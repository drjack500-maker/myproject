/*
 * YouTube動画「オールオンフォー 15分講座」を作る（いびき動画の tools/build-video.js と同じ組み立て方）
 *   npm run build:video:allon4 → dist/video-allon4/
 *     オールオンフォー15分講座_尾崎隆.mp4  1920×1080・30fps・字幕入り
 *     captions.ja.srt                    YouTube・Vimeo にあとから付ける字幕
 *     thumbnail.jpg                      サムネイル（1280×720）
 *     youtube.txt                        タイトル案・概要欄（チャプター入り）・タグ
 *     timeline.json                      場面と字幕の時刻（確認用）
 * 材料：video-allon4/scenes.js（台本と画面）、video-allon4/narration.json（ナレーション音声のURL）、video-allon4/slide.html（スライド）
 * 必要なもの：ffmpeg、Playwright の Chromium、ネット（音声のダウンロードと Google Fonts）
 * 字幕の切り替えは video-allon4/align.json（tools/align-narration.py が音声認識で言葉の位置に合わせたもの）を使う。
 * ない場面は音声の無音（文の切れ目）を探して合わせる。`node tools/build-video-allon4.js --plan` で切れ目だけ確かめられる。
 */
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync, spawnSync } = require('node:child_process');
const { chromium } = require('playwright');
const { createServer } = require('./serve');

const ROOT = path.join(__dirname, '..');
const DIR = 'video-allon4';
const OUT = path.join(ROOT, 'dist', DIR);
const WORK = path.join(ROOT, 'dist', `${DIR}-work`);
const CACHE = path.join(ROOT, 'dist', `${DIR}-cache`);
const NAME = 'オールオンフォー15分講座_尾崎隆';
const FPS = 30;
const RATE = 48000;

const scenes = require(`../${DIR}/scenes.js`);
const READINGS = require(`../${DIR}/readings.js`);
const narration = require(`../${DIR}/narration.json`);
const ALIGN = fs.existsSync(path.join(ROOT, DIR, 'align.json')) ? require(`../${DIR}/align.json`) : {};

// 間（秒）
const LEAD = 0.35; // 画面が変わってから話し始めるまで
const TAIL = 0.55; // 話し終えてから次の画面まで
const CHAPTER_LEAD = 0.9;
const CHAPTER_TAIL = 1.3;
const FIRST_LEAD = 0.8;
const LAST_TAIL = 2.5;

