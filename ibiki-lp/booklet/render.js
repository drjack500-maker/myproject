/* =========================================================
   マンガ小冊子「私の眠りの記録」— render.js
   pages.js（window.BOOKLET）の台本から20ページを組み立てる。
   コマの位置は 560×794 の紙面座標で計算し、％で配置する（A5に合わせて伸縮）。
   ========================================================= */
(function () {
  'use strict';

  const PAGE = { w: 560, h: 794, x0: 22, y0: 24, cw: 516, ch: 728, gx: 8, gy: 10 };
  const book = document.getElementById('book');
  const pages = (window.BOOKLET && window.BOOKLET.pages) || [];
  const IMG = (window.BOOKLET && window.BOOKLET.imgBase) || 'img/';

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // 「|」で改行（縦書きでは次の列）、{ } は縦中横（!? や 2けたの数字）、** ** は太字
  const fmt = (t) => esc(t)
    .replace(/&lt;(\/?)small&gt;/g, '<$1small>')
    .replace(/\{([^}]+)\}/g, '<span class="tcy">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\|/g, '<br>');
  const pct = (v, total) => `${((v / total) * 100).toFixed(3)}%`;

  // 行（高さと、右から順の幅の比）からコマの位置を出す。マンガなので右上から読む
  function layout(rows) {
    const total = rows.reduce((a, r) => a + r[0], 0);
    const avail = PAGE.ch - PAGE.gy * (rows.length - 1);
    const out = [];
    let y = PAGE.y0;
    rows.forEach(([hh, cols]) => {
      const h = (hh / total) * avail;
      const wAvail = PAGE.cw - PAGE.gx * (cols.length - 1);
      let right = PAGE.x0 + PAGE.cw;
      cols.forEach((fr) => {
        const w = fr * wAvail;
        out.push({ x: right - w, y, w, h });
        right -= w + PAGE.gx;
      });
      y += h + PAGE.gy;
    });
    return out;
  }

  function bubble(b) {
    const style = [`left:${(b.x * 100).toFixed(2)}%`, `top:${(b.y * 100).toFixed(2)}%`];
    if (b.fs) style.push(`font-size:${b.fs}px`);
    if (b.to != null) style.push(`--to:${b.to}%`);
    if (b.r) style.push(`--r:${b.r}deg`);
    if (b.rot) style.push(`--rot:${b.rot}deg`);
    if (b.k === 'sfx') {
      return `<span class="sfx${b.h ? '' : ' is-v'}${b.dark ? ' is-dark' : ''}" style="${style.join(';')}">${fmt(b.t)}</span>`;
    }
    const tail = b.tail ? `<i class="tail tail-${b.tail}"></i>` : '';
    // 話のタイトルは1行目（第○話）を小さく
    const text = b.k === 'ep' ? b.t.replace(/^([^|]+)\|/, '<small>$1</small>|') : b.t;
    return `<div class="bb bb--${b.k}${b.h ? ' is-h' : ''}" style="${style.join(';')}">${fmt(text)}${tail}</div>`;
  }

  function mangaPage(p) {
    const rects = layout(p.rows);
    if (rects.length !== p.panels.length) console.error(`[booklet] p.${p.n}: コマ数（${p.panels.length}）と割り付け（${rects.length}）が合いません`);
    return p.panels.map((panel, i) => {
      const r = rects[i];
      const pos = panel.pos ? ` style="object-position:${panel.pos}"` : '';
      return `<div class="panel" data-panel="${panel.img}" style="left:${pct(r.x, PAGE.w)};top:${pct(r.y, PAGE.h)};width:${pct(r.w, PAGE.w)};height:${pct(r.h, PAGE.h)}">`
        + `<img src="${IMG}${panel.img}.jpg" alt="${esc(panel.alt || '')}"${pos}>`
        + (panel.b || []).map(bubble).join('')
        + '</div>';
    }).join('')
      + (p.fin ? '<p class="fin">おわり</p><p class="fiction">※このマンガはフィクションです。いびきの変化には個人差があります。</p>' : '');
  }

  const html = pages.map((p, i) => {
    const n = i + 1;
    const body = p.kind === 'manga' ? mangaPage({ ...p, n }) : (typeof p.html === 'function' ? p.html(IMG) : p.html);
    const nombre = p.nombre === false ? '' : `<p class="nombre">${n}</p>`;
    return `<section class="page page--${p.cls || p.kind}" id="p${n}" aria-label="${n}ページ">${body}${nombre}</section>`;
  }).join('');
  book.innerHTML = html;

  // 画面では、紙の幅が画面に収まるよう縮小する（印刷・PDFでは原寸）
  function fit() {
    const avail = Math.min(book.clientWidth - 32, 760);
    const z = Math.max(0.3, Math.min(1.35, avail / 559.4));
    document.documentElement.style.setProperty('--z', z.toFixed(4));
  }
  fit();
  window.addEventListener('resize', fit);
  window.BOOKLET_READY = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    const imgs = Array.from(document.images);
    return Promise.all(imgs.map((im) => (im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; }))));
  });
})();
