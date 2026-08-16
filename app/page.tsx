import { LayoutDashboard } from "lucide-react";
import { AnchorTarget, DashboardTabs, type DashboardTab } from "@/components/dashboard-tabs";
import { RelativeTime } from "@/components/relative-time";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeedCard } from "@/components/widgets/feed-card";
import { XTimelineCard } from "@/components/widgets/x-timeline-card";
import { groupByCategory, readAllFeeds } from "@/lib/feeds";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/schemas";
import { X_ACCOUNT_GROUPS } from "@/lib/x-accounts";

/** ウィジェットの並べ方はどのタブでも同じ。1画面に入る幅で段数を増やす */
const GRID = "grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3";

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

  const tabs: DashboardTab[] = [
    // カテゴリのタブ。データが無くてもタブ自体は残す（タブの並びが日によって
    // 変わると「昨日あった場所」を探すことになるため）
    ...CATEGORY_ORDER.map((category): DashboardTab => {
      const items = grouped.get(category) ?? [];
      return {
        id: category,
        label: CATEGORY_LABELS[category],
        anchors: items.map((feed) => ({ id: `sec-${feed.key}`, label: feed.label })),
        content: items.length ? (
          <div className={GRID}>
            {items.map((feed) => (
              <AnchorTarget key={feed.key} id={`sec-${feed.key}`} className="min-w-0">
                <FeedCard feed={feed} fallbackLabel={feed.key} />
              </AnchorTarget>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground py-12 text-center text-sm">
            このカテゴリのデータがまだありません（<code>npm run fetch</code>）
          </p>
        ),
      };
    }),

    // X はビルド時に取得できない（API/RSS が閉じている）ため、
    // 中身の取得はブラウザ側の公式ウィジェットに任せる
    {
      id: "x",
      label: "ツイート",
      anchors: X_ACCOUNT_GROUPS.map((group) => ({ id: group.id, label: group.label })),
      content: (
        <div className="space-y-8">
          {X_ACCOUNT_GROUPS.map((group) => (
            <AnchorTarget key={group.id} id={group.id}>
              <h3 className="text-muted-foreground mb-2 text-xs font-semibold tracking-wider uppercase">
                {group.label}
              </h3>
              <div className={GRID}>
                {group.accounts.map((account) => (
                  <XTimelineCard key={account.handle} account={account} />
                ))}
              </div>
            </AnchorTarget>
          ))}
        </div>
      ),
    },
  ];

  return (
    // 端末の横幅を使い切りたいので、スマホでは左右の余白を切り詰める。
    // 上下は safe-area（ノッチ・ジェスチャーバー）に食われないぶんだけ足す。
    <main className="mx-auto w-full max-w-7xl flex-1 px-2 pb-[calc(2rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8">
      <header className="flex items-start justify-between gap-4 py-4 sm:py-6">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight sm:text-2xl">
            <LayoutDashboard className="size-5 sm:size-6" />
            My Dashboard
          </h1>
          {latestFetch ? (
            <p className="text-muted-foreground/80 mt-1.5 text-xs">
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

      <DashboardTabs tabs={tabs} />

      <footer className="text-muted-foreground mt-10 text-xs">
        GitHub Actions が15分ごとにフィードを取得し、GitHub Pages から静的配信しています。
        ツイートは X の公式ウィジェットを使い、表示時にブラウザから読み込んでいます。
      </footer>
    </main>
  );
}
