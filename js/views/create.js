const CreateView = (() => {
  function optionCardHtml(index) {
    return `
      <div class="option-card" data-index="${index}">
        <div class="option-card-head">
          <span class="option-card-icon">📅</span>
          <input type="text" class="option-title" placeholder="予定タイトル（例: BBQ）" required>
          <button type="button" class="btn-remove-option" aria-label="この予定枠を削除">×</button>
        </div>
        <div class="option-range">
          <label class="option-sublabel">開始<input type="datetime-local" step="900" class="option-start" required></label>
          <label class="option-sublabel">完了<input type="datetime-local" step="900" class="option-end" required></label>
        </div>
        <input type="text" class="option-location" placeholder="📍 場所（任意）">
      </div>`;
  }

  function render(root, ctx) {
    root.innerHTML = `
      <div class="page-header">
        <a class="btn-back" href="?view=list">← 戻る</a>
        <h1>予定を作成</h1>
      </div>
      <form id="create-form">
        <label>大枠のタイトル（例: 8月）<input type="text" id="f-title" required></label>
        <label>説明（任意）<textarea id="f-description"></textarea></label>
        <label>回答期限（任意）<input type="datetime-local" step="900" id="f-deadline"></label>
        <div class="options-block">
          <label>予定枠</label>
          <div id="option-list">${optionCardHtml(0)}</div>
          <button type="button" id="add-option" class="btn">＋ 予定枠を追加</button>
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
        .map((card) => ({
          title: card.querySelector('.option-title').value.trim(),
          startAt: card.querySelector('.option-start').value,
          endAt: card.querySelector('.option-end').value,
          location: card.querySelector('.option-location').value.trim(),
        }))
        .filter((opt) => opt.startAt && opt.endAt && opt.title);

      if (!title || !options.length) {
        alert('大枠のタイトルと、予定枠（タイトル・開始・完了とも）を1件以上入力してください');
        return;
      }
      if (options.some((opt) => new Date(opt.endAt) <= new Date(opt.startAt))) {
        alert('完了は開始より後の日時にしてください');
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
