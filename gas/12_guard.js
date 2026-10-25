/**
 * 外から来た中身を守る：文字の長さ・数・形を確かめる、書きこむ操作を1つずつにする、画面に出すエラーの言葉を決める。
 * シートに書く文字の守り（safeCell）は selfcheck.js（Q 共通）にある。
 * 呼ばれ方：01_entry.js（鍵・エラー）と 06・08・09 のファイル（確かめ）。Q のセキュリティの決まり（q-oqrn の docs/security.md）G1・G2・G6・G7。
 */

const LIMITS = {
  TITLE: 100,
  DESCRIPTION: 2000,
  OPTION_TITLE: 100,
  LOCATION: 200,
  DATETIME: 40,
  ICON: 16,
  COMMENT: 500,
  NAME: 60,
  OPTIONS: 50,
  ANSWERS: 200,
  CARD_NAMES: 30,
};

// 書きこむ操作（同時に来たら1つずつ順番に）
const WRITE_ACTIONS = [
  'createEvent', 'addOptions', 'updateOption', 'updateEvent', 'claimEditor',
  'approveEditRequest', 'deleteEvent', 'submitAnswer', 'addComment', 'deleteComment',
];

/** 文字の長さを確かめる。undefined はそのまま（「変えない」の意味で使うため） */
function limitText_(value, max, label) {
  if (value === undefined || value === null) return value;
  const text = String(value);
  if (text.length > max) {
    throw new Error(label + 'が長すぎます（' + max + '字まで）');
  }
  return text;
}

/** 候補（イベント）の並び。数・形・長さを確かめて、使う項目だけにする */
function cleanOptions_(options) {
  if (!Array.isArray(options) || !options.length) {
    throw new Error('イベントを1件以上指定してください');
  }
  if (options.length > LIMITS.OPTIONS) {
    throw new Error('イベントが多すぎます（' + LIMITS.OPTIONS + '件まで）');
  }
  return options.map((opt) => {
    if (!opt || typeof opt !== 'object' || !opt.startAt) {
      throw new Error('イベントの開始は必須です');
    }
    return {
      startAt: limitText_(opt.startAt, LIMITS.DATETIME, '開始'),
      endAt: limitText_(opt.endAt || '', LIMITS.DATETIME, '完了'),
      title: limitText_(opt.title || '', LIMITS.OPTION_TITLE, 'イベント名'),
      location: limitText_(opt.location || '', LIMITS.LOCATION, '場所'),
    };
  });
}

/** 書きこむ操作は、ほかの人の書きこみと重ならないように1つずつ（G7） */
function withWriteLock_(action, fn) {
  if (WRITE_ACTIONS.indexOf(action) === -1) return fn();
  return withScriptLock_(fn);
}

/** 鍵を持って fn を動かす。もう持っていれば（書きこむ操作の中から呼ばれたとき）そのまま */
function withScriptLock_(fn) {
  const lock = LockService.getScriptLock();
  if (lock.hasLock()) return fn();
  lock.waitLock(20000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/** カードに入れる名前の並び（画面から届くので、文字だけ・数と長さを決める） */
function cleanNames_(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((name) => typeof name === 'string' && name.trim())
    .slice(0, LIMITS.ANSWERS)
    .map((name) => name.trim().slice(0, LIMITS.NAME));
}

/** カードに並べる名前。多いときは CARD_NAMES 人までにして「ほか○名」 */
function joinNamesForCard_(names, separator) {
  if (names.length <= LIMITS.CARD_NAMES) return names.join(separator);
  return names.slice(0, LIMITS.CARD_NAMES).join(separator) + separator + 'ほか' + (names.length - LIMITS.CARD_NAMES) + '名';
}

// 画面に出してよいエラー（自分で書いたやさしい言葉）。それ以外は中身を出さずログへ（G2）
const PUBLIC_ERROR_PATTERN = /ログインしなおして|のみです|見つかりません|必須です|未対応|長すぎ|多すぎ|選べません|招待のリンク|サービスに接続できなくなりました/;

// 画面に出すエラーの言葉。自分で書いたやさしい言葉だけ出し、それ以外は中身を出さずにログへ
function publicErrorMessage_(err) {
  const message = String((err && err.message) || err || '');
  if (PUBLIC_ERROR_PATTERN.test(message) && !/Script Properties|Exception:/.test(message)) {
    return message.slice(0, 200);
  }
  console.error(err && err.stack ? err.stack : message);
  return 'うまく処理できませんでした。時間をおいて、もう一度ためしてね。';
}
