import type { SlotId } from './data';

/* Partner with us: every way a funder, a brand, a school or a service could be part of TemoLima, grouped by area,
   each tied to the screens where players meet it. It is the pitch for partners still to sign; data.ts holds the ones
   who have (brands, and the slots they hold). Every word on the Partners page's "Partner with us" tab is here, and so
   are the fields of the Open to partner form. */

export type AreaId = 'funding' | 'credit' | 'fintech' | 'inputs' | 'machines' | 'market' | 'learning' | 'climate';

export const AREAS: { id: AreaId; label: string; icon: string }[] = [
  { id: 'funding', label: 'Funding', icon: '🏛️' },
  { id: 'credit', label: 'Insurance & credit', icon: '☔' },
  { id: 'fintech', label: 'Fintech', icon: '🪙' },
  { id: 'inputs', label: 'Farm inputs', icon: '🌱' },
  { id: 'machines', label: 'Tools & machines', icon: '🚜' },
  { id: 'market', label: 'Transport & market', icon: '🚚' },
  { id: 'learning', label: 'Learning', icon: '🎓' },
  { id: 'climate', label: 'Climate & data', icon: '🌍' },
];

export interface WayToPartner {
  id: string;
  area: AreaId;
  name: string;
  icon: string;
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
  /* ---------- funding ---------- */
  {
    id: 'nie',
    area: 'funding',
    name: 'National Implementing Entities (NIEs)',
    icon: '🏛️',
    pitch: 'NIEs enable national entities to develop and manage all aspects of climate adaptation projects. TemoLima is the farmer-facing part of yours.',
    where: ['Six farms: drought, flood and hail, and the plans that hold up', 'Climate › Water & soil, Shocks and Credits', 'Training: the adaptation practices, taught and then booked'],
    gets: 'A ready tool for an adaptation project’s farmer training and monitoring: what farmers chose, and the practice change, as anonymous counts.',
    see: { label: 'Open Climate › Shocks', to: '/climate/shocks' },
  },
  {
    id: 'climatefund',
    area: 'funding',
    name: 'Climate funds and donors',
    icon: '🌍',
    pitch: 'Grants that fund pilots, farmer training and the climate-smart practices the game teaches.',
    where: ['Six farms: plans grown side by side, harvests compared', 'Climate: emissions, water and the climate rating', 'Training: real courses after the lesson'],
    gets: 'Reach into rural youth, and learning you can measure, reported as anonymous counts.',
    see: { label: 'Open Climate', to: '/climate/overview' },
  },
  {
    id: 'impact',
    area: 'funding',
    name: 'Impact investors and DFIs',
    icon: '📈',
    pitch: 'Blended finance for farmers and young agri-businesses who have already run the numbers in the game.',
    where: ['Tractor business: a fleet plan with its costs and income', 'Results: spend, income and profit each season'],
    gets: 'A pipeline of young operators with a business plan they have played through.',
    see: { label: 'Open the Tractor business', to: '/tractor-business' },
  },

  /* ---------- insurance & credit ---------- */
  {
    id: 'finance',
    area: 'credit',
    name: 'Loans and credit',
    icon: '💳',
    pitch: 'A loan quote before the farmer borrows: what it costs each month, and in all.',
    where: ['The loan calculator and quote', 'Rewards: the phone loan voucher', 'Results: spend, income and profit each season'],
    gets: 'Borrowers who understand the season’s money before they borrow.',
    slots: ['loan'],
    see: { label: 'Open the loan calculator', to: '/loan-calculator' },
  },
  {
    id: 'inputcredit',
    area: 'credit',
    name: 'Input credit',
    icon: '🧾',
    pitch: 'Seed and fertilizer now, paid back at harvest.',
    where: ['Shop › Buy Fertilizer and Buy Equipment', 'Sale of produce: the harvest money that pays it back'],
    gets: 'Farmers who see the whole loop: inputs on credit, a better harvest, a loan repaid.',
    see: { label: 'Open the fertilizer shop', to: '/shop/fertilizer' },
  },
  {
    id: 'insurance',
    area: 'credit',
    name: 'Crop insurance',
    icon: '☔',
    pitch: 'Cover that pays when drought, flood or hail hits the farm.',
    where: ['Six farms: drought, flood and hail happen', 'Climate › Shocks: what each shock cost'],
    gets: 'Farmers who see a shock’s cost, then a payout, in the same season.',
    slots: ['climate'],
    see: { label: 'Open Climate › Shocks', to: '/climate/shocks' },
  },

  /* ---------- fintech ---------- */
  {
    id: 'stablecoin',
    area: 'fintech',
    name: 'Stablecoin wallets',
    icon: '🪙',
    pitch: 'Digital dollars that hold their value, so farmers can save, receive and spend to fund the season.',
    where: ['Wallet: every shilling in and out', 'Climate payments, paid into the wallet', 'Shop: inputs paid for from the wallet'],
    gets: 'Farmers who learn to save and pay in a stable currency, with your wallet behind the game’s.',
    see: { label: 'Open the Wallet', to: '/wallet/history' },
  },
  {
    id: 'payments',
    area: 'fintech',
    name: 'Payments and mobile money',
    icon: '📲',
    pitch: 'Pay for inputs and get paid for the harvest, on the phone.',
    where: ['Shop: seed, fertilizer, tanks and tools', 'Sale of produce and the market stall', 'Wallet: the money each day'],
    gets: 'Every payment in the game made the way your customers pay.',
    see: { label: 'Open the Wallet', to: '/wallet/history' },
  },
  {
    id: 'transfer',
    area: 'fintech',
    name: 'Money transfer and remittances',
    icon: '💸',
    pitch: 'Family in town or abroad sends money straight to the farm, for seed, fertilizer and labour.',
    where: ['Wallet: money in, by what it paid for', 'The season’s plan: what the farm needs before planting'],
    gets: 'Senders who see what their money grew, and farmers who can fund the season on time.',
    see: { label: 'Open the Wallet', to: '/wallet/summary' },
  },

