# くるかな 〜QuruKana〜

来れる日を、○△×でそろえよう。LINE LIFF + Google Apps Script (GAS) + Spreadsheet で作る、Botなし日程調整。

公開URL: https://katsuan.github.io/line-schedule-coordinator/ （LINE では https://liff.line.me/2009927582-qytzPvoy ）

おくるん（OQRN）と同じ Q のツールのなかま（「く」を Q にした名前。GitHub のリポジトリ名は line-schedule-coordinator のまま、ローカルのフォルダは `~/GitHub/q-qurukana`）。
おくるんの「ほかのツール」に並び、画面の下の「📤 くるかなを紹介する」から紹介カードを送れる。

## アイコン・ロゴ・OGP

`python3 tools/icon.py` で書き出す（となりのおくるん `~/GitHub/q-oqrn` の `tools/brandkit.py` を使う）。
Q はカレンダー（綴じ具と日付の点、真ん中の1日だけ ○）に、✓ のしっぽ。色は空色（`--ls-accent` #0284C7）。

## 見た目（Q キット）

部品（見出しの行・カード・タブ・入力欄・ボタン・開閉・下から出るシート・下の送る帯・トースト）はおくるんの Q キット（`https://katsuan.github.io/line-share/shared/ui.css`・`ui.js`。使い方はおくるんの README）。`style.css` には、くるかなの色と字（`:root` の `--ls-accent` など）と、くるかなにしかない見た目（○△× のボタン・回答者の顔・コメント・カレンダー・送信内容プレビュー・使い方の画面）だけを置く。

公開は GitHub Actions（`.github/workflows/pages.yml`。中身は Q 共通の line-share の `q-pages.yml`）。push すると、テストと check-code が通ったときだけ Pages に出す。読みこむ JS・CSS の `?v=` は公開のときに付くので、手で付けなくてよい。

### ファイルの並べ方（おくるんの `docs/structure.md` にそろえる）

- `index.html`：画面。`app.js`：画面の入口（どの画面を出すか決める）。`style.css`：見た目
- `js/`：役わりごとの部品。`markup.js`（画面に出す文字と小さな部品）・`dates.js`（日付と時刻・カレンダー）・`notice.js`（知らせ・確かめ・待つボタン）の3つで `AppUtil` を作る。送る流れは `share.js`、画面で作るカード（紹介・編集の依頼・許可のお知らせ）は `cards.js`。画面ごとの部品は `views/`（CLAUDE.md にくわしく）
- `gas/`：GAS（番号＋役わり）。`00_admin.js` は人がエディタで実行するもの（`checkSetup`＝使う前の確かめ）と、どの順に何をするか。`01_entry.js` は入口（`doPost`）。予定とイベントは `08_eventActions.js`、回答とコメントは `09_responseActions.js`、集計は `10_summary.js`、編集者は `13_editorActions.js`。`season.js`・`selfcheck.js` は Q キットの写し（中身は元と同じ）
- `test/`：`node --test test/` で動く（GAS はとなりの q-oqrn の `tools/qtest/fake-gas.js` で、本番のシート・LINE に触らずに動かす）。`scenario.js` だけは、ブラウザの DevTools に貼って画面を自動で押す手動の確かめ
- コメント：どのファイルも先頭に「何のためか・中に何があるか・どこから呼ばれるか」、どの関数も前に「何をするか」

#### 前の名前のファイル（2026-11-25 ごろ消す）

LINE の中のブラウザが古い `index.html` を覚えていることがあるので、前の名前のファイルを、新しいファイルを読むだけの中身で残している。

- `js/util.js` → `js/markup.js`・`js/dates.js`・`js/notice.js`
- `js/app.js` → `app.js`
- `css/style.css` → `style.css`

幹事が LIFF で予定（イベント＝候補の日をいくつか）を作る → カード（Flex Message）を LINE へ送る → 参加者が LIFF でイベントごとに ○／△／× で答える → みんなが答えのようすを見る、という流れ。

## 構成

