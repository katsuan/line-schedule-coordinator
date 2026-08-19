const DetailView = (() => {
  const ANSWERS = ['○', '△', '×'];

  async function render(root, ctx) {
    root.innerHTML = `<div class="loading"><span class="spinner"></span>読み込み中...</div>`;
    const data = await AppApi.getEvent({ eventId: ctx.eventId, userId: ctx.identity.userId });

    if (!data.hasAnswered) {
      renderAnswerForm(root, ctx, data, false);
    } else {
      await renderSummary(root, ctx, data);
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

  function shareButtonHtml(label) {
    return `<button id="share-event" class="btn btn-primary" type="button">${label}</button>`;
  }

  function wireShareButton(root, ctx) {
    const btn = root.querySelector('#share-event');
    if (!btn) return;
    btn.addEventListener('click', async (e) => {
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

  function deleteButtonHtml() {
    return `<button id="delete-event" class="btn btn-danger" type="button">予定を削除する</button>`;
  }

  function wireDeleteButton(root, ctx) {
    const btn = root.querySelector('#delete-event');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!confirm('この予定を削除します。回答データもすべて削除され、元に戻せません。よろしいですか？')) return;
      btn.disabled = true;
      try {
        await AppApi.deleteEvent({ eventId: ctx.eventId, userId: ctx.identity.userId });
        AppRouter.navigate({ view: 'list' });
      } catch (err) {
        alert('削除に失敗しました: ' + err.message);
        btn.disabled = false;
      }
    });
  }

  function avatarHtml(displayName, pictureUrl) {
    const initial = AppUtil.escapeHtml(String(displayName || '?').slice(0, 1));
    const style = pictureUrl ? ` style="background-image:url('${pictureUrl.replace(/'/g, '%27')}')"` : '';
    return `<span class="avatar"${style}>${pictureUrl ? '' : initial}</span>`;
  }

  function summaryRowsHtml(event, summary) {
    return summary.map((row) => {
      const respondentsHtml = (answer) => {
        const list = row.respondents[answer] || [];
        if (!list.length) return '<p class="empty-respondents">なし</p>';
        return `<div class="respondent-list">${list.map((r) => `
          <span class="respondent">${avatarHtml(r.displayName, r.pictureUrl)}<span>${AppUtil.escapeHtml(r.displayName)}</span></span>`).join('')}</div>`;
      };
      return `
        <div class="summary-row">
          <div class="summary-date-block">
            <div class="summary-date">${AppUtil.formatDateRange(row.option.startAt, row.option.endAt)}</div>
            ${AppUtil.calendarLinkHtml(event.title, event.description, row.option.startAt, row.option.endAt)}
          </div>
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
  }

  function renderAnswerForm(root, ctx, data, isEditing) {
    const rows = data.options.map((opt) => `
      <div class="answer-row" data-option-id="${opt.optionId}">
        <span class="answer-date-block">
          <span class="answer-date">${AppUtil.formatDateRange(opt.startAt, opt.endAt)}</span>
          ${AppUtil.calendarLinkHtml(data.event.title, data.event.description, opt.startAt, opt.endAt)}
        </span>
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
      <section>
        <button id="toggle-summary" class="btn" type="button">現在の回答状況を見る</button>
        <div id="summary-preview" class="summary-list" hidden></div>
      </section>
      ${data.isCreator ? `
        <section>
          <p class="event-meta">作成者として、回答前でも共有できます。</p>
          ${shareButtonHtml('LINEで共有する')}
          ${deleteButtonHtml()}
        </section>` : ''}
    `;

    wireShareButton(root, ctx);
    wireDeleteButton(root, ctx);

    const toggleBtn = root.querySelector('#toggle-summary');
    const previewBox = root.querySelector('#summary-preview');
    let previewLoaded = false;
    toggleBtn.addEventListener('click', async () => {
      const nowHidden = !previewBox.hidden;
      if (nowHidden) {
        previewBox.hidden = true;
        toggleBtn.textContent = '現在の回答状況を見る';
        return;
      }
      toggleBtn.textContent = '閉じる';
      previewBox.hidden = false;
      if (!previewLoaded) {
        previewBox.innerHTML = '<div class="loading"><span class="spinner"></span>読み込み中...</div>';
        try {
          const summaryData = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });
          previewBox.innerHTML = summaryRowsHtml(data.event, summaryData.summary);
          previewLoaded = true;
        } catch (err) {
          previewBox.innerHTML = `<p class="error">${AppUtil.escapeHtml(err.message)}</p>`;
        }
      }
    });

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

  async function renderSummary(root, ctx, data) {
    const summaryData = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });

    const myAnswerRows = data.options.map((opt) => `
      <div class="answer-row readonly">
        <span class="answer-date-block">
          <span class="answer-date">${AppUtil.formatDateRange(opt.startAt, opt.endAt)}</span>
          ${AppUtil.calendarLinkHtml(data.event.title, data.event.description, opt.startAt, opt.endAt)}
        </span>
        <span class="answer-value">${AppUtil.escapeHtml(data.myAnswers[opt.optionId] || '-')}</span>
      </div>`).join('');

    const rows = summaryRowsHtml(data.event, summaryData.summary);

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
        ${data.isCreator ? `${shareButtonHtml('LINEで共有する')}${deleteButtonHtml()}` : ''}
      </section>
    `;

    root.querySelector('#edit-answer').addEventListener('click', () => {
      renderAnswerForm(root, ctx, data, true);
    });

    if (data.isCreator) {
      wireShareButton(root, ctx);
      wireDeleteButton(root, ctx);
    }
  }

  return { render };
})();
