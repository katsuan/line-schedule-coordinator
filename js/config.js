// 設定（AppConfig）：config.json（liffId・gasUrl）を1回だけ読んで覚える。読めなければ空で動く。
// AppPlatform・AppApi・AppShare から AppConfig.load() で使う
const AppConfig = (() => {
  let config = null;

  // config.json を読んで返す（2回目からは覚えたもの）
  async function load() {
    if (config) return config;
    try {
      const res = await fetch('./config.json', { cache: 'no-store' });
      config = await res.json();
    } catch (err) {
      console.error('config.json の読み込みに失敗しました', err);
      config = { liffId: '', gasUrl: '' };
    }
    return config;
  }

  return { load };
})();
