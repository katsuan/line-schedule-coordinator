const AppShare = (() => {
  function collectText(node) {
    if (!node) return '';
    if (node.type === 'text') return node.text || '';
    if (node.contents) return node.contents.map(collectText).join(' ').replace(/\s+/g, ' ').trim();
    return '';
  }

  function walkPreviewLines(node, lines) {
    if (!node) return;
    if (node.type === 'separator') { lines.push('---'); return; }
    if (node.type === 'text') { lines.push(node.text); return; }
    if (node.type === 'button') { lines.push('▶ ' + node.action.label); return; }
    if (node.type === 'box') {
      if (node.layout === 'horizontal' || node.layout === 'baseline') {
        const line = collectText(node);
        if (line) lines.push(line);
      } else if (node.contents) {
        node.contents.forEach((c) => walkPreviewLines(c, lines));
      }
    }
  }

  function buildPreviewLines(flex) {
    const lines = [];
    walkPreviewLines(flex.contents.body, lines);
    if (flex.contents.footer) walkPreviewLines(flex.contents.footer, lines);
    return lines;
  }

  function injectComment(flex, comment) {
    if (!comment) return flex;
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    bubble.body.contents.push(
      { type: 'separator', margin: 'md' },
      {
        type: 'box',
        layout: 'vertical',
        margin: 'md',
        contents: [
          { type: 'text', text: '💬 コメント', size: 'xs', color: '#8C8C8C' },
          { type: 'text', text: comment, size: 'sm', color: '#111111', wrap: true, margin: 'xs' },
        ],
      }
    );
    return { altText: flex.altText, contents: bubble };
  }

  function showPreviewModal(flex) {
    return new Promise((resolve) => {
      const lines = buildPreviewLines(flex);
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-box">
          <div class="modal-header">
            <h2 style="margin:0">送信内容プレビュー</h2>
            <button type="button" class="modal-close" aria-label="閉じる">×</button>
          </div>
          <p class="event-meta">※実際の見え方は端末によって異なります</p>
          <div class="flex-preview">
            ${lines.map((l) => l === '---'
              ? '<hr class="flex-preview-sep">'
              : `<p class="flex-preview-line">${AppUtil.escapeHtml(l)}</p>`).join('')}
          </div>
          <label class="preview-comment-label">
            コメントを追加（任意）
            <textarea id="preview-comment" rows="2" class="preview-comment-input"></textarea>
          </label>
          <div class="option-edit-actions" style="margin-top:12px">
            <button type="button" class="btn btn-primary" id="preview-confirm">送信先を選ぶ</button>
            <button type="button" class="btn" id="preview-cancel">キャンセル</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const close = (result) => { overlay.remove(); resolve(result); };
      overlay.querySelector('.modal-close').addEventListener('click', () => close(null));
      overlay.querySelector('#preview-cancel').addEventListener('click', () => close(null));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
      overlay.querySelector('#preview-confirm').addEventListener('click', () => {
        close(overlay.querySelector('#preview-comment').value.trim());
      });
    });
  }

  async function sendFlexMessage(flex, opts) {
    const comment = await showPreviewModal(flex);
    if (comment === null) return false;

    const finalFlex = injectComment(flex, comment);
    const message = {
      type: 'flex',
      altText: finalFlex.altText,
      contents: finalFlex.contents,
    };

    let available = false;
    try {
      available = window.liff && typeof liff.isApiAvailable === 'function' && liff.isApiAvailable('shareTargetPicker');
    } catch (err) {
      available = false;
    }

    if (available) {
      const result = await liff.shareTargetPicker([message]);
      console.log('shareTargetPicker result', result);
      if (result && result.status === 'cancel') {
        return false;
      }
      if ((!opts || opts.closeAfter !== false) && liff.isInClient && liff.isInClient()) {
        liff.closeWindow();
      }
      return true;
    }

    console.warn('shareTargetPicker は利用できません（LIFF外またはローカルプレビュー）。生成されたFlexを表示します。', message);
    alert('この環境では共有できません（LINEアプリ内のLIFFでのみ動作します）。コンソールにFlex内容を出力しました。');
    return false;
  }

  async function shareEvent(eventId) {
    const flex = await AppApi.buildShareFlex({ eventId });
    return sendFlexMessage(flex);
  }

  async function remindRespondents(params) {
    const flex = await AppApi.buildReminderFlex(params);
    return sendFlexMessage(flex, { closeAfter: false });
  }

  async function inviteEditor(eventId) {
    const flex = await AppApi.buildEditorInviteFlex({ eventId });
    return sendFlexMessage(flex, { closeAfter: false });
  }

  async function notifyChange(params) {
    const flex = await AppApi.buildChangeNotificationFlex(params);
    return sendFlexMessage(flex, { closeAfter: false });
  }

  return { shareEvent, remindRespondents, inviteEditor, notifyChange };
})();
