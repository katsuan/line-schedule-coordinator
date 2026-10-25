/**
 * 人がエディタから実行するものと、人が書きかえる設定（くるかなの GAS）。
 *
 * どの順に何を実行するか
 *   1. Script Properties に SPREADSHEET_ID・LIFF_URL を入れる（LIFF_CHANNEL_ID・ALLOW_DEBUG_USERS は必要なときだけ）
 *   2. checkSetup を実行して、実行ログが ✅ だけか見る（何も書きこまない・送らない）
 *   3. ふだんは何も実行しない。画面（LIFF）から 01_entry.js の doPost が呼ばれる
 *
 * 本番の入口は別の GAS で、このプロジェクトをライブラリ（開発モード）として読んでいる。
 * clasp push したらすぐ本番に効く（デプロイはいらない）。
 */

/**
 * 使う前の確かめ（Q 共通の自己点検 selfcheck.js の qCheckAll）。
 * いつ：はじめて使うとき・Script Properties やシートを変えたとき。結果は実行ログに ✅⚠️❌ で出る
 */
function checkSetup() {
  return qCheckAll();
}

/**
 * 自己点検の設定（selfcheck.js が読む）。シートの見出しは 04_sheetStore.js の SCHEMA と同じ
 */
var Q_SELF_CHECK = {
  properties: ['SPREADSHEET_ID', 'LIFF_URL'],
  spreadsheetId: function () { return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'); },
  get sheets() { return SCHEMA; },
};
