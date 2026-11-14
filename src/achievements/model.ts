/* Achievements: badges for progress in every part of the game, a daily streak with a reward to claim each day,
   and certificates awarded along the way (each week of play, streak milestones, and a game mastered at a tier).

   This file is the whole model and has no screens, so the reducer and the tests can use it. Every number a
   designer might tune (what each badge asks, what it pays, the streak's rewards, which streaks earn a certificate)
   is in the tables below. Rewards are claimed by the player on the Achievements page, so an action never changes
   coins or points behind the player's back. */

/* ---------------- the parts of the game ---------------- */

export type AchGame = 'daily' | 'farm' | 'six' | 'rounds' | 'tractor' | 'business' | 'climate';

export const GAMES: { id: AchGame; name: string; icon: string; subject: string }[] = [
  { id: 'daily', name: 'Every day', icon: '🔥', subject: 'Coming back' },
  { id: 'farm', name: 'Farm Moja', icon: '🌽', subject: 'Maize farming' },
  { id: 'six', name: 'Six farms', icon: '🧪', subject: 'Farm trials' },
  { id: 'rounds', name: 'Field rounds', icon: '🔍', subject: 'Crop scouting' },
  { id: 'tractor', name: 'Tractor', icon: '🚜', subject: 'Tractor driving' },
  { id: 'business', name: 'Tractor business', icon: '🤝', subject: 'Tractor services' },
  { id: 'climate', name: 'Climate', icon: '🌍', subject: 'Climate-smart farming' },
];
export const gameOf = (id: AchGame) => GAMES.find(g => g.id === id)!;

/* ---------------- what is counted ---------------- */

/** Lifetime counts of things the game state does not keep by itself (src/achievements/track.ts fills them in). */
export interface AchStats {
  /** Farm Moja: farming-step tasks done */
  tasks: number;
  /** field rounds: beds read right (the first right call on each bed each day) */
  roundsRight: number;
  /** six farms: daily checks read right */
  checksRight: number;
  /** six farms: problems treated */
  treatments: number;
  /** six farms: cycles planted */
  plantings: number;
  /** tractor: drives finished, and drives with three stars */
  drives: number;
  topDrives: number;
  /** tractor: a farm's job finished from the tractor seat */
  seatJobs: number;
  /** shop items bought, milk and eggs collected */
  buys: number;
  collects: number;
  /** coins earned by playing (not by claiming rewards) */
  coinsEarned: number;
}

export const ZERO_STATS: AchStats = { tasks: 0, roundsRight: 0, checksRight: 0, treatments: 0, plantings: 0, drives: 0, topDrives: 0, seatJobs: 0, buys: 0, collects: 0, coinsEarned: 0 };

/** What a badge can read: the counts above, and what the saved game already holds. */
export interface AchView {
  stats: AchStats;
  /** the streak now, and days played in all */
  streak: number;
  days: number;
  onboarded: boolean;
  level: number;
  /** Farm Moja seasons sold */
  seasonsSold: number;
  /** six-farm cycles harvested */
  harvests: number;
  /** tractor business: days run, farmers helped, tractors owned */
  bizDays: number;
  helped: number;
  owned: number;
  /** climate credits earned */
  credits: number;
}

/* ---------------- the badges ---------------- */

export type Tier = 'day1' | 'bronze' | 'silver' | 'gold' | 'special';

export interface Achievement {
  id: string;
  game: AchGame;
  tier: Tier;
  name: string;
  /** what to do, in a few words */
  goal: string;
  icon: string;
  /** progress toward it, and the number it needs */
  value: (v: AchView) => number;
  need: number;
  /** points paid when it is claimed (coins too, for some) */
  points: number;
  coins?: number;
}

