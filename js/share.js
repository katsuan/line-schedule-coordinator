/**
 * LINEへの送信フロー（プレビューモーダル呼び出し＋shareTargetPicker/sendMessages送信）。
 * プレビューモーダルUI本体は js/views/previewModal.js (PreviewModal)、
 * Flexツリーの変換・プレビュー用テキスト生成は js/flexPreview.js (FlexPreview) を参照。
 */
const AppShare = (() => {
  // LINE の送り先を選ぶ画面が使えるか（LIFF の準備前は例外を出すので、使えないあつかい）
  function canPickTarget() {
    try {
      return !!(window.liff && typeof liff.isApiAvailable === 'function' && liff.isApiAvailable('shareTargetPicker'));
    } catch (err) {
      return false;
    }
  }

  // 送れないときに出す「LINE 版で開く」の行き先（今のページのまま）
  async function lineAppUrl() {
    const config = await AppConfig.load();
    return config.liffId ? `https://liff.line.me/${config.liffId}${window.location.search}` : '';
  }

  // 送り先を選んで送る。送れたら true（やめたら false）
  async function pickAndSend(messages) {
    const pickerResult = await liff.shareTargetPicker(messages);
    return !(pickerResult && pickerResult.status === 'cancel');
  }

  // 送る前にプレビューを見せ、送り先を選んで送る。送ったあとは「続けて別のトークにも送る」「閉じる」（Q キット）。
  // opts.sentTitle：送ったあとのシートの見出し
  async function sendFlexMessage(flex, opts) {
    const canSend = canPickTarget();
    const result = await PreviewModal.show(flex, { ...opts, canSend, appUrl: canSend ? '' : await lineAppUrl() });
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

    if (!(await pickAndSend(messages))) return false;
    if (window.LineShareUI && typeof LineShareUI.afterSent === 'function') {
      LineShareUI.afterSent({ resend: () => pickAndSend(messages), title: AppUtil.withSeason((opts && opts.sentTitle) || '送りました') });
    } else {
      AppUtil.notify(AppUtil.withSeason('送りました'));
    }
    return true;
  }

  async function shareEvent(eventId) {
    const flex = await AppApi.buildShareFlex({ eventId });
    return sendFlexMessage(flex, { sentTitle: '予定を送りました' });
  }

  const REMIND_PRESETS = ['回答ありがとうございます', '回答の更新をお願いします', 'イベントが近づいています'];

  async function remindRespondents(params) {
    const flex = await AppApi.buildReminderFlex(params);
    const hasMaybe = !!(params.groups && params.groups['△'] && params.groups['△'].length);
    const defaultPresetIndex = hasMaybe ? 1 : 0;
    return sendFlexMessage(flex, { sentTitle: '連絡を送りました', presets: REMIND_PRESETS, defaultPresetIndex, groups: params.groups });
  }

  async function inviteEditor(eventId) {
    const flex = await AppApi.buildEditorInviteFlex({ eventId });
    return sendFlexMessage(flex, { sentTitle: '招待を送りました' });
  }

  async function notifyChange(params) {
    const flex = await AppApi.buildChangeNotificationFlex(params);
    return sendFlexMessage(flex, {
      sentTitle: '変更を知らせました',
      target: { note: '次の画面で、変更を伝えたいトークやグループを選べます' },
    });
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
            backgroundColor: '#0284C7',
            cornerRadius: 'xxl',
            paddingAll: 'md',
            action: { type: 'uri', label: '使ってみる', uri: liffUrl },
            contents: [{ type: 'text', text: '使ってみる', color: '#ffffff', align: 'center', weight: 'bold', size: 'md' }],
          }],
        } : undefined,
        styles: liffUrl ? { footer: { separator: true, separatorColor: '#EEEEEE' } } : undefined,
      },
    };
    return sendFlexMessage(flex, { sentTitle: 'くるかなを紹介しました' });
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
            backgroundColor: '#0284C7',
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
      sentTitle: '依頼を送りました',
      target: {
        displayName: creator.displayName,
        pictureUrl: creator.pictureUrl,
        note: '次の画面で、予定を作った人のトークを選んで送れます',
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

    if (canPickTarget()) {
      const result = await liff.shareTargetPicker([{ type: 'text', text }]);
      if (result && result.status === 'cancel') return false;
      if (liff.isInClient && liff.isInClient()) liff.closeWindow();
      return true;
    }

    AppUtil.ask({ title: '送るときは LINE 版で', text: 'ここでは見本だけ見られます。', ok: '閉じる', cancel: null });
    return false;
  }

  return { shareEvent, remindRespondents, inviteEditor, notifyChange, shareApp, requestEditAccess, replyInChat };
})();
