/* A filled-in climate record for design review: one Farm Moja season and one cycle of two farms, played through the
   same rules the game uses. */

import { COMMON_PLAN, type Plan } from '../trials/model';
import { AREA_SIZE, LAND_FACTORS, coinsFor, payRate, type LandNow } from './land';
import { PLOT_ACRES } from '../farmSize';
import { TASK_CLIMATE, closeSeason, creditsOf, initialPay, initialClimate, marketDelta, planDelta, record, tractorWork, treatDelta, waterTask, wrongFixDelta, type ClimateState, type Delta, type Payment, type Where } from './model';

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
  // three days of every area: Farm 1 and Farm 2 planted (Farm 2 with mulch, beans and manure), Farm 3 ploughed but
  // bare; the forest, the pen, the animals and the house every day
  let creditsAt = c.credits;
  const payments: Payment[] = [];
  const plot = (n: number, rate: number) => n * PLOT_ACRES * rate;
  const days: [string, Pick<LandNow, 'farmed' | 'bare' | 'idle' | 'stored' | 'lost'>][] = [
    ['Fri 13 Nov', { farmed: 20, bare: 20, idle: 80, stored: plot(20, 1), lost: plot(20, 2) }],
    ['Sat 14 Nov', { farmed: 40, bare: 10, idle: 70, stored: plot(20, 1) + plot(20, 4.5), lost: plot(10, 2) }],
    ['Sun 15 Nov', { farmed: 60, bare: 0, idle: 60, stored: plot(40, 1) + plot(20, 4.5), lost: 0 }],
  ];
  const forest = AREA_SIZE.forest * LAND_FACTORS.forest.value;
  const pen = AREA_SIZE.pasture * LAND_FACTORS.pasture.value;
  const animals = AREA_SIZE.cows * (LAND_FACTORS.cowMethane.value + LAND_FACTORS.cowManure.value) + AREA_SIZE.hens * LAND_FACTORS.henManure.value;
  const cook = LAND_FACTORS.cooking.value;
  const drink = AREA_SIZE.cows * LAND_FACTORS.cowWater.value + AREA_SIZE.hens * LAND_FACTORS.henWater.value;
  const plotDays = { farmed: 0, bare: 0, idle: 0 };
  const landKg = { stored: 0, lost: 0 };
  const areas: Record<string, { stored: number; emitted: number; water: number }> = {};
  const add = (id: string, stored: number, emitted: number, water: number) => {
    const t = areas[id] ?? { stored: 0, emitted: 0, water: 0 };
    areas[id] = { stored: t.stored + stored, emitted: t.emitted + emitted, water: t.water + water };
  };
  days.forEach(([label, l], i) => {
    const d: Delta = {
      stored: l.stored + forest + pen,
      emit: { livestock: animals, cooking: cook, ...(l.lost ? { soil: l.lost } : {}) },
      water: drink + LAND_FACTORS.houseWater.value,
      ...(l.lost ? { credits: -l.lost / 10, soil: -l.bare * LAND_FACTORS.bareSoil.value } : {}),
    };
    if (i === 0) go('Farm 3 · tractor drive (climate 88/100)', 'tractor', { diesel: 38, emit: { fuel: 102 }, pollution: 19, credits: 1 });
    if (i === 1) go('Farm 2 · weeded by hand', 'field', treatDelta('weed', false));
    go(`Farm areas · ${label}: six farms ${l.farmed} farmed${l.bare ? ` · ${l.bare} bare` : ''} · ${l.idle} idle plots, forest, animals, pond, home`, 'land', d);
    const credits = c.credits - creditsAt;
    creditsAt = c.credits;
    const landCredits = creditsOf(d);
    const dayAreas = [
      { id: 'farms', stored: l.stored, emitted: l.lost },
      { id: 'forest', stored: forest, emitted: 0 },
      { id: 'pasture', stored: pen, emitted: 0 },
      { id: 'animals', stored: 0, emitted: animals },
      { id: 'homestead', stored: 0, emitted: cook },
    ];
    payments.unshift({ id: i + 1, label, date: `2026-11-${14 + i}`, days: 1, ...l, landCredits, workCredits: Math.max(0, credits - landCredits), credits, rate: payRate(c.level), coins: coinsFor(credits, c.level), areas: dayAreas });
    add('farms', l.stored, l.lost, 0);
    add('forest', forest, 0, 0);
    add('pasture', pen, 0, 0);
    add('animals', 0, animals, drink);
    add('homestead', 0, cook, LAND_FACTORS.houseWater.value);
    plotDays.farmed += l.farmed;
    plotDays.bare += l.bare;
    plotDays.idle += l.idle;
    landKg.stored += l.stored;
    landKg.lost += l.lost;
  });
  const paid = payments.reduce((n, p) => n + p.coins, 0);
  const creditsPaid = payments.reduce((n, p) => n + p.credits, 0);
  return {
    ...c,
    shocks: { met: 5, handled: 4 },
    drives: { n: 1, clim: 82 },
    pay: { ...initialPay, day: '2026-11-16', creditsAt, paid, creditsPaid, payments, plotDays, landKg, areas },
  };
}

export const CLIMATE_SAMPLE = build();
