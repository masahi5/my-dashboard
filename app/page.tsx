import { LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { FeedCard } from "@/components/widgets/feed-card";
import { readFeed } from "@/lib/feeds";

export default function Home() {
  // readFeed は build 時に実行され、結果が静的HTMLへ焼き込まれる。
  const callcenter = readFeed("callcenter-news");

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <LayoutDashboard className="size-6" />
            My Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            AI・コールセンター・ゲーム・話題を1画面に。
          </p>
        </div>
        <ThemeToggle />
      </header>

      {/* ウィジェットが増えたらこの grid に足していく */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <FeedCard feed={callcenter} fallbackLabel="コールセンター / CTI" />
      </div>

      <footer className="text-muted-foreground mt-10 text-xs">
        データは GitHub Actions が定期取得し、GitHub Pages から静的配信しています。
      </footer>
    </main>
  );
}
