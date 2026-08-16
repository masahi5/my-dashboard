/**
 * 最小構成の Service Worker。
 *
 * 目的は2つだけ:
 *   1. 「ホーム画面に追加」でインストール可能な PWA として認識させる
 *   2. 圏外・機内モードでも直前の内容が開けるようにする
 *
 * データは15分ごとに更新されるので **HTML はネットワーク優先**。
 * キャッシュ優先にすると「アプリを開いても昨日のニュースが出る」ことになる。
 * ハッシュ付きファイル名の /_next/static だけはキャッシュ優先で良い（内容が変われば名前が変わる）。
 *
 * このファイルは public/ 配下の静的ファイルなのでビルド時の変数展開が効かない。
 * basePath は自分の URL から導出する（GitHub Pages のサブパス配信対策）。
 */

const VERSION = "v1";
const CACHE = `my-dashboard-${VERSION}`;

// SW 自身の置き場所 = スコープのルート。例: "/my-dashboard/"
const ROOT = new URL("./", self.location).pathname;

self.addEventListener("install", (event) => {
  // トップページだけ先に温めておく。オフラインで開いたときの受け皿になる
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll([ROOT]))
      .catch(() => {}) // 取得できなくてもインストールは止めない
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // 別オリジン（X のウィジェットなど）には一切触らない
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(ROOT)) return;

  // ハッシュ付きの静的アセットはキャッシュ優先
  if (url.pathname.startsWith(`${ROOT}_next/static/`)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // HTML とその他はネットワーク優先。失敗したときだけキャッシュを返す
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const hit = await caches.match(request);
        if (hit) return hit;
        // ページ遷移が失敗したらトップページのキャッシュで代替する
        if (request.mode === "navigate") {
          const root = await caches.match(ROOT);
          if (root) return root;
        }
        return Response.error();
      }),
  );
});
