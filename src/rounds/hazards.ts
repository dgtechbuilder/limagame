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
  | 'virus'
  | 'wind'
  | 'striga'
  | 'erosion'
  | 'rodents'
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
  { id: 'water', label: 'Water & soil', icon: 'water', calls: [c('water', 'Needs water'), c('flood', 'Too much water'), c('erosion', 'Soil washed away')] },
  { id: 'food', label: 'Plant food', icon: 'fertiliser', calls: [c('fertiliser', 'Needs fertiliser')] },
  { id: 'pests', label: 'Pests & disease', icon: 'pests', calls: [c('pests', 'Pests'), c('disease', 'Disease'), c('virus', 'Virus')] },
  { id: 'weeds', label: 'Weeds', icon: 'weeds', calls: [c('weeds', 'Needs weeding'), c('striga', 'Striga (witchweed)')] },
  { id: 'damage', label: 'Animals & weather', icon: 'animals', calls: [c('animals', 'Animals got in'), c('rodents', 'Rats or mole rats'), c('hail', 'Hail or storm damage'), c('wind', 'Wind flattened it')] },
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
const waterCaption = 'Check the furrow and tank.';

export const HAZARDS: Record<HazardId, Hazard> = {
  healthy: {
    id: 'healthy',
    call: 'healthy',
    name: 'A healthy crop',
    crops: ALL,
    weights: { young: 1.5, grow: 1, harvest: 1.5 },
    diary: {
      young: 'Planted with the first rains. Came up evenly.',
      grow: 'Weeded once. Rain every few days.',
      harvest: 'On time. Picking the ripe {produce}.',
    },
    captions: {
      crop: 'Compare it with its neighbour.',
      pests: 'Check one leaf.',
      soil: 'Feel the soil.',
      water: waterCaption,
      farm: 'Look at every row.',
    },
    clue: { part: 'farm', text: 'Every row is strong, even and green, {name}. Nothing is wrong.' },
    right: 'Healthy! Well read, {name}.',
    practice: 'Check weekly: weeds and pests start small.',
  },
  drought: {
    id: 'drought',
    call: 'water',
    name: 'Not enough water',
    crops: ALL,
    weights: { grow: 2 },
    diary: 'No good rain for three weeks. Tank low.',
    captions: {
      crop: 'Front row vs back row.',
      pests: 'Turn a leaf over.',
      soil: 'Feel the soil at the back.',
      water: waterCaption,
      farm: 'Which rows differ from above?',
    },
    clue: { part: 'soil', text: 'No holes, {name}, but the soil is cracked and the leaves droop.' },
    right: 'They are thirsty! Good eye, {name}.',
    practice: 'Water the roots in the cool morning.',
  },
  flood: {
    id: 'flood',
    call: 'flood',
    name: 'Too much water',
    crops: ALL,
    weights: { young: 1, grow: 1, harvest: 1 },
    diary: 'Three days of heavy rain. Furrow overflowed.',
    captions: {
      crop: 'Check the lower leaves and stem base.',
      pests: 'Check one leaf.',
      soil: 'Is the soil firm or soggy?',
      water: waterCaption,
      farm: 'Look for standing water.',
    },
    clue: { part: 'water', text: 'The furrow is overflowing, {name}, and water stands between the rows.' },
    right: 'Too much water! Well read, {name}.',
    practice: 'Dig a drain, and do not water again until the soil is firm.',
  },
  nitrogen: {
    id: 'nitrogen',
    call: 'fertiliser',
    name: 'Short of plant food',
    crops: ['maize', 'kale', 'tomato'],
    weights: { grow: 2 },
    diary: 'Same plot as last season. No manure or fertiliser yet.',
    captions: {
      crop: 'Lowest leaves, then the top.',
      pests: 'Check one leaf.',
      soil: 'Feel the soil.',
      water: waterCaption,
      farm: 'Which rows look paler?',
    },
    clue: { part: 'crop', text: 'The lowest leaves go yellow first, {name}, while new ones stay green: short of food.' },
    right: 'Hungry plants! Well read, {name}.',
    practice: 'Top-dress with fertiliser or manure beside the row.',
  },
  armyworm: {
    id: 'armyworm',
    call: 'pests',
    name: 'Fall armyworm',
    crops: ['maize'],
    weights: { grow: 3 },
    diary: 'Young maize. The rains have been good.',
    captions: {
      crop: 'Compare a front-row plant with a middle one.',
      pests: 'Look into the funnel.',
      soil: 'Feel the soil.',
      water: waterCaption,
      farm: 'Which rows differ from above?',
    },
    clue: { part: 'pests', text: 'Holes and sawdust in the funnel, {name}: something is eating it.' },
    right: 'Fall armyworm! Well read, {name}.',
    practice: 'Ash or sand in each funnel stops them early.',
  },
  aphids: {
    id: 'aphids',
    call: 'pests',
    name: 'Aphids',
    crops: ['kale', 'tomato', 'beans'],
    weights: { grow: 2 },
    diary: 'Dry and warm. Ants climbing the stems.',
    captions: {
      crop: 'Compare front-row leaves with the middle rows.',
      pests: 'Turn a leaf over.',
      soil: 'Feel the soil.',
      water: waterCaption,
      farm: 'Which rows differ from above?',
    },
    clue: { part: 'pests', text: 'Tiny insects crowd under the leaf, {name}, and the leaves curl.' },
    right: 'Aphids! You caught them, {name}.',
    practice: 'Wash them off with soapy water, and check under leaves weekly.',
  },
  disease: {
    id: 'disease',
    call: 'disease',
    name: 'A leaf disease',
    crops: ALL,
    weights: { grow: 2, harvest: 1 },
    diary: 'A warm, wet week. Plants close together.',
    captions: {
      crop: 'Look at the spots on the leaves.',
      pests: 'Check one leaf.',
      soil: 'Feel the soil.',
      water: waterCaption,
      farm: 'Where do the spots start and spread?',
    },
    clue: { part: 'pests', text: '{signs}, {name}, and no insects anywhere. This is a disease: {disease}.' },
    right: 'A disease! You read it well, {name}.',
    practice: 'Burn the worst leaves, keep out of the wet crop, and ask about a safe spray. Rotate next season.',
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
      pests: 'What grows between the plants?',
      soil: 'Check the soil.',
      water: waterCaption,
      farm: 'Green patches between rows?',
    },
    clue: { part: 'farm', text: 'Weeds fill the gaps, {name}, taking water and food from the {crop}.' },
    right: 'Weeds! Sharp eyes, {name}.',
    practice: 'Weed early while weeds are small, and again before flowering.',
  },
  livestock: {
    id: 'livestock',
    call: 'animals',
    name: 'Animals broke the fence',
    crops: ALL,
    weights: { young: 1, grow: 1, harvest: 1 },
    diary: 'An old post-and-wire fence. A windy week.',
    captions: {
      crop: 'Look at the tops of the plants.',
      pests: 'Look at the stems and the ground.',
      soil: 'Check the soil.',
      water: waterCaption,
      farm: 'Walk the farm’s edge.',
    },
    clue: { part: 'farm', text: 'The fence is broken, {name}, and goats are eating the {crop}.' },
    right: 'Animals got in! Well read, {name}.',
    practice: 'Drive them out, mend the fence, and keep goats tied away from crops.',
  },
  wildlife: {
    id: 'wildlife',
    call: 'animals',
    name: 'Birds and monkeys',
    crops: ['maize', 'tomato', 'beans'],
    weights: { harvest: 2 },
    diary: 'Fence sound. Nothing picked yet.',
    captions: {
      crop: 'Look at the {produce}.',
      pests: 'Check one of the {produce}.',
      soil: 'Check the ground below.',
      water: waterCaption,
      farm: 'Is the fence standing? What is overhead?',
    },
    clue: { part: 'pests', text: 'The {produce} are pecked and torn, {name}: birds and monkeys are taking the harvest.' },
    right: 'Birds and monkeys! Good eye, {name}.',
    practice: 'Scare birds at dawn, harvest as soon as ready, and net small plots.',
  },
  hail: {
    id: 'hail',
    call: 'hail',
    name: 'Hail damage',
    crops: ALL,
    weights: { grow: 1, harvest: 1 },
    diary: 'A heavy storm yesterday.',
    captions: {
      crop: 'Leaves, top to bottom.',
      pests: 'Check one leaf.',
      soil: 'Look at the ground.',
      water: waterCaption,
      farm: 'Look at every row from above.',
    },
    clue: { part: 'crop', text: 'Shredded leaves and ice on the ground, {name}: hail came through.' },
    right: 'Hail damage! Well read, {name}.',
    practice: 'Wait a few days: hail-cut plants can recover. Fill only real gaps; ask about insurance.',
  },
  /* The newer problems. They show on the six farms only (weights {}: never drawn in the everyday rounds), from the
     second cycle on (trials/model.ts NEW_HAZARDS). */
  virus: {
    id: 'virus',
    call: 'virus',
    name: 'Maize lethal necrosis',
    crops: ['maize'],
    weights: {},
    diary: 'Saved our own seed this season. Thrips in the funnels last week.',
    captions: {
      crop: 'Look at the top of the plant.',
      pests: 'Look along the leaf.',
      soil: 'Feel the soil.',
      water: waterCaption,
      farm: 'Where are the sick plants?',
    },
    clue: { part: 'pests', text: 'Pale streaks along the leaves and the top drying from the edges in, {name}: a virus, maize lethal necrosis.' },
    right: 'A virus disease! Sharp eyes, {name}.',
    practice: 'Pull out and burn sick plants, plant certified seed, and rotate with beans: the virus cannot live in beans.',
  },
  wind: {
    id: 'wind',
    call: 'wind',
    name: 'Flattened by the wind',
    crops: ['maize', 'beans', 'tomato'],
    weights: {},
    diary: 'A strong wind all night. No trees on the windy side.',
    captions: {
      crop: 'Is the plant standing?',
      pests: 'Look at the base of the stem.',
      soil: 'Look at the roots.',
      water: waterCaption,
      farm: 'Which way do the rows lean?',
    },
    clue: { part: 'farm', text: 'The stalks lie flat, {name}, all one way: the wind blew them over.' },
    right: 'Wind damage! Well read, {name}.',
    practice: 'Stand fallen plants up within a day and earth up their roots. Plant a line of trees on the windy side.',
  },
  striga: {
    id: 'striga',
    call: 'striga',
    name: 'Striga (witchweed)',
    crops: ['maize'],
    weights: {},
    diary: 'Maize on this plot for five seasons. No fertilizer this time.',
    captions: {
      crop: 'The plant wilts: is the soil dry?',
      pests: 'Look at the foot of the stem.',
      soil: 'Feel the soil.',
      water: waterCaption,
      farm: 'Small red or pink flowers between the rows?',
    },
    clue: { part: 'pests', text: 'Red- or pink-flowered striga grows from the maize roots, {name}: it feeds on them, so the maize wilts in damp soil.' },
    right: 'Striga! Good eye, {name}.',
    practice: 'Pull striga before it flowers and burn it. Feed the soil, rotate with beans and plant desmodium between the rows.',
  },
  erosion: {
    id: 'erosion',
    call: 'erosion',
    name: 'Soil washed away',
    crops: ALL,
    weights: {},
    diary: 'Heavy rain on a sloping farm. The rows run down the slope.',
    captions: {
      crop: 'Look at the foot of the plant.',
      pests: 'Check one leaf.',
      soil: 'Where has the topsoil gone?',
      water: 'Where did the rain go?',
      farm: 'Look for channels down the slope.',
    },
    clue: { part: 'soil', text: 'Gullies cut down the farm and the roots stand bare, {name}: the rain washed the topsoil away.' },
    right: 'Soil erosion! Well read, {name}.',
    practice: 'Dig trenches across the slope, plant grass strips along them, and keep the soil covered.',
  },
  rodents: {
    id: 'rodents',
    call: 'rodents',
    name: 'Rats and mole rats',
    crops: ALL,
    weights: {},
    diary: 'Tall bush along the edge. Something busy at night.',
    captions: {
      crop: 'Look at the stems near the ground.',
      pests: 'What made these marks?',
      soil: 'Look at the ground between the rows.',
      water: waterCaption,
      farm: 'Where are the gaps?',
    },
    clue: { part: 'soil', text: 'Fresh mounds, holes and cut stems, {name}: rats and mole rats are digging and gnawing.' },
    right: 'Rats and mole rats! Sharp eyes, {name}.',
    practice: 'Clear the bush at the edge, set traps on their runs, and put up perches for owls.',
  },
  plantEarly: {
    id: 'plantEarly',
    call: 'plantEarly',
    name: 'Planted too early',
    crops: ['maize', 'beans', 'tomato'],
    weights: { young: 2.5 },
    diary: 'Planted two weeks before a short first rain.',
    captions: {
      crop: 'Count the plants that came up.',
      pests: 'Look at the seeds in the soil.',
      soil: 'Is the soil moist enough for seeds?',
      water: 'Has the rain come?',
      farm: 'Look for gaps in the rows.',
    },
    clue: { part: 'soil', text: 'Dry, hard soil, {name}, and many seeds never came up: planted before the rains.' },
    right: 'Planted too early! Good eye, {name}.',
    practice: 'Wait for steady rain to plant, then fill gaps with fresh seed.',
  },
  plantLate: {
    id: 'plantLate',
    call: 'plantLate',
    name: 'Planted too late',
    crops: ['maize', 'beans', 'tomato'],
    weights: { grow: 2 },
    diary: 'Planted in two lots. The rains began early in the month.',
    captions: {
      crop: 'Front rows vs back rows.',
      pests: 'Check one leaf.',
      soil: 'Feel the soil.',
      water: waterCaption,
      farm: 'Plant size, row by row.',
    },
    clue: { part: 'farm', text: 'The back rows are much smaller, {name}: planted weeks after the first rains.' },
    right: 'Planted too late! Sharp eyes, {name}.',
    practice: 'Plant as the rains start: late crops miss rain and meet more pests. If late, use a quick variety.',
  },
  harvestEarly: {
    id: 'harvestEarly',
    call: 'harvestEarly',
    name: 'Harvested too early',
    crops: ['maize', 'beans', 'tomato'],
    weights: { harvest: 4 },
    window: [14, 17],
    diary: 'Picked early to catch high prices.',
    captions: {
      crop: 'Are the {produce} ready?',
      pests: 'Check one of the {produce}.',
      soil: 'Check the ground and piles.',
      water: waterCaption,
      farm: 'Look at what has been picked.',
    },
    clue: { part: 'pests', text: 'The {produce} are green and soft, {name}: picked too soon.' },
    right: 'Picked too early! Well read, {name}.',
    practice: 'Wait until {ready}. Early means light and quick to spoil.',
  },
  harvestLate: {
    id: 'harvestLate',
    call: 'harvestLate',
    name: 'Harvested too late',
    crops: ['maize', 'beans', 'tomato'],
    weights: { harvest: 4 },
    window: [18, 20],
    diary: 'Ready two weeks ago; waiting for transport.',
    captions: {
      crop: 'How long have the {produce} been ripe?',
      pests: 'Check one of the {produce}.',
      soil: 'Check the ground below.',
      water: waterCaption,
      farm: 'What is on the ground?',
    },
    clue: { part: 'pests', text: 'The {produce} are split, rotting and mouldy, {name}: left too long.' },
    right: 'Left too long! Good eye, {name}.',
    practice: 'Harvest as soon as ready, dry well and store off the ground. Late means mould and pests.',
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
