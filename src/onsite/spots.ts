/* Where the farmer stands to do each job by hand on the 3D farm (src/onsite): plain numbers, no three.js, so the
   game's rules can use them. Every spot is clear of the places that open a page when walked to (the pen gate, the
   coop door, the power gate, the Train spot, the house, the market: world/engine.ts PLACES), so doing a job never
   opens one by mistake. `face` is what the farmer turns to while working. */

export interface Spot {
  x: number;
  z: number;
  face?: { x: number; z: number };
}

const at = (x: number, z: number, fx?: number, fz?: number): Spot => ({ x, z, ...(fx !== undefined && fz !== undefined ? { face: { x: fx, z: fz } } : {}) });

/** The cow pen (fenced: the farmer works over the fence) and its feed store by the gate. */
export const PEN = {
  feedStore: at(-8.4, -10.6, -8.4, -12.2),
  trough: at(-15.0, -10.8, -15.0, -13.6),
  milk: at(-13.2, -10.8, -13.2, -12.4),
  west: at(-19.0, -10.8, -19.0, -13.0),
  east: at(-11.1, -16.4, -13.0, -16.4),
  shed: at(-11.1, -18.8, -17.4, -18.4),
};
/** Where a cow comes to be milked, inside the fence; and where the herd gathers at the trough. */
export const COW_MILK = { x: -13.2, z: -12.5 };
export const COW_TROUGH = { x: -15.0, z: -13.0 };

/** The chicken coop, its run and its feed bin. */
export const COOP = {
  feed: at(6.0, -14.0, 6.0, -15.4),
  drinker: at(10.6, -14.0, 10.6, -15.4),
  nest: at(10.2, -18.4, 9.4, -18.4),
  door: at(7.4, -16.9, 7.5, -17.6),
  west: at(6.3, -18.4, 7.0, -18.4),
  feedBin: at(4.4, -17.6, 4.4, -18.6),
};
/** Where the hens gather when fed. */
export const HEN_FEED = { x: 6.0, z: -15.6 };

/** The power yard (src/power): beside each part, outside the fence's blocked ground. */
export const POWER_SPOTS = {
  panelsW: at(14.4, -15.6, 16.6, -15.6),
  panelsS1: at(16.6, -10.2, 16.6, -12.0),
  panelsS2: at(20.2, -10.2, 20.2, -12.0),
  inverter: at(16.2, -8.5, 16.2, -7.9),
  hut: at(16.2, -5.3, 16.2, -6.9),
  battery: at(18.6, -5.3, 18.6, -6.7),
  generator: at(20.4, -10.2, 20.4, -9.0),
  fuel: at(20.6, -5.3, 20.4, -6.6),
};
/** The first four light poles (the ones that carry a real light: world/engine.ts LAMPS), and a spot below each. */
export const LAMP_SPOTS: Spot[] = [
  { x: -2.4, z: -12.2 },
  { x: 2.4, z: -9.0 },
  { x: -12.4, z: -4.0 },
  { x: 12.0, z: -4.4 },
].map(l => at(l.x, l.z + 0.9, l.x, l.z));

/** Around the tractor, in its own frame: x to its right, z forward (World.tsx turns these into farm points). */
export const TRACTOR_SPOTS = {
  front: { x: 0, z: 2.4 },
  left: { x: -1.9, z: 0.2 },
  right: { x: 1.9, z: 0.2 },
  back: { x: 0, z: -2.4 },
};

/** The sheds' store (tools and bags go in here), the farm gate (deliveries), the water tank by the pond, the dog's kennel. */
export const STORE = at(-16.0, -3.6, -17.0, -2.8);
export const DELIVERY = at(3.4, 15.6, 3.4, 17.0);
/** beside the water tank on its stand by the pond (world/engine.ts WATER_TANK at 19.8, 3.9) */
export const TANK_SITE = at(18.0, 4.3, 19.8, 3.9);
export const KENNEL = at(-4.8, -15.0, -4.8, -16.2);
export const FENCE_SPOTS: Spot[] = [at(-3.2, 16.4, -3.2, 17.6), at(3.2, 16.4, 3.2, 17.6), at(21.0, -2.0, 22.4, -2.0)];

/** Farms 7 and 8 (src/garden): three spots across each, from the left (world/field.ts GARDEN_PLOTS). */
export const GARDEN_SPOTS = (i: number): Spot[] => {
  const x = i === 0 ? -7.4 : 7.4;
  return [-1.8, 0, 1.8].map(dx => at(x + dx, 12.2, x + dx, 13.2));
};
