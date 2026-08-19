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

  return { escapeHtml, formatDateTimeLocal };
})();
