#!/usr/bin/env python3
"""YouTube の台本を意味のまとまりで区切り、Gemini API でスライド画像を生成する。

標準ライブラリだけで動く（pip install 不要）。

サブコマンド:
  check    API キーとモデルの疎通を確認する
  prepare  台本を「文」単位に番号付けし、出力フォルダ（~/Downloads/スライド/<日時>_<名前>/）を作る
  render   plan.json（どの文からどの文までを 1 枚にするか＋スライドの文言）に従って画像を生成する
           --dry-run で API を呼ばずに検証と対応表の作成だけ行う

典型的な流れ:
  python3 text_to_slide.py prepare 台本.txt --name 動画タイトル
  （出力フォルダに plan.json を書く）
  python3 text_to_slide.py render ~/Downloads/スライド/20261003-1530_動画タイトル --dry-run
  python3 text_to_slide.py render ~/Downloads/スライド/20261003-1530_動画タイトル
"""

from __future__ import annotations

import argparse
import base64
import concurrent.futures as cf
import datetime as dt
import hashlib
import html
import json
import os
import random
import re
import ssl
import sys
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_MODEL = "gemini-3-pro-image"  # Nano Banana Pro: 日本語の文字描画が最も安定
DEFAULT_SIZE = "2K"
DEFAULT_ASPECT = "16:9"
DEFAULT_WORKERS = 4
DEFAULT_API_BASE = "https://generativelanguage.googleapis.com/v1beta"
MAX_ATTEMPTS = 4
REQUEST_TIMEOUT = 300

SKILL_DIR = Path(__file__).resolve().parent.parent
WORK_DIR = "_work"
PLAN_FILE = "plan.json"
SENTENCES_FILE = "sentences.json"
STATE_FILE = "state.json"
MAPPING_FILE = "台本対応表.md"
PREVIEW_FILE = "index.html"

MIME_BY_EXT = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}
EXT_BY_MIME = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}
ASPECTS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]
SIZES = ["512", "1K", "2K", "4K"]

DEFAULT_STYLE = (
    "Clean, modern flat design in the style of high-quality Japanese YouTube explainer videos. "
    "Background: warm off-white (#F8F7F3). Main text: deep navy (#1E2A3A). "
    "One accent color, vivid orange (#FF7A1A), used only for key words, numbers and highlights. "
    "Secondary: pale blue-gray panels (#E7EDF3) with softly rounded corners. "
    "Typography: heavy, bold Japanese gothic sans-serif (like Noto Sans JP Black) for titles and bold gothic "
    "for body text, high contrast. On content slides the title sits at the top-left with a short orange accent "
    "bar under it. Illustrations: simple flat vector illustrations and line icons using only the palette colors; "
    "no photographs, no 3D renders, no heavy gradients or drop shadows."
)

LAYOUTS = {
    "title": (
        "Title slide. A large title in the center (or left-center), the subtitle below it, and one bold key "
        "visual that represents the topic. No bullet list."
    ),
    "bullets": (
        "Title at the top. Below it, the points as a short vertical list, each with a simple icon or number "
        "marker, on the left ~60% of the slide; a supporting illustration on the right."
    ),
    "steps": (
        "Title at the top. The points as numbered steps: cards arranged left-to-right and connected by arrows "
        "(top-to-bottom if there are more than 4). Each card shows a big step number and the point text."
    ),
    "comparison": (
        "Title at the top. Two side-by-side panels contrasting two things (before vs after, bad vs good, A vs B) "
        "as described in [VISUAL]. Use a muted gray for the weaker side and the accent color for the "
        "recommended side."
    ),
    "big_number": (
        "One huge focal element: the first point (a number, percentage or very short key phrase) set extremely "
        "large in the accent color in the center, the title above it, and any remaining point as a one-line "
        "explanation below it."
    ),
    "quote": (
        "One key message as a large centerpiece with decorative quotation marks. The first point is the "
        "message; the title is small at the top."
    ),
    "diagram": (
        "Title at the top. A simple diagram (flow, cycle, hierarchy, Venn or relationship map, as described in "
        "[VISUAL]) whose nodes are labeled with the points, with small icons."
    ),
    "image": (
        "Visual-first slide: a large illustration described in [VISUAL] fills most of the slide; the title is a "
        "bold caption band; points, if any, are small labels on the illustration."
    ),
    "summary": (
        "Recap slide. Title at the top and the points as a checklist with bold check-mark icons, evenly spaced, "
        "in a large readable size."
    ),
    "cta": (
        "Closing call-to-action slide (subscribe / comment / next video). A big friendly message and simple "
        "icons such as a bell, a thumbs-up and a speech bubble. No YouTube logo or any other trademark."
    ),
}
DEFAULT_LAYOUT = "bullets"


class UserError(Exception):
    """利用者が直せるエラー（メッセージだけ表示して終了する）。"""


# ---------------------------------------------------------------------------
# 入出力ユーティリティ
# ---------------------------------------------------------------------------