const ff = (args) => execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });
const duration = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file]).toString());
const say = (t) => READINGS.reduce((s, [a, b]) => s.split(a).join(b), t);
const ts = (sec, sep = ',') => {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`;
};
const clock = (sec) => { const s = Math.floor(sec); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ---------- 音声 ----------
async function fetchAudio() {
  fs.mkdirSync(CACHE, { recursive: true });
  for (const c of narration.clips) {
    const file = path.join(CACHE, `${c.id}.wav`);
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) continue;
    const res = await fetch(c.url);
    if (!res.ok) throw new Error(`${c.id} の音声を取得できません（${res.status}）。Higgsfield の job ${c.job} を確認してください`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    console.log(`  downloaded ${c.id}`);
  }
}

function silences(file) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-38dB:d=0.16', '-f', 'null', '-'], { encoding: 'utf8' });
  const list = [];
  let start = null;
  for (const line of r.stderr.split('\n')) {
    const a = line.match(/silence_start: ([\d.]+)/);
    const b = line.match(/silence_end: ([\d.]+)/);
    if (a) start = Number(a[1]);
    if (b && start !== null) { list.push([start, Number(b[1])]); start = null; }
  }
  if (start !== null) list.push([start, duration(file)]);
  return list;
}

// 字幕の切れ目を、無音の位置から選ぶ（文字数から見込んだ位置に近く、長い無音ほど選ばれやすい）
function align(lines, sil, speechStart, speechEnd) {
  const weight = (t) => { const s = say(t); return s.replace(/[「」、。！？]/g, '').length + (s.match(/[。！？]/g) || []).length * 2.5 + (s.match(/、/g) || []).length * 1.0; };
  const w = lines.map((l) => weight(l.t));
  const total = w.reduce((a, b) => a + b, 0);
  const span = speechEnd - speechStart;
  const expected = [];
  let acc = 0;
  for (let i = 0; i < lines.length - 1; i++) { acc += w[i]; expected.push(speechStart + (acc / total) * span); }
  const cands = sil.filter(([a, b]) => a > speechStart + 0.3 && b < speechEnd - 0.3).map(([a, b]) => ({ t: (a + b) / 2, d: b - a }));
  const n = expected.length;
  if (!n) return [];
  // DP：境界 k に候補 j を割り当てる（候補を使わない「見込みのまま」も選べるが高くつく）
  const INF = 1e9;
  const opts = (k) => [...cands.map((c) => ({ t: c.t, d: c.d, cost: ((c.t - expected[k]) / span) ** 2 * 40 - Math.min(c.d, 1.2) * (lines[k].t.match(/[。」]$/) ? 1.2 : 0.6) })), { t: expected[k], d: 0, cost: 0.9 }];
  let prev = opts(0).map((o) => ({ ...o, total: o.cost, from: null }));
  const hist = [prev];
  for (let k = 1; k < n; k++) {
    const cur = opts(k).map((o) => {
      let best = { total: INF, idx: -1 };
      prev.forEach((p, i) => { if (p.t < o.t - 0.4 && p.total + o.cost < best.total) best = { total: p.total + o.cost, idx: i }; });
      return { ...o, total: best.total, from: best.idx };
    });
    hist.push(cur);
    prev = cur;
  }
  let idx = prev.reduce((bi, p, i, arr) => (p.total < arr[bi].total ? i : bi), 0);
  const out = [];
  for (let k = n - 1; k >= 0; k--) { out.unshift({ t: hist[k][idx].t, d: hist[k][idx].d }); idx = hist[k][idx].from; }
  if (out.some((b, i) => i && b.t <= out[i - 1].t)) throw new Error('字幕の切れ目が順番になりません');
  return out;
}

// ---------- 段取り ----------
function plan() {
  let t = 0;
  let step = 0;
  const timeline = [];
  scenes.forEach((s, si) => {
    if (s.v.layout === 'chapter') step = s.v.step;
    if (s.id === 's34') step = 6;
    const wav = path.join(CACHE, `${s.id}.wav`);
    const total = duration(wav);
    const sil = silences(wav);
    const speechStart = sil.length && sil[0][0] < 0.05 ? sil[0][1] : 0;
    const last = sil[sil.length - 1];
    const speechEnd = last && last[1] >= total - 0.05 ? last[0] : total;
    const chapter = s.v.layout === 'chapter';
    const lead = si === 0 ? FIRST_LEAD : chapter ? CHAPTER_LEAD : LEAD;
    const tail = si === scenes.length - 1 ? LAST_TAIL : chapter ? CHAPTER_TAIL : TAIL;
    const clipStart = Math.max(0, speechStart - 0.1);
    const clipEnd = Math.min(total, speechEnd + 0.2);
    // 切れ目：align.json（音声認識で言葉の位置に合わせたもの）があれば使い、なければ無音から選ぶ
    const known = ALIGN[s.id] && ALIGN[s.id].length === s.lines.length - 1 ? ALIGN[s.id] : null;
    const aligned = known ? known.map((t) => ({ t, d: -1 })) : align(s.lines, sil, speechStart, speechEnd);
    const bounds = aligned.map((b) => b.t - clipStart);
    const pauses = aligned.map((b) => Number(b.d.toFixed(2)));
    const speak = clipEnd - clipStart;
    const practice = s.practice || 0;
    const dur = lead + speak + tail + practice;
    const starts = [0, ...bounds.map((b) => lead + b)];
    const frames = s.lines.map((l, i) => ({ line: i, start: t + starts[i], end: t + (i + 1 < starts.length ? starts[i + 1] : lead + speak + tail) }));
    for (let p = practice; p >= 1; p--) frames.push({ practice: { left: p, total: practice }, start: t + lead + speak + tail + (practice - p), end: t + lead + speak + tail + (practice - p) + 1 });
    timeline.push({ id: s.id, step, chapter: s.chapter, start: t, dur, lead, clipStart, clipEnd, speak, practice, pauses, frames, subs: s.lines.map((l, i) => ({ t: l.t, start: t + lead + (i ? bounds[i - 1] : 0), end: t + lead + (i < bounds.length ? bounds[i] - 0.05 : speak) })) });
    t += dur;
  });
  return timeline;
}

// ---------- 画面 ----------
async function renderFrames(timeline) {
  const dir = path.join(WORK, 'frames');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const server = createServer(ROOT);
  await new Promise((r) => server.listen(0, r));
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push(`読みこめない: ${r.url()}`); });
  await page.goto(`http://localhost:${server.address().port}/${DIR}/slide.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const fontsOk = await page.evaluate(async () => {
    const faces = ['800 40px "Shippori Mincho B1"', '700 40px "BIZ UDPGothic"', '400 40px "BIZ UDPGothic"'];
    await Promise.all(faces.map((f) => document.fonts.load(f, 'オールオンフォー講座')));
    return faces.every((f) => document.fonts.check(f, 'オールオンフォー講座'));
  });
  if (!fontsOk) throw new Error('Google Fonts を読みこめませんでした（ネットにつながる環境で実行してください）');
  let n = 0;
  for (const sc of timeline) {
    const scene = scenes.find((s) => s.id === sc.id);
    for (const f of sc.frames) {
      const line = scene.lines[f.line];
      await page.evaluate((a) => window.renderSlide(a), { v: scene.v, show: line.show ?? 99, sub: line.t, step: sc.step });
      await page.waitForLoadState('networkidle');
      f.file = path.join(dir, `${String(++n).padStart(4, '0')}.png`);
      await page.screenshot({ path: f.file });
    }
  }
  // サムネイル
  const thumbPage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await thumbPage.goto(`http://localhost:${server.address().port}/${DIR}/slide.html`, { waitUntil: 'networkidle' });
  await thumbPage.evaluate(() => document.fonts.ready);
  await thumbPage.evaluate(() => window.renderThumb({ img: 'hook.jpg', badge: '名駅歯科クリニック 理事長が解説', title: '手術の日に、<br><em>固定式の仮の歯</em>が<br>入るしくみ', sub: 'オールオンフォー 15分講座' }));
  await thumbPage.waitForLoadState('networkidle');
  await thumbPage.screenshot({ path: path.join(OUT, 'thumbnail.jpg'), type: 'jpeg', quality: 92 });
  await browser.close();
  server.close();
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(`  ${n} frames`);
}

