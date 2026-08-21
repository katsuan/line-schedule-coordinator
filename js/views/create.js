const CreateView = (() => {
  function optionCardHtml(index) {
    return `
      <div class="option-card" data-index="${index}">
        <div class="option-card-head">
          <span class="option-card-icon">🗓️</span>
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

    // カードが1枚だけのときは削除ボタンを押しても何も起きず分かりにくいため、
    // そもそも押せない（非表示）状態にしておく。
    const updateRemoveButtons = () => {
      const cards = optionList.querySelectorAll('.option-card');
      const onlyOne = cards.length <= 1;
      cards.forEach((card) => {
        card.querySelector('.btn-remove-option').hidden = onlyOne;
      });
    };
    updateRemoveButtons();

    root.querySelector('#add-option').addEventListener('click', () => {
      optionList.insertAdjacentHTML('beforeend', optionCardHtml(index++));
      updateRemoveButtons();
    });

    optionList.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-option')) {
        const cards = optionList.querySelectorAll('.option-card');
        if (cards.length > 1) {
          e.target.closest('.option-card').remove();
          updateRemoveButtons();
        }
      }
    });

    root.querySelector('#create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = root.querySelector('#f-title').value.trim();
      const description = root.querySelector('#f-description').value.trim();

      const optionCards = Array.from(optionList.querySelectorAll('.option-card'));
      const allFields = optionCards.map((card) => OptionCard.readFields(card, 'option'));
      // 何も入力されていないカード（追加だけして使わなかった等）は無視するが、
      // 一部だけ入力されたカードは不備として弾く（黙って消えるとデータ欠落に気づけないため）。
      const isBlank = (opt) => !opt.title && !opt.startAt && !opt.endAt && !opt.location;
      const options = allFields.filter((opt) => !isBlank(opt));

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
      const stopLoading = AppUtil.beginButtonLoading(submitBtn);
      try {
        const { eventId } = await AppApi.createEvent({
          title, description, options,
          creatorUserId: ctx.identity.userId,
          creatorDisplayName: ctx.identity.displayName,
          creatorPictureUrl: ctx.identity.pictureUrl,
        });
        AppRouter.navigate({ event: eventId });
      } catch (err) {
        alert('作成に失敗しました: ' + err.message);
        stopLoading();
      }
    });
  }

  return { render };
})();
