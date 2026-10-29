// 予定の画面（DetailView）：見出し・イベントごとの ○△× と答えた人・コメント・カードで送る。
// app.js が ?event= のとき render を呼ぶ。見出しは detailHeader.js、イベントの行は optionCard.js・optionComments.js
const DetailView = (() => {
  // 予定を読んで画面を描く。opts.silent なら読みこみ中の箱を出さずに描きなおす
  async function render(root, ctx, opts) {
    if (!opts || !opts.silent) {
      root.innerHTML = AppUtil.loadingHtml();
    }

    if (ctx.claimEditor) {
      try {
        await AppApi.claimEditor({
          eventId: ctx.eventId,
          userId: ctx.identity.userId,
          displayName: ctx.identity.displayName,
          pictureUrl: ctx.identity.pictureUrl,
          inviteKey: ctx.inviteKey,
        });
      } catch (err) {
        AppUtil.notifyError('編集者になれませんでした', err);
      }
    }

    const data = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });
    // 同じ予定を、読みこみ中の箱なしで描きなおす
    const refresh = () => render(root, ctx, { silent: true });

    renderSummary(root, ctx, data, refresh);
  }

  // 紹介・予定を送る・編集者を招待・予定を消す のボタンをつなぐ
  function wireCommonActions(root, ctx, { canShare, isCreator }) {
    AppUtil.wireAsyncButton(root.querySelector('#share-app-btn'), () => AppShare.shareApp(), {
      errorPrefix: '送れませんでした',
    });
    if (canShare) {
      AppUtil.wireAsyncButton(root.querySelector('#share-event'), () => AppShare.shareEvent(ctx.eventId), {
        errorPrefix: '送れませんでした',
      });
    }
    if (isCreator) {
      AppUtil.wireAsyncButton(root.querySelector('#delete-event'), async () => {
        await AppApi.deleteEvent({ eventId: ctx.eventId, userId: ctx.identity.userId });
        AppRouter.navigate({ view: 'list' });
      }, {
        confirm: { title: 'この予定を消しますか？', text: '回答とコメントもすべて消えて、元に戻せません。', ok: '消す', danger: true },
        errorPrefix: '消せませんでした',
      });
      AppUtil.wireAsyncButton(root.querySelector('#invite-editor'), () => AppShare.inviteEditor(ctx.eventId), {
        errorPrefix: '招待を送れませんでした',
      });
    }
  }

  const ANSWERS = ['○', '△', '×'];

  // ○△× ごとの回答者の顔。自分 → コメントした人 → ほかの人 の順。コメントした人の顔を押すとコメントが出る
  function respondentGroupsHtml(row, myUserId) {
    const commentTextByUser = {};
    (row.comments || []).forEach((c) => {
      (commentTextByUser[c.userId] = commentTextByUser[c.userId] || []).push(c.text);
    });
    // 答えた人の並べ順（自分 → コメントのある人 → ほか）
    const rank = (r) => (r.userId === myUserId ? 2 : commentTextByUser[r.userId] ? 1 : 0);
    // 答えた人1人分（アイコンと名前。コメントがあれば押すと出る）
    const respondentHtml = (r, answer) => {
      const comments = commentTextByUser[r.userId];
      const isMe = r.userId === myUserId;
      return `<span class="respondent${isMe ? ' me' : ''}">
        <span class="avatar-wrap"${comments ? ' role="button" tabindex="0" data-comment-toggle="1"' : ''}>
          ${AppUtil.avatarHtml(r.displayName, r.pictureUrl, answer)}
          ${comments ? '<span class="avatar-comment-badge">💬</span>' : ''}
        </span>
        <span>${AppUtil.escapeHtml(r.displayName)}${isMe ? '（自分）' : ''}</span>
        ${comments ? `<span class="respondent-comment-popup" hidden>${comments.map((t) => AppUtil.escapeHtml(t)).join('<br>')}</span>` : ''}
      </span>`;
    };
    return ANSWERS.map((answer) => {
      const list = row.respondents[answer] || [];
      const sorted = [...list].sort((a, b) => rank(b) - rank(a));
      return `
        <div class="respondent-group ${OptionCard.statusClass(answer)}">
          <p class="respondent-label">${answer}</p>
          ${list.length
            ? `<div class="respondent-list">${sorted.map((r) => respondentHtml(r, answer)).join('')}</div>`
            : '<p class="empty-respondents">なし</p>'}
        </div>`;
    }).join('');
  }

  // イベントごとの行（日時・○△× のボタンと数・答えた人・連絡のボタン）の HTML
  function summaryRowsHtml(event, summary, canEdit, myUserId, myAnswers) {
    myAnswers = myAnswers || {};
    return summary.map((row, rowIndex) => {
      const opt = row.option;
      const answerByUser = {};
      ANSWERS.forEach((a) => (row.respondents[a] || []).forEach((r) => { answerByUser[r.userId] = a; }));
      const enrichedComments = (row.comments || []).map((c) => ({ ...c, answer: answerByUser[c.userId] }));
      // 「カードで送る」（候補ごとの連絡）で使う、○△× ごとの名前
      const groups = {};
      ANSWERS.forEach((a) => {
        const names = (row.respondents[a] || []).map((r) => r.displayName);
        if (names.length) groups[a] = names;
      });
      const totalCount = row.counts['○'] + row.counts['△'] + row.counts['×'];
      const card = `
        <div class="ls-panel summary-row ${OptionCard.statusClass(myAnswers[opt.optionId])}" data-row="${rowIndex}" data-option-id="${AppUtil.escapeHtml(opt.optionId)}" data-option-title="${AppUtil.escapeHtml(opt.title || event.title)}" data-option-start="${AppUtil.escapeHtml(opt.startAt || '')}" data-option-end="${AppUtil.escapeHtml(opt.endAt || '')}" data-option-location="${AppUtil.escapeHtml(opt.location || '')}" data-groups="${AppUtil.escapeHtml(JSON.stringify(groups))}">
          ${OptionCard.metaHtml(opt, canEdit, enrichedComments, myUserId)}
          <div class="summary-answer-row">
            ${OptionCard.answerButtonsHtml(opt.optionId, myAnswers[opt.optionId], row.counts)}
            <div class="summary-answer-side">
              <span class="summary-comment-row">
                ${row.commentCount ? `<span class="comment-count">💬 ${row.commentCount}</span>` : ''}
                ${OptionComments.commentAddToggleHtml(opt.optionId)}
              </span>
              ${canEdit && totalCount ? `<button type="button" class="ls-button line is-oqrn remind-btn" data-row="${rowIndex}">カードで送る</button>` : ''}
            </div>
          </div>
          <details class="respondents-fold">
            <summary>回答者を見る（${totalCount}人）</summary>
            ${respondentGroupsHtml(row, myUserId)}
          </details>
        </div>`;
      if (!AppUtil.hasEnded(opt)) return card;
      // 終わったイベントは、たたんでおく
      return `
        <details class="summary-row-collapsed">
          <summary>${AppUtil.titleIconHtml(opt.title || '(タイトルなし)')}（終了）</summary>
          ${card}
        </details>`;
    }).join('');
  }

  // アイコンを押すと、その人のコメントを出したり隠したりする
  function wireRespondentComments(root) {
    root.querySelectorAll('.avatar-wrap[data-comment-toggle]').forEach((wrap) => {
      AppUtil.onActivate(wrap, () => {
        const popup = wrap.parentElement.querySelector('.respondent-comment-popup');
        if (popup) popup.hidden = !popup.hidden;
      });
    });
  }

  // イベントごとの「カードで送る」（答えた人への連絡）をつなぐ
  function wireRemindButtons(root, eventTitle, eventId) {
    root.querySelectorAll('.remind-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const rowEl = btn.closest('.summary-row');
        const groups = rowEl && rowEl.dataset.groups ? JSON.parse(rowEl.dataset.groups) : {};
        if (!Object.keys(groups).length) return;

        btn.disabled = true;
        btn.textContent = '準備中…';
        try {
          await AppShare.remindRespondents({
            eventId, groups,
            optionId: rowEl ? rowEl.dataset.optionId : '',
            optionTitle: rowEl ? rowEl.dataset.optionTitle : eventTitle,
            optionStartAt: rowEl ? rowEl.dataset.optionStart : '',
            optionEndAt: rowEl ? rowEl.dataset.optionEnd : '',
            optionLocation: rowEl ? rowEl.dataset.optionLocation : '',
          });
          // 送ったあとの知らせは送る流れ（Q キットの送ったあとのシート）が出す
        } catch (err) {
          AppUtil.notifyError('連絡を送れませんでした', err);
        } finally {
          btn.textContent = 'カードで送る';
          btn.disabled = false;
        }
      });
    });
  }

  // 画面全体を描いて、全部のボタンをつなぐ
  function renderSummary(root, ctx, data, refresh) {
    const canEdit = data.isCreator || data.isEditor;
    // 回答者・コメントの ID は、この予定だけの記号。自分の記号は data.me
    const rows = summaryRowsHtml(data.event, data.summary, canEdit, data.me, data.myAnswers);

    root.innerHTML = `
      ${DetailHeader.headerHtml(data.event, data, canEdit, ctx)}
      <section class="summary-section">
        <p class="event-meta">イベント数：${data.options.length}件 / 回答者数：${data.totalRespondents}人</p>
        <div class="summary-list">${rows}</div>
      </section>
      ${canEdit ? `
        <details class="ls-fold">
          <summary><span class="ls-fold-icon" aria-hidden="true">＋</span>イベントを追加</summary>
          <div class="ls-fold-body">
            <p class="ls-hint">追加すると、既に回答した人も新しいイベントへの回答が必要になります。</p>
            <div class="option-card">
              <div class="option-card-head">
                <span class="option-card-icon">🗓️</span>
                ${OptionCard.titleFieldHtml('new-option')}
              </div>
              ${OptionCard.rangeLocationFieldsHtml('new-option')}
              <button id="add-option-btn" class="ls-button is-primary is-block" type="button">＋ このカードの内容でイベントを追加する</button>
            </div>
          </div>
        </details>
        ${data.isCreator ? '<button id="delete-event" class="ls-button is-danger is-block" type="button">🗑 予定を消す</button>' : ''}
        <div class="sendbar-spacer"></div>
        <div class="ls-sendbar">
          <div class="ls-sendbar-inner">
            <button id="share-event" class="ls-send line is-oqrn" type="button">カードで送る</button>
          </div>
        </div>` : ''}
    `;

    wireRemindButtons(root, data.event.title, ctx.eventId);
    wireRespondentComments(root);
    DetailHeader.wireEventEdit(root, ctx, refresh);
    DetailHeader.wireEditAccessSection(root, ctx, data);
    OptionCard.wireAnswerButtons(root, ctx, refresh);
    OptionComments.wireComments(root, ctx, refresh);
    wireCommonActions(root, ctx, { canShare: canEdit, isCreator: data.isCreator });

    root.querySelector('#refresh-event').addEventListener('click', async (e) => {
      const stopLoading = AppUtil.beginButtonLoading(e.currentTarget);
      try {
        await refresh();
      } finally {
        stopLoading();
      }
    });

    if (canEdit) {
      OptionCard.wireEditForms(root, ctx, refresh);

      root.querySelector('#add-option-btn').addEventListener('click', async (e) => {
        const fields = OptionCard.readFields(root, 'new-option');
        const error = AppUtil.validateEventFields(fields);
        if (error) { AppUtil.notify(error); return; }

        await AppUtil.saveWithButton(e.currentTarget, async () => {
          await AppApi.addOptions({ eventId: ctx.eventId, userId: ctx.identity.userId, options: [fields] });
          await refresh();
        }, 'イベントを足せませんでした');
      });
    }
  }

  return { render };
})();
