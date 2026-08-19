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

  function toGCalStamp(value) {
    const date = value instanceof Date ? value : new Date(value);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }

  function buildGoogleCalendarUrl(title, description, startAt, endAt) {
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
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  const CALENDAR_ICON_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 9.5H21" stroke="currentColor" stroke-width="1.6"/><path d="M8 3V6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M16 3V6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 13V17M10 15H14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

  function calendarLinkHtml(title, description, startAt, endAt) {
    const url = buildGoogleCalendarUrl(title, description, startAt, endAt);
    if (!url) return '';
    return `<a class="cal-link" href="${url}" target="_blank" rel="noopener">${CALENDAR_ICON_SVG}<span>カレンダーに追加</span></a>`;
  }

  return { escapeHtml, formatDateTimeLocal, formatDateRange, buildGoogleCalendarUrl, calendarLinkHtml };
})();
