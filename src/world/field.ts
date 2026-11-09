/* The farm world's field work: what each of the six farms needs doing by hand, tile by tile.

   A farm is a plot of 4 × 5 tiles, in four mini plots A to D: its columns, left to right (plots/data.ts). Each job (dig, sow, fertilize, cut weeds, water, spray, harvest…) is done by
   the farmer walking over the tiles with the right tool or load; the work done is a bit mask per farm and job.
   No pictures or three.js here, so the saved game can use it. */

import { PRESCRIBE, followUpTitle } from '../care/data';
import { CARE, CARE_JOBS, PLOTS_PER_FARM, PLOT_LETTERS, careApplies, careDay, plotStart, type CareJob, type PlotKind } from '../plots/data';
import {
  CHECK_DAYS,
  DAMAGE,
  canTreat,
  checkKey,
  currentDay,
  hazardFor,
  plotsOf,
  type FollowUp,
  type Plan,
  type Trial,
  type TrialHazard,
} from '../trials/model';

export const COLS = 4;
export const ROWS = 5;
export const TILES = COLS * ROWS;
/** How far from the farmer a tile gets worked: two passes cover a farm's four columns. */
export const WORK_REACH = 1.3;
export const FULL = (1 << TILES) - 1;
/** world units per tile */
export const TILE = 1.2;

/** Plot centres in the world (x right, z towards the camera): Farms 1–3 in the back row, 4–6 in front. */
export const PLOTS: { x: number; z: number }[] = [
  { x: -8, z: -4.6 },
  { x: 0, z: -4.6 },
  { x: 8, z: -4.6 },
  { x: -8, z: 4.6 },
  { x: 0, z: 4.6 },
  { x: 8, z: 4.6 },
];
export const PLOT_W = COLS * TILE;
export const PLOT_D = ROWS * TILE;

/** Which mini plot a tile is in: its column. */
export const plotOfTile = (i: number) => i % COLS;
/** The tiles of a mini plot. */
export function plotMask(plot: number) {
  let m = 0;
  for (let i = plot; i < TILES; i += COLS) m |= 1 << i;
  return m;
}
/** The plots that have any of these tiles. */
export const plotsIn = (bits: number) => Array.from({ length: PLOTS_PER_FARM }, (_, p) => p).filter(p => bits & plotMask(p));
/** "Plot A", "Plots B and C"… for the plots that have any of these tiles. */
export const plotLetters = (bits: number) => {
  const l = plotsIn(bits).map(p => PLOT_LETTERS[p]);
  return l.length > 1 ? `Plots ${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}` : `Plot ${l[0] ?? ''}`;
};

/** The plots planted by this day (or due to be): every plot, unless the cycle is staggered. */
export function plantedBy(t: Pick<Trial, 'stagger'>, day: number) {
  let m = 0;
  for (let p = 0; p < PLOTS_PER_FARM; p++) if (plotStart(p, t.stagger) <= Math.max(1, day)) m |= plotMask(p);
  return m;
}

export function tileCenter(farm: number, i: number) {
  const p = PLOTS[farm];
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { x: p.x + (col - (COLS - 1) / 2) * TILE, z: p.z + (row - (ROWS - 1) / 2) * TILE };
}

/** Where the farm's sign stands: at the path side, below the plot. */
export const signOf = (farm: number) => ({ x: PLOTS[farm].x + PLOT_W / 2 + 0.35, z: PLOTS[farm].z + PLOT_D / 2 + 0.3 });

export type Carry = 'seeds' | 'fertilizer' | 'water' | 'sprayer' | null;

export const CARRY_NAME: Record<Exclude<Carry, null>, string> = {
  seeds: 'Seed sack',
  fertilizer: 'Fertilizer bag',
  water: 'Watering can',
  sprayer: 'Sprayer',
};

