const DetailView = (() => {
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
    const refresh = () => render(root, ctx, { silent: true });

    if (!data.hasAnswered) {
      renderAnswerForm(root, ctx, data, refresh);
    } else {
      await renderSummary(root, ctx, data, refresh);
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

  function shareButtonHtml(label) {
    return `<button id="share-event" class="btn btn-primary" type="button">${label}</button>`;
  }

  function deleteButtonHtml() {
    return `<button id="delete-event" class="btn btn-danger" type="button">予定を削除する</button>`;
  }

  function wireCommonActions(root, ctx, { canShare, isCreator }) {
    if (canShare) {
      AppUtil.wireAsyncButton(root.querySelector('#share-event'), () => AppShare.shareEvent(ctx.eventId), {
        errorPrefix: '共有に失敗しました',
      });
    }
    if (isCreator) {
      AppUtil.wireAsyncButton(root.querySelector('#delete-event'), async () => {
        await AppApi.deleteEvent({ eventId: ctx.eventId, userId: ctx.identity.userId });
        AppRouter.navigate({ view: 'list' });
      }, {
        confirmMessage: 'この予定を削除します。回答データもすべて削除され、元に戻せません。よろしいですか？',
        errorPrefix: '削除に失敗しました',
      });
      AppUtil.wireAsyncButton(root.querySelector('#invite-editor'), () => AppShare.inviteEditor(ctx.eventId), {
        errorPrefix: '招待の送信に失敗しました',
      });
    }
  }

  function avatarHtml(displayName, pictureUrl) {
    const initial = AppUtil.escapeHtml(String(displayName || '?').slice(0, 1));
    const style = pictureUrl ? ` style="background-image:url('${pictureUrl.replace(/'/g, '%27')}')"` : '';
    return `<span class="avatar"${style}>${pictureUrl ? '' : initial}</span>`;
  }

  function summaryRowsHtml(event, summary, canEdit, myUserId, myAnswers, myComments) {
    myAnswers = myAnswers || {};
    myComments = myComments || {};
    return summary.map((row, rowIndex) => {
      const respondentsHtml = (answer) => {
        const list = row.respondents[answer] || [];
        if (!list.length) return '<p class="empty-respondents">なし</p>';
        const names = list.map((r) => r.displayName).join(',');
        return `<div class="respondent-list">
          ${list.map((r) => `<span class="respondent${r.userId === myUserId ? ' me' : ''}">${avatarHtml(r.displayName, r.pictureUrl)}<span>${AppUtil.escapeHtml(r.displayName)}${r.userId === myUserId ? '（自分）' : ''}</span></span>`).join('')}
          <button type="button" class="remind-btn" data-answer="${answer}" data-row="${rowIndex}" data-names="${AppUtil.escapeHtml(names)}">連絡する</button>
        </div>`;
      };
      const totalCount = row.counts['○'] + row.counts['△'] + row.counts['×'];
      return `
        <div class="summary-row ${OptionCard.statusClass(myAnswers[row.option.optionId])}" data-row="${rowIndex}" data-option-title="${AppUtil.escapeHtml(row.option.title || event.title)}" data-option-start="${AppUtil.escapeHtml(row.option.startAt || '')}" data-option-end="${AppUtil.escapeHtml(row.option.endAt || '')}" data-option-location="${AppUtil.escapeHtml(row.option.location || '')}">
          ${OptionCard.metaHtml(row.option, canEdit, myAnswers[row.option.optionId], myComments[row.option.optionId])}
          <div class="summary-counts">
            <span>${OptionCard.answerIcon('○')} ${row.counts['○']}</span>
            <span>${OptionCard.answerIcon('△')} ${row.counts['△']}</span>
            <span>${OptionCard.answerIcon('×')} ${row.counts['×']}</span>
            ${row.commentCount ? `<span class="comment-count">💬 ${row.commentCount}</span>` : ''}
          </div>
          <details>
            <summary>回答者を見る（${totalCount}人）</summary>
            <p class="respondent-label">○</p>${respondentsHtml('○')}
            <p class="respondent-label">△</p>${respondentsHtml('△')}
            <p class="respondent-label">×</p>${respondentsHtml('×')}
            <p class="respondent-label">💬 コメント</p>${OptionCard.commentThreadHtml(row.comments, myUserId)}
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
        btn.disabled = true;
        btn.textContent = '送信中...';
        try {
          await AppShare.remindRespondents({
            eventId, answerLabel: btn.dataset.answer, names,
            optionTitle: rowEl ? rowEl.dataset.optionTitle : eventTitle,
            optionStartAt: rowEl ? rowEl.dataset.optionStart : '',
            optionEndAt: rowEl ? rowEl.dataset.optionEnd : '',
            optionLocation: rowEl ? rowEl.dataset.optionLocation : '',
          });
          btn.textContent = '送信しました';
          setTimeout(() => { btn.textContent = '連絡する'; btn.disabled = false; }, 2000);
        } catch (err) {
          alert('連絡の送信に失敗しました: ' + err.message);
          btn.textContent = '連絡する';
          btn.disabled = false;
        }
      });
    });
  }

  function wireSummaryPreview(root, ctx, data) {
    const toggleBtn = root.querySelector('#toggle-summary');
    const previewBox = root.querySelector('#summary-preview');
    let previewLoaded = false;
    toggleBtn.addEventListener('click', async () => {
      if (!previewBox.hidden) {
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
          previewBox.innerHTML = summaryRowsHtml(data.event, summaryData.summary, false, ctx.identity.userId, data.myAnswers, data.myComments);
          wireRemindButtons(previewBox, data.event.title, ctx.eventId);
          const previewRefresh = () => render(root, ctx, { silent: true });
          OptionCard.wireInlineAnswerToggles(previewBox, ctx, previewRefresh);
          OptionCard.wireComments(previewBox, ctx, previewRefresh);
          previewLoaded = true;
        } catch (err) {
          previewBox.innerHTML = `<p class="error">${AppUtil.escapeHtml(err.message)}</p>`;
        }
      }
    });
  }

  function renderAnswerForm(root, ctx, data, refresh) {
    const canEdit = data.isCreator || data.isEditor;
    const rows = data.options.map((opt) => `
      <div class="answer-row ${OptionCard.statusClass(data.myAnswers[opt.optionId])}" data-option-id="${opt.optionId}">
        ${OptionCard.metaHtml(opt, canEdit)}
        <span class="answer-choices" data-option-id="${opt.optionId}">
          ${OptionCard.choiceButtonsHtml(opt.optionId, data.myAnswers)}
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
      ${canEdit ? `
        <section>
          <p class="event-meta">${data.isCreator ? '作成者' : '編集者'}として、回答前でも共有できます。</p>
          ${shareButtonHtml('LINEで共有する')}
          ${data.isCreator ? deleteButtonHtml() : ''}
        </section>` : ''}
    `;

    wireCommonActions(root, ctx, { canShare: canEdit, isCreator: data.isCreator });
    if (canEdit) OptionCard.wireEditForms(root, ctx, refresh);
    wireSummaryPreview(root, ctx, data);

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
      const row = container.closest('.answer-row');
      row.classList.remove('choice-ok', 'choice-maybe', 'choice-ng', 'status-none');
      row.classList.add(OptionCard.statusClass(value));

      savingOptionIds.add(optionId);
      const stopLoading = AppUtil.beginButtonLoading(btn);
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
          await refresh();
          return;
        }
      } catch (err) {
        alert('回答の保存に失敗しました: ' + err.message);
      } finally {
        savingOptionIds.delete(optionId);
        stopLoading();
      }
    });
  }

  async function renderSummary(root, ctx, data, refresh) {
    const summaryData = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });
    const canEdit = data.isCreator || data.isEditor;
    const rows = summaryRowsHtml(data.event, summaryData.summary, canEdit, ctx.identity.userId, data.myAnswers, data.myComments);

    root.innerHTML = `
      ${headerHtml(data.event)}
      <section>
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
              ${OptionCard.titleFieldHtml('new-option')}
            </div>
            ${OptionCard.rangeLocationFieldsHtml('new-option')}
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

    wireRemindButtons(root, data.event.title, ctx.eventId);
    OptionCard.wireInlineAnswerToggles(root, ctx, refresh);
    OptionCard.wireComments(root, ctx, refresh);
    wireCommonActions(root, ctx, { canShare: canEdit, isCreator: data.isCreator });

    if (canEdit) {
      OptionCard.wireEditForms(root, ctx, refresh);

      root.querySelector('#add-option-btn').addEventListener('click', async (e) => {
        const fields = OptionCard.readFields(root, 'new-option');
        const error = AppUtil.validateEventFields(fields);
        if (error) { alert(error); return; }

        const stopLoading = AppUtil.beginButtonLoading(e.target);
        try {
          await AppApi.addOptions({ eventId: ctx.eventId, userId: ctx.identity.userId, options: [fields] });
          await refresh();
        } catch (err) {
          alert('イベントの追加に失敗しました: ' + err.message);
          stopLoading();
        }
      });
    }
  }

  return { render };
})();
