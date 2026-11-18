/* The cows and the hens: every number to tune, in one place. Placeholders until a vet and a livestock officer confirm
   them. Money is stored money (src/money.ts: 1 = KSh 10); litres (L) for water; days are farm days (a night slept
   on the fast clock, or a calendar day).

   Care starts on DAY 2 (LIFE.startDay): the first day is the crops'. From then on, each day the cows and the hens
   need feed, clean water and their produce gathered, and their pen and coop cleaned every few days. Care that is
   missed costs health; low health costs milk and eggs, and in the end an animal. Diseases and problems (ISSUES) show
   by their signs: the player picks the fix, as with the crops. Vaccines and tick control (PREVENT) keep them away. */

export type Group = 'cows' | 'hens';

export const LIFE = {
  /** the farm day the animals come into the player's care */
  startDay: 2,
  /** the farm day the chicken coop can be upgraded (the first day: the hens need a roof from the start) */
  coopDay: 1,
  /** the farm day the cow shed can be upgraded */
  shedDay: 3,
  /** at most this many nights are counted after time away */
  catchUpNights: 3,
  /** a healthy cow's milk a day, and its price a litre (KSh 50) */
  milk: { perCow: 10, price: 5 },
  /** a healthy hen's eggs a day, and the price an egg (KSh 15) */
  eggs: { perHen: 0.8, price: 1.5 },
  /** what a cow or a hen costs to buy (KSh 80,000 and KSh 700), and the share of it a sale brings back */
  price: { cow: 8000, hen: 70, sellShare: 0.8 },
  health: {
    start: 90,
    /** lost for each day the feed, the water or the cleaning was missed */
    missFeed: 12,
    missWater: 18,
    dirty: 6,
    /** lost each day for the tank running dry (no water in the trough at all) */
    thirst: 20,
    /** gained on a day of full care with nothing wrong */
    recover: 6,
    /** under this, an animal dies in the night (health then goes back to `afterDeath`) */
    deathAt: 25,
    afterDeath: 55,
  },
  /** the chance a night brings a new problem to a group, before what raises or lowers it */
  issueChance: { cows: 0.14, hens: 0.16 },
  /** at most this many problems at once in a group */
  maxIssues: 2,
  /** hens over the coop's room: problems this much likelier */
  crowded: 1.6,
  /** a pen or coop not cleaned for this many days is dirty */
  cleanEvery: 3,
} as const;

/* ---------------- the daily care ---------------- */

export type CareId = 'cowFeed' | 'cowWater' | 'milk' | 'pen' | 'henFeed' | 'henWater' | 'eggs' | 'coopClean' | 'closeCoop';

export interface Care {
  id: CareId;
  group: Group;
  label: string;
  /** what it does, in a line */
  does: string;
  /** money for each animal (feed) */
  costEach?: number;
  /** done every this many days (1: daily) */
  every: number;
}

export const CARE: Care[] = [
  { id: 'cowFeed', group: 'cows', label: 'Feed the cows', does: 'Napier grass, hay and dairy meal: a fed cow gives all her milk.', costEach: 25, every: 1 },
  { id: 'cowWater', group: 'cows', label: 'Fill the trough', does: 'Clean water from the tank: 50 L for each cow. No water, no milk.', every: 1 },
  { id: 'milk', group: 'cows', label: 'Milk the cows', does: 'Wash hands and udders first. The milk is sold to the dairy.', every: 1 },
  { id: 'pen', group: 'cows', label: 'Clean the pen', does: 'Muck out, dry bedding, look for ticks. Every 3 days.', every: 3 },
  { id: 'henFeed', group: 'hens', label: 'Feed the hens', does: 'Layers mash: about 120 g a hen. A fed hen lays.', costEach: 0.7, every: 1 },
  { id: 'henWater', group: 'hens', label: 'Fresh water for the hens', does: 'Wash the drinker and refill it.', every: 1 },
  { id: 'eggs', group: 'hens', label: 'Collect the eggs', does: 'Twice a day keeps them clean and whole. Sold to the shop.', every: 1 },
  { id: 'coopClean', group: 'hens', label: 'Clean the coop', does: 'New dry litter, scrub the perches. Wet litter brings disease. Every 3 days.', every: 3 },
  { id: 'closeCoop', group: 'hens', label: 'Shut the coop for the night', does: 'Hens in, door shut: safe from thieves, mongooses and hawks.', every: 1 },
];
export const careOf = (id: CareId) => CARE.find(c => c.id === id)!;

