import { genericRss } from "./generic-rss";
import { googleNews } from "./google-news";
import { googleTrendsJapan } from "./google-trends";
import { hackerNewsFrontPage } from "./hacker-news";
import { hatenaHotentry } from "./hatena";
import { huggingFacePapers } from "./hugging-face";
import type { Source } from "./types";

/**
 * 収集対象の一覧。ここに1件足すと data/<key>.json が生まれ、
 * app/page.tsx で readFeed(key) するだけでウィジェットが増える。
 *
 * 採用条件: APIキー不要・無料・CORS を気にせずサーバー側から叩けること。
 */
export const sources: Source[] = [
  // ── AI ────────────────────────────────────────────────────────────
  huggingFacePapers({ limit: 12 }),
  genericRss({
    key: "ai-zenn",
    label: "Zenn / AI",
    category: "ai",
    description: "日本語の AI 実践記事（Zenn の AI トピック）",
    feedUrl: "https://zenn.dev/topics/ai/feed",
    homepage: "https://zenn.dev/topics/ai",
    withSummary: true,
    limit: 12,
  }),
  googleNews({
    key: "ai-news",
    label: "AI ニュース",
    category: "ai",
    description: "生成AI・LLM・主要AI企業の動向",
    query: "生成AI OR LLM OR OpenAI OR Anthropic OR Gemini",
    limit: 12,
  }),

  // ── コールセンター / 情シス ────────────────────────────────────────
  googleNews({
    key: "callcenter-news",
    label: "コールセンター / CTI",
    category: "callcenter",
    description: "コールセンター・コンタクトセンター・CTI・ボイスボットの最新ニュース",
    query: "コールセンター OR コンタクトセンター OR CTI OR ボイスボット",
    limit: 15,
  }),
  genericRss({
    key: "enterprise-it",
    label: "ITmedia エンタープライズ",
    category: "callcenter",
    description: "情報システム部門向け。基幹刷新・セキュリティ・社内DX",
    feedUrl: "https://rss.itmedia.co.jp/rss/2.0/enterprise.xml",
    homepage: "https://www.itmedia.co.jp/enterprise/",
    withSummary: true,
    limit: 12,
  }),
  hatenaHotentry({
    key: "it-hatena",
    label: "はてブ / テクノロジー",
    category: "callcenter",
    description: "日本語圏の技術者が今ブックマークしている記事",
    path: "it",
    limit: 12,
  }),

  // ── ゲーム ────────────────────────────────────────────────────────
  genericRss({
    key: "game-4gamer",
    label: "4Gamer",
    category: "game",
    description: "国内最大級のゲームニュース。新作・アップデート・イベント",
    feedUrl: "https://www.4gamer.net/rss/index.xml",
    homepage: "https://www.4gamer.net/",
    withSummary: true,
    limit: 12,
  }),
  googleNews({
    key: "game-news",
    label: "ゲームニュース",
    category: "game",
    description: "新作・アップデート・プラットフォームの動向",
    query: "ゲーム (新作 OR 発売 OR アップデート) OR Nintendo Switch OR PlayStation OR Steam",
    limit: 12,
  }),
  hatenaHotentry({
    key: "game-hatena",
    label: "はてブ / アニメとゲーム",
    category: "game",
    // はてブのこのカテゴリはマンガ・アニメ記事も多く含む。ラベルで実態を明示している。
    description: "話題のゲーム・アニメ・マンガ記事（ブクマ数順）",
    path: "game",
    minBookmarks: 30,
    limit: 12,
  }),

  // ── 話題（分野問わず） ─────────────────────────────────────────────
  googleTrendsJapan({ limit: 12 }),
  hatenaHotentry({
    key: "trend-hatena",
    label: "はてブ / 総合",
    category: "trend",
    description: "分野を問わず日本語圏で読まれている記事（ブクマ数順）",
    limit: 12,
  }),
  hackerNewsFrontPage({ limit: 12 }),
];

export function findSource(key: string): Source | undefined {
  return sources.find((source) => source.key === key);
}
