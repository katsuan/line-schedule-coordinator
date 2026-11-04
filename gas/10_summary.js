/**
 * 集計と一覧：予定の画面に出す回答のようす（getSummary_）、自分の予定の一覧（listMyEvents_）、カレンダーのイベント（listMyOptions_）。
 * 呼ばれ方：03_routing.js から（読むだけなので鍵は持たない）。他人の ID は本物ではなく記号にして返す。
 */

// 並びを key の値ごとに分けた Map を返す
function groupBy_(items, key) {
  const map = new Map();
  items.forEach((item) => {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  });
  return map;
}

// 外に出す人の形（本物の userId ではなく、この予定だけの記号。名前がなければ「(名前未取得)」）
function publicPerson_(eventId, userById, uid) {
  const u = userById.get(uid) || {};
  return {
    userId: publicIdOf_(eventId, uid),
    displayName: u.displayName || '(名前未取得)',
    pictureUrl: u.pictureUrl || '',
  };
}

// イベント1つ分の集計：○△× ごとに答えた人・人数・コメント（古い順）
function optionSummary_(opt, optResponses, optComments, personOf) {
  const byAnswer = { [ANSWER.OK]: [], [ANSWER.MAYBE]: [], [ANSWER.NG]: [] };
  optResponses.forEach((r) => {
    if (byAnswer[r.answer]) byAnswer[r.answer].push(personOf(r.userId));
  });
  const comments = optComments
    .slice()
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((c) => ({
      commentId: c.commentId,
      ...personOf(c.userId),
      text: c.text,
      createdAt: c.createdAt,
    }));
  return {
    option: stripRowMeta_(opt),
    counts: {
      [ANSWER.OK]: byAnswer[ANSWER.OK].length,
      [ANSWER.MAYBE]: byAnswer[ANSWER.MAYBE].length,
      [ANSWER.NG]: byAnswer[ANSWER.NG].length,
    },
    commentCount: comments.length,
    comments,
    respondents: byAnswer,
  };
}

// 予定の画面に出すもの：予定・イベントごとの集計・自分の答え・作成者／編集者か・編集者の名前（ID はみな記号）。
// 画面が1回呼ぶだけで足りるよう、自分のようすと全員の集計をまとめて、シートは1回ずつ読む
function getSummary_(payload) {
  const { eventId, userId } = payload;
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  const options = getEventOptions_(eventId);
  const responses = getEventResponses_(eventId);
  const { rows: comments } = sheetRowsAsObjects_(SHEET.COMMENTS);
  const { rows: users } = sheetRowsAsObjects_(SHEET.USERS);

  const userById = new Map(users.map((u) => [u.userId, u]));
  // 外に出すのは本物の userId ではなく、この予定だけの記号（11_auth.js）
  const pid = (uid) => publicIdOf_(eventId, uid);
  const personOf = (uid) => publicPerson_(eventId, userById, uid);
  const responsesByOption = groupBy_(responses, 'optionId');
  const commentsByOption = groupBy_(comments, 'optionId');

  const answeredUserIds = new Set(responses.map((r) => r.userId));
  const myAnswers = {};
  responses.forEach((r) => { if (r.userId === userId) myAnswers[r.optionId] = r.answer; });

  const summary = options.map((opt) => optionSummary_(
    opt, responsesByOption.get(opt.optionId) || [], commentsByOption.get(opt.optionId) || [], personOf
  ));

  const editors = editorIdsOf_(event).map((id) => {
    const { userId: publicId, displayName } = personOf(id);
    return { userId: publicId, displayName };
  });

  // 予定の行にある作成者・編集者の本物の ID は外さない
  const { creatorUserId, editorUserIds, ...publicEvent } = stripRowMeta_(event);
  return {
    me: pid(userId),
    event: publicEvent,
    options: options.map(stripRowMeta_),
    isCreator: event.creatorUserId === userId,
    isEditor: isEditorOrCreator_(event, userId),
    hasAnswered: options.length > 0 && options.every((opt) => myAnswers[opt.optionId] !== undefined),
    myAnswers,
    editors,
    creator: personOf(event.creatorUserId),
    totalRespondents: answeredUserIds.size,
    summary,
  };
}

// 自分が作った・答えた予定の一覧（新しい順）。答えおわったか・もう終わった予定かもつける
function listMyEvents_(payload) {
  const { userId } = payload;
  if (!userId) {
    throw new Error('userId は必須です');
  }
  const { rows: events } = sheetRowsAsObjects_(SHEET.EVENTS);
  const { rows: responses } = sheetRowsAsObjects_(SHEET.RESPONSES);
  const { rows: allOptions } = sheetRowsAsObjects_(SHEET.EVENT_OPTIONS);

  const myResponseEventIds = new Set(
    responses.filter((r) => r.userId === userId).map((r) => r.eventId)
  );

  const related = events.filter((e) => e.creatorUserId === userId || myResponseEventIds.has(e.eventId));

  // その予定の全部のイベントに答えたか
  const hasFullyAnswered = (eventId) => {
    const optionIds = allOptions.filter((o) => o.eventId === eventId).map((o) => o.optionId);
    if (!optionIds.length) return false;
    const myAnsweredOptionIds = new Set(
      responses.filter((r) => r.eventId === eventId && r.userId === userId).map((r) => r.optionId)
    );
    return optionIds.every((id) => myAnsweredOptionIds.has(id));
  };

  // 未回答判定の対象からは、候補日が全て過去になったイベントを除外する（回答者判定自体は変更しない）。
  const isPastEvent = (eventId) => {
    const eventOptions = allOptions.filter((o) => o.eventId === eventId);
    if (!eventOptions.length) return false;
    const now = new Date();
    return eventOptions.every((o) => new Date(o.endAt || o.startAt) < now);
  };

  const list = related.map((e) => ({
    eventId: e.eventId,
    title: e.title,
    icon: e.icon || '🗓️',
    deadline: e.deadline || '',
    status: e.status,
    isCreator: e.creatorUserId === userId,
    hasAnswered: hasFullyAnswered(e.eventId),
    isPast: isPastEvent(e.eventId),
    createdAt: e.createdAt,
  }));

  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return { events: list };
}

// 自分にかかわる予定のイベントを全部（カレンダー用）。自分の答えもつける
function listMyOptions_(payload) {
  const { userId } = payload;
  if (!userId) {
    throw new Error('userId は必須です');
  }
  const { rows: events } = sheetRowsAsObjects_(SHEET.EVENTS);
  const { rows: options } = sheetRowsAsObjects_(SHEET.EVENT_OPTIONS);
  const { rows: responses } = sheetRowsAsObjects_(SHEET.RESPONSES);

  const myResponseEventIds = new Set(
    responses.filter((r) => r.userId === userId).map((r) => r.eventId)
  );
  const relatedEvents = events.filter((e) => isEditorOrCreator_(e, userId) || myResponseEventIds.has(e.eventId));
  const eventById = {};
  relatedEvents.forEach((e) => { eventById[e.eventId] = e; });

  const items = options
    .filter((o) => eventById[o.eventId])
    .map((o) => {
      const e = eventById[o.eventId];
      const myResponse = responses.find((r) => r.userId === userId && r.optionId === o.optionId);
      return {
        optionId: o.optionId,
        eventId: o.eventId,
        eventTitle: e.title,
        eventIcon: e.icon || '🗓️',
        optionTitle: o.title || '',
        startAt: o.startAt,
        endAt: o.endAt || '',
        location: o.location || '',
        myAnswer: myResponse ? myResponse.answer : null,
        isCreator: e.creatorUserId === userId,
      };
    });

  return { items };
}
