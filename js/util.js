const AppUtil = (() => {
  function escapeHtml(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  const AVATAR_ANSWER_CLASS = { '○': 'avatar-ok', '△': 'avatar-maybe', '×': 'avatar-ng' };

  // 画像の URL は https だけ（ほかは頭文字を出す）。CSS と HTML の両方で文字が外に出ないようにする
  function safeImageUrl(value) {
    if (typeof value !== 'string' || !value || value.length > 1000) return '';
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.href.replace(/['"()\\\s]/g, encodeURIComponent) : '';
    } catch (err) {
      return '';
    }
  }

  function avatarHtml(displayName, pictureUrl, answer) {
    const initial = escapeHtml(Array.from(String(displayName || '?'))[0] || '?');
    const url = safeImageUrl(pictureUrl);
    const style = url ? ` style="background-image:url('${escapeHtml(url)}')"` : '';
    const cls = AVATAR_ANSWER_CLASS[answer] ? ` ${AVATAR_ANSWER_CLASS[answer]}` : '';
    return `<span class="avatar${cls}"${style}>${url ? '' : initial}</span>`;
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
      return rest ? `${firstChar} ${escapeHtml(rest)}` : firstChar;
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
    return `<a class="cal-link" href="${escapeHtml(url)}" target="_blank" rel="noopener">${CALENDAR_ICON_SVG}<span>カレンダー追加</span></a>`;
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
    '届いたメッセージの「回答する」を開くと、そのまま候補に回答できます。',
    '○＝参加できる／△＝未定／×＝参加できない、という意味です。',
  ];

  // 読みこみ中：中身（見出し・カード）と同じくらいの大きさの箱（Q キットの ls-skeleton）。中身が出ても位置がずれにくい
  function loadingHtml() {
    const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
    return `
      <div class="loading" role="status" aria-label="読みこみ中">
        <span class="ls-skeleton loading-head"></span>
        <span class="ls-skeleton loading-card"></span>
        <span class="ls-skeleton loading-card"></span>
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

  // 下に数秒出る知らせ（Q キットのトースト）。options に { actionLabel: '元に戻す', onAction } を渡すとボタンが付く。
  // Q キットが読めなかったときは alert（ボタンは付けられない）
  // 季節の絵文字（Q キットの season.js。tool-share.js があとから読むので、まだなければ付けない）。
  // うれしい瞬間の短い文だけに使う（エラー・確認・ボタン・送るカードの本文には使わない）
  function withSeason(text) {
    return window.QSeason && typeof window.QSeason.decorate === 'function' ? window.QSeason.decorate(text) : text;
  }

  function notify(message, options) {
    if (window.LineShareUI && typeof LineShareUI.toast === 'function') {
      LineShareUI.toast(message, options);
    } else {
      alert(message); // qcheck-ok: W8 Q キットが読めなかったときだけの代わり
    }
  }

  // 確かめる窓（Q キットの LineShareUI.ask。下から出るシート）。OK なら true。Q キットが読めなかったときは confirm
  // 知らせるだけのとき（alert の代わり）は ask({ title, ok: '閉じる', cancel: null })
  function ask(options) {
    if (window.LineShareUI && typeof LineShareUI.ask === 'function') return LineShareUI.ask(options);
    const text = [options.title, options.text].filter(Boolean).join('\n');
    if (options.cancel === null) {
      alert(text); // qcheck-ok: W8 Q キットが読めなかったときだけの代わり
      return Promise.resolve(true);
    }
    return Promise.resolve(confirm(text)); // qcheck-ok: W8 Q キットが読めなかったときだけの代わり
  }

  // 失敗したときの「次にすること」。GAS の返すエラーの中身は画面に出さず、種類だけ見て言いかえる（くわしくはコンソール）
  function friendlyReason(err) {
    const message = String((err && err.message) || '');
    if (/ログインしなおして/.test(message)) return 'LINE で開きなおしてね。';
    if (/長すぎ|多すぎ/.test(message)) return 'もう少し短く（少なく）してね。';
    if (/招待のリンク/.test(message)) return '作成者に「🔑 編集を依頼」してね。';
    if (/のみです|作成者|投稿者/.test(message)) return 'この操作は、予定を作った人（編集をまかされた人）だけができます。';
    if (/見つかりません/.test(message)) return '予定が見つかりませんでした。消されたのかもしれません。';
    return '電波のよいところで、もう一度ためしてね。';
  }

  function notifyError(what, err) {
    console.warn(what, err);
    notify(`${what || 'うまくいきませんでした'}。${friendlyReason(err)}`);
  }

  // confirm：元に戻せない操作だけ、押す前に確かめる（{ title, text, ok: '消す', danger: true }。ok にはすることを書く）
  function wireAsyncButton(btn, action, { confirm: confirmOptions, errorPrefix } = {}) {
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget;
      if (confirmOptions && !(await ask(confirmOptions))) return;
      const stopLoading = beginButtonLoading(target || e.target);
      try {
        await action(e);
      } catch (err) {
        notifyError(errorPrefix, err);
      } finally {
        stopLoading();
      }
    });
  }

  // 保存して画面を描き直す（または移る）ボタン。うまくいったときは描き直しでボタンごと消えるので、
  // くるくるは止めない。失敗したときだけ知らせて、ボタンを元に戻す
  async function saveWithButton(btn, action, errorPrefix) {
    const stopLoading = beginButtonLoading(btn);
    try {
      await action();
    } catch (err) {
      notifyError(errorPrefix, err);
      stopLoading();
    }
  }

  // ---- カレンダーの週のはじまり（1＝月曜・既定、0＝日曜）。この端末に残す ----
  // qlove:weekStart は Q のツールで共通に使うキー（同じ katsuan.github.io なら、ほかのツールでも読める）。
  // qurukana:weekStart は前の版のキー（そこで日曜を選んだ人は日曜のまま）
  const WEEK_START_KEY = 'qlove:weekStart';
  const OLD_WEEK_START_KEY = 'qurukana:weekStart';
  const DEFAULT_WEEK_START = 1;
  const WEEK_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

  function readWeekStart(key) {
    const value = window.localStorage.getItem(key);
    return value === '0' || value === '1' ? Number(value) : null;
  }

  function getWeekStart() {
    try {
      const saved = readWeekStart(WEEK_START_KEY) ?? readWeekStart(OLD_WEEK_START_KEY);
      return saved ?? DEFAULT_WEEK_START;
    } catch (e) {
      return DEFAULT_WEEK_START;
    }
  }

  function setWeekStart(value) {
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

  return {
    getWeekStart, setWeekStart, monthCells, weekHeader,
    escapeHtml, safeImageUrl, formatDateRange, toDatetimeLocalValue, calendarLinkHtml, loadingHtml, titleIconHtml,
    extractIcon, shortTime, validateEventFields, wireAsyncButton, saveWithButton, relativeDayPillHtml,
    beginButtonLoading, avatarHtml, notify, notifyError, friendlyReason, ask, withSeason,
  };
})();
