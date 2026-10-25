/**
 * 下から出るシート（Q キットの ls-sheet）。その日の予定・編集権限の承認・送信内容プレビューで使う。
 * 見出しの行と「×」、外側を押すと閉じる、までをここでまとめる。中身と配線は呼び出し側。
 */
const Sheet = (() => {
  // onDismiss：「×」か外側で閉じたときに呼ぶ（ボタンで閉じるときは close() を呼ぶ）
  function open({ title, bodyHtml, onDismiss }) {
    const sheet = document.createElement('div');
    sheet.className = 'ls-sheet';
    sheet.innerHTML = `
      <div class="ls-sheet-card" role="dialog" aria-modal="true" aria-label="${AppUtil.escapeHtml(title)}">
        <div class="sheet-head">
          <p class="ls-sheet-title">${AppUtil.escapeHtml(title)}</p>
          <button type="button" class="sheet-close" aria-label="閉じる">×</button>
        </div>
        ${bodyHtml}
      </div>`;
    document.body.appendChild(sheet);

    // シートを閉じる（ボタンで閉じるとき）
    const close = () => sheet.remove();
    // 「×」か外側で閉じる（onDismiss も呼ぶ）
    const dismiss = () => {
      close();
      if (onDismiss) onDismiss();
    };
    sheet.querySelector('.sheet-close').addEventListener('click', dismiss);
    sheet.addEventListener('click', (e) => { if (e.target === sheet) dismiss(); });
    return { el: sheet, close, dismiss };
  }

  return { open };
})();
