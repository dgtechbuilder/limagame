/* Event log for the first session, so drop-off between moments can be measured.
   Events are kept on the device (last 300) and, if VITE_EVENTS_URL is set at build time, sent there in batches
   through the outbox (src/net/outbox.ts), which keeps them through a weak or missing signal. */

import { enqueue } from '../net/outbox';

export interface LimaEvent {
  name: string;
  at: number; // ms since epoch
  ms: number; // ms since this player's first event
  [k: string]: unknown;
}

const KEY = 'lima-events';
const URL_: string | undefined = (import.meta as { env?: { VITE_EVENTS_URL?: string } }).env?.VITE_EVENTS_URL;
const reviewing = () => {
  const q = new URLSearchParams(window.location.search);
  return q.has('review') || q.has('screen');
};

export function events(): LimaEvent[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

/** Other listeners on the same moments (src/analytics hears a skipped story this way). */
export const trackListeners: ((name: string, data: Record<string, unknown>) => void)[] = [];

/** The player's cohort / programme tags (src/evidence), added to every event; App keeps them current. */
export const trackContext: { tags: string[] } = { tags: [] };

export function track(name: string, data: Record<string, unknown> = {}) {
  // no browser (the reducer played in a test): nothing to keep
  if (typeof window === 'undefined' || reviewing()) return;
  trackListeners.forEach(f => f(name, data));
  const list = events();
  const at = Date.now();
  const e: LimaEvent = { name, at, ms: list.length ? at - list[0].at : 0, ...data, ...(trackContext.tags.length ? { tags: trackContext.tags } : {}) };
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...list, e].slice(-300)));
  } catch {
    /* storage blocked: still try to send */
  }
  if (URL_) enqueue(URL_, e, 'batch');
}

export function clearEvents() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
