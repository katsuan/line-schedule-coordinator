// 知らせと確かめ（Q キットのトースト・下から出る窓）、季節の絵文字、押してから終わるまで待つボタン。
// AppUtil に足す
var AppUtil = Object.assign(typeof AppUtil === 'undefined' ? {} : AppUtil, (() => {
  // ボタンではない押せる印（role="button" tabindex="0"）を、クリックと Enter・スペースのどちらでも動くようにする
  function onActivate(el, fn) {
    el.addEventListener('click', fn);
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      fn(e);
    });
  }

  // ボタンを押せなくして、くるくるを出す。返す関数を呼ぶと元に戻る
  function beginButtonLoading(btn) {
    const originalColor = getComputedStyle(btn).color;
    btn.classList.add('is-saving');
    btn.disabled = true;
    const spinner = document.createElement('span');
    spinner.className = 'btn-spinner';
    spinner.style.borderColor = originalColor;
    spinner.style.borderTopColor = 'transparent';
    btn.appendChild(spinner);
    return () => {
      btn.classList.remove('is-saving');
      btn.disabled = false;
      spinner.remove();
    };
  }

  // 季節の絵文字（Q キットの season.js。tool-share.js があとから読むので、まだなければ付けない）。
  // うれしい瞬間の短い文だけに使う（エラー・確認・ボタン・送るカードの本文には使わない）
  function withSeason(text) {
    return window.QSeason && typeof window.QSeason.decorate === 'function' ? window.QSeason.decorate(text) : text;
  }

  // 下に数秒出る知らせ（Q キットのトースト）。options に { actionLabel: '元に戻す', onAction } でボタンが付く。
  // Q キットが読めなかったときは alert（ボタンなし）
  function notify(message, options) {
    if (window.LineShareUI && typeof LineShareUI.toast === 'function') {
      LineShareUI.toast(message, options);
    } else {
      alert(message); // qcheck-ok: W8 Q キットが読めなかったときだけの代わり
    }
  }

  // 確かめる窓（Q キットの LineShareUI.ask。下から出るシート）。OK なら true。Q キットが読めなかったときは confirm
  // 知らせるだけのとき（alert の代わり）は ask({ title, ok: '閉じる', cancel: null })
  function ask(options) {
    if (window.LineShareUI && typeof LineShareUI.ask === 'function') return LineShareUI.ask(options);
    const text = [options.title, options.text].filter(Boolean).join('\n');
    if (options.cancel === null) {
      alert(text); // qcheck-ok: W8 Q キットが読めなかったときだけの代わり
      return Promise.resolve(true);
    }
    return Promise.resolve(confirm(text)); // qcheck-ok: W8 Q キットが読めなかったときだけの代わり
  }

  // 失敗したときの「次にすること」。GAS の返すエラーの中身は画面に出さず、種類だけ見て言いかえる（くわしくはコンソール）
  function friendlyReason(err) {
    const message = String((err && err.message) || '');
    if (/ログインしなおして/.test(message)) return 'LINE で開きなおしてね。';
    if (/長すぎ|多すぎ/.test(message)) return 'もう少し短く（少なく）してね。';
    if (/招待のリンク/.test(message)) return '作成者に「🔑 編集を依頼」してね。';
    if (/のみです|作成者|投稿者/.test(message)) return 'この操作は、予定を作った人（編集をまかされた人）だけができます。';
    if (/見つかりません/.test(message)) return '予定が見つかりませんでした。消されたのかもしれません。';
    return '電波のよいところで、もう一度ためしてね。';
  }

  // 失敗の知らせ：「○○できませんでした。次にすること」をやさしく出す（くわしい中身はコンソールへ）
  function notifyError(what, err) {
    console.warn(what, err);
    notify(`${what || 'うまくいきませんでした'}。${friendlyReason(err)}`);
  }

  // confirm：元に戻せない操作だけ、押す前に確かめる（{ title, text, ok: '消す', danger: true }。ok にはすることを書く）
  function wireAsyncButton(btn, action, { confirm: confirmOptions, errorPrefix } = {}) {
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget;
      if (confirmOptions && !(await ask(confirmOptions))) return;
      const stopLoading = beginButtonLoading(target || e.target);
      try {
        await action(e);
      } catch (err) {
        notifyError(errorPrefix, err);
      } finally {
        stopLoading();
      }
    });
  }

  // 保存して画面を描き直す（または移る）ボタン。うまくいったときは描き直しでボタンごと消えるので、
  // くるくるは止めない。失敗したときだけ知らせて、ボタンを元に戻す
  async function saveWithButton(btn, action, errorPrefix) {
    const stopLoading = beginButtonLoading(btn);
    try {
      await action();
    } catch (err) {
      notifyError(errorPrefix, err);
      stopLoading();
    }
  }

  return { onActivate, wireAsyncButton, saveWithButton, beginButtonLoading, notify, notifyError, friendlyReason, ask, withSeason };
})());
