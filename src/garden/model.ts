/* The two new farms (Farm 7 and Farm 8), at the bottom of the farm either side of the market path. They open after
   day 3 (from farm day 4) and grow what the six farms do not: spinach, cabbage, tomatoes, French beans, onions, watermelon,
   or a fruit orchard. Each is planted with a short mini-game, watered every day (the power system's drip does it
   by itself), and harvested into the store, where the market stall sells it. Spinach and the orchard keep giving.

   No screens here (Garden.tsx), so the saved game can use it. Money is stored money (src/money.ts: 1 = KSh 10). */

import type { ProduceId } from '../produce/model';

export type GardenCropId = 'spinach' | 'cabbage' | 'tomatoes' | 'beans' | 'onions' | 'watermelon' | 'orchard';

export interface GardenCrop {
  id: GardenCropId;
  name: string;
  icon: string;
  produce: ProduceId;
  does: string;
  /** what planting a farm costs (seed, seedlings or young trees) */
  cost: number;
  /** farm days to the first harvest, and between harvests after (0: harvested once) */
  grow: number;
  regrow: number;
  /** kg a harvest at full health */
  kg: number;
  /** litres of water a day (by hand; the drip uses less) */
  water: number;
  /** kg CO₂ the farm stores a day while the crop grows */
  stored: number;
  color: string;
}

export const GARDEN_CROPS: GardenCrop[] = [
  { id: 'spinach', name: 'Spinach', icon: '🥬', produce: 'spinach', does: 'Fast and leafy: cut the outer leaves every 2 days once it is up.', cost: 400, grow: 3, regrow: 2, kg: 30, water: 300, stored: 1.2, color: '#2f8a3a' },
  { id: 'cabbage', name: 'Cabbage', icon: '🥗', produce: 'cabbage', does: 'Firm heads that keep a few days: lots of kg, a low price a kg.', cost: 500, grow: 5, regrow: 0, kg: 150, water: 350, stored: 1.2, color: '#8fbf5a' },
  { id: 'tomatoes', name: 'Tomatoes', icon: '🍅', produce: 'tomatoes', does: 'Staked tomatoes: a good price, but thirsty and slower.', cost: 900, grow: 5, regrow: 0, kg: 120, water: 450, stored: 1.4, color: '#d9432f' },
  { id: 'beans', name: 'French beans', icon: '🫛', produce: 'beans', does: 'For export buyers: beans fix nitrogen, so the soil gains too.', cost: 700, grow: 4, regrow: 0, kg: 60, water: 300, stored: 2.2, color: '#6aa336' },
  { id: 'onions', name: 'Onions', icon: '🧅', produce: 'onions', does: 'Slow, but they keep for weeks in the store without wilting.', cost: 600, grow: 6, regrow: 0, kg: 140, water: 250, stored: 1.0, color: '#b0628a' },
  { id: 'watermelon', name: 'Watermelon', icon: '🍉', produce: 'watermelon', does: 'Heavy fruit on running vines: lots of kg, a low price a kg.', cost: 500, grow: 5, regrow: 0, kg: 200, water: 400, stored: 1.2, color: '#3c9a4a' },
  { id: 'orchard', name: 'Fruit orchard', icon: '🥑', produce: 'fruit', does: 'Grafted avocado and mango trees: slow to start, then fruit every 3 days, and the trees store carbon.', cost: 2500, grow: 7, regrow: 3, kg: 50, water: 350, stored: 5, color: '#4c8f2a' },
];
export const cropOf = (id: GardenCropId) => GARDEN_CROPS.find(c => c.id === id)!;

export const GARDEN = {
  /** the farm day the new farms open (after day 3) */
  openDay: 4,
  /** health lost for each day a crop went unwatered, and its least */
  dry: 15,
  minHealth: 20,
  /** points for planting and for a harvest */
  plantPoints: 30,
  harvestPoints: 20,
};

export interface GardenFarm {
  crop: GardenCropId | null;
  /** farm days: planted, last watered, ready to harvest */
  planted: number;
  watered: number;
  ready: number;
  /** 0 to 100 */
  health: number;
  /** how well it was planted (0 to 1) */
  score: number;
  harvests: number;
}

export interface GardenState {
  farms: GardenFarm[];
  /** kg harvested, all time */
  kg: number;
  /** the last harvest, for its nutrition on the page */
  last?: { farm: number; crop: GardenCropId; kg: number; day: number };
}

const emptyFarm = (): GardenFarm => ({ crop: null, planted: 0, watered: 0, ready: 0, health: 100, score: 0, harvests: 0 });
export const newGarden = (): GardenState => ({ farms: [emptyFarm(), emptyFarm()], kg: 0 });
export const gardenOf = (g: Partial<GardenState> | undefined): GardenState => {
  const base = newGarden();
  const farms = base.farms.map((f, i) => ({ ...f, ...(g?.farms?.[i] ?? {}) }));
  return { ...base, ...(g ?? {}), farms };
};
export const GARDEN_NAMES = ['Farm 7', 'Farm 8'];

export type GardenStatus = 'locked' | 'empty' | 'thirsty' | 'growing' | 'ready';
export function statusOf(f: GardenFarm, day: number): GardenStatus {
  if (day < GARDEN.openDay) return 'locked';
  if (!f.crop) return 'empty';
  if (day >= f.ready) return 'ready';
  if (f.watered < day) return 'thirsty';
  return 'growing';
}

/** The growth stage to draw: 0 just planted … 3 ready. */
export function stageOf(f: GardenFarm, day: number): number {
  if (!f.crop) return -1;
  if (day >= f.ready) return 3;
  const c = cropOf(f.crop);
  const span = f.harvests > 0 && c.regrow ? c.regrow : c.grow;
  const done = 1 - (f.ready - day) / span;
  return done < 0.34 ? 0 : done < 0.67 ? 1 : 2;
}

/** What a harvest gives now (kg), from the crop's health, how it was planted, and how the harvest went. */
export const harvestKg = (f: GardenFarm, score: number) => (f.crop ? Math.round(cropOf(f.crop).kg * (f.health / 100) * (0.8 + 0.2 * f.score) * (0.7 + 0.3 * score)) : 0);

/** A night on the new farms: an unwatered crop loses health; the drip waters them (it needs `litres` from the tank). */
export function gardenNight(g0: Partial<GardenState> | undefined, endedDay: number, drip: boolean): { g: GardenState; litres: number } {
  const g = gardenOf(g0);
  let litres = 0;
  const farms = g.farms.map(f => {
    if (!f.crop || endedDay < f.planted) return f;
    if (drip) {
      litres += Math.round(cropOf(f.crop).water * 0.6);
      return { ...f, watered: endedDay + 1 };
    }
    return f.watered >= endedDay ? f : { ...f, health: Math.max(GARDEN.minHealth, f.health - GARDEN.dry) };
  });
  return { g: { ...g, farms }, litres };
}
