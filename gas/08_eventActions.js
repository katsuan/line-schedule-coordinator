/**
 * 予定（EVENTS）・イベント（EVENT_OPTIONS）本体のCRUDアクション。
 * 回答（RESPONSES）まわりは 09_responseActions.js を参照。
 */

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
  myResponses.forEach((r) => {
    myAnswers[r.optionId] = r.answer;
  });

  const { rows: allComments } = sheetRowsAsObjects_(SHEET.COMMENTS);
  const myComments = {};
  allComments
    .filter((c) => c.eventId === eventId && c.userId === userId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .forEach((c) => {
      (myComments[c.optionId] = myComments[c.optionId] || []).push({
        commentId: c.commentId, text: c.text, createdAt: c.createdAt,
      });
    });

  return {
    event: stripRowMeta_(event),
    options: options.map(stripRowMeta_),
    isCreator: event.creatorUserId === userId,
    isEditor: isEditorOrCreator_(event, userId),
    hasAnswered: options.length > 0 && options.every((opt) => myAnswers[opt.optionId] !== undefined),
    myAnswers,
    myComments,
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
  const { rows: commentRows } = sheetRowsAsObjects_(SHEET.COMMENTS);

  deleteRows_(SHEET.EVENT_OPTIONS, optionRows.filter((r) => r.eventId === eventId).map((r) => r._rowIndex));
  deleteRows_(SHEET.RESPONSES, responseRows.filter((r) => r.eventId === eventId).map((r) => r._rowIndex));
  deleteRows_(SHEET.COMMENTS, commentRows.filter((r) => r.eventId === eventId).map((r) => r._rowIndex));
  deleteRows_(SHEET.EVENTS, [event._rowIndex]);

  return { ok: true };
}

function buildShareFlex_(payload) {
  const { eventId } = payload;
  return buildEventShareFlex_(eventId);
}
