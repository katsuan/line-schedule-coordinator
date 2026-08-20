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
    } else if (view === 'calendar') {
      await CalendarView.render(root, ctx);
    } else if (view === 'list') {
      await ListView.render(root, ctx);
    } else {
      // パラメータなしでの起動（LIFFルートURLへの直接アクセスなど）はガイド画面を入口にする
      GuideView.render(root, ctx);
    }
  } catch (err) {
    console.error(err);
    GuideView.render(root, {}, { errorMessage: err.message });
  }
})();
