@AGENTS.md

# My Dashboard

個人的に欲しい情報を集約したダッシュボード。タブは5枚
（AI / コールセンタ・システム / ゲーム / その他 / ツイート）で、フィード12ソース + X 12アカウント。
公開先: https://masahi5.github.io/my-dashboard/

**運用費ゼロ**が設計上の最重要制約：常時起動サーバーを持たず、GitHub Actions でデータを取得し、
静的書き出しした Next.js を GitHub Pages から配信する。APIキーが必要な情報源は採用しない。

スマホでの利用が主。PWA として「ホーム画面に追加」でき、タブは横スワイプでも切り替わる。

## Architecture / Data flow

```
GitHub Actions (cron 15分ごと)
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
  実体参照の復号もここ（数値文字参照・二重エスケープ対応。はてブのタイトルが該当）
- `lib/sources/generic-rss.ts` — 素直な RSS/Atom 用の汎用ソース（Zenn / ITmedia / 4Gamer）
- `lib/sources/google-news.ts` — 検索クエリをRSS化するソース生成関数。専門領域はこれで賄う
- `lib/sources/hatena.ts` — はてブ人気エントリ。`hatena:bookmarkcount` を score に。ブクマ数降順
- `lib/sources/hacker-news.ts` — Algolia API（公式Firebase版はN+1になるので不採用）
- `lib/sources/hugging-face.ts` — Daily Papers。レスポンス形状が2通りあるため両対応
- `lib/sources/google-trends.ts` — 急上昇ワード。**全項目のlinkが同一なのでIDは検索語から生成する**
- `lib/sources/index.ts` — 収集対象の一覧。**ここに1件足すとウィジェットが1つ増える**
- `scripts/fetch-feeds.ts` — パイプライン本体。取得 → zod検証 → `data/<key>.json` 書き出し

### 表示（`app/` + `components/`）
- `lib/feeds.ts` — `readAllFeeds()` / `groupByCategory()`。**Server Component 専用**（fs を使う）。
  ページはキーを列挙せずこれを使うので、ソース追加だけでウィジェットが増える
- `lib/format.ts` — 日時整形。**必ず `timeZone: "Asia/Tokyo"` を指定する**（後述）
- `app/page.tsx` — タブの中身を組み立てるだけ。並べ方はタブごとに違うのでここが持つ
- `components/dashboard-tabs.tsx` — タブ本体（Client）。タブ切り替え / ハッシュ連動 /
  ジャンプボタン / 横スワイプ / 「上へ戻る」。**カテゴリの追加はここではなく `schemas.ts`**
- `components/widgets/feed-card.tsx` — フィード1本のウィジェット。空/stale の状態も明示する
- `components/widgets/x-timeline-card.tsx` — X 1アカウント分（Client、後述）
- `components/relative-time.tsx` — 相対時刻。Client Component（後述）
- `components/ui/` — shadcn/ui。`npx shadcn@latest add <name>` で追加

### X（ツイートタブ）
- `lib/x-accounts.ts` — 表示するアカウントの一覧。グループ = タブ内の小見出し = ジャンプ先
- `lib/x-widgets.ts` — 公式ウィジェット（platform.twitter.com/widgets.js）の読み込みと生成
- X は API/RSS を閉じたため、**無料で使える手段が公式ウィジェットしかない**。
  ここだけはビルド時ではなく**ブラウザ側**で中身を取りに行く（`data/*.json` には入らない）

### PWA
- `app/manifest.ts` — Web App Manifest。**中身の URL には basePath が自動で付かない**ので自分で前置する
- `app/layout.tsx` — `viewport.themeColor` / apple 用 meta / safe-area
- `public/sw.js` — Service Worker。HTML はネットワーク優先、`_next/static` だけキャッシュ優先
- `scripts/generate-icons.ts` — アイコン PNG 生成（`npm run icons`）。生成物は commit 済み

### 自動化
- `.github/workflows/update-and-deploy.yml` — cron で取得 → `data/` を commit → ビルド → Pages へデプロイ

## Commands

```bash
npm run fetch    # data/*.json を生成（ソース追加後は必ず実行）
npm run icons    # PWA アイコンを再生成（デザインを変えたときだけ）
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
- **manifest / Service Worker / apple-touch-icon のパスは basePath を自分で付ける。**
  Next が自動で付けてくれるのは `<link rel="manifest">` の href まで。中身は素通し。
- **`app/manifest.ts` には `export const dynamic = "force-static"` が要る**（無いと export でビルドが落ちる）。
- **X の埋め込みは一斉に作らない。** 12個を同時に生成すると syndication.twitter.com が 429 を返し、
  全部が無言で空になる。`lib/x-widgets.ts` で1件ずつ直列化し、画面に入ったものだけ生成している。
  `createTimeline` の Promise は iframe 挿入時点で解決してしまうので、**成否は iframe の高さで判定する**。
  失敗時はプロフィールへのリンクに退避する（広告ブロッカーでも同じ経路になる）。
- **X の 429 は「閲覧者のIP」に対する 15分あたり 30リクエストの枠。** 恒久ブロックではない。
  ウィジェットは各自のブラウザから syndication.twitter.com を叩くので、その枠を使い切ると
  `Rate limit exceeded` の1行だけが返り、タイムラインは全滅する。実測（2026-08）:
  `x-rate-limit-limit: 30` / `x-rate-limit-reset` は約15分後 / 1リクエスト = 1消費。
  **枠はIP単位なので CGNAT 等で他人と共有していると自分が何もしなくても減る**
  （実測で無操作の 87 秒間に 6 消費）。この回線では枯渇が常態化していて、
  1週間以上ずっと 429 のままだった。1ページ表示で 12 アカウント分＝12消費するので、
  枠の大半を1回の閲覧で使い切る計算になる。別IP（r.jina.ai 経由）からは 200 で本文が取れる。
  **ブラウザ側での取得を続ける限りコード側では直せない**ので、粘らず素早くリンク表示へ倒す:
  レンダー待ち 8 秒・再試行なし・2 件連続で空振りしたら残りは即リンク表示。
  widgets.js が load も error も返さず黙り込む経路があるため、**script の読み込み自体にも
  15 秒の上限を置く**（これが無いと全カードが永久にスケルトンのままになる）。
  恒久的に直すなら、`syndication.twitter.com/srv/timeline-profile/screen-name/<handle>`
  を **Actions 側で**取得する（HTML内 `__NEXT_DATA__` の
  `props.pageProps.timeline.entries[]` に本文・投稿日時・いいね数・パーマリンクが入っている）。
  15分ごとの cron で 12リクエストなら枠 30 に収まり、閲覧者のIPも一切使わない。

## 情報源を追加する手順

1. `lib/sources/` に `Source` を返す関数を書く（RSSなら `rss.ts` のヘルパを使う）
2. `lib/sources/index.ts` の `sources` 配列に追加
3. `npm run fetch` で `data/<key>.json` が生えるのを確認

`app/page.tsx` の編集は不要。`readAllFeeds()` が `data/` を走査してカテゴリ別に並べる。

### 現在のソース（12件・すべてAPIキー不要）
| カテゴリ | key | 取得元 |
|---|---|---|
| ai | `ai-papers` | Hugging Face Daily Papers（JSON, upvotes） |
| ai | `ai-zenn` | Zenn AIトピック（RSS 2.0） |
| ai | `ai-news` | Google ニュース検索（生成AI・LLM） |
| callcenter | `callcenter-news` | Google ニュース検索（コールセンター・CTI） |
| callcenter | `enterprise-it` | ITmedia エンタープライズ（RSS 2.0） |
| callcenter | `it-hatena` | はてブ テクノロジー（RSS 1.0, ブクマ数） |
| game | `game-4gamer` | 4Gamer（RSS 1.0） |
| game | `game-news` | Google ニュース検索（ゲーム） |
| game | `game-hatena` | はてブ アニメとゲーム（RSS 1.0, ブクマ数） |
| trend | `trend-google` | Google トレンド日本（RSS, 検索数） |
| trend | `trend-hatena` | はてブ 総合（RSS 1.0, ブクマ数） |
| trend | `trend-hackernews` | Hacker News / Algolia（JSON, points） |

カテゴリ ↔ タブ名は `lib/schemas.ts` の `CATEGORY_LABELS` で決める
（`callcenter` → 「コールセンタ・システム」、`trend` → 「その他」）。

### X アカウントを追加する手順

`lib/x-accounts.ts` の `X_ACCOUNT_GROUPS` に足すだけ。取得処理もビルドも不要。
グループを増やすと小見出しとジャンプボタンが1つ増える。
