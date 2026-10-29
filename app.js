// くるかなの入口：LINE の本人を決め、URL を見て出す画面（予定・作る・カレンダー・一覧・使い方）を選ぶ。
// index.html のいちばん最後に読む。開けなかったときは使い方の画面に、やさしい言葉で出す
(async () => {
  const root = document.getElementById('app');
  // 開始を入れたら完了を自動で入れる（どの画面の入力欄でも）
  OptionCard.wireEndFollowsStart(root);

  try {
    const identity = await AppPlatform.initIdentity();
    const { view, eventId, claimEditor, inviteKey, approveEditor, requesterId, requesterName, requesterPic } = AppRouter.getQueryState();
    const ctx = { identity, eventId, claimEditor, inviteKey, approveEditor, requesterId, requesterName, requesterPic };

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
    GuideView.render(root, {}, { error: err });
  }
})();
