/**
 * イベント1つ分の部品（OptionCard）：題と日時の表示・変える欄・○△× のボタン（押すとすぐ保存）。
 * 呼ばれ方：views/detail.js（予定の画面）と views/calendar.js（その日のシート）から。コメントは optionComments.js。
 */
const OptionCard = (() => {
  const ANSWERS = ['○', '△', '×'];
  const ANSWER_CLASS = { '○': 'choice-ok', '△': 'choice-maybe', '×': 'choice-ng' };

  // ○△× のボタン（自分の答えに印）
  function choiceButtonsHtml(optionId, myAnswers) {
    return ANSWERS.map((a) => `
      <button type="button" class="choice-btn ${ANSWER_CLASS[a]} ${myAnswers[optionId] === a ? 'selected' : ''}" data-value="${a}">${a}</button>`).join('');
  }

  // 答えに合う色のクラス（答えがなければ status-none）
  function statusClass(answer) {
    return ANSWER_CLASS[answer] || 'status-none';
  }

  // ○△× のボタンと、それぞれの人数
  function answerButtonsHtml(optionId, myAnswer, counts) {
    return `
      <div class="answer-buttons" data-option-id="${AppUtil.escapeHtml(optionId)}">
        ${ANSWERS.map((a) => `
          <span class="choice-count-wrap">
            <button type="button" class="choice-btn ${ANSWER_CLASS[a]} ${myAnswer === a ? 'selected' : ''}" data-value="${a}">${a}</button>
            ${counts ? `<span class="choice-count">${counts[a] || 0}</span>` : ''}
          </span>`).join('')}
      </div>`;
  }

  // イベント名の入力欄
  function titleFieldHtml(prefix, values, placeholder) {
    values = values || {};
    return `<input type="text" class="ls-input option-title-input ${prefix}-title" value="${AppUtil.escapeHtml(values.title || '')}" placeholder="${AppUtil.escapeHtml(placeholder || 'イベント名')}">`;
  }

  // 開始・完了・場所の入力欄
  function rangeLocationFieldsHtml(prefix, values) {
    values = values || {};
    return `
      <div class="ls-grid-2 option-range">
        <label class="ls-field"><span class="ls-label">開始</span><input type="datetime-local" class="ls-input ${prefix}-start" value="${AppUtil.toDatetimeLocalValue(values.startAt)}"></label>
        <label class="ls-field"><span class="ls-label">完了</span><input type="datetime-local" class="ls-input ${prefix}-end" value="${AppUtil.toDatetimeLocalValue(values.endAt)}"></label>
      </div>
      <input type="text" class="ls-input ${prefix}-location" value="${AppUtil.escapeHtml(values.location || '')}" placeholder="📍 場所・持ち物など（任意）">`;
  }

  // イベント名・開始・完了・場所の入力欄をまとめて
  function fieldsHtml(prefix, values) {
    return titleFieldHtml(prefix, values) + rangeLocationFieldsHtml(prefix, values);
  }

  // 入力欄から、イベント名・開始・完了・場所を読む
  function readFields(container, prefix) {
    return {
      title: container.querySelector(`.${prefix}-title`).value.trim(),
      startAt: container.querySelector(`.${prefix}-start`).value,
      endAt: container.querySelector(`.${prefix}-end`).value,
      location: container.querySelector(`.${prefix}-location`).value.trim(),
    };
  }

  // イベントの題・日時・場所の表示と、変える欄（変えられる人だけ）
  function metaHtml(opt, canEdit, comments, myUserId) {
    return `
      <div class="option-meta" data-option-id="${AppUtil.escapeHtml(opt.optionId)}">
        <div class="option-meta-view">
          <div class="option-meta-title-row">
            <div class="option-meta-title">${AppUtil.titleIconHtml(opt.title || '(タイトルなし)')} ${AppUtil.relativeDayPillHtml(opt.startAt)}</div>
            ${canEdit ? `<button type="button" class="edit-option-btn" aria-label="編集">✏️</button>` : ''}
          </div>
          <div class="option-meta-info-row option-meta-info-row-split">
            <span class="option-meta-date">${AppUtil.formatDateRange(opt.startAt, opt.endAt)}</span>
            ${AppUtil.calendarLinkHtml(opt.title, '', opt.startAt, opt.endAt, opt.location)}
          </div>
          ${opt.location ? `<div class="option-meta-info-row"><span class="option-meta-location">📍 ${AppUtil.escapeHtml(opt.location)}</span></div>` : ''}
          ${OptionComments.commentsListHtml(comments, myUserId)}
          ${OptionComments.commentAddFormHtml(opt.optionId)}
        </div>
        ${canEdit ? `
        <div class="option-edit-form" hidden>
          ${fieldsHtml('edit', opt)}
          <div class="option-edit-actions">
            <button type="button" class="ls-button is-primary save-option-btn">保存</button>
            <button type="button" class="ls-button cancel-option-btn">やめる</button>
          </div>
        </div>` : ''}
      </div>`;
  }

  // イベントを変える・消すのボタンをつなぐ（答えた人がいれば、変えたことを知らせるか聞く）
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
        if (error) { AppUtil.notify(error); return; }

        const optionId = meta.dataset.optionId;
        await AppUtil.saveWithButton(e.currentTarget, async () => {
          const summaryBefore = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });
          const rowBefore = summaryBefore.summary.find((r) => r.option.optionId === optionId);
          const respondentNames = rowBefore
            ? Array.from(new Set(['○', '△', '×'].flatMap((a) => (rowBefore.respondents[a] || []).map((r) => r.displayName))))
            : [];

          await AppApi.updateOption({ eventId: ctx.eventId, userId: ctx.identity.userId, optionId, ...fields });

          if (respondentNames.length && (await AppUtil.ask({ title: '変更を回答者に知らせますか？', text: `この予定には、もう${respondentNames.length}件の回答があります。`, ok: '知らせる', cancel: '知らせない' }))) {
            try {
              await AppShare.notifyChange({
                eventId: ctx.eventId, optionTitle: fields.title, optionStartAt: fields.startAt,
                optionEndAt: fields.endAt, optionLocation: fields.location, names: respondentNames,
              });
            } catch (notifyErr) {
              AppUtil.notifyError('お知らせを送れませんでした', notifyErr);
            }
          }

          await refresh();
        }, '変えられませんでした');
      });
    });
  }

  /**
   * ○△× を押したとき：すぐ印を付けて保存する。保存できなければ、押す前の印に戻して知らせる。
   * save は保存の Promise を返す関数。保存できたら true
   */
  async function saveChoice(container, btn, save) {
    const buttons = Array.from(container.querySelectorAll('.choice-btn'));
    const before = buttons.find((b) => b.classList.contains('selected')) || null;
    buttons.forEach((b) => {
      b.classList.toggle('selected', b === btn);
      b.disabled = true;
    });
    const stopLoading = AppUtil.beginButtonLoading(btn);
    try {
      await save();
      return true;
    } catch (err) {
      buttons.forEach((b) => b.classList.toggle('selected', b === before));
      AppUtil.notifyError('回答を保存できませんでした', err);
      return false;
    } finally {
      stopLoading();
      buttons.forEach((b) => { b.disabled = false; });
    }
  }

  /** 1つの候補の答えを送る（画面の本人の名前・アイコンもいっしょに） */
  function submitOne(ctx, eventId, optionId, answer) {
    return AppApi.submitAnswer({
      eventId,
      userId: ctx.identity.userId,
      displayName: ctx.identity.displayName,
      pictureUrl: ctx.identity.pictureUrl,
      answers: [{ optionId, answer }],
    });
  }

  // ○△× のボタンをつなぐ（押すとすぐ保存して描きなおす）
  function wireAnswerButtons(root, ctx, refresh) {
    root.querySelectorAll('.answer-buttons').forEach((wrap) => {
      wrap.addEventListener('click', async (e) => {
        const btn = e.target.closest('.choice-btn');
        if (!btn || btn.disabled) return;
        const saved = await saveChoice(wrap, btn, () => submitOne(ctx, ctx.eventId, wrap.dataset.optionId, btn.dataset.value));
        if (saved) await refresh();
      });
    });
  }

  return {
    metaHtml, titleFieldHtml, rangeLocationFieldsHtml, readFields,
    choiceButtonsHtml, answerButtonsHtml, statusClass, wireEditForms, wireAnswerButtons, saveChoice, submitOne,
  };
})();
