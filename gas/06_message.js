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
    _createInfoRow_('予定枠', options.length + '件'),
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

function buildReminderFlex_(eventId, answerLabel, names, optionTitle) {
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません: ' + eventId);
  }

  const nameList = names.join('さん、') + 'さん';
  const liffUrl = getLiffUrl_();
  const answerUrl = liffUrl ? (liffUrl + (liffUrl.indexOf('?') >= 0 ? '&' : '?') + 'event=' + encodeURIComponent(eventId)) : '';

  const rows = [
    _createInfoRow_('宛先', nameList),
    _createInfoRow_('現在の回答', answerLabel),
  ];

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        _createFlexHeader_(event.title, (optionTitle ? optionTitle + ' の' : '') + '回答の更新をお願いします🙏'),
        _createSeparator_(),
        { type: 'box', layout: 'vertical', margin: 'md', contents: [_createFlexBody_(rows)] },
      ],
    },
    footer: answerUrl ? _createFlexButtonFooter_('回答を更新する', answerUrl) : undefined,
  };

  return {
    altText: nameList + '様への回答更新のお願い（' + event.title + '）',
    contents: bubble,
  };
}

function buildEditorInviteFlex_(eventId) {
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません: ' + eventId);
  }
  const liffUrl = getLiffUrl_();
  const inviteUrl = liffUrl
    ? liffUrl + (liffUrl.indexOf('?') >= 0 ? '&' : '?') + 'event=' + encodeURIComponent(eventId) + '&claimEditor=1'
    : '';

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [_createFlexHeader_(event.title, '編集をお願いします🙏\nこのリンクから予定枠の追加や共有ができるようになります。')],
    },
    footer: inviteUrl ? _createFlexButtonFooter_('編集者として参加する', inviteUrl) : undefined,
  };
  return { altText: event.title + ' の編集をお願いします', contents: bubble };
}

function formatDateTime_(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(date, 'Asia/Tokyo', 'M/d(E) HH:mm');
}
