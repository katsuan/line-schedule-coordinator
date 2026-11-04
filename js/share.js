/**
 * LINE にカードを送る流れ（AppShare）：送る前の見本を見せる → 送り先を選ぶ → 送ったあとのシート。
 * 中身：予定・連絡・変更・招待・紹介・編集の依頼・許可のお知らせを送る関数。カードは GAS か、js/cards.js（AppCards）で作る。
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
    return sendFlexMessage(AppCards.appIntro(config.liffId), { sentTitle: 'くるかなを紹介しました' });
  }

  // 編集権限の依頼のカードを送る（送り先は依頼した人がピッカーで選ぶ＝作成者のトークへ）
  async function requestEditAccess(eventId, eventTitle, requester, creator) {
    const config = await AppConfig.load();
    const flex = AppCards.editRequest(config.liffId, eventId, eventTitle, requester, creator);
    return sendFlexMessage(flex, {
      sentTitle: '依頼を送りました',
      target: {
        displayName: creator.displayName,
        pictureUrl: creator.pictureUrl,
        note: '次の画面で、予定を作った人のトークを選んで送れます',
      },
    });
  }

  // 選ばずにそのまま送る（sendMessages）には、トークに書く許し（chat_message.write）がいる。
  // 送り先を選ぶ画面とちがって、選ぶことで同意したことにならないため。まだ決まっていなければ聞く
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

  // 許可したことを知らせるカードを送る（同じトークで開いていれば選ばずに、そうでなければ送り先を選んで）。送れたら true
  async function sendApprovedCard(eventId, eventTitle, requesterName) {
    const config = await AppConfig.load();
    const messages = [AppCards.approved(config.liffId, eventId, eventTitle, requesterName)];
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
