(async () => {
  const root = document.getElementById('app');

  try {
    const identity = await AppPlatform.initIdentity();
    const { view, eventId, claimEditor } = AppRouter.getQueryState();
    const ctx = { identity, eventId, claimEditor };

    if (eventId) {
      await DetailView.render(root, ctx);
    } else if (view === 'create') {
      CreateView.render(root, ctx);
    } else {
      await ListView.render(root, ctx);
    }
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="error">エラーが発生しました: ${AppUtil.escapeHtml(err.message)}</div>`;
  }
})();
