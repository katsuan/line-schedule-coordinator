/**
 * イベントカードのコメント（追加・一覧表示・削除）まわり。js/views/optionCard.js から切り出し。
 */
const OptionComments = (() => {
  const COMMENT_VISIBLE_LIMIT = 2;

  function commentEntryHtml(comment, myUserId) {
    const isMine = comment.userId === myUserId;
    return `
      <div class="option-comment" data-comment-id="${comment.commentId}">
        ${AppUtil.avatarHtml(comment.displayName, comment.pictureUrl, comment.answer)}
        <div class="option-comment-body">
          <span class="option-comment-author">${AppUtil.escapeHtml(comment.displayName)}${isMine ? '（自分）' : ''}</span>
          <span class="option-comment-text">${AppUtil.escapeHtml(comment.text)}</span>
        </div>
        ${isMine ? `<button type="button" class="comment-delete-btn" data-comment-id="${comment.commentId}" aria-label="コメントを削除">×</button>` : ''}
      </div>`;
  }

  function commentsListHtml(comments, myUserId) {
    comments = comments || [];
    if (comments.length <= COMMENT_VISIBLE_LIMIT) {
      return comments.map((c) => commentEntryHtml(c, myUserId)).join('');
    }
    const visible = comments.slice(0, COMMENT_VISIBLE_LIMIT);
    const rest = comments.slice(COMMENT_VISIBLE_LIMIT);
    return `
      ${visible.map((c) => commentEntryHtml(c, myUserId)).join('')}
      <details class="comment-list-more">
        <summary>他${rest.length}件のコメントを見る</summary>
        ${rest.map((c) => commentEntryHtml(c, myUserId)).join('')}
      </details>`;
  }

  function commentAddToggleHtml(optionId) {
    return `<button type="button" class="comment-add-toggle" data-option-id="${optionId}">💬 コメントを追加</button>`;
  }

  function commentAddFormHtml(optionId) {
    return `
      <div class="comment-add-form" data-option-id="${optionId}" hidden>
        <input type="text" class="comment-input" placeholder="例: 友達が1名参加します" maxlength="200">
        <button type="button" class="btn comment-save-btn">保存</button>
      </div>`;
  }

  function wireComments(root, ctx, refresh) {
    root.querySelectorAll('.comment-add-toggle').forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const form = root.querySelector(`.comment-add-form[data-option-id="${toggle.dataset.optionId}"]`);
        if (!form) return;
        toggle.hidden = true;
        form.hidden = false;
        form.querySelector('.comment-input').focus();
      });
    });

    root.querySelectorAll('.comment-add-form').forEach((form) => {
      const input = form.querySelector('.comment-input');
      form.querySelector('.comment-save-btn').addEventListener('click', async (e) => {
        const text = input.value.trim();
        if (!text) return;
        const stopLoading = AppUtil.beginButtonLoading(e.target);
        input.disabled = true;
        try {
          await AppApi.addComment({
            eventId: ctx.eventId,
            optionId: form.dataset.optionId,
            userId: ctx.identity.userId,
            displayName: ctx.identity.displayName,
            pictureUrl: ctx.identity.pictureUrl,
            text,
          });
          await refresh();
        } catch (err) {
          alert('コメントの保存に失敗しました: ' + err.message);
          input.disabled = false;
          stopLoading();
        }
      });
    });

    root.querySelectorAll('.comment-delete-btn').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        if (!confirm('コメントを削除しますか？')) return;
        const stopLoading = AppUtil.beginButtonLoading(e.target);
        try {
          await AppApi.deleteComment({
            eventId: ctx.eventId,
            userId: ctx.identity.userId,
            commentId: btn.dataset.commentId,
          });
          await refresh();
        } catch (err) {
          alert('コメントの削除に失敗しました: ' + err.message);
          stopLoading();
        }
      });
    });
  }

  return { commentsListHtml, commentAddToggleHtml, commentAddFormHtml, wireComments };
})();
