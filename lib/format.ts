const JST = "Asia/Tokyo";

/**
 * 日時は必ずタイムゾーンを明示して整形する。
 *
 * GitHub Actions のビルド環境は UTC なので、指定しないと
 * 「静的HTMLに焼かれた時刻(UTC)」と「ブラウザの表示(JST)」がズレ、
 * ハイドレーション不整合になる。JST 固定にして両者を必ず一致させる。
 */
export function formatJst(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: JST,
  }).format(new Date(iso));
}

export function formatJstFull(iso: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: JST,
  }).format(new Date(iso));
}

/**
 * 相対表記。静的サイトなのでビルド時には使わず、
 * ブラウザ側（マウント後）でのみ使う。詳細は RelativeTime を参照。
 */
export function toRelative(iso: string, now: number = Date.now()): string {
  const diffMs = now - new Date(iso).getTime();
  if (diffMs < 0) return formatJst(iso); // 未来日付は素直に絶対表記

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}日前`;

  return formatJst(iso);
}
