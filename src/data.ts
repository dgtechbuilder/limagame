import { asset } from './assets';

/* ------------------------------------------------------------------ */
/* Shop                                                                 */
/* ------------------------------------------------------------------ */

export type ShopTab = 'food' | 'fertilizer' | 'tank' | 'equipment';

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  iconSize: [number, number];
  price: number;
  /** Harvested stock for the "Sell Food" tab, e.g. 3 of 4 bags */
  stock?: [number, number];
}

export interface ShopTabDef {
  id: ShopTab;
  label: string;
  title: string;
  speech: string;
  icon: string;
  iconOn: string;
  iconSize: [number, number];
  iconOnSize: [number, number];
  priceFont: number;
  nameFont: number;
  items: ShopItem[];
}

export const SHOP_TABS: ShopTabDef[] = [
  {
    id: 'food',
    label: 'Sell Food',
    title: 'Sell your Grown Food',
    speech: 'Sell your freshly harvested crops to earn money',
    icon: asset('tab-food.png'),
    iconOn: asset('tab-food-on.png'),
    iconSize: [48, 37],
    iconOnSize: [60, 45],
    priceFont: 8,
    nameFont: 11,
    items: [
      { id: 'cassava', name: 'Cassava', icon: asset('food-cassava.png'), iconSize: [31, 23], price: 40, stock: [4, 4] },
      { id: 'maize', name: 'Maize', icon: asset('food-maize.png'), iconSize: [31, 23], price: 40, stock: [3, 4] },
      { id: 'carrot', name: 'Carrot', icon: asset('food-carrot.png'), iconSize: [31, 23], price: 40, stock: [1, 4] },
      { id: 'potato', name: 'Potato', icon: asset('food-potato.png'), iconSize: [31, 23], price: 40, stock: [4, 4] },
      { id: 'broccoli', name: 'Broccoli', icon: asset('food-broccoli.png'), iconSize: [31, 23], price: 40, stock: [3, 4] },
      { id: 'spinach', name: 'Spinach', icon: asset('food-spinach.png'), iconSize: [31, 23], price: 40, stock: [1, 4] },
    ],
  },
  {
    id: 'fertilizer',
    label: 'Buy Fertilizer',
    title: 'Buy Fertilizer',
    speech: 'Buy fertilizer to nourish your food',
    icon: asset('tab-fert.png'),
    iconOn: asset('tab-fert-on.png'),
    iconSize: [40, 29],
    iconOnSize: [61, 45],
    priceFont: 8,
    nameFont: 8,
    items: [
      { id: 'nitrogen', name: 'Nitrogen', icon: asset('fert-nitrogen.png'), iconSize: [31, 23], price: 40 },
      { id: 'phosphorus', name: 'Phosphorus', icon: asset('fert-phosphorus.png'), iconSize: [31, 23], price: 40 },
      { id: 'potassium', name: 'Potassium', icon: asset('fert-potassium.png'), iconSize: [31, 23], price: 40 },
      { id: 'npk', name: 'Balance NPK', icon: asset('fert-npk.png'), iconSize: [31, 23], price: 40 },
      { id: 'manure', name: 'Organic Manure', icon: asset('fert-manure.png'), iconSize: [31, 23], price: 40 },
    ],
  },
  {
    id: 'tank',
    label: 'Buy Tank',
    title: 'Buy Water Tank',
    speech: 'Plants need clean water. Buy a water tank to store your water.',
    icon: asset('tab-tank.png'),
    iconOn: asset('tab-tank-on.png'),
    iconSize: [32, 41],
    iconOnSize: [53, 48],
    priceFont: 6,
    nameFont: 8,
    items: [
      { id: 'tank-s', name: 'Small', icon: asset('tank-small.png'), iconSize: [24, 35], price: 2500 },
      { id: 'tank-m', name: 'Medium', icon: asset('tank-medium.png'), iconSize: [24, 35], price: 5000 },
      { id: 'tank-l', name: 'Large', icon: asset('tank-large.png'), iconSize: [30, 35], price: 10000 },
    ],
  },
  {
    id: 'equipment',
    label: 'Buy Equipment',
    title: 'Buy Equipments',
    speech: 'Use equipment to farm better and faster',
    icon: asset('tab-equip.png'),
    iconOn: asset('tab-equip-on.png'),
    iconSize: [40, 29],
    iconOnSize: [60, 45],
    priceFont: 11,
    nameFont: 8,
    items: [
      { id: 'hoe', name: 'Hoe', icon: asset('eq-hoe.png'), iconSize: [38, 29], price: 50 },
      { id: 'spade', name: 'Spade', icon: asset('eq-spade.png'), iconSize: [18, 29], price: 100 },
      { id: 'wheelbarrow', name: 'Wheel barrow', icon: asset('eq-wheelbarrow.png'), iconSize: [38, 29], price: 150 },
      { id: 'rake', name: 'Rake', icon: asset('eq-rake.png'), iconSize: [38, 29], price: 200 },
      { id: 'cultivator', name: 'Cultivator', icon: asset('eq-cultivator.png'), iconSize: [26, 29], price: 250 },
      { id: 'shears', name: 'Shears', icon: asset('eq-shears.png'), iconSize: [26, 29], price: 300 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Farming steps                                                        */
/* ------------------------------------------------------------------ */

export type StepId = 'landprep' | 'planting' | 'fertilizer' | 'pesticides' | 'water' | 'harvest';

export interface StepTask {
  id: string;
  name: string;
  icon: string;
  iconSize: [number, number];
  price: number;
}

export interface StepDef {
  id: StepId;
  label: string;
  title: string;
  icon: string;
  iconOn: string;
  iconSize: [number, number];
  iconOnSize: [number, number];
  columns: 2 | 3;
  nameFont: number;
  tasks: StepTask[];
}

export const STEPS: StepDef[] = [
  {
    id: 'landprep',
    label: 'Land prep',
    title: 'Land preparation',
    icon: asset('step-landprep.png'),
    iconOn: asset('step-landprep-on.png'),
    iconSize: [36, 27],
    iconOnSize: [60, 45],
    columns: 3,
    nameFont: 11,
    tasks: [
      { id: 'land-selection', name: 'Land Selection', icon: asset('lp-land-selection.png'), iconSize: [58, 43], price: 40 },
      { id: 'clearing', name: 'Clearing', icon: asset('lp-clearing.png'), iconSize: [58, 43], price: 40 },
      { id: 'tilling', name: 'Tilling', icon: asset('lp-tilling.png'), iconSize: [53, 44], price: 40 },
      { id: 'leveling', name: 'Leveling', icon: asset('lp-leveling.png'), iconSize: [64, 44], price: 40 },
      { id: 'lp-manure', name: 'Organic Manure', icon: asset('lp-manure.png'), iconSize: [58, 43], price: 40 },
      { id: 'herbicide', name: 'Herbicide', icon: asset('lp-herbicide.png'), iconSize: [38, 38], price: 40 },
    ],
  },
  {
    id: 'planting',
    label: 'Planting',
    title: 'Planting',
    icon: asset('step-planting.png'),
    iconOn: asset('step-planting-on.png'),
    iconSize: [40, 29],
    iconOnSize: [60, 45],
    columns: 2,
    nameFont: 11,
    tasks: [
      { id: 'seeding', name: 'Seeding', icon: asset('pl-seeding.png'), iconSize: [58, 43], price: 40 },
      { id: 'intercropping', name: 'Intercropping', icon: asset('pl-intercropping.png'), iconSize: [68, 44], price: 40 },
      { id: 'transplanting', name: 'Transplanting', icon: asset('pl-transplanting.png'), iconSize: [64, 44], price: 40 },
      { id: 'pl-manure', name: 'Organic Manure', icon: asset('pl-manure.png'), iconSize: [58, 44], price: 40 },
    ],
  },
  {
    id: 'fertilizer',
    label: 'Fertilizer',
    title: 'Fertilizer',
    icon: asset('step-fertilizer.png'),
    iconOn: asset('step-fertilizer-on.png'),
    iconSize: [24, 29],
    iconOnSize: [60, 45],
    columns: 3,
    nameFont: 10,
    tasks: [
      { id: 'f-nitrogen', name: 'Nitrogen', icon: asset('fert-nitrogen.png'), iconSize: [41, 30], price: 40 },
      { id: 'f-phosphorus', name: 'Phosphorus', icon: asset('fert-phosphorus.png'), iconSize: [41, 30], price: 40 },
      { id: 'f-potassium', name: 'Potassium', icon: asset('fert-potassium.png'), iconSize: [41, 30], price: 40 },
      { id: 'f-npk', name: 'Balance NPK', icon: asset('fert-npk.png'), iconSize: [41, 30], price: 40 },
      { id: 'f-manure', name: 'Organic Manure', icon: asset('fert-manure.png'), iconSize: [41, 30], price: 40 },
    ],
  },
  {
    id: 'pesticides',
    label: 'Pesticides',
    title: 'Pesticides',
    icon: asset('step-pesticides.png'),
    iconOn: asset('step-pesticides-on.png'),
    iconSize: [24, 29],
    iconOnSize: [46, 47],
    columns: 2,
    nameFont: 11,
    tasks: [
      { id: 'herbicides', name: 'Herbicides', icon: asset('pe-herbicides.png'), iconSize: [40, 43], price: 40 },
      { id: 'fungicides', name: 'Fungicides', icon: asset('pe-fungicides.png'), iconSize: [40, 43], price: 40 },
      { id: 'nematicides', name: 'Nematicides', icon: asset('pe-nematicides.png'), iconSize: [40, 43], price: 40 },
      { id: 'insecticides', name: 'Insecticides', icon: asset('pe-insecticides.png'), iconSize: [40, 43], price: 40 },
    ],
  },
  {
    id: 'water',
    label: 'Water',
    title: 'Water Management',
    icon: asset('step-water.png'),
    iconOn: asset('step-water-on.png'),
    iconSize: [40, 29],
    iconOnSize: [60, 45],
    columns: 2,
    nameFont: 10,
    tasks: [
      { id: 'w-1000', name: '1,000 L', icon: asset('water-1.png'), iconSize: [40, 43], price: 40 },
      { id: 'w-5000', name: '5,000 L', icon: asset('water-2.png'), iconSize: [48, 46], price: 40 },
      { id: 'w-10000', name: '10,000 L', icon: asset('water-3.png'), iconSize: [59, 46], price: 40 },
      { id: 'w-20000', name: '20,000 L', icon: asset('water-4.png'), iconSize: [66, 46], price: 40 },
    ],
  },
  {
    id: 'harvest',
    label: 'Harvest',
    title: 'Harvest',
    icon: asset('step-harvest.png'),
    iconOn: asset('step-harvest-on.png'),
    iconSize: [40, 29],
    iconOnSize: [60, 45],
    columns: 3,
    nameFont: 11,
    tasks: [
      { id: 'protection', name: 'Harvest Protection', icon: asset('hv-protection.png'), iconSize: [40, 43], price: 40 },
      { id: 'timing', name: 'Timing', icon: asset('hv-timing.png'), iconSize: [40, 43], price: 40 },
      { id: 'reaping', name: 'Reaping', icon: asset('hv-reaping.png'), iconSize: [40, 43], price: 40 },
      { id: 'sorting', name: 'Sorting', icon: asset('hv-sorting.png'), iconSize: [40, 43], price: 40 },
      { id: 'packaging', name: 'Packaging', icon: asset('hv-packaging.png'), iconSize: [40, 43], price: 40 },
      { id: 'storage', name: 'Storage', icon: asset('hv-storage.png'), iconSize: [40, 43], price: 40 },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Storage, value addition, rewards, timing                             */
/* ------------------------------------------------------------------ */

export interface StorageOption {
  id: string;
  name: string;
  icon: string;
  iconSize: [number, number];
  /** coins per bag stored */
  costPerBag: number;
  spoilage: 'High' | 'Medium' | 'Low';
  /** share of bags lost while stored */
  loss: number;
  time: string;
}

export const STORAGE_OPTIONS: StorageOption[] = [
  { id: 'home', name: 'Home Storage', icon: asset('storage-home.png'), iconSize: [40, 43], costPerBag: 0, spoilage: 'High', loss: 0.12, time: '3 days' },
  { id: 'coop', name: 'Cooperative warehouse', icon: asset('storage-coop.png'), iconSize: [54, 43], costPerBag: 2, spoilage: 'Medium', loss: 0.05, time: '2 days' },
  { id: 'cold', name: 'Cold storage', icon: asset('storage-cold.png'), iconSize: [34, 43], costPerBag: 4, spoilage: 'Low', loss: 0.01, time: '1 day' },
];

export interface ProcessOption {
  id: string;
  step: number;
  name: string;
  blurb: string;
  icon: string;
  iconSize: [number, number];
  time: string;
  cost: number;
  profitIncrease: number;
}

export const PROCESSES: ProcessOption[] = [
  { id: 'drying', step: 1, name: 'Drying', blurb: 'Reduce moisture to prevent spoilage', icon: asset('va-drying.png'), iconSize: [37, 33], time: '2 hrs', cost: 10, profitIncrease: 25 },
  { id: 'processing', step: 2, name: 'Processing', blurb: 'Turn grains into flour for higher value', icon: asset('va-processing.png'), iconSize: [37, 38], time: '4 hrs', cost: 10, profitIncrease: 65 },
  { id: 'packaging', step: 3, name: 'Packaging', blurb: 'Attractive packaging builds trust', icon: asset('va-packaging.png'), iconSize: [37, 33], time: '2 hrs', cost: 10, profitIncrease: 40 },
];

export interface Reward {
  id: string;
  name: string;
  icon: string;
  off: number;
  /** points needed to redeem */
  cost: number;
}

export const REWARDS: Reward[] = [
  { id: 'fertilizer', name: 'Fertilizer discount', icon: asset('rw-fertilizer.png'), off: 30, cost: 1500 },
  { id: 'seed', name: 'Seed discount', icon: asset('rw-seed.png'), off: 10, cost: 800 },
  { id: 'equipment', name: 'Equipment discount', icon: asset('rw-equipment.png'), off: 30, cost: 1500 },
  { id: 'irrigation', name: 'Irrigation system discount', icon: asset('rw-irrigation.png'), off: 30, cost: 1500 },
  { id: 'phone', name: 'Phone Loan Discount', icon: asset('rw-phone.png'), off: 10, cost: 800 },
  { id: 'solar', name: 'Solar power discount', icon: asset('rw-solar.png'), off: 30, cost: 1500 },
];

export type HarvestChoice = 'now' | 'wait2' | 'week';

export const HARVEST_CHOICES: {
  id: HarvestChoice;
  label: string;
  icon: string;
  iconSize: [number, number];
  yieldBags: number;
  quality: number;
  note: string;
}[] = [
  { id: 'now', label: 'Harvest now', icon: asset('chest-now.png'), iconSize: [20, 25], yieldBags: 120, quality: 4, note: 'Good yield, average quality' },
  { id: 'wait2', label: 'Wait 2 days', icon: asset('chest-2days.png'), iconSize: [34, 32], yieldBags: 150, quality: 5, note: 'Best yield, best quality' },
  { id: 'week', label: 'Wait 1 week', icon: asset('chest-week.png'), iconSize: [35, 25], yieldBags: 135, quality: 3, note: 'High profit, risk of over-ripening' },
];

export const TIMELINE = [
  { week: 'Week 1', note: 'replant\nfaster, early', star: asset('tl-star1.png') },
  { week: 'Week 2', note: 'Balanced harvest,\nperfect timing', star: asset('tl-star2.png') },
  { week: 'Week 3', note: 'Highest profit,\nrisky, late', star: asset('tl-star3.png') },
  { week: 'Week 4', note: 'Over ripe,\nrisky, late', star: asset('tl-star4.png') },
];

export const TIP =
  'Farmers across Africa dry, mill and package their products to earn more and reduce losses.';

/* ------------------------------------------------------------------ */
/* Season rules                                                         */
/* ------------------------------------------------------------------ */

export const STEP_META: Record<StepId, { days: number; need: number; purpose: string }> = {
  landprep: { days: 3, need: 4, purpose: 'Get the soil ready before you plant' },
  planting: { days: 7, need: 2, purpose: 'Get a strong, even crop in the ground' },
  fertilizer: { days: 21, need: 2, purpose: 'Feed the crop while it grows' },
  pesticides: { days: 14, need: 2, purpose: 'Protect the crop from weeds, pests and disease' },
  water: { days: 21, need: 1, purpose: 'Keep the crop watered through tasseling' },
  harvest: { days: 0, need: 3, purpose: 'Handle the ripe crop well to cut losses' },
};

/** One-line lesson shown when a task is done. */
export const TASK_TIPS: Record<string, string> = {
  'land-selection': 'Pick well-drained land in full sun; maize hates waterlogged soil.',
  clearing: 'Clear weeds and stumps so seedlings are not fighting for light and water.',
  tilling: 'Tilling loosens the soil so roots grow deep and rain soaks in.',
  leveling: 'Level ground spreads water evenly and stops puddles that rot seed.',
  'lp-manure': 'Manure dug in before planting feeds the soil all season.',
  herbicide: 'A pre-planting herbicide clears weeds that would choke seedlings.',
  seeding: 'Plant certified seed about 75 cm between rows and 25 cm apart.',
  intercropping: 'Beans between maize rows add nitrogen and a second harvest.',
  transplanting: 'Fill gaps with seedlings within two weeks so the stand stays even.',
  'pl-manure': 'A handful of manure in each hole gives seedlings a strong start.',
  'f-nitrogen': 'Top-dress nitrogen at knee height; it drives leaf growth.',
  'f-phosphorus': 'Phosphorus at planting builds strong roots.',
  'f-potassium': 'Potassium helps maize resist drought and disease.',
  'f-npk': 'A balanced NPK covers all three main nutrients at once.',
  'f-manure': 'Organic manure improves soil structure and holds moisture.',
  herbicides: 'Control weeds in the first six weeks, when maize suffers most.',
  fungicides: 'Fungicide protects leaves from blight in wet weather.',
  nematicides: 'Nematicides protect roots from soil worms that stunt growth.',
  insecticides: 'Scout weekly for fall armyworm and spray early, into the funnel.',
  'w-1000': 'Even a little water at tasseling protects yield.',
  'w-5000': 'Water most when the crop tassels and silks.',
  'w-10000': 'Deep, less frequent watering grows deeper roots.',
  'w-20000': 'A full tank carries the crop through a dry spell.',
  protection: 'Guard the ripe crop from birds, rodents and theft.',
  timing: 'Harvest when husks are dry and kernels are hard and dented.',
  reaping: 'Reap carefully so cobs are not dropped and broken.',
  sorting: 'Sorting out damaged cobs stops the rest from rotting.',
  packaging: 'Clean, sealed bags keep grain dry and fetch better prices.',
  storage: 'Dry grain well before storing to stop mould.',
};

/** Farming-step tasks that can use an item bought in the Shop instead of coins. */
export const TASK_USES_ITEM: Record<string, string> = {
  'f-nitrogen': 'nitrogen',
  'f-phosphorus': 'phosphorus',
  'f-potassium': 'potassium',
  'f-npk': 'npk',
  'f-manure': 'manure',
  'lp-manure': 'manure',
  'pl-manure': 'manure',
};

export const HARVEST_EFFECT: Record<HarvestChoice, { yieldFactor: number; qualityShift: number }> = {
  now: { yieldFactor: 0.85, qualityShift: 0 },
  wait2: { yieldFactor: 1, qualityShift: 0 },
  week: { yieldFactor: 0.92, qualityShift: -1 },
};

export const GROWING_STEPS: StepId[] = ['landprep', 'planting', 'fertilizer', 'pesticides', 'water'];
export const PLAY_GOAL_HOURS = 20;
