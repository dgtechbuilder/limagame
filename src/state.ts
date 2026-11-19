import { farmSignal } from './business/signal';
import { idBlock, lockBlock } from './unlock/model';
import { evidenceReduce, trackEvidence, type EvidenceAction, type EvidenceState } from './evidence/model';
import { WATER, coverPlanOf, waterBuyOf, waterBuyPrice, type DrawPolicy, type WaterBuyId } from './water/config';
import { capacityOf, coverQuote, tankOf } from './water/model';
import { treatmentOf } from './care/treatments';
import type { TankState } from './water/model';
import type { Ledger } from './credits/ledger';
import { trackWater } from './water/track';
import { DIMENSIONS, ROWS_PER_FARM } from './strategy/data';
import { riskReduce, type RiskAction, type RiskState } from './risk/model';
import { LIFE, type CareId, type CoopId, type Group, type IssueId, type PreventId, type ShedId } from './livestock/config';
import { buildCoop, buildShed, doCare, doPrevent, fixIssue, lifeOf, type LifeEvent, type LifeState } from './livestock/model';
import { trackWallet, type WalletState } from './wallet/model';
import { POWER, partOptionOf, stepOf, type LoadId, type StepId as PowerStepId } from './power/config';
import { fuelTankL, loadsAvailable, powerOf, stepBlock, type PowerState } from './power/model';
import { HUB, hubOf, levelOf as hubLevel, lessonOf, type HubSection, type HubState } from './tractor/hub';
import { sell as sellProduce, stock, type ProduceId, type ProduceState } from './produce/model';
import { GARDEN, GARDEN_NAMES, cropOf as gardenCrop, gardenOf, harvestKg, type GardenCropId, type GardenState } from './garden/model';
import { trackSystems, coldRoom, repairCut } from './systems/track';
import { trackLife } from './livestock/track';
import { MEASURES, measureOf, type MeasureId } from './security/config';
import { cropsTaken, harvestLessTheft, securityOf, storeTheftShare, type SecurityState } from './security/model';
import { useEffect, useReducer, useRef } from 'react';
import { FARMS, ROUND_POINTS, dayNumber } from './rounds/farms';
import {
  CHECK_DAYS,
  farmCost,
  COMMON_PLAN,
  DAMAGE,
  PRICE_BY_QUALITY,
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
  planOptionBlock,
  planOptionOpen,
  type Plan,
  type StepKey,
  type Trial,
  type TrialSummary,
} from './trials/model';
import { FOLLOW_UP } from './care/data';
import { FULL, ROUTINE_POINTS, carryNeeded, doneMask, emptyField, followUpLeft, plotLocked, routineLeft, treatCostFor, treatLeft, type Carry, type Field } from './world/field';
import { TRACTOR_BONUS, type ImplId } from './tractor/data';
import { rewardFor } from './tractor/sim';
import { OPTIONS, ROUTINE, TRACTOR_PLOT, plotCost, setPlotInput, toolName, tractorName, type PlotJob, type PlotKind, type TractorId } from './plots/data';
import { initialClimate, type ClimateState } from './climate/model';
import { settleDays, trackClimate } from './climate/track';
import { achClock, trackAchievements } from './achievements/track';
import { achOf, achOfSave, initialAch, streakReward, type AchState } from './achievements/model';
import { levelOf } from './progress/model';
import { brandOf, offerCode, type BrandId } from './partners/data';
import type { PartnerApplication } from './partners/catalogue';
import { routeTo } from './route';
import { DEFAULT_LOAN, type LoanAsk } from './finance/loan';
import { bookingRef, courseDate, courseOf, dayText, type TrainingBooking } from './training/data';
import type { SfxKind } from './sfx';
import { money } from './money';
import { clearPiece, tidyFor, TIDY_TOTAL, type TidyState } from './tidy/model';
import { JOBS_MAX, onFarm, treatJob, type Job, type JobSpec } from './onsite/model';
import { PAYG, SHOP, activitiesDone, bizOf, contractDay, demoSlots, farmerAccepts, graduation, hireOutDay, offersFor, partnerBlock, partnerOf, planDay, requestsFor, runDay, scanFarm, shopBlock, type Biz, type Bookings, type Crop, type Drives, type FleetItem, type PartnerId } from './business/model';
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
  itemsFor,
  shopIndex,
  type HarvestChoice,
  type ShopTab,
  type StepId,
} from './data';

export type Modal =
  | { kind: 'menu' }
  | { kind: 'climate'; tab?: ClimateTab }
  | { kind: 'achievements'; tab?: AchTab }
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
  | { kind: 'info' }
  /** the loan calculator, and the quote it gives */
  | { kind: 'loan'; view?: 'calc' | 'quote' }
  /** farmer training: book a seat on a course */
  | { kind: 'training' }
  /** partners: their offers, and (for partners) every place in the game a brand can appear; brand: the offer to show */
  | { kind: 'partners'; tab?: PartnersTab; brand?: BrandId }
  /** the cows and the hens: today's care, their health, water, the coop, the herd (src/livestock) */
  | { kind: 'animals'; tab?: AnimalsTab }
  /** keeping the farm safe from theft: what protects it, tonight's risks, the night reports (src/security) */
  | { kind: 'security'; tab?: SecurityTab }
  /** the farmer's wallet: every payment in and out (src/wallet) */
  | { kind: 'wallet'; tab?: WalletTab }
  /** the power system: building it over the first 7 days, today's energy, what it does for the farm (src/power) */
  | { kind: 'power'; tab?: PowerTab }
  /** the market stall: up to 25 kg of the store sold a day (src/produce) */
  | { kind: 'market' }
  /** Farm 7 or Farm 8, the new farms (src/garden): farm 0 or 1 */
  | { kind: 'garden'; farm: number }
  /** the tractor game: plough the mini farm in 30 seconds, round rocks, trees and holes (src/minifarm) */
  | { kind: 'tractorGame' };

/** The dialog after something worked: a sale, a training booked, a storage upgrade. It replaces the short message
    at the top of the screen for these, so the player cannot miss it (components/Success.tsx, screens/Success.tsx). */
export type Success =
  | {
      kind: 'sale';
      id: number;
      /** the shop's Sell Food, or the season's harvest */
      from: 'shop' | 'season';
      item: string;
      /** the shop item sold (Sell another sells one more of it) */
      itemId?: string;
      qty: number;
      price: number;
      earned: number;
      points: number;
      /** bags of it left in the shop */
      left?: number;
      /** the season's sale: where it sold, bags lost in store, the process, the costs taken off */
      at?: 'gate' | 'market';
      lost?: number;
      process?: string | null;
      costs?: number;
      quality?: number;
    }
  | { kind: 'training'; id: number; course: string; date: string; ref: string; price: number }
  | { kind: 'storage'; id: number; from: string; to: string; saved: number; extra: number }
  /** the morning after a night with news: thefts, predators, deaths, a new problem with the animals */
  | { kind: 'night'; id: number; nights: number; day: number; events: LifeEvent[] }
  /** day 2: the animals come into the player's care, and the farm's safety is theirs to look after */
  | { kind: 'day2'; id: number }
  /** a morning with something new to build or open (the cow shed on day 3, the new farms on day 4, a power part) */
  | { kind: 'morning'; id: number; day: number; lines: { icon: string; title: string; text: string; go: Modal }[] };

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
  /** the happy sound effects when an action or a flow is completed (src/sfx.ts) */
  sound: boolean;
  /** the dialog after an upgrade (better storage): it can be turned off in the dialog or in Settings */
  upgradeNotes: boolean;
  /** the player's country (ISO code, picked when the farmer is made): money is shown in its currency; "" is US dollars */
  country: string;
  /** night mode on the 3D farm: follow the phone's clock (night from 7 pm to 6 am), or always day, or always night */
  night?: 'auto' | 'day' | 'night';
}
export type SettingsTab = 'farmer' | 'game' | 'display' | 'help';
export type ClimateTab = 'overview' | 'land' | 'areas' | 'emissions' | 'water' | 'tank' | 'credits' | 'shocks' | 'activity';
/** My Progress (the achievements page): the journey of certification levels, the modules, today, badges, certificates */
export type AchTab = 'journey' | 'modules' | 'today' | 'badges' | 'certificates';
export type PartnersTab = 'offers' | 'placements' | 'join' | 'shortlist';
export type AnimalsTab = 'today' | 'health' | 'water' | 'coop' | 'shed' | 'herd';
export type SecurityTab = 'protect' | 'risk' | 'reports';
export type WalletTab = 'history' | 'climate' | 'summary';
export type PowerTab = 'build' | 'today' | 'impact' | 'history';
export const DEFAULT_SETTINGS: Settings = { art: 'anime', graphics: 'auto', reduceMotion: false, voice: false, sound: true, upgradeNotes: true, country: '', night: 'auto' };

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
export type FsPhase = 'create' | 'story' | 'walk1' | 'update' | 'review1' | 'walkRetry' | 'retry' | 'walk2' | 'review2' | 'done';

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
  /** the sound effect the last action earned (App plays it once): a completed action, or a completed flow */
  sfx: { id: number; kind: SfxKind } | null;
  /** climate tracking: emissions, carbon stored, water, pollution, soil, credits (src/climate/model.ts) */
  climate: ClimateState;
  /** achievements: badges won, the daily streak, certificates (src/achievements/model.ts); missing in older saves */
  ach?: AchState;
  /** the pop-up announcing a badge, a certificate or a new day of the streak (not saved) */
  award: { id: number; title: string; line: string } | null;
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
  /** the tractor business (business/model.ts); missing in saves from before it */
  biz?: Biz;
  bizOpen: boolean;
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
  /** page: the story page shown (0–2) while phase is 'story' */
  fs: { phase: FsPhase; at: 'first' | 'lower'; opened: boolean; page?: number };
  /** reminder shown in Messages, e.g. the bean shamba to check tomorrow */
  note: string | null;
  // UI
  modal: Modal | null;
  plotSelected: boolean;
  toast: { id: number; text: string } | null;
  /** the dialog after something worked (not saved) */
  success: Success | null;
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
  /** the loan calculator's last amounts (missing in older saves) */
  loan?: LoanAsk;
  /** training courses booked (missing in older saves) */
  trainings?: TrainingBooking[];
  /** partner offers the player saved (src/partners/data.ts; missing in older saves) */
  offers?: BrandId[];
  /** Partners › Partner with us: the ways a partner tapped Interested on (src/partners/catalogue.ts; missing in older saves) */
  partnerPicks?: string[];
  /** Partners › Open to partner: the applications sent from this device (missing in older saves) */
  partnerApps?: PartnerApplication[];
  /** money at risk: the button as last seen, and every problem dealt with (src/risk/model.ts; missing in older saves) */
  risk?: RiskState;
  /** water: the tank, the animals, the shared catchment, crop cover (src/water; missing in older saves) */
  tank?: Partial<TankState>;
  /** every kind of credit earned and paid (src/credits/ledger.ts; missing in older saves) */
  ledger?: Ledger;
  /** the evidence layer: decisions, cohort tags, "tried it on your farm?" answers (src/evidence; missing in older saves) */
  evidence?: Partial<EvidenceState>;
  /** the daily tidy-up: today's bushes and rocks cleared, and the tidy streak (src/tidy/model.ts; missing in older saves) */
  tidy?: TidyState;
  /** jobs waiting to be done by hand on the 3D farm: walk to each spot and work there (src/onsite; missing in older saves) */
  jobs?: Job[];
  collectedDay: Record<string, string>; // milk/eggs → date last collected
  /** the cows and the hens: care, health, problems, the coop (src/livestock) */
  life?: Partial<LifeState>;
  /** theft: the measures in place, what was taken, the night reports (src/security) */
  security?: Partial<SecurityState>;
  /** every payment in and out of the farmer's money (src/wallet; missing in older saves) */
  wallet?: Partial<WalletState>;
  /** the power system (src/power) */
  power?: Partial<PowerState>;
  /** the farm's own tractor: training, condition, diesel (src/tractor/hub.ts) */
  hub?: Partial<HubState>;
  /** the store of produce and the market stall (src/produce) */
  produce?: Partial<ProduceState>;
  /** Farm 7 and Farm 8, the new farms (src/garden) */
  garden?: Partial<GardenState>;
  /** the seed, fertilizer and sprayer last chosen at the shed: new farms start with them */
  prefs?: Partial<Record<PlotKind, string>>;
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
  ach: initialAch,
  award: null,
  view: 'world',
  fromMenu: false,
  navSeq: 0,
  rideReq: 0,
  field: emptyField(),
  trial: null,
  trialHistory: [],
  recipe: null,
  trialsOpen: false,
  bizOpen: false,
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
  success: null,
  sfx: null,
  onboarded: false,
  // enough for the first planting of two 4-acre farms (src/farmSize.ts), and a margin
  coins: 30000,
  water: 20,
  level: 1,
  xp: 0.1,
  points: 0,
  playSeconds: 0,
  stock: initialStock,
  inventory: [],
  redeemed: [],
  loan: DEFAULT_LOAN,
  trainings: [],
  offers: [],
  partnerPicks: [],
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

