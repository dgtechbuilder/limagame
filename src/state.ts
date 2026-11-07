import { useEffect, useReducer, useRef } from 'react';
import { FARMS, ROUND_POINTS, dayNumber } from './rounds/farms';
import {
  CHECK_DAYS,
  COMMON_PLAN,
  DAMAGE,
  WRONG_FIX_COST,
  canTreat,
  checkKey,
  currentDay,
  explain,
  farmName,
  harvestFarm,
  hazardFor,
  newTrial,
  planProblem,
  plotsOf,
  trialCost,
  setChoice,
  suggestPlans,
  type Plan,
  type StepKey,
  type Trial,
  type TrialSummary,
} from './trials/model';
import { FOLLOW_UP } from './care/data';
import { carryNeeded, emptyField, followUpLeft, plotLocked, plotMask, plotsIn, treatCost, treatLeft, type Carry, type Field } from './world/field';
import { TRACTOR_BONUS, type ImplId } from './tractor/data';
import { TRACTOR_PLOT, plotCost, plotName, setPlotInput, tractorBlock, type PlotJob, type PlotKind, type TractorId } from './plots/data';
import { initialClimate, type ClimateState } from './climate/model';
import { trackClimate } from './climate/track';
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
  | { kind: 'menu' }
  | { kind: 'climate'; tab?: ClimateTab }
  | { kind: 'welcome' }
  | { kind: 'settings'; tab?: SettingsTab }
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

/** Player settings. They are kept on this device and survive Reset progress. */
export interface Settings {
  /** how the people and animals are drawn: retro anime (cel shading, ink outlines, big eyes) or the original look */
  art: 'anime' | 'original';
  /** 3D farm quality: auto drops shadows on slow phones; low always does; high never does */
  graphics: 'auto' | 'high' | 'low';
  /** stop the bobbing, pulsing and sliding animations */
  reduceMotion: boolean;
  /** read the guide's lines and the messages aloud */
  voice: boolean;
}
export type SettingsTab = 'farmer' | 'game' | 'display' | 'help';
export type ClimateTab = 'overview' | 'emissions' | 'water' | 'shocks' | 'activity';
export const DEFAULT_SETTINGS: Settings = { art: 'anime', graphics: 'auto', reduceMotion: false, voice: false };

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

/** First session: create → walk → review (→ retry) → the whole farm opens → second review → done. */
export type FsPhase = 'create' | 'walk1' | 'review1' | 'walkRetry' | 'retry' | 'walk2' | 'review2' | 'done';

/** The best result for one field round: read right (and on which look), or still missed. */
export interface RoundRecord {
  right: boolean;
  /** which look got it right (1 or 2), or how many looks so far */
  tries: number;
}

/** Which part of the field rounds to open in design review (the rounds keep their own place otherwise). */
export type RoundsView = 'map' | 'look' | 'judge' | 'right' | 'wrong' | 'summary';

