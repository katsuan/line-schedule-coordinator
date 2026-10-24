/**
 * LINE送信前の「送信内容プレビュー」（下から出るシート。js/views/sheet.js）。js/share.js から切り出した独立UIコンポーネント。
 * Flexツリーの変換自体は js/flexPreview.js (FlexPreview) を参照。
 */
const PreviewModal = (() => {
  const ANSWER_CLASS = { '○': 'choice-ok', '△': 'choice-maybe', '×': 'choice-ng' };

  function show(flex, opts) {
    const presets = (opts && opts.presets) || [];
    const defaultIndex = (opts && opts.defaultPresetIndex) || 0;
    const groups = (opts && opts.groups) || null;
    const groupAnswers = groups ? ['○', '△', '×'].filter((a) => groups[a] && groups[a].length) : [];
    const target = (opts && opts.target) || null;
    const canSend = !opts || opts.canSend !== false; // LINE の送り先を選ぶ画面が使えるか（使えないときは理由と「LINE アプリで開く」）
    const headerNode = flex.contents.header;
    const headerTitleNode = headerNode && headerNode.contents && headerNode.contents[0];
    const headerTitle = headerTitleNode ? headerTitleNode.text : null;
    return new Promise((resolve) => {
      let presetIndex = presets.length ? defaultIndex : null;
      let commentText = '';
      let sendAsChat = true;
      const linesFor = (unselectedAnswers, hiddenAnswers) => FlexPreview.buildPreviewLines(FlexPreview.applyComment(
        FlexPreview.hideNames(FlexPreview.filterGroups(flex, unselectedAnswers), hiddenAnswers),
        sendAsChat ? '' : commentText, presetIndex, presetIndex != null ? presets[presetIndex] : null
      ));
      const lines = linesFor([]);
      const sheet = Sheet.open({
        title: '送る内容の見本',
        onDismiss: () => resolve(null),
        bodyHtml: `
          ${canSend ? '' : `<p class="ls-outside-text preview-outside">ここでは見本だけ。送るときは下から開いてね。</p>`}
          <p class="event-meta">※実際の見え方は端末によって異なります</p>
          <p class="preview-scope-label">👇 プレビュー範囲（実際に送信される内容）</p>
          <div class="preview-scope">
            <div class="flex-preview-wrap">
              ${headerTitle ? `
                <div class="preview-header-banner" id="preview-header-banner">
                  <strong>${AppUtil.escapeHtml(headerTitle)}</strong>
                  <span id="preview-header-label"></span>
                  <span id="preview-header-comment"></span>
                </div>` : ''}
              <div class="flex-preview">
                ${FlexPreview.renderPreviewLinesHtml(lines)}
              </div>
            </div>
            <div class="preview-chat-bubble" id="preview-chat-bubble" hidden></div>
          </div>
          ${presets.length ? `
            <div class="ls-field">
              <span class="ls-label">送信ヘッダー（任意）</span>
              <div class="ls-chips">
                ${presets.map((p, i) => `<button type="button" class="ls-chip is-small preset-chip" data-index="${i}" aria-pressed="false">${AppUtil.escapeHtml(p)}</button>`).join('')}
              </div>
            </div>` : ''}
          ${groupAnswers.length ? `
            <div class="ls-field">
              <div class="preview-section-header">
                <span class="ls-label">回答者</span>
                <label class="preview-checkbox-label-inline">
                  <input type="checkbox" id="preview-hide-names">
                  名前を隠す（人数のみ表示）
                </label>
              </div>
              <div class="preview-group-select">
                ${groupAnswers.map((a) => `
                  <button type="button" class="answer-toggle-chip ${ANSWER_CLASS[a]} selected" data-answer="${a}">${a} ${groups[a].length}人</button>`).join('')}
              </div>
            </div>` : ''}
          <label class="ls-field">
            <span class="ls-label">コメントを追加（任意）</span>
            <textarea id="preview-comment" rows="2" class="ls-input is-short" placeholder="自由にコメントを入力できます"></textarea>
          </label>
          <label class="preview-checkbox-label-inline">
            <input type="checkbox" id="preview-comment-as-chat" checked>
            コメントをチャット形式で送信する（OFFでカードに埋め込む）
          </label>
          ${canSend && target && target.note ? `<p class="event-meta">${AppUtil.escapeHtml(target.note)}</p>` : ''}
          <div class="ls-sheet-actions${canSend && !(target && target.displayName) ? '' : ' is-stacked'}">
            ${canSend ? `
              <button type="button" class="ls-button line is-oqrn" id="preview-confirm">
                ${target && target.displayName ? `${AppUtil.avatarHtml(target.displayName, target.pictureUrl)}${AppUtil.escapeHtml(target.displayName)} に送る` : 'カードで送る'}
              </button>` : (opts.appUrl ? `<a class="ls-button is-primary" href="${AppUtil.escapeHtml(opts.appUrl)}">💬 LINE 版で開く</a>` : '')}
            <button type="button" class="ls-sheet-cancel" id="preview-cancel">やめる</button>
          </div>`,
      });
      const overlay = sheet.el; // シートの外側（中身をここから探す）

      const previewBox = overlay.querySelector('.flex-preview');
      const hideNamesCheckbox = overlay.querySelector('#preview-hide-names');
      // ○△× のチップで外した答え（送らない）と、名前を隠す答え
      const answerFilter = () => {
        const chips = Array.from(overlay.querySelectorAll('.answer-toggle-chip'));
        const unselectedAnswers = chips.filter((c) => !c.classList.contains('selected')).map((c) => c.dataset.answer);
        const hiddenAnswers = hideNamesCheckbox && hideNamesCheckbox.checked
          ? chips.filter((c) => c.classList.contains('selected')).map((c) => c.dataset.answer)
          : [];
        return { unselectedAnswers, hiddenAnswers };
      };
      const renderPreview = () => {
        const { unselectedAnswers, hiddenAnswers } = answerFilter();
        previewBox.innerHTML = FlexPreview.renderPreviewLinesHtml(linesFor(unselectedAnswers, hiddenAnswers));
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
        const color = FlexPreview.headerColorFor(presetIndex);
        banner.style.background = color.bg;
        banner.style.color = color.text;
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
      // 選んだ送信ヘッダーのチップは、そのヘッダーの色で塗る
      const paintChips = () => {
        overlay.querySelectorAll('.preset-chip').forEach((chip) => {
          const idx = Number(chip.dataset.index);
          const isSelected = idx === presetIndex;
          const color = FlexPreview.headerColorFor(idx);
          chip.setAttribute('aria-pressed', String(isSelected));
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

      const close = (result) => { sheet.close(); resolve(result); };
      overlay.querySelector('#preview-cancel').addEventListener('click', sheet.dismiss);
      const confirmBtn = overlay.querySelector('#preview-confirm');
      if (confirmBtn) confirmBtn.addEventListener('click', () => {
        close({
          comment: textarea.value.trim(),
          sendAsChat,
          ...answerFilter(),
          presetIndex,
          presetLabel: presetIndex != null ? presets[presetIndex] : null,
        });
      });
    });
  }

  return { show };
})();
