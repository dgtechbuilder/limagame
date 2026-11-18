/* Theft on the farm: what thieves (and, for the hens, predators) go for at night, and what a farmer can do about
   it. Every number to tune, in one place: placeholders until the county agricultural office and a farmers' group
   confirm them. Money is stored money (src/money.ts: 1 = KSh 10). Chances are a night's.

   Theft starts with the animals on day 2 (LIFE.startDay). Each night, every thing worth stealing has a chance of
   being taken; each measure the farmer has in place cuts that chance by a share (shares from several measures
   multiply, so two good measures do not add up to more than everything). A theft reported to the community watch,
   or a branded cow, can be found again. */

export type Target = 'crops' | 'hens' | 'predators' | 'cows' | 'tools' | 'store' | 'cash' | 'water' | 'diesel';

export interface TargetInfo {
  label: string;
  /** what is at risk, in a line */
  what: string;
  /** the chance a night of it being taken, when it is there to take */
  base: number;
}

export const TARGETS: Record<Target, TargetInfo> = {
  crops: { label: 'Maize in the field', what: 'Ripe cobs on the six farms, from day 5 of a cycle until the harvest is in.', base: 0.14 },
  hens: { label: 'Hens', what: 'Hens taken from the coop, or from the trees with no coop.', base: 0.07 },
  predators: { label: 'Predators', what: 'Mongooses, hawks and wild dogs after the hens at night.', base: 0.12 },
  cows: { label: 'Cows', what: 'A cow led off in the night: the biggest loss a small farm can have.', base: 0.02 },
  tools: { label: 'Tools in the shed', what: 'Equipment bought in the Shop: wheelbarrows, sprayers, tools.', base: 0.05 },
  store: { label: 'Maize in the store', what: 'The classic season’s harvest while it waits in storage to be sold.', base: 0.06 },
  cash: { label: 'Cash at home', what: 'Money from a harvest sale, kept in the house overnight.', base: 0.25 },
  water: { label: 'Water from the tank', what: 'Water drawn off the tank’s tap at night, most often in a dry season.', base: 0.04 },
  diesel: { label: 'Diesel', what: 'Fuel siphoned from the tractor of the tractor business.', base: 0.06 },
};

/** How much a theft takes. */
export const TAKES = {
  /** a share of one farm's harvest, in percent */
  crops: [4, 10],
  hens: [2, 6],
  predators: [1, 2],
  cows: [1, 1],
  /** a share of the cash at home, in percent */
  cash: [10, 25],
  water: [800, 1500],
  diesel: [150, 300],
} as const;

/** Maize in store loses this share to theft over its time in storage, by where it is kept. */
export const STORE_THEFT: Record<string, number> = { home: 0.06, hermetic: 0.06, coop: 0.005, silo: 0.03, cold: 0.003 };

export type MeasureId = 'fence' | 'dog' | 'watchman' | 'locks' | 'light' | 'tags' | 'watch' | 'mpesa' | 'taplock' | 'gps';

export interface Measure {
  id: MeasureId;
  name: string;
  does: string;
  /** bought once (kept), or paid for each night it is on */
  kind: 'once' | 'nightly';
  /** price to buy (once), or to start */
  price: number;
  /** cost each night it is on (a watchman's pay, a dog's food) */
  nightly?: number;
  /** the share it cuts off each target's chance */
  cut: Partial<Record<Target, number>>;
  /** the chance it helps get a stolen thing back */
  recover?: Partial<Record<Target, number>>;
  /** only shown when the farm has this (the tractor business) */
  needs?: 'biz';
}

/** Simplest first: two from the start, the third from day 2, the rest from day 3 or Level 3 (src/unlock/model.ts).
    Theft starts on day 2, so the first nights offer three measures. */
export const MEASURES: Measure[] = [
  {
    id: 'watch',
    name: 'Join the community watch',
    does: 'Your Nyumba Kumi group: neighbours look out for each other and report thefts to the chief together.',
    kind: 'once',
    price: 100,
    cut: { crops: 0.2, hens: 0.15, cows: 0.2, tools: 0.15, store: 0.1, water: 0.15, diesel: 0.1 },
    recover: { crops: 0.2, hens: 0.25, cows: 0.3, tools: 0.35, diesel: 0.2 },
  },
  {
    id: 'locks',
    name: 'Padlocks on the shed and the store',
    does: 'Strong padlocks and hasps on every door; the keys stay with you.',
    kind: 'once',
    price: 250,
    cut: { tools: 0.75, store: 0.6, diesel: 0.25 },
  },
  {
    id: 'watchman',
    name: 'Night watchman',
    does: 'Walks the farm from dusk to dawn with a torch and a whistle. Paid each night.',
    kind: 'nightly',
    price: 0,
    nightly: 50,
    cut: { crops: 0.55, hens: 0.5, predators: 0.3, cows: 0.6, tools: 0.5, store: 0.5, water: 0.5, diesel: 0.5, cash: 0.2 },
  },
  {
    id: 'mpesa',
    name: 'Mobile money, not cash',
    does: 'Buyers pay on M-Pesa and the money goes to a SACCO account: no cash in the house overnight.',
    kind: 'once',
    price: 0,
    cut: { cash: 0.9 },
  },
  {
    id: 'taplock',
    name: 'A lock on the tank’s tap',
    does: 'A lockable tap cover: the water is drawn only when you open it.',
    kind: 'once',
    price: 150,
    cut: { water: 0.85 },
  },
  {
    id: 'tags',
    name: 'Brand and ear-tag the cows',
    does: 'A brand and numbered ear tags, registered with the chief: a stolen cow is hard to sell and easy to find.',
    kind: 'once',
    price: 150,
    cut: { cows: 0.45 },
    recover: { cows: 0.5 },
  },
  {
    id: 'dog',
    name: 'Guard dog',
    does: 'Barks at anyone at the gate and keeps mongooses off the coop. Her food is paid each night.',
    kind: 'once',
    price: 500,
    nightly: 5,
    cut: { crops: 0.25, hens: 0.35, predators: 0.5, cows: 0.3, tools: 0.25, store: 0.25, water: 0.2, diesel: 0.2 },
  },
  {
    id: 'light',
    name: 'Solar security light',
    does: 'A motion light over the yard, the coop and the pen: thieves keep to the dark.',
    kind: 'once',
    price: 1200,
    cut: { crops: 0.1, hens: 0.25, predators: 0.2, cows: 0.25, tools: 0.25, store: 0.2, water: 0.2, diesel: 0.2, cash: 0.1 },
  },
  {
    id: 'fence',
    name: 'Fence and a locked gate',
    does: 'Barbed wire with a kei-apple hedge growing along it, and a gate with a padlock.',
    kind: 'once',
    price: 3500,
    cut: { crops: 0.3, hens: 0.2, predators: 0.25, cows: 0.4, tools: 0.2, store: 0.15, water: 0.25, diesel: 0.2 },
  },
  {
    id: 'gps',
    name: 'GPS tracker and a locking fuel cap',
    does: 'For the business tractor: the cap stops siphoning and the tracker shows where it is at night.',
    kind: 'once',
    price: 1500,
    cut: { diesel: 0.8 },
    recover: { diesel: 0.6 },
    needs: 'biz',
  },
];
export const measureOf = (id: MeasureId) => MEASURES.find(m => m.id === id)!;

/** Cuts from several measures multiply; together they never cut more than this. */
export const MAX_CUT = 0.95;
/** Harvest on time: ripe maize left standing past the harvest is this much likelier to be stolen each night. */
export const LATE_HARVEST = 1.6;
