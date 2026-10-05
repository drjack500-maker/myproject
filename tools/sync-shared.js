/*
 * 共通のファイルを各ページのフォルダにコピーする
 *   npm run sync:shared
 * - lp/（名駅歯科LP）→ youtube-lp/・meta-lp/：main.js・style.css・医師の写真
 * - youtube-lp/（栄院 YouTube）→ meta-lp/（栄院 Meta 広告）：栄院の見た目（youtube.css）・動画の埋め込み（youtube.js）・栄院の写真
 * 元のフォルダで直したら、このコマンドで反映してください。
 * （tests/youtube-lp.test.js・tests/meta-lp.test.js が、内容が一致しているかを確認します）
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const FROM_LP = [
  'assets/js/main.js',
  'assets/css/style.css',
  'assets/img/doctor-kawai.jpg',
  'assets/img/doctor-ozaki.jpg',
];
const FROM_YOUTUBE = [
  'assets/css/youtube.css',
  'assets/js/youtube.js',
  'assets/img/doctor-kitamura.jpg',
  'assets/img/doctor-kitamura-face.jpg',
  'assets/img/doctor-kitamura-fv.jpg',
  'assets/img/favicon.svg',
];
const GROUPS = [
  { from: 'lp', to: ['youtube-lp', 'meta-lp'], files: FROM_LP },
  { from: 'youtube-lp', to: ['meta-lp'], files: FROM_YOUTUBE },
];
// 以前の名前（tests/youtube-lp.test.js が使用）
const SHARED = FROM_LP;

module.exports = { SHARED, GROUPS };

if (require.main === module) {
  GROUPS.forEach(({ from, to, files }) => to.forEach((dir) => files.forEach((p) => {
    fs.mkdirSync(path.dirname(path.join(ROOT, dir, p)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, from, p), path.join(ROOT, dir, p));
    console.log(`copied ${from}/${p} → ${dir}/${p}`);
  })));
}
