import type { HandsQuestion } from '../minigames/workshop/kit';

/* The tractor yard: the farm's own tractor, looked after and learned. Tapping the tractor (or walking to the Train
   spot beside it) opens the tractor screen with its sections, each a short mini-game: Train (drive the practice
   course: one row of a field per job, with the right implement), Learn (the parts and the safe way to work), Safety check (the walk-round before starting), Service (oil
   and grease), Repair (find what is wrong), Refuel (diesel from the farm's tank or the pump), Hire (the oxen or
   the tractor plough the farms whose plan hires them) and Drive (hop on).

   The tractor wears as it works and burns diesel; a worn tractor drives slower and at the end will not start; a
   trained driver drives faster. The farm's power system makes the workshop's repairs cheaper. No screens here
   (TractorHub.tsx), so the saved game can use it. Money is stored money (src/money.ts: 1 = KSh 10). */

/** 'yard' is the walkable tractor yard itself, where the other sections are stations */
export type HubSection = 'yard' | 'train' | 'learn' | 'safety' | 'service' | 'repair' | 'refuel' | 'hire' | 'drive';

export const HUB = {
  /** the tank holds this many litres; a plot driven burns this much and wears the tractor this much (condition points) */
  tankL: 60,
  perPlotL: 0.08,
  perPlotWear: 0.15,
  /** a before-planting drive and a business day wear it this much */
  driveWear: 2,
  bizWear: 3,
  /** under this condition it drives slower; at 0 it will not start */
  worn: 30,
  wornSpeed: 0.8,
  /** experience for each level (1 to 3), and how much faster each level drives */
  levels: [60, 150, 300],
  speedPerLevel: 0.05,
  /** what servicing and repairing cost (oil, grease, filters; parts), and a litre of diesel at the pump (KSh 200) */
  serviceCost: 150,
  repairCost: 600,
  pumpPrice: 20,
  /** points for each section done well */
  points: { train: 20, learn: 25, safety: 15, service: 15, repair: 20, refuel: 5 },
} as const;

export interface HubState {
  xp: number;
  /** lessons passed (LESSONS ids) */
  lessons: string[];
  /** 0 to 100 */
  condition: number;
  /** litres of diesel in the tractor */
  fuel: number;
  /** each section done, counted */
  done: Partial<Record<HubSection, number>>;
  /** the best score (0 to 1) at each section's mini-game: the stars on its station in the yard */
  best: Partial<Record<HubSection, number>>;
  /** Train: the best score (0 to 1) on each drill passed (training.ts DRILLS ids) */
  drills: Partial<Record<string, number>>;
  /** the farm day of the last safety check */
  safetyDay: number | null;
  /** newest first */
  log: { day: number; text: string }[];
}

export const newHub = (): HubState => ({ xp: 0, lessons: [], condition: 100, fuel: HUB.tankL, done: {}, best: {}, drills: {}, safetyDay: null, log: [] });
export const hubOf = (h: Partial<HubState> | undefined): HubState => ({ ...newHub(), ...(h ?? {}), done: { ...(h?.done ?? {}) }, best: { ...(h?.best ?? {}) }, drills: { ...(h?.drills ?? {}) } });

/** The driver's level, 0 to 3. */
export const levelOf = (xp: number) => HUB.levels.filter(n => xp >= n).length;
/** How fast the tractor drives now, from the driver's level and the tractor's condition. */
export function speedOf(h: HubState) {
  return (1 + HUB.speedPerLevel * levelOf(h.xp)) * (h.condition < HUB.worn ? HUB.wornSpeed : 1);
}
/** Why the tractor cannot be driven now, or null. */
export function cannotDrive(h: HubState): string | null {
  if (h.condition <= 0) return 'The tractor will not start: repair it first';
  if (h.fuel <= 0) return 'The tractor’s tank is empty: refuel it first';
  return null;
}

export interface Lesson {
  id: string;
  title: string;
  /** art: the hands-on scene for the question (minigames/workshop/scenes.tsx); task: what to do in it */
  questions: HandsQuestion[];
}

