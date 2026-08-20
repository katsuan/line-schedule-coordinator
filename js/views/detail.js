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

    await renderSummary(root, ctx, data, refresh);
  }

  function headerHtml(event, data) {
    const statusPill = data.isCreator
      ? '<span class="status-pill status-pill-creator">作成者</span>'
      : data.isEditor
        ? '<span class="status-pill status-pill-editor">編集者</span>'
        : '';
    return `
      <div class="page-header">
        <div class="page-header-top-row">
          <a class="btn-back" href="?view=list">← 一覧へ</a>
          <button type="button" id="refresh-event" class="btn-refresh" aria-label="最新の状態に更新">🔄</button>
        </div>
        <div class="page-header-title-row">
          <h1>${AppUtil.titleIconHtml(event.title)}</h1>
          ${statusPill}
        </div>
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

  function summaryRowsHtml(event, summary, canEdit, myUserId, myAnswers) {
    myAnswers = myAnswers || {};
    return summary.map((row, rowIndex) => {
      const answerByUser = {};
      ['○', '△', '×'].forEach((a) => (row.respondents[a] || []).forEach((r) => { answerByUser[r.userId] = a; }));
      const enrichedComments = (row.comments || []).map((c) => ({ ...c, answer: answerByUser[c.userId] }));
      const respondentsHtml = (answer) => {
        const list = row.respondents[answer] || [];
        if (!list.length) return '<p class="empty-respondents">なし</p>';
        return `<div class="respondent-list">
          ${list.map((r) => `<span class="respondent${r.userId === myUserId ? ' me' : ''}">${AppUtil.avatarHtml(r.displayName, r.pictureUrl, answer)}<span>${AppUtil.escapeHtml(r.displayName)}${r.userId === myUserId ? '（自分）' : ''}</span></span>`).join('')}
        </div>`;
      };
      const groupBlock = (answer) => `
        <div class="respondent-group ${OptionCard.statusClass(answer)}">
          <p class="respondent-label">${answer}</p>
          ${respondentsHtml(answer)}
        </div>`;
      const groups = {};
      ['○', '△', '×'].forEach((a) => {
        const names = (row.respondents[a] || []).map((r) => r.displayName);
        if (names.length) groups[a] = names;
      });
      const totalCount = row.counts['○'] + row.counts['△'] + row.counts['×'];
      return `
        <div class="summary-row ${OptionCard.statusClass(myAnswers[row.option.optionId])}" data-row="${rowIndex}" data-option-title="${AppUtil.escapeHtml(row.option.title || event.title)}" data-option-start="${AppUtil.escapeHtml(row.option.startAt || '')}" data-option-end="${AppUtil.escapeHtml(row.option.endAt || '')}" data-option-location="${AppUtil.escapeHtml(row.option.location || '')}" data-groups="${AppUtil.escapeHtml(JSON.stringify(groups))}">
          ${OptionCard.metaHtml(row.option, canEdit, enrichedComments, myUserId)}
          <div class="summary-answer-row">
            ${OptionCard.answerButtonsHtml(row.option.optionId, myAnswers[row.option.optionId], row.counts)}
            <div class="summary-answer-side">
              ${row.commentCount ? `<span class="comment-count">💬 ${row.commentCount}</span>` : ''}
              ${OptionCard.commentAddToggleHtml(row.option.optionId)}
              ${totalCount ? `<button type="button" class="btn remind-btn" data-row="${rowIndex}">連絡する</button>` : ''}
            </div>
          </div>
          <details>
            <summary>回答者を見る（${totalCount}人）</summary>
            ${groupBlock('○')}${groupBlock('△')}${groupBlock('×')}
          </details>
        </div>`;
    }).join('');
  }

  function wireRemindButtons(root, eventTitle, eventId) {
    root.querySelectorAll('.remind-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rowEl = btn.closest('.summary-row');
        const groups = rowEl && rowEl.dataset.groups ? JSON.parse(rowEl.dataset.groups) : {};
        if (!Object.keys(groups).length) return;

        btn.disabled = true;
        btn.textContent = '送信中...';
        try {
          await AppShare.remindRespondents({
            eventId, groups,
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

  async function renderSummary(root, ctx, data, refresh) {
    const summaryData = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });
    const canEdit = data.isCreator || data.isEditor;
    const rows = summaryRowsHtml(data.event, summaryData.summary, canEdit, ctx.identity.userId, data.myAnswers);

    root.innerHTML = `
      ${headerHtml(data.event, data)}
      <p class="event-meta">タップすると自動的に保存されます。</p>
      <section>
        <p class="event-meta">イベント数：${data.options.length}件 / 回答者数：${summaryData.totalRespondents}人</p>
        <div class="summary-list">${rows}</div>
      </section>
      ${canEdit ? `
        <section>
          <details>
            <summary>＋ イベントを追加</summary>
            <p class="event-meta">追加すると、既に回答した人も新しいイベントへの回答が必要になります。</p>
            <div class="option-card">
              <div class="option-card-head">
                <span class="option-card-icon">🗓️</span>
                ${OptionCard.titleFieldHtml('new-option')}
              </div>
              ${OptionCard.rangeLocationFieldsHtml('new-option')}
              <button id="add-option-btn" class="btn btn-primary" type="button">＋ このカードの内容でイベントを追加する</button>
            </div>
          </details>
        </section>
        <section>
          ${shareButtonHtml('LINEで共有する')}
          ${data.isCreator ? `
            <button id="invite-editor" class="btn" type="button">編集者を招待する</button>
            ${deleteButtonHtml()}` : ''}
        </section>` : ''}
    `;

    wireRemindButtons(root, data.event.title, ctx.eventId);
    OptionCard.wireAnswerButtons(root, ctx, refresh);
    OptionCard.wireComments(root, ctx, refresh);
    wireCommonActions(root, ctx, { canShare: canEdit, isCreator: data.isCreator });

    root.querySelector('#refresh-event').addEventListener('click', async (e) => {
      const stopLoading = AppUtil.beginButtonLoading(e.currentTarget);
      try {
        await refresh();
      } finally {
        stopLoading();
      }
    });

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
