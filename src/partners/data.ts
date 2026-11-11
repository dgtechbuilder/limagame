import type { Modal } from '../state';

/* Partnerships: the ways a brand, a school or a service can be part of Lima, each tied to the place in the game where
   players meet it. Every word on the Partnerships page is here, so it can be reviewed without touching code.

   Status, honestly:
   - now   — the moment is in the game today and works; a partner's name and product go onto it
   - build — the moment is in the game; a small new step adds the partner's part
   - new   — a new part of the game, proposed from what the game already does */

export type PartnerTab = 'overview' | 'inputs' | 'machines' | 'market' | 'learning' | 'money' | 'shortlist';
export type GroupTab = Exclude<PartnerTab, 'overview' | 'shortlist'>;
export type Status = 'now' | 'build' | 'new';

export const STATUS: Record<Status, { label: string; means: string }> = {
  now: { label: 'In the game now', means: 'The moment is in the game today. Your name and product go onto it.' },
  build: { label: 'Small build', means: 'The moment is in the game. A short new step adds your part.' },
  new: { label: 'New idea', means: 'A new part of the game, built with you.' },
};

export const GROUPS: { id: GroupTab; label: string; icon: string; blurb: string; covers: string }[] = [
  { id: 'inputs', label: 'Farm inputs', icon: '🌱', blurb: 'What goes into the soil and onto the crop: chosen plot by plot, and judged at harvest.', covers: 'Seed, fertilizer, crop protection, safety kits' },
  { id: 'machines', label: 'Tools & machines', icon: '🚜', blurb: 'Hand tools, water, power and tractors: used in the farm world and in the tractor business.', covers: 'Hardware, tractors and implements, water tanks, solar, fuel' },
  { id: 'market', label: 'Transport & market', icon: '🚚', blurb: 'From the harvest to the buyer: storage, processing, transport and selling.', covers: 'Trucks, buyers, storage, millers, co-ops and booking apps' },
  { id: 'learning', label: 'Learning', icon: '🎓', blurb: 'The game teaches farmers to read their crops. Classes and experts take that further.', covers: 'Training classes, agronomists, sponsored missions' },
  { id: 'money', label: 'Money & climate', icon: '💳', blurb: 'Paying for inputs, protecting the season, and the climate the farm runs in.', covers: 'Loans and mobile money, insurance, carbon, weather, telcos' },
];

export interface PartnerOption {
  id: string;
  group: GroupTab;
  name: string;
  icon: string;
  status: Status;
  /** one line: the offer */
  pitch: string;
  /** where in the game players meet it (real screens) */
  where: string[];
  /** what the partner gets */
  gets: string;
  /** a screen in the game that shows the moment today (only screens that open safely at any time) */
  see?: Modal;
}

