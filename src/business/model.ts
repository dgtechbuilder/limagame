/* The tractor business, built to Hello Tractor's game brief ("Tractor Wars: from Booking Agent to Tractor Owner").
   The player is a Booking Agent in the Narok hub territory: each day farmers book jobs on parts of their farms; the
   agent scouts a farm with Project Campbell (the agronomy advisor on the Knowledge Graph), delivers its advice,
   books each job for the hub tractor they dispatch or passes it to a partner, plans the order to drive round the
   farms, drives the tractor at each stop (the minigame in drive.ts), and runs the day. Two numbers are computed
   continuously: the Service Efficiency Ratio (acres a km) and the fulfilment rate; counted acres (physical acres ×
   unique activities) take the agent to PAYG financing of a tractor of their own, which the Marketplace then keeps
   busy year-round. Money is the business's own account, in shillings: hire prices and diesel are Wakala's real
   figures (tractor/data.ts MONEY and IMPL); everything else here is a game estimate, marked as one. Every number the
   brief calls tunable is a named constant here. No screens or pictures, so the save and the tests can use it. */

import { IMPL, MONEY, TRACTORS, type ImplId } from '../tractor/data';
import { kshText } from '../money';

/* ---------------- the map ---------------- */

/** A point on the business map, in map pixels (the map is drawn MAP_W × MAP_H). */
export interface Pt {
  x: number;
  y: number;
}

export const MAP_W = 520;
export const MAP_H = 252;
/** One map pixel, in km of road: the map is a territory about 13 km across. */
export const KM_PER_PX = 0.025;
/** The hub yard, where every day starts and ends (a node of the road map). */
export const YARD = 'yard';

/* ---------------- the calendar: Narok's year ---------------- */

/** Business days in a month: a year is 36 days of play. */
export const DAYS_A_MONTH = 3;
/** The game opens in February: land preparation for the long-rains maize. */
export const START_MONTH = 2;
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthIndex = (day: number) => START_MONTH - 1 + Math.floor((day - 1) / DAYS_A_MONTH);
/** The month a day falls in, 1 to 12. */
export const monthOf = (day: number) => (monthIndex(day) % 12) + 1;
export const yearOf = (day: number) => Math.floor(monthIndex(day) / 12) + 1;
/** A month as a key for the calendar's totals, e.g. "1-3" (year 1, March). */
export const monthKey = (day: number) => `${yearOf(day)}-${monthOf(day)}`;

/* ---------------- the five production activities (Loop D) and the tools that do them ---------------- */

export type Activity = 'landprep' | 'planting' | 'fertilizer' | 'transport' | 'harvest';
/** Equal weight in this round: each unique activity on an acre adds one multiple (the brief, Loop D). */
export const ACTIVITIES: Activity[] = ['landprep', 'planting', 'fertilizer', 'transport', 'harvest'];
export const ACTIVITY_NAME: Record<Activity, string> = { landprep: 'Land preparation', planting: 'Planting', fertilizer: 'Fertilizer application', transport: 'Transport', harvest: 'Harvesting' };

/** The jobs a farm can book, and the tool each needs on the tractor. */
export type BizTool = 'plough' | 'harrow' | 'ridger' | 'planter' | 'spreader' | 'trailer' | 'harvester' | 'combine';

export interface ToolInfo {
  name: string;
  activity: Activity;
  does: string;
  /** hire, KSh an acre */
  hire: number;
  /** litres of diesel an acre */
  lpa: number;
  /** the same work by hand, person-days an acre */
  manual: number;
  /** Wakala's implement this is, for its sources (absent: a game estimate) */
  impl?: ImplId;
}

const fromImpl = (id: ImplId, activity: Activity, name = IMPL[id].name): ToolInfo => ({ name, activity, does: IMPL[id].does, hire: IMPL[id].hire.value, lpa: IMPL[id].lpa, manual: IMPL[id].manual.value, impl: id });

/** Every tool a job can call for. Transport and the combine are game estimates; the rest are Wakala's implements. */
export const TOOLS: Record<BizTool, ToolInfo> = {
  plough: fromImpl('plough', 'landprep'),
  harrow: fromImpl('harrow', 'landprep'),
  ridger: fromImpl('ridger', 'landprep'),
  planter: fromImpl('planter', 'planting'),
  spreader: fromImpl('spreader', 'fertilizer'),
  trailer: { name: 'Trailer', activity: 'transport', does: 'Hauls inputs to the farm and the harvest to the road, in season and out of it.', hire: 1500, lpa: 2.5, manual: 3 },
  harvester: fromImpl('maizeH', 'harvest', 'Tractor harvester'),
  combine: { name: 'Combine harvester', activity: 'harvest', does: 'Cuts and threshes wheat and barley in one pass. A separate asset, not a tractor.', hire: 4500, lpa: 9, manual: 14 },
};
export const toolName = (tool: BizTool) => TOOLS[tool].name;
export const hireOf = (tool: BizTool) => TOOLS[tool].hire;
export const activityOf = (tool: BizTool) => TOOLS[tool].activity;

/* ---------------- the Knowledge Graph: Narok's crops and their windows ---------------- */

export type Crop = 'maize' | 'wheat' | 'barley' | 'beans' | 'potatoes';

export interface CropInfo {
  name: string;
  /** the months each activity is in window (1 = January); transport is year-round for every crop */
  window: Record<Exclude<Activity, 'transport'>, number[]>;
  /** harvest work: the tractor's harvester, or a combine (wheat and barley) */
  harvestTool: 'harvester' | 'combine';
  /** the land preparation tool the crop usually wants */
  prepTool: 'plough' | 'harrow' | 'ridger';
  note: string;
}

/** Narok's planting calendar (long rains March to May, short rains October to December). Seeded from public
    agronomy for Narok County; to be signed off by Hello Tractor's agronomy team before the territory ships. */
export const CROPS: Record<Crop, CropInfo> = {
  maize: { name: 'Maize', window: { landprep: [1, 2, 3], planting: [3, 4], fertilizer: [5, 6], harvest: [8, 9, 10] }, harvestTool: 'harvester', prepTool: 'plough', note: 'Planted at the start of the long rains; top-dressed knee high; harvested from August.' },
  wheat: { name: 'Wheat', window: { landprep: [3, 4, 5], planting: [5, 6], fertilizer: [7, 8], harvest: [10, 11, 12] }, harvestTool: 'combine', prepTool: 'harrow', note: 'Narok’s big crop: planted May to June, combined from October.' },
  barley: { name: 'Barley', window: { landprep: [3, 4], planting: [5, 6], fertilizer: [7], harvest: [10, 11] }, harvestTool: 'combine', prepTool: 'harrow', note: 'Grown on contract for the breweries; the same calendar as wheat, a little tighter.' },
  beans: { name: 'Beans', window: { landprep: [2, 3, 9], planting: [3, 4, 10], fertilizer: [5, 11], harvest: [6, 7, 12, 1] }, harvestTool: 'harvester', prepTool: 'harrow', note: 'Two seasons a year, with the long and the short rains.' },
  potatoes: { name: 'Potatoes', window: { landprep: [2, 3, 8, 9], planting: [3, 4, 9, 10], fertilizer: [5, 11], harvest: [7, 8, 12, 1] }, harvestTool: 'harvester', prepTool: 'ridger', note: 'Ridged, planted twice a year; the harvest is heavy to carry.' },
};
export const cropName = (c: Crop) => CROPS[c].name;

/** Is an activity in window for a crop this month? Transport is always in window. */
export const inWindow = (crop: Crop, activity: Activity, month: number) => activity === 'transport' || CROPS[crop].window[activity].includes(month);
/** The tool a crop's activity calls for. */
export function toolFor(crop: Crop, activity: Activity, prep: BizTool): BizTool {
  if (activity === 'landprep') return prep;
  if (activity === 'planting') return 'planter';
  if (activity === 'fertilizer') return 'spreader';
  if (activity === 'transport') return 'trailer';
  return CROPS[crop].harvestTool;
}
/** The months an activity is in window, in words ("March to April"). */
export function windowText(crop: Crop, activity: Activity): string {
  if (activity === 'transport') return 'all year';
  const ms = CROPS[crop].window[activity];
  return ms.length === 1 ? MONTHS[ms[0] - 1] : `${MONTHS[ms[0] - 1]} to ${MONTHS[ms[ms.length - 1] - 1]}`;
}

/* ---------------- the farms that book ---------------- */

export interface FarmPart {
  id: string;
  /** which part of the farm, in a few words */
  name: string;
  crop: Crop;
  /** its land preparation tool */
  prep: 'plough' | 'harrow' | 'ridger';
  acres: number;
  /** the tool of the job as booked (set on the parts a request names; the part's own is its prep tool) */
  tool: BizTool;
}

