/* Tracking: how well the farm is doing, in one place. The sustainability score (0 to 100) on the farm's home screen,
   and every figure behind it: climate, water, soil, power, inputs, practices, money and the animals. No screens here
   (Tracking.tsx, and the Sustainability section of Mission), so it can be tested and read anywhere.

   The score is a weighted average of eight parts, each 0 to 100. A part with nothing to go on yet (no animals in
   care, say) is left out and the others share its weight, so a new farm starts near the middle and moves with play. */

import { FACTORS, net, payOf, rating, waterProductivity, type ClimateState } from '../climate/model';
import { tankOf, capacityOf, type TankState } from '../water/model';
import { powerOf, partsDone, type PowerState } from '../power/model';
import { PART_IDS } from '../power/config';
import { csaOf, drillStreak, learned, practised, PRACTICE_COUNT, type CsaState } from '../csa/model';
import { farmProfit, financeOf, marginOf, investedValue, type FinanceState } from '../finance/model';
import { walletOf, type WalletKind, type WalletState } from '../wallet/model';
import { lifeOf, type LifeState } from '../livestock/model';
import { securityOf, type SecurityState } from '../security/model';
import type { TrialSummary } from '../trials/model';

/** What the score reads from the game state (a GameState fits). */
export interface TrackHost {
  climate: ClimateState;
  tank?: Partial<TankState>;
  power?: Partial<PowerState>;
  csa?: Partial<CsaState>;
  wallet?: Partial<WalletState>;
  finance?: Partial<FinanceState>;
  life?: Partial<LifeState>;
  security?: Partial<SecurityState>;
  trialHistory: TrialSummary[];
  inventory: string[];
  coins: number;
}

export type PartId = 'climate' | 'water' | 'soil' | 'power' | 'inputs' | 'practices' | 'money' | 'animals';

export interface Part {
  id: PartId;
  label: string;
  icon: string;
  /** share of the score, before parts with no data are left out */
  weight: number;
  /** 0 to 100, or null with nothing to go on yet */
  score: number | null;
  /** what the score is made of, in a few words */
  why: string;
  /** the one thing that would raise it most */
  tip: string;
}

export const PARTS: { id: PartId; label: string; icon: string; weight: number; what: string }[] = [
  { id: 'climate', label: 'Climate and carbon', icon: '🌍', weight: 20, what: 'Emissions for each bag grown, carbon kept in the soil, food lost' },
  { id: 'water', label: 'Water', icon: '💧', weight: 15, what: 'Rain caught against water used, and days the tank ran dry' },
  { id: 'soil', label: 'Soil and land', icon: '🪱', weight: 15, what: 'Soil health, and land kept covered rather than left bare' },
  { id: 'power', label: 'Power efficiency', icon: '⚡', weight: 15, what: 'Solar against the generator, and power there when needed' },
  { id: 'inputs', label: 'Chemicals and pollution', icon: '🧪', weight: 10, what: 'Pollution, sprays and synthetic nitrogen for each bag grown' },
  { id: 'practices', label: 'Climate-smart practice', icon: '🌿', weight: 10, what: 'Practices learned, shocks handled, the daily drill' },
  { id: 'money', label: 'Money', icon: '💰', weight: 10, what: 'Profit on what came in, and money kept back' },
  { id: 'animals', label: 'Animal welfare', icon: '🐄', weight: 5, what: 'The herd’s health, losses and problems fixed' },
];

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));
const r = Math.round;

/** The score's band, as a word and a tone. */
export function bandOf(score: number): { word: string; tone: 'good' | 'ok' | 'bad' } {
  if (score >= 80) return { word: 'Thriving', tone: 'good' };
  if (score >= 65) return { word: 'Sustainable', tone: 'good' };
  if (score >= 50) return { word: 'Getting there', tone: 'ok' };
  if (score >= 35) return { word: 'At risk', tone: 'bad' };
  return { word: 'Unsustainable', tone: 'bad' };
}

/* ---------------- the figures, part by part (the Tracking page shows these) ---------------- */

export function climateFigures(s: TrackHost) {
  const f = s.climate.total;
  const bags = f.yieldKg / FACTORS.bag.value;
  return {
    emitted: f.co2,
    stored: f.stored,
    net: net(f),
    bags,
    perBag: bags > 0 ? net(f) / bags : null,
    rating: rating(f),
    credits: s.climate.credits,
    foodLoss: f.foodLoss,
    lossShare: f.yieldKg + f.foodLoss > 0 ? f.foodLoss / (f.yieldKg + f.foodLoss) : null,
    shocks: s.climate.shocks,
    diesel: f.diesel,
  };
}