export const OPTIONS: PartnerOption[] = [
  /* ---------- farm inputs ---------- */
  {
    id: 'seed',
    group: 'inputs',
    name: 'Your seed brand',
    icon: '🌽',
    status: 'now',
    pitch: 'Your variety on the plot board, grown side by side with the others and judged at harvest.',
    where: [
      'Plot board at the seed shed: six seed choices for every plot (hybrid, drought-tolerant, open-pollinated…)',
      'Six farms: the same maize grown to different plans, the harvests compared',
      'Rewards: the Seed discount (10% off for 800 points)',
    ],
    gets: 'Your seed chosen at the moment of decision, its harvest shown fairly against the rest, and a real voucher to your shops.',
    see: { kind: 'rewards' },
  },
  {
    id: 'fertilizer',
    group: 'inputs',
    name: 'Your fertilizer brand',
    icon: '🧪',
    status: 'now',
    pitch: 'Your fertilizer in the Shop and on every plot, with its yield and its climate cost shown.',
    where: [
      'Shop · Buy Fertilizer: nitrogen, phosphorus, potassium, NPK, manure',
      'Plot board: no fertilizer, manure, DAP, DAP with a CAN top-dress, double rate',
      'Climate page: nitrogen and emissions per bag grown',
      'Rewards: the Fertilizer discount (30% off for 1,500 points)',
    ],
    gets: 'Farmers learn the right rate and timing with your product, and see what it adds per bag.',
    see: { kind: 'shop', tab: 'fertilizer' },
  },
  {
    id: 'protect',
    group: 'inputs',
    name: 'Your crop protection brand',
    icon: '🛡️',
    status: 'build',
    pitch: 'Your product named when the farmer has spotted the problem and picks what goes in the sprayer.',
    where: [
      'Choose the product: one right product for each problem (armyworm, aphids, leaf rust)',
      'Follow-up sprays two days on, on the task card',
      'Field rounds: the clue, the call and the fix',
    ],
    gets: 'Your product at the moment of diagnosis, with the right use and safety taught, never sprayed by default.',
  },
  {
    id: 'kit',
    group: 'inputs',
    name: 'Your safety kit brand',
    icon: '🧤',
    status: 'build',
    pitch: 'Your gloves, mask and boots, put on before every spray job.',
    where: ['Safety kit: gloves, face mask and boots before the sprayer is picked up', '"Spray drifts onto skin and into lungs. Wear the kit every time."'],
    gets: 'A safety habit tied to your kit, repeated on every spray job.',
  },

  /* ---------- tools & machines ---------- */
  {
    id: 'hardware',
    group: 'machines',
    name: 'Your hardware brand',
    icon: '🔨',
    status: 'now',
    pitch: 'Your hoes, spades, wheelbarrows and sprayers in the Shop and in the farmer’s hands.',
    where: [
      'Shop · Buy Equipment: hoe, spade, wheelbarrow, rake, cultivator, shears',
      'Farm world: hoeing, watering and spraying by hand',
      'Plot board: knapsack sprayer or motorised mist blower',
      'Rewards: the Equipment discount (30% off for 1,500 points)',
    ],
    gets: 'Your tools used in every job the farmer does by hand, and a voucher to your hardware shops.',
    see: { kind: 'shop', tab: 'equipment' },
  },
  {
    id: 'equipment',
    group: 'machines',
    name: 'Your equipment brand',
    icon: '🚜',
    status: 'now',
    pitch: 'Your tractors and implements, driven by the player and bought for their tractor business.',
    where: [
      'Tractor drive: compact, standard or large tractor, and eight implements',
      'Tractor business · Fleet: ridger, boom sprayer, maize planter, large tractor',
      'Plot board: tractor type and tool for each plot',
      'The tractor summary: what the same work costs by hand, in shillings',
    ],
    gets: 'Your machine chosen for the right job, with its work rate and diesel shown, and owners-to-be planning a fleet.',
  },
  {
    id: 'water',
    group: 'machines',
    name: 'Your water tank and irrigation brand',
    icon: '💧',
    status: 'now',
    pitch: 'Your tanks and drip kits, keeping the crop alive in a dry season.',
    where: [
      'Shop · Buy Tank: small, medium, large',
      'Farm world: watering at the roots, drought checks',
      'Climate page · Water & soil: litres used, water per bag',
      'Rewards: the Irrigation system discount (30% off)',
    ],
    gets: 'Your product at the moment drought shows on the crop, and its water saving measured.',
    see: { kind: 'shop', tab: 'tank' },
  },
  {
    id: 'solar',
    group: 'machines',
    name: 'Your solar brand',
    icon: '☀️',
    status: 'now',
    pitch: 'Solar pumping and lights, with the emissions they save shown on the Climate page.',
    where: ['Rewards: the Solar power discount (30% off)', 'Once redeemed, watering’s pumping emissions drop on the Climate page'],
    gets: 'A visible climate saving tied to your product, and a voucher farmers redeem.',
    see: { kind: 'rewards' },
  },
  {
    id: 'fuel',
    group: 'machines',
    name: 'Your fuel station',
    icon: '⛽',
    status: 'now',
    pitch: 'The tractor business’s fuel partner: diesel 10% cheaper on every route.',
    where: ['Tractor business · Partners: the fuel station slot', 'Every day’s money: diesel at KSh 228 a litre'],
    gets: 'Tractor owners-to-be learn that a fuel partner makes thin margins work.',
  },

  /* ---------- transport & market ---------- */
  {
    id: 'truck',
    group: 'market',
    name: 'Your truck brand',
    icon: '🚚',
    status: 'build',
    pitch: 'Your trucks carry the harvest to market, and run the tractor business’s longer jobs.',
    where: [
      'Sale of produce: the transportation cost between farm gate and market price',
      'Storage: days to market for each option',
      'Tractor business: the village map and its routes',
    ],
    gets: 'Farmers see what a hired truck adds to the market price, and businesses plan routes with your fleet.',
  },
  {
    id: 'buyer',
    group: 'market',
    name: 'Buyers and off-takers',
    icon: '🤝',
    status: 'build',
    pitch: 'A buyer’s offer for good maize: a contract price, a quality grade, a collection day.',
    where: ['Sale of produce: farm gate or market', 'Harvest timing: quality changes with when the crop is picked', 'Results: what each choice earned'],
    gets: 'Farmers who grow to your grade, and learn why quality and timing earn more.',
  },
  {
    id: 'storage',
    group: 'market',
    name: 'Storage and warehouses',
    icon: '🏠',
    status: 'now',
    pitch: 'Your warehouse, cold store or hermetic bags, against the losses of storing at home.',
    where: ['Storage: home (12% lost), co-op warehouse (5%), cold storage (1%), each with its cost per bag', 'Climate page: food lost'],
    gets: 'The cost of a bag lost made clear, next to what your storage costs.',
  },
  {
    id: 'processor',
    group: 'market',
    name: 'Millers and processors',
    icon: '🏭',
    status: 'build',
    pitch: 'Drying, milling and packaging with you, and the extra value it brings.',
    where: ['Value addition: drying (+25%), milling into flour (+65%), packaging (+40%)', 'Process: the steps one by one'],
    gets: 'Farmers who see why to sell dry, graded grain, or flour, through you.',
  },
  {
    id: 'coop',
    group: 'market',
    name: 'Co-ops, hire services and booking apps',
    icon: '📱',
    status: 'now',
    pitch: 'The tractor business’s partners: more bookings, shared jobs, routes in one tap.',
    where: ['Tractor business · Partners: a farmers’ co-op, a tractor hire owner, a booking app, the county', 'Storage: the co-op warehouse'],
    gets: 'Young operators who learn to work with you before they buy their first tractor.',
  },

  /* ---------- learning ---------- */
  {
    id: 'training',
    group: 'learning',
    name: 'Your training class',
    icon: '🎓',
    status: 'new',
    pitch: 'Your class, offered when a player has just learned the same thing in the game.',
    where: [
      'After a field round or a check read right: “Learn more in a real class”',
      'Choose the fix: each wrong fix explains why, a class goes deeper',
      'Points for attending a real class, with a code from the trainer',
    ],
    gets: 'Students who already know the basics and want more, booked at the right moment.',
  },
  {
    id: 'experts',
    group: 'learning',
    name: 'Agronomists and extension services',
    icon: '🔬',
    status: 'new',
    pitch: 'Check the game’s farming advice, and be credited on it.',
    where: ['Field rounds and Choose the fix: every lesson, “Checked by …”', 'Six farms: yields, problem odds and damage', 'Mama Achieng’s lines'],
    gets: 'Your name on advice thousands of young farmers follow. The game needs this review before a pilot.',
  },
  {
    id: 'mission',
    group: 'learning',
    name: 'A sponsored mission',
    icon: '🏆',
    status: 'new',
    pitch: 'A challenge in your name: grow the most maize with less water, or the best climate rating.',
    where: ['Mission: the six farms’ plan, progress and results', 'Climate rating A to E', 'Rewards: your prize'],
    gets: 'Players who compete to use your product well, and a story to tell about it.',
  },

  /* ---------- money & climate ---------- */
  {
    id: 'finance',
    group: 'money',
    name: 'Phone loans, mobile money and input credit',
    icon: '💳',
    status: 'now',
    pitch: 'Buy inputs now and pay at harvest, with the cost of the loan in the season’s results.',
    where: ['Rewards: the Phone Loan discount (10% off)', 'Results: spend, revenue and profit for each season', 'The first story: a season that lost KSh 23,500'],
    gets: 'Borrowers who understand the season’s money before they borrow.',
    see: { kind: 'rewards' },
  },
  {
    id: 'insurance',
    group: 'money',
    name: 'Crop insurance',
    icon: '☔',
    status: 'build',
    pitch: 'A cover that pays when drought, flood or hail hits the six farms.',
    where: ['Six farms: drought, flood and hail happen', 'Climate page · Climate shocks: what each shock cost', 'Forecasts: dry, normal or wet season'],
    gets: 'Farmers who see a shock’s cost, then a payout, in the same season.',
    see: { kind: 'climate', tab: 'shocks' },
  },
  {
    id: 'carbon',
    group: 'money',
    name: 'Climate and carbon partners',
    icon: '🌍',
    status: 'build',
    pitch: 'Turn Lima climate credits into rewards, or fund the real practices behind them.',
    where: ['Climate page: credits, rating A to E, emissions by source', 'Manure, solar and less diesel earn credits'],
    gets: 'Measured practice change: what farmers chose, and what it kept out of the air (estimates for learning).',
    see: { kind: 'climate', tab: 'overview' },
  },
  {
    id: 'weather',
    group: 'money',
    name: 'A weather service',
    icon: '🌦️',
    status: 'new',
    pitch: 'Your forecast before every plan, and an alert before a dry week.',
    where: ['Six farms · Plan: the season’s forecast (dry, normal, wet), and the rain it brings each week', 'Watering: what the crop needs on top of the rain'],
    gets: 'Farmers who plan from a forecast, and then subscribe to yours.',
  },
  {
    id: 'telco',
    group: 'money',
    name: 'Telcos and data bundles',
    icon: '📶',
    status: 'new',
    pitch: 'Lima free on your network, and data bundles as rewards.',
    where: ['The game is about 100 KB to start and plays on a weak signal', 'Rewards: data bundles for points'],
    gets: 'Young rural customers on your network, playing every day.',
  },
];

