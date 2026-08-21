/**
 * LINEへの送信フロー（プレビューモーダル＋shareTargetPicker呼び出し）。
 * Flexツリーの変換・プレビュー用テキスト生成は js/flexPreview.js (FlexPreview) を参照。
 */
const AppShare = (() => {
  const ANSWER_CLASS = { '○': 'choice-ok', '△': 'choice-maybe', '×': 'choice-ng' };

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
      const linesFor = (unselectedAnswers, hiddenAnswers) => FlexPreview.buildPreviewLines(FlexPreview.applyComment(
        FlexPreview.hideNames(FlexPreview.filterGroups(flex, unselectedAnswers), hiddenAnswers),
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
            <p class="event-meta">送信ヘッダー（任意）</p>
            <div class="preset-chip-row">
              ${presets.map((p, i) => `<button type="button" class="preset-chip${i === defaultIndex ? ' selected' : ''}" data-index="${i}">${AppUtil.escapeHtml(p)}</button>`).join('')}
            </div>` : ''}
          ${groupAnswers.length ? `
            <div class="preview-section-header">
              <p class="event-meta">回答者</p>
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
      const paintChips = () => {
        overlay.querySelectorAll('.preset-chip').forEach((chip) => {
          const idx = Number(chip.dataset.index);
          const isSelected = idx === presetIndex;
          const color = FlexPreview.headerColorFor(idx);
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

    let finalFlex = FlexPreview.filterGroups(flex, result.unselectedAnswers);
    finalFlex = FlexPreview.hideNames(finalFlex, result.hiddenAnswers);
    finalFlex = FlexPreview.applyComment(finalFlex, result.sendAsChat ? '' : result.comment, result.presetIndex, result.presetLabel);
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
