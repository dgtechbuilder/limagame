/* Four mini plots on every farm: an on-farm trial, where each plot gets a different seed, fertilizer, sprayer,
   tractor and tool, side by side under the same weather and care, and the harvest shows what each one did.

   From the second cycle in the farm world the plots are planted a day apart (Plot A on day 1 … Plot D on day 4), and
   each one then has its own care calendar: weeding (and a top-dress) the day after planting, a spray against stalk
   borer the day after that. So on any day the four plots of a farm are at different stages, and there is planting,
   weeding, feeding and spraying to do every day.

   Every word and number the player learns from is here, so an agronomist can review them without touching code. The
   numbers are proposed, for that review (see docs/plot-trials-plan.md). No pictures or screens here, so the saved
   game can use it. */

import type { Forecast, TrialHazard } from '../trials/model';
import { IMPL, LAYOUTS, TRACTORS, fitOf, type ImplId, type TractorKind } from '../tractor/data';

/** Plots A to D are a farm's four columns of tiles, left to right. */
export const PLOTS_PER_FARM = 4;
export const PLOT_LETTERS = ['A', 'B', 'C', 'D'] as const;
export const plotName = (p: number) => `Plot ${PLOT_LETTERS[p]}`;

/** A plot's share of a farm's potential harvest. */
export const PLOT_SHARE = 1 / PLOTS_PER_FARM;

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
  /** it has a CAN top-dress, done by hand or with the spreader the day after the plot is planted */
  topDress?: true;
  /** how much of a hungry week's loss the plot suffers (1 = all of it) */
  hunger: number;
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
    topDress: true,
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
    topDress: true,
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

/** What each tractor type does to a plot it works. */
export const TRACTOR_PLOT: Record<TractorId, { fuel: number; compaction: number; speed: number; teach: string }> = {
  twoWheel: { fuel: 4, compaction: 1, speed: 0.7, teach: 'Walk-behind: you steer it by the handles. It does not pack the soil and uses the least fuel, but it is the slowest.' },
  compact: { fuel: 6, compaction: 1, speed: 0.85, teach: 'Light: it does not pack the soil. Slow, and cheap on fuel.' },
  standard: { fuel: 9, compaction: 0.99, speed: 1, teach: 'Packs the soil a little. Middle speed and fuel.' },
  large: { fuel: 14, compaction: 0.96, speed: 1.25, teach: 'Fastest, but heavy wheels pack the soil (less grain), and it burns the most fuel.' },
};

/** Land turned by a tractor: the yield factor of its land prep (a hand hoe is 0.95, oxen 1). */
export const TRACTOR_LAND_FACTOR = 1.03;

export type PlotJob = 'prep' | 'sow' | 'setupFeed' | 'weeding' | 'topdress' | 'spray' | 'harvest';

/** The job each tool does when the tractor drives over a plot (the spreader also top-dresses: TOOL_JOBS). */
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

/** Every job a tool can do: the spreader feeds at planting and top-dresses later. */
export const toolJobs = (tool: ImplId): PlotJob[] => (tool === 'spreader' ? ['setupFeed', 'topdress'] : [TOOL_JOB[tool]]);

export const JOB_INFO: Record<PlotJob, { name: string; when: string }> = {
  prep: { name: 'Prepare the land', when: 'before planting' },
  sow: { name: 'Sow', when: 'at planting' },
  setupFeed: { name: 'Fertilize', when: 'at planting' },
  weeding: { name: 'Weed', when: 'the day after planting' },
  topdress: { name: 'Top-dress', when: 'the day after planting, on DAP + CAN plots' },
  spray: { name: 'Spray', when: 'two days after planting, and when a pest or disease is found' },
  harvest: { name: 'Harvest', when: 'when the cobs are dry' },
};

