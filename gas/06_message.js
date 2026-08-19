/**
 * イベント共有用の Flex Message（バブル1枚）を組み立てる。
 */

function buildEventShareFlex_(eventId) {
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません: ' + eventId);
  }
  const options = getEventOptions_(eventId);
  const responses = getEventResponses_(eventId);

  const answeredUserIds = new Set(responses.map((r) => r.userId));
  const deadlineText = event.deadline ? formatDateTime_(event.deadline) : 'なし';

  const rows = [
    _createInfoRow_('候補日', options.length + '件'),
    _createInfoRow_('回答期限', deadlineText),
    _createInfoRow_('回答', answeredUserIds.size + '人'),
  ];

  const liffUrl = getLiffUrl_();
  const answerUrl = liffUrl ? (liffUrl + (liffUrl.indexOf('?') >= 0 ? '&' : '?') + 'event=' + encodeURIComponent(eventId)) : '';

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        _createFlexHeader_(event.title, event.description || ''),
        _createSeparator_(),
        { type: 'box', layout: 'vertical', margin: 'md', contents: [_createFlexBody_(rows)] },
      ],
    },
    footer: answerUrl ? _createFlexButtonFooter_('回答する', answerUrl) : undefined,
  };

  return {
    altText: event.title + ' の日程調整',
    contents: bubble,
  };
}

function formatDateTime_(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(date, 'Asia/Tokyo', 'M/d(E) HH:mm');
}
