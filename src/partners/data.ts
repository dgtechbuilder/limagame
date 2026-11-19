/* Partners: the brands that sponsor parts of the game, and every place in the game a brand can appear (a slot).

   This one file is the whole partnership set-up. To sign a partner, add (or edit) its brand below and put its id on
   the slots it has bought; a slot with no brand shows as Available on the Partners page's Placements tab, which is
   the inventory to sell. The game reads only these tables, so no screen needs changing to swap a brand.

   Hello Tractor is the game's tractor partner (the tractor business is built to its brief). Every other brand here is
   a SAMPLE, made up for the game (sample: true), standing in until a real partner signs for its slot: no real
   company is named or implied. */

export type BrandId = 'hello-tractor' | 'rutuba' | 'shina' | 'tangi' | 'pesa' | 'kinga' | 'jua' | 'ujuzi';

export type PartnerCategory = 'Tractors' | 'Fertilizer' | 'Seed' | 'Water' | 'Finance' | 'Insurance' | 'Solar' | 'Training';

export interface Brand {
  id: BrandId;
  name: string;
  category: PartnerCategory;
  /** a few words under the name, on billboards and cards */
  tagline: string;
  /** the brand's colours: background and the accent on it (text on the background is white) */
  color: string;
  accent: string;
  /** a mark for the brand where no logo file is supplied */
  mark: string;
  /** the offer a player can get from the Partners page: what it is, what it gives, and where in the game it is used */
  offer: {
    title: string;
    line: string;
    /** what the player gets, a line each, shown before they take it */
    get: string[];
    /** where it is used: the button after it is taken, and the game address it opens (src/route.ts) */
    use: { label: string; to: string };
  };
  /** where "Visit" goes (opened in a new tab); none for sample brands */
  url?: string;
  /** a made-up brand standing in until a real partner signs */
  sample: boolean;
}

