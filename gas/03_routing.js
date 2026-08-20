/**
 * action 文字列 → ハンドラのディスパッチのみを行う。
 * 各アクションの実装は 07_lookups.js / 08_eventActions.js / 09_responseActions.js / 06_message.js を参照。
 */
function routeAction_(action, payload) {
  switch (action) {
    case 'createEvent': return createEvent_(payload);
    case 'getEvent': return getEvent_(payload);
    case 'addOptions': return addOptions_(payload);
    case 'updateOption': return updateOption_(payload);
    case 'claimEditor': return claimEditor_(payload);
    case 'deleteEvent': return deleteEvent_(payload);
    case 'submitAnswer': return submitAnswer_(payload);
    case 'addComment': return addComment_(payload);
    case 'deleteComment': return deleteComment_(payload);
    case 'getSummary': return getSummary_(payload);
    case 'listMyEvents': return listMyEvents_(payload);
    case 'listMyOptions': return listMyOptions_(payload);
    case 'buildShareFlex': return buildShareFlex_(payload);
    case 'buildReminderFlex': return buildReminderFlex_(payload.eventId, payload.answerLabel, payload.names, payload.optionTitle, payload.optionStartAt, payload.optionEndAt, payload.optionLocation);
    case 'buildEditorInviteFlex': return buildEditorInviteFlex_(payload.eventId);
    case 'buildChangeNotificationFlex': return buildChangeNotificationFlex_(payload.eventId, payload.optionTitle, payload.optionStartAt, payload.optionEndAt, payload.optionLocation, payload.names);
    default:
      throw new Error('未対応のactionです: ' + action);
  }
}
