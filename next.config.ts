import type { NextConfig } from "next";

/**
 * GitHub Pages はサブパス（https://<user>.github.io/<repo>/）で配信されるため、
 * 本番ビルドだけ basePath を付ける。ローカルの `npm run dev` は "/" のままにしたいので
 * 環境変数で切り替える（値は .github/workflows/update-and-deploy.yml で注入）。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  // GitHub Pages は静的ファイル配信のみ。Node サーバーが無いので静的書き出しにする。
  // この結果 ISR / Route Handler / next/image の最適化は使えなくなる。
  // データ更新は「Actions で取得 → 再ビルド → デプロイ」で担保する。
  output: "export",
  basePath,
  // 画像最適化は実行時サーバーが必要なため無効化（静的書き出しの必須設定）
  images: { unoptimized: true },
  // /foo を /foo/index.html として出力する。Pages で 404 を避けるための定石。
  trailingSlash: true,
};

export default nextConfig;
