import { useEffect, useReducer } from 'react';
import {
  GROWING_STEPS,
  HARVEST_EFFECT,
  PROCESSES,
  REWARDS,
  SHOP_TABS,
  STEP_META,
  STEPS,
  STORAGE_OPTIONS,
  TASK_TIPS,
  TASK_USES_ITEM,
  type HarvestChoice,
  type ShopTab,
  type StepId,
} from './data';

export type Modal =
  | { kind: 'welcome' }
  | { kind: 'settings' }
  | { kind: 'shop'; tab: ShopTab }
  | { kind: 'steps'; step: StepId }
  | { kind: 'sale' }
  | { kind: 'storage' }
  | { kind: 'outcome' }
  | { kind: 'timing' }
  | { kind: 'rewards' }
  | { kind: 'value' }
  | { kind: 'process' }
  | { kind: 'info' };

/** Stage index: 0–5 = the farming step being worked on, 6 = harvested and selling, 7 = season sold. */
export const SELLING = 6;
export const SOLD = 7;

export interface SeasonResult {
  season: number;
  health: number; // 0..1
  stepScores: Partial<Record<StepId, number>>;
  choice: HarvestChoice;
  bagsHarvested: number;
  bagsSold: number;
  quality: number;
  storage: string;
  processId: string | null;
  revenue: number;
  spend: number;
  profit: number;
  days: number;
}

export interface Prices {
  farmgate: number;
  market: number;
  transport: number;
  storage: number;
}

/** First session: create → walk → review (→ retry) → village opens → second review → done. */
export type FsPhase = 'create' | 'walk1' | 'review1' | 'walkRetry' | 'retry' | 'walk2' | 'review2' | 'done';

export interface GameState {
  // first session
  farmer: { name: string; look: number } | null;
  fs: { phase: FsPhase; at: 'first' | 'lower'; opened: boolean };
  /** reminder shown in Messages, e.g. the bean shamba to check tomorrow */
  note: string | null;
  // UI
  modal: Modal | null;
  plotSelected: boolean;
  toast: { id: number; text: string } | null;
  // player
  onboarded: boolean;
  coins: number;
  water: number; // thousands of litres
  level: number;
  xp: number;
  points: number;
  playSeconds: number;
  stock: Record<string, number>;
  inventory: string[]; // shop items owned (one entry per unit)
  redeemed: string[];
  collectedDay: Record<string, string>; // milk/eggs → date last collected
  // season
  season: number;
  day: number;
  stage: number;
  stepScores: Partial<Record<StepId, number>>;
  doneTasks: string[];
  seasonSpend: number;
  harvestChoice: HarvestChoice;
  harvested: { bags: number; quality: number } | null;
  prices: Prices;
  storage: string;
  processId: string;
  history: SeasonResult[];
  farmView: number; // index into history
  showPicker: boolean;
}

const initialStock = Object.fromEntries(SHOP_TABS.find(t => t.id === 'food')!.items.map(i => [i.id, i.stock![0]]));

export const DEFAULT_PRICES: Prices = { farmgate: 12, market: 24, transport: 24, storage: 24 };

export const freshSeason = {
  day: 0,
  stage: 0,
  stepScores: {},
  doneTasks: [] as string[],
  seasonSpend: 0,
  harvestChoice: 'wait2' as HarvestChoice,
  harvested: null,
  storage: 'home',
  processId: 'processing',
};

export const initialState: GameState = {
  farmer: null,
  fs: { phase: 'create', at: 'first', opened: false },
  note: null,
  modal: null,
  plotSelected: false,
  toast: null,
  onboarded: false,
  coins: 5000,
  water: 20,
  level: 1,
  xp: 0.1,
  points: 0,
  playSeconds: 0,
  stock: initialStock,
  inventory: [],
  redeemed: [],
  collectedDay: {},
  season: 1,
  ...freshSeason,
  prices: DEFAULT_PRICES,
  history: [],
  farmView: 0,
  showPicker: false,
};

/* ------------------------------------------------------------------ */
/* Rules                                                                */
/* ------------------------------------------------------------------ */

const stepDef = (id: StepId) => STEPS.find(d => d.id === id)!;
export const stepIndex = (id: StepId) => STEPS.findIndex(d => d.id === id);
export const currentStep = (s: GameState): StepId | null => (s.stage < STEPS.length ? STEPS[s.stage].id : null);