/* ---------------- the chicken coop ---------------- */

export type CoopId = 'shelter' | 'basic' | 'mobile' | 'secure' | 'layers';

export interface CoopOption {
  id: CoopId;
  name: string;
  does: string;
  price: number;
  /** hens it holds */
  room: number;
  /** more eggs: nest boxes keep them clean and in one place */
  eggs: number;
  /** a share off the risk of thieves and of predators at night (once the door is shut) */
  theft: number;
  predators: number;
  /** a share off the risk of the coop's diseases (a raised, slatted floor stays dry) */
  disease: number;
  /** how it looks on the 3D farm */
  look: 'basic' | 'secure';
}

/** Simplest first, by price (an upgrade pays the difference): the first two from day 1, the third from day 2, the last
    two from day 3 (src/unlock/model.ts). */
export const COOPS: CoopOption[] = [
  { id: 'shelter', name: 'Night shelter', does: 'A roof on poles over a few perches: dry at night, but open on every side.', price: 600, room: 10, eggs: 0.05, theft: 0.15, predators: 0.3, disease: 0.05, look: 'basic' },
  { id: 'basic', name: 'Simple coop', does: 'Timber walls, an iron-sheet roof, perches and four nest boxes.', price: 1500, room: 20, eggs: 0.15, theft: 0.4, predators: 0.6, disease: 0.1, look: 'basic' },
  { id: 'mobile', name: 'Movable coop', does: 'A coop on wheels, moved to fresh grass each week: clean ground, fewer worms, manure spread for you.', price: 2500, room: 15, eggs: 0.2, theft: 0.35, predators: 0.7, disease: 0.35, look: 'basic' },
  { id: 'secure', name: 'Raised coop with wire mesh', does: 'Off the ground on posts, a slatted floor, wire mesh all round and a padlock.', price: 4000, room: 60, eggs: 0.25, theft: 0.75, predators: 0.9, disease: 0.45, look: 'secure' },
  { id: 'layers', name: 'Layer house', does: 'A block house with wire windows, a nest box for every four hens, feeders and a locked door.', price: 8000, room: 60, eggs: 0.35, theft: 0.85, predators: 0.95, disease: 0.55, look: 'secure' },
];
export const coopOption = (id: CoopId | null | undefined) => COOPS.find(c => c.id === id) ?? null;
/** Hens with no coop roost in the trees: some of their eggs are laid in the bush and lost. */
export const NO_COOP = { room: 10, eggs: -0.3 };

/* ---------------- the cow shed ---------------- */

export type ShedId = 'shade' | 'roofed' | 'stall' | 'zero' | 'barn';

export interface ShedOption {
  id: ShedId;
  name: string;
  does: string;
  price: number;
  /** more milk: shade, a dry floor and feed in reach */
  milk: number;
  /** a share off the cows' disease risk (a dry, clean floor) */
  disease: number;
  /** a share off the risk of a cow being stolen (a locked shed at night) */
  theft: number;
  /** litres of rain the shed's gutters catch into the tank a day (normal season) */
  gutter: number;
  /** how it looks on the 3D farm */
  look: 'roofed' | 'zero';
}

/** Simplest first, by price (an upgrade pays the difference). The shed opens on day 3, when all five are open
    (src/unlock/model.ts). */
export const SHEDS: ShedOption[] = [
  { id: 'shade', name: 'Shade roof over the pen', does: 'Iron sheets on poles: shade and a dry spot, but the cows still stand in mud.', price: 2500, milk: 0.04, disease: 0.08, theft: 0.05, gutter: 40, look: 'roofed' },
  { id: 'roofed', name: 'Roofed cow shed', does: 'Timber posts, an iron-sheet roof, a feed trough and a raised sleeping area.', price: 6000, milk: 0.1, disease: 0.2, theft: 0.2, gutter: 80, look: 'roofed' },
  { id: 'stall', name: 'Shed with stalls and mats', does: 'A stall and a rubber mat for each cow: clean, dry udders and rested legs.', price: 9000, milk: 0.15, disease: 0.3, theft: 0.25, gutter: 120, look: 'roofed' },
  { id: 'zero', name: 'Zero-grazing unit', does: 'A concrete floor that drains, feed and water troughs, a locked gate and gutters into the tank.', price: 15000, milk: 0.25, disease: 0.45, theft: 0.5, gutter: 220, look: 'zero' },
  { id: 'barn', name: 'Barn with a milking parlour', does: 'Cubicles, a clean milking room with a water point, a manure pit and a locked yard.', price: 24000, milk: 0.32, disease: 0.5, theft: 0.6, gutter: 300, look: 'zero' },
];
export const shedOption = (id: ShedId | null | undefined) => SHEDS.find(c => c.id === id) ?? null;