/** What each tool is for, for the tool picker. */
export const TOOL_USE: Record<ImplId, string> = {
  plough: 'Hard ground and old stalks: it turns the soil over and buries them. The first job of the season.',
  harrow: 'Ground already ploughed but lumpy: it breaks the clods into a fine, level seedbed.',
  ridger: 'Dry ground with a channel to bring water in (or wet ground to drain): it digs furrows and ridges.',
  planter: 'Sowing maize: one seed every 25 cm in rows 75 cm apart.',
  drill: 'Sowing small seeds such as beans or wheat in close rows. Too close for maize.',
  cultivator: 'Weeding: its tines run between the maize rows the day after a plot is planted.',
  spreader: 'Spreading fertilizer evenly at planting, and the CAN top-dress the day after.',
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
export const MISFIT_COST: Record<PlotJob, number> = { prep: 0.15, sow: 0.12, setupFeed: 0.08, weeding: 0, topdress: 0, spray: 0, harvest: 0.15 };

/** The tool that suits a job on a farm, for the picker's hints. */
export function rightTool(job: PlotJob, farm: number): ImplId {
  if (job === 'prep') return prepNeed(farm).tool;
  return ({ sow: 'planter', setupFeed: 'spreader', weeding: 'cultivator', topdress: 'spreader', spray: 'sprayer', harvest: 'maizeH' } as const)[job];
}

export const TOOLS = Object.keys(TOOL_JOB) as ImplId[];
export const toolName = (k: ImplId) => IMPL[k].name;
export const tractorName = (k: TractorId) => TRACTORS.find(t => t.id === k)!.name;

/* ---------------- plots a day apart, each with its own care ---------------- */

/** Days between one plot's planting and the next one's (staggered cycles only). */
export const PLOT_STAGGER = 1;
/** The day a plot is planted: all on day 1, or a day apart when the cycle is staggered (Plot A day 1 … Plot D day 4). */
export const plotStart = (plot: number, stagger?: boolean) => (stagger ? 1 + plot * PLOT_STAGGER : 1);

export type CareJob = 'weeding' | 'topdress' | 'borer';
export const CARE_JOBS: CareJob[] = ['weeding', 'topdress', 'borer'];

/** A plot's care after planting, in a staggered cycle. Proposed numbers, for the agronomist's review. */
export const CARE: Record<CareJob, { after: number; title: string; done: string; job: PlotJob; carry?: 'fertilizer' | 'sprayer'; teach: string }> = {
  weeding: {
    after: 1,
    title: 'Weed',
    done: 'weeded',
    job: 'weeding',
    teach: 'Weeds take the water and food meant for young maize. A plot not weeded loses a tenth of its grain.',
  },
  topdress: {
    after: 1,
    title: 'Top-dress',
    done: 'top-dressed',
    job: 'topdress',
    carry: 'fertilizer',
    teach: 'DAP + CAN only pays when the CAN goes on: without the top-dress the nitrogen runs out and the plot grows like DAP alone.',
  },
  borer: {
    after: 2,
    title: 'Spray against stalk borer',
    done: 'sprayed against stalk borer',
    job: 'spray',
    carry: 'sprayer',
    teach: 'Stalk borer tunnels into young stems. Each plot loses grain to it unless sprayed, as well as its sprayer reaches the funnels.',
  },
};

/** What missed care costs a plot: weeding a share of its yield, the top-dress a share of its fertilizer's. */
export const CARE_MISSED = { weeding: 0.1, topdress: 0.2 };
/** The share of a plot's yield stalk borer takes unless it is sprayed (the check strip shows it every cycle). */
export const STALK_BORER = 0.08;

/** The day a plot's care is due. */
export const careDay = (plot: number, job: CareJob, stagger?: boolean) => plotStart(plot, stagger) + CARE[job].after;

/** Whether a plot gets this care at all: a top-dress only after DAP + CAN (or the double dose), no spray on the check strip. */
export function careApplies(job: CareJob, r: Pick<PlotRecord, 'fert' | 'sprayer'>): boolean {
  if (job === 'topdress') return !!fertOf(r.fert).topDress;
  if (job === 'borer') return (r.sprayer ?? 'knapsack') !== 'none';
  return true;
}

/* ---------------- one farm's four plots ---------------- */

export interface PlotRecord {
  seed: SeedId;
  fert: FertId;
  /** chosen before the farm's first spray, kept all season */
  sprayer?: SprayerId;
  /** the tractor type that works this plot (claimed by the first tile it works) */
  tractor?: TractorId;
  /** the tool used for each job done by tractor on this plot */
  tools?: Partial<Record<PlotJob, ImplId>>;
  /** the care done on this plot after planting, in a staggered cycle */
  care?: Partial<Record<CareJob, true>>;
}

/** Plots A to D start like this on every farm, so farms stay comparable; the player changes them on the plot board. */
export const DEFAULT_SEEDS: SeedId[] = ['certified', 'dt', 'opv', 'saved'];
export const DEFAULT_FERTS: FertId[] = ['none', 'basalTop', 'manure', 'basal'];
export const DEFAULT_SPRAYERS: SprayerId[] = ['knapsack', 'none', 'mist', 'boom'];

export const defaultPlots = (): PlotRecord[] => DEFAULT_SEEDS.map((seed, p) => ({ seed, fert: DEFAULT_FERTS[p], sprayer: DEFAULT_SPRAYERS[p] }));

/** Old saves (before plots): all four plots follow the farm plan. */
export const legacyPlots = (seed: string, fert: string): PlotRecord[] =>
  Array.from({ length: PLOTS_PER_FARM }, () => ({ seed: (SEEDS.some(x => x.id === seed) ? seed : 'certified') as SeedId, fert: (FERTS.some(x => x.id === fert) ? fert : 'basal') as FertId }));

export type PlotKind = 'seed' | 'fert' | 'sprayer';

export const seedOf = (id: SeedId) => SEEDS.find(x => x.id === id)!;
export const fertOf = (id: FertId) => FERTS.find(x => x.id === id)!;
export const sprayerOf = (id: SprayerId) => SPRAYERS.find(x => x.id === id)!;

export const OPTIONS: { [K in PlotKind]: InputOption[] } = { seed: SEEDS, fert: FERTS, sprayer: SPRAYERS };
export const KIND_WORDS: Record<PlotKind, { title: string; one: string; shed: string; rule: string }> = {
  seed: { title: 'Seeds', one: 'seed', shed: 'the seed shed', rule: 'Each seed goes on one plot of a farm, so you can compare them side by side.' },
  fert: { title: 'Fertilizer', one: 'fertilizer', shed: 'the fertilizer shed', rule: 'Each fertilizer goes on one plot of a farm. Leave one plot with none to see what fertilizer adds.' },
  sprayer: { title: 'Sprayers', one: 'sprayer', shed: 'the sprayer shed', rule: 'Each sprayer is used on one plot of a farm, all season. One plot stays unsprayed as a check.' },
};

/** Coins a plot's input costs (a quarter of a farm's). */
export const plotCost = (kind: PlotKind, id: string) => Math.round((OPTIONS[kind].find(x => x.id === id)?.cost ?? 0) * PLOT_SHARE);

/** Put an input on a plot. If another plot of the farm has it, the two swap, so each input stays on one plot. */
export function setPlotInput(rows: PlotRecord[], kind: PlotKind, plot: number, value: string): PlotRecord[] {
  const out = rows.map(r => ({ ...r }));
  const old = out[plot][kind];
  const other = out.findIndex((r, i) => i !== plot && r[kind] === value);
  (out[plot] as unknown as Record<string, unknown>)[kind] = value;
  if (other >= 0) (out[other] as unknown as Record<string, unknown>)[kind] = old;
  return out;
}

/** Why a tractor can't work a plot of a farm with this type and tool, or null if it can. There are four tractor types
    for the four plots, so every plot of a farm can have its own; a tool can work any number of plots. */
export function tractorBlock(rows: PlotRecord[], plot: number, tractor: TractorId, tool: ImplId, job: PlotJob = TOOL_JOB[tool]): string | null {
  const here = rows[plot];
  if (here.tractor && here.tractor !== tractor) return `${plotName(plot)} is the ${tractorName(here.tractor).toLowerCase()} tractor's plot. Each tractor works one plot of a farm, so you can compare them.`;
  const mine = rows.findIndex((r, i) => i !== plot && r.tractor === tractor);
  if (!here.tractor && mine >= 0) {
    const left = TRACTORS.filter(k => !rows.some(r => r.tractor === k.id)).map(k => k.name.toLowerCase());
    return `The ${tractorName(tractor).toLowerCase()} tractor already works ${plotName(mine)} on this farm.${left.length ? ` Take the ${left.join(' or ')} tractor to ${plotName(plot)}.` : ''}`;
  }
  const done = here.tools?.[job];
  if (done && done !== tool) return `${plotName(plot)} was already worked with the ${toolName(done).toLowerCase()}.`;
  return null;
}

/** Hazards whose damage a plot's inputs change. */
export const SEED_HAZARD: Partial<Record<TrialHazard, 'drought' | 'rust'>> = { drought: 'drought', disease: 'rust' };
