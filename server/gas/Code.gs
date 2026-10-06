/**
 * オールオン4 LP 予約フォーム受信スクリプト（Google Apps Script）
 *
 * できること
 *   - LPの予約リクエストをスプレッドシート（予約台帳）に保存
 *   - 医院の担当者へ通知メール、メールアドレスを入力した方へ自動返信
 *   - 来院・成約を台帳に記入すると、Google 広告の「オフライン コンバージョン」取り込み用シートを作成
 *   - Meta 広告（Instagram・Facebook）のコンバージョンAPIに予約（Lead）を送信（設定したときだけ）
 *
 * 設置手順（詳しくは server/gas/README.md）
 *   1. Google スプレッドシートを新規作成 →［拡張機能］→［Apps Script］
 *   2. このファイルの内容を貼り付け、下の SETTINGS を編集して保存
 *   3. 関数「setup」を1回実行（シートの作成・権限の承認）
 *   4. ［デプロイ］→［新しいデプロイ］→ 種類「ウェブアプリ」
 *      実行ユーザー：自分 ／ アクセスできるユーザー：全員
 *   5. 表示された「…/exec」のURLを lp/assets/js/main.js の CONFIG.formEndpoint に設定（npm run sync:006 で lp-006 にも反映）
 */

const SETTINGS = {
  // 通知メールの送信先（複数ある場合はカンマ区切り）【要設定】
  notifyTo: 'clinic@example.com',
  clinicName: '名駅歯科クリニック・矯正歯科',
  clinicTel: '052-571-3345',
  clinicHours: '電話受付 月〜金 9:00〜19:00',
  // メールアドレスを入力した方へ自動返信する
  sendAutoReply: true,
  sheetName: '予約台帳',
  conversionSheetName: '広告CV取り込み',
  // Google 広告で作成するコンバージョン アクション名と完全に一致させる
  conversionNames: {
    visit: 'オールオン4 来院',
    contract: 'オールオン4 成約',
  },
  // 同じ電話番号からの連続送信を無視する秒数（二重送信・いたずら対策）
  duplicateWindowSec: 120,
  // ページを開いてから送信までがこれより短い場合はロボットとみなす（秒）
  minElapsedSec: 5,
  // Meta（Instagram・Facebook広告）のコンバージョンAPI。pixelId を入れたときだけ送信する【任意】
  // アクセストークンはコードに書かず、［プロジェクトの設定］→［スクリプト プロパティ］に
  // META_ACCESS_TOKEN という名前で保存する（手順は server/gas/README.md）
  meta: {
    pixelId: '',
    apiVersion: 'v26.0',
    // イベントマネージャの［テストイベント］で確認するときだけ入れる（例：TEST12345）。確認後は空に戻す
    testEventCode: '',
    // true にすると電話番号・メールアドレスをハッシュ化（SHA-256）して送り、広告との照合精度を上げる。
    // 個人情報の第三者提供にあたるため、個人情報の取り扱い（privacy.html）への明記と同意の取得が必要。初期値は送らない
    sendHashedContact: false,
  },
};

// 台帳の列（key はフォームの name 属性）
const COLUMNS = [
  ['received_at', '受付日時'],
  ['status', '対応状況'],
  ['name', 'お名前'],
  ['tel', '電話番号'],
  ['email', 'メール'],
  ['age', '年代'],
  ['who', '相談者'],
  ['concerns', 'ご相談内容'],
  ['date1', '第1希望日'],
  ['time1', '第1希望時間'],
  ['date2', '第2希望日'],
  ['time2', '第2希望時間'],
  ['contact_time', '電話希望時間'],
  ['note', 'ご質問・ご要望'],
  ['visit_at', '来院日時'],
  ['contract_at', '成約日時'],
  ['contract_value', '成約金額'],
  ['memo', '対応メモ'],
  ['lp_variant', '見出しパターン'],
  ['utm_source', 'utm_source'],
  ['utm_medium', 'utm_medium'],
  ['utm_campaign', 'utm_campaign'],
  ['utm_term', 'utm_term'],
  ['utm_content', 'utm_content'],
  ['gclid', 'gclid'],
  ['gbraid', 'gbraid'],
  ['wbraid', 'wbraid'],
  ['yclid', 'yclid'],
  ['fbclid', 'fbclid'],
  ['fbc', 'fbc'],
  ['fbp', 'fbp'],
  ['event_id', 'イベントID'],
  ['meta_capi', 'Meta送信'],
  ['landing_url', '流入ページ'],
  ['referrer', '参照元'],
];
const STAFF_COLUMNS = ['status', 'visit_at', 'contract_at', 'contract_value', 'memo'];
// フォームからは受け取らず、スクリプトが書き込む列
const SYSTEM_COLUMNS = ['received_at', 'status', 'meta_capi'];
const STATUS_OPTIONS = ['未対応', '連絡済み', '予約確定', '来院', '成約', '失注', 'キャンセル', 'スパム疑い'];
const SPAM_STATUS = 'スパム疑い';
const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

