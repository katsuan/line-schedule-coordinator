/**
 * 予定（EVENTS）とイベント（EVENT_OPTIONS）を作る・変える・消す。編集者になる・編集を許可する。
 * 呼ばれ方：03_routing.js から（書きこむ操作は 01_entry.js で鍵を持って1つずつ）。回答は 09_responseActions.js。
 */

// 新しい予定とイベントを作る。返すもの：{ eventId }
function createEvent_(payload) {
  const { creatorUserId, creatorDisplayName, creatorPictureUrl } = payload;
  const title = limitText_(payload.title, LIMITS.TITLE, 'タイトル');
  const description = limitText_(payload.description, LIMITS.DESCRIPTION, '説明');
  const deadline = limitText_(payload.deadline, LIMITS.DATETIME, '回答期限');
  const icon = limitText_(payload.icon, LIMITS.ICON, 'アイコン');
  if (!title || !creatorUserId) {
    throw new Error('title / creatorUserId は必須です');
  }
  const options = cleanOptions_(payload.options);

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
    icon: icon || '🗓️',
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

// 予定の題・説明・回答期限を変える（作った人か編集者だけ）
function updateEvent_(payload) {
  const { eventId, userId } = payload;
  const title = limitText_(payload.title, LIMITS.TITLE, 'タイトル');
  const description = limitText_(payload.description, LIMITS.DESCRIPTION, '説明');
  const deadline = limitText_(payload.deadline, LIMITS.DATETIME, '回答期限');
  if (!eventId || !title) {
    throw new Error('eventId / title は必須です');
  }
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  if (!isEditorOrCreator_(event, userId)) {
    throw new Error('編集できるのは作成者・編集者のみです');
  }

  updateRowObject_(SHEET.EVENTS, event._rowIndex, {
    ...event,
    title,
    description: description !== undefined ? description : event.description,
    deadline: deadline !== undefined ? deadline : event.deadline,
    updatedAt: new Date(),
  });

  return { ok: true };
}

// 予定にイベントを足す（作った人か編集者だけ。多すぎるときは断る）
function addOptions_(payload) {
  const { eventId, userId } = payload;
  if (!eventId || !payload.options || !payload.options.length) {
    throw new Error('eventId / options は必須です');
  }
  const options = cleanOptions_(payload.options);
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  if (!isEditorOrCreator_(event, userId)) {
    throw new Error('イベントを追加できるのは作成者・編集者のみです');
  }

  const existingOptions = getEventOptions_(eventId);
  if (existingOptions.length + options.length > LIMITS.OPTIONS * 2) {
    throw new Error('イベントが多すぎます（' + LIMITS.OPTIONS * 2 + '件まで）');
  }
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

// イベントの題・日時・メモを変える（作った人か編集者だけ）
function updateOption_(payload) {
  const { eventId, userId, optionId } = payload;
  const title = limitText_(payload.title, LIMITS.OPTION_TITLE, 'イベント名');
  const startAt = limitText_(payload.startAt, LIMITS.DATETIME, '開始');
  const endAt = limitText_(payload.endAt, LIMITS.DATETIME, '完了');
  const location = limitText_(payload.location, LIMITS.LOCATION, '場所');
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

// 招待のリンク（合言葉つき）から開いた人を、編集者にする
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
    // 編集者になれるのは、作成者が送った招待のリンク（合言葉つき）から開いた人だけ
    if (String(payload.inviteKey || '') !== editorInviteKey_(eventId)) {
      throw new Error('編集者になるには、作成者からの招待のリンクが必要です');
    }
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

// 作った人が、編集を頼んだ人（記号で届く）を編集者にする。
// （claimEditor_ は招待のリンクから自分でなるほう）
function approveEditRequest_(payload) {
  const { eventId, userId } = payload;
  // 依頼のリンクに入っているのは、本物の ID ではなく、その予定の記号（11_auth.js）
  const targetUserId = userIdFromPublicId_(eventId, payload.targetUserId);
  if (!eventId || !userId || !targetUserId) {
    throw new Error('eventId / userId / targetUserId は必須です');
  }
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  if (event.creatorUserId !== userId) {
    throw new Error('編集権限を許可できるのは作成者のみです');
  }

  if (!isEditorOrCreator_(event, targetUserId)) {
    const ids = editorIdsOf_(event);
    ids.push(targetUserId);
    updateRowObject_(SHEET.EVENTS, event._rowIndex, {
      ...event,
      editorUserIds: ids.join(','),
      updatedAt: new Date(),
    });
  }

  return { ok: true };
}

// 予定と、そのイベント・回答・コメントを全部消す（作った人だけ）
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

// 予定を送るカードを返す（06_message.js の buildEventShareFlex_）
function buildShareFlex_(payload) {
  const { eventId } = payload;
  return buildEventShareFlex_(eventId);
}
