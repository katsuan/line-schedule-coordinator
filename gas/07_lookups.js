/**
 * いろいろな処理で使う、探す・確かめる関数：予定・イベント・回答を探す、作った人か編集者かを確かめる。
 * 呼ばれ方：06・08・09・10 のファイルから。
 */

// 予定を ID で探す。なければ null
function findEventById_(eventId) {
  const { rows } = sheetRowsAsObjects_(SHEET.EVENTS);
  return rows.find((r) => r.eventId === eventId) || null;
}

// 予定の中のイベントを ID で探す。なければ null
function findOptionById_(eventId, optionId) {
  const { rows } = sheetRowsAsObjects_(SHEET.EVENT_OPTIONS);
  return rows.find((r) => r.eventId === eventId && r.optionId === optionId) || null;
}

// 予定のイベントを、始まりの早い順（同じなら作った順）で返す
function getEventOptions_(eventId) {
  const { rows } = sheetRowsAsObjects_(SHEET.EVENT_OPTIONS);
  return rows
    .filter((r) => r.eventId === eventId)
    .sort((a, b) => {
      const diff = new Date(a.startAt) - new Date(b.startAt);
      return diff !== 0 ? diff : Number(a.sort) - Number(b.sort);
    });
}

// 予定への回答を全部返す
function getEventResponses_(eventId) {
  const { rows } = sheetRowsAsObjects_(SHEET.RESPONSES);
  return rows.filter((r) => r.eventId === eventId);
}

// 予定の編集者の userId の並び
function editorIdsOf_(event) {
  return String(event.editorUserIds || '').split(',').map((s) => s.trim()).filter(Boolean);
}

// その人が予定を作った人か編集者か
function isEditorOrCreator_(event, userId) {
  return event.creatorUserId === userId || editorIdsOf_(event).includes(userId);
}

// 行から _rowIndex（シートの何行目か）を外して返す
function stripRowMeta_(row) {
  const { _rowIndex, ...rest } = row;
  return rest;
}
