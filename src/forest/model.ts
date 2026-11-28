/* The mini forest: 10 acres at the bottom right of the farm, below the pond, planted with trees, bushes and grasses
   that are native to most of Africa. Each plant has its own stand (an area of the forest), its own card (what it is,
   what it gives, what it does for the climate) and its own harvests:

   - A crop (fruit, pods, nuts, leaves, cut grass) is taken and the plant lives on. It grows back in a few farm days;
     a cut grass or a cut bush stores less carbon until it does. The carbon in the crop goes back to the air within
     weeks (it is eaten or burned), but it was never counted as credits, so no credits are lost.
   - Felling (poles, timber, firewood, charcoal) is worth far more money once, and only once the stand is fully grown.
     The carbon in the wood goes back into the air (timber keeps some of it locked up for years), the credits for that
     carbon are cancelled (a "reversal", as in a real carbon project), and the stand starts again from seedlings,
     storing a fraction of what it did until it is grown again. Before a sale the player sees the money against the
     carbon, the credits and what else the land loses.

   The carbon rates are from the published figures named in SOURCES, turned into kg CO₂ an acre a day (C × 44/12,
   dry matter × 0.47 carbon, 2.471 acres a hectare, 365 days). Prices and growing times are estimates (the game's farm
   day is a shortened season). No pictures or screens here (Forest.tsx), so the saved game can use it. Money is stored
   money (src/money.ts: 1 = KSh 10). */

/* ---------------- sources ---------------- */

export interface ForestSource {
  name: string;
  url: string;
  /** the figure the rate is taken from, in the source's own words */
  figure: string;
}

export const SOURCES = {
  youngForest: {
    name: 'Requena Suarez et al. 2019, Global Change Biology: IPCC default rates refined from forest plots',
    url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6852081/',
    figure: 'Young secondary forest in Africa (20 years or less) gains 7.6 t of above-ground biomass a hectare a year (median 3.5)',
  },
  agroforestry: {
    name: 'IPCC Special Report on Land Use (2000), fact sheet: from low-productivity croplands to agroforestry in Africa',
    url: 'https://archive.ipcc.ch/ipccreports/sres/land_use/index.php?idp=187',
    figure: 'Trees on African farms store 1.2 to 5.1 t of carbon a hectare a year, most often 3.1; tree fallows (Sesbania) about 1.5',
  },
  grassland: {
    name: 'Tessema et al. 2020, Grassland Research: soil carbon in East African grasslands (23 studies, 6 countries)',
    url: 'https://livestock.cgiar.org/node/2079',
    figure: 'Grassland soils store 0.1 to 3.1 t of carbon a hectare a year, depending on how they are managed',
  },
  baobab: {
    name: 'Aboveground carbon in Adansonia digitata (baobab), Mpwapwa, Tanzania (Int. J. of Engineering, Science and Technology)',
    url: 'https://ajol.info/index.php/ijest/article/view/241652',
    figure: 'A grown baobab holds 2.8 to 3.5 t of carbon above the ground (about 10 to 13 t of CO₂)',
  },
  croton: {
    name: 'World Agroforestry (ICRAF), Agroforestree Database: Croton megalocarpus',
    url: 'https://apps.worldagroforestry.org/treedb2/AFTPDFS/Croton_megalocarpus.PDF',
    figure: 'A hardy, fast-growing pioneer tree, 15 to 35 m tall; its nuts are 50% protein and up to 32% oil',
  },
} satisfies Record<string, ForestSource>;

/** kg CO₂ an acre a day from t of carbon a hectare a year. */
export const fromCarbon = (tC: number) => Math.round(((tC * 1000 * 44) / 12 / 2.471 / 365) * 10) / 10;
/** kg CO₂ an acre a day from t of dry matter a hectare a year (47% carbon, the IPCC factor). */
export const fromBiomass = (tDm: number) => fromCarbon(tDm * 0.47);

/* ---------------- the plants ---------------- */

