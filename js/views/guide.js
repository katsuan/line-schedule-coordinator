// 使い方の画面（GuideView）：くるかなの流れ・幹事と参加者のよくある質問・はじめるボタン。
// app.js が URL に何もないとき（と、開けなかったとき）に render を呼ぶ
const GuideView = (() => {
  // 使い方の1つの手順（番号・題・説明）
  function stepItem(num, title, desc) {
    return `
      <div class="guide-step-item">
        <span class="guide-step-num">${num}</span>
        <div class="guide-step-body">
          <p class="guide-step-title">${title}</p>
          <p class="event-meta">${desc}</p>
        </div>
      </div>`;
  }

  const AUDIENCE_BADGE = {
    common: 'status-common',
    organizer: 'status-creator',
    member: 'status-answered',
  };

  // よくある質問1つ（だれ向けかの札・問い・答え）
  function faqItem(audience, audienceLabel, q, a) {
    return `
      <div class="ls-panel guide-faq-item">
        <p class="guide-faq-q">
          <span class="status-badge ${AUDIENCE_BADGE[audience]}">${audienceLabel}</span>
          Q. ${q}
        </p>
        <p class="event-meta">${a}</p>
      </div>`;
  }

  // 「予定をはじめる」のボタン
  function ctaHtml() {
    return `<a class="ls-button is-primary is-block" href="?view=list">＋ 予定をはじめる</a>`;
  }

  // 使い方の画面を描く（opts.error があれば上に知らせ）
  function render(root, ctx, opts) {
    const notice = opts && opts.error
      ? `<div class="guide-notice">⚠️ ページを開けませんでした。${AppUtil.escapeHtml(AppUtil.friendlyReason(opts.error))}下のボタンから一覧も見られます。</div>`
      : '';

    root.innerHTML = `
      ${notice}
      <div class="guide-hero">
        <img class="guide-hero-icon" src="icon.svg" alt="" width="64" height="64">
        <img class="guide-hero-logo" src="logo.svg" alt="くるかな（QuruKana）" width="118" height="32">
        <p class="ls-brand-copy guide-hero-copy">来れる日を、○△×でそろえよう</p>
        <h1>アプリを追加せずに、<br>LINEで日程調整。</h1>
        <p class="event-meta">友だち追加もBotもいりません。このページで、予定づくり〜回答〜集計までの流れをおさらいできます。</p>
      </div>
      ${ctaHtml()}

      <section class="guide-section">
        <p class="guide-label">👤 参加者のとき</p>
        <h2 class="guide-section-title">予定に回答する</h2>
        <div class="ls-panel guide-step-card">
          <div class="guide-step-list">
            ${stepItem(1, '届いたメッセージの「回答する」を開く', '幹事から届いたカード形式のメッセージから、そのまま開けます。')}
            ${stepItem(2, '候補ごとに○△×をタップ', '複数の候補日があれば、それぞれに回答します。あとから何度でも変更できます。')}
          </div>
          <div class="guide-answer-demo">
            <div class="guide-answer-demo-item">
              <span class="choice-btn choice-ok selected" aria-hidden="true">○</span>
              <span class="event-meta">参加できる</span>
            </div>
            <div class="guide-answer-demo-item">
              <span class="choice-btn choice-maybe selected" aria-hidden="true">△</span>
              <span class="event-meta">未定</span>
            </div>
            <div class="guide-answer-demo-item">
              <span class="choice-btn choice-ng selected" aria-hidden="true">×</span>
              <span class="event-meta">参加できない</span>
            </div>
          </div>
          <div class="guide-step-list guide-step-list-divider">
            ${stepItem(3, '伝えたいことがあれば「💬 コメントを追加」', '例えば「19時以降なら参加できます」など、○△×だけで伝えきれないことを書き添えられます。他の参加者にも見えます。')}
          </div>
        </div>
      </section>

      <section class="guide-section">
        <p class="guide-label">🎌 幹事のとき</p>
        <h2 class="guide-section-title">予定をつくって共有する</h2>
        <div class="ls-panel guide-step-card">
          <div class="guide-step-list">
            ${stepItem(1, '一覧の「＋ 新規作成」', 'タイトルと、候補日時を1つ以上入力します（複数候補もOK）。')}
            ${stepItem(2, '「カードで送る」で参加者に送る', '送る前に、送る内容の見本を見られます。')}
            ${stepItem(3, '予定ページで回答状況をいつでも確認', '候補ごとの人数・回答者・コメントがまとまって見られます。')}
          </div>
        </div>
      </section>

      <section class="guide-section">
        <p class="guide-label">🎌 幹事のとき</p>
        <h2 class="guide-section-title">幹事だけができること</h2>
        <div class="ls-panel guide-role-card">
          <span class="status-badge status-creator">作成者・編集者</span>
          <ul class="guide-role-can">
            <li>候補や予定内容を編集する</li>
            <li>候補ごとに未回答・要更新の人へ「カードで送る」で個別に連絡する</li>
            <li>他の人を編集者として招待し、候補づくりを任せる</li>
            <li>このアプリ自体を友だちに紹介する</li>
          </ul>
        </div>
        <div class="ls-panel guide-role-card">
          <span class="status-badge status-pending">作成者のみ</span>
          <ul class="guide-role-can">
            <li>予定をまるごと消す</li>
          </ul>
        </div>
      </section>

      <section class="guide-section">
        <p class="guide-label">💡 知っておくと便利</p>
        <h2 class="guide-section-title">よくある操作</h2>
        ${faqItem('common', '共通', '複数の予定をまとめて見たい', '一覧の「🗓️ カレンダー」から月表示で確認できます。日付をタップすると、その日の候補にその場で回答できます。')}
        ${faqItem('organizer', '幹事', '連絡するとき、名前を出したくない', '「カードで送る」の見本の画面で「名前を隠す（人数のみ表示）」にチェックすると、○10人／△5人のように人数だけが伝わる形式に変わります。')}
        ${faqItem('organizer', '幹事', 'コメントの届き方を選びたい', '送る内容の見本の「コメントをチャット形式で送信する」がONなら、予定カードとは別の普通のメッセージとして届きます。OFFにすると、予定カードの中に埋め込んで1通にまとめられます。')}
        ${faqItem('organizer', '幹事', '予定の内容が変わったとき', '日時やメモを変えると、すでに回答している人がいれば「変更を回答者に知らせますか？」と聞かれます。「知らせる」を選ぶと、知らせるカードの見本が出て、そのまま送れます。')}
        ${faqItem('member', '参加者', '自分も候補を編集したい', '予定ページの「🔑 編集を依頼」から作成者に依頼を送れます。作成者が承認すると、編集者として候補の追加・変更ができるようになります。')}
      </section>

      ${ctaHtml()}
    `;
  }

  return { render };
})();
