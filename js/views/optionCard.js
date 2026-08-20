/**
 * イベントカード（予定枠1件分）の表示・編集・インライン回答まわりを
 * detail.js から切り出した共有コンポーネント。
 */
const OptionCard = (() => {
  const ANSWERS = ['○', '△', '×'];
  const ANSWER_CLASS = { '○': 'choice-ok', '△': 'choice-maybe', '×': 'choice-ng' };

  function choiceButtonsHtml(optionId, myAnswers) {
    return ANSWERS.map((a) => `
      <button type="button" class="choice-btn ${ANSWER_CLASS[a]} ${myAnswers[optionId] === a ? 'selected' : ''}" data-value="${a}">${a}</button>`).join('');
  }

  function statusClass(answer) {
    return ANSWER_CLASS[answer] || 'status-none';
  }

  function answerButtonsHtml(optionId, myAnswer, counts) {
    return `
      <div class="answer-buttons" data-option-id="${optionId}">
        ${ANSWERS.map((a) => `
          <span class="choice-count-wrap">
            <button type="button" class="choice-btn ${ANSWER_CLASS[a]} ${myAnswer === a ? 'selected' : ''}" data-value="${a}">${a}</button>
            ${counts ? `<span class="choice-count">${counts[a] || 0}</span>` : ''}
          </span>`).join('')}
      </div>`;
  }

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

  const COMMENT_VISIBLE_LIMIT = 2;

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

  function titleFieldHtml(prefix, values, placeholder) {
    values = values || {};
    return `<input type="text" class="${prefix}-title" value="${AppUtil.escapeHtml(values.title || '')}" placeholder="${AppUtil.escapeHtml(placeholder || 'イベント名')}">`;
  }

  function rangeLocationFieldsHtml(prefix, values) {
    values = values || {};
    return `
      <div class="option-range">
        <label class="option-sublabel">開始<input type="datetime-local" class="${prefix}-start" value="${AppUtil.toDatetimeLocalValue(values.startAt)}"></label>
        <label class="option-sublabel">完了<input type="datetime-local" class="${prefix}-end" value="${AppUtil.toDatetimeLocalValue(values.endAt)}"></label>
      </div>
      <input type="text" class="${prefix}-location option-location" value="${AppUtil.escapeHtml(values.location || '')}" placeholder="📍 場所・持ち物など（任意）">`;
  }

  function fieldsHtml(prefix, values) {
    return titleFieldHtml(prefix, values) + rangeLocationFieldsHtml(prefix, values);
  }

  function readFields(container, prefix) {
    return {
      title: container.querySelector(`.${prefix}-title`).value.trim(),
      startAt: container.querySelector(`.${prefix}-start`).value,
      endAt: container.querySelector(`.${prefix}-end`).value,
      location: container.querySelector(`.${prefix}-location`).value.trim(),
    };
  }

  function metaHtml(opt, canEdit, comments, myUserId) {
    return `
      <div class="option-meta" data-option-id="${opt.optionId}">
        <div class="option-meta-view">
          <div class="option-meta-title-row">
            <div class="option-meta-title">${AppUtil.titleIconHtml(opt.title || '(タイトルなし)')}</div>
            ${canEdit ? `<button type="button" class="edit-option-btn" aria-label="編集">✏️</button>` : ''}
          </div>
          <div class="option-meta-info-row option-meta-info-row-split">
            <span class="option-meta-date">${AppUtil.formatDateRange(opt.startAt, opt.endAt)} ${AppUtil.relativeDayPillHtml(opt.startAt)}</span>
            ${AppUtil.calendarLinkHtml(opt.title, '', opt.startAt, opt.endAt, opt.location)}
          </div>
          ${opt.location ? `<div class="option-meta-info-row"><span class="option-meta-location">📍 ${AppUtil.escapeHtml(opt.location)}</span></div>` : ''}
          ${commentsListHtml(comments, myUserId)}
          ${commentAddFormHtml(opt.optionId)}
        </div>
        ${canEdit ? `
        <div class="option-edit-form" hidden>
          ${fieldsHtml('edit', opt)}
          <div class="option-edit-actions">
            <button type="button" class="btn save-option-btn">保存</button>
            <button type="button" class="btn cancel-option-btn">キャンセル</button>
          </div>
        </div>` : ''}
      </div>`;
  }

  function wireEditForms(root, ctx, refresh) {
    root.querySelectorAll('.option-meta').forEach((meta) => {
      const editBtn = meta.querySelector('.edit-option-btn');
      const view = meta.querySelector('.option-meta-view');
      const form = meta.querySelector('.option-edit-form');
      if (!editBtn || !form) return;

      editBtn.addEventListener('click', () => {
        view.hidden = true;
        form.hidden = false;
      });

      meta.querySelector('.cancel-option-btn').addEventListener('click', () => {
        form.hidden = true;
        view.hidden = false;
      });

      meta.querySelector('.save-option-btn').addEventListener('click', async (e) => {
        const fields = readFields(form, 'edit');
        const error = AppUtil.validateEventFields(fields);
        if (error) { alert(error); return; }

        const stopLoading = AppUtil.beginButtonLoading(e.target);
        const optionId = meta.dataset.optionId;
        try {
          const summaryBefore = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });
          const rowBefore = summaryBefore.summary.find((r) => r.option.optionId === optionId);
          const respondentNames = rowBefore
            ? Array.from(new Set(['○', '△', '×'].flatMap((a) => (rowBefore.respondents[a] || []).map((r) => r.displayName))))
            : [];

          await AppApi.updateOption({ eventId: ctx.eventId, userId: ctx.identity.userId, optionId, ...fields });

          if (respondentNames.length && confirm(`この予定には既に${respondentNames.length}件の回答があります。変更を回答者に知らせますか？`)) {
            try {
              await AppShare.notifyChange({
                eventId: ctx.eventId, optionTitle: fields.title, optionStartAt: fields.startAt,
                optionEndAt: fields.endAt, optionLocation: fields.location, names: respondentNames,
              });
            } catch (notifyErr) {
              alert('通知の送信に失敗しました: ' + notifyErr.message);
            }
          }

          await refresh();
        } catch (err) {
          alert('更新に失敗しました: ' + err.message);
          stopLoading();
        }
      });
    });
  }

  function wireAnswerButtons(root, ctx, refresh) {
    root.querySelectorAll('.answer-buttons').forEach((wrap) => {
      wrap.addEventListener('click', async (e) => {
        const btn = e.target.closest('.choice-btn');
        if (!btn) return;
        const optionId = wrap.dataset.optionId;
        const value = btn.dataset.value;
        wrap.querySelectorAll('.choice-btn').forEach((b) => {
          b.classList.toggle('selected', b === btn);
          b.disabled = true;
        });
        const stopLoading = AppUtil.beginButtonLoading(btn);
        try {
          await AppApi.submitAnswer({
            eventId: ctx.eventId,
            userId: ctx.identity.userId,
            displayName: ctx.identity.displayName,
            pictureUrl: ctx.identity.pictureUrl,
            answers: [{ optionId, answer: value }],
          });
          await refresh();
        } catch (err) {
          alert('回答の保存に失敗しました: ' + err.message);
          stopLoading();
          wrap.querySelectorAll('.choice-btn').forEach((b) => { b.disabled = false; });
        }
      });
    });
  }

  return {
    metaHtml, fieldsHtml, titleFieldHtml, rangeLocationFieldsHtml, readFields,
    choiceButtonsHtml, answerButtonsHtml, commentAddToggleHtml, statusClass, wireEditForms, wireAnswerButtons, wireComments,
  };
})();
