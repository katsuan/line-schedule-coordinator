/**
 * イベント共有用の Flex Message（バブル1枚）を組み立てる。
 */

function buildEventShareFlex_(eventId) {
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません: ' + eventId);
  }
  const now = new Date();
  const options = getEventOptions_(eventId).filter((opt) => {
    const end = opt.endAt || opt.startAt;
    return !end || new Date(end) >= now;
  });
  const responses = getEventResponses_(eventId);

  const answeredUserIds = new Set(responses.map((r) => r.userId));

  const headerRows = [
    _createInfoRow_('回答', answeredUserIds.size + '人'),
  ];

  const optionCards = options.map((opt) => {
    const optResponses = responses.filter((r) => r.optionId === opt.optionId);
    const count = (a) => optResponses.filter((r) => r.answer === a).length;
    const cardRows = [_createEventTimeRow_('日時', opt.startAt, opt.endAt)];
    if (opt.location) cardRows.push(_createInfoRow_('場所', opt.location));
    cardRows.push(_createInfoRow_('回答', `○${count(ANSWER.OK)} △${count(ANSWER.MAYBE)} ×${count(ANSWER.NG)}`));
    return {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: 'md',
      backgroundColor: '#F7F8FA',
      cornerRadius: 'md',
      contents: [
        { type: 'text', text: opt.title || '(タイトルなし)', weight: 'bold', size: 'sm', color: COLOR.TEXT, wrap: true },
        ...cardRows,
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
        { type: 'box', layout: 'vertical', margin: 'md', spacing: 'md', contents: optionCards },
      ],
    },
    footer: answerUrl ? _createFlexButtonFooter_('回答する', answerUrl) : undefined,
    styles: answerUrl ? _footerStyles_() : undefined,
  };

  return {
    altText: event.title + ' の日程調整',
    contents: bubble,
  };
}

function buildReminderFlex_(eventId, groups, optionTitle, optionStartAt, optionEndAt, optionLocation) {
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません: ' + eventId);
  }
  groups = groups || {};

  const liffUrl = getLiffUrl_();
  const answerUrl = liffUrl ? (liffUrl + (liffUrl.indexOf('?') >= 0 ? '&' : '?') + 'event=' + encodeURIComponent(eventId)) : '';
  const targetTitle = optionTitle || event.title;

  const rows = [
    _createInfoRow_('イベント名', targetTitle),
  ];
  if (optionStartAt) rows.push(_createEventTimeRow_('日時', optionStartAt, optionEndAt));
  if (optionLocation) rows.push(_createInfoRow_('場所', optionLocation));
  [ANSWER.OK, ANSWER.MAYBE, ANSWER.NG].forEach((ans) => {
    const names = groups[ans];
    if (names && names.length) {
      rows.push(_createAnswerGroupRow_(ans, `${names.length}人：` + names.map((n) => n + 'さん').join('、')));
    }
  });
  rows.push(_createSnapshotNoteRow_());

  const allNames = [ANSWER.OK, ANSWER.MAYBE, ANSWER.NG].reduce((acc, ans) => acc.concat(groups[ans] || []), []);
  const nameLabel = allNames.length > 3
    ? allNames.slice(0, 3).join('・') + `他${allNames.length - 3}名`
    : allNames.join('・');

  const bubble = {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: [
        { type: 'text', text: event.title, weight: 'bold', size: 'lg', wrap: true, color: COLOR.TEXT },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [_createFlexBody_(rows)],
    },
    footer: answerUrl ? _createFlexButtonFooter_('回答を確認する', answerUrl) : undefined,
    styles: answerUrl ? _footerStyles_() : undefined,
  };

  return {
    altText: targetTitle + 'への連絡（' + nameLabel + '）',
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
    styles: answerUrl ? _footerStyles_() : undefined,
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
    styles: inviteUrl ? _footerStyles_() : undefined,
  };
  return { altText: event.title + ' の編集をお願いします', contents: bubble };
}

function formatDateTime_(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return Utilities.formatDate(date, 'Asia/Tokyo', 'M/d(E) HH:mm');
}
