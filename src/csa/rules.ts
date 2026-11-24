/* Climate Smart Agriculture: the rules of the eight practice games, with no screens, so the play-tests can check
   them directly. Each game's screen is in ./games; every number a designer might tune is in the tables here. The
   figures are for learning (an agronomist's review is still to come), but every rule follows the real practice: a
   half-moon only catches water with its open side uphill, a zaï pit sown before the rain loses its seed, and so on. */

import { REST, SOIL, soilFactor, type RestKind } from '../soil/model';

/** Stars from a score of 0 to 1 (the same as every mini-game in the game). */
export const starsOf = (score: number) => (score >= 0.85 ? 3 : score >= 0.6 ? 2 : score > 0 ? 1 : 0);

/** A small seeded random number generator: the same seed, the same field. */
export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const hashText = (text: string) => {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
};
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

/* ================================================================== */
/* Half-moons                                                          */
/* ================================================================== */

/** The slope seen from above: uphill at the top. Three contour rows of nine spots; rain runs down in 19 streams. */
export const HM = {
  cols: 9,
  rows: 3,
  x0: 60,
  dx: 60,
  y0: 70,
  dy: 62,
  /** how far either side of its middle a half-moon reaches (a stream inside it is held) */
  reach: 45,
  streams: 19,
  sx0: 30,
  sdx: 30,
  /** the day's labour: half-moons that can be dug (a perfect, staggered field needs all of them) */
  budget: 9,
};
export type Opening = 'up' | 'down';
export interface Moon {
  row: number;
  col: number;
  /** which way the open side faces: up the slope (right) or down it (the water runs off its back) */
  open: Opening;
  manure?: boolean;
  seed?: boolean;
}
export const moonX = (col: number) => HM.x0 + col * HM.dx;
export const moonY = (row: number) => HM.y0 + row * HM.dy;
export const streamX = (k: number) => HM.sx0 + k * HM.sdx;

/** Can a half-moon be dug here? Two side by side in a row would overlap. */
export function canDig(moons: Moon[], row: number, col: number): 'ok' | 'taken' | 'close' | 'budget' {
  if (moons.some(m => m.row === row && m.col === col)) return 'taken';
  if (moons.some(m => m.row === row && Math.abs(m.col - col) === 1)) return 'close';
  if (moons.length >= HM.budget) return 'budget';
  return 'ok';
}

export interface StreamEnd {
  k: number;
  x: number;
  /** the half-moon that held it (its index in the list), or null: it ran off the bottom of the slope */
  moon: number | null;
  /** the half-moons it ran past the back of (dug the wrong way round), in order */
  spilled: number[];
}

/** The rain: each stream runs down the slope until a half-moon with its open side uphill holds it. */
export function rainRun(moons: Moon[]): { ends: StreamEnd[]; caught: number; share: number } {
  const ends: StreamEnd[] = [];
  for (let k = 0; k < HM.streams; k++) {
    const x = streamX(k);
    const spilled: number[] = [];
    let held: number | null = null;
    for (let row = 0; row < HM.rows && held === null; row++) {
      const i = moons.findIndex(m => m.row === row && Math.abs(moonX(m.col) - x) <= HM.reach);
      if (i < 0) continue;
      if (moons[i].open === 'up') held = i;
      else spilled.push(i);
    }
    ends.push({ k, x, moon: held, spilled });
  }
  const caught = ends.filter(e => e.moon !== null).length;
  return { ends, caught, share: caught / HM.streams };
}

/** The score: the rain held (most of it), half-moons the right way round, and fed with manure and seed. */
export function scoreHalfMoon(moons: Moon[]) {
  const run = rainRun(moons);
  const right = moons.filter(m => m.open === 'up').length;
  const fed = moons.filter(m => m.open === 'up' && m.manure && m.seed).length;
  // the water held counts most, squared: rows not staggered let a quarter of it run off, and that is a big miss
  const score = 0.7 * run.share * run.share + 0.1 * (moons.length ? right / moons.length : 0) + 0.2 * (right ? fed / Math.max(right, HM.budget - 1) : 0);
  return { score: clamp01(score), run, right, fed };
}

