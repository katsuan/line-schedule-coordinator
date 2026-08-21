const AppRouter = (() => {
  function getQueryState() {
    const params = new URLSearchParams(window.location.search);
    return {
      view: params.get('view') || '',
      eventId: params.get('event') || '',
      claimEditor: params.get('claimEditor') === '1',
      approveEditor: params.get('approveEditor') === '1',
      requesterId: params.get('requesterId') || '',
      requesterName: params.get('requesterName') || '',
      requesterPic: params.get('requesterPic') || '',
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
