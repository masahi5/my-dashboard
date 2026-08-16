"use client";

import { useEffect } from "react";

/**
 * Service Worker を登録するだけのコンポーネント。描画は何もしない。
 *
 * 登録は「ページの読み込みが落ち着いてから」に遅らせる。初回訪問で
 * SW の取得が本文の取得と帯域を奪い合うと、表示が遅くなるだけで得がない。
 *
 * dev では登録しない。next dev の HMR と SW のキャッシュが噛み合わず、
 * 「編集したのに古い画面が出る」という無駄なデバッグを生むため。
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    // basePath 配下に置かれるので、絶対パスではなく現在の URL から解決する
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const register = () => {
      navigator.serviceWorker
        .register(`${basePath}/sw.js`, { scope: `${basePath}/` })
        .catch((error) => console.warn("[sw] 登録に失敗しました", error));
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
