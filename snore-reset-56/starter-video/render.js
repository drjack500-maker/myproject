#!/usr/bin/env node
// 56秒スターター動画の書き出し。
// scene.html を Chromium で1コマずつ撮影し、audio.py で作った音（BGM・合図・ナレーション）と合わせて ffmpeg で MP4 にする。
//
//   node render.js                    … output/ に動画（snore-reset-56-starter.mp4）・サムネイル（poster.jpg）・字幕（captions.srt）を作る
//   node render.js --stills 3,15,45   … 指定した秒の静止画だけ output/still-*.png に書き出す（確認用）
//   node render.js --fps 24           … フレームレートを変える（既定 30）
const path = require('path');
const fs = require('fs');
const { spawn, execFileSync } = require('child_process');
const { chromium } = require('playwright');

const DIR = __dirname;
const OUT = path.join(DIR, 'output');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const FPS = Number(opt('--fps') || 30);
const STILLS = opt('--stills');
const VIDEO = path.join(OUT, 'snore-reset-56-starter.mp4');
const POSTER_T = 2.4;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(DIR, 'scene.html') + '?render=1');
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  const duration = await page.evaluate(() => window.DURATION);

  const shoot = async (t, type = 'jpeg', opts = {}) => {
    await page.evaluate(([x, o]) => window.render(x, o), [t, opts]);
    return page.screenshot({ type, quality: type === 'jpeg' ? 95 : undefined, clip: { x: 0, y: 0, width: 1080, height: 1920 } });
  };

  if (STILLS) {
    for (const s of STILLS.split(',')) {
      const file = path.join(OUT, `still-${s}.png`);
      fs.writeFileSync(file, await shoot(Number(s), 'png'));
      console.log(file);
    }
    await browser.close();
    return;
  }

  const wav = path.join(OUT, 'audio.wav');
  execFileSync('python3', [path.join(DIR, 'audio.py'), wav, path.join(OUT, 'captions.srt')], { stdio: 'inherit' });

  const ff = spawn('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', wav,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '160k',
    '-movflags', '+faststart', '-shortest',
    '-metadata', 'title=SNORE RESET 56 スターター動画（56秒）',
    VIDEO
  ], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error('ffmpeg exited with ' + c)))));

  const frames = Math.round(duration * FPS);
  for (let i = 0; i < frames; i++) {
    const buf = await shoot(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % FPS === 0) process.stdout.write(`\r${i / FPS}s / ${duration}s`);
  }
  ff.stdin.end();
  await done;
  process.stdout.write('\n');

  fs.writeFileSync(path.join(OUT, 'poster.jpg'), await shoot(POSTER_T, 'jpeg', { poster: true }));
  await browser.close();
  fs.unlinkSync(wav);
  console.log(VIDEO);
})().catch(e => { console.error(e); process.exit(1); });
