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

  function removeRowsByLabel(node, labels) {
    if (!node || !node.contents) return;
    node.contents = node.contents.filter((child) => {
      const label = child.type === 'box' && child.layout === 'baseline' && child.contents && child.contents[0]
        ? child.contents[0].text : null;
      return !labels.includes(label);
    });
    node.contents.forEach((child) => removeRowsByLabel(child, labels));
  }

  function stripRecipientInfo(flex) {
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    removeRowsByLabel(bubble.body, ['宛先']);
    return { altText: flex.altText.replace(/^.+?への連絡/, '連絡'), contents: bubble };
  }

  function showPreviewModal(flex, opts) {
    const presets = (opts && opts.presets) || [];
    const defaultIndex = (opts && opts.defaultPresetIndex) || 0;
    const allowHideRecipients = !!(opts && opts.allowHideRecipients);
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
          ${allowHideRecipients ? `
            <label class="preview-checkbox-label">
              <input type="checkbox" id="preview-hide-recipients">
              宛先の名前を隠して送信する（グループ転送などを想定する場合）
            </label>` : ''}
          <label class="preview-comment-label">
            コメントを追加（任意）
            ${presets.length ? `
              <div class="preset-chip-row">
                ${presets.map((p, i) => `<button type="button" class="preset-chip${i === defaultIndex ? ' selected' : ''}" data-index="${i}">${AppUtil.escapeHtml(p)}</button>`).join('')}
              </div>` : ''}
            <textarea id="preview-comment" rows="2" class="preview-comment-input">${AppUtil.escapeHtml(presets[defaultIndex] || '')}</textarea>
          </label>
          <div class="option-edit-actions" style="margin-top:12px">
            <button type="button" class="btn btn-primary" id="preview-confirm">送信先を選ぶ</button>
            <button type="button" class="btn" id="preview-cancel">キャンセル</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const textarea = overlay.querySelector('#preview-comment');
      overlay.querySelectorAll('.preset-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          overlay.querySelectorAll('.preset-chip').forEach((c) => c.classList.toggle('selected', c === chip));
          textarea.value = presets[Number(chip.dataset.index)];
        });
      });

      const close = (result) => { overlay.remove(); resolve(result); };
      overlay.querySelector('.modal-close').addEventListener('click', () => close(null));
      overlay.querySelector('#preview-cancel').addEventListener('click', () => close(null));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
      overlay.querySelector('#preview-confirm').addEventListener('click', () => {
        const hideCheckbox = overlay.querySelector('#preview-hide-recipients');
        close({ comment: textarea.value.trim(), hideRecipients: !!(hideCheckbox && hideCheckbox.checked) });
      });
    });
  }

  async function sendFlexMessage(flex, opts) {
    const result = await showPreviewModal(flex, opts);
    if (result === null) return false;

    let finalFlex = result.hideRecipients ? stripRecipientInfo(flex) : flex;
    finalFlex = injectComment(finalFlex, result.comment);
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

    console.warn('shareTargetPicker は利用できません。生成されたFlexを表示します。', message);
    const inClient = window.liff && typeof liff.isInClient === 'function' && liff.isInClient();
    alert(inClient
      ? 'この環境では共有できません。LINE Developers ConsoleのLIFFアプリ設定で「Share target picker」のScopeが有効になっているか確認してください。'
      : 'この環境では共有できません（LINEアプリ内のLIFFでのみ動作します）。コンソールにFlex内容を出力しました。');
    return false;
  }

  async function shareEvent(eventId) {
    const flex = await AppApi.buildShareFlex({ eventId });
    return sendFlexMessage(flex);
  }

  const REMIND_PRESETS = ['回答ありがとうございます', '回答の更新をお願いします', 'イベントが近づいています'];

  async function remindRespondents(params) {
    const flex = await AppApi.buildReminderFlex(params);
    const defaultPresetIndex = params.answerLabel === '△' ? 1 : 0;
    return sendFlexMessage(flex, { closeAfter: false, presets: REMIND_PRESETS, defaultPresetIndex, allowHideRecipients: true });
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
