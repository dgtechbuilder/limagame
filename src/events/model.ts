import { PRODUCE, type ProduceId } from '../produce/model';

/* The Kakuma special event (27–30 November), with the World Food Programme. A pop-up on the farm's bottom left
   tells the player about it; its page (Kakuma.tsx) teaches about Kakuma refugee camp, the food grown there and
   what food means to the people who live there, and lets the player give: money, a food gift bought with money, or
   produce from their own store. No screens here, so the saved game can use it. Money is stored money
   (src/money.ts: 1 = KSh 10). Giving in the game moves game money only: the page links to WFP for a real gift. */

export const KAKUMA_EVENT = {
  /** the event's days (inclusive, the player's own calendar) */
  start: '2026-11-27',
  end: '2026-11-30',
  dates: '27–30 November',
  partner: 'World Food Programme',
  /** WFP's own pages, for a real gift and to read more */
  giveUrl: 'https://www.wfp.org/support-us',
  readUrl: 'https://www.wfp.org/countries/kenya',
} as const;

export type KakumaPhase = 'soon' | 'on' | 'over';

/** The event's clock: tests set the day. */
export const kakumaClock = {
  today: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
};

/** Before, during or after the event, on a given day (YYYY-MM-DD). */
export function kakumaPhase(date = kakumaClock.today()): KakumaPhase {
  if (date < KAKUMA_EVENT.start) return 'soon';
  if (date > KAKUMA_EVENT.end) return 'over';
  return 'on';
}

/** Whole days until the event starts (0 once it has). */
export function daysToGo(date = kakumaClock.today()): number {
  const ms = Date.parse(`${KAKUMA_EVENT.start}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`);
  return Math.max(0, Math.round(ms / 86_400_000));
}

/* ---------- what the page teaches ---------- */

export const KAKUMA_FACTS: { label: string; value: string; sub: string }[] = [
  { label: 'Where', value: 'Turkana, Kenya', sub: 'north-west, near South Sudan' },
  { label: 'Opened', value: '1992', sub: 'for children fleeing Sudan’s war' },
  { label: 'Home to', value: '~300,000', sub: 'Kakuma camp and Kalobeyei' },
  { label: 'Weather', value: 'Hot and dry', sub: 'often 35–40 °C, little rain' },
];

export const KAKUMA_ABOUT: string[] = [
  'Kakuma is one of the largest refugee camps in the world. It opened in 1992 for the “Lost Boys” of Sudan, thousands of children who walked for weeks to escape war.',
  'Today families from South Sudan, Somalia, the DR Congo, Burundi, Ethiopia, Uganda and more live there, many for over ten years. Next to it is Kalobeyei, a settlement where refugees and their Turkana neighbours farm, trade and go to school together.',
  'The land is semi-desert: long dry spells, dust storms and sudden floods. Most food has to come from outside, so food aid, and the gardens people grow themselves, keep families going.',
];

export interface KakumaFood {
  id: string;
  name: string;
  icon: string;
  /** why it grows there */
  grows: string;
  /** what it does for the people who eat or sell it */
  helps: string;
  /** what a player can take to their own farm */
  forYou: string;
}

export const KAKUMA_FOODS: KakumaFood[] = [
  {
    id: 'sukuma',
    name: 'Sukuma wiki (kale)',
    icon: '🥬',
    grows: 'Grows fast in kitchen gardens and under shade nets; leaves can be picked again and again.',
    helps: 'Iron and vitamins A and C for children and mothers; a few leaves a day stretch a ration.',
    forYou: 'Pick the lower leaves often and the plant keeps giving for months.',
  },
  {
    id: 'cowpeas',
    name: 'Cowpeas (kunde)',
    icon: '🫘',
    grows: 'Takes heat and little water; its roots put nitrogen back into poor soil.',
    helps: 'Leaves as greens, dry beans as protein: two foods from one plant.',
    forYou: 'Grow it between maize rows to feed the soil for the next crop.',
  },
  {
    id: 'sorghum',
    name: 'Sorghum',
    icon: '🌾',
    grows: 'A grain that survives drought where maize fails.',
    helps: 'Porridge and kisra flatbread, a taste of home for South Sudanese families.',
    forYou: 'A safer grain to keep for a dry season.',
  },
  {
    id: 'amaranth',
    name: 'Amaranth (terere)',
    icon: '🌿',
    grows: 'A hardy green that comes up quickly after a little rain.',
    helps: 'Protein, calcium and iron, cheap to grow from saved seed.',
    forYou: 'Save the seed heads: one plant gives enough seed for a whole bed.',
  },
  {
    id: 'okra',
    name: 'Okra',
    icon: '🫑',
    grows: 'Loves heat and keeps fruiting through hot months.',
    helps: 'Thickens stews and soups, and sells well at the camp market.',
    forYou: 'Harvest young pods every two days for the best price.',
  },
  {
    id: 'tomatoes',
    name: 'Tomatoes and onions',
    icon: '🍅',
    grows: 'Grown in shade-net and drip gardens that save water.',
    helps: 'Cash crops: a small bed can pay school costs or buy cooking fuel.',
    forYou: 'Drip lines put water at the roots, not on the leaves.',
  },
  {
    id: 'moringa',
    name: 'Moringa',
    icon: '🌳',
    grows: 'A drought-tough tree that grows beside homes and fences.',
    helps: 'Its dried leaf powder adds vitamins to porridge for small children.',
    forYou: 'Plant one by the house: shade, a windbreak and greens in one.',
  },
  {
    id: 'greengrams',
    name: 'Green grams (ndengu)',
    icon: '🟢',
    grows: 'Ready in about three months on very little rain.',
    helps: 'A cheap protein that stores well, so nothing is lost.',
    forYou: 'A short-season crop to fit in before the dry months.',
  },
];

