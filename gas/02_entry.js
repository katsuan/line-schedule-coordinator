/**
 * Web App エントリポイント。
 * フロントは text/plain で JSON.stringify({action, ...}) をPOSTする
 * （GASはカスタムCORSヘッダーを返せないため、preflightを避けるための約束事）。
 */
function doPost(e) { // qcheck-ok: G3 本人は handleAction_ で LINE のアクセストークンを確かめて決める（11_auth.js）
  try {
    const body = JSON.parse(e.postData.contents);
    if (!body || typeof body !== 'object') {
      throw new Error('action は必須です');
    }
    const { action, accessToken, ...payload } = body;
    if (!action || typeof action !== 'string') {
      throw new Error('action は必須です');
    }
    const result = withWriteLock_(action, () => handleAction_(action, body, payload));
    return jsonResponse_({ ok: true, data: result });
  } catch (err) {
    return jsonResponse_({ ok: false, error: publicErrorMessage_(err) });
  }
}

function handleAction_(action, body, payload) {
  // 本人は LINE に確かめて決める（画面から来た userId・名前・画像は使わない。11_auth.js）
  const me = resolveIdentity_(body);
  payload.userId = me.userId; // qcheck-ok: G4 LINE に確かめた本人で上書きする
  payload.creatorUserId = me.userId;
  payload.displayName = me.displayName;
  payload.pictureUrl = me.pictureUrl;
  payload.creatorDisplayName = me.displayName;
  payload.creatorPictureUrl = me.pictureUrl;
  return routeAction_(action, payload);
}

function doGet(e) {
  return jsonResponse_({ ok: false, error: 'GET は未対応です。POSTでactionを指定してください。' });
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
