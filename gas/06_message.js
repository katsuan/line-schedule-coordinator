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

  const headerRows = [
    _createInfoRow_('回答期限', deadlineText),
    _createInfoRow_('回答', answeredUserIds.size + '人'),
  ];

  const optionRows = options.map((opt) => {
    const optResponses = responses.filter((r) => r.optionId === opt.optionId);
    const count = (a) => optResponses.filter((r) => r.answer === a).length;
    return {
      type: 'box',
      layout: 'vertical',
      margin: 'sm',
      contents: [
        {
          type: 'text',
          size: 'sm',
          color: COLOR.TEXT,
          wrap: true,
          text: (opt.title || '(タイトルなし)') + `  ○${count(ANSWER.OK)} △${count(ANSWER.MAYBE)} ×${count(ANSWER.NG)}`,
        },
        _createEventTimeRow_('日時', opt.startAt, opt.endAt),
      ],
    };
  });

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
        { type: 'box', layout: 'vertical', margin: 'md', contents: [_createFlexBody_(headerRows)] },
        _createSeparator_(),
        { type: 'box', layout: 'vertical', margin: 'md', spacing: 'sm', contents: optionRows },
      ],
    },
    footer: answerUrl ? _createFlexButtonFooter_('回答する', answerUrl) : undefined,
  };

  return {
    altText: event.title + ' の日程調整',
    contents: bubble,
  };
}

function buildReminderFlex_(eventId, answerLabel, names, optionTitle, optionStartAt, optionEndAt, optionLocation) {
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません: ' + eventId);
  }

  const nameList = names.length > 3
    ? names.slice(0, 3).join('さん、') + `さん他${names.length - 3}名`
    : names.join('さん、') + 'さん';
  const liffUrl = getLiffUrl_();
  const answerUrl = liffUrl ? (liffUrl + (liffUrl.indexOf('?') >= 0 ? '&' : '?') + 'event=' + encodeURIComponent(eventId)) : '';
  const targetTitle = optionTitle || event.title;

  const rows = [
    _createInfoRow_('イベント名', targetTitle),
  ];
  if (optionStartAt) rows.push(_createEventTimeRow_('日時', optionStartAt, optionEndAt));
  if (optionLocation) rows.push(_createInfoRow_('場所', optionLocation));
  rows.push(_createInfoRow_('宛先', nameList + '一同'));
  rows.push(_createInfoRow_('現在の回答', answerLabel));

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        _createFlexHeader_(event.title, '回答の更新をお願いします🙏'),
        _createSeparator_(),
        { type: 'box', layout: 'vertical', margin: 'md', contents: [_createFlexBody_(rows)] },
      ],
    },
    footer: answerUrl ? _createFlexButtonFooter_('回答を更新する', answerUrl) : undefined,
  };

  return {
    altText: nameList + '様への回答更新のお願い（' + targetTitle + '）',
    contents: bubble,
  };
}

function buildChangeNotificationFlex_(eventId, optionTitle, optionStartAt, optionEndAt, optionLocation, names) {
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません: ' + eventId);
  }

  const nameList = names.length > 3
    ? names.slice(0, 3).join('さん、') + `さん他${names.length - 3}名`
    : names.join('さん、') + 'さん';
  const liffUrl = getLiffUrl_();
  const answerUrl = liffUrl ? (liffUrl + (liffUrl.indexOf('?') >= 0 ? '&' : '?') + 'event=' + encodeURIComponent(eventId)) : '';

  const rows = [
    _createInfoRow_('イベント名', optionTitle || event.title),
  ];
  if (optionStartAt) rows.push(_createEventTimeRow_('新しい日時', optionStartAt, optionEndAt));
  if (optionLocation) rows.push(_createInfoRow_('新しい場所', optionLocation));
  rows.push(_createInfoRow_('宛先', nameList + '一同'));

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        _createFlexHeader_(event.title, '🔔 予定の内容が変更されました。ご確認ください。'),
        _createSeparator_(),
        { type: 'box', layout: 'vertical', margin: 'md', contents: [_createFlexBody_(rows)] },
      ],
    },
    footer: answerUrl ? _createFlexButtonFooter_('内容を確認する', answerUrl) : undefined,
  };

  return {
    altText: '【変更あり】' + (optionTitle || event.title),
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
      contents: [_createFlexHeader_(event.title, '編集をお願いします🙏\nこのリンクからイベントの追加や共有ができるようになります。')],
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