export function waterFigures(s: TrackHost) {
  const t = tankOf(s.tank);
  const days = t.days;
  const sum = (k: 'rain' | 'house' | 'animals' | 'farms' | 'short' | 'credits' | 'irrigationWant' | 'irrigationGot') => days.reduce((n, d) => n + (d[k] ?? 0), 0);
  const used = sum('house') + sum('animals') + sum('farms');
  return {
    days: days.length,
    level: t.level,
    capacity: capacityOf(s),
    rain: sum('rain'),
    used,
    house: sum('house'),
    animals: sum('animals'),
    farms: sum('farms'),
    short: sum('short'),
    dryDays: days.filter(d => d.short > 0).length,
    credits: sum('credits'),
    irrigation: sum('irrigationWant') > 0 ? sum('irrigationGot') / sum('irrigationWant') : null,
    rationed: days.filter(d => d.rationed).length,
    bought: (t.bought.piped ?? 0) + (t.bought.transported ?? 0),
    productivity: waterProductivity(s.climate.total),
    farmWater: s.climate.total.water,
  };
}

export function landFigures(s: TrackHost) {
  const p = payOf(s.climate);
  const pd = p.plotDays;
  const all = pd.farmed + pd.bare + pd.idle;
  return {
    soil: s.climate.total.soil,
    farmed: pd.farmed,
    bare: pd.bare,
    idle: pd.idle,
    plotDays: all,
    bareShare: all ? pd.bare / all : null,
    landStored: p.landKg.stored,
    landLost: p.landKg.lost,
  };
}

export function powerFigures(s: TrackHost) {
  const p = powerOf(s.power);
  const t = p.totals;
  const made = t.solar + t.gen;
  const served = p.history.length ? p.history.reduce((n, d) => n + d.served, 0) / p.history.length : null;
  return {
    parts: partsDone(s),
    partsAll: PART_IDS.length,
    days: t.days,
    solar: t.solar,
    gen: t.gen,
    used: t.used,
    solarShare: made > 0 ? t.solar / made : null,
    served,
    fuelL: t.fuelL,
    avoided: t.avoided,
    emitted: t.emitted,
    saved: t.saved,
    pumped: t.water,
  };
}

const INCOME: WalletKind[] = ['harvest', 'produce', 'animals', 'climate'];
const COSTS: WalletKind[] = ['farm', 'shop', 'water', 'animals', 'power', 'tractor', 'security'];

export function moneyFigures(s: TrackHost) {
  const w = walletOf(s.wallet);
  const f = financeOf(s.finance);
  const p = farmProfit(w, f);
  const tot = (k: WalletKind) => w.totals[k] ?? { in: 0, out: 0 };
  const harvestIn = tot('harvest').in + tot('produce').in;
  const otherIn = INCOME.filter(k => k !== 'harvest' && k !== 'produce').reduce((n, k) => n + tot(k).in, 0);
  const expenses = COSTS.reduce((n, k) => n + tot(k).out, 0);
  const inputs = tot('farm').out + tot('shop').out + tot('water').out;
  const bags = s.trialHistory.reduce((n, c) => n + c.bags.reduce((a, b) => a + b, 0), 0) + s.climate.total.yieldKg / FACTORS.bag.value;
  return {
    in: p.total.in,
    out: p.total.out,
    profit: p.profit,
    margin: marginOf(p.total),
    harvestIn,
    otherIn,
    expenses,
    inputs,
    /** money from harvests and the stall for every unit spent on seed, inputs and water */
    harvestReturn: inputs > 0 ? harvestIn / inputs : null,
    costPerBag: bags > 0 ? inputs / bags : null,
    savings: f.savings,
    invested: investedValue(f),
    wallet: s.coins,
    cycles: s.trialHistory.length,
    cycleProfit: s.trialHistory.map(c => ({ cycle: c.cycle, profit: c.profit.reduce((a, b) => a + b, 0), bags: c.bags.reduce((a, b) => a + b, 0) })),
  };
}

export function animalFigures(s: TrackHost) {
  const l = lifeOf(s.life);
  const sec = securityOf(s.security);
  return {
    started: l.started !== null,
    cows: l.health.cows,
    hens: l.health.hens,
    health: (l.health.cows + l.health.hens) / 2,
    issues: l.issues.length,
    deaths: l.totals.deaths,
    fixed: l.totals.fixed,
    wrong: l.totals.wrong,
    milk: l.totals.milk,
    eggs: l.totals.eggs,
    earned: l.totals.earned,
    spent: l.totals.spent,
    nights: sec.totals.nights,
    thefts: sec.totals.thefts,
    lost: sec.totals.lost,
  };
}

