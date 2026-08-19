/**
 * Script Properties
 * @type {GoogleAppsScript.Properties.Properties}
 */
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
  PRIMARY: '#06C755',
  TEXT: '#111111',
  SUB_TEXT: '#8C8C8C',
  BORDER: '#EEEEEE',
};

function getSpreadsheetId_() {
  const id = PROPS.getProperty(KEYS.SPREADSHEET_ID);
  if (!id) {
    throw new Error('SPREADSHEET_ID がScript Propertiesに設定されていません');
  }
  return id;
}

function getLiffUrl_() {
  return PROPS.getProperty(KEYS.LIFF_URL) || '';
}
