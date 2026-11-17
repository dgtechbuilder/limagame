import { expect, test } from '@playwright/test';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { AREA_SIZE, LAND_FACTORS, LAND_PLOTS, PAY, areasOf, coinsFor, farmedRate, landOf, payRate } from '../src/climate/land';
import { payOf } from '../src/climate/model';
import { FARM_ACRES, PLOT_ACRES } from '../src/farmSize';
import { money, toUsd } from '../src/money';
import { COMMON_PLAN, POTENTIAL_BAGS, type Plan } from '../src/trials/model';
import { TRIAL_SAMPLES } from '../src/trials/samples';
import { FULL } from '../src/world/field';
import { ledgerOf } from '../src/credits/ledger';

/* Every area of the farm, evaluated each day, and the daily climate payment in US dollars, without a browser: what
   each plot of the six 4-acre farms is each day, the forest, the pen, the animals, the pond and the house, the carbon
   each stores or gives off, and the dollars paid for the credits at the end of the day. */

let day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

const farm = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  onboarded: true,
  fs: { phase: 'done', at: 'first', opened: true },
  farmer: { name: 'Wanjiku', look: 0 },
  coins: 1000,
  ...patch,
});
const tick = (s: GameState) => reducer(s, { type: 'climateTick' });
const area = (s: GameState, id: string) => areasOf(s).find(a => a.id === id)!;
/** a day's credits from the areas other than the six farms (the forest and the pen) */
const fixedCredits = (AREA_SIZE.forest * LAND_FACTORS.forest.value + AREA_SIZE.pasture * LAND_FACTORS.pasture.value) / 10;

test('the six farms are 4 acres each: 20 plots of a fifth of an acre, 144 bags a farm at best', () => {
  expect(FARM_ACRES).toBe(4);
  expect(PLOT_ACRES).toBeCloseTo(0.2, 6);
  expect(POTENTIAL_BAGS).toBe(144);
  expect(AREA_SIZE.farms).toBe(24);
});

test('money is in US dollars: a stored amount is 10 shillings, at 129 to the dollar', () => {
  expect(money(129)).toBe('$10');
  expect(money(12.9)).toBe('$1');
  expect(money(40)).toBe('$3.10');
  expect(money(30000)).toBe('$2,326');
  expect(money(-40)).toBe('−$3.10');
  expect(initialState.coins).toBe(30000);
});

test('land: no crop is idle land; plots planted are farmed, cleared but unplanted are bare', () => {
  const none = landOf(farm());
  expect(LAND_PLOTS).toBe(120);
  expect([none.farmed, none.bare, none.idle]).toEqual([0, 0, 120]);
  expect(none.credits).toBe(0);

  // the first cycle in the farm world: Farm 1 cleared, 8 of its plots planted; Farm 2 starts cleared; Farms 3–6 idle
  const l = landOf(farm({ view: 'world', trial: TRIAL_SAMPLES.worldPlanting, field: TRIAL_SAMPLES.worldPlantingField }));
  expect([l.farmed, l.bare, l.idle]).toEqual([8, 32, 80]);
  expect(l.farms[1].uses.every(u => u === 'bare')).toBe(true);
  expect(l.farms.slice(2).every(f => f.uses.every(u => u === 'idle'))).toBe(true);
  // a farmed acre stores 1 kg CO₂ a day, a bare acre loses 2: 8 farmed plots store less than 32 bare ones lose
  expect(l.stored).toBeCloseTo(8 * 0.2 * 1, 6);
  expect(l.lost).toBeCloseTo(32 * 0.2 * 2, 6);
  expect(l.credits).toBe(0);

  // a harvested plot is idle again
  const field = { ...TRIAL_SAMPLES.worldPlantingField, marks: { ...TRIAL_SAMPLES.worldPlantingField.marks, '0:sow': FULL, '0:harvest': 0b1111 } };
  const h = landOf(farm({ view: 'world', trial: TRIAL_SAMPLES.worldPlanting, field }));
  expect(h.farms[0].uses.filter(u => u === 'farmed').length).toBe(16);
});

