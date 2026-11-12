/* A farm's inputs: the seed, fertilizer and sprayer it grows with, and the tractor and tools that worked it. Every
   farm is 20 plots (its 4 × 5 tiles: see world/field.ts), worked one plot at a time; the inputs are chosen once per
   farm and go on all 20 plots, so the six farms compare them.

   Every word and number the player learns from is here, so an agronomist can review them without touching code. The
   numbers are proposed, for that review (see docs/plot-trials-plan.md). No pictures or screens here, so the saved
   game can use it. */

import type { Forecast, TrialHazard } from '../trials/model';
import { IMPL, LAYOUTS, TRACTORS, fitOf, type ImplId, type TractorKind } from '../tractor/data';

/** Every farm is 20 plots: its 4 × 5 tiles, numbered 1 to 20 from the back left. */
export const PLOTS_PER_FARM = 20;
export const plotName = (p: number) => `Plot ${p + 1}`;

/** One set of inputs per farm (the record below): the seed, fertilizer and sprayer go on every plot. */
export const INPUT_SETS = 1;
/** An input set's share of a farm's potential harvest and of its input costs: the whole farm. */
export const PLOT_SHARE = 1 / INPUT_SETS;

/* ---------------- seeds ---------------- */

export type SeedId = 'saved' | 'certified' | 'dt' | 'opv' | 'intercrop' | 'dense';

export interface InputOption<Id extends string = string> {
  id: Id;
  /** a few words: fits a small cell */
  label: string;
  /** the full name */
  name: string;
  /** what it is and what the farmer does with it */
  does: string;
  /** when it is the right choice */
  bestFor: string;
  /** coins for a whole farm (a plot costs a quarter) */
  cost: number;
  /** a colour for its chip on the plot board and the plot letters */
  color: string;
}

export interface SeedOption extends InputOption<SeedId> {
  /** yield multiplier, by the season's rain */
  factor: Record<Forecast, number>;
  /** how much of a drought or dry-spell loss the plot suffers (1 = all of it) */
  drought: number;
  /** how much of a leaf-rust loss the plot suffers */
  rust: number;
  /** stars added to the grain's quality */
  quality: number;
  /** a row of beans grows between the maize */
  beans?: boolean;
}

export const SEEDS: SeedOption[] = [
  {
    id: 'saved',
    label: 'Saved seed',
    name: 'Saved seed',
    does: 'Grain kept from last season. It costs almost nothing, but grain from a hybrid does not breed true: the plants come up uneven and weaker.',
    bestFor: 'Only when there is no money for seed. One plot shows what it costs you.',
    cost: 10,
    color: '#a07d4b',
    factor: { normal: 0.75, dry: 0.72, wet: 0.75 },
    drought: 1,
    rust: 1.3,
    quality: -1,
  },
  {
    id: 'certified',
    label: 'Long-season hybrid',
    name: 'Certified hybrid, long season',
    does: 'New certified seed of a hybrid that grows for about 5 months. It yields the most when the rains last the whole season.',
    bestFor: 'Normal and wet seasons.',
    cost: 90,
    color: '#2f7d27',
    factor: { normal: 1, dry: 0.86, wet: 1.02 },
    drought: 1,
    rust: 1,
    quality: 0,
  },
  {
    id: 'dt',
    label: 'Drought-tolerant',
    name: 'Drought-tolerant hybrid, early',
    does: 'A hybrid bred to keep growing through dry spells. It is ready 3 to 4 weeks sooner, so a little less grain when rain is plenty.',
    bestFor: 'Dry seasons and short rains.',
    cost: 100,
    color: '#d08a1f',
    factor: { normal: 0.94, dry: 1, wet: 0.92 },
    drought: 0.5,
    rust: 1,
    quality: 0,
  },
  {
    id: 'opv',
    label: 'Open-pollinated',
    name: 'Improved open-pollinated variety',
    does: 'Cheaper certified seed of a variety that breeds true: its grain can be replanted for two or three seasons with little loss.',
    bestFor: 'A tight budget, or farmers who want to keep their own seed.',
    cost: 50,
    color: '#5aa0c8',
    factor: { normal: 0.86, dry: 0.84, wet: 0.86 },
    drought: 0.9,
    rust: 0.8,
    quality: 0,
  },
  {
    id: 'intercrop',
    label: 'Hybrid + beans',
    name: 'Hybrid with a row of beans',
    does: 'Certified hybrid in rows, with beans between the maize rows. A little less maize, plus a harvest of beans, and the beans feed the soil.',
    bestFor: 'Extra food and income from the same ground.',
    cost: 130,
    color: '#8e5bb5',
    factor: { normal: 0.95, dry: 0.9, wet: 0.95 },
    drought: 1.1,
    rust: 1,
    quality: 0,
    beans: true,
  },
  {
    id: 'dense',
    label: 'Close spacing',
    name: 'Hybrid planted twice as close',
    does: 'Certified hybrid with twice the plants. They share the water, food and light, and damp leaves spread disease.',
    bestFor: 'Rarely: it shows why spacing matters.',
    cost: 120,
    color: '#c0392b',
    factor: { normal: 0.9, dry: 0.82, wet: 0.9 },
    drought: 1.3,
    rust: 1.4,
    quality: 0,
  },
];

