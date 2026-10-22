const CreateView = (() => {
  function optionCardHtml(index) {
    return `
      <div class="option-card" data-index="${index}">
        <div class="option-card-head">
          <span class="option-card-icon">🗓️</span>
          ${OptionCard.titleFieldHtml('option', null, 'イベント名（例: BBQ）')}
          <button type="button" class="ls-icon-button btn-remove-option" aria-label="このイベントを消す">×</button>
        </div>
        ${OptionCard.rangeLocationFieldsHtml('option')}
      </div>`;
  }

  function render(root, ctx) {
    root.innerHTML = `
      <header class="page-header">
        <a class="ls-back" href="?view=list">戻る</a>
        <h1>予定を作成</h1>
      </header>
      <form id="create-form" class="ls-panel">
        <label class="ls-field"><span class="ls-label">予定のタイトル（例: 8月）</span><input type="text" id="f-title" class="ls-input" required></label>
        <label class="ls-field"><span class="ls-label">説明（任意）</span><textarea id="f-description" class="ls-input is-short"></textarea></label>
        <div class="ls-field">
          <span class="ls-label">イベント</span>
          <div id="option-list" class="option-list">${optionCardHtml(0)}</div>
          <button type="button" id="add-option" class="ls-button">＋ イベントを追加</button>
        </div>
        <button type="submit" class="ls-button is-primary is-block">作成する</button>
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
      const removeBtn = e.target.closest('.btn-remove-option');
      if (removeBtn && optionList.querySelectorAll('.option-card').length > 1) {
        // 確かめずにすぐ消し、トーストの「元に戻す」で同じ場所に戻す（入れた中身もそのまま）
        const card = removeBtn.closest('.option-card');
        const next = card.nextElementSibling;
        card.remove();
        updateRemoveButtons();
        AppUtil.notify('イベントを消しました', {
          actionLabel: '元に戻す',
          onAction: () => {
            optionList.insertBefore(card, next && next.parentNode === optionList ? next : null);
            updateRemoveButtons();
          },
        });
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
        AppUtil.notify('予定のタイトルと、イベント（タイトル・開始・完了とも）を1件以上入力してください');
        return;
      }
      const fieldError = options.map(AppUtil.validateEventFields).find(Boolean);
      if (fieldError) {
        AppUtil.notify(fieldError);
        return;
      }

      const submitBtn = root.querySelector('button[type="submit"]');
      await AppUtil.saveWithButton(submitBtn, async () => {
        const { eventId } = await AppApi.createEvent({
          title, description, options,
          // userId：LINE の中では GAS がログインから本人を決めて上書きする。ローカルの仮ユーザーはこれで通る
          userId: ctx.identity.userId,
          creatorUserId: ctx.identity.userId,
          creatorDisplayName: ctx.identity.displayName,
          creatorPictureUrl: ctx.identity.pictureUrl,
        });
        AppRouter.navigate({ event: eventId });
      }, '作れませんでした');
    });
  }

  return { render };
})();