/* ================================================================== */
/* Saving water                                                        */
/* ================================================================== */

export type WaterHow = 'leaves' | 'roots' | 'drip';
export type WaterWhen = 6 | 13 | 17;
export interface WaterChoice {
  mulch: boolean;
  how: WaterHow;
  when: WaterWhen;
  litres: number;
}
export const WATER_GAME = {
  /** soil water at dawn, the wilting line, and the most the soil holds (more drains away below the roots) */
  start: 48,
  wilt: 20,
  cap: 80,
  /** each litre that reaches the soil adds this much */
  perLitre: 5,
  /** the sun's draw on bare soil, each hour from 6 am to 6 pm; mulch halves it */
  sun: [1, 1.5, 2, 3, 4, 4.5, 4.5, 4, 3, 2, 1.5, 1],
  mulchCut: 0.5,
  /** the plant drinks this much an hour by day, and at night; the night air takes a little from bare soil */
  drinkDay: 1,
  drinkNight: 0.5,
  nightSun: 0.3,
  /** the share of the water that reaches the roots, by how it is given and when */
  how: { leaves: 0.55, roots: 0.85, drip: 0.95 } as Record<WaterHow, number>,
  when: { 6: 0.9, 13: 0.55, 17: 0.8 } as Record<WaterWhen, number>,
  litres: [2, 4, 6, 8, 10],
};
export const HOW_NAME: Record<WaterHow, string> = { leaves: 'Can over the leaves', roots: 'Can at the roots', drip: 'Bucket drip' };
export const WHEN_NAME: Record<WaterWhen, string> = { 6: '6 am', 13: '1 pm', 17: '5 pm' };

/** A day and a night with this choice: the soil water every hour from 6 am to 6 am, and how the plant did. */
export function waterDay(c: WaterChoice) {
  const g = WATER_GAME;
  const eff = g.how[c.how] * g.when[c.when];
  let m = g.start;
  const curve = [m];
  let min = m;
  let drained = 0;
  let toAir = 0;
  for (let h = 6; h < 30; h++) {
    if (h === c.when) {
      const add = c.litres * eff * g.perLitre;
      toAir += c.litres * (1 - eff);
      m += add;
      if (m > g.cap) {
        drained += (m - g.cap) / g.perLitre;
        m = g.cap;
      }
    }
    const day = h < 18;
    const sun = day ? g.sun[h - 6] : g.nightSun;
    const cut = c.mulch ? g.mulchCut : 1;
    m -= sun * cut + (day ? g.drinkDay : g.drinkNight);
    toAir += (sun * cut) / g.perLitre;
    curve.push(m);
    min = Math.min(min, m);
  }
  const alive = min >= g.wilt;
  // the hour the plant first wilted (6 = 6 am), or null
  const wiltAt = alive ? null : 6 + curve.findIndex(x => x < g.wilt);
  const fungus = c.how === 'leaves' && c.when === 17;
  return { curve, min, alive, wiltAt, fungus, drained: Math.round(drained * 10) / 10, toAir: Math.round(toAir * 10) / 10, eff };
}

/** The score: the plant alive, on as little water as can be, given the best way at the best time. */
export function scoreWater(c: WaterChoice) {
  const d = waterDay(c);
  if (!d.alive) return { score: 0.1 + (c.mulch ? 0.1 : 0) + (c.how !== 'leaves' ? 0.05 : 0), day: d };
  const thrift = Math.max(0, 0.25 - ((c.litres - 2) / 2) * 0.06);
  const way = c.how === 'drip' ? 0.1 : c.how === 'roots' ? 0.07 : 0;
  const hour = c.when === 6 ? 0.1 : c.when === 17 ? 0.06 : 0;
  return { score: clamp01(0.5 + thrift + way + hour + (c.mulch ? 0.05 : 0) - (d.fungus ? 0.15 : 0)), day: d };
}

/* ================================================================== */
/* The right time of day                                               */
/* ================================================================== */