export const KAKUMA_LIFE: { icon: string; title: string; text: string }[] = [
  {
    icon: '🍲',
    title: 'A taste of home',
    text: 'Cooking kisra, canjeero or fufu and pondu keeps a family’s culture alive far from home. A shared meal is where children hear their parents’ stories.',
  },
  {
    icon: '📱',
    title: 'Choosing your own food',
    text: 'With WFP’s Bamba Chakula (“get your food”), families receive money on their phones to buy food from traders in the camp. Choosing what to cook brings back a little control, and the money keeps local shops going.',
  },
  {
    icon: '🌱',
    title: 'A garden to care for',
    text: 'Kitchen gardens, shade nets and water-saving beds give people fresh food, a little income and something of their own to grow. Many say tending a garden helps them heal.',
  },
  {
    icon: '🎒',
    title: 'Meals that keep children learning',
    text: 'A hot meal at school brings children to class and keeps them there. A child who is not hungry can learn.',
  },
  {
    icon: '🤝',
    title: 'Neighbours, not strangers',
    text: 'In Kalobeyei refugees and Turkana hosts farm and trade side by side. Food grown and sold together builds trust between communities.',
  },
  {
    icon: '⚠️',
    title: 'Why your gift matters',
    text: 'When funding falls short, rations are cut and families eat less. Every gift helps keep food on the table.',
  },
];

/* ---------- giving ---------- */

export type GiftKind = 'money' | 'basket' | 'store';

export interface KakumaGiftOption {
  id: string;
  kind: 'money' | 'basket';
  icon: string;
  name: string;
  line: string;
  /** stored money */
  price: number;
  /** meals it stands for, in the game */
  meals: number;
}

/** Things to give, bought with the farm's money. */
export const KAKUMA_GIFTS: KakumaGiftOption[] = [
  { id: 'cash-s', kind: 'money', icon: '💵', name: 'A small gift', line: 'Money for food, sent by phone', price: 50, meals: 10 },
  { id: 'cash-m', kind: 'money', icon: '💵', name: 'A family’s week', line: 'Money for food, sent by phone', price: 200, meals: 40 },
  { id: 'cash-l', kind: 'money', icon: '💰', name: 'A big gift', line: 'Money for food, sent by phone', price: 500, meals: 100 },
  { id: 'basket', kind: 'basket', icon: '🧺', name: 'Food basket', line: 'Maize flour, beans, oil and salt for a family', price: 150, meals: 30 },
  { id: 'school', kind: 'basket', icon: '🎒', name: 'School meals', line: 'A week of hot lunches for a class', price: 300, meals: 60 },
  { id: 'garden', kind: 'basket', icon: '🌱', name: 'Kitchen garden kit', line: 'Seeds, a shade net and a watering can', price: 250, meals: 50 },
];
export const giftOf = (id: string) => KAKUMA_GIFTS.find(g => g.id === id);

/** kg of produce given from the store in one tap. */
export const STORE_GIFT_KG = 10;
/** kg of produce that make a meal, in the game. */
export const KG_PER_MEAL = 0.5;
/** Points for each gift, and twice as many on the event's days. */
export const GIFT_POINTS = 10;

export interface KakumaGift {
  t: number;
  date: string;
  kind: GiftKind;
  label: string;
  /** stored money given (0 for produce) */
  money: number;
  /** kg of produce given (0 for money) */
  kg: number;
  meals: number;
}

export interface KakumaState {
  /** newest first */
  gifts: KakumaGift[];
  totals: { money: number; kg: number; meals: number; count: number };
  /** the pop-up on the farm tucked away into its round button */
  tucked: boolean;
}

export const newKakuma = (): KakumaState => ({ gifts: [], totals: { money: 0, kg: 0, meals: 0, count: 0 }, tucked: false });
export const kakumaOf = (k: Partial<KakumaState> | undefined): KakumaState => ({ ...newKakuma(), ...(k ?? {}), totals: { ...newKakuma().totals, ...(k?.totals ?? {}) } });

export const GIFTS_KEEP = 40;

/** A gift recorded. */
export function addGift(k: KakumaState, g: KakumaGift): KakumaState {
  return {
    ...k,
    gifts: [g, ...k.gifts].slice(0, GIFTS_KEEP),
    totals: { money: k.totals.money + g.money, kg: k.totals.kg + g.kg, meals: k.totals.meals + g.meals, count: k.totals.count + 1 },
  };
}

export const produceName = (id: ProduceId) => PRODUCE[id].name;
