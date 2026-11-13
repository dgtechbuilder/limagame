/* Climate tracking, wired to the game: after every action, look at what it actually did (a task finished, a plan
   planted, a tile ploughed from the tractor seat, a treatment done, a harvest sold) and record its climate effect.
   Kept out of the main reducer so the farming rules stay readable; the numbers are in model.ts. */

import { TILES, TREAT_JOB, popcount } from '../world/field';
import { checkKey, farmName, hazardFor, optionOf, type Trial } from '../trials/model';
import { toast, SELLING, SOLD, type Action, type GameState } from '../state';
import {
  SHOCKS,
  TASK_CLIMATE,
  TRACTOR_LPA,
  closeSeason,
  contractorDiesel,
  marketDelta,
  planDelta,
  record,
  tractorWork,
  treatDelta,
  waterTask,
  wrongFixDelta,
  type Delta,
  type Where,
} from './model';

/** Solar power, once its reward is redeemed, runs the pumps, the cold store and the mill. */
export const hasSolar = (s: GameState) => s.redeemed.includes('solar');

export function trackClimate(prev: GameState, s: GameState, a: Action): GameState {
  let next = s;
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
      t.plans.forEach((p, i) => log(`${farmName(i)} planted · ${optionOf('land', p).label}, ${optionOf('fert', p).label.toLowerCase()}, ${optionOf('pest', p).label.toLowerCase()}`, 'farms', planDelta(p, t.forecast, solar)));
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
          const words: Record<string, string> = { prep: 'ploughed', sow: 'sown', setupFeed: 'fertilized', spray: 'sprayed', harvest: 'harvested' };
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
          if (job) log(`${farmName(a.farm)} · ${job === 'weed' ? 'weeded by hand' : `treated (${h})`}`, 'field', treatDelta(job, solar));
        }
      }
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
        if (p.land !== 'tractor') return;
        const drove = !!t.tractor?.[i] || popcount(s.field.byTractor?.[`${i}:prep`] ?? 0) > 0;
        if (!drove) log(`${farmName(i)} · ploughed by a hired tractor`, 'tractor', contractorDiesel());
      });
      const kg = t.results.reduce((n, r) => n + (r.bags + r.beans) * 90, 0);
      const lost = t.results.reduce((n, r) => n + (r.lost > 0 && r.lost < 1 ? (r.bags * r.lost) / (1 - r.lost) : 0) * 90, 0);
      log(`Six farms harvested · ${Math.round(kg)} kg grown`, 'farms', { yieldKg: kg, foodLoss: lost });
      next = { ...next, climate: closeSeason(next.climate, `Six farms · cycle ${t.cycle}`) };
      break;
    }
  }
  return next;
}
