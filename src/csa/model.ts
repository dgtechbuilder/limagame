/* Climate Smart Agriculture: what the farmer has learned and practised, the daily drill, the field clock, and what
   their skills do for the farm. No screens here (the module is ./Csa.tsx, the games are in ./games).

   - Each practice has a skill that grows with practice: New, Learner, Practised, Skilled, Expert. A run with two
     stars or more adds to it (a few runs a day count), and so does the daily drill.
   - The daily drill: one practice a day (they take turns), done from the CLIMATE-SMART chip on the farm. It pays
     money, points and climate credits once a day, and keeps a streak.
   - The field clock: the hour of the phone's own clock matters for work on the farm. Watering a dry farm in the
     midday heat loses water to the sun; watering in the cool of the morning or evening earns points.
   - Skills help the farm: the rows use less water from the tank (saving water and the right time of day), and crop
     cover costs less (half-moons, zaï pits and drought-tolerant seed keep water in the soil).
   Every number a designer might tune is in CSA below. */

import { CSA_IDS, PRACTICES, practiceOf, type CsaId } from './data';
import { starsOf } from './rules';

export interface CsaState {
  /** the best score (0 to 1) each practice has had */
  best: Partial<Record<CsaId, number>>;
  /** skill points, from runs with two stars or more and the daily drills */
  xp: Partial<Record<CsaId, number>>;
  /** practice runs finished, all time */
  runs: number;
  /** the skill points each practice has earned today (a few a day count) */
  today: { date: string; xp: Partial<Record<CsaId, number>> };
  /** the daily drill: the last day it was done, the days done and in a row, and its last result */
  drill: { date: string | null; days: number; streak: number; id?: CsaId; stars?: number; credits?: number };
  /** the field clock: farm work done in the cool hours, in the midday heat, and in the dark; litres lost to the sun */
  clock: { good: number; hot: number; dark: number; lost: number; tipDate: string | null };
}

export const initialCsa: CsaState = {
  best: {},
  xp: {},
  runs: 0,
  today: { date: '', xp: {} },
  drill: { date: null, days: 0, streak: 0 },
  clock: { good: 0, hot: 0, dark: 0, lost: 0, tipDate: null },
};
export const csaOf = (c: Partial<CsaState> | undefined): CsaState => ({
  ...initialCsa,
  ...(c ?? {}),
  drill: { ...initialCsa.drill, ...(c?.drill ?? {}) },
  clock: { ...initialCsa.clock, ...(c?.clock ?? {}) },
  today: { ...initialCsa.today, ...(c?.today ?? {}) },
});

/** Every number a designer might tune. */
export const CSA = {
  /** a practice done for the first time (one star or more): a welcome */
  first: { coins: 80, points: 50 },
  /** each star better than the practice's best */
  starPoints: 10,
  /** the daily drill: money, points, and climate credits for each star */
  drill: { coins: 60, points: 30, creditsPerStar: 0.5, streakPoints: 5 },
  /** skill points a practice can earn in a day */
  xpPerDay: 3,
  levels: [
    { name: 'New', xp: 0 },
    { name: 'Learner', xp: 1 },
    { name: 'Practised', xp: 3 },
    { name: 'Skilled', xp: 6 },
    { name: 'Expert', xp: 10 },
  ],
  /** what skills do on the farm: the share less water the rows draw from the tank, by skill level (0 to 4) */
  waterCut: { water: [0, 0, 0.05, 0.1, 0.15], clock: [0, 0, 0.03, 0.06, 0.1] } as Record<'water' | 'clock', number[]>,
  /** crop cover's price: off for each of these practices at Skilled or better */
  coverOff: { practices: ['halfmoon', 'zai', 'seeds'] as CsaId[], each: 0.04, from: 3 },
  /** the field clock: watering a farm in the midday heat loses this share more water to the sun */
  hotLoss: 0.4,
  /** points for farm work in the cool hours (once per job) */
  coolPoints: 3,
};

