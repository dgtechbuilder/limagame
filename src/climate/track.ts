/* Climate tracking, wired to the game: after every action, look at what it actually did (a task finished, a plan
   planted, a tile ploughed from the tractor seat, a treatment done, a harvest sold) and record its climate effect.
   Kept out of the main reducer so the farming rules stay readable; the numbers are in model.ts. */

import { pumpCo2, type Source } from './model';
import { earn } from '../credits/ledger';
import { addEntry } from '../wallet/model';
import { powerOn } from '../power/model';
import { TREATMENTS, treatmentOf, type Treatment } from '../care/treatments';
import { ROWS_PER_FARM } from '../strategy/data';
import { chosen, hasStrategies, strategiesOf } from '../strategy/model';
import { TILES, TREAT_JOB, popcount } from '../world/field';
import { checkKey, farmName, hazardFor, optionOf, type Trial } from '../trials/model';
import { toast, SELLING, SOLD, type Action, type GameState } from '../state';
import { achClock } from '../achievements/track';
import { daysBetween } from '../achievements/model';
import { dayText } from '../training/data';
import { money } from '../money';
import { practiceOf } from '../csa/data';
import { REST } from '../soil/model';
import { PAY, areasDelta, areasOf, coinsFor, landOf, landWords, payRate } from './land';
import {
  creditsOf,
  payOf,
  SHOCKS,
  TASK_CLIMATE,
  TRACTOR_LPA,
  closeSeason,
  contractorDiesel,
  marketDelta,
  planDelta,
  record,
  routineDelta,
  tractorWork,
  treatDelta,
  waterTask,
  wrongFixDelta,
  type Delta,
  type Where,
} from './model';

/** Solar power, once its reward is redeemed, runs the pumps, the cold store and the mill. */
export const hasSolar = (s: GameState) => s.redeemed.includes('solar') || powerOn(s);

/** The clock the daily payment counts in: the player's own calendar day (the same clock as the daily streak). */
export const payClock = { today: () => achClock.today() };

let payId = 0;

/** Ends the days that have passed: records the land's carbon for them (the land as it stood, from `land`), and pays
    every credit earned since the last payment. `farmDay`: one night slept on the fast clock of the first cycle,
    which ends a farm day without the calendar day turning. Nothing happens before the farm opens. */
export function settleDays(land: GameState, s: GameState, today = payClock.today(), farmDay?: number): GameState {
  if (s.fs.phase !== 'done') return s;
  const c = s.climate;
  const pay = payOf(c);
  // the first day counted: from now on (credits earned before are not paid again)
  if (pay.day === null) return { ...s, climate: { ...c, pay: { ...pay, day: today, creditsAt: c.credits } } };
  const gap = daysBetween(pay.day, today);
  // a clock set back: nothing is counted until it passes the last day again
  if (gap < 0 && !farmDay) return s;
  const days = farmDay ? 1 : Math.min(PAY.catchUpDays, gap);
  if (days <= 0) return s;

  const l = landOf(land);
  const areas = areasOf(land);
  const when = farmDay ? `Farm day ${farmDay}` : days > 1 ? `${dayText(pay.day)} + ${days - 1} more day${days > 2 ? 's' : ''}` : dayText(pay.day);
  const d = areasDelta(areas, days);
  const { c: c1, levelUp } = record(c, `Farm areas · ${when}: six farms ${landWords(l)} plots, forest, animals, pond, home`, 'land', d);
  const credits = Math.max(0, c1.credits - pay.creditsAt);
  const landCredits = creditsOf(d);
  const coins = coinsFor(credits, c1.level);
  const payment = {
    id: Date.now() + ++payId,
    label: when,
    date: today,
    days,
    farmed: l.farmed,
    bare: l.bare,
    idle: l.idle,
    landCredits,
    workCredits: Math.max(0, credits - landCredits),
    credits,
    rate: payRate(c1.level),
    coins,
    areas: areas.map(a => ({ id: a.id, stored: a.stored * days, emitted: (Object.values(a.emit).reduce((n, v) => n + (v ?? 0), 0) as number) * days })),
  };
  const totals = { ...(pay.areas ?? {}) };
  for (const a of areas) {
    const t = totals[a.id] ?? { stored: 0, emitted: 0, water: 0 };
    totals[a.id] = { stored: t.stored + a.stored * days, emitted: t.emitted + (Object.values(a.emit).reduce((n, v) => n + (v ?? 0), 0) as number) * days, water: t.water + a.water * days };
  }
  const pay1 = {
    ...pay,
    day: farmDay ? pay.day : today,
    creditsAt: c1.credits,
    paid: pay.paid + coins,
    creditsPaid: pay.creditsPaid + credits,
    payments: coins > 0 ? [payment, ...pay.payments].slice(0, 30) : pay.payments,
    plotDays: { farmed: pay.plotDays.farmed + l.farmed * days, bare: pay.plotDays.bare + l.bare * days, idle: pay.plotDays.idle + l.idle * days },
    landKg: { stored: pay.landKg.stored + l.stored * days, lost: pay.landKg.lost + l.lost * days },
    areas: totals,
  };
  let next: GameState = { ...s, climate: { ...c1, pay: pay1 }, coins: s.coins + coins, ledger: coins > 0 ? earn(s.ledger, 'co2', credits, coins, when, today) : s.ledger };
  // into the farmer's wallet, with its own words (src/wallet)
  if (coins > 0) next = addEntry(next, 'climate', `Climate payment · ${when}`, coins, next.coins, { credits: Math.round(credits * 100) / 100 });
  if (levelUp) next = { ...next, points: next.points + levelUp.points, toast: toast(`Climate level up: ${levelUp.name} · +${levelUp.points} points`) };
  if (coins > 0)
    next = {
      ...next,
      award: {
        id: payment.id,
        title: `Climate payment: +${money(coins)}`,
        line: `${when} · ${Math.round(credits * 10) / 10} credits from the forest, the farms and your work`,
      },
    };
  return next;
}