export const BRANDS: Brand[] = [
  {
    id: 'hello-tractor',
    name: 'Hello Tractor',
    category: 'Tractors',
    tagline: 'Tractor services, booked near you',
    color: '#1f6f5c',
    accent: '#f5c21b',
    mark: '🚜',
    offer: { title: 'Book a tractor through a booking agent', line: 'Ploughing, harrowing and planting at a set price per acre', get: ['Ploughing, harrowing and planting booked for farmers near you', 'An agreed price per acre, settled before the tractor comes', 'Book the jobs yourself in the Tractor business'], use: { label: 'Open the Tractor business', to: '/tractor-business' } },
    url: 'https://hellotractor.com',
    sample: false,
  },
  {
    id: 'rutuba',
    name: 'Rutuba Gold',
    category: 'Fertilizer',
    tagline: 'Feed the soil, grow more maize',
    color: '#2f8a3c',
    accent: '#ffd23f',
    mark: '🌿',
    offer: { title: '10% off Rutuba Gold NPK', line: 'In the Shop, with a planting guide in every bag', get: ['10% off Rutuba Gold NPK in the Shop', 'A planting guide with every bag: how much, and when to top-dress'], use: { label: 'Open the fertilizer shop', to: '/shop/fertilizer' } },
    sample: true,
  },
  {
    id: 'shina',
    name: 'Shina Seeds',
    category: 'Seed',
    tagline: 'Certified seed for every season',
    color: '#b5651d',
    accent: '#ffe08a',
    mark: '🌽',
    offer: { title: 'Seed discount voucher', line: 'Redeem points for certified seed in Rewards', get: ['A voucher for certified maize seed', 'Redeemed with your points in the Rewards hub'], use: { label: 'Open the Rewards hub', to: '/rewards' } },
    sample: true,
  },
  {
    id: 'tangi',
    name: 'Tangi Tanks',
    category: 'Water',
    tagline: 'Store the rain, water all season',
    color: '#2a7fd0',
    accent: '#bfe7f2',
    mark: '💧',
    offer: { title: 'Free gutter kit with a 5,000 L tank', line: 'With the Tangi tank in the Shop’s water-tank section', get: ['A gutter kit, free with a Tangi 5,000 L tank', 'Catch the rain off your roof and water through the dry weeks'], use: { label: 'Open the water-tank shop', to: '/shop/water-tanks' } },
    sample: true,
  },
  {
    id: 'pesa',
    name: 'PesaShamba',
    category: 'Finance',
    tagline: 'Farm loans you can plan for',
    color: '#5b3fa0',
    accent: '#ffcf3f',
    mark: '📱',
    offer: { title: 'Plan a farm loan', line: 'See what a loan costs before you borrow', get: ['A loan quote: what you pay each month, and in all', 'How much of the farm’s income the payments would take'], use: { label: 'Open the Loan calculator', to: '/loan-calculator' } },
    sample: true,
  },
  {
    id: 'kinga',
    name: 'Kinga Cover',
    category: 'Insurance',
    tagline: 'Crop cover for dry spells and floods',
    color: '#c0392b',
    accent: '#fff1c2',
    mark: '☂️',
    offer: { title: 'Learn about crop cover', line: 'What a drought or flood costs, on the Climate page', get: ['What a dry spell or a flood would cost your farm', 'How crop cover would pay out if one comes'], use: { label: 'Open Climate › Shocks', to: '/climate/shocks' } },
    sample: true,
  },
  {
    id: 'jua',
    name: 'JuaPower Solar',
    category: 'Solar',
    tagline: 'Pump water with the sun',
    color: '#e67e22',
    accent: '#fff6d6',
    mark: '☀️',
    offer: { title: 'Solar pump discount', line: 'Redeem points for solar and irrigation in Rewards', get: ['A discount on a solar pump and irrigation', 'Redeemed with your points in the Rewards hub'], use: { label: 'Open the Rewards hub', to: '/rewards' } },
    sample: true,
  },
  {
    id: 'ujuzi',
    name: 'Ujuzi Agri Academy',
    category: 'Training',
    tagline: 'Learn by farming, get certified',
    color: '#1e5b78',
    accent: '#ffcf3f',
    mark: '🎓',
    offer: { title: 'Your farming certificates', line: 'Earn certification levels in My Progress as you play', get: ['A certificate at each level you reach, co-signed by Ujuzi', 'Learning credits for every part of the game'], use: { label: 'Open My Progress', to: '/progress/journey' } },
    sample: true,
  },
];

export const brandOf = (id: BrandId | null | undefined) => (id ? BRANDS.find(b => b.id === id) : undefined);

/** The player's code for a brand's offer, e.g. "RUTU-7K3Q": the brand's first letters, then four from the farmer's
    name, so it is the same each time it is shown and needs nothing more in the save. */
