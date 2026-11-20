/* Regions: parts of Africa living through climate and food instability, and the player's gifts to them.

   Each region names what it is going through (drought, floods, heat, cyclones, conflict) and what a gift buys there:
   three relief packs, small to large. A gift is paid from the game's money (it is a game: no real money moves) and
   goes into the wallet as Giving. It earns giving points, twice as many for the region in focus this week or while a
   special day is on (src/events/days.ts), and a region's appeal in the game is met once the player's gifts to it reach
   its goal, which pays a one-time bonus of points.

   The words about each region describe what it has faced in recent years in general terms, not today's figures. Real
   giving is on the Donate page (src/events/orgs.ts), which links to the organisations' own sites.

   No screens here (the page is Events.tsx), so the saved game can use it. */

import { achClock } from '../achievements/track';

export type RegionId = 'horn' | 'sahel' | 'southern' | 'lakechad' | 'madagascar' | 'sudan';
export type CrisisId = 'drought' | 'floods' | 'heat' | 'cyclones' | 'conflict' | 'pests';

export const CRISES: Record<CrisisId, { label: string; icon: string }> = {
  drought: { label: 'Drought', icon: '☀️' },
  floods: { label: 'Floods', icon: '🌊' },
  heat: { label: 'Heat & desert', icon: '🔥' },
  cyclones: { label: 'Cyclones', icon: '🌀' },
  conflict: { label: 'Conflict', icon: '⚠️' },
  pests: { label: 'Pests', icon: '🦗' },
};

export interface Pack {
  id: string;
  name: string;
  /** stored money (src/money.ts) */
  price: number;
  /** what it does, in a line */
  line: string;
}

export interface Region {
  id: RegionId;
  name: string;
  /** the countries it covers, in a line */
  where: string;
  icon: string;
  crises: CrisisId[];
  /** how bad it is in the game: 3 is the worst (the order on the page) */
  level: 1 | 2 | 3;
  /** what is happening, in two sentences */
  story: string;
  /** how farming and food are hit */
  food: string;
  /** what a farmer like the player can learn from it */
  lesson: string;
  packs: Pack[];
  /** the region's appeal in the game: the player's gifts reach it once */
  goal: number;
}

export const REGIONS: Region[] = [
  {
    id: 'horn',
    name: 'Horn of Africa',
    where: 'Northern Kenya, Somalia, southern Ethiopia',
    icon: '🐪',
    crises: ['drought', 'floods'],
    level: 3,
    story: 'Rainy season after rainy season has failed here, and when the rain does come it can come all at once and flood the dry ground.',
    food: 'Pasture and water holes dry up, so herds weaken and die; families who live from their animals lose their milk and their savings at once.',
    lesson: 'Harvest water when it rains (a tank, a pan, mulch) and keep fewer, stronger animals with feed put by.',
    packs: [
      { id: 'water', name: 'Clean water for a family', price: 150, line: 'Water trucked in for a herding family for a month' },
      { id: 'feed', name: 'Feed to keep a herd alive', price: 600, line: 'Hay and feed blocks through the driest weeks' },
      { id: 'pan', name: 'A water pan for a village', price: 2500, line: 'A lined pan that holds the next rain for months' },
    ],
    goal: 6000,
  },
  {
    id: 'sahel',
    name: 'The Sahel',
    where: 'Mali, Niger, Burkina Faso, Chad',
    icon: '🌾',
    crises: ['heat', 'drought', 'conflict'],
    level: 3,
    story: 'The belt south of the Sahara is warming faster than most of the world, and the desert creeps into tired land; fighting has driven many farmers from their fields.',
    food: 'Millet and sorghum harvests shrink in hot, short seasons, and families who had to leave their land rely on help to eat.',
    lesson: 'Old Sahel methods bring land back: zaï pits, stone lines along the slope, and letting trees regrow among the crops.',
    packs: [
      { id: 'meals', name: 'School meals for a child', price: 120, line: 'A term of lunches, which keeps children in class' },
      { id: 'zai', name: 'Zaï pits for a field', price: 500, line: 'Planting pits that catch rain and compost for one field' },
      { id: 'trees', name: 'Trees for a village', price: 2000, line: 'Seedlings and care for a green belt against the sand' },
    ],
    goal: 6000,
  },
  {
    id: 'southern',
    name: 'Southern Africa',
    where: 'Zambia, Malawi, Zimbabwe, Mozambique',
    icon: '🌽',
    crises: ['drought', 'cyclones'],
    level: 2,
    story: 'El Niño years bring long dry spells in the middle of the season, and storms off the Indian Ocean flood the coast and the river valleys.',
    food: 'Maize that is planted on the rains wilts before it fills its cobs, so whole harvests fail and the price of maize meal climbs.',
    lesson: 'Plant more than one crop (sorghum, cassava, beans beside the maize) and use early, drought-tolerant seed.',
    packs: [
      { id: 'flour', name: 'Maize meal for a family', price: 150, line: 'A month of mealie meal while the next crop grows' },
      { id: 'seed', name: 'Drought-tolerant seed', price: 450, line: 'Early maize and sorghum seed for one farm' },
      { id: 'drip', name: 'A drip kit for a group', price: 2200, line: 'A small solar drip system shared by ten farmers' },
    ],
    goal: 5000,
  },
  {
    id: 'lakechad',
    name: 'Lake Chad Basin',
    where: 'North-east Nigeria, Niger, Chad, Cameroon',
    icon: '🐟',
    crises: ['conflict', 'drought', 'floods'],
    level: 3,
    story: 'The lake is much smaller than it was two generations ago, and years of conflict around it have pushed families off their farms and fishing grounds.',
    food: 'Fishing, farming and herding all depended on the lake; with less water and less safety, many households cannot grow or buy enough food.',
    lesson: 'Share water fairly: one farm drawing too much leaves the next one dry (Climate › Water tank shows yours).',
    packs: [
      { id: 'food', name: 'A food basket', price: 180, line: 'Cereals, beans and oil for a family for two weeks' },
      { id: 'garden', name: 'A kitchen garden', price: 400, line: 'Seed, a watering can and training for a home garden' },
      { id: 'boat', name: 'Nets and a boat for a group', price: 2400, line: 'Fishing gear that lets a group earn again' },
    ],
    goal: 6000,
  },
  {
    id: 'madagascar',
    name: 'Southern Madagascar',
    where: 'The Grand Sud of Madagascar',
    icon: '🌵',
    crises: ['drought', 'heat', 'cyclones'],
    level: 2,
    story: 'The deep south has had drought after drought, with hot winds that bury fields in sand; the north and east are hit by cyclones instead.',
    food: 'With crops failing year after year, families have lived on cactus fruit and wild leaves through the hungry season.',
    lesson: 'Windbreaks of trees and hedges keep the soil on the field, and cover crops keep it from blowing away.',
    packs: [
      { id: 'meals', name: 'Meals for a child', price: 120, line: 'Fortified meals through the hungry season' },
      { id: 'hedge', name: 'A windbreak hedge', price: 500, line: 'Seedlings to hold the sand off one field' },
      { id: 'well', name: 'A well for a village', price: 2600, line: 'A deep well with a hand pump' },
    ],
    goal: 5000,
  },
  {
    id: 'sudan',
    name: 'Sudan & South Sudan',
    where: 'Sudan, South Sudan',
    icon: '🏕️',
    crises: ['conflict', 'floods'],
    level: 3,
    story: 'War has driven millions of people from their homes, and in South Sudan the Nile’s floods have stayed on the land for seasons at a time.',
    food: 'Farmers cannot plant on land they have fled or on fields under water, so many families depend on food aid to get through the year.',
    lesson: 'Store seed safely and keep some off the farm: a family that keeps its seed can plant again when it goes home.',
    packs: [
      { id: 'food', name: 'An emergency food ration', price: 200, line: 'A month of food for a family that had to flee' },
      { id: 'tools', name: 'Seed and tools', price: 450, line: 'A hoe, a panga and seed to plant again' },
      { id: 'dyke', name: 'A flood dyke for a village', price: 2500, line: 'Earth banks that keep the fields dry' },
    ],
    goal: 6000,
  },
];

