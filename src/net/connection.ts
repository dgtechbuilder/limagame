/* The phone's connection, as far as the browser can tell, and the player's Data saver choice.

   Players in remote places often have a weak, slow or metered signal, or none for hours. The game itself runs entirely
   on the phone (progress is saved there, src/state.ts), so the network is only needed to download the game's files
   and to send the few messages it sends (src/net/outbox.ts). This module answers two questions for the rest of the
   game:
   - online(): is there a connection at all right now (navigator.onLine, kept current by the online/offline events)?
   - lowData(): should the game spend as little data as it can? Yes when the player turned Data saver on (Settings →
     Display), or, on Auto, when the phone asks to save data (Android's Data Saver, Chrome's Lite mode) or reports a
     2G-speed link (the Network Information API, Chrome and Android only; other browsers count as a normal link).
   Data saver: 1× pictures instead of 2×, the lighter copy of the crop photos, only the farm's own activities fetched
   ahead of time (the rest when opened), and messages sent in fewer, larger batches. */

export type DataPref = 'auto' | 'on' | 'off';

interface NetInfo {
  saveData?: boolean;
  effectiveType?: string;
  rtt?: number;
  downlink?: number;
  addEventListener?: (type: 'change', fn: () => void) => void;
}

const info = (): NetInfo | undefined =>
  typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { connection?: NetInfo }).connection;

let pref: DataPref = 'auto';
const listeners = new Set<() => void>();
const changed = () => listeners.forEach(fn => fn());

/** The player's Data saver setting; App keeps it current. */
export function setDataPref(p: DataPref | undefined) {
  const next = p ?? 'auto';
  if (next === pref) return;
  pref = next;
  changed();
}

/** Is there a connection at all? (true when the browser cannot tell) */
export const online = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** The phone itself reports a link too slow or too costly to spend data on. */
export function slowLink(): boolean {
  const c = info();
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === 'slow-2g' || c.effectiveType === '2g';
}

/** Spend as little data as possible: Data saver on, or Auto on a phone asking to save data or on a 2G-speed link. */
export const lowData = () => pref === 'on' || (pref === 'auto' && slowLink());

/** A short description of the connection, for Settings. */
export function linkLabel(): string {
  if (!online()) return 'Offline';
  const c = info();
  if (!c?.effectiveType) return 'Online';
  const kind = { 'slow-2g': 'very slow (2G)', '2g': 'slow (2G)', '3g': '3G speed', '4g': 'fast' }[c.effectiveType] ?? c.effectiveType;
  return `Online, ${kind}${c.saveData ? ', phone saving data' : ''}`;
}

/** Called when the connection, or the Data saver choice, changes. Returns the unsubscribe. */
export function onNetChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', changed);
  window.addEventListener('offline', changed);
  info()?.addEventListener?.('change', changed);
}

/** Wait until there is a connection again (at once if there is one). */
export function whenOnline(): Promise<void> {
  if (online()) return Promise.resolve();
  return new Promise(resolve => {
    const on = () => {
      window.removeEventListener('online', on);
      resolve();
    };
    window.addEventListener('online', on);
  });
}

/** fetch() that gives up after `ms` (a weak signal can leave a request hanging for minutes). */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 15_000): Promise<Response> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const id = ctl ? window.setTimeout(() => ctl.abort(), ms) : undefined;
  try {
    return await fetch(url, { ...init, signal: ctl?.signal });
  } finally {
    if (id !== undefined) window.clearTimeout(id);
  }
}
