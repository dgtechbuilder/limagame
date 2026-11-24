/* Cloud save: the player's progress in Supabase (the "Mela Press" project), in several tables (see cloudRecords.ts).

   The phone stays the source of truth: the game saves to localStorage first (src/state.ts) and plays with no signal at
   all. This module keeps a copy in the cloud, quietly, when there is a signal:
   - Who: players have no accounts. On first use the phone makes a random player code, a UUID (localStorage
     `lima-cloud-id`). The code is the player's key to their farm: shown in Settings → Help & data, it opens the same
     farm on another phone (cloudRestore). It is 122 random bits, so it cannot be guessed; anyone who has it can open
     the farm, so the game tells the player to keep it to themselves. The tables are closed to the public; the
     publishable key below can only call the database's two functions (temolima_save, temolima_restore). Phones
     that saved before player codes keep their id: it becomes their player code.
   - What: the whole save (temolima_saves) and, worked out from it, the player, badges, certificates, learning,
     partner codes and rewards, each in its own table. Those lists go only when they have changed.
   - When: only the latest state is sent, at most once a minute while playing (every 5 minutes on Data saver), at once
     when the phone comes back online, and when the game is hidden or closed. A save that fails waits and tries again
     later; nothing piles up, since a newer state replaces the one waiting. With one code on two phones, the save made
     last wins (a save that arrives late, made before the one stored, is ignored).
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

const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A player code as typed or pasted (spaces, capitals and missing dashes forgiven), or null if it is not one. */
export function cleanCode(text: string): string | null {
  const h = text.toLowerCase().replace(/[^0-9a-f]/g, '');
  if (h.length !== 32) return null;
  const c = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  return UUID_RE.test(c) ? c : null;
}

let code: string | null = null;
/** This phone's player code, made on first use. */
function playerCode(): string | null {
  if (code) return code;
  try {
    const raw = JSON.parse(window.localStorage.getItem(ID_KEY) ?? 'null');
    if (raw && typeof raw.id === 'string' && UUID_RE.test(raw.id)) return (code = raw.id as string);
    const made = uuid();
    window.localStorage.setItem(ID_KEY, JSON.stringify({ id: made }));
    return (code = made);
  } catch {
    // no storage: a code we cannot keep would be lost on the next opening, so do not save
    return null;
  }
}

/** The player code this phone saves under: the key to this farm on any phone. */
export const cloudPlayerId = () => (cloudEnabled() ? playerCode() : null);

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

/** the latest state not yet in the cloud, its tables' lists (worked out when sent), and when it was saved on the phone */
let waiting: { state: unknown; records: () => unknown; at: string } | null = null;
/** the lists as last taken by the server: unchanged lists are not sent again */
let recordsSent = '';
let busy = false;
let failures = 0;
let waitUntil = 0;
let lastSent = 0;
let timer: number | undefined;

const gap = () => (lowData() ? 300_000 : 60_000);

async function send(keepalive = false): Promise<void> {
  if (busy || !waiting || !online()) return;
  const id = playerCode();
  if (!id) return;
  const item = waiting;
  waiting = null;
  busy = true;
  lastSent = Date.now();
  let records: string | null = null;
  try {
    records = JSON.stringify(item.records());
  } catch {
    records = null;
  }
  const fresh = records !== null && records !== recordsSent;
  try {
    const r = await rpc('temolima_save', { p_player: id, p_state: item.state, p_saved_at: item.at, p_records: fresh ? JSON.parse(records!) : null }, keepalive);
    if (r.ok) {
      failures = 0;
      waitUntil = 0;
      if (fresh) recordsSent = records!;
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

/** The game was just saved on the phone: keep this state to send to the cloud (only the latest one is ever sent).
    `records` works out its tables' lists, only when it is sent. */
export function cloudSave(state: unknown, records: () => unknown) {
  if (!cloudEnabled()) return;
  start();
  waiting = { state, records, at: new Date().toISOString() };
  schedule();
}

/** The game is being hidden or closed: send what is waiting now (the browser finishes small requests after the page has gone). */
export function cloudFlush() {
  if (!cloudEnabled() || !waiting) return;
  window.clearTimeout(timer);
  void send(true).then(schedule);
}

/* ---------------- another phone ---------------- */

export type RestoreResult =
  | { ok: true; state: Record<string, unknown>; savedAt: string; farmer: string | null }
  | { ok: false; why: 'code' | 'none' | 'offline' | 'off' | 'error' };

/** The farm saved under a player code (typed on this phone), to open here. Nothing changes until adoptPlayer. */
export async function cloudRestore(text: string): Promise<RestoreResult> {
  if (!cloudEnabled()) return { ok: false, why: 'off' };
  const id = cleanCode(text);
  if (!id) return { ok: false, why: 'code' };
  if (!online()) return { ok: false, why: 'offline' };
  try {
    const r = await rpc('temolima_restore', { p_player: id });
    if (!r.ok) return { ok: false, why: 'error' };
    const out = await r.json();
    if (!out || typeof out.state !== 'object' || out.state === null) return { ok: false, why: 'none' };
    return { ok: true, state: out.state, savedAt: out.saved_at, farmer: out.farmer_name ?? null };
  } catch {
    return { ok: false, why: 'error' };
  }
}

/** From now on this phone saves under another player code (after opening that farm here). */
export function adoptPlayer(text: string): boolean {
  const id = cleanCode(text);
  if (!id) return false;
  try {
    window.localStorage.setItem(ID_KEY, JSON.stringify({ id }));
  } catch {
    return false;
  }
  code = id;
  waiting = null;
  recordsSent = '';
  window.clearTimeout(timer);
  return true;
}
