/* Field rounds: seven farms, one after the other. Each round is a farm with its own crop and its own problem
   (or none). To add or change a round, edit ROUNDS: everything else is drawn from these records.
   {name} is replaced with the farmer's name everywhere. */

import type { Call, Condition, Crop } from '../first/data';
import type { BedId } from './walk';

export type RoundPart = 'crop' | 'pests' | 'soil' | 'water' | 'farm';

export const ROUND_PARTS: RoundPart[] = ['crop', 'pests', 'soil', 'water', 'farm'];

export const ROUND_PART_LABELS: Record<RoundPart, string> = {
  crop: 'The crop',
  pests: 'Pests & disease',
  soil: 'Soil',
  water: 'Water',
  farm: 'State of the farm',
};

/** After a check, the same farm cannot be checked again for this long. */
export const CHECK_COOLDOWN_S = 30;

/** Points for reading a farm right: on the first look, or on a second look after the cooldown. Paid once per farm. */
export const ROUND_POINTS = { first: 100, second: 50 };

export interface Round {
  id: string;
  /** 1 to 7: the order of the rounds */
  n: number;
  /** which bed on the painted map this farm is */
  bed: BedId;
  crop: Crop;
  /** the farm, as it reads in a title: {name}'s shamba */
  title: string;
  /** the farmer or farm, as it reads on a chip: Mama Achieng */
  short: string;
  /** what the drawn pictures show (used until a real photo is added) */
  cond: Condition;
  correct: Call;
  /** rows (0 = nearest the path) that show the problem in the drawn pictures */
  problemRows: number[];
  rows: number;
  /** One short sentence per picture. It points the eye, it never diagnoses. */
  captions: Record<RoundPart, string>;
  /** The picture to show, and the sentence to read, when the call is wrong. `ring` (percent of the photo: x, y, radius) circles the clue on a real photo. */
  clue: { part: RoundPart; text: string; ring?: [number, number, number] };
  right: string;
  practice: string;
}

const same = {
  water: 'See how much water is in the furrow and the tank.',
};

