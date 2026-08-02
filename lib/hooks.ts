"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * ハイドレーション完了後のみ true を返す。
 *
 * `useEffect` + `setMounted(true)` でも同じことはできるが、
 * それは「effect 内での setState」となりカスケード再レンダリングを招くため
 * React 19 の lint ルール（react-hooks/set-state-in-effect）で禁止されている。
 * サーバー用とクライアント用のスナップショットを出し分けられる
 * useSyncExternalStore がこの用途の正攻法。
 */
export function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true, // クライアント
    () => false, // サーバー（およびハイドレーション時の初回描画）
  );
}

function subscribeToMinute(onChange: () => void) {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
}

/**
 * 現在時刻を「分に丸めた epoch ミリ秒」で返す。サーバーでは null。
 *
 * 丸めるのが重要で、getSnapshot が呼ばれるたびに値が変わると
 * React が無限再レンダリングと判断してしまう。分単位なら1分間は安定する。
 */
export function useCurrentMinute(): number | null {
  return useSyncExternalStore(
    subscribeToMinute,
    () => Math.floor(Date.now() / 60_000) * 60_000,
    () => null,
  );
}