/* ---------------- fertilizer ---------------- */

export type FertId = 'none' | 'manure' | 'basal' | 'basalTop' | 'double';

export interface FertOption extends InputOption<FertId> {
  /** yield multiplier */
  factor: number;
  /** how much of a hungry week's loss the plot suffers (1 = all of it) */
  hunger: number;
  /** it has a CAN top-dress after planting: how it grows when the top-dress is never done (scheduled care, ROUTINE) */
  withoutTop?: { factor: number; hunger: number };
}

export const FERTS: FertOption[] = [
  {
    id: 'none',
    label: 'None',
    name: 'No fertilizer (a control plot)',
    does: 'Nothing added. The plot shows what the soil gives on its own.',
    bestFor: 'One plot on every farm, to measure what fertilizer adds.',
    cost: 0,
    color: '#9a9a9a',
    factor: 0.55,
    hunger: 1.6,
  },
  {
    id: 'manure',
    label: 'Manure',
    name: 'Farmyard manure',
    does: 'Well-rotted manure dug into the planting holes. It feeds the soil slowly and keeps it moist, but holds little nitrogen.',
    bestFor: 'Building the soil over seasons, and farms with animals.',
    cost: 60,
    color: '#7a5230',
    factor: 0.72,
    hunger: 1.1,
  },
  {
    id: 'basal',
    label: 'DAP at planting',
    name: 'DAP at planting only',
    does: 'A capful of DAP (18:46:0) in each planting hole. Strong roots early, but the nitrogen runs out by knee height.',
    bestFor: 'A start, when there is no money for a top-dress.',
    cost: 150,
    color: '#5aa0c8',
    factor: 0.75,
    hunger: 1,
  },
  {
    id: 'basalTop',
    label: 'DAP + CAN',
    name: 'DAP at planting, CAN top-dress',
    does: 'DAP in each hole at planting, then CAN (26% nitrogen) beside each plant when the maize is knee high.',
    bestFor: 'Most maize: it feeds the crop when it needs it.',
    cost: 250,
    color: '#2f7d27',
    factor: 1,
    hunger: 0.3,
    // without the CAN it is DAP at planting, and grows like it
    withoutTop: { factor: 0.75, hunger: 1 },
  },
  {
    id: 'double',
    label: 'Double dose',
    name: 'Twice the DAP and twice the CAN',
    does: 'Double of both. The extra costs a lot, washes away or burns roots, and adds almost nothing.',
    bestFor: 'Never on purpose: it shows that more is not better.',
    cost: 480,
    color: '#c0392b',
    factor: 0.95,
    hunger: 0.3,
    // a double dose of DAP alone: a little less than one dose, as the extra burns roots
    withoutTop: { factor: 0.72, hunger: 1 },
  },
];

/* ---------------- sprayers ---------------- */

export type SprayerId = 'knapsack' | 'mist' | 'boom' | 'none';

