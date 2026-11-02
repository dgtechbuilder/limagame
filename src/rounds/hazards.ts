/* Everything that can go wrong on a farm (or not), and when.
   A farm keeps one crop for a 21-day cycle, and the crop moves through three stages: seedlings (days 1–7),
   growing (days 8–14) and harvest (days 15–21). Each real day, a farm gets one situation drawn from the hazards
   that can happen to that crop at that stage. To add a hazard: add it to HAZARDS, give it a call (and a picture
   in scene.tsx if it needs one). Text placeholders: {name} the farmer, {crop}, {produce}, {ready}, {disease}, {signs}. */

import type { Call, Crop } from '../first/data';

export type Stage = 'young' | 'grow' | 'harvest';
export type HazardId =
  | 'healthy'
  | 'drought'
  | 'flood'
  | 'nitrogen'
  | 'armyworm'
  | 'aphids'
  | 'disease'
  | 'weeds'
  | 'livestock'
  | 'wildlife'
  | 'hail'
  | 'plantEarly'
  | 'plantLate'
  | 'harvestEarly'
  | 'harvestLate';

export type RoundPart = 'crop' | 'pests' | 'soil' | 'water' | 'farm';

/** A farm keeps its crop for this many real days, then the next crop in the rotation takes its place. */
export const CYCLE_DAYS = 21;

export const STAGE_LABELS: Record<Stage, string> = { young: 'Seedlings', grow: 'Growing', harvest: 'Harvest time' };

export const stageOf = (day: number): Stage => (day < 7 ? 'young' : day < 14 ? 'grow' : 'harvest');

/** Crops follow each other on a farm in this order (rotation keeps pests and disease from building up). */
export const ROTATION: Crop[] = ['maize', 'beans', 'kale', 'tomato'];

export const CROP_NAME: Record<Crop, string> = { maize: 'Maize', beans: 'Beans', kale: 'Sukuma wiki', tomato: 'Tomatoes' };

const CROP_WORDS: Record<Crop, Record<string, string>> = {
  maize: { crop: 'maize', produce: 'cobs', ready: 'the husks are dry and the kernels are hard', disease: 'leaf rust', signs: 'Orange-brown dots on the leaves' },
  beans: { crop: 'beans', produce: 'pods', ready: 'the pods are dry and rattle', disease: 'bean rust', signs: 'Orange-brown dots on the leaves' },
  kale: { crop: 'sukuma wiki', produce: 'leaves', ready: 'the leaves are broad and soft', disease: 'black rot', signs: 'Yellow V-shaped patches from the leaf edge' },
  tomato: { crop: 'tomatoes', produce: 'fruit', ready: 'the fruit is red and firm', disease: 'late blight', signs: 'Brown blotches with a pale edge' },
};

export interface CallInfo {
  id: Call;
  label: string;
}

/** The judge screen asks in two taps: a group, then (for groups with more than one) the exact problem. */
export interface CallGroup {
  id: string;
  label: string;
  /** which call's icon stands for the group */
  icon: Call;
  calls: CallInfo[];
}

const c = (id: Call, label: string): CallInfo => ({ id, label });

export const CALL_GROUPS: CallGroup[] = [
  { id: 'ok', label: 'Healthy', icon: 'healthy', calls: [c('healthy', 'Healthy: leave it')] },
  { id: 'water', label: 'Water', icon: 'water', calls: [c('water', 'Needs water'), c('flood', 'Too much water')] },
  { id: 'food', label: 'Plant food', icon: 'fertiliser', calls: [c('fertiliser', 'Needs fertiliser')] },
  { id: 'pests', label: 'Pests & disease', icon: 'pests', calls: [c('pests', 'Pests'), c('disease', 'Disease')] },
  { id: 'weeds', label: 'Weeds', icon: 'weeds', calls: [c('weeds', 'Needs weeding')] },
  { id: 'damage', label: 'Animals & weather', icon: 'animals', calls: [c('animals', 'Animals got in'), c('hail', 'Hail or storm damage')] },
  {
    id: 'timing',
    label: 'Plant & harvest time',
    icon: 'plantEarly',
    calls: [c('plantEarly', 'Planted too early'), c('plantLate', 'Planted too late'), c('harvestEarly', 'Harvested too early'), c('harvestLate', 'Harvested too late')],
  },
];