export const TIER_NAME: Record<Tier, string> = { day1: 'Day one', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', special: 'Special' };
/** Points a badge of each tier pays (day-one badges are easy and pay a little, gold pays most). */
export const TIER_POINTS: Record<Tier, number> = { day1: 25, bronze: 50, silver: 100, gold: 250, special: 150 };

const day1 = (id: string, game: AchGame, name: string, goal: string, icon: string, value: (v: AchView) => number, coins = 0): Achievement => ({
  id,
  game,
  tier: 'day1',
  name,
  goal,
  icon,
  value,
  need: 1,
  points: TIER_POINTS.day1,
  ...(coins ? { coins } : {}),
});

/** A badge in three tiers: the same thing done more and more. */
function tiers(base: string, game: AchGame, icon: string, value: (v: AchView) => number, list: [name: string, need: number, goal: string][]): Achievement[] {
  const ts: Tier[] = ['bronze', 'silver', 'gold'];
  return list.map(([name, need, goal], i) => ({ id: `${base}-${ts[i]}`, game, tier: ts[i], name, goal, icon, value, need, points: TIER_POINTS[ts[i]] }));
}

/** Easy badges for the first day, one in each part of the game, so every first visit ends with something won. */
export const DAY_ONE: Achievement[] = [
  day1('welcome', 'daily', 'Welcome to your farm', 'Finish your first crop checks', '🏡', v => (v.onboarded ? 1 : 0), 50),
  day1('first-task', 'farm', 'First task', 'Do one Farm Moja farming task', '🌱', v => v.stats.tasks),
  day1('first-buy', 'farm', 'First purchase', 'Buy something in the Shop', '🛒', v => v.stats.buys),
  day1('chores', 'farm', 'Morning chores', 'Collect the milk or the eggs', '🥚', v => v.stats.collects),
  day1('first-read', 'rounds', 'Sharp eyes', 'Read one bed right in Field rounds', '👀', v => v.stats.roundsRight),
  day1('first-plant', 'six', 'Seeds in the ground', 'Plant your farms from Mission', '🌾', v => v.stats.plantings),
  day1('first-check', 'six', 'Crop doctor', 'Read one of your farms right on its daily check', '🩺', v => v.stats.checksRight),
  day1('first-drive', 'tractor', 'First furrow', 'Finish a tractor drive', '🚜', v => v.stats.drives),
  day1('first-biz', 'business', 'Open for business', 'Run your first tractor business day', '📒', v => v.bizDays),
  day1('first-credit', 'climate', 'Climate starter', 'Earn your first climate credit', '🍃', v => v.credits),
];

export const ACHIEVEMENTS: Achievement[] = [
  ...DAY_ONE,
  // every day
  ...tiers('streak', 'daily', '🔥', v => v.streak, [
    ['On a roll', 3, 'Play 3 days in a row'],
    ['Week strong', 7, 'Play 7 days in a row'],
    ['Month of mornings', 30, 'Play 30 days in a row'],
  ]),
  ...tiers('days', 'daily', '📅', v => v.days, [
    ['Regular', 7, 'Play on 7 days'],
    ['Part of the farm', 30, 'Play on 30 days'],
    ['Farmer for life', 100, 'Play on 100 days'],
  ]),
  ...tiers('level', 'daily', '⭐', v => v.level, [
    ['Growing', 5, 'Reach level 5'],
    ['Seasoned', 10, 'Reach level 10'],
    ['Master farmer', 20, 'Reach level 20'],
  ]),
  // Farm Moja
  ...tiers('tasks', 'farm', '🧑‍🌾', v => v.stats.tasks, [
    ['Farm hand', 10, 'Do 10 farming tasks'],
    ['Hard worker', 50, 'Do 50 farming tasks'],
    ['Backbone of the farm', 150, 'Do 150 farming tasks'],
  ]),
  ...tiers('seasons', 'farm', '🧺', v => v.seasonsSold, [
    ['Market day', 1, 'Sell a season of maize'],
    ['Steady seller', 5, 'Sell 5 seasons'],
    ['Maize trader', 15, 'Sell 15 seasons'],
  ]),
  ...tiers('coins', 'farm', '💰', v => v.stats.coinsEarned, [
    ['Money maker', 1000, 'Earn 10,000 coins'],
    ['Good business', 10000, 'Earn 100,000 coins'],
    ['Farm fortune', 50000, 'Earn 500,000 coins'],
  ]),
  // six farms
  ...tiers('harvests', 'six', '📊', v => v.harvests, [
    ['First results', 1, 'Harvest a cycle of your farms'],
    ['Trial runner', 3, 'Harvest 3 cycles'],
    ['Farm scientist', 10, 'Harvest 10 cycles'],
  ]),
  ...tiers('checks', 'six', '🩺', v => v.stats.checksRight, [
    ['Careful eye', 10, 'Read 10 daily checks right'],
    ['Plant doctor', 50, 'Read 50 daily checks right'],
    ['Chief agronomist', 150, 'Read 150 daily checks right'],
  ]),
  ...tiers('treat', 'six', '🧴', v => v.stats.treatments, [
    ['First aid', 3, 'Treat 3 problems'],
    ['Problem solver', 15, 'Treat 15 problems'],
    ['Crop saver', 50, 'Treat 50 problems'],
  ]),
  // field rounds
  ...tiers('rounds', 'rounds', '🔍', v => v.stats.roundsRight, [
    ['Field scout', 5, 'Read 5 beds right'],
    ['Keen scout', 25, 'Read 25 beds right'],
    ['Master scout', 100, 'Read 100 beds right'],
  ]),
  // tractor
  ...tiers('drives', 'tractor', '🚜', v => v.stats.drives, [
    ['Tractor driver', 3, 'Finish 3 drives'],
    ['Regular driver', 10, 'Finish 10 drives'],
    ['Road veteran', 30, 'Finish 30 drives'],
  ]),
  ...tiers('top', 'tractor', '🏆', v => v.stats.topDrives, [
    ['Three stars', 1, 'Drive a 3-star job'],
    ['Clean driver', 5, 'Drive 5 three-star jobs'],
    ['Precision driver', 15, 'Drive 15 three-star jobs'],
  ]),
  ...tiers('seat', 'tractor', '🪑', v => v.stats.seatJobs, [
    ['Seat time', 1, 'Finish a farm’s job from the seat'],
    ['Field hand on wheels', 5, 'Finish 5 jobs from the seat'],
    ['Tractor farmer', 20, 'Finish 20 jobs from the seat'],
  ]),
  // tractor business
  ...tiers('biz', 'business', '📒', v => v.bizDays, [
    ['Booking agent', 5, 'Run 5 business days'],
    ['Busy agent', 20, 'Run 20 business days'],
    ['Territory leader', 60, 'Run 60 business days'],
  ]),
  ...tiers('helped', 'business', '🤝', v => v.helped, [
    ['Farmers’ friend', 10, 'Help 10 farmers'],
    ['Known in the ward', 50, 'Help 50 farmers'],
    ['The county’s helper', 150, 'Help 150 farmers'],
  ]),
  { id: 'owner', game: 'business', tier: 'special', name: 'Tractor owner', goal: 'Get a tractor of your own on Pay-As-You-Go', icon: '🔑', value: v => v.owned, need: 1, points: TIER_POINTS.special },
  // climate
  ...tiers('credits', 'climate', '🍃', v => v.credits, [
    ['Climate friend', 10, 'Earn 10 climate credits'],
    ['Climate steward', 30, 'Earn 30 climate credits'],
    ['Climate champion', 100, 'Earn 100 climate credits'],
  ]),
];

export const achOf = (id: string) => ACHIEVEMENTS.find(a => a.id === id);
/** How far a badge has come, 0 to 1. */
export const progressOf = (a: Achievement, v: AchView) => Math.max(0, Math.min(1, a.value(v) / a.need));

/* ---------------- the daily streak ---------------- */

/** The player's own calendar day, YYYY-MM-DD (local time, so the day turns at the player's midnight). */
export function localDay(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Whole days from one YYYY-MM-DD to another. */
export function daysBetween(a: string, b: string): number {
  const t = (x: string) => Date.UTC(Number(x.slice(0, 4)), Number(x.slice(5, 7)) - 1, Number(x.slice(8, 10)));
  return Math.round((t(b) - t(a)) / 86400000);
}

/** The reward for coming back: it grows with the streak for its first week, then stays at the top. */
export const STREAK_REWARD = { coinsPerDay: 20, pointsPerDay: 10, capDays: 7 };
export const streakReward = (streak: number) => {
  const d = Math.max(1, Math.min(STREAK_REWARD.capDays, streak));
  return { coins: STREAK_REWARD.coinsPerDay * d, points: STREAK_REWARD.pointsPerDay * d };
};
/** Streaks that earn a certificate. */
export const STREAK_CERTS = [3, 7, 14, 30, 60, 100];
/** Every this many days played, a certificate for the week's work. */
export const WEEK_DAYS = 7;

/* ---------------- certificates ---------------- */

export interface Certificate {
  id: string;
  kind: 'week' | 'streak' | 'mastery';
  title: string;
  /** one line on what it is for */
  line: string;
  date: string;
  /** what was done, for a week's certificate */
  summary?: string[];
  game?: AchGame;
  tier?: Tier;
}

/* ---------------- the saved state ---------------- */

export interface AchState {
  stats: AchStats;
  /** badges won, by id: the day each was won, and whether its reward was claimed */
  won: Record<string, { date: string; claimed: boolean }>;
  streak: { count: number; best: number; last: string | null };
  /** days played in all, and the latest few (for the week's dots) */
  days: number;
  recent: string[];
  /** the reward for today's visit: the day it is for, and whether it was claimed */
  daily: { date: string; streak: number; claimed: boolean } | null;
  certs: Certificate[];
  /** the counts when the last week's certificate was given, to sum up the next week */
  weekFrom: AchStats & { seasons: number; helped: number };
}

export const initialAch: AchState = {
  stats: ZERO_STATS,
  won: {},
  streak: { count: 0, best: 0, last: null },
  days: 0,
  recent: [],
  daily: null,
  certs: [],
  weekFrom: { ...ZERO_STATS, seasons: 0, helped: 0 },
};

/** A save from before achievements, or from an older version of them, with every field filled in. */
export const achOfSave = (a: Partial<AchState> | undefined): AchState => ({
  ...initialAch,
  ...(a ?? {}),
  stats: { ...ZERO_STATS, ...(a?.stats ?? {}) },
  streak: { ...initialAch.streak, ...(a?.streak ?? {}) },
  weekFrom: { ...initialAch.weekFrom, ...(a?.weekFrom ?? {}) },
});

/** A day played: the streak goes on (yesterday was played), holds (today already counted) or starts again. */
export function playDay(a: AchState, today: string): AchState {
  const last = a.streak.last;
  if (last === today) return a;
  const gap = last ? daysBetween(last, today) : Infinity;
  // a clock set back: keep what was earned, count nothing
  if (gap < 0) return a;
  const count = gap === 1 ? a.streak.count + 1 : 1;
  return {
    ...a,
    streak: { count, best: Math.max(a.streak.best, count), last: today },
    days: a.days + 1,
    recent: [...a.recent.filter(d => d !== today), today].slice(-14),
    daily: { date: today, streak: count, claimed: false },
  };
}

/** The streak as it stands today: it is broken once a whole day has gone by unplayed. */
export const streakNow = (a: AchState, today: string) => (a.streak.last && daysBetween(a.streak.last, today) <= 1 ? a.streak.count : 0);

/** Badges whose goal is met but are not yet won. */
export const newlyWon = (a: AchState, v: AchView) => ACHIEVEMENTS.filter(x => !a.won[x.id] && x.value(v) >= x.need);

/** Rewards waiting to be claimed: badges won, and today's visit. */
export const unclaimed = (a: AchState, today: string) =>
  Object.entries(a.won).filter(([, w]) => !w.claimed).length + (a.daily && a.daily.date === today && !a.daily.claimed ? 1 : 0);

/** A game whose every badge of a tier is won (day-one badges count with bronze). */
export function masteredTiers(a: AchState): { game: AchGame; tier: Tier }[] {
  const out: { game: AchGame; tier: Tier }[] = [];
  for (const g of GAMES) {
    for (const tier of ['bronze', 'silver', 'gold'] as Tier[]) {
      const set = ACHIEVEMENTS.filter(x => x.game === g.id && (x.tier === tier || (tier === 'bronze' && x.tier === 'day1')));
      if (set.length && set.every(x => a.won[x.id])) out.push({ game: g.id, tier });
    }
  }
  return out;
}

/** Certificates now due that have not been given. */
export function dueCertificates(a: AchState, v: AchView, today: string): Certificate[] {
  const have = new Set(a.certs.map(c => c.id));
  const out: Certificate[] = [];
  for (const n of STREAK_CERTS) {
    const id = `streak-${n}`;
    if (a.streak.count >= n && !have.has(id)) out.push({ id, kind: 'streak', title: `${n}-day streak`, line: `For coming back to the farm ${n} days in a row`, date: today });
  }
  const week = Math.floor(a.days / WEEK_DAYS);
  for (let w = 1; w <= week; w++) {
    const id = `week-${w}`;
    if (have.has(id)) continue;
    // a week's certificate sums up what was done since the last one (earlier weeks, given late, sum up nothing)
    out.push({ id, kind: 'week', title: `Week ${w} of farming`, line: `For ${WEEK_DAYS} more days of work on the farm`, date: today, summary: w === week ? weekSummary(a, v) : [] });
  }
  for (const m of masteredTiers(a)) {
    const id = `mastery-${m.game}-${m.tier}`;
    if (have.has(id)) continue;
    const g = gameOf(m.game);
    out.push({ id, kind: 'mastery', title: `${TIER_NAME[m.tier]} certificate in ${g.subject}`, line: `For winning every ${TIER_NAME[m.tier].toLowerCase()} badge in ${g.name}`, date: today, game: m.game, tier: m.tier });
  }
  return out;
}

/** What was done since the last week's certificate, in a few lines (only what there was some of). */
export function weekSummary(a: AchState, v: AchView): string[] {
  const s = a.stats;
  const f = a.weekFrom;
  const lines: [number, string, string][] = [
    [s.tasks - f.tasks, 'farming task', 'farming tasks'],
    [v.seasonsSold - f.seasons, 'season sold', 'seasons sold'],
    [s.checksRight + s.roundsRight - f.checksRight - f.roundsRight, 'crop read right', 'crops read right'],
    [s.treatments - f.treatments, 'problem treated', 'problems treated'],
    [s.drives - f.drives, 'tractor drive', 'tractor drives'],
    [v.helped - f.helped, 'farmer helped', 'farmers helped'],
  ];
  return lines.filter(([n]) => n > 0).map(([n, one, many]) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`);
}
