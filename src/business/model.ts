/* The tractor business: the player runs a tractor-hire service (Wakala's tractor work, grown into a business). Each day
   farmers book jobs on parts of their farms; the player books each part for their own tractor or passes it to a
   partner, plans the order to drive round the farms, then runs the day. Money is the business's own account, in
   shillings: hire prices and diesel are Wakala's real figures (tractor/data.ts MONEY and IMPL); everything else here is
   a game estimate, marked as one. No screens or pictures here, so the save and the tests can use it. */

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
/** One map pixel, in km of road: the map is a village about 13 km across. */
export const KM_PER_PX = 0.025;
/** The tractor yard, where every day starts and ends (a node of the road map). */
export const YARD = 'yard';

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
  parts: FarmPart[];
}

const part = (id: string, name: string, tool: BizTool, acres: number): FarmPart => ({ id, name, tool, acres });

/** The farmers around the yard. Each day some of them book work on one or two parts of their farm. */
export const CLIENTS: Client[] = [
  { id: 'wanjiru', name: 'Mama Wanjiru', place: 'Kiambu ridge', parts: [part('top', 'Top field', 'plough', 1.5), part('river', 'River strip', 'harrow', 1)] },
  { id: 'otieno', name: 'Otieno', place: 'Lake road', parts: [part('maize', 'Maize block', 'plough', 2), part('beans', 'Bean rows', 'planter', 1)] },
  { id: 'chebet', name: 'Chebet', place: 'Hill farm', parts: [part('slope', 'The slope', 'ridger', 1), part('flat', 'Flat field', 'harrow', 1.5)] },
  { id: 'kamau', name: 'Kamau', place: 'Market side', parts: [part('north', 'North block', 'plough', 2.5), part('south', 'South block', 'sprayer', 2)] },
  { id: 'akinyi', name: 'Akinyi', place: 'Swamp edge', parts: [part('rice', 'Wet field', 'ridger', 1.5), part('dry', 'Dry field', 'plough', 1)] },
  { id: 'mutua', name: 'Mutua', place: 'Dry plains', parts: [part('east', 'East paddock', 'plough', 3), part('west', 'West paddock', 'harrow', 2)] },
  { id: 'njeri', name: 'Njeri', place: 'School lane', parts: [part('garden', 'Kitchen garden', 'harrow', 0.5), part('maize', 'Maize field', 'planter', 1.5)] },
  { id: 'kiprop', name: 'Kiprop', place: 'Forest gate', parts: [part('new', 'New clearing', 'plough', 2), part('old', 'Old field', 'sprayer', 1.5)] },
  { id: 'achieng', name: 'Mama Achieng', place: 'Home village', parts: [part('home', 'Home field', 'plough', 1), part('sukuma', 'Sukuma beds', 'sprayer', 0.5)] },
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
export const ACRES_AN_HOUR: Record<BizTool, number> = { plough: 0.8, harrow: 1.4, ridger: 0.9, planter: 1, sprayer: 2.5 };
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
  { id: 'county', name: 'County Roads Office', kind: 'Hires tractors', does: 'Rents your tractor for a whole day, with your driver: KSh 120,000, no farms that day.', fee: 0, level: 2 },
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
}

/** Farms, the yard and the crossroads are placed afresh each day, inside this margin of the map. */
const PLACE = { x0: 34, x1: MAP_W - 34, y0: 22, y1: MAP_H - 58, gap: 52 };
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
    be reached from every other. The same map every time for a day, so a reload shows the same village. */