export type PlantKind = 'tree' | 'bush' | 'grass';
export type PlantId = 'croton' | 'markhamia' | 'acacia' | 'baobab' | 'sesbania' | 'carissa' | 'vernonia' | 'napier' | 'brachiaria' | 'rhodes';

export interface ForestCrop {
  /** the button: "Pick the fruit" */
  verb: string;
  /** what is sold: "baobab fruit powder" */
  what: string;
  price: number;
  /** farm days before it can be taken again */
  every: number;
  /** what the plant stores, as a share of its full rate, until the crop grows back (1: nothing changes) */
  drop: number;
  /** what taking it does, in a line */
  note: string;
}

export interface ForestFell {
  verb: string;
  what: string;
  price: number;
  /** the share of the wood's carbon kept out of the air for years (timber and poles), 0 for firewood or charcoal */
  keeps: number;
  /** where that carbon stays: "the poles" */
  keptIn?: string;
  /** extra CO₂ the making gives off, as a share of the wood's (a charcoal kiln burns much of the wood) */
  extra?: number;
  /** what the land loses until it grows again */
  losses: string[];
}

export interface Plant {
  id: PlantId;
  kind: PlantKind;
  name: string;
  /** the Latin name and names on the farm */
  latin: string;
  local: string;
  /** what it is, where it grows, what it gives */
  what: string;
  /** its good for the land and the climate, beyond carbon */
  good: string[];
  /** kg CO₂ an acre a day when fully grown, and where the figure comes from */
  kgDay: number;
  source: keyof typeof SOURCES;
  /** how the rate was worked out from the source (or "estimate" and why) */
  how: string;
  estimate?: true;
  /** in real life: how long it takes to grow, and what a grown one holds */
  real: string;
  /** in real life, its age in years when it is felled or fully grown (for the real-life carbon figure) */
  years: number;
  /** acres of the mini forest it stands on */
  acres: number;
  /** farm days from seedlings to fully grown (and ready to fell) */
  grow: number;
  crop: ForestCrop;
  fell: ForestFell | null;
  /** why it cannot be felled, when it cannot */
  noFell?: string;
  /** its Farm words card (learn/glossary.ts) */
  term: string;
  color: string;
}

const TREE_LOSSES = ['Birds, bees and the insects that eat crop pests lose their home', 'Bare ground washes away in the rains until roots hold it again', 'Less shade and shelter from the wind for the farm'];

