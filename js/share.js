/**
 * LINEへの送信フロー（プレビューモーダル呼び出し＋shareTargetPicker/sendMessages送信）。
 * プレビューモーダルUI本体は js/views/previewModal.js (PreviewModal)、
 * Flexツリーの変換・プレビュー用テキスト生成は js/flexPreview.js (FlexPreview) を参照。
 */
const AppShare = (() => {
  async function sendFlexMessage(flex, opts) {
    const result = await PreviewModal.show(flex, opts);
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

  // 編集権限の依頼Flexを生成して送る（送信先は依頼者自身がピッカーで選ぶ＝作成者のトークへ）。
  // 「許可する」は作成者側でLIFFを開いてapproveEditRequestを叩くuriリンク（postbackはBotなし構成では使えないため不採用）。
  async function requestEditAccess(eventId, eventTitle, requester, creator) {
    const config = await AppConfig.load();
    const liffUrl = config.liffId ? `https://liff.line.me/${config.liffId}` : '';
    const approveUrl = liffUrl
      ? `${liffUrl}${liffUrl.indexOf('?') >= 0 ? '&' : '?'}event=${encodeURIComponent(eventId)}&approveEditor=1`
        + `&requesterId=${encodeURIComponent(requester.userId)}`
        + `&requesterName=${encodeURIComponent(requester.displayName || '')}`
        + `&requesterPic=${encodeURIComponent(requester.pictureUrl || '')}`
      : '';
    const flex = {
      altText: `${eventTitle} の編集権限を依頼します`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          paddingBottom: 'md',
          contents: [
            { type: 'text', text: '🔑 編集権限の依頼', weight: 'bold', size: 'lg', color: '#111111' },
            { type: 'text', text: eventTitle, size: 'sm', color: '#8C8C8C', wrap: true, margin: 'md' },
            {
              type: 'box', layout: 'baseline', spacing: 'sm', margin: 'md',
              contents: [
                { type: 'text', text: '依頼者', size: 'sm', color: '#8C8C8C', flex: 2 },
                { type: 'text', text: requester.displayName || '(名前未取得)', size: 'sm', color: '#111111', flex: 5, wrap: true },
              ],
            },
            {
              type: 'box', layout: 'baseline', spacing: 'sm', margin: 'sm',
              contents: [
                { type: 'text', text: '依頼先', size: 'sm', color: '#8C8C8C', flex: 2 },
                { type: 'text', text: creator.displayName || '(名前未取得)', size: 'sm', color: '#111111', flex: 5, wrap: true },
              ],
            },
          ],
        },
        footer: approveUrl ? {
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
            action: { type: 'uri', label: '許可する', uri: approveUrl },
            contents: [{ type: 'text', text: '許可する', color: '#ffffff', align: 'center', weight: 'bold', size: 'md' }],
          }],
        } : undefined,
        styles: approveUrl ? { footer: { separator: true, separatorColor: '#EEEEEE' } } : undefined,
      },
    };
    return sendFlexMessage(flex, {
      closeAfter: false,
      target: {
        displayName: creator.displayName,
        pictureUrl: creator.pictureUrl,
        note: '予定作成者に依頼を送信してください',
      },
    });
  }

  // sendMessagesにはchat_message.write権限が必要（shareTargetPickerと異なり、
  // ピッカーでの選択という同意ステップがないため）。未確定なら明示的にリクエストする。
  async function ensureSendMessagePermission_() {
    try {
      if (!window.liff || !liff.permission || typeof liff.permission.query !== 'function') return true;
      const result = await liff.permission.query('chat_message.write');
      if (!result) return true;
      if (result.state === 'granted') return true;
      if (result.state === 'prompt' && typeof liff.permission.requestAll === 'function') {
        await liff.permission.requestAll();
        const after = await liff.permission.query('chat_message.write');
        return !!(after && after.state === 'granted');
      }
      return false;
    } catch (err) {
      return false;
    }
  }

  // 承認直後、同じトークへそのまま一言返信する導線。
  // liffがチャット内で開かれている（sendMessagesが使える）場合はピッカーなしで直接送信し、
  // そうでなければshareTargetPickerで送信先を選んでもらう。
  async function replyInChat(text) {
    try {
      const sendAvailable = window.liff && liff.isApiAvailable && liff.isApiAvailable('sendMessages');
      if (sendAvailable) {
        const hasPermission = await ensureSendMessagePermission_();
        if (hasPermission) {
          await liff.sendMessages([{ type: 'text', text }]);
          if (liff.isInClient && liff.isInClient()) liff.closeWindow();
          return true;
        }
      }
    } catch (err) {
      console.warn('sendMessages に失敗したため送信先ピッカーにフォールバックします', err);
    }

    let pickerAvailable = false;
    try {
      pickerAvailable = window.liff && typeof liff.isApiAvailable === 'function' && liff.isApiAvailable('shareTargetPicker');
    } catch (err) {
      pickerAvailable = false;
    }
    if (pickerAvailable) {
      const result = await liff.shareTargetPicker([{ type: 'text', text }]);
      if (result && result.status === 'cancel') return false;
      if (liff.isInClient && liff.isInClient()) liff.closeWindow();
      return true;
    }

    alert('この環境では送信できません（LINEアプリ内のLIFFでのみ動作します）。');
    return false;
  }

  return { shareEvent, remindRespondents, inviteEditor, notifyChange, shareApp, requestEditAccess, replyInChat };
})();
