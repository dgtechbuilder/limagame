/* Event log for the first session, so drop-off between moments can be measured.
   Events are kept on the device (last 300) and, if VITE_EVENTS_URL is set at build time,
   sent there with sendBeacon (fire-and-forget, survives closing the tab). */

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

export function track(name: string, data: Record<string, unknown> = {}) {
  if (reviewing()) return;
  const list = events();
  const at = Date.now();
  const e: LimaEvent = { name, at, ms: list.length ? at - list[0].at : 0, ...data };
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...list, e].slice(-300)));
  } catch {
    /* storage blocked: still try to send */
  }
  if (URL_ && navigator.sendBeacon) {
    try {
      navigator.sendBeacon(URL_, JSON.stringify(e));
    } catch {
      /* offline: the local copy is kept */
    }
  }
}

export function clearEvents() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