export const PLANTS: Plant[] = [
  /* ---------------- trees ---------------- */
  {
    id: 'croton', kind: 'tree', name: 'Croton', latin: 'Croton megalocarpus', local: 'Mukinduri, musine, msenefu', term: 'croton', color: '#4f9450',
    what: 'A fast, hardy tree of East and Central Africa, and a native choice in place of grevillea (from Australia). Its nuts feed hens and make oil; its hard wood makes poles and timber.',
    good: ['Grows fast on poor, dry ground', 'Nuts are 50% protein: poultry feed and oil for biofuel', 'Shade, a windbreak and bee forage'],
    kgDay: fromBiomass(7.6), source: 'youngForest', how: '7.6 t biomass a hectare a year × 0.47 carbon × 44/12 ÷ 2.471 acres ÷ 365 days',
    real: 'Ready for poles in 8 to 10 years; grows 15 to 35 m tall',
    years: 8, acres: 2.5, grow: 14,
    crop: { verb: 'Gather the nuts', what: 'croton nuts for poultry feed and oil', price: 420, every: 6, drop: 1, note: 'The nuts fall by themselves: gathering them does not touch the tree.' },
    fell: { verb: 'Fell for poles', what: 'building poles and firewood', price: 1800, keeps: 0.4, keptIn: 'the poles', losses: TREE_LOSSES },
  },
  {
    id: 'markhamia', kind: 'tree', name: 'Nile tulip', latin: 'Markhamia lutea', local: 'Siala, mubiru', term: 'markhamia', color: '#3f7f47',
    what: 'A tall, narrow tree with yellow trumpet flowers, native from Kenya to Ghana. Farmers grow it along boundaries and among crops for straight poles and timber, a native choice in place of grevillea.',
    good: ['Narrow crown: little shade on the crops beside it', 'Straight poles that termites leave alone', 'Leaves for mulch, flowers for bees'],
    kgDay: fromCarbon(3.1), source: 'agroforestry', how: '3.1 t carbon a hectare a year (the most common figure for trees on African farms) × 44/12 ÷ 2.471 ÷ 365',
    real: 'Ready for timber in 10 to 15 years',
    years: 12, acres: 2, grow: 16,
    crop: { verb: 'Prune for firewood', what: 'side branches for firewood', price: 160, every: 8, drop: 0.85, note: 'Pruning the side branches grows a straighter trunk; it stores a little less until the branches grow back.' },
    fell: { verb: 'Fell for timber', what: 'timber and poles', price: 1600, keeps: 0.5, keptIn: 'the timber', losses: TREE_LOSSES },
  },
  {
    id: 'acacia', kind: 'tree', name: 'Umbrella thorn acacia', latin: 'Vachellia tortilis (Acacia tortilis)', local: 'Mgunga, olgorete', term: 'acacia', color: '#6aac5c',
    what: 'The flat-topped thorn tree of the African savanna, from the Sahel to South Africa. Its roots fix nitrogen from the air and its pods feed goats in the dry season.',
    good: ['Fixes nitrogen: grass and crops under it grow better', 'Pods are dry-season fodder for goats and cows', 'Lives through long droughts'],
    kgDay: fromCarbon(1.2), source: 'agroforestry', how: '1.2 t carbon a hectare a year, the low end for trees on farms: it grows slowly on dry land',
    real: 'Grows slowly: decades to full size, and lives over 100 years',
    years: 20, acres: 1, grow: 18,
    crop: { verb: 'Collect the pods', what: 'pods for goat fodder', price: 260, every: 5, drop: 1, note: 'The pods drop in the dry season: collecting them leaves the tree as it was.' },
    fell: { verb: 'Fell for charcoal', what: 'charcoal', price: 900, keeps: 0, extra: 0.25, losses: ['Charcoal puts all of the tree’s carbon in the air, and the kiln more', ...TREE_LOSSES] },
  },
  {
    id: 'baobab', kind: 'tree', name: 'Baobab', latin: 'Adansonia digitata', local: 'Mbuyu, kuka', term: 'baobab', color: '#9a7a55',
    what: 'The great bottle-trunked tree of Africa’s dry lands, from Senegal to Mozambique. It lives for many hundreds of years; its fruit is a dry powder rich in vitamin C, and its leaves are cooked as a vegetable.',
    good: ['Fruit powder and leaves to eat and sell, every year for centuries', 'Its trunk stores water through the dry season', 'Home to bats, birds and bees'],
    kgDay: 3, source: 'baobab', how: 'Estimate: a baobab grows very slowly, but a grown one holds 10 to 13 t of CO₂ in its trunk and branches', estimate: true,
    real: 'Fruits after 8 to 20 years and lives for over 1,000; a grown tree holds 10 to 13 t of CO₂',
    years: 50, acres: 1, grow: 30,
    crop: { verb: 'Pick the fruit', what: 'baobab fruit powder', price: 620, every: 7, drop: 1, note: 'Picking the fruit leaves the tree standing: it fruits again next season, for centuries.' },
    fell: null,
    noFell: 'Baobabs are protected in much of Africa, and one tree holds 10 to 13 t of CO₂: worth far more standing than felled.',
  },
  /* ---------------- bushes ---------------- */
  {
    id: 'sesbania', kind: 'bush', name: 'Sesbania', latin: 'Sesbania sesban', local: 'Mwethia, river bean', term: 'sesbania', color: '#5c9a43',
    what: 'A fast, soft-wooded bush native across Africa, grown as a tree fallow: two years of sesbania brings tired soil back. Its leaves are protein-rich fodder, its stems firewood.',
    good: ['Fixes nitrogen: maize after it can yield about 6 t a hectare', 'Leaves feed cows and goats', 'Cut, it sprouts again from the stump'],
    kgDay: fromCarbon(1.5), source: 'agroforestry', how: '1.5 t carbon a hectare a year for tree fallows such as sesbania × 44/12 ÷ 2.471 ÷ 365',
    real: 'Grows 3 to 4 m in a year; cut for fodder every few months',
    years: 2, acres: 1, grow: 6,
    crop: { verb: 'Cut for fodder', what: 'leafy stems for fodder', price: 300, every: 4, drop: 0.6, note: 'It sprouts again from the cut stems; it stores less until it grows back.' },
    fell: { verb: 'Uproot for firewood', what: 'firewood', price: 320, keeps: 0, losses: ['The nitrogen it fixed for the soil stops', 'Bare ground until it is planted again'] },
  },
  {
    id: 'carissa', kind: 'bush', name: 'Carissa', latin: 'Carissa spinarum (C. edulis)', local: 'Mtanda-mboo, agam', term: 'carissa', color: '#4f9450',
    what: 'A thorny evergreen bush found across Africa’s dry bush and forest edges, with sweet purple berries that children pick and markets sell. Planted close, it makes a living hedge.',
    good: ['Sweet berries to eat and sell', 'A thorny hedge that keeps goats out', 'Roots hold the soil on slopes'],
    kgDay: 3, source: 'agroforestry', how: 'Estimate: a slow bush stores less than farm trees (1.2 t carbon a hectare a year at the least), about 0.75 t', estimate: true,
    real: 'Berries from the third year; lives for decades',
    years: 5, acres: 0.5, grow: 10,
    crop: { verb: 'Pick the berries', what: 'carissa berries', price: 200, every: 4, drop: 1, note: 'Picking the berries leaves the bush as it was.' },
    fell: null,
    noFell: 'Its wood is small and thorny: it is worth more for its berries and as a hedge.',
  },
  {
    id: 'vernonia', kind: 'bush', name: 'Bitter leaf', latin: 'Vernonia amygdalina', local: 'Mululuza, ewuro, grawa', term: 'vernonia', color: '#6aac5c',
    what: 'A bush native across tropical Africa whose bitter leaves are cooked as a vegetable in West Africa and used as a medicine in the east. Bees love its flowers.',
    good: ['Leaves to cook and sell, picked again and again', 'A traditional medicine plant', 'Flowers for bees'],
    kgDay: 3, source: 'agroforestry', how: 'Estimate: a small bush stores less than farm trees (1.2 t carbon a hectare a year at the least), about 0.75 t', estimate: true,
    real: 'Leaves can be picked from the first year',
    years: 3, acres: 0.5, grow: 8,
    crop: { verb: 'Pick the leaves', what: 'bitter leaf for the market', price: 150, every: 3, drop: 0.8, note: 'Picking the leaves slows it a little until new ones grow.' },
    fell: null,
    noFell: 'It is grown for its leaves: cutting it down gives almost nothing.',
  },
  /* ---------------- grasses ---------------- */
  {
    id: 'napier', kind: 'grass', name: 'Napier grass', latin: 'Cenchrus purpureus (Pennisetum purpureum)', local: 'Elephant grass, mabingo', term: 'napier', color: '#79b457',
    what: 'A tall grass native to Africa’s wet grasslands, and the main cut fodder for dairy cows in East Africa. It also traps the stem borer moth away from maize (push-pull).',
    good: ['The most fodder of any grass: feeds the cows', 'Its roots hold the soil on terraces', 'A trap crop for stem borers beside maize'],
    kgDay: fromCarbon(1), source: 'grassland', how: '1 t carbon a hectare a year into the soil, in the 0.1 to 3.1 t range for East African grassland × 44/12 ÷ 2.471 ÷ 365',
    real: 'Cut every 6 to 8 weeks, for 5 years or more',
    years: 5, acres: 0.5, grow: 4,
    crop: { verb: 'Cut and sell', what: 'bundles of cut fodder', price: 380, every: 3, drop: 0.5, note: 'The roots stay alive and it grows back; until it does it stores half as much.' },
    fell: null,
    noFell: 'Grass is cut, not felled: its roots stay alive and keep the soil’s carbon.',
  },
  {
    id: 'brachiaria', kind: 'grass', name: 'Brachiaria', latin: 'Urochloa (Brachiaria) brizantha', local: 'Signal grass, palisade grass', term: 'brachiaria', color: '#6aa94f',
    what: 'A grass from the savannas of East and Central Africa, grown across the tropics for its deep roots and drought-hardy leaves.',
    good: ['Deep roots put carbon deep in the soil', 'Stays green into the dry season', 'Good grazing and hay'],
    kgDay: fromCarbon(1), source: 'grassland', how: '1 t carbon a hectare a year into the soil, in the 0.1 to 3.1 t range for East African grassland',
    real: 'Grazed or cut every 4 to 6 weeks',
    years: 5, acres: 0.5, grow: 4,
    crop: { verb: 'Cut for hay', what: 'hay', price: 320, every: 3, drop: 0.5, note: 'The roots stay alive and it grows back; until it does it stores half as much.' },
    fell: null,
    noFell: 'Grass is cut, not felled: its roots stay alive and keep the soil’s carbon.',
  },
  {
    id: 'rhodes', kind: 'grass', name: 'Rhodes grass', latin: 'Chloris gayana', local: 'Kapsabet grass', term: 'rhodes', color: '#9ccb74',
    what: 'A fine, leafy grass native to Africa, spreading by runners. Farmers sow it to bring bare, overgrazed land back and bale it as hay.',
    good: ['Runners cover bare ground fast', 'The most baled hay grass in Kenya', 'Handles salty and dry soil'],
    kgDay: fromCarbon(0.5), source: 'grassland', how: '0.5 t carbon a hectare a year into the soil: a lighter grass, low in the 0.1 to 3.1 t range',
    real: 'Baled two or three times a year',
    years: 5, acres: 0.5, grow: 4,
    crop: { verb: 'Bale the hay', what: 'bales of hay', price: 280, every: 3, drop: 0.5, note: 'The runners grow back from the roots; until they do it stores half as much.' },
    fell: null,
    noFell: 'Grass is cut, not felled: its roots stay alive and keep the soil’s carbon.',
  },
];

