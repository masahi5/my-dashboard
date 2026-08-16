"use client";

/**
 * X 公式ウィジェット（platform.twitter.com/widgets.js）の読み込みと生成。
 *
 * ここが引き受けている厄介ごと:
 *   1. script は「アプリ全体で1本だけ」。ウィジェットの数だけ <script> を足すと
 *      二重初期化で描画が壊れるので、Promise を使い回す。
 *   2. **同時に作らない。** 12アカウント分を一斉に生成すると
 *      syndication.twitter.com が 429 を返し、全部が無言で空になる（実測）。
 *      1件ずつ、描き終わってから次を作る。
 *   3. `createTimeline` の Promise は「iframe を挿入した時点」で解決してしまい、
 *      中身が取れたかどうかを教えてくれない。**描画の成否は iframe の高さで見る**。
 *      429 で空振りしたときは高さ 0 のまま変わらない。
 */

type TimelineSource = { sourceType: "profile"; screenName: string };

export type TimelineOptions = {
  tweetLimit?: number;
  theme?: "light" | "dark";
  chrome?: string;
  lang?: string;
  dnt?: boolean;
};

type TwitterWidgets = {
  createTimeline: (
    source: TimelineSource,
    target: HTMLElement,
    options?: TimelineOptions,
  ) => Promise<HTMLElement | undefined>;
};

type Twttr = {
  widgets: TwitterWidgets;
  /** widgets.js の初期化完了コールバック */
  ready?: (callback: (twttr: Twttr) => void) => void;
};

declare global {
  interface Window {
    twttr?: Twttr;
  }
}

const SCRIPT_SRC = "https://platform.twitter.com/widgets.js";

/** 1件描き終えてから次を始めるまでの間隔 */
const GAP_MS = 500;
/** 1件あたりの待ち時間の上限。429 のときは何も起きないまま黙って終わる */
const RENDER_TIMEOUT_MS = 12_000;
/** 空振りしたときに置く間隔（レート制限の解除を待つ） */
const RETRY_DELAY_MS = 3_000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** iframe の高さが付いた＝中身が描けた、と判定する */
export function isTimelineRendered(slot: HTMLElement): boolean {
  return (slot.querySelector("iframe")?.clientHeight ?? 0) > 0;
}

let scriptPromise: Promise<TwitterWidgets> | null = null;

function loadXWidgets(): Promise<TwitterWidgets> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TwitterWidgets>((resolve, reject) => {
    const ready = (twttr: Twttr) => {
      if (twttr.ready) twttr.ready((loaded) => resolve(loaded.widgets));
      else resolve(twttr.widgets);
    };

    if (window.twttr?.widgets) {
      ready(window.twttr);
      return;
    }

    const script = document.createElement("script");
    script.addEventListener("load", () => {
      if (window.twttr) ready(window.twttr);
      else reject(new Error("widgets.js を読み込みましたが twttr がありません"));
    });
    // 広告ブロッカーやトラッキング防止機能に阻まれるのは日常茶飯事。
    // ここで reject し、呼び出し側はプロフィールへのリンクに切り替える。
    script.addEventListener("error", () => reject(new Error("widgets.js の読み込みに失敗しました")));
    script.src = SCRIPT_SRC;
    script.async = true;
    document.head.appendChild(script);
  });

  return scriptPromise;
}

/** タブが裏に回っている間は何もしない（裏では iframe が描画されず待つだけ無駄） */
function waitUntilVisible(): Promise<void> {
  if (!document.hidden) return Promise.resolve();
  return new Promise((resolve) => {
    const onChange = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", onChange);
      resolve();
    };
    document.addEventListener("visibilitychange", onChange);
  });
}

/** slot の中の iframe に高さが付くまで待つ。付かなければ timeout で false */
function waitForRender(slot: HTMLElement): Promise<boolean> {
  if (isTimelineRendered(slot)) return Promise.resolve(true);

  return new Promise((resolve) => {
    const finish = (rendered: boolean) => {
      clearTimeout(timer);
      observer.disconnect();
      resolve(rendered);
    };
    // ウィジェットは自分の高さを親へ伝えて iframe を伸ばす。その変化を捉える
    const observer = new ResizeObserver(() => {
      if (isTimelineRendered(slot)) finish(true);
    });
    observer.observe(slot);
    const timer = setTimeout(() => finish(isTimelineRendered(slot)), RENDER_TIMEOUT_MS);
  });
}

// 生成を直列化するためのキュー。常に fulfilled にして次を止めない
let queue: Promise<unknown> = Promise.resolve();

/**
 * 連続で失敗したら以降は即あきらめる。
 *
 * X に締め出されている状態（レート制限・ブロッカー）では、待っても結果は同じ。
 * 律儀に1件ずつ待つと最後のカードが数分スケルトンのままになるので、
 * 早めに全部リンク表示へ倒したほうが読む側にとって親切。
 */
let consecutiveFailures = 0;
const FAILURE_LIMIT = 3;

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task);
  queue = result.then(
    () => delay(GAP_MS),
    () => delay(GAP_MS),
  );
  return result;
}

/**
 * 指定アカウントのタイムラインを slot の中に描く。順番待ちのうえで実行される。
 *
 * @returns 描けたら true。空振り（レート制限・ブロック・非公開など）なら false
 */
export function renderXTimeline(
  screenName: string,
  slot: HTMLElement,
  options: TimelineOptions,
): Promise<boolean> {
  const attempt = async (widgets: TwitterWidgets) => {
    // 前回の残骸が残っていると二重に見えるので必ず空にしてから作る
    slot.replaceChildren();
    await widgets.createTimeline({ sourceType: "profile", screenName }, slot, options);
    return waitForRender(slot);
  };

  return enqueue(async () => {
    if (consecutiveFailures >= FAILURE_LIMIT) return false;

    await waitUntilVisible();
    const widgets = await loadXWidgets();

    let rendered = await attempt(widgets);
    if (!rendered) {
      // 混み合っただけのことが多いので、間を置いて1回だけやり直す
      await delay(RETRY_DELAY_MS);
      rendered = await attempt(widgets);
    }

    consecutiveFailures = rendered ? 0 : consecutiveFailures + 1;
    return rendered;
  }).catch(() => {
    consecutiveFailures += 1;
    return false;
  });
}
