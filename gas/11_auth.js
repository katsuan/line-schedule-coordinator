/**
 * 本人確認と、外に出す ID（くるかなの GAS は、だれでも URL を呼べる）。
 *
 * - 画面から送られてくる userId は信じない。LIFF のアクセストークンを LINE に確かめて、本人の userId を決める
 *   （トークンは本人しか持てないので、ページのソースや通信を読んでも、他人にはなれない）
 * - アクセストークンがないときは、ローカルで試すときの仮の ID（debug-user-…）だけ通す。本物の LINE の ID（U…）にはなれない
 * - 集計で返す他人の ID は、本物の userId ではなく、予定ごとの記号（publicId）にする。
 *   記号は Script Properties の ID_SALT（なければ最初に作る）で作るので、記号から本物の ID は戻せない
 */

const AUTH = {
  VERIFY_URL: 'https://api.line.me/oauth2/v2.1/verify',
  PROFILE_URL: 'https://api.line.me/v2/profile',
  // LIFF のチャネル ID（LIFF ID の「-」の前）。Script Properties の LIFF_CHANNEL_ID があればそちら
  DEFAULT_CHANNEL_ID: '2009927582',
  CACHE_SECONDS: 600,
  DEBUG_PREFIX: 'debug-user-',
};

function liffChannelId_() {
  const fromProp = PROPS.getProperty('LIFF_CHANNEL_ID');
  if (fromProp) return String(fromProp).trim();
  const m = String(getLiffUrl_() || '').match(/liff\.line\.me\/(\d+)-/);
  return m ? m[1] : AUTH.DEFAULT_CHANNEL_ID;
}

function sha256Hex_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, '0'))
    .join('');
}

/**
 * リクエストの本人を決める。{ userId, displayName, pictureUrl, verified }
 * 確かめられないときは例外（画面には「LINE でログインしなおしてください」と出る）
 */
function resolveIdentity_(body) {
  const token = String((body && body.accessToken) || '').trim();
  if (!token) {
    const claimed = String((body && body.userId) || '');
    if (claimed.indexOf(AUTH.DEBUG_PREFIX) === 0) {
      return { userId: claimed, displayName: body.displayName || '', pictureUrl: body.pictureUrl || '', verified: false };
    }
    throw new Error('LINE でログインしなおしてください（本人確認ができませんでした）');
  }

  // 同じトークンは10分だけ覚えておく（毎回 LINE に聞くと遅いため）。キーはトークンそのものではなくハッシュ
  const cache = CacheService.getScriptCache();
  const cacheKey = 'auth_' + sha256Hex_(token).slice(0, 40);
  const cached = cache.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const verifyRes = UrlFetchApp.fetch(AUTH.VERIFY_URL + '?access_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (verifyRes.getResponseCode() !== 200) {
    throw new Error('LINE でログインしなおしてください（ログインの期限が切れています）');
  }
  const verified = JSON.parse(verifyRes.getContentText());
  if (String(verified.client_id) !== liffChannelId_() || Number(verified.expires_in) <= 0) {
    throw new Error('LINE でログインしなおしてください（ほかのアプリのログインです）');
  }

  const profileRes = UrlFetchApp.fetch(AUTH.PROFILE_URL, {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true,
  });
  if (profileRes.getResponseCode() !== 200) {
    throw new Error('LINE でログインしなおしてください（プロフィールを取得できませんでした）');
  }
  const profile = JSON.parse(profileRes.getContentText());
  const identity = {
    userId: String(profile.userId || ''),
    displayName: String(profile.displayName || ''),
    pictureUrl: String(profile.pictureUrl || ''),
    verified: true,
  };
  if (!identity.userId) throw new Error('LINE でログインしなおしてください');

  // 名前・アイコンを覚える（編集権限の依頼で、記号から本人を探せるように）
  upsertUser_(identity.userId, identity.displayName, identity.pictureUrl);
  cache.put(cacheKey, JSON.stringify(identity), AUTH.CACHE_SECONDS);
  return identity;
}

/** 記号を作るための秘密の値（Script Properties の ID_SALT。なければ作って残す） */
function idSalt_() {
  let salt = PROPS.getProperty('ID_SALT');
  if (!salt) {
    salt = Utilities.getUuid() + Utilities.getUuid();
    PROPS.setProperty('ID_SALT', salt);
  }
  return salt;
}

/** 予定ごとの記号（本物の userId の代わりに外へ出す） */
function publicIdOf_(eventId, userId) {
  if (!userId) return '';
  const mac = Utilities.computeHmacSha256Signature(String(eventId) + ':' + String(userId), idSalt_());
  return 'p_' + Utilities.base64EncodeWebSafe(mac).replace(/=+$/, '').slice(0, 16);
}

/** 記号から本物の userId を探す（その予定の記号として作られたものだけ） */
function userIdFromPublicId_(eventId, publicId) {
  if (!publicId) return '';
  const { rows } = sheetRowsAsObjects_(SHEET.USERS);
  const hit = rows.find((u) => publicIdOf_(eventId, u.userId) === publicId);
  return hit ? hit.userId : '';
}