export interface GameState {
  settings: Settings;
  /** climate tracking: emissions, carbon stored, water, pollution, soil, credits (src/climate/model.ts) */
  climate: ClimateState;
  /** the farm screen: the walkable 3D farm, or the classic painted one */
  view: 'world' | 'classic';
  /** the screen on top was opened from the main menu, so Back goes back to the menu */
  fromMenu: boolean;
  /** counts every "back to the farm", so screens the farm world keeps to itself (the tractor, a check) close too */
  navSeq: number;
  /** counts the menu's "Tractor" taps, which the farm world answers by walking to the tractor */
  rideReq: number;
  /** field work done by hand in the farm world, for the current cycle */
  field: Field;
  // the six farms: one crop grown to a different plan on each farm, compared at harvest
  trial: Trial | null;
  trialHistory: TrialSummary[];
  /** the plan the player kept from an earlier cycle; the next cycle starts from it */
  recipe: Plan | null;
  trialsOpen: boolean;
  /** the field rounds are checking the six farms (not the everyday beds) */
  roundsTrial: boolean;
  // field rounds
  /** start: the day the player first opened the rounds (the 21-day crop cycle counts from it); done: today's results, by farm */
  rounds: { start: number | null; day: number; done: Record<string, RoundRecord> };
  roundsOpen: boolean;
  roundsView: RoundsView | null;
  /** design review only: show one situation, as hazard:crop:stage */
  roundsDemo: string | null;
  /** design review only: open one of the farm world's screens from Wakala Agent (see world/World.tsx WORLD_DEMOS) */
  worldDemo: string | null;
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
  settings: DEFAULT_SETTINGS,
  climate: initialClimate,
  view: 'world',
  fromMenu: false,
  navSeq: 0,
  rideReq: 0,
  field: emptyField(),
  trial: null,
  trialHistory: [],
  recipe: null,
  trialsOpen: false,
  roundsTrial: false,
  rounds: { start: null, day: 0, done: {} },
  roundsOpen: false,
  roundsView: null,
  roundsDemo: null,
  worldDemo: null,
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
  /** back to the farm from anywhere: closes every screen on top of it */
  | { type: 'home' }
  /** back to the farm and walk to the tractor (the farm world picks this up) */
  | { type: 'ride' }
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
  | { type: 'settings'; patch: Partial<Settings> }
  | { type: 'rounds'; open: boolean; view?: RoundsView | null; demo?: string | null; trial?: boolean }
  | { type: 'trials'; open: boolean }
  | { type: 'trialNew' }
  | { type: 'trialPlan'; farm: number; key: StepKey; value: string }
  | { type: 'trialSuggest' }
  | { type: 'trialPlant'; clock: Trial['clock'] }
  | { type: 'trialCheck'; farm: number; day: number; right: boolean; tries: number; physical?: boolean }
  | { type: 'view'; view: GameState['view'] }
  | {
      type: 'fieldMark';
      farm: number;
      job: string;
      bits: number;
      /** the tiles were done from the tractor seat */
      tractor?: boolean;
      /** the tractor type and tool that did them (one plot at a time: plots/data.ts tractorBlock) */
      rig?: { tractor: TractorId; tool: ImplId; job: PlotJob };
    }
  /** put a seed, fertilizer or sprayer on a plot of a farm (another plot with it swaps) */
  | { type: 'plotSet'; farm: number; plot: number; kind: PlotKind; value: string }
  | { type: 'carry'; item: Carry }
  | { type: 'fieldHire' }
  | { type: 'trialNextDay' }
  | { type: 'trialClock'; clock: Trial['clock'] }
  | { type: 'trialHarvest' }
  | { type: 'trialRecipe'; farm: number }
  | { type: 'roundResult'; id: string; right: boolean; tries: number; day: number; hazard?: string }
  /** farm world, after a right call: the fix the player picked (a wrong one costs coins; they pick again) */
  | { type: 'prescribe'; farm: number; day: number; pick: string; right: boolean }
  /** farm world: follow-ups whose day ended undone, by `${farm}:${day}` (they are logged once) */
  | { type: 'followUpMissed'; keys: string[] }
  /** farm world: a before-planting tractor drive finished (the drive's coins and points are worked out by the screen) */
  | { type: 'tractorDone'; farm: number; score: number; stars: number; Q: number; coins: number; points: number; diesel?: number; co2?: number; clim?: number }
  | { type: 'fs'; phase: FsPhase; at?: 'first' | 'lower'; opened?: boolean; note?: string };

let toastId = 0;
export const toast = (text: string) => ({ id: ++toastId, text });
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

/** Every action, then the climate it changed (src/climate/track.ts). */
export function reducer(s: GameState, a: Action): GameState {
  const next = play(s, a);
  return next === s ? s : trackClimate(s, next, a);
}

function play(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'open':
      return { ...s, modal: a.modal, fromMenu: s.modal?.kind === 'menu' && a.modal.kind !== 'menu', plotSelected: false };
    case 'close':
      // a screen opened from the main menu goes back to the menu
      return s.fromMenu && s.modal && s.modal.kind !== 'menu' ? { ...s, modal: { kind: 'menu' }, fromMenu: false } : { ...s, modal: null, fromMenu: false };
    case 'ride':
      return { ...s, modal: null, fromMenu: false, plotSelected: false, roundsOpen: false, roundsTrial: false, roundsView: null, roundsDemo: null, trialsOpen: false, worldDemo: null, navSeq: s.navSeq + 1, rideReq: s.rideReq + 1, toast: s.view === 'world' ? s.toast : toast('The tractor is on the 3D farm: switch the farm view in Settings') };
    case 'home':
      return { ...s, modal: null, fromMenu: false, plotSelected: false, roundsOpen: false, roundsTrial: false, roundsView: null, roundsDemo: null, trialsOpen: false, worldDemo: null, navSeq: s.navSeq + 1 };
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
    case 'settings':
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case 'rounds':
      return {
        ...s,
        // closing the checks of the six farms goes back to the six farms
        trialsOpen: !a.open && s.roundsTrial ? true : a.open ? false : s.trialsOpen,
        roundsTrial: a.open ? !!a.trial : false,
        roundsOpen: a.open,
        roundsView: a.open ? (a.view ?? null) : null,
        roundsDemo: a.open ? (a.demo ?? null) : null,
        // the crops stay for 21 real days from the first time the rounds are opened
        rounds: a.open && s.rounds.start === null ? { ...s.rounds, start: dayNumber() } : s.rounds,
        // closed again after being opened from the main menu: back to the menu
        modal: !a.open && s.fromMenu && !s.roundsTrial ? { kind: 'menu' } : null,
        fromMenu: a.open ? s.modal?.kind === 'menu' || (s.fromMenu && !!a.trial) : !!s.fromMenu && s.roundsTrial,
        plotSelected: false,
      };
    case 'roundResult': {
      // every farm is a new situation each day, so results (and the points) start again at midnight
      const today = s.rounds.day === a.day ? s.rounds.done : {};
      const before = today[a.id];
      // points are paid once per farm per day, the first time it is read right
      const earned = a.right && !before?.right ? (a.tries === 1 ? ROUND_POINTS.first : ROUND_POINTS.second) : 0;
      const record: RoundRecord = before?.right ? before : { right: a.right, tries: a.tries };
      const done = { ...today, [a.id]: record };
      const total = FARMS.filter(r => done[r.id]?.right).length;
      return {
        ...s,
        rounds: { ...s.rounds, day: a.day, done },
        points: s.points + earned,
        ...gainXp(s, a.right ? 0.06 : 0.01),
        toast: earned ? toast(`Read right · +${earned} points · ${total} of ${FARMS.length} beds`) : s.toast,
      };
    }
    case 'trials':
      return {
        ...s,
        trialsOpen: a.open,
        roundsOpen: false,
        roundsTrial: false,
        // closed again after being opened from the main menu: back to the menu
        modal: !a.open && s.fromMenu ? { kind: 'menu' } : null,
        fromMenu: a.open ? s.modal?.kind === 'menu' || s.fromMenu : false,
        plotSelected: false,
      };
    case 'trialNew': {
      if (s.trial && s.trial.phase !== 'done') return s;
      const guided = s.trialHistory.length === 0;
      return { ...s, trial: newTrial(s.trialHistory.length + 1, guided, s.recipe ?? COMMON_PLAN) };
    }
    case 'trialPlan': {
      const t = s.trial;
      if (!t || t.phase !== 'plan' || (t.guided && a.farm === 0)) return s;
      const plans = t.plans.map((p, i) => (i === a.farm ? setChoice(p, a.key, a.value) : p));
      return { ...s, trial: { ...t, plans } };
    }
    case 'trialSuggest': {
      const t = s.trial;
      if (!t || t.phase !== 'plan') return s;
      return { ...s, trial: { ...t, plans: suggestPlans(t.plans[0], t.plans.length, Math.floor(Math.random() * 7)) } };
    }
    case 'trialPlant': {
      const t = s.trial;
      if (!t || t.phase !== 'plan') return s;
      const problem = planProblem(t, s.coins);
      if (problem) return { ...s, toast: toast(problem) };
      const cost = trialCost(t);
      return {
        ...s,
        coins: s.coins - cost,
        trial: { ...t, phase: 'growing', clock: a.clock, planted: dayNumber(), day: 1 },
        field: emptyField(t.cycle),
        ...gainXp(s, 0.1),
        toast: toast(s.view === 'world' ? `${t.plans.length} farm plans paid: ${fmt(cost)} coins · now get them planted` : `${t.plans.length} farms planted for ${fmt(cost)} coins · day 1: check every farm`),
      };
    }
    case 'trialCheck': {
      const t = s.trial;
      if (!t || t.phase !== 'growing' || a.day < 1 || a.day > CHECK_DAYS) return s;
      const key = checkKey(a.farm, a.day);
      const before = t.checks[key];
      if (before?.right) return s;
      const h = hazardFor(t, a.farm, a.day);
      const p = t.plans[a.farm];
      const fix = a.right && canTreat(h, p) ? DAMAGE[h].treat : 0;
      // in the farm world the treatment is done by hand afterwards (fieldMark), and paid for then
      const paid = !a.physical && fix > 0 && s.coins >= fix;
      const earned = a.right ? (a.tries === 1 ? ROUND_POINTS.first : ROUND_POINTS.second) : 0;
      const treatments = t.treatments.map((n, i) => (i === a.farm && paid ? n + fix : n));
      return {
        ...s,
        coins: s.coins - (paid ? fix : 0),
        points: s.points + earned,
        trial: { ...t, checks: { ...t.checks, [key]: { right: a.right, tries: a.tries, treated: paid } }, treatments },
        ...gainXp(s, a.right ? 0.06 : 0.01),
        toast: earned ? toast(`Read right · +${earned} points${paid ? ` · treated for ${fix} coins` : ''}`) : s.toast,
      };
    }
    case 'trialNextDay': {
      const t = s.trial;
      if (!t || t.phase !== 'growing' || t.clock !== 'fast') return s;
      const day = currentDay(t, dayNumber());
      if (day > CHECK_DAYS) return s;
      const unchecked = t.plans.findIndex((_, i) => !t.checks[checkKey(i, day)]);
      if (unchecked >= 0) return { ...s, toast: toast(`Check ${farmName(unchecked)} first`) };
      return { ...s, trial: { ...t, day: day + 1 }, toast: toast(day + 1 > CHECK_DAYS ? 'Harvest time on every farm' : `Day ${day + 1} of ${CHECK_DAYS}`) };
    }
    case 'trialClock': {
      const t = s.trial;
      if (!t || t.phase !== 'growing') return s;
      return { ...s, trial: { ...t, clock: a.clock, day: currentDay(t, dayNumber()), planted: a.clock === 'daily' ? dayNumber() - currentDay(t, dayNumber()) + 1 : t.planted } };
    }
    case 'trialHarvest': {
      const t = s.trial;
      if (!t || t.phase !== 'growing' || currentDay(t, dayNumber()) <= CHECK_DAYS) return s;
      const results = t.plans.map((_, i) => harvestFarm(t, i));
      const income = results.reduce((n, r) => n + r.income, 0);
      const why = explain(t, results);
      const summary: TrialSummary = { cycle: t.cycle, farms: t.plans.length, best: why.best, bags: results.map(r => r.bags), profit: results.map(r => r.profit) };
      return {
        ...s,
        coins: s.coins + income,
        points: s.points + 50 * t.plans.length,
        trial: { ...t, phase: 'done', results },
        trialHistory: [...s.trialHistory, summary],
        ...gainXp(s, 0.4),
        toast: toast(`Harvest sold for ${fmt(income)} coins · +${50 * t.plans.length} points`),
      };
    }
    case 'view':
      // switched from Settings: stay in Settings
      return { ...s, view: a.view, modal: s.modal?.kind === 'settings' ? s.modal : null };
    case 'carry':
      return s.field.carry === a.item ? s : { ...s, field: { ...s.field, carry: a.item } };
    case 'fieldHire': {
      const t = s.trial;
      if (!t) return s;
      const f = s.field.cycle === t.cycle ? s.field : emptyField(t.cycle);
      return { ...s, field: { ...f, hired: true } };
    }
    case 'fieldMark': {
      if (!s.trial || s.trial.phase !== 'growing') return s;
      const t0 = s.trial;
      const f = s.field.cycle === t0.cycle ? s.field : emptyField(t0.cycle);
      const key = `${a.farm}:${a.job}`;
      const before = f.marks[key] ?? 0;
      // the tractor works one plot at a time, and only a plot its type and tool may work (each one plot per farm)
      let t = s.trial;
      let fuel = 0;
      let bits = a.bits;
      if (a.rig) {
        const plot = plotsIn(bits)[0];
        if (plot === undefined) return s;
        bits &= plotMask(plot);
        const rows = plotsOf(t, a.farm);
        if (tractorBlock(rows, plot, a.rig.tractor, a.rig.tool)) return s;
        const here = rows[plot];
        if (!here.tractor || !here.tools?.[a.rig.job]) {
          fuel = Math.min(s.coins, TRACTOR_PLOT[a.rig.tractor].fuel);
          let next = rows.map((r, i) => (i === plot ? { ...r, tractor: a.rig!.tractor, tools: { ...(r.tools ?? {}), [a.rig!.job]: a.rig!.tool } } : r));
          if (a.rig.job === 'spray' && here.sprayer !== 'boom') next = setPlotInput(next, 'sprayer', plot, 'boom');
          const plots = t.plans.map((_, i) => (i === a.farm ? next : plotsOf(t!, i)));
          const spent = t.plans.map((_, i) => (t!.fuel?.[i] ?? 0) + (i === a.farm ? fuel : 0));
          t = { ...t, plots, fuel: spent };
        }
      }
      const after = before | bits;
      if (after === before) return s;
      // what the tractor claimed is saved, and its fuel paid, along with the work
      const s1: GameState = t === s.trial ? s : { ...s, trial: t, coins: s.coins - fuel };
      let marked: Field = { ...f, marks: { ...f.marks, [key]: after } };
      // extra points for using a tractor: a big job (plough, plant, fertilize, harvest) finished mostly from the seat
      let bonus = 0;
      if (a.tractor && a.rig) {
        // the tractor's plot finished from the seat: bonus points, once per plot and job
        const plot = plotsIn(bits)[0];
        const pm = plotMask(plot);
        const seat = (f.byTractor?.[key] ?? 0) | bits;
        const bk = `${key}:${plot}`;
        marked = { ...marked, byTractor: { ...(f.byTractor ?? {}), [key]: seat } };
        if ((after & pm) === pm && (seat & pm) === pm && !(f.bonus ?? []).includes(bk)) {
          bonus = TRACTOR_BONUS.perPlot;
          marked = { ...marked, bonus: [...(f.bonus ?? []), bk] };
        }
      }
      // put down what is carried once no job left today needs it
      const putDown = (tr: Trial) => (carryNeeded(marked, tr, currentDay(tr, dayNumber())) ? marked : { ...marked, carry: null });
      let field = putDown(t);
      // a treatment done by hand counts (and is paid for) once its last tile is done
      if (/^t\d$/.test(a.job)) {
        const day = Number(a.job.slice(1));
        const pending = treatLeft(f, t, a.farm, day);
        if (pending && (after & pending.need) === pending.need) {
          const cost = treatCost(pending.hazard);
          if (s1.coins < cost) return { ...s1, field: marked, toast: toast(`You need ${cost} coins to treat ${farmName(a.farm)}`) };
          const ck = checkKey(a.farm, day);
          // the care that has to be done again a day or two later (only inside the six check days)
          const fu = FOLLOW_UP[pending.hazard];
          const due = fu && day + fu.afterDays <= CHECK_DAYS ? day + fu.afterDays : 0;
          const followUps = (t.followUps ?? []).filter(u => !(u.farm === a.farm && u.day === due));
          if (fu && due) followUps.push({ farm: a.farm, day: due, job: fu.job, hazard: pending.hazard, done: false });
          const trial: Trial = {
            ...t,
            checks: { ...t.checks, [ck]: { ...t.checks[ck], treated: true } },
            treatments: t.treatments.map((n, i) => (i === a.farm ? n + cost : n)),
            ...(fu && due ? { followUps } : {}),
          };
          field = putDown(trial);
          return {
            ...s1,
            field,
            coins: s1.coins - cost,
            trial,
            ...gainXp(s1, 0.03),
            toast: toast(`${farmName(a.farm)} treated · −${cost} coins · most of the damage stopped${due ? ` · come back on day ${due}` : ''}`),
          };
        }
      }
      // follow-up care counts once its last tile is done
      if (/^f\d$/.test(a.job)) {
        const day = Number(a.job.slice(1));
        const pending = followUpLeft(f, t, a.farm, day);
        if (pending && (after & pending.need) === pending.need) {
          const trial: Trial = { ...t, followUps: (t.followUps ?? []).map(u => (u === pending.follow ? { ...u, done: true } : u)) };
          field = putDown(trial);
          return { ...s1, field, trial, ...gainXp(s1, 0.03), toast: toast(`${farmName(a.farm)}: follow-up done · the problem stays away`) };
        }
      }
      if (bonus) return { ...s1, field, points: s1.points + bonus, ...gainXp(s1, 0.02), toast: toast(`Tractor bonus · +${bonus} points · ${farmName(a.farm)} ${plotName(plotsIn(bits)[0])} done from the seat${fuel ? ` · −${fuel} coins of fuel` : ''}`) };
      if (fuel && a.rig) {
        const plot = plotsIn(bits)[0];
        return { ...s1, field, toast: toast(`${farmName(a.farm)} ${plotName(plot)} is the ${a.rig.tractor} tractor's plot now · −${fuel} coins of fuel`) };
      }
      return { ...s1, field };
    }
    case 'plotSet': {
      const t = s.trial;
      if (!t || t.phase === 'done') return s;
      const rows = plotsOf(t, a.farm);
      const next = setPlotInput(rows, a.kind, a.plot, a.value);
      if (rows[a.plot][a.kind] === next[a.plot][a.kind]) return s;
      // a plot already sown, spread or sprayed keeps what it has
      if (t.phase === 'growing') {
        const f = s.field.cycle === t.cycle ? s.field : emptyField(t.cycle);
        const moved = next.map((r, i) => (r[a.kind] !== rows[i][a.kind] ? i : -1)).filter(i => i >= 0);
        const stuck = moved.find(i => plotLocked(f, t, a.farm, i, a.kind));
        if (stuck !== undefined) return { ...s, toast: toast(`${farmName(a.farm)} ${plotName(stuck)} is already ${plotLocked(f, t, a.farm, stuck, a.kind)!.toLowerCase()}: it keeps its ${a.kind === 'fert' ? 'fertilizer' : a.kind}`) };
      }
      const plots = t.plans.map((_, i) => (i === a.farm ? next : plotsOf(t, i)));
      // once the farms are paid for, a change of seed or fertilizer is paid (or refunded) at once
      const delta = t.phase === 'growing' && a.kind !== 'sprayer' ? next.reduce((n, r, i) => n + plotCost(a.kind, r[a.kind] as string) - plotCost(a.kind, rows[i][a.kind] as string), 0) : 0;
      if (delta > s.coins) return { ...s, toast: toast(`That costs ${delta} coins more and you have ${s.coins}`) };
      return { ...s, coins: s.coins - delta, trial: { ...t, plots } };
    }
    case 'prescribe': {
      const t = s.trial;
      if (!t || t.phase !== 'growing') return s;
      const ck = checkKey(a.farm, a.day);
      const rec = t.checks[ck];
      if (!rec?.right || rec.fix) return s;
      if (a.right) return { ...s, trial: { ...t, checks: { ...t.checks, [ck]: { ...rec, fix: a.pick } } }, ...gainXp(s, 0.02) };
      // a wrong fix: the money is spent and the problem stays (what the player has, if less)
      const cost = Math.min(s.coins, WRONG_FIX_COST[hazardFor(t, a.farm, a.day)] ?? 0);
      return {
        ...s,
        coins: s.coins - cost,
        trial: { ...t, checks: { ...t.checks, [ck]: { ...rec, wrongFixes: (rec.wrongFixes ?? 0) + 1 } }, treatments: t.treatments.map((n, i) => (i === a.farm ? n + cost : n)) },
      };
    }
    case 'followUpMissed': {
      const t = s.trial;
      if (!t?.followUps) return s;
      const followUps = t.followUps.map(u => (a.keys.includes(`${u.farm}:${u.day}`) ? { ...u, missed: true } : u));
      return { ...s, trial: { ...t, followUps } };
    }
    case 'tractorDone': {
      const t = s.trial;
      if (!t) return s;
      const before = t.tractor?.[a.farm];
      const best = {
        stars: Math.max(before?.stars ?? 0, a.stars),
        score: Math.max(before?.score ?? 0, a.score),
        Q: Math.max(before?.Q ?? 0, a.Q),
        tries: (before?.tries ?? 0) + 1,
      };
      return {
        ...s,
        coins: s.coins + a.coins,
        points: s.points + a.points,
        trial: { ...t, tractor: { ...(t.tractor ?? {}), [a.farm]: best } },
        ...gainXp(s, 0.05 + 0.05 * a.stars),
      };
    }
    case 'trialRecipe': {
      const t = s.trial;
      if (!t) return s;
      return { ...s, recipe: t.plans[a.farm], toast: toast(`${farmName(a.farm)}'s plan is your recipe: the next cycle starts from it`) };
    }
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
const TRANSIENT: (keyof GameState)[] = ['fromMenu', 'navSeq', 'rideReq', 'modal', 'plotSelected', 'toast', 'roundsOpen', 'roundsView', 'roundsDemo', 'worldDemo', 'trialsOpen', 'roundsTrial'];

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
    const saved = JSON.parse(raw);
    // Saves from before the farm had one owner may carry a reminder about neighbours.
    if (typeof saved.note === 'string' && /Achieng|neighbour/i.test(saved.note)) saved.note = 'Check every bed on your farm often: open Rounds on the farm.';
    return { ...initialState, ...saved, fromMenu: false, navSeq: 0, rideReq: 0, modal: null, plotSelected: false, toast: null, roundsOpen: false, roundsView: null, roundsDemo: null, worldDemo: null, trialsOpen: false, roundsTrial: false, rounds: { ...initialState.rounds, ...(saved.rounds ?? {}) }, settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) }, climate: { ...initialClimate, ...(saved.climate ?? {}) } };
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

function save(state: GameState) {
  try {
    const copy: Partial<GameState> = { ...state };
    TRANSIENT.forEach(k => delete copy[k]);
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
  } catch {
    /* private mode or storage blocked: play continues without saving */
  }
}

/** The game's state, saved to the phone. Saving waits for a short pause (the farm world changes the state many times a
    second while the farmer works), and happens at once when the game is hidden or closed. */
export function useGame() {
  const [state, dispatch] = useReducer(reducer, undefined, load);
  const latest = useRef(state);
  // the state as last saved (or loaded): only a change is written
  const saved = useRef(state);
  const timer = useRef<number | undefined>(undefined);
  latest.current = state;
  const flush = () => {
    window.clearTimeout(timer.current);
    if (latest.current === saved.current) return;
    saved.current = latest.current;
    save(latest.current);
  };
  useEffect(() => {
    if (reviewing() || state === saved.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, SAVE_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  useEffect(() => {
    if (reviewing()) return;
    const now = flush;
    const hidden = () => document.visibilityState === 'hidden' && now();
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', now);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', now);
      now();
    };
  }, []);
  return [state, dispatch] as const;
}

/** How long saving waits for the state to settle. */
const SAVE_DELAY_MS = 600;
