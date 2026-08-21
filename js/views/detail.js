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

  function headerHtml(event, data, canEdit, ctx) {
    const statusPill = data.isCreator
      ? '<span class="status-pill status-pill-creator">作成者</span>'
      : data.isEditor
        ? '<span class="status-pill status-pill-editor">編集者</span>'
        : '';
    const editors = data.editors || [];
    const showRequestChip = !canEdit && !data.isCreator && data.creator;
    const showApproveChip = ctx.approveEditor && data.isCreator;
    return `
      <div class="page-header">
        <div class="page-header-top-row">
          <a class="btn-back" href="?view=list">← 一覧へ</a>
          <div class="page-header-top-actions">
            <button type="button" id="share-app-btn" class="btn-refresh" aria-label="このアプリを紹介する">📣</button>
            <button type="button" id="refresh-event" class="btn-refresh" aria-label="最新の状態に更新">🔄</button>
          </div>
        </div>
        <div id="event-header-view" class="event-title-banner">
          <div class="page-header-title-row">
            <h1>${AppUtil.titleIconHtml(event.title)}</h1>
            ${statusPill}
            ${editors.length ? `<button type="button" id="toggle-editors" class="editors-count-btn">編集者${editors.length}人</button>` : ''}
            ${showRequestChip ? `<button type="button" id="request-edit-btn" class="editors-count-btn">🔑 ${AppUtil.escapeHtml(data.creator.displayName)}さんに依頼</button>` : ''}
            ${showApproveChip ? `<button type="button" id="approve-edit-btn" class="editors-count-btn edit-request-chip-pending">🔑 ${AppUtil.escapeHtml(ctx.requesterName || '依頼者')}さんを承認</button>` : ''}
            ${data.isCreator ? `<button type="button" id="invite-editor" class="edit-option-btn" aria-label="編集者を招待する">👥</button>` : ''}
            ${canEdit ? `<button type="button" id="edit-event-btn" class="edit-option-btn" aria-label="予定を編集">✏️</button>` : ''}
          </div>
          ${editors.length ? `<p id="editors-list" class="event-meta" hidden>編集者: ${editors.map((ed) => AppUtil.escapeHtml(ed.displayName)).join('、')}</p>` : ''}
          ${event.description ? `<p class="event-description">${AppUtil.escapeHtml(event.description)}</p>` : ''}
        </div>
        ${canEdit ? `
        <div id="event-header-edit" class="option-edit-form" hidden>
          <input type="text" id="edit-event-title" value="${AppUtil.escapeHtml(event.title)}" placeholder="予定のタイトル">
          <textarea id="edit-event-description" placeholder="説明（任意）">${AppUtil.escapeHtml(event.description || '')}</textarea>
          <div class="option-edit-actions">
            <button type="button" class="btn" id="save-event-btn">保存</button>
            <button type="button" class="btn" id="cancel-event-btn">キャンセル</button>
          </div>
        </div>` : ''}
      </div>`;
  }

  function wireEditAccessSection(root, ctx, data) {
    const requestBtn = root.querySelector('#request-edit-btn');
    if (requestBtn) {
      AppUtil.wireAsyncButton(requestBtn, () => AppShare.requestEditAccess(ctx.eventId, data.event.title, {
        userId: ctx.identity.userId,
        displayName: ctx.identity.displayName,
        pictureUrl: ctx.identity.pictureUrl,
      }), {
        confirmMessage: `作成者（${data.creator.displayName}）に編集権限を依頼します。送信先は次の画面でLINEのトークから選んでください。よろしいですか？`,
        errorPrefix: '依頼の送信に失敗しました',
      });
    }

    const approveBtn = root.querySelector('#approve-edit-btn');
    if (approveBtn) {
      approveBtn.addEventListener('click', async () => {
        const stopLoading = AppUtil.beginButtonLoading(approveBtn);
        try {
          await AppApi.approveEditRequest({
            eventId: ctx.eventId,
            userId: ctx.identity.userId,
            targetUserId: ctx.requesterId,
            targetDisplayName: ctx.requesterName,
            targetPictureUrl: ctx.requesterPic,
          });
          const replyBtn = document.createElement('button');
          replyBtn.type = 'button';
          replyBtn.id = 'reply-approved-btn';
          replyBtn.className = 'editors-count-btn';
          replyBtn.textContent = '✅ 返信する';
          approveBtn.replaceWith(replyBtn);
          AppUtil.wireAsyncButton(replyBtn, () => AppShare.replyInChat(
            `✅ ${data.event.title} の編集権限を承認しました`
          ), { errorPrefix: '返信に失敗しました' });
        } catch (err) {
          alert('許可に失敗しました: ' + err.message);
          stopLoading();
        }
      });
    }
  }

  function wireEventEdit(root, ctx, refresh) {
    const editBtn = root.querySelector('#edit-event-btn');
    if (editBtn) {
      const view = root.querySelector('#event-header-view');
      const form = root.querySelector('#event-header-edit');
      editBtn.addEventListener('click', () => {
        view.hidden = true;
        form.hidden = false;
      });
      root.querySelector('#cancel-event-btn').addEventListener('click', () => {
        form.hidden = true;
        view.hidden = false;
      });
      root.querySelector('#save-event-btn').addEventListener('click', async (e) => {
        const title = root.querySelector('#edit-event-title').value.trim();
        if (!title) { alert('タイトルを入力してください'); return; }
        const description = root.querySelector('#edit-event-description').value.trim();
        const stopLoading = AppUtil.beginButtonLoading(e.target);
        try {
          await AppApi.updateEvent({ eventId: ctx.eventId, userId: ctx.identity.userId, title, description });
          await refresh();
        } catch (err) {
          alert('更新に失敗しました: ' + err.message);
          stopLoading();
        }
      });
    }

    const toggleEditorsBtn = root.querySelector('#toggle-editors');
    if (toggleEditorsBtn) {
      toggleEditorsBtn.addEventListener('click', () => {
        const list = root.querySelector('#editors-list');
        if (list) list.hidden = !list.hidden;
      });
    }
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
                ${OptionCard.commentAddToggleHtml(row.option.optionId)}
              </span>
              ${totalCount ? `<button type="button" class="btn remind-btn" data-row="${rowIndex}">LINE送信</button>` : ''}
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
      ${headerHtml(data.event, data, canEdit, ctx)}
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
    wireEventEdit(root, ctx, refresh);
    wireEditAccessSection(root, ctx, data);
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