  /* ---------- farm inputs ---------- */
  {
    id: 'seed',
    area: 'inputs',
    name: 'Seed brand',
    icon: '🌽',
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
    pitch: 'Your product named when the farmer has spotted the problem and picks what to spray.',
    where: ['Choose the product: one right product per problem', 'Follow-up sprays on the task card', 'Field rounds: the clue, the call and the fix'],
    gets: 'Your product at the moment of diagnosis, with safe use taught. Never sprayed by default.',
  },
  {
    id: 'kit',
    area: 'inputs',
    name: 'Safety kit brand',
    icon: '🧤',
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
    pitch: 'Your trucks take the harvest to market, and haul for the tractor business.',
    where: ['Sale of produce: the transport cost to market', 'Storage: days to market', 'Tractor business: the trailer and the village routes'],
    gets: 'Farmers see what a hired truck adds to the price; operators plan routes with your fleet.',
  },
  {
    id: 'buyer',
    area: 'market',
    name: 'Buyers and off-takers',
    icon: '🤝',
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
    pitch: 'Your warehouse, cold store or hermetic bags, against the losses of storing at home.',
    where: ['Storage: home, co-op warehouse or cold storage, with the bags lost', 'Climate: food lost'],
    gets: 'The cost of a lost bag made plain, beside what your storage costs.',
  },
  {
    id: 'processor',
    area: 'market',
    name: 'Millers and processors',
    icon: '🏭',
    pitch: 'Drying, milling and packing with you, and the value it adds.',
    where: ['Value addition: drying, milling into flour, packaging', 'Process: the steps one by one'],
    gets: 'Farmers who see why to sell dry, graded grain, or flour, through you.',
  },
  {
    id: 'coop',
    area: 'market',
    name: 'Co-ops and booking apps',
    icon: '📱',
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
    pitch: 'Check the game’s farming advice, and be credited on it.',
    where: ['Field rounds and Choose the fix: “Checked by …” on every lesson', 'Six farms: yields, problem odds and damage'],
    gets: 'Your name on advice thousands of young farmers follow. The game needs this review before a pilot.',
  },
  {
    id: 'mission',
    area: 'learning',
    name: 'A sponsored mission',
    icon: '🏆',
    pitch: 'A challenge in your name: the most maize with less water, or the best climate rating.',
    where: ['Mission: the six farms’ plans and results', 'Climate rating', 'Rewards: your prize'],
    gets: 'Players who compete to use your product well, and a story to tell.',
  },

  /* ---------- climate & data ---------- */
  {
    id: 'carbon',
    area: 'climate',
    name: 'Carbon and climate partners',
    icon: '🌍',
    pitch: 'TemoLima climate credits turned into rewards, or the real practices behind them funded.',
    where: ['Climate › Credits: credits and daily payments', 'Manure, solar and less diesel earn credits'],
    gets: 'Measured practice change: what farmers chose, and what it kept out of the air (estimates for learning).',
    see: { label: 'Open Climate › Credits', to: '/climate/credits' },
  },
  {
    id: 'weather',
    area: 'climate',
    name: 'A weather service',
    icon: '🌦️',
    pitch: 'Your forecast before every plan, and an alert before a dry week.',
    where: ['Six farms › Plan: the season’s forecast and its rain', 'Watering: what the crop needs on top of the rain'],
    gets: 'Farmers who plan from a forecast, then subscribe to yours.',
  },
  {
    id: 'telco',
    area: 'climate',
    name: 'Telcos and data bundles',
    icon: '📶',
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
    .map(w => `- ${w.name} (${areaOf(w.area).label}): ${w.pitch}`);
  return ['TemoLima partnership shortlist', '', ...lines].join('\n');
}

/* ---------------- Open to partner: the application form ---------------- */

/** A partner's application, from the Open to partner form. Kept on this device, and sent where the build says. */
export interface PartnerApplication {
  /** when it was sent (ms since 1970) */
  t: number;
  org: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  country: string;
  website: string;
  /** the partnership category */
  area: AreaId;
  /** the ways to partner picked (WAYS ids) */
  ways: string[];
  message: string;
}

/** Where applications are posted as JSON: set VITE_PARTNER_FORM_URL at build time (a form service or the team's API). */
export const PARTNER_FORM_URL: string = (import.meta as { env?: { VITE_PARTNER_FORM_URL?: string } }).env?.VITE_PARTNER_FORM_URL ?? '';

/** The application as text, for an email or a message. */
export function applicationText(a: PartnerApplication): string {
  const ways = a.ways.map(wayOf).filter((w): w is WayToPartner => !!w);
  return [
    'TemoLima partner application',
    '',
    `Organisation: ${a.org}`,
    `Contact: ${a.name}${a.role ? `, ${a.role}` : ''}`,
    `Email: ${a.email}`,
    a.phone ? `Phone: ${a.phone}` : null,
    `Country: ${a.country}`,
    a.website ? `Website: ${a.website}` : null,
    `Category: ${areaOf(a.area).label}`,
    ways.length > 0 ? `Ways to partner: ${ways.map(w => w.name).join(', ')}` : null,
    '',
    a.message,
  ]
    .filter((x): x is string => x !== null)
    .join('\n');
}
