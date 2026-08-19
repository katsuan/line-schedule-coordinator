const AppShare = (() => {
  async function sendFlexMessage(flex) {
    const message = {
      type: 'flex',
      altText: flex.altText,
      contents: flex.contents,
    };

    if (window.liff && typeof liff.isApiAvailable === 'function' && liff.isApiAvailable('shareTargetPicker')) {
      await liff.shareTargetPicker([message]);
      if (liff.isInClient && liff.isInClient()) {
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

  async function remindRespondents(optionTitle, eventId, answerLabel, names) {
    const flex = await AppApi.buildReminderFlex({ eventId, answerLabel, names, optionTitle });
    return sendFlexMessage(flex);
  }

  async function inviteEditor(eventId) {
    const flex = await AppApi.buildEditorInviteFlex({ eventId });
    return sendFlexMessage(flex);
  }

  return { shareEvent, remindRespondents, inviteEditor };
})();
