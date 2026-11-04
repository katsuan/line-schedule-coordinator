/**
 * イベントに答えた人の顔の並び（Respondents）：○△× ごとに、自分 → コメントした人 → ほかの人 の順。
 * コメントした人の顔を押すと、その人のコメントが出る。呼ばれ方：views/detail.js から。
 */
const Respondents = (() => {
  const ANSWERS = ['○', '△', '×'];

  // ○△× ごとの回答者の顔。自分 → コメントした人 → ほかの人 の順。コメントした人の顔を押すとコメントが出る
  function groupsHtml(row, myUserId) {
    const commentTextByUser = {};
    (row.comments || []).forEach((c) => {
      (commentTextByUser[c.userId] = commentTextByUser[c.userId] || []).push(c.text);
    });
    // 答えた人の並べ順（自分 → コメントのある人 → ほか）
    const rank = (r) => (r.userId === myUserId ? 2 : commentTextByUser[r.userId] ? 1 : 0);
    // 答えた人1人分（アイコンと名前。コメントがあれば押すと出る）
    const respondentHtml = (r, answer) => {
      const comments = commentTextByUser[r.userId];
      const isMe = r.userId === myUserId;
      return `<span class="respondent${isMe ? ' me' : ''}">
        <span class="avatar-wrap"${comments ? ' role="button" tabindex="0" data-comment-toggle="1"' : ''}>
          ${AppUtil.avatarHtml(r.displayName, r.pictureUrl, answer)}
          ${comments ? '<span class="avatar-comment-badge">💬</span>' : ''}
        </span>
        <span>${AppUtil.escapeHtml(r.displayName)}${isMe ? '（自分）' : ''}</span>
        ${comments ? `<span class="respondent-comment-popup" hidden>${comments.map((t) => AppUtil.escapeHtml(t)).join('<br>')}</span>` : ''}
      </span>`;
    };
    return ANSWERS.map((answer) => {
      const list = row.respondents[answer] || [];
      const sorted = [...list].sort((a, b) => rank(b) - rank(a));
      return `
        <div class="respondent-group ${OptionCard.statusClass(answer)}">
          <p class="respondent-label">${answer}</p>
          ${list.length
            ? `<div class="respondent-list">${sorted.map((r) => respondentHtml(r, answer)).join('')}</div>`
            : '<p class="empty-respondents">なし</p>'}
        </div>`;
    }).join('');
  }

  // アイコンを押すと、その人のコメントを出したり隠したりする
  function wireComments(root) {
    root.querySelectorAll('.avatar-wrap[data-comment-toggle]').forEach((wrap) => {
      AppUtil.onActivate(wrap, () => {
        const popup = wrap.parentElement.querySelector('.respondent-comment-popup');
        if (popup) popup.hidden = !popup.hidden;
      });
    });
  }

  return { groupsHtml, wireComments };
})();
