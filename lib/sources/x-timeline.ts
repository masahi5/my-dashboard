import { decodeEntities } from "./rss";
import { fetchNitterTimeline } from "./x-nitter";
import { xTweetSchema, type XTweet } from "../schemas";

/**
 * X のタイムラインを「公式埋め込みウィジェットが中身を取りに行く先」から直接取る。
 *
 * X は API を有料化し RSS も閉じたので、無料で使える口はここしか残っていない。
 * `syndication.twitter.com/srv/timeline-profile/screen-name/<handle>` は
 * 埋め込みウィジェットの iframe が読み込む HTML で、`__NEXT_DATA__` に
 * 本文・投稿日時・いいね数・パーマリンクがそのまま入っている。
 *
 * **必ず Actions（サーバー側）から呼ぶこと。** この口は 15分あたり 30リクエストの
 * レート制限を「呼び出し元のIP」に対してかける。ブラウザから呼ぶと閲覧者のIPの枠を
 * 使うことになり、1回の表示で 12アカウント分＝12消費するのでほぼ即座に枯渇する
 * （CGNAT で他人と枠を共有していると何もしなくても減る）。
 *
 * ただし **GitHub Actions のランナーIPからは直接叩けない**。枠の残量に関係なく
 * 1発目から 429 が返る（別ランナー＝別IPでも同じなので、データセンターのIPごと
 * 弾かれている）。実測でリーダープロキシ・CORSプロキシ類もことごとく駄目だった
 * （X 側に弾かれるか、プロキシ自身が Cloudflare のチャレンジを返す）。
 * そこで直接が駄目な環境では Nitter の RSS へ切り替える（lib/sources/x-nitter.ts）。
 * こちらの本文は完全だが、いいね数は取れない。
 */
const ENDPOINT = "https://syndication.twitter.com/srv/timeline-profile/screen-name/";


/**
 * 埋め込み iframe と同じ体裁で名乗る。
 *
 * 他のソース（lib/sources/rss.ts）はプロジェクト名の UA を使っているが、ここは
 * 公開APIではなくウィジェット用の口なので、ブラウザとして扱われる形に寄せておく。
 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0.0.0 Safari/537.36";

/** ページ内に埋まっている JSON。Next.js 製ページなので id は固定 */
const NEXT_DATA = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/;

type RawUser = { screen_name?: string; name?: string };
type RawTweet = {
  id_str?: string;
  full_text?: string;
  text?: string;
  created_at?: string;
  permalink?: string;
  favorite_count?: number;
  in_reply_to_screen_name?: string;
  user?: RawUser;
  retweeted_status?: RawTweet;
  entities?: { urls?: { url?: string; display_url?: string }[] };
};
type RawEntry = { type?: string; content?: { tweet?: RawTweet } };

/**
 * 本文を読める形に整える。
 *
 *  - t.co の短縮URLを表示用（`example.com/aaa…`）へ戻す。そのままだと
 *    どこへ飛ぶか分からない文字列が本文に残る
 *  - 末尾に残る t.co は画像・動画への参照。entities.urls に含まれないので
 *    上の置換では消えず、ここで落とす
 *  - `&amp;` などの実体参照を戻す（RSS と同じ処理を使い回す）
 */
function normalizeText(tweet: RawTweet): string {
  let text = tweet.full_text ?? tweet.text ?? "";
  for (const url of tweet.entities?.urls ?? []) {
    if (url.url && url.display_url) text = text.split(url.url).join(url.display_url);
  }
  return decodeEntities(text.replace(/\s*https:\/\/t\.co\/\w+\s*$/, "")).trim();
}

function isSelfReply(raw: RawTweet, owner: string): boolean {
  const to = raw.in_reply_to_screen_name?.toLowerCase();
  return to !== undefined && to === owner.toLowerCase();
}

