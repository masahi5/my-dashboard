# My Dashboard

個人的に欲しい情報を集約したダッシュボード。

**運用費ゼロ**。常時起動サーバーを持たず、GitHub Actions が15分ごとにフィードを取得し、
静的書き出しした Next.js を GitHub Pages から配信する。APIキーが必要な情報源は使わない。

**公開先: https://masahi5.github.io/my-dashboard/**

```
GitHub Actions (cron 15分ごと)
  ├─▶ npm run fetch ──▶ data/*.json を commit
  └─▶ npm run build ──▶ out/ ──▶ GitHub Pages
```

## 情報源（12ソース・すべてAPIキー不要）

| カテゴリ | ソース |
|---|---|
| AI | Hugging Face Daily Papers / Zenn AIトピック / Google ニュース（生成AI・LLM） |
| コールセンター・情シス | Google ニュース（コールセンター・CTI） / ITmedia エンタープライズ / はてブ テクノロジー |
| ゲーム | 4Gamer / Google ニュース（ゲーム） / はてブ アニメとゲーム |
| 話題 | Google トレンド日本 / はてブ 総合 / Hacker News |

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
