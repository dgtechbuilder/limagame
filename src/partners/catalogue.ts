import type { SlotId } from './data';

/* Partner with us: every way a brand, a school or a service could be part of TemoLima, grouped by area, each tied to the
   screens where players meet it. It is the pitch for partners still to sign; data.ts holds the ones who have
   (brands, and the slots they hold). Every word on the Partners page's "Partner with us" tab is here.

   Status, honestly:
   - now   — the moment is in the game today; a partner's name and product go onto it
   - build — the moment is in the game; a short new step adds the partner's part
   - new   — a new part of the game, built with the partner */

export type AreaId = 'inputs' | 'machines' | 'market' | 'learning' | 'money';
export type Status = 'now' | 'build' | 'new';

export const STATUS: Record<Status, { label: string; means: string }> = {
  now: { label: 'In the game now', means: 'The moment is in the game today. Your name and product go onto it.' },
  build: { label: 'Small build', means: 'The moment is in the game. A short new step adds your part.' },
  new: { label: 'New idea', means: 'A new part of the game, built with you.' },
};

export const AREAS: { id: AreaId; label: string; icon: string }[] = [
  { id: 'inputs', label: 'Farm inputs', icon: '🌱' },
  { id: 'machines', label: 'Tools & machines', icon: '🚜' },
  { id: 'market', label: 'Transport & market', icon: '🚚' },
  { id: 'learning', label: 'Learning', icon: '🎓' },
  { id: 'money', label: 'Money & climate', icon: '💳' },
];

export interface WayToPartner {
  id: string;
  area: AreaId;
  name: string;
  icon: string;
  status: Status;
  /** one line: the offer to the partner */
  pitch: string;
  /** where players meet it (real screens) */
  where: string[];
  /** what the partner gets */
  gets: string;
  /** the placements (data.ts SLOTS) this option sells, if any: the card shows who holds them */
  slots?: SlotId[];
  /** a screen that shows the moment today: its button label and game address (src/route.ts) */
  see?: { label: string; to: string };
}