export interface Client {
  id: string;
  name: string;
  place: string;
  /** inside the hub territory (Loop B): Hub Manager, CX Team, demo plots, dense farms. Outside: none of that. */
  inside: boolean;
  parts: FarmPart[];
}

const part = (id: string, name: string, crop: Crop, prep: FarmPart['prep'], acres: number): FarmPart => ({ id, name, crop, prep, acres, tool: prep });

/** The farmers around the hub. Each day some of them book work on one or two parts of their farm. */
export const CLIENTS: Client[] = [
  { id: 'wanjiru', name: 'Mama Wanjiru', place: 'Ololulung’a', inside: true, parts: [part('top', 'Top field', 'maize', 'plough', 1.5), part('river', 'River strip', 'beans', 'harrow', 1)] },
  { id: 'otieno', name: 'Otieno', place: 'Narok town road', inside: true, parts: [part('maize', 'Maize block', 'maize', 'plough', 2), part('beans', 'Bean rows', 'beans', 'harrow', 1)] },
  { id: 'chebet', name: 'Chebet', place: 'Mulot', inside: true, parts: [part('slope', 'The slope', 'potatoes', 'ridger', 1), part('flat', 'Flat field', 'wheat', 'harrow', 1.5)] },
  { id: 'kamau', name: 'Kamau', place: 'Ntulele', inside: true, parts: [part('north', 'North block', 'wheat', 'plough', 2.5), part('south', 'South block', 'barley', 'harrow', 2)] },
  { id: 'akinyi', name: 'Akinyi', place: 'Ewaso Ngiro', inside: false, parts: [part('rice', 'Wet field', 'potatoes', 'ridger', 1.5), part('dry', 'Dry field', 'maize', 'plough', 1)] },
  { id: 'mutua', name: 'Mutua', place: 'Suswa plains', inside: false, parts: [part('east', 'East paddock', 'wheat', 'plough', 3), part('west', 'West paddock', 'barley', 'harrow', 2)] },
  { id: 'njeri', name: 'Njeri', place: 'Nairegie Enkare', inside: true, parts: [part('garden', 'Kitchen garden', 'beans', 'harrow', 0.5), part('maize', 'Maize field', 'maize', 'plough', 1.5)] },
  { id: 'kiprop', name: 'Kiprop', place: 'Lemek', inside: false, parts: [part('new', 'New clearing', 'maize', 'plough', 2), part('old', 'Old field', 'wheat', 'harrow', 1.5)] },
  { id: 'achieng', name: 'Mama Achieng', place: 'Kilgoris road', inside: true, parts: [part('home', 'Home field', 'maize', 'plough', 1), part('sukuma', 'Potato beds', 'potatoes', 'ridger', 0.5)] },
];
/** The hub territory: Hello Tractor's first playable territory. */
export const TERRITORY = { name: 'Narok', hub: 'Narok hub' };

export const clientOf = (id: string) => CLIENTS.find(c => c.id === id)!;
/** A booking request: one job on one part of one farm, today: client:part:tool (an old two-part key is the part's
    land preparation job). */
export type ReqKey = `${string}:${string}` | `${string}:${string}:${string}`;
export const reqKey = (client: string, partId: string, tool?: BizTool): ReqKey => (tool ? `${client}:${partId}:${tool}` : `${client}:${partId}`);
export const clientKey = (k: ReqKey) => k.split(':')[0];
export const partKey = (k: ReqKey) => k.split(':').slice(0, 2).join(':');
export const partOf = (k: ReqKey) => {
  const [c, p, t] = k.split(':');
  const client = clientOf(c);
  const base = client.parts.find(x => x.id === p)!;
  const tool = (t as BizTool | undefined) ?? base.prep;
  return { client, part: { ...base, tool }, tool, activity: activityOf(tool), crop: base.crop };
};

/* ---------------- the tractor and its work ---------------- */

/** Acres an hour for each job, with a standard tractor (game estimates; the brief: roughly 2 acres an hour ploughing
    with a 45HP at 65 to 75% field efficiency on small, irregular plots, which these rates and the drive's
    BASELINE in drive.ts stand for). */
export const ACRES_AN_HOUR: Record<BizTool, number> = { plough: 0.8, harrow: 1.4, ridger: 0.9, planter: 1, spreader: 3, trailer: 2.5, harvester: 0.7, combine: 1.6 };
/** Road speed, km an hour, and diesel on the road, litres a km (game estimates). */
export const ROAD_KMH = 20;
export const ROAD_LPKM = 0.3;
/** A working day, hours. */
export const DAY_HOURS = 9;
/** The driver's pay for a day, KSh (game estimate, near MONEY.wage for skilled work). */
export const DRIVER_WAGE = 1000;
/** Overtime: each hour past the working day costs the driver's hourly pay this many times over (game estimate). */
export const OVERTIME = 1.5;
/** What a partner pays the player for a booking passed on: a share of its hire (game estimate). */
export const PARTNER_CUT = 0.1;
/** Before the agent owns a tractor, the hub keeps this share of the hire for the tractor they dispatch (estimate). */
export const HUB_SHARE = 0.25;

export type BizTractor = 'standard' | 'large';
/** How fast each tractor works against a standard one (TRACTORS' speed, as a work rate). */
export const WORK_RATE: Record<BizTractor, number> = { standard: 1, large: 1.3 };
export const fuelFactor = (k: BizTractor) => TRACTORS.find(t => t.id === k)!.fuel;
/** What the farmer would spend doing the job by hand instead, KSh (MONEY: person-days at a day's wage). */
export const handCost = (tool: BizTool, acres: number) => Math.round(TOOLS[tool].manual * acres * MONEY.wage.value);

/** What one job leaves the business on the tractor: its hire less the diesel to do it and the hub's share (road not counted). */
export function jobKeep(b: Pick<Biz, 'tractor' | 'partners' | 'owned'>, tool: BizTool, acres: number) {
  const price = MONEY.diesel.value * (b.partners.includes('fuel') ? 1 - FUEL_DISCOUNT : 1);
  const diesel = Math.round(acres * TOOLS[tool].lpa * fuelFactor(b.tractor) * price);
  const hire = Math.round(hireOf(tool) * acres);
  const hub = b.owned.length ? 0 : Math.round(hire * HUB_SHARE);
  return { hire, diesel, hub, keep: hire - diesel - hub, partner: Math.round(hire * PARTNER_CUT) };
}

/* ---------------- partners ---------------- */

export type PartnerId = 'kimani' | 'coop' | 'fuel' | 'app' | 'county';

export interface Partner {
  id: PartnerId;
  name: string;
  kind: string;
  /** what they do for the business */
  does: string;
  /** KSh to sign up (0: free) */
  fee: number;
  /** business level it opens at */
  level: number;
}

/** Game partners, each a real kind of partner a tractor business works with. */
export const PARTNERS: Partner[] = [
  { id: 'kimani', name: 'Kimani Tractor Hire', kind: 'Tractor owner', does: 'Takes the bookings you pass on, with his own tractor. You keep 10% of the hire, and the farmer is helped.', fee: 0, level: 1 },
  { id: 'coop', name: 'Narok Farmers’ Co-op', kind: 'Farmers’ co-op', does: 'Sends you two more farms’ bookings every day.', fee: 5000, level: 2 },
  { id: 'fuel', name: 'Rafiki Fuel', kind: 'Fuel station', does: 'Sells you diesel 10% cheaper.', fee: 3000, level: 2 },
  { id: 'county', name: 'County Roads Office', kind: 'Hires tractors', does: 'Rents your tractor for a whole day, with your driver: KSh 120,000, no farms that day.', fee: 0, level: 2 },
  { id: 'app', name: 'Hello Tractor app', kind: 'Booking app', does: 'Puts your stops in the shortest order with one tap.', fee: 4000, level: 3 },
];
export const partnerOf = (id: PartnerId) => PARTNERS.find(p => p.id === id)!;
export const FUEL_DISCOUNT = 0.1;
export const COUNTY_DAY = 12000;
export const COOP_EXTRA = 2;

/* ---------------- the fleet ---------------- */

