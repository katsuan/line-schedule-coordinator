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

    const data = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });
    const refresh = () => render(root, ctx, { silent: true });

    renderSummary(root, ctx, data, refresh);
  }

  function shareButtonHtml(label) {
    return `<button id="share-event" class="btn btn-primary" type="button">${label}</button>`;
  }

  function deleteButtonHtml() {
    return `<button id="delete-event" class="btn btn-danger" type="button">予定を削除する</button>`;
  }

  function wireCommonActions(root, ctx, { canShare, isCreator }) {
    AppUtil.wireAsyncButton(root.querySelector('#share-app-btn'), () => AppShare.shareApp(), {
      errorPrefix: '共有に失敗しました',
    });
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
      const commentTextByUser = {};
      (row.comments || []).forEach((c) => {
        (commentTextByUser[c.userId] = commentTextByUser[c.userId] || []).push(c.text);
      });
      const respondentsHtml = (answer) => {
        const list = row.respondents[answer] || [];
        if (!list.length) return '<p class="empty-respondents">なし</p>';
        const rank = (r) => (r.userId === myUserId ? 2 : commentTextByUser[r.userId] ? 1 : 0);
        const sorted = [...list].sort((a, b) => rank(b) - rank(a));
        return `<div class="respondent-list">
          ${sorted.map((r) => {
            const comments = commentTextByUser[r.userId];
            return `<span class="respondent${r.userId === myUserId ? ' me' : ''}">
              <span class="avatar-wrap"${comments ? ' role="button" tabindex="0" data-comment-toggle="1"' : ''}>
                ${AppUtil.avatarHtml(r.displayName, r.pictureUrl, answer)}
                ${comments ? '<span class="avatar-comment-badge">💬</span>' : ''}
              </span>
              <span>${AppUtil.escapeHtml(r.displayName)}${r.userId === myUserId ? '（自分）' : ''}</span>
              ${comments ? `<span class="respondent-comment-popup" hidden>${comments.map((t) => AppUtil.escapeHtml(t)).join('<br>')}</span>` : ''}
            </span>`;
          }).join('')}
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
      const cardBody = `
          ${OptionCard.metaHtml(row.option, canEdit, enrichedComments, myUserId)}
          <div class="summary-answer-row">
            ${OptionCard.answerButtonsHtml(row.option.optionId, myAnswers[row.option.optionId], row.counts)}
            <div class="summary-answer-side">
              <span class="summary-comment-row">
                ${row.commentCount ? `<span class="comment-count">💬 ${row.commentCount}</span>` : ''}
                ${OptionComments.commentAddToggleHtml(row.option.optionId)}
              </span>
              ${canEdit && totalCount ? `<button type="button" class="btn remind-btn" data-row="${rowIndex}">LINE送信</button>` : ''}
            </div>
          </div>
          <details>
            <summary>回答者を見る（${totalCount}人）</summary>
            ${groupBlock('○')}${groupBlock('△')}${groupBlock('×')}
          </details>`;
      const isPast = isOptionPast(row.option);
      if (isPast) {
        return `
        <details class="summary-row-collapsed">
          <summary>${AppUtil.titleIconHtml(row.option.title || '(タイトルなし)')}（終了）</summary>
          <div class="summary-row ${OptionCard.statusClass(myAnswers[row.option.optionId])}" data-row="${rowIndex}" data-option-id="${AppUtil.escapeHtml(row.option.optionId)}" data-option-title="${AppUtil.escapeHtml(row.option.title || event.title)}" data-option-start="${AppUtil.escapeHtml(row.option.startAt || '')}" data-option-end="${AppUtil.escapeHtml(row.option.endAt || '')}" data-option-location="${AppUtil.escapeHtml(row.option.location || '')}" data-groups="${AppUtil.escapeHtml(JSON.stringify(groups))}">
            ${cardBody}
          </div>
        </details>`;
      }
      return `
        <div class="summary-row ${OptionCard.statusClass(myAnswers[row.option.optionId])}" data-row="${rowIndex}" data-option-id="${AppUtil.escapeHtml(row.option.optionId)}" data-option-title="${AppUtil.escapeHtml(row.option.title || event.title)}" data-option-start="${AppUtil.escapeHtml(row.option.startAt || '')}" data-option-end="${AppUtil.escapeHtml(row.option.endAt || '')}" data-option-location="${AppUtil.escapeHtml(row.option.location || '')}" data-groups="${AppUtil.escapeHtml(JSON.stringify(groups))}">
          ${cardBody}
        </div>`;
    }).join('');
  }

  function isOptionPast(opt) {
    const end = opt.endAt || opt.startAt;
    return !!end && new Date(end) < new Date();
  }

  function wireRespondentComments(root) {
    root.querySelectorAll('.avatar-wrap[data-comment-toggle]').forEach((wrap) => {
      wrap.addEventListener('click', () => {
        const popup = wrap.parentElement.querySelector('.respondent-comment-popup');
        if (popup) popup.hidden = !popup.hidden;
      });
    });
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
            optionId: rowEl ? rowEl.dataset.optionId : '',
            optionTitle: rowEl ? rowEl.dataset.optionTitle : eventTitle,
            optionStartAt: rowEl ? rowEl.dataset.optionStart : '',
            optionEndAt: rowEl ? rowEl.dataset.optionEnd : '',
            optionLocation: rowEl ? rowEl.dataset.optionLocation : '',
          });
          btn.textContent = '送信しました';
          setTimeout(() => { btn.textContent = 'LINE送信'; btn.disabled = false; }, 2000);
        } catch (err) {
          alert('連絡の送信に失敗しました: ' + err.message);
          btn.textContent = 'LINE送信';
          btn.disabled = false;
        }
      });
    });
  }

  function renderSummary(root, ctx, data, refresh) {
    const canEdit = data.isCreator || data.isEditor;
    const rows = summaryRowsHtml(data.event, data.summary, canEdit, ctx.identity.userId, data.myAnswers);

    root.innerHTML = `
      ${DetailHeader.headerHtml(data.event, data, canEdit, ctx)}
      <section>
        <p class="event-meta">イベント数：${data.options.length}件 / 回答者数：${data.totalRespondents}人</p>
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
        ${data.isCreator ? `<section>${deleteButtonHtml()}</section>` : ''}
        <div class="fixed-share-bar-spacer"></div>
        <div class="fixed-share-bar">
          ${shareButtonHtml('イベント一覧をLINEで送信')}
        </div>` : ''}
    `;

    wireRemindButtons(root, data.event.title, ctx.eventId);
    wireRespondentComments(root);
    DetailHeader.wireEventEdit(root, ctx, refresh);
    DetailHeader.wireEditAccessSection(root, ctx, data);
    OptionCard.wireAnswerButtons(root, ctx, refresh);
    OptionComments.wireComments(root, ctx, refresh);
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
