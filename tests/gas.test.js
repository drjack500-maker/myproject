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
  const api = {
    name, rows,
    getRange(r, c, nr = 1, nc = 1) {
      if (typeof r === 'string') return rangeStub();
      return {
        setValues(v) { v.forEach((row, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((val, j) => { rows[r - 1 + i][c - 1 + j] = val; }); }); return this; },
        clearContent() { for (let i = 0; i < nr; i++) if (rows[r - 1 + i]) for (let j = 0; j < nc; j++) rows[r - 1 + i][c - 1 + j] = ''; return this; },
        setFontWeight() { return this; }, setBackground() { return this; }, setNumberFormat() { return this; }, setDataValidation() { return this; },
      };
    },
    appendRow(row) { rows.push(row.slice()); },
    getDataRange() { return { getValues: () => rows.map((r) => r.slice()) }; },
    getLastRow() { return rows.length; },
    getMaxRows() { return 1000; },
    setFrozenRows() {}, setFrozenColumns() {}, setConditionalFormatRules() {},
  };
  function rangeStub() { return { setNumberFormat() { return this; } }; }
  return api;
}

function load() {
  const sheets = {};
  const mails = [];
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
    },
  };
  vm.createContext(ctx);
  vm.runInContext(`${SRC}\n;this.__api = { doPost, doGet, setup, buildConversionSheet, SETTINGS, COLUMNS };`, ctx);
  return { api: ctx.__api, sheets, mails, cache };
}

const post = (api, fields, concerns = []) => {
  const parameter = { ...fields };
  const parameters = { concerns };
  return JSON.parse(api.doPost({ parameter, parameters }).body);
};

const VALID = {
  name: '名駅 花子', tel: '090-1234-5678', email: 'hanako@example.jp', age: '60代', who: '本人',
  date1: '2026-10-02', time1: '午後（14:30〜17:00）', date2: '', time2: '', note: '=HYPERLINK("x")',
  elapsed: '40', gclid: 'Cj0TEST', utm_source: 'google', utm_term: 'オールオン4 費用', lp_variant: 'price',
};

test('valid submission is saved, notifies clinic and auto-replies', () => {
  const { api, sheets, mails } = load();
  api.SETTINGS.notifyTo = 'reception@clinic.test';
  const res = post(api, VALID, ['入れ歯が合わない・外れる', '費用を知りたい']);
  assert.deepEqual(res, { ok: true });
  const sheet = sheets[api.SETTINGS.sheetName];
  assert.equal(sheet.rows.length, 2, 'header + 1 row');
  const row = sheet.rows[1];
  const col = (k) => api.COLUMNS.findIndex(([key]) => key === k);
  assert.equal(row[col('status')], '未対応');
  assert.equal(row[col('tel')], "'090-1234-5678", 'phone kept as text');
  assert.equal(row[col('note')], "'=HYPERLINK(\"x\")", 'formula injection neutralised');
  assert.equal(row[col('concerns')], '入れ歯が合わない・外れる / 費用を知りたい');
  assert.equal(row[col('gclid')], 'Cj0TEST');
  assert.equal(mails.length, 2);
  assert.match(mails[0].subject, /予約リクエスト：名駅 花子 様（第1希望 10月2日（金））/);
  assert.equal(mails[1].to, 'hanako@example.jp');
  assert.match(mails[1].body, /第1希望：10月2日（金） 午後/);
});

test('placeholder notify address does not send clinic mail', () => {
  const { api, mails } = load();
  post(api, { ...VALID, email: '' });
  assert.equal(mails.length, 0);
});

test('honeypot and too-fast submissions are silently dropped', () => {
  const { api, sheets } = load();
  assert.deepEqual(post(api, { ...VALID, website: 'http://spam' }), { ok: true });
  assert.deepEqual(post(api, { ...VALID, elapsed: '2' }), { ok: true });
  assert.equal(sheets[api.SETTINGS.sheetName], undefined, 'nothing written');
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
  const col = (k) => api.COLUMNS.findIndex(([key]) => key === k);
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
