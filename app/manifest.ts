import type { MetadataRoute } from "next";

/**
 * Web App Manifest。Android の「ホーム画面に追加」でアプリ扱いされるための宣言。
 *
 * Next が <link rel="manifest"> の href には basePath を自動で付けるが、
 * **この中身の URL には付かない**。GitHub Pages はサブパス配信なので、
 * start_url とアイコンのパスは自分で basePath を前置する必要がある。
 * これを忘れると「起動するとリポジトリのルート(404)へ飛ぶアプリ」になる。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// manifest は Route Handler 扱いなので、output: "export" では静的だと明示が要る
// （無いと「動的ルートは書き出せない」でビルドが落ちる）
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Dashboard",
    short_name: "Dashboard",
    description: "AI・コールセンタ・システム・ゲーム・話題を1画面に集約する個人ダッシュボード",
    lang: "ja",
    // trailingSlash: true でビルドしているのでスラッシュ終わりに揃える
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    // ブラウザのUIを消してアプリのように全画面で開く
    display: "standalone",
    // orientation は指定しない。横向きを禁止しても得るものが無い
    // 起動時のスプラッシュとステータスバーの色。ダーク基調に合わせる
    background_color: "#0e0e11",
    theme_color: "#0e0e11",
    icons: [
      { src: `${basePath}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${basePath}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      // maskable が無いと Android で白い余白付きの縮小アイコンになる
      {
        src: `${basePath}/icons/maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
