"""text_to_slide.py のテスト。

  python3 -m unittest discover -s .claude/skills/text-to-slide/tests -v

Gemini API はローカルのモックサーバーで置き換えるので、API キーもネットワークも不要。
"""

from __future__ import annotations

import base64
import contextlib
import io
import json
import os
import struct
import sys
import tempfile
import threading
import unittest
import zlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import text_to_slide as tts  # noqa: E402

SAMPLE = """# サムネイルの話
こんにちは、デザイナーのミナトです。
今日は「クリックされるサムネイル」の作り方を3つ紹介します！

1つ目は、文字を7文字以内にすることです。スマホでは文字が小さく見えるからです。
2つ目は、顔のアップを入れること。人は顔に目が行きます。
---
最後に、チャンネル登録もお願いします。
"""


def tiny_png(rgb=(255, 122, 26)) -> bytes:
    raw = b"".join(b"\x00" + bytes(rgb) * 16 for _ in range(9))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 16, 9, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def image_response(png: bytes) -> dict:
    return {"candidates": [{"content": {"parts": [
        {"text": "thinking", "thought": True},
        {"inlineData": {"mimeType": "image/png", "data": base64.b64encode(b"draft").decode()}, "thought": True},
        {"inlineData": {"mimeType": "image/png", "data": base64.b64encode(png).decode()}},
    ]}, "finishReason": "STOP"}]}


class MockGemini:
    """generateContent を受けてモック画像を返す。queue に (status, body) を積むと先にそれを返す。"""

    def __init__(self):
        self.requests: list[dict] = []
        self.queue: list[tuple[int, dict]] = []
        self.png = tiny_png()
        self.lock = threading.Lock()
        mock_self = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                with mock_self.lock:
                    mock_self.requests.append({"path": self.path, "key": self.headers.get("x-goog-api-key"), "body": body})
                    status, payload = mock_self.queue.pop(0) if mock_self.queue else (200, image_response(mock_self.png))
                data = json.dumps(payload).encode()
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.server.shutdown()
        self.server.server_close()

    @property
    def base(self) -> str:
        return f"http://127.0.0.1:{self.server.server_port}/v1beta"


def run_cli(*argv: str) -> tuple[int, str]:
    out = io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
        code = tts.main(list(argv))
    return code, out.getvalue()


class SplitSentencesTest(unittest.TestCase):
    def test_japanese_punctuation_and_quotes(self):
        self.assertEqual(
            tts.split_sentences("こんにちは。今日は「本当？ウソ！」って話です！次へ行きましょう"),
            ["こんにちは。", "今日は「本当？ウソ！」って話です！", "次へ行きましょう"],
        )

    def test_consecutive_marks_stay_together(self):
        self.assertEqual(tts.split_sentences("えっ！？マジで。。すごい…"), ["えっ！？", "マジで。。", "すごい…"])

    def test_closing_bracket_after_terminator(self):
        self.assertEqual(tts.split_sentences("（ここ重要です。）では次。"), ["（ここ重要です。）", "では次。"])

    def test_newlines_headings_and_separators(self):
        self.assertEqual(
            tts.split_sentences("# 第1章\n\n本文です。\n---\n＊＊＊\n続き"),
            ["第1章", "本文です。", "続き"],
        )

    def test_english(self):
        self.assertEqual(
            tts.split_sentences('Hello world. This is 3.5 times faster! Dr. Smith said "yes." Visit example.com today.'),
            ["Hello world.", "This is 3.5 times faster!", 'Dr. Smith said "yes."', "Visit example.com today."],
        )

    def test_unclosed_bracket_does_not_swallow_the_rest(self):
        text = "「" + "あ" * 130 + "。次の文です。"
        self.assertEqual(len(tts.split_sentences(text)), 2)

    def test_language_detection(self):
        self.assertEqual(tts.detect_language("今日はいい天気ですね"), "Japanese")
        self.assertEqual(tts.detect_language("It is a nice day today, isn't it?"), "English")


def sentences_of(n: int) -> list[dict]:
    return [{"id": i, "text": f"文{i}です。"} for i in range(1, n + 1)]