export function offerCode(id: BrandId, farmer = '') {
  const b = brandOf(id);
  const head = (b?.name ?? id).replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase();
  let h = 2166136261;
  for (const ch of `${id}:${farmer.trim().toLowerCase()}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const abc = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L: easy to read out
  let tail = '';
  for (let i = 0; i < 4; i++, h = Math.floor(h / abc.length)) tail += abc[h % abc.length];
  return `${head}-${tail}`;
}

/* ---------------- the slots: every place a brand can appear ---------------- */

export type SlotId =
  | 'world-billboard-west'
  | 'world-billboard-east'
  | 'world-billboard-shed'
  | 'world-billboard-forest'
  | 'world-tractor'
  | 'world-stall'
  | 'classic-billboard'
  | 'shop-fertilizer'
  | 'shop-tank'
  | 'shop-equipment'
  | 'rewards'
  | 'loan'
  | 'training'
  | 'certification'
  | 'climate'
  | 'progress-button';

export type Surface = '3D farm' | 'Classic farm' | 'Shop' | 'Rewards' | 'Finance' | 'Learning' | 'Climate' | 'Home';

export interface Slot {
  id: SlotId;
  surface: Surface;
  /** where it is, as a player finds it */
  where: string;
  /** what the partner gets there */
  format: string;
  /** the brand on it now, or null: open to a partner */
  brand: BrandId | null;
}

export const SLOTS: Slot[] = [
  { id: 'world-billboard-west', surface: '3D farm', where: 'Billboard in the yard, west of the farmhouse path', format: 'Billboard: name, tagline, offer, tap for the offer', brand: 'rutuba' },
  { id: 'world-billboard-east', surface: '3D farm', where: 'Billboard in the yard, east of the coop', format: 'Billboard: name, tagline, offer, tap for the offer', brand: 'kinga' },
  { id: 'world-billboard-shed', surface: '3D farm', where: 'Billboard by the seed shed, west of the farms', format: 'Billboard: name, tagline, offer, tap for the offer', brand: 'shina' },
  { id: 'world-billboard-forest', surface: '3D farm', where: 'Billboard between Farm 8 and the mini forest', format: 'Billboard: name, tagline, offer, tap for the offer', brand: 'tangi' },
  { id: 'world-tractor', surface: '3D farm', where: 'The farm’s tractor, both sides of the bonnet', format: 'Tractor livery and name on the tractor', brand: 'hello-tractor' },
  { id: 'world-stall', surface: '3D farm', where: 'The market stall’s awning, where harvests are sold', format: 'Awning branding', brand: null },
  { id: 'classic-billboard', surface: 'Classic farm', where: 'Roadside sign on the painted farm', format: 'Rotating sign: every partner in turn', brand: null },
  { id: 'shop-fertilizer', surface: 'Shop', where: 'Shop › Buy Fertilizer', format: 'Branded product: Rutuba Gold NPK, used for the NPK task', brand: 'rutuba' },
  { id: 'shop-tank', surface: 'Shop', where: 'Shop › Buy Tank', format: 'Branded product: a 5,000 L tank', brand: 'tangi' },
  { id: 'shop-equipment', surface: 'Shop', where: 'Shop › Buy Equipment', format: 'Branded product: a tool', brand: null },
  { id: 'rewards', surface: 'Rewards', where: 'Rewards & Discounts Hub vouchers', format: 'Voucher sponsor: name on the voucher card', brand: null },
  { id: 'loan', surface: 'Finance', where: 'Loan calculator and quote', format: '“Loan quotes with” line', brand: 'pesa' },
  { id: 'training', surface: 'Learning', where: 'Training: book a farmer course', format: '“Courses with” line', brand: 'ujuzi' },
  { id: 'certification', surface: 'Learning', where: 'My Progress: certification levels and every certificate', format: 'Certificate co-branding', brand: 'ujuzi' },
  { id: 'climate', surface: 'Climate', where: 'Climate › Shocks', format: '“Crop cover with” line', brand: 'kinga' },
  { id: 'progress-button', surface: 'Home', where: 'The PROGRESS button on the farm', format: 'Sponsor of the progress journey', brand: 'ujuzi' },
];

export const slotOf = (id: SlotId) => SLOTS.find(x => x.id === id)!;
/** The brand on a slot, if one has signed for it. */
export const slotBrand = (id: SlotId) => brandOf(slotOf(id).brand);

/** Each Rewards-hub voucher's sponsor (the rewards slot as a whole can also be sold to one brand). */
export const REWARD_SPONSOR: Record<string, BrandId | undefined> = {
  fertilizer: 'rutuba',
  seed: 'shina',
  equipment: 'hello-tractor',
  irrigation: 'jua',
  phone: 'pesa',
  solar: 'jua',
};

/** Brands that have at least one slot, or a voucher: the ones shown to players. */
export const activeBrands = () => BRANDS.filter(b => SLOTS.some(x => x.brand === b.id) || Object.values(REWARD_SPONSOR).includes(b.id));

/** The rotating sign: every brand with a slot, in turn. */
export const ROTATION_MS = 6000;
