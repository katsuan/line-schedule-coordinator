/**
 * 見出しの本人のアイコン（MeIcon）：一覧の画面（ListView）の見出しで、ロゴの右に本人の LINE のアイコン（なければ名前の頭の字）を出す。
 * 出すのは Q キットの shared/line-me.js（window.QLineMe。つづく・しょくじ・キロっく・ひっくりと同じ見た目）。緑のふちはログイン中、灰色はまだ。
 * 押すと、だれで回答しているか・回答に出る名前とアイコン・LINE 版とブラウザ版で同じ予定が見られることのシート（Sheet）。
 * くるかなはボットにつながないので bot: false。LIFF は AppPlatform が起こしたものを待つ（2回起こさない）。
 * 予定の画面（参加者の一覧がある画面）には見出しのロゴがないので出さない。
 * 呼ばれ方：views/list.js の render から mount(root, identity)
 */
const MeIcon = (() => {
  // シートの行（文字だけ。テストで中身を確かめる）。st：{ me（{ name, picture } か null）, loggedIn }
  function rows(st) {
    const s = st || {};
    const name = s.me && s.me.name ? s.me.name : '';
    if (!s.loggedIn) {
      return [
        { icon: '👤', text: 'まだ LINE にログインしていません' },
      ];
    }
    return [
      { icon: '✅', text: `${name ? `${name} さん` : 'LINE'}でログインしています` },
      { icon: '🙋', text: '○△× とコメントには、この名前とアイコンが出ます' },
      { icon: '📱', text: '予定と回答は LINE のアカウントごとに残るので、LINE 版でもブラウザ版でも同じものが見られます' },
    ];
  }

  // シートの中身の HTML（名前は文字として入れる）。頭のアイコンは、回答者の一覧と同じ丸（AppUtil.avatarHtml）
  function bodyHtml(st) {
    const me = st.me || {};
    const list = rows(st).map((row) => `<li><span aria-hidden="true">${AppUtil.escapeHtml(row.icon)}</span><span>${AppUtil.escapeHtml(row.text)}</span></li>`).join('');
    return `
      <div class="qme-head me-sheet-head">
        ${AppUtil.avatarHtml(me.name || '?', me.picture || '')}
        <p class="me-sheet-name">${AppUtil.escapeHtml(st.loggedIn && me.name ? `${me.name} さん` : 'LINE 版')}</p>
      </div>
      <ul class="qme-rows">${list}</ul>`;
  }

  // 見出しにアイコンを出す。Q キットが読めないとき・LIFF ID がないとき・見出しがないときは何もしない
  async function mount(root, identity) {
    // line-me.js は defer なので、HTML を読み終えるまで待つ
    if (document.readyState === 'loading') {
      await new Promise((resolve) => document.addEventListener('DOMContentLoaded', resolve, { once: true }));
    }
    const host = root.querySelector('.ls-brand');
    if (!window.QLineMe || !host || host.querySelector('.qme-button')) return null;
    const { liffId } = await AppConfig.load();
    if (!liffId) return null;
    const id = identity || {};
    return window.QLineMe.mount({
      liffId,
      host,
      // ブラウザ版でログインして使っているときも出す（くるかなはログインしないと使えない）
      show: true,
      bot: false,
      ready: AppPlatform.liffReady(),
      initial: id.displayName ? { name: id.displayName, picture: id.pictureUrl || '' } : null,
      onOpen: (handle) => {
        const st = handle.status();
        Sheet.open({ title: 'あなた', bodyHtml: bodyHtml(st) });
      },
    });
  }

  return { mount, rows };
})();
