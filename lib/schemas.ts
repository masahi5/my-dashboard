import { z } from "zod";

/**
 * 表示カテゴリ。ウィジェットのグルーピングとフィルタに使う。
 */
export const categorySchema = z.enum(["ai", "callcenter", "game", "trend"]);
export type Category = z.infer<typeof categorySchema>;

export const CATEGORY_LABELS: Record<Category, string> = {
  ai: "AI",
  callcenter: "コールセンター / 情シス",
  game: "ゲーム",
  trend: "話題",
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
