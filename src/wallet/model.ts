/* The farmer's wallet: every change to the farmer's money, kept as history. Climate payments (and other payments the
   game makes on its own, like the water credits) are written here by the code that pays them, with their own words;
   every other change of money is written by trackWallet after each action, labelled by what the player did.

   No screens here (the page is Wallet.tsx), so the saved game can use it. */

import { plantOf } from '../forest/model';
import type { Action, GameState } from '../state';
import { achClock } from '../achievements/track';
import { lifeOf } from '../livestock/model';

export type WalletKind = 'climate' | 'water' | 'harvest' | 'produce' | 'animals' | 'power' | 'tractor' | 'farm' | 'shop' | 'business' | 'reward' | 'security' | 'giving' | 'savings' | 'other';

export const WALLET_KINDS: Record<WalletKind, { label: string; icon: string }> = {
  climate: { label: 'Climate payments', icon: '🌍' },
  water: { label: 'Water', icon: '💧' },
  harvest: { label: 'Harvests', icon: '🌽' },
  produce: { label: 'Market stall and restaurant', icon: '🧺' },
  animals: { label: 'Animals', icon: '🐄' },
  power: { label: 'Power', icon: '⚡' },
  tractor: { label: 'Tractor', icon: '🚜' },
  farm: { label: 'Farm work', icon: '🌱' },
  shop: { label: 'Shop', icon: '🛒' },
  business: { label: 'Tractor business', icon: '📍' },
  reward: { label: 'Rewards', icon: '🏅' },
  security: { label: 'Security', icon: '🔒' },
  giving: { label: 'Giving', icon: '🤝' },
  savings: { label: 'Savings & investments', icon: '🏦' },
  other: { label: 'Other', icon: '•' },
};

export interface WalletEntry {
  id: number;
  /** when (ms since 1970) */
  t: number;
  /** the calendar day (YYYY-MM-DD) and the farm day */
  date: string;
  day: number;
  kind: WalletKind;
  label: string;
  /** stored money: positive in, negative out */
  amount: number;
  /** the money in the wallet after it */
  balance: number;
  /** climate payments: the credits paid for */
  credits?: number;
}

export interface WalletState {
  /** newest first (the last WALLET_KEEP) */
  entries: WalletEntry[];
  /** all time, by kind (never trimmed) */
  totals: Partial<Record<WalletKind, { in: number; out: number }>>;
  /** by farm day, by kind: the last DAYS_KEPT farm days (for profit tracking; missing in older saves) */
  days?: Record<number, Partial<Record<WalletKind, { in: number; out: number }>>>;
}

/** Farm days of money in and out kept by day. */
export const DAYS_KEPT = 60;

export const WALLET_KEEP = 400;
export const emptyWallet = (): WalletState => ({ entries: [], totals: {} });
export const walletOf = (w: Partial<WalletState> | undefined): WalletState => ({ entries: w?.entries ?? [], totals: w?.totals ?? {}, days: w?.days ?? {} });

let seq = 0;

/** Write one entry: `coins` is the money in the wallet after it. */
export function addEntry<S extends { wallet?: Partial<WalletState>; life?: GameState['life'] }>(s: S, kind: WalletKind, label: string, amount: number, coins: number, extra: Partial<WalletEntry> = {}): S {
  if (!amount) return s;
  const w = walletOf(s.wallet);
  const t = Date.now();
  const e: WalletEntry = { id: t * 100 + (++seq % 100), t, date: achClock.today(), day: lifeOf(s.life).day, kind, label, amount: round2(amount), balance: round2(coins), ...extra };
  const add = (t: { in: number; out: number } | undefined) => {
    const x = t ?? { in: 0, out: 0 };
    return amount > 0 ? { ...x, in: round2(x.in + amount) } : { ...x, out: round2(x.out - amount) };
  };
  const days = { ...(w.days ?? {}) };
  days[e.day] = { ...(days[e.day] ?? {}), [kind]: add(days[e.day]?.[kind]) };
  const keep = Object.keys(days)
    .map(Number)
    .sort((a, b) => b - a)
    .slice(0, DAYS_KEPT);
  return {
    ...s,
    wallet: {
      entries: [e, ...w.entries].slice(0, WALLET_KEEP),
      totals: { ...w.totals, [kind]: add(w.totals[kind]) },
      days: Object.fromEntries(keep.map(d => [d, days[d]])),
    },
  };
}

const round2 = (n: number) => Math.round(n * 10000) / 10000;

