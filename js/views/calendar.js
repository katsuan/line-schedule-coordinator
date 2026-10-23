const CalendarView = (() => {
  // 自分の答えの色（日付の小さな印と、一覧の札で同じ）
  const STATUS_CLASS = { '○': 'dot-ok', '△': 'dot-maybe', '×': 'dot-ng' };
  const STATUS_LABEL = { '○': '○ 参加', '△': '△ 未定', '×': '× 不参加' };

  function dateKey(isoLike) {
    const d = new Date(isoLike);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }

  async function render(root, ctx) {
    root.innerHTML = AppUtil.loadingHtml();
    let { items } = await AppApi.listMyOptions({ userId: ctx.identity.userId });
    items.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

    const today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth();
    let weekStart = AppUtil.getWeekStart();

    function byDayMap() {
      const map = {};
      items.forEach((it) => {
        const key = dateKey(it.startAt);
        (map[key] = map[key] || []).push(it);
      });
      return map;
    }

    function monthGridHtml(year, month, byDay) {
      const cells = AppUtil.monthCells(year, month, weekStart);

      const weekHeader = AppUtil.weekHeader(weekStart)
        .map((w) => `<div class="cal-weekday${w.dow === 0 ? ' is-sun' : w.dow === 6 ? ' is-sat' : ''}">${w.label}</div>`).join('');

      const dayCells = cells.map((d) => {
        if (!d) return '<div class="cal-cell empty"></div>';
        const key = `${year}-${month}-${d}`;
        const dayItems = byDay[key] || [];
        const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
        const shown = dayItems.slice(0, 2);
        const pills = shown.map((it) => `
          <span class="cal-pill ${STATUS_CLASS[it.myAnswer] || 'dot-none'}">${AppUtil.extractIcon(it.optionTitle || it.eventTitle)}${AppUtil.shortTime(it.startAt).slice(0, 2)}時</span>`).join('');
        const overflow = dayItems.length > shown.length ? `<span class="cal-pill-more">+${dayItems.length - shown.length}</span>` : '';
        return `
          <div class="cal-cell${isToday ? ' today' : ''}${dayItems.length ? ' has-items' : ''}" data-key="${key}">
            <span class="cal-daynum">${d}</span>
            <span class="cal-pills">${pills}${overflow}</span>
          </div>`;
      }).join('');

      return `<div class="cal-grid-header">${weekHeader}</div><div class="cal-grid">${dayCells}</div>`;
    }

    function isPast(it) {
      const end = it.endAt || it.startAt;
      return !!end && new Date(end) < new Date();
    }

    function listHtml() {
      const upcoming = items.filter((it) => !isPast(it));
      if (!upcoming.length) return '<p class="ls-empty">今後の予定はありません。</p>';
      return upcoming.map((it) => {
        const statusText = it.myAnswer ? STATUS_LABEL[it.myAnswer] : '未回答';
        const rowClass = OptionCard.statusClass(it.myAnswer);
        const badgeClass = STATUS_CLASS[it.myAnswer] || 'dot-none';
        return `
          <button type="button" class="ls-panel summary-row cal-item ${rowClass}" data-key="${dateKey(it.startAt)}">
            <div class="option-meta-title-row">
              <span class="option-meta-title">${AppUtil.titleIconHtml(it.optionTitle || it.eventTitle)}</span>
              <span class="cal-status-badge ${badgeClass}">${statusText}</span>
            </div>
            <div class="option-meta-info-row">
              <span class="option-meta-date">${AppUtil.formatDateRange(it.startAt, it.endAt)}</span>
            </div>
            ${it.location ? `<div class="option-meta-info-row"><span class="option-meta-location">📍 ${AppUtil.escapeHtml(it.location)}</span></div>` : ''}
          </button>`;
      }).join('');
    }

    function daySheetItemHtml(it) {
      return `
        <div class="answer-row" data-option-id="${AppUtil.escapeHtml(it.optionId)}" data-event-id="${AppUtil.escapeHtml(it.eventId)}">
          <div class="option-meta">
            <div class="option-meta-title">${AppUtil.titleIconHtml(it.optionTitle || it.eventTitle)}</div>
            <div class="option-meta-info-row option-meta-info-row-split">
              <span class="option-meta-date">${AppUtil.formatDateRange(it.startAt, it.endAt)}</span>
              ${AppUtil.calendarLinkHtml(it.optionTitle || it.eventTitle, '', it.startAt, it.endAt, it.location)}
            </div>
            ${it.location ? `<div class="option-meta-info-row"><span class="option-meta-location">📍 ${AppUtil.escapeHtml(it.location)}</span></div>` : ''}
          </div>
          <span class="answer-choices" data-option-id="${AppUtil.escapeHtml(it.optionId)}">
            ${OptionCard.choiceButtonsHtml(it.optionId, { [it.optionId]: it.myAnswer })}
          </span>
          <a class="cal-open-link" href="?event=${encodeURIComponent(it.eventId)}">この予定を開く →</a>
        </div>`;
    }

    function openDaySheet(key) {
      const dayItems = items.filter((it) => dateKey(it.startAt) === key);
      if (!dayItems.length) return;

      const dayLabel = new Date(dayItems[0].startAt).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' });
      const sheet = Sheet.open({ title: `${dayLabel}の予定`, bodyHtml: dayItems.map(daySheetItemHtml).join('') });

      let saving = false;
      sheet.el.querySelectorAll('.answer-choices').forEach((container) => {
        container.addEventListener('click', async (e) => {
          const btn = e.target.closest('.choice-btn');
          if (!btn || saving) return;
          const optionId = container.dataset.optionId;
          const eventId = container.closest('.answer-row').dataset.eventId;
          const value = btn.dataset.value;
          saving = true;
          const saved = await OptionCard.saveChoice(container, btn, () => OptionCard.submitOne(ctx, eventId, optionId, value));
          saving = false;
          if (saved) {
            const item = items.find((it) => it.optionId === optionId);
            if (item) item.myAnswer = value;
            paint();
          }
        });
      });
    }

    function paint() {
      root.innerHTML = `
        <header class="page-header">
          <a class="ls-back" href="?view=list">一覧へ</a>
          <h1>カレンダー</h1>
        </header>
        <div class="cal-nav">
          <button type="button" id="cal-prev" class="ls-icon-button" aria-label="前の月">←</button>
          <span id="cal-month-label" class="cal-month-label"></span>
          <button type="button" id="cal-next" class="ls-icon-button" aria-label="次の月">→</button>
        </div>
        <div id="cal-grid-container"></div>
        <div class="cal-week-start">
          <span>週のはじまり</span>
          <div class="ls-chips" role="radiogroup" aria-label="週のはじまり">
            <button type="button" class="ls-chip is-small" role="radio" data-week-start="1">月曜</button>
            <button type="button" class="ls-chip is-small" role="radio" data-week-start="0">日曜</button>
          </div>
        </div>
        <h2>今後の予定一覧</h2>
        <div class="cal-item-list">${listHtml()}</div>
      `;
      paintGrid();

      root.querySelectorAll('.cal-item').forEach((btn) => {
        btn.addEventListener('click', () => openDaySheet(btn.dataset.key));
      });

      root.querySelector('#cal-prev').addEventListener('click', () => {
        viewMonth -= 1;
        if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
        paintGrid();
      });
      root.querySelectorAll('[data-week-start]').forEach((btn) => {
        btn.addEventListener('click', () => {
          weekStart = Number(btn.dataset.weekStart) === 1 ? 1 : 0;
          AppUtil.setWeekStart(weekStart);
          paintGrid();
        });
      });
      root.querySelector('#cal-next').addEventListener('click', () => {
        viewMonth += 1;
        if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
        paintGrid();
      });
    }

    function paintGrid() {
      const byDay = byDayMap();
      root.querySelector('#cal-month-label').textContent = `${viewYear}年${viewMonth + 1}月`;
      root.querySelector('#cal-grid-container').innerHTML = monthGridHtml(viewYear, viewMonth, byDay);
      root.querySelectorAll('[data-week-start]').forEach((btn) => {
        btn.setAttribute('aria-checked', String(Number(btn.dataset.weekStart) === weekStart));
      });
      root.querySelectorAll('.cal-cell.has-items').forEach((cell) => {
        cell.addEventListener('click', () => openDaySheet(cell.dataset.key));
      });
    }

    paint();
  }

  return { render };
})();
