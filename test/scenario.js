/**
 * 手動シナリオテスト用スクリプト。
 *
 * 使い方:
 * 1. ローカルサーバーを立てて `?view=create` を開く
 *    （例: `python3 -m http.server 8000` → http://localhost:8000/?view=create）。
 * 2. DevTools コンソールにこのファイルの中身を貼り付けて読み込む
 *    （index.html からは読み込まれない。手動実行専用）。
 * 3. `runCreatePhase({ ...params })` を実行する。
 *    予定作成は実際のページ遷移（`window.location.href`）を伴うため、
 *    ここで一度スクリプトの実行コンテキストが切れる。
 * 4. 遷移後の画面（回答フォーム）で、再度このファイルを貼り付けてから
 *    `runAnswerPhase({ answers, cleanup })` を実行する。
 *
 * 実際のGASバックエンド（Spreadsheet）と通信するため、本物のCIでは使わない想定。
 * `cleanup: true`（デフォルト）で、回答フェーズの最後に作成したイベントを削除する。
 */

function installClickHighlight() {
  if (window.__claudeClickHighlightInstalled) return;
  window.__claudeClickHighlightInstalled = true;
  document.addEventListener('click', (e) => {
    const el = e.target.closest('button, a, input, [role], .choice-btn, .answer-icon') || e.target;
    const prevOutline = el.style.outline;
    el.style.transition = 'outline-color 0.1s ease';
    el.style.outline = '3px solid #FF3B8D';
    el.style.outlineOffset = '2px';
    setTimeout(() => { el.style.outline = prevOutline; }, 500);

    const ripple = document.createElement('div');
    ripple.style.cssText = `position:fixed;left:${e.clientX - 12}px;top:${e.clientY - 12}px;
      width:24px;height:24px;border-radius:50%;background:rgba(255,59,141,0.55);
      pointer-events:none;z-index:99999;transition:transform 0.45s ease, opacity 0.45s ease;`;
    document.body.appendChild(ripple);
    requestAnimationFrame(() => {
      ripple.style.transform = 'scale(3.5)';
      ripple.style.opacity = '0';
    });
    setTimeout(() => ripple.remove(), 500);
  }, true);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(selector, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = document.querySelector(selector);
    if (el) return el;
    await wait(100);
  }
  throw new Error('要素が見つかりませんでした: ' + selector);
}

function setInputValue(el, value) {
  el.focus();
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * フェーズ1: 予定作成フォームへの入力〜送信。
 * 送信するとアプリが `window.location.href` で遷移するため、この呼び出し自体は
 * 遷移が起きた時点で実行コンテキストごと終了する（エラーではない）。
 *
 * @param {object} params
 * @param {string} params.title 予定タイトル
 * @param {string} [params.description]
 * @param {Array<{title:string, startAt:string, endAt:string, location?:string}>} params.events
 */
async function runCreatePhase(params) {
  installClickHighlight();
  const { title, description = '', events } = params;
  if (!events || !events.length) throw new Error('events は1件以上指定してください');

  setInputValue(await waitFor('#f-title'), title);
  if (description) setInputValue(await waitFor('#f-description'), description);
  await wait(300);

  for (let i = 0; i < events.length; i++) {
    if (i > 0) {
      document.querySelector('#add-option').click();
      await wait(300);
    }
    const card = document.querySelectorAll('.option-card')[i];
    setInputValue(card.querySelector('.option-title'), events[i].title);
    setInputValue(card.querySelector('.option-start'), events[i].startAt);
    setInputValue(card.querySelector('.option-end'), events[i].endAt);
    if (events[i].location) setInputValue(card.querySelector('.option-location'), events[i].location);
    await wait(300);
  }

  document.querySelector('#create-form button[type="submit"]').click();
}

/**
 * フェーズ2: 遷移後の回答フォームで、各イベントに回答する。
 * 全問回答するとアプリが自動で集計画面へ遷移する。
 *
 * @param {object} [params]
 * @param {string[]} [params.answers] 各イベントへの回答（'○'|'△'|'×'）。省略時はランダム。
 * @param {boolean} [params.cleanup=true] 最後にイベントを削除するか
 */
async function runAnswerPhase(params = {}) {
  installClickHighlight();
  const { answers, cleanup = true } = params;

  const answerRows = await waitFor('#answer-rows');
  const rows = Array.from(answerRows.querySelectorAll('.answer-row'));
  for (let i = 0; i < rows.length; i++) {
    const answer = (answers && answers[i]) || ['○', '△', '×'][Math.floor(Math.random() * 3)];
    const btn = rows[i].querySelector(`.choice-btn[data-value="${answer}"]`);
    if (!btn) throw new Error('回答ボタンが見つかりません: ' + answer);
    btn.click();
    await wait(900); // 保存の通信＋最後の1問なら遷移を待つ
  }

  const eventId = new URLSearchParams(location.search).get('event');
  console.log('シナリオ完了。eventId =', eventId);

  if (cleanup && eventId) {
    const identity = await AppPlatform.initIdentity();
    await AppApi.deleteEvent({ eventId, userId: identity.userId });
    console.log('後始末: イベントを削除しました。');
  }

  return { eventId };
}

// 使用例:
//
// [1] ?view=create を開いてから:
// runCreatePhase({
//   title: 'シナリオテスト',
//   events: [
//     { title: 'BBQ', startAt: '2026-09-20T10:00', endAt: '2026-09-20T12:00', location: '河原' },
//     { title: '打ち上げ', startAt: '2026-09-20T18:00', endAt: '2026-09-20T20:00' },
//   ],
// });
//
// [2] 遷移完了後、このファイルをもう一度貼り付けてから:
// runAnswerPhase({ answers: ['○', '△'], cleanup: true });