export const WAYS: WayToPartner[] = [
  /* ---------- farm inputs ---------- */
  {
    id: 'seed',
    area: 'inputs',
    name: 'Seed brand',
    icon: '🌽',
    status: 'now',
    pitch: 'Your variety on every plot, grown beside the others and judged at harvest.',
    where: ['The plot board at the seed shed: a seed for every plot', 'Six farms: plans grown side by side, harvests compared', 'Rewards: the seed voucher'],
    gets: 'Your seed chosen at the moment of decision, its harvest shown fairly, and a voucher to your shops.',
    see: { label: 'Open Rewards', to: '/rewards' },
  },
  {
    id: 'fertilizer',
    area: 'inputs',
    name: 'Fertilizer brand',
    icon: '🧪',
    status: 'now',
    pitch: 'Your fertilizer in the Shop and on every plot, with its yield and climate cost shown.',
    where: ['Shop › Buy Fertilizer', 'The plot board: manure, DAP, a CAN top-dress', 'Climate: nitrogen and emissions per bag'],
    gets: 'Farmers learn the right rate and timing with your product, and see what it adds per bag.',
    slots: ['shop-fertilizer'],
    see: { label: 'Open the fertilizer shop', to: '/shop/fertilizer' },
  },
  {
    id: 'protect',
    area: 'inputs',
    name: 'Crop protection brand',
    icon: '🛡️',
    status: 'build',
    pitch: 'Your product named when the farmer has spotted the problem and picks what to spray.',
    where: ['Choose the product: one right product per problem', 'Follow-up sprays on the task card', 'Field rounds: the clue, the call and the fix'],
    gets: 'Your product at the moment of diagnosis, with safe use taught. Never sprayed by default.',
  },
  {
    id: 'kit',
    area: 'inputs',
    name: 'Safety kit brand',
    icon: '🧤',
    status: 'build',
    pitch: 'Your gloves, mask and boots, put on before every spray job.',
    where: ['The safety kit, asked for before the sprayer is picked up'],
    gets: 'A safety habit tied to your kit, repeated on every spray job.',
  },

  /* ---------- tools & machines ---------- */
  {
    id: 'hardware',
    area: 'machines',
    name: 'Hardware brand',
    icon: '🔨',
    status: 'now',
    pitch: 'Your hoes, spades, wheelbarrows and sprayers in the Shop and in the farmer’s hands.',
    where: ['Shop › Buy Equipment', 'The 3D farm: hoeing, watering and spraying by hand', 'Rewards: the equipment voucher'],
    gets: 'Your tools in every job done by hand, and a voucher to your hardware shops.',
    slots: ['shop-equipment'],
    see: { label: 'Open the equipment shop', to: '/shop/equipment' },
  },
  {
    id: 'equipment',
    area: 'machines',
    name: 'Equipment brand',
    icon: '🚜',
    status: 'now',
    pitch: 'Your tractors and implements, driven by the player and bought for their tractor business.',
    where: ['The tractor drive: three tractors and their implements', 'Tractor business › Fleet', 'The farm’s tractor, on the 3D farm'],
    gets: 'Your machine picked for the right job, its work rate and diesel shown, and owners-to-be planning a fleet.',
    slots: ['world-tractor'],
    see: { label: 'Open the Tractor business', to: '/tractor-business' },
  },
  {
    id: 'water',
    area: 'machines',
    name: 'Water tanks and irrigation',
    icon: '💧',
    status: 'now',
    pitch: 'Your tanks and drip kits, keeping the crop alive through a dry spell.',
    where: ['Shop › Buy Tank', 'Climate › Water tank and Water & soil', 'Rewards: the irrigation voucher'],
    gets: 'Your product at the moment drought shows on the crop, and the water it saves, measured.',
    slots: ['shop-tank'],
    see: { label: 'Open the water-tank shop', to: '/shop/water-tanks' },
  },
  {
    id: 'solar',
    area: 'machines',
    name: 'Solar brand',
    icon: '☀️',
    status: 'now',
    pitch: 'Solar pumping, with the emissions it saves shown on the Climate page.',
    where: ['Rewards: the solar voucher', 'Once redeemed, pumping emissions drop on the Climate page'],
    gets: 'A visible climate saving tied to your product.',
    see: { label: 'Open Rewards', to: '/rewards' },
  },
  {
    id: 'fuel',
    area: 'machines',
    name: 'Fuel station',
    icon: '⛽',
    status: 'now',
    pitch: 'The tractor business’s fuel partner: cheaper diesel on every route.',
    where: ['Tractor business › Partners: the fuel station', 'Every day’s money: what the diesel cost'],
    gets: 'Tractor operators-to-be learn that a fuel partner makes thin margins work.',
    see: { label: 'Open the Tractor business', to: '/tractor-business' },
  },

  /* ---------- transport & market ---------- */
  {
    id: 'truck',
    area: 'market',
    name: 'Truck brand',
    icon: '🚚',
    status: 'build',
    pitch: 'Your trucks take the harvest to market, and haul for the tractor business.',
    where: ['Sale of produce: the transport cost to market', 'Storage: days to market', 'Tractor business: the trailer and the village routes'],
    gets: 'Farmers see what a hired truck adds to the price; operators plan routes with your fleet.',
  },
  {
    id: 'buyer',
    area: 'market',
    name: 'Buyers and off-takers',
    icon: '🤝',
    status: 'build',
    pitch: 'A buyer’s offer for good maize: a set price, a grade, a collection day.',
    where: ['Sale of produce: farm gate or market', 'Harvest timing: quality changes with the day', 'Results: what each choice earned'],
    gets: 'Farmers who grow to your grade, and learn why quality and timing earn more.',
    slots: ['world-stall'],
  },
  {
    id: 'storage',
    area: 'market',
    name: 'Storage and warehouses',
    icon: '🏠',
    status: 'now',
    pitch: 'Your warehouse, cold store or hermetic bags, against the losses of storing at home.',
    where: ['Storage: home, co-op warehouse or cold storage, with the bags lost', 'Climate: food lost'],
    gets: 'The cost of a lost bag made plain, beside what your storage costs.',
  },
  {
    id: 'processor',
    area: 'market',
    name: 'Millers and processors',
    icon: '🏭',
    status: 'build',
    pitch: 'Drying, milling and packing with you, and the value it adds.',
    where: ['Value addition: drying, milling into flour, packaging', 'Process: the steps one by one'],
    gets: 'Farmers who see why to sell dry, graded grain, or flour, through you.',
  },
  {
    id: 'coop',
    area: 'market',
    name: 'Co-ops and booking apps',
    icon: '📱',
    status: 'now',
    pitch: 'More bookings, shared jobs and routes in one tap, in the tractor business.',
    where: ['Tractor business › Partners: a co-op, a hire owner, a booking app, the county', 'Storage: the co-op warehouse'],
    gets: 'Young operators who learn to work with you before they buy a tractor.',
    see: { label: 'Open the Tractor business', to: '/tractor-business' },
  },

  /* ---------- learning ---------- */
  {
    id: 'training',
    area: 'learning',
    name: 'Training courses',
    icon: '🎓',
    status: 'now',
    pitch: 'Your course, offered just after a player has learned the same thing in the game.',
    where: ['Training: book a farmer course', 'After a check read right: “Learn more in a real course”', 'Points for attending, with a code from the trainer'],
    gets: 'Students who know the basics and want more, booked at the right moment.',
    slots: ['training'],
    see: { label: 'Open Training', to: '/training' },
  },
  {
    id: 'certify',
    area: 'learning',
    name: 'Certificates',
    icon: '📜',
    status: 'now',
    pitch: 'Your name on every certification level a player reaches.',
    where: ['My Progress: certification levels and certificates', 'The PROGRESS button on the farm'],
    gets: 'A credential young farmers work towards, co-signed by you.',
    slots: ['certification', 'progress-button'],
    see: { label: 'Open My Progress', to: '/progress/certificates' },
  },
  {
    id: 'experts',
    area: 'learning',
    name: 'Agronomists and extension services',
    icon: '🔬',
    status: 'new',
    pitch: 'Check the game’s farming advice, and be credited on it.',
    where: ['Field rounds and Choose the fix: “Checked by …” on every lesson', 'Six farms: yields, problem odds and damage'],
    gets: 'Your name on advice thousands of young farmers follow. The game needs this review before a pilot.',
  },
  {
    id: 'mission',
    area: 'learning',
    name: 'A sponsored mission',
    icon: '🏆',
    status: 'new',
    pitch: 'A challenge in your name: the most maize with less water, or the best climate rating.',
    where: ['Mission: the six farms’ plans and results', 'Climate rating', 'Rewards: your prize'],
    gets: 'Players who compete to use your product well, and a story to tell.',
  },

  /* ---------- money & climate ---------- */
  {
    id: 'finance',
    area: 'money',
    name: 'Loans and mobile money',
    icon: '💳',
    status: 'now',
    pitch: 'A loan quote before the farmer borrows: what it costs each month, and in all.',
    where: ['The loan calculator and quote', 'Rewards: the phone loan voucher', 'Results: spend, income and profit each season'],
    gets: 'Borrowers who understand the season’s money before they borrow.',
    slots: ['loan'],
    see: { label: 'Open the loan calculator', to: '/loan-calculator' },
  },
  {
    id: 'insurance',
    area: 'money',
    name: 'Crop insurance',
    icon: '☔',
    status: 'now',
    pitch: 'Cover that pays when drought, flood or hail hits the farm.',
    where: ['Six farms: drought, flood and hail happen', 'Climate › Shocks: what each shock cost'],
    gets: 'Farmers who see a shock’s cost, then a payout, in the same season.',
    slots: ['climate'],
    see: { label: 'Open Climate › Shocks', to: '/climate/shocks' },
  },
  {
    id: 'carbon',
    area: 'money',
    name: 'Carbon and climate partners',
    icon: '🌍',
    status: 'build',
    pitch: 'TemoLima climate credits turned into rewards, or the real practices behind them funded.',
    where: ['Climate › Credits: credits and daily payments', 'Manure, solar and less diesel earn credits'],
    gets: 'Measured practice change: what farmers chose, and what it kept out of the air (estimates for learning).',
    see: { label: 'Open Climate › Credits', to: '/climate/credits' },
  },
  {
    id: 'weather',
    area: 'money',
    name: 'A weather service',
    icon: '🌦️',
    status: 'new',
    pitch: 'Your forecast before every plan, and an alert before a dry week.',
    where: ['Six farms › Plan: the season’s forecast and its rain', 'Watering: what the crop needs on top of the rain'],
    gets: 'Farmers who plan from a forecast, then subscribe to yours.',
  },
  {
    id: 'telco',
    area: 'money',
    name: 'Telcos and data bundles',
    icon: '📶',
    status: 'new',
    pitch: 'TemoLima free on your network, and data bundles as rewards.',
    where: ['A light game that plays on a weak signal', 'Rewards: data bundles for points'],
    gets: 'Young rural customers on your network, playing every day.',
  },
];

/** The rules every partner keeps, shown under the list. */
export const RULES = [
  'Fair play: a product does in the game what that kind of product does on a farm. No partner pays for a better result.',
  'No personal data is shared: partners see anonymous counts, never names.',
  'Farming advice is checked by an agronomist before a pilot.',
];

/** Where the shortlist is sent: set VITE_PARTNER_EMAIL at build time to show an email button. */
export const PARTNER_EMAIL: string = (import.meta as { env?: { VITE_PARTNER_EMAIL?: string } }).env?.VITE_PARTNER_EMAIL ?? '';

export const wayOf = (id: string) => WAYS.find(w => w.id === id);
export const areaOf = (id: AreaId) => AREAS.find(a => a.id === id)!;

/** The shortlist as text, to paste into an email or a message. */
export function shortlistText(ids: string[]): string {
  const lines = ids
    .map(wayOf)
    .filter((w): w is WayToPartner => !!w)
    .map(w => `- ${w.name} (${areaOf(w.area).label}, ${STATUS[w.status].label.toLowerCase()}): ${w.pitch}`);
  return ['TemoLima partnership shortlist', '', ...lines].join('\n');
}
