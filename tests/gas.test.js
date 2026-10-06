/*
 * server/gas/Code.gs の動作確認（Google のサービスを模擬して Node で実行）
 * 実行：node --test tests/
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'server', 'gas', 'Code.gs'), 'utf8');

function makeSheet(name) {
  const rows = [];
  let maxRows = 1000;
  const cell = (r, c) => { const v = (rows[r - 1] || [])[c - 1]; return v === undefined ? '' : v; };
  const api = {
    name, rows, inserted: 0,
    getRange(r, c, nr = 1, nc = 1) {
      if (typeof r === 'string') return { setNumberFormat() { return this; } };
      const range = {
        getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (__, j) => cell(r + i, c + j))),
        setValues(v) { v.forEach((row, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((val, j) => { rows[r - 1 + i][c - 1 + j] = val; }); }); return range; },
        setValue(v) { return range.setValues([[v]]); },
        clearContent() { for (let i = 0; i < nr; i++) if (rows[r - 1 + i]) for (let j = 0; j < nc; j++) rows[r - 1 + i][c - 1 + j] = ''; return range; },
        setFontWeight() { return range; }, setBackground() { return range; }, setNumberFormat() { return range; }, setDataValidation() { return range; },
      };
      return range;
    },
    appendRow(row) { rows.push(row.slice()); },
    getDataRange() { const w = api.getLastColumn(); return { getValues: () => rows.map((r) => Array.from({ length: w }, (_, j) => (r[j] === undefined ? '' : r[j]))) }; },
    getLastRow() { return rows.length; },
    getLastColumn() { return rows.reduce((m, r) => Math.max(m, (r || []).length), 0); },
    getMaxRows() { return maxRows; },
    setMaxRows(n) { maxRows = n; },
    insertRowsAfter(_, n) { maxRows += n; api.inserted += n; },
    setFrozenRows() {}, setFrozenColumns() {}, setConditionalFormatRules() {},
  };
  return api;
}

function load({ props = {}, fetchResponse = { code: 200, body: '{"events_received":1}' } } = {}) {
  const sheets = {};
  const mails = [];
  const fetches = [];
  const cache = new Map();
  const chain = () => new Proxy({}, { get: (t, k) => (k === 'build' ? () => ({}) : () => chain()) });
  const ctx = {
    console: { log() {}, error() {} },
    SpreadsheetApp: {
      getActive: () => ({
        getSheetByName: (n) => sheets[n] || null,
        insertSheet: (n) => (sheets[n] = makeSheet(n)),
        getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST',
        setSpreadsheetTimeZone() {},
        toast() {},
      }),
      getUi: () => { throw new Error('no ui'); },
      newDataValidation: chain,
      newConditionalFormatRule: chain,
    },
    CacheService: { getScriptCache: () => ({ get: (k) => cache.get(k) || null, put: (k, v) => cache.set(k, v) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: (m) => mails.push(m) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ body: s, setMimeType() { return this; } }),
    },
    Utilities: {
      formatDate: (d, tz, fmt) => {
        const p = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
      },
      // Apps Script と同じく、符号つきバイト（-128〜127）の配列を返す
      computeDigest: (alg, text) => Array.from(require('node:crypto').createHash('sha256').update(text, 'utf8').digest()).map((b) => (b > 127 ? b - 256 : b)),
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      Charset: { UTF_8: 'UTF_8' },
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] || null }) },
    UrlFetchApp: {
      fetch: (url, opts) => {
        fetches.push({ url, opts, payload: JSON.parse(opts.payload) });
        return { getResponseCode: () => fetchResponse.code, getContentText: () => fetchResponse.body };
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(`${SRC}\n;this.__api = { doPost, doGet, setup, buildConversionSheet, SETTINGS, COLUMNS };`, ctx);
  return { api: ctx.__api, sheets, mails, fetches, cache, ctx };
}

// 見出し名から列の位置を求める（台帳は見出し名で対応づけるため）
const colOf = (api, sheet, key) => sheet.rows[0].indexOf(api.COLUMNS.find(([k]) => k === key)[1]);

const post = (api, fields, concerns = []) => {
  const parameter = { ...fields };
  const parameters = { concerns };
  return JSON.parse(api.doPost({ parameter, parameters }).body);
};

const VALID = {
  name: '名駅 花子', tel: '090-1234-5678', email: 'hanako@example.jp', age: '60代', who: '本人',
  date1: '2026-10-02', time1: '午後（14:30〜17:00）', date2: '', time2: '', note: '=HYPERLINK("x")',
  contact_time: '夕方（17:00〜19:00）', elapsed: '40', gclid: 'Cj0TEST', utm_source: 'google', utm_term: 'オールオン4 費用', lp_variant: 'price',
};

test('valid submission is saved, notifies clinic and auto-replies', () => {
  const { api, sheets, mails } = load();
  api.SETTINGS.notifyTo = 'reception@clinic.test';
  const res = post(api, VALID, ['入れ歯が合わない・外れる', '費用を知りたい']);
  assert.deepEqual(res, { ok: true });
  const sheet = sheets[api.SETTINGS.sheetName];
  assert.equal(sheet.rows.length, 2, 'header + 1 row');
  const row = sheet.rows[1];
  const col = (k) => colOf(api, sheet, k);
  assert.equal(row[col('status')], '未対応');
  assert.equal(row[col('tel')], "'090-1234-5678", 'phone kept as text');
  assert.equal(row[col('note')], "'=HYPERLINK(\"x\")", 'formula injection neutralised');
  assert.equal(row[col('concerns')], '入れ歯が合わない・外れる / 費用を知りたい');
  assert.equal(row[col('gclid')], 'Cj0TEST');
  assert.equal(row[col('contact_time')], '夕方（17:00〜19:00）');
  assert.equal(mails.length, 2);
  assert.match(mails[0].subject, /予約リクエスト：名駅 花子 様（第1希望 10月2日（金））/);
  assert.match(mails[0].body, /お電話のご希望時間帯：夕方/);
  assert.match(mails[0].body, /予約システム（Apotool）に予約を登録/);
  assert.match(mails[0].body, /■ 流入ページ：\n/, 'landing_url がなくても空欄で表示');
  assert.equal(mails[1].to, 'hanako@example.jp');
  assert.match(mails[1].body, /第1希望：10月2日（金） 午後/);
});

test('placeholder notify address does not send clinic mail', () => {
  const { api, mails } = load();
  post(api, { ...VALID, email: '' });
  assert.equal(mails.length, 0);
});

test('honeypot and too-fast submissions are kept as spam suspects without emails', () => {
  const { api, sheets, mails } = load();
  api.SETTINGS.notifyTo = 'reception@clinic.test';
  assert.deepEqual(post(api, { ...VALID, hp_extra: 'http://spam' }), { ok: true, flagged: true });
  assert.deepEqual(post(api, { ...VALID, tel: '080-1111-2222', elapsed: '2' }), { ok: true, flagged: true });
  const sheet = sheets[api.SETTINGS.sheetName];
  assert.equal(sheet.rows.length, 3, 'saved, not dropped');
  assert.equal(sheet.rows[1][colOf(api, sheet, 'status')], 'スパム疑い');
  assert.equal(sheet.rows[2][colOf(api, sheet, 'status')], 'スパム疑い');
  assert.equal(mails.length, 0, 'no notification or auto-reply');
});

test('existing ledger with an older column layout stays aligned by header name', () => {
  const { api, sheets, ctx } = load();
  // 旧版の台帳：列の順番が違い、「電話希望時間」の列がない。スタッフが独自の列も追加している
  const oldLabels = api.COLUMNS.filter(([k]) => k !== 'contact_time').map(([, l]) => l).reverse();
  const sheet = ctx.SpreadsheetApp.getActive().insertSheet(api.SETTINGS.sheetName);
  sheet.rows.push([...oldLabels, '院内メモ']);
  post(api, VALID);
  const header = sheet.rows[0];
  assert.equal(header[header.length - 1], '電話希望時間', 'missing column appended at the end');
  const row = sheet.rows[1];
  assert.equal(row[header.indexOf('お名前')], '名駅 花子');
  assert.equal(row[header.indexOf('gclid')], 'Cj0TEST');
  assert.equal(row[header.indexOf('電話希望時間')], '夕方（17:00〜19:00）');
  assert.equal(row[header.indexOf('院内メモ')], '', 'custom staff column left empty');
});

test('rows and formatting are extended before the sheet fills up', () => {
  const { api, sheets } = load();
  post(api, VALID);
  const sheet = sheets[api.SETTINGS.sheetName];
  sheet.setMaxRows(40);
  post(api, { ...VALID, tel: '080-3333-4444' });
  assert.equal(sheet.inserted, 1000);
  assert.equal(sheet.getMaxRows(), 1040);
});

test('invalid phone or missing date is rejected', () => {
  const { api } = load();
  assert.equal(post(api, { ...VALID, tel: '12345' }).ok, false);
  assert.equal(post(api, { ...VALID, date1: '' }).ok, false);
  assert.equal(post(api, { ...VALID, name: '' }).ok, false);
});

test('duplicate submission from the same phone is stored once', () => {
  const { api, sheets } = load();
  post(api, VALID);
  const res = post(api, VALID);
  assert.equal(res.duplicate, true);
  assert.equal(sheets[api.SETTINGS.sheetName].rows.length, 2);
});

test('conversion sheet exports visit and contract rows with gclid only', () => {
  const { api, sheets } = load();
  post(api, VALID);
  post(api, { ...VALID, tel: '080-0000-0000', gclid: '' });
  const sheet = sheets[api.SETTINGS.sheetName];
  const col = (k) => colOf(api, sheet, k);
  sheet.rows[1][col('visit_at')] = new Date(2026, 9, 2, 15, 0, 0);
  sheet.rows[1][col('contract_at')] = new Date(2026, 9, 9, 11, 30, 0);
  sheet.rows[1][col('contract_value')] = '1,925,000';
  sheet.rows[2][col('visit_at')] = new Date(2026, 9, 3, 10, 0, 0); // gclid なし → 出力しない
  api.buildConversionSheet();
  const out = sheets[api.SETTINGS.conversionSheetName].rows.filter((r) => r && r[0]);
  assert.deepEqual(out[0], ['Google Click ID', 'Conversion Name', 'Conversion Time', 'Conversion Value', 'Conversion Currency']);
  assert.deepEqual(out.slice(1), [
    ['Cj0TEST', 'オールオン4 来院', '2026-10-02 15:00:00+0900', '', 'JPY'],
    ['Cj0TEST', 'オールオン4 成約', '2026-10-09 11:30:00+0900', 1925000, 'JPY'],
  ]);
});

test('doGet health check', () => {
  const { api } = load();
  assert.equal(api.doGet().body, 'ok');
});

test('setup runs without the spreadsheet UI', () => {
  const { api, sheets } = load();
  assert.doesNotThrow(() => api.setup());
  assert.ok(sheets[api.SETTINGS.sheetName]);
  assert.ok(sheets[api.SETTINGS.conversionSheetName]);
});

/* ---------------- Meta コンバージョンAPI ---------------- */
const sha = (t) => require('node:crypto').createHash('sha256').update(t).digest('hex');
const META = { ...VALID, gclid: '', utm_source: 'meta', fbclid: 'IwAR_TEST', fbc: 'fb.1.1760000000000.IwAR_TEST', fbp: 'fb.1.1759999999999.123456789', event_id: 'evt-123', client_ua: 'Mozilla/5.0 (iPhone) Instagram', landing_url: 'https://www.meieki-dental.net/all_on_4_006/?utm_source=meta&fbclid=IwAR_TEST' };

