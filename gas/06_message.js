/**
 * LINE に送るカード（Flex）を組み立てる：予定の共有・候補ごとの連絡・変更のお知らせ・編集者の招待。
 * 呼ばれ方：03_routing.js の build○○Flex から（画面が送り先を選んで送る）。部品は 05_flexParts.js。
 */

/** 予定の画面を開く URL（LIFF）。extra は後ろに足す query（例 '&claimEditor=1'） */
function eventPageUrl_(eventId, extra) {
  const liffUrl = getLiffUrl_();
  if (!liffUrl) return '';
  return liffUrl + (liffUrl.indexOf('?') >= 0 ? '&' : '?') + 'event=' + encodeURIComponent(eventId) + (extra || '');
}

/** 名前の並びを短く（3人まで＋「他○名」） */
function shortNameList_(names, separator) {
  return names.length > 3
    ? names.slice(0, 3).join(separator) + `他${names.length - 3}名`
    : names.join(separator);
}

// 予定を送るカード。これからのイベントごとに日時・メモ・○△× の数。ボタンは「回答する」。
// 季節の絵文字は通知の1行（altText）にだけ
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
  const { rows: comments } = sheetRowsAsObjects_(SHEET.COMMENTS);
  const commentCountByOption = {};
  comments.forEach((c) => {
    if (c.eventId === eventId) commentCountByOption[c.optionId] = (commentCountByOption[c.optionId] || 0) + 1;
  });

  const answeredUserIds = new Set(responses.map((r) => r.userId));

  const headerRows = [
    flexInfoRow_('回答', answeredUserIds.size + '人'),
  ];

  const optionCards = options.map((opt) => {
    const optResponses = responses.filter((r) => r.optionId === opt.optionId);
    // その答え（○・△・×）の人数
    const count = (a) => optResponses.filter((r) => r.answer === a).length;
    const commentCount = commentCountByOption[opt.optionId] || 0;
    const cardRows = [flexTimeRow_('日時', opt.startAt, opt.endAt)];
    if (opt.location) cardRows.push(flexInfoRow_('メモ', opt.location));
    const answerText = `○${count(ANSWER.OK)} △${count(ANSWER.MAYBE)} ×${count(ANSWER.NG)}`
      + (commentCount ? `　💬${commentCount}件` : '');
    cardRows.push(flexInfoRow_('回答', answerText));
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

  const answerUrl = eventPageUrl_(eventId);

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        flexHeader_(event.title, event.description || ''),
        flexSeparator_(),
        { type: 'box', layout: 'vertical', margin: 'md', contents: [flexBody_(headerRows)] },
        flexSeparator_(),
        optionCards.length
          ? { type: 'box', layout: 'vertical', margin: 'md', spacing: 'md', contents: optionCards }
          : { type: 'text', text: 'これからのイベントはありません', size: 'sm', color: COLOR.SUB_TEXT, margin: 'md', wrap: true },
      ],
    },
    footer: answerUrl ? flexButtonFooter_('回答する', answerUrl) : undefined,
    styles: answerUrl ? flexFooterStyles_() : undefined,
  };

  return {
    // 季節の絵文字は、通知に出る1行（altText）にだけ、ときどき1つ（season.js）
    altText: QSeason.decorate(event.title + ' の日程調整'),
    contents: bubble,
  };
}

// 1つのイベントについて、答えた人へ送る連絡のカード（○△× ごとの名前つき）
function buildReminderFlex_(eventId, groups, optionTitle, optionStartAt, optionEndAt, optionLocation, optionId) {
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません: ' + eventId);
  }
  // 名前の並びは画面から届くので、文字だけ・数と長さを決める
  const source = groups && typeof groups === 'object' ? groups : {};
  groups = {};
  [ANSWER.OK, ANSWER.MAYBE, ANSWER.NG].forEach((ans) => { groups[ans] = cleanNames_(source[ans]); });

  const answerUrl = eventPageUrl_(eventId);
  const targetTitle = optionTitle || event.title;

  const rows = [
    flexInfoRow_('イベント名', targetTitle),
  ];
  if (optionStartAt) rows.push(flexTimeRow_('日時', optionStartAt, optionEndAt));
  if (optionLocation) rows.push(flexInfoRow_('メモ', optionLocation));
  [ANSWER.OK, ANSWER.MAYBE, ANSWER.NG].forEach((ans) => {
    const names = groups[ans];
    if (names && names.length) {
      rows.push(flexAnswerGroupRow_(ans, names.length, joinNamesForCard_(names, '、')));
    }
  });
  if (optionId) {
    const { rows: comments } = sheetRowsAsObjects_(SHEET.COMMENTS);
    const commentCount = comments.filter((c) => c.eventId === eventId && c.optionId === optionId).length;
    if (commentCount) rows.push(flexInfoRow_('コメント', `💬${commentCount}件`));
  }
  rows.push(flexSnapshotNote_());

  const allNames = [ANSWER.OK, ANSWER.MAYBE, ANSWER.NG].reduce((acc, ans) => acc.concat(groups[ans]), []);
  const nameLabel = shortNameList_(allNames, '・');

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
      contents: [flexBody_(rows)],
    },
    footer: answerUrl ? flexButtonFooter_('回答を確認する', answerUrl) : undefined,
    styles: answerUrl ? flexFooterStyles_() : undefined,
  };

  return {
    altText: (targetTitle + 'への連絡（' + nameLabel + '）').slice(0, 400),
    contents: bubble,
  };
}

// イベントの日時やメモが変わったことを、答えた人へ知らせるカード
function buildChangeNotificationFlex_(eventId, optionTitle, optionStartAt, optionEndAt, optionLocation, names) {
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません: ' + eventId);
  }

  const nameList = shortNameList_(cleanNames_(names), '、');
  const answerUrl = eventPageUrl_(eventId);

  const rows = [
    flexInfoRow_('イベント名', optionTitle || event.title),
  ];
  if (optionStartAt) rows.push(flexTimeRow_('新しい日時', optionStartAt, optionEndAt));
  if (optionLocation) rows.push(flexInfoRow_('新しいメモ', optionLocation));
  rows.push(flexInfoRow_('宛先', nameList + '一同'));

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        flexHeader_(event.title, '🔔 予定の内容が変更されました。ご確認ください。'),
        flexSeparator_(),
        { type: 'box', layout: 'vertical', margin: 'md', contents: [flexBody_(rows)] },
      ],
    },
    footer: answerUrl ? flexButtonFooter_('内容を確認する', answerUrl) : undefined,
    styles: answerUrl ? flexFooterStyles_() : undefined,
  };

  return {
    altText: ('【変更あり】' + (optionTitle || event.title)).slice(0, 400),
    contents: bubble,
  };
}

// 編集者になってもらうための招待カード（合言葉つきのリンク）。作った人だけが作れる
function buildEditorInviteFlex_(eventId, userId) {
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  if (event.creatorUserId !== userId) {
    throw new Error('編集者を招待できるのは作成者のみです');
  }
  const inviteUrl = eventPageUrl_(eventId, '&claimEditor=1&key=' + encodeURIComponent(editorInviteKey_(eventId)));

  const bubble = {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [flexHeader_(event.title, '編集をお願いします🙏\nこのリンクからイベントの追加や共有ができるようになります。')],
    },
    footer: inviteUrl ? flexButtonFooter_('編集者として参加する', inviteUrl) : undefined,
    styles: inviteUrl ? flexFooterStyles_() : undefined,
  };
  return { altText: event.title + ' の編集をお願いします', contents: bubble };
}
