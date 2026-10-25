/**
 * 設定の名前と決まった値：Script Properties のキー・シートの名前・○△× の印・予定の状態・カードの色。
 * どのファイルからも読む（GAS は全部のファイルが1つの場所に並ぶので、ここは定数と小さな読み出しだけ）。
 */

// Script Properties（SPREADSHEET_ID・LIFF_URL など。値は GAS エディタの「プロジェクトの設定」で入れる）
const PROPS = PropertiesService.getScriptProperties();

/** ========= KEYS ========= */
const KEYS = {
  SPREADSHEET_ID: 'SPREADSHEET_ID',
  LIFF_URL: 'LIFF_URL',
};

/** ========= SHEET NAMES ========= */
const SHEET = {
  USERS: 'USERS',
  EVENTS: 'EVENTS',
  EVENT_OPTIONS: 'EVENT_OPTIONS',
  RESPONSES: 'RESPONSES',
  COMMENTS: 'COMMENTS',
};

/** ========= ANSWER ========= */
const ANSWER = {
  OK: '○',
  MAYBE: '△',
  NG: '×',
};

/** ========= EVENT STATUS ========= */
const EVENT_STATUS = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
};

/** ========= COLOR (Flex) ========= */
const COLOR = {
  PRIMARY: '#0284C7',
  TEXT: '#111111',
  SUB_TEXT: '#8C8C8C',
  BORDER: '#EEEEEE',
};

// 記録を置くスプレッドシートの ID。入っていなければ止める
function getSpreadsheetId_() {
  const id = PROPS.getProperty(KEYS.SPREADSHEET_ID);
  if (!id) {
    throw new Error('SPREADSHEET_ID がScript Propertiesに設定されていません');
  }
  return id;
}

// 画面（LIFF）の URL。カードのボタンの行き先に使う。なければ空
function getLiffUrl_() {
  return PROPS.getProperty(KEYS.LIFF_URL) || '';
}
