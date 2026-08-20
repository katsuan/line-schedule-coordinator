const GuideView = (() => {
  function stepItem(num, title, desc) {
    return `
      <li>
        <span class="guide-step-num">${num}</span>
        <div class="guide-step-body">
          <p class="guide-step-title">${title}</p>
          <p class="event-meta">${desc}</p>
        </div>
      </li>`;
  }

  function faqItem(q, a) {
    return `
      <div class="guide-faq-item">
        <p class="guide-faq-q">Q. ${q}</p>
        <p class="event-meta">${a}</p>
      </div>`;
  }

  function ctaHtml() {
    return `<a class="btn btn-primary" href="?view=list">＋ 予定をはじめる</a>`;
  }

  function render(root, ctx, opts) {
    const notice = opts && opts.errorMessage
      ? `<div class="guide-notice">⚠️ ページを表示できませんでした（${AppUtil.escapeHtml(opts.errorMessage)}）。下のボタンから一覧をご確認ください。</div>`
      : '';

    root.innerHTML = `
      ${notice}
      <div class="guide-hero">
        <div class="guide-hero-icon">🗓️</div>
        <h1>アプリを追加せずに、<br>LINEで日程調整。</h1>
        <p class="event-meta">友だち追加もBotもいりません。このページで、予定づくり〜回答〜集計までの流れをおさらいできます。</p>
      </div>
      ${ctaHtml()}

      <section class="guide-section">
        <p class="guide-label">👤 参加者のとき</p>
        <h2 class="guide-section-title">予定に回答する</h2>
        <div class="guide-step-card">
          <ol class="guide-step-list">
            ${stepItem(1, '届いたメッセージの「回答する」を開く', '幹事から届いたカード形式のメッセージから、そのまま開けます。')}
            ${stepItem(2, '候補ごとに○△×をタップ', '複数の候補日があれば、それぞれに回答します。あとから何度でも変更できます。')}
            ${stepItem(3, '伝えたいことがあれば「💬 コメントを追加」', '「19時以降なら参加できます」など、○△×だけで伝えきれないことを書き添えられます。他の参加者にも見えます。')}
          </ol>
          <div class="guide-answer-demo">
            <div class="guide-answer-demo-item">
              <span class="choice-btn choice-ok" aria-hidden="true">○</span>
              <span class="event-meta">参加できる</span>
            </div>
            <div class="guide-answer-demo-item">
              <span class="choice-btn choice-maybe" aria-hidden="true">△</span>
              <span class="event-meta">未定</span>
            </div>
            <div class="guide-answer-demo-item">
              <span class="choice-btn choice-ng" aria-hidden="true">×</span>
              <span class="event-meta">参加できない</span>
            </div>
          </div>
        </div>
      </section>

      <section class="guide-section">
        <p class="guide-label">🎌 幹事のとき</p>
        <h2 class="guide-section-title">予定をつくって共有する</h2>
        <div class="guide-step-card">
          <ol class="guide-step-list">
            ${stepItem(1, '一覧の「＋ 新規作成」', 'タイトルと、候補日時を1つ以上入力します（複数候補もOK）。')}
            ${stepItem(2, '「LINEで共有する」で参加者に送る', '送る前に内容のプレビューを確認できます。')}
            ${stepItem(3, '予定ページで回答状況をいつでも確認', '候補ごとの人数・回答者・コメントがまとまって見られます。')}
          </ol>
        </div>
      </section>

      <section class="guide-section">
        <p class="guide-label">🎌 幹事のとき</p>
        <h2 class="guide-section-title">幹事だけができること</h2>
        <div class="guide-role-card">
          <span class="status-badge status-creator">作成者・編集者</span>
          <ul class="guide-role-can">
            <li>候補や予定内容を編集する</li>
            <li>候補ごとに未回答・要更新の人へ「LINE送信」で個別に連絡する</li>
            <li>他の人を編集者として招待し、候補づくりを任せる</li>
            <li>このアプリ自体を友だちに紹介する</li>
          </ul>
        </div>
        <div class="guide-role-card">
          <span class="status-badge status-pending">作成者のみ</span>
          <ul class="guide-role-can">
            <li>予定をまるごと削除する</li>
          </ul>
        </div>
      </section>

      <section class="guide-section">
        <p class="guide-label">💡 知っておくと便利</p>
        <h2 class="guide-section-title">よくある操作</h2>
        ${faqItem('複数の予定をまとめて見たい', '一覧の「🗓️ カレンダー」から月表示で確認できます。日付をタップすると、その日の候補にその場で回答できます。')}
        ${faqItem('連絡するとき、名前を出したくない', '「LINE送信」のプレビュー画面で「名前を隠す（人数のみ表示）」にチェックすると、○◯人／△◯人のように人数だけが伝わる形式に変わります。')}
        ${faqItem('コメントの届き方を選びたい', '送信プレビューの「コメントをチャット形式で送信する」がONなら、予定カードとは別の普通のメッセージとして届きます。OFFにすると、予定カードの中に埋め込んで1通にまとめられます。')}
        ${faqItem('予定の内容が変わったとき', '日時や場所を編集すると、すでに回答している人がいれば「変更を知らせますか？」と確認が出ます。「はい」を選ぶと自動で通知メッセージが用意されます。')}
      </section>

      ${ctaHtml()}
    `;
  }

  return { render };
})();