export const plantOf = (id: PlantId) => PLANTS.find(p => p.id === id)!;
export const KINDS: { id: PlantKind; label: string; icon: string }[] = [
  { id: 'tree', label: 'Trees', icon: '🌳' },
  { id: 'bush', label: 'Bushes', icon: '🌿' },
  { id: 'grass', label: 'Grasses', icon: '🌾' },
];

export const FOREST = {
  acres: 10,
  /** a felled stand starts again from seedlings at this share of its full rate */
  seedling: 0.15,
  /** points for a harvest, and for keeping a stand standing after seeing what felling would do */
  cropPoints: 10,
  keepPoints: 15,
  /** harvests kept in the log */
  keep: 20,
};

/** In real life: tonnes of CO₂ an acre of it holds at its harvest age (its rate over the years it took to grow). */
export const realTonnes = (p: Plant) => Math.round((p.kgDay * 365 * p.years) / 100) / 10;
/** A real carbon price for nature-based credits: US$ a tonne of CO₂ (the same as a TemoLima credit, climate/land.ts). */
export const REAL_PRICE_USD = 25;

/** kg CO₂ the whole mini forest stores a day when every stand is grown. */
export const FOREST_FULL = PLANTS.reduce((n, p) => n + p.kgDay * p.acres, 0);