export const tasksDone = (s: GameState, id: StepId) => stepDef(id).tasks.filter(t => s.doneTasks.includes(t.id)).length;

/** 0..1: how much of the recommended work in a step has been done. */
export const stepScore = (s: GameState, id: StepId) => Math.min(1, tasksDone(s, id) / STEP_META[id].need);

/** Crop health so far: average score of the growing steps reached (finished steps use their final score). */
export function cropHealth(s: GameState): number | null {
  const reached = GROWING_STEPS.filter(id => stepIndex(id) <= s.stage);
  if (!reached.length) return null;
  const total = reached.reduce((sum, id) => sum + (s.stepScores[id] ?? stepScore(s, id)), 0);
  return total / reached.length;
}

/** Health used for the harvest: unfinished or skipped growing steps count as zero. */
const finalHealth = (s: GameState) =>
  GROWING_STEPS.reduce((sum, id) => sum + (s.stepScores[id] ?? 0), 0) / GROWING_STEPS.length;

export function expectedHarvest(s: GameState, choice: HarvestChoice) {
  const h = s.stage >= stepIndex('harvest') ? finalHealth(s) : (cropHealth(s) ?? 0);
  const fx = HARVEST_EFFECT[choice];
  const bags = Math.round((90 + 90 * h) * fx.yieldFactor);
  const quality = Math.max(1, Math.min(5, Math.round(1 + 4 * h) + fx.qualityShift));
  return { bags, quality, health: h };
}

/** Coins earned per bag at market after transport and storage (both entered per 10 bags). */
export const profitPerBag = (p: Prices) => Math.round((p.market - (p.transport + p.storage) / 10) * 10) / 10;

export function saleQuote(s: GameState, processId: string | null) {
  const storage = STORAGE_OPTIONS.find(o => o.id === s.storage)!;
  const harvestCare = s.stepScores.harvest ?? stepScore(s, 'harvest');
  const loss = storage.loss * (1 - 0.5 * harvestCare); // good handling halves losses
  const bags = s.harvested?.bags ?? 0;
  const bagsSold = Math.round(bags * (1 - loss));
  const process = processId ? PROCESSES.find(p => p.id === processId)! : null;
  const price = profitPerBag(s.prices) * (1 + (process ? process.profitIncrease / 100 : 0));
  const costs = bagsSold * storage.costPerBag + (process ? process.cost : 0);
  const revenue = Math.max(0, Math.round(bagsSold * price - costs));
  return { bagsSold, lost: bags - bagsSold, price, revenue };
}

export const daysToHarvest = (s: GameState) =>
  STEPS.slice(s.stage, stepIndex('harvest')).reduce((d, st) => d + STEP_META[st.id].days, 0);

export const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Reducer                                                              */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: 'open'; modal: Modal }
  | { type: 'close' }
  | { type: 'selectPlot'; on: boolean }
  | { type: 'onboarded' }
  | { type: 'buy'; id: string; price: number; name: string }
  | { type: 'sell'; id: string; price: number; name: string }
  | { type: 'task'; step: StepId; id: string; price: number; name: string; water?: number }
  | { type: 'finishStep'; step: StepId }
  | { type: 'water'; litres: number }
  | { type: 'chooseHarvest'; choice: HarvestChoice }
  | { type: 'harvest' }
  | { type: 'prices'; prices: Prices }
  | { type: 'storage'; id: string }
  | { type: 'process'; id: string }
  | { type: 'completeSale'; processId: string | null }
  | { type: 'newSeason' }
  | { type: 'redeem'; id: string }
  | { type: 'farm'; index: number }
  | { type: 'collect'; id: string; text: string; coins: number }
  | { type: 'toast'; text: string }
  | { type: 'tick'; seconds: number }
  | { type: 'picker'; on: boolean }
  | { type: 'reset'; state: Partial<GameState> }
  | { type: 'farmer'; name: string; look: number }
  | { type: 'fs'; phase: FsPhase; at?: 'first' | 'lower'; opened?: boolean; note?: string };