def read_text_file(path: str) -> str:
    if path == "-":
        data = sys.stdin.buffer.read()
    else:
        p = Path(path).expanduser()
        if not p.is_file():
            raise UserError(f"台本ファイルが見つかりません: {p}")
        data = p.read_bytes()
    for enc in ("utf-8-sig", "cp932"):  # Windows のメモ帳で保存した Shift_JIS にも対応
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    raise UserError("台本の文字コードを判別できません。UTF-8 で保存し直してください。")


def write_json(path: Path, data) -> None:
    write_text(path, json.dumps(data, ensure_ascii=False, indent=2) + "\n")


def write_text(path: Path, text: str) -> None:
    write_bytes(path, text.encode("utf-8"))


def write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def load_json(path: Path, what: str):
    if not path.is_file():
        raise UserError(f"{what} が見つかりません: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise UserError(f"{what} の JSON が壊れています（{path} {e.lineno}行目 {e.colno}文字目）: {e.msg}") from e


def default_out_root() -> Path:
    env = os.environ.get("TEXT_TO_SLIDE_OUT", "").strip()
    if env:
        return Path(env).expanduser()
    home = Path.home()
    for name in ("Downloads", "ダウンロード"):
        if (home / name).is_dir():
            return home / name / "スライド"
    return home / "Downloads" / "スライド"


def safe_name(name: str, limit: int = 40) -> str:
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', "", name).strip().strip(".")
    name = re.sub(r"\s+", "_", name)
    return name[:limit] or "slides"


def slide_stem(index: int, total: int) -> str:
    return f"slide_{index:0{max(2, len(str(total)))}d}"


def find_slide_file(deck: Path, stem: str) -> Path | None:
    for ext in (".png", ".jpg", ".webp"):
        p = deck / (stem + ext)
        if p.is_file():
            return p
    return None


# ---------------------------------------------------------------------------
# 文分割
# ---------------------------------------------------------------------------

_TERMINATORS = "。！？!?．"
_CLOSERS = "」』）)】〕〉》”’\"'"
_OPENERS = {"「": "」", "『": "』", "（": "）", "(": ")", "【": "】", "〔": "〕", "〈": "〉", "《": "》", "“": "”"}
_ABBREVIATIONS = {"mr", "mrs", "ms", "dr", "prof", "st", "vs", "etc", "e.g", "i.e", "no", "fig", "approx"}
_SEPARATOR_LINE = re.compile(r"^[\s\-=*_~#・＊ー─━―.。…]+$")
_UNCLOSED_BRACKET_LIMIT = 120  # 括弧が閉じないまま長く続いたら、閉じ忘れとみなして句点で区切る


def split_sentences(text: str) -> list[str]:
    """台本を文に分ける。改行は必ず区切り、括弧の中の「。」「？」では区切らない。"""
    sentences: list[str] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or _SEPARATOR_LINE.match(line):
            continue
        line = re.sub(r"^#{1,6}\s+", "", line)  # Markdown の見出し記号
        sentences.extend(_split_line(line))
    return sentences


def _is_terminator(line: str, i: int) -> bool:
    ch = line[i]
    if ch in _TERMINATORS:
        return True
    if ch != ".":
        return False
    j = i + 1
    while j < len(line) and line[j] in _CLOSERS:
        j += 1
    if j < len(line) and not line[j].isspace():
        return False  # 3.5 や example.com
    m = re.search(r"(?<![A-Za-z])([A-Za-z][A-Za-z.]{0,5})$", line[:i])
    return not (m and m.group(1).lower() in _ABBREVIATIONS)


def _split_line(line: str) -> list[str]:
    out: list[str] = []
    buf: list[str] = []
    stack: list[str] = []
    i, n = 0, len(line)
    while i < n:
        ch = line[i]
        buf.append(ch)
        if ch in _OPENERS:
            stack.append(_OPENERS[ch])
        elif ch in stack:
            while stack and stack.pop() != ch:
                pass
        if stack and ch == "。" and len(buf) > _UNCLOSED_BRACKET_LIMIT:
            stack.clear()
        # 「（ここ重要です。）」のように丸括弧ごと 1 文になっているものは、閉じ括弧の後で区切る
        # （「〜？」と言った のように鉤括弧の後は文が続くことが多いので対象外）
        closes_paren_sentence = ch in "）)" and not stack and len(buf) >= 2 and buf[-2] in _TERMINATORS
        if not stack and (closes_paren_sentence or _is_terminator(line, i)):
            j = i + 1
            while j < n and (line[j] in _TERMINATORS or line[j] in _CLOSERS):
                buf.append(line[j])
                j += 1
            sentence = "".join(buf).strip()
            if sentence:
                out.append(sentence)
            buf = []
            i = j
            continue
        i += 1
    rest = "".join(buf).strip()
    if rest:
        out.append(rest)
    return out


def detect_language(text: str) -> str:
    letters = [c for c in text if not c.isspace()]
    if not letters:
        return "Japanese"
    cjk = sum(1 for c in letters if "぀" <= c <= "ヿ" or "一" <= c <= "鿿")
    return "Japanese" if cjk / len(letters) > 0.2 else "English"


def narration_seconds(text: str, language: str) -> float:
    if language == "Japanese":
        return len(re.sub(r"\s", "", text)) / 5.0  # 約300字/分
    return len(text.split()) / 2.5  # 約150語/分


def fmt_duration(seconds: float) -> str:
    s = int(round(seconds))
    return f"{s // 60}分{s % 60:02d}秒"


# ---------------------------------------------------------------------------
# plan.json の検証
# ---------------------------------------------------------------------------


def validate_plan(plan, sentences: list[dict]) -> tuple[list[dict], list[str], list[str]]:
    """plan を検証し、(スライド一覧, エラー, 警告) を返す。スライドには台本の該当部分を付ける。"""
    errors: list[str] = []
    warnings: list[str] = []
    total = len(sentences)
    if not isinstance(plan, dict):
        return [], ["plan.json の一番外側は {...}（オブジェクト）にしてください。"], []
    if not str(plan.get("deck_title", "")).strip():
        errors.append("deck_title（動画・デッキのタイトル）が空です。")
    raw_slides = plan.get("slides")
    if not isinstance(raw_slides, list) or not raw_slides:
        errors.append("slides が空です。1 枚以上のスライドを定義してください。")
        return [], errors, warnings

    language = plan.get("language") or detect_language("".join(s["text"] for s in sentences))
    title_limit, point_limit = (20, 28) if language == "Japanese" else (60, 70)
    slides: list[dict] = []
    expected_from = 1
    for idx, raw in enumerate(raw_slides, start=1):
        label = f"スライド{idx}"
        if not isinstance(raw, dict):
            errors.append(f"{label}: {{...}} の形で書いてください。")
            continue
        start, end = raw.get("from"), raw.get("to")
        if not isinstance(start, int) or not isinstance(end, int) or isinstance(start, bool) or isinstance(end, bool):
            errors.append(f"{label}: from / to には文番号（整数）を入れてください。")
            continue
        if start > end:
            errors.append(f"{label}: from={start} が to={end} より大きくなっています。")
        elif start != expected_from:
            if start > expected_from:
                gap = f"文{expected_from}" if start - 1 == expected_from else f"文{expected_from}〜{start - 1}"
                errors.append(f"{label}: from={start} ですが {gap} がどのスライドにも入っていません。")
            else:
                errors.append(f"{label}: from={start} が前のスライドと重なっています（文{expected_from}から始めてください）。")
        if end > total:
            errors.append(f"{label}: to={end} ですが台本は文{total}までです。")
        expected_from = max(expected_from, end + 1)

        title = raw.get("title")
        if not isinstance(title, str) or not title.strip():
            errors.append(f"{label}: title が空です。")
            title = ""
        subtitle = raw.get("subtitle") or ""
        points = raw.get("points") or []
        highlight = raw.get("highlight") or []
        if not isinstance(subtitle, str):
            errors.append(f"{label}: subtitle は文字列にしてください。")
            subtitle = ""
        if not isinstance(points, list) or not all(isinstance(p, str) for p in points):
            errors.append(f"{label}: points は文字列の配列にしてください。")
            points = []
        if not isinstance(highlight, list) or not all(isinstance(h, str) for h in highlight):
            errors.append(f"{label}: highlight は文字列の配列にしてください。")
            highlight = []
        layout = raw.get("layout") or DEFAULT_LAYOUT
        if layout not in LAYOUTS:
            warnings.append(f"{label}: layout「{layout}」は未定義なので {DEFAULT_LAYOUT} として扱います。")
            layout = DEFAULT_LAYOUT

        if len(title) > title_limit:
            warnings.append(f"{label}: タイトルが{len(title)}字あります（{title_limit}字以内だと崩れにくい）。")
        if len(points) > 5:
            warnings.append(f"{label}: 箇条書きが{len(points)}個あります（4個以内推奨）。")
        for p in points:
            if len(p) > point_limit:
                warnings.append(f"{label}: 箇条書き「{p[:12]}…」が{len(p)}字あります（{point_limit}字以内推奨）。")
        on_slide = "\n".join([title, subtitle, *points])
        for h in highlight:
            if h not in on_slide:
                warnings.append(f"{label}: highlight「{h}」がスライドの文言に含まれていません。")

        narration = ""
        if 1 <= start <= end <= total:
            narration = "".join(s["text"] for s in sentences[start - 1:end]) if language == "Japanese" else " ".join(
                s["text"] for s in sentences[start - 1:end]
            )
        slides.append(
            {
                "index": idx,
                "from": start,
                "to": end,
                "layout": layout,
                "title": title.strip(),
                "subtitle": subtitle.strip(),
                "points": [p.strip() for p in points if p.strip()],
                "highlight": [h.strip() for h in highlight if h.strip()],
                "visual": str(raw.get("visual") or "").strip(),
                "notes": str(raw.get("notes") or "").strip(),
                "narration": narration,
                "seconds": narration_seconds(narration, language),
            }
        )
    if not errors and expected_from <= total:
        gap = f"文{expected_from}" if expected_from == total else f"文{expected_from}〜{total}"
        errors.append(f"最後のスライドが to={expected_from - 1} で終わっていて、{gap} がどのスライドにも入っていません。")
    if not errors:
        for s in slides:
            if s["seconds"] > 75:
                warnings.append(f"スライド{s['index']}: ナレーションが約{int(s['seconds'])}秒あります。分けられる切れ目がないか確認してください。")
    for s in slides:
        s["language"] = language
    return slides, errors, warnings


# ---------------------------------------------------------------------------
# プロンプト
# ---------------------------------------------------------------------------


def build_prompt(slide: dict, total: int, deck_title: str, style: str, aspect: str, reference: str | None) -> str:
    language = slide["language"]
    lines = [
        f"Create a single presentation slide image for a YouTube explainer video (aspect ratio {aspect}).",
        f'This is slide {slide["index"]} of {total} in the deck "{deck_title}". '
        "Every slide in the deck shares one consistent design system.",
        "",
        "[TEXT ON THE SLIDE]",
        f"Render exactly the following {language} text, character-for-character - nothing more, nothing less.",
        "The labels (Title, Subtitle, Point) and the double quotes are NOT part of the text.",
        f'- Title: "{slide["title"]}"',
    ]
    if slide["subtitle"]:
        lines.append(f'- Subtitle: "{slide["subtitle"]}"')
    for n, point in enumerate(slide["points"], start=1):
        lines.append(f'- Point {n}: "{point}"')
    if slide["highlight"]:
        words = ", ".join(f'"{h}"' for h in slide["highlight"])
        lines.append(f"Emphasize these words in the accent color: {words}")
    lines += ["", "[LAYOUT]", LAYOUTS[slide["layout"]], "", "[VISUAL]"]
    lines.append(slide["visual"] or "A simple flat illustration or a small set of icons that supports the message.")
    lines += ["", "[DESIGN SYSTEM]", style]
    if reference:
        lines += [
            "",
            "[STYLE REFERENCE]",
            f"The attached image is {reference}. Match its background, color palette, typography (font family, "
            "weights, relative sizes), title treatment and decorative motifs so the slides look like one deck. "
            "Do NOT copy its text, its illustration subject or its layout - follow [LAYOUT] above.",
        ]
    lines += [
        "",
        "[RULES]",
        "- No text other than the text listed above: no page numbers, captions, labels, logos, watermarks, URLs "
        "or placeholder text.",
    ]
    if language == "Japanese":
        lines.append(
            "- Japanese characters must be correct, crisp and legible - no garbled, invented or misspelled kanji, "
            "and no Chinese-style glyph variants."
        )
    lines += [
        "- Large, bold type readable on a smartphone screen; generous margins (keep all text at least 5% away "
        "from every edge).",
        "- A flat, full-bleed slide that fills the entire canvas: not a photo or mockup of a slide, no device "
        "frame, no perspective, no outer border.",
    ]
    if slide["notes"]:
        lines.append(f"- {slide['notes']}")
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Gemini API
# ---------------------------------------------------------------------------


class ApiError(Exception):
    def __init__(self, message: str, *, retryable: bool = False, fatal: bool = False, retry_after: float | None = None):
        super().__init__(message)
        self.retryable = retryable
        self.fatal = fatal
        self.retry_after = retry_after


def api_base() -> str:
    return os.environ.get("GEMINI_API_BASE", DEFAULT_API_BASE).rstrip("/")


def load_api_key() -> str | None:
    for var in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
        value = os.environ.get(var, "").strip()
        if value:
            return value
    env_file = SKILL_DIR / ".env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            m = re.match(r"\s*(?:export\s+)?(?:GEMINI_API_KEY|GOOGLE_API_KEY)\s*=\s*(.*)$", line)
            if m and m.group(1).strip().strip("'\""):
                return m.group(1).strip().strip("'\"")
    return None


def require_api_key() -> str:
    key = load_api_key()
    if not key:
        raise UserError(
            "Gemini の API キーが見つかりません。\n"
            "  1. https://aistudio.google.com/apikey でキーを発行\n"
            "  2. ターミナルで export GEMINI_API_KEY='発行したキー'（~/.zshrc に書くと毎回不要）\n"
            f"     または {SKILL_DIR / '.env'} に GEMINI_API_KEY=発行したキー と書く\n"
            "  3. Claude Code を起動し直してもう一度実行"
        )
    return key


_ssl_context: ssl.SSLContext | None = None


def ssl_context() -> ssl.SSLContext:
    global _ssl_context
    if _ssl_context is None:
        ctx = ssl.create_default_context()
        try:  # python.org 版の macOS Python はシステムの証明書を読まないため certifi があれば足す
            import certifi  # type: ignore

            ctx.load_verify_locations(certifi.where())
        except Exception:
            pass
        _ssl_context = ctx
    return _ssl_context


def _parse_retry_delay(payload: dict) -> float | None:
    for detail in payload.get("error", {}).get("details", []) or []:
        delay = detail.get("retryDelay") if isinstance(detail, dict) else None
        if isinstance(delay, str) and delay.endswith("s"):
            try:
                return float(delay[:-1])
            except ValueError:
                pass
    return None


def http_json(method: str, url: str, api_key: str, body: dict | None = None, timeout: float = REQUEST_TIMEOUT) -> dict:
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=ssl_context()) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            payload = {}
        message = payload.get("error", {}).get("message") or raw[:300] or e.reason
        retry_after = _parse_retry_delay(payload)
        if retry_after is None and e.headers.get("Retry-After", "").isdigit():
            retry_after = float(e.headers["Retry-After"])
        if e.code in (429, 500, 502, 503, 504):
            raise ApiError(f"HTTP {e.code}: {message}", retryable=True, retry_after=retry_after) from None
        fatal = e.code in (401, 403, 404) or "API key" in message
        raise ApiError(f"HTTP {e.code}: {message}", fatal=fatal) from None
    except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
        reason = getattr(e, "reason", e)
        if isinstance(reason, ssl.SSLCertVerificationError):
            raise ApiError(
                f"SSL 証明書の検証に失敗しました: {reason}\n"
                "macOS で python.org 版の Python を使っている場合は「Install Certificates.command」を実行するか、"
                "pip3 install certifi を実行してください。",
                fatal=True,
            ) from None
        raise ApiError(f"通信エラー: {reason}", retryable=True) from None


