/**
 * LINE にカードを送る流れ（AppShare）：送る前の見本を見せる → 送り先を選ぶ → 送ったあとのシート。
 * 中身：予定・連絡・変更・招待・紹介・編集の依頼・許可のお知らせを送る関数。カードは GAS か、ここで作る。
 * 呼ばれ方：予定の画面（detail.js・detailHeader.js・optionCard.js）のボタンから。見本の画面は views/previewModal.js、カードの変換は flexPreview.js。
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

  // カードの下のボタン（画面を開くだけ。あとで押されても困らない）。URL がなければボタンなし
  function buttonFooter(label, uri) {
    if (!uri) return undefined;
    return {
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
        action: { type: 'uri', label, uri },
        contents: [{ type: 'text', text: label, color: '#ffffff', align: 'center', weight: 'bold', size: 'md' }],
      }],
    };
  }

  // カードのボタンの上に区切りの線を引く設定（ボタンがなければなし）
  function footerStyles(uri) {
    return uri ? { footer: { separator: true, separatorColor: '#EEEEEE' } } : undefined;
  }

  // 予定の画面を開く URL（LIFF）。extra は後ろに足す query
  function eventPageUrl(liffId, eventId, extra) {
    return liffId ? `https://liff.line.me/${liffId}?event=${encodeURIComponent(eventId)}${extra || ''}` : '';
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

  // 予定を送るカード（GAS で作る）を、見本を見せてから送る
  async function shareEvent(eventId) {
    const flex = await AppApi.buildShareFlex({ eventId });
    return sendFlexMessage(flex, { sentTitle: '予定を送りました' });
  }

  const REMIND_PRESETS = ['回答ありがとうございます', '回答の更新をお願いします', 'イベントが近づいています'];

  // 1つのイベントについて、答えた人へ連絡のカードを送る（ひとことの見本つき。△ の人がいれば「更新をお願い」を先に）
  async function remindRespondents(params) {
    const flex = await AppApi.buildReminderFlex(params);
    const hasMaybe = !!(params.groups && params.groups['△'] && params.groups['△'].length);
    const defaultPresetIndex = hasMaybe ? 1 : 0;
    return sendFlexMessage(flex, { sentTitle: '連絡を送りました', presets: REMIND_PRESETS, defaultPresetIndex, groups: params.groups });
  }

  // 編集者になってもらう招待のカードを送る
  async function inviteEditor(eventId) {
    const flex = await AppApi.buildEditorInviteFlex({ eventId });
    return sendFlexMessage(flex, { sentTitle: '招待を送りました' });
  }

  // イベントが変わったことを知らせるカードを送る
  async function notifyChange(params) {
    const flex = await AppApi.buildChangeNotificationFlex(params);
    return sendFlexMessage(flex, {
      sentTitle: '変更を知らせました',
      target: { note: '次の画面で、変更を伝えたいトークやグループを選べます' },
    });
  }

  // くるかなを紹介するカードを送る
  async function shareApp() {
    const config = await AppConfig.load();
    const liffUrl = config.liffId ? `https://liff.line.me/${config.liffId}` : '';
    const flex = {
      altText: 'くるかな：候補の日に ○△× で答えるだけの日程調整',
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
        footer: buttonFooter('使ってみる', liffUrl),
        styles: footerStyles(liffUrl),
      },
    };
    return sendFlexMessage(flex, { sentTitle: 'くるかなを紹介しました' });
  }

  // 編集権限の依頼Flexを生成して送る（送信先は依頼者自身がピッカーで選ぶ＝作成者のトークへ）。
  // 「許可する」は作成者側でLIFFを開いてapproveEditRequestを叩くuriリンク（postbackはBotなし構成では使えないため不採用）。
  async function requestEditAccess(eventId, eventTitle, requester, creator) {
    const config = await AppConfig.load();
    const approveUrl = eventPageUrl(config.liffId, eventId, '&approveEditor=1'
      + `&requesterId=${encodeURIComponent(requester.userId)}`
      + `&requesterName=${encodeURIComponent(requester.displayName || '')}`
      + `&requesterPic=${encodeURIComponent(requester.pictureUrl || '')}`);
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
        footer: buttonFooter('許可する', approveUrl),
        styles: footerStyles(approveUrl),
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

  // 編集を許可したお知らせ（カード）。依頼した人が「予定を開く」からすぐ編集できるように。
  // 同じトークで開いていれば（sendMessages が使えれば）選ばずにそのまま送り、そうでなければ送り先を選んで送る
  function approvedMessage(liffId, eventId, eventTitle, requesterName) {
    const url = eventPageUrl(liffId, eventId);
    return {
      type: 'flex',
      altText: `✅ ${eventTitle} の編集を許可しました`,
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          paddingBottom: 'md',
          contents: [
            { type: 'text', text: '✅ 編集を許可しました', weight: 'bold', size: 'lg', color: '#111111' },
            { type: 'text', text: eventTitle, size: 'sm', color: '#8C8C8C', wrap: true, margin: 'md' },
            {
              type: 'box', layout: 'baseline', spacing: 'sm', margin: 'md',
              contents: [
                { type: 'text', text: '編集できる人', size: 'sm', color: '#8C8C8C', flex: 3 },
                { type: 'text', text: requesterName || '依頼した人', size: 'sm', color: '#111111', flex: 5, wrap: true },
              ],
            },
          ],
        },
        footer: buttonFooter('予定を開く', url),
        styles: footerStyles(url),
      },
    };
  }

  // 許可したことを知らせるカードを送る（同じトークで開いていれば選ばずに、そうでなければ送り先を選んで）。送れたら true
  async function sendApprovedCard(eventId, eventTitle, requesterName) {
    const config = await AppConfig.load();
    const messages = [approvedMessage(config.liffId, eventId, eventTitle, requesterName)];
    try {
      const sendAvailable = window.liff && liff.isApiAvailable && liff.isApiAvailable('sendMessages');
      if (sendAvailable) {
        const hasPermission = await ensureSendMessagePermission_();
        if (hasPermission) {
          await liff.sendMessages(messages);
          if (liff.isInClient && liff.isInClient()) liff.closeWindow();
          return true;
        }
      }
    } catch (err) {
      console.warn('sendMessages に失敗したため送信先ピッカーにフォールバックします', err);
    }

    if (canPickTarget()) {
      if (!(await pickAndSend(messages))) return false;
      if (liff.isInClient && liff.isInClient()) liff.closeWindow();
      return true;
    }

    AppUtil.ask({ title: '送るときは LINE 版で', text: 'ここでは見本だけ見られます。', ok: '閉じる', cancel: null });
    return false;
  }

  return { shareEvent, remindRespondents, inviteEditor, notifyChange, shareApp, requestEditAccess, sendApprovedCard };
})();
