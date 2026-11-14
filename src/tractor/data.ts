/* From Wakala Agent: the tractor drive before planting, on a farm whose plan says Tractor hire.

   Everything that teaches or pays is here as data: the three tractors, the eight implements, how much of a job a
   wrong implement still does, the six farms' fields, and every shilling figure with its source (or marked as an
   estimate). Shillings are real-world information shown in the summary only; Lima's coins stay the only money in the
   game. No pictures or screens here. */

/* ---------------- money: real-world figures, shown in the summary only ---------------- */

export interface MoneyFigure {
  value: number;
  unit: string;
  /** what it is, in a few words */
  what: string;
  /** where the figure comes from; absent for game estimates */
  source?: { name: string; url: string };
  /** a game estimate still to check against real quotes */
  estimate?: true;
}

const EPRA = { name: 'Techish, 14 Oct 2026: EPRA Nairobi caps, 15 Oct to 14 Nov 2026', url: 'https://tech-ish.com/2026/10/14/petrol-rises-to-kes-226-96-in-nairobi-and-kerosene-jumps-kes-28-49/' };
const BEYOND = { name: 'Beyond Forest, 2026: ploughing cost per acre in Kenya', url: 'https://www.beyondforest.org/post/ploughing-cost-per-acre-in-kenya-2026-guide-virgin-vs-uncultivated-land-explained' };
const FARMBIZ = { name: 'FarmBiz Africa: tractor services and farmer earnings', url: 'https://farmbizafrica.com/tractors-services-increase-farmer-earnings-lower-production-costs/' };

/** Copied from Wakala Agent's README (4 Nov 2026). */
export const MONEY = {
  diesel: { value: 228, unit: 'KSh a litre', what: 'Diesel, Nairobi pump price cap', source: EPRA },
  wage: { value: 400, unit: 'KSh a person-day', what: 'Hand labour (KSh 3,000 to 5,000 a day, shown at 10 times; the game uses 4,000)', source: FARMBIZ },
  ploughHire: { value: 3000, unit: 'KSh an acre', what: 'Tractor ploughing hire', source: BEYOND },
  harrowHire: { value: 1500, unit: 'KSh an acre', what: 'Tractor harrowing hire', source: BEYOND },
  ridgeHire: { value: 2000, unit: 'KSh an acre', what: 'Tractor ridging hire', estimate: true },
  plantHire: { value: 2000, unit: 'KSh an acre', what: 'Tractor planting hire', estimate: true },
  spreadHire: { value: 1000, unit: 'KSh an acre', what: 'Fertilizer spreading hire', estimate: true },
  sprayHire: { value: 1200, unit: 'KSh an acre', what: 'Boom spraying hire', estimate: true },
  maizeHarvestHire: { value: 3500, unit: 'KSh an acre', what: 'Maize harvester hire', estimate: true },
  beanHarvestHire: { value: 3000, unit: 'KSh an acre', what: 'Bean harvester hire', estimate: true },
  ploughDays: { value: 24, unit: 'person-days an acre', what: 'Hand ploughing', source: FARMBIZ },
  harrowDays: { value: 10, unit: 'person-days an acre', what: 'Breaking clods by hand', estimate: true },
  ridgeDays: { value: 16, unit: 'person-days an acre', what: 'Digging furrows by hand', estimate: true },
  plantDays: { value: 6, unit: 'person-days an acre', what: 'Planting by hand', estimate: true },
  spreadDays: { value: 2, unit: 'person-days an acre', what: 'Spreading fertilizer by hand', estimate: true },
  sprayDays: { value: 3, unit: 'person-days an acre', what: 'Spraying by hand', estimate: true },
  maizeHarvestDays: { value: 12, unit: 'person-days an acre', what: 'Harvesting maize by hand', estimate: true },
  beanHarvestDays: { value: 10, unit: 'person-days an acre', what: 'Harvesting beans by hand', estimate: true },
  co2: { value: 2.68, unit: 'kg CO₂ a litre of diesel', what: 'Carbon dioxide from burning diesel', estimate: true },
} satisfies Record<string, MoneyFigure>;

/** One farm in Lima is a sixth of an acre. */
export const FARM_ACRES = 1 / 6;