/** Learn: short lessons, each a few questions, each done with the hands on a working tractor (the workshop). */
export const LESSONS: Lesson[] = [
  {
    id: 'parts',
    title: 'Know your tractor',
    questions: [
      { art: 'pto', task: 'Fit the part that joins the tractor to the mower, switch the PTO on, then drive over the grass to cut it.', q: 'Which part turns the plough or the mower behind the tractor?', options: ['The PTO shaft', 'The steering wheel', 'The fuel cap'], right: 0, why: 'The power take-off (PTO) shaft drives the tool behind. Never step over it while it turns.' },
      { art: 'linkage', task: 'Hitch the plough with the right part, lift it with the lever and carry it to the field.', q: 'What do the three-point linkage arms do?', options: ['Lift and hold the tool', 'Pump the tyres', 'Cool the engine'], right: 0, why: 'They lift, lower and hold the plough, harrow or planter.' },
      { art: 'radiator', task: 'Fit the part that cools the engine, start it and keep the needle out of the red.', q: 'Where does the engine’s heat go?', options: ['The radiator', 'The battery', 'The seat'], right: 0, why: 'The radiator cools it: keep its fins clean of chaff and mud.' },
    ],
  },
  {
    id: 'safety',
    title: 'Working safely',
    questions: [
      { art: 'slope', task: 'Drive up to the shed at the top of the steep slope. Watch how far it leans.', q: 'Driving across a steep slope, the tractor can…', options: ['Roll over', 'Go faster', 'Use less diesel'], right: 0, why: 'Drive straight up and down slopes, never across them, and keep the ROPS frame up with the belt on.' },
      { art: 'getoff', task: 'Make the tractor safe with the switches, then get the farmer down to the ground.', q: 'Before getting off the tractor you…', options: ['Lower the tool, stop the PTO and set the brake', 'Leave the engine running', 'Lift the plough high'], right: 0, why: 'A tool left up or a turning shaft injures people walking past, and a tractor without its brake rolls away. Take the key out too.' },
      { art: 'rider', task: 'Drive to the gate. Decide who stays on the tractor and who gets off.', q: 'Who rides on the tractor?', options: ['Only the driver', 'Two friends on the mudguards', 'Children for fun'], right: 0, why: 'Passengers fall under the wheels: the seat is for one.' },
    ],
  },
  {
    id: 'soil',
    title: 'Look after the soil',
    questions: [
      { art: 'wetsoil', task: 'Drive across the field without harming the soil. Let the days pass if you need to.', q: 'Driving on wet soil…', options: ['Packs it hard (compaction)', 'Makes it softer', 'Adds nitrogen'], right: 0, why: 'Heavy wheels on wet ground squeeze out the air roots need. Wait until it is dry enough.' },
      { art: 'deep', task: 'Plough the whole strip. Set the plough’s depth and watch what comes up.', q: 'Ploughing too deep every season…', options: ['Brings up poor subsoil and loses carbon', 'Always raises the yield', 'Stops weeds for good'], right: 0, why: 'Plough shallow, vary the depth, or use a ripper and keep crop residue on top.' },
      { art: 'tyre', task: 'Set the tyres for the field on the gauge, then drive across it.', q: 'Tyre pressure for field work should be…', options: ['Lower than on the road', 'As hard as possible', 'Flat'], right: 0, why: 'Lower pressure spreads the weight and packs the soil less.' },
    ],
  },
];
export const lessonOf = (id: string) => LESSONS.find(l => l.id === id);

/** Safety check: the walk-round before starting, in order. */
export const SAFETY_STEPS = ['Walk round: nobody near the tractor', 'Check the oil and the water', 'Check the tyres and the hitch pins', 'Sit down and put the belt on', 'Gear in neutral, PTO off', 'Start the engine'];
/** A picture for each safety step, in the same order. */
export const SAFETY_ICONS = ['👀', '🛢️', '🛞', '💺', '🕹️', '🔑'];
/** Where each safety step happens on the big tractor drawing (the order game's stage units, 400 × 184): the track
    starts on foot in front of the tractor, goes round it, and ends in the seat with the key. */
export const SAFETY_TRACK = [
  { x: 342, y: 168, hint: 'On foot, all the way round' },
  { x: 246, y: 70, hint: 'Under the bonnet' },
  { x: 70, y: 150, hint: 'The wheels and the hitch pins' },
  { x: 126, y: 54, hint: 'The seat' },
  { x: 151, y: 72, hint: 'The levers' },
  { x: 178, y: 58, hint: 'The key on the dash' },
];
export const SAFETY_START = { x: 376, y: 172 };

/** Service: the points to grease and check, on the tractor drawing (stage coordinates of the mini-game). */
export const SERVICE_SPOTS = [
  { x: 120, y: 120, label: 'Engine oil' },
  { x: 205, y: 95, label: 'Air filter' },
  { x: 92, y: 185, label: 'Front axle grease nipple' },
  { x: 250, y: 175, label: 'Linkage grease nipple' },
  { x: 170, y: 150, label: 'Fan belt' },
  { x: 290, y: 120, label: 'Hydraulic oil' },
];

/** Repair: what can be wrong (three of these are wrong on a visit; the rest are fine). */
export const FAULTS = [
  { x: 92, y: 200, label: 'Flat front tyre' },
  { x: 245, y: 165, label: 'Leaking hydraulic hose' },
  { x: 172, y: 135, label: 'Loose fan belt' },
  { x: 120, y: 95, label: 'Cracked radiator hose' },
  { x: 290, y: 190, label: 'Worn rear tyre' },
  { x: 215, y: 90, label: 'Blocked air filter' },
];

/** The faults on this visit, picked by the number of repairs done so far. */
export function faultsFor(n: number) {
  return [0, 1, 2, 3, 4, 5].filter((_, i) => (i + n) % 2 === 0).map(i => FAULTS[i]);
}
