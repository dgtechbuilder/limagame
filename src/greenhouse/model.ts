/* The greenhouse, where Farm 7 was: a glass house at the bottom of the farm, left of the market path, with four beds.
   It opens after day 3 (from farm day 4) and grows what does best under glass: tomatoes, capsicum, cucumbers,
   strawberries and chillies. The glass keeps off the rain, the cold nights and most pests, so a bed is picked again and
   again; but nothing falls on it from the sky, so every bed is watered every day (the power system's drip does it by
   itself). Each bed is planted with a short mini-game, and its harvests go into the storehouse (src/storehouse), where
   the market stall sells them or they are made into sauce, jam and pickles.

   No screens here (Greenhouse.tsx), so the saved game can use it. Money is stored money (src/money.ts: 1 = KSh 10). */

import type { ProduceId } from '../produce/model';

export type GhCropId = 'tomatoes' | 'capsicum' | 'cucumber' | 'strawberries' | 'chillies';

export interface GhCrop {
  id: GhCropId;
  name: string;
  icon: string;
  produce: ProduceId;
  does: string;
  /** what planting a bed costs (seedlings, stakes, strings) */
  cost: number;
  /** farm days to the first pick, and between picks after */
  grow: number;
  regrow: number;
  /** picks before the plants are spent and the bed is planted again */
  picks: number;
  /** kg a pick at full health */
  kg: number;
  /** litres of water a day (by hand; the drip uses less) */
  water: number;
  color: string;
}

export const GH_CROPS: GhCrop[] = [
  { id: 'tomatoes', name: 'Tomatoes', icon: '🍅', produce: 'tomatoes', does: 'Tall vines tied up strings: under glass they escape the blight that rain spreads, and are picked every 2 days.', cost: 900, grow: 5, regrow: 2, picks: 6, kg: 40, water: 120, color: '#d9432f' },
  { id: 'capsicum', name: 'Capsicum', icon: '🫑', produce: 'capsicum', does: 'Sweet peppers need warm, still air: the glass gives it. Slower, and a good price a kg.', cost: 800, grow: 5, regrow: 3, picks: 5, kg: 30, water: 100, color: '#3f9a3a' },
  { id: 'cucumber', name: 'Cucumbers', icon: '🥒', produce: 'cucumber', does: 'The fastest climber: lots of kg every 2 days, but a low price a kg and thirsty.', cost: 600, grow: 4, regrow: 2, picks: 4, kg: 40, water: 120, color: '#4f8f2a' },
  { id: 'strawberries', name: 'Strawberries', icon: '🍓', produce: 'strawberries', does: 'Low plants kept off the wet soil: few kg, but the best price on the farm, and they make jam.', cost: 1200, grow: 6, regrow: 2, picks: 8, kg: 10, water: 80, color: '#e0364a' },
  { id: 'chillies', name: 'Chillies', icon: '🌶️', produce: 'chillies', does: 'Small, hot and hardy: a few kg each pick, for the stall or for chilli sauce.', cost: 500, grow: 5, regrow: 3, picks: 6, kg: 8, water: 60, color: '#c4302b' },
];
export const ghCropOf = (id: GhCropId) => GH_CROPS.find(c => c.id === id)!;

export const GREENHOUSE = {
  /** the farm day the greenhouse (and the storehouse) open: after day 3 */
  openDay: 4,
  beds: 4,
  /** health lost for each day a bed went unwatered, and its least */
  dry: 15,
  minHealth: 20,
  /** points for planting and for a pick */
  plantPoints: 30,
  harvestPoints: 20,
  /** harvests kept in the log */
  keep: 20,
};

/** The four beds, by the crop each is laid out for: four different fruits and vegetables (any bed grows any of them). */
export const BED_NAMES = ['Bed 1', 'Bed 2', 'Bed 3', 'Bed 4'];
export const BED_SUGGEST: GhCropId[] = ['tomatoes', 'capsicum', 'cucumber', 'strawberries'];

export interface GhBed {
  crop: GhCropId | null;
  /** farm days: planted, last watered, next ready to pick */
  planted: number;
  watered: number;
  ready: number;
  /** 0 to 100 */
  health: number;
  /** how well it was planted (0 to 1) */
  score: number;
  /** picks so far from this planting */
  harvests: number;
}

export interface GhHarvest {
  day: number;
  bed: number;
  crop: GhCropId;
  kg: number;
}

export interface GreenhouseState {
  beds: GhBed[];
  /** kg picked, all time */
  kg: number;
  /** newest first */
  log: GhHarvest[];
}

