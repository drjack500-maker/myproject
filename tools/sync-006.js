/*
 * SNS広告用LP（lp-006/）に、共通ファイルを lp/ からコピーする
 *   npm run sync:006
 * lp-006/ は「そのままサーバーの all_on_4_006/ にアップロードできる」よう、必要なファイルをすべて持っています。
 * CSS・JS・画像・完了ページ・個人情報ページは lp/ が元なので、lp/ を編集したら必ずこれを実行してください
 * （コピー漏れは npm test で検出します）。lp-006/index.html だけは lp-006 専用です。
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'lp');
const DEST = path.join(ROOT, 'lp-006');
// lp/ から lp-006/ へコピーするもの（index.html 以外のすべて）
const SHARED = ['assets', 'thanks.html', 'privacy.html'];

function listFiles(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p, base) : [path.relative(base, p)];
  });
}

function sharedFiles() {
  return SHARED.flatMap((name) => {
    const p = path.join(SRC, name);
    return fs.statSync(p).isDirectory() ? listFiles(p, SRC) : [name];
  }).sort();
}

// コピー先にあって、コピー元にない共通ファイル（lp/ で削除・改名されたもの）
function staleFiles() {
  const want = new Set(sharedFiles());
  return SHARED.flatMap((name) => {
    const p = path.join(DEST, name);
    if (!fs.existsSync(p)) return [];
    return fs.statSync(p).isDirectory() ? listFiles(p, DEST) : [name];
  }).filter((f) => !want.has(f));
}

// 内容が違う・足りない・余分なファイルの一覧（テストから使う）
function diff() {
  const changed = sharedFiles().filter((f) => {
    const d = path.join(DEST, f);
    return !fs.existsSync(d) || !fs.readFileSync(d).equals(fs.readFileSync(path.join(SRC, f)));
  });
  return { changed, stale: staleFiles() };
}

function sync() {
  const { changed, stale } = diff();
  changed.forEach((f) => {
    fs.mkdirSync(path.dirname(path.join(DEST, f)), { recursive: true });
    fs.copyFileSync(path.join(SRC, f), path.join(DEST, f));
  });
  stale.forEach((f) => fs.rmSync(path.join(DEST, f)));
  return { changed, stale };
}

module.exports = { diff, sync, sharedFiles };

if (require.main === module) {
  const { changed, stale } = sync();
  changed.forEach((f) => console.log(`copied  lp/${f}`));
  stale.forEach((f) => console.log(`removed lp-006/${f}`));
  console.log(changed.length || stale.length ? 'lp-006/ を更新しました' : 'lp-006/ は最新です');
}
