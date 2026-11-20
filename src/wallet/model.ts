/* The farmer's wallet: every change to the farmer's money, kept as history. Climate payments (and other payments the
   game makes on its own, like the water credits) are written here by the code that pays them, with their own words;
   every other change of money is written by trackWallet after each action, labelled by what the player did.

   No screens here (the page is Wallet.tsx), so the saved game can use it. */

import type { Action, GameState } from '../state';
import { achClock } from '../achievements/track';
import { lifeOf } from '../livestock/model';

export type WalletKind = 'climate' | 'water' | 'harvest' | 'produce' | 'animals' | 'power' | 'tractor' | 'farm' | 'shop' | 'business' | 'reward' | 'security' | 'giving' | 'other';

export const WALLET_KINDS: Record<WalletKind, { label: string; icon: string }> = {
  climate: { label: 'Climate payments', icon: '🌍' },
  water: { label: 'Water', icon: '💧' },
  harvest: { label: 'Harvests', icon: '🌽' },
  produce: { label: 'Market stall', icon: '🧺' },
  animals: { label: 'Animals', icon: '🐄' },
  power: { label: 'Power', icon: '⚡' },
  tractor: { label: 'Tractor', icon: '🚜' },
  farm: { label: 'Farm work', icon: '🌱' },
  shop: { label: 'Shop', icon: '🛒' },
  business: { label: 'Tractor business', icon: '📍' },
  reward: { label: 'Rewards', icon: '🏅' },
  security: { label: 'Security', icon: '🔒' },
  giving: { label: 'Giving', icon: '🤝' },
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
}

export const WALLET_KEEP = 400;
export const emptyWallet = (): WalletState => ({ entries: [], totals: {} });
export const walletOf = (w: Partial<WalletState> | undefined): WalletState => ({ entries: w?.entries ?? [], totals: w?.totals ?? {} });

let seq = 0;

/** Write one entry: `coins` is the money in the wallet after it. */
export function addEntry<S extends { wallet?: Partial<WalletState>; life?: GameState['life'] }>(s: S, kind: WalletKind, label: string, amount: number, coins: number, extra: Partial<WalletEntry> = {}): S {
  if (!amount) return s;
  const w = walletOf(s.wallet);
  const t = Date.now();
  const e: WalletEntry = { id: t * 100 + (++seq % 100), t, date: achClock.today(), day: lifeOf(s.life).day, kind, label, amount: round2(amount), balance: round2(coins), ...extra };
  const tot = w.totals[kind] ?? { in: 0, out: 0 };
  return {
    ...s,
    wallet: {
      entries: [e, ...w.entries].slice(0, WALLET_KEEP),
      totals: { ...w.totals, [kind]: amount > 0 ? { ...tot, in: round2(tot.in + amount) } : { ...tot, out: round2(tot.out - amount) } },
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
      return { kind: 'produce', label: 'Sold at the market stall' };
    case 'gardenPlant':
    case 'gardenWater':
    case 'gardenHarvest':
      return { kind: 'farm', label: a.type === 'gardenPlant' ? `Planted Farm ${a.farm + 7}` : 'New farms' };
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
