/**
 * 各アクションで共有される検索・権限判定ヘルパー。
 */

function findEventById_(eventId) {
  const { rows } = sheetRowsAsObjects_(SHEET.EVENTS);
  return rows.find((r) => r.eventId === eventId) || null;
}

function findOptionById_(eventId, optionId) {
  const { rows } = sheetRowsAsObjects_(SHEET.EVENT_OPTIONS);
  return rows.find((r) => r.eventId === eventId && r.optionId === optionId) || null;
}

function getEventOptions_(eventId) {
  const { rows } = sheetRowsAsObjects_(SHEET.EVENT_OPTIONS);
  return rows
    .filter((r) => r.eventId === eventId)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt) || Number(a.sort) - Number(b.sort));
}

function getEventResponses_(eventId) {
  const { rows } = sheetRowsAsObjects_(SHEET.RESPONSES);
  return rows.filter((r) => r.eventId === eventId);
}

function getUserDisplayName_(userId) {
  const { rows } = sheetRowsAsObjects_(SHEET.USERS);
  const user = rows.find((r) => r.userId === userId);
  return user ? user.displayName : '';
}

function editorIdsOf_(event) {
  return String(event.editorUserIds || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function isEditorOrCreator_(event, userId) {
  return event.creatorUserId === userId || editorIdsOf_(event).includes(userId);
}

function stripRowMeta_(row) {
  const { _rowIndex, ...rest } = row;
  return rest;
}
