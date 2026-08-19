/**
 * action 文字列 → ハンドラのディスパッチと、各アクションのドメインロジック。
 */

function routeAction_(action, payload) {
  switch (action) {
    case 'createEvent': return createEvent_(payload);
    case 'getEvent': return getEvent_(payload);
    case 'submitAnswer': return submitAnswer_(payload);
    case 'getSummary': return getSummary_(payload);
    case 'listMyEvents': return listMyEvents_(payload);
    case 'buildShareFlex': return buildShareFlex_(payload);
    default:
      throw new Error('未対応のactionです: ' + action);
  }
}

/** ========= lookups ========= */

function findEventById_(eventId) {
  const { rows } = sheetRowsAsObjects_(SHEET.EVENTS);
  return rows.find((r) => r.eventId === eventId) || null;
}

function getEventOptions_(eventId) {
  const { rows } = sheetRowsAsObjects_(SHEET.EVENT_OPTIONS);
  return rows
    .filter((r) => r.eventId === eventId)
    .sort((a, b) => Number(a.sort) - Number(b.sort));
}

function getEventResponses_(eventId) {
  const { rows } = sheetRowsAsObjects_(SHEET.RESPONSES);
  return rows.filter((r) => r.eventId === eventId);
}

function getUserDisplayName_(userId) {
  const { rows } = sheetRowsAsObjects_(SHEET.USERS);
  const user = rows.find((r) => r.userId === userId);
  return user ? user.displayName : '';
}

/** ========= actions ========= */

function createEvent_(payload) {
  const { title, description, deadline, options, creatorUserId, creatorDisplayName, creatorPictureUrl } = payload;
  if (!title || !creatorUserId) {
    throw new Error('title / creatorUserId は必須です');
  }
  if (!options || !options.length) {
    throw new Error('候補日時を1件以上指定してください');
  }

  upsertUser_(creatorUserId, creatorDisplayName, creatorPictureUrl);

  const eventId = 'EVT_' + Utilities.getUuid();
  const now = new Date();
  appendRowObject_(SHEET.EVENTS, {
    eventId,
    creatorUserId,
    title,
    description: description || '',
    deadline: deadline || '',
    status: EVENT_STATUS.OPEN,
    workspaceId: '',
    createdAt: now,
    updatedAt: now,
  });

  options.forEach((opt, index) => {
    appendRowObject_(SHEET.EVENT_OPTIONS, {
      optionId: 'OPT_' + Utilities.getUuid(),
      eventId,
      startAt: opt.startAt,
      endAt: opt.endAt || '',
      sort: index,
    });
  });

  return { eventId };
}

function getEvent_(payload) {
  const { eventId, userId } = payload;
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  const options = getEventOptions_(eventId);
  const responses = getEventResponses_(eventId);
  const myResponses = responses.filter((r) => r.userId === userId);
  const myAnswers = {};
  myResponses.forEach((r) => { myAnswers[r.optionId] = r.answer; });

  return {
    event: stripRowMeta_(event),
    options: options.map(stripRowMeta_),
    isCreator: event.creatorUserId === userId,
    hasAnswered: myResponses.length > 0,
    myAnswers,
  };
}

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
  if (event.creatorUserId !== userId) {
    throw new Error('集計を閲覧できるのは作成者のみです');
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

  const myResponseEventIds = new Set(
    responses.filter((r) => r.userId === userId).map((r) => r.eventId)
  );

  const related = events.filter((e) => e.creatorUserId === userId || myResponseEventIds.has(e.eventId));

  const list = related.map((e) => ({
    eventId: e.eventId,
    title: e.title,
    deadline: e.deadline || '',
    status: e.status,
    isCreator: e.creatorUserId === userId,
    hasAnswered: myResponseEventIds.has(e.eventId),
    createdAt: e.createdAt,
  }));

  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return { events: list };
}

function buildShareFlex_(payload) {
  const { eventId } = payload;
  return buildEventShareFlex_(eventId);
}

function stripRowMeta_(row) {
  const { _rowIndex, ...rest } = row;
  return rest;
}
