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
    case 'deleteEvent': return deleteEvent_(payload);
    case 'addOptions': return addOptions_(payload);
    case 'updateOption': return updateOption_(payload);
    case 'claimEditor': return claimEditor_(payload);
    case 'listMyOptions': return listMyOptions_(payload);
    case 'buildReminderFlex': return buildReminderFlex_(payload.eventId, payload.answerLabel, payload.names, payload.optionTitle, payload.optionStartAt, payload.optionEndAt, payload.optionLocation);
    case 'buildEditorInviteFlex': return buildEditorInviteFlex_(payload.eventId);
    default:
      throw new Error('未対応のactionです: ' + action);
  }
}

/** ========= lookups ========= */

function findEventById_(eventId) {
  const { rows } = sheetRowsAsObjects_(SHEET.EVENTS);
  return rows.find((r) => r.eventId === eventId) || null;
}

function findOptionById_(eventId, optionId) {
  const { rows } = sheetRowsAsObjects_(SHEET.EVENT_OPTIONS);
  return rows.find((r) => r.eventId === eventId && r.optionId === optionId) || null;
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

function editorIdsOf_(event) {
  return String(event.editorUserIds || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function isEditorOrCreator_(event, userId) {
  return event.creatorUserId === userId || editorIdsOf_(event).includes(userId);
}

/** ========= actions ========= */

function createEvent_(payload) {
  const { title, description, deadline, options, creatorUserId, creatorDisplayName, creatorPictureUrl, icon } = payload;
  if (!title || !creatorUserId) {
    throw new Error('title / creatorUserId は必須です');
  }
  if (!options || !options.length) {
    throw new Error('イベントを1件以上指定してください');
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
    editorUserIds: '',
    icon: icon || '📅',
  });

  options.forEach((opt, index) => {
    appendRowObject_(SHEET.EVENT_OPTIONS, {
      optionId: 'OPT_' + Utilities.getUuid(),
      eventId,
      startAt: opt.startAt,
      endAt: opt.endAt || '',
      sort: index,
      title: opt.title || '',
      location: opt.location || '',
    });
  });

  return { eventId };
}

function addOptions_(payload) {
  const { eventId, userId, options } = payload;
  if (!eventId || !options || !options.length) {
    throw new Error('eventId / options は必須です');
  }
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  if (!isEditorOrCreator_(event, userId)) {
    throw new Error('イベントを追加できるのは作成者・編集者のみです');
  }

  const existingOptions = getEventOptions_(eventId);
  let nextSort = existingOptions.reduce((max, o) => Math.max(max, Number(o.sort)), -1) + 1;

  options.forEach((opt) => {
    appendRowObject_(SHEET.EVENT_OPTIONS, {
      optionId: 'OPT_' + Utilities.getUuid(),
      eventId,
      startAt: opt.startAt,
      endAt: opt.endAt || '',
      sort: nextSort++,
      title: opt.title || '',
      location: opt.location || '',
    });
  });

  return { ok: true };
}

function updateOption_(payload) {
  const { eventId, userId, optionId, title, startAt, endAt, location } = payload;
  if (!eventId || !optionId) {
    throw new Error('eventId / optionId は必須です');
  }
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  if (!isEditorOrCreator_(event, userId)) {
    throw new Error('イベントを編集できるのは作成者・編集者のみです');
  }
  const option = findOptionById_(eventId, optionId);
  if (!option) {
    throw new Error('イベントが見つかりません');
  }

  updateRowObject_(SHEET.EVENT_OPTIONS, option._rowIndex, {
    ...option,
    title: title !== undefined ? title : option.title,
    startAt: startAt || option.startAt,
    endAt: endAt !== undefined ? endAt : option.endAt,
    location: location !== undefined ? location : option.location,
  });

  return { ok: true };
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
    isEditor: isEditorOrCreator_(event, userId),
    hasAnswered: options.length > 0 && options.every((opt) => myAnswers[opt.optionId] !== undefined),
    myAnswers,
  };
}

function claimEditor_(payload) {
  const { eventId, userId, displayName, pictureUrl } = payload;
  if (!eventId || !userId) {
    throw new Error('eventId / userId は必須です');
  }
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }

  upsertUser_(userId, displayName, pictureUrl);

  if (!isEditorOrCreator_(event, userId)) {
    const ids = editorIdsOf_(event);
    ids.push(userId);
    updateRowObject_(SHEET.EVENTS, event._rowIndex, {
      ...event,
      editorUserIds: ids.join(','),
      updatedAt: new Date(),
    });
  }

  return { ok: true };
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

function deleteEvent_(payload) {
  const { eventId, userId } = payload;
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  if (event.creatorUserId !== userId) {
    throw new Error('削除できるのは作成者のみです');
  }

  const { rows: optionRows } = sheetRowsAsObjects_(SHEET.EVENT_OPTIONS);
  const { rows: responseRows } = sheetRowsAsObjects_(SHEET.RESPONSES);

  deleteRows_(SHEET.EVENT_OPTIONS, optionRows.filter((r) => r.eventId === eventId).map((r) => r._rowIndex));
  deleteRows_(SHEET.RESPONSES, responseRows.filter((r) => r.eventId === eventId).map((r) => r._rowIndex));
  deleteRows_(SHEET.EVENTS, [event._rowIndex]);

  return { ok: true };
}

function buildShareFlex_(payload) {
  const { eventId } = payload;
  return buildEventShareFlex_(eventId);
}

function stripRowMeta_(row) {
  const { _rowIndex, ...rest } = row;
  return rest;
}
