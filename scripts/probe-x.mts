// 使い捨ての疎通確認。Actions のIPから X のタイムラインを取れる経路を探す。
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TARGET = "https://syndication.twitter.com/srv/timeline-profile/screen-name/hillbig";

const candidates: { name: string; url: string; headers?: Record<string, string> }[] = [
  { name: "direct", url: TARGET },
  { name: "jina", url: `https://r.jina.ai/${TARGET}`, headers: { "x-return-format": "html" } },
  { name: "allorigins", url: `https://api.allorigins.win/raw?url=${encodeURIComponent(TARGET)}` },
  { name: "codetabs", url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(TARGET)}` },
  { name: "corsproxy", url: `https://corsproxy.io/?url=${encodeURIComponent(TARGET)}` },
  { name: "isomorphic", url: `https://cors.isomorphic-git.org/${TARGET}` },
  {
    name: "twimg-cdn",
    url: "https://cdn.syndication.twimg.com/timeline/profile?screen_name=hillbig&dnt=true&suppress_response_codes=true&lang=ja",
  },
  { name: "nitter-poast", url: "https://nitter.poast.org/hillbig/rss" },
  { name: "nitter-privacydev", url: "https://nitter.privacydev.net/hillbig/rss" },
  { name: "nitter-net", url: "https://nitter.net/hillbig/rss" },
  { name: "rsshub", url: "https://rsshub.app/twitter/user/hillbig" },
];

for (const c of candidates) {
  const started = Date.now();
  try {
    const r = await fetch(c.url, {
      headers: { "user-agent": UA, accept: "*/*", ...c.headers },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await r.text();
    const entries = body.match(/"entries":\[/) ? "entries:yes" : "entries:no";
    const items = (body.match(/<item[ >]/g) ?? []).length;
    console.log(
      `${c.name.padEnd(18)} ${r.status} ${String(body.length).padStart(7)}B ${entries} rss_items=${items} ${Date.now() - started}ms :: ${body.slice(0, 90).replace(/\s+/g, " ")}`,
    );
  } catch (error) {
    console.log(`${c.name.padEnd(18)} ERR ${(error as Error).message} ${Date.now() - started}ms`);
  }
}
