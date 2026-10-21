/*
 * 動画の図（SVG）。slide.js から呼ぶ。
 *   jaw(opts)：下あごの正面図（LPの構造図と同じ描き方）。インプラントの本数・角度、神経、ひとつながりの歯、噛む力の矢印
 *   zygoma(show)：上あごの正面図。斜めのインプラントと、頬の骨まで届くザイゴマインプラント
 *   icon(name)：小さな線のアイコン
 */
(function () {
  const C = {
    bone: '#f5ebda', boneLine: '#dcc6a2', dots: '#e6d4b4', gum: '#f5b5c0', gumLine: '#e999a7', tooth: '#ffffff', toothLine: '#cdd5db',
    nerve: '#e0a21f', primary: '#0e5a63', accent: '#b83d0b', sinus: '#cfe6f2', sinusLine: '#8fbfd8', ink: '#1d2b33', muted: '#4f5f69',
  };
  let uid = 0;

  function defs(p) {
    return `<defs>
<linearGradient id="${p}ti" x1="0" x2="1"><stop offset="0" stop-color="#8b97a2"/><stop offset=".45" stop-color="#eef1f4"/><stop offset="1" stop-color="#7b8793"/></linearGradient>
<linearGradient id="${p}tz" x1="0" x2="1"><stop offset="0" stop-color="#b8673f"/><stop offset=".45" stop-color="#ffe2cf"/><stop offset="1" stop-color="#a85a35"/></linearGradient>
<pattern id="${p}dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1.7" fill="${C.dots}"/><circle cx="10" cy="9.5" r="1.2" fill="${C.dots}"/></pattern>
<marker id="${p}ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.2" markerHeight="4.2" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${C.accent}"/></marker>
</defs>`;
  }

  // インプラント1本（頭が原点、下向きに長さ len）
  function implant(p, { x, y, a = 0, len = 100, hl = null, zygo = false }) {
    const k = len / 100;
    const body = `M-9 6H9L7 ${6 + 94 * k}Q0 ${18 + 94 * k}-7 ${6 + 94 * k}Z`;
    let threads = '';
    for (let t = 18; t < 6 + 90 * k; t += 12) threads += `M-8.8 ${t}L8.8 ${t + 5}`;
    const glow = hl ? `<path d="${body}" fill="none" stroke="${hl}" stroke-width="16" stroke-linejoin="round" opacity="0.38"/>` : '';
    return `<g transform="translate(${x} ${y}) rotate(${a})">${glow}<rect x="-8" y="-12" width="16" height="17" rx="3" fill="#aeb8c1" stroke="#76828d"/><path d="${body}" fill="url(#${p}${zygo ? 'tz' : 'ti'})" stroke="#6f7b86"/><path d="${threads}" stroke="#6f7b86" stroke-width="1.4" fill="none"/></g>`;
  }

  const TEETH_X = [44, 80, 116, 152, 188, 224, 260, 296, 332, 368, 404, 440];
  const TEETH_H = [60, 64, 68, 74, 80, 86, 86, 80, 74, 68, 64, 60];
  const BONE = 'M24 150C24 141 32 136 44 136H476C488 136 496 141 496 150V224C496 262 440 288 260 288C80 288 24 262 24 224Z';

  // 下あごの正面図
  //   implants：[{x, a, hl}]、nerve：神経の点線、bridge：歯をひとつながりに囲む、force：噛む力の矢印
  function jaw({ implants = FOUR(), nerve = false, nerveHl = false, bridge = false, force = false, teeth = true } = {}) {
    const p = `j${++uid}-`;
    const top = force ? -86 : 30;
    let s = `<svg viewBox="10 ${top} 500 ${300 - top}" xmlns="http://www.w3.org/2000/svg" font-family="BIZ UDPGothic, sans-serif">${defs(p)}`;
    s += `<path d="${BONE}" fill="${C.bone}" stroke="${C.boneLine}" stroke-width="2"/><path d="${BONE}" fill="url(#${p}dots)" opacity=".8"/>`;
    if (nerve) {
      const w = nerveHl ? 6 : 3.5;
      s += `<path d="M30 244C72 250 116 246 156 232" stroke="${C.nerve}" stroke-width="${w}" stroke-dasharray="7 6" fill="none" stroke-linecap="round"/><path d="M490 244C448 250 404 246 364 232" stroke="${C.nerve}" stroke-width="${w}" stroke-dasharray="7 6" fill="none" stroke-linecap="round"/>`;
    }
    if (teeth) {
      s += `<g fill="${C.tooth}" stroke="${C.toothLine}" stroke-width="1.6">${TEETH_X.map((x, i) => `<rect x="${x}" y="${128 - TEETH_H[i]}" width="32" height="${TEETH_H[i]}" rx="10"/>`).join('')}</g>`;
      s += `<path d="M36 110H484Q494 110 494 120V138Q494 146 486 146H34Q26 146 26 138V120Q26 110 36 110Z" fill="${C.gum}" stroke="${C.gumLine}" stroke-width="1.6"/>`;
    }
    if (bridge) s += `<rect x="30" y="34" width="460" height="118" rx="22" fill="none" stroke="${C.primary}" stroke-width="5" stroke-dasharray="14 8"/>`;
    s += implants.map((im) => implant(p, { x: im.x, y: 152, a: im.a, hl: im.hl })).join('');
    if (force) {
      s += `<text x="260" y="-58" font-size="26" font-weight="700" fill="${C.accent}" text-anchor="middle">噛む力</text>`;
      s += `<path d="M260 -46 V-24" stroke="${C.accent}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      s += FOUR().map((im) => `<path d="M260 -22 C260 -6 ${im.x} -10 ${im.x} 22" stroke="${C.accent}" stroke-width="5" fill="none" marker-end="url(#${p}ar)" stroke-linecap="round"/>`).join('');
    }
    return s + '</svg>';
  }
  function FOUR(hlBack, hlFront) {
    return [{ x: 112, a: -32, hl: hlBack }, { x: 208, a: 0, hl: hlFront }, { x: 312, a: 0, hl: hlFront }, { x: 408, a: 32, hl: hlBack }];
  }
  function MANY() {
    return [62, 106, 150, 194, 238, 282, 326, 370, 414, 458].map((x) => ({ x, a: 0 }));
  }

  // 上あごの正面図（歯が下、骨が上）。show：1=斜めのインプラント 2=ザイゴマインプラント
  function zygoma(show = 0) {
    const p = `z${++uid}-`;
    let s = `<svg viewBox="-30 -150 580 470" xmlns="http://www.w3.org/2000/svg" font-family="BIZ UDPGothic, sans-serif">${defs(p)}`;
    // 頬の骨
    const cheek = (x, f) => `<path transform="translate(${x} 0) scale(${f} 1)" d="M0 -10 C-10 -60 10 -110 60 -120 C100 -126 120 -100 110 -70 C102 -44 70 -30 50 -6 C40 6 18 10 0 -10 Z" fill="${C.bone}" stroke="${C.boneLine}" stroke-width="2"/>`;
    s += cheek(-6, 1) + cheek(526, -1);
    s += `<text x="40" y="-128" font-size="24" font-weight="700" fill="${C.muted}" text-anchor="middle">頬の骨</text><text x="480" y="-128" font-size="24" font-weight="700" fill="${C.muted}" text-anchor="middle">頬の骨</text>`;
    // 上あごの骨（LPの形を上下反転）
    s += `<g transform="translate(0 330) scale(1 -1)"><path d="${BONE}" fill="${C.bone}" stroke="${C.boneLine}" stroke-width="2"/><path d="${BONE}" fill="url(#${p}dots)" opacity=".8"/></g>`;
    // 上あごの空洞（上顎洞）
    s += `<ellipse cx="96" cy="92" rx="62" ry="40" fill="${C.sinus}" stroke="${C.sinusLine}" stroke-width="2.5"/><ellipse cx="424" cy="92" rx="62" ry="40" fill="${C.sinus}" stroke="${C.sinusLine}" stroke-width="2.5"/>`;
    s += `<text x="-4" y="60" font-size="22" font-weight="700" fill="#3d7f9e" text-anchor="middle">空洞</text><text x="524" y="60" font-size="22" font-weight="700" fill="#3d7f9e" text-anchor="middle">空洞</text>`;
    // 歯と歯ぐき（下向き）
    s += `<path d="M36 220H484Q494 220 494 210V192Q494 184 486 184H34Q26 184 26 192V210Q26 220 36 220Z" fill="${C.gum}" stroke="${C.gumLine}" stroke-width="1.6"/>`;
    s += `<g fill="${C.tooth}" stroke="${C.toothLine}" stroke-width="1.6">${TEETH_X.map((x, i) => `<rect x="${x}" y="202" width="32" height="${TEETH_H[i]}" rx="10"/>`).join('')}</g>`;
    // インプラント（頭が下、上向き）
    s += implant(p, { x: 208, y: 178, a: 180 }) + implant(p, { x: 312, y: 178, a: 180 });
    if (show < 2) {
      const hl = show === 1 ? C.primary : null;
      s += implant(p, { x: 150, y: 178, a: 212, hl }) + implant(p, { x: 370, y: 178, a: 148, hl });
    } else {
      s += implant(p, { x: 120, y: 178, a: 164, len: 250, zygo: true, hl: C.accent }) + implant(p, { x: 400, y: 178, a: 196, len: 250, zygo: true, hl: C.accent });
    }
    return s + '</svg>';
  }

  // ---------- アイコン ----------
  const ICONS = {
    check: '<path d="M14 34 L26 46 L50 18" fill="none"/>',
    clock: '<circle cx="32" cy="32" r="24" fill="none"/><path d="M32 18 V32 L42 38" fill="none"/>',
    line: '<path d="M10 14 C10 10 13 8 17 8 H47 C51 8 54 10 54 14 V38 C54 42 51 44 47 44 H30 L18 54 V44 H17 C13 44 10 42 10 38 Z" fill="none"/>',
    bp: '<path d="M10 42 A22 22 0 1 1 54 42" fill="none"/><path d="M32 42 L44 24" fill="none"/><circle cx="32" cy="42" r="4"/><path d="M14 52 h36" fill="none"/>',
    scalpel: '<path d="M10 54 L40 24 L50 14 C54 18 54 24 48 30 L22 54 Z" fill="none"/><path d="M40 24 L46 30" fill="none"/>',
    yen: '<circle cx="32" cy="32" r="24" fill="none"/><path d="M22 18 L32 32 L42 18 M32 32 V48 M24 34 H40 M24 41 H40" fill="none"/>',
    brush: '<path d="M8 50 L40 18" fill="none"/><rect x="38" y="6" width="16" height="22" rx="4" transform="rotate(45 46 17)" fill="none"/><path d="M42 10 l-4 -4 M47 15 l-4 -4 M52 20 l-4 -4" fill="none"/>',
    pill: '<rect x="8" y="22" width="48" height="20" rx="10" fill="none" transform="rotate(-35 32 32)"/><path d="M26 22 L38 42" fill="none"/>',
    smoke: '<rect x="6" y="36" width="44" height="10" rx="2" fill="none"/><path d="M50 36 V46" fill="none"/><path d="M40 28 C40 22 46 22 46 16 C46 12 42 10 42 6 M50 28 C50 22 56 20 56 14" fill="none"/>',
    card: '<rect x="6" y="14" width="52" height="36" rx="6" fill="none"/><path d="M6 24 H58 M14 40 H28" fill="none"/>',
    doc: '<path d="M16 6 H40 L50 16 V58 H16 Z" fill="none"/><path d="M40 6 V16 H50 M24 30 H42 M24 40 H42 M24 50 H34" fill="none"/>',
    drip: '<rect x="22" y="6" width="20" height="26" rx="6" fill="none"/><path d="M32 32 V42 M26 18 H38" fill="none"/><path d="M32 42 C32 52 20 50 14 58" fill="none"/>',
    moon: '<path d="M40 10 A22 22 0 1 0 54 44 A18 18 0 1 1 40 10 Z" fill="none"/>',
    shield: '<path d="M32 6 L54 14 V30 C54 44 44 54 32 58 C20 54 10 44 10 30 V14 Z" fill="none"/><path d="M22 32 L30 40 L44 24" fill="none"/>',
    ct: '<circle cx="32" cy="32" r="24" fill="none"/><circle cx="32" cy="32" r="12" fill="none"/><path d="M10 52 H54" fill="none"/>',
    tooth: '<path d="M14 14 C14 6 24 6 32 10 C40 6 50 6 50 14 C50 26 46 30 44 40 C42 50 40 58 36 58 C32 58 34 44 32 44 C30 44 32 58 28 58 C24 58 22 50 20 40 C18 30 14 26 14 14 Z" fill="none"/>',
    implant: '<path d="M22 6 H42 V14 H22 Z M24 18 H40 L38 52 L32 58 L26 52 Z M24 26 L40 30 M24 36 L39 40 M25 46 L38 49" fill="none"/>',
    calendar: '<rect x="8" y="12" width="48" height="44" rx="6" fill="none"/><path d="M8 24 H56 M20 6 V16 M44 6 V16 M18 34 h6 M30 34 h6 M42 34 h6 M18 44 h6 M30 44 h6" fill="none"/>',
    chat: '<path d="M8 12 H56 V42 H30 L18 54 V42 H8 Z" fill="none"/><path d="M18 24 H46 M18 32 H38" fill="none"/>',
    family: '<circle cx="22" cy="18" r="8" fill="none"/><circle cx="44" cy="22" r="6" fill="none"/><path d="M8 54 C8 38 14 30 22 30 C30 30 36 38 36 54 M34 54 C34 42 38 34 44 34 C50 34 56 42 56 54" fill="none"/>',
    soup: '<path d="M8 30 H56 C56 44 46 54 32 54 C18 54 8 44 8 30 Z" fill="none"/><path d="M24 22 C24 16 28 16 28 10 M36 22 C36 16 40 16 40 10" fill="none"/>',
    build: '<path d="M10 54 V22 L32 10 L54 22 V54 Z" fill="none"/><path d="M26 54 V38 H38 V54" fill="none"/>',
  };
  function icon(name, color = 'currentColor', size = 64) {
    return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="${color}" stroke="${color}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${ICONS[name] || ''}</svg>`;
  }

  window.DIAGRAMS = { jaw, zygoma, icon, FOUR, MANY };
})();