export interface Field {
  /** the cycle this work belongs to; a new cycle starts with an empty field */
  cycle: number;
  /** done tiles, by `${farm}:${job}` */
  marks: Record<string, number>;
  carry: Carry;
  /** the tractor or oxen have been hired this cycle */
  hired: boolean;
  /** tiles done from the tractor seat, by `${farm}:${job}` (the tractor bonus counts these) */
  byTractor?: Record<string, number>;
  /** the farm jobs whose tractor bonus has been paid this cycle, as `${farm}:${job}` */
  bonus?: string[];
}

export const emptyField = (cycle = 0): Field => ({ cycle, marks: {}, carry: null, hired: false });

/** A treatment the farmer does by hand after reading a problem right. */
export type TreatJob = 'weed' | 'water' | 'feed' | 'spray' | 'drain' | 'goat' | 'birds';

export const TREAT_JOB: Partial<Record<TrialHazard, TreatJob>> = {
  weeds: 'weed',
  drought: 'water',
  nitrogen: 'feed',
  armyworm: 'spray',
  disease: 'spray',
  flood: 'drain',
  livestock: 'goat',
  wildlife: 'birds',
};

export const JOB_CARRY: Partial<Record<string, Exclude<Carry, null>>> = {
  sow: 'seeds',
  feed: 'fertilizer',
  setupFeed: 'fertilizer',
  water: 'water',
  spray: 'sprayer',
};

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Some tiles of a farm, picked the same way every time (weeds and puddles grow there). */
export function someTiles(seed: string, count: number) {
  let mask = 0;
  let h = hash(seed);
  for (let n = 0; n < 60 && popcount(mask) < count; n++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    mask |= 1 << (h % TILES);
  }
  return mask;
}

export function popcount(m: number) {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
}

/** The tiles a job needs done. Fertilizer at planting skips a plot that gets none; spraying skips the check strip. */
export function needOf(job: string, t: Pick<Trial, 'cycle' | 'plans' | 'plots'>, farm: number, day = 0) {
  if (job === 'weed') return someTiles(`w:${t.cycle}:${farm}:${day}`, 7);
  if (job === 'drain') return someTiles(`p:${t.cycle}:${farm}:${day}`, 5);
  if (job === 'goat' || job === 'birds') return 1;
  if (job === 'setupFeed' || job === 'spray') {
    const rows = plotsOf(t, farm);
    return rows.reduce((m, r, p) => ((job === 'setupFeed' ? r.fert === 'none' : r.sprayer === 'none') ? m : m | plotMask(p)), 0);
  }
  return FULL;
}

export const marksOf = (f: Field, cycle: number) => (f.cycle === cycle ? f.marks : {});
export const doneMask = (f: Field, cycle: number, farm: number, job: string) => marksOf(f, cycle)[`${farm}:${job}`] ?? 0;
export const isDone = (f: Field, t: Pick<Trial, 'cycle'>, farm: number, job: string, need = FULL) => (doneMask(f, t.cycle, farm, job) & need) === need;

/** Land prep with oxen or a tractor is hired, not walked. */
export const machinePrep = (p: Plan) => p.land === 'ox' || p.land === 'tractor';

/** The setup jobs of a farm, in order: prepare the land, sow, then fertilizer at planting (if any plot gets some). */
export function setupJobs(t: Pick<Trial, 'cycle' | 'plans' | 'plots'>, farm: number): string[] {
  const jobs = ['prep', 'sow'];
  if (needOf('setupFeed', t, farm)) jobs.push('setupFeed');
  return jobs;
}

/** The tiles of a setup job due by this day: all of them, or in a staggered cycle the plots planted by then. */
export const setupNeed = (job: string, t: Trial, farm: number, day: number) => needOf(job, t, farm) & plantedBy(t, day);

/** The first setup job a farm still needs today, or null once every plot due by today is planted. */
export function setupLeft(f: Field, t: Trial, farm: number, day: number): string | null {
  for (const job of setupJobs(t, farm)) {
    const need = setupNeed(job, t, farm, day);
    if (need && !isDone(f, t, farm, job, need)) return job;
  }
  return null;
}