test('climate-smart practices store more carbon a day; tillage and burning store less', () => {
  const mulch: Plan = { ...COMMON_PLAN, land: 'mulch', seed: 'intercrop', fert: 'manure' };
  expect(farmedRate(COMMON_PLAN).rate).toBeCloseTo(1, 6);
  expect(farmedRate(mulch).rate).toBeCloseTo(1 + 1.5 + 1 + 1, 6);
  expect(farmedRate({ ...COMMON_PLAN, land: 'tractor' }).rate).toBeCloseTo(0.7, 6);
  expect(farmedRate({ ...COMMON_PLAN, land: 'slash' }).rate).toBeCloseTo(0.2, 6);
});

test('every area is evaluated: the forest stores, the cows give off methane, the house cooks, the pond is drawn on', () => {
  const s = farm();
  const ids = areasOf(s).map(a => a.id);
  expect(ids).toEqual(['farms', 'moja', 'forest', 'pasture', 'animals', 'pond', 'homestead']);
  expect(area(s, 'forest').stored).toBeCloseTo(110, 6);
  expect(area(s, 'forest').tone).toBe('good');
  expect(area(s, 'animals').emit.livestock).toBeCloseTo(2 * (4.6 + 0.6) + 4 * 0.02, 6);
  expect(area(s, 'animals').water).toBeCloseTo(2 * 50 + 4 * 0.3, 6);
  expect(area(s, 'homestead').emit.cooking).toBeCloseTo(3, 6);
  // the pond is clean until the season's runoff muddies it
  expect(area(s, 'pond').tone).toBe('good');
  const muddy = farm({ climate: { ...s.climate, season: { ...s.climate.season, pollution: 3000 } } });
  expect(area(muddy, 'pond').tone).toBe('bad');
  // Farm Moja: bare once cleared, farmed once seeded, idle after the harvest
  expect(area(farm({ doneTasks: ['clearing'] }), 'moja').lost).toBeGreaterThan(0);
  expect(area(farm({ doneTasks: ['clearing', 'seeding', 'lp-manure'] }), 'moja').stored).toBeCloseTo(2, 6);
  expect(area(farm({ doneTasks: ['clearing', 'seeding'], stage: 6 }), 'moja').stored).toBe(0);
});

test('the end of a day pays every credit earned since the last payment, from every area and the work', () => {
  day = '2026-11-15';
  // six farms planted on the classic farm: every plot of every farm in the plan is farmed
  const trial = TRIAL_SAMPLES.sixGrowing;
  let s = tick(farm({ view: 'classic', trial }));
  expect(payOf(s.climate).day).toBe(day);
  expect(s.coins).toBe(1000);
  const land = landOf(s);
  expect(land.farmed).toBe(trial.plans.length * 20);
  const areas = areasOf(s);
  const areaCredits = areas.reduce((n, a) => n + a.credits, 0);
  expect(areaCredits).toBeCloseTo(land.credits + fixedCredits, 6);

  // work today: organic manure on Farm Moja stores 40 kg (4 credits); then the acre is planted, so it stores too
  s = reducer(s, { type: 'task', step: 'landprep', id: 'lp-manure', price: 40, name: 'Organic Manure' });
  const afterTask = s.coins;
  expect(s.climate.credits).toBeCloseTo(4, 6);
  // the same day: nothing paid yet
  expect(tick(s)).toBe(s);

  // the next morning: every area's day is recorded, and the day's credits are paid in dollars
  day = '2026-11-16';
  s = tick(s);
  const pay = payOf(s.climate);
  expect(pay.payments.length).toBe(1);
  const p = pay.payments[0];
  expect(p.landCredits).toBeCloseTo(areaCredits, 6);
  expect(p.workCredits).toBeCloseTo(4, 6);
  expect(p.credits).toBeCloseTo(4 + areaCredits, 6);
  expect(p.coins).toBeCloseTo(coinsFor(p.credits, s.climate.level), 6);
  // $0.25 a credit, with the premium of the level the day's credits reached (Grower: ×1.1), to the cent
  expect(s.climate.level).toBe(1);
  expect(toUsd(p.coins)).toBeCloseTo(Math.round(p.credits * 0.25 * 1.1 * 100) / 100, 6);
  // the day's climate payment, and the water credits for the day (src/water) in the same night
  expect(s.coins).toBeCloseTo(afterTask + p.coins + ledgerOf(s.ledger).coins.water, 6);
  expect(p.label).toBe('Sun 15 Nov');
  expect(p.areas?.map(a => a.id)).toContain('forest');
  expect(s.climate.log[0].where).toBe('land');
  expect(s.climate.log[0].label).toContain(`${land.farmed} farmed`);
  expect(s.climate.co2By.livestock).toBeCloseTo(area(s, 'animals').emit.livestock!, 6);
  expect(s.climate.co2By.cooking).toBeCloseTo(3, 6);
  expect(s.climate.total.water).toBeGreaterThan(200);
  // the pop-up: the payment, unless a badge or certificate the credits won takes its place
  expect(s.award?.title).toMatch(/^(Climate payment: \+\$[\d.,]+|Certificate: .*|Badge won: .*|\d+ badges won)$/);
  expect(pay.areas?.forest.stored).toBeCloseTo(110, 6);
  expect(pay.day).toBe('2026-11-16');
  // paid once
  expect(tick(s)).toBe(s);

  // a week away: up to seven days are counted
  day = '2026-11-30';
  const back = tick(s);
  const q = payOf(back.climate).payments[0];
  expect(q.days).toBe(PAY.catchUpDays);
  expect(q.landCredits).toBeCloseTo(areaCredits * PAY.catchUpDays, 4);
});

