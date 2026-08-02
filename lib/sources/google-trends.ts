import type { FeedItem } from "../schemas";
import type { Source } from "./types";
import { asArray, dedupeById, fetchText, makeId, parseFeedItems, pickDate, text } from "./rss";

/**
 * Google トレンド（日本）の急上昇ワード。
 *
 * 注意点が2つある:
 *  1. 各 item の <link> は全件同じトレンドページを指すので、URL を ID にすると全部衝突する。
 *     → 検索ワードそのものを ID の種にする。
 *  2. ht:news_item に関連ニュースが入っているので、リンク先はそちらを優先する。
 *     無ければ Google 検索へ飛ばす。
 * removeNSPrefix により ht:approx_traffic → approx_traffic、ht:news_item → news_item。
 */
export function googleTrendsJapan(options: { limit?: number } = {}): Source {
  const limit = options.limit ?? 15;

  return {
    key: "trend-google",
    label: "Google トレンド（日本）",
    category: "trend",
    description: "日本でいま検索が急上昇しているワード",
    homepage: "https://trends.google.co.jp/trending?geo=JP",

    async fetch(): Promise<FeedItem[]> {
      const xml = await fetchText("https://trends.google.co.jp/trending/rss?geo=JP");

      const items = parseFeedItems(xml).flatMap((item) => {
        const term = text(item.title).trim();
        if (!term) return [];

        // 関連ニュースの先頭を取る（無ければ Google 検索へ）
        const firstNews = asArray(item.news_item)[0] as Record<string, unknown> | undefined;
        const newsUrl = firstNews ? text(firstNews.news_item_url) : "";
        const newsSource = firstNews ? text(firstNews.news_item_source) : "";

        return [
          {
            id: makeId(`trend:${term}`),
            title: term,
            url: newsUrl || `https://www.google.com/search?q=${encodeURIComponent(term)}`,
            publishedAt: pickDate(item),
            publisher: newsSource || undefined,
            // "200+" のような文字列なので数値だけ取り出す
            score: parseApproxTraffic(text(item.approx_traffic)),
          } satisfies FeedItem,
        ];
      });

      return dedupeById(items)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
        .slice(0, limit);
    },
  };
}

function parseApproxTraffic(raw: string): number | undefined {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : undefined;
}