test('Meta: pixelId 未設定なら送信しない', () => {
  const { api, sheets, fetches } = load({ props: { META_ACCESS_TOKEN: 'TOKEN' } });
  post(api, META);
  assert.equal(fetches.length, 0);
  const sheet = sheets[api.SETTINGS.sheetName];
  assert.equal(sheet.rows[1][colOf(api, sheet, 'meta_capi')], '');
  assert.equal(sheet.rows[1][colOf(api, sheet, 'fbclid')], 'IwAR_TEST');
  assert.equal(sheet.rows[1][colOf(api, sheet, 'event_id')], 'evt-123');
});

test('Meta: Lead を event_id・fbc・fbp つきで送り、連絡先は送らない（初期設定）', () => {
  const { api, sheets, fetches } = load({ props: { META_ACCESS_TOKEN: 'TOKEN' } });
  api.SETTINGS.meta.pixelId = '1234567890';
  assert.deepEqual(post(api, META), { ok: true });
  assert.equal(fetches.length, 1);
  const { url, opts, payload } = fetches[0];
  assert.equal(url, 'https://graph.facebook.com/v26.0/1234567890/events?access_token=TOKEN');
  assert.equal(opts.method, 'post');
  assert.equal(opts.muteHttpExceptions, true);
  const ev = payload.data[0];
  assert.equal(ev.event_name, 'Lead');
  assert.equal(ev.event_id, 'evt-123');
  assert.equal(ev.action_source, 'website');
  assert.equal(ev.event_source_url, META.landing_url);
  assert.ok(Math.abs(ev.event_time - Date.now() / 1000) < 60);
  assert.deepEqual(ev.user_data, { client_user_agent: META.client_ua, fbc: META.fbc, fbp: META.fbp });
  assert.equal(payload.test_event_code, undefined);
  const sheet = sheets[api.SETTINGS.sheetName];
  assert.equal(sheet.rows[1][colOf(api, sheet, 'meta_capi')], '送信済み');
});

