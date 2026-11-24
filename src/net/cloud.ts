/* Cloud save: a copy of the player's progress in Supabase (the "Mela Press" project), table public.temolima_saves.

   The phone stays the source of truth: the game saves to localStorage first (src/state.ts) and plays with no signal at
   all. This module keeps a copy in the cloud, quietly, when there is a signal:
   - Who: players have no accounts. On first use the phone makes a random player id and a secret key (localStorage
     `lima-cloud-id`). The database keeps only a hash of the key, and its two functions (temolima_save, temolima_load)
     refuse a different key, so nobody can read or overwrite another player's save. The table itself is closed to the
     public; the publishable key below can only call those two functions.
   - When: only the latest state is sent, at most once a minute while playing (every 5 minutes on Data saver), at once
     when the phone comes back online, and when the game is hidden or closed. A save that fails waits and tries again
     later; nothing piles up, since a newer state replaces the one waiting.
   - Where: on by default in the published game. In development and the play-tests it is off unless VITE_SUPABASE_URL
     and VITE_SUPABASE_KEY are set, so tests never write to the real database. VITE_CLOUD_SAVE=off turns it off. */

import { fetchWithTimeout, lowData, online } from './connection';

const env = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** The Mela Press project. The publishable key is meant to be public (it only reaches what the database allows). */
const DEFAULT_URL = 'https://nxjwjklugmwnrlngzrub.supabase.co';
const DEFAULT_KEY = 'sb_publishable_zV6LWeLUBEDvxO9V_ifnOQ_jvbnx6bi';

const URL_ = str(env.VITE_SUPABASE_URL) ?? (env.PROD ? DEFAULT_URL : undefined);
const KEY_ = str(env.VITE_SUPABASE_KEY) ?? (env.PROD ? DEFAULT_KEY : undefined);
const OFF = str(env.VITE_CLOUD_SAVE) === 'off';

const ID_KEY = 'lima-cloud-id';
/** fetch keepalive (used while the page closes) refuses bodies over 64 KB */
const MAX_KEEPALIVE = 60_000;

const reviewing = () => {
  const q = new URLSearchParams(window.location.search);
  return q.has('review') || q.has('screen');
};

/** Is cloud saving on for this build and this page? */
export const cloudEnabled = () => !OFF && !!URL_ && !!KEY_ && typeof window !== 'undefined' && !reviewing();

interface Identity {
  id: string;
  key: string;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let ident: Identity | null = null;
/** This phone's player id and secret key, made on first use. */
function identity(): Identity | null {
  if (ident) return ident;
  try {
    const raw = JSON.parse(window.localStorage.getItem(ID_KEY) ?? 'null');
    if (raw && typeof raw.id === 'string' && typeof raw.key === 'string' && raw.key.length >= 32) return (ident = raw);
    const made: Identity = { id: uuid(), key: hex(crypto.getRandomValues(new Uint8Array(32))) };
    window.localStorage.setItem(ID_KEY, JSON.stringify(made));
    return (ident = made);
  } catch {
    // no storage or no crypto: a key we cannot keep would lock the player out of their own row, so do not save
    return null;
  }
}

/** The player id this phone saves under (for support: "which save is mine?"). */
export const cloudPlayerId = () => (cloudEnabled() ? identity()?.id ?? null : null);

const rpc = (fn: string, body: unknown, keepalive = false) => {
  const text = JSON.stringify(body);
  return fetchWithTimeout(
    `${URL_}/rest/v1/rpc/${fn}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY_!, ...(KEY_!.startsWith('ey') ? { Authorization: `Bearer ${KEY_}` } : {}) },
      body: text,
      keepalive: keepalive && text.length < MAX_KEEPALIVE,
    },
    20_000,
  );
};

/* ---------------- saving ---------------- */

/** the latest state not yet in the cloud, and when it was saved on the phone */
let waiting: { state: unknown; at: string } | null = null;
let busy = false;
let failures = 0;
let waitUntil = 0;
let lastSent = 0;
let timer: number | undefined;

const gap = () => (lowData() ? 300_000 : 60_000);

async function send(keepalive = false): Promise<void> {
  if (busy || !waiting || !online()) return;
  const me = identity();
  if (!me) return;
  const item = waiting;
  waiting = null;
  busy = true;
  lastSent = Date.now();
  try {
    const r = await rpc('temolima_save', { p_player: me.id, p_key: me.key, p_state: item.state, p_saved_at: item.at }, keepalive);
    if (r.ok) {
      failures = 0;
      waitUntil = 0;
      return;
    }
    // 4xx (other than timeouts and rate limits) will never succeed for this state: drop it, the next save tries anew
    if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) return;
    throw new Error(String(r.status));
  } catch {
    if (!waiting) waiting = item;
    failures++;
    waitUntil = Date.now() + Math.min(600_000, 10_000 * 2 ** (failures - 1));
  } finally {
    busy = false;
  }
}

function schedule() {
  window.clearTimeout(timer);
  if (!waiting) return;
  const due = Math.max(lastSent + gap(), waitUntil) - Date.now();
  timer = window.setTimeout(() => {
    void send().then(schedule);
  }, Math.max(1_000, due));
}

let started = false;
function start() {
  if (started) return;
  started = true;
  window.addEventListener('online', () => {
    failures = 0;
    waitUntil = 0;
    void send().then(schedule);
  });
}

/** The game was just saved on the phone: keep this state to send to the cloud (only the latest one is ever sent). */
export function cloudSave(state: unknown) {
  if (!cloudEnabled()) return;
  start();
  waiting = { state, at: new Date().toISOString() };
  schedule();
}

/** The game is being hidden or closed: send what is waiting now (the browser finishes small requests after the page has gone). */
export function cloudFlush() {
  if (!cloudEnabled() || !waiting) return;
  window.clearTimeout(timer);
  void send(true).then(schedule);
}

/* ---------------- restoring ---------------- */

/** The progress this player saved to the cloud, or null (none, wrong key, no signal, or cloud saving off). */
export async function cloudLoad(): Promise<{ state: Record<string, unknown>; savedAt: string } | null> {
  const me = cloudEnabled() ? identity() : null;
  if (!me || !online()) return null;
  try {
    const r = await rpc('temolima_load', { p_player: me.id, p_key: me.key });
    if (!r.ok) return null;
    const out = await r.json();
    return out && typeof out.state === 'object' ? { state: out.state, savedAt: out.saved_at } : null;
  } catch {
    return null;
  }
}
