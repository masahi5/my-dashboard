// 使い捨ての疎通確認（第2弾）。Actions のIPから X のタイムラインを取れる経路を探す。
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const TARGET = "https://syndication.twitter.com/srv/timeline-profile/screen-name/hillbig";

const candidates: { name: string; url: string; headers?: Record<string, string> }[] = [
  { name: "twimg-srv", url: "https://cdn.syndication.twimg.com/srv/timeline-profile/screen-name/hillbig" },
  { name: "xcancel-rss", url: "https://xcancel.com/hillbig/rss" },
  { name: "xcancel-html", url: "https://xcancel.com/hillbig" },
  { name: "twiiit-rss", url: "https://twiiit.com/hillbig/rss" },
  { name: "nitter-tiekoetter", url: "https://nitter.tiekoetter.com/hillbig/rss" },
  { name: "lightbrd", url: "https://lightbrd.com/hillbig/rss" },
  { name: "nitter-space", url: "https://nitter.space/hillbig/rss" },
  { name: "openrss", url: "https://openrss.org/x.com/hillbig" },
  { name: "cors.lol", url: `https://api.cors.lol/?url=${encodeURIComponent(TARGET)}` },
  { name: "corsfix", url: `https://proxy.corsfix.com/?${TARGET}` },
  { name: "allorigins-get", url: `https://api.allorigins.win/get?url=${encodeURIComponent(TARGET)}` },
  { name: "thingproxy", url: `https://thingproxy.freeboard.io/fetch/${TARGET}` },
];

for (const c of candidates) {
  const started = Date.now();
  try {
    const r = await fetch(c.url, {
      headers: { "user-agent": UA, accept: "*/*", ...c.headers },
      signal: AbortSignal.timeout(30_000),
    });
    const body = await r.text();
    const entries = body.includes('"entries":[') ? "entries:yes" : "entries:no";
    const items = (body.match(/<item[ >]/g) ?? []).length;
    console.log(
      `${c.name.padEnd(18)} ${r.status} ${String(body.length).padStart(7)}B ${entries} rss_items=${items} ${Date.now() - started}ms :: ${body.slice(0, 90).replace(/\s+/g, " ")}`,
    );
  } catch (error) {
    console.log(`${c.name.padEnd(18)} ERR ${(error as Error).message} ${Date.now() - started}ms`);
  }
}