/** A treatment done a chosen way: its climate effects for the farm. */
function treatmentDelta(w: Treatment, solar: boolean): Delta {
  const water = w.water ?? 0;
  return {
    emit: { chemicals: w.co2 ?? 0, ...(water ? { water: pumpCo2(water, solar) } : {}) },
    water,
    soil: w.soil ?? 0,
    pollution: w.pollution ?? 0,
    stored: w.stored ?? 0,
    sprays: (w.pollution ?? 0) >= 3 ? 1 : 0,
  };
}

/** Where each strategy dimension's emissions go on the climate page. */
const DIM_SOURCE: Record<string, Source> = { fert: 'fertilizer', fertTiming: 'fertilizer', till: 'fuel', mulch: 'chemicals', seed: 'seed', crop: 'seed' };

/** A farm's row strategies over the cycle, for the climate ledger (null: every row as the plan). */
function strategyDelta(t: Trial, farm: number, solar: boolean): { delta: Delta; smart: number } | null {
  if (!hasStrategies(t, farm)) return null;
  const emit: Partial<Record<Source, number>> = {};
  let stored = 0;
  let water = 0;
  let soil = 0;
  let pollution = 0;
  let smart = 0;
  for (const st of strategiesOf(t, farm))
    for (const { dim, option } of chosen(st)) {
      const src = DIM_SOURCE[dim] ?? 'seed';
      if (option.co2) emit[src] = (emit[src] ?? 0) + option.co2;
      stored += option.stored ?? 0;
      water += option.water ?? 0;
      soil += (option.soil ?? 0) / ROWS_PER_FARM;
      pollution += option.pollution ?? 0;
      if (option.smart) smart++;
    }
  // water saved (negative) is less pumping
  if (water) emit.water = (emit.water ?? 0) + pumpCo2(water, solar);
  return { delta: { emit, stored, water, soil, pollution }, smart };
}

