const AppRouter = (() => {
  function getQueryState() {
    const params = new URLSearchParams(window.location.search);
    return {
      view: params.get('view') || '',
      eventId: params.get('event') || '',
      claimEditor: params.get('claimEditor') === '1',
    };
  }

  function navigate(params) {
    const url = new URL(window.location.href);
    url.search = '';
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });
    window.location.href = url.toString();
  }

  return { getQueryState, navigate };
})();