/* ---------------- prevention ---------------- */

export type PreventId = 'fmdVax' | 'dip' | 'ncdVax' | 'deworm';

export interface Prevent {
  id: PreventId;
  group: Group | 'both';
  label: string;
  does: string;
  /** money for each animal */
  costEach: number;
  /** farm days it lasts */
  days: number;
}

export const PREVENT: Prevent[] = [
  { id: 'dip', group: 'cows', label: 'Spray the cows for ticks', does: 'An acaricide spray every week keeps the ticks that carry East Coast fever off.', costEach: 15, days: 7 },
  { id: 'fmdVax', group: 'cows', label: 'Vaccinate against foot-and-mouth', does: 'The county vet’s vaccine, every six months (30 farm days here).', costEach: 30, days: 30 },
  { id: 'ncdVax', group: 'hens', label: 'Vaccinate the hens against Newcastle', does: 'An eye drop for every bird, every three months (21 farm days here).', costEach: 1, days: 21 },
  { id: 'deworm', group: 'both', label: 'Deworm every animal', does: 'Worms take milk, eggs and weight before they show.', costEach: 0, days: 21 },
];
/** Deworming: what a cow and a hen take. */
export const DEWORM = { cow: 12, hen: 0.5 };
export const preventOf = (id: PreventId) => PREVENT.find(p => p.id === id)!;

/* ---------------- diseases and problems ---------------- */

export type IssueId = 'ecf' | 'mastitis' | 'fmd' | 'bloat' | 'heat' | 'leak' | 'newcastle' | 'cocci' | 'mites' | 'eggEating';

export interface Fix {
  id: string;
  label: string;
  right: boolean;
  cost: number;
  /** why it is right, or what it gets wrong */
  lesson: string;
}

export interface Issue {
  id: IssueId;
  group: Group;
  name: string;
  /** what the player sees: the signs, as a vet would teach them */
  signs: string;
  cause: string;
  /** how to keep it away */
  prevent: string;
  /** the prevention that keeps it away (its chance is cut by `cut`) */
  preventBy?: PreventId;
  /** how likely it is among the group's problems (weights) */
  weight: number;
  /** health lost each day it is left */
  health: number;
  /** milk or eggs left while it lasts (a share: 0.6 = 60%) */
  output: number;
  /** from this many days left, it kills: the share of the group lost each further day (at least one animal) */
  kills?: { after: number; share: number };
  /** litres a day it wastes from the tank while it lasts */
  water?: number;
  fixes: Fix[];
}

