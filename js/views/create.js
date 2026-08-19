const CreateView = (() => {
  function optionRowHtml(index) {
    return `
      <div class="option-row" data-index="${index}">
        <div class="option-range">
          <label class="option-sublabel">開始<input type="datetime-local" class="option-start" required></label>
          <label class="option-sublabel">完了<input type="datetime-local" class="option-end" required></label>
        </div>
        <button type="button" class="btn btn-remove-option">×</button>
      </div>`;
  }

  function render(root, ctx) {
    root.innerHTML = `
      <div class="page-header">
        <a class="btn-back" href="?view=list">← 戻る</a>
        <h1>予定を作成</h1>
      </div>
      <form id="create-form">
        <label>タイトル<input type="text" id="f-title" required></label>
        <label>説明（任意）<textarea id="f-description"></textarea></label>
        <label>回答期限（任意）<input type="datetime-local" id="f-deadline"></label>
        <div class="options-block">
          <label>候補日時（開始〜完了）</label>
          <div id="option-list">${optionRowHtml(0)}</div>
          <button type="button" id="add-option" class="btn">＋ 候補を追加</button>
        </div>
        <button type="submit" class="btn btn-primary">作成する</button>
      </form>
    `;

    const optionList = root.querySelector('#option-list');
    let index = 1;

    root.querySelector('#add-option').addEventListener('click', () => {
      optionList.insertAdjacentHTML('beforeend', optionRowHtml(index++));
    });

    optionList.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-remove-option')) {
        const rows = optionList.querySelectorAll('.option-row');
        if (rows.length > 1) {
          e.target.closest('.option-row').remove();
        }
      }
    });

    root.querySelector('#create-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = root.querySelector('#f-title').value.trim();
      const description = root.querySelector('#f-description').value.trim();
      const deadline = root.querySelector('#f-deadline').value;

      const optionRows = Array.from(optionList.querySelectorAll('.option-row'));
      const options = optionRows
        .map((row) => ({
          startAt: row.querySelector('.option-start').value,
          endAt: row.querySelector('.option-end').value,
        }))
        .filter((opt) => opt.startAt && opt.endAt);

      if (!title || !options.length) {
        alert('タイトルと候補日時（開始・完了とも）を1件以上入力してください');
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