/** The plots still to be planted on later days (staggered cycles), as a tile mask. */
export const plantLater = (t: Trial, day: number) => FULL & ~plantedBy(t, day);

/* ---------------- each plot's care after planting (staggered cycles) ---------------- */

/** The tiles that need a care job by this day: the plots it is due on (from its day to the last check day), less
    the plots that do not get it (no top-dress after plain DAP, no spray on the check strip). */
export function careNeed(t: Trial, farm: number, job: CareJob, day: number): number {
  if (!t.stagger || day < 1 || day > CHECK_DAYS) return 0;
  const rows = plotsOf(t, farm);
  let m = 0;
  for (let p = 0; p < PLOTS_PER_FARM; p++) if (careDay(p, job, true) <= day && careDay(p, job, true) <= CHECK_DAYS && careApplies(job, rows[p])) m |= plotMask(p);
  return m;
}

/** A plot's care still to do on a farm today, in calendar order. Its work is marked under the care job's name. */
export function plotCareLeft(f: Field, t: Trial, farm: number, day: number): { job: CareJob; key: string; need: number }[] {
  const out: { job: CareJob; key: string; need: number }[] = [];
  for (const job of CARE_JOBS) {
    const need = careNeed(t, farm, job, day);
    const left = need & ~doneMask(f, t.cycle, farm, job);
    if (left) out.push({ job, key: job, need: left });
  }
  return out;
}

/** What a plot is doing on a day, for the plot board and hints: planting, its care, or growing. */
export function plotStage(f: Field, t: Trial, farm: number, plot: number, day: number): string {
  if (!t.stagger) return '';
  const start = plotStart(plot, true);
  const m = plotMask(plot);
  if (day > CHECK_DAYS) return 'Harvest';
  if (day < start) return `Plant on day ${start}`;
  if ((doneMask(f, t.cycle, farm, 'sow') & m) !== m) return 'Planting today';
  const rows = plotsOf(t, farm);
  const due = CARE_JOBS.filter(j => careApplies(j, rows[plot]) && careDay(plot, j, true) <= day && careDay(plot, j, true) <= CHECK_DAYS && (doneMask(f, t.cycle, farm, j) & m) !== m);
  if (due.length) return due.map(j => CARE[j].title).join(' + ');
  return 'Growing';
}

/** A spray treatment or follow-up has been done on this farm this cycle (its plots keep their sprayers after it). */
export function sprayDone(f: Field, t: Trial, farm: number): boolean {
  for (let day = 1; day <= CHECK_DAYS; day++) {
    if (TREAT_JOB[hazardFor(t, farm, day)] === 'spray' && t.checks[checkKey(farm, day)]?.treated) return true;
    if (t.followUps?.some(u => u.farm === farm && u.day === day && u.job === 'spray' && u.done)) return true;
    if (doneMask(f, t.cycle, farm, `t${day}`) && TREAT_JOB[hazardFor(t, farm, day)] === 'spray') return true;
  }
  return !!doneMask(f, t.cycle, farm, 'borer');
}

/** Why a plot's input can no longer be changed (it is in the ground), or null. */
export function plotLocked(f: Field, t: Trial, farm: number, plot: number, kind: PlotKind): string | null {
  if (t.phase !== 'growing') return null;
  const m = plotMask(plot);
  if (kind === 'seed' && doneMask(f, t.cycle, farm, 'sow') & m) return 'Sown';
  if (kind === 'fert' && doneMask(f, t.cycle, farm, 'setupFeed') & m) return 'Spread';
  if (kind === 'sprayer' && plotsOf(t, farm)[plot].sprayer && sprayDone(f, t, farm)) return 'In use';
  return null;
}

/** A farm read right today whose fix has not been picked yet (the farm world asks for the fix before the work). */
export function fixLeft(t: Trial, farm: number, day: number): TrialHazard | null {
  if (day < 1 || day > CHECK_DAYS) return null;
  const rec = t.checks[checkKey(farm, day)];
  if (!rec?.right || rec.treated || rec.fix) return null;
  const h = hazardFor(t, farm, day);
  if (!TREAT_JOB[h] || !canTreat(h, t.plans[farm]) || !PRESCRIBE[h]) return null;
  return h;
}