/** What the player did, for the wallet's words. */
function describe(a: Action, prev: GameState, next: GameState): { kind: WalletKind; label: string } {
  const up = next.coins > prev.coins;
  switch (a.type) {
    case 'buy':
      return { kind: 'shop', label: `Bought ${a.name}` };
    case 'sell':
      return { kind: 'produce', label: `Sold ${a.name}` };
    case 'collect':
      return { kind: 'produce', label: a.text };
    case 'task':
      return { kind: 'farm', label: `Farm Moja: ${a.name}` };
    case 'csaDone':
      return { kind: 'reward', label: 'Climate Smart Agriculture practice' };
    case 'completeSale':
      return { kind: 'harvest', label: 'Farm Moja harvest sold' };
    case 'trialNew':
    case 'trialPlant':
      return { kind: 'farm', label: 'Seed and inputs for the farms' };
    case 'trialHarvest':
      return { kind: 'harvest', label: 'Harvest sold' };
    case 'trialCheck':
    case 'fieldMark':
    case 'prescribe':
    case 'treatChoose':
    case 'plotSet':
    case 'strategySet':
      return { kind: 'farm', label: a.type === 'prescribe' ? 'A wrong fix' : a.type === 'plotSet' ? 'Inputs changed' : 'Treatments and field work' };
    case 'tractorDone':
      return { kind: 'tractor', label: 'Tractor drive' };
    case 'tractorHub':
      return { kind: 'tractor', label: `Tractor: ${a.label ?? a.section}` };
    case 'biz':
    case 'bizRun':
    case 'bizHireOut':
    case 'bizPartner':
    case 'bizBuy':
    case 'bizAdvise':
    case 'bizDemo':
    case 'bizGraduate':
    case 'bizContract':
      return { kind: 'business', label: 'Tractor business' };
    case 'achClaim':
    case 'achClaimAll':
    case 'achDaily':
    case 'levelClaim':
    case 'redeem':
    case 'tidyClear':
      return { kind: 'reward', label: a.type === 'tidyClear' ? 'Daily tidy-up bonus' : 'Reward claimed' };
    case 'animalCare':
    case 'animalFix':
    case 'animalPrevent':
    case 'coopBuild':
    case 'shedBuild':
    case 'herdBuy':
    case 'herdSet':
      return { kind: 'animals', label: a.type === 'coopBuild' ? 'Chicken coop upgrade' : a.type === 'shedBuild' ? 'Cow shed upgrade' : a.type === 'herdBuy' || a.type === 'herdSet' ? 'Herd bought or sold' : up ? 'Milk and eggs sold' : 'Animal care' };
    case 'securityBuy':
    case 'securityHire':
      return { kind: 'security', label: 'Security' };
    case 'waterBuy':
    case 'coverBuy':
    case 'drawPolicy':
      return { kind: 'water', label: a.type === 'coverBuy' ? 'Crop cover' : 'Water bought' };
    case 'powerInstall':
      return { kind: 'power', label: 'Power: installed' };
    case 'powerFuel':
      return { kind: 'power', label: 'Diesel for the generator' };
    case 'produceSell':
    case 'produceSellGrades':
      return { kind: 'produce', label: 'Sold at the market stall' };
    case 'storageSet':
      return { kind: 'produce', label: `Storage: ${a.method === 'hermetic' ? 'hermetic bags' : 'charcoal cooler'}` };
    case 'restaurantCook':
      return { kind: 'produce', label: 'Meals sold at the restaurant' };
    case 'shopSell':
      return { kind: 'produce', label: `Market stall: ${a.name}'s order${a.tip > 0 ? ' and a tip' : ''}` };
    case 'shopMeal':
      return { kind: 'produce', label: `Restaurant: ${a.name}'s meal${a.tip > 0 ? ' and a tip' : ''}` };
    case 'ghPlant':
    case 'ghWater':
    case 'ghHarvest':
      return { kind: 'farm', label: a.type === 'ghPlant' ? `Planted greenhouse bed ${a.bed + 1}` : 'Greenhouse' };
    case 'storeMake':
      return { kind: 'produce', label: 'Storehouse: jars, sugar and milling' };
    case 'forestSell':
      return { kind: 'farm', label: a.kind === 'fell' ? `Mini forest: ${plantOf(a.id).name} felled` : `Mini forest: ${plantOf(a.id).name} harvest` };
    case 'finDeposit':
      return { kind: 'savings', label: 'Into SACCO savings' };
    case 'finWithdraw':
      return { kind: 'savings', label: 'Out of SACCO savings' };
    case 'finInvest':
      return { kind: 'savings', label: 'Invested' };
    case 'finSell':
      return { kind: 'savings', label: 'Investment taken out' };
    case 'kakumaGive':
      return { kind: 'giving', label: 'Gift to Kakuma, with WFP' };
    case 'loanAsk':
    case 'bookTraining':
      return { kind: 'other', label: 'Training booked' };
    case 'climateTick':
      return { kind: 'other', label: up ? 'Overnight' : 'Overnight: wages and losses' };
    default:
      return { kind: 'other', label: up ? 'Money in' : 'Money out' };
  }
}

/** After every action: a change of money nothing else wrote down goes in the wallet, labelled by the action. */
export function trackWallet(prev: GameState, next: GameState, a: Action): GameState {
  if (a.type === 'reset') return next;
  if (next.coins === prev.coins && next.wallet === prev.wallet) return next;
  const before = walletOf(prev.wallet).entries;
  const after = walletOf(next.wallet).entries;
  // entries written during this action by the code that paid them (they are newest first)
  const top = before[0]?.id;
  const at = top === undefined ? after.length : after.findIndex(e => e.id === top);
  const fresh = after.slice(0, at < 0 ? after.length : at);
  const written = fresh.reduce((n, e) => n + e.amount, 0);
  const rest = round2(next.coins - prev.coins - written);
  if (Math.abs(rest) < 0.0001) return next;
  const d = describe(a, prev, next);
  return addEntry(next, d.kind, d.label, rest, next.coins);
}

/** The climate payments in the wallet, newest first. */
export const climatePayments = (w: Partial<WalletState> | undefined) => walletOf(w).entries.filter(e => e.kind === 'climate');