export const ROUNDS: Round[] = [
  {
    id: 'r1',
    n: 1,
    bed: 'maizeFront',
    crop: 'maize',
    title: "{name}'s shamba",
    short: 'Your shamba',
    cond: 'armyworm',
    correct: 'pests',
    problemRows: [2, 3],
    rows: 5,
    captions: {
      crop: 'Compare a plant from the front row with one from the middle.',
      pests: 'Look down into the leaf funnel.',
      soil: 'Feel the soil between the rows.',
      water: same.water,
      farm: 'See which rows look different from above.',
    },
    clue: { part: 'pests', text: 'See the holes and the sawdust in the funnel, {name}? Something is eating it.' },
    right: 'Fall armyworm! Well read, {name}.',
    practice: 'A pinch of ash or sand in each funnel stops them early.',
  },
  {
    id: 'r2',
    n: 2,
    bed: 'maizeBack',
    crop: 'maize',
    title: "{name}'s back shamba",
    short: 'Back shamba',
    cond: 'healthy',
    correct: 'healthy',
    problemRows: [],
    rows: 5,
    captions: {
      crop: 'Look at the colour and height of the plants in every row.',
      pests: 'Look down into the funnel. Is anything feeding?',
      soil: 'Feel the soil between the rows.',
      water: same.water,
      farm: 'Look at the rows from above. Does any row look different?',
    },
    clue: { part: 'farm', text: 'Every row looks the same, {name}: dark green, tall and even. Nothing is wrong here.' },
    right: 'Healthy! Knowing when to leave it alone is part of reading a shamba, {name}.',
    practice: 'Keep checking every week so you catch trouble early.',
  },
  {
    id: 'r3',
    n: 3,
    bed: 'greensFront',
    crop: 'kale',
    title: "Wambui's sukuma wiki",
    short: 'Wambui',
    cond: 'aphids',
    correct: 'pests',
    problemRows: [1, 2],
    rows: 5,
    captions: {
      crop: 'Compare the leaves in the front row with the middle rows.',
      pests: 'Turn a leaf over and look closely.',
      soil: 'Feel the soil at the roots.',
      water: same.water,
      farm: 'Look for the rows where the leaves curl.',
    },
    clue: { part: 'pests', text: 'Tiny insects crowd under the leaf, {name}, and the leaves curl.' },
    right: 'Aphids! Sharp eyes, {name}.',
    practice: 'Wash small colonies off with soapy water, and look under the leaves every week.',
  },
  {
    id: 'r4',
    n: 4,
    bed: 'greensLeft',
    crop: 'kale',
    title: "Mama Achieng's sukuma wiki",
    short: 'Mama Achieng',
    cond: 'drought',
    correct: 'water',
    problemRows: [3, 4],
    rows: 5,
    captions: {
      crop: 'Compare the front row with the back row.',
      pests: 'Turn a leaf over.',
      soil: 'Feel the soil at the back.',
      water: same.water,
      farm: 'Find the water furrow and see where it stops.',
    },
    clue: { part: 'soil', text: 'No holes, {name}, but the soil at the back is cracked and dry.' },
    right: 'They are thirsty! Good eye, {name}.',
    practice: 'Water at the roots in the cool of the morning.',
  },
  {
    id: 'r5',
    n: 5,
    bed: 'tomatoLeft',
    crop: 'tomato',
    title: "Baraka's tomatoes",
    short: 'Baraka',
    cond: 'nitrogen',
    correct: 'fertiliser',
    problemRows: [2, 3],
    rows: 5,
    captions: {
      crop: 'Compare the lowest leaves with the new leaves at the top.',
      pests: 'Turn a leaf over.',
      soil: 'Feel the soil between the plants.',
      water: same.water,
      farm: 'See where the pale plants are.',
    },
    clue: { part: 'crop', text: 'The lowest leaves go yellow first, {name}, while the new leaves stay green. The plants are short of food.' },
    right: 'They are hungry! Well read, {name}.',
    practice: 'Work manure or compost in around each plant, or top-dress as your extension officer advises.',
  },
  {
    id: 'r6',
    n: 6,
    bed: 'tomatoRight',
    crop: 'tomato',
    title: "Mzee Kamau's tomatoes",
    short: 'Mzee Kamau',
    cond: 'drought',
    correct: 'water',
    problemRows: [3, 4],
    rows: 5,
    captions: {
      crop: 'Compare the leaves in the front row with the back row.',
      pests: 'Turn a leaf over.',
      soil: 'Feel the soil at the back.',
      water: same.water,
      farm: 'Find the furrow and see where it stops.',
    },
    clue: { part: 'water', text: 'The furrow is dry, {name}, and the leaves are drooping.' },
    right: 'Thirsty tomatoes! Good call, {name}.',
    practice: 'Water at the roots in the cool of the morning. A mulch of dry grass keeps the soil moist.',
  },
  {
    id: 'r7',
    n: 7,
    bed: 'maizeFront',
    crop: 'maize',
    title: "{name}'s shamba, six weeks on",
    short: 'Your shamba',
    cond: 'nitrogen',
    correct: 'fertiliser',
    problemRows: [1, 2],
    rows: 5,
    captions: {
      crop: 'Look at the lowest leaves, then the top ones.',
      pests: 'Look down into the funnel.',
      soil: 'Feel the soil between the rows.',
      water: same.water,
      farm: 'See which rows look paler from above.',
    },
    clue: { part: 'crop', text: 'The lowest leaves are yellow, starting at the tip, {name}, while the new leaves are still green.' },
    right: 'Hungry maize! Well read, {name}.',
    practice: 'Top-dress with fertiliser or manure beside the row, as your extension officer advises.',
  },
];

export const roundById = (id: string) => ROUNDS.find(r => r.id === id)!;
