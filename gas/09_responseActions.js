/**
 * 回答（RESPONSES）の登録・集計・一覧アクション。
 */

function submitAnswer_(payload) {
  const { eventId, userId, displayName, pictureUrl, answers } = payload;
  if (!eventId || !userId || !answers || !answers.length) {
    throw new Error('eventId / userId / answers は必須です');
  }
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }

  upsertUser_(userId, displayName, pictureUrl);

  const { rows } = sheetRowsAsObjects_(SHEET.RESPONSES);
  const now = new Date();

  answers.forEach(({ optionId, answer }) => {
    const existing = rows.find((r) => r.eventId === eventId && r.optionId === optionId && r.userId === userId);
    if (existing) {
      updateRowObject_(SHEET.RESPONSES, existing._rowIndex, {
        eventId, optionId, userId, answer, answeredAt: existing.answeredAt || now, updatedAt: now,
      });
    } else {
      appendRowObject_(SHEET.RESPONSES, {
        eventId, optionId, userId, answer, answeredAt: now, updatedAt: now,
      });
    }
  });

  return { ok: true };
}

function getSummary_(payload) {
  const { eventId, userId } = payload;
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  const options = getEventOptions_(eventId);
  const responses = getEventResponses_(eventId);

  const { rows: users } = sheetRowsAsObjects_(SHEET.USERS);
  const userOf = (uid) => users.find((u) => u.userId === uid) || {};

  const answeredUserIds = new Set(responses.map((r) => r.userId));

  const summary = options.map((opt) => {
    const optResponses = responses.filter((r) => r.optionId === opt.optionId);
    const byAnswer = { [ANSWER.OK]: [], [ANSWER.MAYBE]: [], [ANSWER.NG]: [] };
    optResponses.forEach((r) => {
      if (byAnswer[r.answer]) {
        const u = userOf(r.userId);
        byAnswer[r.answer].push({
          userId: r.userId,
          displayName: u.displayName || '(名前未取得)',
          pictureUrl: u.pictureUrl || '',
        });
      }
    });
    return {
      option: stripRowMeta_(opt),
      counts: {
        [ANSWER.OK]: byAnswer[ANSWER.OK].length,
        [ANSWER.MAYBE]: byAnswer[ANSWER.MAYBE].length,
        [ANSWER.NG]: byAnswer[ANSWER.NG].length,
      },
      respondents: byAnswer,
    };
  });

  return {
    event: stripRowMeta_(event),
    totalRespondents: answeredUserIds.size,
    summary,
  };
}

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

  const hasFullyAnswered = (eventId) => {
    const optionIds = allOptions.filter((o) => o.eventId === eventId).map((o) => o.optionId);
    if (!optionIds.length) return false;
    const myAnsweredOptionIds = new Set(
      responses.filter((r) => r.eventId === eventId && r.userId === userId).map((r) => r.optionId)
    );
    return optionIds.every((id) => myAnsweredOptionIds.has(id));
  };

  const list = related.map((e) => ({
    eventId: e.eventId,
    title: e.title,
    icon: e.icon || '📅',
    deadline: e.deadline || '',
    status: e.status,
    isCreator: e.creatorUserId === userId,
    hasAnswered: hasFullyAnswered(e.eventId),
    createdAt: e.createdAt,
  }));

  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return { events: list };
}

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
        eventIcon: e.icon || '📅',
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
