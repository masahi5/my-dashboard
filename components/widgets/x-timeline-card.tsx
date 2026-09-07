import { ArrowUpRight, Heart, Inbox, Repeat2, Reply, TriangleAlert } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCount, formatJstFull } from "@/lib/format";
import type { XTimelineFile } from "@/lib/schemas";
import { X_TWEET_LIMIT, type XAccount } from "@/lib/x-accounts";

type XTimelineCardProps = {
  account: XAccount;
  timeline: XTimelineFile | null;
  limit?: number;
};

/**
 * X の1アカウント分のカード。Server Component。
 *
 * 以前は X の公式埋め込みウィジェットをブラウザ側で生成していたが、取得口の
 * レート制限が「閲覧者のIP」にかかるため、開いても全部空という状態が常態化した。
 * 今は Actions が取得した data/x/<handle>.json をビルド時に焼き込む
 * （経緯は lib/sources/x-timeline.ts を参照）。他のフィードと同じ壊れ方をする。
 */
export function XTimelineCard({ account, timeline, limit = X_TWEET_LIMIT }: XTimelineCardProps) {
  const tweets = timeline?.tweets.slice(0, limit) ?? [];
  const profileUrl = `https://x.com/${account.handle}`;

  return (
    <Card className="flex h-full flex-col gap-4 [--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]">
      <CardHeader>
        <CardTitle className="text-base">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-primary transition-colors"
          >
            {account.name}
            <span className="text-muted-foreground ml-1.5 text-xs font-normal">
              @{account.handle}
            </span>
          </a>
        </CardTitle>
        <CardDescription className="line-clamp-2 text-xs">{account.role}</CardDescription>
        <CardAction>
          {timeline?.stale ? (
            <Badge variant="secondary" className="gap-1 text-amber-600 dark:text-amber-400">
              <TriangleAlert /> 更新失敗
            </Badge>
          ) : (
            <Badge variant="secondary">{tweets.length}件</Badge>
          )}
        </CardAction>
      </CardHeader>

      <CardContent className="flex-1">
        {tweets.length === 0 ? (
          <EmptyState url={profileUrl} />
        ) : (
          <ol className="divide-border/60 -my-1 divide-y">
            {tweets.map((tweet) => (
              <li key={tweet.id} className="py-2.5 first:pt-0 last:pb-0">
                <a
                  href={tweet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group focus-visible:ring-ring block rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                >
                  {/* リポスト・返信は「誰の言葉か」が変わるので必ず出す */}
                  {tweet.repost ? (
                    <p className="text-muted-foreground mb-1 flex items-center gap-1 text-[11px]">
                      <Repeat2 className="size-3 shrink-0" />
                      <span className="truncate">
                        {tweet.authorName} @{tweet.authorHandle}
                      </span>
                    </p>
                  ) : null}
                  {!tweet.repost && tweet.replyTo ? (
                    <p className="text-muted-foreground mb-1 flex items-center gap-1 text-[11px]">
                      <Reply className="size-3 shrink-0" />
                      <span className="truncate">@{tweet.replyTo} への返信</span>
                    </p>
                  ) : null}

                  {/* 改行は投稿者の意図なので保つ。長文はカードが伸びすぎない位置で畳む */}
                  <p className="group-hover:text-primary line-clamp-6 text-sm leading-relaxed whitespace-pre-line transition-colors">
                    {tweet.text || "（画像・動画のみの投稿）"}
                    <ArrowUpRight className="text-muted-foreground ml-1 inline size-3 shrink-0 align-baseline opacity-0 transition-opacity group-hover:opacity-100" />
                  </p>

                  <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                    <RelativeTime iso={tweet.publishedAt} />
                    {tweet.likeCount > 0 ? (
                      <span className="text-muted-foreground/80 inline-flex items-center gap-0.5">
                        <Heart className="size-3" />
                        {formatCount(tweet.likeCount)}
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
        {timeline ? (
          <>
            最終取得 {formatJstFull(timeline.fetchedAt)}
            {timeline.stale && timeline.error ? (
              <span className="text-amber-600 dark:text-amber-400"> — {timeline.error}</span>
            ) : null}
          </>
        ) : (
          <code>npm run fetch</code>
        )}
      </div>
    </Card>
  );
}

/**
 * 空のときは必ず X への導線を残す。
 * 鍵アカウント化・凍結・改名では取得できないので、ここから確認できるようにする。
 */
function EmptyState({ url }: { url: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-10 text-center text-sm">
      <Inbox className="size-6 opacity-50" />
      <p>まだ投稿を取得できていません</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground hover:text-primary text-xs font-medium underline underline-offset-4"
      >
        X で開く
      </a>
    </div>
  );
}
