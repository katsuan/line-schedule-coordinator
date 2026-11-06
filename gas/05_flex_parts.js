/**
 * LINE のカード（Flex）の小さな部品：見出し・1行の情報・○△× の人の行・日時の行・ボタン・区切り。
 * 呼ばれ方：06_message.js のカードを組み立てるところから。
 */

// カードの見出し（太字の題と、小さな説明）
function flexHeader_(title, subtitle) {
  const contents = [
    { type: 'text', text: title, weight: 'bold', size: 'lg', wrap: true, color: COLOR.TEXT },
  ];
  if (subtitle) {
    contents.push({ type: 'text', text: subtitle, size: 'xs', color: COLOR.SUB_TEXT, margin: 'sm', wrap: true });
  }
  return {
    type: 'box',
    layout: 'vertical',
    contents,
    paddingBottom: 'md',
  };
}

// 「ラベル　値」の1行
function flexInfoRow_(label, value) {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      { type: 'text', text: label, size: 'sm', color: COLOR.SUB_TEXT, flex: 2 },
      { type: 'text', text: String(value), size: 'sm', color: COLOR.TEXT, flex: 5, wrap: true },
    ],
  };
}

const ANSWER_COLOR = { '○': '#2D8A4E', '△': '#C9862B', '×': '#D93025' };
const ANSWER_BG = { '○': '#E9F7EF', '△': '#FFF6E5', '×': '#FDEDEB' };

// ○△× ごとの人数と名前の並びの行（答えの色の背景）
function flexAnswerGroupRow_(answer, count, nameList) {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    backgroundColor: ANSWER_BG[answer] || undefined,
    cornerRadius: 'md',
    paddingAll: 'sm',
    contents: [
      { type: 'text', text: answer + ' ' + count + '人', size: 'sm', weight: 'bold', color: ANSWER_COLOR[answer] || COLOR.SUB_TEXT, flex: 2, wrap: true },
      { type: 'text', text: String(nameList), size: 'sm', color: COLOR.TEXT, flex: 5, wrap: true },
    ],
  };
}

// 「送ったときの回答のようすです」の小さな注意書き
function flexSnapshotNote_() {
  return { type: 'text', text: '※敬称略・送信時点の回答状況です', size: 'xxs', color: COLOR.SUB_TEXT, margin: 'md' };
}

// 行を縦に並べた本文の箱
function flexBody_(rows) {
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    contents: rows,
  };
}

// カードの下のボタン（画面を開くだけ。あとで押されても困らない）
function flexButtonFooter_(label, uri) {
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    paddingAll: 'lg',
    contents: [
      {
        type: 'box',
        layout: 'vertical',
        backgroundColor: COLOR.PRIMARY,
        cornerRadius: 'xxl',
        paddingAll: 'md',
        action: { type: 'uri', label, uri },
        contents: [
          { type: 'text', text: label, color: '#ffffff', align: 'center', weight: 'bold', size: 'md' },
        ],
      },
    ],
  };
}

// ボタンの上に区切りの線を引く設定
function flexFooterStyles_() {
  return { footer: { separator: true, separatorColor: COLOR.BORDER } };
}

// 曜日の文字の色（日曜は赤・土曜は青・ほかはふつう）
function weekdayColor_(date) {
  const day = date.getDay();
  if (day === 0) return '#D93025';
  if (day === 6) return '#2563EB';
  return COLOR.TEXT;
}

const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

// 「日時　11/1(土) 10:00 〜 12:00」の行。日をまたぐときは終わりの日付も出す
function flexTimeRow_(label, startAt, endAt) {
  const start = new Date(startAt);
  const datePart = Utilities.formatDate(start, 'Asia/Tokyo', 'M/d');
  const weekday = WEEKDAY_NAMES[start.getDay()];
  let timePart = Utilities.formatDate(start, 'Asia/Tokyo', 'HH:mm');
  if (endAt) {
    const end = new Date(endAt);
    // 日をまたぐときは、終わりの日付も出す（「22:00 〜 02:00」だと、どの日の 2 時かわからない）
    const sameDay = Utilities.formatDate(end, 'Asia/Tokyo', 'yyyyMMdd') === Utilities.formatDate(start, 'Asia/Tokyo', 'yyyyMMdd');
    timePart += ' 〜 ' + (sameDay ? '' : Utilities.formatDate(end, 'Asia/Tokyo', 'M/d') + '(' + WEEKDAY_NAMES[end.getDay()] + ') ') +
      Utilities.formatDate(end, 'Asia/Tokyo', 'HH:mm');
  }
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    contents: [
      { type: 'text', text: label, size: 'sm', color: COLOR.SUB_TEXT, flex: 2 },
      {
        type: 'text',
        size: 'sm',
        flex: 5,
        wrap: true,
        contents: [
          { type: 'span', text: datePart + ' ', color: COLOR.TEXT },
          { type: 'span', text: '(' + weekday + ') ', color: weekdayColor_(start) },
          { type: 'span', text: timePart, color: COLOR.TEXT },
        ],
      },
    ],
  };
}

// 区切りの線
function flexSeparator_() {
  return { type: 'separator', margin: 'md', color: COLOR.BORDER };
}
