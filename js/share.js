const AppShare = (() => {
  async function shareEvent(eventId) {
    const flex = await AppApi.buildShareFlex({ eventId });
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

  return { shareEvent };
})();
