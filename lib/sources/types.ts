import type { Category, FeedItem } from "../schemas";

/**
 * 1つの情報源の定義。
 *
 * fetch() は「正規化済みの FeedItem 配列」を返すことだけに責任を持ち、
 * 失敗時は素直に throw してよい（前回データの温存は pipeline 側の仕事）。
 */
export type Source = {
  /** data/<key>.json のファイル名になる。英小文字とハイフンのみ */
  key: string;
  /** ウィジェットの見出し */
  label: string;
  category: Category;
  /** 情報源の説明（UIの副題に出す） */
  description: string;
  /** 元サイトへのリンク。ウィジェット見出しから飛べるようにする */
  homepage: string;
  fetch: () => Promise<FeedItem[]>;
};
