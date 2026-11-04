/**
 * 予定の編集者（EVENTS の editorUserIds）を足す：招待のリンクから自分でなる・作った人が依頼を許可する。
 * 呼ばれ方：03_routing.js から（書きこむ操作は 01_entry.js で鍵を持って1つずつ）。だれが編集者かを見るのは 07_lookups.js。
 */

// 予定の編集者に1人足す（もう編集者・作成者かは、呼ぶ側で見ておく）
function addEditor_(event, userId) {
  const ids = editorIdsOf_(event);
  ids.push(userId);
  updateRowObject_(SHEET.EVENTS, event._rowIndex, {
    ...event,
    editorUserIds: ids.join(','),
    updatedAt: new Date(),
  });
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
    addEditor_(event, userId);
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
    addEditor_(event, targetUserId);
  }

  return { ok: true };
}