/* ----------------------------------------------------------------
   受信
   ---------------------------------------------------------------- */
function doPost(e) {
  try {
    const p = (e && e.parameter) || {};
    const ps = (e && e.parameters) || {};

    // スパムの疑い（人には見えない項目に入力がある／送信が速すぎる）：
    // 捨てずに「スパム疑い」として台帳に残し、通知・自動返信はしない（自動入力で埋まった本物の予約を失わないため）
    const suspicious = !!(p.hp_extra || p.website) || Number(p.elapsed || 0) < SETTINGS.minElapsedSec;

    const data = {};
    COLUMNS.forEach(([key]) => { data[key] = clean_(p[key], key === 'note' ? 1000 : 500); });
    data.concerns = (ps.concerns || []).map((v) => clean_(v, 60)).filter(String).join(' / ');

    const telDigits = data.tel.replace(/[^\d]/g, '');
    if (!data.name || !/^0\d{9,10}$/.test(telDigits) || !data.date1 || !data.time1) {
      return json_({ ok: false, error: 'invalid' });
    }

    let sheet;
    let cols;
    let rowIndex;
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      // 同じ電話番号からの連続送信（二重クリック等）は1件として扱う
      const cache = CacheService.getScriptCache();
      const dupKey = 'tel_' + telDigits;
      if (cache.get(dupKey)) return json_({ ok: true, duplicate: true });

      sheet = getSheet_();
      // 列は位置ではなく見出し名で対応づける（列の追加・並べ替えがあってもずれない）
      cols = ensureColumns_(sheet);
      const row = new Array(sheet.getLastColumn()).fill('');
      COLUMNS.forEach(([key]) => {
        let v;
        if (key === 'received_at') v = new Date();
        else if (key === 'status') v = suspicious ? SPAM_STATUS : STATUS_OPTIONS[0];
        else if (STAFF_COLUMNS.indexOf(key) !== -1 || SYSTEM_COLUMNS.indexOf(key) !== -1) v = '';
        else v = asText_(data[key]);
        row[cols[key] - 1] = v;
      });
      sheet.appendRow(row);
      rowIndex = sheet.getLastRow();
      ensureCapacity_(sheet, cols);
      cache.put(dupKey, '1', SETTINGS.duplicateWindowSec);
    } finally {
      lock.releaseLock();
    }

    if (suspicious) return json_({ ok: true, flagged: true });

    // Meta コンバージョンAPI（設定時のみ）。失敗しても予約の受付には影響させない
    try {
      const result = sendMetaLead_(data, p);
      if (result) sheet.getRange(rowIndex, cols.meta_capi).setValue(result);
    } catch (err) { console.error('meta capi failed', err); }

    // 台帳への保存は完了しているため、メール送信の失敗は記録のみ（利用者にはエラーを返さない）
    try { notify_(data); } catch (err) { console.error('notify failed', err); }
    if (SETTINGS.sendAutoReply && isEmail_(data.email)) {
      try { autoReply_(data); } catch (err) { console.error('auto reply failed', err); }
    }

    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
}

// 動作確認用（ブラウザでURLを開くと "ok" と表示）
function doGet() {
  return ContentService.createTextOutput('ok');
}

/* ----------------------------------------------------------------
   初期設定・メニュー
   ---------------------------------------------------------------- */
