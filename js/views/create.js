const CreateView = (() => {
  function optionCardHtml(index) {
    return `
      <div class="option-card" data-index="${index}">
        <div class="option-card-head">
          <span class="option-card-icon">📅</span>
          ${OptionCard.titleFieldHtml('option', null, 'イベント名（例: BBQ）')}
          <button type="button" class="btn-remove-option" aria-label="このイベントを削除">×</button>
        </div>
        ${OptionCard.rangeLocationFieldsHtml('option')}
      </div>`;
  }

  function render(root, ctx) {
    root.innerHTML = `
      <div class="page-header">
        <a class="btn-back" href="?view=list">← 戻る</a>
        <h1>予定を作成</h1>
      </div>
      <form id="create-form">
        <label>予定のタイトル（例: 8月）<input type="text" id="f-title" required></label>
        <label>説明（任意）<textarea id="f-description"></textarea></label>
        <label>回答期限（任意）<input type="datetime-local" step="900" id="f-deadline"></label>
        <div class="options-block">
          <label>イベント</label>
          <div id="option-list">${optionCardHtml(0)}</div>
          <button type="button" id="add-option" class="btn">＋ イベントを追加</button>
        </div>
        <button type="submit" class="btn btn-primary">作成する</button>
      </form>
    `;

    const optionList = root.querySelector('#option-list');
    let index = 1;

    root.querySelector('#add-option').addEventListener('click', () => {
      optionList.insertAdjacentHTML('beforeend', optionCardHtml(index++));
    });

    optionList.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-option')) {
        const cards = optionList.querySelectorAll('.option-card');
        if (cards.length > 1) {
          e.target.closest('.option-card').remove();
        }
      }
    });

    root.querySelector('#create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = root.querySelector('#f-title').value.trim();
      const description = root.querySelector('#f-description').value.trim();
      const deadline = root.querySelector('#f-deadline').value;

      const optionCards = Array.from(optionList.querySelectorAll('.option-card'));
      const options = optionCards
        .map((card) => OptionCard.readFields(card, 'option'))
        .filter((opt) => opt.startAt && opt.endAt && opt.title);

      if (!title || !options.length) {
        alert('予定のタイトルと、イベント（タイトル・開始・完了とも）を1件以上入力してください');
        return;
      }
      const fieldError = options.map(AppUtil.validateEventFields).find(Boolean);
      if (fieldError) {
        alert(fieldError);
        return;
      }

      const submitBtn = root.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      try {
        const { eventId } = await AppApi.createEvent({
          title, description, deadline, options,
          creatorUserId: ctx.identity.userId,
          creatorDisplayName: ctx.identity.displayName,
          creatorPictureUrl: ctx.identity.pictureUrl,
        });
        AppRouter.navigate({ event: eventId });
      } catch (err) {
        alert('作成に失敗しました: ' + err.message);
        submitBtn.disabled = false;
      }
    });
  }

  return { render };
})();