export interface Hazard {
  id: HazardId;
  /** the call that reads this situation right */
  call: Call;
  /** what happened, in a few words (shown once the farm is read right) */
  name: string;
  crops: Crop[];
  /** how likely on a given day in each stage (0 or missing = cannot happen then) */
  weights: Partial<Record<Stage, number>>;
  /** only on these days of the cycle (0 to 20) */
  window?: [number, number];
  /** the farmer's note: planting date, weather, what was done. It helps, but never says what is wrong. */
  diary: string | Record<Stage, string>;
  captions: Record<RoundPart, string>;
  clue: { part: RoundPart; text: string };
  right: string;
  practice: string;
}

const ALL: Crop[] = ['maize', 'beans', 'kale', 'tomato'];
const waterCaption = 'See how much water is in the furrow and the tank.';

export const HAZARDS: Record<HazardId, Hazard> = {
  healthy: {
    id: 'healthy',
    call: 'healthy',
    name: 'A healthy crop',
    crops: ALL,
    weights: { young: 1.5, grow: 1, harvest: 1.5 },
    diary: {
      young: 'Planted with the first good rains. Seeds came up evenly.',
      grow: 'Weeded once. Rain every few days.',
      harvest: 'Planted on time. Picking the {produce} that are ready.',
    },
    captions: {
      crop: 'Compare this plant with the healthy one next to it.',
      pests: 'Look closely at one leaf.',
      soil: 'Feel the soil between the rows.',
      water: waterCaption,
      farm: 'Walk the whole farm and look at every row.',
    },
    clue: { part: 'farm', text: 'Every row looks the same, {name}: strong, even and green. Nothing is wrong here.' },
    right: 'Healthy! Well read, {name}.',
    practice: 'Keep checking every week. Weeds and pests start small.',
  },
  drought: {
    id: 'drought',
    call: 'water',
    name: 'Not enough water',
    crops: ALL,
    weights: { grow: 2 },
    diary: 'No good rain for three weeks. The tank is low.',
    captions: {
      crop: 'Compare the front row with the back row.',
      pests: 'Turn a leaf over.',
      soil: 'Feel the soil at the back.',
      water: waterCaption,
      farm: 'See which rows look different from above.',
    },
    clue: { part: 'soil', text: 'No holes, {name}, but the soil is cracked and dry and the leaves droop.' },
    right: 'They are thirsty! Good eye, {name}.',
    practice: 'Water at the roots in the cool of the morning.',
  },
  flood: {
    id: 'flood',
    call: 'flood',
    name: 'Too much water',
    crops: ALL,
    weights: { young: 1, grow: 1, harvest: 1 },
    diary: 'Heavy rain for three days. The furrow overflowed.',
    captions: {
      crop: 'Look at the lower leaves and the base of the plant.',
      pests: 'Look closely at one leaf.',
      soil: 'Is the soil firm or soggy?',
      water: waterCaption,
      farm: 'Look for water lying between the rows.',
    },
    clue: { part: 'water', text: 'The tank is full and the furrow is overflowing, {name}. Water is standing between the rows.' },
    right: 'Too much water! Well read, {name}.',
    practice: 'Dig a drain to carry the water away, and do not water again until the soil is firm.',
  },
  nitrogen: {
    id: 'nitrogen',
    call: 'fertiliser',
    name: 'Short of plant food',
    crops: ['maize', 'kale', 'tomato'],
    weights: { grow: 2 },
    diary: 'Same plot as last season. No manure or fertiliser yet this season.',
    captions: {
      crop: 'Look at the lowest leaves, then the top ones.',
      pests: 'Look closely at one leaf.',
      soil: 'Feel the soil between the rows.',
      water: waterCaption,
      farm: 'See which rows look paler from above.',
    },
    clue: { part: 'crop', text: 'The lowest leaves go yellow first, {name}, while the new leaves stay green. The plants are short of food.' },
    right: 'Hungry plants! Well read, {name}.',
    practice: 'Top-dress with fertiliser or manure beside the row, as your extension officer advises.',
  },
  armyworm: {
    id: 'armyworm',
    call: 'pests',
    name: 'Fall armyworm',
    crops: ['maize'],
    weights: { grow: 3 },
    diary: 'Young maize. The rains have been good.',
    captions: {
      crop: 'Compare a plant from the front row with one from the middle.',
      pests: 'Look down into the leaf funnel.',
      soil: 'Feel the soil between the rows.',
      water: waterCaption,
      farm: 'See which rows look different from above.',
    },
    clue: { part: 'pests', text: 'See the holes and the sawdust in the funnel, {name}? Something is eating it.' },
    right: 'Fall armyworm! Well read, {name}.',
    practice: 'A pinch of ash or sand in each funnel stops them early.',
  },
  aphids: {
    id: 'aphids',
    call: 'pests',
    name: 'Aphids',
    crops: ['kale', 'tomato', 'beans'],
    weights: { grow: 2 },
    diary: 'Dry and warm. Ants were seen going up the stems.',
    captions: {
      crop: 'Compare the leaves in the front row with the middle rows.',
      pests: 'Turn a leaf over.',
      soil: 'Feel the soil between the rows.',
      water: waterCaption,
      farm: 'See which rows look different from above.',
    },
    clue: { part: 'pests', text: 'Tiny insects crowd under the leaf, {name}, and the leaves curl.' },
    right: 'Aphids! You caught them, {name}.',
    practice: 'Wash them off with soapy water early, and check under the leaves every week.',
  },
  disease: {
    id: 'disease',
    call: 'disease',
    name: 'A leaf disease',
    crops: ALL,
    weights: { grow: 2, harvest: 1 },
    diary: 'Warm and wet for a week. The plants are close together.',
    captions: {
      crop: 'Look at the spots on the leaves.',
      pests: 'Look closely at one leaf.',
      soil: 'Feel the soil between the rows.',
      water: waterCaption,
      farm: 'See where the spots start and how far they spread.',
    },
    clue: { part: 'pests', text: '{signs}, {name}, and no insects anywhere. This is a disease: {disease}.' },
    right: 'A disease! You read it well, {name}.',
    practice: 'Remove and burn the worst leaves, keep out of the wet crop, and ask your extension officer about a safe spray. Rotate the crop next season.',
  },
  weeds: {
    id: 'weeds',
    call: 'weeds',
    name: 'Weeds',
    crops: ALL,
    weights: { young: 2, grow: 2 },
    diary: 'Not weeded for three weeks.',
    captions: {
      crop: 'Is the crop being crowded?',
      pests: 'Look at what is growing between the plants.',
      soil: 'Look at the soil between the rows.',
      water: waterCaption,
      farm: 'Look for green patches between the rows.',
    },
    clue: { part: 'farm', text: 'Weeds fill the gaps between the rows, {name}, and take the water and food from the {crop}.' },
    right: 'Weeds! Sharp eyes, {name}.',
    practice: 'Weed early, while the weeds are small, and weed again before the crop flowers.',
  },
  livestock: {
    id: 'livestock',
    call: 'animals',
    name: 'Animals broke the fence',
    crops: ALL,
    weights: { young: 1, grow: 1, harvest: 1 },
    diary: 'The fence is old posts and wire. It was windy this week.',
    captions: {
      crop: 'Look at the tops of the plants.',
      pests: 'Look at the stems and the ground.',
      soil: 'Look at the soil between the rows.',
      water: waterCaption,
      farm: 'Look all the way around the edge of the farm.',
    },
    clue: { part: 'farm', text: 'The fence is broken here, {name}, and goats are inside eating the {crop}.' },
    right: 'Animals got in! Well read, {name}.',
    practice: 'Drive the animals out, mend the fence at once, and keep goats tied up away from the crops.',
  },
  wildlife: {
    id: 'wildlife',
    call: 'animals',
    name: 'Birds and monkeys',
    crops: ['maize', 'tomato', 'beans'],
    weights: { harvest: 2 },
    diary: 'The fence is sound. Nothing has been picked yet.',
    captions: {
      crop: 'Look at the {produce}.',
      pests: 'Look closely at one of the {produce}.',
      soil: 'Look at the ground under the plants.',
      water: waterCaption,
      farm: 'Is the fence still standing? What is above the rows?',
    },
    clue: { part: 'pests', text: 'The {produce} are pecked and torn, {name}, and there are feathers on the ground. Birds and monkeys are taking the harvest.' },
    right: 'Birds and monkeys! Good eye, {name}.',
    practice: 'Scare birds in the early morning, harvest as soon as the {crop} is ready, and use nets on a small plot.',
  },
  hail: {
    id: 'hail',
    call: 'hail',
    name: 'Hail damage',
    crops: ALL,
    weights: { grow: 1, harvest: 1 },
    diary: 'A heavy storm came through yesterday afternoon.',
    captions: {
      crop: 'Look at the leaves from top to bottom.',
      pests: 'Look closely at one leaf.',
      soil: 'Look at the ground.',
      water: waterCaption,
      farm: 'Look at every row from above.',
    },
    clue: { part: 'crop', text: 'The leaves are torn to shreds and there is white ice on the ground, {name}. Hail came through.' },
    right: 'Hail damage! Well read, {name}.',
    practice: 'Wait a few days: plants cut back by hail can recover. Fill only the real gaps, and ask about crop insurance.',
  },
  plantEarly: {
    id: 'plantEarly',
    call: 'plantEarly',
    name: 'Planted too early',
    crops: ['maize', 'beans', 'tomato'],
    weights: { young: 2.5 },
    diary: 'Planted two weeks before the rains. The first rain was short.',
    captions: {
      crop: 'Count the plants that came up.',
      pests: 'Look at the seeds in the soil.',
      soil: 'Feel the soil: is it moist enough for seeds?',
      water: 'See the tank and the furrow: has the rain come?',
      farm: 'Look for gaps in the rows.',
    },
    clue: { part: 'soil', text: 'The soil is dry and hard, {name}, and many seeds never came up. They were planted before the rains.' },
    right: 'Planted too early! Good eye, {name}.',
    practice: 'Wait for steady rain before planting, then fill the gaps with fresh seed straight away.',
  },
  plantLate: {
    id: 'plantLate',
    call: 'plantLate',
    name: 'Planted too late',
    crops: ['maize', 'beans', 'tomato'],
    weights: { grow: 2 },
    diary: 'Planted in two lots. The rains began early in the month.',
    captions: {
      crop: 'Compare the front rows with the back rows.',
      pests: 'Look closely at one leaf.',
      soil: 'Feel the soil between the rows.',
      water: waterCaption,
      farm: 'Look at the size of the plants, row by row.',
    },
    clue: { part: 'farm', text: 'The back rows are much smaller than the front rows, {name}. They were planted weeks after the first rains.' },
    right: 'Planted too late! Sharp eyes, {name}.',
    practice: 'Plant at the start of the rains: late crops miss the best rain and meet more pests. A quick-maturing variety helps if you are late.',
  },
  harvestEarly: {
    id: 'harvestEarly',
    call: 'harvestEarly',
    name: 'Harvested too early',
    crops: ['maize', 'beans', 'tomato'],
    weights: { harvest: 4 },
    window: [14, 17],
    diary: 'Picked this week to sell early, while prices are high.',
    captions: {
      crop: 'Look at the {produce}: are they ready?',
      pests: 'Look closely at one of the {produce}.',
      soil: 'Look at the ground and the piles.',
      water: waterCaption,
      farm: 'Look at what has been picked.',
    },
    clue: { part: 'pests', text: 'The {produce} are still green and soft, {name}. They were picked before they were ready.' },
    right: 'Picked too early! Well read, {name}.',
    practice: 'Wait until {ready}. An early harvest gives low weight and spoils fast.',
  },
  harvestLate: {
    id: 'harvestLate',
    call: 'harvestLate',
    name: 'Harvested too late',
    crops: ['maize', 'beans', 'tomato'],
    weights: { harvest: 4 },
    window: [18, 20],
    diary: 'Ready two weeks ago. Waiting for transport.',
    captions: {
      crop: 'Look at the {produce}: how long have they been ripe?',
      pests: 'Look closely at one of the {produce}.',
      soil: 'Look at the ground under the plants.',
      water: waterCaption,
      farm: 'Look at what is lying on the ground.',
    },
    clue: { part: 'pests', text: 'The {produce} are over-ripe, {name}: split, rotting and mouldy. They stayed in the field too long.' },
    right: 'Left too long! Good eye, {name}.',
    practice: 'Harvest as soon as the {crop} is ready, dry it well and store it off the ground. Late harvests mean mould, losses and pests.',
  },
};

