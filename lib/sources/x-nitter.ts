import { asArray, decodeEntities, parseFeedItems, pickDate, text, type RawItem } from "./rss";
import { xTweetSchema, type XTweet } from "../schemas";

/**
 * Nitter（X のフロントエンド）の RSS からタイムラインを取る。**X の唯一の取得経路**。
 *
 * X 本体（syndication.twitter.com の埋め込み用の口）を使わない理由は2つ:
 *   1. データセンターのIPからは枠の残量に関係なく 1発目から 429 が返る。
 *      GitHub Actions のランナーは軒並みこれで、別ランナー＝別IPでも同じだった
 *   2. **たまに通っても中身が数か月古い。** アカウントによって古いキャッシュを
 *      返し続ける（実測 2026-09: @sama は 2025-11、@unnonouno は 2025-05 が「最新」。
 *      同時刻に Nitter からは当日の投稿が取れていた）。つまり通ったら通ったで、
 *      古い投稿で新しいデータを上書きしてしまう
 *
 * 代償として **いいね数は取れない**（RSS に無い）。本文は逆に X 本体より完全で、
 * 長文が途中で切れない。
 */

/**
 * 試すインスタンス。**生きているものは頻繁に入れ替わる**ので、
 * ここが全滅したら新しいインスタンスに差し替える（stale 表示になるだけで壊れはしない）。
 * twiiit.com は「そのとき生きているインスタンスへランダムに転送する」ので最後の砦に置く。
 */
const NITTER_HOSTS = [
  "https://nitter.jaydenha.uk",
  "https://twiiit.com",
  "https://nitter.tiekoetter.com",
];

/**
 * ブラウザのふりをしない。Nitter は RSS リーダーからのアクセスを想定していて、
 * ブラウザ UA だとインスタンスによっては弾かれる。
 */
const USER_AGENT = "my-dashboard/1.0 (+https://github.com/masahi5/my-dashboard) RSS reader";
const ACCEPT = "application/rss+xml, application/xml, text/xml, */*";

/** その実行で通ったホスト。1件目で見つけたら残り11アカウントはそこだけを使う */
let workingHost: string | null = null;

async function fetchFeed(host: string, handle: string): Promise<string> {
  const response = await fetch(`${host}/${encodeURIComponent(handle)}/rss`, {
    headers: { "user-agent": USER_AGENT, accept: ACCEPT },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

  const xml = await response.text();
  // 死んだインスタンスは 200 のまま Cloudflare のブロックページ等を返してくる
  if (!xml.includes("<item>")) throw new Error("RSS ではない応答（インスタンスが不調）");
  return xml;
}

/**
 * 本文は description（HTML）から取る。title にも本文は入っているが改行が潰れており、
 * 「RT by @x:」のような接頭辞も混ざる。
 *
 * 最初の <p> だけを見るのは、その後ろに画像・動画へのリンクが付くため。
 */
function bodyText(html: string): string {
  const paragraph = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? html;
  return (
    decodeEntities(
      paragraph
        // <br> の前後にはソース整形の改行も入っている。まとめて1つの改行に潰す
        .replace(/\s*<br\s*\/?>\s*/gi, "\n")
        .replace(/<[^>]*>/g, ""),
    )
      // 投稿者が空けた1行は残し、それ以上は詰める
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]+$/gm, "")
      .trim()
  );
}

/** Nitter のリンク（`http://<instance>/user/status/<id>#m`）を x.com へ戻す */
function toXUrl(link: string): string | null {
  try {
    return `https://x.com${new URL(link).pathname}`;
  } catch {
    return null;
  }
}

function toTweet(item: RawItem, owner: string): XTweet | null {
  const url = toXUrl(text(item.link));
  const id = text(item.guid);
  if (!url || !id) return null;

  // 種別は title の接頭辞にしか出てこない（description は本文だけ）
  const title = decodeEntities(text(item.title));
  const repost = /^RT by @\w+: /.test(title);
  const replyTo = title.match(/^R to @(\w+): /)?.[1];

  const creator = text(item.creator).replace(/^@/, ""); // dc:creator。リポストなら元投稿者

  const parsed = xTweetSchema.safeParse({
    id,
    url,
    text: bodyText(text(item.description)),
    publishedAt: pickDate(item),
    // 表示名は RSS に無い。カード側はハンドルだけで出す
    authorHandle: creator || owner,
    // RSS はいいね数を持たない。0 なら UI に出ない
    likeCount: 0,
    repost,
    // 自分への返信＝連投スレッドの続き。「@自分 への返信」と出しても意味が無い
    replyTo: replyTo && replyTo.toLowerCase() !== owner.toLowerCase() ? replyTo : undefined,
  } satisfies XTweet);

  return parsed.success ? parsed.data : null;
}

/**
 * 1アカウント分のタイムラインを取得する。どのインスタンスでも取れなければ throw する
 * （前回データの温存は scripts/fetch-x.ts の仕事）。
 */
export async function fetchXTimeline(handle: string, limit: number): Promise<XTweet[]> {
  const hosts = workingHost ? [workingHost] : NITTER_HOSTS;
  const failures: string[] = [];

  for (const host of hosts) {
    try {
      const xml = await fetchFeed(host, handle);
      workingHost = host;
      return asArray(parseFeedItems(xml))
        .map((item) => toTweet(item, handle))
        .filter((tweet): tweet is XTweet => tweet !== null)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, limit);
    } catch (error) {
      failures.push(`${host}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // 覚えていたホストが落ちただけかもしれないので、次のアカウントでは総当たりに戻す
  workingHost = null;
  throw new Error(`Nitter から取得できませんでした（${failures.join(" / ")}）`);
}
