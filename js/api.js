const AppApi = (() => {
  async function call(action, payload) {
    const config = await AppConfig.load();
    if (!config.gasUrl || config.gasUrl === 'YOUR_DEPLOYMENT_ID' || config.gasUrl.indexOf('YOUR_DEPLOYMENT_ID') >= 0) {
      throw new Error('config.json に gasUrl が設定されていません（config.example.json を参考に設定してください）');
    }

    const res = await fetch(config.gasUrl, {
      method: 'POST',
      // GASはカスタムCORSヘッダーを返せないため、text/plainでpreflightを回避する
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
    });

    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || '不明なエラーが発生しました');
    }
    return json.data;
  }

  return {
    createEvent: (payload) => call('createEvent', payload),
    submitAnswer: (payload) => call('submitAnswer', payload),
    addComment: (payload) => call('addComment', payload),
    deleteComment: (payload) => call('deleteComment', payload),
    getSummary: (payload) => call('getSummary', payload),
    listMyEvents: (payload) => call('listMyEvents', payload),
    buildShareFlex: (payload) => call('buildShareFlex', payload),
    deleteEvent: (payload) => call('deleteEvent', payload),
    addOptions: (payload) => call('addOptions', payload),
    claimEditor: (payload) => call('claimEditor', payload),
    updateOption: (payload) => call('updateOption', payload),
    updateEvent: (payload) => call('updateEvent', payload),
    listMyOptions: (payload) => call('listMyOptions', payload),
    buildReminderFlex: (payload) => call('buildReminderFlex', payload),
    buildEditorInviteFlex: (payload) => call('buildEditorInviteFlex', payload),
    buildChangeNotificationFlex: (payload) => call('buildChangeNotificationFlex', payload),
  };
})();
