const AppShare = (() => {
  async function sendFlexMessage(flex, opts) {
    const message = {
      type: 'flex',
      altText: flex.altText,
      contents: flex.contents,
    };

    let available = false;
    try {
      available = window.liff && typeof liff.isApiAvailable === 'function' && liff.isApiAvailable('shareTargetPicker');
    } catch (err) {
      available = false;
    }

    if (available) {
      await liff.shareTargetPicker([message]);
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

  return { shareEvent, remindRespondents, inviteEditor };
})();
