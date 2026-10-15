/* 販売導線の設計書 — 収支シミュレーター（数字はすべて仮定） */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const num = (id) => Math.max(0, Number($(id).value) || 0);
  const pct = (id) => num(id) / 100;
  const yen = (v) => `${v < 0 ? '−' : ''}${Math.round(Math.abs(v)).toLocaleString('ja-JP')}円`;
  const man = (v) => `${v < 0 ? '−' : ''}${(Math.abs(v) / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`;
  const ppl = (v) => `${v < 10 ? v.toLocaleString('ja-JP', { maximumFractionDigits: 1 }) : Math.round(v).toLocaleString('ja-JP')}人`;

  function calc() {
    const leads = num('s-cpl') ? num('s-ad') / num('s-cpl') : 0;
    const eligible = leads * (1 - pct('s-ex'));
    const viewers = eligible * pct('s-view');
    const applicants = viewers * pct('s-apply');
    const approved = applicants * pct('s-pass');
    const demand = approved * pct('s-pay');
    const cap = num('s-cap');
    const students = Math.min(demand, cap);
    const price = num('s-price');
    const fee = pct('s-fee');
    const course = students * price;
    const refunds = students * pct('s-refund') * price;
    const self = (eligible - students) * pct('s-selfr') * num('s-selfp');
    const net = (course - refunds) + self - (course + self) * fee;
    const coaches = Math.max(1, Math.ceil((students * 3) / Math.max(1, num('s-load'))));
    const cost = num('s-ad') + coaches * num('s-coach') + num('s-tool');
    const profit = net - cost;

    $('o-students').textContent = ppl(students);
    const capNote = $('o-cap');
    if (demand > cap) {
      capNote.textContent = `受付上限で打ち止め（需要は約${ppl(demand)}）`;
      capNote.classList.add('is-warn');
    } else {
      capNote.textContent = `受付上限 ${cap}人／月`;
      capNote.classList.remove('is-warn');
    }
    $('o-sales').textContent = man(net);
    $('o-sales-s').textContent = `12週間コース ${man(course - refunds)}・自習版 ${man(self)}`;
    $('o-profit').textContent = man(profit);
    $('o-profit').classList.toggle('is-neg', profit < 0);
    $('o-profit-s').textContent = `広告費 ${man(num('s-ad'))}・担当 ${coaches}人 ${man(coaches * num('s-coach'))}`;
    $('o-cpa').textContent = students ? yen(num('s-ad') / students) : '–';
    $('o-coaches').textContent = `担当の人数：${coaches}人（在籍 約${ppl(students * 3)}）`;

    const rows = [
      ['LINE登録', leads], ['案内の対象', eligible], ['セミナー視聴', viewers],
      ['申込', applicants], ['受講可', approved], ['受講', students],
    ];
    const max = Math.max(leads, 1);
    const box = $('o-funnel');
    box.innerHTML = '';
    rows.forEach(([label, v], i) => {
      const prev = i ? rows[i - 1][1] : null;
      const rate = prev ? `前の段階の${Math.round((v / prev) * 1000) / 10}%` : '';
      const row = document.createElement('li');
      row.className = 'bar';
      row.innerHTML = `<span>${label}</span><span class="bar__track" aria-hidden="true"><span class="bar__fill" style="width:${((v / max) * 100).toFixed(2)}%"></span></span><span class="bar__v">${ppl(v)}${rate ? `<small>${rate}</small>` : ''}</span>`;
      row.title = `${label}：${ppl(v)}${rate ? `（${rate}）` : ''}`;
      box.append(row);
    });
  }
  document.getElementById('sim-form').addEventListener('input', calc);
  calc();
})();
