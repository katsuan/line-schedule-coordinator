# line-schedule-coordinator

LINE LIFF + Google Apps Script (GAS) + Spreadsheet で作る、Botなし日程調整アプリ。詳細な使い方は [README.md](README.md) を参照。

## 用語

- **予定**: 大枠のグループ（例: 「8月」）。作成時のタイトル・説明・回答期限を持つ。GAS/DB上は `EVENTS` テーブル、`eventId`。
- **イベント**: 予定の中の個々の候補（タイトル・開始〜終了・場所を持つ）。ユーザーはイベントごとに○（参加）／△（未定）／×（不参加）で回答する。GAS/DB上は `EVENT_OPTIONS` テーブル、`optionId`。
- コード上の識別子（`eventId`/`optionId`/関数名など）は変更しない。UI文言・コメントでのみこの呼称を使う。

## フロントエンド構成

バンドラなし・素の `<script>` タグ読み込み（`index.html` 参照）。各ファイルは `const Xxx = (() => { ... return {...}; })();` の即時実行IIFEパターンでグローバルに公開する。

- `js/util.js` (`AppUtil`): 日付フォーマット、バリデーション、`wireAsyncButton` などの汎用ヘルパー。
- `js/config.js` (`AppConfig`) / `js/platform.js` (`AppPlatform`) / `js/api.js` (`AppApi`) / `js/router.js` (`AppRouter`) / `js/share.js` (`AppShare`): インフラ層。
- `js/views/*.js`: 画面単位（`ListView`/`CreateView`/`DetailView`/`CalendarView`）。
- `js/views/optionCard.js` (`OptionCard`): 画面をまたいで再利用される「イベントカード」コンポーネント（表示・編集フォーム・インライン回答・カラーリング）。

### 画面系コードのルール

**UIの要素は、画面（view）に直書きせず、扱いやすいコンポーネント単位に切り出すこと。** 同じ見た目・同じ振る舞いが2箇所以上で必要になったら、view専用ファイルに置いたままにせず `js/views/<component>.js` として切り出し、`return {...}` で必要な関数だけ公開する（`OptionCard` が実例）。全画面共通の1回きりの処理はview側に残してよいが、「カード」「フォーム」「モーダル」など再利用されうる単位は独立させる。

- HTML生成関数（`xxxHtml`）とイベント配線関数（`wireXxx`）はセットで同じコンポーネントファイルに置く。
- コンポーネントは呼び出し側の内部実装（`render`関数など）に直接依存しない。再描画が必要な処理は `refresh` コールバックを引数で受け取る（`OptionCard.wireEditForms(root, ctx, refresh)` を参照）。
- バリデーションや確認ダイアログ付き非同期ボタンなど、3箇所以上で同じパターンが出てきたら `AppUtil` に共通化する（`validateEventFields`/`wireAsyncButton` が実例）。

## バックエンド（GAS）

- `gas/04_sheetStore.js` の `SCHEMA` がスプレッドシートの列定義。**スキーマ変更は必ず既存配列の末尾に追記する**（途中への挿入や削除は既存データの列がズレるため禁止）。`ensureSheetSchema_` は末尾に足りない列だけを安全に追記する設計になっている。
- 新しいactionを追加したら `gas/03_routing.js` の `routeAction_` swtich と `js/api.js` の `AppApi` 側エクスポートの**両方**を必ず更新すること（`AppApi`側だけ漏れて実装済みのactionが呼べない、という事故が過去に発生している）。
- GASは無認証（誰でもeventIdを知っていれば操作可能）という前提の設計。新しいactionが外部URLや秘匿情報をクライアントから受け取らないよう注意する。

## デプロイ

- `cd gas && clasp push -f` でGASへ反映。`.clasp.json` はgitignore対象。
- フロントは `git push` するとGitHub Pagesへ自動反映。
- 動作確認は `python3 -m http.server <port>` + Browserツールで行う。ローカルではLIFF未初期化のままデバッグユーザーにフォールバックするが、`config.json` の `gasUrl` が設定されていれば実際のGASバックエンドと通信する。**テストで作成したイベントは `AppApi.deleteEvent` で必ず削除してから終える。**
