"use client";

import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { ArrowUp, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** タブ内の小見出し。上部のジャンプボタンと対になる */
export type TabAnchor = { id: string; label: string };

export type DashboardTab = {
  id: string;
  label: string;
  anchors: TabAnchor[];
  /** パネルの中身。並べ方はタブごとに違うので呼び出し側で組み立てる */
  content: ReactNode;
};

/** ジャンプ先が隠れないように、固定タブバーの高さぶん余白を取る */
const SCROLL_MARGIN = "scroll-mt-16";

function subscribeToHash(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * URL のハッシュ（#game など）。サーバーでは空文字。
 *
 * effect + setState で読むと React 19 の set-state-in-effect に触れるうえ、
 * 初回描画がサーバーとズレる。useSyncExternalStore なら
 * 「ハイドレーション時はサーバーと同じ値 → 直後にクライアントの値」に切り替わる。
 */
function useHash(): string {
  return useSyncExternalStore(
    subscribeToHash,
    () => window.location.hash.replace(/^#/, ""),
    () => "",
  );
}

function subscribeToScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

/** 「上へ戻る」ボタンを出すかどうか。深くスクロールしたときだけ */
function useIsScrolled(): boolean {
  return useSyncExternalStore(
    subscribeToScroll,
    () => window.scrollY > 600,
    () => false,
  );
}

export function DashboardTabs({ tabs }: { tabs: DashboardTab[] }) {
  // 画面で選ばれたタブ。「どのハッシュのときに選ばれたか」も持つ。
  // こうしておくと #game のリンクを後から開いたときにハッシュ側が勝つ
  // （タブを触った後は選択が勝つ、という当たり前の優先順位も同時に満たせる）
  const [selection, setSelection] = useState<{ id: string; hash: string } | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const hash = useHash();
  const scrolled = useIsScrolled();

  const hashTab = tabs.some((tab) => tab.id === hash) ? hash : null;
  const activeId = (selection?.hash === hash ? selection.id : null) ?? hashTab ?? tabs[0].id;
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === activeId),
  );
  const active = tabs[activeIndex];

  const goToTab = useCallback(
    (index: number) => {
      const next = tabs[index];
      if (!next || next.id === activeId) return;
      setDirection(index > activeIndex ? 1 : -1);
      setSelection({ id: next.id, hash });
      // 前のタブでの読み位置を引きずらないよう先頭へ戻す
      window.scrollTo({ top: 0, behavior: "instant" });
      // pushState だと戻るボタンがタブ切り替えの履歴で埋まるので replace。
      // replaceState は hashchange を起こさないので上の hash は据え置きのままでよい
      window.history.replaceState(null, "", `#${next.id}`);
    },
    [tabs, activeId, activeIndex, hash],
  );

  // ── スワイプでタブを切り替える ────────────────────────────────────
  // preventDefault は一切しない。縦スクロールを邪魔せず、
  // 「横方向だと判定できたときだけ」指を離した時点で切り替える。
  const touch = useRef<{ x: number; y: number; axis: "undecided" | "x" | "y" } | null>(null);

  const onTouchStart = (event: React.TouchEvent) => {
    const target = event.target as HTMLElement | null;
    // タブバーやジャンプボタンの列は自分で横スクロールするので対象外
    if (event.touches.length !== 1 || target?.closest("[data-swipe-ignore]")) {
      touch.current = null;
      return;
    }
    touch.current = { x: event.touches[0].clientX, y: event.touches[0].clientY, axis: "undecided" };
  };

  const onTouchMove = (event: React.TouchEvent) => {
    const start = touch.current;
    if (!start || start.axis !== "undecided" || event.touches.length !== 1) return;
    const dx = event.touches[0].clientX - start.x;
    const dy = event.touches[0].clientY - start.y;
    if (Math.hypot(dx, dy) < 12) return; // まだ方向を決めるには早い
    // 縦優先で判定する。斜めの指の動きで勝手にタブが変わるのが一番うるさい
    start.axis = Math.abs(dx) > Math.abs(dy) * 1.4 ? "x" : "y";
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || start.axis !== "x") return;
    const dx = event.changedTouches[0].clientX - start.x;
    if (Math.abs(dx) < 60) return;
    goToTab(activeIndex + (dx < 0 ? 1 : -1));
  };

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {/* タブバーは常に見えるところに固定する。アプリの下タブに近い操作感になる */}
      <div
        data-swipe-ignore
        className="bg-background/85 sticky top-0 z-30 -mx-2 mb-3 border-b backdrop-blur sm:-mx-6 lg:-mx-8"
      >
        <div
          role="tablist"
          aria-label="カテゴリ"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") goToTab(activeIndex + 1);
            if (event.key === "ArrowLeft") goToTab(activeIndex - 1);
          }}
          className="scrollbar-none mx-auto flex max-w-7xl gap-0.5 overflow-x-auto px-1 sm:px-4 lg:px-6"
        >
          {tabs.map((tab, index) => {
            const isActive = tab.id === activeId;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${tab.id}`}
                tabIndex={isActive ? 0 : -1}
                onClick={() => goToTab(index)}
                className={cn(
                  "relative shrink-0 px-2.5 py-3 text-sm font-medium whitespace-nowrap transition-colors sm:px-4",
                  isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.label}
                <span
                  aria-hidden
                  className={cn(
                    "bg-primary absolute inset-x-1.5 -bottom-px h-0.5 rounded-full transition-opacity sm:inset-x-3",
                    isActive ? "opacity-100" : "opacity-0",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div
        role="tabpanel"
        id={`panel-${active.id}`}
        aria-labelledby={`tab-${active.id}`}
        // key を変えて毎回マウントし直すことで、切り替え方向のアニメーションが付く
        key={active.id}
        className={cn(
          "animate-in fade-in duration-200",
          direction === 1 ? "slide-in-from-right-6" : "slide-in-from-left-6",
        )}
      >
        {active.anchors.length > 1 ? <AnchorNav anchors={active.anchors} /> : null}
        {active.content}
      </div>

      {scrolled ? <BackToTop /> : null}
    </div>
  );
}

/** タブ先頭のジャンプボタン列。目的の情報源まで一気に飛ぶ */
function AnchorNav({ anchors }: { anchors: TabAnchor[] }) {
  return (
    <nav
      data-swipe-ignore
      aria-label="このタブの情報源"
      className="scrollbar-none -mx-2 mb-4 flex gap-1.5 overflow-x-auto px-2 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
    >
      {anchors.map((anchor) => (
        <button
          key={anchor.id}
          type="button"
          onClick={() => {
            document.getElementById(anchor.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
          className="bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground inline-flex shrink-0 items-center gap-0.5 rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors"
        >
          {anchor.label}
          <ChevronRight className="size-3 opacity-60" />
        </button>
      ))}
    </nav>
  );
}

function BackToTop() {
  return (
    <button
      type="button"
      aria-label="先頭へ戻る"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      // 下端は端末のジェスチャーバーと重なるので safe-area ぶん持ち上げる
      className="bg-primary text-primary-foreground fixed right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-40 flex size-10 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95"
    >
      <ArrowUp className="size-4" />
    </button>
  );
}

/** セクション側に付ける目印。タブバーに隠れない位置で止まるようにする */
export function AnchorTarget({
  id,
  className,
  children,
}: {
  id: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className={cn(SCROLL_MARGIN, className)}>
      {children}
    </div>
  );
}