def supports_image_size(model: str) -> bool:
    return not model.startswith("gemini-2.") and "flash-lite" not in model


def extract_image(payload: dict) -> tuple[bytes, str]:
    """generateContent のレスポンスから最終画像（思考途中の画像は除く）を取り出す。"""
    candidates = payload.get("candidates") or []
    if not candidates:
        reason = (payload.get("promptFeedback") or {}).get("blockReason")
        raise ApiError(f"プロンプトがブロックされました（{reason or '理由不明'}）", retryable=bool(reason is None))
    candidate = candidates[0]
    parts = (candidate.get("content") or {}).get("parts") or []
    images = []
    texts = []
    for part in parts:
        inline = part.get("inlineData") or part.get("inline_data")
        if inline and inline.get("data") and not part.get("thought"):
            images.append(inline)
        elif part.get("text") and not part.get("thought"):
            texts.append(part["text"].strip())
    if not images:
        reason = candidate.get("finishReason", "")
        said = f" / モデルの返答: {' '.join(texts)[:200]}" if texts else ""
        raise ApiError(f"画像が返ってきませんでした（finishReason={reason or '不明'}）{said}", retryable=True)
    inline = images[-1]
    mime = inline.get("mimeType") or inline.get("mime_type") or "image/png"
    return base64.b64decode(inline["data"]), mime


