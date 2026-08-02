"use client";

import { useEffect, useState } from "react";
import { formatJst, formatJstFull, toRelative } from "@/lib/format";

/**
 * 「3時間前」のような相対時刻。
 *
 * 静的サイトの落とし穴への対処:
 *   ビルド時に "3時間前" を HTML へ焼き込むと、1日後には嘘の表示になる。
 *   そこで初回描画は必ず絶対時刻（サーバー/クライアントで一致する値）にし、
 *   マウント後に相対表記へ差し替える。これならハイドレーション不整合も起きず、
 *   表示は常に正しい。JS が無効でも絶対時刻は読める。
 */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [label, setLabel] = useState(() => formatJst(iso));

  useEffect(() => {
    setLabel(toRelative(iso));
    const timer = setInterval(() => setLabel(toRelative(iso)), 60_000);
    return () => clearInterval(timer);
  }, [iso]);

  return (
    <time dateTime={iso} title={formatJstFull(iso)} className={className}>
      {label}
    </time>
  );
}