export interface ClockJob {
  id: string;
  name: string;
  icon: string;
  /** the score for each hour of the day (0 to 23) */
  at: (h: number) => number;
  good: string;
  /** why an hour is wrong: by the hour */
  bad: (h: number) => string;
}
const inR = (h: number, a: number, b: number) => h >= a && h <= b;
const night = (h: number) => h < 5 || h > 20;

export const CLOCK_JOBS: ClockJob[] = [
  {
    id: 'water',
    name: 'Water the tomatoes',
    icon: '💧',
    at: h => (inR(h, 5, 8) ? 1 : h === 9 ? 0.7 : inR(h, 16, 18) ? 0.8 : h === 10 ? 0.4 : h === 19 ? 0.3 : inR(h, 11, 15) ? 0.05 : 0.1),
    good: 'Cool and still: the water soaks down to the roots before the sun gets to it.',
    bad: h => (inR(h, 10, 15) ? 'The midday sun takes up to half of it into the air.' : 'Leaves wet all night: fungus and blight.'),
  },
  {
    id: 'transplant',
    name: 'Transplant cabbage seedlings',
    icon: '🌱',
    at: h => (inR(h, 16, 18) ? 1 : inR(h, 5, 8) ? 0.8 : inR(h, 9, 10) ? 0.4 : h === 19 ? 0.4 : inR(h, 11, 15) ? 0 : 0.1),
    good: 'They settle in through the cool night before facing the sun.',
    bad: h => (inR(h, 9, 15) ? 'Seedlings moved in the heat wilt and many die.' : 'Too dark to plant them well.'),
  },
  {
    id: 'spray',
    name: 'Spray neem on the kale',
    icon: '🧴',
    at: h => (inR(h, 5, 8) || inR(h, 17, 19) ? 1 : h === 16 ? 0.6 : h === 9 ? 0.5 : inR(h, 10, 15) ? 0 : 0.2),
    good: 'No wind to carry it away, no bees flying, and it does not dry before it works.',
    bad: h => (inR(h, 9, 15) ? 'Wind drifts it, the heat dries it and burns leaves, and the bees are out.' : 'You cannot see what you are spraying.'),
  },
  {
    id: 'dig',
    name: 'Weed and dig the beds',
    icon: '⛏️',
    at: h => (inR(h, 6, 9) ? 1 : inR(h, 16, 18) ? 0.9 : h === 5 ? 0.8 : h === 10 ? 0.7 : h === 11 || h === 19 ? 0.3 : 0),
    good: 'Hard work in the cool: you keep going longer and stay safe.',
    bad: h => (inR(h, 11, 15) ? 'Heat stress: rest in the shade from noon to 3 and drink water.' : 'Too dark to see the crop from the weeds.'),
  },
  {
    id: 'greens',
    name: 'Pick sukuma wiki for market',
    icon: '🥬',
    at: h => (inR(h, 5, 7) ? 1 : h === 8 ? 0.8 : h === 9 ? 0.5 : inR(h, 16, 18) ? 0.4 : inR(h, 10, 15) ? 0.1 : 0.2),
    good: 'Cool and crisp at dawn: they stay fresh to the market.',
    bad: h => (inR(h, 9, 18) ? 'Leaves picked in the heat wilt before they are sold.' : 'Too dark to pick well.'),
  },
  {
    id: 'grain',
    name: 'Harvest the dry maize',
    icon: '🌽',
    at: h => (inR(h, 10, 14) ? 1 : inR(h, 15, 16) ? 0.8 : h === 9 ? 0.6 : inR(h, 17, 18) ? 0.5 : inR(h, 5, 8) ? 0.2 : 0),
    good: 'The dew is off: dry cobs store without mould.',
    bad: h => (inR(h, 5, 8) ? 'Morning dew wets the cobs: they go mouldy in store.' : night(h) ? 'Too dark to harvest.' : 'Fine, but the cobs are drier from late morning.'),
  },
];
export const clockJobOf = (id: string) => CLOCK_JOBS.find(j => j.id === id)!;

