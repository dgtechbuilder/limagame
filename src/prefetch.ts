import { createElement, lazy, useState, type ComponentType } from 'react';
import { img } from './assets';

/* Every activity's code (and the pictures its screens open on) is fetched ahead of time, once the farm is up and the
   phone is idle, so tapping into one starts it at once instead of waiting on the network behind a green screen.
   Each activity is declared with lazyPage() (App.tsx, world/World.tsx): until its code has arrived it shows the
   loading card (components/ActivityLoading.tsx) as a lazy() screen would; once it is here it is drawn straight away,
   with no loading card in between at all. The files of a wave download side by side, so a slow connection waits
   about one round trip a wave, not one a file: wave 0 is the farm's own activities (the shed, the Train spot, the
   sprayer, the tractor), wave 1 the rest. */

type Wave = 0 | 1;
const WAVES: (() => Promise<unknown>)[][] = [[], []];

/** A screen loaded when first needed, or ahead of time by prefetchActivities(). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyPage<P extends Record<string, any>>(load: () => Promise<ComponentType<P>>, wave: Wave): ComponentType<P> {
  let ready: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;
  const get = () =>
    (pending ??= load().then(
      c => (ready = c),
      e => {
        pending = null; // a failed fetch (offline for a moment) is tried again when the screen is opened
        throw e;
      },
    ));
  const Lazy = lazy(() => get().then(c => ({ default: c })));
  WAVES[wave].push(get);
  // chosen once per opening: switching from the lazy one to the loaded one while open would start the screen over
  const Page = (props: P) => {
    const [C] = useState<ComponentType<P>>(() => ready ?? (Lazy as unknown as ComponentType<P>));
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
  [(window.devicePixelRatio || 1) > 1 ? img.bg2x : img.bg, img.plank].forEach(src => {
    const p = new Image();
    p.decoding = 'async';
    p.src = src;
  });
  let i = 0;
  const next = () => {
    const wave = WAVES[i++];
    if (!wave) return;
    idle(() => void Promise.allSettled(wave.map(load => load().catch(() => undefined))).then(next));
  };
  next();
}