export interface SprayerOption extends InputOption<SprayerId> {
  /** on a day a pest or disease was treated: the share of the damage the spray stopped on this plot */
  cover: { armyworm: number; disease: number };
  /** yield multiplier once it has been used (the boom sprayer's wheels break tall maize) */
  damage: number;
}

export const SPRAYERS: SprayerOption[] = [
  {
    id: 'knapsack',
    label: 'Knapsack',
    name: 'Knapsack sprayer',
    does: 'A 16-litre tank on your back, pumped by hand. Slow, but you aim the nozzle into each plant, down the funnel where armyworm hides.',
    bestFor: 'Armyworm, and small farms.',
    cost: 0,
    color: '#2f7d27',
    cover: { armyworm: 1, disease: 0.85 },
    damage: 1,
  },
  {
    id: 'mist',
    label: 'Mist blower',
    name: 'Motorised mist blower',
    does: 'A small engine blows the spray as a fine mist. Fast, and it covers the leaves well, but the mist drifts and misses deep in the funnels.',
    bestFor: 'Leaf diseases such as rust.',
    cost: 0,
    color: '#5aa0c8',
    cover: { armyworm: 0.75, disease: 1 },
    damage: 1,
  },
  {
    id: 'boom',
    label: 'Boom sprayer',
    name: 'Tractor boom sprayer',
    does: 'A long boom behind a tractor sprays a wide band in one pass. Fastest, but it cannot aim into funnels, and its wheels break tall maize.',
    bestFor: 'Big fields, young crops and weeds.',
    cost: 0,
    color: '#e0892a',
    cover: { armyworm: 0.55, disease: 0.9 },
    damage: 0.97,
  },
  {
    id: 'none',
    label: 'Check strip',
    name: 'Unsprayed check strip',
    does: 'Left unsprayed on purpose, so you can see how much the spray saved on the other plots.',
    bestFor: 'One plot, to measure what spraying does.',
    cost: 0,
    color: '#9a9a9a',
    cover: { armyworm: 0, disease: 0 },
    damage: 1,
  },
];

/* ---------------- the tractor and its tools ---------------- */

export type TractorId = TractorKind['id'];

/** What each tractor type does to a farm it works: fuel is coins per farm and job, paid the first time it works it. */
export const TRACTOR_PLOT: Record<TractorId, { fuel: number; compaction: number; speed: number; teach: string }> = {
  compact: { fuel: 24, compaction: 1, speed: 0.85, teach: 'Light: it does not pack the soil. Slowest, and cheapest on fuel.' },
  standard: { fuel: 36, compaction: 0.99, speed: 1, teach: 'Packs the soil a little. Middle speed and fuel.' },
  large: { fuel: 56, compaction: 0.96, speed: 1.25, teach: 'Fastest, but heavy wheels pack the soil (less grain), and it burns the most fuel.' },
};

/** Land turned by a tractor: the yield factor of its land prep (a hand hoe is 0.95, oxen 1). */
export const TRACTOR_LAND_FACTOR = 1.03;

export type PlotJob = 'prep' | 'sow' | 'setupFeed' | 'weeding' | 'borer' | 'topdress' | 'spray' | 'harvest';

/** The job each tool does when the tractor drives over a plot (its first job: the spreader and the boom sprayer also
    do scheduled care, toolJobs). */
export const TOOL_JOB: Record<ImplId, PlotJob> = {
  plough: 'prep',
  harrow: 'prep',
  ridger: 'prep',
  planter: 'sow',
  drill: 'sow',
  cultivator: 'weeding',
  spreader: 'setupFeed',
  sprayer: 'spray',
  maizeH: 'harvest',
  beanH: 'harvest',
};

/** Every job a tool can do: the spreader feeds at planting and top-dresses later; the boom sprayer sprays a problem
    and the stalk-borer spray. */
export const toolJobs = (tool: ImplId): PlotJob[] => (tool === 'spreader' ? ['setupFeed', 'topdress'] : tool === 'sprayer' ? ['spray', 'borer'] : [TOOL_JOB[tool]]);

