# ZeroTouch Web

閲覧専用の ZeroTouch Web ダッシュボードです。

Android 側で収集された Topic / Card を、Web でほぼリアルタイムに見せるための MVP として作っています。

## できること

- ZeroTouch のホーム相当 UI を Web で閲覧
- `topics` と `utterances` を 2.5 秒ごとに polling
- 検索
- `すべて / 今日 / ライブ / 完了` フィルター
- Next.js の route handler 経由で既存 ZeroTouch API を参照

## 技術スタック

- Next.js 16
- React 19
- Tailwind CSS 4
- SWR

## セットアップ

`.env.example` を元に `.env.local` を作成します。

```bash
cp .env.example .env.local
```

デフォルトでは既存の ZeroTouch API を参照します。

```env
ZEROTOUCH_API_BASE_URL=https://api.hey-watch.me/zerotouch
```

ローカル起動:

```bash
npm install
npm run dev
```

`http://localhost:3000` を開くと、`/api/topics` が upstream の ZeroTouch API をプロキシして表示します。

## 主要ファイル

- `src/app/page.tsx`
  - ダッシュボードのエントリ
- `src/components/zerotouch-dashboard.tsx`
  - 閲覧専用ホーム画面
- `src/app/api/topics/route.ts`
  - ZeroTouch backend の `GET /api/topics` プロキシ
- `src/lib/cn.ts`
  - `clsx` + `tailwind-merge`

## Vercel デプロイ

このリポジトリを Vercel に接続し、環境変数 `ZEROTOUCH_API_BASE_URL` を設定すればそのままデプロイできます。

最低限必要なのは次の 1 つです。

```env
ZEROTOUCH_API_BASE_URL=https://api.hey-watch.me/zerotouch
```

## 現状の制約

- 認証は未実装
- push ではなく polling
- 読み取り専用
- `topics` API が public に参照できる前提

## 確認コマンド

```bash
npm run lint
npm run build
```
