# line-schedule-coordinator

LINE LIFF + Google Apps Script (GAS) + Spreadsheet で作る、Botなし日程調整MVP。

幹事がLIFFで予定を作成 → Flex Messageを生成してLINEへ共有 → 参加者がLIFFで○/△/×回答 → 幹事が回答集計を確認、という一連の流れを実現する。

## 構成

```
GitHub Pages (このリポジトリのルート: index.html + js/)
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
