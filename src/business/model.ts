/* The tractor business: the player runs a tractor-hire service (Wakala's tractor work, grown into a business). Each day
   farmers book jobs on parts of their farms; the player books each part for their own tractor or passes it to a
   partner, plans the order to drive round the farms, then runs the day. Money is the business's own account, in
   shillings: hire prices and diesel are Wakala's real figures (tractor/data.ts MONEY and IMPL); everything else here is
   a game estimate, marked as one. No screens or pictures here, so the save and the tests can use it. */

import { IMPL, MONEY, TRACTORS, type ImplId } from '../tractor/data';

/* ---------------- the map ---------------- */

/** A point on the business map, in map units (the map is 30 × 16 units, 12 × 6.4 km: KM_PER_UNIT). */
export interface Pt {
  x: number;
  y: number;
}

export const MAP_W = 30;
export const MAP_H = 16;
/** The tractor yard, where every day starts and ends. */
export const YARD: Pt = { x: 3, y: 8 };
/** Roads wind: a trip is this much longer than the straight line (game estimate). */
export const ROAD_FACTOR = 1.25;
/** One map unit, in km: the farms are spread over a village, 12 km across. */
export const KM_PER_UNIT = 0.4;

/* ---------------- the farms that book ---------------- */

/** The jobs a farm can book, and the tool each needs. */
export type BizTool = Extract<ImplId, 'plough' | 'harrow' | 'ridger' | 'planter' | 'sprayer'>;

export interface FarmPart {
  id: string;
  /** which part of the farm, in a few words */
  name: string;
  tool: BizTool;
  acres: number;
}

export interface Client {
  id: string;
  name: string;
  place: string;
  at: Pt;
  parts: FarmPart[];
}

const part = (id: string, name: string, tool: BizTool, acres: number): FarmPart => ({ id, name, tool, acres });

/** The farmers around the yard. Each day some of them book work on one or two parts of their farm. */
export const CLIENTS: Client[] = [
  { id: 'wanjiru', name: 'Mama Wanjiru', place: 'Kiambu ridge', at: { x: 9, y: 3 }, parts: [part('top', 'Top field', 'plough', 1.5), part('river', 'River strip', 'harrow', 1)] },
  { id: 'otieno', name: 'Otieno', place: 'Lake road', at: { x: 14, y: 12.5 }, parts: [part('maize', 'Maize block', 'plough', 2), part('beans', 'Bean rows', 'planter', 1)] },
  { id: 'chebet', name: 'Chebet', place: 'Hill farm', at: { x: 7.5, y: 12 }, parts: [part('slope', 'The slope', 'ridger', 1), part('flat', 'Flat field', 'harrow', 1.5)] },
  { id: 'kamau', name: 'Kamau', place: 'Market side', at: { x: 18, y: 5 }, parts: [part('north', 'North block', 'plough', 2.5), part('south', 'South block', 'sprayer', 2)] },
  { id: 'akinyi', name: 'Akinyi', place: 'Swamp edge', at: { x: 22, y: 11 }, parts: [part('rice', 'Wet field', 'ridger', 1.5), part('dry', 'Dry field', 'plough', 1)] },
  { id: 'mutua', name: 'Mutua', place: 'Dry plains', at: { x: 26, y: 4 }, parts: [part('east', 'East paddock', 'plough', 3), part('west', 'West paddock', 'harrow', 2)] },
  { id: 'njeri', name: 'Njeri', place: 'School lane', at: { x: 12, y: 7.5 }, parts: [part('garden', 'Kitchen garden', 'harrow', 0.5), part('maize', 'Maize field', 'planter', 1.5)] },
  { id: 'kiprop', name: 'Kiprop', place: 'Forest gate', at: { x: 25.5, y: 13.5 }, parts: [part('new', 'New clearing', 'plough', 2), part('old', 'Old field', 'sprayer', 1.5)] },
  { id: 'achieng', name: 'Mama Achieng', place: 'Home village', at: { x: 4.5, y: 2.5 }, parts: [part('home', 'Home field', 'plough', 1), part('sukuma', 'Sukuma beds', 'sprayer', 0.5)] },
];

export const clientOf = (id: string) => CLIENTS.find(c => c.id === id)!;
/** A booking request: one part of one farm, today. */
export type ReqKey = `${string}:${string}`;
export const reqKey = (client: string, partId: string): ReqKey => `${client}:${partId}`;
export const partOf = (k: ReqKey) => {
  const [c, p] = k.split(':');
  return { client: clientOf(c), part: clientOf(c).parts.find(x => x.id === p)! };
};

/* ---------------- the tractor and its work ---------------- */

