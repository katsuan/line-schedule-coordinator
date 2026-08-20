/**
 * Flex Message の小さな組み立てパーツ群。
 * 上位のメッセージビルダー（06_message.js）から組み合わせて使う。
 */

function _createFlexHeader_(title, subtitle) {
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

function _createInfoRow_(label, value) {
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

function _createAnswerGroupRow_(answer, count, nameList) {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'sm',
    backgroundColor: ANSWER_BG[answer] || undefined,
    cornerRadius: 'md',
    paddingAll: 'sm',
    contents: [
      { type: 'text', text: answer + count + '人', size: 'sm', weight: 'bold', color: ANSWER_COLOR[answer] || COLOR.SUB_TEXT, flex: 2, wrap: true },
      { type: 'text', text: String(nameList), size: 'sm', color: COLOR.TEXT, flex: 5, wrap: true },
    ],
  };
}

function _createSnapshotNoteRow_() {
  return { type: 'text', text: '※送信時点の回答状況です', size: 'xxs', color: COLOR.SUB_TEXT, margin: 'md' };
}

function _createFlexBody_(rows) {
  return {
    type: 'box',
    layout: 'vertical',
    spacing: 'sm',
    contents: rows,
  };
}

function _createFlexButtonFooter_(label, uri) {
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

function _footerStyles_() {
  return { footer: { separator: true, separatorColor: COLOR.BORDER } };
}

function _weekdayColor_(date) {
  const day = date.getDay();
  if (day === 0) return '#D93025';
  if (day === 6) return '#2563EB';
  return COLOR.TEXT;
}

function _createEventTimeRow_(label, startAt, endAt) {
  const start = new Date(startAt);
  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
  const datePart = Utilities.formatDate(start, 'Asia/Tokyo', 'M/d');
  const weekday = weekdayNames[start.getDay()];
  let timePart = Utilities.formatDate(start, 'Asia/Tokyo', 'HH:mm');
  if (endAt) {
    timePart += ' 〜 ' + Utilities.formatDate(new Date(endAt), 'Asia/Tokyo', 'HH:mm');
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
          { type: 'span', text: '(' + weekday + ') ', color: _weekdayColor_(start) },
          { type: 'span', text: timePart, color: COLOR.TEXT },
        ],
      },
    ],
  };
}

function _createSeparator_() {
  return { type: 'separator', margin: 'md', color: COLOR.BORDER };
}
