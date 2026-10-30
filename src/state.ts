import { useReducer } from 'react';
import { SHOP_TABS, STEPS, type HarvestChoice, type ShopTab, type StepId } from './data';

export type Modal =
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

export interface GameState {
  modal: Modal | null;
  plotSelected: boolean;
  showHint: boolean;
  coins: number;
  water: number; // thousands of litres in the tanks
  level: number;
  xp: number; // 0..1
  rewardPoints: number;
  stock: Record<string, number>; // harvested bags per crop
  owned: string[]; // shop purchases
  doneTasks: string[]; // farming-step task ids
  storage: string;
  harvestChoice: HarvestChoice;
  processId: string;
  redeemed: string[];
  farmView: number;
  collected: string[]; // milk / eggs collected this session
  toast: { id: number; text: string } | null;
}

const initialStock = Object.fromEntries(
  SHOP_TABS.find(t => t.id === 'food')!.items.map(i => [i.id, i.stock![0]]),
);

export const initialState: GameState = {
  modal: null,
  plotSelected: false,
  showHint: false,
  coins: 5000,
  water: 20,
  level: 5,
  xp: 0.38,
  rewardPoints: 8000,
  stock: initialStock,
  owned: [],
  doneTasks: [],
  storage: 'home',
  harvestChoice: 'now',
  processId: 'processing',
  redeemed: [],
  farmView: 1,
  collected: [],
  toast: null,
};

export type Action =
  | { type: 'open'; modal: Modal }
  | { type: 'close' }
  | { type: 'selectPlot'; on: boolean }
  | { type: 'hint'; on: boolean }
  | { type: 'buy'; id: string; price: number; name: string }
  | { type: 'sell'; id: string; price: number; name: string }
  | { type: 'task'; id: string; price: number; name: string; water?: number }
  | { type: 'water'; litres: number }
  | { type: 'storage'; id: string }
  | { type: 'harvest'; choice: HarvestChoice }
  | { type: 'process'; id: string }
  | { type: 'redeem'; id: string; name: string }
  | { type: 'farm'; id: number }
  | { type: 'collect'; id: string; text: string; coins: number }
  | { type: 'toast'; text: string }
  | { type: 'reset'; state: Partial<GameState> };

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

function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case 'open':
      return { ...s, modal: a.modal, plotSelected: false, showHint: false };
    case 'close':
      return { ...s, modal: null };
    case 'selectPlot':
      return { ...s, plotSelected: a.on, showHint: false };
    case 'hint':
      return { ...s, showHint: a.on };
    case 'buy': {
      if (s.coins < a.price) return { ...s, toast: toast(`Not enough coins for ${a.name}`) };
      return {
        ...s,
        coins: s.coins - a.price,
        owned: s.owned.includes(a.id) ? s.owned : [...s.owned, a.id],
        ...gainXp(s, 0.04),
        toast: toast(`Bought ${a.name} for ${a.price.toLocaleString('en-US')} coins`),
      };
    }
    case 'sell': {
      const left = s.stock[a.id] ?? 0;
      if (left <= 0) return { ...s, toast: toast(`No ${a.name} left to sell`) };
      return {
        ...s,
        coins: s.coins + a.price,
        stock: { ...s.stock, [a.id]: left - 1 },
        ...gainXp(s, 0.05),
        toast: toast(`Sold 1 bag of ${a.name} for ${a.price} coins`),
      };
    }
    case 'task': {
      if (s.doneTasks.includes(a.id)) return s;
      if (s.coins < a.price) return { ...s, toast: toast(`Not enough coins for ${a.name}`) };
      return {
        ...s,
        coins: s.coins - a.price,
        water: s.water + (a.water ?? 0),
        doneTasks: [...s.doneTasks, a.id],
        ...gainXp(s, 0.06),
        toast: toast(`${a.name} done`),
      };
    }
    case 'water':
      return { ...s, water: s.water + a.litres / 1000, toast: toast(`Saved ${a.litres.toLocaleString('en-US')} L/m² water plan`) };
    case 'storage':
      return { ...s, storage: a.id };
    case 'harvest':
      return { ...s, harvestChoice: a.choice };
    case 'process':
      return { ...s, processId: a.id };
    case 'redeem':
      if (s.redeemed.includes(a.id)) return s;
      return { ...s, redeemed: [...s.redeemed, a.id], toast: toast(`${a.name} added to your vouchers`) };
    case 'farm':
      return { ...s, farmView: a.id };
    case 'collect':
      return {
        ...s,
        collected: [...s.collected, a.id],
        coins: s.coins + a.coins,
        ...gainXp(s, 0.05),
        toast: toast(a.text),
      };
    case 'toast':
      return { ...s, toast: toast(a.text) };
    case 'reset':
      return { ...s, ...a.state };
  }
}

export const isStepComplete = (s: GameState, step: StepId) =>
  STEPS.find(d => d.id === step)!.tasks.every(t => s.doneTasks.includes(t.id));

export function useGame() {
  return useReducer(reducer, initialState);
}
