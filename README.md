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

公開する前に `python3 ../q-oqrn/tools/qstamp.py index.html` で、読みこむ JS・CSS の版（`?v=`）をつけ直す。

### ファイルの並べ方（おくるんの `docs/structure.md` にそろえる）

- `index.html`：画面。`app.js`：画面の入口（どの画面を出すか決める）。`style.css`：見た目
- `js/`：役わりごとの部品。`markup.js`（画面に出す文字と小さな部品）・`dates.js`（日付と時刻・カレンダー）・`notice.js`（知らせ・確かめ・待つボタン）の3つで `AppUtil` を作る。ほかは `api.js`・`share.js`・`views/` など（CLAUDE.md にくわしく）
- `gas/`：GAS（番号＋役わり）。`00_admin.js` は人がエディタで実行するもの（`checkSetup`＝使う前の確かめ）と、どの順に何をするか。`01_entry.js` は入口（`doPost`）。`season.js`・`selfcheck.js` は Q キットの写し（中身は元と同じ）
- コメント：どのファイルも先頭に「何のためか・中に何があるか・どこから呼ばれるか」、どの関数も前に「何をするか」

#### 前の名前のファイル（2026-11-25 ごろ消す）

LINE の中のブラウザが古い `index.html` を覚えていることがあるので、前の名前のファイルを、新しいファイルを読むだけの中身で残している。

- `js/util.js` → `js/markup.js`・`js/dates.js`・`js/notice.js`
- `js/app.js` → `app.js`
- `css/style.css` → `style.css`

幹事がLIFFで予定を作成 → Flex Messageを生成してLINEへ共有 → 参加者がLIFFで○/△/×回答 → 幹事が回答集計を確認、という一連の流れを実現する。

## 構成

```
GitHub Pages (このリポジトリのルート: index.html + app.js + style.css + js/)
        ↓ fetch POST (text/plain, action-based)
GAS Web App (gas/ 配下、clasp管理)
        ↓
Spreadsheet (USERS / EVENTS / EVENT_OPTIONS / RESPONSES)
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
3. `デプロイ` → `新しいデプロイ` → 種類「ウェブアプリ」、アクセスできるユーザー「全員」で公開し、発行された `.../exec` URLを控える

### 2. LINE Developers

1. LINE Developers Console で Messaging API チャネル（or LINEログイン）配下にLIFFアプリを追加
2. エンドポイントURLは、このリポジトリをGitHub Pages公開したURL
3. 発行されたLIFF IDを控える
4. LIFFアプリの設定画面で **Scopes に `Share target picker` を必ず有効化する**（デフォルトはOFF）。これが無効のままだと `liff.isApiAvailable('shareTargetPicker')` が `false` を返し、共有ボタンから「この環境では共有できません」というアラートになりFlex Messageが一切送れない。

### 3. フロントエンド設定

`config.example.json` を参考に `config.json` を作成（`.gitignore` 済みなのでリポジトリには含まれない）:

```json
{
  "liffId": "xxxxxxxxxx-xxxxxxxx",
  "gasUrl": "https://script.google.com/macros/s/xxxxx/exec"
}
```

GAS側の `LIFF_URL` スクリプトプロパティにも `https://liff.line.me/<liffId>` を設定しておく（Flex Messageの「回答する」ボタンのリンク先として使われる）。

### 4. GitHub Pages公開

このリポジトリのルート（index.html）をGitHub Pagesで公開する。

## ローカルでのUI動作確認（LIFFなし）

`config.json` の `liffId` が `YOUR_LIFF_ID` のまま、または `localhost` で開いた場合はデバッグユーザーにフォールバックし、LINEログインなしでUIの動作確認ができる（バックエンドAPI呼び出しには実際の `gasUrl` 設定が必要）。

```bash
python3 -m http.server 8000
# http://localhost:8000 を開く
```

## MVPスコープ

- LIFFログイン / 予定作成（複数候補日時）/ Flex共有 / ○△×回答 / 回答変更 / 作成者による集計閲覧 / 自分の予定一覧
- スコープ外（次フェーズ）: LINE groupId管理、Bot連携、Messaging APIによる自動リマインド、未回答者への催促、Workspace機能
