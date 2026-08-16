import { ArrowUpRight, Flame, Inbox, TriangleAlert } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatJstFull } from "@/lib/format";
import type { FeedFile } from "@/lib/schemas";

type FeedCardProps = {
  feed: FeedFile | null;
  /** feed が無いとき（初回 fetch 前など）に見出しへ出す名前 */
  fallbackLabel: string;
  /** 表示件数の上限 */
  limit?: number;
};

/**
 * フィード1本を表示するウィジェット。Server Component。
 *
 * データが無い/古い場合も「何も出ない」ではなく状態を明示する。
 * 外部フィードは必ずいつか落ちるので、壊れ方を設計に含めておく。
 */
export function FeedCard({ feed, fallbackLabel, limit = 12 }: FeedCardProps) {
  const items = feed?.items.slice(0, limit) ?? [];

  return (
    // スマホでは画面幅が貴重なのでカード内側の余白も詰める（--card-spacing は
    // Card が padding に使っている変数。上書きすると見出し・本文・脚注が揃って狭まる）
    <Card className="flex h-full flex-col gap-4 [--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]">
      <CardHeader>
        <CardTitle className="text-base">
          {feed ? (
            <a
              href={feed.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors"
            >
              {feed.label}
            </a>
          ) : (
            fallbackLabel
          )}
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {feed?.description ?? "データ未取得"}
        </CardDescription>
        <CardAction>
          {feed?.stale ? (
            <Badge variant="secondary" className="gap-1 text-amber-600 dark:text-amber-400">
              <TriangleAlert /> 更新失敗
            </Badge>
          ) : (
            <Badge variant="secondary">{items.length}件</Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex-1">
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <ol className="divide-border/60 -my-1 divide-y">
            {items.map((item) => (
              <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group focus-visible:ring-ring block rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  <p className="group-hover:text-primary text-sm leading-snug font-medium transition-colors">
                    {item.title}
                    <ArrowUpRight className="text-muted-foreground ml-1 inline size-3 shrink-0 align-baseline opacity-0 transition-opacity group-hover:opacity-100" />
                  </p>
                  <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    {item.publisher ? (
                      <span className="max-w-[12rem] truncate">{item.publisher}</span>
                    ) : null}
                    {item.publisher ? <span aria-hidden>·</span> : null}
                    <RelativeTime iso={item.publishedAt} />
                    {typeof item.score === "number" ? (
                      <span className="text-muted-foreground/80 inline-flex items-center gap-0.5">
                        <Flame className="size-3" />
                        {item.score}
                      </span>
                    ) : null}
                  </p>
                </a>
              </li>
            ))}
          </ol>
        )}
      </CardContent>

      <div className="text-muted-foreground border-border/60 border-t px-(--card-spacing) pt-3 text-[11px]">
        {feed ? (
          <>
            最終取得 {formatJstFull(feed.fetchedAt)}
            {feed.stale && feed.error ? (
              <span className="text-amber-600 dark:text-amber-400"> — {feed.error}</span>
            ) : null}
          </>
        ) : (
          <code>npm run fetch</code>
        )}
      </div>
    </Card>
  );
}

function EmptyState() {
  return (
    <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-10 text-center text-sm">
      <Inbox className="size-6 opacity-50" />
      <p>まだデータがありません</p>
    </div>
  );
}
