const AppApi = (() => {
  // ネットワーク環境（一部のLINEアプリ内ブラウザ等）ではPOSTがGASに正しく届かず
  // 「GET は未対応です」等の一時的なエラーになることがあるため、1回だけ自動リトライする。
  const TRANSIENT_ERROR_PATTERNS = ['GET は未対応', 'サービスに接続できなくなりました', 'Failed to fetch'];

  // 作る・足す操作は、届いたかわからないまま送りなおすと2つできてしまう。
  // GAS に届いていないとわかるとき（GET として届いた）だけやりなおす
  const NOT_REPEATABLE_ACTIONS = ['createEvent', 'addOptions', 'addComment'];
  const NOT_DELIVERED_PATTERN = 'GET は未対応';

  function isTransientError_(message) {
    return TRANSIENT_ERROR_PATTERNS.some((p) => message && message.indexOf(p) >= 0);
  }

  function canRetry_(action, message) {
    if (NOT_REPEATABLE_ACTIONS.indexOf(action) >= 0) {
      return !!message && message.indexOf(NOT_DELIVERED_PATTERN) >= 0;
    }
    return isTransientError_(message);
  }

  async function callOnce_(gasUrl, action, payload) {
    const res = await fetch(gasUrl, {
      method: 'POST',
      // GASはカスタムCORSヘッダーを返せないため、text/plainでpreflightを回避する
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      // accessToken：GAS はこれを LINE に確かめて本人を決める（payload の userId は使わない）
      body: JSON.stringify({ action, ...payload, accessToken: AppPlatform.getAccessToken() }),
    });

    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || '不明なエラーが発生しました');
    }
    return json.data;
  }

  async function call(action, payload) {
    const config = await AppConfig.load();
    if (!config.gasUrl || config.gasUrl === 'YOUR_DEPLOYMENT_ID' || config.gasUrl.indexOf('YOUR_DEPLOYMENT_ID') >= 0) {
      throw new Error('config.json に gasUrl が設定されていません（config.example.json を参考に設定してください）');
    }

    try {
      return await callOnce_(config.gasUrl, action, payload);
    } catch (err) {
      if (!canRetry_(action, err.message)) throw err;
      console.warn('一時的なエラーのため再試行します', action, err.message);
      return await callOnce_(config.gasUrl, action, payload);
    }
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
    approveEditRequest: (payload) => call('approveEditRequest', payload),
    updateOption: (payload) => call('updateOption', payload),
    updateEvent: (payload) => call('updateEvent', payload),
    listMyOptions: (payload) => call('listMyOptions', payload),
    buildReminderFlex: (payload) => call('buildReminderFlex', payload),
    buildEditorInviteFlex: (payload) => call('buildEditorInviteFlex', payload),
    buildChangeNotificationFlex: (payload) => call('buildChangeNotificationFlex', payload),
  };
})();