export function trackClimate(prev: GameState, s: GameState, a: Action): GameState {
  // a day that ended before this action is settled first, with the land as it stood then
  let next = a.type === 'reset' ? s : settleDays(prev, s);
  const solar = hasSolar(prev);
  const log = (label: string, where: Where, d: Delta) => {
    const { c, levelUp } = record(next.climate, label, where, d);
    next = { ...next, climate: c };
    if (levelUp) next = { ...next, points: next.points + levelUp.points, toast: toast(`Climate level up: ${levelUp.name} · +${levelUp.points} points`) };
  };
  const shock = (hazard: string | undefined, right: boolean) => {
    if (!hazard || !(SHOCKS as string[]).includes(hazard)) return;
    next = { ...next, climate: { ...next.climate, shocks: { met: next.climate.shocks.met + 1, handled: next.climate.shocks.handled + (right ? 1 : 0) } } };
  };

  switch (a.type) {
    // Farm Moja: a farming-step task done
    case 'task': {
      if (s.doneTasks.length === prev.doneTasks.length) break;
      const litres = /^w-(\d+)$/.exec(a.id);
      const d = litres ? waterTask(Number(litres[1]), solar) : TASK_CLIMATE[a.id];
      if (d) log(`Farm Moja · ${a.name}`, 'season', d);
      break;
    }
    // Farm Moja: the harvest sold; the season closes
    case 'completeSale': {
      if (prev.stage !== SELLING || s.stage !== SOLD || !prev.harvested) break;
      const sold = s.history[s.history.length - 1]?.bagsSold ?? 0;
      log(`Farm Moja · ${sold} bags to market`, 'market', marketDelta({ bagsHarvested: prev.harvested.bags, bagsSold: sold, storage: prev.storage, processId: a.processId, solar }));
      next = { ...next, climate: closeSeason(next.climate, `Farm Moja · season ${prev.season}`) };
      break;
    }
    // Six farms: each plan's inputs go in at planting
    // the farms are planted: from the plan, or (the first planting period) as soon as the cycle starts
    case 'trialNew':
    case 'trialPlant': {
      const t = s.trial;
      if (!t || t.phase !== 'growing' || (prev.trial?.phase === 'growing' && prev.trial.cycle === t.cycle)) break;
      t.plans.forEach((p, i) => {
        // a resting farm (src/soil): no inputs, its soil comes back (the carbon its plants store is paid daily: land.ts)
        const rest = t.rest?.[i];
        if (rest) return log(`${farmName(i)} resting · ${REST[rest].short.toLowerCase()}`, 'farms', { soil: REST[rest].soil / 10 });
        log(`${farmName(i)} planted · ${optionOf('land', p).label}, ${optionOf('fert', p).label.toLowerCase()}, ${optionOf('pest', p).label.toLowerCase()}`, 'farms', planDelta(p, t.forecast, solar));
      });
      break;
    }
    // A check read: climate shocks met; a treatment paid at once (the six farms screen, not the farm world)
    case 'trialCheck': {
      const t = prev.trial;
      if (!t || !s.trial) break;
      const key = checkKey(a.farm, a.day);
      const h = hazardFor(t, a.farm, a.day);
      if (!t.checks[key]) shock(h, a.right);
      if (!t.checks[key]?.treated && s.trial.checks[key]?.treated) {
        const job = TREAT_JOB[h];
        if (job) log(`${farmName(a.farm)} · treated (${h})`, 'checks', treatDelta(job, solar));
      }
      break;
    }
    case 'roundResult': {
      if (!prev.rounds.done[a.id] || prev.rounds.day !== a.day) shock(a.hazard, a.right);
      break;
    }
    // Climate Smart Agriculture: today's drill earns climate credits, for each star (src/csa)
    case 'csaDone': {
      const d0 = prev.csa?.drill?.days ?? 0;
      const d1 = s.csa?.drill;
      if (!d1 || d1.days <= d0 || !d1.credits) break;
      log(`Climate-smart drill · ${practiceOf(a.id).name} (${'★'.repeat(d1.stars ?? 0)})`, 'csa', { credits: d1.credits });
      break;
    }
    // The farm world: work by hand or from the tractor seat
    case 'fieldMark': {
      const t: Trial | null = s.trial;
      if (!t) break;
      const key = `${a.farm}:${a.job}`;
      const before = prev.field.cycle === s.field.cycle ? (prev.field.marks[key] ?? 0) : 0;
      // a tractor worked a plot: diesel for the tiles it covered, scaled by the type of tractor (fuel use is in plots/data)
      if (a.tractor && a.job in TRACTOR_LPA) {
        const newly = popcount((s.field.marks[key] ?? 0) & ~before);
        if (newly > 0) {
          const type = a.rig?.tractor ?? 'standard';
          const words: Record<string, string> = { prep: 'ploughed', sow: 'sown', setupFeed: 'fertilized', weeding: 'weeded', borer: 'sprayed against stalk borer', topdress: 'top-dressed', spray: 'sprayed', harvest: 'harvested' };
          log(`${farmName(a.farm)} ${words[a.job]} · ${newly} plot${newly > 1 ? 's' : ''} by ${type} tractor`, 'tractor', tractorWork(a.job, newly / TILES, type));
        }
      }
      // a treatment finished by hand
      const tr = /^t(\d)$/.exec(a.job);
      if (tr && prev.trial) {
        const ck = checkKey(a.farm, Number(tr[1]));
        if (!prev.trial.checks[ck]?.treated && t.checks[ck]?.treated) {
          const h = hazardFor(prev.trial, a.farm, Number(tr[1]));
          const job = TREAT_JOB[h];
          // a treatment done another way than the standard one: its own climate effects (care/treatments.ts)
          const way = treatmentOf(h, t.checks[ck]?.treatment);
          if (way && way !== TREATMENTS[h]?.[0]) log(`${farmName(a.farm)} · ${way.label.toLowerCase()} (${h})`, 'field', treatmentDelta(way, solar));
          else if (job) log(`${farmName(a.farm)} · ${job === 'weed' ? 'weeded by hand' : `treated (${h})`}`, 'field', treatDelta(job, solar));
        }
      }
      // scheduled care finished
      const was = prev.trial?.routine ?? [];
      (t.routine ?? []).filter(k => !was.includes(k)).forEach(k => {
        const job = k.split(':')[1];
        log(`${farmName(a.farm)} · ${job === 'borer' ? 'stalk-borer spray' : job === 'topdress' ? 'top-dress' : 'weeding'}${a.tractor ? ' by tractor' : ' by hand'}`, 'field', routineDelta(job, !!a.tractor, solar));
      });
      // follow-up care finished
      const before2 = prev.trial?.followUps ?? [];
      (t.followUps ?? []).forEach((u, i) => {
        if (u.done && before2[i] && !before2[i].done) log(`${farmName(u.farm)} · follow-up (${u.job})`, 'field', treatDelta(u.job, solar));
      });
      break;
    }
    // A wrong fix still went on the field
    case 'prescribe': {
      if (a.right) break;
      const d = wrongFixDelta(a.pick);
      if (d) log(`${farmName(a.farm)} · wrong fix (${a.pick})`, 'field', d);
      break;
    }
    // A tractor drive: the diesel it really burned; the first clean drive on a farm this cycle earns a credit (a retry
    // burns diesel again, but earns no second credit)
    case 'tractorDone': {
      if (a.diesel === undefined) break;
      const first = !prev.trial?.tractor?.[a.farm];
      next = { ...next, climate: { ...next.climate, drives: { n: next.climate.drives.n + 1, clim: next.climate.drives.clim + (a.clim ?? 0) } } };
      log(`${farmName(a.farm)} · tractor drive (climate ${a.clim ?? 0}/100)`, 'tractor', {
        diesel: a.diesel,
        emit: { fuel: a.co2 ?? 0 },
        pollution: a.diesel * 0.5,
        credits: first && (a.clim ?? 0) >= 80 ? 1 : 0,
      });
      break;
    }
    // Six farms harvested: a contractor's diesel where nobody ploughed by tractor; food grown and lost; the cycle closes
    case 'trialHarvest': {
      const t = s.trial;
      if (!t?.results || prev.trial?.phase !== 'growing') break;
      t.plans.forEach((p, i) => {
        if (p.land !== 'tractor' || t.rest?.[i]) return;
        const drove = !!t.tractor?.[i] || popcount(s.field.byTractor?.[`${i}:prep`] ?? 0) > 0;
        if (!drove) log(`${farmName(i)} · ploughed by a hired tractor`, 'tractor', contractorDiesel());
      });
      // each farm's row strategies: their emissions, carbon, water and soil over the cycle (src/strategy)
      t.plans.forEach((_, i) => {
        if (t.rest?.[i]) return;
        const d = strategyDelta(t, i, solar);
        if (d) log(`${farmName(i)} · row strategies (${d.smart} climate-smart choice${d.smart === 1 ? '' : 's'})`, 'farms', d.delta);
      });
      const kg = t.results.reduce((n, r) => n + (r.bags + r.beans) * 90, 0);
      const lost = t.results.reduce((n, r) => n + (r.lost > 0 && r.lost < 1 ? (r.bags * r.lost) / (1 - r.lost) : 0) * 90, 0);
      log(`Six farms harvested · ${Math.round(kg)} kg grown`, 'farms', { yieldKg: kg, foodLoss: lost });
      next = { ...next, climate: closeSeason(next.climate, `Six farms · cycle ${t.cycle}`) };
      break;
    }
    // a night slept on the fast clock: a farm day ends, with the land as it stood that day, and is paid
    case 'trialNextDay': {
      const day = prev.trial?.day ?? 0;
      if (s.trial && prev.trial && s.trial.day > day) next = settleDays(prev, next, undefined, day);
      break;
    }
  }
  return next;
}
