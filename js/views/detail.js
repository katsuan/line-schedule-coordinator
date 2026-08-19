const DetailView = (() => {
  const ANSWERS = ['○', '△', '×'];

  async function render(root, ctx, opts) {
    if (!opts || !opts.silent) {
      root.innerHTML = AppUtil.loadingHtml();
    }

    if (ctx.claimEditor) {
      try {
        await AppApi.claimEditor({
          eventId: ctx.eventId,
          userId: ctx.identity.userId,
          displayName: ctx.identity.displayName,
          pictureUrl: ctx.identity.pictureUrl,
        });
      } catch (err) {
        console.error('編集者登録に失敗しました', err);
      }
    }

    const data = await AppApi.getEvent({ eventId: ctx.eventId, userId: ctx.identity.userId });

    if (!data.hasAnswered) {
      renderAnswerForm(root, ctx, data, false);
    } else {
      await renderSummary(root, ctx, data);
    }
  }

  function headerHtml(event) {
    return `
      <div class="page-header">
        <a class="btn-back" href="?view=list">← 一覧へ</a>
        <h1>${AppUtil.titleIconHtml(event.title)}</h1>
        ${event.description ? `<p class="event-description">${AppUtil.escapeHtml(event.description)}</p>` : ''}
        ${event.deadline ? `<p class="event-meta">回答期限: ${AppUtil.formatDateTimeLocal(event.deadline)}</p>` : ''}
      </div>`;
  }

  function optionMetaHtml(opt, canEdit) {
    return `
      <div class="option-meta" data-option-id="${opt.optionId}">
        <div class="option-meta-view">
          <div class="option-meta-title-row">
            <div class="option-meta-title">${AppUtil.titleIconHtml(opt.title || '(タイトルなし)')}</div>
            ${canEdit ? `<button type="button" class="edit-option-btn" aria-label="編集">✏️</button>` : ''}
          </div>
          <div class="option-meta-date">${AppUtil.formatDateRange(opt.startAt, opt.endAt)}</div>
          ${opt.location ? `<div class="option-meta-location">📍 ${AppUtil.escapeHtml(opt.location)}</div>` : ''}
          ${AppUtil.calendarLinkHtml(opt.title, '', opt.startAt, opt.endAt, opt.location)}
        </div>
        ${canEdit ? `
        <div class="option-edit-form" hidden>
          <input type="text" class="edit-title" value="${AppUtil.escapeHtml(opt.title || '')}" placeholder="イベント名">
          <div class="option-range">
            <label class="option-sublabel">開始<input type="datetime-local" step="900" class="edit-start" value="${AppUtil.toDatetimeLocalValue(opt.startAt)}"></label>
            <label class="option-sublabel">完了<input type="datetime-local" step="900" class="edit-end" value="${AppUtil.toDatetimeLocalValue(opt.endAt)}"></label>
          </div>
          <input type="text" class="edit-location option-location" value="${AppUtil.escapeHtml(opt.location || '')}" placeholder="📍 場所（任意）">
          <div class="option-edit-actions">
            <button type="button" class="btn save-option-btn">保存</button>
            <button type="button" class="btn cancel-option-btn">キャンセル</button>
          </div>
        </div>` : ''}
      </div>`;
  }

  function wireOptionEditForms(root, ctx) {
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
        const title = meta.querySelector('.edit-title').value.trim();
        const startAt = meta.querySelector('.edit-start').value;
        const endAt = meta.querySelector('.edit-end').value;
        const location = meta.querySelector('.edit-location').value.trim();
        if (!title || !startAt || !endAt) {
          alert('タイトル・開始・完了を入力してください');
          return;
        }
        if (new Date(endAt) <= new Date(startAt)) {
          alert('完了は開始より後の日時にしてください');
          return;
        }
        e.target.disabled = true;
        try {
          await AppApi.updateOption({
            eventId: ctx.eventId,
            userId: ctx.identity.userId,
            optionId: meta.dataset.optionId,
            title, startAt, endAt, location,
          });
          await render(root, ctx, { silent: true });
        } catch (err) {
          alert('更新に失敗しました: ' + err.message);
          e.target.disabled = false;
        }
      });
    });
  }

  function shareButtonHtml(label) {
    return `<button id="share-event" class="btn btn-primary" type="button">${label}</button>`;
  }

  function wireShareButton(root, ctx) {
    const btn = root.querySelector('#share-event');
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        await AppShare.shareEvent(ctx.eventId);
      } catch (err) {
        alert('共有に失敗しました: ' + err.message);
      } finally {
        e.target.disabled = false;
      }
    });
  }

  function deleteButtonHtml() {
    return `<button id="delete-event" class="btn btn-danger" type="button">予定を削除する</button>`;
  }

  function wireDeleteButton(root, ctx) {
    const btn = root.querySelector('#delete-event');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!confirm('この予定を削除します。回答データもすべて削除され、元に戻せません。よろしいですか？')) return;
      btn.disabled = true;
      try {
        await AppApi.deleteEvent({ eventId: ctx.eventId, userId: ctx.identity.userId });
        AppRouter.navigate({ view: 'list' });
      } catch (err) {
        alert('削除に失敗しました: ' + err.message);
        btn.disabled = false;
      }
    });
  }

  function wireInviteEditorButton(root, ctx) {
    const btn = root.querySelector('#invite-editor');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        await AppShare.inviteEditor(ctx.eventId);
      } catch (err) {
        alert('招待の送信に失敗しました: ' + err.message);
      } finally {
        btn.disabled = false;
      }
    });
  }

  function answerIconHtml(answer) {
    const cls = ANSWER_CLASS[answer] || 'dot-none';
    return `<span class="answer-icon ${cls}">${answer || '-'}</span>`;
  }

  function avatarHtml(displayName, pictureUrl) {
    const initial = AppUtil.escapeHtml(String(displayName || '?').slice(0, 1));
    const style = pictureUrl ? ` style="background-image:url('${pictureUrl.replace(/'/g, '%27')}')"` : '';
    return `<span class="avatar"${style}>${pictureUrl ? '' : initial}</span>`;
  }

  function summaryRowsHtml(event, summary, canEdit, myUserId) {
    return summary.map((row, rowIndex) => {
      const respondentsHtml = (answer) => {
        const list = row.respondents[answer] || [];
        if (!list.length) return '<p class="empty-respondents">なし</p>';
        const names = list.map((r) => r.displayName).join(',');
        return `<div class="respondent-list">
          ${list.map((r) => `<span class="respondent${r.userId === myUserId ? ' me' : ''}">${avatarHtml(r.displayName, r.pictureUrl)}<span>${AppUtil.escapeHtml(r.displayName)}${r.userId === myUserId ? '（自分）' : ''}</span></span>`).join('')}
          <button type="button" class="remind-btn" data-answer="${answer}" data-row="${rowIndex}" data-names="${AppUtil.escapeHtml(names)}">催促する</button>
        </div>`;
      };
      return `
        <div class="summary-row" data-row="${rowIndex}" data-option-title="${AppUtil.escapeHtml(row.option.title || event.title)}" data-option-start="${AppUtil.escapeHtml(row.option.startAt || '')}" data-option-end="${AppUtil.escapeHtml(row.option.endAt || '')}" data-option-location="${AppUtil.escapeHtml(row.option.location || '')}">
          ${optionMetaHtml(row.option, canEdit)}
          <div class="summary-counts">
            <span>${answerIconHtml('○')} ${row.counts['○']}</span>
            <span>${answerIconHtml('△')} ${row.counts['△']}</span>
            <span>${answerIconHtml('×')} ${row.counts['×']}</span>
          </div>
          <details>
            <summary>回答者を見る</summary>
            <p class="respondent-label">○</p>${respondentsHtml('○')}
            <p class="respondent-label">△</p>${respondentsHtml('△')}
            <p class="respondent-label">×</p>${respondentsHtml('×')}
          </details>
        </div>`;
    }).join('');
  }

  function wireRemindButtons(root, eventTitle, eventId) {
    root.querySelectorAll('.remind-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const names = btn.dataset.names.split(',').filter(Boolean);
        if (!names.length) return;
        const rowEl = btn.closest('.summary-row');
        const optionTitle = rowEl ? rowEl.dataset.optionTitle : eventTitle;
        const optionStartAt = rowEl ? rowEl.dataset.optionStart : '';
        const optionEndAt = rowEl ? rowEl.dataset.optionEnd : '';
        const optionLocation = rowEl ? rowEl.dataset.optionLocation : '';
        btn.disabled = true;
        btn.textContent = '送信中...';
        try {
          await AppShare.remindRespondents({
            eventId, answerLabel: btn.dataset.answer, names,
            optionTitle, optionStartAt, optionEndAt, optionLocation,
          });
          btn.textContent = '送信しました';
          setTimeout(() => { btn.textContent = '催促する'; btn.disabled = false; }, 2000);
        } catch (err) {
          alert('催促の送信に失敗しました: ' + err.message);
          btn.textContent = '催促する';
          btn.disabled = false;
        }
      });
    });
  }

  const ANSWER_CLASS = { '○': 'choice-ok', '△': 'choice-maybe', '×': 'choice-ng' };

  function choiceButtonsHtml(optionId, myAnswers) {
    return ANSWERS.map((a) => `
      <button type="button" class="choice-btn ${ANSWER_CLASS[a]} ${myAnswers[optionId] === a ? 'selected' : ''}" data-value="${a}">${a}</button>`).join('');
  }

  function renderAnswerForm(root, ctx, data, isEditing) {
    const canEdit = data.isCreator || data.isEditor;
    const rows = data.options.map((opt) => `
      <div class="answer-row" data-option-id="${opt.optionId}">
        ${optionMetaHtml(opt, canEdit)}
        <span class="answer-choices" data-option-id="${opt.optionId}">
          ${choiceButtonsHtml(opt.optionId, data.myAnswers)}
        </span>
      </div>`).join('');

    root.innerHTML = `
      ${headerHtml(data.event)}
      <p class="event-meta">タップすると自動的に保存されます。</p>
      <div id="answer-rows">${rows}</div>
      <section>
        <button id="toggle-summary" class="btn" type="button">現在の回答状況を見る</button>
        <div id="summary-preview" class="summary-list" hidden></div>
      </section>
      ${data.isCreator || data.isEditor ? `
        <section>
          <p class="event-meta">${data.isCreator ? '作成者' : '編集者'}として、回答前でも共有できます。</p>
          ${shareButtonHtml('LINEで共有する')}
          ${data.isCreator ? deleteButtonHtml() : ''}
        </section>` : ''}
    `;

    if (canEdit) wireShareButton(root, ctx);
    if (data.isCreator) wireDeleteButton(root, ctx);
    if (canEdit) wireOptionEditForms(root, ctx);

    const toggleBtn = root.querySelector('#toggle-summary');
    const previewBox = root.querySelector('#summary-preview');
    let previewLoaded = false;
    toggleBtn.addEventListener('click', async () => {
      const nowHidden = !previewBox.hidden;
      if (nowHidden) {
        previewBox.hidden = true;
        toggleBtn.textContent = '現在の回答状況を見る';
        return;
      }
      toggleBtn.textContent = '閉じる';
      previewBox.hidden = false;
      if (!previewLoaded) {
        previewBox.innerHTML = AppUtil.loadingHtml();
        try {
          const summaryData = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });
          previewBox.innerHTML = summaryRowsHtml(data.event, summaryData.summary, false, ctx.identity.userId);
          wireRemindButtons(previewBox, data.event.title, ctx.eventId);
          previewLoaded = true;
        } catch (err) {
          previewBox.innerHTML = `<p class="error">${AppUtil.escapeHtml(err.message)}</p>`;
        }
      }
    });

    const answeredMap = { ...data.myAnswers };
    const savingOptionIds = new Set();

    root.querySelector('#answer-rows').addEventListener('click', async (e) => {
      const btn = e.target.closest('.choice-btn');
      if (!btn) return;
      const container = btn.closest('.answer-choices');
      const optionId = container.dataset.optionId;
      if (savingOptionIds.has(optionId)) return;
      const value = btn.dataset.value;

      container.querySelectorAll('.choice-btn').forEach((b) => b.classList.toggle('selected', b === btn));

      savingOptionIds.add(optionId);
      try {
        await AppApi.submitAnswer({
          eventId: ctx.eventId,
          userId: ctx.identity.userId,
          displayName: ctx.identity.displayName,
          pictureUrl: ctx.identity.pictureUrl,
          answers: [{ optionId, answer: value }],
        });
        answeredMap[optionId] = value;
        if (data.options.every((opt) => answeredMap[opt.optionId] !== undefined)) {
          data.myAnswers = answeredMap;
          await render(root, ctx, { silent: true });
          return;
        }
      } catch (err) {
        alert('回答の保存に失敗しました: ' + err.message);
      } finally {
        savingOptionIds.delete(optionId);
      }
    });
  }

  async function renderSummary(root, ctx, data) {
    const summaryData = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });

    const canEdit = data.isCreator || data.isEditor;

    const myAnswerRows = data.options.map((opt) => `
      <div class="answer-row readonly">
        ${optionMetaHtml(opt, canEdit)}
        ${answerIconHtml(data.myAnswers[opt.optionId])}
      </div>`).join('');

    const rows = summaryRowsHtml(data.event, summaryData.summary, canEdit, ctx.identity.userId);

    root.innerHTML = `
      ${headerHtml(data.event)}
      <section>
        <h2>自分の回答</h2>
        <div class="my-answers">${myAnswerRows}</div>
        <button id="edit-answer" class="btn">回答を変更する</button>
      </section>
      <section>
        <h2>回答集計</h2>
        <p class="event-meta">回答者数: ${summaryData.totalRespondents}人</p>
        <div class="summary-list">${rows}</div>
      </section>
      ${canEdit ? `
        <section>
          <h2>イベントを追加</h2>
          <p class="event-meta">追加すると、既に回答した人も新しいイベントへの回答が必要になります。</p>
          <div class="option-card">
            <div class="option-card-head">
              <span class="option-card-icon">📅</span>
              <input type="text" id="new-option-title" placeholder="イベント名（例: BBQ）">
            </div>
            <div class="option-range">
              <label class="option-sublabel">開始<input type="datetime-local" step="900" id="new-option-start"></label>
              <label class="option-sublabel">完了<input type="datetime-local" step="900" id="new-option-end"></label>
            </div>
            <input type="text" id="new-option-location" class="option-location" placeholder="📍 場所（任意）">
            <button id="add-option-btn" class="btn btn-primary" type="button">＋ このカードの内容でイベントを追加する</button>
          </div>
        </section>
        <section>
          ${shareButtonHtml('LINEで共有する')}
          ${data.isCreator ? `
            <button id="invite-editor" class="btn" type="button">編集者を招待する</button>
            ${deleteButtonHtml()}` : ''}
        </section>` : ''}
    `;

    root.querySelector('#edit-answer').addEventListener('click', () => {
      renderAnswerForm(root, ctx, data, true);
    });

    wireRemindButtons(root, data.event.title, ctx.eventId);

    if (canEdit) {
      wireShareButton(root, ctx);

      root.querySelector('#add-option-btn').addEventListener('click', async (e) => {
        const title = root.querySelector('#new-option-title').value.trim();
        const startAt = root.querySelector('#new-option-start').value;
        const endAt = root.querySelector('#new-option-end').value;
        const location = root.querySelector('#new-option-location').value.trim();
        if (!title || !startAt || !endAt) {
          alert('タイトル・開始・完了を入力してください');
          return;
        }
        if (new Date(endAt) <= new Date(startAt)) {
          alert('完了は開始より後の日時にしてください');
          return;
        }
        e.target.disabled = true;
        try {
          await AppApi.addOptions({ eventId: ctx.eventId, userId: ctx.identity.userId, options: [{ title, startAt, endAt, location }] });
          await render(root, ctx, { silent: true });
        } catch (err) {
          alert('イベントの追加に失敗しました: ' + err.message);
          e.target.disabled = false;
        }
      });
    }

    if (data.isCreator) {
      wireDeleteButton(root, ctx);
      wireInviteEditorButton(root, ctx);
    }
  }

  return { render };
})();