// ---------- 音 ----------
function buildAudio(timeline) {
  const dir = path.join(WORK, 'audio');
  fs.mkdirSync(dir, { recursive: true });
  const chime = path.join(dir, 'chime.wav');
  ff(['-f', 'lavfi', '-i', `aevalsrc=0.20*sin(2*PI*880*t)*exp(-4.5*t)+0.12*sin(2*PI*1318.5*t)*exp(-5.5*t):s=${RATE}:d=1.2`, '-ac', '1', chime]);
  const parts = [];
  for (const sc of timeline) {
    const src = path.join(CACHE, `${sc.id}.wav`);
    const out = path.join(dir, `${sc.id}.wav`);
    const samples = Math.round(sc.dur * RATE);
    const delay = Math.round(sc.lead * 1000);
    if (sc.practice) {
      const chimeAt = Math.round((sc.dur - 0.9) * 1000);
      ff(['-i', src, '-i', chime, '-filter_complex', `[0:a]aformat=sample_rates=${RATE}:channel_layouts=mono,atrim=${sc.clipStart}:${sc.clipEnd},asetpts=N/SR/TB,adelay=${delay},apad[a];[1:a]adelay=${chimeAt},apad[b];[a][b]amix=inputs=2:normalize=0,atrim=end_sample=${samples}[o]`, '-map', '[o]', '-ar', String(RATE), '-ac', '1', out]);
    } else {
      ff(['-i', src, '-af', `aformat=sample_rates=${RATE}:channel_layouts=mono,atrim=${sc.clipStart}:${sc.clipEnd},asetpts=N/SR/TB,adelay=${delay},apad,atrim=end_sample=${samples}`, '-ar', String(RATE), '-ac', '1', out]);
    }
    parts.push(out);
  }
  const list = path.join(dir, 'list.txt');
  fs.writeFileSync(list, parts.map((p) => `file '${p}'`).join('\n'));
  const joined = path.join(dir, 'joined.wav');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', joined]);
  // 音量をそろえる（2回に分けて測ってから一律に上げ下げする。1回だけだと間の無音まで持ち上がる）
  const target = 'I=-16:TP=-1.5:LRA=11';
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-i', joined, '-af', `highpass=f=70,loudnorm=${target}:print_format=json`, '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const m = JSON.parse(probe.slice(probe.lastIndexOf('{'), probe.lastIndexOf('}') + 1));
  const final = path.join(dir, 'narration.wav');
  ff(['-i', joined, '-af', `highpass=f=70,loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`, '-ar', String(RATE), '-ac', '2', final]);
  return final;
}