function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone('Asia/Tokyo');
  const sheet = getSheet_();
  const cols = ensureColumns_(sheet);
  applyFormats_(sheet, cols);
  getConversionSheet_();
  const msg = '初期設定が完了しました。続けて［デプロイ］→［新しいデプロイ］でウェブアプリとして公開してください。';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
}

// 対応状況のプルダウン・日付の表示形式・行の色分けを、2行目から最終行まで設定する
function applyFormats_(sheet, cols) {
  const n = sheet.getMaxRows() - 1;
  const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_OPTIONS, true).setAllowInvalid(false).build();
  sheet.getRange(2, cols.status, n, 1).setDataValidation(rule);
  ['received_at', 'visit_at', 'contract_at'].forEach((key) => sheet.getRange(2, cols[key], n, 1).setNumberFormat('yyyy/mm/dd hh:mm'));
  sheet.getRange(2, cols.contract_value, n, 1).setNumberFormat('#,##0');

  // 医院スタッフが記入する列を色分け
  STAFF_COLUMNS.forEach((key) => sheet.getRange(1, cols[key]).setBackground('#fde7d6'));

  // 対応状況で行を色分け
  const range = sheet.getRange(2, 1, n, sheet.getLastColumn());
  const letter = columnLetter_(cols.status);
  const color = (status, bg) => SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + letter + '2="' + status + '"').setBackground(bg).setRanges([range]).build();
  sheet.setConditionalFormatRules([
    color('未対応', '#fff4d6'),
    color('成約', '#dff3e4'),
    color('失注', '#eeeeee'),
    color('キャンセル', '#eeeeee'),
    color(SPAM_STATUS, '#f3e5e5'),
  ]);
}

// 空き行が少なくなったら行を追加し、書式を追加分にも広げる（新しい行でもプルダウンや色分けが効くように）
function ensureCapacity_(sheet, cols) {
  if (sheet.getMaxRows() - sheet.getLastRow() >= 50) return;
  sheet.insertRowsAfter(sheet.getMaxRows(), 1000);
  applyFormats_(sheet, cols);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('LP予約')
    .addItem('広告CV取り込みシートを更新', 'buildConversionSheet')
    .addSeparator()
    .addItem('初期設定（最初に1回）', 'setup')
    .addToUi();
}

/* ----------------------------------------------------------------
   Google 広告 オフライン コンバージョン取り込みシート
   台帳の「来院日時」「成約日時」「成約金額」に記入 → メニューから更新
   Google 広告の［コンバージョン］→［アップロード］→［スケジュール］で
   このシートを定期取り込みに設定できます。
   ---------------------------------------------------------------- */
