/* The outbox: everything the game sends goes through here, so it reaches the server on a weak or missing signal.

   - Kept on the phone (localStorage `lima-outbox`) until the server takes it, so nothing is lost when the signal drops,
     the request times out, or the game is closed: it is sent on the next opening.
   - Batched: events (src/first/track.ts) are not sent one request each. They wait in the outbox and go together, up to
     50 in one request (one round trip, one set of headers): every 30 s while the game is open (2 minutes on Data
     saver), at once when the phone comes back online, and when the game is hidden or closed (with sendBeacon, which
     the browser delivers after the page has gone).
   - Patient: a failed send waits before trying again, longer each time (5 s, 10 s, 20 s… up to 10 minutes), so a
     phone on a bad link is not kept busy retrying. Nothing is tried while the phone is offline.
   - Bounded: at most 500 events wait (the oldest go first); a form (a partner application) is never dropped.
   Batch body: a JSON array of the items, e.g. [{"name":"walk_start","at":…}, …]. A form is sent alone, as its own
   JSON object, and its sender hears when it has gone (onSent). */

import { fetchWithTimeout, lowData, online } from './connection';

export interface OutItem {
  id: string;
  url: string;
  /** 'batch': joins others for the same address into one JSON array; 'single': sent alone as its own JSON body */
  mode: 'batch' | 'single';
  body: unknown;
  /** when it was queued (ms since epoch) */
  at: number;
}

const KEY = 'lima-outbox';
const MAX_BATCH = 50;
const MAX_EVENTS = 500;
/** sendBeacon refuses bodies over 64 KB; stay well under */
const MAX_BEACON = 48_000;

let mem: OutItem[] | null = null;
function load(): OutItem[] {
  if (mem) return mem;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    mem = Array.isArray(raw) ? raw : [];
  } catch {
    mem = [];
  }
  return mem;
}
function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(mem ?? []));
  } catch {
    /* storage full or blocked: the copy in memory is still sent this visit */
  }
}

/** What is waiting to be sent. */
export const pending = (): readonly OutItem[] => load();

const sentListeners = new Map<string, Set<() => void>>();
/** Hear when one item (by id) has reached the server. */
export function onSent(id: string, fn: () => void): () => void {
  if (!load().some(i => i.id === id)) {
    fn();
    return () => {};
  }
  const set = sentListeners.get(id) ?? new Set();
  set.add(fn);
  sentListeners.set(id, set);
  return () => set.delete(fn);
}

function drop(ids: Set<string>) {
  mem = load().filter(i => !ids.has(i.id));
  save();
  ids.forEach(id => {
    sentListeners.get(id)?.forEach(fn => fn());
    sentListeners.delete(id);
  });
}

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** Put something in the outbox. A 'single' item is sent at once (if there is a signal); batched items wait for the next batch. Returns its id. */
export function enqueue(url: string, body: unknown, mode: OutItem['mode'] = 'batch'): string {
  const item: OutItem = { id: newId(), url, mode, body, at: Date.now() };
  let list = [...load(), item];
  const batched = list.filter(i => i.mode === 'batch');
  if (batched.length > MAX_EVENTS) {
    const over = new Set(batched.slice(0, batched.length - MAX_EVENTS).map(i => i.id));
    list = list.filter(i => !over.has(i.id));
  }
  mem = list;
  save();
  start();
  if (mode === 'single') void flush();
  return item.id;
}

/* ---------------- sending ---------------- */

let failures = 0;
let waitUntil = 0;
let busy: Promise<void> | null = null;

/** The next requests to make: each single item alone, and batched items grouped by address (up to 50 a request). */
function groups(list: readonly OutItem[]): OutItem[][] {
  const out: OutItem[][] = [];
  const byUrl = new Map<string, OutItem[]>();
  for (const i of list) {
    if (i.mode === 'single') out.push([i]);
    else {
      const g = byUrl.get(i.url) ?? [];
      g.push(i);
      byUrl.set(i.url, g);
    }
  }
  for (const g of byUrl.values()) for (let k = 0; k < g.length; k += MAX_BATCH) out.push(g.slice(k, k + MAX_BATCH));
  // forms first: a person is waiting on them
  return out.sort((a, b) => (a[0].mode === 'single' ? 0 : 1) - (b[0].mode === 'single' ? 0 : 1));
}

const bodyOf = (g: OutItem[]) => JSON.stringify(g[0].mode === 'single' ? g[0].body : g.map(i => i.body));

/** Send what is waiting now (skipped while offline or while waiting after a failure, unless `force`). */
export function flush(force = false): Promise<void> {
  if (busy) return busy;
  if (!online() || (!force && Date.now() < waitUntil) || load().length === 0) return Promise.resolve();
  busy = (async () => {
    try {
      for (const g of groups(load())) {
        let ok = false;
        try {
          const r = await fetchWithTimeout(g[0].url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bodyOf(g), keepalive: true }, 20_000);
          // a 4xx other than 408/429 will never succeed: drop it rather than retry forever
          ok = r.ok || (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429);
        } catch {
          ok = false;
        }
        if (!ok) {
          failures++;
          waitUntil = Date.now() + Math.min(600_000, 5_000 * 2 ** (failures - 1));
          return;
        }
        failures = 0;
        waitUntil = 0;
        drop(new Set(g.map(i => i.id)));
      }
    } finally {
      busy = null;
    }
  })();
  return busy;
}

/** The game is being hidden or closed: hand the batches to sendBeacon, which the browser delivers after the page has gone. */
function beaconAll() {
  if (!online() || typeof navigator.sendBeacon !== 'function') return;
  const sent = new Set<string>();
  for (const g of groups(load())) {
    let part = g;
    // keep each beacon under the browser's size limit
    while (part.length > 1 && bodyOf(part).length > MAX_BEACON) part = part.slice(0, Math.ceil(part.length / 2));
    try {
      const blob = new Blob([bodyOf(part)], { type: 'application/json' });
      if (navigator.sendBeacon(part[0].url, blob)) part.forEach(i => sent.add(i.id));
    } catch {
      /* not sent: kept for the next opening */
    }
  }
  if (sent.size) drop(sent);
}

let started = false;
function start() {
  if (started || typeof window === 'undefined') return;
  started = true;
  const tick = () => {
    window.setTimeout(() => {
      if (document.visibilityState === 'visible') void flush();
      tick();
    }, lowData() ? 120_000 : 30_000);
  };
  tick();
  window.addEventListener('online', () => {
    failures = 0;
    waitUntil = 0;
    void flush(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') beaconAll();
  });
  window.addEventListener('pagehide', beaconAll);
}

/** Start sending what an earlier visit left in the outbox (App calls it once the game is up). */
export function startOutbox() {
  if (load().length === 0) return;
  start();
  window.setTimeout(() => void flush(), 3_000);
}
