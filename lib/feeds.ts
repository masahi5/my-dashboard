import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { feedFileSchema, type FeedFile } from "./schemas";

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
  const file = path.join(process.cwd(), "data", `${key}.json`);
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