// ---------- 動画 ----------
function buildVideo(timeline, audio) {
  const frames = timeline.flatMap((s) => s.frames);
  const list = path.join(WORK, 'frames.txt');
  const total = timeline.reduce((a, s) => a + s.dur, 0);
  // フレームの切り替えを 1/30 秒の格子にそろえる（ずれがたまらないように）
  let lines = '';
  let prevEnd = 0;
  frames.forEach((f, i) => {
    const end = i === frames.length - 1 ? Math.round(total * FPS) / FPS : Math.round(f.end * FPS) / FPS;
    lines += `file '${f.file}'\nduration ${(end - prevEnd).toFixed(4)}\n`;
    prevEnd = end;
  });
  lines += `file '${frames[frames.length - 1].file}'\n`;
  fs.writeFileSync(list, lines);
  const out = path.join(OUT, `${NAME}.mp4`);
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-i', audio,
    '-vf', `fps=${FPS},format=yuv420p,fade=t=in:st=0:d=0.6,fade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2`,
    '-af', `afade=t=out:st=${(total - 1.2).toFixed(2)}:d=1.2`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-tune', 'stillimage', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', total.toFixed(3),
    '-metadata', 'title=オールオンフォー 15分講座｜名駅歯科クリニック 尾崎隆', out]);
  return { out, total };
}

