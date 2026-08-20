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
        eventId, optionId, userId, answer,
        answeredAt: existing.answeredAt || now,
        updatedAt: now,
        comment: existing.comment,
      });
    } else {
      appendRowObject_(SHEET.RESPONSES, {
        eventId, optionId, userId, answer, answeredAt: now, updatedAt: now, comment: '',
      });
    }
  });

  return { ok: true };
}

function addComment_(payload) {
  const { eventId, optionId, userId, displayName, pictureUrl, text } = payload;
  if (!eventId || !optionId || !userId || !text || !text.trim()) {
    throw new Error('eventId / optionId / userId / text は必須です');
  }
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }

  upsertUser_(userId, displayName, pictureUrl);

  const commentId = 'CMT_' + Utilities.getUuid();
  appendRowObject_(SHEET.COMMENTS, {
    commentId, eventId, optionId, userId, text: text.trim(), createdAt: new Date(),
  });

  return { commentId };
}

function deleteComment_(payload) {
  const { eventId, userId, commentId } = payload;
  if (!eventId || !userId || !commentId) {
    throw new Error('eventId / userId / commentId は必須です');
  }
  const { rows } = sheetRowsAsObjects_(SHEET.COMMENTS);
  const comment = rows.find((r) => r.commentId === commentId && r.eventId === eventId);
  if (!comment) {
    throw new Error('コメントが見つかりません');
  }
  if (comment.userId !== userId) {
    throw new Error('削除できるのは投稿者のみです');
  }

  deleteRows_(SHEET.COMMENTS, [comment._rowIndex]);
  return { ok: true };
}

function _groupBy_(items, key) {
  const map = new Map();
  items.forEach((item) => {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  });
  return map;
}

// getEvent_ 相当（自分の回答状況・権限判定・編集者一覧）と getSummary_ 相当（全員の回答集計）を
// まとめて1回のシート読み込みで返す。detail画面が2回APIを呼んで同じシートを二重に読んでいたのを解消。
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
  const userOf = (uid) => userById.get(uid) || {};
  const responsesByOption = _groupBy_(responses, 'optionId');
  const commentsByOption = _groupBy_(comments, 'optionId');

  const answeredUserIds = new Set(responses.map((r) => r.userId));
  const myAnswers = {};
  responses.forEach((r) => { if (r.userId === userId) myAnswers[r.optionId] = r.answer; });

  const summary = options.map((opt) => {
    const optResponses = responsesByOption.get(opt.optionId) || [];
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
    const optComments = (commentsByOption.get(opt.optionId) || [])
      .slice()
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((c) => {
        const u = userOf(c.userId);
        return {
          commentId: c.commentId,
          userId: c.userId,
          displayName: u.displayName || '(名前未取得)',
          pictureUrl: u.pictureUrl || '',
          text: c.text,
          createdAt: c.createdAt,
        };
      });
    return {
      option: stripRowMeta_(opt),
      counts: {
        [ANSWER.OK]: byAnswer[ANSWER.OK].length,
        [ANSWER.MAYBE]: byAnswer[ANSWER.MAYBE].length,
        [ANSWER.NG]: byAnswer[ANSWER.NG].length,
      },
      commentCount: optComments.length,
      comments: optComments,
      respondents: byAnswer,
    };
  });

  const editors = editorIdsOf_(event).map((id) => {
    const u = userById.get(id);
    return { userId: id, displayName: (u && u.displayName) || '(名前未取得)' };
  });

  return {
    event: stripRowMeta_(event),
    options: options.map(stripRowMeta_),
    isCreator: event.creatorUserId === userId,
    isEditor: isEditorOrCreator_(event, userId),
    hasAnswered: options.length > 0 && options.every((opt) => myAnswers[opt.optionId] !== undefined),
    myAnswers,
    editors,
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
    icon: e.icon || '🗓️',
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
