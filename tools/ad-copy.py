#!/usr/bin/env python3
"""
Google 広告（レスポンシブ検索広告）の広告文を、文字数を検証しながら書き出す
  python3 tools/ad-copy.py
出力：docs/ad-copy.md（一覧）、docs/ads/*.csv（Google 広告エディタ取り込み用）

文字数は Google 広告の数え方（全角＝2、半角＝1）で検証し、超えていれば停止する。
文言を変えるときは、このファイルの DATA を編集して再実行する。
"""
import csv
import os
import sys
import unicodedata

ROOT = os.path.join(os.path.dirname(__file__), '..')
BASE_URL = 'https://www.meieki-dental.net/all_on_4_004/'  # 【要設定】新LPの公開URL
CAMPAIGN = 'オールオン4_名古屋'
LIMITS = {'headline': 30, 'description': 90, 'path': 15, 'sitelink': 25, 'sitelink_desc': 35, 'callout': 25, 'snippet': 25}


def width(s):
    return sum(2 if unicodedata.east_asian_width(c) in ('F', 'W') else 1 for c in s)


COMMON_HEADLINES = [
    '名古屋駅徒歩2分の歯科医院',
    '手術当日に固定式の仮歯',
    '麻酔専門医が常駐',
    '静脈内鎮静法・全身麻酔に対応',
    'CT撮影つき無料カウンセリング',
    '片顎1,925,000円（税込）',
    '月々19,000円台からの分割可',
    '治療後も10年保証',
    '平日9時〜19時 電話受付',
]
COMMON_DESCRIPTIONS = [
    '自由診療。片顎1,925,000円（税込）。CT撮影・診断を含み、麻酔・上部構造等は別途です。',
    '麻酔専門医が常駐し、静脈内鎮静法・全身麻酔に対応。JR名古屋駅3番出口から徒歩2分。',
    'オールオン4の治療実績170症例以上（2024年1〜12月）。CT撮影つき無料相談を受付中。',
]

# 広告グループ：LPの見出しパターン（?v=）と対応
DATA = [
    {
        'group': 'オールオン4', 'v': '',
        'keywords': ['オールオン4 名古屋', 'オールオンフォー 名古屋', 'all on 4 名古屋', 'オールオン4 愛知', 'オールオン4 名駅'],
        'headlines': ['オールオン4｜名駅歯科', '4本のインプラントで歯を支える', '入れ歯のお悩みご相談ください'],
        'description': '4本のインプラントで片あごの歯を支えるオールオン4。手術当日に固定式の仮歯が入ります。',
        'path': ('オールオン4', '名古屋駅'),
    },
    {
        'group': '入れ歯の悩み', 'v': 'denture',
        'keywords': ['入れ歯 合わない', '入れ歯 痛い', '総入れ歯 インプラント', '入れ歯 インプラント 名古屋', '入れ歯 外れる'],
        'headlines': ['入れ歯が合わない方へ', '取り外し不要の固定式の歯', '入れ歯から固定式の歯へ'],
        'description': '入れ歯のずれ・痛みでお悩みの方へ。オールオン4なら固定式で、毎晩の取り外しが不要です。',
        'path': ('入れ歯', '固定式の歯'),
    },
    {
        'group': '費用', 'v': 'price',
        'keywords': ['オールオン4 費用', 'オールオン4 値段', 'オールオンフォー 費用', 'オールオン4 相場', 'オールオン4 分割'],
        'headlines': ['オールオン4の費用と支払い', '医療費控除の対象です', '治療前に総額をご説明'],
        'description': '税抜1,750,000円。デンタルローンで月々19,000円台から。医療費控除の対象になります。',
        'path': ('オールオン4', '費用'),
    },
    {
        'group': '骨が少ない', 'v': 'bone',
        'keywords': ['インプラント 骨が少ない', 'インプラント 骨がない', 'インプラント 断られた', 'ザイゴマ 名古屋', 'ザイゴマインプラント'],
        'headlines': ['骨が少ないと言われた方へ', 'ザイゴマインプラント対応', 'CTで骨の状態を確認'],
        'description': '他院で難しいと言われた方もご相談を。斜めの埋入やザイゴマで治療できる場合があります。',
        'path': ('骨が少ない', 'ザイゴマ'),
    },
    {
        'group': '手術が怖い', 'v': 'fear',
        'keywords': ['インプラント 怖い', 'インプラント 静脈内鎮静', 'インプラント 麻酔 名古屋', 'インプラント 全身麻酔 名古屋'],
        'headlines': ['手術が怖い方へ', 'うとうとした状態で手術', 'すべての手術に麻酔医が立会い'],
        'description': '静脈内鎮静法で、うとうとした状態で手術。すべての手術に麻酔医が立ち会います。',
        'path': ('麻酔', '静脈内鎮静'),
    },
]