test('通知メールに、どちらのLPからの予約か（流入ページ）を表示する', () => {
  const { api, mails } = load();
  api.SETTINGS.notifyTo = 'reception@clinic.test';
  post(api, { ...META, email: '' });
  assert.match(mails[0].body, /■ 流入ページ：https:\/\/www\.meieki-dental\.net\/all_on_4_006\/\n/);
  assert.match(mails[0].body, /■ 流入：meta \//);
});

test('Meta: sendHashedContact のときは電話番号（国番号つき）とメールを SHA-256 で送る', () => {
  const { api, fetches } = load({ props: { META_ACCESS_TOKEN: 'TOKEN' } });
  Object.assign(api.SETTINGS.meta, { pixelId: '1', sendHashedContact: true, testEventCode: 'TEST1' });
  post(api, { ...META, email: ' Hanako@Example.JP ' });
  const { payload } = fetches[0];
  assert.deepEqual(payload.data[0].user_data.ph, [sha('819012345678')]);
  assert.deepEqual(payload.data[0].user_data.em, [sha('hanako@example.jp')]);
  assert.deepEqual(payload.data[0].user_data.country, [sha('jp')]);
  assert.equal(payload.test_event_code, 'TEST1');
});

test('Meta: スパム疑い・照合情報なしは送らない／トークン未設定・エラーは台帳に記録', () => {
  let ctx = load({ props: { META_ACCESS_TOKEN: 'TOKEN' } });
  ctx.api.SETTINGS.meta.pixelId = '1';
  post(ctx.api, { ...META, hp_extra: 'x' });
  post(ctx.api, { ...META, tel: '080-1111-2222', fbc: '', fbp: '' });
  assert.equal(ctx.fetches.length, 0);

  ctx = load();
  ctx.api.SETTINGS.meta.pixelId = '1';
  post(ctx.api, META);
  let sheet = ctx.sheets[ctx.api.SETTINGS.sheetName];
  assert.equal(sheet.rows[1][colOf(ctx.api, sheet, 'meta_capi')], '未設定（アクセストークンなし）');

  ctx = load({ props: { META_ACCESS_TOKEN: 'BAD' }, fetchResponse: { code: 400, body: '{"error":{"message":"Invalid OAuth access token."}}' } });
  ctx.api.SETTINGS.meta.pixelId = '1';
  assert.deepEqual(post(ctx.api, META), { ok: true }, '予約の受付は成功のまま');
  sheet = ctx.sheets[ctx.api.SETTINGS.sheetName];
  assert.equal(sheet.rows[1][colOf(ctx.api, sheet, 'meta_capi')], 'エラー 400：Invalid OAuth access token.');
});

test('フォームから送られた値で、スクリプトが書く列（Meta送信）を上書きできない', () => {
  const { api, sheets } = load();
  post(api, { ...VALID, meta_capi: '送信済み', status: '成約' });
  const sheet = sheets[api.SETTINGS.sheetName];
  assert.equal(sheet.rows[1][colOf(api, sheet, 'meta_capi')], '');
  assert.equal(sheet.rows[1][colOf(api, sheet, 'status')], '未対応');
});
