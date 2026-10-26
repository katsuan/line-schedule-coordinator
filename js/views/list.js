// 予定の一覧（ListView）：未回答・回答済み・自分が作成 のタブ。予定がなければあいさつ。
// app.js が ?view=list のとき render を呼ぶ
const ListView = (() => {
  // 自分の予定を読んで、一覧の画面を描く
  async function render(root, ctx) {
    root.innerHTML = AppUtil.loadingHtml();
    const { events } = await AppApi.listMyEvents({ userId: ctx.identity.userId });

    const groups = {
      unanswered: events.filter((e) => !e.isCreator && !e.hasAnswered && !e.isPast),
      answered: events.filter((e) => !e.isCreator && e.hasAnswered),
      created: events.filter((e) => e.isCreator),
    };

    const tabs = [
      { key: 'unanswered', label: '未回答', list: groups.unanswered },
      { key: 'answered', label: '回答済み', list: groups.answered },
      { key: 'created', label: '自分が作成', list: groups.created },
    ];

    // 予定の札（作成者・回答済み・未回答）
    const statusBadge = (e) => {
      if (e.isCreator) return '<span class="status-badge status-creator">作成者</span>';
      return e.hasAnswered
        ? '<span class="status-badge status-answered">✓ 回答済み</span>'
        : '<span class="status-badge status-pending">未回答</span>';
    };

    // 予定の並びの HTML（なければ「該当する予定はありません」）
    const itemsHtml = (list) => {
      if (!list.length) return '<p class="ls-empty">該当する予定はありません。</p>';
      return `<ul class="event-list ls-panel">${list.map((e) => `
        <li class="event-row">
          <a href="?event=${encodeURIComponent(e.eventId)}">
            <span class="event-title">${AppUtil.titleIconHtml(e.title)}</span>
            ${statusBadge(e)}
          </a>
        </li>`).join('')}</ul>`;
    };

    const defaultTab = tabs.find((t) => t.list.length)?.key || 'unanswered';

    root.innerHTML = `
      <header class="page-header">
        <div class="ls-brand">
          <p class="ls-brand-name"><img class="ls-brand-icon" src="icon.svg" alt="" width="30" height="30">くるかな</p>
          <img class="ls-brand-logo" src="logo.svg" alt="QuruKana" width="103" height="28">
        </div>
        <p class="ls-brand-copy">来れる日を、○△×でそろえよう</p>
        <h1 class="page-subtitle">自分の予定</h1>
        <div class="header-actions">
          <a class="ls-button" href="?view=calendar">🗓️ カレンダー</a>
          <a class="ls-button is-primary" href="?view=create">＋ 新規作成</a>
        </div>
      </header>
      ${events.length ? `
        <div class="ls-tabs" role="tablist">
          ${tabs.map((t) => `
            <button type="button" class="ls-tab" data-tab="${t.key}" role="tab" aria-selected="false">
              ${t.label}${t.list.length ? `<span class="tab-count">${t.list.length}</span>` : ''}
            </button>`).join('')}
        </div>
        ${tabs.map((t) => `<div class="tab-panel" data-panel="${t.key}" role="tabpanel" hidden>${itemsHtml(t.list)}</div>`).join('')}
      ` : `<p class="ls-empty">${AppUtil.escapeHtml(AppUtil.withSeason('予定はまだありません。「＋ 新規作成」から作れます。'))}</p>`}
    `;

    // 見出しのロゴの右に、本人の LINE のアイコン（views/meIcon.js。Q キットの shared/line-me.js）
    MeIcon.mount(root, ctx.identity);

    // はじめて開いた人にだけ、短い使い方（Q キット。「わかった」で消え、この端末では二度と出さない）
    if (window.LineShareUI && typeof LineShareUI.firstTip === 'function') {
      LineShareUI.firstTip('qurukana', [
        '「＋ 新規作成」で、候補の日をいくつか入れます',
        '「カードで送る」で、みんなに ○△× で答えてもらえます',
        '答えは押したときに保存されます。あとから変えてもOK',
      ], root.querySelector('.ls-tabs, .ls-empty'));
    }

    if (!events.length) return;

    // タブを切りかえる
    const activate = (key) => {
      root.querySelectorAll('.ls-tab').forEach((btn) => {
        btn.setAttribute('aria-selected', String(btn.dataset.tab === key));
      });
      root.querySelectorAll('.tab-panel').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== key;
      });
    };

    root.querySelectorAll('.ls-tab').forEach((btn) => {
      btn.addEventListener('click', () => activate(btn.dataset.tab));
    });

    activate(defaultTab);
  }

  return { render };
})();