export type FleetItem = 'ridger' | 'planter' | 'spreader' | 'harvester' | 'large' | 'combine';
/** What the business can buy (KSh, game prices scaled to the game's days, not real list prices). */
export const SHOP: { id: FleetItem; name: string; does: string; price: number; level: number }[] = [
  { id: 'ridger', name: 'Ridger', does: TOOLS.ridger.does, price: 25000, level: 1 },
  { id: 'spreader', name: 'Fertilizer spreader', does: TOOLS.spreader.does, price: 20000, level: 2 },
  { id: 'planter', name: 'Maize planter', does: TOOLS.planter.does, price: 35000, level: 2 },
  { id: 'harvester', name: 'Tractor harvester', does: TOOLS.harvester.does, price: 60000, level: 3 },
  { id: 'large', name: 'Large tractor', does: 'Dispatch the hub’s large tractor: 30% faster, so more acres fit in a day. It burns 50% more diesel.', price: 90000, level: 3 },
  { id: 'combine', name: 'Combine harvester', does: 'Harvests wheat and barley. Not financed under PAYG: it comes once you own both tractors.', price: 150000, level: 4 },
];

/* ---------------- growing the business ---------------- */

export const LEVELS: { level: number; helped: number; name: string }[] = [
  { level: 1, helped: 0, name: 'Booking agent' },
  { level: 2, helped: 8, name: 'Known in the territory' },
  { level: 3, helped: 20, name: 'The ward’s booking agent' },
  { level: 4, helped: 40, name: 'A tractor business' },
  { level: 5, helped: 80, name: 'The county’s tractor service' },
];
export const levelOf = (helped: number) => [...LEVELS].reverse().find(l => helped >= l.helped)!;
export const nextLevel = (helped: number) => LEVELS.find(l => l.helped > helped) ?? null;
/** Points for the player (Lima's rewards) for each farmer helped. */
export const POINTS_A_FARMER = 20;
/** Points for a neighbourhood synchronised: three or more farms booked on the same activity the same day (Loop A). */
export const CLUSTER = { farms: 3, points: 30 };
/** Points for a clean drive at a farm (the minigame's field efficiency at or above this). */
export const CLEAN_DRIVE = { e: 0.9, points: 15 };

/* ---------------- the two numbers the engine computes (brief §5), as tunable config ---------------- */

/** Service Efficiency Ratio: acres serviced ÷ km driven. The brief's real-world v1 values are 1.0 (the floor for a
    serviceable booking) and 4.0 (a healthy cluster) acres a km; the game's territory is drawn sprawling (13 km
    across, bookings of half an acre to 3), so its thresholds are scaled to its map. Below the floor the sparsest
    stops are dropped as unserviceable (Loop C). Refine in playtesting. */
export const SER = { floor: 0.1, healthy: 0.3 };
/** A job counts as fulfilled when at least this share of it was done at the stop. */
export const FULFILLED_SHARE = 0.8;
/** Reputation (Loop C): fulfilment this high brings one more farm a day; this low, one fewer (after some days). */
export const REPUTATION = { more: 0.9, fewer: 0.6, after: 10 };

/** PAYG financing (brief §2.2, §5.4 and §7.2): the two graduation thresholds in counted acres, each tractor's daily
    acre capacity, the loan (KSh, a game price), the share of each day's hire that pays it, and the warning that
    leads to repossession. */
export const PAYG = {
  tiers: [
    { hp: 45, name: '45HP tractor', counted: 700, capacity: 4, price: 180000, tractor: 'standard' as BizTractor },
    { hp: 75, name: '75HP tractor', counted: 1235, capacity: 10, price: 400000, tractor: 'large' as BizTractor },
  ],
  /** fulfilment rate to graduate: the underwriting bar */
  fulfilment: 0.8,
  /** share of each day's hire that goes to the loan until it is paid */
  share: 0.3,
  /** repossession risk: utilisation of the daily capacity, or fulfilment, below these over a rolling window; this many
      days in a row in warning and the tractor is taken back */
  warn: { utilization: 0.5, fulfilment: 0.6, window: 7, days: 5 },
  /** days before an agent can qualify again after a repossession */
  cooldown: 7,
};
/** The hub's own bank of tractors the agent dispatches before graduating: a 75HP-class machine. */
export const HUB_CAPACITY = 10;

/* ---------------- the business's state ---------------- */

export interface DayResult {
  day: number;
  kind: 'farms' | 'county' | 'contract';
  km: number;
  bestKm: number;
  /** the order the tractor drove, and the shortest order through the same farms (farm days only) */
  route?: string[];
  best?: string[];
  efficiency?: number;
  hours?: number;
  overH?: number;
  acres: number;
  /** farmers helped by the player's tractor, and through partners */
  farmers: number;
  partnerFarmers: number;
  revenue: number;
  diesel: number;
  wage: number;
  commission: number;
  /** the hub's share of the hire (before the agent owns a tractor) */
  hubFee: number;
  /** the PAYG instalment taken from the day's hire */
  instalment: number;
  profit: number;
  /** what the farmers saved against doing the same work by hand */
  saved: number;
  /** bookings nobody took */
  missed: number;
  stars: number;
  /** the brief's two numbers for the day, and what it earned toward graduation */
  ser: number;
  booked: number;
  fulfilled: number;
  counted: number;
  /** jobs dropped as unserviceable (low SER), and jobs left unfinished at the stop */
  dropped: ReqKey[];
  unfinished: ReqKey[];
  /** the neighbourhood booked on the same activity, if one was */
  cluster?: { activity: Activity; farms: number };
  cleanFarms: number;
  points: number;
  /** PAYG after the day: what is owed, and the warning state */
  payg?: { left: number; util: number; fulfil: number; warn: number; repossessed: boolean };
  /** the marketplace contract, on a contract day */
  contract?: { hub: string; agent: string; activity: Activity };
}

export interface Owned {
  hp: 45 | 75;
  price: number;
  paid: number;
  since: number;
  /** days in a row in the warning state */
  warn: number;
}

export interface Biz {
  day: number;
  cash: number;
  helped: number;
  acres: number;
  km: number;
  partners: PartnerId[];
  tools: BizTool[];
  tractor: BizTractor;
  history: DayResult[];
  /** counted acres toward graduation: physical acres × unique activities on each part this year (Loop D) */
  counted: number;
  /** the activities done on each part this year, by client:part */
  done: Record<string, Activity[]>;
  /** every booking there was, and those closed: the fulfilment rate */
  booked: number;
  fulfilled: number;
  /** demo plots the Hub Manager runs, by crop */
  demos: Crop[];
  /** today's extra jobs, booked after Campbell's advice was accepted */
  extra: ReqKey[];
  /** farms advised today (one recommendation a farm a day), and what the farmer said */
  advised: Record<string, boolean>;
  /** the tractors financed under PAYG, first the 45HP */
  owned: Owned[];
  /** after a repossession: the day the agent may qualify again */
  requalify: number;
  /** acres and days worked by month (the booking calendar) */
  months: Record<string, { acres: number; days: number }>;
  /** marketplace contracts taken, by offer id */
  contracts: string[];
  /** Sasha's welcome has been read */
  intro: boolean;
}

export const newBiz = (): Biz => ({
  day: 1,
  cash: 20000,
  helped: 0,
  acres: 0,
  km: 0,
  partners: ['kimani'],
  tools: ['plough', 'harrow', 'trailer'],
  tractor: 'standard',
  history: [],
  counted: 0,
  done: {},
  booked: 0,
  fulfilled: 0,
  demos: [],
  extra: [],
  advised: {},
  owned: [],
  requalify: 0,
  months: {},
  contracts: [],
  intro: false,
});

const VALID_TOOLS = new Set<string>(Object.keys(TOOLS));
/** A saved business, filled in from before any field it lacks (saves from before the brief's features). */
export function bizOf(saved: Partial<Biz> | undefined): Biz {
  const b = { ...newBiz(), ...(saved ?? {}) };
  b.tools = b.tools.filter(t => VALID_TOOLS.has(t));
  if (!b.tools.includes('trailer')) b.tools = [...b.tools, 'trailer'];
  return b;
}

/** The fulfilment rate so far: closed bookings against every booking there was (1 before any). */
export const fulfilment = (b: Pick<Biz, 'booked' | 'fulfilled'>) => (b.booked ? b.fulfilled / b.booked : 1);
/** Reputation (Loop C): farms a day gained or lost from the fulfilment rate. */
export function reputation(b: Pick<Biz, 'booked' | 'fulfilled'>): number {
  if (b.booked < REPUTATION.after) return 0;
  const f = fulfilment(b);
  return f >= REPUTATION.more ? 1 : f < REPUTATION.fewer ? -1 : 0;
}
/** The tractor the agent dispatches today: the hub's, or their own under PAYG (the newest). */
export function tractorOf(b: Pick<Biz, 'owned' | 'tractor'>): { name: string; capacity: number; tractor: BizTractor; own: Owned | null } {
  const own = b.owned[b.owned.length - 1] ?? null;
  if (!own) return { name: b.tractor === 'large' ? 'the hub’s large tractor' : 'the hub tractor', capacity: HUB_CAPACITY, tractor: b.tractor, own: null };
  const tier = PAYG.tiers.find(t => t.hp === own.hp)!;
  return { name: `your ${tier.name}`, capacity: tier.capacity, tractor: tier.tractor, own };
}
/** The next PAYG tier, when the agent qualifies for it today, else null (and why not, for the screen). */
export function graduation(b: Biz): { tier: (typeof PAYG.tiers)[number]; due: boolean; why: string | null } | null {
  const tier = PAYG.tiers[b.owned.length];
  if (!tier) return null;
  const f = fulfilment(b);
  let why: string | null = null;
  if (b.counted < tier.counted) why = `${Math.ceil(tier.counted - b.counted)} more counted acres`;
  else if (f < PAYG.fulfilment) why = `a fulfilment rate of ${Math.round(PAYG.fulfilment * 100)}% (yours is ${Math.round(f * 100)}%)`;
  else if (b.day < b.requalify) why = `${b.requalify - b.day} more days after the repossession`;
  return { tier, due: !why, why };
}

