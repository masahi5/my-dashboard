import type { Category, FeedItem } from "../schemas";
import type { Source } from "./types";
import {
  dedupeById,
  fetchText,
  makeId,
  parseFeedItems,
  pickDate,
  pickLink,
  stripHtml,
  text,
  truncate,
} from "./rss";

type GenericRssOptions = {
  key: string;
  label: string;
  category: Category;
  description: string;
  feedUrl: string;
  homepage: string;
  limit?: number;
  /** description を要約として表示するか。中身が広告や関連リンクだけのフィードでは false */
  withSummary?: boolean;
};

/**
 * 素直な RSS / Atom フィード用の汎用ソース。
 * rss.ts が形式差を吸収しているので、Zenn(RSS 2.0) も 4Gamer(RSS 1.0) も同じ関数で扱える。
 */
export function genericRss(options: GenericRssOptions): Source {
  return {
    key: options.key,
    label: options.label,
    category: options.category,
    description: options.description,
    homepage: options.homepage,

    async fetch(): Promise<FeedItem[]> {
      const xml = await fetchText(options.feedUrl);

      const items = parseFeedItems(xml).map((item) => {
        const url = pickLink(item);
        const summary = options.withSummary
          ? truncate(stripHtml(text(item.description) || text(item.summary)), 120)
          : "";

        return {
          id: makeId(url),
          title: stripHtml(text(item.title)),
          url,
          publishedAt: pickDate(item),
          // dc:creator があれば著者名を出す（Zenn など）
          publisher: text(item.creator) || undefined,
          summary: summary || undefined,
        } satisfies FeedItem;
      });

      return dedupeById(items.filter((item) => item.title && item.url)).slice(
        0,
        options.limit ?? 15,
      );
    },
  };
}
