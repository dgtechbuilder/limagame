/* The farm's power system: what is built, and what a day of power does. No screens here (Power.tsx), so the saved
   game can use it. Every number is in ./config.ts. */

import { lifeOf, type LifeState } from '../livestock/model';
import { capacityOf, tankOf, type TankState } from '../water/model';
import type { Trial } from '../trials/model';
import { LOAD_IDS, PART_IDS, POWER, POWER_STEPS, partOptionOf, stepOf, type LoadId, type PartOption, type StepId } from './config';
import { idBlock, type UnlockHost } from '../unlock/model';

export interface PowerDay {
  /** the farm day it was */
  day: number;
  /** kWh: made by the panels, by the generator, needed, and used */
  solar: number;
  gen: number;
  need: number;
  used: number;
  /** the share of what was needed that the system gave (0 to 1) */
  served: number;
  /** litres of diesel burned, litres the pump lifted into the tank, the battery's charge at the end (kWh) */
  fuelL: number;
  water: number;
  battery: number;
  /** kg CO₂ kept out of the air by the clean power, and emitted by the generator */
  avoided: number;
  emitted: number;
  /** what the power saved the farm (stored money: grid power, paraffin and pumping it no longer buys) */
  saved: number;
}

export interface PowerState {
  /** each step done: the farm day, and how well its mini-game went (0 to 1) */
  parts: Partial<Record<StepId, { day: number; score: number; option?: string }>>;
  /** what is switched on */
  loads: LoadId[];
  /** litres of diesel in the tank, and kWh in the battery */
  fuel: number;
  battery: number;
  /** the farm day the system has run up to */
  day: number;
  /** newest first */
  history: PowerDay[];
  totals: { solar: number; gen: number; used: number; fuelL: number; water: number; avoided: number; emitted: number; saved: number; days: number };
}

export const newPower = (): PowerState => ({
  parts: {},
  loads: [],
  fuel: 0,
  battery: 0,
  day: 0,
  history: [],
  totals: { solar: 0, gen: 0, used: 0, fuelL: 0, water: 0, avoided: 0, emitted: 0, saved: 0, days: 0 },
});

export const powerOf = (p: Partial<PowerState> | undefined): PowerState => {
  const base = newPower();
  return { ...base, ...(p ?? {}), totals: { ...base.totals, ...(p?.totals ?? {}) } };
};

export interface PowerHost {
  power?: Partial<PowerState>;
  life?: Partial<LifeState>;
  tank?: Partial<TankState>;
  trial: Trial | null;
  inventory: string[];
}

export const has = (s: Pick<PowerHost, 'power'>, id: StepId) => !!powerOf(s.power).parts[id];
/** The whole system is built and switched on. */
export const powerOn = (s: Pick<PowerHost, 'power'>) => has(s, 'switchOn');
/** How well the last day went: the share of what was needed that the system gave (1 before any day has run). */
export const servedShare = (s: Pick<PowerHost, 'power'>) => powerOf(s.power).history[0]?.served ?? 1;
/** A load is running: the system is on, the load is switched on, and the system gave power yesterday. */
export const loadOn = (s: Pick<PowerHost, 'power'>, id: LoadId) => powerOn(s) && powerOf(s.power).loads.includes(id) && servedShare(s) > 0.25;
/** The option a part was put in with (or would be, by default), or null for one with no options. */
export const partOf = (s: Pick<PowerHost, 'power'>, id: StepId): PartOption | null => partOptionOf(id, powerOf(s.power).parts[id]?.option);
/** The lights are on tonight: switched on and powered, or (stand-alone solar lights) switched on at all. */
const lightsOn = (s: Pick<PowerHost, 'power'>) => has(s, 'lights') && (partOf(s, 'lights')?.own ? powerOn(s) && powerOf(s.power).loads.includes('lights') : loadOn(s, 'lights'));
/** The farm's lights are lit at night and light the yard (they count as the solar security light). */
export const lightsLit = (s: Pick<PowerHost, 'power'>) => lightsOn(s) && partOf(s, 'lights')?.secure !== false;
/** More eggs from the lit coop (0 when the lights are off). */
export const lightsEggs = (s: Pick<PowerHost, 'power'>) => (lightsOn(s) ? (partOf(s, 'lights')?.eggs ?? POWER.eggBoost) : 0);
/** The diesel tank's size, litres (the default before one is in). */
export const fuelTankL = (s: Pick<PowerHost, 'power'>) => partOf(s, 'fuel')?.size ?? POWER.tankL;
/** The battery bank's usable kWh, before how well it was put in. */
export const batteryUsable = (s: Pick<PowerHost, 'power'>) => {
  const b = partOf(s, 'battery');
  return b ? b.size * (b.out ?? 1) : POWER.batteryKwh;
};
/** What a day's load of a switch is: the lights' depends on the lights put in. */
export const loadKwh = (s: Pick<PowerHost, 'power'>, id: LoadId) => (id === 'lights' ? (partOf(s, 'lights')?.size ?? POWER.loads.lights.kwh) : POWER.loads[id].kwh);

/** The step that comes next (in order), or null when all seven are done. */
export function nextStep(s: Pick<PowerHost, 'power'>) {
  return POWER_STEPS.find(p => !has(s, p.id)) ?? null;
}

