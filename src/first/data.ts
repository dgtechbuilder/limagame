/* First session: farmer looks, the crops the player checks on their own farm, and every line they read.
   One review system drives every check; to add one, add an entry to SHAMBAS. */

export type Call =
  | 'healthy'
  | 'water'
  | 'pests'
  | 'fertiliser'
  // the field rounds add these
  | 'flood'
  | 'disease'
  | 'weeds'
  | 'animals'
  | 'hail'
  | 'plantEarly'
  | 'plantLate'
  | 'harvestEarly'
  | 'harvestLate';
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
  /** Real photos for some parts, by key under src/rounds/photos (e.g. "armyworm/pests"). Other parts are drawn. */
  photos?: Partial<Record<PartId, string>>;
  /** One short sentence per part, shown when the player zooms in. It points the eye, it never diagnoses. */
  captions: Record<PartId, string>;
  /** The part to show, and the sentence to read, when the call is wrong. */
  clue: { part: PartId; text: string };
  /** Result lines, one sentence each. */
  right: string;
  practice: string;
  /** Shamba to send the player to after a wrong call. Without one, they look again at the same shamba. */
  retry?: string;
  /** Shillings of harvest this problem costs if it is left alone (shown while the player checks). */
  atStake: number;
}

export const SHAMBAS: Record<string, ShambaReview> = {
  first: {
    id: 'first',
    crop: 'maize',
    title: "{name}'s maize",
    condition: 'armyworm',
    correct: 'pests',
    photos: { pests: 'armyworm/pests', soil: '_normal/soil' },
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
    atStake: 10000,
  },
  lower: {
    id: 'lower',
    crop: 'maize',
    title: "{name}'s back maize",
    intro: 'Same maize, {name}. Look closely at every part this time.',
    condition: 'armyworm',
    correct: 'pests',
    photos: { pests: 'armyworm/pests', soil: '_normal/soil' },
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
    atStake: 10000,
  },
  sukuma: {
    id: 'sukuma',
    crop: 'kale',
    title: "{name}'s sukuma wiki",
    intro: 'Now your sukuma wiki, {name}. Look at every part first.',
    condition: 'drought',
    correct: 'water',
    photos: { soil: 'drought/soil' },
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
    atStake: 5000,
  },
};

export const say = (line: string, name: string) => line.replace(/\{name\}/g, name);

/* ------------------------------------------------------------------ */
/* The story so far: three pages, after the farmer is named and before the first walk.
   The farmer bought this farm, last season's harvest failed and lost money, and this season they start by learning
   from each mistake. Each mistake is one the game then teaches: reading the crops (the maize check), watering by
   the soil (the sukuma wiki check), and when to harvest, store and sell (the season). */

export interface StoryMistake {
  /** icon, from the review calls */
  icon: Call;
  what: string;
  lesson: string;
}

export interface StoryPage {
  id: 'bought' | 'failed' | 'learn';
  title: string;
  lines: string[];
  /** page 2: what the season cost, in shillings */
  ledger?: { label: string; ksh: number; kind: 'out' | 'in' | 'lost' }[];
  /** page 3: last season's mistakes, each with what to do instead */
  mistakes?: StoryMistake[];
  button: string;
}

export const STORY: StoryPage[] = [
  {
    id: 'bought',
    title: 'A farm of my own',
    lines: [
      'For years, {name} saved from a job in town. Last year, the savings bought this farm: red soil, a water tank and a small hut.',
      'The plan was simple: plant maize and sukuma wiki, come back at harvest, and sell.',
    ],
    button: 'Next',
  },
  {
    id: 'failed',
    title: 'The harvest that failed',
    lines: [
      'The maize came up green, then went ragged. By the time {name} looked closely, caterpillars had eaten most of it, and the sukuma wiki at the back had dried out.',
    ],
    ledger: [
      { label: 'Spent on seed, fertiliser and labour', ksh: 38000, kind: 'out' },
      { label: 'Earned from the harvest', ksh: 14500, kind: 'in' },
      { label: 'Lost', ksh: 23500, kind: 'lost' },
    ],
    button: 'Next',
  },
  {
    id: 'learn',
    title: 'What went wrong',
    lines: ['This season {name} will farm smarter, starting with last season’s mistakes.'],
    mistakes: [
      { icon: 'pests', what: 'Checked the crops only now and then.', lesson: 'Check every bed often, and catch pests early.' },
      { icon: 'water', what: 'Watered when it was easy.', lesson: 'Read the soil, and water when the crop needs it.' },
      { icon: 'harvestEarly', what: 'Sold everything at harvest, at the lowest price.', lesson: 'Plan when to harvest, store and sell.' },
    ],
    button: 'Start with my maize',
  },
];

export const ksh = (n: number) => `KSh ${n.toLocaleString('en-US')}`;

/* ------------------------------------------------------------------ */
/* The farm update: on arriving at the maize, before the first check, how this season is going. The numbers make one
   story with the checks: what is at stake on the maize and the sukuma wiki (SHAMBAS[…].atStake) is about what the
   season stands to lose, so catching both problems turns a loss back towards breaking even. */

export const FARM_UPDATE = {
  weeks: 7,
  /** spent so far this season: seed, fertilizer and labour (shillings) */
  spent: 21400,
  /** what the harvest would bring at this rate (shillings) */
  atThisRate: 6000,
  title: 'How your farm is doing',
  lines: [
    'Your farm has been running for {weeks} weeks this season, {name}, and you have spent {spent} on seed, fertilizer and labour.',
    'The way it is going, you will lose most of that money again.',
  ],
  crops: [
    { crop: 'maize' as Crop, name: 'Maize', sign: 'Some rows look ragged.', stake: 'first' },
    { crop: 'kale' as Crop, name: 'Sukuma wiki', sign: 'The back rows look dull.', stake: 'sukuma' },
  ],
  button: 'Check my maize',
};

/** What a problem puts at stake, in words for the check screen. */
export const stakeLine = (n: number) => `This problem will cost you about ${ksh(n)} of harvest if it is left alone.`;
export const savedLine = (n: number) => `Caught in time: about ${ksh(n)} of harvest saved.`;
