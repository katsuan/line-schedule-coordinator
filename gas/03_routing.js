// action に合う処理を呼んで、その返り値を返す。知らない action はエラー
function routeAction_(action, payload) {
  switch (action) {
    case 'createEvent': return createEvent_(payload);
    case 'addOptions': return addOptions_(payload);
    case 'updateOption': return updateOption_(payload);
    case 'updateEvent': return updateEvent_(payload);
    case 'claimEditor': return claimEditor_(payload);
    case 'approveEditRequest': return approveEditRequest_(payload);
    case 'deleteEvent': return deleteEvent_(payload);
    case 'submitAnswer': return submitAnswer_(payload);
    case 'addComment': return addComment_(payload);
    case 'deleteComment': return deleteComment_(payload);
    case 'getSummary': return getSummary_(payload);
    case 'listMyEvents': return listMyEvents_(payload);
    case 'listMyOptions': return listMyOptions_(payload);
    case 'buildShareFlex': return buildShareFlex_(payload);
    case 'buildReminderFlex': return buildReminderFlex_(payload.eventId, payload.groups, payload.optionTitle, payload.optionStartAt, payload.optionEndAt, payload.optionLocation, payload.optionId);
    case 'buildEditorInviteFlex': return buildEditorInviteFlex_(payload.eventId, payload.userId);
    case 'buildChangeNotificationFlex': return buildChangeNotificationFlex_(payload.eventId, payload.optionTitle, payload.optionStartAt, payload.optionEndAt, payload.optionLocation, payload.names);
    default:
      throw new Error('未対応のactionです: ' + action);
  }
}
