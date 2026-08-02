# My Dashboard

AI・コールセンター/情シス・ゲーム・世間の話題を1画面に集約する個人ダッシュボード。

**運用費ゼロ**。常時起動サーバーを持たず、GitHub Actions が定期的にフィードを取得し、
静的書き出しした Next.js を GitHub Pages から配信する。APIキーが必要な情報源は使わない。

```
GitHub Actions (cron 毎時)
  ├─▶ npm run fetch ──▶ data/*.json を commit
  └─▶ npm run build ──▶ out/ ──▶ GitHub Pages
```

## 技術スタック

Next.js 16 (App Router, `output: "export"`) / React 19 / TypeScript /
Tailwind CSS v4 / shadcn/ui / lucide-react / zod / fast-xml-parser

## セットアップ

```bash
npm install
npm run fetch    # data/*.json を生成
npm run dev      # http://localhost:3000
```

## 情報源を追加する

1. `lib/sources/` に `Source` を返す関数を書く
2. `lib/sources/index.ts` の `sources` 配列へ追加
3. `npm run fetch` → `data/<key>.json` が生成される
4. `app/page.tsx` に `readFeed("<key>")` と `<FeedCard>` を足す

`lib/sources/rss.ts` が RSS 1.0 (RDF) / RSS 2.0 / Atom を吸収するので、
たいていのフィードは変換関数を1つ書くだけで追加できる。

詳細な設計メモと落とし穴は [CLAUDE.md](./CLAUDE.md) を参照。
