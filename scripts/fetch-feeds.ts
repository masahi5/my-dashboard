/**
 * フィード取得パイプライン。
 *
 *   GitHub Actions (cron) ──▶ このスクリプト ──▶ data/*.json を commit
 *                                                      └──▶ next build ──▶ GitHub Pages
 *
 * 設計の要点:
 *  - 外部API取得は「サーバー側(Actions)」で行う。ブラウザから直接叩くと
 *    ほとんどのフィードは CORS で弾かれるため。
 *  - 1ソースが落ちても全体を壊さない。失敗時は前回の items を温存し、
 *    stale フラグと error だけ更新して書き戻す。
 *  - 常に exit 0。取得失敗でデプロイまで止めない（古いデータでも表示は続く）。
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { feedFileSchema, type FeedFile } from "../lib/schemas";
import { sources } from "../lib/sources";

const DATA_DIR = path.join(process.cwd(), "data");

async function readPrevious(key: string): Promise<FeedFile | null> {
  try {
    const raw = await readFile(path.join(DATA_DIR, `${key}.json`), "utf8");
    const parsed = feedFileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // 初回実行時はファイルが無いので想定内
  }
}

async function writeFeed(file: FeedFile): Promise<void> {
  const target = path.join(DATA_DIR, `${file.key}.json`);
  await writeFile(target, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  let succeeded = 0;
  let failed = 0;

  for (const source of sources) {
    const startedAt = Date.now();
    try {
      const items = await source.fetch();
      if (items.length === 0) {
        throw new Error("取得できた記事が0件でした（フィード仕様変更の可能性）");
      }

      // 書き出す前に必ずスキーマ検証する。壊れたJSONを data/ に commit すると
      // 次回ビルドが丸ごと落ちるため、ここが最後の砦になる。
      const file = feedFileSchema.parse({
        key: source.key,
        label: source.label,
        description: source.description,
        homepage: source.homepage,
        category: source.category,
        items,
        fetchedAt: new Date().toISOString(),
        stale: false,
        error: null,
      } satisfies FeedFile);

      await writeFeed(file);
      succeeded += 1;
      console.log(`✓ ${source.key}: ${items.length}件 (${Date.now() - startedAt}ms)`);
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`✗ ${source.key}: ${message}`);

      const previous = await readPrevious(source.key);
      await writeFeed({
        key: source.key,
        label: source.label,
        description: source.description,
        homepage: source.homepage,
        category: source.category,
        items: previous?.items ?? [], // 前回値を温存
        fetchedAt: previous?.fetchedAt ?? new Date().toISOString(),
        stale: true,
        error: message,
      });
    }
  }

  console.log(`\n完了: 成功 ${succeeded} / 失敗 ${failed} (全 ${sources.length} ソース)`);
  // 失敗しても exit 0。デプロイは続行し、UI 側で stale を明示する。
}

main().catch((error) => {
  // ここに来るのはパイプライン自体のバグ（想定外）なので、はっきり落とす。
  console.error("パイプラインが異常終了しました:", error);
  process.exit(1);
});