test('bare land loses carbon and takes credits back; idle plots earn nothing, the forest still does', () => {
  day = '2026-11-15';
  // Farm 1 cleared, 8 plots planted; Farm 2 bare: the six farms lose more than they store
  let s = tick(farm({ view: 'world', trial: TRIAL_SAMPLES.worldPlanting, field: TRIAL_SAMPLES.worldPlantingField }));
  day = '2026-11-16';
  s = tick(s);
  expect(s.climate.co2By.soil).toBeCloseTo(32 * 0.2 * 2, 6);
  expect(s.climate.total.soil).toBeLessThan(0);
  // the bare soil's loss takes back part of the forest's credits
  const lost = (32 * 0.2 * 2 - 8 * 0.2) / 10;
  expect(s.climate.credits).toBeCloseTo(fixedCredits - lost, 6);

  // all six farms idle: only the forest and the pen are paid
  let i = tick(farm());
  day = '2026-11-17';
  i = tick(i);
  expect(payOf(i.climate).payments[0].credits).toBeCloseTo(fixedCredits, 6);
  expect(payOf(i.climate).payments[0].farmed).toBe(0);
});

test('a night slept on the fast clock ends a farm day and pays it', () => {
  day = '2026-11-15';
  const trial = { ...TRIAL_SAMPLES.sixGrowing, clock: 'fast' as const, day: 1, checks: Object.fromEntries(TRIAL_SAMPLES.sixGrowing.plans.map((_, i) => [`${i}:1`, { right: true, tries: 1, treated: false }])) };
  let s = tick(farm({ view: 'classic', trial }));
  s = reducer(s, { type: 'trialNextDay' });
  expect(s.trial?.day).toBe(2);
  const p = payOf(s.climate).payments[0];
  expect(p.label).toBe('Farm day 1');
  expect(p.coins).toBeGreaterThan(0);
  expect(s.coins).toBeCloseTo(1000 + p.coins + ledgerOf(s.ledger).coins.water, 6);
  // the calendar day is still today: it is counted at midnight as usual
  expect(payOf(s.climate).day).toBe('2026-11-15');
});

test('nothing is counted or paid before the farm opens; a higher climate level pays more a credit', () => {
  day = '2026-11-15';
  const first = { ...farm({ view: 'classic', trial: TRIAL_SAMPLES.sixGrowing }), fs: { phase: 'walk1' as const, at: 'first' as const, opened: false } };
  expect(tick(first)).toBe(first);
  expect(toUsd(payRate(0))).toBeCloseTo(0.25, 6);
  expect(payRate(4)).toBeGreaterThan(payRate(1));
  expect(coinsFor(10, 4)).toBeGreaterThan(coinsFor(10, 0));
});
