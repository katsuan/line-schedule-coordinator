const DetailView = (() => {
  const ANSWERS = ['○', '△', '×'];

  async function render(root, ctx) {
    root.innerHTML = AppUtil.loadingHtml();

    if (ctx.claimEditor) {
      try {
        await AppApi.claimEditor({
          eventId: ctx.eventId,
          userId: ctx.identity.userId,
          displayName: ctx.identity.displayName,
          pictureUrl: ctx.identity.pictureUrl,
        });
      } catch (err) {
        console.error('編集者登録に失敗しました', err);
      }
    }

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

  function optionMetaHtml(opt) {
    return `
      <div class="option-meta">
        <div class="option-meta-title">📅 ${AppUtil.escapeHtml(opt.title || '(タイトルなし)')}</div>
        <div class="option-meta-date">${AppUtil.formatDateRange(opt.startAt, opt.endAt)}</div>
        ${opt.location ? `<div class="option-meta-location">📍 ${AppUtil.escapeHtml(opt.location)}</div>` : ''}
        ${AppUtil.calendarLinkHtml(opt.title, '', opt.startAt, opt.endAt, opt.location)}
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

  function wireInviteEditorButton(root, ctx) {
    const btn = root.querySelector('#invite-editor');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const config = await AppConfig.load();
        const url = config.liffId && config.liffId !== 'YOUR_LIFF_ID'
          ? `https://liff.line.me/${config.liffId}?event=${encodeURIComponent(ctx.eventId)}&claimEditor=1`
          : '';
        const text = `「${root.querySelector('h1').textContent}」の編集をお願いします。\nこのリンクを開くと、候補日の追加や共有ができるようになります。${url ? '\n' + url : ''}`;
        await AppShare.sendTextMessage(text);
      } catch (err) {
        alert('招待の送信に失敗しました: ' + err.message);
      } finally {
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
    return summary.map((row, rowIndex) => {
      const respondentsHtml = (answer) => {
        const list = row.respondents[answer] || [];
        if (!list.length) return '<p class="empty-respondents">なし</p>';
        const names = list.map((r) => r.displayName).join(',');
        return `<div class="respondent-list">
          ${list.map((r) => `<span class="respondent">${avatarHtml(r.displayName, r.pictureUrl)}<span>${AppUtil.escapeHtml(r.displayName)}</span></span>`).join('')}
          <button type="button" class="remind-btn" data-answer="${answer}" data-row="${rowIndex}" data-names="${AppUtil.escapeHtml(names)}">催促する</button>
        </div>`;
      };
      return `
        <div class="summary-row" data-row="${rowIndex}" data-option-title="${AppUtil.escapeHtml(row.option.title || event.title)}">
          <div class="option-meta">
            <div class="option-meta-title">📅 ${AppUtil.escapeHtml(row.option.title || '(タイトルなし)')}</div>
            <div class="option-meta-date">${AppUtil.formatDateRange(row.option.startAt, row.option.endAt)}</div>
            ${row.option.location ? `<div class="option-meta-location">📍 ${AppUtil.escapeHtml(row.option.location)}</div>` : ''}
            ${AppUtil.calendarLinkHtml(row.option.title, '', row.option.startAt, row.option.endAt, row.option.location)}
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

  function wireRemindButtons(root, eventTitle, eventId) {
    root.querySelectorAll('.remind-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const names = btn.dataset.names.split(',').filter(Boolean);
        if (!names.length) return;
        const rowEl = btn.closest('.summary-row');
        const optionTitle = rowEl ? rowEl.dataset.optionTitle : eventTitle;
        btn.disabled = true;
        try {
          await AppShare.remindRespondents(optionTitle, eventId, btn.dataset.answer, names);
        } catch (err) {
          alert('催促の送信に失敗しました: ' + err.message);
        } finally {
          btn.disabled = false;
        }
      });
    });
  }

  const ANSWER_CLASS = { '○': 'choice-ok', '△': 'choice-maybe', '×': 'choice-ng' };

  function choiceButtonsHtml(optionId, myAnswers) {
    return ANSWERS.map((a) => `
      <button type="button" class="choice-btn ${ANSWER_CLASS[a]} ${myAnswers[optionId] === a ? 'selected' : ''}" data-value="${a}">${a}</button>`).join('');
  }

  function renderAnswerForm(root, ctx, data, isEditing) {
    const rows = data.options.map((opt) => `
      <div class="answer-row" data-option-id="${opt.optionId}">
        ${optionMetaHtml(opt)}
        <span class="answer-choices" data-option-id="${opt.optionId}">
          ${choiceButtonsHtml(opt.optionId, data.myAnswers)}
        </span>
      </div>`).join('');

    root.innerHTML = `
      ${headerHtml(data.event)}
      <p class="event-meta">タップすると自動的に保存されます。</p>
      <div id="answer-rows">${rows}</div>
      <section>
        <button id="toggle-summary" class="btn" type="button">現在の回答状況を見る</button>
        <div id="summary-preview" class="summary-list" hidden></div>
      </section>
      ${data.isCreator || data.isEditor ? `
        <section>
          <p class="event-meta">${data.isCreator ? '作成者' : '編集者'}として、回答前でも共有できます。</p>
          ${shareButtonHtml('LINEで共有する')}
          ${data.isCreator ? deleteButtonHtml() : ''}
        </section>` : ''}
    `;

    if (data.isCreator || data.isEditor) wireShareButton(root, ctx);
    if (data.isCreator) wireDeleteButton(root, ctx);

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
        previewBox.innerHTML = AppUtil.loadingHtml();
        try {
          const summaryData = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });
          previewBox.innerHTML = summaryRowsHtml(data.event, summaryData.summary);
          wireRemindButtons(previewBox, data.event.title, ctx.eventId);
          previewLoaded = true;
        } catch (err) {
          previewBox.innerHTML = `<p class="error">${AppUtil.escapeHtml(err.message)}</p>`;
        }
      }
    });

    const answeredMap = { ...data.myAnswers };
    let saving = false;

    root.querySelector('#answer-rows').addEventListener('click', async (e) => {
      const btn = e.target.closest('.choice-btn');
      if (!btn || saving) return;
      const container = btn.closest('.answer-choices');
      const optionId = container.dataset.optionId;
      const value = btn.dataset.value;

      container.querySelectorAll('.choice-btn').forEach((b) => b.classList.toggle('selected', b === btn));

      saving = true;
      try {
        await AppApi.submitAnswer({
          eventId: ctx.eventId,
          userId: ctx.identity.userId,
          displayName: ctx.identity.displayName,
          pictureUrl: ctx.identity.pictureUrl,
          answers: [{ optionId, answer: value }],
        });
        answeredMap[optionId] = value;
        if (data.options.every((opt) => answeredMap[opt.optionId] !== undefined)) {
          data.myAnswers = answeredMap;
          await render(root, ctx);
          return;
        }
      } catch (err) {
        alert('回答の保存に失敗しました: ' + err.message);
      } finally {
        saving = false;
      }
    });
  }

  async function renderSummary(root, ctx, data) {
    const summaryData = await AppApi.getSummary({ eventId: ctx.eventId, userId: ctx.identity.userId });

    const myAnswerRows = data.options.map((opt) => `
      <div class="answer-row readonly">
        ${optionMetaHtml(opt)}
        <span class="answer-value">${AppUtil.escapeHtml(data.myAnswers[opt.optionId] || '-')}</span>
      </div>`).join('');

    const rows = summaryRowsHtml(data.event, summaryData.summary);
    const canEdit = data.isCreator || data.isEditor;

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
      </section>
      ${canEdit ? `
        <section>
          <h2>候補を追加</h2>
          <p class="event-meta">追加すると、既に回答した人も新しい候補への回答が必要になります。</p>
          <div class="option-card">
            <div class="option-card-head">
              <span class="option-card-icon">📅</span>
              <input type="text" id="new-option-title" placeholder="予定タイトル（例: BBQ）">
            </div>
            <div class="option-range">
              <label class="option-sublabel">開始<input type="datetime-local" id="new-option-start"></label>
              <label class="option-sublabel">完了<input type="datetime-local" id="new-option-end"></label>
            </div>
            <input type="text" id="new-option-location" class="option-location" placeholder="📍 場所（任意）">
          </div>
          <button id="add-option-btn" class="btn" type="button">＋ 候補を追加する</button>
        </section>
        <section>
          ${shareButtonHtml('LINEで共有する')}
          ${data.isCreator ? `
            <button id="invite-editor" class="btn" type="button">編集者を招待する</button>
            ${deleteButtonHtml()}` : ''}
        </section>` : ''}
    `;

    root.querySelector('#edit-answer').addEventListener('click', () => {
      renderAnswerForm(root, ctx, data, true);
    });

    wireRemindButtons(root, data.event.title, ctx.eventId);

    if (canEdit) {
      wireShareButton(root, ctx);

      root.querySelector('#add-option-btn').addEventListener('click', async (e) => {
        const title = root.querySelector('#new-option-title').value.trim();
        const startAt = root.querySelector('#new-option-start').value;
        const endAt = root.querySelector('#new-option-end').value;
        const location = root.querySelector('#new-option-location').value.trim();
        if (!title || !startAt || !endAt) {
          alert('タイトル・開始・完了を入力してください');
          return;
        }
        if (new Date(endAt) <= new Date(startAt)) {
          alert('完了は開始より後の日時にしてください');
          return;
        }
        e.target.disabled = true;
        try {
          await AppApi.addOptions({ eventId: ctx.eventId, userId: ctx.identity.userId, options: [{ title, startAt, endAt, location }] });
          await render(root, ctx);
        } catch (err) {
          alert('候補の追加に失敗しました: ' + err.message);
          e.target.disabled = false;
        }
      });
    }

    if (data.isCreator) {
      wireDeleteButton(root, ctx);
      wireInviteEditorButton(root, ctx);
    }
  }

  return { render };
})();
