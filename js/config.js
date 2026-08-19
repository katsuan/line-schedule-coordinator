const AppConfig = (() => {
  let config = null;

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
