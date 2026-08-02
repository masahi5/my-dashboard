import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

/**
 * removeNSPrefix で名前空間プレフィックスを落とすのが肝。
 *   dc:date              → date
 *   hatena:bookmarkcount → bookmarkcount
 *   rdf:RDF              → RDF
 *   content:encoded      → encoded
 * これで RSS 1.0 / 2.0 / Atom を同じアクセサで扱える。
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  trimValues: true,
});

export type RawItem = Record<string, unknown>;

/**
 * フィードXMLから記事ノードの配列を取り出す。
 * 3形式すべてを1関数で吸収する（4Gamer・はてブは RSS 1.0、
 * Zenn・ITmedia・Google ニュースは RSS 2.0）。
 */
export function parseFeedItems(xml: string): RawItem[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doc = parser.parse(xml) as any;
  if (doc?.rss?.channel) return asArray(doc.rss.channel.item); // RSS 2.0
  if (doc?.RDF) return asArray(doc.RDF.item); // RSS 1.0 (RDF)
  if (doc?.feed) return asArray(doc.feed.entry); // Atom
  return [];
}

export function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * fast-xml-parser は属性やCDATAがあると文字列ではなくオブジェクトを返すので、
 * 素直に String() せず #text を掘る必要がある。
 */
export function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("#text" in record) return text(record["#text"]);
  }
  return "";
}

export function num(value: unknown): number | undefined {
  const parsed = Number(text(value));
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Atom は link が属性(@_href)、RSS は要素テキスト。両方に対応する。 */
export function pickLink(item: RawItem): string {
  const link = item.link;
  if (typeof link === "string") return link;

  if (Array.isArray(link)) {
    const alternate = link.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (l: any) => !l?.["@_rel"] || l["@_rel"] === "alternate",
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chosen = (alternate ?? link[0]) as any;
    return chosen?.["@_href"] ?? text(chosen);
  }

  if (link && typeof link === "object") {
    const record = link as Record<string, unknown>;
    if (typeof record["@_href"] === "string") return record["@_href"];
    return text(link);
  }

  return text(item.id); // Atom は id が URL のことがある
}

/** pubDate(RFC822) / dc:date(ISO) / Atom published・updated を吸収する。 */
export function pickDate(item: RawItem): string {
  const raw =
    text(item.pubDate) || text(item.date) || text(item.published) || text(item.updated);
  const parsed = raw ? new Date(raw) : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? parsed.toISOString()
    : new Date().toISOString();
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  amp: "&",
};

/**
 * 実体参照を1パスで復号する。
 *
 * 逐次 replace を並べる実装だと `&amp;` を戻した結果が次の replace の入力になり、
 * 二重デコードで壊れる。正規表現1回で置換することでそれを避ける。
 * 数値文字参照（&#x307F; / &#12415;）にも対応する — はてなブックマークの
 * タイトルは日本語がこの形式で入ってくる。
 */
function decodeEntitiesOnce(input: string): string {
  return input.replace(/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const isHex = entity[1] === "x" || entity[1] === "X";
      const code = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

export function decodeEntities(input: string): string {
  const once = decodeEntitiesOnce(input);
  // 一部フィード（はてブ等）は実体参照が二重エスケープされている（&amp;#x307F;）。
  // 数値参照が残っているときだけもう1パスかける。
  return /&#(?:[xX][0-9a-fA-F]+|\d+);/.test(once) ? decodeEntitiesOnce(once) : once;
}

/** description に HTML が入るソースが多いので、素のテキストへ落とす。 */
export function stripHtml(html: string): string {
  return decodeEntities(
    // タグを落としてから復号する。順序を逆にすると &lt;script&gt; が本物のタグに戻る。
    html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

/**
 * 安定IDを作る。取得のたびに変わらないので重複排除と React の key に使える。
 * 通常は URL を渡すが、Google トレンドのように全項目が同じ URL を返すソースでは
 * タイトル等の一意な文字列を渡す。
 */
export function makeId(seed: string): string {
  return createHash("sha1").update(seed).digest("hex").slice(0, 12);
}

/** 同じ記事が複数回現れるフィードがあるので、ID で畳む。 */
export function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; my-dashboard/1.0; +https://github.com/masahi5/my-dashboard)";

/**
 * 取得の共通処理。UA を明示しないと弾くフィードがあるため必ず付ける。
 * タイムアウトは Actions のジョブを詰まらせないため 15 秒で打ち切る。
 */
export async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}