/* ---------------- how much better a tractor is than walking ---------------- */

/** A tractor works a swath this many times as wide as a farmer on foot, so the same ground takes a third of the time. */
export const TRACTOR_EDGE = 3;
/** A tractor also drives a little faster than the farmer walks (the farmer's pace is 1). */
export const RIDE_SPEED = 1.4;
/** The big jobs a tractor does in the farm world: plough, plant, spread fertilizer at planting, harvest. Small jobs
    (weeds, puddles, watering, spraying, top-dressing, animals) stay on foot. */
export const TRACTOR_JOBS = ['prep', 'sow', 'setupFeed', 'harvest'] as const;
/** Extra points for using a tractor, on top of everything the work already pays. */
export const TRACTOR_BONUS = {
  /** a farm-world job (plough, plant, fertilize, harvest) done mostly from the tractor seat, once per farm and job */
  perJob: 30,
  /** kept for old saves' wording; a farm finished from the seat pays perJob */
  perPlot: 10,
  /** the first scored drive on a farm each cycle */
  perDrive: 25,
};

/* ---------------- rewards, in Lima's scale ---------------- */

export const TRACTOR_REWARD = {
  /** coins for each point of the score (out of 100) */
  coinsPerScore: 1.5,
  /** points for each star above the farm's best this cycle */
  pointsPerStar: 50,
  /** 'improvement': a second try on the same farm pays only for the score above the best so far, so "Try again" can
      not be replayed for coins. 'full' (as in Wakala) paid every finished drive in full, which a player could farm. */
  retryPays: 'improvement' as 'improvement' | 'full',
  /** autopilot jobs earn at most this many stars */
  autopilotStars: 2,
};

/* ---------------- tractors and implements ---------------- */

export interface TractorKind {
  id: 'compact' | 'standard' | 'large';
  name: string;
  hp: number;
  /** drive speed, game pixels a second */
  slow: number;
  fast: number;
  /** turning rate, radians a second */
  w: number;
  /** diesel use against a standard tractor */
  fuel: number;
  /** hire price against a standard tractor */
  hire: number;
  /** points off the climate score for packing the soil down */
  soil: number;
  /** how big it is drawn */
  size: number;
  /** 1 to 5, for the cards */
  meters: Record<string, number>;
  note: string;
}

/** Wakala */
export const TRACTORS: TractorKind[] = [
  { id: 'compact', name: 'Compact', hp: 35, slow: 65, fast: 100, w: 3.4, fuel: 0.7, hire: 0.8, soil: 0, size: 0.85, meters: { Speed: 2, Turning: 5, 'Fuel use': 1, 'Hire cost': 1 }, note: 'Light and cheap to run. Slow, and it struggles with heavy implements.' },
  { id: 'standard', name: 'Standard', hp: 60, slow: 80, fast: 135, w: 3, fuel: 1, hire: 1, soil: 5, size: 1, meters: { Speed: 3, Turning: 3, 'Fuel use': 3, 'Hire cost': 3 }, note: 'A good all-rounder for a small farm.' },
  { id: 'large', name: 'Large', hp: 100, slow: 95, fast: 160, w: 2.3, fuel: 1.5, hire: 1.35, soil: 15, size: 1.2, meters: { Speed: 5, Turning: 1, 'Fuel use': 5, 'Hire cost': 5 }, note: 'Fast and strong, but it turns wide, burns more fuel and packs the soil down.' },
];

export type ImplId = 'plough' | 'harrow' | 'ridger' | 'planter' | 'drill' | 'spreader' | 'sprayer' | 'maizeH' | 'beanH';

export interface Implement {
  name: string;
  does: string;
  /** working width, game pixels */
  w: number;
  /** heavy: a compact tractor slows down and burns more pulling it */
  heavy?: boolean;
  /** works in front of the tractor (the harvesters) */
  front?: boolean;
  /** litres of diesel an acre (game estimate) */
  lpa: number;
  /** hire, KSh an acre (MONEY) */
  hire: MoneyFigure;
  /** the same work by hand, person-days an acre (MONEY) */
  manual: MoneyFigure;
}