/** The sky at an hour (a typical hot, dry-season day near the equator). */
export function skyAt(h: number) {
  const day = h >= 6.5 && h <= 18.75;
  const temp = Math.round(17 + 13 * Math.max(0, Math.sin((Math.PI * (h - 6)) / 16)));
  const evap = Math.round(45 * Math.max(0, Math.sin((Math.PI * (h - 6)) / 14)));
  const wind = inR(h, 13, 15) ? 'Windy' : inR(h, 10, 12) || inR(h, 16, 17) ? 'Breezy' : 'Calm';
  const bees = inR(h, 9, 16);
  const dew = inR(h, 4, 8);
  return { day, temp, evap, wind, bees, dew };
}
export const hourText = (h: number) => (h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`);

/** The score for a set of jobs done at the hours picked. */
export const scoreClock = (picks: { job: string; hour: number }[]) => (picks.length ? picks.reduce((n, p) => n + clockJobOf(p.job).at(p.hour), 0) / picks.length : 0);

/* ================================================================== */
/* Zaï pits                                                            */
/* ================================================================== */

export const ZAI = { cols: 6, rows: 3 };
export interface Pit {
  dug: boolean;
  manure: boolean;
  /** sown, and whether it was before the rain (the seed is lost to birds, ants and the dry) */
  seed: 'none' | 'early' | 'good';
}
export const newPits = (): Pit[] => Array.from({ length: ZAI.cols * ZAI.rows }, () => ({ dug: false, manure: false, seed: 'none' }));

/** Each pit: dug in the dry season, fed with manure, sown once the rain has filled it. */
export function scoreZai(pits: Pit[]) {
  const per = pits.map(p => (p.dug ? 0.4 : 0) + (p.dug && p.manure ? 0.3 : 0) + (p.dug && p.seed === 'good' ? 0.3 : 0));
  const early = pits.filter(p => p.seed === 'early').length;
  return { score: clamp01(per.reduce((n, x) => n + x, 0) / pits.length), early, ready: pits.filter(p => p.dug && p.manure && p.seed === 'good').length };
}

/* ================================================================== */
/* Push-pull                                                           */
/* ================================================================== */

/** The field from above: an edge of border cells all round, and inside it maize rows with a gap between each pair. */
export const PP = { w: 8, h: 7, moths: 20 };
export type PpCell = 'border' | 'maize' | 'gap';
export type PpPlant = 'desmodium' | 'grass';
export const ppKind = (i: number): PpCell => {
  const x = i % PP.w;
  const y = Math.floor(i / PP.w);
  if (x === 0 || y === 0 || x === PP.w - 1 || y === PP.h - 1) return 'border';
  return y % 2 === 1 ? 'maize' : 'gap';
};
export const PP_CELLS = Array.from({ length: PP.w * PP.h }, (_, i) => i);
const PP_BORDER = PP_CELLS.filter(i => ppKind(i) === 'border');
const PP_MAIZE = PP_CELLS.filter(i => ppKind(i) === 'maize');
const PP_GAP = PP_CELLS.filter(i => ppKind(i) === 'gap');
/** The gap cells beside a maize cell (above and below). */
const gapsBy = (i: number) => [i - PP.w, i + PP.w].filter(j => j >= 0 && j < PP.w * PP.h && ppKind(j) === 'gap');

export type MothFate = 'trapped' | 'pushed' | 'eggs';
export interface Moth {
  from: number;
  to: number;
  fate: MothFate;
  /** it flew in toward the maize and desmodium drove it back out first */
  turned: boolean;
}
/** The share of moths the border grass pulls in as they arrive; the share desmodium alone drives off for good (with no
    grass at the edge to take them, the rest come back and lay their eggs). */
export const PP_PULL = 0.6;
export const PP_PUSH_ALONE = 0.55;

/** The moths fly in from the edge toward a maize plant: the border grass pulls most of them in; desmodium beside the
    maize drives the others back out, into the grass if it is there. Push and pull work best together. */
export function mothRun(plants: Record<number, PpPlant>, seed: number): Moth[] {
  const r = rng(seed);
  return Array.from({ length: PP.moths }, () => {
    const from = PP_BORDER[Math.floor(r() * PP_BORDER.length)];
    const to = PP_MAIZE[Math.floor(r() * PP_MAIZE.length)];
    const pull = r();
    const push = r();
    const grass = plants[from] === 'grass';
    if (grass && pull < PP_PULL) return { from, to, fate: 'trapped' as const, turned: false };
    if (gapsBy(to).some(g => plants[g] === 'desmodium')) {
      if (grass) return { from, to, fate: 'trapped' as const, turned: true };
      return { from, to, fate: push < PP_PUSH_ALONE ? ('pushed' as const) : ('eggs' as const), turned: true };
    }
    return { from, to, fate: 'eggs' as const, turned: false };
  });
}

/** Maize plants with striga (witchweed) in their roots: every one without desmodium beside it. */
export const strigaOf = (plants: Record<number, PpPlant>) => PP_MAIZE.filter(i => !gapsBy(i).some(g => plants[g] === 'desmodium'));

export function scorePushPull(plants: Record<number, PpPlant>, seed: number) {
  const moths = mothRun(plants, seed);
  const safe = moths.filter(m => m.fate !== 'eggs').length / moths.length;
  const striga = strigaOf(plants).length;
  const borderGrass = PP_BORDER.filter(i => plants[i] === 'grass').length / PP_BORDER.length;
  const gapDesmo = PP_GAP.filter(i => plants[i] === 'desmodium').length / PP_GAP.length;
  // grass inside the field pulls moths in among the maize; desmodium on the edge does not trap them
  const wrong = PP_GAP.filter(i => plants[i] === 'grass').length + PP_BORDER.filter(i => plants[i] === 'desmodium').length;
  const layout = Math.max(0, (borderGrass + gapDesmo) / 2 - wrong * 0.05);
  const score = 0.55 * safe + 0.25 * (1 - striga / PP_MAIZE.length) + 0.2 * layout;
  return { score: clamp01(score), moths, striga, wrong, borderGrass, gapDesmo };
}

/* ================================================================== */
/* Kisiki hai (FMNR)                                                   */
/* ================================================================== */

export type StemKind = 'strong' | 'thin' | 'crooked' | 'broken';
export const STEM_NAME: Record<StemKind, string> = { strong: 'tall, straight and strong', thin: 'thin and weak', crooked: 'crooked', broken: 'broken and dying' };
export interface Stem {
  kind: StemKind;
  /** its lean from upright, in degrees */
  angle: number;
  /** its height, as a share of the tallest */
  height: number;
}
export const FMNR = { stumps: 4, stems: 7, keepMin: 3, keepMax: 5 };

/** The stumps of the day's field: each with 3 to 5 strong stems among the weak ones. */
export function stumpsFor(seed: number): Stem[][] {
  const r = rng(seed);
  const weak: StemKind[] = ['thin', 'crooked', 'broken'];
  return Array.from({ length: FMNR.stumps }, () => {
    const strong = 3 + Math.floor(r() * 3);
    const kinds: StemKind[] = [...Array(strong).fill('strong'), ...Array.from({ length: FMNR.stems - strong }, () => weak[Math.floor(r() * weak.length)])];
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    return kinds.map((kind, i) => ({
      kind,
      angle: -40 + (80 * i) / (FMNR.stems - 1) + (r() - 0.5) * 6,
      height: kind === 'strong' ? 0.85 + r() * 0.15 : kind === 'thin' ? 0.55 + r() * 0.25 : kind === 'crooked' ? 0.6 + r() * 0.2 : 0.35 + r() * 0.2,
    }));
  });
}

/** cut[stump][stem]: the stems cut. Each stump scores for every stem decided right, less if 3 to 5 are not kept. */
export function scoreFmnr(stumps: Stem[][], cut: boolean[][]) {
  const per = stumps.map((stems, s) => {
    const kept = stems.filter((_, i) => !cut[s]?.[i]);
    const right = stems.filter((st, i) => (st.kind === 'strong') === !cut[s]?.[i]).length / stems.length;
    const inRange = kept.length >= FMNR.keepMin && kept.length <= FMNR.keepMax;
    return { kept: kept.length, right, inRange, score: right * (inRange ? 1 : 0.6) };
  });
  return { score: clamp01(per.reduce((n, p) => n + p.score, 0) / per.length), per };
}

/* ================================================================== */
/* Drought-tolerant seed and intercropping                             */
/* ================================================================== */

export type SeasonId = 'short' | 'long' | 'false';
export type CropId = 'hybrid' | 'dtmaize' | 'sorghum' | 'millet';
export type PartnerId = 'none' | 'beans' | 'cowpea' | 'pigeon';
export type PlantWhen = 'dry' | 'onset' | 'late';
export interface SeedChoice {
  crop: CropId;
  partner: PartnerId;
  when: PlantWhen;
}

/** Sixteen weeks of rain, 0 (none) to 1 (plenty), for each kind of season. */
export const SEASONS: Record<SeasonId, { name: string; forecast: string; rain: number[] }> = {
  short: { name: 'Short rains that end early', forecast: 'The forecast: rains start on time but stop after about two months.', rain: [0.9, 0.9, 0.8, 0.9, 0.8, 0.7, 0.7, 0.6, 0.5, 0.3, 0.1, 0.05, 0, 0, 0, 0] },
  long: { name: 'Good long rains', forecast: 'The forecast: normal to above-normal rain for four months.', rain: [0.8, 0.9, 0.9, 0.8, 0.9, 0.9, 0.8, 0.8, 0.9, 0.8, 0.7, 0.7, 0.6, 0.5, 0.4, 0.3] },
  false: { name: 'A false start', forecast: 'The forecast: an early shower, then a dry spell, then the real rains about a month later.', rain: [0.7, 0.05, 0, 0.1, 0.8, 0.9, 0.9, 0.8, 0.8, 0.7, 0.6, 0.5, 0.4, 0.2, 0.1, 0] },
};
export const SEASON_IDS = Object.keys(SEASONS) as SeasonId[];

/** weeks: how long it grows; need: the rain it needs to grow fully; bags: its harvest in a good season (an acre) */
export const CROPS: Record<CropId, { name: string; weeks: number; need: number; bags: number; does: string }> = {
  hybrid: { name: 'Long-season hybrid maize', weeks: 15, need: 0.75, bags: 10, does: 'The biggest harvest, if the rain lasts the whole season' },
  dtmaize: { name: 'Early drought-tolerant maize', weeks: 11, need: 0.5, bags: 8, does: 'Ready in under three months; copes with a dry spell' },
  sorghum: { name: 'Sorghum', weeks: 12, need: 0.4, bags: 6.5, does: 'Tough in the dry; a smaller harvest' },
  millet: { name: 'Pearl millet', weeks: 10, need: 0.3, bags: 5, does: 'The toughest of all; the smallest harvest' },
};
export const PARTNERS: Record<PartnerId, { name: string; weeks: number; need: number; bags: number; cut: number; does: string }> = {
  none: { name: 'Nothing between the rows', weeks: 0, need: 1, bags: 0, cut: 0, does: 'Bare soil between the rows' },
  beans: { name: 'Beans', weeks: 10, need: 0.55, bags: 2.5, cut: 0.05, does: 'Food and nitrogen; needs fair rain' },
  cowpea: { name: 'Cowpeas', weeks: 10, need: 0.35, bags: 2.5, cut: 0.05, does: 'Food, leaves and nitrogen; copes with the dry' },
  pigeon: { name: 'Pigeon peas', weeks: 16, need: 0.3, bags: 2, cut: 0.03, does: 'Deep roots; harvested after the maize' },
};
export const WHEN_PLANT: Record<PlantWhen, string> = { dry: 'Before the rain, into dry soil', onset: 'When the soil is wet a hand deep', late: 'Three weeks after the rains start' };

/** The week the real rains start: the first of two wet weeks in a row. */
export const onsetOf = (rain: number[]) => Math.max(0, rain.findIndex((r, i) => r >= 0.5 && (rain[i + 1] ?? 0) >= 0.5));
export const plantWeek = (rain: number[], when: PlantWhen) => (when === 'dry' ? 0 : when === 'onset' ? onsetOf(rain) : onsetOf(rain) + 3);

/** How well a crop grows from week p: its water each week against its need, counted twice at flowering. */
function growth(rain: number[], p: number, weeks: number, need: number) {
  let sum = 0;
  let n = 0;
  for (let w = 0; w < weeks; w++) {
    const f = Math.min(1, (rain[p + w] ?? 0) / need);
    const flowering = w >= weeks * 0.5 && w < weeks * 0.75;
    sum += f * (flowering ? 2 : 1);
    n += flowering ? 2 : 1;
  }
  // the seed sprouts in the first shower and dies in the dry weeks after it
  const failed = (rain[p + 1] ?? 0) < 0.2 && (rain[p + 2] ?? 0) < 0.2;
  return { factor: Math.pow(sum / Math.max(1, n), 1.5) * (failed ? 0.25 : 1), failed };
}

/** A season grown: the bags of the main crop and of the one between the rows. */
export function seasonOf(season: SeasonId, c: SeedChoice) {
  const rain = SEASONS[season].rain;
  const p = plantWeek(rain, c.when);
  const crop = CROPS[c.crop];
  const part = PARTNERS[c.partner];
  const g = growth(rain, p, crop.weeks, crop.need);
  const main = crop.bags * g.factor * (1 - part.cut);
  const pg = c.partner === 'none' ? { factor: 0, failed: false } : growth(rain, p, part.weeks, part.need);
  const second = part.bags * pg.factor;
  return { week: p, main: Math.round(main * 10) / 10, second: Math.round(second * 10) / 10, total: Math.round((main + second) * 10) / 10, failed: g.failed, legume: c.partner !== 'none' };
}

const ALL_CHOICES: SeedChoice[] = (Object.keys(CROPS) as CropId[]).flatMap(crop =>
  (Object.keys(PARTNERS) as PartnerId[]).flatMap(partner => (Object.keys(WHEN_PLANT) as PlantWhen[]).map(when => ({ crop, partner, when }))),
);
/** The best that could be done in a season, and the choice that does it (planting into dry soil is never the advice). */
export function bestOf(season: SeasonId) {
  let best = { total: 0, choice: ALL_CHOICES[0] };
  for (const c of ALL_CHOICES) {
    if (c.when === 'dry') continue;
    const t = seasonOf(season, c).total;
    if (t > best.total) best = { total: t, choice: c };
  }
  return best;
}

/** The score for one season: the food grown against the best that could be; planting into dry soil is a gamble. */
export function scoreSeason(season: SeasonId, c: SeedChoice) {
  const r = seasonOf(season, c);
  const best = bestOf(season);
  return { score: clamp01((r.total / best.total) * (c.when === 'dry' ? 0.85 : 1)), result: r, best };
}

/* ================================================================== */
/* Resting the land                                                    */
/* ================================================================== */

/* Six farms over a few seasons. Each season every farm is cropped, or rested under natural fallow or a green-manure
   cover crop. A cropped farm's harvest follows its soil (src/soil: the same soil numbers as the six farms), and the
   crop wears the soil out, faster when it has been cropped many seasons in a row; a rest brings it back. The family
   needs ROT.need bags a season: what is short is bought at market, at twice the price. The soil left at the end counts
   too: each point grows about half a bag over the seasons after. */

export const ROT = {
  farms: 6,
  seasons: 4,
  /** the daily drill's game is shorter */
  drillSeasons: 2,
  /** farms that must be planted each season */
  minPlanted: 3,
  /** bags a farm grows at the starting soil */
  bags: 10,
  /** bags the family needs a season; each bag short costs `hungry` bags */
  need: 36,
  hungry: 2,
  /** bags the cover crop's seed costs, a farm */
  coverBags: 1,
  /** what a point of soil left at the end is worth, in bags (the seasons after) */
  soilWorth: 0.45,
};

export interface RotFarm {
  soil: number;
  /** seasons cropped in a row */
  streak: number;
}
export type RotPick = RestKind | null;

const round1r = (x: number) => Math.round(x * 10) / 10;

/** The six farms at the start: some rich, some worn out, some cropped many seasons in a row. */
export function rotStart(seed: number): RotFarm[] {
  const r = rng(seed);
  return Array.from({ length: ROT.farms }, () => ({ soil: Math.round(30 + r() * 55), streak: Math.floor(r() * 5) }));
}

/** The bags a cropped farm grows on this soil. */
export const rotBags = (soil: number) => round1r(ROT.bags * soilFactor(soil));

/** One season grown: each farm's bags, the soil after, the cover seed paid and the bags short of the family's need. */
export function rotSeason(farms: RotFarm[], picks: RotPick[]) {
  const per = farms.map((f, i) => (picks[i] ? 0 : rotBags(f.soil)));
  const bags = round1r(per.reduce((n, x) => n + x, 0));
  const cover = picks.filter(p => p === 'cover').length * ROT.coverBags;
  const short = round1r(Math.max(0, ROT.need - bags));
  const next = farms.map((f, i): RotFarm => {
    const p = picks[i];
    const soil = p ? f.soil + REST[p].soil : f.soil + SOIL.cropped - (f.streak + 1 >= SOIL.streakFrom ? SOIL.streakLoss : 0);
    return { soil: Math.round(Math.max(SOIL.min, Math.min(SOIL.max, soil))), streak: p ? 0 : f.streak + 1 };
  });
  return { farms: next, per, bags, cover, short };
}

/** A plan for every season played out: the food, the cover seed, the bags short, the soil left, and its value in bags. */
export function rotRun(start: RotFarm[], plan: RotPick[][]) {
  let farms = start;
  let food = 0;
  let cover = 0;
  let short = 0;
  for (const picks of plan) {
    const r = rotSeason(farms, picks);
    food += r.bags;
    cover += r.cover;
    short += r.short;
    farms = r.farms;
  }
  const soil = farms.reduce((n, f) => n + f.soil, 0);
  return { farms, food: round1r(food), cover, short: round1r(short), soil, value: food - cover - short * ROT.hungry + soil * ROT.soilWorth };
}

/** Ways a farmer might go about it, for the yardstick: never rest; rest the poorest one or two, under cover or fallow. */
const poorest = (n: number, kind: RestKind) => (farms: RotFarm[]): RotPick[] => {
  const order = farms.map((_, i) => i).sort((a, b) => farms[a].soil - farms[b].soil || farms[b].streak - farms[a].streak);
  const pick = new Set(order.slice(0, n));
  return farms.map((_, i) => (pick.has(i) ? kind : null));
};
const WAYS: ((farms: RotFarm[]) => RotPick[])[] = [farms => farms.map(() => null), poorest(1, 'cover'), poorest(2, 'cover'), poorest(1, 'fallow'), poorest(2, 'fallow')];

function wayRun(start: RotFarm[], seasons: number, way: (farms: RotFarm[]) => RotPick[]) {
  let farms = start;
  const plan: RotPick[][] = [];
  for (let k = 0; k < seasons; k++) {
    const picks = way(farms);
    plan.push(picks);
    farms = rotSeason(farms, picks).farms;
  }
  return rotRun(start, plan);
}

/** The yardsticks for a start: never resting, and the best of the simple ways. */
export function rotRefs(start: RotFarm[], seasons: number) {
  const runs = WAYS.map(w => wayRun(start, seasons, w));
  return { never: runs[0].value, best: Math.max(...runs.map(r => r.value)) };
}

/** The score: never resting is one star; doing as well as the best simple rotation (or better) is three. */
export function scoreRot(start: RotFarm[], plan: RotPick[][]) {
  const run = rotRun(start, plan);
  const ref = rotRefs(start, plan.length);
  const score = ref.best > ref.never ? 0.3 + (0.7 * (run.value - ref.never)) / (ref.best - ref.never) : 1;
  return { score: Math.max(0.05, clamp01(score)), run, ref };
}