export const levelIndex = (xp: number) => CSA.levels.reduce((n, l, i) => (xp >= l.xp ? i : n), 0);
export const skillOf = (c: CsaState, id: CsaId) => {
  const xp = c.xp[id] ?? 0;
  const i = levelIndex(xp);
  const next = CSA.levels[i + 1];
  return { xp, level: i, name: CSA.levels[i].name, next: next ? next.xp - xp : 0, nextName: next?.name ?? null, share: next ? (xp - CSA.levels[i].xp) / (next.xp - CSA.levels[i].xp) : 1 };
};
/** Practices learned (played with a star or more), and practised to two stars or more. */
export const learned = (c: CsaState) => CSA_IDS.filter(id => (c.best[id] ?? 0) > 0).length;
export const practised = (c: CsaState) => CSA_IDS.filter(id => starsOf(c.best[id] ?? 0) >= 2).length;

/* ---------------- the daily drill ---------------- */

const dayIndex = (date: string) => Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
/** Today's drill: the practices take turns, one a day. */
export const drillOf = (date: string): CsaId => CSA_IDS[((dayIndex(date) % CSA_IDS.length) + CSA_IDS.length) % CSA_IDS.length];
/** A seed for today's drill (a new field, new moths, a new season each day). */
export const drillSeed = (date: string) => dayIndex(date) * 7919 + 13;
export const drillDone = (c: CsaState, date: string) => c.drill.date === date;

const dayBefore = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};
/** The drill streak now: it holds through today, then lapses. */
export const drillStreak = (c: CsaState, today: string) => (c.drill.date === today || c.drill.date === dayBefore(today) ? c.drill.streak : 0);

/* ---------------- a run finished ---------------- */

export interface CsaPay {
  csa: CsaState;
  coins: number;
  points: number;
  /** climate credits the drill earned (they go in the climate ledger and are paid at night) */
  credits: number;
  first: boolean;
  drill: boolean;
  stars: number;
  /** points for stars better than the practice's best */
  starPoints: number;
  levelUp: string | null;
}

/** A practice game finished with a score: its best, the skill it adds, and (once a day) the drill's pay. */
export function finishRun(prev: Partial<CsaState> | undefined, id: CsaId, score: number, today: string, daily: boolean): CsaPay {
  const c = csaOf(prev);
  const stars = starsOf(score);
  const best0 = c.best[id] ?? 0;
  const first = best0 === 0 && stars > 0;
  const better = Math.max(0, stars - starsOf(best0));
  const isDrill = daily && stars > 0 && !drillDone(c, today) && drillOf(today) === id;
  // skill points: a good run, the first time, the drill; a few a day
  const t = c.today.date === today ? c.today : { date: today, xp: {} };
  const got = t.xp[id] ?? 0;
  const want = (stars >= 2 ? stars - 1 : 0) + (first ? 1 : 0) + (isDrill ? 1 : 0);
  const add = Math.max(0, Math.min(want, CSA.xpPerDay - got));
  const xp0 = c.xp[id] ?? 0;
  const lvl0 = levelIndex(xp0);
  const lvl1 = levelIndex(xp0 + add);
  let coins = 0;
  let points = better * CSA.starPoints;
  let credits = 0;
  if (first) {
    coins += CSA.first.coins;
    points += CSA.first.points;
  }
  let drill = c.drill;
  if (isDrill) {
    const streak = c.drill.date === dayBefore(today) ? c.drill.streak + 1 : 1;
    credits = stars * CSA.drill.creditsPerStar;
    coins += CSA.drill.coins;
    points += CSA.drill.points + Math.min(10, streak - 1) * CSA.drill.streakPoints;
    drill = { date: today, days: c.drill.days + 1, streak, id, stars, credits };
  }
  const csa: CsaState = {
    ...c,
    best: { ...c.best, [id]: Math.max(best0, score) },
    xp: { ...c.xp, [id]: xp0 + add },
    runs: c.runs + 1,
    today: { date: today, xp: { ...t.xp, [id]: got + add } },
    drill,
  };
  return { csa, coins, points, credits, first, drill: isDrill, stars, starPoints: better * CSA.starPoints, levelUp: lvl1 > lvl0 ? CSA.levels[lvl1].name : null };
}

/* ---------------- what the skills do on the farm ---------------- */

/** The share less water the rows draw from the tank. */
export function waterCut(prev: Partial<CsaState> | undefined): number {
  const c = csaOf(prev);
  return CSA.waterCut.water[skillOf(c, 'water').level] + CSA.waterCut.clock[skillOf(c, 'clock').level];
}

