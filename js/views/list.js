const ListView = (() => {
  async function render(root, ctx) {
    root.innerHTML = `<div class="loading">読み込み中...</div>`;
    const { events } = await AppApi.listMyEvents({ userId: ctx.identity.userId });

    const unanswered = events.filter((e) => !e.isCreator && !e.hasAnswered);
    const answered = events.filter((e) => !e.isCreator && e.hasAnswered);
    const created = events.filter((e) => e.isCreator);

    const renderGroup = (title, list) => {
      if (!list.length) return '';
      const items = list.map((e) => `
        <li class="event-row">
          <a href="?event=${encodeURIComponent(e.eventId)}">
            <span class="event-title">${AppUtil.escapeHtml(e.title)}</span>
            <span class="event-meta">${e.deadline ? '期限 ' + AppUtil.formatDateTimeLocal(e.deadline) : ''}</span>
          </a>
        </li>`).join('');
      return `<section class="event-group"><h2>${title}</h2><ul>${items}</ul></section>`;
    };

    root.innerHTML = `
      <div class="page-header">
        <h1>自分の予定</h1>
        <a class="btn btn-primary" href="?view=create">＋ 新規作成</a>
      </div>
      ${renderGroup('未回答', unanswered)}
      ${renderGroup('回答済み', answered)}
      ${renderGroup('自分が作成', created)}
      ${!events.length ? '<p class="empty">予定はまだありません。</p>' : ''}
    `;
  }

  return { render };
})();