/* ---------------- today's bookings ---------------- */

function rand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  };
}

/** How many farms book today: more as the business grows, two more with the co-op, one more or fewer by reputation. */
export const farmsToday = (b: Pick<Biz, 'helped' | 'partners' | 'booked' | 'fulfilled'>) => Math.max(1, Math.min(CLIENTS.length, 3 + levelOf(b.helped).level + (b.partners.includes('coop') ? COOP_EXTRA : 0) + reputation(b)));

/** How likely a part books transport rather than a field job in window (transport is the year-round earner). */
const TRANSPORT_SHARE = 0.22;

/** Today's booking requests: the same every time for a day, so a reload shows the same farms. Farms inside the
    territory book more often (density); each part books an activity in window for its crop this month, or
    transport. Jobs the farmers added after Campbell's advice (b.extra) come too. */
export function requestsFor(b: Pick<Biz, 'day' | 'helped' | 'partners' | 'booked' | 'fulfilled' | 'extra'>): ReqKey[] {
  const r = rand(`biz:${b.day}`);
  const month = monthOf(b.day);
  const order = CLIENTS.map(c => ({ c, k: r() + (c.inside ? 0 : 0.45) })).sort((a, z) => a.k - z.k).map(x => x.c);
  const base = order.slice(0, farmsToday(b)).flatMap(c => {
    const pick = r();
    const parts = pick < 0.35 ? c.parts : [c.parts[pick < 0.7 ? 0 : 1]];
    return parts.map(p => {
      const field = ACTIVITIES.filter(a => a !== 'transport' && inWindow(p.crop, a, month));
      const roll = r();
      const activity: Activity = !field.length || roll < TRANSPORT_SHARE ? 'transport' : field[Math.floor(((roll - TRANSPORT_SHARE) / (1 - TRANSPORT_SHARE)) * field.length)];
      return reqKey(c.id, p.id, toolFor(p.crop, activity, p.prep));
    });
  });
  return [...base, ...(b.extra ?? []).filter(k => !base.includes(k))];
}

/* ---------------- Project Campbell: the advisory chore (Loop A) ---------------- */

/** The sub-optimal practice Campbell flags for each activity a farmer has not booked, and the advice to deliver. */
const FLAGS: Record<Activity, { flag: string; advice: string }> = {
  landprep: { flag: 'plans to break the ground by hand, three weeks of hoeing', advice: 'a tractor turns it in a morning, ready for the rains' },
  planting: { flag: 'will plant by hand two weeks after the land is ready', advice: 'plant with the tractor right after land prep, inside the window, and every seed comes up together' },
  fertilizer: { flag: 'puts fertilizer on at planting only, nothing in the growing season', advice: 'a top-dressing while the crop grows is where the yield is' },
  transport: { flag: 'hauls seed and fertilizer in, and the harvest out, a sack at a time on a donkey', advice: 'one trailer load does the whole trip the same day' },
  harvest: { flag: 'will harvest by hand over a month, losing grain to the rain', advice: 'a tractor harvest brings it in while the price is good' },
};

export interface Scan {
  client: Client;
  part: FarmPart;
  crop: Crop;
  /** the farmer's practice Campbell flagged, and the advice (null: everything in window is already booked) */
  rec: { activity: Activity; tool: BizTool; key: ReqKey; flag: string; advice: string } | null;
  /** an activity the farmer asked about that is not in window: the lesson is the window */
  notNow: { activity: Activity; months: string } | null;
  /** how likely the farmer is to accept, and why */
  chance: number;
  chanceWhy: string[];
}

/** How likely a farmer is to accept the agent's recommendation: inside the territory the Hub Manager's demo plot and
    the CX Team's follow-up lift it (Loop B); outside there is neither. Game estimates. */
export const ACCEPT = { inside: 0.55, outside: 0.25, demo: 0.25, cx: 0.15 };
export function acceptChance(b: Pick<Biz, 'demos'>, client: Client, crop: Crop): { chance: number; why: string[] } {
  if (!client.inside) return { chance: ACCEPT.outside, why: ['outside the territory: no Hub Manager, no CX Team'] };
  const why = ['inside the territory'];
  let chance = ACCEPT.inside;
  if (b.demos.includes(crop)) {
    chance += ACCEPT.demo;
    why.push(`the Hub Manager’s ${cropName(crop).toLowerCase()} demo plot`);
  }
  chance += ACCEPT.cx;
  why.push('the CX Team’s follow-up call');
  return { chance: Math.min(0.98, chance), why };
}

/** Campbell scouts a farm: its first booked part's crop, the practice to flag and the activity to recommend (in
    window this month, not booked yet), or what is out of window. */
export function scanFarm(b: Pick<Biz, 'day' | 'demos'>, clientId: string, requests: ReqKey[]): Scan {
  const client = clientOf(clientId);
  const month = monthOf(b.day);
  const keys = requests.filter(k => clientKey(k) === clientId);
  const first = keys.length ? partOf(keys[0]).part : client.parts[0];
  const crop = first.crop;
  const booked = new Set(keys.filter(k => partKey(k) === `${clientId}:${first.id}`).map(k => partOf(k).activity));
  const open = ACTIVITIES.filter(a => !booked.has(a) && inWindow(crop, a, month) && a !== 'transport');
  const activity = open[0] ?? (!booked.has('transport') ? 'transport' : null);
  const rec = activity ? { activity, tool: toolFor(crop, activity, first.prep), key: reqKey(clientId, first.id, toolFor(crop, activity, first.prep)), ...FLAGS[activity] } : null;
  const out = ACTIVITIES.find(a => a !== 'transport' && !booked.has(a) && !inWindow(crop, a, month) && CROPS[crop].window[a][0] > month) ?? null;
  const { chance, why } = acceptChance(b, client, crop);
  return { client, part: first, crop, rec, notNow: out ? { activity: out, months: windowText(crop, out) } : null, chance, chanceWhy: why };
}

/** Does the farmer take the advice? The same answer every time for a day and a farm. */
export const farmerAccepts = (b: Pick<Biz, 'day' | 'demos'>, scan: Scan) => rand(`advice:${b.day}:${scan.client.id}:${scan.rec?.activity}`)() < scan.chance;

/** Demo plots the Hub Manager can run: one for each business level. */
export const demoSlots = (b: Pick<Biz, 'helped'>) => levelOf(b.helped).level;

/* ---------------- the community leaderboard (Loop C) ---------------- */

export const AGENTS: { name: string; hub: string }[] = [
  { name: 'Wanjala', hub: 'Narok' },
  { name: 'Naserian', hub: 'Narok' },
  { name: 'Kipchumba', hub: 'Narok' },
  { name: 'Amina', hub: 'Nakuru' },
  { name: 'Lekishon', hub: 'Narok' },
  { name: 'Wambui', hub: 'Meru' },
  { name: 'Odhiambo', hub: 'Kisumu' },
];
/** Every agent's fulfilment rate today (the others drift slowly), the player's among them, best first. */
export function leaderboard(b: Pick<Biz, 'day' | 'booked' | 'fulfilled'>, you = 'You'): { name: string; hub: string; rate: number; you: boolean }[] {
  const rows = AGENTS.map((a, i) => {
    const base = 0.62 + rand(`agent:${a.name}`)() * 0.33;
    const drift = Math.sin(b.day / 9 + i) * 0.04;
    return { name: a.name, hub: a.hub, rate: Math.max(0.4, Math.min(0.99, base + drift)), you: false };
  });
  rows.push({ name: you, hub: TERRITORY.name, rate: fulfilment(b), you: true });
  return rows.sort((p, q) => q.rate - p.rate);
}

/* ---------------- the Marketplace (Loop E) ---------------- */