let toastId = 0;
const toast = (text: string) => ({ id: ++toastId, text });
const gainXp = (s: GameState, amount: number) => {
  let xp = s.xp + amount;
  let level = s.level;
  while (xp >= 1) {
    xp -= 1;
    level += 1;
  }
  return { xp, level };
};
const fmt = (n: number) => n.toLocaleString('en-US');

function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'open':
      return { ...s, modal: a.modal, plotSelected: false };
    case 'close':
      return { ...s, modal: null };
    case 'selectPlot':
      return { ...s, plotSelected: a.on };
    case 'onboarded':
      return { ...s, onboarded: true };
    case 'buy': {
      if (s.coins < a.price) return { ...s, toast: toast(`You need ${fmt(a.price)} coins for ${a.name}`) };
      return {
        ...s,
        coins: s.coins - a.price,
        inventory: [...s.inventory, a.id],
        ...gainXp(s, 0.03),
        toast: toast(`Bought ${a.name} for ${fmt(a.price)} coins`),
      };
    }
    case 'sell': {
      const left = s.stock[a.id] ?? 0;
      if (left <= 0) return { ...s, toast: toast(`No ${a.name} left to sell`) };
      return {
        ...s,
        coins: s.coins + a.price,
        stock: { ...s.stock, [a.id]: left - 1 },
        ...gainXp(s, 0.03),
        toast: toast(`Sold 1 bag of ${a.name} for ${a.price} coins`),
      };
    }
    case 'task': {
      if (s.doneTasks.includes(a.id)) return s;
      if (stepIndex(a.step) !== s.stage) return { ...s, toast: toast(`Finish ${STEPS[Math.min(s.stage, 5)].label} first`) };
      const item = TASK_USES_ITEM[a.id];
      const fromStock = item ? s.inventory.indexOf(item) : -1;
      const cost = fromStock >= 0 ? 0 : a.price;
      if (s.coins < cost) return { ...s, toast: toast(`You need ${cost} coins for ${a.name}`) };
      const inventory = fromStock >= 0 ? s.inventory.filter((_, i) => i !== fromStock) : s.inventory;
      const tip = TASK_TIPS[a.id] ?? `${a.name} done`;
      return {
        ...s,
        coins: s.coins - cost,
        seasonSpend: s.seasonSpend + cost,
        inventory,
        water: s.water + (a.water ?? 0),
        doneTasks: [...s.doneTasks, a.id],
        ...gainXp(s, 0.05),
        toast: toast(fromStock >= 0 ? `Used your ${a.name} from the shop · ${tip}` : tip),
      };
    }
    case 'finishStep': {
      const i = stepIndex(a.step);
      if (i !== s.stage) return s;
      const score = stepScore(s, a.step);
      const meta = STEP_META[a.step];
      const next = STEPS[i + 1];
      const stepScores = { ...s.stepScores, [a.step]: score };
      if (a.step === 'harvest') {
        return { ...s, stepScores, modal: { kind: 'timing' } };
      }
      const msg =
        score === 0
          ? `${STEPS[i].label} skipped · your crop will suffer`
          : `${STEPS[i].label} done · ${meta.days} days pass · next: ${next.label}`;
      return {
        ...s,
        stepScores,
        stage: i + 1,
        day: s.day + meta.days,
        points: s.points + Math.round(100 * score),
        ...gainXp(s, 0.2 * score),
        modal: { kind: 'steps', step: next.id },
        toast: toast(msg),
      };
    }
    case 'water':
      return { ...s, water: s.water + a.litres / 1000, toast: toast(`Saved a plan of ${fmt(a.litres)} L/m²`) };
    case 'chooseHarvest':
      return { ...s, harvestChoice: a.choice };
    case 'harvest': {
      if (s.stage !== stepIndex('harvest')) return s;
      const stepScores = { ...s.stepScores, harvest: s.stepScores.harvest ?? stepScore(s, 'harvest') };
      const next = { ...s, stepScores };
      const { bags, quality } = expectedHarvest(next, s.harvestChoice);
      const extra = s.harvestChoice === 'wait2' ? 2 : s.harvestChoice === 'week' ? 7 : 0;
      return {
        ...next,
        harvested: { bags, quality },
        stage: SELLING,
        day: s.day + extra,
        ...gainXp(s, 0.3),
        modal: { kind: 'sale' },
        toast: toast(`Harvested ${bags} bags of maize · quality ${quality}/5`),
      };
    }
    case 'prices':
      return { ...s, prices: a.prices };
    case 'storage':
      return { ...s, storage: a.id };
    case 'process':
      return { ...s, processId: a.id };
    case 'completeSale': {
      if (s.stage !== SELLING || !s.harvested) return s;
      const q = saleQuote(s, a.processId);
      const result: SeasonResult = {
        season: s.season,
        health: finalHealth(s),
        stepScores: s.stepScores,
        choice: s.harvestChoice,
        bagsHarvested: s.harvested.bags,
        bagsSold: q.bagsSold,
        quality: s.harvested.quality,
        storage: s.storage,
        processId: a.processId,
        revenue: q.revenue,
        spend: s.seasonSpend,
        profit: q.revenue - s.seasonSpend,
        days: s.day,
      };
      const history = [...s.history, result];
      return {
        ...s,
        coins: s.coins + q.revenue,
        points: s.points + q.bagsSold * 5,
        stage: SOLD,
        history,
        farmView: history.length - 1,
        ...gainXp(s, 0.5),
        modal: { kind: 'outcome' },
        toast: toast(`Sold ${q.bagsSold} bags for ${fmt(q.revenue)} coins · +${q.bagsSold * 5} points`),
      };
    }
    case 'newSeason':
      return {
        ...s,
        ...freshSeason,
        season: s.season + 1,
        modal: { kind: 'steps', step: 'landprep' },
        toast: toast(`Season ${s.season + 1} started · prepare your land`),
      };
    case 'redeem': {
      const r = REWARDS.find(x => x.id === a.id)!;
      if (s.redeemed.includes(a.id)) return s;
      if (s.points < r.cost) return { ...s, toast: toast(`You need ${fmt(r.cost - s.points)} more points for ${r.name}`) };
      return { ...s, points: s.points - r.cost, redeemed: [...s.redeemed, a.id], toast: toast(`${r.name} saved to your vouchers`) };
    }
    case 'farm':
      return { ...s, farmView: a.index };
    case 'collect':
      return {
        ...s,
        collectedDay: { ...s.collectedDay, [a.id]: today() },
        coins: s.coins + a.coins,
        ...gainXp(s, 0.03),
        toast: toast(a.text),
      };
    case 'toast':
      return { ...s, toast: toast(a.text) };
    case 'tick':
      return { ...s, playSeconds: s.playSeconds + a.seconds };
    case 'picker':
      return { ...s, showPicker: a.on };
    case 'reset':
      return { ...s, ...a.state };
    case 'farmer':
      return { ...s, farmer: { name: a.name, look: a.look } };
    case 'fs':
      return {
        ...s,
        fs: { phase: a.phase, at: a.at ?? s.fs.at, opened: a.opened ?? s.fs.opened },
        note: a.note ?? s.note,
        // passing the first review completes onboarding, so it never repeats
        onboarded: s.onboarded || a.phase === 'walk2',
      };
  }
}

