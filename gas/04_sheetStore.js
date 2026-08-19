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
  [SHEET.RESPONSES]: ['eventId', 'optionId', 'userId', 'answer', 'answeredAt', 'updatedAt'],
};

function getSpreadsheet_() {
  return SpreadsheetApp.openById(getSpreadsheetId_());
}

function getOrCreateSheet_(sheetName) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  ensureSheetSchema_(sheet, sheetName);
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
  const sheet = getOrCreateSheet_(sheetName);
  const headers = SCHEMA[sheetName];
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { sheet, headers, rows: [] };
  }
  const values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const rows = values.map((row, i) => {
    const obj = { _rowIndex: i + 2 };
    headers.forEach((h, idx) => { obj[h] = row[idx]; });
    return obj;
  });
  return { sheet, headers, rows };
}

function appendRowObject_(sheetName, obj) {
  const sheet = getOrCreateSheet_(sheetName);
  const headers = SCHEMA[sheetName];
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ''));
  sheet.appendRow(row);
}

function deleteRows_(sheetName, rowIndices) {
  const sheet = getOrCreateSheet_(sheetName);
  const sorted = [...rowIndices].sort((a, b) => b - a);
  sorted.forEach((rowIndex) => sheet.deleteRow(rowIndex));
}

function updateRowObject_(sheetName, rowIndex, obj) {
  const sheet = getOrCreateSheet_(sheetName);
  const headers = SCHEMA[sheetName];
  const row = headers.map((h) => (obj[h] !== undefined ? obj[h] : ''));
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
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
