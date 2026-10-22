/**
 * Web App エントリポイント。
 * フロントは text/plain で JSON.stringify({action, ...}) をPOSTする
 * （GASはカスタムCORSヘッダーを返せないため、preflightを避けるための約束事）。
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, accessToken, ...payload } = body;
    if (!action) {
      throw new Error('action は必須です');
    }
    // 本人は LINE に確かめて決める（画面から来た userId・名前は使わない。11_auth.js）
    const me = resolveIdentity_(body);
    payload.userId = me.userId;
    payload.creatorUserId = me.userId;
    if (me.verified) {
      payload.displayName = me.displayName;
      payload.pictureUrl = me.pictureUrl;
      payload.creatorDisplayName = me.displayName;
      payload.creatorPictureUrl = me.pictureUrl;
    }
    const result = routeAction_(action, payload);
    return jsonResponse_({ ok: true, data: result });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function doGet(e) {
  return jsonResponse_({ ok: false, error: 'GET は未対応です。POSTでactionを指定してください。' });
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
