# ZeroTouch Web

閲覧専用の ZeroTouch Web ダッシュボードです。

Android 側で収集された Topic / Card を、Web でほぼリアルタイムに見せるための MVP として作っています。

公開URL:

`https://app-web-zero-touch.vercel.app/`

## できること

- ZeroTouch のホーム相当 UI を Web で閲覧
- `topics` と `utterances` を 2.5 秒ごとに polling
- 検索
- `すべて / 今日 / ライブ / 完了` フィルター
- Next.js の route handler 経由で既存 ZeroTouch API を参照
- `/stateful` で Amical の `daily rollup / context bundle / active state snapshot / state delta` を読む

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

stateful viewer は、既定では sibling repo の次のローカル生成物を読みます。

`../android-zero-touch/experiments/amical/artifacts/daily-rollups`

必要なら `.env.local` で上書きできます。

```env
ZEROTOUCH_STATEFUL_ARTIFACTS_ROOT=/absolute/path/to/daily-rollups
```

ローカル起動:

```bash
npm install
npm run dev
```

`http://localhost:3000` を開くと、`/api/topics` が upstream の ZeroTouch API をプロキシして表示します。

`http://localhost:3000/stateful` を開くと、stateful artifact viewer が表示されます。

## 主要ファイル

- `src/app/page.tsx`
  - ダッシュボードのエントリ
- `src/components/zerotouch-dashboard.tsx`
  - 閲覧専用ホーム画面
- `src/app/api/topics/route.ts`
  - ZeroTouch backend の `GET /api/topics` プロキシ
- `src/app/stateful/page.tsx`
  - stateful viewer のエントリ
- `src/components/stateful-daily-viewer.tsx`
  - daily / context / snapshot / delta を読む人間用 viewer
- `src/lib/stateful-artifacts.ts`
  - Android 側で生成した artifact の loader
- `src/lib/cn.ts`
  - `clsx` + `tailwind-merge`

## Vercel デプロイ

このリポジトリを Vercel に接続し、環境変数 `ZEROTOUCH_API_BASE_URL` を設定すればそのままデプロイできます。

現在の公開先:

`https://app-web-zero-touch.vercel.app/`

最低限必要なのは次の 1 つです。

```env
ZEROTOUCH_API_BASE_URL=https://api.hey-watch.me/zerotouch
```

## 現状の制約

- 認証は未実装
- push ではなく polling
- 読み取り専用
- `topics` API が public に参照できる前提
- `/stateful` はローカルの file artifact を読む前提で、現時点ではデプロイ用途ではなく価値検証用

## 確認コマンド

```bash
npm run lint
npm run build
```
