import { LayoutDashboard } from "lucide-react";
import { RelativeTime } from "@/components/relative-time";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeedCard } from "@/components/widgets/feed-card";
import { groupByCategory, readAllFeeds } from "@/lib/feeds";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/schemas";

export default function Home() {
  // ビルド時に data/*.json を全部読む。ソースを足せば自動でウィジェットが増える。
  const feeds = readAllFeeds();
  const grouped = groupByCategory(feeds);

  // 「いつ時点のダッシュボードか」を示すため、最も新しい取得時刻を採る
  const latestFetch = feeds.reduce<string | null>(
    (latest, feed) => (!latest || feed.fetchedAt > latest ? feed.fetchedAt : latest),
    null,
  );
  const staleCount = feeds.filter((feed) => feed.stale).length;

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-10 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <LayoutDashboard className="size-6" />
            My Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            個人的に欲しい情報を集約したダッシュボード
          </p>
          {latestFetch ? (
            <p className="text-muted-foreground/80 mt-2 text-xs">
              最終更新 <RelativeTime iso={latestFetch} />
              <span className="mx-1.5" aria-hidden>
                ·
              </span>
              {feeds.length} ソース
              {staleCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  （{staleCount} 件が更新失敗）
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
        <ThemeToggle />
      </header>

      <div className="space-y-10">
        {CATEGORY_ORDER.map((category) => {
          const items = grouped.get(category);
          if (!items?.length) return null;

          return (
            <section key={category}>
              <h2 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                {CATEGORY_LABELS[category]}
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((feed) => (
                  <FeedCard key={feed.key} feed={feed} fallbackLabel={feed.key} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <footer className="text-muted-foreground mt-12 text-xs">
        GitHub Actions が15分ごとにフィードを取得し、GitHub Pages から静的配信しています。
      </footer>
    </main>
  );
}
