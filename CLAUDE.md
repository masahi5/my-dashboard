@AGENTS.md

# My Dashboard

個人的に欲しい情報を集約したダッシュボード。タブは5枚
（AI / コールセンタ・システム / ゲーム / その他 / ツイート）で、フィード12ソース + X 12アカウント。
すべて Actions が取得してビルド時に焼き込む（ブラウザから外部を叩くものは無い）。
公開先: https://masahi5.github.io/my-dashboard/

**運用費ゼロ**が設計上の最重要制約：常時起動サーバーを持たず、GitHub Actions でデータを取得し、
静的書き出しした Next.js を GitHub Pages から配信する。APIキーが必要な情報源は採用しない。

スマホでの利用が主。PWA として「ホーム画面に追加」でき、タブは横スワイプでも切り替わる。

## Architecture / Data flow

```
GitHub Actions (cron 15分ごと)
  ├─▶ npm run fetch  (scripts/fetch-feeds.ts) ──▶ data/*.json    を commit
  │                  (scripts/fetch-x.ts)     ──▶ data/x/*.json  を commit
  └─▶ npm run build  (output: "export")       ──▶ out/ ──▶ GitHub Pages
```

- **外部データの取得は必ず Actions（サーバー側）で行う。** フィードはブラウザから直接叩くと
  CORS で弾かれ、X は「閲覧者のIP」にレート制限がかかる（後述）。
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
- `lib/sources/x-timeline.ts` — X のタイムライン取得。埋め込みウィジェットが読む
  `syndication.twitter.com` の HTML から `__NEXT_DATA__` を抜く（RSS/APIは閉じている）
- `scripts/fetch-feeds.ts` — パイプライン本体。取得 → zod検証 → `data/<key>.json` 書き出し
- `scripts/fetch-x.ts` — X 用の同じ構造のパイプライン。`data/x/<handle>.json` 書き出し

### 表示（`app/` + `components/`）
- `lib/feeds.ts` — `readAllFeeds()` / `groupByCategory()`。**Server Component 専用**（fs を使う）。
  ページはキーを列挙せずこれを使うので、ソース追加だけでウィジェットが増える
- `lib/format.ts` — 日時整形。**必ず `timeZone: "Asia/Tokyo"` を指定する**（後述）
- `app/page.tsx` — タブの中身を組み立てるだけ。並べ方はタブごとに違うのでここが持つ
- `components/dashboard-tabs.tsx` — タブ本体（Client）。タブ切り替え / ハッシュ連動 /
  ジャンプボタン / 横スワイプ / 「上へ戻る」。**カテゴリの追加はここではなく `schemas.ts`**
- `components/widgets/feed-card.tsx` — フィード1本のウィジェット。空/stale の状態も明示する
- `components/widgets/x-timeline-card.tsx` — X 1アカウント分。FeedCard と同じ作り（Server）
- `components/relative-time.tsx` — 相対時刻。Client Component（後述）
- `components/ui/` — shadcn/ui。`npx shadcn@latest add <name>` で追加

### X（ツイートタブ）
- `lib/x-accounts.ts` — 表示するアカウントの一覧。グループ = タブ内の小見出し = ジャンプ先。
  ファイル名は `xTimelineFileName()` を通す（Linux は大文字小文字を区別するため）
- `lib/x-timelines.ts` — `data/x/*.json` を読む。**Server Component 専用**（`lib/feeds.ts` と同役）
- X は API も RSS も閉じているので、**埋め込みウィジェットの取得口**を借りる。
  他のフィードと同じく Actions で取得 → `data/x/<handle>.json` → ビルド時に焼き込み。
  以前はブラウザ側で公式ウィジェットを動かしていたが、レート制限が閲覧者のIPに
  かかるせいで「開いても全部空」が常態化したのでやめた（後述）

### PWA
- `app/manifest.ts` — Web App Manifest。**中身の URL には basePath が自動で付かない**ので自分で前置する
- `app/layout.tsx` — `viewport.themeColor` / apple 用 meta / safe-area
- `public/sw.js` — Service Worker。HTML はネットワーク優先、`_next/static` だけキャッシュ優先
- `scripts/generate-icons.ts` — アイコン PNG 生成（`npm run icons`）。生成物は commit 済み

### 自動化
- `.github/workflows/update-and-deploy.yml` — cron で取得 → `data/` を commit → ビルド → Pages へデプロイ

## Commands

```bash
npm run fetch    # data/*.json と data/x/*.json を生成（ソース追加後は必ず実行）
npm run fetch:x  # ツイートだけ再取得（X の枠は 15分/30リクエスト。無駄打ちしない）
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
- **X は絶対にブラウザ側から取らない。** レート制限（`Rate limit exceeded` / HTTP 429）は
  **リクエスト元のIPに対して 15分あたり 30リクエスト**。埋め込みウィジェットは各自のブラウザから
  syndication.twitter.com を叩くので、1ページ表示で 12アカウント＝12消費し、枠の大半を1回の閲覧で
  使い切る。**枠はIP単位なので CGNAT 等で他人と共有していると何もしなくても減る**
  （実測 2026-08: 無操作の 87 秒間に 6 消費）。この回線では枯渇が常態化し、1週間以上
  ずっと 429 でツイートが1件も出ない状態だった。**これは待っても直らないので取得口を
  Actions へ移した**（2026-09）。15分ごとの cron で 12リクエストなら枠 30 に収まり、
  閲覧者のIPは一切使わない。ウィジェット方式（`platform.twitter.com/widgets.js`）へ
  戻してはいけない。
- **X の中身は HTML に埋まった JSON から取る。**
  `syndication.twitter.com/srv/timeline-profile/screen-name/<handle>` を GET し、
  `__NEXT_DATA__` の `props.pageProps.timeline.entries[]` を読む。1件は
  `content.tweet` で、本文 `full_text` ・日時 `created_at` ・`favorite_count` ・
  `permalink` が入っている。押さえどころ:
  - **UA はブラウザのものを送る**（公開APIではなくウィジェット用の口なので）
  - **リポストは `retweeted_status` を見る。** 外側の本文は `RT @xxx: …` と切り詰められている
  - **本文の t.co は `entities.urls` で表示用URLへ戻す。** 末尾に残る t.co は画像・動画への
    参照なので落とす（`entities.urls` には入っていない）
  - **0件は失敗として扱う。** 非公開・凍結・改名でも 200 + 空配列が返るため、
    そのまま書き出すと前回分を消してしまう
  - 非公式な口なので**いつ壊れてもおかしくない**。壊れても `stale` を立てて前回分を出し続け、
    カードには X へのリンクを必ず残す

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

1. `lib/x-accounts.ts` の `X_ACCOUNT_GROUPS` に足す
2. `npm run fetch:x` で `data/x/<handle>.json` が生えるのを確認

グループを増やすと小見出しとジャンプボタンが1つ増える。
