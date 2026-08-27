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
/**
 * 1件あたりの待ち時間の上限。429 のときは何も起きないまま黙って終わる。
 *
 * この時間が計り始めるのは createTimeline を呼んだ後なので、widgets.js の
 * ダウンロードは含まない。実測では成功時 1〜3 秒で高さが付く。
 */
const RENDER_TIMEOUT_MS = 8_000;
/**
 * widgets.js 自体の待ち時間の上限。
 *
 * load も error も飛んでこないまま黙り込むこと（間に挟まったプロキシや
 * フィルタが握り潰す）があり、そうなると **全カードが永久にスケルトンのまま**
 * になる。ここで打ち切って全部リンク表示へ倒す。
 */
const SCRIPT_TIMEOUT_MS = 15_000;

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** iframe の高さが付いた＝中身が描けた、と判定する */
export function isTimelineRendered(slot: HTMLElement): boolean {
  return (slot.querySelector("iframe")?.clientHeight ?? 0) > 0;
}

let scriptPromise: Promise<TwitterWidgets> | null = null;

function loadXWidgets(): Promise<TwitterWidgets> {
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TwitterWidgets>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("widgets.js が時間内に応答しませんでした")),
      SCRIPT_TIMEOUT_MS,
    );
    const settle = {
      ok: (widgets: TwitterWidgets) => {
        clearTimeout(timer);
        resolve(widgets);
      },
      ng: (message: string) => {
        clearTimeout(timer);
        reject(new Error(message));
      },
    };

    const ready = (twttr: Twttr) => {
      if (twttr.ready) twttr.ready((loaded) => settle.ok(loaded.widgets));
      else settle.ok(twttr.widgets);
    };

    if (window.twttr?.widgets) {
      ready(window.twttr);
      return;
    }

    const script = document.createElement("script");
    script.addEventListener("load", () => {
      if (window.twttr) ready(window.twttr);
      else settle.ng("widgets.js を読み込みましたが twttr がありません");
    });
    // 広告ブロッカーやトラッキング防止機能に阻まれるのは日常茶飯事。
    // ここで reject し、呼び出し側はプロフィールへのリンクに切り替える。
    script.addEventListener("error", () => settle.ng("widgets.js の読み込みに失敗しました"));
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
 * X に締め出されている状態（syndication.twitter.com が 429 を返す）では、
 * 待っても再試行しても結果は同じ。律儀に1件ずつ待つと後ろのカードが
 * 数分スケルトンのままになるので、早めに全部リンク表示へ倒したほうが親切。
 *
 * 2 にしているのは「1アカウントだけ非公開・改名で落ちた」ケースを
 * 全滅と取り違えないため。締め出しなら 2件目で判明し、約17秒で全カードが
 * リンク表示に切り替わる。
 */
let consecutiveFailures = 0;
const FAILURE_LIMIT = 2;

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
  const attempt = async (): Promise<boolean> => {
    await waitUntilVisible();
    const widgets = await loadXWidgets();

    // 前回の残骸が残っていると二重に見えるので必ず空にしてから作る
    slot.replaceChildren();
    await widgets.createTimeline({ sourceType: "profile", screenName }, slot, options);
    // ここで再試行はしない。空振りの理由はほぼ 429 で、間を置いても結果は同じ。
    // 待っている間ずっとスケルトンが居座り、後続のカードまで止めてしまう。
    const rendered = await waitForRender(slot);

    consecutiveFailures = rendered ? 0 : consecutiveFailures + 1;
    return rendered;
  };

  // `created` は「実際にウィジェットを作ったか」。見送った回は X に触れていないので、
  // 次を始めるまでの間隔を置く必要がない。ここを詰めないと、締め出しが確定した後も
  // 残りのカードが 0.5 秒刻みでしか切り替わらない。
  const result: Promise<{ rendered: boolean; created: boolean }> = queue.then(async () => {
    if (consecutiveFailures >= FAILURE_LIMIT) return { rendered: false, created: false };
    try {
      return { rendered: await attempt(), created: true };
    } catch {
      consecutiveFailures += 1;
      return { rendered: false, created: true };
    }
  });

  // result は必ず fulfilled になるが、キューは何があっても止めない
  queue = result.then(
    ({ created }) => (created ? delay(GAP_MS) : undefined),
    () => delay(GAP_MS),
  );
  return result.then(({ rendered }) => rendered);
}
