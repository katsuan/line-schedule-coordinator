/**
 * スプレッドシートを小さなデータベースとして使う：シートを作る・見出しをそろえる・行を読む／足す／書きかえる／消す。
 * 中身：SCHEMA（シートの列。列を足すときは必ず最後に）・行の読み書き・名前とアイコンを覚える upsertUser_。
 * 呼ばれ方：07〜11 のファイルから。1回の呼び出しの中では、開いたシートと読んだ行を覚えて使い回す。
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

// 記録のスプレッドシートを開く（1回の呼び出しの中では1回だけ）
function getSpreadsheet_() {
  if (!_spreadsheetCache_) {
    _spreadsheetCache_ = SpreadsheetApp.openById(getSpreadsheetId_());
  }
  return _spreadsheetCache_;
}

// 名前のシートを返す。なければ作り、見出しをそろえる
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

// 1行目の見出しを SCHEMA に合わせる。空なら書き、足りない列は最後に足す（前の列は動かさない）
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

// シートの行を { 見出し: 値, _rowIndex } の並びで返す（同じ呼び出しの中では覚えて使い回す）
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

// 1行足す（文字は safeCell を通す）
function appendRowObject_(sheetName, obj) {
  const sheet = getOrCreateSheet_(sheetName);
  const headers = SCHEMA[sheetName];
  const row = headers.map((h) => safeCell(obj[h] !== undefined ? obj[h] : ''));
  sheet.appendRow(row);
  delete _rowsCache_[sheetName];
}

// 行をまとめて消す（下から消して、行の番号がずれないように）
function deleteRows_(sheetName, rowIndices) {
  const sheet = getOrCreateSheet_(sheetName);
  const sorted = [...rowIndices].sort((a, b) => b - a);
  sorted.forEach((rowIndex) => sheet.deleteRow(rowIndex));
  delete _rowsCache_[sheetName];
}

// 決まった行を書きかえる（文字は safeCell を通す）
function updateRowObject_(sheetName, rowIndex, obj) {
  const sheet = getOrCreateSheet_(sheetName);
  const headers = SCHEMA[sheetName];
  const row = headers.map((h) => safeCell(obj[h] !== undefined ? obj[h] : ''));
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([row]);
  delete _rowsCache_[sheetName];
}

// 名前・アイコンを覚える。変わったときだけ、鍵を持って読みなおしてから書く
// （はじめての人が読むだけの操作を同時に2つ送っても、行が2つにならないように）
function upsertUser_(userId, displayName, pictureUrl) {
  if (!userNeedsWrite_(findUserRow_(userId), displayName, pictureUrl)) return;
  withScriptLock_(() => {
    delete _rowsCache_[SHEET.USERS]; // 鍵を待つあいだに、ほかの人が書いたかもしれない
    writeUser_(userId, displayName, pictureUrl);
  });
}

// USERS から本人の行を探す。なければ null
function findUserRow_(userId) {
  const { rows } = sheetRowsAsObjects_(SHEET.USERS);
  return rows.find((r) => r.userId === userId) || null;
}

// 行がない・名前かアイコンが変わった、なら書く
function userNeedsWrite_(row, displayName, pictureUrl) {
  return !row || !!(displayName && row.displayName !== displayName) ||
    !!(pictureUrl && row.pictureUrl !== pictureUrl);
}

// USERS に本人の名前・アイコンを書く（なければ足す・変わっていれば書きかえる）。鍵の中で呼ぶ
function writeUser_(userId, displayName, pictureUrl) {
  const now = new Date();
  const existing = findUserRow_(userId);
  if (!userNeedsWrite_(existing, displayName, pictureUrl)) return;
  if (existing) {
    updateRowObject_(SHEET.USERS, existing._rowIndex, {
      ...existing,
      displayName: displayName || existing.displayName,
      pictureUrl: pictureUrl || existing.pictureUrl,
      updatedAt: now,
    });
    return;
  }
  appendRowObject_(SHEET.USERS, {
    userId, displayName: displayName || '', pictureUrl: pictureUrl || '', createdAt: now, updatedAt: now,
  });
}