/* ---------------- the stands ---------------- */

export interface Stand {
  id: PlantId;
  /** the farm day it was replanted after felling (null: grown, as the forest stood when the farm opened) */
  planted: number | null;
  /** the farm day its crop can be taken again (0: now) */
  cropAt: number;
  /** kg CO₂ it has stored and been credited for since the farm opened */
  credited: number;
  /** money it has earned, and how many times it was felled */
  earned: number;
  felled: number;
}

export interface ForestLog {
  day: number;
  id: PlantId;
  kind: 'crop' | 'fell' | 'keep';
  coins: number;
  /** kg CO₂ back in the air, and credits cancelled (felling) */
  co2: number;
  credits: number;
}

export interface ForestState {
  stands: Record<PlantId, Stand>;
  /** newest first */
  log: ForestLog[];
}

const grownStand = (id: PlantId): Stand => ({ id, planted: null, cropAt: 0, credited: 0, earned: 0, felled: 0 });
export const newForest = (): ForestState => ({ stands: Object.fromEntries(PLANTS.map(p => [p.id, grownStand(p.id)])) as Record<PlantId, Stand>, log: [] });
export function forestOf(f: Partial<ForestState> | undefined): ForestState {
  const base = newForest();
  const stands = { ...base.stands };
  for (const p of PLANTS) stands[p.id] = { ...base.stands[p.id], ...(f?.stands?.[p.id] ?? {}) };
  return { stands, log: f?.log ?? [] };
}

