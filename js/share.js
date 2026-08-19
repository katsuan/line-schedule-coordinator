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

  async function buildEventUrl(eventId) {
    const config = await AppConfig.load();
    if (!config.liffId || config.liffId === 'YOUR_LIFF_ID') return '';
    return `https://liff.line.me/${config.liffId}?event=${encodeURIComponent(eventId)}`;
  }

  async function sendTextMessage(text) {
    if (window.liff && typeof liff.isApiAvailable === 'function' && liff.isApiAvailable('shareTargetPicker')) {
      await liff.shareTargetPicker([{ type: 'text', text }]);
      if (liff.isInClient && liff.isInClient()) {
        liff.closeWindow();
      }
      return true;
    }
    console.warn('shareTargetPicker は利用できません（LIFF外またはローカルプレビュー）。', text);
    alert('この環境では共有できません（LINEアプリ内のLIFFでのみ動作します）。\n\n' + text);
    return false;
  }

  async function remindRespondents(eventTitle, eventId, answerLabel, names) {
    const url = await buildEventUrl(eventId);
    const nameList = names.join('さん、') + 'さん';
    const text = `【${eventTitle}】\n${nameList}\n「${answerLabel}」で回答いただいていますが、都合が分かり次第、回答の更新をお願いします🙏${url ? '\n' + url : ''}`;
    return sendTextMessage(text);
  }

  return { shareEvent, remindRespondents };
})();
