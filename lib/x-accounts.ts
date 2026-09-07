/**
 * ツイートタブに並べる X アカウント。
 *
 * ここに1件足すと data/x/<handle>.json が生まれ、カードが1枚増える。
 * 中身は他のフィードと同じく Actions が取得してビルド時に焼き込む
 * （取得口とレート制限の事情は lib/sources/x-timeline.ts を参照）。
 */

export type XAccount = {
  /** @ を除いたスクリーンネーム。取得先URLと data/x/<handle>.json の名前になる */
  handle: string;
  name: string;
  role: string;
};

export type XAccountGroup = {
  /** タブ内の小見出し。ジャンプボタンのラベルにもなる */
  id: string;
  label: string;
  accounts: XAccount[];
};

export const X_ACCOUNT_GROUPS: XAccountGroup[] = [
  {
    id: "x-jp-research",
    label: "国内 — 研究者・経営者",
    accounts: [
      { handle: "hillbig", name: "岡野原大輔", role: "Preferred Networks 共同創業者・代表取締役CRO" },
      { handle: "unnonouno", name: "海野裕也", role: "Preferred Networks" },
      { handle: "iwiwi", name: "秋葉拓哉", role: "Sakana AI リサーチャー" },
      {
        handle: "ikuyamada",
        name: "山田育矢",
        role: "Studio Ousia 共同創業者・チーフサイエンティスト",
      },
      { handle: "ImAI_Eruel", name: "今井翔太", role: "AI研究者・著述家" },
    ],
  },
  {
    id: "x-jp-hands-on",
    label: "国内 — 速報・実装検証",
    accounts: [
      { handle: "npaka123", name: "npaka", role: "個人開発者（note 発信）" },
      { handle: "shi3z", name: "清水亮", role: "ギリア創業者" },
    ],
  },
  {
    id: "x-global-exec",
    label: "海外 — 経営者・組織",
    accounts: [
      { handle: "JensenHuang", name: "Jensen Huang", role: "NVIDIA 創業者・CEO" },
      { handle: "sama", name: "Sam Altman", role: "OpenAI CEO" },
      { handle: "AnthropicAI", name: "Anthropic", role: "公式アカウント（Claude 開発元）" },
    ],
  },
  {
    id: "x-global-research",
    label: "海外 — 研究者",
    accounts: [
      { handle: "hardmaru", name: "David Ha", role: "Sakana AI 共同創業者・CEO" },
      { handle: "shanegJP", name: "Shane Gu", role: "Google DeepMind（Gemini 非英語向け事後学習）" },
    ],
  },
];

/** カードに出す件数。カード1枚が縦に伸びすぎない範囲に収める */
export const X_TWEET_LIMIT = 5;

/**
 * data/x/<handle>.json に貯める件数。
 * 表示より多めに持っておくと、表示件数を増やしたいときに再取得が要らない。
 */
export const X_TWEET_STORE_LIMIT = 10;

/**
 * data/x/ の中のファイル名。
 *
 * ハンドルの大文字小文字は X 側では区別されないが、ファイル名は
 * Actions の Linux では区別される（Windows・macOS では区別されない）。
 * 手元では動いたのに Actions で読めない、を防ぐため読み書き両方でここを通す。
 */
export function xTimelineFileName(handle: string): string {
  return `${handle.toLowerCase()}.json`;
}