/** Acres an hour for each job, with a standard tractor (game estimates). */
export const ACRES_AN_HOUR: Record<BizTool, number> = { plough: 0.6, harrow: 1.2, ridger: 0.9, planter: 1, sprayer: 2.5 };
/** Road speed, km an hour, and diesel on the road, litres a km (game estimates). */
export const ROAD_KMH = 14;
export const ROAD_LPKM = 0.3;
/** A working day, hours. */
export const DAY_HOURS = 9;
/** The driver's pay for a day, KSh (game estimate, near MONEY.wage for skilled work). */
export const DRIVER_WAGE = 1000;
/** What a partner pays the player for a booking passed on: a share of its hire (game estimate). */
export const PARTNER_CUT = 0.1;

export type BizTractor = 'standard' | 'large';
/** How fast each tractor works against a standard one (TRACTORS' speed, as a work rate). */
export const WORK_RATE: Record<BizTractor, number> = { standard: 1, large: 1.3 };
export const fuelFactor = (k: BizTractor) => TRACTORS.find(t => t.id === k)!.fuel;
export const hireOf = (tool: BizTool) => IMPL[tool].hire.value;
export const toolName = (tool: BizTool) => IMPL[tool].name;
/** What the farmer would spend doing the job by hand instead, KSh (MONEY: person-days at a day's wage). */
export const handCost = (tool: BizTool, acres: number) => Math.round(IMPL[tool].manual.value * acres * MONEY.wage.value);

/** What one job leaves the business on the player's tractor: its hire less the diesel to do it (road not counted). */
export function jobKeep(b: Pick<Biz, 'tractor' | 'partners'>, tool: BizTool, acres: number) {
  const price = MONEY.diesel.value * (b.partners.includes('fuel') ? 1 - FUEL_DISCOUNT : 1);
  const diesel = Math.round(acres * IMPL[tool].lpa * fuelFactor(b.tractor) * price);
  const hire = Math.round(hireOf(tool) * acres);
  return { hire, diesel, keep: hire - diesel, partner: Math.round(hire * PARTNER_CUT) };
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
  { id: 'coop', name: 'Lake Farmers’ Co-op', kind: 'Farmers’ co-op', does: 'Sends you two more farms’ bookings every day.', fee: 5000, level: 2 },
  { id: 'fuel', name: 'Rafiki Fuel', kind: 'Fuel station', does: 'Sells you diesel 10% cheaper.', fee: 3000, level: 2 },
  { id: 'county', name: 'County Roads Office', kind: 'Hires tractors', does: 'Rents your tractor for a whole day, with your driver: KSh 12,000, no farms that day.', fee: 0, level: 2 },
  { id: 'app', name: 'Shamba Booking App', kind: 'Booking app', does: 'Puts your stops in the shortest order with one tap.', fee: 4000, level: 3 },
];
export const partnerOf = (id: PartnerId) => PARTNERS.find(p => p.id === id)!;
export const FUEL_DISCOUNT = 0.1;
export const COUNTY_DAY = 12000;
export const COOP_EXTRA = 2;

/* ---------------- the fleet ---------------- */

export type FleetItem = 'ridger' | 'planter' | 'sprayer' | 'large';
/** What the business can buy (KSh, game prices scaled to the game's days, not real list prices). */
export const SHOP: { id: FleetItem; name: string; does: string; price: number; level: number }[] = [
  { id: 'ridger', name: 'Ridger', does: IMPL.ridger.does, price: 25000, level: 1 },
  { id: 'sprayer', name: 'Boom sprayer', does: IMPL.sprayer.does, price: 20000, level: 2 },
  { id: 'planter', name: 'Maize planter', does: IMPL.planter.does, price: 35000, level: 2 },
  { id: 'large', name: 'Large tractor', does: 'Works 30% faster, so more acres fit in a day. It burns 50% more diesel.', price: 90000, level: 3 },
];

/* ---------------- growing the business ---------------- */

export const LEVELS: { level: number; helped: number; name: string }[] = [
  { level: 1, helped: 0, name: 'One tractor, one driver' },
  { level: 2, helped: 8, name: 'Known in the village' },
  { level: 3, helped: 20, name: 'The ward’s tractor service' },
  { level: 4, helped: 40, name: 'A tractor business' },
  { level: 5, helped: 80, name: 'The county’s tractor service' },
];
export const levelOf = (helped: number) => [...LEVELS].reverse().find(l => helped >= l.helped)!;
export const nextLevel = (helped: number) => LEVELS.find(l => l.helped > helped) ?? null;
/** Points for the player (Lima's rewards) for each farmer helped. */
export const POINTS_A_FARMER = 20;

/* ---------------- the business's state ---------------- */