/** Hello Tractor's other hub territories, with their seasons offset from Narok's: the trade partners. */
export const HUBS: { id: string; name: string; offset: number; note: string }[] = [
  { id: 'nakuru', name: 'Nakuru hub', offset: 1, note: 'a month behind Narok' },
  { id: 'kisumu', name: 'Kisumu hub', offset: -2, note: 'two months ahead, two seasons' },
  { id: 'meru', name: 'Meru hub', offset: 6, note: 'half a year out of step: short rains first' },
  { id: 'eldoret', name: 'Eldoret hub', offset: 2, note: 'two months behind' },
];

export interface Offer {
  id: string;
  hub: (typeof HUBS)[number];
  agent: string;
  activity: Activity;
  tool: BizTool;
  acres: number;
  /** the hire for the day, KSh */
  pay: number;
  /** road km there and back */
  km: number;
}

/** Peer agents in other hubs post contracts for the day: a day's work away, in an activity in window there. Simulated
    peers stand in until agents trade with each other live. */
export function offersFor(b: Pick<Biz, 'day' | 'owned' | 'tractor' | 'tools' | 'contracts'>): Offer[] {
  if (!b.owned.length) return [];
  const r = rand(`market:${b.day}`);
  const month = monthOf(b.day);
  const out: Offer[] = [];
  const crops = Object.keys(CROPS) as Crop[];
  for (const hub of HUBS) {
    if (r() < 0.45) continue;
    const there = ((month - 1 - hub.offset + 24) % 12) + 1;
    const crop = crops[Math.floor(r() * crops.length)];
    const open = ACTIVITIES.filter(a => a !== 'transport' && inWindow(crop, a, there));
    const activity = open.length && r() < 0.75 ? open[Math.floor(r() * open.length)] : 'transport';
    const tool = toolFor(crop, activity, CROPS[crop].prepTool);
    const cap = tractorOf(b).capacity;
    const acres = Math.round(Math.min(cap, 2 + r() * cap) * 2) / 2;
    const agent = AGENTS.filter(a => a.hub !== 'Narok')[Math.floor(r() * 3)]?.name ?? 'Amina';
    const id = `${b.day}:${hub.id}`;
    if (b.contracts.includes(id)) continue;
    out.push({ id, hub, agent, activity, tool, acres, pay: Math.round(hireOf(tool) * acres * 1.1), km: 30 + Math.round(r() * 30) });
  }
  return out;
}

/* ---------------- the road map of the day ---------------- */

/** A murram road between two places on the map: a gentle curve (through c), and its length in km. */
export interface Road {
  a: string;
  b: string;
  /** the curve's control point */
  c: Pt;
  km: number;
}

export interface BizMap {
  day: number;
  /** where everything is: the yard, every farm, and the crossroads */
  at: Record<string, Pt>;
  /** crossroads: road junctions with no farm */
  junctions: string[];
  roads: Road[];
  /** shortest road km between any two places, and the next place on the way */
  km: Record<string, Record<string, number>>;
  via: Record<string, Record<string, string>>;
  /** the hub territory on the map: an ellipse round the yard and the farms inside it */
  territory: { cx: number; cy: number; rx: number; ry: number };
}

/** Farms, the yard and the crossroads are placed afresh each day, inside this margin of the map: the territory's
    farms and the yard in the middle band, the farms outside it near the edges. */
const PLACE = { x0: 34, x1: MAP_W - 34, y0: 22, y1: MAP_H - 58, gap: 52 };
const INSIDE = { x0: 120, x1: MAP_W - 120, y0: 40, y1: MAP_H - 70 };
const JUNCTIONS = 3;

const bez = (a: Pt, c: Pt, b: Pt, t: number): Pt => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
/** A road's curve as points, from a to b (or b to a). */
export function roadPoints(m: BizMap, r: Road, from: string, n = 14): Pt[] {
  const a = m.at[r.a];
  const b = m.at[r.b];
  const pts = Array.from({ length: n + 1 }, (_, k) => bez(a, r.c, b, k / n));
  return from === r.a ? pts : pts.reverse();
}
const plen = (pts: Pt[]) => pts.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - pts[i].x, p.y - pts[i].y), 0);