function buildConversionSheet() {
  const sheet = getSheet_();
  const out = getConversionSheet_();
  const values = sheet.getDataRange().getValues();
  const cols = ensureColumns_(sheet);
  const idx = {};
  COLUMNS.forEach(([key]) => { idx[key] = cols[key] - 1; });

  const rows = [];
  values.slice(1).forEach((r) => {
    const gclid = String(r[idx.gclid] || '').replace(/^'/, '').trim();
    if (!gclid) return;
    const visit = r[idx.visit_at];
    const contract = r[idx.contract_at];
    const value = Number(String(r[idx.contract_value] || '').replace(/[^\d.]/g, '')) || '';
    if (isDate_(visit)) rows.push([gclid, SETTINGS.conversionNames.visit, adsTime_(visit), '', 'JPY']);
    if (isDate_(contract)) rows.push([gclid, SETTINGS.conversionNames.contract, adsTime_(contract), value, value ? 'JPY' : '']);
  });

  out.getRange(2, 1, Math.max(out.getLastRow() - 1, 1), 5).clearContent();
  if (rows.length) out.getRange(2, 1, rows.length, 5).setValues(rows);
  try { SpreadsheetApp.getActive().toast(rows.length + '件のコンバージョンを書き出しました', 'LP予約'); } catch (e) { /* トリガー実行時は表示しない */ }
}

/* ----------------------------------------------------------------
   Meta コンバージョンAPI（Instagram・Facebook 広告）
   ブラウザのピクセルと同じ event_id で送るため、両方で届いても1件として数えられる。
   初期設定では、広告クリックID（fbc）・ブラウザID（fbp）・ブラウザ情報だけを送り、
   お名前・電話番号などの入力内容は送らない（sendHashedContact を true にした場合のみ、ハッシュ化して送る）
   ---------------------------------------------------------------- */
function sendMetaLead_(d, p) {
  const m = SETTINGS.meta || {};
  if (!m.pixelId) return '';
  const token = PropertiesService.getScriptProperties().getProperty('META_ACCESS_TOKEN');
  if (!token) return '未設定（アクセストークンなし）';
  // 広告と照合できる情報（クリックID・ブラウザID・ハッシュ化した連絡先）がなければ送らない。
  // どの広告の成果かは Meta 側で判定される（ブラウザのピクセルと同じ考え方）
  if (!d.fbc && !d.fbp && !m.sendHashedContact) return '';

  const userData = { client_user_agent: clean_(p.client_ua, 400) };
  if (d.fbc) userData.fbc = d.fbc;
  if (d.fbp) userData.fbp = d.fbp;
  if (m.sendHashedContact) {
    const ph = normalizePhone_(d.tel);
    if (ph) userData.ph = [sha256_(ph)];
    if (isEmail_(d.email)) userData.em = [sha256_(d.email.trim().toLowerCase())];
    userData.country = [sha256_('jp')];
  }
  const event = {
    event_name: 'Lead',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: d.landing_url || '',
    user_data: userData,
  };
  if (d.event_id) event.event_id = d.event_id;
  const payload = { data: [event] };
  if (m.testEventCode) payload.test_event_code = m.testEventCode;

  const url = 'https://graph.facebook.com/' + m.apiVersion + '/' + encodeURIComponent(m.pixelId) + '/events?access_token=' + encodeURIComponent(token);
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code >= 200 && code < 300) return '送信済み';
  let message = '';
  try { message = JSON.parse(res.getContentText()).error.message; } catch (e) { message = res.getContentText(); }
  console.error('meta capi error', code, message);
  return ('エラー ' + code + '：' + String(message || '')).slice(0, 200);
}

// 日本の電話番号を国番号つきの数字だけにする（090-1234-5678 → 819012345678）
function normalizePhone_(tel) {
  const digits = String(tel || '').replace(/[^\d]/g, '');
  if (/^0\d{9,10}$/.test(digits)) return '81' + digits.slice(1);
  return '';
}

function sha256_(text) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return bytes.map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

/* ----------------------------------------------------------------
   メール
   ---------------------------------------------------------------- */
function notify_(d) {
  if (!SETTINGS.notifyTo || /example\.com$/.test(SETTINGS.notifyTo)) return;
  const url = SpreadsheetApp.getActive().getUrl();
  const body = [
    'オールオン4 LP から予約リクエストが届きました。',
    '',
    '【対応手順】',
    '① できるだけ早く（遅くとも当日中に）お電話し、日時を確定',
    '② 予約システム（Apotool）に予約を登録',
    '③ 予約台帳の「対応状況」を更新（つながらない場合は「連絡済み」＋メモ）',
    '',
    '■ お名前：' + d.name,
    '■ 電話番号：' + d.tel,
    '■ メール：' + (d.email || '（未入力）'),
    '■ 第1希望：' + dateLabel_(d.date1) + ' ' + d.time1,
    '■ 第2希望：' + (d.date2 ? dateLabel_(d.date2) + ' ' + d.time2 : '（なし）'),
    '■ お電話のご希望時間帯：' + (d.contact_time || '（指定なし）'),
    '■ 相談者：' + (d.who || ''),
    '■ 年代：' + (d.age || '（未選択）'),
    '■ ご相談内容：' + (d.concerns || '（未選択）'),
    '■ ご質問・ご要望：',
    d.note || '（なし）',
    '',
    '■ 流入：' + [d.utm_source, d.utm_campaign, d.utm_content, d.utm_term].filter(String).join(' / '),
    '■ 流入ページ：' + (d.landing_url || '').split('?')[0],
    '■ 見出しパターン：' + (d.lp_variant || 'default'),
    '',
    '予約台帳：' + url,
  ].join('\n');
  MailApp.sendEmail({
    to: SETTINGS.notifyTo,
    subject: '【オールオン4 LP】予約リクエスト：' + d.name + ' 様（第1希望 ' + dateLabel_(d.date1) + '）',
    body: body,
    name: 'オールオン4 LP',
  });
}

