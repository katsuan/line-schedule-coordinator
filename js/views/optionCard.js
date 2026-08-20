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

  function answerIcon(answer) {
    const cls = ANSWER_CLASS[answer] || 'dot-none';
    return `<span class="answer-icon ${cls}">${answer || '-'}</span>`;
  }

  function statusClass(answer) {
    return ANSWER_CLASS[answer] || 'status-none';
  }

  function answerInlineHtml(optionId, myAnswer) {
    const cls = ANSWER_CLASS[myAnswer] || 'dot-none';
    return `
      <span class="answer-inline" data-option-id="${optionId}">
        <button type="button" class="answer-icon answer-inline-badge ${cls}" aria-label="回答を変更">${myAnswer || '-'}</button>
        <span class="answer-inline-choices" hidden>
          ${ANSWERS.map((a) => `<button type="button" class="choice-btn choice-inline ${ANSWER_CLASS[a]} ${myAnswer === a ? 'selected' : ''}" data-value="${a}">${a}</button>`).join('')}
        </span>
      </span>`;
  }

  function commentHtml(optionId, myAnswer, myComment) {
    if (myComment) {
      return `
        <div class="option-comment" data-option-id="${optionId}" data-answer="${myAnswer}">
          <span class="option-comment-text">💬 ${AppUtil.escapeHtml(myComment)}</span>
          <button type="button" class="comment-delete-btn" aria-label="コメントを削除">×</button>
        </div>`;
    }
    return `
      <div class="option-comment-add" data-option-id="${optionId}" data-answer="${myAnswer}">
        <button type="button" class="comment-add-toggle">💬 コメントを追加</button>
        <div class="comment-add-form" hidden>
          <input type="text" class="comment-input" placeholder="例: 友達が1名参加します" maxlength="200">
          <button type="button" class="btn comment-save-btn">保存</button>
        </div>
      </div>`;
  }

  function wireComments(root, ctx, refresh) {
    root.querySelectorAll('.option-comment-add').forEach((wrap) => {
      const toggle = wrap.querySelector('.comment-add-toggle');
      const form = wrap.querySelector('.comment-add-form');
      const input = wrap.querySelector('.comment-input');
      toggle.addEventListener('click', () => {
        toggle.hidden = true;
        form.hidden = false;
        input.focus();
      });
      wrap.querySelector('.comment-save-btn').addEventListener('click', async (e) => {
        const comment = input.value.trim();
        if (!comment) return;
        const stopLoading = AppUtil.beginButtonLoading(e.target);
        input.disabled = true;
        try {
          await AppApi.submitAnswer({
            eventId: ctx.eventId,
            userId: ctx.identity.userId,
            displayName: ctx.identity.displayName,
            pictureUrl: ctx.identity.pictureUrl,
            answers: [{ optionId: wrap.dataset.optionId, answer: wrap.dataset.answer, comment }],
          });
          await refresh();
        } catch (err) {
          alert('コメントの保存に失敗しました: ' + err.message);
          input.disabled = false;
          stopLoading();
        }
      });
    });

    root.querySelectorAll('.option-comment').forEach((wrap) => {
      wrap.querySelector('.comment-delete-btn').addEventListener('click', async (e) => {
        if (!confirm('コメントを削除しますか？')) return;
        const stopLoading = AppUtil.beginButtonLoading(e.target);
        try {
          await AppApi.submitAnswer({
            eventId: ctx.eventId,
            userId: ctx.identity.userId,
            displayName: ctx.identity.displayName,
            pictureUrl: ctx.identity.pictureUrl,
            answers: [{ optionId: wrap.dataset.optionId, answer: wrap.dataset.answer, comment: '' }],
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
        <label class="option-sublabel">開始<input type="datetime-local" step="900" class="${prefix}-start" value="${AppUtil.toDatetimeLocalValue(values.startAt)}"></label>
        <label class="option-sublabel">完了<input type="datetime-local" step="900" class="${prefix}-end" value="${AppUtil.toDatetimeLocalValue(values.endAt)}"></label>
      </div>
      <input type="text" class="${prefix}-location option-location" value="${AppUtil.escapeHtml(values.location || '')}" placeholder="📍 場所（任意）">`;
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

  function metaHtml(opt, canEdit, myAnswer, myComment) {
    return `
      <div class="option-meta" data-option-id="${opt.optionId}">
        <div class="option-meta-view">
          <div class="option-meta-title-row">
            <div class="option-meta-title">${AppUtil.titleIconHtml(opt.title || '(タイトルなし)')}</div>
            ${myAnswer !== undefined ? answerInlineHtml(opt.optionId, myAnswer) : ''}
            ${canEdit ? `<button type="button" class="edit-option-btn" aria-label="編集">✏️</button>` : ''}
          </div>
          <div class="option-meta-date">${AppUtil.formatDateRange(opt.startAt, opt.endAt)} ${AppUtil.relativeDayPillHtml(opt.startAt)}</div>
          ${opt.location ? `<div class="option-meta-location">📍 ${AppUtil.escapeHtml(opt.location)}</div>` : ''}
          ${AppUtil.calendarLinkHtml(opt.title, '', opt.startAt, opt.endAt, opt.location)}
          ${myAnswer !== undefined ? commentHtml(opt.optionId, myAnswer, myComment) : ''}
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

  function wireInlineAnswerToggles(root, ctx, refresh) {
    root.querySelectorAll('.answer-inline').forEach((wrap) => {
      const badge = wrap.querySelector('.answer-inline-badge');
      const choices = wrap.querySelector('.answer-inline-choices');

      badge.addEventListener('click', () => {
        badge.hidden = true;
        choices.hidden = false;
      });

      choices.addEventListener('click', async (e) => {
        const btn = e.target.closest('.choice-btn');
        if (!btn) return;
        const optionId = wrap.dataset.optionId;
        const value = btn.dataset.value;
        choices.querySelectorAll('.choice-btn').forEach((b) => {
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
          choices.querySelectorAll('.choice-btn').forEach((b) => { b.disabled = false; });
        }
      });
    });
  }

  return {
    metaHtml, fieldsHtml, titleFieldHtml, rangeLocationFieldsHtml, readFields,
    choiceButtonsHtml, answerIcon, statusClass, wireEditForms, wireInlineAnswerToggles, wireComments,
  };
})();