export function mapFor(day: number): BizMap {
  const hit = maps.get(day);
  if (hit) return hit;
  const r = rand(`map:${day}`);
  const ids = [YARD, ...CLIENTS.map(c => c.id), ...Array.from({ length: JUNCTIONS }, (_, k) => `x${k + 1}`)];
  const at: Record<string, Pt> = {};
  // scatter the places, never too close together (and give up gracefully if the map is crowded)
  for (const id of ids) {
    let p: Pt = { x: 0, y: 0 };
    for (let tries = 0, gap = PLACE.gap; tries < 400; tries++) {
      if (tries % 100 === 99) gap *= 0.85;
      p = { x: PLACE.x0 + r() * (PLACE.x1 - PLACE.x0), y: PLACE.y0 + r() * (PLACE.y1 - PLACE.y0) };
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
  const m: BizMap = { day, at, junctions, roads, km, via };
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
export const stopsOf = (route: string[], bookings: Bookings) => route.filter(id => Object.entries(bookings).some(([k, v]) => v === 'me' && k.startsWith(`${id}:`)));
/** Every farm booked for the player's own tractor, route or not. */
export const myFarms = (bookings: Bookings) => [...new Set(Object.entries(bookings).flatMap(([k, v]) => (v === 'me' ? [k.split(':')[0]] : [])))];

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
  litres: number;
  diesel: number;
  /** the diesel of the work itself, without the road */
  workDiesel: number;
  revenue: number;
  wage: number;
  commission: number;
  profit: number;
  saved: number;
  farmers: number;
  partnerFarmers: number;
  missed: number;
  /** farms booked for the tractor but not yet put on the route */
  unrouted: string[];
  /** farms the tractor must visit today */
  needed: number;
  /** why the day can't start, or null */
  problem: string | null;
}

/** Everything a day would come to: road and work hours, diesel, money, and the farmers helped. */
export function planDay(b: Biz, requests: ReqKey[], bookings: Bookings, route: string[]): Plan {
  const m = mapFor(b.day);
  const mineFarms = myFarms(bookings);
  const stops = stopsOf(route, bookings);
  const unrouted = mineFarms.filter(id => !stops.includes(id));
  const km = routeKm(m, stops);
  const best = bestRoute(m, mineFarms);
  const bestKm = routeKm(m, best);
  const mine = requests.filter(k => bookings[k] === 'me').map(partOf);
  const theirs = requests.filter(k => bookings[k] === 'partner').map(partOf);
  const acres = mine.reduce((n, x) => n + x.part.acres, 0);
  const workH = mine.reduce((n, x) => n + x.part.acres / (ACRES_AN_HOUR[x.part.tool] * WORK_RATE[b.tractor]), 0);
  const driveH = km / ROAD_KMH;
  const hours = driveH + workH;
  const overH = Math.max(0, hours - DAY_HOURS);
  const price = MONEY.diesel.value * (b.partners.includes('fuel') ? 1 - FUEL_DISCOUNT : 1);
  const workL = mine.reduce((n, x) => n + x.part.acres * IMPL[x.part.tool].lpa, 0) * fuelFactor(b.tractor);
  const litres = km * ROAD_LPKM * fuelFactor(b.tractor) + workL;
  const diesel = Math.round(litres * price);
  const workDiesel = Math.round(workL * price);
  const revenue = mine.reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres), 0);
  const commission = theirs.reduce((n, x) => n + Math.round(hireOf(x.part.tool) * x.part.acres * PARTNER_CUT), 0);
  const wage = mineFarms.length ? DRIVER_WAGE + Math.round((overH * DRIVER_WAGE * OVERTIME) / DAY_HOURS) : 0;
  const farmers = new Set(mine.map(x => x.client.id)).size;
  const partnerFarmers = new Set(theirs.map(x => x.client.id).filter(id => !mine.some(mm => mm.client.id === id))).size;
  const missed = requests.filter(k => !bookings[k]).length;
  const saved = [...mine, ...theirs].reduce((n, x) => n + handCost(x.part.tool, x.part.acres) - Math.round(hireOf(x.part.tool) * x.part.acres), 0);
  const needed = stopsNeeded(b, requests);
  // the day must fit with the shortest way round: a longer route is the player's to find, and costs diesel and overtime
  const fitH = workH + bestKm / ROAD_KMH;
  const noTool = mine.find(x => !b.tools.includes(x.part.tool));
  let problem: string | null = null;
  if (noTool) problem = `You have no ${toolName(noTool.part.tool).toLowerCase()} for ${noTool.client.name}'s ${noTool.part.name.toLowerCase()}: pass it to a partner, or buy one in Fleet.`;
  else if (!mineFarms.length && !theirs.length) problem = 'Book at least one job: tap a farm on the map.';
  else if (mineFarms.length < needed) problem = `Book at least ${needed} farms for your tractor to visit: ${mineFarms.length} so far.`;
  else if (fitH > DAY_HOURS + 1e-9) problem = `That is ${workH.toFixed(1)} hours of work, and the driving still to add: a day has ${DAY_HOURS}. Pass a job to a partner, or drop one.`;
  else if (unrouted.length) problem = `Plan your route: tap the farms in the order your tractor will visit them (${stops.length} of ${mineFarms.length}).`;
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
    litres,
    diesel,
    workDiesel,
    revenue,
    wage,
    commission,
    profit: revenue + commission - diesel - wage,
    saved,
    farmers,
    partnerFarmers,
    missed,
    unrouted,
    needed,
    problem,
  };
}

/** The efficiency score, out of 100: the shortest route's km against the player's. */
export const effScore = (efficiency: number) => Math.round(Math.max(0, Math.min(1, efficiency)) * 100);

/** Stars for a day: one for any work, one for the most efficient route, one for leaving no farmer waiting. */
export const starsOf = (p: Pick<Plan, 'stops' | 'efficiency' | 'missed' | 'farmers' | 'partnerFarmers'>) =>
  (p.farmers + p.partnerFarmers > 0 ? 1 : 0) + (p.stops.length && p.efficiency >= BEST_ROUTE ? 1 : 0) + (p.missed === 0 ? 1 : 0);

/** The day is run: the plan's money and farmers go into the business. */
export function runDay(b: Biz, plan: Plan): { biz: Biz; result: DayResult } {
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
  if (b.cash < p.fee) return `Needs ${kshText(p.fee)}`;
  return null;
}

/** Why an item can't be bought yet, or null. */
export function shopBlock(b: Biz, id: FleetItem): string | null {
  const item = SHOP.find(x => x.id === id)!;
  if (id === 'large' ? b.tractor === 'large' : b.tools.includes(id)) return 'Owned';
  if (levelOf(b.helped).level < item.level) return `Opens at level ${item.level}`;
  if (b.cash < item.price) return `Needs ${kshText(item.price)}`;
  return null;
}
