const AppRouter = (() => {
  // URL の中身は、形と長さを確かめてから使う（合わないものは無いのと同じ）
  function pick(params, key, pattern, max) {
    const value = params.get(key) || '';
    return value.length <= max && pattern.test(value) ? value : '';
  }

  function getQueryState() {
    const params = new URLSearchParams(window.location.search);
    return {
      view: pick(params, 'view', /^(create|calendar|list)$/, 10),
      eventId: pick(params, 'event', /^[A-Za-z0-9_-]+$/, 80),
      claimEditor: params.get('claimEditor') === '1',
      inviteKey: pick(params, 'key', /^[A-Za-z0-9_-]+$/, 40),
      approveEditor: params.get('approveEditor') === '1',
      requesterId: pick(params, 'requesterId', /^[A-Za-z0-9_-]+$/, 40),
      requesterName: pick(params, 'requesterName', /^[^\u0000-\u001f]*$/, 60),
      requesterPic: pick(params, 'requesterPic', /^https:\/\//, 500),
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