export const ISSUES: Issue[] = [
  {
    id: 'ecf',
    group: 'cows',
    name: 'East Coast fever',
    signs: 'A swollen lump under the ear, a high fever, fast breathing, tears and a runny nose. She will not eat.',
    cause: 'Brown ear ticks carry it from cow to cow.',
    prevent: 'Spray or dip for ticks every week; keep the grass round the pen short.',
    preventBy: 'dip',
    weight: 3,
    health: 16,
    output: 0.3,
    kills: { after: 3, share: 0.5 },
    fixes: [
      { id: 'vet', label: 'Call the vet now: an injection for East Coast fever, then spray for ticks', right: true, cost: 450, lesson: 'Caught early, buparvaquone saves most cows. The tick spray stops the next one.' },
      { id: 'antibiotic', label: 'Give the antibiotic left over from last time', right: false, cost: 60, lesson: 'Antibiotics do not touch the parasite that causes it, and a half dose breeds resistance.' },
      { id: 'wait', label: 'Rest her for two days and see', right: false, cost: 0, lesson: 'It kills in days. Every day waited makes the vet’s treatment less likely to work.' },
    ],
  },
  {
    id: 'mastitis',
    group: 'cows',
    name: 'Mastitis',
    signs: 'One quarter of the udder is hot, hard and swollen; the milk has clots and flakes in it.',
    cause: 'Germs from dirty hands, a wet pen or a dirty udder get into the teat.',
    prevent: 'Wash hands and udders before milking; dip the teats after; keep the bedding dry.',
    weight: 3,
    health: 8,
    output: 0.5,
    fixes: [
      { id: 'tube', label: 'Milk her out last, a tube of mastitis medicine into the teat, and throw that milk away for 3 days', right: true, cost: 120, lesson: 'Milk with medicine in it must not be sold: the dairy tests for it and people can react to it.' },
      { id: 'sell', label: 'Keep milking and sell the milk as usual', right: false, cost: 0, lesson: 'The milk is spoiled and spreads the germs to the other quarters and cows.' },
      { id: 'salt', label: 'Rub salt and hot water on the udder', right: false, cost: 10, lesson: 'Warm water helps a little; it does not clear the infection inside.' },
    ],
  },
  {
    id: 'fmd',
    group: 'cows',
    name: 'Foot-and-mouth disease',
    signs: 'Blisters on the tongue and between the hooves, drooling, smacking lips, limping. The milk drops at once.',
    cause: 'A virus that spreads fast between herds: at markets, on shared paths and dips.',
    prevent: 'Vaccinate every six months; keep new animals apart for two weeks.',
    preventBy: 'fmdVax',
    weight: 2,
    health: 12,
    output: 0.3,
    fixes: [
      { id: 'report', label: 'Keep her apart, soft feed and clean water, and report it to the county vet', right: true, cost: 150, lesson: 'It must be reported: the vet sets a quarantine so it does not reach the neighbours’ herds.' },
      { id: 'market', label: 'Sell her quickly at the market before she gets worse', right: false, cost: 0, lesson: 'Moving a sick cow spreads it to every herd at the market, and it is against the law.' },
      { id: 'herbs', label: 'Wash the blisters with herbs and keep her with the herd', right: false, cost: 20, lesson: 'Kept with the herd, every cow gets it.' },
    ],
  },
  {
    id: 'bloat',
    group: 'cows',
    name: 'Bloat',
    signs: 'Her left side is swollen high and tight like a drum; she kicks at her belly and breathes hard.',
    cause: 'Too much wet, young legume (lucerne, clover) at once.',
    prevent: 'Give hay first in the morning; wilt fresh legumes before feeding them.',
    weight: 2,
    health: 20,
    output: 0.5,
    kills: { after: 1, share: 0.5 },
    fixes: [
      { id: 'drench', label: 'Walk her, give a cooking-oil drench and call the vet', right: true, cost: 80, lesson: 'Oil breaks up the froth that traps the gas; walking keeps it moving.' },
      { id: 'water', label: 'Give her plenty of water', right: false, cost: 0, lesson: 'Water does not release the gas, and makes the froth worse.' },
      { id: 'lie', label: 'Let her lie down and rest', right: false, cost: 0, lesson: 'Lying down presses on her lungs: bloat can kill within hours.' },
    ],
  },
  {
    id: 'heat',
    group: 'cows',
    name: 'Heat stress',
    signs: 'Panting with her mouth open, standing in the only shade, drinking more and giving less milk.',
    cause: 'A hot, dry spell with too little shade or water.',
    prevent: 'Shade over the pen, the trough always full, feed in the cool of the morning and evening.',
    weight: 1,
    health: 8,
    output: 0.6,
    water: 30,
    fixes: [
      { id: 'shade', label: 'Put up a shade net over the pen and keep the trough full', right: true, cost: 200, lesson: 'Shade and water bring her temperature down; she drinks more, so watch the tank.' },
      { id: 'less', label: 'Give her less water so the tank lasts', right: false, cost: 0, lesson: 'A hot cow needs more water, not less: without it her milk stops.' },
      { id: 'noon', label: 'Move her feeding to midday', right: false, cost: 0, lesson: 'Digesting at the hottest time makes her hotter: feed early and late.' },
    ],
  },
  {
    id: 'leak',
    group: 'cows',
    name: 'Leaking trough',
    signs: 'Mud all round the trough, the float valve hisses, and the tank drops faster than the cows drink.',
    cause: 'A worn float valve and a cracked trough: water runs to waste day and night.',
    prevent: 'Look at the trough every day; fix a drip the day it starts.',
    weight: 2,
    health: 2,
    output: 1,
    water: 300,
    fixes: [
      { id: 'valve', label: 'Fit a new float valve and seal the crack', right: true, cost: 90, lesson: 'A dripping trough can waste 300 L a day: more than the cows drink.' },
      { id: 'bucket', label: 'Put a bucket under the drip', right: false, cost: 0, lesson: 'The bucket fills in an hour; the leak goes on.' },
      { id: 'off', label: 'Turn the tank’s tap off at night', right: false, cost: 0, lesson: 'The cows have no water at night, and it still leaks by day.' },
    ],
  },
  {
    id: 'newcastle',
    group: 'hens',
    name: 'Newcastle disease',
    signs: 'Hens gasping and coughing, green watery droppings, twisted necks, and some dead on the perch in the morning.',
    cause: 'A virus brought in by new birds, wild birds and on people’s shoes.',
    prevent: 'Vaccinate every three months; keep new birds apart for two weeks.',
    preventBy: 'ncdVax',
    weight: 3,
    health: 18,
    output: 0.3,
    kills: { after: 1, share: 0.25 },
    fixes: [
      { id: 'isolate', label: 'Take the sick birds out, vaccinate the healthy ones today, and burn or bury the dead', right: true, cost: 60, lesson: 'There is no cure: the vaccine saves the birds not yet sick, and the dead must not be eaten or sold.' },
      { id: 'eat', label: 'Kill the sick hens and sell them cheaply', right: false, cost: 0, lesson: 'Sold birds carry the virus to the buyers’ flocks.' },
      { id: 'antibiotic', label: 'Antibiotics in the water', right: false, cost: 30, lesson: 'It is a virus: antibiotics do nothing against it.' },
    ],
  },
  {
    id: 'cocci',
    group: 'hens',
    name: 'Coccidiosis',
    signs: 'Bloody droppings, hens huddled with ruffled feathers and their eyes half shut, pale combs.',
    cause: 'A parasite that thrives in wet, dirty litter.',
    prevent: 'Dry litter: clean the coop every few days and fix leaking drinkers.',
    weight: 3,
    health: 12,
    output: 0.5,
    kills: { after: 3, share: 0.15 },
    fixes: [
      { id: 'amprolium', label: 'A coccidiosis medicine (amprolium) in the water for 5 days, and dry new litter', right: true, cost: 40, lesson: 'The medicine stops the parasite; the dry litter stops it coming back.' },
      { id: 'more', label: 'Give them more feed', right: false, cost: 10, lesson: 'Sick hens cannot use the feed, and the wet litter keeps infecting them.' },
      { id: 'water', label: 'Give them less water so the litter dries', right: false, cost: 0, lesson: 'Hens without water stop laying in a day. Fix the drinker and change the litter instead.' },
    ],
  },
  {
    id: 'mites',
    group: 'hens',
    name: 'Mites and lice',
    signs: 'Hens pecking at their feathers, bare patches round the vent, pale combs, tiny red specks on the perches at night.',
    cause: 'Mites live in the cracks of the perches and feed on the birds at night.',
    prevent: 'A clean coop, a dust bath of dry ash and sand, and new litter often.',
    weight: 2,
    health: 6,
    output: 0.7,
    fixes: [
      { id: 'dust', label: 'Dust the birds and the coop with a poultry insecticide and scrub the perches', right: true, cost: 30, lesson: 'Treat the coop as well as the birds: the mites hide in it by day.' },
      { id: 'oil', label: 'Pour used engine oil on the perches', right: false, cost: 0, lesson: 'It burns the hens’ feet and taints the eggs.' },
      { id: 'leave', label: 'Leave it: mites are normal', right: false, cost: 0, lesson: 'A heavy load of mites makes hens anaemic and they stop laying.' },
    ],
  },
  {
    id: 'eggEating',
    group: 'hens',
    name: 'Egg eating',
    signs: 'Broken shells and yolk in the nest boxes, hens with egg on their beaks; fewer eggs every day.',
    cause: 'Too little calcium makes thin shells; bored, crowded hens learn to break them.',
    prevent: 'Oyster shell or limestone grit in the feed, enough nest boxes, eggs collected twice a day.',
    weight: 1,
    health: 2,
    output: 0.6,
    fixes: [
      { id: 'grit', label: 'Oyster-shell grit in the feed, dark nest boxes, and collect eggs twice a day', right: true, cost: 25, lesson: 'Strong shells and quick collection break the habit.' },
      { id: 'more', label: 'Buy more hens to make up the eggs', right: false, cost: 0, lesson: 'More hens in the same coop crowd it, and they learn the habit too.' },
      { id: 'nothing', label: 'Nothing: they will stop', right: false, cost: 0, lesson: 'It spreads: the other hens copy it.' },
    ],
  },
];
export const issueOf = (id: IssueId) => ISSUES.find(i => i.id === id)!;
