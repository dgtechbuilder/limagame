/* A filled-in climate record for design review: one Farm Moja season and one cycle of two farms, played through the
   same rules the game uses. */

import { COMMON_PLAN, type Plan } from '../trials/model';
import { TASK_CLIMATE, closeSeason, initialClimate, marketDelta, planDelta, record, tractorWork, treatDelta, waterTask, wrongFixDelta, type ClimateState, type Delta, type Where } from './model';

function build(): ClimateState {
  let c = initialClimate;
  const go = (label: string, where: Where, d: Delta) => {
    c = record(c, label, where, d).c;
  };
  for (const [id, name] of [
    ['tilling', 'Tilling'],
    ['lp-manure', 'Organic Manure'],
    ['seeding', 'Seeding'],
    ['intercropping', 'Intercropping'],
    ['f-npk', 'Balance NPK'],
    ['f-nitrogen', 'Nitrogen'],
    ['insecticides', 'Insecticides'],
    ['herbicides', 'Herbicides'],
  ] as const)
    go(`Farm Moja · ${name}`, 'season', TASK_CLIMATE[id]);
  go('Farm Moja · 5,000 L', 'season', waterTask(5000, false));
  go('Farm Moja · 132 bags to market', 'market', marketDelta({ bagsHarvested: 150, bagsSold: 132, storage: 'coop', processId: 'processing', solar: false }));
  c = closeSeason(c, 'Farm Moja · season 1');

  const mulch: Plan = { land: 'mulch', seed: 'intercrop', date: 'rains', fert: 'manure', pest: 'scout', water: 10, harvest: 'ready' };
  const tractor: Plan = { ...COMMON_PLAN, land: 'tractor', fert: 'basalTop', pest: 'spray', water: 20 };
  go('Farm 1 planted · Hand hoe, at planting only, none', 'farms', planDelta(COMMON_PLAN, 'dry', false));
  go('Farm 2 planted · Mulch, no dig, manure only, check and treat', 'farms', planDelta(mulch, 'dry', false));
  go('Farm 3 planted · Tractor hire, planting + top-dress, spray every week', 'farms', planDelta(tractor, 'dry', false));
  go('Farm 3 ploughed · 85% from the tractor seat', 'tractor', tractorWork('prep', 0.85));
  go('Farm 3 · tractor drive (climate 82/100)', 'tractor', { diesel: 1.9, emit: { fuel: 5.1 }, pollution: 0.95, credits: 1 });
  go('Farm 1 · treated (drought)', 'field', treatDelta('water', false));
  go('Farm 2 · weeded by hand', 'field', treatDelta('weed', false));
  go('Farm 3 · wrong fix (glyphosate)', 'field', wrongFixDelta('glyphosate')!);
  go('Six farms harvested · 1,350 kg grown', 'farms', { yieldKg: 1350, foodLoss: 160 });
  c = closeSeason(c, 'Six farms · cycle 1');
  go('Farm 1 planted · Hand hoe, planting + top-dress, check and treat', 'farms', planDelta({ ...COMMON_PLAN, fert: 'basalTop', pest: 'scout' }, 'normal', false));
  return { ...c, shocks: { met: 5, handled: 4 }, drives: { n: 1, clim: 82 } };
}

export const CLIMATE_SAMPLE = build();