def generate_image(api_key: str, model: str, prompt: str, reference: tuple[bytes, str] | None, aspect: str, size: str) -> tuple[bytes, str]:
    parts: list[dict] = []
    if reference:
        data, mime = reference
        parts.append({"inlineData": {"mimeType": mime, "data": base64.b64encode(data).decode("ascii")}})
    parts.append({"text": prompt})
    image_config = {"aspectRatio": aspect}
    if size and supports_image_size(model):
        image_config["imageSize"] = size
    body = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {"responseModalities": ["TEXT", "IMAGE"], "imageConfig": image_config},
    }
    payload = http_json("POST", f"{api_base()}/models/{model}:generateContent", api_key, body)
    return extract_image(payload)


def generate_with_retry(log, label: str, abort: threading.Event, **kwargs) -> tuple[bytes, str]:
    for attempt in range(1, MAX_ATTEMPTS + 1):
        if abort.is_set():
            raise ApiError("中断しました（他のスライドで致命的なエラー）", fatal=True)
        try:
            return generate_image(**kwargs)
        except ApiError as e:
            if e.fatal or not e.retryable or attempt == MAX_ATTEMPTS:
                raise
            wait = e.retry_after if e.retry_after is not None else 5 * 3 ** (attempt - 1)
            wait = min(wait, 90) + random.uniform(0, 2)
            log(f"  … {label}: {e}（{wait:.0f}秒後に再試行 {attempt + 1}/{MAX_ATTEMPTS}）")
            time.sleep(wait)
    raise AssertionError("unreachable")


