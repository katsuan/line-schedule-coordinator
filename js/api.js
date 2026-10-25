// GAS とのやりとり（AppApi）。action と中身を POST で送り、返事の data を返す（だめならエラーにする）。
// 画面のどこからでも AppApi.○○(payload) で呼ぶ。LINE の鍵（アクセストークン）をいっしょに送り、GAS が本人を確かめる
const AppApi = (() => {
  // ネットワーク環境（一部のLINEアプリ内ブラウザ等）ではPOSTがGASに正しく届かず
  // 「GET は未対応です」等の一時的なエラーになることがあるため、1回だけ自動リトライする。
  const TRANSIENT_ERROR_PATTERNS = ['GET は未対応', 'サービスに接続できなくなりました', 'Failed to fetch'];

  // 作る・足す操作は、届いたかわからないまま送りなおすと2つできてしまう。
  // GAS に届いていないとわかるとき（GET として届いた）だけやりなおす
  const NOT_REPEATABLE_ACTIONS = ['createEvent', 'addOptions', 'addComment'];
  const NOT_DELIVERED_PATTERN = 'GET は未対応';

  // 一時的な通信のまちがい（やりなおせば通りそうなもの）か
  function isTransientError_(message) {
    return TRANSIENT_ERROR_PATTERNS.some((p) => message && message.indexOf(p) >= 0);
  }

  // その action を、そのまちがいのあとで1回だけやりなおしてよいか（作る・足すは、届いていないとわかるときだけ）
  function canRetry_(action, message) {
    if (NOT_REPEATABLE_ACTIONS.indexOf(action) >= 0) {
      return !!message && message.indexOf(NOT_DELIVERED_PATTERN) >= 0;
    }
    return isTransientError_(message);
  }

  // GAS に1回送る。返事が ok でなければ、その言葉でエラーにする
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

  // GAS に送る。gasUrl がなければ止め、一時的なまちがいなら1回だけやりなおす
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

  // GAS の action（gas/03_routing.js の routeAction_）と同じ名前の関数を作る。AppApi.createEvent(payload) なら action は createEvent。
  // action を足したら、ここと routeAction_ の両方に足す（テストで、そろっているかを確かめる）
  const ACTIONS = [
    'createEvent', 'submitAnswer', 'addComment', 'deleteComment', 'getSummary', 'listMyEvents', 'buildShareFlex',
    'deleteEvent', 'addOptions', 'claimEditor', 'approveEditRequest', 'updateOption', 'updateEvent', 'listMyOptions',
    'buildReminderFlex', 'buildEditorInviteFlex', 'buildChangeNotificationFlex',
  ];

  return Object.fromEntries(ACTIONS.map((action) => [action, (payload) => call(action, payload)]));
})();
