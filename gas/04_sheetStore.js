/**
 * Spreadsheet を軽量DBとして扱うヘルパー群。
 * シートが無ければ作成し、ヘッダー行のスキーマを保証してから読み書きする。
 */

const SCHEMA = {
  [SHEET.USERS]: ['userId', 'displayName', 'pictureUrl', 'createdAt', 'updatedAt'],
  [SHEET.EVENTS]: [
    'eventId', 'creatorUserId', 'title', 'description', 'deadline',
    'status', 'workspaceId', 'createdAt', 'updatedAt', 'editorUserIds', 'icon',
  ],
  [SHEET.EVENT_OPTIONS]: ['optionId', 'eventId', 'startAt', 'endAt', 'sort', 'title', 'location'],
  [SHEET.RESPONSES]: ['eventId', 'optionId', 'userId', 'answer', 'answeredAt', 'updatedAt', 'comment'],
  [SHEET.COMMENTS]: ['commentId', 'eventId', 'optionId', 'userId', 'text', 'createdAt'],
};

// 1回のリクエスト実行内で SpreadsheetApp.openById / シート取得 / 行読み込みを使い回すためのキャッシュ。
// GASの openById はネットワーク往復を伴い遅いため、同一実行内での再オープンを避けるのが目的。
// 書き込み（append/update/delete）のたびに該当シートの行キャッシュだけ破棄する。
let _spreadsheetCache_ = null;
let _sheetCache_ = {};
let _rowsCache_ = {};

function getSpreadsheet_() {
  if (!_spreadsheetCache_) {
    _spreadsheetCache_ = SpreadsheetApp.openById(getSpreadsheetId_());
  }
  return _spreadsheetCache_;
}

function getOrCreateSheet_(sheetName) {
  if (_sheetCache_[sheetName]) return _sheetCache_[sheetName];
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  ensureSheetSchema_(sheet, sheetName);
  _sheetCache_[sheetName] = sheet;
  return sheet;
}

function ensureSheetSchema_(sheet, sheetName) {
  const headers = SCHEMA[sheetName];
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return;
  }
  // スキーマ拡張は末尾への追加のみを想定。既存ヘッダーより列数が少なければ、
  // 足りない分だけ末尾に追記する（既存データの列位置はそのまま保つ）。
  if (lastCol < headers.length) {
    const missing = headers.slice(lastCol);
    sheet.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
}

function sheetRowsAsObjects_(sheetName) {
  if (_rowsCache_[sheetName]) return _rowsCache_[sheetName];
  const sheet = getOrCreateSheet_(sheetName);
  const headers = SCHEMA[sheetName];
  const lastRow = sheet.getLastRow();
  let rows;
  if (lastRow < 2) {
    rows = [];
  } else {
    const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    rows = values.map((row, i) => {
      const obj = { _rowIndex: i + 2 };
      headers.forEach((h, idx) => { obj[h] = row[idx]; });
      return obj;
    });
  }
  const result = { sheet, headers, rows };
  _rowsCache_[sheetName] = result;
  return result;
}

function appendRowObject_(sheetName, obj) {
  const sheet = getOrCreateSheet_(sheetName);
  const headers = SCHEMA[sheetName];
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ''));
  sheet.appendRow(row);
  delete _rowsCache_[sheetName];
}

function deleteRows_(sheetName, rowIndices) {
  const sheet = getOrCreateSheet_(sheetName);
  const sorted = [...rowIndices].sort((a, b) => b - a);
  sorted.forEach((rowIndex) => sheet.deleteRow(rowIndex));
  delete _rowsCache_[sheetName];
}

function updateRowObject_(sheetName, rowIndex, obj) {
  const sheet = getOrCreateSheet_(sheetName);
  const headers = SCHEMA[sheetName];
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ''));
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  delete _rowsCache_[sheetName];
}

function upsertUser_(userId, displayName, pictureUrl) {
  const { rows } = sheetRowsAsObjects_(SHEET.USERS);
  const now = new Date();
  const existing = rows.find((r) => r.userId === userId);
  if (existing) {
    const changed = (displayName && existing.displayName !== displayName) ||
      (pictureUrl && existing.pictureUrl !== pictureUrl);
    if (changed) {
      updateRowObject_(SHEET.USERS, existing._rowIndex, {
        ...existing,
        displayName: displayName || existing.displayName,
        pictureUrl: pictureUrl || existing.pictureUrl,
        updatedAt: now,
      });
    }
    return;
  }
  appendRowObject_(SHEET.USERS, {
    userId, displayName: displayName || '', pictureUrl: pictureUrl || '', createdAt: now, updatedAt: now,
  });
}
