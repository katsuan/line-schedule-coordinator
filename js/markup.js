// 画面に出す文字と小さな部品（HTML に入れる前のエスケープ・アイコン・タイトルの絵文字・読みこみ中の箱）。
// AppUtil に足す（js/dates.js・js/notice.js と分けて持つ）
var AppUtil = Object.assign(typeof AppUtil === 'undefined' ? {} : AppUtil, (() => {
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

  const TIPS = [
    'イベントごとに○（参加）／△（未定）／×（不参加）で回答できます。',
    '回答はタップした瞬間に自動保存されます。送信ボタンは不要です。',
    'イベントには個別のタイトルを付けられます（例: BBQ、飲み会）。',
    '各イベントの「カレンダー追加」からGoogleカレンダーに直接登録できます。',
    '作成者はイベントをあとから追加できます。全員の回答状況もいつでも確認できます。',
    '回答状況は、作成者だけでなく参加者もいつでも確認できます。',
    '「カードで送る」で、この予定を友だちやグループに送れます。',
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

  return { escapeHtml, safeImageUrl, loadingHtml, titleIconHtml, extractIcon, avatarHtml };
})());