/** Why a step cannot be done now, or null when it can. */
export function stepBlock(s: Pick<PowerHost, 'power' | 'life'> & UnlockHost, id: StepId, coins: number, option?: string | null): string | null {
  const st = stepOf(id);
  const i = POWER_STEPS.indexOf(st);
  if (has(s, id)) return `${st.name}: done`;
  const day = lifeOf(s.life).day;
  if (day < st.day) return `${st.name} goes in on day ${st.day} (today is day ${day})`;
  const before = POWER_STEPS[i - 1];
  if (before && !has(s, before.id)) return `Put in the ${before.name.toLowerCase()} first`;
  const o = partOptionOf(id, option);
  if (o && option) {
    const locked = idBlock(s, st.options, o.id);
    if (locked) return locked;
  }
  const price = o?.price ?? st.price;
  if (coins < price) return `You need ${price} for the ${st.name.toLowerCase()}`;
  return null;
}

/** A part's output, from how well it was put in. */
const quality = (p: PowerState, id: StepId) => POWER.floor + (1 - POWER.floor) * (p.parts[id]?.score ?? 0);

/** What the system would make and need today. */
export function forecastDay(s: PowerHost) {
  const p = powerOf(s.power);
  const f = s.trial?.forecast ?? 'normal';
  const panels = partOf(s, 'panels')!;
  const inv = partOf(s, 'inverter')!;
  // the inverter carries at most its own kW: panels beyond it are wasted
  const kw = Math.min(panels.size * (panels.out ?? 1), inv.size);
  const solar = has(s, 'panels') && has(s, 'inverter') ? kw * (inv.out ?? 1) * POWER.sunHours[f] * quality(p, 'panels') * quality(p, 'inverter') : 0;
  const cows = tankOf(s.tank).herd.cows;
  const need = p.loads.filter(id => (id === 'cooler' ? cows > 0 : id === 'lights' ? has(s, 'lights') : true)).reduce((n, id) => n + loadKwh(s, id), 0);
  return { solar: round(solar), need: round(need), sun: POWER.sunHours[f] };
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;

/** One day of power: the panels, the battery, the generator; what was served; the water pumped; the climate. */
export function runDay(s: PowerHost, day: number): { power: PowerState; tank?: TankState; d: PowerDay } {
  const p = powerOf(s.power);
  const { solar, need } = forecastDay(s);
  const batCap = has(s, 'battery') ? batteryUsable(s) * quality(p, 'battery') : 0;
  const supply = solar + p.battery * (partOf(s, 'battery')?.eff ?? POWER.batteryEff);
  const fromSupply = Math.min(need, supply);
  const short = need - fromSupply;
  const genOk = has(s, 'generator');
  const g = partOf(s, 'generator')!;
  // a biogas generator burns the cows' manure first, diesel only for the rest
  const gas = genOk ? Math.min(short, (g.biogas ?? 0) * tankOf(s.tank).herd.cows) : 0;
  const perL = g.size || POWER.genKwhPerL;
  const fromDiesel = genOk ? Math.min(short - gas, p.fuel * perL) : 0;
  const gen = gas + fromDiesel;
  const fuelL = fromDiesel / perL;
  const used = fromSupply + gen;
  const served = need > 0 ? used / need : 1;
  const battery = Math.min(batCap, Math.max(0, supply - fromSupply));
  // the pump lifts pond water into the tank (as much as it was powered)
  const pumpShare = p.loads.includes('pump') ? served : 0;
  const t = tankOf(s.tank);
  const room = Math.max(0, capacityOf(s) - t.level);
  const water = Math.round(Math.min(room, POWER.pumpLitres * pumpShare));
  const avoided = round((used - gen) * POWER.avoidedCo2 + 0);
  const emitted = round(fuelL * POWER.dieselCo2);
  const saved = round(used * POWER.gridPrice - fuelL * POWER.dieselPrice);
  const d: PowerDay = { day, solar: round(solar), gen: round(gen), need: round(need), used: round(used), served: round(served, 3), fuelL: round(fuelL), water, battery: round(battery), avoided, emitted, saved };
  const tot = p.totals;
  const power: PowerState = {
    ...p,
    fuel: round(Math.max(0, p.fuel - fuelL)),
    battery: round(battery),
    day,
    history: [d, ...p.history].slice(0, POWER.keep),
    totals: {
      solar: round(tot.solar + d.solar),
      gen: round(tot.gen + d.gen),
      used: round(tot.used + d.used),
      fuelL: round(tot.fuelL + d.fuelL),
      water: tot.water + water,
      avoided: round(tot.avoided + avoided),
      emitted: round(tot.emitted + emitted),
      saved: round(tot.saved + saved),
      days: tot.days + 1,
    },
  };
  return { power, tank: water ? { ...t, level: t.level + water } : undefined, d };
}

/** Every load the system can power now, switched on or not. */
export const loadsAvailable = (s: Pick<PowerHost, 'power'>) => LOAD_IDS.filter(id => id !== 'lights' || has(s, 'lights'));
export const partsDone = (s: Pick<PowerHost, 'power'>) => PART_IDS.filter(id => has(s, id)).length;
