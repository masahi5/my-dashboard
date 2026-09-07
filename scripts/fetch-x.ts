/**
 * X タイムライン取得パイプライン。
 *
 *   GitHub Actions (cron) ──▶ このスクリプト ──▶ data/x/<handle>.json を commit
 *                                                      └──▶ next build ──▶ GitHub Pages
 *
 * フィード側（scripts/fetch-feeds.ts）と同じ約束で動く:
 *  - 取得は必ずサーバー側。X の取得口は「呼び出し元のIP」にレート制限をかけるので、
 *    ブラウザから呼ぶと閲覧者の枠を使い切って全滅する（詳細は lib/sources/x-timeline.ts）
 *  - 1アカウントが落ちても全体を壊さない。前回の tweets を温存し stale/error を立てる
 *  - 常に exit 0。取得失敗でデプロイまで止めない
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { xTimelineFileSchema, type XTimelineFile } from "../lib/schemas";
import { fetchXTimeline } from "../lib/sources/x-nitter";
import { X_ACCOUNT_GROUPS, X_TWEET_STORE_LIMIT, xTimelineFileName } from "../lib/x-accounts";

const DATA_DIR = path.join(process.cwd(), "data", "x");

/**
 * 1件ごとの間隔。枠は 15分あたり 30リクエストで 12アカウントなら余裕があるが、
 * 短時間に固めて叩く必要も無いので均す。
 */
const GAP_MS = 800;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function readPrevious(handle: string): Promise<XTimelineFile | null> {
  try {
    const raw = await readFile(path.join(DATA_DIR, xTimelineFileName(handle)), "utf8");
    const parsed = xTimelineFileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // 初回実行時はファイルが無いので想定内
  }
}

async function writeTimeline(file: XTimelineFile): Promise<void> {
  const target = path.join(DATA_DIR, xTimelineFileName(file.handle));
  await writeFile(target, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  const accounts = X_ACCOUNT_GROUPS.flatMap((group) => group.accounts);
  let succeeded = 0;
  let failed = 0;

  for (const [index, account] of accounts.entries()) {
    if (index > 0) await delay(GAP_MS);

    const startedAt = Date.now();
    try {
      const tweets = await fetchXTimeline(account.handle, X_TWEET_STORE_LIMIT);
      // 0件は鍵アカウント・凍結・改名・レート制限のいずれか。
      // 前回の内容を消してしまわないよう失敗として扱う。
      if (tweets.length === 0) {
        throw new Error("投稿が0件でした（非公開・凍結・改名の可能性）");
      }

      // 書き出す前に必ずスキーマ検証する。壊れた JSON を commit すると
      // 次のビルドが丸ごと落ちるため、ここが最後の砦になる。
      const file = xTimelineFileSchema.parse({
        handle: account.handle,
        tweets,
        fetchedAt: new Date().toISOString(),
        stale: false,
        error: null,
      } satisfies XTimelineFile);

      await writeTimeline(file);
      succeeded += 1;
      console.log(`✓ @${account.handle}: ${tweets.length}件 (${Date.now() - startedAt}ms)`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ @${account.handle}: ${message}`);

      const previous = await readPrevious(account.handle);
      await writeTimeline({
        handle: account.handle,
        tweets: previous?.tweets ?? [], // 前回値を温存
        fetchedAt: previous?.fetchedAt ?? new Date().toISOString(),
        stale: true,
        error: message,
      });
    }
  }

  console.log(`\n完了: 成功 ${succeeded} / 失敗 ${failed} (全 ${accounts.length} アカウント)`);
  // 失敗しても exit 0。デプロイは続行し、UI 側で stale を明示する。
}

main().catch((error) => {
  // ここに来るのはパイプライン自体のバグ（想定外）なので、はっきり落とす。
  console.error("X 取得パイプラインが異常終了しました:", error);
  process.exit(1);
});
