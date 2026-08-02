import type { Category, FeedItem } from "../schemas";
import type { Source } from "./types";
import {
  dedupeById,
  fetchText,
  makeId,
  num,
  parseFeedItems,
  pickDate,
  pickLink,
  stripHtml,
  text,
  truncate,
} from "./rss";

type HatenaOptions = {
  key: string;
  label: string;
  category: Category;
  description: string;
  /** "" = 総合、"it"、"game"（= アニメとゲーム）など */
  path?: string;
  limit?: number;
  /** このブクマ数未満は捨てる。ノイズの多いカテゴリで効く */
  minBookmarks?: number;
};

/**
 * はてなブックマークの人気エントリ。RSS 1.0 (RDF) 形式。
 *
 * hatena:bookmarkcount を score として拾えるのがこのソースの価値。
 * 「日本語圏で今読まれているもの」の指標として素直に使える。
 * フィードは新着順なので、ブクマ数で降順に並べ替えてから切り出す。
 */
export function hatenaHotentry(options: HatenaOptions): Source {
  const segment = options.path ? `/${options.path}` : "";
  const feedUrl = `https://b.hatena.ne.jp/hotentry${segment}.rss`;

  return {
    key: options.key,
    label: options.label,
    category: options.category,
    description: options.description,
    homepage: `https://b.hatena.ne.jp/hotentry${segment}`,

    async fetch(): Promise<FeedItem[]> {
      const xml = await fetchText(feedUrl);

      const items = parseFeedItems(xml).map((item) => {
        const url = pickLink(item);
        return {
          id: makeId(url),
          title: stripHtml(text(item.title)),
          url,
          publishedAt: pickDate(item),
          summary: truncate(stripHtml(text(item.description)), 100) || undefined,
          // removeNSPrefix により hatena:bookmarkcount → bookmarkcount
          score: num(item.bookmarkcount),
        } satisfies FeedItem;
      });

      const minBookmarks = options.minBookmarks ?? 0;

      return dedupeById(items)
        .filter((item) => item.title && item.url && (item.score ?? 0) >= minBookmarks)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, options.limit ?? 15);
    },
  };
}