class ValidatePlanTest(unittest.TestCase):
    def plan(self, *ranges, **extra):
        return {"deck_title": "テスト", "slides": [{"from": a, "to": b, "title": f"T{a}", **extra} for a, b in ranges]}

    def test_valid_plan(self):
        slides, errors, warnings = tts.validate_plan(self.plan((1, 2), (3, 5)), sentences_of(5))
        self.assertEqual(errors, [])
        self.assertEqual([s["narration"] for s in slides], ["文1です。文2です。", "文3です。文4です。文5です。"])
        self.assertEqual(slides[0]["layout"], "bullets")

    def test_gap_overlap_and_tail(self):
        _, errors, _ = tts.validate_plan(self.plan((1, 2), (4, 5)), sentences_of(5))
        self.assertTrue(any("文3" in e for e in errors), errors)
        _, errors, _ = tts.validate_plan(self.plan((1, 3), (3, 5)), sentences_of(5))
        self.assertTrue(any("重なって" in e for e in errors), errors)
        _, errors, _ = tts.validate_plan(self.plan((1, 3)), sentences_of(5))
        self.assertTrue(any("文4〜5" in e for e in errors), errors)
        _, errors, _ = tts.validate_plan(self.plan((1, 6)), sentences_of(5))
        self.assertTrue(any("文5まで" in e for e in errors), errors)

    def test_type_errors(self):
        plan = {"deck_title": "", "slides": [{"from": "1", "to": 2, "title": "x"}, {"from": 3, "to": 3, "title": ""}]}
        _, errors, _ = tts.validate_plan(plan, sentences_of(3))
        self.assertTrue(any("deck_title" in e for e in errors))
        self.assertTrue(any("整数" in e for e in errors))
        self.assertTrue(any("title が空" in e for e in errors))

    def test_warnings(self):
        plan = self.plan((1, 1), layout="unknown", highlight=["存在しない語"], points=["あ" * 40])
        _, errors, warnings = tts.validate_plan(plan, sentences_of(1))
        self.assertEqual(errors, [])
        text = "\n".join(warnings)
        self.assertIn("unknown", text)
        self.assertIn("存在しない語", text)
        self.assertIn("40字", text)


class PromptTest(unittest.TestCase):
    def slide(self, **kw):
        base = {"index": 2, "layout": "steps", "title": "3つのコツ", "subtitle": "", "points": ["短く", "顔を入れる"],
                "highlight": ["顔"], "visual": "サムネイルの例", "notes": "", "language": "Japanese"}
        base.update(kw)
        return base

    def test_prompt_contents(self):
        prompt = tts.build_prompt(self.slide(), 5, "サムネ講座", tts.DEFAULT_STYLE, "16:9", None)
        for expected in ['Title: "3つのコツ"', 'Point 2: "顔を入れる"', '"顔"', "slide 2 of 5", "16:9",
                         tts.LAYOUTS["steps"], "サムネイルの例", "Japanese characters"]:
            self.assertIn(expected, prompt)
        self.assertNotIn("[STYLE REFERENCE]", prompt)
        self.assertNotIn("Subtitle", prompt.split("[LAYOUT]")[0].split("NOT part")[1])

    def test_prompt_with_reference_and_notes(self):
        prompt = tts.build_prompt(self.slide(notes="背景は濃紺"), 5, "x", "style", "16:9", "slide 1 of this same deck")
        self.assertIn("[STYLE REFERENCE]", prompt)
        self.assertIn("slide 1 of this same deck", prompt)
        self.assertIn("- 背景は濃紺", prompt)


class ExtractImageTest(unittest.TestCase):
    def test_skips_thought_images(self):
        data, mime = tts.extract_image(image_response(b"final"))
        self.assertEqual((data, mime), (b"final", "image/png"))

    def test_snake_case_response(self):
        payload = {"candidates": [{"content": {"parts": [
            {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(b"jpg").decode()}}]}}]}
        self.assertEqual(tts.extract_image(payload), (b"jpg", "image/jpeg"))

    def test_no_image_is_retryable(self):
        payload = {"candidates": [{"content": {"parts": [{"text": "I can't"}]}, "finishReason": "IMAGE_SAFETY"}]}
        with self.assertRaises(tts.ApiError) as ctx:
            tts.extract_image(payload)
        self.assertTrue(ctx.exception.retryable)
        self.assertIn("IMAGE_SAFETY", str(ctx.exception))

    def test_blocked_prompt_is_not_retryable(self):
        with self.assertRaises(tts.ApiError) as ctx:
            tts.extract_image({"promptFeedback": {"blockReason": "SAFETY"}})
        self.assertFalse(ctx.exception.retryable)

    def test_image_size_support(self):
        self.assertTrue(tts.supports_image_size("gemini-3-pro-image"))
        self.assertFalse(tts.supports_image_size("gemini-2.5-flash-image"))
        self.assertFalse(tts.supports_image_size("gemini-3.1-flash-lite-image"))

    def test_parse_only(self):
        self.assertEqual(tts.parse_only("2,5-7", 8), {2, 5, 6, 7})
        self.assertIsNone(tts.parse_only(None, 8))
        with self.assertRaises(tts.UserError):
            tts.parse_only("9", 8)


class EndToEndTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.script = self.root / "台本.txt"
        self.script.write_text(SAMPLE, encoding="utf-8")
        patches = [
            mock.patch.object(tts.time, "sleep", lambda s: None),
            mock.patch.object(tts, "SKILL_DIR", self.root),
            mock.patch.dict(os.environ, {"no_proxy": "127.0.0.1,localhost", "NO_PROXY": "127.0.0.1,localhost",
                                         "TEXT_TO_SLIDE_OUT": str(self.root / "Downloads" / "スライド")}),
        ]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)
        os.environ.pop("GEMINI_API_KEY", None)
        os.environ.pop("GOOGLE_API_KEY", None)
        os.environ.pop("TEXT_TO_SLIDE_MODEL", None)

    def tearDown(self):
        self.tmp.cleanup()

    def prepare(self) -> Path:
        code, out = run_cli("prepare", str(self.script), "--name", "サムネ講座")
        self.assertEqual(code, 0, out)
        decks = list((self.root / "Downloads" / "スライド").iterdir())
        self.assertEqual(len(decks), 1)
        self.assertIn("[1] サムネイルの話", out)
        return decks[0]

    def write_plan(self, deck: Path, slides: list[dict]) -> None:
        (deck / "plan.json").write_text(json.dumps({"deck_title": "サムネ講座", "slides": slides}, ensure_ascii=False),
                                        encoding="utf-8")

    PLAN = [
        {"from": 1, "to": 3, "layout": "title", "title": "クリックされるサムネ", "subtitle": "3つのコツ"},
        {"from": 4, "to": 7, "layout": "steps", "title": "文字と顔", "points": ["7文字以内", "顔のアップ"]},
        {"from": 8, "to": 8, "layout": "cta", "title": "チャンネル登録お願いします"},
    ]

    def test_prepare_splits_sample(self):
        deck = self.prepare()
        data = json.loads((deck / "_work" / "sentences.json").read_text(encoding="utf-8"))
        texts = [s["text"] for s in data["sentences"]]
        self.assertEqual(len(texts), 8)
        self.assertEqual(texts[2], "今日は「クリックされるサムネイル」の作り方を3つ紹介します！")
        self.assertEqual(data["language"], "Japanese")
        self.assertEqual((deck / "_work" / "source.txt").read_text(encoding="utf-8"), SAMPLE)

    def test_dry_run_needs_no_key_and_writes_mapping(self):
        deck = self.prepare()
        self.write_plan(deck, self.PLAN)
        code, out = run_cli("render", str(deck), "--dry-run")
        self.assertEqual(code, 0, out)
        self.assertIn("検証 OK: 3枚", out)
        mapping = (deck / "台本対応表.md").read_text(encoding="utf-8")
        self.assertIn("| 2 | （未生成） | 文字と顔 | 4〜7 |", mapping)
        self.assertTrue((deck / "index.html").is_file())
        self.assertTrue((deck / "_work" / "prompts" / "slide_03.txt").is_file())

    def test_invalid_plan_is_rejected(self):
        deck = self.prepare()
        self.write_plan(deck, self.PLAN[:2])
        code, out = run_cli("render", str(deck), "--dry-run")
        self.assertEqual(code, 2)
        self.assertIn("文8", out)

    def test_missing_key(self):
        deck = self.prepare()
        self.write_plan(deck, self.PLAN)
        with mock.patch.dict(os.environ, {"CLAUDE_CODE_REMOTE": ""}):
            del os.environ["CLAUDE_CODE_REMOTE"]
            code, out = run_cli("render", str(deck))
        self.assertEqual(code, 2)
        self.assertIn("export GEMINI_API_KEY", out)
        self.assertIn("環境変数がありません", out)

        with mock.patch.dict(os.environ, {"CLAUDE_CODE_REMOTE": "true", "GEMINI_API_KEY": " "}):
            code, out = run_cli("check")
        self.assertEqual(code, 2)
        self.assertIn("クラウド環境メニュー", out)
        self.assertIn("新しいセッション", out)
        self.assertIn("GEMINI_API_KEY はありますが値が空です", out)

    def test_render_reuse_and_partial_regeneration(self):
        deck = self.prepare()
        self.write_plan(deck, self.PLAN)
        with MockGemini() as api, mock.patch.dict(os.environ, {"GEMINI_API_KEY": "test-key", "GEMINI_API_BASE": api.base}):
            code, out = run_cli("render", str(deck))
            self.assertEqual(code, 0, out)
            self.assertEqual(len(api.requests), 3)
            first, *others = sorted(api.requests, key=lambda r: "slide 1 of 3" not in r["body"]["contents"][0]["parts"][-1]["text"])
            self.assertEqual(first["path"], "/v1beta/models/gemini-3-pro-image:generateContent")
            self.assertEqual(first["key"], "test-key")
            config = first["body"]["generationConfig"]
            self.assertEqual(config["imageConfig"], {"aspectRatio": "16:9", "imageSize": "2K"})
            self.assertEqual(len(first["body"]["contents"][0]["parts"]), 1)  # 1枚目は見本なし
            for req in others:  # 2枚目以降は 1枚目を見本として添付
                parts = req["body"]["contents"][0]["parts"]
                self.assertEqual(base64.b64decode(parts[0]["inlineData"]["data"]), api.png)
                self.assertIn("[STYLE REFERENCE]", parts[1]["text"])
            for i in (1, 2, 3):
                self.assertEqual((deck / f"slide_0{i}.png").read_bytes(), api.png)
            self.assertIn("![クリックされるサムネ](slide_01.png)", (deck / "台本対応表.md").read_text(encoding="utf-8"))
            self.assertIn('src="slide_02.png"', (deck / "index.html").read_text(encoding="utf-8"))

            code, out = run_cli("render", str(deck))
            self.assertEqual((code, len(api.requests)), (0, 3), out)  # 変更がなければ API を呼ばない

            plan = json.loads((deck / "plan.json").read_text(encoding="utf-8"))
            plan["slides"][2]["title"] = "高評価もお願いします"
            self.write_plan(deck, plan["slides"])
            code, out = run_cli("render", str(deck))
            self.assertEqual((code, len(api.requests)), (0, 4), out)  # 変えた 1 枚だけ作り直す
            self.assertIn("高評価もお願いします", api.requests[-1]["body"]["contents"][0]["parts"][-1]["text"])

            code, out = run_cli("render", str(deck), "--only", "2")
            self.assertEqual((code, len(api.requests)), (0, 5), out)

            self.write_plan(deck, [dict(self.PLAN[0], to=8)])  # 1 枚に減らすと古い画像は消える
            code, out = run_cli("render", str(deck))
            self.assertEqual(code, 0, out)
            self.assertEqual(sorted(p.name for p in deck.glob("slide_*")), ["slide_01.png"])

    def test_retry_on_rate_limit_and_options(self):
        deck = self.prepare()
        self.write_plan(deck, self.PLAN)
        with MockGemini() as api, mock.patch.dict(os.environ, {"GEMINI_API_KEY": "k", "GEMINI_API_BASE": api.base}):
            api.queue = [
                (429, {"error": {"code": 429, "message": "quota", "details": [{"retryDelay": "3s"}]}}),
                (200, {"candidates": [{"content": {"parts": [{"text": "no image"}]}, "finishReason": "STOP"}]}),
            ]
            code, out = run_cli("render", str(deck), "--model", "gemini-3.1-flash-image", "--size", "4K",
                                "--aspect", "9:16", "--no-style-ref", "--workers", "1")
            self.assertEqual(code, 0, out)
            self.assertIn("HTTP 429", out)
            self.assertIn("画像が返ってきませんでした", out)
            self.assertEqual(len(api.requests), 5)
            body = api.requests[-1]["body"]
            self.assertEqual(body["generationConfig"]["imageConfig"], {"aspectRatio": "9:16", "imageSize": "4K"})
            self.assertTrue(all(len(r["body"]["contents"][0]["parts"]) == 1 for r in api.requests))
            self.assertIn("gemini-3.1-flash-image", api.requests[-1]["path"])

    def test_fatal_error_aborts(self):
        deck = self.prepare()
        self.write_plan(deck, self.PLAN)
        with MockGemini() as api, mock.patch.dict(os.environ, {"GEMINI_API_KEY": "bad", "GEMINI_API_BASE": api.base}):
            api.queue = [(400, {"error": {"code": 400, "message": "API key not valid. Please pass a valid API key."}})]
            code, out = run_cli("render", str(deck))
            self.assertEqual(code, 1, out)
            self.assertEqual(len(api.requests), 1)  # 1枚目で止まり、残りは送らない
            self.assertIn("API key not valid", out)
            self.assertIn("デザイン見本なし", out)

    def test_style_image_is_sent_with_every_slide(self):
        deck = self.prepare()
        self.write_plan(deck, self.PLAN)
        brand = self.root / "brand.jpg"
        brand.write_bytes(b"brand-jpeg")
        with MockGemini() as api, mock.patch.dict(os.environ, {"GEMINI_API_KEY": "k", "GEMINI_API_BASE": api.base}):
            code, out = run_cli("render", str(deck), "--style-image", str(brand))
            self.assertEqual(code, 0, out)
            for req in api.requests:
                inline = req["body"]["contents"][0]["parts"][0]["inlineData"]
                self.assertEqual((inline["mimeType"], base64.b64decode(inline["data"])), ("image/jpeg", b"brand-jpeg"))

    def test_key_from_env_file(self):
        (self.root / ".env").write_text("export GEMINI_API_KEY='from-file'\n", encoding="utf-8")
        self.assertEqual(tts.load_api_key(), "from-file")


if __name__ == "__main__":
    unittest.main()
