/*
 * アルティメイト栄歯科・矯正歯科 インプラントLPの1ファイル版（写真・見出しフォントを埋め込み）を作る
 *   npm run build:ultimate-preview → ultimate-implant-lp/preview.html
 * ダブルクリックやメール・チャットの添付でそのまま開ける確認用です。公開には index.html を使ってください。
 * 写真とフォントをネットから取得するため、ネットにつながった環境で実行してください。
 * 確認用のため GTM は外しています（確認時のアクセスが計測に混ざらないように）。
 */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DIR = path.join(__dirname, '..', 'ultimate-implant-lp');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const get = (url) => execFileSync('curl', ['-sSfL', '--max-time', '60', '-A', UA, url], { maxBuffer: 64 * 1024 * 1024 });
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

let html = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
const replaceOnce = (from, to) => {
  if (typeof from === 'string' ? !html.includes(from) : !from.test(html)) throw new Error(`not found: ${from}`);
  html = html.replace(from, () => to);
};

// GTM を外し、検索エンジンに載らないようにする
replaceOnce(/<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->\n/, '<meta name="robots" content="noindex">\n');
replaceOnce(/<noscript><iframe src="https:\/\/www\.googletagmanager\.com[^\n]*<\/noscript>\n/, '');

// 見出しの明朝体：使っている文字だけのフォントを取得して埋め込む
const serifText = [
  ...[...html.matchAll(/<(h1|h2|h3|b)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2]),
  ...[...html.matchAll(/<section class="cta-band">[\s\S]*?<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]),
  ...[...html.matchAll(/h:\[('[^\]]*')\]/g)].map((m) => m[1]), // 見出しの出し分け（?t=）
  'QA0123456789',
].join('').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
const chars = [...new Set(serifText.replace(/\s/g, ''))].join('');
let fontCss = get(`https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@600;700&display=swap&text=${encodeURIComponent(chars)}`).toString();
fontCss = fontCss.replace(/url\((https:[^)]+)\)/g, (m, url) => `url(data:font/woff2;base64,${get(url).toString('base64')})`);
replaceOnce(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\n<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\n<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]+>\n/, `<style>\n${fontCss.trim()}\n</style>\n`);

// 写真を埋め込む
replaceOnce(/<link rel="preload" as="image"[^>]+>\n/, '');
const IMG = /https:\/\/www\.ultimate-dental\.com\/implant03\/assets\/img\/[\w.-]+\.(?:jpe?g|png)/g;
const cache = new Map();
html = html.replace(IMG, (url) => {
  if (!cache.has(url)) cache.set(url, `data:${TYPES[path.extname(url).toLowerCase()]};base64,${get(url).toString('base64')}`);
  return cache.get(url);
});

fs.writeFileSync(path.join(DIR, 'preview.html'), html);
console.log(`wrote ultimate-implant-lp/preview.html (${Math.round(html.length / 1024)} KB, images ${cache.size}, serif glyphs ${chars.length})`);