/** Do segments p1–p2 and p3–p4 cross (touching at a shared end does not count)? */
function crosses(p1: Pt, p2: Pt, p3: Pt, p4: Pt) {
  const d = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d1 = d(p3, p4, p1), d2 = d(p3, p4, p2), d3 = d(p1, p2, p3), d4 = d(p1, p2, p4);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
/** How near a point is to a segment. */
function nearSeg(p: Pt, a: Pt, b: Pt) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

const maps = new Map<number, BizMap>();

/** The day's map: the yard, the farms and three crossroads at new places, joined by winding roads so every farm can
    be reached from every other. The same map every time for a day, so a reload shows the same territory. */
export function mapFor(day: number): BizMap {
  const hit = maps.get(day);
  if (hit) return hit;
  const r = rand(`map:${day}`);
  const ids = [YARD, ...CLIENTS.map(c => c.id), ...Array.from({ length: JUNCTIONS }, (_, k) => `x${k + 1}`)];
  const inside = (id: string) => id === YARD || (CLIENTS.find(c => c.id === id)?.inside ?? false);
  const at: Record<string, Pt> = {};
  // scatter the places, never too close together (and give up gracefully if the map is crowded)
  for (const id of ids) {
    let p: Pt = { x: 0, y: 0 };
    const box = inside(id) ? INSIDE : PLACE;
    for (let tries = 0, gap = PLACE.gap; tries < 400; tries++) {
      if (tries % 100 === 99) gap *= 0.85;
      p = { x: box.x0 + r() * (box.x1 - box.x0), y: box.y0 + r() * (box.y1 - box.y0) };
      // a farm outside the territory keeps to the edges of the map
      if (!inside(id) && !id.startsWith('x') && p.x > INSIDE.x0 - 10 && p.x < INSIDE.x1 + 10 && p.y > INSIDE.y0 - 6 && p.y < INSIDE.y1 + 6) continue;
      const g = id.startsWith('x') ? gap * 0.75 : gap;
      if (Object.values(at).every(q => Math.hypot((q.x - p.x) * 0.8, q.y - p.y) >= g * (q.y === p.y ? 1 : 0.8))) break;
    }
    at[id] = p;
  }
  // roads: the shortest links first, each kept if it crosses no road already laid and passes no other place
  const pairs: [string, string, number][] = [];
  ids.forEach((a, i) => ids.slice(i + 1).forEach(b => pairs.push([a, b, Math.hypot(at[a].x - at[b].x, at[a].y - at[b].y)])));
  pairs.sort((p, q) => p[2] - q[2]);
  const laid: [string, string][] = [];
  for (const [a, b, len] of pairs) {
    if (len > 230) continue;
    if (laid.some(([c, d]) => c !== a && c !== b && d !== a && d !== b && crosses(at[a], at[b], at[c], at[d]))) continue;
    if (ids.some(o => o !== a && o !== b && nearSeg(at[o], at[a], at[b]) < 20)) continue;
    laid.push([a, b]);
  }
  // the roads that join everything up (shortest first), then some of the rest, so there are loops to choose between
  const root: Record<string, string> = Object.fromEntries(ids.map(id => [id, id]));
  const find = (x: string): string => (root[x] === x ? x : (root[x] = find(root[x])));
  const keep = laid.filter(([a, b]) => {
    const ra = find(a), rb = find(b);
    if (ra === rb) return r() < 0.42;
    root[ra] = rb;
    return true;
  });
  // anything still cut off is joined by its nearest link
  for (const [a, b] of pairs) if (find(a) !== find(b)) (keep.push([a, b]), (root[find(a)] = find(b)));
  // a crossroads with one road is a dead end: take it away
  let edges = keep;
  let junctions = ids.filter(id => id.startsWith('x'));
  for (let changed = true; changed; ) {
    changed = false;
    for (const j of junctions) {
      const deg = edges.filter(e => e.includes(j)).length;
      if (deg < 2) {
        edges = edges.filter(e => !e.includes(j));
        junctions = junctions.filter(x => x !== j);
        delete at[j];
        changed = true;
      }
    }
  }
  const roads: Road[] = edges.map(([a, b]) => {
    const A = at[a], B = at[b];
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    // roads wind: the curve bends to one side by up to a fifth of its length
    const bend = (r() * 2 - 1) * 0.2 * len;
    const c = { x: (A.x + B.x) / 2 + (-(B.y - A.y) / len) * bend, y: (A.y + B.y) / 2 + ((B.x - A.x) / len) * bend };
    const road: Road = { a, b, c, km: 0 };
    road.km = plen(Array.from({ length: 21 }, (_, k) => bez(A, c, B, k / 20))) * KM_PER_PX;
    return road;
  });
  // every place to every other, along the roads (Floyd–Warshall: a few places only)
  const nodes = Object.keys(at);
  const km: BizMap['km'] = {};
  const via: BizMap['via'] = {};
  for (const a of nodes) {
    km[a] = {};
    via[a] = {};
    for (const b of nodes) km[a][b] = a === b ? 0 : Infinity;
  }
  for (const rd of roads) {
    if (rd.km < km[rd.a][rd.b]) {
      km[rd.a][rd.b] = km[rd.b][rd.a] = rd.km;
      via[rd.a][rd.b] = rd.b;
      via[rd.b][rd.a] = rd.a;
    }
  }
  for (const k of nodes)
    for (const a of nodes)
      for (const b of nodes)
        if (km[a][k] + km[k][b] < km[a][b] - 1e-9) {
          km[a][b] = km[a][k] + km[k][b];
          via[a][b] = via[a][k];
        }
  // the territory: an ellipse round the yard and the farms inside it
  const ins = ids.filter(id => inside(id)).map(id => at[id]);
  const cx = ins.reduce((n, p) => n + p.x, 0) / ins.length;
  const cy = ins.reduce((n, p) => n + p.y, 0) / ins.length;
  const rx = Math.max(...ins.map(p => Math.abs(p.x - cx))) + 46;
  const ry = Math.max(...ins.map(p => Math.abs(p.y - cy))) + 40;
  const m: BizMap = { day, at, junctions, roads, km, via, territory: { cx, cy, rx, ry } };
  maps.set(day, m);
  return m;
}

/** The places a tractor passes on the shortest road from a to b, both ends included. */
export function legStops(m: BizMap, a: string, b: string): string[] {
  const out = [a];
  for (let at = a, n = 0; at !== b && n < 40; n++) out.push((at = m.via[at][b]));
  return out;
}

/* ---------------- planning a day ---------------- */

export type Booking = 'me' | 'partner';
export type Bookings = Partial<Record<ReqKey, Booking>>;
/** The minigame's field efficiency at each farm the tractor stopped at (0 to 1), by farm. */
export type Drives = Record<string, number>;
/** The hub driver's field efficiency when the player lets them drive: the brief's 65 to 75% on small, irregular
    plots. A drive at this does exactly the planned job; better finishes it cleaner, worse leaves it unfinished. */
export const BASELINE = 0.7;
/** How much of a job a drive did: BASELINE is the whole job. */
export const shareOf = (e: number) => Math.min(1, Math.max(0, e) / BASELINE);
/** How clean a drive was beyond the baseline (0 to 1): less diesel wasted. */
export const cleanOf = (e: number) => Math.max(0, Math.min(1, (e - BASELINE) / (1 - BASELINE)));
/** A clean drive saves up to this share of the job's diesel. */
export const CLEAN_DIESEL = 0.25;

/** The tractor must visit at least this many farms in a day (fewer only when fewer can be done with its tools). */
export const MIN_STOPS = 3;
/** A route this close to the shortest counts as the most efficient one. */
export const BEST_ROUTE = 0.995;

/** Road km of a round trip from the yard through these farms, in order, along the day's roads. */
export function routeKm(m: BizMap, stops: string[]): number {
  if (!stops.length) return 0;
  let km = 0;
  let at = YARD;
  for (const id of stops) {
    km += m.km[at][id];
    at = id;
  }
  return km + m.km[at][YARD];
}

/** The shortest order through these farms (every order is tried, with a cut-off: a day has at most nine stops). */
export function bestRoute(m: BizMap, stops: string[]): string[] {
  if (stops.length <= 1) return [...stops];
  let best = [...stops];
  let bestKm = routeKm(m, best);
  const go = (rest: string[], done: string[], sofar: number) => {
    const last = done.length ? done[done.length - 1] : YARD;
    if (!rest.length) {
      const total = sofar + m.km[last][YARD];
      if (total < bestKm - 1e-9) {
        bestKm = total;
        best = [...done];
      }
      return;
    }
    // a partial route already longer than the best can't win
    if (sofar >= bestKm) return;
    rest.forEach((id, i) => go([...rest.slice(0, i), ...rest.slice(i + 1)], [...done, id], sofar + m.km[last][id]));
  };
  go(stops, [], 0);
  return best;
}

/** The farms the player's own tractor stops at, in the order of the route. */
export const stopsOf = (route: string[], bookings: Bookings) => route.filter(id => Object.entries(bookings).some(([k, v]) => v === 'me' && clientKey(k as ReqKey) === id));
/** Every farm booked for the player's own tractor, route or not. */
export const myFarms = (bookings: Bookings) => [...new Set(Object.entries(bookings).flatMap(([k, v]) => (v === 'me' ? [clientKey(k as ReqKey)] : [])))];

/** How many farms the tractor must visit today: MIN_STOPS, or fewer when fewer farms have a job its tools can do, or
    when even the quickest jobs on that many farms can't fit in a day. */
export function stopsNeeded(b: Pick<Biz, 'tools' | 'tractor' | 'day'>, requests: ReqKey[]): number {
  const m = mapFor(b.day);
  // each farm's quickest job the tractor can do, quickest farms first
  const quick = new Map<string, number>();
  for (const k of requests) {
    const { client, part } = partOf(k);
    if (!b.tools.includes(part.tool)) continue;
    const h = part.acres / (ACRES_AN_HOUR[part.tool] * WORK_RATE[b.tractor]);
    quick.set(client.id, Math.min(quick.get(client.id) ?? Infinity, h));
  }
  const farms = [...quick.entries()].sort((x, y) => x[1] - y[1]);
  for (let n = Math.min(MIN_STOPS, farms.length); n > 0; n--) {
    const pick = farms.slice(0, n);
    const h = pick.reduce((t, f) => t + f[1], 0) + routeKm(m, bestRoute(m, pick.map(f => f[0]))) / ROAD_KMH;
    if (h <= DAY_HOURS + 1e-9) return n;
  }
  return 0;
}

export interface Plan {
  stops: string[];
  km: number;
  bestKm: number;
  /** the shortest order through the same farms */
  best: string[];
  /** shortest / yours, 0 to 1 */
  efficiency: number;
  driveH: number;
  workH: number;
  hours: number;
  /** hours past the working day (the driver is paid overtime) */
  overH: number;
  acres: number;
  /** field acres (not transport), against the tractor's daily capacity */
  fieldAcres: number;
  capacity: number;
  litres: number;
  diesel: number;
  /** the diesel of the work itself, without the road */
  workDiesel: number;
  revenue: number;
  wage: number;
  commission: number;
  hubFee: number;
  instalment: number;
  profit: number;
  saved: number;
  farmers: number;
  partnerFarmers: number;
  missed: number;
  /** farms booked for the tractor but not yet put on the route */
  unrouted: string[];
  /** farms the tractor must visit today */
  needed: number;
  /** the Service Efficiency Ratio of the day (acres a km; with the shortest route while the route is not set) */
  ser: number;
  serBand: 'low' | 'ok' | 'healthy';
  /** jobs dropped as unserviceable: the sparsest stops, until the SER clears the floor */
  dropped: ReqKey[];
  /** jobs the drive left unfinished (under FULFILLED_SHARE) */
  unfinished: ReqKey[];
  booked: number;
  fulfilled: number;
  /** counted acres the day earns (Loop D), halved on a day with drops */
  counted: number;
  cluster: { activity: Activity; farms: number } | null;
  cleanFarms: number;
  points: number;
  /** why the day can't start, or null */
  problem: string | null;
}

export const serBand = (ser: number): Plan['serBand'] => (ser >= SER.healthy ? 'healthy' : ser >= SER.floor ? 'ok' : 'low');

/** Everything a day would come to: road and work hours, diesel, money, the farmers helped, the SER and the
    fulfilment, with each stop's drive (drives: field efficiency by farm; absent: the planned job, done). */
export function planDay(b: Biz, requests: ReqKey[], bookings: Bookings, route: string[], drives: Drives = {}): Plan {
  const m = mapFor(b.day);
  const rig = tractorOf(b);
  const rate = WORK_RATE[rig.tractor];
  const fuel = fuelFactor(rig.tractor);
  const mineFarms = myFarms(bookings);
  const routed = stopsOf(route, bookings);
  const unrouted = mineFarms.filter(id => !routed.includes(id));
  const best = bestRoute(m, mineFarms);
  const bestKm = routeKm(m, best);
  const mineAll = requests.filter(k => bookings[k] === 'me').map(k => ({ key: k, ...partOf(k) }));
  const theirs = requests.filter(k => bookings[k] === 'partner').map(k => ({ key: k, ...partOf(k) }));
  const acresAt = (farm: string) => mineAll.filter(x => x.client.id === farm).reduce((n, x) => n + x.part.acres, 0);

  // Loop C: a route whose acres a km fall below the floor sheds its sparsest stops as unserviceable: the stop whose
  // acres are least worth the km driven for them goes first, until the rest clear the floor
  let stops = routed;
  const dropped: ReqKey[] = [];
  if (!unrouted.length && stops.length > 1) {
    for (;;) {
      const km0 = routeKm(m, stops);
      const ser0 = km0 > 0 ? stops.reduce((n, id) => n + acresAt(id), 0) / km0 : Infinity;
      if (ser0 >= SER.floor || stops.length <= 1) break;
      let worst = 0;
      let worstWorth = Infinity;
      stops.forEach((id, i) => {
        const saved = km0 - routeKm(m, stops.filter((_, j) => j !== i));
        const worth = acresAt(id) / Math.max(0.05, saved);
        if (worth < worstWorth) {
          worstWorth = worth;
          worst = i;
        }
      });
      dropped.push(...mineAll.filter(x => x.client.id === stops[worst]).map(x => x.key));
      stops = stops.filter((_, j) => j !== worst);
    }
  }
  const mine = mineAll.filter(x => !dropped.includes(x.key));
  const km = routeKm(m, stops);

  // the drives: how much of each job got done, and how cleanly
  const e = (farm: string) => drives[farm] ?? BASELINE;
  const share = (farm: string) => shareOf(e(farm));
  const acres = mine.reduce((n, x) => n + x.part.acres * share(x.client.id), 0);
  const fieldAcres = mine.reduce((n, x) => n + (x.activity === 'transport' ? 0 : x.part.acres), 0);
  const workH = mine.reduce((n, x) => n + x.part.acres / (ACRES_AN_HOUR[x.part.tool] * rate), 0);
  const driveH = km / ROAD_KMH;
  const hours = driveH + workH;
  const overH = Math.max(0, hours - DAY_HOURS);
  const price = MONEY.diesel.value * (b.partners.includes('fuel') ? 1 - FUEL_DISCOUNT : 1);
  const workL = mine.reduce((n, x) => n + x.part.acres * TOOLS[x.part.tool].lpa * share(x.client.id) * (1 - CLEAN_DIESEL * cleanOf(e(x.client.id))), 0) * fuel;
  const litres = km * ROAD_LPKM * fuel + workL;
  const diesel = Math.round(litres * price);
  const workDiesel = Math.round(workL * price);
  const revenue = mine.reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres * share(x.client.id)), 0);
  const commission = theirs.reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres * PARTNER_CUT), 0);
  const wage = mineFarms.length ? DRIVER_WAGE + Math.round((overH * DRIVER_WAGE * OVERTIME) / DAY_HOURS) : 0;
  const hubFee = rig.own ? 0 : Math.round(revenue * HUB_SHARE);
  const instalment = rig.own ? Math.min(Math.round(revenue * PAYG.share), Math.max(0, rig.own.price - rig.own.paid)) : 0;
  const farmers = new Set(mine.map(x => x.client.id)).size;
  const partnerFarmers = new Set(theirs.map(x => x.client.id).filter(id => !mine.some(mm => mm.client.id === id))).size;
  const missed = requests.filter(k => !bookings[k]).length;
  const saved = [...mine, ...theirs].reduce((n, x) => n + handCost(x.part.tool, x.part.acres) - Math.round(hireOf(x.part.tool) * x.part.acres), 0);
  const needed = stopsNeeded({ ...b, tractor: rig.tractor }, requests);
  const unfinished = mine.filter(x => share(x.client.id) < FULFILLED_SHARE).map(x => x.key);
  const ser = km > 0 ? acres / km : unrouted.length && bestKm > 0 ? mineAll.reduce((n, x) => n + x.part.acres, 0) / bestKm : 0;
  const booked = requests.length;
  const fulfilled = mine.length - unfinished.length + theirs.length;
  // counted acres (Loop D): each new activity on a part this year counts its acres once, the agent's whole book
  const seen = new Map<string, Set<Activity>>();
  for (const [k, v] of Object.entries(b.done)) seen.set(k, new Set(v));
  let counted = 0;
  for (const x of [...mine.filter(x => !unfinished.includes(x.key)), ...theirs]) {
    const pk = partKey(x.key);
    const had = seen.get(pk) ?? new Set<Activity>();
    if (!had.has(x.activity)) {
      counted += x.part.acres * (bookings[x.key] === 'me' ? share(x.client.id) : 1);
      had.add(x.activity);
      seen.set(pk, had);
    }
  }
  if (dropped.length) counted *= 0.5;
  // the neighbourhood synchronised: three or more farms on the same activity today
  const byAct = new Map<Activity, Set<string>>();
  for (const x of [...mine, ...theirs]) byAct.set(x.activity, (byAct.get(x.activity) ?? new Set()).add(x.client.id));
  const clusterAct = [...byAct.entries()].filter(([, s]) => s.size >= CLUSTER.farms).sort((p, q) => q[1].size - p[1].size)[0];
  const cluster = clusterAct ? { activity: clusterAct[0], farms: clusterAct[1].size } : null;
  const cleanFarms = stops.filter(id => e(id) >= CLEAN_DRIVE.e).length;
  const points = (farmers + partnerFarmers) * POINTS_A_FARMER + (cluster ? CLUSTER.points : 0) + cleanFarms * CLEAN_DRIVE.points;
  // the day must fit with the shortest way round: a longer route is the player's to find, and costs diesel and overtime
  const fitH = mineAll.reduce((n, x) => n + x.part.acres / (ACRES_AN_HOUR[x.part.tool] * rate), 0) + bestKm / ROAD_KMH;
  const allField = mineAll.reduce((n, x) => n + (x.activity === 'transport' ? 0 : x.part.acres), 0);
  const noTool = mineAll.find(x => !b.tools.includes(x.part.tool));
  let problem: string | null = null;
  if (noTool) problem = `You have no ${toolName(noTool.part.tool).toLowerCase()} for ${noTool.client.name}'s ${noTool.part.name.toLowerCase()}: pass it to a partner, or buy one in Fleet.`;
  else if (!mineFarms.length && !theirs.length) problem = 'Book at least one job: tap a farm on the map.';
  else if (mineFarms.length < needed) problem = `Book at least ${needed} farms for your tractor to visit: ${mineFarms.length} so far.`;
  else if (fitH > DAY_HOURS + 1e-9) problem = `That is ${workH.toFixed(1)} hours of work, and the driving still to add: a day has ${DAY_HOURS}. Pass a job to a partner, or drop one.`;
  else if (allField > rig.capacity + 1e-9) problem = `${rig.name[0].toUpperCase()}${rig.name.slice(1)} can do ${rig.capacity} acres of field work a day: that is ${allField.toFixed(1)}. Pass a job to a partner.`;
  else if (unrouted.length) problem = `Plan your route: tap the farms in the order your tractor will visit them (${routed.length} of ${mineFarms.length}).`;
  return {
    stops,
    km,
    bestKm,
    best,
    efficiency: km > 0 && !unrouted.length ? Math.min(1, bestKm / km) : km > 0 ? 0 : 1,
    driveH,
    workH,
    hours,
    overH,
    acres,
    fieldAcres,
    capacity: rig.capacity,
    litres,
    diesel,
    workDiesel,
    revenue,
    wage,
    commission,
    hubFee,
    instalment,
    profit: revenue + commission - diesel - wage - hubFee,
    saved,
    farmers,
    partnerFarmers,
    missed,
    unrouted,
    needed,
    ser,
    serBand: serBand(ser),
    dropped,
    unfinished,
    booked,
    fulfilled,
    counted,
    cluster,
    cleanFarms,
    points,
    problem,
  };
}

