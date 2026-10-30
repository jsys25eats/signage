# signage

ローカル動画と Web リンクを順番に切り替えて表示するサイネージ用スイッチャー。
Cloudflare Workers（静的アセットのみ・無料枠）で動作します。

- `/` … 設定画面
- `/display` … 表示画面（全画面表示対応）

## 機能

- 動画（ローカルファイル）を複数登録。再生が終わると次へ進む
- リンク（URL）を複数登録。アイテムごとに設定した秒数で次へ進む（既定秒数も設定可能）
- ドラッグ＆ドロップ / 矢印ボタンで並べ替え。最後まで行くと先頭に戻ってループ
- 設定画面の変更は開いている表示画面に即時反映
- 設定画面から「前へ / 次へ / ここから再生」を操作可能
- 表示画面: `F` キー・ダブルクリック・ボタンで全画面、`←` `→` で前後移動。マウスを動かすと操作ボタンを表示
- 表示中は画面スリープを抑止（Wake Lock 対応ブラウザ）

## データの保存先

設定と動画ファイルは **ブラウザの IndexedDB** に保存され、サーバーへは送信されません。
そのため設定画面と表示画面は **同じ PC・同じブラウザ（同じプロファイル）** で開いてください
（例: PC に繋いだディスプレイに表示画面、手元のウィンドウに設定画面）。

## 注意点

- 埋め込み表示（iframe）を禁止しているサイト（`X-Frame-Options` / CSP `frame-ancestors`）は表示できません。
- ブラウザの自動再生ポリシーにより、音声ありの動画は表示画面を一度クリックするまで無音で再生されることがあります。
- 再生できる動画形式はブラウザ依存です（MP4(H.264) / WebM が無難）。

## 開発

```sh
npm install
npm run dev        # Vite 開発サーバー
npm run build      # dist/ を生成
npx wrangler dev   # Workers ランタイムでローカル確認
```

## デプロイ（Cloudflare 無料枠）

### 手元から

```sh
npx wrangler login
npm run deploy
```

`https://signage.<あなたのサブドメイン>.workers.dev` で公開されます。

### GitHub Actions から（main への push で自動デプロイ）

リポジトリの Settings → Secrets and variables → Actions に以下を登録します。

| Secret | 内容 |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare ダッシュボードの「API トークン」で「Cloudflare Workers を編集する」テンプレートから作成 |
| `CLOUDFLARE_ACCOUNT_ID` | ダッシュボードの Workers & Pages 画面右側に表示されるアカウント ID |