export const JOB_INFO: Record<PlotJob, { name: string; when: string }> = {
  prep: { name: 'Prepare the land', when: 'before planting' },
  sow: { name: 'Sow', when: 'at planting' },
  setupFeed: { name: 'Fertilize', when: 'at planting' },
  weeding: { name: 'Weed', when: 'day 2 or 3' },
  borer: { name: 'Spray against stalk borer', when: 'day 3 or 4, maize' },
  topdress: { name: 'Top-dress', when: 'day 4 or 5, DAP + CAN farms' },
  spray: { name: 'Spray', when: 'when a pest or disease is found' },
  harvest: { name: 'Harvest', when: 'when the cobs are dry' },
};

/** What each tool is for, for the tool picker. */
export const TOOL_USE: Record<ImplId, string> = {
  plough: 'Hard ground and old stalks: it turns the soil over and buries them. The first job of the season.',
  harrow: 'Ground already ploughed but lumpy: it breaks the clods into a fine, level seedbed.',
  ridger: 'Dry ground with a channel to bring water in (or wet ground to drain): it digs furrows and ridges.',
  planter: 'Sowing maize: one seed every 25 cm in rows 75 cm apart.',
  drill: 'Sowing small seeds such as beans or wheat in close rows. Too close for maize.',
  cultivator: 'Weeding: its tines run between the rows on weeding day.',
  spreader: 'Spreading fertilizer evenly at planting, and the CAN top-dress later.',
  sprayer: 'Spraying a whole plot fast: against stalk borer, or a pest or disease.',
  maizeH: 'Picking and shelling dry maize cobs, row by row.',
  beanH: 'Cutting and threshing dry beans. On maize it drops and breaks cobs.',
};

/** What a farm's land needs before planting (the drive's field layouts: hard stalks, a water channel, clods…). */
export const prepNeed = (farm: number) => LAYOUTS[farm % LAYOUTS.length].prep;

/** How well a tool does a job on a farm: 1 = the right tool, less = a poorer job. */
export function toolFit(job: PlotJob, tool: ImplId, farm: number): number {
  if (!toolJobs(tool).includes(job)) return 0;
  if (job === 'prep') return fitOf(prepNeed(farm).tool, tool);
  if (job === 'sow') return tool === 'planter' ? 1 : 0.5;
  if (job === 'harvest') return tool === 'maizeH' ? 1 : 0.4;
  return 1;
}

/** The most a wrong tool takes off a plot's harvest, by job. */
export const MISFIT_COST: Record<PlotJob, number> = { prep: 0.15, sow: 0.12, setupFeed: 0.08, weeding: 0, borer: 0, topdress: 0, spray: 0, harvest: 0.15 };

/** The tool that suits a job on a farm, for the picker's hints. */
export function rightTool(job: PlotJob, farm: number): ImplId {
  if (job === 'prep') return prepNeed(farm).tool;
  return ({ sow: 'planter', setupFeed: 'spreader', weeding: 'cultivator', borer: 'sprayer', topdress: 'spreader', spray: 'sprayer', harvest: 'maizeH' } as const)[job];
}

/* ---------------- scheduled care after planting ---------------- */

/** Care every farm gets on set days after planting, whatever its checks show: weeding, a spray against stalk borer
    (maize) and the CAN top-dress (farms on DAP + CAN, or the double dose). Each can be done by hand or from the
    tractor seat, on either of its two days. Missing it costs the harvest (trials/model.ts). From the second cycle
    in the farm world (Trial.routine). Proposed days and numbers, for the agronomist's review. */
export type RoutineJob = 'weeding' | 'borer' | 'topdress';
export const ROUTINE_JOBS: RoutineJob[] = ['weeding', 'borer', 'topdress'];