/** The efficiency score, out of 100: the shortest route's km against the player's. */
export const effScore = (efficiency: number) => Math.round(Math.max(0, Math.min(1, efficiency)) * 100);

/** Stars for a day: one for any work, one for the most efficient route, one for leaving no farmer waiting. */
export const starsOf = (p: Pick<Plan, 'stops' | 'efficiency' | 'missed' | 'farmers' | 'partnerFarmers'>) =>
  (p.farmers + p.partnerFarmers > 0 ? 1 : 0) + (p.stops.length && p.efficiency >= BEST_ROUTE ? 1 : 0) + (p.missed === 0 ? 1 : 0);

/** The day is run: the plan's money, farmers, counted acres and the two numbers go into the business (done: the
    activities each part got today, from activitiesDone, for the counted-acres record). */
export function runDay(b: Biz, plan: Plan, done: Record<string, Activity[]> = {}): { biz: Biz; result: DayResult } {
  const result: DayResult = {
    day: b.day,
    kind: 'farms',
    km: plan.km,
    bestKm: plan.bestKm,
    route: plan.stops,
    best: plan.best,
    efficiency: plan.efficiency,
    hours: plan.hours,
    overH: plan.overH,
    acres: plan.acres,
    farmers: plan.farmers,
    partnerFarmers: plan.partnerFarmers,
    revenue: plan.revenue,
    diesel: plan.diesel,
    wage: plan.wage,
    commission: plan.commission,
    hubFee: plan.hubFee,
    instalment: plan.instalment,
    profit: plan.profit,
    saved: plan.saved,
    missed: plan.missed,
    stars: starsOf(plan),
    ser: plan.ser,
    booked: plan.booked,
    fulfilled: plan.fulfilled,
    counted: plan.counted,
    dropped: plan.dropped,
    unfinished: plan.unfinished,
    cluster: plan.cluster ?? undefined,
    cleanFarms: plan.cleanFarms,
    points: plan.points,
  };
  return closeDay(b, result, done);
}