/** Where the harvest sells: at the gate when the gate pays more a bag than the market after its costs. */
export const sellAt = (p: Prices): 'gate' | 'market' => (p.farmgate > profitPerBag(p) ? 'gate' : 'market');
/** Coins a bag of top-grade grain fetches where it sells (the better of the gate and the market after costs). */
export const basePerBag = (p: Prices) => Math.max(0, sellAt(p) === 'gate' ? p.farmgate : profitPerBag(p));

/** The price a grade fetches against top grade (5 stars), as on the six farms (trials/model.ts PRICE_BY_QUALITY). */
export const qualityPrice = (quality: number) => PRICE_BY_QUALITY[Math.max(1, Math.min(5, Math.round(quality)))] / PRICE_BY_QUALITY[5];

export function saleQuote(s: GameState, processId: string | null) {
  const storage = STORAGE_OPTIONS.find(o => o.id === s.storage)!;
  const harvestCare = s.stepScores.harvest ?? stepScore(s, 'harvest');
  const loss = storage.loss * (1 - 0.5 * harvestCare); // good handling halves losses
  const bags = s.harvested?.bags ?? 0;
  // thieves take a share of the maize while it waits in store (src/security): less in a guarded warehouse
  const stolen = Math.round(bags * storeTheftShare(s));
  const bagsSold = Math.max(0, Math.round(bags * (1 - loss)) - stolen);
  const process = processId ? PROCESSES.find(p => p.id === processId)! : null;
  // the grade sets the price: a lower grade fetches less a bag
  const price = basePerBag(s.prices) * qualityPrice(s.harvested?.quality ?? 5) * (1 + (process ? process.profitIncrease / 100 : 0));
  // storage is paid on every bag put in store, the ones that spoil there too
  const costs = bags * storage.costPerBag + (process ? process.cost : 0);
  const gross = bagsSold * price;
  const revenue = Math.max(0, Math.round(gross - costs));
  return { bagsSold, lost: bags - bagsSold - stolen, stolen, price, costs, gross: Math.round(gross), revenue, at: sellAt(s.prices) };
}

/** What a shop item cost (one unit), or 0. */
const shopPrice = (id: string) => SHOP_TABS.flatMap(t => t.items).find(i => i.id === id)?.price ?? 0;
/** Shop items that are kept for good (equipment): one of each is enough. Tanks add up; fertilizer is used up. */
const KEEPS = new Set(SHOP_TABS.find(t => t.id === 'equipment')!.items.map(i => i.id));

export const daysToHarvest = (s: GameState) =>
  STEPS.slice(s.stage, stepIndex('harvest')).reduce((d, st) => d + STEP_META[st.id].days, 0);

export const today = () => new Date().toISOString().slice(0, 10);

/* ------------------------------------------------------------------ */
/* Reducer                                                              */
/* ------------------------------------------------------------------ */

export type Action =
  | { type: 'open'; modal: Modal }
  | { type: 'close' }
  /** the clock's check (on opening the game, coming back to it, and every minute): a day that has ended is paid */
  | { type: 'climateTick' }
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
  /** close the dialog after something worked */
  | { type: 'dismissSuccess' }
  /** the loan calculator's amounts */
  | { type: 'loanAsk'; ask: Partial<LoanAsk> }
  /** book a seat on a training course */
  | { type: 'bookTraining'; id: string }
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
      /** the tractor type and tool that did them */
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
  /** farm world: a before-planting tractor drive finished (its coins and points are worked out here, from the score
      and the farm's best: tractor/sim.ts rewardFor; the screen's own figures are only what it showed) */
  | { type: 'tractorDone'; farm: number; score: number; stars: number; Q: number; coins?: number; points?: number; diesel?: number; co2?: number; clim?: number }
  | { type: 'fs'; phase: FsPhase; at?: 'first' | 'lower'; opened?: boolean; note?: string; page?: number }
  /** the tractor business: open or close it; run a day (the plan is worked out again here); hire the tractor out
      for a day; sign a partner; buy for the fleet */
  | { type: 'biz'; open: boolean }
  | { type: 'bizRun'; bookings: Bookings; route: string[]; drives?: Drives }
  | { type: 'bizHireOut' }
  | { type: 'bizPartner'; id: PartnerId }
  | { type: 'bizBuy'; item: FleetItem }
  /** deliver Campbell's advice to a farm (the farmer's answer is worked out here); ask the Hub Manager for a demo
      plot; sign the PAYG agreement; take a marketplace contract for the day; Sasha's welcome read */
  | { type: 'bizAdvise'; client: string }
  | { type: 'bizDemo'; crop: Crop }
  | { type: 'bizGraduate' }
  | { type: 'bizContract'; id: string; bookings: Bookings }
  | { type: 'bizIntro' }
  /** achievements: claim a badge's reward, every reward waiting, or today's reward for coming back */
  | { type: 'achClaim'; id: string }
  | { type: 'achClaimAll' }
  | { type: 'achDaily' }
  /** the farm opened on a new day (or a new day started while it was open): today's bushes and rocks turn up */
  | { type: 'tidyDay' }
  /** one of today's bushes or rocks cleared in the farm world */
  | { type: 'tidyClear'; id: string }
  /** My Progress: claim a certification level's reward */
  | { type: 'levelClaim'; id: string }
  /** partners: get a brand's offer (its code is kept in Messages) */
  | { type: 'partnerSave'; id: BrandId }
  /** Partners › Partner with us: tap Interested on a way to partner, or tap again to take it off the shortlist */
  | { type: 'partnerPick'; id: string }
  /** Partners › Open to partner: a partner sends the application form */
  | { type: 'partnerApply'; app: PartnerApplication }
  /** go to a web address (src/route.ts): the screen it names, if the player may go there now */
  | { type: 'route'; path: string }
  | RiskAction
  | EvidenceAction
  /** how a treatment is done (care/treatments.ts) */
  | { type: 'treatChoose'; farm: number; day: number; id: string }
  /** water (src/water): buy piped water or a bowser; change the herd; how the farm draws on the shared dam; crop cover */
  | { type: 'waterBuy'; kind: WaterBuyId }
  | { type: 'herdSet'; cows: number; hens: number }
  | { type: 'drawPolicy'; policy: DrawPolicy }
  | { type: 'coverBuy'; plan?: string }
  /** a row's strategy (src/strategy): one option on one dimension; row -1 sets every row of the farm */
  | { type: 'strategySet'; farm: number; row: number; dim: string; option: string }
  /** the animals (src/livestock): a day's job, a fix for a problem, a prevention, the coop, buying or selling */
  | { type: 'animalCare'; id: CareId }
  | { type: 'animalFix'; issue: IssueId; fix: string }
  | { type: 'animalPrevent'; id: PreventId }
  | { type: 'coopBuild'; id: CoopId }
  | { type: 'herdBuy'; group: Group; n: number }
  /** theft (src/security): buy a measure; switch a nightly one (the watchman) on or off */
  | { type: 'securityBuy'; id: MeasureId }
  | { type: 'securityHire'; id: MeasureId; on: boolean }
  /** the cow shed (from day 3) */
  | { type: 'shedBuild'; id: ShedId }
  /** the power system: a part put in (score: how its mini-game went), a load switched, diesel bought */
  | { type: 'powerInstall'; id: PowerStepId; score: number; loads?: LoadId[]; option?: string }
  | { type: 'powerLoad'; id: LoadId; on: boolean }
  | { type: 'powerFuel'; litres: number }
  /** the tractor screen: a section's mini-game done (score 0 to 1) */
  | { type: 'tractorHub'; section: HubSection; score: number; id?: string; litres?: number; label?: string }
  /** the market stall: kg of each produce to sell */
  | { type: 'produceSell'; items: Partial<Record<ProduceId, number>> }
  /** the new farms: plant (score: the planting mini-game), water, harvest */
  | { type: 'gardenPlant'; farm: number; crop: GardenCropId; score: number }
  | { type: 'gardenWater'; farm: number }
  | { type: 'gardenHarvest'; farm: number; score: number }
  /** at the shed: a seed, fertilizer or sprayer chosen for every farm that can still take it, then picked up */
  | { type: 'shedChoose'; kind: PlotKind; id: string }
  /** on the 3D farm: a page's action waits for the walk and the work by hand (src/onsite) */
  | { type: 'jobAdd'; job: JobSpec }
  | { type: 'jobStep'; id: number }
  | { type: 'jobDone'; id: number }
  | { type: 'jobDrop'; id: number }