export const ROUTINE: Record<RoutineJob, { from: number; by: number; title: string; short: string; done: string; carry?: 'fertilizer' | 'sprayer'; teach: string; missed: string }> = {
  weeding: {
    from: 2,
    by: 3,
    title: 'Weed',
    short: 'weeding',
    done: 'weeded',
    teach: 'Weeds take the water and food meant for the young crop. Weed every farm on day 2 or 3.',
    missed: 'Not weeded in time: the weeds took a tenth of the harvest.',
  },
  borer: {
    from: 3,
    by: 4,
    title: 'Spray against stalk borer',
    short: 'stalk-borer spray',
    done: 'sprayed against stalk borer',
    carry: 'sprayer',
    teach: 'Stalk borer tunnels into young maize stems. Spray the leaf funnels on day 3 or 4.',
    missed: 'Not sprayed against stalk borer: it took grain from every plant.',
  },
  topdress: {
    from: 4,
    by: 5,
    title: 'Top-dress',
    short: 'top-dress',
    done: 'top-dressed',
    carry: 'fertilizer',
    teach: 'DAP + CAN only pays when the CAN goes on: put it beside each plant on day 4 or 5.',
    missed: 'No CAN top-dress: the maize ran short of nitrogen and grew like DAP alone.',
  },
};

/** The share of the harvest a farm loses when it is not weeded on its days. */
export const WEEDS_MISSED = 0.1;
/** The share of a maize farm's harvest stalk borer takes unless it is sprayed (a farm with no sprayer always loses
    it: the check strip shows it). A spray keeps what its sprayer reaches (its armyworm cover: both hide in the funnel). */
export const STALK_BORER = 0.08;

export const TOOLS = Object.keys(TOOL_JOB) as ImplId[];
export const toolName = (k: ImplId) => IMPL[k].name;
export const tractorName = (k: TractorId) => TRACTORS.find(t => t.id === k)!.name;

/* ---------------- one farm's inputs ---------------- */

export interface PlotRecord {
  seed: SeedId;
  fert: FertId;
  /** chosen before the farm's first spray, kept all season */
  sprayer?: SprayerId;
  /** the tractor type that first worked this farm */
  tractor?: TractorId;
  /** the tool first used for each job done by tractor on this farm */
  tools?: Partial<Record<PlotJob, ImplId>>;
}

/** Every farm starts with these inputs; the player changes them on the inputs board (in the plan, or at a shed). */
export const defaultPlots = (): PlotRecord[] => [{ seed: 'certified', fert: 'basal', sprayer: 'knapsack' }];

/** Old saves (before inputs were chosen): the farm follows its plan. */
export const legacyPlots = (seed: string, fert: string): PlotRecord[] => [
  { seed: (SEEDS.some(x => x.id === seed) ? seed : 'certified') as SeedId, fert: (FERTS.some(x => x.id === fert) ? fert : 'basal') as FertId },
];

export type PlotKind = 'seed' | 'fert' | 'sprayer';

export const seedOf = (id: SeedId) => SEEDS.find(x => x.id === id)!;
export const fertOf = (id: FertId) => FERTS.find(x => x.id === id)!;
export const sprayerOf = (id: SprayerId) => SPRAYERS.find(x => x.id === id)!;

export const OPTIONS: { [K in PlotKind]: InputOption[] } = { seed: SEEDS, fert: FERTS, sprayer: SPRAYERS };
export const KIND_WORDS: Record<PlotKind, { title: string; one: string; shed: string; rule: string }> = {
  seed: { title: 'Seed', one: 'seed', shed: 'the seed shed', rule: 'One seed for the whole farm, all 20 plots. Give another farm a different seed to compare them.' },
  fert: { title: 'Fertilizer', one: 'fertilizer', shed: 'the fertilizer shed', rule: 'One fertilizer for the whole farm. Leave a farm with none to see what fertilizer adds.' },
  sprayer: { title: 'Sprayer', one: 'sprayer', shed: 'the sprayer shed', rule: 'One sprayer for the whole farm, all season. A farm with none stays unsprayed.' },
};

/** Coins an input costs a farm. */
export const plotCost = (kind: PlotKind, id: string) => Math.round((OPTIONS[kind].find(x => x.id === id)?.cost ?? 0) * PLOT_SHARE);

/** Put an input on a farm (its one input set). */
export function setPlotInput(rows: PlotRecord[], kind: PlotKind, plot: number, value: string): PlotRecord[] {
  return rows.map((r, i) => (i === plot ? { ...r, [kind]: value } : { ...r }));
}

/** Hazards whose damage a plot's inputs change. */
export const SEED_HAZARD: Partial<Record<TrialHazard, 'drought' | 'rust'>> = { drought: 'drought', disease: 'rust' };