/** How grown a stand is, 0 to 1: a felled stand starts at the seedling share and is grown after its growing days. */
export function grownOf(st: Stand, day: number): number {
  if (st.planted === null) return 1;
  const p = plantOf(st.id);
  return Math.min(1, FOREST.seedling + (1 - FOREST.seedling) * Math.max(0, day - st.planted) / p.grow);
}
export const isGrown = (st: Stand, day: number) => grownOf(st, day) >= 1;
/** The farm day a stand is grown again. */
export const grownOn = (st: Stand) => (st.planted === null ? 0 : st.planted + plantOf(st.id).grow);

/** kg CO₂ a stand stores a day now: its rate, how grown it is, and less while a cut crop grows back. */
export function standRate(st: Stand, day: number): number {
  const p = plantOf(st.id);
  const cut = day < st.cropAt ? p.crop.drop : 1;
  return p.kgDay * p.acres * grownOf(st, day) * cut;
}

/** kg CO₂ the mini forest stores a day now. */
export const forestRate = (f0: Partial<ForestState> | undefined, day: number) => {
  const f = forestOf(f0);
  return PLANTS.reduce((n, p) => n + standRate(f.stands[p.id], day), 0);
};

export type StandStatus = 'ready' | 'growing' | 'regrowing';
/** Ready: its crop can be taken. Regrowing: its crop grows back. Growing: felled, growing from seedlings. */
export function standStatus(st: Stand, day: number): StandStatus {
  if (!isGrown(st, day) && plantOf(st.id).kind === 'tree') return 'growing';
  return day >= st.cropAt ? 'ready' : 'regrowing';
}

/** Days credited to the forest (the daily climate payment, climate/track.ts): each stand's share of the kg stored. */
export function creditForest(f0: Partial<ForestState> | undefined, day: number, days: number): ForestState {
  const f = forestOf(f0);
  if (days <= 0) return f;
  const stands = { ...f.stands };
  for (const p of PLANTS) stands[p.id] = { ...stands[p.id], credited: stands[p.id].credited + standRate(stands[p.id], day) * days };
  return { ...f, stands };
}

/* ---------------- before a sale: what it earns against what it costs the climate ---------------- */

export interface SaleQuote {
  id: PlantId;
  kind: 'crop' | 'fell';
  /** money it brings now */
  coins: number;
  /** kg CO₂ the stand holds, and the kg that goes back into the air */
  held: number;
  co2: number;
  /** credits cancelled, and the money they paid (at the climate level reached) */
  credits: number;
  creditCoins: number;
  /** kg CO₂ a day it stores now, and after */
  before: number;
  after: number;
  /** farm days until it is back to what it stores now */
  days: number;
  /** kg CO₂ it will not store while it grows back */
  missed: number;
  /** what else the land loses */
  losses: string[];
  /** can it be done now, and why not */
  ok: boolean;
  why?: string;
}