/** The Overview: who plays, how a partnership works, and the rules every partner keeps. */
export const OVERVIEW = {
  title: 'Partner with Lima',
  lead: 'Lima is a farming game for young Africans who farm or want to, played on a phone. Partners meet farmers at the moment they decide: what to plant, how to treat a sick crop, where to store, who to sell to.',
  facts: [
    { label: 'Who plays', value: 'Young farmers', sub: 'and “satellite farmers” with a city job and a rural farm' },
    { label: 'Ways to partner', value: String(OPTIONS.length), sub: `in ${GROUPS.length} areas` },
    { label: 'In the game now', value: String(OPTIONS.filter(o => o.status === 'now').length), sub: 'moments ready for your brand' },
    { label: 'Points', value: 'Real discounts', sub: 'points earned in play become vouchers' },
  ],
  steps: ['Pick the ways that fit you, and tap Interested', 'Send us your shortlist', 'We put your brand into the game for a pilot cycle and share what players did'],
  rules: [
    'Fair play: a product does in the game what that kind of product does on a real farm. No partner pays for a better result.',
    'No personal data is shared. Partners see anonymous counts (how many chose, tried, redeemed), never names.',
    'Farming advice is checked by an agronomist before a pilot.',
    'Rewards are saved in the game today. Redeeming them in your shops is built with each partner.',
  ],
};

/** Where the shortlist is sent: set VITE_PARTNER_EMAIL at build time to show an email button. */
export const PARTNER_EMAIL: string = import.meta.env.VITE_PARTNER_EMAIL ?? '';

export const optionsIn = (g: GroupTab) => OPTIONS.filter(o => o.group === g);
export const optionOf = (id: string) => OPTIONS.find(o => o.id === id);

/** The shortlist as text, to paste into an email or a message. */
export function shortlistText(ids: string[]): string {
  const picked = ids.map(optionOf).filter((o): o is PartnerOption => !!o);
  const lines = picked.map(o => `- ${o.name} (${GROUPS.find(g => g.id === o.group)!.label}, ${STATUS[o.status].label.toLowerCase()}): ${o.pitch}`);
  return ['Lima partnership shortlist', '', ...lines].join('\n');
}