# ---------------------------------------------------------------------------
# 出力（対応表・プレビュー）
# ---------------------------------------------------------------------------


def write_mapping(deck: Path, deck_title: str, slides: list[dict], files: dict[int, str]) -> None:
    total_seconds = sum(s["seconds"] for s in slides)
    out = [
        f"# {deck_title}",
        "",
        f"スライド {len(slides)} 枚 / ナレーション推定 {fmt_duration(total_seconds)}",
        "",
        "| No | ファイル | タイトル | 台本の文 | 推定尺 |",
        "|---:|---|---|---|---:|",
    ]
    for s in slides:
        name = files.get(s["index"], "（未生成）")
        title = s["title"].replace("|", "｜")
        out.append(f"| {s['index']} | {name} | {title} | {s['from']}〜{s['to']} | {int(round(s['seconds']))}秒 |")
    for s in slides:
        out += ["", f"## {s['index']}. {s['title']}", ""]
        if s["index"] in files:
            out += [f"![{s['title']}]({files[s['index']]})", ""]
        out += [f"> {line}" for line in s["narration"].splitlines() or [""]]
    write_text(deck / MAPPING_FILE, "\n".join(out) + "\n")


def write_preview(deck: Path, deck_title: str, slides: list[dict], files: dict[int, str], model: str) -> None:
    esc = html.escape
    cards = []
    for s in slides:
        if s["index"] in files:
            src = esc(files[s["index"]])
            media = f'<a href="{src}" target="_blank"><img src="{src}" alt="{esc(s["title"])}" loading="lazy"></a>'
        else:
            media = '<div class="missing">未生成</div>'
        cards.append(
            f'<section class="card"><div class="media">{media}</div><div class="body">'
            f'<p class="meta">{s["index"]:02d} ・ 文{s["from"]}〜{s["to"]} ・ 約{int(round(s["seconds"]))}秒 ・ {esc(s["layout"])}</p>'
            f'<h2>{esc(s["title"])}</h2><p class="narration">{esc(s["narration"])}</p></div></section>'
        )
    page = f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(deck_title)}</title>
