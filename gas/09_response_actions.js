/**
 * 回答（○△×）とコメントを書く・消す。
 * 呼ばれ方：03_routing.js から（鍵を持って1つずつ）。集計や一覧は 10_summary.js。
 */

// ○△× の答えを書く（同じ人・同じイベントは書きかえる）。答えは ○△× だけ、その予定のイベントだけ
function submitAnswer_(payload) {
  const { eventId, userId, displayName, pictureUrl, answers } = payload;
  if (!eventId || !userId || !Array.isArray(answers) || !answers.length) {
    throw new Error('eventId / userId / answers は必須です');
  }
  if (answers.length > LIMITS.ANSWERS) {
    throw new Error('回答が多すぎます');
  }
  const event = findEventById_(eventId);
  if (!event) {
    throw new Error('イベントが見つかりません');
  }
  // 答えは ○△× だけ、候補はこの予定のものだけ
  const optionIds = new Set(getEventOptions_(eventId).map((o) => o.optionId));
  const choices = [ANSWER.OK, ANSWER.MAYBE, ANSWER.NG];
  answers.forEach((item) => {
    if (!item || !optionIds.has(item.optionId) || choices.indexOf(item.answer) === -1) {
      throw new Error('その答えは選べません');
    }
  });

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

// イベントにコメントを足す。返すもの：{ commentId }
function addComment_(payload) {
  const { eventId, optionId, userId, displayName, pictureUrl } = payload;
  const text = typeof payload.text === 'string' ? payload.text : '';
  if (!eventId || !optionId || !userId || !text.trim()) {
    throw new Error('eventId / optionId / userId / text は必須です');
  }
  limitText_(text.trim(), LIMITS.COMMENT, 'コメント');
  const event = findEventById_(eventId);
  if (!event || !findOptionById_(eventId, optionId)) {
    throw new Error('イベントが見つかりません');
  }

  upsertUser_(userId, displayName, pictureUrl);

  const commentId = 'CMT_' + Utilities.getUuid();
  appendRowObject_(SHEET.COMMENTS, {
    commentId, eventId, optionId, userId, text: text.trim(), createdAt: new Date(),
  });

  return { commentId };
}

// コメントを消す（書いた人だけ）
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
