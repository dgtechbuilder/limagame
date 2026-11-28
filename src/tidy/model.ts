/* The daily tidy-up: every new day, 3 bushes and 5 rocks turn up around the farm (on the grass, on the lanes between
   the farms, by the paths), and the farmer clears them by hand to keep the farm and the neighbourhood tidy. Each
   piece pays a few points as it goes; the whole tidy-up pays a bonus and moves the tidy streak on.

   Where they turn up is picked from the spots below by the day's date, so the same day always shows the same
   spots (on every open of the game) and the next day shows others. No three.js here, so the saved game can use it. */

export type TidyKind = 'bush' | 'rock';

export interface TidyItem {
  id: string;
  kind: TidyKind;
  x: number;
  z: number;
  /** a little bigger or smaller, so no two days look alike */
  s: number;
}

/** The tidy-up's saved record (missing in older saves). */
export interface TidyState {
  /** the day this tidy-up is for (the player's own calendar day, YYYY-MM-DD) */
  date: string;
  /** the pieces cleared today */
  cleared: string[];
  /** days with every piece cleared, and in a row (the last such day) */
  days: number;
  streak: number;
  last: string | null;
}

/** Every number a designer might tune. */
export const TIDY = {
  bushes: 3,
  rocks: 5,
  /** points for each piece cleared */
  pointsEach: 5,
  /** the bonus for clearing the lot: money (in coins, shown in the player's currency) and points */
  bonusCoins: 60,
  bonusPoints: 40,
  /** seconds of work on a piece */
  workS: { bush: 2.5, rock: 2 } as Record<TidyKind, number>,
  /** how close the farmer must stand to a piece to work it (world units) */
  reach: 1.8,
};

export const TIDY_TOTAL = TIDY.bushes + TIDY.rocks;

export const TIDY_NAME: Record<TidyKind, string> = { bush: 'bush', rock: 'rock' };

/** Where bushes can sprout: on the grass, clear of the paths, the farms, the buildings and the places. */
export const BUSH_SPOTS: [number, number][] = [
  [-14.6, 17.0],
  [13.9, 11.8],
  [-5.2, -11.2],
  [7.8, -10.9],
  [14.2, 4.0],
  [-16.4, -6.6],
  [10.2, -12.6],
  [-20.6, 17.0],
  [7.8, 16.4],
  [-3.6, 15.9],
  [5.4, -15.8],
  [-17.4, -9.2],
];

/** Where rocks can roll in: the lanes between the farms, the edges of the paths, and the grass. */
export const ROCK_SPOTS: [number, number][] = [
  [-3.8, 0.4],
  [4.2, -0.6],
  [-11.6, -6.0],
  [11.6, 3.8],
  [-8.0, -8.8],
  [5.6, 8.9],
  [-8.4, 9.0],
  [1.2, -8.7],
  [-17.6, -3.6],
  [16.2, -3.6],
  [-9.6, 16.9],
  [14.4, 14.4],
];

/** A small seeded random number generator (the same day, the same numbers). */
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};

/** n of the spots, picked by the random numbers. */
function pick(spots: [number, number][], n: number, r: () => number) {
  const pool = spots.map((_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n).map(i => spots[i]);
}

/** The day's bushes and rocks, all of them (cleared or not). */
export function tidyItems(date: string): TidyItem[] {
  const r = rng(hash(`tidy:${date}`));
  const bushes = pick(BUSH_SPOTS, TIDY.bushes, r).map(([x, z], i) => ({ id: `bush-${i}`, kind: 'bush' as const, x, z, s: 1.2 + r() * 0.3 }));
  const rocks = pick(ROCK_SPOTS, TIDY.rocks, r).map(([x, z], i) => ({ id: `rock-${i}`, kind: 'rock' as const, x, z, s: 1.15 + r() * 0.35 }));
  return [...bushes, ...rocks];
}

export const initialTidy: TidyState = { date: '', cleared: [], days: 0, streak: 0, last: null };

/** The tidy-up record for today: a new day brings a new tidy-up (everything back to clear). */
export function tidyFor(t: TidyState | undefined, today: string): TidyState {
  const base = { ...initialTidy, ...(t ?? {}) };
  return base.date === today ? base : { ...base, date: today, cleared: [] };
}

/** The pieces still to clear today. */
export const tidyLeft = (t: TidyState | undefined, today: string) => {
  const cur = tidyFor(t, today);
  return tidyItems(today).filter(i => !cur.cleared.includes(i.id));
};

/** How many of each kind are cleared today. */
export function tidyCount(t: TidyState | undefined, today: string) {
  const cur = tidyFor(t, today);
  const items = tidyItems(today);
  const done = (k: TidyKind) => items.filter(i => i.kind === k && cur.cleared.includes(i.id)).length;
  return { bushes: done('bush'), rocks: done('rock'), done: cur.cleared.length, total: TIDY_TOTAL };
}

const dayBefore = (date: string) => {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** One piece cleared: the record after it, whether it finished the tidy-up, and what it paid. null if it changes
    nothing (not one of today's pieces, or already cleared). */
export function clearPiece(t: TidyState | undefined, id: string, today: string): { tidy: TidyState; finished: boolean; points: number; coins: number } | null {
  const cur = tidyFor(t, today);
  if (cur.cleared.includes(id) || !tidyItems(today).some(i => i.id === id)) return null;
  const cleared = [...cur.cleared, id];
  const finished = cleared.length === TIDY_TOTAL;
  if (!finished) return { tidy: { ...cur, cleared }, finished, points: TIDY.pointsEach, coins: 0 };
  const streak = cur.last === dayBefore(today) ? cur.streak + 1 : 1;
  return {
    tidy: { ...cur, cleared, days: cur.days + 1, streak, last: today },
    finished,
    points: TIDY.pointsEach + TIDY.bonusPoints,
    coins: TIDY.bonusCoins,
  };
}

/** The tidy streak now: it holds through today until the day is over, then lapses. */
export function tidyStreak(t: TidyState | undefined, today: string) {
  if (!t?.last) return 0;
  return t.last === today || t.last === dayBefore(today) ? t.streak : 0;
}
