/* The page's side of the service worker (public/sw.js): register it, ask how much of the game is kept on the phone,
   and ask it to keep the rest, so the whole game plays with no signal at all.
   - On a normal connection the rest of the game's code and pictures are kept by themselves, a little after the farm
     opens (App.tsx calls warmGame() once the activities are fetched).
   - On Data saver nothing more is downloaded by itself: Settings → Display → Play offline has a button that keeps the
     whole game (with the light copy of the crop photos), for a player who can reach Wi-Fi now and then. */

import { lowData } from './connection';

export interface KeptStatus {
  build: string | null;
  game?: { kept: number; total: number };
  photos?: { kept: number; total: number };
  lite?: { kept: number; total: number };
}
export interface WarmProgress {
  done: number;
  total: number;
  finished: boolean;
}

const supported = () => import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

/** Register the service worker (the published game only, never in development or design review). */
export function registerServiceWorker() {
  if (!supported()) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* not available (private mode, an old browser): the game works without it */
    });
  });
}

const progressListeners = new Set<(p: WarmProgress, s?: KeptStatus) => void>();
let listening = false;
function listen() {
  if (listening || !supported()) return;
  listening = true;
  navigator.serviceWorker.addEventListener('message', e => {
    const d = e.data ?? {};
    if (d.type === 'lima-warm') progressListeners.forEach(fn => fn({ done: d.done, total: d.total, finished: false }));
    if (d.type === 'lima-warm-done') progressListeners.forEach(fn => fn({ done: 1, total: 1, finished: true }, d as KeptStatus));
  });
}

async function worker(): Promise<ServiceWorker | null> {
  if (!supported()) return null;
  try {
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise<null>(r => window.setTimeout(() => r(null), 4000))]);
    return reg?.active ?? null;
  } catch {
    return null;
  }
}

/** How much of the game is kept on the phone (null: no service worker here, e.g. in development). */
export async function keptStatus(): Promise<KeptStatus | null> {
  const w = await worker();
  if (!w) return null;
  listen();
  return new Promise(resolve => {
    const on = (e: MessageEvent) => {
      if (e.data?.type !== 'lima-status') return;
      navigator.serviceWorker.removeEventListener('message', on);
      resolve(e.data as KeptStatus);
    };
    navigator.serviceWorker.addEventListener('message', on);
    w.postMessage({ type: 'status' });
    window.setTimeout(() => resolve(null), 6000);
  });
}

/** Hear the progress of a download for offline. */
export function onWarm(fn: (p: WarmProgress, s?: KeptStatus) => void): () => void {
  listen();
  progressListeners.add(fn);
  return () => progressListeners.delete(fn);
}

/** Keep the rest of the game on the phone. `photos`: also the crop photos (the light copies on Data saver). */
export async function warmGame(opts: { photos?: boolean } = {}): Promise<boolean> {
  const w = await worker();
  if (!w) return false;
  listen();
  const sharp = (window.devicePixelRatio || 1) > 1;
  w.postMessage({ type: 'warm', hires: sharp && !lowData(), photos: opts.photos ? (lowData() ? 'lite' : 'full') : undefined });
  return true;
}