/** A morning's news waits for the screen on top to close (it is shown on the farm): opening or closing a screen keeps it. */
export const MORNING_KINDS: Success['kind'][] = ['night', 'day2', 'morning'];
const morning = (x: Success | null) => (x && MORNING_KINDS.includes(x.kind) ? x : null);

let toastId = 0;
let successId = 0;
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
/** What changing a herd from one count to another costs: a full price each animal bought, a share back each one sold. */
const herdCost = (from: number, to: number, price: number) => (to > from ? (to - from) * price : -Math.round((from - to) * price * LIFE.price.sellShare));
/** A message's first letter lowered, so names and units like KSh keep their capitals. */
const lowerFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);

/** Every action, then the climate it changed (src/climate/track.ts), then the sound it earned. */
export function reducer(s: GameState, a: Action): GameState {
  const next = play(s, a);
  if (next === s) return s;
  const kind = soundOf(s, next, a);
  // an action that finished something counts today as a day played (the streak)
  const tracked = trackWallet(s, trackSystems(s, trackEvidence(s, trackAchievements(s, trackLife(s, trackWater(s, trackClimate(s, next, a), a), a), a, kind !== null), a), a), a);
  return kind ? { ...tracked, sfx: { id: ++sfxId, kind } } : tracked;
}

let sfxId = 0;
/** Flows: finishing one of these ends a whole piece of play. */
const FLOWS = new Set<Action['type']>(['achClaimAll', 'completeSale', 'trialHarvest', 'bizRun', 'bizHireOut', 'bizContract', 'bizGraduate', 'tractorDone']);
/** Actions: finishing one of these is one thing done. Some only count when they earned something (their message). */
const ACTIONS = new Set<Action['type']>(['achClaim', 'achDaily', 'levelClaim', 'partnerSave', 'buy', 'sell', 'bookTraining', 'task', 'finishStep', 'water', 'harvest', 'redeem', 'collect', 'newSeason', 'trialNew', 'trialPlant', 'trialNextDay', 'trialRecipe', 'plotSet', 'bizPartner', 'bizBuy', 'bizDemo', 'tidyClear', 'animalCare', 'animalPrevent', 'coopBuild', 'shedBuild', 'herdBuy', 'securityBuy', 'powerInstall', 'powerFuel', 'tractorHub', 'produceSell', 'gardenPlant', 'gardenWater', 'gardenHarvest', 'shedChoose']);
const EARNED = new Set<Action['type']>(['roundResult', 'trialCheck', 'fieldMark']);
const FS_ORDER: FsPhase[] = ['create', 'story', 'walk1', 'update', 'review1', 'walkRetry', 'retry', 'walk2', 'review2', 'done'];

/** The sound an action earned: none for a refusal (only a message changes) or a step back. */
function soundOf(s: GameState, next: GameState, a: Action): SfxKind | null {
  const changed = (Object.keys(next) as (keyof GameState)[]).some(k => k !== 'toast' && k !== 'sfx' && k !== 'climate' && next[k] !== s[k]);
  if (!changed) return null;
  if (a.type === 'fs') {
    const from = FS_ORDER.indexOf(s.fs.phase);
    const to = FS_ORDER.indexOf(next.fs.phase);
    if (to <= from) return null;
    // the story told, and the first session done, are whole flows; every other step forward is an action
    return next.fs.phase === 'done' || s.fs.phase === 'story' ? 'flow' : 'action';
  }
  if (FLOWS.has(a.type)) return 'flow';
  // the last bush or rock of the day finishes the whole tidy-up
  if (a.type === 'tidyClear' && (next.tidy?.cleared.length ?? 0) === TIDY_TOTAL) return 'flow';
  if (ACTIONS.has(a.type)) return 'action';
  if (a.type === 'prescribe') return a.right ? 'action' : null;
  if (a.type === 'animalFix') return lifeOf(next.life).issues.length < lifeOf(s.life).issues.length ? 'action' : null;
  if (EARNED.has(a.type)) return next.toast && next.toast !== s.toast && !/^(You need|That costs)/.test(next.toast.text) ? 'action' : null;
  return null;
}

/** Something besides the message changed: the action worked. */
function changedState(s: GameState, next: GameState) {
  return (Object.keys(next) as (keyof GameState)[]).some(k => k !== 'toast' && k !== 'sfx' && next[k] !== s[k]);
}

let jobSeq = 0;
/** A job goes on the list, and the page closes so the farmer can walk to it. */
function addJob(s: GameState, spec: JobSpec): GameState {
  const id = Date.now() * 10 + (jobSeq++ % 10);
  return { ...s, jobs: [...(s.jobs ?? []), { ...spec, id, done: 0 }], modal: null, fromMenu: false, toast: toast(`${spec.title}: walk to ${spec.where}`) };
}