const emptyBed = (): GhBed => ({ crop: null, planted: 0, watered: 0, ready: 0, health: 100, score: 0, harvests: 0 });
export const newGreenhouse = (): GreenhouseState => ({ beds: Array.from({ length: GREENHOUSE.beds }, emptyBed), kg: 0, log: [] });
export const greenhouseOf = (g: Partial<GreenhouseState> | undefined): GreenhouseState => {
  const base = newGreenhouse();
  const beds = base.beds.map((b, i) => ({ ...b, ...(g?.beds?.[i] ?? {}) }));
  return { ...base, ...(g ?? {}), beds, log: g?.log ?? [] };
};

export type BedStatus = 'locked' | 'empty' | 'thirsty' | 'growing' | 'ready';
export function bedStatus(b: GhBed, day: number): BedStatus {
  if (day < GREENHOUSE.openDay) return 'locked';
  if (!b.crop) return 'empty';
  if (day >= b.ready) return 'ready';
  if (b.watered < day) return 'thirsty';
  return 'growing';
}

/** The growth stage to draw: 0 just planted … 3 ready. -1: nothing planted. */
export function bedStage(b: GhBed, day: number): number {
  if (!b.crop) return -1;
  if (day >= b.ready) return 3;
  const c = ghCropOf(b.crop);
  // once picked, the plants stay grown: only the fruit ripens again
  if (b.harvests > 0) return 2;
  const done = 1 - (b.ready - day) / c.grow;
  return done < 0.34 ? 0 : done < 0.67 ? 1 : 2;
}

/** What a pick gives now (kg), from the bed's health, how it was planted, and how the picking went. */
export const pickKg = (b: GhBed, score: number) => (b.crop ? Math.round(ghCropOf(b.crop).kg * (b.health / 100) * (0.8 + 0.2 * b.score) * (0.7 + 0.3 * score)) : 0);

/** Picks left from this planting. */
export const picksLeft = (b: GhBed) => (b.crop ? Math.max(0, ghCropOf(b.crop).picks - b.harvests) : 0);

/** What the beds need now: to plant, to water, to pick. */
export function ghNeeds(g0: Partial<GreenhouseState> | undefined, day: number) {
  const g = greenhouseOf(g0);
  const st = g.beds.map(b => bedStatus(b, day));
  return { empty: st.filter(x => x === 'empty').length, thirsty: st.filter(x => x === 'thirsty').length, ready: st.filter(x => x === 'ready').length, statuses: st };
}

/** Litres the beds drink a day by hand. */
export const ghWater = (g0: Partial<GreenhouseState> | undefined) => greenhouseOf(g0).beds.reduce((n, b) => n + (b.crop ? ghCropOf(b.crop).water : 0), 0);

/** A night in the greenhouse: an unwatered bed loses health; the drip waters every bed (it needs `litres` from the
    tank, a share of what hand watering takes). */
export function greenhouseNight(g0: Partial<GreenhouseState> | undefined, endedDay: number, drip: boolean, dripShare: number): { g: GreenhouseState; litres: number } {
  const g = greenhouseOf(g0);
  let litres = 0;
  const beds = g.beds.map(b => {
    if (!b.crop || endedDay < b.planted) return b;
    if (drip) {
      litres += Math.round(ghCropOf(b.crop).water * dripShare);
      return { ...b, watered: endedDay + 1 };
    }
    return b.watered >= endedDay ? b : { ...b, health: Math.max(GREENHOUSE.minHealth, b.health - GREENHOUSE.dry) };
  });
  return { g: { ...g, beds }, litres };
}

/** Plant a bed. */
export function plantBed(g0: Partial<GreenhouseState> | undefined, bed: number, crop: GhCropId, score: number, day: number): GreenhouseState {
  const g = greenhouseOf(g0);
  const c = ghCropOf(crop);
  const beds = g.beds.map((b, i) => (i === bed ? { crop, planted: day, watered: day, ready: day + c.grow, health: 100, score: Math.max(0, Math.min(1, score)), harvests: 0 } : b));
  return { ...g, beds };
}

/** Pick a ready bed: the kg, and the greenhouse after (the bed ripens again, or is spent and empty). */
export function pickBed(g0: Partial<GreenhouseState> | undefined, bed: number, score: number, day: number): { g: GreenhouseState; kg: number; crop: GhCropId; spent: boolean } | null {
  const g = greenhouseOf(g0);
  const b = g.beds[bed];
  if (!b?.crop || day < b.ready) return null;
  const c = ghCropOf(b.crop);
  const kg = pickKg(b, score);
  const harvests = b.harvests + 1;
  const spent = harvests >= c.picks;
  const next: GhBed = spent ? emptyBed() : { ...b, ready: day + c.regrow, harvests };
  const beds = g.beds.map((x, i) => (i === bed ? next : x));
  return { g: { ...g, beds, kg: g.kg + kg, log: [{ day, bed, crop: c.id, kg }, ...g.log].slice(0, GREENHOUSE.keep) }, kg, crop: c.id, spent };
}
