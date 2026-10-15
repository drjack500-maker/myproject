/*
 * 動画の図（SVG）。slide.js から呼ぶ。
 *   airway(state)：頭の断面図。open（起きているとき）／narrow（眠ってせまくなる）／spot（舌の定位置）
 *   hose()：せまいところほど流れが速い
 *   pillow()：枕の高さ3通り
 *   apnea()：録音の注意パターン（いびき→無音→大きな音）
 *   palate()：「アッ」でのどちんこが上がる（正面）
 *   vowels()：あ・い・う の口の形
 *   venn(labels)：タイプの重なり
 *   icon(name)：小さな線のアイコン
 * 色は CSS 変数（slide.html の :root）を使う
 */
(function () {
  const C = {
    skin: '#f6e8dd', skinLine: '#b98d74', tissue: '#efc6bb', tongue: '#e4908b', tongueLine: '#c06a66',
    palate: '#eda69b', bone: '#fffaf2', boneLine: '#cdbba6', air: '#cfe1f7', airLine: '#8fb0de',
    flow: '#33408f', snore: '#d9692c', spine: '#f1ebe0', spineLine: '#d3c6b2', ink: '#1a1f35', muted: '#535a73',
  };

  // ---------- 頭の断面図 ----------
  const TONGUE = {
    open: 'M190 470 C215 448 290 440 360 442 C410 444 432 470 438 510 C444 550 446 590 440 625 C430 650 400 662 380 656 C320 640 250 590 210 540 C195 520 185 495 190 470 Z',
    narrow: 'M190 476 C215 458 290 454 360 458 C432 462 480 490 497 532 C510 566 510 606 497 634 C480 656 430 664 395 658 C330 646 250 596 210 546 C195 526 185 500 190 476 Z',
    spot: 'M196 444 C230 432 300 430 360 432 C412 434 434 462 440 506 C446 548 446 590 440 625 C430 650 400 662 380 656 C320 640 250 590 212 540 C196 518 186 470 196 444 Z',
  };
  const VELUM = {
    open: 'M400 422 C430 420 455 430 468 452 C478 472 474 495 460 508 C450 514 440 505 440 492 C438 470 420 446 398 438 Z',
    narrow: 'M400 422 C440 420 482 442 498 470 C510 494 510 516 500 528 C490 534 478 522 476 508 C470 482 440 452 398 438 Z',
  };
  const EPIGLOTTIS = {
    open: 'M448 668 C452 640 462 620 476 606 C472 630 464 650 456 672 Z',
    narrow: 'M486 676 C488 656 494 642 504 634 C502 652 498 666 492 680 Z',
  };

  function airway(state = 'open', { labels = true, crop = false } = {}) {
    const narrow = state === 'narrow';
    const tongue = TONGUE[state] || TONGUE.open;
    const velum = narrow ? VELUM.narrow : VELUM.open;
    const epi = narrow ? EPIGLOTTIS.narrow : EPIGLOTTIS.open;
    const vb = crop ? '110 330 420 260' : '80 200 1320 700';
    let spine = '';
    for (let y = 392; y < 900; y += 62) spine += `<rect x="568" y="${y}" width="62" height="50" rx="12" fill="${C.spine}" stroke="${C.spineLine}" stroke-width="3"/>`;
    const flowOpen = 'M146 404 C220 380 340 372 440 380 C482 384 486 420 484 470 C482 560 480 680 470 860';
    const flowNarrow = 'M146 404 C220 380 340 372 440 380 C486 386 506 430 507 480 C508 540 508 600 500 660 C492 740 480 800 470 860';
    const flow = state === 'spot' ? '' : `<path d="${narrow ? flowNarrow : flowOpen}" fill="none" stroke="${narrow ? C.snore : C.flow}" stroke-width="${narrow ? 7 : 9}" stroke-linecap="round" stroke-dasharray="${narrow ? '2 16' : '0'}" marker-end="url(#ah-${narrow ? 'o' : 'b'})" opacity="0.9"/>`;
    const vib = narrow ? [470, 505, 545, 585].map((y, i) => `<path d="M${528 + (i % 2) * 6} ${y} q8 -8 16 0 t16 0 t16 0" fill="none" stroke="${C.snore}" stroke-width="5" stroke-linecap="round"/>`).join('') : '';
    const eye = narrow
      ? '<path d="M222 286 q16 10 32 0" fill="none" stroke="#6b4a3a" stroke-width="4" stroke-linecap="round"/>'
      : '<path d="M220 284 q18 -12 36 0 q-18 10 -36 0 Z" fill="#fff" stroke="#6b4a3a" stroke-width="3"/><circle cx="240" cy="284" r="6" fill="#3a2b25"/>';
    const lab = (x, y, tx, ty, text, color = C.ink) => `<path d="M${x} ${y} L${tx - 14} ${ty - 10}" stroke="${color}" stroke-width="3" fill="none"/><circle cx="${x}" cy="${y}" r="7" fill="${color}"/><text x="${tx}" y="${ty}" font-size="50" font-weight="700" fill="${color}">${text}</text>`;
    let labs = '';
    if (labels && !crop) {
      labs = narrow
        ? lab(488, 505, 720, 470, '軟口蓋が垂れ下がる', C.ink) + lab(500, 600, 720, 620, '舌の付け根が落ちこむ', C.ink) + lab(512, 700, 720, 770, 'せまい気道で粘膜が震える', C.snore)
        : lab(300, 386, 720, 320, '鼻から入った空気', C.flow) + lab(452, 470, 720, 460, '軟口蓋', C.ink) + lab(360, 500, 720, 600, '舌', C.ink) + lab(482, 720, 720, 760, '気道（空気の通り道）', C.flow);
    }
    const spot = state === 'spot'
      ? `<circle cx="200" cy="441" r="11" fill="#f2d59b" stroke="${C.ink}" stroke-width="3"/><path d="M200 428 L232 360" stroke="${C.ink}" stroke-width="3"/><text x="236" y="356" font-size="30" font-weight="700" fill="${C.ink}">スポット</text>`
      : '';
    return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img" font-family="BIZ UDPGothic, sans-serif">
<defs>
  <marker id="ah-b" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${C.flow}"/></marker>
  <marker id="ah-o" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="${C.snore}"/></marker>
  <clipPath id="head-${state}"><path d="M430 70 C330 60 230 110 205 200 C195 235 192 255 196 280 C185 300 160 340 128 388 C122 398 130 410 150 412 C160 414 168 418 170 428 C168 440 158 452 158 462 C160 472 170 478 176 480 C168 486 158 494 160 506 C164 520 176 530 178 545 C178 570 180 590 200 605 C230 625 270 630 300 640 C305 700 308 800 310 900 L600 900 C598 800 600 700 615 600 C640 520 690 450 700 360 C710 230 600 80 430 70 Z"/></clipPath>
</defs>
<path d="M430 70 C330 60 230 110 205 200 C195 235 192 255 196 280 C185 300 160 340 128 388 C122 398 130 410 150 412 C160 414 168 418 170 428 C168 440 158 452 158 462 C160 472 170 478 176 480 C168 486 158 494 160 506 C164 520 176 530 178 545 C178 570 180 590 200 605 C230 625 270 630 300 640 C305 700 308 800 310 900 L600 900 C598 800 600 700 615 600 C640 520 690 450 700 360 C710 230 600 80 430 70 Z" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="4"/>
<g clip-path="url(#head-${state})">
  <path d="M150 405 C200 360 300 350 420 352 C460 354 480 370 485 395 L470 420 C400 418 300 420 175 425 Z" fill="${C.air}" stroke="${C.airLine}" stroke-width="2"/>
  <path d="M410 352 L505 360 C520 420 522 520 515 600 C508 700 500 800 495 900 L420 900 L410 352 Z" fill="${C.air}" stroke="${C.airLine}" stroke-width="2"/>
  ${spine}
  <path d="M505 360 C518 420 522 520 515 600 C508 700 500 800 494 900 L566 900 C572 800 576 640 575 520 C574 440 560 380 520 350 Z" fill="${C.tissue}" stroke="#d4a397" stroke-width="2"/>
  <path d="${tongue}" fill="${C.tongue}" stroke="${C.tongueLine}" stroke-width="3"/>
  <path d="M178 430 C250 422 330 420 410 422 L410 434 C330 432 250 436 182 442 Z" fill="${C.bone}" stroke="${C.boneLine}" stroke-width="2"/>
  <path d="${velum}" fill="${C.palate}" stroke="${C.tongueLine}" stroke-width="2"/>
  <path d="${epi}" fill="#f2b8ad" stroke="${C.tongueLine}" stroke-width="2"/>
  <rect x="171" y="436" width="16" height="34" rx="6" fill="#fff" stroke="${C.boneLine}" stroke-width="2" transform="rotate(8 179 452)"/>
  <rect x="176" y="476" width="14" height="30" rx="6" fill="#fff" stroke="${C.boneLine}" stroke-width="2" transform="rotate(-10 183 490)"/>
  ${flow}
  ${vib}
</g>
${eye}
${spot}
${labs}
</svg>`;
  }

  // ---------- ホース（広い管とせまい管） ----------
  function hose() {
    const arrows = (y, xs, color, len) => xs.map((x) => `<path d="M${x} ${y} h${len}" stroke="${color}" stroke-width="8" stroke-linecap="round" marker-end="url(#hh-${color === C.flow ? 'b' : 'o'})"/>`).join('');
    return `<svg viewBox="0 0 1400 620" xmlns="http://www.w3.org/2000/svg" font-family="BIZ UDPGothic, sans-serif">
<defs>
  <marker id="hh-b" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${C.flow}"/></marker>
  <marker id="hh-o" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${C.snore}"/></marker>
</defs>
<text x="40" y="70" font-size="40" font-weight="700" fill="${C.flow}">広い気道</text>
<rect x="40" y="100" width="1060" height="140" rx="70" fill="${C.air}" stroke="${C.airLine}" stroke-width="5"/>
${arrows(170, [140, 460, 780], C.flow, 140)}
<text x="1130" y="182" font-size="38" font-weight="700" fill="${C.flow}">ゆっくり・静か</text>
<text x="40" y="350" font-size="40" font-weight="700" fill="${C.snore}">せまい気道</text>
<path d="M110 380 H420 C520 380 540 452 600 452 H640 C700 452 720 380 820 380 H1030 a70 70 0 0 1 0 140 H820 C720 520 700 448 640 448 H600 C540 448 520 520 420 520 H110 a70 70 0 0 1 0 -140 Z" fill="${C.air}" stroke="${C.airLine}" stroke-width="5"/>
<rect x="520" y="432" width="200" height="36" rx="18" fill="${C.air}"/>
${arrows(450, [150, 300], C.flow, 90)}
<path d="M470 450 h290" stroke="${C.snore}" stroke-width="9" stroke-linecap="round" marker-end="url(#hh-o)"/>
${arrows(450, [860], C.snore, 140)}
${[540, 600, 660].map((x) => `<path d="M${x} 418 q8 -10 16 0 t16 0" fill="none" stroke="${C.snore}" stroke-width="5" stroke-linecap="round"/><path d="M${x} 486 q8 10 16 0 t16 0" fill="none" stroke="${C.snore}" stroke-width="5" stroke-linecap="round"/>`).join('')}
<text x="1130" y="440" font-size="38" font-weight="700" fill="${C.snore}">速い流れで</text>
<text x="1130" y="490" font-size="38" font-weight="700" fill="${C.snore}">壁が震える</text>
</svg>`;
  }

  // ---------- 枕の高さ ----------
  const HEAD = 'M430 70 C330 60 230 110 205 200 C195 235 192 255 196 280 C185 300 160 340 128 388 C122 398 130 410 150 412 C160 414 168 418 170 428 C168 440 158 452 158 462 C160 472 170 478 176 480 C168 486 158 494 160 506 C164 520 176 530 178 545 C178 570 180 590 200 605 C230 625 270 630 300 640 C305 700 308 760 310 800 L600 800 C598 760 600 700 615 600 C640 520 690 450 700 360 C710 230 600 80 430 70 Z';
  // あお向けに寝た人（横から）。phi>0：あごが胸に近づく／phi<0：頭がのけぞる
  function sleeper(cx, phi, pillowH, mark, caption, ok) {
    const mattress = 330, k = 0.27;
    const cy = mattress - pillowH - 72;
    const color = ok ? C.flow : C.snore;
    const local = `translate(${cx} ${cy}) rotate(${phi}) rotate(-90) scale(${-k} ${k}) translate(-430 -330)`;
    return `<g>
<rect x="${cx - 150}" y="${mattress}" width="440" height="36" rx="12" fill="#e8ecf4"/>
<ellipse cx="${cx}" cy="${mattress - pillowH / 2}" rx="104" ry="${Math.max(pillowH / 2, 7)}" fill="#fff" stroke="#c9cfdc" stroke-width="4"/>
<g transform="${local}">
  <path d="${HEAD}" fill="${C.skin}" stroke="${C.skinLine}" stroke-width="16"/>
  <path d="M222 286 q16 10 32 0" fill="none" stroke="#6b4a3a" stroke-width="14" stroke-linecap="round"/>
  <line x1="215" y1="190" x2="188" y2="590" stroke="${color}" stroke-width="16" stroke-dasharray="34 26"/>
  <circle cx="215" cy="190" r="30" fill="${color}"/><circle cx="188" cy="590" r="30" fill="${color}"/>
</g>
<path d="M${cx + 96} ${mattress} C${cx + 92} ${mattress - 60} ${cx + 120} ${mattress - 104} ${cx + 180} ${mattress - 108} C${cx + 230} ${mattress - 110} ${cx + 270} ${mattress - 100} ${cx + 300} ${mattress - 96} L${cx + 300} ${mattress} Z" fill="#cfd6ea" stroke="#9aa6c9" stroke-width="4"/>
<text x="${cx + 60}" y="70" font-size="70" font-weight="700" fill="${color}" text-anchor="middle">${mark}</text>
<text x="${cx + 60}" y="420" font-size="40" font-weight="700" fill="${C.ink}" text-anchor="middle">${caption}</text>
</g>`;
  }
  function pillow(show = 3) {
    const parts = [
      sleeper(170, 28, 100, '×', '高すぎる', false),
      sleeper(650, -24, 14, '×', '低すぎる', false),
      sleeper(1130, 6, 56, '○', 'ちょうどいい', true),
    ];
    return `<svg viewBox="0 0 1460 440" xmlns="http://www.w3.org/2000/svg" font-family="BIZ UDPGothic, sans-serif">${parts.map((p, i) => `<g opacity="${i < show ? 1 : 0.12}">${p}</g>`).join('')}</svg>`;
  }

  // ---------- 録音の注意パターン ----------
  function apnea() {
    const bars = [];
    let x = 40;
    const W = 1400;
    const amp = (i) => 40 + 34 * Math.abs(Math.sin(i * 0.9)) + 14 * Math.abs(Math.sin(i * 2.3));
    for (let i = 0; x < 560; i++, x += 16) bars.push([x, amp(i), C.flow]);
    const gap0 = x; x += 380; const gap1 = x;
    for (let i = 0; x < W - 40; i++, x += 16) bars.push([x, i < 10 ? 120 + 20 * Math.sin(i) : amp(i) * 1.1, i < 10 ? C.snore : C.flow]);
    const mid = 230;
    return `<svg viewBox="0 0 ${W} 460" xmlns="http://www.w3.org/2000/svg" font-family="BIZ UDPGothic, sans-serif">
<line x1="30" y1="${mid}" x2="${W - 30}" y2="${mid}" stroke="#c9cfdc" stroke-width="3"/>
${bars.map(([bx, a, c]) => `<rect x="${bx}" y="${mid - a}" width="9" height="${a * 2}" rx="4" fill="${c}"/>`).join('')}
<rect x="${gap0 + 10}" y="${mid - 70}" width="${gap1 - gap0 - 20}" height="140" rx="20" fill="#fbefed" stroke="#e9c3bc" stroke-width="3" stroke-dasharray="10 8"/>
<text x="${(gap0 + gap1) / 2}" y="${mid - 8}" font-size="38" font-weight="700" fill="#8b2b22" text-anchor="middle">急に静かになる</text>
<text x="${(gap0 + gap1) / 2}" y="${mid + 40}" font-size="30" font-weight="700" fill="#8b2b22" text-anchor="middle">（呼吸が止まっている）</text>
<text x="300" y="${mid + 150}" font-size="34" font-weight="700" fill="${C.flow}" text-anchor="middle">いびき</text>
<text x="${gap1 + 90}" y="${mid + 190}" font-size="34" font-weight="700" fill="${C.snore}" text-anchor="middle">大きな音で再開</text>
</svg>`;
  }

  // ---------- のどちんこ（正面） ----------
  function mouthFront(cx, lifted) {
    const arch = lifted ? 150 : 185; // 軟口蓋のアーチの高さ
    const uvTip = lifted ? 215 : 290; // のどちんこの先
    return `<g>
<ellipse cx="${cx}" cy="250" rx="220" ry="170" fill="#f2c9bd" stroke="${C.skinLine}" stroke-width="5"/>
<ellipse cx="${cx}" cy="258" rx="188" ry="138" fill="#7a2c34"/>
${Array.from({ length: 8 }, (_, i) => `<rect x="${cx - 156 + i * 39}" y="${122 + Math.abs(i - 3.5) * 5}" width="34" height="${40 - Math.abs(i - 3.5) * 3}" rx="8" fill="#fff" stroke="#d8cfc2" stroke-width="2"/>`).join('')}
<path d="M${cx - 160} ${arch + 70} Q${cx} ${arch - 40} ${cx + 160} ${arch + 70}" fill="none" stroke="#e48f8a" stroke-width="20" stroke-linecap="round"/>
<path d="M${cx - 20} ${arch + 14} Q${cx} ${arch + 4} ${cx + 20} ${arch + 14} L${cx + 15} ${uvTip - 18} Q${cx} ${uvTip + 6} ${cx - 15} ${uvTip - 18} Z" fill="#e48f8a" stroke="#b9615e" stroke-width="3"/>
<path d="M${cx - 170} 345 Q${cx} 270 ${cx + 170} 345 Q${cx} 412 ${cx - 170} 345 Z" fill="${C.tongue}" stroke="${C.tongueLine}" stroke-width="3"/>
${lifted ? `<path d="M${cx + 90} 300 v-96" stroke="#f2d59b" stroke-width="12" stroke-linecap="round" marker-end="url(#pa)"/><path d="M${cx - 90} 300 v-96" stroke="#f2d59b" stroke-width="12" stroke-linecap="round" marker-end="url(#pa)"/>` : ''}
</g>`;
  }
  function palate() {
    return `<svg viewBox="0 0 1200 520" xmlns="http://www.w3.org/2000/svg" font-family="BIZ UDPGothic, sans-serif">
<defs><marker id="pa" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="#f2d59b"/></marker></defs>
${mouthFront(300, false)}${mouthFront(900, true)}
<text x="300" y="490" font-size="38" font-weight="700" fill="${C.muted}" text-anchor="middle">ふだん</text>
<text x="900" y="490" font-size="38" font-weight="700" fill="${C.flow}" text-anchor="middle">「アッ」と言うと上がる</text>
</svg>`;
  }

  // ---------- あ・い・う ----------
  function vowels(show = 3) {
    const lips = [
      ['あ', '<ellipse cx="0" cy="0" rx="78" ry="104" fill="#f0b3a8" stroke="#b9615e" stroke-width="5"/><ellipse cx="0" cy="4" rx="58" ry="84" fill="#7a2c34"/><rect x="-44" y="-80" width="88" height="22" rx="8" fill="#fff"/><ellipse cx="0" cy="58" rx="44" ry="20" fill="#e4908b"/>'],
      ['い', '<path d="M-130 0 Q0 -58 130 0 Q0 58 -130 0 Z" fill="#f0b3a8" stroke="#b9615e" stroke-width="5"/><path d="M-104 0 Q0 -30 104 0 Q0 30 -104 0 Z" fill="#7a2c34"/><path d="M-90 -6 Q0 -26 90 -6 L90 4 Q0 -12 -90 4 Z" fill="#fff"/>'],
      ['う', '<ellipse cx="0" cy="0" rx="62" ry="54" fill="#f0b3a8" stroke="#b9615e" stroke-width="5"/><ellipse cx="0" cy="0" rx="22" ry="18" fill="#7a2c34"/>' + Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return `<path d="M${(Math.cos(a) * 30).toFixed(1)} ${(Math.sin(a) * 26).toFixed(1)} L${(Math.cos(a) * 54).toFixed(1)} ${(Math.sin(a) * 46).toFixed(1)}" stroke="#c97b74" stroke-width="3"/>`; }).join('')],
    ];
    return `<svg viewBox="0 0 1200 400" xmlns="http://www.w3.org/2000/svg" font-family="Shippori Mincho B1, serif">${lips.map(([k, g], i) => `<g opacity="${i < show ? 1 : 0.12}" transform="translate(${200 + i * 400} 170)">${g}<text x="0" y="200" font-size="72" font-weight="800" fill="${C.ink}" text-anchor="middle">「${k}ー」</text></g>`).join('')}</svg>`;
  }

  // ---------- タイプの重なり ----------
  function venn(labels) {
    const pos = [[420, 230], [640, 230], [530, 410]];
    const cols = ['#8e9ad8', '#e4908b', '#f2c46b'];
    return `<svg viewBox="160 20 740 620" xmlns="http://www.w3.org/2000/svg" font-family="BIZ UDPGothic, sans-serif">
${pos.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="190" fill="${cols[i]}" fill-opacity="0.38" stroke="${cols[i]}" stroke-width="5"/>`).join('')}
${pos.map(([x, y], i) => { const [dx, dy] = [[-80, -60], [80, -60], [0, 110]][i]; return `<text x="${x + dx}" y="${y + dy}" font-size="40" font-weight="700" fill="${C.ink}" text-anchor="middle">${labels[i]}</text>`; }).join('')}
</svg>`;
  }

  // ---------- アイコン ----------
  const ICONS = {
    muscle: '<path d="M14 40 C14 26 22 18 30 18 L36 10 C40 6 46 8 46 14 L42 22 C50 24 54 32 52 40 C50 50 38 54 26 52 C18 50 14 46 14 40 Z" fill="none"/><path d="M26 34 C32 30 40 30 44 34" fill="none"/>',
    tongue: '<path d="M8 22 Q32 10 56 22 Q32 30 8 22 Z" fill="none"/><path d="M20 26 C20 44 26 54 32 54 C38 54 44 44 44 26" fill="none"/><path d="M32 34 v12" fill="none"/>',
    nose: '<path d="M30 8 C28 20 22 30 16 38 C12 44 16 50 24 50 C28 50 30 46 34 46 C38 46 40 50 44 50 C50 50 52 44 48 38" fill="none"/><path d="M14 54 q6 4 12 0 M38 54 q6 4 12 0" fill="none"/>',
    bone: '<circle cx="32" cy="18" r="11" fill="none"/><path d="M22 30 C22 36 24 40 26 42 L38 42 C40 40 42 36 42 30" fill="none"/><path d="M14 58 C16 48 22 44 32 44 C42 44 48 48 50 58" fill="none"/>',
    mouth: '<ellipse cx="32" cy="34" rx="20" ry="14" fill="none"/><path d="M20 30 Q32 40 44 30" fill="none"/><path d="M24 14 q8 -6 16 0" fill="none"/>',
    bp: '<path d="M10 42 A22 22 0 1 1 54 42" fill="none"/><path d="M32 42 L44 24" fill="none"/><circle cx="32" cy="42" r="4"/><path d="M14 52 h36" fill="none"/>',
    heart: '<path d="M32 54 C14 40 8 30 8 22 C8 14 14 8 22 8 C27 8 30 11 32 15 C34 11 37 8 42 8 C50 8 56 14 56 22 C56 30 50 40 32 54 Z" fill="none"/><path d="M14 30 h10 l4 -8 l6 16 l4 -8 h12" fill="none"/>',
    brain: '<path d="M30 12 C22 8 12 14 14 22 C6 24 6 36 14 38 C12 46 20 52 28 50 L30 50 L30 12 Z" fill="none"/><path d="M34 12 C42 8 52 14 50 22 C58 24 58 36 50 38 C52 46 44 52 36 50 L34 50 L34 12 Z" fill="none"/>',
    car: '<path d="M8 40 L12 28 C14 22 18 20 24 20 L40 20 C46 20 50 22 52 28 L56 40 L56 48 L8 48 Z" fill="none"/><circle cx="18" cy="48" r="5"/><circle cx="46" cy="48" r="5"/><path d="M44 8 h8 l-8 8 h8" fill="none"/>',
    check: '<path d="M14 34 L26 46 L50 18" fill="none"/>',
    drop: '<path d="M32 6 C24 20 12 32 12 42 C12 52 21 58 32 58 C43 58 52 52 52 42 C52 32 40 20 32 6 Z" fill="none"/>',
    clock: '<circle cx="32" cy="32" r="24" fill="none"/><path d="M32 18 V32 L42 38" fill="none"/>',
    line: '<path d="M10 14 C10 10 13 8 17 8 H47 C51 8 54 10 54 14 V38 C54 42 51 44 47 44 H30 L18 54 V44 H17 C13 44 10 42 10 38 Z" fill="none"/>',
  };
  function icon(name, color = 'currentColor', size = 64) {
    return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" fill="${color}" stroke="${color}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg">${ICONS[name] || ''}</svg>`;
  }

  window.DIAGRAMS = { airway, hose, pillow, apnea, palate, vowels, venn, icon };
})();
