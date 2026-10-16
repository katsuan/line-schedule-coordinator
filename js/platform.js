const AppPlatform = (() => {
  let identityPromise = null;

  function isLocalPreviewEnvironment() {
    const hostname = String(window.location.hostname || '').toLowerCase();
    return (
      window.location.protocol === 'file:' ||
      hostname === '127.0.0.1' ||
      hostname === 'localhost' ||
      hostname === '0.0.0.0'
    );
  }

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

  function debugIdentity(displayName) {
    return {
      userId: getStableDebugUserId(),
      displayName: displayName || 'デバッグユーザー',
      pictureUrl: '',
    };
  }

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

  // ログインの受け渡しで付く一時的なパラメータは外す（おくるんの shared/liff.js と同じ）
  function loginReturnUrl() {
    const url = new URL(window.location.href);
    ['code', 'state', 'liffClientId', 'liffRedirectUri', 'error', 'error_description', 'friendship_status_changed'].forEach((key) => {
      url.searchParams.delete(key);
    });
    return url.toString();
  }

  return { initIdentity, isLocalPreviewEnvironment };
})();