/* ---------------- the parts of the score ---------------- */

function climatePart(s: TrackHost): Pick<Part, 'score' | 'why' | 'tip'> {
  const c = climateFigures(s);
  if (c.rating) return { score: c.rating.score, why: `Rating ${c.rating.grade}: ${c.perBag !== null ? `${r(c.perBag)} kg CO₂e a bag` : ''}${c.lossShare ? `, ${r(c.lossShare * 100)}% of food lost` : ''}`, tip: c.lossShare && c.lossShare > 0.1 ? 'Store the harvest well: lost food wastes every emission that grew it.' : 'Mulch, beans and manure keep carbon in the soil and cut fertilizer.' };
  const moved = c.emitted + c.stored;
  if (moved <= 0) return { score: 60, why: 'No harvest yet: the rating comes with the first one', tip: 'Plan the six farms in Mission and bring in a harvest.' };
  return { score: r(clamp(60 + ((c.stored - c.emitted) / moved) * 30)), why: `${r(c.stored)} kg CO₂ kept, ${r(c.emitted)} kg emitted so far`, tip: 'Keep more carbon than you emit: mulch, beans, manure, solar pumping.' };
}

function waterPart(s: TrackHost): Pick<Part, 'score' | 'why' | 'tip'> {
  const w = waterFigures(s);
  if (!w.days || w.used <= 0) return { score: 60, why: 'No water days counted yet', tip: 'Gutters and a bigger tank catch the rain the farm needs.' };
  const reliable = 1 - Math.min(1, w.short / w.used);
  const rainShare = Math.min(1, w.rain / w.used);
  const score = r(clamp(55 * reliable + 45 * rainShare - Math.min(10, w.rationed * 2)));
  return {
    score,
    why: `${r(rainShare * 100)}% of the water used came from the rain${w.dryDays ? `, ${w.dryDays} dry day${w.dryDays > 1 ? 's' : ''}` : ''}`,
    tip: w.dryDays ? 'The tank ran dry: add storage, or draw less on the shared dam when it is low.' : rainShare < 0.6 ? 'Water in the cool hours and catch more rain: less is bought or pumped.' : 'Keep it up: water early or late, never in the midday heat.',
  };
}

function soilPart(s: TrackHost): Pick<Part, 'score' | 'why' | 'tip'> {
  const l = landFigures(s);
  const cover = l.bareShare === null ? 0 : 15 * (1 - 3 * l.bareShare);
  const score = r(clamp(55 + clamp(l.soil * 2.5, -35, 30) + cover));
  return {
    score,
    why: `Soil ${l.soil >= 0 ? '+' : ''}${r(l.soil)} points${l.bareShare !== null ? `, ${r(l.bareShare * 100)}% of plot-days bare` : ''}`,
    tip: l.bareShare && l.bareShare > 0.15 ? 'Bare soil loses carbon and washes away: plant or mulch cleared plots soon.' : 'Rotate with beans and add manure or compost to build the soil.',
  };
}

function powerPart(s: TrackHost): Pick<Part, 'score' | 'why' | 'tip'> {
  const p = powerFigures(s);
  const built = p.parts / p.partsAll;
  if (!p.days) return { score: r(25 + 35 * built), why: `${p.parts} of ${p.partsAll} power parts built`, tip: 'Build the solar power system (Power → Build): it pays for itself.' };
  const score = r(clamp(45 * (p.solarShare ?? 0) + 30 * (p.served ?? 0) + 25 * built));
  return {
    score,
    why: `${r((p.solarShare ?? 0) * 100)}% from the sun, ${r((p.served ?? 0) * 100)}% of needs met`,
    tip: (p.solarShare ?? 0) < 0.8 ? 'Run the generator less: more panels or a bigger battery keep diesel off the farm.' : (p.served ?? 1) < 0.9 ? 'Switch off loads you do not need so the battery lasts the night.' : 'Clean power, well used.',
  };
}

