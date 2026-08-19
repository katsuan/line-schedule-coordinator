const ListView = (() => {
  async function render(root, ctx) {
    root.innerHTML = AppUtil.loadingHtml();
    const { events } = await AppApi.listMyEvents({ userId: ctx.identity.userId });

    const groups = {
      unanswered: events.filter((e) => !e.isCreator && !e.hasAnswered),
      answered: events.filter((e) => !e.isCreator && e.hasAnswered),
      created: events.filter((e) => e.isCreator),
    };

    const tabs = [
      { key: 'unanswered', label: '未回答', list: groups.unanswered },
      { key: 'answered', label: '回答済み', list: groups.answered },
      { key: 'created', label: '自分が作成', list: groups.created },
    ];

    const itemsHtml = (list) => {
      if (!list.length) return '<p class="empty">該当する予定はありません。</p>';
      return `<ul>${list.map((e) => `
        <li class="event-row">
          <a href="?event=${encodeURIComponent(e.eventId)}">
            <span class="event-title">${AppUtil.escapeHtml(e.title)}</span>
            <span class="event-meta">${e.deadline ? '期限 ' + AppUtil.formatDateTimeLocal(e.deadline) : ''}</span>
          </a>
        </li>`).join('')}</ul>`;
    };

    const defaultTab = tabs.find((t) => t.list.length)?.key || 'unanswered';

    root.innerHTML = `
      <div class="page-header">
        <h1>自分の予定</h1>
        <a class="btn btn-primary" href="?view=create">＋ 新規作成</a>
      </div>
      ${events.length ? `
        <div class="tab-bar" role="tablist">
          ${tabs.map((t) => `
            <button type="button" class="tab-btn" data-tab="${t.key}" role="tab">
              ${t.label}${t.list.length ? `<span class="tab-count">${t.list.length}</span>` : ''}
            </button>`).join('')}
        </div>
        ${tabs.map((t) => `<div class="tab-panel" data-panel="${t.key}">${itemsHtml(t.list)}</div>`).join('')}
      ` : '<p class="empty">予定はまだありません。</p>'}
    `;

    if (!events.length) return;

    const activate = (key) => {
      root.querySelectorAll('.tab-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.tab === key);
      });
      root.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.style.display = panel.dataset.panel === key ? '' : 'none';
      });
    };

    root.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => activate(btn.dataset.tab));
    });

    activate(defaultTab);
  }

  return { render };
})();
