import type { FeedItem } from "../schemas";
import type { Source } from "./types";
import { dedupeById, fetchJson, makeId, truncate } from "./rss";

/**
 * HF の daily_papers はレスポンス形状が
 *   [{ paper: { id, title, summary, upvotes, publishedAt }, ... }]
 * のときと、フラットに近い形のときがあるため、両方を受けられるようにしておく。
 */
type DailyPaper = {
  paper?: {
    id?: string;
    title?: string;
    summary?: string;
    upvotes?: number;
    publishedAt?: string;
  };
  id?: string;
  title?: string;
  summary?: string;
  upvotes?: number;
  publishedAt?: string;
  submittedOnDailyAt?: string;
};

/**
 * Hugging Face Daily Papers。APIキー不要のJSON。
 * upvotes が付くので「今日どの論文が注目されているか」がそのまま分かる。
 */
export function huggingFacePapers(options: { limit?: number } = {}): Source {
  const limit = options.limit ?? 15;

  return {
    key: "ai-papers",
    label: "AI 論文（HF Daily Papers）",
    category: "ai",
    description: "Hugging Face で今日注目されている論文。upvotes 順",
    homepage: "https://huggingface.co/papers",

    async fetch(): Promise<FeedItem[]> {
      const data = await fetchJson<DailyPaper[]>(
        `https://huggingface.co/api/daily_papers?limit=${limit}`,
      );

      const items = data.flatMap((entry) => {
        const paper = entry.paper ?? entry;
        const id = paper.id ?? entry.id;
        const title = paper.title ?? entry.title;
        if (!id || !title) return []; // 形状が想定外の要素は捨てて他を生かす

        return [
          {
            id: makeId(id),
            title: title.replace(/\s+/g, " ").trim(),
            url: `https://huggingface.co/papers/${id}`,
            publishedAt: new Date(
              entry.submittedOnDailyAt ?? paper.publishedAt ?? entry.publishedAt ?? Date.now(),
            ).toISOString(),
            summary: truncate((paper.summary ?? entry.summary ?? "").replace(/\s+/g, " "), 120)
              || undefined,
            score: paper.upvotes ?? entry.upvotes ?? undefined,
          } satisfies FeedItem,
        ];
      });

      return dedupeById(items)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit);
    },
  };
}
