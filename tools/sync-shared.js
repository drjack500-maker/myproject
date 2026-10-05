/*
 * 名駅歯科LP（lp/）と共通のファイルを、YouTube をご覧の方向けページ（youtube-lp/）にコピーする
 *   npm run sync:shared
 * main.js・style.css などを lp/ 側で直したら、このコマンドで youtube-lp/ にも反映してください。
 * （tests/youtube-lp.test.js が、2つのフォルダで内容が一致しているかを確認します）
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SHARED = [
  'assets/js/main.js',
  'assets/css/style.css',
  'assets/img/doctor-kawai.jpg',
  'assets/img/doctor-ozaki.jpg',
];

module.exports = { SHARED };

if (require.main === module) {
  SHARED.forEach((p) => {
    fs.copyFileSync(path.join(ROOT, 'lp', p), path.join(ROOT, 'youtube-lp', p));
    console.log(`copied lp/${p} → youtube-lp/${p}`);
  });
}