function play(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'climateTick':
      return settleDays(s, s);
    case 'open':
      // another section of the same screen (a Settings tab, a Shop tab) keeps where Back goes
      return { ...s, success: morning(s.success), modal: a.modal, fromMenu: s.modal?.kind === a.modal.kind ? s.fromMenu : s.modal?.kind === 'menu' && a.modal.kind !== 'menu', plotSelected: false };
    case 'close':
      // a screen opened from the main menu goes back to the menu
      return s.fromMenu && s.modal && s.modal.kind !== 'menu' ? { ...s, success: morning(s.success), modal: { kind: 'menu' }, fromMenu: false } : { ...s, success: morning(s.success), modal: null, fromMenu: false };
    case 'ride':
      return { ...s, success: null, modal: null, fromMenu: false, plotSelected: false, roundsOpen: false, roundsTrial: false, roundsView: null, roundsDemo: null, trialsOpen: false, bizOpen: false, worldDemo: null, navSeq: s.navSeq + 1, rideReq: s.rideReq + 1, toast: s.view === 'world' ? s.toast : toast('The tractor is on the 3D farm: switch the farm view in Settings') };
    case 'home':
      return { ...s, success: morning(s.success), modal: null, fromMenu: false, plotSelected: false, roundsOpen: false, roundsTrial: false, roundsView: null, roundsDemo: null, trialsOpen: false, bizOpen: false, worldDemo: null, navSeq: s.navSeq + 1 };
    case 'selectPlot':
      return { ...s, plotSelected: a.on };
    case 'onboarded':
      return { ...s, onboarded: true };
    case 'buy': {
      if (KEEPS.has(a.id) && s.inventory.includes(a.id)) return { ...s, toast: toast(`You already have a ${a.name.toLowerCase()}`) };
      const gate = lockBlock(s, shopIndex(a.id), a.name);
      if (gate) return { ...s, toast: toast(gate) };
      if (s.coins < a.price) return { ...s, toast: toast(`You need ${money(a.price)} for ${a.name}`) };
      return {
        ...s,
        coins: s.coins - a.price,
        inventory: [...s.inventory, a.id],
        ...gainXp(s, 0.03),
        toast: toast(`Bought ${a.name} for ${money(a.price)}`),
      };
    }
    case 'sell': {
      const left = s.stock[a.id] ?? 0;
      if (left <= 0) return { ...s, toast: toast(`No ${a.name} left to sell`) };
      // a second sale of the same food while the dialog is up adds to it
      const prev = s.success?.kind === 'sale' && s.success.from === 'shop' && s.success.itemId === a.id ? s.success : null;
      return {
        ...s,
        coins: s.coins + a.price,
        stock: { ...s.stock, [a.id]: left - 1 },
        ...gainXp(s, 0.03),
        success: {
          kind: 'sale',
          id: ++successId,
          from: 'shop',
          item: a.name,
          itemId: a.id,
          qty: (prev?.qty ?? 0) + 1,
          price: a.price,
          earned: (prev?.earned ?? 0) + a.price,
          points: 0,
          left: left - 1,
        },
      };
    }
    case 'task': {
      if (s.doneTasks.includes(a.id)) return s;
      if (stepIndex(a.step) !== s.stage) return { ...s, toast: toast(`Finish ${STEPS[Math.min(s.stage, 5)].label} first`) };
      const item = TASK_USES_ITEM[a.id];
      // the plain item, or a partner's branded product that does its job
      const have = item ? itemsFor(item).find(i => s.inventory.includes(i)) : undefined;
      const fromStock = have ? s.inventory.indexOf(have) : -1;
      const cost = fromStock >= 0 ? 0 : a.price;
      if (s.coins < cost) return { ...s, toast: toast(`You need ${money(cost)} for ${a.name}`) };
      const inventory = fromStock >= 0 ? s.inventory.filter((_, i) => i !== fromStock) : s.inventory;
      const tip = TASK_TIPS[a.id] ?? `${a.name} done`;
      // an item bought in the shop was paid for then: it still counts in this season's costs when it is used
      const spent = have ? shopPrice(have) : cost;
      return {
        ...s,
        coins: s.coins - cost,
        seasonSpend: s.seasonSpend + spent,
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
    case 'storage': {
      if (a.id === s.storage) return s;
      const from = STORAGE_OPTIONS.find(o => o.id === s.storage);
      const to = STORAGE_OPTIONS.find(o => o.id === a.id);
      if (!to) return s;
      const gate = idBlock(s, STORAGE_OPTIONS, a.id);
      if (gate) return { ...s, toast: toast(gate) };
      const next = { ...s, storage: a.id };
      // a move to storage that loses less is an upgrade: a dialog says what it changes, unless it was turned off
      if (!from || to.loss >= from.loss || s.settings.upgradeNotes === false || s.stage !== SELLING || !s.harvested) return next;
      const before = saleQuote(s, null);
      const after = saleQuote(next, null);
      return {
        ...next,
        success: { kind: 'storage', id: ++successId, from: from.id, to: to.id, saved: before.lost - after.lost, extra: after.costs - before.costs },
      };
    }
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
      // the season results open underneath: the sale dialog is read first, then closed onto them
      return {
        ...s,
        coins: s.coins + q.revenue,
        points: s.points + q.bagsSold * 5,
        stage: SOLD,
        history,
        farmView: history.length - 1,
        ...gainXp(s, 0.5),
        modal: { kind: 'outcome' },
        success: {
          kind: 'sale',
          id: ++successId,
          from: 'season',
          item: 'Maize',
          qty: q.bagsSold,
          price: q.price,
          earned: q.revenue,
          points: q.bagsSold * 5,
          at: q.at,
          lost: q.lost + q.stolen,
          process: a.processId,
          costs: q.costs,
          quality: s.harvested.quality,
        },
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
      if (s.collectedDay[a.id] === today()) return s;
      return {
        ...s,
        collectedDay: { ...s.collectedDay, [a.id]: today() },
        coins: s.coins + a.coins,
        ...gainXp(s, 0.03),
        toast: toast(a.text),
      };
    case 'toast':
      return { ...s, toast: toast(a.text) };
    case 'dismissSuccess':
      return s.success ? { ...s, success: null } : s;
    case 'loanAsk':
      return { ...s, loan: { ...(s.loan ?? DEFAULT_LOAN), ...a.ask } };
    case 'bookTraining': {
      const c = courseOf(a.id);
      if (!c) return s;
      const booked = s.trainings ?? [];
      if (booked.some(b => b.id === a.id)) return s;
      if (s.coins < c.price) return { ...s, toast: toast(`You need ${money(c.price)} for ${c.title}`) };
      const date = courseDate(c, today());
      const ref = bookingRef(c, date);
      return {
        ...s,
        coins: s.coins - c.price,
        trainings: [...booked, { id: c.id, date, ref }],
        ...gainXp(s, 0.05),
        note: `Training on ${dayText(date)}, ${c.time}: ${c.title} at ${c.place} · ref ${ref}`,
        success: { kind: 'training', id: ++successId, course: c.id, date, ref, price: c.price },
      };
    }
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
      const made = newTrial(s.trialHistory.length + 1, guided, s.recipe ?? COMMON_PLAN);
      // the seed, fertilizer and sprayer last chosen at the shed go on every farm
      const trial = s.prefs ? { ...made, plots: made.plots?.map(rows => rows.map(r => ({ ...r, ...s.prefs }) as typeof r)) } : made;
      if (!guided) return { ...s, trial };
      // the first planting period starts at once, with no plan to make: maize on Farm 1 (to clear, then plant) and
      // sukuma wiki on Farm 2 (cleared, ready to plant)
      const cost = Math.min(s.coins, trialCost(trial));
      return {
        ...s,
        coins: s.coins - cost,
        trial: { ...trial, phase: 'growing', clock: 'fast', planted: dayNumber(), day: 1 },
        field: emptyField(trial.cycle),
        toast: toast(`Your first planting: maize on Farm 1, sukuma wiki on Farm 2 · −${money(cost)}`),
      };
    }
    case 'trialPlan': {
      const t = s.trial;
      if (!t || t.phase !== 'plan' || (t.guided && a.farm === 0)) return s;
      const locked = planOptionBlock(s, a.key, a.value);
      if (locked) return { ...s, toast: toast(locked) };
      const plans = t.plans.map((p, i) => (i === a.farm ? setChoice(p, a.key, a.value) : p));
      return { ...s, trial: { ...t, plans } };
    }
    case 'trialSuggest': {
      const t = s.trial;
      if (!t || t.phase !== 'plan') return s;
      return { ...s, trial: { ...t, plans: suggestPlans(t.plans[0], t.plans.length, Math.floor(Math.random() * 7), (key, id) => planOptionOpen(s, key, id)) } };
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
        // scheduled care (weeding, the stalk-borer spray, the top-dress) from the second cycle, when the farms are worked
        // in the farm world: the six farms screen has no field work to do it with
        trial: { ...t, phase: 'growing', clock: a.clock, planted: dayNumber(), day: 1, ...(!t.guided && s.view === 'world' ? { routine: [] } : {}) },
        field: emptyField(t.cycle),
        ...gainXp(s, 0.1),
        toast: toast(s.view === 'world' ? `${t.plans.length} farm plans paid: ${money(cost)} · now get them planted` : `${t.plans.length} farms planted for ${money(cost)} · day 1: check every farm`),
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
      const dry = h === 'drought' && tankOf(s.tank).level < WATER.droughtTreat;
      const paid = !a.physical && fix > 0 && s.coins >= fix && !dry;
      const earned = a.right ? (a.tries === 1 ? ROUND_POINTS.first : ROUND_POINTS.second) : 0;
      const treatments = t.treatments.map((n, i) => (i === a.farm && paid ? n + fix : n));
      return {
        ...s,
        coins: s.coins - (paid ? fix : 0),
        points: s.points + earned,
        trial: { ...t, checks: { ...t.checks, [key]: { right: a.right, tries: a.tries, treated: paid } }, treatments },
        ...gainXp(s, a.right ? 0.06 : 0.01),
        toast: earned
          ? toast(`Read right · +${earned} points${paid ? ` · treated for ${money(fix)}` : dry && !a.physical ? ' · not watered: the tank is too low (buy water in Water)' : !a.physical && fix > 0 ? ` · not treated: it costs ${money(fix)} and you have ${money(s.coins)}` : ''}`)
          : s.toast,
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
      // thieves took a share of some farms' cobs from the field before the harvest (src/security)
      const theft = harvestLessTheft(t.plans.map((_, i) => harvestFarm(t, i)), cropsTaken(s, t.cycle));
      const results = theft.results;
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
        toast: toast(`Harvest sold for ${money(income)} · +${50 * t.plans.length} points${theft.bags ? ` · ${theft.bags} bags were stolen from the field (${money(theft.value)})` : ''}`),
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
      // the tractor's first work on a farm and job: its fuel is paid, and its type and tool are noted for the results
      let t = s.trial;
      let fuel = 0;
      const bits = a.bits;
      if (a.rig && bits & ~before) {
        const rows = plotsOf(t, a.farm);
        const here = rows[0];
        if (!here.tools?.[a.rig.job]) {
          fuel = Math.min(s.coins, TRACTOR_PLOT[a.rig.tractor].fuel);
          let next = rows.map((r, i) => (i === 0 ? { ...r, tractor: r.tractor ?? a.rig!.tractor, tools: { ...(r.tools ?? {}), [a.rig!.job]: a.rig!.tool } } : r));
          // spraying from the seat is the boom sprayer's work
          if ((a.rig.job === 'spray' || a.rig.job === 'borer') && here.sprayer !== 'boom') next = setPlotInput(next, 'sprayer', 0, 'boom');
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
      // extra points for using a tractor: a farm's job finished from the seat, once per farm and job
      let bonus = 0;
      if (a.tractor && a.rig) {
        // only plots this pass newly did count as done from the seat
        const seat = (f.byTractor?.[key] ?? 0) | (bits & ~before);
        marked = { ...marked, byTractor: { ...(f.byTractor ?? {}), [key]: seat } };
        if (after === FULL && seat === FULL && !(f.bonus ?? []).includes(key)) {
          bonus = TRACTOR_BONUS.perJob;
          marked = { ...marked, bonus: [...(f.bonus ?? []), key] };
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
          const cost = treatCostFor(t, a.farm, day, pending.hazard);
          // a drought watered by hand needs the water in the tank (src/water)
          if (pending.hazard === 'drought') {
            const need = treatmentOf('drought', t.checks[checkKey(a.farm, day)]?.treatment)?.water ?? WATER.droughtTreat;
            if (tankOf(s1.tank).level < need) return { ...s1, toast: toast(`The tank has ${fmt(Math.round(tankOf(s1.tank).level))} L: watering ${farmName(a.farm)} needs ${fmt(need)} L. Buy water in Water first.`) };
          }
          // not enough coins: the last of the work waits (marking it done would leave the treatment unpaid and undone for good)
          if (s1.coins < cost) return { ...s1, toast: toast(`You need ${money(cost)} to treat ${farmName(a.farm)}`) };
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
            toast: toast(`${farmName(a.farm)} treated · −${money(cost)} · damage stopped${due ? ` · come back on day ${due}` : ''}`),
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
      // scheduled care counts once its last plot is done
      const due = routineLeft(f, t, a.farm, currentDay(t, dayNumber())).find(r => r.key === a.job);
      if (due && (after & due.need) === due.need) {
        const trial: Trial = { ...t, routine: [...(t.routine ?? []), `${a.farm}:${due.job}`] };
        field = putDown(trial);
        const points = ROUTINE_POINTS + bonus;
        return { ...s1, field, trial, points: s1.points + points, ...gainXp(s1, 0.03), toast: toast(`${farmName(a.farm)} ${ROUTINE[due.job].done} · +${points} points`) };
      }
      if (bonus) return { ...s1, field, points: s1.points + bonus, ...gainXp(s1, 0.02), toast: toast(`Tractor bonus · +${bonus} points · ${farmName(a.farm)} done by tractor${fuel ? ` · −${money(fuel)} of fuel` : ''}`) };
      if (fuel && a.rig) return { ...s1, field, toast: toast(`${farmName(a.farm)}: the ${tractorName(a.rig.tractor).toLowerCase()} tractor's ${toolName(a.rig.tool).toLowerCase()} at work · −${money(fuel)} of fuel`) };
      return { ...s1, field };
    }
    case 'plotSet': {
      const t = s.trial;
      if (!t || t.phase === 'done') return s;
      const rows = plotsOf(t, a.farm);
      const gate = idBlock(s, OPTIONS[a.kind], a.value);
      if (gate && rows[a.plot]?.[a.kind] !== a.value) return { ...s, toast: toast(gate) };
      const next = setPlotInput(rows, a.kind, a.plot, a.value);
      if (rows[a.plot][a.kind] === next[a.plot][a.kind]) return s;
      // a plot already sown, spread or sprayed keeps what it has
      if (t.phase === 'growing') {
        const f = s.field.cycle === t.cycle ? s.field : emptyField(t.cycle);
        const moved = next.map((r, i) => (r[a.kind] !== rows[i][a.kind] ? i : -1)).filter(i => i >= 0);
        const stuck = moved.find(i => plotLocked(f, t, a.farm, i, a.kind));
        if (stuck !== undefined) return { ...s, toast: toast(`${farmName(a.farm)} is already ${plotLocked(f, t, a.farm, stuck, a.kind)!.toLowerCase()}: it keeps its ${a.kind === 'fert' ? 'fertilizer' : a.kind}`) };
      }
      const plots = t.plans.map((_, i) => (i === a.farm ? next : plotsOf(t, i)));
      // once the farms are paid for, a change of seed or fertilizer is paid (or refunded) at once
      const delta = t.phase === 'growing' && a.kind !== 'sprayer' ? next.reduce((n, r, i) => n + plotCost(a.kind, r[a.kind] as string) - plotCost(a.kind, rows[i][a.kind] as string), 0) : 0;
      if (delta > s.coins) return { ...s, toast: toast(`That costs ${money(delta)} more and you have ${money(s.coins)}`) };
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
      // the pay is worked out against the best on file (TRACTOR_REWARD): a retry pays only for beating it
      const pay = rewardFor(a, before ?? null);
      const best = {
        stars: Math.max(before?.stars ?? 0, a.stars),
        score: Math.max(before?.score ?? 0, a.score),
        Q: Math.max(before?.Q ?? 0, a.Q),
        tries: (before?.tries ?? 0) + 1,
      };
      return {
        ...s,
        coins: s.coins + pay.coins,
        points: s.points + pay.points,
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
        fs: { phase: a.phase, at: a.at ?? s.fs.at, opened: a.opened ?? s.fs.opened, page: a.page ?? s.fs.page ?? 0 },
        note: a.note ?? s.note,
        // passing the first review completes onboarding, so it never repeats
        onboarded: s.onboarded || a.phase === 'walk2',
      };
    case 'route':
      return routeTo(s, a.path).reduce(play, s);
    case 'biz':
      return {
        ...s,
        bizOpen: a.open,
        biz: bizOf(s.biz),
        roundsOpen: false,
        roundsTrial: false,
        trialsOpen: false,
        modal: !a.open && s.fromMenu ? { kind: 'menu' } : null,
        fromMenu: a.open ? s.modal?.kind === 'menu' || s.fromMenu : false,
        plotSelected: false,
      };
    case 'bizRun': {
      const b = bizOf(s.biz);
      const requests = requestsFor(b);
      const plan = planDay(b, requests, a.bookings, a.route, a.drives ?? {}, farmSignal(s));
      if (plan.problem) return { ...s, toast: toast(plan.problem) };
      const { biz, result } = runDay(b, plan, activitiesDone(requests, a.bookings, plan));
      const helped = result.farmers + result.partnerFarmers;
      return { ...s, biz, points: s.points + result.points, ...gainXp(s, 0.02 * helped) };
    }
    case 'bizHireOut': {
      const b = bizOf(s.biz);
      if (!b.partners.includes('county')) return s;
      return { ...s, biz: hireOutDay(b, requestsFor(b).length).biz };
    }
    case 'bizContract': {
      const b = bizOf(s.biz);
      const offer = offersFor(b).find(o => o.id === a.id);
      if (!offer) return { ...s, toast: toast('That contract has gone.') };
      const { biz, result } = contractDay(b, offer, requestsFor(b), a.bookings);
      return { ...s, biz, points: s.points + result.points, ...gainXp(s, 0.02 * result.partnerFarmers) };
    }
    case 'bizPartner': {
      const b = bizOf(s.biz);
      const block = partnerBlock(b, a.id);
      if (block) return { ...s, toast: toast(`${partnerOf(a.id).name}: ${lowerFirst(block)}`) };
      return { ...s, biz: { ...b, cash: b.cash - partnerOf(a.id).fee, partners: [...b.partners, a.id] }, toast: toast(`Signed with ${partnerOf(a.id).name}`) };
    }
    case 'bizBuy': {
      const b = bizOf(s.biz);
      const block = shopBlock(b, a.item);
      const item = SHOP.find(x => x.id === a.item)!;
      if (block) return { ...s, toast: toast(`${item.name}: ${lowerFirst(block)}`) };
      const next = a.item === 'large' ? { ...b, tractor: 'large' as const } : { ...b, tools: [...b.tools, a.item] };
      return { ...s, biz: { ...next, cash: b.cash - item.price }, toast: toast(`Bought: ${item.name}`) };
    }
    case 'bizAdvise': {
      const b = bizOf(s.biz);
      if (a.client in b.advised) return s;
      const scan = scanFarm(b, a.client, requestsFor(b));
      if (!scan.rec) return s;
      const yes = farmerAccepts(b, scan);
      const biz: Biz = { ...b, advised: { ...b.advised, [a.client]: yes }, extra: yes ? [...b.extra, scan.rec.key] : b.extra };
      return { ...s, biz, ...(yes ? gainXp(s, 0.01) : {}) };
    }
    case 'bizDemo': {
      const b = bizOf(s.biz);
      if (b.demos.includes(a.crop)) return s;
      if (b.demos.length >= demoSlots(b)) return { ...s, toast: toast(`The Hub Manager runs one demo plot a level: ${b.demos.length} already.`) };
      return { ...s, biz: { ...b, demos: [...b.demos, a.crop] }, toast: toast('The Hub Manager is planting the demo plot.') };
    }
    case 'bizGraduate': {
      const b = bizOf(s.biz);
      const g = graduation(b);
      if (!g?.due) return s;
      return { ...s, biz: { ...b, owned: [...b.owned, { hp: g.tier.hp as 45 | 75, price: g.tier.price, paid: 0, since: b.day, warn: 0 }], tractor: g.tier.tractor }, ...gainXp(s, 0.5), points: s.points + PAYG.tiers.indexOf(g.tier) * 100 + 200 };
    }
    case 'bizIntro':
      return { ...s, biz: { ...bizOf(s.biz), intro: true } };
    case 'achClaim': {
      const ach = achOfSave(s.ach);
      const w = ach.won[a.id];
      const x = achOf(a.id);
      if (!w || w.claimed || !x) return s;
      return {
        ...s,
        ach: { ...ach, won: { ...ach.won, [a.id]: { ...w, claimed: true } } },
        points: s.points + x.points,
        coins: s.coins + (x.coins ?? 0),
        toast: toast(`${x.name}: +${x.points} points${x.coins ? ` · +${money(x.coins)}` : ''}`),
      };
    }
    case 'achClaimAll': {
      const ach = achOfSave(s.ach);
      const ids = Object.keys(ach.won).filter(id => !ach.won[id].claimed && achOf(id));
      const lv = Object.keys(ach.levels).filter(id => !ach.levels[id].claimed && levelOf(id));
      const day = ach.daily && ach.daily.date === achClock.today() && !ach.daily.claimed ? streakReward(ach.daily.streak) : null;
      if (!ids.length && !lv.length && !day) return s;
      const points = ids.reduce((n, id) => n + achOf(id)!.points, 0) + lv.reduce((n, id) => n + levelOf(id)!.points, 0) + (day?.points ?? 0);
      const coins = ids.reduce((n, id) => n + (achOf(id)!.coins ?? 0), 0) + lv.reduce((n, id) => n + levelOf(id)!.coins, 0) + (day?.coins ?? 0);
      return {
        ...s,
        ach: {
          ...ach,
          won: { ...ach.won, ...Object.fromEntries(ids.map(id => [id, { ...ach.won[id], claimed: true }])) },
          levels: { ...ach.levels, ...Object.fromEntries(lv.map(id => [id, { ...ach.levels[id], claimed: true }])) },
          daily: day ? { ...ach.daily!, claimed: true } : ach.daily,
        },
        points: s.points + points,
        coins: s.coins + coins,
        toast: toast(`Rewards claimed: +${fmt(points)} points${coins ? ` · +${money(coins)}` : ''}`),
      };
    }
    case 'levelClaim': {
      const ach = achOfSave(s.ach);
      const w = ach.levels[a.id];
      const l = levelOf(a.id);
      if (!w || w.claimed || !l) return s;
      return {
        ...s,
        ach: { ...ach, levels: { ...ach.levels, [a.id]: { ...w, claimed: true } } },
        coins: s.coins + l.coins,
        points: s.points + l.points,
        ...gainXp(s, 0.1 * l.n),
        toast: toast(`Level ${l.n} · ${l.name}: +${money(l.coins)} · +${fmt(l.points)} points`),
      };
    }
    case 'waterBuy': {
      const tank = tankOf(s.tank);
      const cap = capacityOf(s);
      const room = Math.max(0, cap - tank.level);
      if (room < 1) return { ...s, toast: toast('The tank is full') };
      const gate = idBlock(s, WATER.buys, a.kind);
      if (gate) return { ...s, toast: toast(gate) };
      const o = waterBuyOf(a.kind);
      const litres = Math.min(room, o.litres);
      const price = waterBuyPrice(o, litres);
      if (s.coins < price) return { ...s, toast: toast(`You need ${money(price)} for that water`) };
      return {
        ...s,
        coins: s.coins - price,
        tank: { ...tank, level: tank.level + litres, bought: { ...tank.bought, [a.kind]: (tank.bought[a.kind] ?? 0) + litres } },
        toast: toast(`${fmt(litres)} L ${a.kind === 'piped' ? 'of piped water' : a.kind === 'transported' ? 'delivered by bowser' : `· ${o.name.toLowerCase()}`} · −${money(price)}`),
      };
    }
    case 'herdSet': {
      const tank = tankOf(s.tank);
      const cows = Math.max(0, Math.min(WATER.herd.maxCows, Math.round(a.cows)));
      const hens = Math.max(0, Math.min(WATER.herd.maxHens, Math.round(a.hens)));
      if (cows === tank.herd.cows && hens === tank.herd.hens) return s;
      // animals are bought at their price and sold for a share of it (src/livestock/config.ts)
      const cost = herdCost(tank.herd.cows, cows, LIFE.price.cow) + herdCost(tank.herd.hens, hens, LIFE.price.hen);
      if (cost > s.coins) return { ...s, toast: toast(`That costs ${money(cost)} and you have ${money(s.coins)}`) };
      return { ...s, coins: s.coins - cost, tank: { ...tank, herd: { cows, hens } } };
    }
    case 'herdBuy': {
      const herd = tankOf(s.tank).herd;
      const max = a.group === 'cows' ? WATER.herd.maxCows : WATER.herd.maxHens;
      const to = Math.max(0, Math.min(max, herd[a.group] + a.n));
      if (to === herd[a.group]) return { ...s, toast: toast(a.n > 0 ? `The farm keeps at most ${max} ${a.group}` : `You have no ${a.group} to sell`) };
      const next = play(s, { type: 'herdSet', cows: a.group === 'cows' ? to : herd.cows, hens: a.group === 'hens' ? to : herd.hens });
      if (tankOf(next.tank).herd[a.group] !== to) return next;
      const n = Math.abs(to - herd[a.group]);
      const word = a.group === 'cows' ? (n === 1 ? 'cow' : 'cows') : n === 1 ? 'hen' : 'hens';
      return { ...next, toast: toast(`${to > herd[a.group] ? 'Bought' : 'Sold'} ${n} ${word} · ${money(Math.abs(s.coins - next.coins))}`) };
    }
    case 'animalCare': {
      const r = doCare(s, a.id);
      return 'error' in r ? { ...s, toast: toast(r.error) } : { ...r.state, ...gainXp(s, 0.02), toast: toast(r.text) };
    }
    case 'animalFix': {
      const r = fixIssue(s, a.issue, a.fix);
      if ('error' in r) return { ...s, toast: toast(r.error) };
      const fixed = { ...r.state, ...(r.right ? gainXp(s, 0.06) : {}), points: s.points + (r.right ? 20 : 0), toast: toast(r.right ? `${r.text} · +20 points` : r.text) };
      // on the 3D farm, the right fix is then given by hand at the pen or the coop
      return r.right && onFarm(s) && !(s.jobs ?? []).some(j => j.key === `treat:${a.issue}`) ? { ...addJob(fixed, treatJob(a.issue, a.fix)), toast: fixed.toast } : fixed;
    }
    case 'animalPrevent': {
      const r = doPrevent(s, a.id);
      return 'error' in r ? { ...s, toast: toast(r.error) } : { ...r.state, ...gainXp(s, 0.03), toast: toast(r.text) };
    }
    case 'coopBuild': {
      const r = buildCoop(s, a.id);
      return 'error' in r ? { ...s, toast: toast(r.error) } : { ...r.state, ...gainXp(s, 0.1), points: s.points + 50, toast: toast(`${r.text} · +50 points`) };
    }
    case 'shedBuild': {
      const r = buildShed(s, a.id);
      return 'error' in r ? { ...s, toast: toast(r.error) } : { ...r.state, ...gainXp(s, 0.1), points: s.points + 60, toast: toast(`${r.text} · +60 points`) };
    }
    case 'powerInstall': {
      const block = stepBlock(s, a.id, s.coins, a.option);
      if (block) return { ...s, toast: toast(block) };
      const st = stepOf(a.id);
      const opt = partOptionOf(a.id, a.option);
      const p = powerOf(s.power);
      const day = lifeOf(s.life).day;
      const score = Math.max(0, Math.min(1, a.score));
      const parts = { ...p.parts, [a.id]: { day, score, ...(opt ? { option: opt.id } : {}) } };
      const fuel = a.id === 'fuel' ? Math.round((opt?.fill ?? POWER.firstFill) * (0.85 + 0.15 * score)) : p.fuel;
      const on = a.id === 'switchOn';
      const loads = on ? (a.loads ?? loadsAvailable(s)) : p.loads;
      const pts = on ? POWER.switchOnPoints : POWER.points;
      return {
        ...s,
        coins: s.coins - (opt?.price ?? st.price),
        points: s.points + pts,
        power: { ...p, parts, fuel, loads, day: on ? day : p.day },
        ...gainXp(s, 0.08),
        toast: toast(on ? `The power is on: ${loads.length} things powered · +${pts} points` : `${st.name} in${opt ? ` (${opt.name})` : ''} · +${pts} points`),
      };
    }
    case 'powerLoad': {
      const p = powerOf(s.power);
      if (!p.parts.switchOn) return { ...s, toast: toast('Switch the system on first (day 7)') };
      if (!loadsAvailable(s).includes(a.id)) return s;
      const loads = a.on ? [...new Set([...p.loads, a.id])] : p.loads.filter(x => x !== a.id);
      return { ...s, power: { ...p, loads }, toast: toast(`${POWER.loads[a.id].name} ${a.on ? 'switched on' : 'switched off'}`) };
    }
    case 'powerFuel': {
      const p = powerOf(s.power);
      if (!p.parts.fuel) return { ...s, toast: toast('Put in the diesel tank first (day 6)') };
      const litres = Math.max(0, Math.min(a.litres, fuelTankL(s) - p.fuel));
      if (litres <= 0) return { ...s, toast: toast('The diesel tank is full') };
      const cost = Math.round(litres * POWER.dieselPrice);
      if (s.coins < cost) return { ...s, toast: toast(`You need ${money(cost)} for ${litres} L of diesel`) };
      return { ...s, coins: s.coins - cost, power: { ...p, fuel: p.fuel + litres }, toast: toast(`${litres} L of diesel in the tank · ${money(cost)}`) };
    }
    case 'tractorHub':
      return hubAction(s, a);
    case 'produceSell': {
      const day = lifeOf(s.life).day;
      const r = sellProduce(s.produce, a.items, day, achClock.today(), coldRoom(s));
      if ('error' in r) return { ...s, toast: toast(r.error) };
      return { ...s, coins: s.coins + r.earned, produce: r.p, ...gainXp(s, 0.03), toast: toast(`Sold ${r.kg} kg at the stall · +${money(r.earned)}`) };
    }
    case 'gardenPlant': {
      const g = gardenOf(s.garden);
      const day = lifeOf(s.life).day;
      const f = g.farms[a.farm];
      if (!f) return s;
      if (day < GARDEN.openDay) return { ...s, toast: toast(`The new farms open on day ${GARDEN.openDay}`) };
      if (f.crop) return { ...s, toast: toast(`${GARDEN_NAMES[a.farm]} already grows ${gardenCrop(f.crop).name.toLowerCase()}`) };
      const c = gardenCrop(a.crop);
      if (s.coins < c.cost) return { ...s, toast: toast(`You need ${money(c.cost)} to plant ${c.name.toLowerCase()}`) };
      const farms = g.farms.map((x, i) => (i === a.farm ? { crop: a.crop, planted: day, watered: day, ready: day + c.grow, health: 100, score: Math.max(0, Math.min(1, a.score)), harvests: 0 } : x));
      return { ...s, coins: s.coins - c.cost, points: s.points + GARDEN.plantPoints, garden: { ...g, farms }, ...gainXp(s, 0.06), toast: toast(`${GARDEN_NAMES[a.farm]} planted with ${c.name.toLowerCase()} · ready on day ${day + c.grow} · +${GARDEN.plantPoints} points`) };
    }
    case 'gardenWater': {
      const g = gardenOf(s.garden);
      const day = lifeOf(s.life).day;
      const f = g.farms[a.farm];
      if (!f?.crop) return s;
      if (f.watered >= day) return { ...s, toast: toast(`${GARDEN_NAMES[a.farm]} is watered for today`) };
      const need = gardenCrop(f.crop).water;
      const t = tankOf(s.tank);
      if (t.level < need) return { ...s, toast: toast(`The tank has ${Math.round(t.level)} L: ${GARDEN_NAMES[a.farm]} needs ${need} L. Buy water (Climate › Water)`) };
      const farms = g.farms.map((x, i) => (i === a.farm ? { ...x, watered: day, health: Math.min(100, x.health + 5) } : x));
      return { ...s, garden: { ...g, farms }, tank: { ...t, level: t.level - need }, toast: toast(`${GARDEN_NAMES[a.farm]} watered: ${need} L from the tank`) };
    }
    case 'gardenHarvest': {
      const g = gardenOf(s.garden);
      const day = lifeOf(s.life).day;
      const f = g.farms[a.farm];
      if (!f?.crop) return s;
      if (day < f.ready) return { ...s, toast: toast(`Not ready yet: ${GARDEN_NAMES[a.farm]} is ready on day ${f.ready}`) };
      const c = gardenCrop(f.crop);
      const kg = harvestKg(f, a.score);
      const farm = c.regrow ? { ...f, ready: day + c.regrow, harvests: f.harvests + 1 } : { ...f, crop: null, harvests: f.harvests + 1 };
      const farms = g.farms.map((x, i) => (i === a.farm ? farm : x));
      return {
        ...s,
        garden: { ...g, farms, kg: g.kg + kg },
        produce: stock(s.produce, { [c.produce]: kg }),
        points: s.points + GARDEN.harvestPoints,
        ...gainXp(s, 0.05),
        toast: toast(`${kg} kg of ${c.name.toLowerCase()} into the store · sell it at the market stall · +${GARDEN.harvestPoints} points`),
      };
    }
    case 'shedChoose': {
      const gate = idBlock(s, OPTIONS[a.kind], a.id);
      if (gate) return { ...s, toast: toast(gate) };
      const t = s.trial;
      let next: GameState = { ...s, prefs: { ...(s.prefs ?? {}), [a.kind]: a.id } };
      const set: number[] = [];
      if (t && t.phase !== 'done')
        t.plans.forEach((_, farm) => {
          if (plotsOf(next.trial!, farm)[0][a.kind] === a.id) return set.push(farm);
          const after = play({ ...next, toast: null }, { type: 'plotSet', farm, kind: a.kind, plot: 0, value: a.id });
          if (after.trial !== next.trial) {
            next = { ...after, toast: null };
            set.push(farm);
          }
        });
      const item = a.kind === 'seed' ? 'seeds' : a.kind === 'fert' ? 'fertilizer' : 'sprayer';
      const name = OPTIONS[a.kind].find(o => o.id === a.id)?.name ?? a.id;
      return { ...next, field: { ...next.field, carry: item }, toast: toast(`${name}${set.length ? ` for ${set.map(farmName).join(', ')}` : ': kept for your next planting'} · picked up`) };
    }
    case 'securityBuy': {
      const m = measureOf(a.id);
      const gate = idBlock(s, MEASURES, a.id);
      if (gate && !securityOf(s.security).owned.includes(a.id)) return { ...s, toast: toast(gate) };
      const sec = securityOf(s.security);
      if (m.kind === 'nightly') return play(s, { type: 'securityHire', id: a.id, on: true });
      if (sec.owned.includes(a.id)) return { ...s, toast: toast(`You have the ${m.name.toLowerCase()} already`) };
      if (s.coins < m.price) return { ...s, toast: toast(`You need ${money(m.price)} for the ${m.name.toLowerCase()}`) };
      return {
        ...s,
        coins: s.coins - m.price,
        security: { ...sec, owned: [...sec.owned, a.id], totals: { ...sec.totals, spent: sec.totals.spent + m.price } },
        ...gainXp(s, 0.04),
        toast: toast(`${m.name}${m.price ? ` · −${money(m.price)}` : ''}${m.nightly ? ` · ${money(m.nightly)} a night` : ''}`),
      };
    }
    case 'securityHire': {
      const m = measureOf(a.id);
      const sec = securityOf(s.security);
      if (m.kind !== 'nightly' || sec.hired.includes(a.id) === a.on) return s;
      const gate = a.on ? idBlock(s, MEASURES, a.id) : null;
      if (gate) return { ...s, toast: toast(gate) };
      return {
        ...s,
        security: { ...sec, hired: a.on ? [...sec.hired, a.id] : sec.hired.filter(x => x !== a.id) },
        toast: toast(a.on ? `${m.name} hired: ${money(m.nightly ?? 0)} a night, paid each morning` : `${m.name}: no longer hired`),
      };
    }
    case 'drawPolicy': {
      const tank = tankOf(s.tank);
      return tank.policy === a.policy ? s : { ...s, tank: { ...tank, policy: a.policy } };
    }
    case 'coverBuy': {
      const t = s.trial;
      const tank = tankOf(s.tank);
      if (!t || t.phase === 'done') return { ...s, toast: toast('Crop cover is bought for a cycle: plan one first') };
      if (tank.cover?.cycle === t.cycle) return { ...s, toast: toast('This cycle is already covered') };
      const plan = coverPlanOf(a.plan);
      const gate = idBlock(s, WATER.cover.plans, plan.id);
      if (gate) return { ...s, toast: toast(gate) };
      const q = coverQuote(s, plan.id);
      if (s.coins < q.premium) return { ...s, toast: toast(`You need ${money(q.premium)} for crop cover`) };
      return { ...s, coins: s.coins - q.premium, tank: { ...tank, cover: { cycle: t.cycle, premium: q.premium, plan: plan.id } }, toast: toast(`${plan.name} for cycle ${t.cycle} · −${money(q.premium)}`) };
    }
    case 'treatChoose': {
      const t = s.trial;
      if (!t || t.phase !== 'growing') return s;
      const ck = checkKey(a.farm, a.day);
      const rec = t.checks[ck];
      if (!rec?.right || rec.treated || rec.treatment === a.id) return s;
      return { ...s, trial: { ...t, checks: { ...t.checks, [ck]: { ...rec, treatment: a.id } } } };
    }
    case 'strategySet': {
      const t = s.trial;
      if (!t || t.phase === 'done' || a.farm >= t.plans.length) return s;
      const f = s.field.cycle === t.cycle ? s.field : emptyField(t.cycle);
      // a row already sown keeps its strategy
      if (t.phase === 'growing' && doneMask(f, t.cycle, a.farm, 'sow')) return { ...s, toast: toast(`${farmName(a.farm)} is already sown: its rows keep their strategies`) };
      const dimOpts = DIMENSIONS.find(d => d.id === a.dim)?.options ?? [];
      const gate = idBlock(s, dimOpts, a.option);
      if (gate) return { ...s, toast: toast(gate) };
      const rows = Array.from({ length: ROWS_PER_FARM }, (_, r) => ({ ...(t.strategies?.[a.farm]?.[r] ?? {}) }));
      rows.forEach((st, r) => {
        if (a.row === -1 || a.row === r) st[a.dim] = a.option;
      });
      const strategies = t.plans.map((_, i) => (i === a.farm ? rows : (t.strategies?.[i] ?? Array.from({ length: ROWS_PER_FARM }, () => ({})))));
      const next: Trial = { ...t, strategies };
      // once the farms are paid for, a change is paid (or refunded) at once
      const delta = t.phase === 'growing' ? farmCost(next, a.farm) - farmCost(t, a.farm) : 0;
      if (delta > s.coins) return { ...s, toast: toast(`That costs ${money(delta)} more and you have ${money(s.coins)}`) };
      return { ...s, coins: s.coins - delta, trial: next };
    }
    case 'evidenceAnswer':
    case 'evidenceTag':
      return { ...s, evidence: evidenceReduce(s.evidence, a) };
    case 'riskSnap':
    case 'riskFixed':
    case 'riskTap':
      return { ...s, risk: riskReduce(s.risk, a) };
    case 'partnerApply':
      return { ...s, partnerApps: [...(s.partnerApps ?? []), a.app] };
    case 'partnerPick': {
      const picks = s.partnerPicks ?? [];
      return { ...s, partnerPicks: picks.includes(a.id) ? picks.filter(x => x !== a.id) : [...picks, a.id] };
    }
    case 'partnerSave': {
      const b = brandOf(a.id);
      const saved = s.offers ?? [];
      if (!b || saved.includes(a.id)) return s;
      const code = offerCode(b.id, s.farmer?.name);
      return { ...s, offers: [...saved, a.id], note: `Offer from ${b.name}: ${b.offer.title}, code ${code}. ${b.offer.line}.`, toast: toast(`Offer from ${b.name}: code ${code} · it is in Messages`) };
    }
    case 'jobAdd': {
      const jobs = s.jobs ?? [];
      if (jobs.some(j => j.key === a.job.key)) return { ...s, modal: null, fromMenu: false, toast: toast(`Already on your jobs: ${a.job.title.toLowerCase()}`) };
      if (jobs.length >= JOBS_MAX) return { ...s, toast: toast('Your hands are full: finish a job on the farm first') };
      // the action must be possible now (money, the day, the order of parts): a refusal says why, and nothing is added
      if (a.job.then) {
        const n = play(s, a.job.then);
        if (!changedState(s, n)) return n.toast && n.toast !== s.toast ? { ...s, toast: n.toast } : s;
      }
      return addJob(s, a.job);
    }
    case 'jobStep': {
      const jobs = s.jobs ?? [];
      if (!jobs.some(j => j.id === a.id)) return s;
      return { ...s, jobs: jobs.map(j => (j.id === a.id ? { ...j, done: Math.min(j.stops.length, j.done + 1) } : j)) };
    }
    case 'jobDone': {
      const job = (s.jobs ?? []).find(j => j.id === a.id);
      if (!job) return s;
      return { ...s, jobs: (s.jobs ?? []).filter(j => j.id !== a.id), points: s.points + job.points };
    }
    case 'jobDrop': {
      const job = (s.jobs ?? []).find(j => j.id === a.id);
      if (!job) return s;
      return { ...s, jobs: (s.jobs ?? []).filter(j => j.id !== a.id), toast: toast(`Dropped: ${job.title.toLowerCase()}${job.then ? '. Nothing was paid' : ''}`) };
    }
    case 'tidyDay': {
      const today = achClock.today();
      if (s.tidy?.date === today) return s;
      const first = !s.tidy?.date;
      return {
        ...s,
        tidy: tidyFor(s.tidy, today),
        toast: toast(first ? 'Tidy-up: clear 3 bushes and 5 rocks around the farm every day' : 'New day: 3 bushes and 5 rocks to clear around the farm'),
      };
    }
    case 'tidyClear': {
      const r = clearPiece(s.tidy, a.id, achClock.today());
      if (!r) return s;
      return {
        ...s,
        tidy: r.tidy,
        points: s.points + r.points,
        coins: s.coins + r.coins,
        ...(r.finished
          ? { toast: toast(`Farm tidy! +${money(r.coins)} · +${r.points} points${r.tidy.streak > 1 ? ` · ${r.tidy.streak}-day tidy streak` : ''}`) }
          : {}),
      };
    }
    case 'achDaily': {
      const ach = achOfSave(s.ach);
      const d = ach.daily;
      if (!d || d.claimed || d.date !== achClock.today()) return s;
      const r = streakReward(d.streak);
      return {
        ...s,
        ach: { ...ach, daily: { ...d, claimed: true } },
        coins: s.coins + r.coins,
        points: s.points + r.points,
        toast: toast(`Day ${d.streak} reward: +${money(r.coins)} · +${r.points} points`),
      };
    }
  }
}

/** The tractor screen's sections (src/tractor/hub.ts): each mini-game done changes the tractor or the driver. */
function hubAction(s: GameState, a: Extract<Action, { type: 'tractorHub' }>): GameState {
  const h = hubOf(s.hub);
  const day = lifeOf(s.life).day;
  const score = Math.max(0, Math.min(1, a.score));
  const done = { ...h.done, [a.section]: (h.done[a.section] ?? 0) + 1 };
  const best = { ...h.best, [a.section]: Math.max(h.best[a.section] ?? 0, Math.max(0, Math.min(1, a.score))) };
  const log = (text: string) => [{ day, text }, ...h.log].slice(0, 20);
  const pts = Math.round((HUB.points[a.section as keyof typeof HUB.points] ?? 0) * score);
  switch (a.section) {
    case 'train': {
      const xp = h.xp + Math.round(30 * score);
      const up = hubLevel(xp) > hubLevel(h.xp);
      return { ...s, points: s.points + pts, hub: { ...h, xp, done, best, log: log(`Practice drive: ${Math.round(score * 100)}%`) }, ...gainXp(s, 0.04), toast: toast(up ? `Driver level ${hubLevel(xp)}: the tractor drives ${Math.round(hubLevel(xp) * HUB.speedPerLevel * 100)}% faster · +${pts} points` : `Practice drive done · +${Math.round(30 * score)} experience · +${pts} points`) };
    }
    case 'learn': {
      const l = a.id ? lessonOf(a.id) : undefined;
      if (!l) return s;
      const pass = score >= 0.6;
      const first = pass && !h.lessons.includes(l.id);
      return { ...s, points: s.points + (first ? pts : 0), hub: { ...h, xp: h.xp + (first ? 20 : 0), lessons: pass ? [...new Set([...h.lessons, l.id])] : h.lessons, done, best, log: log(`${l.title}: ${Math.round(score * 100)}%`) }, toast: toast(pass ? `${l.title}: passed${first ? ` · +${pts} points` : ''}` : `${l.title}: ${Math.round(score * 100)}%. Try again to pass`) };
    }
    case 'safety':
      return { ...s, points: s.points + (h.safetyDay === day ? 0 : pts), hub: { ...h, safetyDay: day, done, best, log: log('Safety check before starting') }, toast: toast(`Safety check done${h.safetyDay === day ? '' : ` · +${pts} points`}`) };
    case 'service': {
      const cost = Math.round(HUB.serviceCost * (1 - repairCut(s)));
      if (s.coins < cost) return { ...s, toast: toast(`Oil, grease and filters cost ${money(cost)}`) };
      const condition = Math.min(100, Math.round(h.condition + 10 + 25 * score));
      return { ...s, coins: s.coins - cost, points: s.points + pts, hub: { ...h, condition, done, best, log: log(`Serviced: condition ${condition}%`) }, toast: toast(`Serviced · condition ${condition}% · ${money(cost)}`) };
    }
    case 'repair': {
      const cost = Math.round(HUB.repairCost * (1 - repairCut(s)));
      if (s.coins < cost) return { ...s, toast: toast(`The parts cost ${money(cost)}`) };
      const condition = Math.max(h.condition, Math.round(60 + 40 * score));
      return { ...s, coins: s.coins - cost, points: s.points + pts, hub: { ...h, condition, done, best, log: log(`Repaired: condition ${condition}%`) }, toast: toast(`Repaired · condition ${condition}% · ${money(cost)}${repairCut(s) ? ' (workshop power: cheaper)' : ''}`) };
    }
    case 'refuel': {
      const want = Math.max(0, Math.min(a.litres ?? HUB.tankL, HUB.tankL - h.fuel));
      if (want <= 0) return { ...s, toast: toast('The tractor’s tank is full') };
      // spilt diesel is lost: a steady pour keeps it all
      const got = Math.round(want * (0.8 + 0.2 * score) * 10) / 10;
      const p = powerOf(s.power);
      if (p.parts.fuel && p.fuel >= want) {
        return { ...s, points: s.points + pts, power: { ...p, fuel: Math.round((p.fuel - want) * 10) / 10 }, hub: { ...h, fuel: Math.round((h.fuel + got) * 10) / 10, done, best, log: log(`Refuelled ${got} L from the farm tank`) }, toast: toast(`${got} L from the farm’s diesel tank${got < want ? ` (${Math.round((want - got) * 10) / 10} L spilt)` : ''}`) };
      }
      const cost = Math.round(want * HUB.pumpPrice);
      if (s.coins < cost) return { ...s, toast: toast(`${want} L at the pump costs ${money(cost)}`) };
      return { ...s, coins: s.coins - cost, points: s.points + pts, hub: { ...h, fuel: Math.round((h.fuel + got) * 10) / 10, done, best, log: log(`Refuelled ${got} L at the pump`) }, toast: toast(`${got} L of diesel from the pump · ${money(cost)}`) };
    }
    default:
      return { ...s, hub: { ...h, done, best } };
  }
}

/* ------------------------------------------------------------------ */
/* Saving                                                               */
/* ------------------------------------------------------------------ */

const SAVE_KEY = 'lima-farming-game:v2';
const TRANSIENT: (keyof GameState)[] = ['award', 'success', 'sfx', 'fromMenu', 'navSeq', 'rideReq', 'modal', 'plotSelected', 'toast', 'roundsOpen', 'roundsView', 'roundsDemo', 'worldDemo', 'trialsOpen', 'roundsTrial', 'bizOpen'];

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

/** The saved game, opened at the address in the browser's address bar (if the player may go there). */
function load(): GameState {
  if (reviewing()) return { ...initialState, ...REVIEW_BASE };
  const saved = loadSaved();
  return window.location.hash ? reducer(saved, { type: 'route', path: window.location.hash }) : saved;
}

function loadSaved(): GameState {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return initialState;
    const saved = JSON.parse(raw);
    // Saves from before the farm had one owner may carry a reminder about neighbours.
    if (typeof saved.note === 'string' && /Achieng|neighbour/i.test(saved.note)) saved.note = 'Check every bed often: open Rounds.';
    return { ...initialState, ...saved, fromMenu: false, navSeq: 0, rideReq: 0, modal: null, plotSelected: false, toast: null, success: null, sfx: null, award: null, ach: achOfSave(saved.ach), roundsOpen: false, roundsView: null, roundsDemo: null, worldDemo: null, trialsOpen: false, bizOpen: false, roundsTrial: false, rounds: { ...initialState.rounds, ...(saved.rounds ?? {}) }, settings: { ...DEFAULT_SETTINGS, ...(saved.settings ?? {}) }, climate: { ...initialClimate, ...(saved.climate ?? {}) } };
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