function toTweet(raw: RawTweet, owner: string): XTweet | null {
  // リポストは外側に「RT @xxx: …」の切り詰められた本文しか無い。
  // 本文・いいね数・著者は元投稿（retweeted_status）から採る。
  const inner = raw.retweeted_status ?? raw;
  const id = raw.id_str;
  const permalink = inner.permalink;
  const handle = inner.user?.screen_name;
  const published = raw.created_at ? new Date(raw.created_at) : null;

  if (!id || !permalink || !handle || !published || Number.isNaN(published.getTime())) return null;

  const parsed = xTweetSchema.safeParse({
    id,
    url: new URL(permalink, "https://x.com").toString(),
    text: normalizeText(inner),
    // 表示順は「タイムラインに現れた順」でありたいので、リポストでも
    // 元投稿の時刻ではなくリポストした時刻を使う
    publishedAt: published.toISOString(),
    authorName: inner.user?.name ?? handle,
    authorHandle: handle,
    likeCount: Math.max(0, Math.trunc(inner.favorite_count ?? 0)),
    repost: Boolean(raw.retweeted_status),
    // 自分への返信＝連投スレッドの続き。「@自分 への返信」と出しても意味が無いので落とす
    replyTo: isSelfReply(raw, owner) ? undefined : (raw.in_reply_to_screen_name ?? undefined),
  } satisfies XTweet);

  return parsed.success ? parsed.data : null;
}

async function fetchViaSyndication(handle: string, limit: number): Promise<XTweet[]> {
  const response = await fetch(`${ENDPOINT}${encodeURIComponent(handle)}`, {
    headers: { "user-agent": USER_AGENT, accept: "text/html", "accept-language": "ja,en;q=0.8" },
    signal: AbortSignal.timeout(15_000),
  });
  // レート制限は 429 + 本文 "Rate limit exceeded"。同じ状況で 403 が返ることもある
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

  const html = await response.text();
  const match = html.match(NEXT_DATA);
  if (!match) throw new Error("__NEXT_DATA__ が見つかりません（ページ構造の変更）");

  let entries: RawEntry[];
  try {
    const data = JSON.parse(match[1]) as {
      props?: { pageProps?: { timeline?: { entries?: RawEntry[] } } };
    };
    entries = data.props?.pageProps?.timeline?.entries ?? [];
  } catch (error) {
    throw new Error(`__NEXT_DATA__ を JSON として読めません: ${String(error)}`);
  }

  // 空配列は「鍵アカウント・凍結・改名」でも起きる。呼び出し側で Nitter を試す
  return entries
    .filter((entry) => entry.type === "tweet" && entry.content?.tweet)
    .map((entry) => toTweet(entry.content!.tweet!, handle))
    .filter((tweet): tweet is XTweet => tweet !== null)
    // 実測では新しい順で返ってくるが、固定ツイートのような例外がありうるので念のため揃える
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit);
}

/**
 * その実行で使える経路。1アカウント目で判明したら、残り11アカウントでは
 * 通らないと分かっている方を試さない（Actions では毎回12回 429 を待つことになる）。
 */
let transport: "syndication" | "nitter" | null = null;

/**
 * 1アカウント分のタイムラインを取得する。
 *
 * X 本体 → 駄目なら Nitter の順に試す。手元（家庭用回線）では X 本体が通っていいね数まで
 * 取れるが、Actions では必ず Nitter 側になる。どちらも駄目なら throw する
 * （前回データの温存は scripts/fetch-x.ts の仕事）。
 */
export async function fetchXTimeline(handle: string, limit: number): Promise<XTweet[]> {
  if (transport !== "nitter") {
    try {
      const tweets = await fetchViaSyndication(handle, limit);
      // 0件は鍵アカウント・凍結・改名のほか、X 側の気まぐれでも起きる。
      // 経路が死んだとは決めつけず、このアカウントだけ Nitter でも試す。
      if (tweets.length > 0) {
        transport = "syndication";
        return tweets;
      }
    } catch {
      // 直接が使えない環境（データセンターのIPなど）。以降は Nitter だけを使う。
      // 一度でも直接が通っていたなら、たまたまの失敗として経路は切り替えない。
      if (transport !== "syndication") transport = "nitter";
    }
  }

  return fetchNitterTimeline(handle, limit);
}
