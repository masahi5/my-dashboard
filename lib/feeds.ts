import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { feedFileSchema, type Category, type FeedFile } from "./schemas";

const DATA_DIR = path.join(process.cwd(), "data");

/**
 * data/<key>.json を読む。**Server Component 専用**。
 *
 * 静的書き出し(output: "export")なので、この関数は `next build` 時に一度だけ実行され、
 * 結果が HTML に焼き込まれる。ブラウザからは fs を触らないので安全。
 *
 * JSON はパイプラインが書いたものだが、外部フィード由来のデータが元なので
 * 読み込み時にも必ずスキーマ検証する。壊れていたら null を返してページ全体は生かす。
 */
export function readFeed(key: string): FeedFile | null {
  const file = path.join(DATA_DIR, `${key}.json`);
  if (!existsSync(file)) {
    console.warn(`[feeds] data/${key}.json が見つかりません（npm run fetch を実行してください）`);
    return null;
  }

  try {
    const parsed = feedFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!parsed.success) {
      console.warn(`[feeds] data/${key}.json のスキーマが不正です:`, parsed.error.message);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.warn(`[feeds] data/${key}.json の読み込みに失敗しました:`, error);
    return null;
  }
}

/**
 * data/ にある全フィードを読む。**Server Component 専用**。
 *
 * ページ側でキーを列挙せずこれを使うことで、`lib/sources/index.ts` に
 * ソースを1件足せば自動的にウィジェットが増える。
 */
export function readAllFeeds(): FeedFile[] {
  if (!existsSync(DATA_DIR)) return [];

  return readdirSync(DATA_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => readFeed(name.replace(/\.json$/, "")))
    .filter((feed): feed is FeedFile => feed !== null)
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** カテゴリごとに束ねる。表示順は CATEGORY_ORDER で決める。 */
export function groupByCategory(feeds: FeedFile[]): Map<Category, FeedFile[]> {
  const grouped = new Map<Category, FeedFile[]>();
  for (const feed of feeds) {
    const bucket = grouped.get(feed.category);
    if (bucket) bucket.push(feed);
    else grouped.set(feed.category, [feed]);
  }
  return grouped;
}
