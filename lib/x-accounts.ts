/**
 * ツイートタブに並べる X アカウント。
 *
 * ここだけは RSS ではなく X の公式埋め込みウィジェットで表示する。
 * X は 2023年に API を有料化し RSS も提供していないため、
 * 「運用費ゼロ・APIキー不要」を守れる手段が公式ウィジェットしかない。
 * その代わり取得はビルド時ではなくブラウザ側で行われる（data/*.json には入らない）。
 */

export type XAccount = {
  /** @ を除いたスクリーンネーム。ウィジェットの sourceType: profile に渡す */
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

/** 1アカウントあたりの表示ツイート数 */
export const X_TWEET_LIMIT = 5;