/** The treatment a farm is waiting for today: read right, the fix picked, treatable, and not yet done by hand. */
export function treatLeft(f: Field, t: Trial, farm: number, day: number): { job: TreatJob; key: string; need: number; hazard: TrialHazard } | null {
  if (day < 1 || day > CHECK_DAYS) return null;
  const rec = t.checks[checkKey(farm, day)];
  if (!rec?.right || rec.treated) return null;
  const h = hazardFor(t, farm, day);
  const job = TREAT_JOB[h];
  if (!job || !canTreat(h, t.plans[farm])) return null;
  if (PRESCRIBE[h] && !rec.fix) return null;
  const grown = plantedBy(t, day);
  const need = needOf(job, t, farm, day) & grown || grown;
  const key = `t${day}`;
  if (isDone(f, t, farm, key, need)) return null;
  return { job, key, need, hazard: h };
}

/** The follow-up care a farm is due today and has not done yet. Its work is marked under `f${day}`. */
export function followUpLeft(f: Field, t: Trial, farm: number, day: number): { job: TreatJob; key: string; need: number; hazard: TrialHazard; follow: FollowUp } | null {
  if (day < 1 || day > CHECK_DAYS) return null;
  const u = t.followUps?.find(x => x.farm === farm && x.day === day && !x.done);
  if (!u) return null;
  const job = u.job as TreatJob;
  const grown = plantedBy(t, day);
  const need = needOf(job, t, farm, 100 + day) & grown || grown;
  const key = `f${day}`;
  if (isDone(f, t, farm, key, need)) return null;
  return { job, key, need, hazard: u.hazard, follow: u };
}

/** The work by hand a farm is waiting for today: its treatment first, then its follow-up. */
export const careLeft = (f: Field, t: Trial, farm: number, day: number) => treatLeft(f, t, farm, day) ?? followUpLeft(f, t, farm, day);

export const treatCost = (h: TrialHazard) => DAMAGE[h].treat;

/** Whether any job left today still uses what the farmer is carrying (if not, it is put down). */
export function carryNeeded(f: Field, t: Trial, day: number): boolean {
  if (!f.carry) return false;
  return t.plans.some((_, farm) => {
    const setup = setupLeft(f, t, farm, day);
    if (setup) return JOB_CARRY[setup] === f.carry;
    const tr = treatLeft(f, t, farm, day);
    const fu = followUpLeft(f, t, farm, day);
    if ((!!tr && JOB_CARRY[tr.job] === f.carry) || (!!fu && JOB_CARRY[fu.job] === f.carry)) return true;
    return plotCareLeft(f, t, farm, day).some(c => CARE[c.job].carry === f.carry);
  });
}

/** The spray jobs waiting today, by farm: what the safety kit and product questions at the shed are for. */
export function sprayJobs(f: Field, t: Trial, day: number): { farm: number; hazard: TrialHazard }[] {
  const out: { farm: number; hazard: TrialHazard }[] = [];
  t.plans.forEach((_, farm) => {
    if (setupLeft(f, t, farm, day)) return;
    const tr = treatLeft(f, t, farm, day);
    if (tr?.job === 'spray') out.push({ farm, hazard: tr.hazard });
    const fu = followUpLeft(f, t, farm, day);
    if (fu?.job === 'spray') out.push({ farm, hazard: fu.hazard });
  });
  return out;
}

/** The day the farms are on, or 0 when no farms are growing. */
export const fieldDay = (t: Trial | null, today: number) => (t && t.phase === 'growing' ? currentDay(t, today) : 0);

export const harvestReady = (t: Trial | null, today: number) => fieldDay(t, today) > CHECK_DAYS;
export const allHarvested = (f: Field, t: Trial) => t.plans.every((_, i) => isDone(f, t, i, 'harvest'));

