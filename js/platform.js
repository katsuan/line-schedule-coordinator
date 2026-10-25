// LINE（LIFF）とのつなぎ（AppPlatform）：だれが使っているか（本人）・LINE の鍵・ブラウザ版の案内。
// app.js が最初に initIdentity を呼ぶ。手元で試すとき（localhost）は、この端末だけの仮の ID で動く
const AppPlatform = (() => {
  let identityPromise = null;

  // 手元で試しているか（file:・localhost・127.0.0.1）
  function isLocalPreviewEnvironment() {
    const hostname = String(window.location.hostname || '').toLowerCase();
    return (
      window.location.protocol === 'file:' ||
      hostname === '127.0.0.1' ||
      hostname === 'localhost' ||
      hostname === '0.0.0.0'
    );
  }

  // 手元で試すときの仮の ID（この端末に残して、毎回同じにする）
  function getStableDebugUserId() {
    const storageKey = 'schedule-coordinator-debug-user-id';
    try {
      let id = window.localStorage.getItem(storageKey);
      if (!id) {
        id = 'debug-user-' + Math.random().toString(36).slice(2, 10);
        window.localStorage.setItem(storageKey, id);
      }
      return id;
    } catch (err) {
      return 'debug-user-' + Math.random().toString(36).slice(2, 10);
    }
  }

  // 手元で試すときの本人（仮の ID と名前）
  function debugIdentity(displayName) {
    return {
      userId: getStableDebugUserId(),
      displayName: displayName || 'デバッグユーザー',
      pictureUrl: '',
    };
  }

  // 本人（userId・名前・アイコン）を決めて返す。LINE 版なら LIFF から、ブラウザ版ならログインするかを選んでもらう。1回だけ動く
  async function initIdentity() {
    if (identityPromise) return identityPromise;

    identityPromise = (async () => {
      const config = await AppConfig.load();
      const liffId = config.liffId;

      if (isLocalPreviewEnvironment() || !window.liff || !liffId || liffId === 'YOUR_LIFF_ID') {
        return debugIdentity();
      }

      try {
        await liff.init({ liffId });
      } catch (err) {
        console.error('liff.init 失敗', err);
        return debugIdentity();
      }

      if (!liff.isLoggedIn()) {
        if (typeof liff.login === 'function') {
          // ブラウザ版では、黙ってログイン画面へ飛ばさず、LINE 版で開くかログインするかを選んでもらう
          if (typeof liff.isInClient === 'function' && !liff.isInClient()) {
            showOutsideChoice(liffId);
            return new Promise(() => {}); // どちらかを選ぶとページを移るので解決しない
          }
          // ログイン後は今のページ（?event= 付き）に戻す。指定しないと LIFF の入口に戻り、開いていた予定から外れる
          liff.login({ redirectUri: loginReturnUrl() });
          return new Promise(() => {}); // ログインリダイレクトへ遷移するため解決しない
        }
        return debugIdentity();
      }

      try {
        const profile = await liff.getProfile();
        return {
          userId: profile.userId,
          displayName: profile.displayName || 'LINE ユーザー',
          pictureUrl: profile.pictureUrl || '',
        };
      } catch (err) {
        console.error('liff.getProfile 失敗', err);
        return debugIdentity('LINE ユーザー');
      }
    })();

    return identityPromise;
  }

  // ブラウザ版で開いたとき：だれの回答かを LINE で分けるので、LINE 版で開くかログインするかを選ぶ（ひっくり・おくるんと同じ考え方）。
  // LINE 版で開くときは、開いていた予定（?event=）もそのまま持っていく
  function showOutsideChoice(liffId) {
    const sheet = document.createElement('div');
    sheet.className = 'ls-sheet outside-choice';
    sheet.innerHTML = `
      <div class="ls-sheet-card outside-choice-card" role="dialog" aria-modal="true" aria-labelledby="outsideChoiceTitle">
        <img src="icon.svg" alt="" width="56" height="56">
        <p id="outsideChoiceTitle" class="ls-sheet-title">ブラウザ版で開いています</p>
        <p class="ls-hint">くるかなは、LINE の名前で ○△× を答えます。下のどちらかで使えます。</p>
        <a class="ls-outside-button is-app">📱 LINE 版で開く</a>
        <button class="ls-outside-button" type="button">🔑 ログインして使う</button>
      </div>`;
    sheet.querySelector('a').setAttribute('href', `https://liff.line.me/${encodeURIComponent(liffId)}${window.location.search}`);
    sheet.querySelector('button').addEventListener('click', () => {
      liff.login({ redirectUri: loginReturnUrl() });
    });
    document.body.appendChild(sheet);
  }

  // ログインの受け渡しで付く一時的なパラメータは外す（おくるんの shared/liff.js と同じ）
  function loginReturnUrl() {
    const url = new URL(window.location.href);
    ['code', 'state', 'liffClientId', 'liffRedirectUri', 'error', 'error_description', 'friendship_status_changed'].forEach((key) => {
      url.searchParams.delete(key);
    });
    return url.toString();
  }

  // GAS に本人を確かめてもらうための LINE のログイン証明（ローカルで試すときはない）
  function getAccessToken() {
    try {
      return window.liff && typeof liff.getAccessToken === 'function' ? (liff.getAccessToken() || '') : '';
    } catch (err) {
      return '';
    }
  }

  return { initIdentity, isLocalPreviewEnvironment, getAccessToken };
})();
