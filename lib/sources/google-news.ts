import type { Category, FeedItem } from "../schemas";
import type { Source } from "./types";
import { fetchText, makeId, parseFeedItems, pickDate, pickLink, stripHtml, text } from "./rss";

type GoogleNewsOptions = {
  key: string;
  label: string;
  category: Category;
  description: string;
  /** Google ニュースの検索クエリ。OR / "" / -除外 がそのまま使える */
  query: string;
  limit?: number;
};

/**
 * Google ニュースの「検索結果RSS」ソース。
 *
 * コールセンター/CTI のような専門領域は既製のRSSが存在しないので、
 * 検索クエリをそのままフィード化できるこの仕組みが要になる。
 * クエリを変えた定義を足すだけでウィジェットが1つ増える。
 */
export function googleNews(options: GoogleNewsOptions): Source {
  const feedUrl =
    "https://news.google.com/rss/search" +
    `?q=${encodeURIComponent(options.query)}&hl=ja&gl=JP&ceid=JP:ja`;

  return {
    key: options.key,
    label: options.label,
    category: options.category,
    description: options.description,
    homepage: feedUrl.replace("/rss/search", "/search"),

    async fetch(): Promise<FeedItem[]> {
      const xml = await fetchText(feedUrl);
      const raw = parseFeedItems(xml);

      const items = raw.map((item) => {
        const publisher = text(item.source) || undefined;
        const url = pickLink(item);

        // Google ニュースのタイトルは末尾に " - 媒体名" が付くので落とす
        let title = stripHtml(text(item.title));
        if (publisher && title.endsWith(` - ${publisher}`)) {
          title = title.slice(0, -(publisher.length + 3)).trim();
        }

        return {
          id: makeId(url),
          title,
          url,
          publishedAt: pickDate(item),
          publisher,
          // description は関連記事のHTMLリンク集で中身が無いため採用しない
        } satisfies FeedItem;
      });

      return dedupeById(items.filter((item) => item.title && item.url)).slice(
        0,
        options.limit ?? 15,
      );
    },
  };
}

function dedupeById(items: FeedItem[]): FeedItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}
