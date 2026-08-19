const DetailView = (() => {
  const ANSWERS = ['○', '△', '×'];

  async function render(root, ctx) {
    root.innerHTML = `<div class="loading">読み込み中...</div>`;
    const data = await AppApi.getEvent({ eventId: ctx.eventId, userId: ctx.identity.userId });

    if (!data.hasAnswered) {
      renderAnswerForm(root, ctx, data, false);
    } else if (data.isCreator) {
      await renderCreatorSummary(root, ctx, data);
    } else {
      renderMyAnswer(root, ctx, data);
    }
  }

  function headerHtml(event) {
    return `
      <div class="page-header">
        <a class="btn-back" href="?view=list">← 一覧へ</a>
        <h1>${AppUtil.escapeHtml(event.title)}</h1>
        ${event.description ? `<p class="event-description">${AppUtil.escapeHtml(event.description)}</p>` : ''}
        ${event.deadline ? `<p class="event-meta">回答期限: ${AppUtil.formatDateTimeLocal(event.deadline)}</p>` : ''}
      </div>`;
  }

  function avatarHtml(displayName, pictureUrl) {
    const initial = AppUtil.escapeHtml(String(displayName || '?').slice(0, 1));
    const style = pictureUrl ? ` style="background-image:url('${pictureUrl.replace(/'/g, '%27')}')"` : '';
    return `<span class="avatar"${style}>${pictureUrl ? '' : initial}</span>`;
  }

  function renderAnswerForm(root, ctx, data, isEditing) {
    const rows = data.options.map((opt) => `
      <div class="answer-row" data-option-id="${opt.optionId}">
        <span class="answer-date">${AppUtil.formatDateTimeLocal(opt.startAt)}</span>
        <span class="answer-choices">
          ${ANSWERS.map((a) => `
            <label class="choice">
              <input type="radio" name="answer-${opt.optionId}" value="${a}" ${data.myAnswers[opt.optionId] === a ? 'checked' : ''}>
              <span>${a}</span>
            </label>`).join('')}
        </span>
      </div>`).join('');

    root.innerHTML = `
      ${headerHtml(data.event)}
      <form id="answer-form">
        ${rows}
        <button type="submit" class="btn btn-primary">${isEditing ? '回答を更新する' : '回答する'}</button>
      </form>
      ${data.isCreator ? '<p class="event-meta">作成者として、回答後に集計・共有画面が表示されます。</p>' : ''}
    `;

    root.querySelector('#answer-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const answers = data.options.map((opt) => {
        const checked = root.querySelector(`input[name="answer-${opt.optionId}"]:checked`);
        return checked ? { optionId: opt.optionId, answer: checked.value } : null;
      }).filter(Boolean);

      if (answers.length !== data.options.length) {
        alert('すべての候補日に回答してください');
        return;
      }

      const submitBtn = root.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        await AppApi.submitAnswer({
          eventId: ctx.eventId,
          userId: ctx.identity.userId,
          displayName: ctx.identity.displayName,
          pictureUrl: ctx.identity.pictureUrl,
          answers,
        });
        await render(root, ctx);
      } catch (err) {
        alert('回答の送信に失敗しました: ' + err.message);
        submitBtn.disabled = false;
      }
    });
  }

  function renderMyAnswer(root, ctx, data) {
    const rows = data.options.map((opt) => `
      <div class="answer-row readonly">
        <span class="answer-date">${AppUtil.formatDateTimeLocal(opt.startAt)}</span>
        <span class="answer-value">${AppUtil.escapeHtml(data.myAnswers[opt.optionId] || '-')}</span>
      </div>`).join('');

    root.innerHTML = `
      ${headerHtml(data.event)}
      <div class="my-answers">${rows}</div>
      <button id="edit-answer" class="btn">回答を変更する</button>
    `;

    root.querySelector('#edit-answer').addEventListener('click', () => {
      renderAnswerForm(root, ctx, data, true);
    });
  }

  async function renderCreatorSummary(root, ctx, data) {
    const summaryData = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });

    const myAnswerRows = data.options.map((opt) => `
      <div class="answer-row readonly">
        <span class="answer-date">${AppUtil.formatDateTimeLocal(opt.startAt)}</span>
        <span class="answer-value">${AppUtil.escapeHtml(data.myAnswers[opt.optionId] || '-')}</span>
      </div>`).join('');

    const rows = summaryData.summary.map((row) => {
      const respondentsHtml = (answer) => {
        const list = row.respondents[answer] || [];
        if (!list.length) return '<p class="empty-respondents">なし</p>';
        return `<div class="respondent-list">${list.map((r) => `
          <span class="respondent">${avatarHtml(r.displayName, r.pictureUrl)}<span>${AppUtil.escapeHtml(r.displayName)}</span></span>`).join('')}</div>`;
      };
      return `
        <div class="summary-row">
          <div class="summary-date">${AppUtil.formatDateTimeLocal(row.option.startAt)}</div>
          <div class="summary-counts">
            <span>○ ${row.counts['○']}</span>
            <span>△ ${row.counts['△']}</span>
            <span>× ${row.counts['×']}</span>
          </div>
          <details>
            <summary>回答者を見る</summary>
            <p class="respondent-label">○</p>${respondentsHtml('○')}
            <p class="respondent-label">△</p>${respondentsHtml('△')}
            <p class="respondent-label">×</p>${respondentsHtml('×')}
          </details>
        </div>`;
    }).join('');

    root.innerHTML = `
      ${headerHtml(data.event)}
      <section>
        <h2>自分の回答</h2>
        <div class="my-answers">${myAnswerRows}</div>
        <button id="edit-answer" class="btn">回答を変更する</button>
      </section>
      <section>
        <h2>回答集計</h2>
        <p class="event-meta">回答者数: ${summaryData.totalRespondents}人</p>
        <div class="summary-list">${rows}</div>
        <button id="share-event" class="btn btn-primary">LINEで共有する</button>
      </section>
    `;

    root.querySelector('#edit-answer').addEventListener('click', () => {
      renderAnswerForm(root, ctx, data, true);
    });

    root.querySelector('#share-event').addEventListener('click', async (e) => {
      e.target.disabled = true;
      try {
        await AppShare.shareEvent(ctx.eventId);
      } catch (err) {
        alert('共有に失敗しました: ' + err.message);
      } finally {
        e.target.disabled = false;
      }
    });
  }

  return { render };
})();
