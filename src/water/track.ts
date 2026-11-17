/* Water through the day, as climate tracking does: each action first settles any calendar day (or farm day, on the
   fast clock) that has ended, then counts what the action did to the water. */

import { addEntry } from '../wallet/model';
import type { Action, GameState } from '../state';
import { toast } from '../state';
import { payClock } from '../climate/track';
import { daysBetween } from '../achievements/model';
import { dayText } from '../training/data';
import { earn, CREDIT_TYPES } from '../credits/ledger';
import { money } from '../money';
import { checkKey, hazardFor } from '../trials/model';
import { treatmentOf } from '../care/treatments';
import { WATER } from './config';
import { coverPayout, deliveredShare, tankOf, waterDay } from './model';

/** Ends the days that have passed: the tank, the dam and the day's water credits (paid at once). */
export function settleWater(s: GameState, today = payClock.today(), farmDay?: number): GameState {
  if (s.fs.phase !== 'done') return s;
  let tank = tankOf(s.tank);
  if (tank.day === null) return { ...s, tank: { ...tank, day: today } };
  const gap = daysBetween(tank.day, today);
  const days = farmDay ? 1 : Math.min(WATER.catchUpDays, gap);
  if (days <= 0) return s;
  let credits = 0;
  let short = 0;
  for (let i = 0; i < days; i++) {
    const r = waterDay(s, tank, farmDay ? `Farm day ${farmDay}` : dayText(tank.day ?? today), today);
    tank = r.tank;
    credits += r.day.credits;
    short += r.day.short;
  }
  tank = { ...tank, day: farmDay ? tank.day : today };
  let next: GameState = { ...s, tank };
  // the farms' irrigation from the shared catchment, as the harvest will count it
  if (next.trial && next.trial.phase === 'growing') next = { ...next, trial: { ...next.trial, delivered: deliveredShare(tank, next.trial.cycle) } };
  const coins = Math.round(credits * CREDIT_TYPES.water.rate);
  if (credits > 0) next = { ...next, coins: next.coins + coins, ledger: earn(next.ledger, 'water', credits, coins, farmDay ? `Farm day ${farmDay}` : `${days} day${days > 1 ? 's' : ''} to ${today}`, today) };
  if (credits > 0) next = addEntry(next, 'water', `Water credits · ${farmDay ? `farm day ${farmDay}` : today}`, coins, next.coins, { credits: Math.round(credits * 100) / 100 });
  if (short > 0) next = { ...next, toast: toast(`The tank ran dry: ${Math.round(short).toLocaleString('en-US')} L short for the house and the animals. Buy water in Water.`) };
  return next;
}

export function trackWater(prev: GameState, s: GameState, a: Action): GameState {
  if (a.type === 'reset') return s;
  let next = a.type === 'trialNextDay' ? s : settleWater(s);
  switch (a.type) {
    // a night slept on the fast clock ends a farm day
    case 'trialNextDay': {
      const day = prev.trial?.day ?? 0;
      if (s.trial && prev.trial && s.trial.day > day) next = settleWater(next, undefined, day);
      break;
    }
    // a drought treated by hand draws its water from the tank
    case 'fieldMark':
    case 'trialCheck': {
      const t = s.trial;
      const t0 = prev.trial;
      if (!t || !t0) break;
      const days = a.type === 'trialCheck' ? [a.day] : /^t(\d)$/.test(a.job) ? [Number(a.job.slice(1))] : [];
      for (const d of days) {
        const ck = checkKey(a.farm, d);
        if (t0.checks[ck]?.treated || !t.checks[ck]?.treated) continue;
        const h = hazardFor(t0, a.farm, d);
        if (h !== 'drought') continue;
        const litres = treatmentOf(h, t.checks[ck]?.treatment)?.water ?? WATER.droughtTreat;
        const tank = tankOf(next.tank);
        next = { ...next, tank: { ...tank, level: Math.max(0, tank.level - litres) } };
      }
      break;
    }
    // crop cover pays out at harvest for what drought, flood and hail took
    case 'trialHarvest': {
      const t = s.trial;
      const tank = tankOf(next.tank);
      if (!t?.results || prev.trial?.phase !== 'growing' || !tank.cover || tank.cover.cycle !== t.cycle) break;
      const pay = coverPayout(t);
      if (pay > 0) next = { ...next, coins: next.coins + pay, tank: { ...tank, paidOut: tank.paidOut + pay }, toast: toast(`Crop cover paid ${money(pay)} for the weather's damage`) };
      break;
    }
  }
  return next;
}
