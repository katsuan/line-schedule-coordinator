const AppUtil = (() => {
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function formatDateTimeLocal(isoLike) {
    if (!isoLike) return '';
    const date = new Date(isoLike);
    if (isNaN(date.getTime())) return String(isoLike);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatDateRange(startAt, endAt) {
    if (!startAt) return '';
    if (!endAt) return formatDateTimeLocal(startAt);
    const start = new Date(startAt);
    const end = new Date(endAt);
    const pad = (n) => String(n).padStart(2, '0');
    const sameDay = start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();
    const startText = formatDateTimeLocal(startAt);
    const endText = sameDay
      ? `${pad(end.getHours())}:${pad(end.getMinutes())}`
      : formatDateTimeLocal(endAt);
    return `${startText} 〜 ${endText}`;
  }

  function toDatetimeLocalValue(isoLike) {
    if (!isoLike) return '';
    const date = new Date(isoLike);
    if (isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const EMOJI_REGEX = /\p{Extended_Pictographic}/u;

  function extractIcon(title) {
    const trimmed = String(title || '').trim();
    const firstChar = Array.from(trimmed)[0] || '';
    return (firstChar && EMOJI_REGEX.test(firstChar)) ? firstChar : '🗓️';
  }

  function titleIconHtml(title) {
    const trimmed = String(title || '').trim();
    const firstChar = Array.from(trimmed)[0] || '';
    if (firstChar && EMOJI_REGEX.test(firstChar)) {
      const rest = trimmed.slice(firstChar.length).trim();
      return `${firstChar} ${escapeHtml(rest || trimmed)}`;
    }
    return `🗓️ ${escapeHtml(trimmed)}`;
  }

  function shortTime(isoLike) {
    if (!isoLike) return '';
    const d = new Date(isoLike);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toGCalStamp(value) {
    const date = value instanceof Date ? value : new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }

  function buildGoogleCalendarUrl(title, description, startAt, endAt, location) {
    if (!startAt) return '';
    const start = toGCalStamp(startAt);
    const endDate = endAt ? new Date(endAt) : new Date(new Date(startAt).getTime() + 60 * 60 * 1000);
    const end = toGCalStamp(endDate);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title || '',
      dates: `${start}/${end}`,
      details: description || '',
      ctz: 'Asia/Tokyo',
    });
    if (location) params.set('location', location);
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  function relativeDayPillHtml(startAt) {
    if (!startAt) return '';
    const start = new Date(startAt);
    if (isNaN(start.getTime())) return '';
    const now = new Date();
    const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((startDay - today) / 86400000);
    if (diffDays < 0 || diffDays > 7) return '';
    const label = diffDays === 0 ? '今日' : diffDays === 1 ? '明日' : `${diffDays}日後`;
    return `<span class="date-pill${diffDays <= 1 ? ' date-pill-urgent' : ''}">${label}</span>`;
  }

  const CALENDAR_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 9.5H21" stroke="currentColor" stroke-width="1.6"/><path d="M8 3V6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 3V6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 13V17M10 15H14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function calendarLinkHtml(title, description, startAt, endAt, location) {
    const url = buildGoogleCalendarUrl(title, description, startAt, endAt, location);
    if (!url) return '';
    return `<a class="cal-link" href="${url}" target="_blank" rel="noopener">${CALENDAR_ICON_SVG}<span>カレンダー追加</span></a>`;
  }

  const TIPS = [
    'イベントごとに○（参加）／△（未定）／×（不参加）で回答できます。',
    '回答はタップした瞬間に自動保存されます。送信ボタンは不要です。',
    'イベントには個別のタイトルを付けられます（例: BBQ、飲み会）。',
    '各イベントの「カレンダー追加」からGoogleカレンダーに直接登録できます。',
    '作成者はイベントをあとから追加できます。全員の回答状況もいつでも確認できます。',
    '回答状況は、作成者だけでなく参加者もいつでも確認できます。',
    '共有ボタンからLINEでこの予定を友だちやグループに送れます。',
    '予定の作成者は、他の人に編集権限を渡すこともできます。',
  ];

  function loadingHtml(message) {
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    return `
      <div class="loading">
        <span class="spinner"></span>
        <span>${escapeHtml(message || '読み込み中...')}</span>
        <p class="loading-tip">💡 ${escapeHtml(tip)}</p>
      </div>`;
  }

  function validateEventFields({ title, startAt, endAt }) {
    if (!title || !startAt || !endAt) {
      return 'タイトル・開始・完了を入力してください';
    }
    if (new Date(endAt) <= new Date(startAt)) {
      return '完了は開始より後の日時にしてください';
    }
    return null;
  }

  function beginButtonLoading(btn) {
    const originalColor = getComputedStyle(btn).color;
    btn.classList.add('is-saving');
    btn.disabled = true;
    const spinner = document.createElement('span');
    spinner.className = 'btn-spinner';
    spinner.style.borderColor = originalColor;
    spinner.style.borderTopColor = 'transparent';
    btn.appendChild(spinner);
    return () => {
      btn.classList.remove('is-saving');
      btn.disabled = false;
      spinner.remove();
    };
  }

  function wireAsyncButton(btn, action, { confirmMessage, errorPrefix } = {}) {
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      if (confirmMessage && !confirm(confirmMessage)) return;
      const stopLoading = beginButtonLoading(e.target);
      try {
        await action(e);
      } catch (err) {
        alert((errorPrefix || '処理に失敗しました') + ': ' + err.message);
      } finally {
        stopLoading();
      }
    });
  }

  return {
    escapeHtml, formatDateTimeLocal, formatDateRange, toDatetimeLocalValue,
    buildGoogleCalendarUrl, calendarLinkHtml, loadingHtml, titleIconHtml,
    extractIcon, shortTime, validateEventFields, wireAsyncButton, relativeDayPillHtml, beginButtonLoading,
  };
})();