export interface DayResult {
  day: number;
  kind: 'farms' | 'county';
  km: number;
  bestKm: number;
  acres: number;
  /** farmers helped by the player's tractor, and through partners */
  farmers: number;
  partnerFarmers: number;
  revenue: number;
  diesel: number;
  wage: number;
  commission: number;
  profit: number;
  /** what the farmers saved against doing the same work by hand */
  saved: number;
  /** bookings nobody took */
  missed: number;
  stars: number;
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
}

export const newBiz = (): Biz => ({ day: 1, cash: 20000, helped: 0, acres: 0, km: 0, partners: ['kimani'], tools: ['plough', 'harrow'], tractor: 'standard', history: [] });

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

/** How many farms book today: more as the business grows, and two more with the co-op. */
export const farmsToday = (b: Biz) => Math.min(CLIENTS.length, 3 + levelOf(b.helped).level + (b.partners.includes('coop') ? COOP_EXTRA : 0));

/** Today's booking requests: the same every time for a day, so a reload shows the same farms. */
export function requestsFor(b: Biz): ReqKey[] {
  const r = rand(`biz:${b.day}`);
  const order = CLIENTS.map(c => ({ c, k: r() })).sort((a, z) => a.k - z.k).map(x => x.c);
  return order.slice(0, farmsToday(b)).flatMap(c => {
    const pick = r();
    const parts = pick < 0.35 ? c.parts : [c.parts[pick < 0.7 ? 0 : 1]];
    return parts.map(p => reqKey(c.id, p.id));
  });
}

/* ---------------- planning a day ---------------- */

export type Booking = 'me' | 'partner';
export type Bookings = Partial<Record<ReqKey, Booking>>;

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) * ROAD_FACTOR * KM_PER_UNIT;
/** Road km of a round trip from the yard through these farms, in order. */
export function routeKm(stops: string[]): number {
  let km = 0;
  let at = YARD;
  for (const id of stops) {
    const to = clientOf(id).at;
    km += dist(at, to);
    at = to;
  }
  return km + dist(at, YARD);
}

/** The shortest order through these farms (every order is tried: a day has at most nine stops). */
export function bestRoute(stops: string[]): string[] {
  if (stops.length <= 1) return [...stops];
  let best = [...stops];
  let bestKm = routeKm(best);
  const permute = (rest: string[], done: string[]) => {
    if (!rest.length) {
      const km = routeKm(done);
      if (km < bestKm - 1e-9) {
        bestKm = km;
        best = [...done];
      }
      return;
    }
    // a partial route already longer than the best can't win
    if (done.length && routeKm(done) - dist(clientOf(done[done.length - 1]).at, YARD) >= bestKm) return;
    rest.forEach((id, i) => permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...done, id]));
  };
  permute(stops, []);
  return best;
}

/** The farms the player's own tractor stops at, in the order they were first booked. */
export const stopsOf = (route: string[], bookings: Bookings) => route.filter(id => Object.entries(bookings).some(([k, v]) => v === 'me' && k.startsWith(`${id}:`)));

export interface Plan {
  stops: string[];
  km: number;
  bestKm: number;
  /** shortest / yours, 0 to 1 */
  efficiency: number;
  driveH: number;
  workH: number;
  hours: number;
  acres: number;
  litres: number;
  diesel: number;
  revenue: number;
  wage: number;
  commission: number;
  profit: number;
  saved: number;
  farmers: number;
  partnerFarmers: number;
  missed: number;
  /** why the day can't start, or null */
  problem: string | null;
}