function autoReply_(d) {
  const body = [
    d.name + ' 様',
    '',
    'このたびは' + SETTINGS.clinicName + 'の無料カウンセリングにお申し込みいただき、ありがとうございます。',
    '以下の内容でご予約リクエストを受け付けました。',
    '',
    '■ 第1希望：' + dateLabel_(d.date1) + ' ' + d.time1,
    d.date2 ? '■ 第2希望：' + dateLabel_(d.date2) + ' ' + d.time2 : '',
    '',
    'ご予約はまだ確定していません。',
    '内容を確認のうえ、当院よりお電話（' + SETTINGS.clinicTel + '）でご連絡し、日時を確定いたします。',
    '',
    '【ご来院時にお持ちいただくと便利なもの】',
    '・健康保険証',
    '・お薬手帳（服用中のお薬がある方）',
    '・今お使いの入れ歯',
    '',
    'ご家族とご一緒のご来院も歓迎です。',
    'お急ぎの場合や、ご予約内容の変更はお電話でご連絡ください。',
    '',
    '――――――――――――――――',
    SETTINGS.clinicName,
    '〒450-0002 愛知県名古屋市中村区名駅3-13-31 名駅モリシタビル8階',
    'JR・名鉄「名古屋駅」3番出口から徒歩2分',
    'TEL ' + SETTINGS.clinicTel + '（' + SETTINGS.clinicHours + '）',
    '――――――――――――――――',
    '※このメールは自動送信です。ご不明な点はお電話でお問い合わせください。',
    '※お心当たりのない場合は、お手数ですが上記までご連絡ください。',
  ].filter((line, i, arr) => !(line === '' && arr[i - 1] === '')).join('\n');
  MailApp.sendEmail({
    to: d.email,
    subject: '【' + SETTINGS.clinicName + '】ご予約リクエストを受け付けました',
    body: body,
    name: SETTINGS.clinicName,
  });
}

/* ----------------------------------------------------------------
   ユーティリティ
   ---------------------------------------------------------------- */
function getSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SETTINGS.sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS.sheetName, 0);
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS.map(([, label]) => label)])
      .setFontWeight('bold').setBackground('#e3f0f1');
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(3);
  }
  return sheet;
}

function getConversionSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SETTINGS.conversionSheetName);
  if (!sheet) {
    sheet = ss.insertSheet(SETTINGS.conversionSheetName);
    sheet.getRange(1, 1, 1, 5).setValues([['Google Click ID', 'Conversion Name', 'Conversion Time', 'Conversion Value', 'Conversion Currency']])
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:C').setNumberFormat('@');
  }
  return sheet;
}

// 見出し行から「項目 → 列番号（1始まり）」を作る。足りない見出しは右端に追加する
function ensureColumns_(sheet) {
  const lastCol = sheet.getLastColumn();
  const header = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map((v) => String(v).trim()) : [];
  const cols = {};
  COLUMNS.forEach(([key, label]) => {
    let i = header.indexOf(label);
    if (i === -1) {
      header.push(label);
      i = header.length - 1;
      sheet.getRange(1, i + 1).setValue(label).setFontWeight('bold').setBackground('#e3f0f1');
    }
    cols[key] = i + 1;
  });
  return cols;
}

function columnLetter_(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max || 500);
}

// スプレッドシートで数式・数値として解釈されないようにする（先頭0の電話番号、=+-@ で始まる値）
function asText_(v) {
  if (v === '') return '';
  return /^[=+\-@0]/.test(v) || /^\d+$/.test(v) ? "'" + v : v;
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

function isEmail_(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v || '');
}

function dateLabel_(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number(m[2]) + '月' + Number(m[3]) + '日（' + WEEK[d.getDay()] + '）';
}

function adsTime_(date) {
  return Utilities.formatDate(date, 'Asia/Tokyo', "yyyy-MM-dd HH:mm:ss") + '+0900';
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