```
GitHub Pages (このリポジトリのルート: index.html + app.js + style.css + js/)
        ↓ fetch POST (text/plain, action-based)
GAS Web App (gas/ 配下、clasp管理)
        ↓
Spreadsheet (USERS / EVENTS / EVENT_OPTIONS / RESPONSES / COMMENTS)
```

## セットアップ

### 1. GASバックエンド

```bash
cd gas
npm run clasp:login   # 初回のみ
clasp create --type webapp --title "line-schedule-coordinator" --rootDir .
npm run clasp:push
```

Apps Script エディタ（`npm run clasp:open`）で以下を設定:
1. 新規または既存のGoogleスプレッドシートを用意し、そのIDを控える
2. `プロジェクトの設定` → `スクリプト プロパティ` に以下を追加
   - `SPREADSHEET_ID`: 上記スプレッドシートのID
   - `LIFF_URL`: `https://liff.line.me/<LIFF ID>`（後述のLIFF ID発行後に設定）
   - `LIFF_CHANNEL_ID`・`ALLOW_DEBUG_USERS`：必要なときだけ（`gas/00_admin.js` の先頭に説明）
3. `checkSetup` を実行して、実行ログが ✅ だけか見る（何も書きこまない・送らない）
4. `デプロイ` → `新しいデプロイ` → 種類「ウェブアプリ」、アクセスできるユーザー「全員」で公開し、発行された `.../exec` URLを控える

いまの本番は、入口の GAS がこのプロジェクトをライブラリ（開発モード）として読んでいる。`clasp push` すると、すぐ本番に効く（`gas/00_admin.js` の先頭）。

### 2. LINE Developers

1. LINE Developers Console で Messaging API チャネル（or LINEログイン）配下にLIFFアプリを追加
2. エンドポイントURLは、このリポジトリをGitHub Pages公開したURL
3. 発行されたLIFF IDを控える
4. LIFFアプリの設定画面で **Scopes に `Share target picker` を必ず有効化する**（デフォルトはOFF）。これが無効のままだと `liff.isApiAvailable('shareTargetPicker')` が `false` を返し、「カードでおくるん」を押しても送る内容の見本しか出ず（「ここでは見本だけ」）、カードを送れない。

### 3. フロントエンド設定

`config.example.json` を参考に `config.json` を作成（`.gitignore` 済みなのでリポジトリには含まれない）:

```json
{
  "liffId": "xxxxxxxxxx-xxxxxxxx",
  "gasUrl": "https://script.google.com/macros/s/xxxxx/exec"
}
```

GAS側の `LIFF_URL` スクリプトプロパティにも `https://liff.line.me/<liffId>` を設定しておく（カードの「回答する」などのボタンのリンク先として使われる）。

### 4. GitHub Pages公開

このリポジトリのルート（index.html）をGitHub Pagesで公開する。

## ローカルでのUI動作確認（LIFFなし）

`config.json` の `liffId` が `YOUR_LIFF_ID` のまま、または `localhost` で開いた場合は仮のユーザー（`debug-user-…`）になり、LINEログインなしで画面を確かめられる。GAS とやりとりするには、実際の `gasUrl` と、GAS の Script Properties の `ALLOW_DEBUG_USERS` を `1` にすることが必要（仮のユーザーは、それがないと断られる）。試しに作った予定は、確かめたあと消す。

```bash
python3 -m http.server 8000
# http://localhost:8000 を開く
```

## できること

- LINE ログイン（LIFF）・予定を作る（イベントをいくつも）・カードで送る（送る前に見本、○△× の絞りこみ・名前を隠す・ひとこと）
- イベントごとに ○△× で答える（押したときに保存。あとから変えられる）・コメント・答えたようすはだれでも見られる
- 作成者と編集者：イベントを足す・変える（答えた人に知らせるか選べる）・答えた人へ連絡のカード・予定を消す（作成者だけ）
- 編集者：招待のリンク（合言葉つき）から、または「編集を依頼」して作成者が許可
- 自分の予定の一覧（未回答・回答済み・自分が作成）・カレンダー（週のはじまりは Q のツールで共通）
- しないこと：Bot・LINE のグループの管理・自動のリマインド（Bot なしで作るため）