/** Fills the placeholders that depend on the crop. {name} is filled in later, with say(). */
export function withCrop(line: string, crop: Crop): string {
  const w = CROP_WORDS[crop];
  return line.replace(/\{(crop|produce|ready|disease|signs)\}/g, (_, k: string) => w[k]);
}

/* ---------------- days ---------------- */

export { dayNumber } from './farms';

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rand(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const cropFor = (base: Crop, cycle: number): Crop => ROTATION[(ROTATION.indexOf(base) + cycle) % ROTATION.length];

function pool(crop: Crop, stage: Stage, day: number) {
  return (Object.values(HAZARDS) as Hazard[]).filter(h => h.crops.includes(crop) && (h.weights[stage] ?? 0) > 0 && (!h.window || (day >= h.window[0] && day <= h.window[1])));
}

function draw(farm: string, crop: Crop, cycle: number, day: number, salt: number): HazardId {
  const stage = stageOf(day);
  const list = pool(crop, stage, day);
  const total = list.reduce((n, h) => n + (h.weights[stage] ?? 0), 0);
  let r = rand(hash(`${farm}:${cycle}:${day}:${salt}`))() * total;
  for (const h of list) {
    r -= h.weights[stage] ?? 0;
    if (r < 0) return h.id;
  }
  return list[0].id;
}

export interface Today {
  cycle: number;
  /** 0 to 20 */
  day: number;
  stage: Stage;
  crop: Crop;
  hazard: HazardId;
  /** which rows show the problem, when it shows in some rows only */
  problemRows: number[];
}

/** What a farm looks like on a given day of the player's season. The same farm on the same day is always the same. */
export function situation(farm: string, base: Crop, elapsedDays: number, force?: Partial<Pick<Today, 'hazard' | 'crop' | 'stage'>>): Today {
  const cycle = Math.max(0, Math.floor(elapsedDays / CYCLE_DAYS));
  const day = Math.max(0, elapsedDays) % CYCLE_DAYS;
  const crop = force?.crop ?? cropFor(base, cycle);
  let stage = stageOf(day);
  let hazard = draw(farm, crop, cycle, day, 0);
  // never the same problem two days running: the farmer would have fixed it
  if (day > 0 && hazard !== 'healthy' && draw(farm, crop, cycle, day - 1, 0) === hazard) hazard = draw(farm, crop, cycle, day, 1);
  if (force?.hazard) hazard = force.hazard;
  if (force?.stage) stage = force.stage;
  const rows = [[2, 3], [0, 1], [3, 4], [1, 2]];
  return { cycle, day, stage, crop, hazard, problemRows: rows[hash(`${farm}:${cycle}:${day}:rows`) % rows.length] };
}
