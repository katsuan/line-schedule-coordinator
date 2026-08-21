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
- `js/flexPreview.js` (`FlexPreview`): Flex MessageツリーのDOM非依存な変換ロジック（対象の絞り込み・名前を隠す・コメント埋め込み・送信プレビュー用テキスト生成）。
- `js/views/previewModal.js` (`PreviewModal`): 送信内容プレビューのモーダルUI本体（DOM操作を伴う部分）。`AppShare.sendFlexMessage` から呼ばれる。
- `js/views/*.js`: 画面単位（`ListView`/`CreateView`/`DetailView`/`CalendarView`）。
- `js/views/optionCard.js` (`OptionCard`): 画面をまたいで再利用される「イベントカード」コンポーネント（表示・編集フォーム・インライン回答・カラーリング）。
- `js/views/optionComments.js` (`OptionComments`): イベントカードのコメント（追加・一覧表示・削除）まわり。`OptionCard`/`DetailView`から呼ばれる。
- `js/views/detailHeader.js` (`DetailHeader`): 詳細画面のページヘッダー（タイトル・チップ・予定編集フォーム・編集権限の依頼/承認導線）。

### 分割の原則（画面系・GAS系共通）

**UIに限らず、処理のまとまりも扱いやすい単位に分割しておくこと。** 1ファイル・1関数が複数の役割を兼ねてきたら、責務ごとに独立させる。フロントは「コンポーネント」単位（下記）、GASは「ドメイン」単位（検索/権限、CRUD、集計、通知、など）で分ける。分割の目安は「同じパターンが2〜3箇所に出てきたら共通化」「1ファイルが150〜200行を超えて役割が混ざってきたら分割」。

### 画面系コードのルール

**UIの要素は、画面（view）に直書きせず、扱いやすいコンポーネント単位に切り出すこと。** 同じ見た目・同じ振る舞いが2箇所以上で必要になったら、view専用ファイルに置いたままにせず `js/views/<component>.js` として切り出し、`return {...}` で必要な関数だけ公開する（`OptionCard` が実例）。全画面共通の1回きりの処理はview側に残してよいが、「カード」「フォーム」「モーダル」など再利用されうる単位は独立させる。

- HTML生成関数（`xxxHtml`）とイベント配線関数（`wireXxx`）はセットで同じコンポーネントファイルに置く。
- コンポーネントは呼び出し側の内部実装（`render`関数など）に直接依存しない。再描画が必要な処理は `refresh` コールバックを引数で受け取る（`OptionCard.wireEditForms(root, ctx, refresh)` を参照）。
- バリデーションや確認ダイアログ付き非同期ボタンなど、3箇所以上で同じパターンが出てきたら `AppUtil` に共通化する（`validateEventFields`/`wireAsyncButton` が実例）。

### UIレイアウトの原則（縦スクロール対策）

**スマホ利用が前提のため、情報を素直に縦積みすると画面がすぐ縦長になりスクロール負担が増える。要素を追加するときは、まず横並び・グルーピング・折りたたみなど「縦に伸ばさない」配置を検討すること。**

- 関連する情報（ラベル+値、アイコン+数値など）は横並びの1行にまとめる。項目ごとに改行して積み上げない。
- 常時表示する必要のない詳細（回答者の内訳など）は `<details>` アコーディオンに格納し、要約（件数など）だけを常時表示にする。
- 同種の情報が並ぶ場合はカード内で改行を増やすのではなく、バッジ／チップ／カウンタのようなコンパクトな見せ方を優先する。
- 新しいUI要素を追加するときは、既存の高さに対してどれだけ縦方向に伸びるかを意識し、可能なら既存の行に相乗りできないか先に検討する。

## バックエンド（GAS）

GASはファイル名に関係なく全ファイルが1つのグローバルスコープにまとまるため、ファイル分割は純粋に整理目的（実行順序に依存するロジックを書かないこと）。

- `gas/03_routing.js`: `routeAction_` のディスパッチのみ。ロジックは書かない。
- `gas/07_lookups.js`: 検索・権限判定の共有ヘルパー（`findEventById_`/`isEditorOrCreator_`など）。
- `gas/08_eventActions.js`: 予定・イベント本体のCRUD（`createEvent_`/`updateOption_`/`deleteEvent_`など）。
- `gas/09_responseActions.js`: 回答・コメントの登録/削除（`submitAnswer_`/`addComment_`/`deleteComment_`）。
- `gas/10_summary.js`: 集計・一覧クエリ（`getSummary_`/`listMyEvents_`/`listMyOptions_`）。
- `gas/06_message.js` / `05_flexParts.js`: Flex Message組み立て。
- 新しいドメイン（例: 通知まわり、集計まわり）が増えたら、既存ファイルに詰め込まず `10_xxx.js` のように新ファイルへ切り出す。1ファイルが150〜200行を超えて役割が混ざってきたら分割を検討する。

- `gas/04_sheetStore.js` の `SCHEMA` がスプレッドシートの列定義。**スキーマ変更は必ず既存配列の末尾に追記する**（途中への挿入や削除は既存データの列がズレるため禁止）。`ensureSheetSchema_` は末尾に足りない列だけを安全に追記する設計になっている。
- 新しいactionを追加したら `gas/03_routing.js` の `routeAction_` switch と `js/api.js` の `AppApi` 側エクスポートの**両方**を必ず更新すること（`AppApi`側だけ漏れて実装済みのactionが呼べない、という事故が過去に発生している）。
- GASは無認証（誰でもeventIdを知っていれば操作可能）という前提の設計。新しいactionが外部URLや秘匿情報をクライアントから受け取らないよう注意する。

## デプロイ

- `cd gas && clasp push -f` でGASへ反映。`.clasp.json` はgitignore対象。
- フロントは `git push` するとGitHub Pagesへ自動反映。LINEアプリ内ブラウザ・GitHub Pages双方がJSを強くキャッシュするため、`index.html` の `<script src="js/....js?v=...">` のバージョン文字列（UTCタイムスタンプ、`date -u +%Y%m%d%H%M`）は **`js/`配下を変更するたびに `sed -i '' -E 's/\?v=[0-9]+/?v=<新しいタイムスタンプ>/g' index.html` で更新する**こと。忘れると「直したのに実機で反映されない」問題が再発する。
- 動作確認は `python3 -m http.server <port>` + Browserツールで行う。ローカルではLIFF未初期化のままデバッグユーザーにフォールバックするが、`config.json` の `gasUrl` が設定されていれば実際のGASバックエンドと通信する。**テストで作成したイベントは `AppApi.deleteEvent` で必ず削除してから終える。**
- `test/scenario.js`: パラメータ化された手動シナリオテスト（作成→回答を自動でクリックして流す）。DevToolsコンソールに貼り付けて実行する専用スクリプトで、`index.html` からは読み込まれない。予定作成でページ遷移が入るため `runCreatePhase` → （遷移後に再度貼り付けて）`runAnswerPhase` の2フェーズに分かれている。クリックした要素をハイライト表示する機能付き。
