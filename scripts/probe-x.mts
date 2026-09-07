// 使い捨ての疎通確認（第3弾）。Nitter 系の RSS がどこから取れるかを見る。
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const READER_UA = "my-dashboard/1.0 (+https://github.com/masahi5/my-dashboard) RSS reader";
const RSS_ACCEPT = "application/rss+xml, application/xml, text/xml, */*";

const candidates: { name: string; url: string; headers?: Record<string, string> }[] = [
  {
    name: "xcancel(reader-ua)",
    url: "https://xcancel.com/hillbig/rss",
    headers: { "user-agent": READER_UA, accept: RSS_ACCEPT },
  },
  { name: "xcancel(browser)", url: "https://xcancel.com/hillbig/rss", headers: { accept: RSS_ACCEPT } },
  {
    name: "farside",
    url: "https://farside.link/nitter/hillbig/rss",
    headers: { "user-agent": READER_UA, accept: RSS_ACCEPT },
  },
  {
    name: "twiiit#1",
    url: "https://twiiit.com/hillbig/rss",
    headers: { "user-agent": READER_UA, accept: RSS_ACCEPT },
  },
  {
    name: "twiiit#2",
    url: "https://twiiit.com/hillbig/rss",
    headers: { "user-agent": READER_UA, accept: RSS_ACCEPT },
  },
  {
    name: "twiiit#3",
    url: "https://twiiit.com/sama/rss",
    headers: { "user-agent": READER_UA, accept: RSS_ACCEPT },
  },
  {
    name: "tiekoetter",
    url: "https://nitter.tiekoetter.com/hillbig/rss",
    headers: { "user-agent": READER_UA, accept: RSS_ACCEPT },
  },
  {
    name: "privacydev",
    url: "https://nitter.privacydev.net/hillbig/rss",
    headers: { "user-agent": READER_UA, accept: RSS_ACCEPT },
  },
  {
    name: "poast",
    url: "https://nitter.poast.org/hillbig/rss",
    headers: { "user-agent": READER_UA, accept: RSS_ACCEPT },
  },
  {
    name: "1d4",
    url: "https://nitter.1d4.us/hillbig/rss",
    headers: { "user-agent": READER_UA, accept: RSS_ACCEPT },
  },
];

for (const c of candidates) {
  const started = Date.now();
  try {
    const r = await fetch(c.url, {
      headers: { "user-agent": BROWSER_UA, accept: "*/*", ...c.headers },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await r.text();
    const items = (body.match(/<item[ >]/g) ?? []).length;
    console.log(
      `${c.name.padEnd(19)} ${r.status} ${String(body.length).padStart(7)}B items=${String(items).padStart(2)} ${Date.now() - started}ms final=${r.url}`,
    );
    if (items > 0) {
      const first = body.split("<item>")[1]?.slice(0, 700).replace(/\s+/g, " ");
      console.log(`   FIRST_ITEM: ${first}`);
    }
  } catch (error) {
    console.log(`${c.name.padEnd(19)} ERR ${(error as Error).message} ${Date.now() - started}ms`);
  }
}