/** Everything a day would come to: road and work hours, diesel, money, and the farmers helped. */
export function planDay(b: Biz, requests: ReqKey[], bookings: Bookings, route: string[]): Plan {
  const stops = stopsOf(route, bookings);
  const km = routeKm(stops);
  const bestKm = routeKm(bestRoute(stops));
  const mine = requests.filter(k => bookings[k] === 'me').map(partOf);
  const theirs = requests.filter(k => bookings[k] === 'partner').map(partOf);
  const acres = mine.reduce((n, x) => n + x.part.acres, 0);
  const workH = mine.reduce((n, x) => n + x.part.acres / (ACRES_AN_HOUR[x.part.tool] * WORK_RATE[b.tractor]), 0);
  const driveH = km / ROAD_KMH;
  const price = MONEY.diesel.value * (b.partners.includes('fuel') ? 1 - FUEL_DISCOUNT : 1);
  const litres = (km * ROAD_LPKM + mine.reduce((n, x) => n + x.part.acres * IMPL[x.part.tool].lpa, 0)) * fuelFactor(b.tractor);
  const diesel = Math.round(litres * price);
  const revenue = mine.reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres), 0);
  const commission = theirs.reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres * PARTNER_CUT), 0);
  const wage = stops.length ? DRIVER_WAGE : 0;
  const farmers = new Set(mine.map(x => x.client.id)).size;
  const partnerFarmers = new Set(theirs.map(x => x.client.id).filter(id => !mine.some(m => m.client.id === id))).size;
  const missed = requests.filter(k => !bookings[k]).length;
  const saved = [...mine, ...theirs].reduce((n, x) => n + handCost(x.part.tool, x.part.acres) - Math.round(hireOf(x.part.tool) * x.part.acres), 0);
  const hours = driveH + workH;
  const noTool = mine.find(x => !b.tools.includes(x.part.tool));
  let problem: string | null = null;
  if (noTool) problem = `You have no ${toolName(noTool.part.tool).toLowerCase()} for ${noTool.client.name}'s ${noTool.part.name.toLowerCase()}: pass it to a partner, or buy one in Fleet.`;
  else if (hours > DAY_HOURS + 1e-9) problem = `That is ${hours.toFixed(1)} hours of work and driving: a day has ${DAY_HOURS}. Pass a job to a partner, or drop one.`;
  else if (!stops.length && !theirs.length) problem = 'Book at least one job: tap a farm on the map.';
  return {
    stops,
    km,
    bestKm,
    efficiency: km > 0 ? bestKm / km : 1,
    driveH,
    workH,
    hours,
    acres,
    litres,
    diesel,
    revenue,
    wage,
    commission,
    profit: revenue + commission - diesel - wage,
    saved,
    farmers,
    partnerFarmers,
    missed,
    problem,
  };
}

/** Stars for a day: one for any work, one for a route within 5% of the shortest, one for leaving no farmer waiting. */
export const starsOf = (p: Pick<Plan, 'stops' | 'efficiency' | 'missed' | 'farmers' | 'partnerFarmers'>) =>
  (p.farmers + p.partnerFarmers > 0 ? 1 : 0) + (p.stops.length && p.efficiency >= 0.95 ? 1 : 0) + (p.missed === 0 ? 1 : 0);

/** The day is run: the plan's money and farmers go into the business. */
export function runDay(b: Biz, plan: Plan): { biz: Biz; result: DayResult } {
  const result: DayResult = {
    day: b.day,
    kind: 'farms',
    km: plan.km,
    bestKm: plan.bestKm,
    acres: plan.acres,
    farmers: plan.farmers,
    partnerFarmers: plan.partnerFarmers,
    revenue: plan.revenue,
    diesel: plan.diesel,
    wage: plan.wage,
    commission: plan.commission,
    profit: plan.profit,
    saved: plan.saved,
    missed: plan.missed,
    stars: starsOf(plan),
  };
  return { biz: closeDay(b, result), result };
}

/** A day hired out to the county: a fixed fee, the driver paid, no farms. */
export function hireOutDay(b: Biz, missed: number): { biz: Biz; result: DayResult } {
  const result: DayResult = { day: b.day, kind: 'county', km: 0, bestKm: 0, acres: 0, farmers: 0, partnerFarmers: 0, revenue: COUNTY_DAY, diesel: 0, wage: DRIVER_WAGE, commission: 0, profit: COUNTY_DAY - DRIVER_WAGE, saved: 0, missed, stars: 1 };
  return { biz: closeDay(b, result), result };
}

function closeDay(b: Biz, r: DayResult): Biz {
  return {
    ...b,
    day: b.day + 1,
    cash: b.cash + r.profit,
    helped: b.helped + r.farmers + r.partnerFarmers,
    acres: b.acres + r.acres,
    km: b.km + r.km,
    history: [...b.history, r].slice(-20),
  };
}

/** Why a partner can't be signed yet, or null. */
export function partnerBlock(b: Biz, id: PartnerId): string | null {
  const p = partnerOf(id);
  if (b.partners.includes(id)) return 'Signed';
  if (levelOf(b.helped).level < p.level) return `Opens at level ${p.level}`;
  if (b.cash < p.fee) return `Needs KSh ${p.fee.toLocaleString('en-US')}`;
  return null;
}

/** Why an item can't be bought yet, or null. */
export function shopBlock(b: Biz, id: FleetItem): string | null {
  const item = SHOP.find(x => x.id === id)!;
  if (id === 'large' ? b.tractor === 'large' : b.tools.includes(id)) return 'Owned';
  if (levelOf(b.helped).level < item.level) return `Opens at level ${item.level}`;
  if (b.cash < item.price) return `Needs KSh ${item.price.toLocaleString('en-US')}`;
  return null;
}