function inputsPart(s: TrackHost): Pick<Part, 'score' | 'why' | 'tip'> {
  const f = s.climate.total;
  const l = landFigures(s);
  const scale = Math.max(1, f.yieldKg / FACTORS.bag.value, l.farmed / 10);
  const pol = f.pollution / scale;
  const sprays = f.sprays / scale;
  const n = f.fertN / scale;
  const score = r(clamp(100 - Math.min(60, pol * 15) - Math.min(25, sprays * 8) - Math.min(15, n * 0.5)));
  return {
    score,
    why: f.pollution || f.sprays || f.fertN ? `${r(f.pollution)} pollution points, ${f.sprays} sprays, ${r(f.fertN)} kg nitrogen` : 'No chemicals used yet',
    tip: f.sprays > 2 ? 'Scout before you spray: treat only the pest you see, on the plot that has it.' : 'Manure and beans feed the soil without synthetic nitrogen.',
  };
}

function practicesPart(s: TrackHost, today: string): Pick<Part, 'score' | 'why' | 'tip'> {
  const c = csaOf(s.csa);
  const sh = s.climate.shocks;
  const streak = drillStreak(c, today);
  const shocks = sh.met ? (sh.handled / sh.met) * 20 : 10;
  const score = r(clamp((learned(c) / PRACTICE_COUNT) * 50 + (practised(c) / PRACTICE_COUNT) * 20 + shocks + Math.min(10, streak * 2)));
  return {
    score,
    why: `${learned(c)} of ${PRACTICE_COUNT} practices learned${sh.met ? `, ${sh.handled} of ${sh.met} shocks handled` : ''}${streak ? `, ${streak}-day drill streak` : ''}`,
    tip: learned(c) < PRACTICE_COUNT ? 'Play today’s climate-smart drill: each practice learned makes the farm hardier.' : 'Practise each one to two stars, and read each drought, flood and hail right.',
  };
}

function moneyPart(s: TrackHost): Pick<Part, 'score' | 'why' | 'tip'> {
  const m = moneyFigures(s);
  if (!m.in && !m.out) return { score: null, why: 'No money in or out yet', tip: 'Sell a harvest to start counting.' };
  const buffer = m.wallet + m.savings + m.invested > 0 ? Math.min(10, ((m.savings + m.invested) / (m.wallet + m.savings + m.invested)) * 40) : 0;
  const score = m.in <= 0 ? 15 : r(clamp(45 + (m.margin ?? 0) * 55 + buffer));
  return {
    score,
    why: m.margin !== null ? `${r(m.margin * 100)}% profit on what came in` : 'Money spent, nothing earned yet',
    tip: (m.margin ?? -1) < 0 ? 'The farm spends more than it earns: open Money → Profit to find the leak.' : buffer < 5 ? 'Save some of each harvest: a buffer carries the farm through a bad season.' : 'Profitable, with money kept back.',
  };
}

function animalsPart(s: TrackHost): Pick<Part, 'score' | 'why' | 'tip'> {
  const a = animalFigures(s);
  if (!a.started) return { score: null, why: 'Animal care starts on day 2', tip: 'Feed, water and clean the cows and hens each day.' };
  const score = r(clamp(a.health - a.deaths * 15 - a.issues * 5 - a.thefts * 2));
  return {
    score,
    why: `Health ${r(a.health)}%${a.issues ? `, ${a.issues} problem${a.issues > 1 ? 's' : ''} now` : ''}${a.deaths ? `, ${a.deaths} lost` : ''}`,
    tip: a.issues ? 'Treat the problems showing in Animals → Health.' : 'Do every chore each day: healthy animals give more milk and eggs.',
  };
}

/** Every part of the score, with the score itself. `today` is the calendar day (YYYY-MM-DD), for the drill streak. */
export function sustainability(s: TrackHost, today: string): { score: number; parts: Part[] } {
  const raw: Record<PartId, Pick<Part, 'score' | 'why' | 'tip'>> = {
    climate: climatePart(s),
    water: waterPart(s),
    soil: soilPart(s),
    power: powerPart(s),
    inputs: inputsPart(s),
    practices: practicesPart(s, today),
    money: moneyPart(s),
    animals: animalsPart(s),
  };
  const parts: Part[] = PARTS.map(p => ({ id: p.id, label: p.label, icon: p.icon, weight: p.weight, ...raw[p.id] }));
  const counted = parts.filter(p => p.score !== null);
  const w = counted.reduce((n, p) => n + p.weight, 0);
  const score = w ? r(counted.reduce((n, p) => n + (p.score as number) * p.weight, 0) / w) : 50;
  return { score: clamp(score), parts };
}

/** The parts pulling the score down most (weight × room to grow), for "what to do next". */
export function weakest(parts: Part[], n = 3): Part[] {
  return parts
    .filter(p => p.score !== null && (p.score as number) < 85)
    .sort((a, b) => (100 - (b.score as number)) * b.weight - (100 - (a.score as number)) * a.weight)
    .slice(0, n);
}
