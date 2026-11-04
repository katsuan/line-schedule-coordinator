/**
 * 画面で作るカード（AppCards）：くるかなの紹介・編集の依頼・編集を許可したお知らせ。
 * 予定・連絡・変更・招待のカードは GAS（gas/06_message.js）が作る。ボタンは画面を開くだけ（あとで押されても困らない）。
 * 呼ばれ方：share.js から。DOM に触らないので node のテストでも動く。
 */
const AppCards = (() => {
  // カードの下のボタン。URL がなければボタンなし
  function buttonFooter(label, uri) {
    if (!uri) return undefined;
    return {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: 'lg',
      contents: [{
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0284C7',
        cornerRadius: 'xxl',
        paddingAll: 'md',
        action: { type: 'uri', label, uri },
        contents: [{ type: 'text', text: label, color: '#ffffff', align: 'center', weight: 'bold', size: 'md' }],
      }],
    };
  }

  // カードのボタンの上に区切りの線を引く設定（ボタンがなければなし）
  function footerStyles(uri) {
    return uri ? { footer: { separator: true, separatorColor: '#EEEEEE' } } : undefined;
  }

  // 予定の画面を開く URL（LIFF）。extra は後ろに足す query
  function eventPageUrl(liffId, eventId, extra) {
    return liffId ? `https://liff.line.me/${liffId}?event=${encodeURIComponent(eventId)}${extra || ''}` : '';
  }

  // 「ラベル　値」の1行（依頼者・依頼先・編集できる人）
  function infoRow(label, value, labelFlex, margin) {
    return {
      type: 'box', layout: 'baseline', spacing: 'sm', margin,
      contents: [
        { type: 'text', text: label, size: 'sm', color: '#8C8C8C', flex: labelFlex },
        { type: 'text', text: value, size: 'sm', color: '#111111', flex: 5, wrap: true },
      ],
    };
  }

  // 題・小さな説明・行を並べたカード（ボタンは uri があるときだけ）
  function bubble(title, rows, buttonLabel, uri) {
    return {
      type: 'bubble',
      body: { type: 'box', layout: 'vertical', paddingBottom: 'md', contents: [{ type: 'text', text: title, weight: 'bold', size: 'lg', color: '#111111' }, ...rows] },
      footer: buttonFooter(buttonLabel, uri),
      styles: footerStyles(uri),
    };
  }

  // 小さな灰色の説明の文
  function note(text) {
    return { type: 'text', text, size: 'sm', color: '#8C8C8C', wrap: true, margin: 'md' };
  }

  // くるかなを紹介するカード
  function appIntro(liffId) {
    const liffUrl = liffId ? `https://liff.line.me/${liffId}` : '';
    return {
      altText: 'くるかな：候補の日に ○△× で答えるだけの日程調整',
      contents: bubble('🗓️ 日程調整', [note('Botの追加なしで、候補日をつくって共有するだけ。○△×で回答が集まります。')], '使ってみる', liffUrl),
    };
  }

  // 編集権限の依頼のカード。「許可する」は作成者が LIFF で開いて承認する uri のリンク
  // （Bot なしの作りでは postback を使えないため）。requester.userId は本物の LINE の ID ではなく、この予定だけの記号
  function editRequest(liffId, eventId, eventTitle, requester, creator) {
    const approveUrl = eventPageUrl(liffId, eventId, '&approveEditor=1'
      + `&requesterId=${encodeURIComponent(requester.userId)}`
      + `&requesterName=${encodeURIComponent(requester.displayName || '')}`
      + `&requesterPic=${encodeURIComponent(requester.pictureUrl || '')}`);
    return {
      altText: `${eventTitle} の編集権限を依頼します`,
      contents: bubble('🔑 編集権限の依頼', [
        note(eventTitle),
        infoRow('依頼者', requester.displayName || '(名前未取得)', 2, 'md'),
        infoRow('依頼先', creator.displayName || '(名前未取得)', 2, 'sm'),
      ], '許可する', approveUrl),
    };
  }

  // 編集を許可したお知らせのカード。依頼した人が「予定を開く」からすぐ編集できるように
  function approved(liffId, eventId, eventTitle, requesterName) {
    const url = eventPageUrl(liffId, eventId);
    return {
      type: 'flex',
      altText: `✅ ${eventTitle} の編集を許可しました`,
      contents: bubble('✅ 編集を許可しました', [
        note(eventTitle),
        infoRow('編集できる人', requesterName || '依頼した人', 3, 'md'),
      ], '予定を開く', url),
    };
  }

  return { appIntro, editRequest, approved };
})();