/** What a sale would do, before it is made. `credit`: kg CO₂ a credit; `rate`: money a credit pays. */
export function quoteSale(f0: Partial<ForestState> | undefined, id: PlantId, kind: 'crop' | 'fell', day: number, credit: number, rate: number): SaleQuote {
  const f = forestOf(f0);
  const p = plantOf(id);
  const st = f.stands[id];
  const before = standRate(st, day);
  if (kind === 'crop') {
    const ok = day >= st.cropAt && (p.kind !== 'tree' || isGrown(st, day));
    const after = p.kgDay * p.acres * grownOf(st, day) * p.crop.drop;
    return {
      id, kind, coins: p.crop.price, held: 0, co2: 0, credits: 0, creditCoins: 0, before, after,
      days: p.crop.drop < 1 ? p.crop.every : 0,
      missed: (before - after) * p.crop.every,
      losses: [],
      ok,
      why: ok ? undefined : p.kind === 'tree' && !isGrown(st, day) ? `Growing from seedlings: it fruits again on day ${grownOn(st)}` : `Grows back on day ${st.cropAt}`,
    };
  }
  if (!p.fell) return { id, kind, coins: 0, held: 0, co2: 0, credits: 0, creditCoins: 0, before, after: before, days: 0, missed: 0, losses: [], ok: false, why: p.noFell };
  // the carbon in the stand: what it took to grow it (its rate over its growing days), and what it has stored since
  const held = Math.round(p.kgDay * p.acres * p.grow + st.credited);
  const co2 = Math.round(held * (1 - p.fell.keeps) * (1 + (p.fell.extra ?? 0)));
  const credits = Math.round((co2 / credit) * 10) / 10;
  const after = p.kgDay * p.acres * FOREST.seedling;
  const ok = isGrown(st, day);
  return {
    id, kind, coins: p.fell.price, held, co2, credits, creditCoins: Math.round(credits * rate * 100) / 100, before, after,
    days: p.grow,
    // it grows back evenly from the seedling share, so it misses half the gap on average
    missed: Math.round(((before - after) * p.grow) / 2),
    losses: p.fell.losses,
    ok,
    why: ok ? undefined : `Still growing: fully grown on day ${grownOn(st)}`,
  };
}

/** The sale made: the forest after it (the log, the stand's crop timer or its replanting). */
export function sell(f0: Partial<ForestState> | undefined, q: SaleQuote, day: number): ForestState {
  const f = forestOf(f0);
  const st = f.stands[q.id];
  const p = plantOf(q.id);
  const next: Stand =
    q.kind === 'crop'
      ? { ...st, cropAt: day + p.crop.every, earned: st.earned + q.coins }
      : { ...st, planted: day, cropAt: day + p.grow, credited: 0, earned: st.earned + q.coins, felled: st.felled + 1 };
  const log: ForestLog = { day, id: q.id, kind: q.kind, coins: q.coins, co2: q.co2, credits: q.credits };
  return { stands: { ...f.stands, [q.id]: next }, log: [log, ...f.log].slice(0, FOREST.keep) };
}

/** The player looked at what felling would do and kept the stand standing. */
export const keepStanding = (f0: Partial<ForestState> | undefined, id: PlantId, day: number): ForestState => {
  const f = forestOf(f0);
  return { ...f, log: [{ day, id, kind: 'keep' as const, coins: 0, co2: 0, credits: 0 }, ...f.log].slice(0, FOREST.keep) };
};

/** Kept standing today already (points once a day a stand). */
export const keptToday = (f0: Partial<ForestState> | undefined, id: PlantId, day: number) => forestOf(f0).log.some(l => l.kind === 'keep' && l.id === id && l.day === day);
