"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, TriangleAlert } from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardHeader, CardTitle, CardDescription, CardAction } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isTimelineRendered, renderXTimeline } from "@/lib/x-widgets";
import { X_TWEET_LIMIT, type XAccount } from "@/lib/x-accounts";

type Status = "pending" | "ready" | "error";

/**
 * X の公式タイムラインウィジェットを1アカウント分表示するカード。
 *
 * 他のウィジェットと違い、これだけはビルド時ではなくブラウザ側で中身を取りに行く
 * （X が API/RSS を閉じたため、無料で使えるのが公式ウィジェットだけ）。そのため:
 *   - 画面に入るまで初期化しない。12個のiframeを一斉に生成すると初期表示が固まる
 *   - 読み込めなかったときは必ずプロフィールへのリンクに退避する。
 *     広告ブロッカー・トラッキング防止・X 側の仕様変更で描画されないことは普通に起きる
 */
export function XTimelineCard({ account }: { account: XAccount }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<Status>("pending");
  const { resolvedTheme } = useTheme();
  const profileUrl = `https://x.com/${account.handle}`;

  // 画面に近づいたら初期化する（タブが非表示の間は交差が起きないので走らない）
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      // 少し手前から先読みする。深追いすると X のレート制限に当たるので控えめに
      { rootMargin: "200px" },
    );
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  // 待ち時間切れで一度あきらめた後に描画が届くことがある（回線が細いときなど）。
  // 高さが付いたら黙って本来の表示へ戻す。
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    const observer = new ResizeObserver(() => {
      if (isTimelineRendered(slot)) setStatus("ready");
    });
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    // next-themes が解決するまで待つ。undefined のまま作ると
    // ダークで作り直しになり、ウィジェットが二度描画されて目立つ
    if (!resolvedTheme) return;

    const slot = slotRef.current;
    if (!slot) return;

    let cancelled = false;

    renderXTimeline(account.handle, slot, {
      tweetLimit: X_TWEET_LIMIT, // 最新5件だけ。スクロールしない静的な並びになる
      theme: resolvedTheme === "light" ? "light" : "dark",
      // 見出しとフッターは自前のカードで出すので消す。背景も透過してカードに馴染ませる
      chrome: "noheader nofooter noborders transparent",
      lang: "ja",
      dnt: true, // 埋め込み経由の行動ターゲティングを無効化する
    }).then((rendered) => {
      if (!cancelled) setStatus(rendered ? "ready" : "error");
    });

    return () => {
      cancelled = true;
    };
  }, [visible, resolvedTheme, account.handle]);

  return (
    <Card className="flex h-full flex-col gap-3 [--card-spacing:--spacing(3)] sm:[--card-spacing:--spacing(4)]">
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
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${account.name} のプロフィールを X で開く`}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowUpRight className="size-4" />
          </a>
        </CardAction>
      </CardHeader>

      {/* iframe が入る場所。ウィジェット側が高さを決めるので指定しない */}
      <div className="min-w-0 px-2">
        <div ref={slotRef} />
        {status === "pending" ? <TimelineSkeleton /> : null}
        {status === "error" ? <TimelineFallback url={profileUrl} /> : null}
      </div>
    </Card>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4 px-2 py-2" aria-hidden>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}

function TimelineFallback({ url }: { url: string }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-2 px-2 py-8 text-center text-xs">
      <TriangleAlert className="size-5 opacity-60" />
      <p>
        タイムラインを読み込めませんでした。
        <br />
        広告ブロッカーや X 側の制限が原因のことがあります。
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground hover:text-primary font-medium underline underline-offset-4"
      >
        X で開く
      </a>
    </div>
  );
}
