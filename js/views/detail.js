const DetailView = (() => {
  const ANSWERS = ['○', '△', '×'];

  async function render(root, ctx) {
    root.innerHTML = `<div class="loading">読み込み中...</div>`;
    const data = await AppApi.getEvent({ eventId: ctx.eventId, userId: ctx.identity.userId });

    if (data.isCreator) {
      await renderCreatorSummary(root, ctx, data);
    } else if (data.hasAnswered) {
      renderMyAnswer(root, ctx, data);
    } else {
      renderAnswerForm(root, ctx, data, false);
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

    const rows = summaryData.summary.map((row) => {
      const respondentNames = (answer) => (row.respondents[answer] || [])
        .map((r) => AppUtil.escapeHtml(r.displayName)).join('、') || 'なし';
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
            <p>○: ${respondentNames('○')}</p>
            <p>△: ${respondentNames('△')}</p>
            <p>×: ${respondentNames('×')}</p>
          </details>
        </div>`;
    }).join('');

    root.innerHTML = `
      ${headerHtml(data.event)}
      <p class="event-meta">回答者数: ${summaryData.totalRespondents}人</p>
      <div class="summary-list">${rows}</div>
      <button id="share-event" class="btn btn-primary">LINEで共有する</button>
    `;

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
