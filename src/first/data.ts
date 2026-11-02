/* First session: farmer looks, the shambas the player reviews, and every line they read.
   One review system drives every shamba; to add a review, add an entry to SHAMBAS. */

export type Call = 'healthy' | 'water' | 'pests' | 'fertiliser';
export type Crop = 'maize' | 'beans' | 'kale' | 'tomato';
/** What is wrong with the problem rows. The art draws each one from this value. */
export type Condition = 'healthy' | 'armyworm' | 'drought' | 'nitrogen' | 'aphids';
export type PartId = 'crop' | 'pests' | 'soil' | 'layout';

export const NAME_SUGGESTIONS = ['Wanjiku', 'Otieno', 'Chebet'];

export interface Look {
  skin: string;
  outfit: string;
  trim: string;
  head: 'wrap' | 'cap' | 'none';
  headColor: string;
}

export const LOOKS: Look[] = [
  { skin: '#8a5634', outfit: '#2f8f4e', trim: '#f2c14e', head: 'wrap', headColor: '#d9572b' },
  { skin: '#6e4127', outfit: '#2b6cb0', trim: '#f4f1e8', head: 'cap', headColor: '#3b3b3b' },
  { skin: '#a46a43', outfit: '#b8432f', trim: '#2c2c2c', head: 'none', headColor: '#1d1d1d' },
  { skin: '#5a3420', outfit: '#7a4fa0', trim: '#f2c14e', head: 'wrap', headColor: '#1f8a70' },
];

export const CALLS: { id: Call; label: string }[] = [
  { id: 'healthy', label: 'Healthy' },
  { id: 'water', label: 'Needs water' },
  { id: 'pests', label: 'Pests' },
  { id: 'fertiliser', label: 'Needs fertiliser' },
];

export const PART_LABELS: Record<PartId, string> = {
  crop: 'The crop',
  pests: 'Pests & disease',
  soil: 'Soil & water',
  layout: 'Layout',
};

/** {name} is replaced with the farmer's name everywhere. */
export interface ShambaReview {
  id: string;
  crop: Crop;
  title: string;
  condition: Exclude<Condition, 'healthy'>;
  correct: Call;
  /** Rows (0 = nearest the path) that show the problem. The rest are healthy. */
  problemRows: number[];
  rows: number;
  /** full = first review (next part highlighted, hints on the first miss); few = later reviews. */
  hints: 'full' | 'few';
  /** First line of the review, if it differs from the default. */
  intro?: string;
  /** One short sentence per part, shown when the player zooms in. It points the eye, it never diagnoses. */
  captions: Record<PartId, string>;
  /** The part to show, and the sentence to read, when the call is wrong. */
  clue: { part: PartId; text: string };
  /** Result lines, one sentence each. */
  right: string;
  practice: string;
  /** Shamba to send the player to after a wrong call. Without one, they look again at the same shamba. */
  retry?: string;
}

export const SHAMBAS: Record<string, ShambaReview> = {
  first: {
    id: 'first',
    crop: 'maize',
    title: "{name}'s shamba",
    condition: 'armyworm',
    correct: 'pests',
    problemRows: [2, 3],
    rows: 5,
    hints: 'full',
    captions: {
      crop: 'Compare a plant from the front row with one from the middle.',
      pests: 'Look down into the leaf funnel.',
      soil: 'Feel the soil between the rows.',
      layout: 'See which rows look different from above.',
    },
    clue: { part: 'pests', text: 'See the holes and the sawdust in the funnel, {name}? Something is eating it.' },
    right: 'Fall armyworm! Well read, {name}.',
    practice: 'A pinch of ash or sand in each funnel stops them early.',
    retry: 'lower',
  },
  lower: {
    id: 'lower',
    crop: 'maize',
    title: "{name}'s back shamba",
    intro: 'Same maize, {name}. Look closely at every part this time.',
    condition: 'armyworm',
    correct: 'pests',
    problemRows: [0, 1],
    rows: 5,
    hints: 'full',
    captions: {
      crop: 'Compare a plant from the front row with one from the back.',
      pests: 'Look down into the leaf funnel.',
      soil: 'Feel the soil between the rows.',
      layout: 'See which rows look different from above.',
    },
    clue: { part: 'pests', text: 'Ragged holes and sawdust mean caterpillars, {name}.' },
    right: 'Fall armyworm! You caught it, {name}.',
    practice: 'A pinch of ash or sand in each funnel stops them early.',
  },
  achieng: {
    id: 'achieng',
    crop: 'kale',
    title: "Mama Achieng's sukuma wiki",
    condition: 'drought',
    correct: 'water',
    problemRows: [3, 4],
    rows: 5,
    hints: 'few',
    captions: {
      crop: 'Compare the front row with the back row.',
      pests: 'Turn a leaf over.',
      soil: 'Feel the soil at the back.',
      layout: 'Find the water furrow.',
    },
    clue: { part: 'soil', text: 'No holes, {name}, but the soil at the back is cracked and dry.' },
    right: 'They are thirsty! Good eye, {name}.',
    practice: 'Water at the roots in the cool of the morning.',
  },
};

/** Village names for the neighbours that appear when the village opens. */
export const NEIGHBOURS = [
  { id: 'achieng', owner: 'Mama Achieng', crop: 'Sukuma wiki' },
  { id: 'baraka', owner: 'Baraka', crop: 'Tomatoes' },
];

export const say = (line: string, name: string) => line.replace(/\{name\}/g, name);