/* ------------------------------------------------------------------ */
/* Saving                                                               */
/* ------------------------------------------------------------------ */

const SAVE_KEY = 'lima-farming-game:v2';
const TRANSIENT: (keyof GameState)[] = ['modal', 'plotSelected', 'toast'];

/** Design-review links (?review or ?screen) use a throwaway game so they never touch a player's save. */
export const reviewing = () => {
  const q = new URLSearchParams(window.location.search);
  return q.has('review') || q.has('screen');
};

/** Design review starts from a finished first session so every farm screen is reachable. */
export const REVIEW_BASE: Partial<GameState> = {
  onboarded: true,
  farmer: { name: 'Wanjiku', look: 0 },
  fs: { phase: 'done', at: 'first', opened: true },
};

function load(): GameState {
  if (reviewing()) return { ...initialState, ...REVIEW_BASE };
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return initialState;
    return { ...initialState, ...JSON.parse(raw), modal: null, plotSelected: false, toast: null };
  } catch {
    return initialState;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  useEffect(() => {
    if (reviewing()) return;
    try {
      const copy: Partial<GameState> = { ...state };
      TRANSIENT.forEach(k => delete copy[k]);
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
    } catch {
      /* private mode or storage blocked: play continues without saving */
    }
  }, [state]);
  return [state, dispatch] as const;
}