export const regionOf = (id: string | undefined) => REGIONS.find(r => r.id === id);

/* ------------------------------------------------------------------ */
/* The player's giving                                                  */
/* ------------------------------------------------------------------ */

export interface Gift {
  /** when (ms since 1970) */
  t: number;
  date: string;
  region: RegionId;
  pack: string;
  /** stored money */
  amount: number;
  points: number;
}

export interface GivingState {
  /** newest first (the last 60) */
  gifts: Gift[];
  /** stored money given, all time, by region */
  totals: Partial<Record<RegionId, number>>;
  /** the regions whose appeal the player met */
  met: RegionId[];
  /** organisations the player opened the donate page of (src/events/orgs.ts): counted only, never followed */
  visits: string[];
}

export const GIVING_KEEP = 60;
export const newGiving = (): GivingState => ({ gifts: [], totals: {}, met: [], visits: [] });
export const givingOf = (g: Partial<GivingState> | undefined): GivingState => ({ ...newGiving(), ...(g ?? {}) });

/** One giving point for every 10 stored money given. */
export const POINTS_PER = 10;
/** The bonus once a region's appeal is met. */
export const MET_BONUS = 300;

/** The region in focus this week: the same for everyone, turning each Monday. */
export function focusRegion(date = achClock.today()): Region {
  const d = new Date(`${date}T12:00:00Z`);
  const monday = Math.floor((d.getTime() / 86400000 + 3) / 7);
  return REGIONS[((monday % REGIONS.length) + REGIONS.length) % REGIONS.length];
}

export const totalGiven = (g: Partial<GivingState> | undefined) => Object.values(givingOf(g).totals).reduce((n, x) => n + (x ?? 0), 0);

/** A gift: the giving after it, the points it earned, and whether it met the region's appeal; or why it cannot. */
export function give(g0: Partial<GivingState> | undefined, regionId: string, packId: string, coins: number, double: boolean, date = achClock.today()): { giving: GivingState; amount: number; points: number; met: boolean; region: Region; pack: Pack } | { error: string } {
  const region = regionOf(regionId);
  const pack = region?.packs.find(p => p.id === packId);
  if (!region || !pack) return { error: 'There is no such gift.' };
  if (coins < pack.price) return { error: `You need ${pack.price} for this gift.` };
  const g = givingOf(g0);
  const before = g.totals[region.id] ?? 0;
  const after = before + pack.price;
  const met = !g.met.includes(region.id) && after >= region.goal;
  const points = Math.round(pack.price / POINTS_PER) * (double ? 2 : 1) + (met ? MET_BONUS : 0);
  const gift: Gift = { t: Date.now(), date, region: region.id, pack: pack.id, amount: pack.price, points };
  return {
    giving: { ...g, gifts: [gift, ...g.gifts].slice(0, GIVING_KEEP), totals: { ...g.totals, [region.id]: after }, met: met ? [...g.met, region.id] : g.met },
    amount: pack.price,
    points,
    met,
    region,
    pack,
  };
}