/** What the farmer should do next, for the task card. */
export interface Task {
  title: string;
  /** a short line under the title */
  note?: string;
  /** what it pays or costs, shown with a coin */
  coins?: number;
  points?: number;
  icon: TaskIcon;
  /** where to walk to: a farm's plot, its sign, or a named place */
  target: { farm: number; at: 'plot' | 'sign' } | { place: Place };
}

export type Place = 'mission' | 'shed-seeds' | 'shed-fertilizer' | 'shed-sprayer' | 'pond' | 'hire' | 'market' | 'house';
export type TaskIcon = 'plan' | 'hoe' | 'seeds' | 'fertilizer' | 'check' | 'weed' | 'water' | 'spray' | 'drain' | 'goat' | 'birds' | 'tractor' | 'corn' | 'sleep' | 'wait' | 'results';

const CARE_ICON: Record<CareJob, TaskIcon> = { weeding: 'weed', topdress: 'fertilizer', borer: 'spray' };

/** Points for each plot's care done (staggered cycles). */
export const CARE_POINTS = 5;

export const JOB_WORDS: Record<string, { title: string; icon: TaskIcon }> = {
  weed: { title: 'Cut the weeds on', icon: 'weed' },
  water: { title: 'Water', icon: 'water' },
  feed: { title: 'Top-dress', icon: 'fertilizer' },
  spray: { title: 'Spray', icon: 'spray' },
  drain: { title: 'Dig drains on', icon: 'drain' },
  goat: { title: 'Chase the goat off', icon: 'goat' },
  birds: { title: 'Scare the birds off', icon: 'birds' },
};

const PICK: Record<Exclude<Carry, null>, Place> = { seeds: 'shed-seeds', fertilizer: 'shed-fertilizer', water: 'pond', sprayer: 'shed-sprayer' };

function needCarry(f: Field, item: Exclude<Carry, null>, then: Task): Task {
  if (f.carry === item) return then;
  const words: Record<Exclude<Carry, null>, string> = { seeds: 'Get seeds', fertilizer: 'Get fertilizer', water: 'Fill the watering can', sprayer: 'Get the sprayer' };
  return { title: words[item], note: `Then: ${then.title}`, icon: item === 'sprayer' ? 'spray' : item, target: { place: PICK[item] } };
}

