const AppShare = (() => {
  function collectText(node) {
    if (!node) return '';
    if (node.type === 'text' || node.type === 'span') {
      if (node.contents) return node.contents.map(collectText).join('');
      return node.text || '';
    }
    if (node.contents) return node.contents.map(collectText).join(' ').replace(/\s+/g, ' ').trim();
    return '';
  }

  function walkPreviewLines(node, lines) {
    if (!node) return;
    if (node.type === 'separator') { lines.push('---'); return; }
    if (node.type === 'text') { lines.push(collectText(node)); return; }
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

  const HEADER_COLORS = {
    1: { bg: '#FDEDEB', text: '#D93025' }, // 赤: 要確認
    2: { bg: '#FFF6E5', text: '#C9862B' }, // 黄: イベント近し
  };

  function applyComment(flex, comment, presetIndex) {
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    const color = HEADER_COLORS[presetIndex];

    if (bubble.header) {
      if (color) {
        bubble.header.backgroundColor = color.bg;
        (bubble.header.contents || []).forEach((c) => {
          if (c.type === 'text' && !c.contents) c.color = color.text;
        });
      }
      if (comment) {
        bubble.header.contents.push({
          type: 'text', text: comment, size: 'sm', wrap: true, margin: 'sm',
          color: color ? color.text : '#8C8C8C',
        });
      }
      return { altText: flex.altText, contents: bubble };
    }

    if (!comment) return flex;
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

  function filterGroups(flex, unselectedAnswers) {
    if (!unselectedAnswers || !unselectedAnswers.length) return flex;
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    removeRowsByLabel(bubble.body, unselectedAnswers);
    return { altText: flex.altText, contents: bubble };
  }

  function showPreviewModal(flex, opts) {
    const presets = (opts && opts.presets) || [];
    const defaultIndex = (opts && opts.defaultPresetIndex) || 0;
    const groups = (opts && opts.groups) || null;
    const groupAnswers = groups ? ['○', '△', '×'].filter((a) => groups[a] && groups[a].length) : [];
    return new Promise((resolve) => {
      const linesFor = (unselectedAnswers) => buildPreviewLines(filterGroups(flex, unselectedAnswers));
      const lines = linesFor([]);
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
          ${groupAnswers.length ? `
            <p class="event-meta">送信対象</p>
            <div class="preview-group-select">
              ${groupAnswers.map((a) => `
                <label class="preview-checkbox-label">
                  <input type="checkbox" class="preview-group-check" data-answer="${a}" checked>
                  ${a}（${groups[a].length}人）
                </label>`).join('')}
            </div>` : ''}
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

      const previewBox = overlay.querySelector('.flex-preview');
      const renderPreview = () => {
        const checked = overlay.querySelectorAll('.preview-group-check:checked');
        const allChecked = overlay.querySelectorAll('.preview-group-check');
        const unselectedAnswers = allChecked.length
          ? Array.from(allChecked).filter((cb) => !cb.checked).map((cb) => cb.dataset.answer)
          : [];
        if (allChecked.length && !checked.length) {
          previewBox.innerHTML = '<p class="flex-preview-line">送信先が選択されていません</p>';
          return;
        }
        previewBox.innerHTML = linesFor(unselectedAnswers).map((l) => l === '---'
          ? '<hr class="flex-preview-sep">'
          : `<p class="flex-preview-line">${AppUtil.escapeHtml(l)}</p>`).join('');
      };
      overlay.querySelectorAll('.preview-group-check').forEach((cb) => {
        cb.addEventListener('change', renderPreview);
      });

      const textarea = overlay.querySelector('#preview-comment');
      let presetIndex = presets.length ? defaultIndex : null;
      overlay.querySelectorAll('.preset-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          overlay.querySelectorAll('.preset-chip').forEach((c) => c.classList.toggle('selected', c === chip));
          presetIndex = Number(chip.dataset.index);
          textarea.value = presets[presetIndex];
        });
      });

      const close = (result) => { overlay.remove(); resolve(result); };
      overlay.querySelector('.modal-close').addEventListener('click', () => close(null));
      overlay.querySelector('#preview-cancel').addEventListener('click', () => close(null));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
      overlay.querySelector('#preview-confirm').addEventListener('click', () => {
        const groupChecks = overlay.querySelectorAll('.preview-group-check');
        const unselectedAnswers = Array.from(groupChecks).filter((cb) => !cb.checked).map((cb) => cb.dataset.answer);
        if (groupChecks.length && unselectedAnswers.length === groupChecks.length) {
          alert('連絡先を1つ以上選択してください');
          return;
        }
        close({
          comment: textarea.value.trim(),
          unselectedAnswers,
          presetIndex,
        });
      });
    });
  }

  async function sendFlexMessage(flex, opts) {
    const result = await showPreviewModal(flex, opts);
    if (result === null) return false;

    let finalFlex = filterGroups(flex, result.unselectedAnswers);
    finalFlex = applyComment(finalFlex, result.comment, result.presetIndex);
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

  const REMIND_PRESETS = ['回答ありがとうございます', '回答の更新をお願いします', 'イベントが近づいています'];

  async function remindRespondents(params) {
    const flex = await AppApi.buildReminderFlex(params);
    const hasMaybe = !!(params.groups && params.groups['△'] && params.groups['△'].length);
    const defaultPresetIndex = hasMaybe ? 1 : 0;
    return sendFlexMessage(flex, { closeAfter: false, presets: REMIND_PRESETS, defaultPresetIndex, groups: params.groups });
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