<style>
:root {{ --bg:#f6f6f3; --card:#fff; --text:#1e2a3a; --muted:#6b7280; --line:#e5e7eb; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#111418; --card:#1b2027; --text:#e8ecf1; --muted:#9aa4b2; --line:#2a313b; }} }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--text); font-family:system-ui,-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif; }}
header {{ max-width:1200px; margin:0 auto; padding:24px 16px 8px; }}
header h1 {{ margin:0 0 4px; font-size:1.5rem; }}
header p {{ margin:0; color:var(--muted); }}
main {{ max-width:1200px; margin:0 auto; padding:16px; display:grid; gap:16px; }}
.card {{ display:grid; grid-template-columns:minmax(0,3fr) minmax(0,2fr); gap:16px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px; }}
.media img {{ width:100%; display:block; border-radius:8px; }}
.missing {{ aspect-ratio:16/9; display:grid; place-items:center; border:2px dashed var(--line); border-radius:8px; color:var(--muted); }}
.meta {{ margin:0; color:var(--muted); font-size:.85rem; }}
.body h2 {{ margin:4px 0 8px; font-size:1.1rem; }}
.narration {{ margin:0; line-height:1.8; white-space:pre-wrap; }}
@media (max-width:760px) {{ .card {{ grid-template-columns:1fr; }} }}
</style></head><body>
<header><h1>{esc(deck_title)}</h1><p>{len(slides)}枚 ・ ナレーション推定 {fmt_duration(sum(s["seconds"] for s in slides))} ・ {esc(model)}</p></header>
<main>
{chr(10).join(cards)}
</main></body></html>
"""
    write_text(deck / PREVIEW_FILE, page)


# ---------------------------------------------------------------------------
# サブコマンド
# ---------------------------------------------------------------------------


def cmd_prepare(args) -> int:
    text = read_text_file(args.input)
    sentences = split_sentences(text)
    if not sentences:
        raise UserError("台本が空です。")
    if args.name:
        name = args.name
    elif args.input != "-":
        name = Path(args.input).stem
    else:
        name = "slides"
    out_root = Path(args.out_root).expanduser() if args.out_root else default_out_root()
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    deck = out_root / f"{stamp}_{safe_name(name)}"
    suffix = 2
    while deck.exists():
        deck = out_root / f"{stamp}_{safe_name(name)}-{suffix}"
        suffix += 1
    work = deck / WORK_DIR
    work.mkdir(parents=True)
    write_text(work / "source.txt", text)
    language = detect_language("".join(sentences))
    write_json(work / SENTENCES_FILE, {
        "language": language,
        "sentences": [{"id": i, "text": s} for i, s in enumerate(sentences, start=1)],
    })

    joined = ("" if language == "Japanese" else " ").join(sentences)
    seconds = narration_seconds(joined, language)
    low = max(1, min(len(sentences), round(seconds / 40)))
    high = max(low, min(len(sentences), round(seconds / 20)))
    print(f"出力フォルダ: {deck}")
    print(f"plan.json の保存先: {deck / PLAN_FILE}")
    char_count = len(re.sub(r"\s", "", text))
    print(f"言語: {language} / 文の数: {len(sentences)} / 文字数: {char_count} / "
          f"推定尺: {fmt_duration(seconds)} / 目安スライド枚数: {low}〜{high}枚")
    long_ones = [i for i, s in enumerate(sentences, start=1) if len(s) > 200]
    if long_ones:
        print(f"注意: 200字を超える文があります（文{', '.join(map(str, long_ones))}）。句読点のない台本なら、"
              "言葉を変えずに句点を補った台本で prepare し直すと区切りやすくなります。")
    print()
    for i, s in enumerate(sentences, start=1):
        print(f"[{i}] {s}")
    return 0


def parse_only(value: str | None, total: int) -> set[int] | None:
    if not value:
        return None
    picked: set[int] = set()
    for chunk in value.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        m = re.fullmatch(r"(\d+)(?:-(\d+))?", chunk)
        if not m:
            raise UserError(f"--only の書き方が不正です: {chunk}（例: --only 3 / --only 2,5-7）")
        a, b = int(m.group(1)), int(m.group(2) or m.group(1))
        if a < 1 or b > total or a > b:
            raise UserError(f"--only の範囲 {chunk} がスライド 1〜{total} の外です。")
        picked.update(range(a, b + 1))
    return picked


def cmd_render(args) -> int:
    deck = Path(args.deck).expanduser().resolve()
    work = deck / WORK_DIR
    sentence_data = load_json(work / SENTENCES_FILE, SENTENCES_FILE)
    sentences = sentence_data["sentences"]
    plan = load_json(deck / PLAN_FILE, PLAN_FILE)
    slides, errors, warnings = validate_plan(plan, sentences)
    for w in warnings:
        print(f"警告: {w}")
    if errors:
        for e in errors:
            print(f"エラー: {e}")
        print("plan.json を直してから、もう一度実行してください。")
        return 2

    model = args.model or os.environ.get("TEXT_TO_SLIDE_MODEL") or DEFAULT_MODEL
    if args.aspect not in ASPECTS:
        raise UserError(f"--aspect は {', '.join(ASPECTS)} のどれかにしてください。")
    if args.size not in SIZES:
        raise UserError(f"--size は {', '.join(SIZES)} のどれかにしてください。")
    deck_title = str(plan["deck_title"]).strip()
    style = (args.style or str(plan.get("style") or "").strip() or DEFAULT_STYLE).strip()
    total = len(slides)

    style_image: tuple[bytes, str] | None = None
    if args.style_image:
        p = Path(args.style_image).expanduser()
        if not p.is_file():
            raise UserError(f"--style-image の画像が見つかりません: {p}")
        mime = MIME_BY_EXT.get(p.suffix.lower(), "image/png")
        style_image = (p.read_bytes(), mime)

    def reference_label(slide: dict) -> str | None:
        if style_image:
            return "the brand style reference for this deck"
        if args.no_style_ref or slide["index"] == 1:
            return None
        return "slide 1 of this same deck"

    prompts = {s["index"]: build_prompt(s, total, deck_title, style, args.aspect, reference_label(s)) for s in slides}
    for s in slides:
        write_text(work / "prompts" / f"{slide_stem(s['index'], total)}.txt", prompts[s["index"]])

    def fingerprint(index: int) -> str:
        return hashlib.sha256(f"{model}\n{args.aspect}\n{args.size}\n{prompts[index]}".encode()).hexdigest()

    state_path = work / STATE_FILE
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.is_file() else {"slides": {}}
    files: dict[int, str] = {}
    for s in slides:
        f = find_slide_file(deck, slide_stem(s["index"], total))
        if f:
            files[s["index"]] = f.name

    if args.dry_run:
        write_mapping(deck, deck_title, slides, files)
        write_preview(deck, deck_title, slides, files, model)
        print(f"検証 OK: {total}枚 / ナレーション推定 {fmt_duration(sum(s['seconds'] for s in slides))} / モデル {model}")
        for s in slides:
            print(f"  {s['index']:>2}. [{s['layout']}] {s['title']}（文{s['from']}〜{s['to']}・約{int(round(s['seconds']))}秒）")
        print(f"プロンプト: {work / 'prompts'}")
        print(f"対応表: {deck / MAPPING_FILE}")
        return 0

    api_key = require_api_key()
    only = parse_only(args.only, total)
    targets = []
    for s in slides:
        i = s["index"]
        if only is not None:
            if i in only:
                targets.append(s)
            continue
        saved = state["slides"].get(str(i), {})
        if args.force or i not in files or saved.get("fingerprint") != fingerprint(i) or saved.get("file") != files.get(i):
            targets.append(s)

    # 枚数が減ったときに残る古い画像を片付ける
    for p in sorted(deck.glob("slide_*.*")):
        m = re.fullmatch(r"slide_(\d+)\.(png|jpg|webp)", p.name)
        if m and (int(m.group(1)) > total or p.stem != slide_stem(int(m.group(1)), total)):
            p.unlink()
    state["slides"] = {k: v for k, v in state["slides"].items() if k.isdigit() and int(k) <= total}

    print(f"モデル: {model} / {args.aspect} / {args.size} / 生成 {len(targets)}枚（全{total}枚、既存 {total - len(targets)}枚は再利用）")
    print(f"出力先: {deck}")
    lock = threading.Lock()
    abort = threading.Event()
    failures: dict[int, str] = {}

    def log(msg: str) -> None:
        with lock:
            print(msg, flush=True)

    def run(slide: dict, reference: tuple[bytes, str] | None) -> None:
        i = slide["index"]
        stem = slide_stem(i, total)
        started = time.time()
        log(f"→ {stem} 生成中: {slide['title']}")
        try:
            data, mime = generate_with_retry(
                log, stem, abort,
                api_key=api_key, model=model, prompt=prompts[i], reference=reference,
                aspect=args.aspect, size=args.size,
            )
        except ApiError as e:
            with lock:
                failures[i] = str(e)
                print(f"✗ {stem}: {e}", flush=True)
            if e.fatal:
                abort.set()
            return
        ext = EXT_BY_MIME.get(mime, ".png")
        for old in (".png", ".jpg", ".webp"):
            if old != ext and (deck / (stem + old)).is_file():
                (deck / (stem + old)).unlink()
        write_bytes(deck / (stem + ext), data)
        with lock:
            files[i] = stem + ext
            state["slides"][str(i)] = {
                "file": stem + ext,
                "fingerprint": fingerprint(i),
                "model": model,
                "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
            }
            write_json(state_path, state)
            print(f"✓ {stem + ext}（{time.time() - started:.0f}秒）", flush=True)

    first = next((s for s in targets if s["index"] == 1), None)
    rest = [s for s in targets if s["index"] != 1]
    if first:
        run(first, style_image)
    reference = style_image
    if reference is None and not args.no_style_ref and rest:
        if 1 in files:
            ref_path = deck / files[1]
            reference = (ref_path.read_bytes(), MIME_BY_EXT[ref_path.suffix])
        else:
            log("注意: 1枚目の画像がないため、デザイン見本なしで生成します。")
            for s in rest:
                prompts[s["index"]] = build_prompt(s, total, deck_title, style, args.aspect, None)
                write_text(work / "prompts" / f"{slide_stem(s['index'], total)}.txt", prompts[s["index"]])
    if rest and not abort.is_set():
        with cf.ThreadPoolExecutor(max_workers=max(1, args.workers)) as pool:
            list(pool.map(lambda s: run(s, reference), rest))

    write_mapping(deck, deck_title, slides, files)
    write_preview(deck, deck_title, slides, files, model)
    print()
    print(f"完了: {len(files)}/{total}枚 → {deck}")
    print(f"プレビュー: {deck / PREVIEW_FILE}")
    print(f"対応表: {deck / MAPPING_FILE}")
    if failures:
        print(f"失敗: {', '.join(str(i) for i in sorted(failures))}（同じコマンドをもう一度実行すると失敗分だけ再生成します）")
        return 1
    return 0


def cmd_check(args) -> int:
    api_key = require_api_key()
    model = args.model or os.environ.get("TEXT_TO_SLIDE_MODEL") or DEFAULT_MODEL
    try:
        info = http_json("GET", f"{api_base()}/models/{model}", api_key, timeout=30)
    except ApiError as e:
        print(f"NG: {model} を確認できませんでした — {e}")
        if "404" in str(e):
            try:
                listing = http_json("GET", f"{api_base()}/models?pageSize=1000", api_key, timeout=30)
                names = [m["name"].split("/", 1)[-1] for m in listing.get("models", []) if "image" in m.get("name", "")]
                if names:
                    print("このキーで使える画像系モデル: " + ", ".join(names))
            except ApiError:
                pass
        return 1
    print(f"OK: API キー有効 / モデル {model}（{info.get('displayName', '')}）")
    return 0


def main(argv: list[str] | None = None) -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="YouTube 台本 → Gemini でスライド画像を生成")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("check", help="API キーとモデルの疎通確認")
    p.add_argument("--model")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("prepare", help="台本を文に分けて番号を振り、出力フォルダを作る")
    p.add_argument("input", help="台本ファイルのパス（- で標準入力）")
    p.add_argument("--name", help="出力フォルダ名に使う名前（省略時はファイル名）")
    p.add_argument("--out-root", help=f"保存先の親フォルダ（既定: {default_out_root()}）")
    p.set_defaults(func=cmd_prepare)

    p = sub.add_parser("render", help="plan.json に従ってスライド画像を生成する")
    p.add_argument("deck", help="prepare が作った出力フォルダ")
    p.add_argument("--model", help=f"画像モデル（既定: {DEFAULT_MODEL}、環境変数 TEXT_TO_SLIDE_MODEL でも指定可）")
    p.add_argument("--size", default=DEFAULT_SIZE, help=f"解像度 {'/'.join(SIZES)}（既定: {DEFAULT_SIZE}）")
    p.add_argument("--aspect", default=DEFAULT_ASPECT, help=f"アスペクト比（既定: {DEFAULT_ASPECT}）")
    p.add_argument("--workers", type=int, default=DEFAULT_WORKERS, help=f"同時生成数（既定: {DEFAULT_WORKERS}）")
    p.add_argument("--only", help="指定したスライドだけ作り直す（例: 3 / 2,5-7）")
    p.add_argument("--force", action="store_true", help="既存の画像があっても全部作り直す")
    p.add_argument("--style", help="デザインの指示（plan.json の style より優先）")
    p.add_argument("--style-image", help="デザインの見本にする画像（全スライドに添付）")
    p.add_argument("--no-style-ref", action="store_true", help="1枚目をデザイン見本として添付しない")
    p.add_argument("--dry-run", action="store_true", help="API を呼ばずに検証・プロンプト作成・対応表作成だけ行う")
    p.set_defaults(func=cmd_render)

    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except UserError as e:
        print(f"エラー: {e}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("\n中断しました。もう一度 render を実行すると、できていない分だけ生成します。", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