SITELINKS = [
    ('費用・お支払い方法', '片顎1,925,000円（税込）', '月々19,000円台から', '#price'),
    ('治療の流れ', '手術当日に固定式の仮歯', '最終的な歯まで丁寧に', '#flow'),
    ('担当する医師', '院長・麻酔医・理事長', '経歴とメッセージ', '#doctor'),
    ('無料カウンセリング予約', 'CT撮影つき・相談無料', '入力は3ステップ', '#reserve'),
]
CALLOUTS = ['名古屋駅徒歩2分', '麻酔専門医が常駐', '治療後も10年保証', 'CT撮影つき無料相談', '全身麻酔にも対応', '最大120回の分割払い']
SNIPPET = ('サービス', ['オールオン4', 'ザイゴマインプラント', '静脈内鎮静法', '全身麻酔', 'CT診断'])
NEGATIVES = ['保険適用', '保険 インプラント', '格安', '激安', '求人', '歯科衛生士', '歯科医師 募集', '論文', '学会', 'セミナー', '自分で', 'やり方 動画']


def check(kind, text, errors):
    w = width(text)
    if w > LIMITS[kind]:
        errors.append(f'{kind} が長すぎます（{w}/{LIMITS[kind]}）：{text}')
    return w


def main():
    errors = []
    for t in COMMON_HEADLINES:
        check('headline', t, errors)
    for t in COMMON_DESCRIPTIONS:
        check('description', t, errors)
    for g in DATA:
        for t in g['headlines']:
            check('headline', t, errors)
        check('description', g['description'], errors)
        for p in g['path']:
            check('path', p, errors)
        heads = g['headlines'] + COMMON_HEADLINES
        if len(heads) > 15:
            errors.append(f"{g['group']}: 見出しは15本までです（{len(heads)}本）")
    for name, d1, d2, _ in SITELINKS:
        check('sitelink', name, errors); check('sitelink_desc', d1, errors); check('sitelink_desc', d2, errors)
    for c in CALLOUTS:
        check('callout', c, errors)
    for v in SNIPPET[1]:
        check('snippet', v, errors)
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        sys.exit(1)

    url = lambda v: BASE_URL + (f'?v={v}' if v else '')
    os.makedirs(os.path.join(ROOT, 'docs', 'ads'), exist_ok=True)

    # 広告（Google 広告エディタ形式）
    with open(os.path.join(ROOT, 'docs', 'ads', 'ads.csv'), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['Campaign', 'Ad group', 'Ad type'] + [f'Headline {i}' for i in range(1, 16)] + [f'Description {i}' for i in range(1, 5)] + ['Final URL', 'Path 1', 'Path 2'])
        for g in DATA:
            heads = (g['headlines'] + COMMON_HEADLINES)[:15]
            descs = ([g['description']] + COMMON_DESCRIPTIONS)[:4]
            w.writerow([CAMPAIGN, g['group'], 'Responsive search ad'] + heads + [''] * (15 - len(heads)) + descs + [''] * (4 - len(descs)) + [url(g['v']), *g['path']])
    # キーワード（フレーズ一致）と除外キーワード
    with open(os.path.join(ROOT, 'docs', 'ads', 'keywords.csv'), 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['Campaign', 'Ad group', 'Keyword', 'Criterion Type'])
        for g in DATA:
            for k in g['keywords']:
                w.writerow([CAMPAIGN, g['group'], k, 'Phrase'])
        for k in NEGATIVES:
            w.writerow([CAMPAIGN, '', k, 'Campaign Negative Phrase'])

    # 一覧（docs/ad-copy.md）
    L = []
    L.append('# Google 広告 広告文（レスポンシブ検索広告）\n')
    L.append('`python3 tools/ad-copy.py` で生成（文字数は Google 広告の数え方＝全角2・半角1で検証済み）。')
    L.append('Google 広告エディタ用の CSV：[`ads/ads.csv`](ads/ads.csv)（広告）、[`ads/keywords.csv`](ads/keywords.csv)（キーワード・除外キーワード）\n')
    L.append('> 最終ページURLは現LPと同じURLを仮定しています。新LPの公開URLが違う場合は `tools/ad-copy.py` の `BASE_URL` を変えて再生成してください。\n')
    L.append('## 考え方\n')
    L.append('- **検索語句ごとに広告グループを分け、LPの見出しもそろえる**（`?v=` で出し分け）。「入れ歯 合わない」で検索した人には「入れ歯を外さない毎日へ」の見出しが表示されます')
    L.append('- 広告文は医療広告ガイドラインの対象です（LPのような「限定解除」は使えません）。「痛くない」「No.1」「安い」「たった1日で完了」などは使わず、**自由診療であること・標準的な費用・集計期間つきの実績**を明記しています')
    L.append('- 「無料」を大きく打ち出す表現は、費用を強調した広告と受け取られるおそれがあるため、「CT撮影つき無料カウンセリング」のように内容とあわせて使っています\n')
    for g in DATA:
        L.append(f"## 広告グループ：{g['group']}\n")
        L.append(f"- 最終ページURL：`{url(g['v'])}`")
        L.append(f"- 表示URLのパス：`{g['path'][0]}` / `{g['path'][1]}`")
        L.append(f"- キーワード（フレーズ一致）：{'、'.join(g['keywords'])}\n")
        L.append('| 見出し（このグループ専用） | 文字数 |\n|---|---|')
        for t in g['headlines']:
            L.append(f'| {t} | {width(t)}/30 |')
        L.append('')
        L.append(f"| 説明文（このグループ専用） | 文字数 |\n|---|---|\n| {g['description']} | {width(g['description'])}/90 |\n")
    L.append('## 全グループ共通\n')
    L.append('| 見出し | 文字数 |\n|---|---|')
    for t in COMMON_HEADLINES:
        L.append(f'| {t} | {width(t)}/30 |')
    L.append('\n| 説明文 | 文字数 |\n|---|---|')
    for t in COMMON_DESCRIPTIONS:
        L.append(f'| {t} | {width(t)}/90 |')
    L.append('\n> 見出し1に「オールオン4」を含む見出しを固定（ピン留め）すると、何の広告かが伝わりやすくなります。\n')
    L.append('## アセット（広告表示オプション）\n')
    L.append('**電話番号**：052-571-3345（表示時間：月〜金 9:00〜19:00）\n')
    L.append('**サイトリンク**\n\n| テキスト | 説明1 | 説明2 | リンク先 |\n|---|---|---|---|')
    for name, d1, d2, anchor in SITELINKS:
        L.append(f'| {name} | {d1} | {d2} | `{BASE_URL}{anchor}` |')
    L.append(f"\n**コールアウト**：{'／'.join(CALLOUTS)}\n")
    L.append(f"**構造化スニペット**（{SNIPPET[0]}）：{'／'.join(SNIPPET[1])}\n")
    L.append(f"## 除外キーワード（キャンペーン単位・フレーズ一致）\n\n{'、'.join(NEGATIVES)}\n")
    L.append('## 配信設定のおすすめ\n')
    L.append('- **地域**：愛知・岐阜・三重（名古屋駅への通院圏）。「所在地」ベースで配信')
    L.append('- **入札**：まずは「コンバージョン数の最大化」（予約完了）。来院・成約のデータが月に数十件たまったら、来院・成約を重視した入札に切り替え（[`measurement-setup.md`](measurement-setup.md)）')
    L.append('- **電話アセット**は受付時間（平日 9:00〜19:00）のみ表示')
    L.append('- **確認**：「分割 最大120回」はコールアウトに使っています。回数が確定するまでは外してください（[提案書 8章](improvement-proposal.md#8-公開前に医院で確認が必要な事項)）')
    with open(os.path.join(ROOT, 'docs', 'ad-copy.md'), 'w', encoding='utf-8') as f:
        f.write('\n'.join(L) + '\n')
    print('wrote docs/ad-copy.md, docs/ads/ads.csv, docs/ads/keywords.csv')


if __name__ == '__main__':
    main()