export function nextTask(f: Field, t: Trial | null, today: number, coins: number): Task {
  if (!t) return { title: 'Plan your farms', note: 'Grow maize two ways', icon: 'plan', target: { place: 'mission' } };
  if (t.phase === 'plan') return { title: 'Plan your farms', note: `Cycle ${t.cycle}`, icon: 'plan', target: { place: 'mission' } };
  if (t.phase === 'done') return { title: 'See the results', note: `Cycle ${t.cycle}`, icon: 'results', target: { place: 'mission' } };
  const day = currentDay(t, today);
  const name = (i: number) => `Farm ${i + 1}`;
  // planting comes first: every farm dug, then every farm sown, then fed (fewer trips to the shed)
  const stageOf = (i: number) => ['prep', 'sow', 'setupFeed'].indexOf(setupLeft(f, t, i, day) ?? '');
  const waiting = t.plans.map((_, i) => i).filter(i => stageOf(i) >= 0);
  const first = Math.min(...waiting.map(stageOf));
  for (const i of waiting.filter(i => stageOf(i) === first)) {
    const job = setupLeft(f, t, i, day)!;
    // in a staggered cycle, the plots planted today
    const left = setupNeed(job, t, i, day) & ~doneMask(f, t.cycle, i, job);
    const where = t.stagger ? `${plotLetters(left)} today` : '';
    if (job === 'prep') {
      if (machinePrep(t.plans[i]))
        return { title: t.plans[i].land === 'tractor' ? 'Hire the tractor' : 'Hire the oxen', note: `to plough ${name(i)}${where ? ` · ${where}` : ''}`, icon: 'tractor', target: { place: 'hire' } };
      const verb = t.plans[i].land === 'slash' ? 'Clear' : t.plans[i].land === 'mulch' ? 'Mulch' : 'Dig';
      return { title: `${verb} ${name(i)}`, note: where || 'Walk over every row', icon: 'hoe', target: { farm: i, at: 'plot' } };
    }
    if (job === 'sow') return needCarry(f, 'seeds', { title: `Sow ${name(i)}`, note: where || 'Walk over every row', icon: 'seeds', target: { farm: i, at: 'plot' } });
    return needCarry(f, 'fertilizer', { title: `Fertilize ${name(i)}`, note: where ? `${where} · at planting` : 'At planting', icon: 'fertilizer', target: { farm: i, at: 'plot' } });
  }
  if (day > CHECK_DAYS) {
    const left = t.plans.findIndex((_, i) => !isDone(f, t, i, 'harvest'));
    if (left >= 0) return { title: `Harvest ${name(left)}`, note: 'The cobs are dry', icon: 'corn', target: { farm: left, at: 'plot' } };
    return { title: 'Collect Corn', note: 'Sell at the market', icon: 'corn', target: { place: 'market' } };
  }
  // a farm read right whose fix is still to be picked
  for (let i = 0; i < t.plans.length; i++) {
    if (fixLeft(t, i, day)) return { title: `Choose the fix for ${name(i)}`, note: 'At its sign', icon: 'check', target: { farm: i, at: 'sign' } };
  }
  // today's checks, and the work a right call asks for
  for (let i = 0; i < t.plans.length; i++) {
    const tr = treatLeft(f, t, i, day);
    if (tr) {
      const w = JOB_WORDS[tr.job];
      const then: Task = { title: `${w.title} ${name(i)}`, coins: -treatCost(tr.hazard), icon: w.icon, target: { farm: i, at: 'plot' } };
      const item = JOB_CARRY[tr.job];
      if (item && coins >= treatCost(tr.hazard)) return needCarry(f, item, then);
      return then;
    }
  }
  // follow-up care due today (no coins: the work is what counts)
  for (let i = 0; i < t.plans.length; i++) {
    const fu = followUpLeft(f, t, i, day);
    if (fu) {
      const then: Task = { title: followUpTitle(fu.hazard, name(i)), note: 'Follow-up care', icon: JOB_WORDS[fu.job].icon, target: { farm: i, at: 'plot' } };
      const item = JOB_CARRY[fu.job];
      return item ? needCarry(f, item, then) : then;
    }
  }
  const unchecked = t.plans.findIndex((_, i) => !t.checks[checkKey(i, day)]);
  if (unchecked >= 0) return { title: `Check ${name(unchecked)}`, note: `Day ${day} of ${CHECK_DAYS}`, points: 100, icon: 'check', target: { farm: unchecked, at: 'sign' } };
  // each plot's own care (staggered cycles): weeding and the top-dress the day after planting, a spray the day after
  for (let i = 0; i < t.plans.length; i++) {
    const care = plotCareLeft(f, t, i, day);
    // what the farmer carries first, so one trip to the shed does every farm
    const c = care.find(x => CARE[x.job].carry && CARE[x.job].carry === f.carry) ?? care[0];
    if (c) {
      const then: Task = { title: `${CARE[c.job].title} ${name(i)}`, note: `${plotLetters(c.need)} · plot care`, points: CARE_POINTS * plotsIn(c.need).length, icon: CARE_ICON[c.job], target: { farm: i, at: 'plot' } };
      const item = CARE[c.job].carry;
      return item ? needCarry(f, item, then) : then;
    }
  }
  if (t.clock === 'fast') return { title: day >= CHECK_DAYS ? 'Sleep till harvest' : `Sleep till day ${day + 1}`, note: 'Every farm is checked', icon: 'sleep', target: { place: 'house' } };
  return { title: 'Come back tomorrow', note: `Day ${day + 1} starts tomorrow`, icon: 'wait', target: { place: 'mission' } };
}