/** A day hired out to the county: a fixed fee, the driver paid, no farms. Like any day's hire, the hub keeps its share
    of its own tractor's, and an agent's own tractor pays its PAYG instalment from it. */
export function hireOutDay(b: Biz, missed: number): { biz: Biz; result: DayResult } {
  const rig = tractorOf(b);
  const hubFee = rig.own ? 0 : Math.round(COUNTY_DAY * HUB_SHARE);
  const instalment = rig.own ? Math.min(Math.round(COUNTY_DAY * PAYG.share), Math.max(0, rig.own.price - rig.own.paid)) : 0;
  const result: DayResult = { ...emptyResult(b.day, 'county'), revenue: COUNTY_DAY, wage: DRIVER_WAGE, hubFee, instalment, profit: COUNTY_DAY - DRIVER_WAGE - hubFee, missed, booked: missed, stars: 1 };
  return closeDay(b, result, {});
}

/** A marketplace contract day: the tractor works in another hub; Narok's bookings go to partners or wait. */
export function contractDay(b: Biz, offer: Offer, requests: ReqKey[], bookings: Bookings): { biz: Biz; result: DayResult } {
  const rig = tractorOf(b);
  const theirs = requests.filter(k => bookings[k] === 'partner').map(partOf);
  const commission = theirs.reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres * PARTNER_CUT), 0);
  const price = MONEY.diesel.value * (b.partners.includes('fuel') ? 1 - FUEL_DISCOUNT : 1);
  const diesel = Math.round((offer.km * ROAD_LPKM + offer.acres * TOOLS[offer.tool].lpa) * fuelFactor(rig.tractor) * price);
  const instalment = rig.own ? Math.min(Math.round(offer.pay * PAYG.share), Math.max(0, rig.own.price - rig.own.paid)) : 0;
  const missed = requests.filter(k => !bookings[k]).length;
  const partnerFarmers = new Set(theirs.map(x => x.client.id)).size;
  const result: DayResult = {
    ...emptyResult(b.day, 'contract'),
    km: offer.km,
    acres: offer.acres,
    revenue: offer.pay,
    diesel,
    wage: DRIVER_WAGE,
    commission,
    instalment,
    profit: offer.pay + commission - diesel - DRIVER_WAGE,
    missed,
    booked: requests.length,
    fulfilled: theirs.length,
    partnerFarmers,
    points: partnerFarmers * POINTS_A_FARMER,
    stars: 1 + (missed === 0 ? 1 : 0),
    contract: { hub: offer.hub.name, agent: offer.agent, activity: offer.activity },
  };
  const biz = closeDay(b, result, {});
  return { biz: { ...biz.biz, contracts: [...b.contracts, offer.id] }, result: biz.result };
}

const emptyResult = (day: number, kind: DayResult['kind']): DayResult => ({ day, kind, km: 0, bestKm: 0, acres: 0, farmers: 0, partnerFarmers: 0, revenue: 0, diesel: 0, wage: 0, commission: 0, hubFee: 0, instalment: 0, profit: 0, saved: 0, missed: 0, stars: 0, ser: 0, booked: 0, fulfilled: 0, counted: 0, dropped: [], unfinished: [], cleanFarms: 0, points: 0 });

/** The day closes: money, farmers, counted acres, the two numbers, the calendar and the PAYG loan. */
function closeDay(b: Biz, r: DayResult, done: Record<string, Activity[]>): { biz: Biz; result: DayResult } {
  const own = b.owned[b.owned.length - 1];
  const result = { ...r };
  let owned = b.owned;
  if (own) {
    const paid = Math.min(own.price, own.paid + r.instalment);
    // utilisation and fulfilment over the rolling window
    const tier = PAYG.tiers.find(t => t.hp === own.hp)!;
    const recent = [...b.history.slice(-(PAYG.warn.window - 1)), r];
    const util = recent.reduce((n, d) => n + d.acres, 0) / (recent.length * tier.capacity);
    const bk = recent.reduce((n, d) => n + d.booked, 0);
    const fulfil = bk ? recent.reduce((n, d) => n + d.fulfilled, 0) / bk : 1;
    const warning = recent.length >= 3 && (util < PAYG.warn.utilization || fulfil < PAYG.warn.fulfilment);
    const warn = warning ? own.warn + 1 : 0;
    const repossessed = paid < own.price && warn >= PAYG.warn.days;
    owned = repossessed ? b.owned.slice(0, -1) : [...b.owned.slice(0, -1), { ...own, paid, warn }];
    result.payg = { left: Math.max(0, own.price - paid), util, fulfil, warn, repossessed };
    if (repossessed) return finish({ ...b, owned, requalify: b.day + PAYG.cooldown, tractor: 'standard' }, result, done);
  }
  return finish({ ...b, owned }, result, done);
}

function finish(b: Biz, r: DayResult, done: Record<string, Activity[]>): { biz: Biz; result: DayResult } {
  const mk = monthKey(b.day);
  const month = b.months[mk] ?? { acres: 0, days: 0 };
  // a new year: each part's activities count afresh
  const newYear = yearOf(b.day + 1) !== yearOf(b.day);
  const merged: Record<string, Activity[]> = newYear ? {} : { ...b.done };
  if (!newYear) for (const [k, v] of Object.entries(done)) merged[k] = [...new Set([...(merged[k] ?? []), ...v])];
  return {
    biz: {
      ...b,
      day: b.day + 1,
      cash: b.cash + r.profit - r.instalment,
      helped: b.helped + r.farmers + r.partnerFarmers,
      acres: b.acres + r.acres,
      km: b.km + r.km,
      counted: b.counted + r.counted,
      booked: b.booked + r.booked,
      fulfilled: b.fulfilled + r.fulfilled,
      done: merged,
      extra: [],
      advised: {},
      months: { ...b.months, [mk]: { acres: month.acres + r.acres, days: month.days + 1 } },
      history: [...b.history, r].slice(-20),
    },
    result: r,
  };
}

/** The activities each part got from a plan's bookings today (the counted-acres record). */
export function activitiesDone(requests: ReqKey[], bookings: Bookings, plan: Pick<Plan, 'dropped' | 'unfinished'>): Record<string, Activity[]> {
  const out: Record<string, Activity[]> = {};
  for (const k of requests) {
    if (!bookings[k] || plan.dropped.includes(k) || plan.unfinished.includes(k)) continue;
    const pk = partKey(k);
    out[pk] = [...new Set([...(out[pk] ?? []), activityOf(partOf(k).tool)])];
  }
  return out;
}

/** Why a partner can't be signed yet, or null. */
export function partnerBlock(b: Biz, id: PartnerId): string | null {
  const p = partnerOf(id);
  if (b.partners.includes(id)) return 'Signed';
  if (levelOf(b.helped).level < p.level) return `Opens at level ${p.level}`;
  if (b.cash < p.fee) return `Needs ${kshText(p.fee)}`;
  return null;
}

/** Why an item can't be bought yet, or null. */
export function shopBlock(b: Biz, id: FleetItem): string | null {
  const item = SHOP.find(x => x.id === id)!;
  if (id === 'large' ? b.tractor === 'large' : b.tools.includes(id)) return 'Owned';
  if (id === 'large' && b.owned.length) return 'You drive your own tractor now';
  if (id === 'combine' && b.owned.length < PAYG.tiers.length) return 'Opens once you own both PAYG tractors';
  if (levelOf(b.helped).level < item.level) return `Opens at level ${item.level}`;
  if (b.cash < item.price) return `Needs ${kshText(item.price)}`;
  return null;
}
