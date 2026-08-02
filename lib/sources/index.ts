import { googleNews } from "./google-news";
import type { Source } from "./types";

/**
 * 収集対象の一覧。ここに1件足すと data/<key>.json が生まれ、
 * app/page.tsx で readFeed(key) するだけでウィジェットが増える。
 *
 * TODO(次の区切り): ai / game / trend のソースを追加する
 *   - AI    : Hugging Face Daily Papers (JSON), Zenn AIトピック (RSS)
 *   - ゲーム : 4Gamer (RSS 1.0), はてブ アニメとゲーム (RSS 1.0, ブクマ数付き)
 *   - 話題   : Google トレンド日本 (RSS), Hacker News (Algolia JSON)
 */
export const sources: Source[] = [
  googleNews({
    key: "callcenter-news",
    label: "コールセンター / CTI",
    category: "callcenter",
    description: "コールセンター・コンタクトセンター・CTI・ボイスボットの最新ニュース",
    query: "コールセンター OR コンタクトセンター OR CTI OR ボイスボット",
    limit: 15,
  }),
];

export function findSource(key: string): Source | undefined {
  return sources.find((source) => source.key === key);
}