// ---------- 字幕・概要欄 ----------
function writeText(timeline, total) {
  const subs = timeline.flatMap((s) => s.subs);
  fs.writeFileSync(path.join(OUT, 'captions.ja.srt'), subs.map((s, i) => `${i + 1}\n${ts(s.start)} --> ${ts(s.end)}\n${s.t}\n`).join('\n'));
  const chapters = timeline.filter((s) => s.chapter).map((s) => `${clock(s === timeline[0] ? 0 : s.start)} ${s.chapter}`);
  const cta = timeline.find((s) => s.id === 's35');
  const txt = `■ 動画の長さ：${clock(total)}（LPで公式LINEのボタンを出す目安：${clock(cta.start)}＝個別相談の案内が始まるところ）

■ タイトル案
1. 入れ歯の悩み、あきらめていませんか。手術の日に固定式の仮の歯が入る「オールオンフォー」15分講座
2. 【理事長が解説】オールオンフォーとは？ 4本で支えるしくみ・入れ歯との違い・費用とリスク
3. 歯がボロボロ・入れ歯が合わない方へ。オールオンフォーの治療の流れを15分で

■ 概要欄
歯がボロボロで噛めない方、入れ歯が合わずに困っている方へ。
名駅歯科クリニック・矯正歯科（医療法人スマイル 理事長）尾崎隆が、オールオンフォーのしくみ・入れ歯との違い・治療の流れ・費用とリスクを約15分でお伝えします。

▼無料の個別相談（公式LINE）
【要設定：公式LINEの友だち追加URL】

▼この動画でわかること
${chapters.join('\n')}

▼費用（オールオンフォー 手術費用・片あご）
1,925,000円（税込）／税抜 1,750,000円
CT撮影・画像診断の費用を含みます。麻酔・上部構造（最終的な歯）などの費用は別途かかります。治療を始める前に総額をご説明します。

▼治療に伴うリスク・副作用
・外科手術のため、術後に痛み・腫れ・内出血が出ることがあります
・骨の量や全身の状態によっては、治療を受けられない場合や、骨造成などの追加処置が必要になる場合があります
・骨の状態などにより、手術当日に仮歯を装着できない場合があります
・糖尿病などの全身疾患や喫煙は、治療の経過に影響を及ぼす可能性があります
・静脈内鎮静法・全身麻酔では、まれに血圧の変動や呼吸抑制などが起こる可能性があります
・インプラント周囲炎を防ぐため、毎日のセルフケアと定期的なメンテナンスが必要です
・治療期間・通院回数・費用は、お口の状態により異なります

▼講師：名駅歯科クリニック・矯正歯科／医療法人スマイル 理事長 尾崎隆
1989年 歯科医師国家資格取得。1997〜2001年 アメリカでインプラントの研修（Dr.Lee LEVEL1・2、OBI LEVEL2〜4）。2013年 名駅歯科クリニック・矯正歯科 開設。2020年 医療法人スマイル設立 理事長就任。

▼名駅歯科クリニック・矯正歯科
〒450-0002 愛知県名古屋市中村区名駅3-13-31 名駅モリシタビル8階（JR・名鉄「名古屋駅」3番出口から徒歩2分）
TEL 052-571-3345（電話受付 月〜金 9:00〜19:00）

※オールオンフォーは公的医療保険が適用されない自由診療です。
※治療の適応・効果には個人差があります。精密検査の結果により、治療できない場合があります。
※この動画は一般的な情報です。イラストはイメージです。ナレーションは合成音声です。

#オールオンフォー #インプラント #入れ歯 #名古屋 #名駅歯科クリニック

■ タグ
オールオンフォー, オールオン4, All-on-4, インプラント, 入れ歯, 総入れ歯, 入れ歯 合わない, 歯がボロボロ, インプラント 費用, インプラント 名古屋, 名駅歯科クリニック, 静脈内鎮静法, ザイゴマインプラント
`;
  fs.writeFileSync(path.join(OUT, 'youtube.txt'), txt);
  fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify(timeline.map(({ frames, ...s }) => s), null, 1));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(WORK, { recursive: true });
  console.log('1/5 音声');
  await fetchAudio();
  console.log('2/5 字幕の切れ目');
  const timeline = plan();
  if (process.argv.includes('--plan')) {
    // 字幕の切れ目の確認：数字は使った無音の長さ（秒）。0 は無音が見つからず文字数から見込んだ位置、-1 は align.json の値
    for (const s of timeline) console.log(`  ${s.id} ${s.pauses.join(' ')}`);
    const all = timeline.flatMap((s) => s.pauses);
    console.log(`  切れ目 ${all.length}、うち見込み ${all.filter((d) => d === 0).length}`);
    return;
  }
  console.log('3/5 画面');
  await renderFrames(timeline);
  console.log('4/5 音');
  const audio = buildAudio(timeline);
  console.log('5/5 動画');
  const { out, total } = buildVideo(timeline, audio);
  writeText(timeline, total);
  console.log(`wrote ${path.relative(ROOT, out)} (${clock(total)}, ${(fs.statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);
})().catch((e) => { console.error(e); process.exit(1); });