/** Wakala's eight, and a fertilizer spreader (new). The drive plays the before-planting jobs; the tractor in the farm
    world uses them all (plots/data.ts says which job each one does). */
export const IMPL: Record<ImplId, Implement> = {
  plough: { name: 'Disc plough', does: 'Turns over hard soil and buries old stalks.', w: 22, heavy: true, lpa: 8, hire: MONEY.ploughHire, manual: MONEY.ploughDays },
  harrow: { name: 'Disc harrow', does: 'Breaks clods into a fine, level seedbed.', w: 30, lpa: 5, hire: MONEY.harrowHire, manual: MONEY.harrowDays },
  ridger: { name: 'Ridger', does: 'Digs furrows and ridges for water to run along.', w: 12, lpa: 6, hire: MONEY.ridgeHire, manual: MONEY.ridgeDays },
  planter: { name: 'Maize planter', does: 'Drops maize seed and fertilizer in wide rows.', w: 24, lpa: 4, hire: MONEY.plantHire, manual: MONEY.plantDays },
  drill: { name: 'Seed drill', does: 'Sows small seeds such as beans in close rows.', w: 30, lpa: 4, hire: MONEY.plantHire, manual: MONEY.plantDays },
  spreader: { name: 'Fertilizer spreader', does: 'Throws fertilizer evenly over the ground from a spinning disc.', w: 40, lpa: 2, hire: MONEY.spreadHire, manual: MONEY.spreadDays },
  sprayer: { name: 'Boom sprayer', does: 'Sprays growing crops against pests and disease.', w: 46, lpa: 2, hire: MONEY.sprayHire, manual: MONEY.sprayDays },
  maizeH: { name: 'Maize harvester', does: 'Picks and shells maize cobs, row by row.', w: 26, heavy: true, front: true, lpa: 10, hire: MONEY.maizeHarvestHire, manual: MONEY.maizeHarvestDays },
  beanH: { name: 'Bean harvester', does: 'Cuts and threshes dry bean plants.', w: 32, heavy: true, front: true, lpa: 8, hire: MONEY.beanHarvestHire, manual: MONEY.beanHarvestDays },
};

export const IMPL_ORDER: ImplId[] = ['plough', 'harrow', 'ridger', 'planter', 'drill', 'spreader', 'sprayer', 'maizeH', 'beanH'];

/** Wakala: how much of the job a wrong implement still does (0 = none of it). */
export const RELATED: Partial<Record<ImplId, Partial<Record<ImplId, number>>>> = {
  plough: { harrow: 0.5, ridger: 0.3 },
  harrow: { plough: 0.6, ridger: 0.3 },
  ridger: { plough: 0.3, harrow: 0.3 },
  planter: { drill: 0.5 },
  drill: { planter: 0.5 },
  maizeH: { beanH: 0.4 },
  beanH: { maizeH: 0.4 },
};

export const fitOf = (right: ImplId, got: ImplId) => (right === got ? 1 : (RELATED[right]?.[got] ?? 0));

/* ---------------- the six farms' fields ---------------- */

/** A rock, the water tank (circles) or a fallen trunk, the house, the pond (rectangles), in game pixels. */
export type Obstacle = { x: number; y: number; r: number; k: 'rock' | 'tank' | 'mound' } | { rect: [number, number, number, number]; k: 'trunk' | 'house' | 'pond' };

export interface FarmLayout {
  /** the field: rectangles [x, y, w, h] in the 580 × 370 drive area */
  field: [number, number, number, number][];
  /** the field slopes down the screen: ploughing across it (left–right) keeps the soil from washing away */
  slope?: boolean;
  /** a water channel along the top of the field */
  channel?: boolean;
  /** how the ground looks before the work */
  ground: 'stubble' | 'dry' | 'clods' | 'grass';
  /** in the way, every time */
  obs: Obstacle[];
  /** the before-planting job */
  prep: {
    tool: ImplId;
    /** ridging: the furrow lines (x), each from the channel down the field */
    strips?: number[];
    /** what Mama Achieng says the farm needs */
    ask: string;
    /** one line for the summary */
    lesson: string;
    /** the task, in a few words */
    task: string;
  };
}

