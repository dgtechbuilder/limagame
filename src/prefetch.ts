import { createElement, lazy, useState, type ComponentType } from 'react';
import { img } from './assets';
import { lowData, online } from './net/connection';
import { warmGame } from './net/offline';

/* Every activity's code (and the pictures its screens open on) is fetched ahead of time, once the farm is up and the
   phone is idle, so tapping into one starts it at once instead of waiting on the network behind a green screen.
   Each activity is declared with lazyPage() (App.tsx, world/World.tsx): until its code has arrived it shows the
   loading card (components/ActivityLoading.tsx) as a lazy() screen would; once it is here it is drawn straight away,
   with no loading card in between at all. The files of a wave download side by side, so a slow connection waits
   about one round trip a wave, not one a file: wave 0 is the farm's own activities (the shed, the Train spot, the
   sprayer, the tractor), wave 1 the rest. On Data saver (src/net/connection.ts) only wave 0 is fetched ahead; the
   rest when opened.
   A download that fails on a weak signal is tried again by itself (after 1 s, then 3 s); if it still fails, or the
   phone is offline, the screen shows the "not downloaded yet" card (net/LoadGuard.tsx), which tries again when the
   signal is back.
   Chrome remembers a failed import() for as long as the page is open, so asking for the same file again fails at once
   without a request. A retry therefore asks for the file under a new address (the same file, with ?retry=N: the
   service worker and the server ignore it), read from the browser's error. If even that cannot work (the failed file
   was one the screen's code needs in turn), the card offers to open the game again (net/LoadGuard.tsx). */

const sleep = (ms: number) => new Promise(r => window.setTimeout(r, ms));

/** The file a failed import() names: Chrome "Failed to fetch dynamically imported module: URL", Firefox "error
    loading dynamically imported module: URL". Safari names none (it does not keep the failure either). */
export function failedUrl(e: unknown): string | null {
  const m = String((e as Error)?.message ?? e).match(/dynamically imported module:?\s*(\S+)/i);
  return m ? m[1] : null;
}

let retries = 0;
/** The same file, under a new address, so the browser fetches it again. */
const fresh = (url: string) => {
  const base = url.replace(/[?&]retry=\d+/g, '').replace(/\?$/, '');
  return import(/* @vite-ignore */ `${base}${base.includes('?') ? '&' : '?'}retry=${++retries}`);
};

/** A download tried up to three times while there is a signal (straight to the error when offline). `pick` takes
    what is wanted from the module, so a retry under a new address gives the same thing. */
export async function retrying<M, T>(load: () => Promise<M>, pick: (m: M) => T): Promise<T> {
  let err: unknown;
  let url: string | null = null;
  for (let i = 0; i < 3; i++) {
    if (i > 0) {
      if (!online()) break;
      await sleep(i === 1 ? 1_000 : 3_000);
    }
    try {
      return pick(url ? ((await fresh(url)) as M) : await load());
    } catch (e) {
      err = e;
      url = failedUrl(e) ?? url;
    }
  }
  throw err;
}

/** Each new attempt at screens that failed to download (net/LoadGuard.tsx calls newLoadAttempt). */
let loadEpoch = 0;
export const newLoadAttempt = () => void loadEpoch++;

type Wave = 0 | 1;
const WAVES: (() => Promise<unknown>)[][] = [[], []];

/** A screen loaded when first needed, or ahead of time by prefetchActivities(). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<M, P extends Record<string, any>>(load: () => Promise<M>, pick: (m: M) => ComponentType<P>, wave: Wave | null): ComponentType<P> {
  let ready: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  const get = () =>
    (pending ??= retrying(load, pick).then(
      c => (ready = c),
      e => {
        pending = null; // a failed fetch (offline for a moment) is tried again when the screen is opened
        throw e;
      },
    ));
  // React keeps a failed lazy() failed, and draws a screen that never appeared again with whatever it is handed: so a
  // lazy() that failed is replaced only for a new attempt (the card's Try again, or the signal coming back), never
  // within the same one, or the downloads would loop
  let failedEpoch = -1;
  const makeLazy = () => {
    const l = lazy(() =>
      get().then(
        c => ({ default: c }),
        e => {
          if (Lazy === l) failedEpoch = loadEpoch;
          throw e;
        },
      ),
    );
    return l;
  };
  let Lazy = makeLazy();
  const current = () => {
    if (failedEpoch >= 0 && failedEpoch !== loadEpoch) {
      Lazy = makeLazy();
      failedEpoch = -1;
    }
    return Lazy;
  };
  if (wave !== null) WAVES[wave].push(get);
  // chosen once per opening: switching from the lazy one to the loaded one while open would start the screen over
  const Page = (props: P) => {
    const [C] = useState<ComponentType<P>>(() => ready ?? (current() as unknown as ComponentType<P>));
    return createElement(C, props);
  };
  return Page;
}

let started = false;

const idle = (fn: () => void) => {
  const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
  if (w.requestIdleCallback) w.requestIdleCallback(fn, { timeout: 500 });
  else window.setTimeout(fn, 60);
};

/** Fetch every activity ahead of time (once per visit; call it after the farm world has loaded, so its screens are
    declared too). */
export function prefetchActivities() {
  if (started) return;
  started = true;
  // the farm picture behind the shed, Mission and the rounds, and their title plank
  [(window.devicePixelRatio || 1) > 1 && !lowData() ? img.bg2x : img.bg, img.plank].forEach(src => {
    const p = new Image();
    p.decoding = 'async';
    p.src = src;
  });
  let i = 0;
  const next = () => {
    // Data saver: only the farm's own activities ahead of time
    const wave = i > 0 && lowData() ? undefined : WAVES[i++];
    if (!wave) {
      // every activity is here: on a normal connection, the service worker keeps the rest of the game too (pictures
      // included), so it plays with no signal later
      if (!lowData()) idle(() => void warmGame());
      return;
    }
    idle(() => void Promise.allSettled(wave.map(load => load().catch(() => undefined))).then(next));
  };
  next();
}
