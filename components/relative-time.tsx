"use client";

import { formatJst, formatJstFull, toRelative } from "@/lib/format";
import { useCurrentMinute } from "@/lib/hooks";

/**
 * 「3時間前」のような相対時刻。
 *
 * 静的サイトの落とし穴への対処:
 *   ビルド時に "3時間前" を HTML へ焼き込むと、1日後には嘘の表示になる。
 *   そこでサーバー側では絶対時刻を描き、ハイドレーション後に相対表記へ切り替える。
 *   初回描画がサーバーと一致するのでハイドレーション不整合も起きず、
 *   JS が無効な環境でも絶対時刻は読める。
 */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const now = useCurrentMinute();

  return (
    <time dateTime={iso} title={formatJstFull(iso)} className={className}>
      {now === null ? formatJst(iso) : toRelative(iso, now)}
    </time>
  );
}