/** Farms 1 to 4 are Wakala's four fields; Farms 5 and 6 are new, mixing the same lessons. */
export const LAYOUTS: FarmLayout[] = [
  {
    field: [[100, 70, 360, 220]],
    slope: true,
    ground: 'stubble',
    obs: [
      { x: 220, y: 130, r: 10, k: 'rock' },
      { x: 390, y: 238, r: 10, k: 'rock' },
      { rect: [262, 186, 48, 12], k: 'trunk' },
      { rect: [140, 248, 40, 11], k: 'trunk' },
    ],
    prep: { tool: 'plough', task: 'turn over the whole field', ask: 'This ground is hard and full of old stalks. It needs ploughing before the rains.', lesson: "Plough across the slope, so rain can't wash the soil away." },
  },
  {
    field: [[170, 110, 290, 210]],
    slope: true,
    channel: true,
    ground: 'dry',
    obs: [
      { x: 62, y: 98, r: 22, k: 'tank' },
      { rect: [492, 150, 64, 50], k: 'house' },
      { x: 357.5, y: 292, r: 11, k: 'mound' },
      { x: 268, y: 200, r: 8, k: 'rock' },
      { rect: [312, 150, 10, 34], k: 'trunk' },
    ],
    prep: {
      tool: 'ridger',
      strips: [200, 245, 290, 335, 380, 425],
      task: 'dig furrows from the channel down the field',
      ask: 'Water from the channel never reaches this dry farm. It needs furrows from the channel down the field.',
      lesson: 'Water only flows downhill: each furrow must start at the channel and run down the field.',
    },
  },
  {
    field: [[90, 70, 380, 220]],
    ground: 'clods',
    obs: [
      { x: 150, y: 120, r: 9, k: 'rock' },
      { x: 420, y: 122, r: 10, k: 'rock' },
      { rect: [180, 230, 44, 12], k: 'trunk' },
    ],
    prep: { tool: 'harrow', task: 'break the clods into a fine seedbed', ask: 'This farm was ploughed, but it is full of big clods. The seed needs fine soil.', lesson: 'A fine, level seedbed lets every seed come up at the same time.' },
  },
  {
    field: [[100, 95, 370, 220]],
    ground: 'stubble',
    obs: [
      { rect: [480, 15, 64, 50], k: 'house' },
      { x: 530, y: 300, r: 22, k: 'tank' },
      { rect: [20, 150, 50, 110], k: 'pond' },
      { x: 250, y: 170, r: 10, k: 'rock' },
      { rect: [360, 250, 44, 12], k: 'trunk' },
    ],
    prep: { tool: 'plough', task: 'turn over the whole field', ask: 'This farm grew maize last year. Turn the old stalks in before planting.', lesson: 'Ploughing in old stalks feeds the soil and breaks the pest cycle.' },
  },
  {
    field: [[90, 80, 380, 215]],
    ground: 'grass',
    obs: [
      { x: 170, y: 140, r: 9, k: 'rock' },
      { x: 300, y: 250, r: 10, k: 'rock' },
      { x: 410, y: 118, r: 9, k: 'rock' },
      { rect: [250, 100, 12, 44], k: 'trunk' },
    ],
    prep: { tool: 'plough', task: 'turn over the whole field', ask: 'Grass and weeds have taken this ground since last season. It needs turning over.', lesson: 'Ploughing buries the weeds and their seeds before planting.' },
  },
  {
    field: [[110, 75, 350, 220]],
    slope: true,
    ground: 'clods',
    obs: [
      { x: 200, y: 200, r: 10, k: 'rock' },
      { x: 360, y: 140, r: 9, k: 'rock' },
      { rect: [280, 240, 46, 12], k: 'trunk' },
    ],
    prep: { tool: 'harrow', task: 'break the clods into a fine seedbed', ask: 'This slope was ploughed, but the clods are big.', lesson: 'Harrow across the slope too, so rain soaks in instead of running off.' },
  },
];

export const OBS_NAME: Record<Obstacle['k'], string> = { rock: 'a rock', trunk: 'a fallen trunk', mound: 'the high spot', house: 'the house', tank: 'the water tank', pond: 'the pond' };
