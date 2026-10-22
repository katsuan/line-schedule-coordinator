/**
 * 詳細画面のページヘッダー（タイトル・チップ・編集フォーム・編集権限依頼/承認）。
 * js/views/detail.js から切り出した共有コンポーネント。
 */
const DetailHeader = (() => {
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
      <header class="page-header">
        <div class="page-header-top-row">
          <a class="ls-back" href="?view=list">一覧へ</a>
          <div class="page-header-top-actions">
            <button type="button" id="share-app-btn" class="ls-icon-button" aria-label="このアプリを紹介する">📣</button>
            <button type="button" id="refresh-event" class="ls-icon-button" aria-label="最新の状態に更新">🔄</button>
          </div>
        </div>
        <div id="event-header-view" class="event-title-banner">
          <div class="page-header-title-row">
            <h1>${AppUtil.titleIconHtml(event.title)}</h1>
            ${statusPill}
            ${editors.length ? `<button type="button" id="toggle-editors" class="editors-count-btn">編集者${editors.length}人</button>` : ''}
            ${showRequestChip ? `<button type="button" id="request-edit-btn" class="editors-count-btn">🔑 編集を依頼</button>` : ''}
            ${showApproveChip ? `<button type="button" id="approve-edit-btn" class="editors-count-btn edit-request-chip-pending">🔑 承認する</button>` : ''}
            ${data.isCreator ? `<button type="button" id="invite-editor" class="edit-option-btn" aria-label="編集者を招待する">👥</button>` : ''}
            ${canEdit ? `<button type="button" id="edit-event-btn" class="edit-option-btn" aria-label="予定を編集">✏️</button>` : ''}
          </div>
          ${editors.length ? `<p id="editors-list" class="event-meta" hidden>編集者: ${editors.map((ed) => AppUtil.escapeHtml(ed.displayName)).join('、')}</p>` : ''}
          ${event.description ? `<p class="event-description">${AppUtil.escapeHtml(event.description)}</p>` : ''}
        </div>
        ${canEdit ? `
        <div id="event-header-edit" class="option-edit-form" hidden>
          <input type="text" id="edit-event-title" class="ls-input" value="${AppUtil.escapeHtml(event.title)}" placeholder="予定のタイトル">
          <textarea id="edit-event-description" class="ls-input is-short" placeholder="説明（任意）">${AppUtil.escapeHtml(event.description || '')}</textarea>
          <div class="option-edit-actions">
            <button type="button" class="ls-button is-primary" id="save-event-btn">保存</button>
            <button type="button" class="ls-button" id="cancel-event-btn">キャンセル</button>
          </div>
        </div>` : ''}
      </header>`;
  }

  function showApproveConfirmSheet(eventTitle, requesterName, requesterPic) {
    return new Promise((resolve) => {
      const sheet = Sheet.open({
        title: '編集権限の承認',
        bodyHtml: `
          <p class="event-meta">${AppUtil.escapeHtml(eventTitle)}</p>
          <div class="approve-target">
            ${AppUtil.avatarHtml(requesterName, requesterPic)}
            <span>${AppUtil.escapeHtml(requesterName || '依頼者')}さんに編集権限を許可します</span>
          </div>
          <div class="ls-sheet-actions">
            <button type="button" class="ls-button is-primary" id="approve-confirm">承認する</button>
            <button type="button" class="ls-sheet-cancel" id="approve-cancel">キャンセル</button>
          </div>`,
        onDismiss: () => resolve(false),
      });
      sheet.el.querySelector('#approve-cancel').addEventListener('click', sheet.dismiss);
      sheet.el.querySelector('#approve-confirm').addEventListener('click', () => { sheet.close(); resolve(true); });
    });
  }

  function wireEditAccessSection(root, ctx, data) {
    const requestBtn = root.querySelector('#request-edit-btn');
    if (requestBtn) {
      AppUtil.wireAsyncButton(requestBtn, () => AppShare.requestEditAccess(ctx.eventId, data.event.title, {
        userId: data.me, // 本物の LINE の ID ではなく、この予定だけの記号（リンクでトークに流れるため）
        displayName: ctx.identity.displayName,
        pictureUrl: ctx.identity.pictureUrl,
      }, data.creator), {
        errorPrefix: '依頼の送信に失敗しました',
      });
    }

    const approveBtn = root.querySelector('#approve-edit-btn');
    if (approveBtn) {
      approveBtn.addEventListener('click', async () => {
        const confirmed = await showApproveConfirmSheet(data.event.title, ctx.requesterName, ctx.requesterPic);
        if (!confirmed) return;
        await AppUtil.saveWithButton(approveBtn, async () => {
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
          replyBtn.textContent = '✅ 権限許可を連絡する';
          approveBtn.replaceWith(replyBtn);
          AppUtil.wireAsyncButton(replyBtn, () => AppShare.replyInChat(
            `✅ ${data.event.title} の編集権限を承認しました`
          ), { errorPrefix: '返信に失敗しました' });
        }, '許可に失敗しました');
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
        if (!title) { AppUtil.notify('タイトルを入力してください'); return; }
        const description = root.querySelector('#edit-event-description').value.trim();
        await AppUtil.saveWithButton(e.currentTarget, async () => {
          await AppApi.updateEvent({ eventId: ctx.eventId, userId: ctx.identity.userId, title, description });
          await refresh();
        }, '更新に失敗しました');
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

  return { headerHtml, wireEditAccessSection, wireEventEdit };
})();
