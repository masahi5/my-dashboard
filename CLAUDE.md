@AGENTS.md

# My Dashboard

AI・コールセンター/情シス・ゲーム・世間の話題を1画面に集約する個人ダッシュボード。

**運用費ゼロ**が設計上の最重要制約：常時起動サーバーを持たず、GitHub Actions でデータを取得し、
静的書き出しした Next.js を GitHub Pages から配信する。APIキーが必要な情報源は採用しない。

## Architecture / Data flow

```
GitHub Actions (cron 毎時)
  ├─▶ npm run fetch  (scripts/fetch-feeds.ts) ──▶ data/*.json を commit
  └─▶ npm run build  (output: "export")       ──▶ out/ ──▶ GitHub Pages
```

- **外部フィードの取得は必ず Actions（サーバー側）で行う。** ブラウザから直接叩くと CORS で弾かれる。
- ページは `readFeed()` で `data/*.json` を **ビルド時に** 読み、HTML へ焼き込む。実行時 fetch は無い。
- 1ソースが落ちても全体を壊さない：失敗時は前回 items を温存し `stale: true` / `error` を立てて書き戻す。
  パイプラインは常に exit 0（取得失敗でデプロイを止めない）。
- 取得は 15 秒でタイムアウト。UA を明示しないと弾くフィードがあるため必ず付ける。

## Layout

### データ取得（`lib/sources/` + `scripts/`）
- `lib/schemas.ts` — zod スキーマ。`FeedItem`（正規化済み記事）と `FeedFile`（`data/*.json` の中身）
- `lib/sources/types.ts` — `Source` 型。1情報源 = key / label / category / fetch()
- `lib/sources/rss.ts` — **RSS 1.0(RDF) / RSS 2.0 / Atom を1関数で吸収する汎用パーサ**。
  `removeNSPrefix: true` が肝（`dc:date`→`date`、`hatena:bookmarkcount`→`bookmarkcount`）
- `lib/sources/google-news.ts` — 検索クエリをRSS化するソース生成関数。専門領域はこれで賄う
- `lib/sources/index.ts` — 収集対象の一覧。**ここに1件足すとウィジェットが1つ増える**
- `scripts/fetch-feeds.ts` — パイプライン本体。取得 → zod検証 → `data/<key>.json` 書き出し

### 表示（`app/` + `components/`）
- `lib/feeds.ts` — `readFeed(key)`。**Server Component 専用**（fs を使う）。スキーマ不正なら null
- `lib/format.ts` — 日時整形。**必ず `timeZone: "Asia/Tokyo"` を指定する**（後述）
- `components/widgets/feed-card.tsx` — フィード1本のウィジェット。空/stale の状態も明示する
- `components/relative-time.tsx` — 相対時刻。Client Component（後述）
- `components/ui/` — shadcn/ui。`npx shadcn@latest add <name>` で追加

### 自動化
- `.github/workflows/update-and-deploy.yml` — cron で取得 → `data/` を commit → ビルド → Pages へデプロイ

## Commands

```bash
npm run fetch    # data/*.json を生成（ソース追加後は必ず実行）
npm run dev      # http://localhost:3000
npm run build    # out/ へ静的書き出し
npm run lint
```

## Notes / 落とし穴

- **静的サイトに相対時刻を焼き込まない。** ビルド時に「3時間前」をHTMLへ入れると翌日には嘘になる。
  `RelativeTime` は初回描画を絶対時刻にし、マウント後に相対表記へ差し替える。
- **日時は必ずタイムゾーン明示。** Actions は UTC で動くため、指定しないとビルド時HTMLとブラウザ表示が
  ズレてハイドレーション不整合になる。`lib/format.ts` 以外で `toLocaleString` を直接使わない。
- **`output: "export"` の制約。** ISR / Route Handler / next/image の最適化は使えない。
  データ更新は「Actions で再取得 → 再ビルド → 再デプロイ」で行う。
- **`basePath`** は `NEXT_PUBLIC_BASE_PATH` 環境変数で切り替える。リポジトリ名を変えたら
  workflow の値も変える。ローカル dev は `/` のまま。
- `public/.nojekyll` は消さない（`_next/` を GitHub Pages が無視しないようにするため）。
- Vercel ではなく **GitHub Pages** を使う。Actions は public リポジトリなら実行時間無料。

## 情報源を追加する手順

1. `lib/sources/` に `Source` を返す関数を書く（RSSなら `rss.ts` のヘルパを使う）
2. `lib/sources/index.ts` の `sources` 配列に追加
3. `npm run fetch` で `data/<key>.json` が生えるのを確認
4. `app/page.tsx` に `readFeed("<key>")` と `<FeedCard>` を足す

### 追加予定のソース（調査済み・全てキー不要で動作確認済み）
| カテゴリ | ソース | エンドポイント |
|---|---|---|
| AI | Hugging Face Daily Papers | `huggingface.co/api/daily_papers?limit=20`（JSON, upvotes付き） |
| AI | Zenn AIトピック | `zenn.dev/topics/ai/feed`（RSS 2.0） |
| 情シス | ITmedia エンタープライズ | `rss.itmedia.co.jp/rss/2.0/enterprise.xml`（RSS 2.0） |
| ゲーム | 4Gamer | `www.4gamer.net/rss/index.xml`（RSS 1.0） |
| ゲーム | はてブ アニメとゲーム | `b.hatena.ne.jp/hotentry/game.rss`（RSS 1.0, ブクマ数付き） |
| 話題 | Google トレンド日本 | `trends.google.co.jp/trending/rss?geo=JP`（RSS, 検索数付き） |
| 話題 | Hacker News | `hn.algolia.com/api/v1/search?tags=front_page`（JSON, points付き） |
