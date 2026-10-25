// 日付と時刻（見せ方・入力欄の値・Google カレンダーへのリンク・あと何日）と、カレンダーの月のマス・週のはじまり。
// AppUtil に足す。HTML のエスケープは js/markup.js の AppUtil.escapeHtml を使う
var AppUtil = Object.assign(typeof AppUtil === 'undefined' ? {} : AppUtil, (() => {
  // 数を2けたの文字に（3 → "03"）
  function pad(n) {
    return String(n).padStart(2, '0');
  }

  // もう終わったイベントか（終わりがなければ始まりで見る）
  function hasEnded(item) {
    const end = item && (item.endAt || item.startAt);
    return !!end && new Date(end) < new Date();
  }

  // 日時を「2026/10/25 10:00」の形に
  function formatDateTimeLocal(isoLike) {
    if (!isoLike) return '';
    const date = new Date(isoLike);
    if (isNaN(date.getTime())) return String(isoLike);
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // 「始まり 〜 終わり」の形に。同じ日なら終わりは時刻だけ
  function formatDateRange(startAt, endAt) {
    if (!startAt) return '';
    if (!endAt) return formatDateTimeLocal(startAt);
    const start = new Date(startAt);
    const end = new Date(endAt);
    const sameDay = start.getFullYear() === end.getFullYear() &&
      start.getMonth() === end.getMonth() &&
      start.getDate() === end.getDate();
    const startText = formatDateTimeLocal(startAt);
    const endText = sameDay
      ? `${pad(end.getHours())}:${pad(end.getMinutes())}`
      : formatDateTimeLocal(endAt);
    return `${startText} 〜 ${endText}`;
  }

  // 日時を、入力欄（datetime-local）に入れる形「2026-10-25T10:00」に
  function toDatetimeLocalValue(isoLike) {
    if (!isoLike) return '';
    const date = new Date(isoLike);
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // 時刻だけ「10:00」
  function shortTime(isoLike) {
    if (!isoLike) return '';
    const d = new Date(isoLike);
    if (isNaN(d.getTime())) return '';
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // Google カレンダーの URL に入れる形「20261025T100000」に
  function toGCalStamp(value) {
    const date = value instanceof Date ? value : new Date(value);
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
  }

  // Google カレンダーに予定を足す画面の URL（終わりがなければ1時間）
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

  // 7日以内なら「今日」「明日」「○日後」の札。それ以外は空
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

  // 「カレンダー追加」のリンク（Google カレンダーを開く）
  function calendarLinkHtml(title, description, startAt, endAt, location) {
    const url = buildGoogleCalendarUrl(title, description, startAt, endAt, location);
    if (!url) return '';
    return `<a class="cal-link" href="${AppUtil.escapeHtml(url)}" target="_blank" rel="noopener">${CALENDAR_ICON_SVG}<span>カレンダー追加</span></a>`;
  }

  // イベントの入力を確かめる。だめなら知らせる文、よければ null
  function validateEventFields({ title, startAt, endAt }) {
    if (!title || !startAt || !endAt) {
      return 'タイトル・開始・完了を入力してください';
    }
    if (new Date(endAt) <= new Date(startAt)) {
      return '完了は開始より後の日時にしてください';
    }
    return null;
  }

  // ---- カレンダーの週のはじまり（1＝月曜・既定、0＝日曜）。この端末に残す ----
  // qlove:weekStart は Q のツールで共通に使うキー（同じ katsuan.github.io なら、ほかのツールでも読める）。
  // qurukana:weekStart は前の版のキー（そこで日曜を選んだ人は日曜のまま）
  const WEEK_START_KEY = 'qlove:weekStart';
  const OLD_WEEK_START_KEY = 'qurukana:weekStart';
  const DEFAULT_WEEK_START = 1;
  const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

  // 端末に残した週のはじまり（0 か 1）。なければ null
  function readWeekStart(key) {
    const value = window.localStorage.getItem(key);
    return value === '0' || value === '1' ? Number(value) : null;
  }

  // 週のはじまり（1＝月曜・0＝日曜）。Q キットの部品（week-start.js の QWeekStart）を使い、前の版のくるかなの値を
  // 「まだ共通の設定がないとき」の値として渡す。部品が読めないときも同じ決まりで読む
  function getWeekStart() {
    let old = null;
    try { old = readWeekStart(OLD_WEEK_START_KEY); } catch (e) { /* 読めない端末は月曜 */ }
    const fallback = old ?? DEFAULT_WEEK_START;
    if (window.QWeekStart) return window.QWeekStart.get(fallback);
    try {
      return readWeekStart(WEEK_START_KEY) ?? fallback;
    } catch (e) {
      return fallback;
    }
  }

  // 週のはじまりを残す（Q のツールで共通の設定に）
  function setWeekStart(value) {
    if (window.QWeekStart) {
      window.QWeekStart.set(value === 0 ? 0 : 1);
      return;
    }
    try {
      window.localStorage.setItem(WEEK_START_KEY, value === 0 ? '0' : '1');
    } catch (e) {
      // 残せない端末でも、開いているあいだは使える
    }
  }

  // ひと月のマス：前の空きは ''、日は 1〜。7 の倍数にそろえる
  function monthCells(year, month, weekStart) {
    const offset = (new Date(year, month, 1).getDay() - weekStart + 7) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < offset; i++) cells.push('');
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push('');
    return cells;
  }

  // 曜日の見出し（週のはじまりから7つ）。dow：0＝日 … 6＝土
  function weekHeader(weekStart) {
    return Array.from({ length: 7 }, (_, i) => {
      const dow = (weekStart + i) % 7;
      return { label: WEEK_LABELS[dow], dow };
    });
  }

  return { hasEnded, getWeekStart, setWeekStart, monthCells, weekHeader, formatDateRange, toDatetimeLocalValue, calendarLinkHtml, shortTime, validateEventFields, relativeDayPillHtml };
})());
