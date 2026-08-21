const AppShare = (() => {
  const ANSWER_CLASS = { '○': 'choice-ok', '△': 'choice-maybe', '×': 'choice-ng' };

  function collectText(node) {
    if (!node) return '';
    if (node.type === 'text' || node.type === 'span') {
      if (node.contents) return node.contents.map(collectText).join('');
      return node.text || '';
    }
    if (node.contents) return node.contents.map(collectText).join(' ').replace(/\s+/g, ' ').trim();
    return '';
  }

  const BUTTON_LINE_PREFIX = ' BTN ';
  const TITLE_LINE_PREFIX = ' TTL ';
  const PILL_ROW_PREFIX = ' PILLROW ';
  const CARD_START = ' CARDSTART ';
  const CARD_END = ' CARDEND ';
  const ANSWER_LINE_PREFIX = { '○': ' ANSok ', '△': ' ANSmb ', '×': ' ANSng ' };
  const ANSWER_SYMBOLS = ['○', '△', '×'];

  function answerSymbolOf(label) {
    if (!label) return null;
    return ANSWER_SYMBOLS.find((a) => label.startsWith(a)) || null;
  }

  function isPillGroupBox(node) {
    return node && node.type === 'box' && node.layout === 'horizontal' && Array.isArray(node.contents)
      && node.contents.every((c) => c.type === 'box' && Array.isArray(c.contents) && c.contents[0]);
  }

  function walkPreviewLines(node, lines) {
    if (!node) return;
    if (node.type === 'separator') { lines.push('---'); return; }
    if (node.type === 'text') {
      const text = collectText(node);
      lines.push(node.weight === 'bold' ? TITLE_LINE_PREFIX + text : text);
      return;
    }
    if (node.type === 'button') { lines.push(BUTTON_LINE_PREFIX + node.action.label); return; }
    if (node.type === 'box') {
      if (node.action) { lines.push(BUTTON_LINE_PREFIX + collectText(node)); return; }
      if (node.layout === 'baseline' && node.contents && node.contents[1] && isPillGroupBox(node.contents[1])) {
        const label = node.contents[0] && node.contents[0].text;
        const pills = node.contents[1].contents.map((pillBox) => ({
          text: pillBox.contents[0].text,
          color: pillBox.contents[0].color,
          bg: pillBox.backgroundColor,
        }));
        lines.push(PILL_ROW_PREFIX + JSON.stringify({ label, pills }));
        return;
      }
      if (node.layout === 'horizontal' || node.layout === 'baseline') {
        const line = collectText(node);
        if (!line) return;
        const label = node.contents && node.contents[0] && node.contents[0].text;
        const ans = answerSymbolOf(label);
        const prefix = ans ? ANSWER_LINE_PREFIX[ans] : '';
        lines.push(prefix + line);
      } else if (node.contents) {
        const isCard = !!node.backgroundColor;
        if (isCard) lines.push(CARD_START);
        node.contents.forEach((c) => walkPreviewLines(c, lines));
        if (isCard) lines.push(CARD_END);
      }
    }
  }

  function buildPreviewLines(flex) {
    const lines = [];
    walkPreviewLines(flex.contents.body, lines);
    if (flex.contents.footer) walkPreviewLines(flex.contents.footer, lines);
    return lines;
  }

  const ANSWER_LINE_CLASS = { ' ANSok ': 'choice-ok', ' ANSmb ': 'choice-maybe', ' ANSng ': 'choice-ng' };

  function renderPreviewLinesHtml(lines) {
    return lines.map((l) => {
      if (l === CARD_START) return '<div class="flex-preview-card">';
      if (l === CARD_END) return '</div>';
      if (l === '---') return '<hr class="flex-preview-sep">';
      if (l.startsWith(BUTTON_LINE_PREFIX)) {
        return `<div class="flex-preview-button">${AppUtil.escapeHtml(l.slice(BUTTON_LINE_PREFIX.length))}</div>`;
      }
      if (l.startsWith(TITLE_LINE_PREFIX)) {
        return `<p class="flex-preview-line flex-preview-title">${AppUtil.escapeHtml(l.slice(TITLE_LINE_PREFIX.length))}</p>`;
      }
      if (l.startsWith(PILL_ROW_PREFIX)) {
        const { label, pills } = JSON.parse(l.slice(PILL_ROW_PREFIX.length));
        const pillsHtml = pills.map((p) => `<span class="flex-preview-pill" style="background:${p.bg};color:${p.color}">${AppUtil.escapeHtml(p.text)}</span>`).join('');
        return `<div class="flex-preview-line flex-preview-pill-row"><span class="flex-preview-pill-row-label">${AppUtil.escapeHtml(label)}</span>${pillsHtml}</div>`;
      }
      const ansPrefix = Object.keys(ANSWER_LINE_CLASS).find((p) => l.startsWith(p));
      if (ansPrefix) {
        return `<p class="flex-preview-line flex-preview-answer ${ANSWER_LINE_CLASS[ansPrefix]}">${AppUtil.escapeHtml(l.slice(ansPrefix.length))}</p>`;
      }
      return `<p class="flex-preview-line">${AppUtil.escapeHtml(l)}</p>`;
    }).join('');
  }

  const HEADER_COLORS = {
    0: { bg: '#EAF0FE', text: '#4F46E5' }, // 青: 回答ありがとう
    1: { bg: '#FDEDEB', text: '#D93025' }, // 赤: 要確認
    2: { bg: '#FFF6E5', text: '#C9862B' }, // 黄: イベント近し
  };

  function applyComment(flex, comment, presetIndex, presetLabel) {
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    const color = HEADER_COLORS[presetIndex];

    if (bubble.header) {
      if (color) {
        bubble.header.backgroundColor = color.bg;
        (bubble.header.contents || []).forEach((c) => {
          if (c.type === 'text' && !c.contents) c.color = color.text;
        });
      }
      if (presetLabel) {
        bubble.header.contents.push({
          type: 'text', text: presetLabel, size: 'sm', wrap: true, margin: 'sm',
          color: color ? color.text : '#8C8C8C',
        });
      }
      if (comment) {
        bubble.header.contents.push({
          type: 'text', text: comment, size: 'xs', wrap: true, margin: 'xs',
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
      const ans = answerSymbolOf(label);
      return !(ans && labels.includes(ans));
    });
    node.contents.forEach((child) => removeRowsByLabel(child, labels));
  }

  function filterGroups(flex, unselectedAnswers) {
    if (!unselectedAnswers || !unselectedAnswers.length) return flex;
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    removeRowsByLabel(bubble.body, unselectedAnswers);
    return { altText: flex.altText, contents: bubble };
  }

  function mergeHiddenRows(node, hiddenAnswers) {
    if (!node || !node.contents) return;
    const idxs = [];
    node.contents.forEach((child, i) => {
      const label = child.type === 'box' && child.layout === 'baseline' && child.contents && child.contents[0]
        ? child.contents[0].text : null;
      const ans = answerSymbolOf(label);
      if (ans && hiddenAnswers.includes(ans)) idxs.push(i);
    });
    if (idxs.length) {
      const pills = idxs.map((i) => {
        const row = node.contents[i];
        const label = row.contents[0].text;
        const color = row.contents[0].color;
        return {
          type: 'box',
          layout: 'vertical',
          backgroundColor: row.backgroundColor,
          cornerRadius: 'md',
          paddingAll: 'xs',
          contents: [{ type: 'text', text: label, size: 'xs', weight: 'bold', color, align: 'center' }],
        };
      });
      const combinedRow = {
        type: 'box',
        layout: 'baseline',
        spacing: 'sm',
        contents: [
          { type: 'text', text: '対象', size: 'sm', color: '#8C8C8C', flex: 2 },
          { type: 'box', layout: 'horizontal', flex: 5, spacing: 'xs', contents: pills },
        ],
      };
      node.contents[idxs[0]] = combinedRow;
      idxs.slice(1).reverse().forEach((i) => node.contents.splice(i, 1));
      return;
    }
    node.contents.forEach((child) => mergeHiddenRows(child, hiddenAnswers));
  }

  function hideNames(flex, hiddenAnswers) {
    if (!hiddenAnswers || !hiddenAnswers.length) return flex;
    const bubble = JSON.parse(JSON.stringify(flex.contents));
    mergeHiddenRows(bubble.body, hiddenAnswers);
    return { altText: flex.altText, contents: bubble };
  }

  function showPreviewModal(flex, opts) {
    const presets = (opts && opts.presets) || [];
    const defaultIndex = (opts && opts.defaultPresetIndex) || 0;
    const groups = (opts && opts.groups) || null;
    const groupAnswers = groups ? ['○', '△', '×'].filter((a) => groups[a] && groups[a].length) : [];
    const headerNode = flex.contents.header;
    const headerTitleNode = headerNode && headerNode.contents && headerNode.contents[0];
    const headerTitle = headerTitleNode ? headerTitleNode.text : null;
    return new Promise((resolve) => {
      let presetIndex = presets.length ? defaultIndex : null;
      let commentText = '';
      let sendAsChat = true;
      const linesFor = (unselectedAnswers, hiddenAnswers) => buildPreviewLines(applyComment(
        hideNames(filterGroups(flex, unselectedAnswers), hiddenAnswers),
        sendAsChat ? '' : commentText, presetIndex, presetIndex != null ? presets[presetIndex] : null
      ));
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
          <div class="flex-preview-wrap">
            ${headerTitle ? `
              <div class="preview-header-banner" id="preview-header-banner">
                <strong>${AppUtil.escapeHtml(headerTitle)}</strong>
                <span id="preview-header-label"></span>
                <span id="preview-header-comment"></span>
              </div>` : ''}
            <div class="flex-preview">
              ${renderPreviewLinesHtml(lines)}
            </div>
            <div class="preview-chat-bubble" id="preview-chat-bubble" hidden></div>
          </div>
          ${presets.length ? `
            <p class="event-meta">送信ヘッダー（任意）</p>
            <div class="preset-chip-row">
              ${presets.map((p, i) => `<button type="button" class="preset-chip${i === defaultIndex ? ' selected' : ''}" data-index="${i}">${AppUtil.escapeHtml(p)}</button>`).join('')}
            </div>` : ''}
          ${groupAnswers.length ? `
            <div class="preview-section-header">
              <p class="event-meta">送信対象</p>
              <label class="preview-checkbox-label-inline">
                <input type="checkbox" id="preview-hide-names">
                名前を隠す（人数のみ表示）
              </label>
            </div>
            <div class="preview-group-select">
              ${groupAnswers.map((a) => `
                <button type="button" class="answer-toggle-chip ${ANSWER_CLASS[a]} selected" data-answer="${a}">${a} ${groups[a].length}人</button>`).join('')}
            </div>` : ''}
          <label class="preview-comment-label">
            コメントを追加（任意）
            <textarea id="preview-comment" rows="2" class="preview-comment-input" placeholder="自由にコメントを入力できます"></textarea>
          </label>
          <label class="preview-checkbox-label-inline">
            <input type="checkbox" id="preview-comment-as-chat" checked>
            コメントをチャット形式で送信する（OFFでカードに埋め込む）
          </label>
          <div class="option-edit-actions" style="margin-top:12px">
            <button type="button" class="btn btn-primary" id="preview-confirm">送信先を選ぶ</button>
            <button type="button" class="btn" id="preview-cancel">キャンセル</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const previewBox = overlay.querySelector('.flex-preview');
      const hideNamesCheckbox = overlay.querySelector('#preview-hide-names');
      const renderPreview = () => {
        const allChips = overlay.querySelectorAll('.answer-toggle-chip');
        const selectedChips = Array.from(overlay.querySelectorAll('.answer-toggle-chip.selected'));
        const unselectedAnswers = allChips.length
          ? Array.from(allChips).filter((c) => !c.classList.contains('selected')).map((c) => c.dataset.answer)
          : [];
        if (allChips.length && !selectedChips.length) {
          previewBox.innerHTML = '<p class="flex-preview-line">送信先が選択されていません</p>';
          return;
        }
        const hiddenAnswers = hideNamesCheckbox && hideNamesCheckbox.checked
          ? selectedChips.map((c) => c.dataset.answer)
          : [];
        previewBox.innerHTML = renderPreviewLinesHtml(linesFor(unselectedAnswers, hiddenAnswers));
      };
      overlay.querySelectorAll('.answer-toggle-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          chip.classList.toggle('selected');
          renderPreview();
        });
      });
      if (hideNamesCheckbox) hideNamesCheckbox.addEventListener('change', renderPreview);

      const textarea = overlay.querySelector('#preview-comment');
      const banner = overlay.querySelector('#preview-header-banner');
      const bannerLabel = overlay.querySelector('#preview-header-label');
      const bannerComment = overlay.querySelector('#preview-header-comment');
      const chatCheckbox = overlay.querySelector('#preview-comment-as-chat');
      const chatBubble = overlay.querySelector('#preview-chat-bubble');
      const updateBanner = () => {
        if (!banner) return;
        const color = HEADER_COLORS[presetIndex];
        banner.style.background = color ? color.bg : '';
        banner.style.color = color ? color.text : '';
        if (bannerLabel) bannerLabel.textContent = presetIndex != null ? presets[presetIndex] : '';
        if (bannerComment) bannerComment.textContent = sendAsChat ? '' : commentText;
      };
      const updateChatBubble = () => {
        if (!chatBubble) return;
        const show = !!commentText && sendAsChat;
        chatBubble.hidden = !show;
        if (show) chatBubble.textContent = commentText;
      };
      textarea.addEventListener('input', () => {
        commentText = textarea.value.trim();
        updateBanner();
        updateChatBubble();
        renderPreview();
      });
      if (chatCheckbox) chatCheckbox.addEventListener('change', () => {
        sendAsChat = chatCheckbox.checked;
        updateBanner();
        updateChatBubble();
        renderPreview();
      });
      const paintChips = () => {
        overlay.querySelectorAll('.preset-chip').forEach((chip) => {
          const idx = Number(chip.dataset.index);
          const isSelected = idx === presetIndex;
          const color = HEADER_COLORS[idx];
          chip.classList.toggle('selected', isSelected);
          if (isSelected && color) {
            chip.style.background = color.text;
            chip.style.borderColor = color.text;
            chip.style.color = '#fff';
          } else {
            chip.style.background = '';
            chip.style.borderColor = '';
            chip.style.color = '';
          }
        });
      };
      updateBanner();
      updateChatBubble();
      paintChips();
      overlay.querySelectorAll('.preset-chip').forEach((chip) => {
        chip.addEventListener('click', () => {
          const isSame = Number(chip.dataset.index) === presetIndex;
          presetIndex = isSame ? null : Number(chip.dataset.index);
          updateBanner();
          renderPreview();
          paintChips();
        });
      });

      const close = (result) => { overlay.remove(); resolve(result); };
      overlay.querySelector('.modal-close').addEventListener('click', () => close(null));
      overlay.querySelector('#preview-cancel').addEventListener('click', () => close(null));
      overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
      overlay.querySelector('#preview-confirm').addEventListener('click', () => {
        const allChips = overlay.querySelectorAll('.answer-toggle-chip');
        const selectedChips = Array.from(allChips).filter((c) => c.classList.contains('selected'));
        const unselectedAnswers = Array.from(allChips).filter((c) => !c.classList.contains('selected')).map((c) => c.dataset.answer);
        if (allChips.length && !selectedChips.length) {
          alert('連絡先を1つ以上選択してください');
          return;
        }
        const hiddenAnswers = hideNamesCheckbox && hideNamesCheckbox.checked
          ? selectedChips.map((c) => c.dataset.answer)
          : [];
        close({
          comment: textarea.value.trim(),
          sendAsChat,
          unselectedAnswers,
          hiddenAnswers,
          presetIndex,
          presetLabel: presetIndex != null ? presets[presetIndex] : null,
        });
      });
    });
  }

  async function sendFlexMessage(flex, opts) {
    const result = await showPreviewModal(flex, opts);
    if (result === null) return false;

    let finalFlex = filterGroups(flex, result.unselectedAnswers);
    finalFlex = hideNames(finalFlex, result.hiddenAnswers);
    finalFlex = applyComment(finalFlex, result.sendAsChat ? '' : result.comment, result.presetIndex, result.presetLabel);
    const messages = [{
      type: 'flex',
      altText: finalFlex.altText,
      contents: finalFlex.contents,
    }];
    if (result.comment && result.sendAsChat) {
      messages.push({ type: 'text', text: result.comment });
    }

    let available = false;
    try {
      available = window.liff && typeof liff.isApiAvailable === 'function' && liff.isApiAvailable('shareTargetPicker');
    } catch (err) {
      available = false;
    }

    if (available) {
      const pickerResult = await liff.shareTargetPicker(messages);
      console.log('shareTargetPicker result', pickerResult);
      if (pickerResult && pickerResult.status === 'cancel') {
        return false;
      }
      if ((!opts || opts.closeAfter !== false) && liff.isInClient && liff.isInClient()) {
        liff.closeWindow();
      }
      return true;
    }

    console.warn('shareTargetPicker は利用できません（LIFF外またはローカルプレビュー）。生成されたメッセージを表示します。', messages);
    alert('この環境では共有できません（LINEアプリ内のLIFFでのみ動作します）。コンソールに送信内容を出力しました。');
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

  async function shareApp() {
    const config = await AppConfig.load();
    const liffUrl = config.liffId ? `https://liff.line.me/${config.liffId}` : '';
    const flex = {
      altText: 'Botの追加なしで日程調整ができるアプリです',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          paddingBottom: 'md',
          contents: [
            { type: 'text', text: '🗓️ 日程調整', weight: 'bold', size: 'lg', color: '#111111' },
            {
              type: 'text', size: 'sm', color: '#8C8C8C', wrap: true, margin: 'md',
              text: 'Botの追加なしで、候補日をつくって共有するだけ。○△×で回答が集まります。',
            },
          ],
        },
        footer: liffUrl ? {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          paddingAll: 'lg',
          contents: [{
            type: 'box',
            layout: 'vertical',
            backgroundColor: '#4F46E5',
            cornerRadius: 'xxl',
            paddingAll: 'md',
            action: { type: 'uri', label: '使ってみる', uri: liffUrl },
            contents: [{ type: 'text', text: '使ってみる', color: '#ffffff', align: 'center', weight: 'bold', size: 'md' }],
          }],
        } : undefined,
        styles: liffUrl ? { footer: { separator: true, separatorColor: '#EEEEEE' } } : undefined,
      },
    };
    return sendFlexMessage(flex, { closeAfter: false });
  }

  return { shareEvent, remindRespondents, inviteEditor, notifyChange, shareApp };
})();
