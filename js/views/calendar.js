const CalendarView = (() => {
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

    function byDayMap() {
      const map = {};
      items.forEach((it) => {
        const key = dateKey(it.startAt);
        (map[key] = map[key] || []).push(it);
      });
      return map;
    }

    function monthGridHtml(year, month, byDay) {
      const first = new Date(year, month, 1);
      const startOffset = first.getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startOffset; i++) cells.push('');
      for (let d = 1; d <= daysInMonth; d++) cells.push(d);
      while (cells.length % 7 !== 0) cells.push('');

      const weekHeader = ['日', '月', '火', '水', '木', '金', '土']
        .map((w) => `<div class="cal-weekday">${w}</div>`).join('');

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

    function listHtml() {
      if (!items.length) return '<p class="empty">関連する予定はありません。</p>';
      return items.map((it) => {
        const statusText = it.myAnswer ? STATUS_LABEL[it.myAnswer] : '未回答';
        const statusClass = it.myAnswer ? STATUS_CLASS[it.myAnswer] : 'dot-none';
        return `
          <button type="button" class="cal-item" data-key="${dateKey(it.startAt)}">
            <span class="cal-dot ${statusClass}"></span>
            <span class="cal-item-body">
              <span class="cal-item-title">${AppUtil.titleIconHtml(it.optionTitle || it.eventTitle)}</span>
              <span class="cal-item-date">${AppUtil.formatDateRange(it.startAt, it.endAt)}${it.location ? ' ・ 📍' + AppUtil.escapeHtml(it.location) : ''}</span>
            </span>
            <span class="cal-item-status">${statusText}</span>
          </button>`;
      }).join('');
    }

    function modalItemHtml(it) {
      return `
        <div class="answer-row" data-option-id="${it.optionId}" data-event-id="${it.eventId}">
          <div class="option-meta">
            <div class="option-meta-title">${AppUtil.titleIconHtml(it.optionTitle || it.eventTitle)}</div>
            <div class="option-meta-date">${AppUtil.formatDateRange(it.startAt, it.endAt)}</div>
            ${it.location ? `<div class="option-meta-location">📍 ${AppUtil.escapeHtml(it.location)}</div>` : ''}
          </div>
          <span class="answer-choices" data-option-id="${it.optionId}">
            ${OptionCard.choiceButtonsHtml(it.optionId, { [it.optionId]: it.myAnswer })}
          </span>
          <a class="cal-item-status" style="text-decoration:none;display:block;margin-top:6px" href="?event=${encodeURIComponent(it.eventId)}">この予定を開く →</a>
        </div>`;
    }

    function openModal(key) {
      const dayItems = items.filter((it) => dateKey(it.startAt) === key);
      if (!dayItems.length) return;

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box">
          <div class="modal-header">
            <h2 style="margin:0">${dayItems[0] ? new Date(dayItems[0].startAt).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' }) : ''}の予定</h2>
            <button type="button" class="modal-close" aria-label="閉じる">×</button>
          </div>
          ${dayItems.map(modalItemHtml).join('')}
        </div>`;
      document.body.appendChild(overlay);

      const close = () => overlay.remove();
      overlay.querySelector('.modal-close').addEventListener('click', close);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

      let saving = false;
      overlay.querySelectorAll('.answer-choices').forEach((container) => {
        container.addEventListener('click', async (e) => {
          const btn = e.target.closest('.choice-btn');
          if (!btn || saving) return;
          const optionId = container.dataset.optionId;
          const rowEl = container.closest('.answer-row');
          const eventId = rowEl.dataset.eventId;
          const value = btn.dataset.value;

          container.querySelectorAll('.choice-btn').forEach((b) => b.classList.toggle('selected', b === btn));
          saving = true;
          try {
            await AppApi.submitAnswer({
              eventId,
              userId: ctx.identity.userId,
              displayName: ctx.identity.displayName,
              pictureUrl: ctx.identity.pictureUrl,
              answers: [{ optionId, answer: value }],
            });
            const item = items.find((it) => it.optionId === optionId);
            if (item) item.myAnswer = value;
            paint();
          } catch (err) {
            alert('回答の保存に失敗しました: ' + err.message);
          } finally {
            saving = false;
          }
        });
      });
    }

    function paint() {
      root.innerHTML = `
        <div class="page-header">
          <h1>カレンダー</h1>
          <a class="btn" href="?view=list">一覧へ</a>
        </div>
        <div class="cal-nav">
          <button type="button" id="cal-prev" class="btn">←</button>
          <span id="cal-month-label" class="cal-month-label"></span>
          <button type="button" id="cal-next" class="btn">→</button>
        </div>
        <div id="cal-grid-container"></div>
        <h2>今後の予定一覧</h2>
        <div class="cal-item-list">${listHtml()}</div>
      `;
      paintGrid();

      root.querySelectorAll('.cal-item').forEach((btn) => {
        btn.addEventListener('click', () => openModal(btn.dataset.key));
      });

      root.querySelector('#cal-prev').addEventListener('click', () => {
        viewMonth -= 1;
        if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
        paintGrid();
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
      root.querySelectorAll('.cal-cell.has-items').forEach((cell) => {
        cell.addEventListener('click', () => openModal(cell.dataset.key));
      });
    }

    paint();
  }

  return { render };
})();