/** Crop cover: what comes off the price for the practices that keep water in the soil. */
export function coverOff(prev: Partial<CsaState> | undefined): { off: number; names: string[] } {
  const c = csaOf(prev);
  const names = CSA.coverOff.practices.filter(id => skillOf(c, id).level >= CSA.coverOff.from).map(id => practiceOf(id).name.toLowerCase());
  return { off: names.length * CSA.coverOff.each, names };
}

/** Everything the skills do for the farm now, and what is still to win, for the module's page. */
export function benefitsOf(prev: Partial<CsaState> | undefined) {
  const c = csaOf(prev);
  const cut = waterCut(c);
  const cover = coverOff(c);
  return [
    {
      icon: '🛢',
      on: cut > 0,
      text: cut > 0 ? `The rows draw ${Math.round(cut * 100)}% less water from the tank` : 'Practise Saving water and The right time of day: the rows draw less water from the tank',
    },
    {
      icon: '☂️',
      on: cover.off > 0,
      text: cover.off > 0 ? `Crop cover costs ${Math.round(cover.off * 100)}% less (${cover.names.join(', ')})` : 'Reach Skilled in half-moons, zaï pits or seed and intercropping: crop cover costs less',
    },
    {
      icon: '🕖',
      on: c.clock.good > 0,
      text: `Field clock: ${c.clock.good} job${c.clock.good === 1 ? '' : 's'} done in the cool, ${c.clock.hot} in the midday heat${c.clock.lost ? ` (${Math.round(c.clock.lost)} L lost to the sun)` : ''}`,
    },
  ];
}

/* ---------------- the field clock ---------------- */

export type Band = 'dark' | 'dawn' | 'cool' | 'warm' | 'hot' | 'evening';
export interface ClockNow {
  band: Band;
  icon: string;
  /** a word for the hour */
  label: string;
  /** what to do now, in a few words (the chip) */
  short: string;
  /** what to do now, in a sentence */
  tip: string;
  /** good: the right time for field work and watering; hot: rest, water later; dark: wait for the light */
  work: 'good' | 'ok' | 'hot' | 'dark';
}

/** The hour the farm counts in: the phone's own clock (the play-tests set their own, see src/dev/hook.ts). */
export const fieldClock = { hour: () => new Date().getHours() };

/** The field clock: what the hour of the day means for farm work. */
export function clockNow(hour: number): ClockNow {
  if (hour < 5 || hour >= 20) return { band: 'dark', icon: '🌙', label: 'Night', short: 'rest', tip: 'Night: rest. Watering now leaves the leaves wet all night, and fungus loves that.', work: 'dark' };
  if (hour < 6) return { band: 'dawn', icon: '🌄', label: 'Dawn', short: 'pick greens', tip: 'Dawn: pick the greens while they are cool and crisp; water as soon as it is light.', work: 'ok' };
  if (hour < 10) return { band: 'cool', icon: '🌅', label: 'Cool morning', short: 'water & weed', tip: 'Cool morning: the best hours to water, weed and spray. Get the hard work done now.', work: 'good' };
  if (hour < 11) return { band: 'warm', icon: '🌤', label: 'Warming up', short: 'finish up', tip: 'It is warming up: finish the heavy work. Harvest dry grain once the dew is off.', work: 'ok' };
  if (hour < 16) return { band: 'hot', icon: '☀️', label: 'Midday heat', short: 'rest in shade', tip: 'Midday heat: rest in the shade and drink water. Water now loses up to half to the sun: wait until 4.', work: 'hot' };
  return { band: 'evening', icon: '🌇', label: 'Cool evening', short: 'water & plant', tip: 'Cool evening: water at the roots and transplant seedlings now. Spray once the bees are home.', work: 'good' };
}

/** A farm watered by hand at this hour: extra litres lost to the sun, and the points the cool hours earn. */
export function wateringAt(hour: number, litres: number) {
  const now = clockNow(hour);
  if (now.work === 'hot') return { now, lost: Math.round(litres * CSA.hotLoss), points: 0 };
  if (now.work === 'good') return { now, lost: 0, points: CSA.coolPoints };
  return { now, lost: 0, points: 0 };
}

export const PRACTICE_COUNT = PRACTICES.length;
