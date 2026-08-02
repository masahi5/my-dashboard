import type { FeedItem } from "../schemas";
import type { Source } from "./types";
import { dedupeById, fetchJson, makeId } from "./rss";

type AlgoliaResponse = {
  hits: Array<{
    objectID: string;
    title: string | null;
    url: string | null;
    points: number | null;
    num_comments: number | null;
    created_at: string;
    author: string | null;
  }>;
};

/**
 * Hacker News のフロントページ。Algolia の検索APIを使う（APIキー不要）。
 *
 * 公式 Firebase API は記事IDの配列しか返さず N+1 リクエストになるのに対し、
 * Algolia 版は1リクエストで points 込みの一覧が取れる。
 */
export function hackerNewsFrontPage(options: { limit?: number } = {}): Source {
  const limit = options.limit ?? 15;
  const endpoint = `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${limit}`;

  return {
    key: "trend-hackernews",
    label: "Hacker News",
    category: "trend",
    description: "世界の技術者が今読んでいる話題（フロントページ）",
    homepage: "https://news.ycombinator.com/",

    async fetch(): Promise<FeedItem[]> {
      const data = await fetchJson<AlgoliaResponse>(endpoint);

      const items = data.hits.map((hit) => {
        // Ask HN / Show HN などの自己投稿は url が null。HN のスレッドへ向ける。
        const url = hit.url ?? `https://news.ycombinator.com/item?id=${hit.objectID}`;
        return {
          id: makeId(hit.objectID),
          title: hit.title ?? "(no title)",
          url,
          publishedAt: new Date(hit.created_at).toISOString(),
          publisher: hit.author ?? undefined,
          score: hit.points ?? undefined,
        } satisfies FeedItem;
      });

      return dedupeById(items.filter((item) => item.title !== "(no title)"));
    },
  };
}
