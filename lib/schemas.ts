import { z } from "zod";

/**
 * 表示カテゴリ。ウィジェットのグルーピングとフィルタに使う。
 */
export const categorySchema = z.enum(["ai", "callcenter", "game", "trend"]);
export type Category = z.infer<typeof categorySchema>;

/** タブの見出しになる。狭い画面でも折り返さない長さに保つこと */
export const CATEGORY_LABELS: Record<Category, string> = {
  ai: "AI",
  callcenter: "コールセンタ・システム",
  game: "ゲーム",
  trend: "その他",
};

/** ダッシュボード上のセクション表示順 */
export const CATEGORY_ORDER: readonly Category[] = ["ai", "callcenter", "game", "trend"];

/**
 * 全ソース共通に正規化した記事1件。
 *
 * 取得元は RSS 2.0 / RSS 1.0(RDF) / Atom / JSON と形式がバラバラなので、
 * ここに畳み込んで UI 側から差異を完全に隠す。新しいソースを足すときは
 * 「この形に変換する関数」を1つ書くだけで済む。
 */
export const feedItemSchema = z.object({
  /** URL から生成した安定ID（重複排除と React の key に使う） */
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.url(),
  /** ISO 8601（UTC）。表示時に JST へ変換する */
  publishedAt: z.string().min(1),
  /** 配信元メディア名。Google ニュースなど提供があるソースのみ */
  publisher: z.string().optional(),
  summary: z.string().optional(),
  /** はてブ数 / HN ポイント / HF upvotes など。人気度の指標 */
  score: z.number().int().nonnegative().optional(),
});
export type FeedItem = z.infer<typeof feedItemSchema>;

/**
 * data/<key>.json の中身。取得失敗時も「前回の items を温存したまま」
 * stale/error だけ更新して書き戻すため、items 以外のメタ情報を持つ。
 */
export const feedFileSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** ウィジェットの副題。UI がソース定義を import せずに済むよう JSON に持たせる */
  description: z.string(),
  /** 情報源のトップページ。ウィジェット見出しのリンク先 */
  homepage: z.url(),
  category: categorySchema,
  items: z.array(feedItemSchema),
  /** 最後に取得を「成功」した時刻（ISO, UTC） */
  fetchedAt: z.string().min(1),
  /** 直近の取得が失敗し、items が古いままなら true */
  stale: z.boolean(),
  /** 直近の失敗理由。成功時は null */
  error: z.string().nullable(),
});
export type FeedFile = z.infer<typeof feedFileSchema>;

/**
 * X の投稿1件。
 *
 * フィード記事（FeedItem）とは持ち物が違う（タイトルが無い・本文がすべて・
 * リポスト/返信という区別がある）ので別スキーマにしている。
 */
export const xTweetSchema = z.object({
  /** 投稿ID（timeline 上での一意キー。リポストならリポストした側のID） */
  id: z.string().min(1),
  /** 投稿そのものへのリンク。リポストなら元投稿へ飛ぶ */
  url: z.url(),
  /** 本文。t.co を表示用URLへ戻し、末尾の画像/動画リンクは落としてある。
   *  画像だけの投稿では空になりうる */
  text: z.string(),
  /** ISO 8601（UTC）。リポストなら「リポストした時刻」 */
  publishedAt: z.string().min(1),
  /** 本文を書いた人。リポストなら元投稿者になる */
  authorName: z.string().min(1),
  authorHandle: z.string().min(1),
  likeCount: z.number().int().nonnegative(),
  /** リポストか。true のとき本文・いいね数・著者は元投稿のもの */
  repost: z.boolean(),
  /** 返信のときだけ、その宛先ハンドル */
  replyTo: z.string().optional(),
});
export type XTweet = z.infer<typeof xTweetSchema>;

/**
 * data/x/<handle>.json の中身。
 *
 * FeedFile と同じく「失敗しても前回分を温存し stale/error だけ立てる」ため、
 * tweets 以外にメタ情報を持つ。表示名や肩書きは lib/x-accounts.ts が持つので入れない。
 */
export const xTimelineFileSchema = z.object({
  /** @ を除いたスクリーンネーム */
  handle: z.string().min(1),
  tweets: z.array(xTweetSchema),
  fetchedAt: z.string().min(1),
  stale: z.boolean(),
  error: z.string().nullable(),
});
export type XTimelineFile = z.infer<typeof xTimelineFileSchema>;
