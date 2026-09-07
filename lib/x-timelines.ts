import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { xTimelineFileSchema, type XTimelineFile } from "./schemas";
import { X_ACCOUNT_GROUPS, xTimelineFileName } from "./x-accounts";

const DATA_DIR = path.join(process.cwd(), "data", "x");

/**
 * data/x/<handle>.json を読む。**Server Component 専用**（lib/feeds.ts と同じ役回り）。
 *
 * 静的書き出しなので `next build` 時に一度だけ実行され、結果が HTML に焼き込まれる。
 * 中身は X 由来の外部データなので、読み込み時にも必ずスキーマ検証する。
 */
export function readXTimeline(handle: string): XTimelineFile | null {
  const file = path.join(DATA_DIR, xTimelineFileName(handle));
  if (!existsSync(file)) {
    console.warn(`[x] data/x/${xTimelineFileName(handle)} がありません（npm run fetch を実行）`);
    return null;
  }

  try {
    const parsed = xTimelineFileSchema.safeParse(JSON.parse(readFileSync(file, "utf8")));
    if (!parsed.success) {
      console.warn(`[x] @${handle} のスキーマが不正です:`, parsed.error.message);
      return null;
    }
    return parsed.data;
  } catch (error) {
    console.warn(`[x] @${handle} の読み込みに失敗しました:`, error);
    return null;
  }
}

/**
 * 表示対象アカウント全員分をまとめて読む。**Server Component 専用**。
 *
 * キーは小文字のハンドル。data/ を走査せず X_ACCOUNT_GROUPS を基準にするのは、
 * アカウントを外したときに古い JSON が残っていても表示に混ざらないようにするため。
 */
export function readAllXTimelines(): Map<string, XTimelineFile> {
  const timelines = new Map<string, XTimelineFile>();
  for (const group of X_ACCOUNT_GROUPS) {
    for (const account of group.accounts) {
      const timeline = readXTimeline(account.handle);
      if (timeline) timelines.set(account.handle.toLowerCase(), timeline);
    }
  }
  return timelines;
}
