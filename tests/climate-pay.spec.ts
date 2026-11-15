import { expect, test } from '@playwright/test';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { LAND_PLOTS, PAY, coinsFor, farmedRate, landOf, payRate } from '../src/climate/land';
import { payOf } from '../src/climate/model';
import { COMMON_PLAN, type Plan } from '../src/trials/model';
import { TRIAL_SAMPLES } from '../src/trials/samples';
import { FULL } from '../src/world/field';

/* Land under farming vs idle land, and the daily climate payment, without a browser: what each plot of the six
   farms is each day, the carbon it stores or loses, and the coins paid for the credits at the end of the day. */

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

test('land: no crop is idle land; plots planted are farmed, cleared but unplanted are bare', () => {
  const none = landOf(farm());
  expect(LAND_PLOTS).toBe(120);
  expect([none.farmed, none.bare, none.idle]).toEqual([0, 0, 120]);
  expect(none.credits).toBe(0);

  // the first cycle in the farm world: Farm 1 cleared, 8 of its plots planted; Farm 2 starts cleared; Farms 3–6 idle
  const l = landOf(farm({ view: 'world', trial: TRIAL_SAMPLES.worldPlanting, field: TRIAL_SAMPLES.worldPlantingField }));
  expect([l.farmed, l.bare, l.idle]).toEqual([8, 32, 80]);
  expect(l.farms[0].uses.filter(u => u === 'farmed').length).toBe(8);
  expect(l.farms[1].uses.every(u => u === 'bare')).toBe(true);
  expect(l.farms.slice(2).every(f => f.uses.every(u => u === 'idle'))).toBe(true);
  // 8 farmed plots store less than 32 bare ones lose: no land credits today
  expect(l.stored).toBeCloseTo(8 * 0.05, 6);
  expect(l.lost).toBeCloseTo(32 * 0.06, 6);
  expect(l.credits).toBe(0);

  // a harvested plot is idle again
  const field = { ...TRIAL_SAMPLES.worldPlantingField, marks: { ...TRIAL_SAMPLES.worldPlantingField.marks, '0:sow': FULL, '0:harvest': 0b1111 } };
  const h = landOf(farm({ view: 'world', trial: TRIAL_SAMPLES.worldPlanting, field }));
  expect(h.farms[0].uses.filter(u => u === 'farmed').length).toBe(16);
});

test('climate-smart practices store more carbon a day; tillage and burning store less', () => {
  const mulch: Plan = { ...COMMON_PLAN, land: 'mulch', seed: 'intercrop', fert: 'manure' };
  expect(farmedRate(COMMON_PLAN).rate).toBeCloseTo(0.05, 6);
  expect(farmedRate(mulch).rate).toBeCloseTo(0.05 + 0.05 + 0.04 + 0.03, 6);
  expect(farmedRate({ ...COMMON_PLAN, land: 'tractor' }).rate).toBeCloseTo(0.04, 6);
  expect(farmedRate({ ...COMMON_PLAN, land: 'slash' }).rate).toBeCloseTo(0.02, 6);
});

test('the end of a day pays every credit earned since the last payment, from the land and the work', () => {
  day = '2026-11-15';
  // six farms planted on the classic farm: every plot of every farm in the plan is farmed
  const trial = TRIAL_SAMPLES.sixGrowing;
  let s = tick(farm({ view: 'classic', trial }));
  expect(payOf(s.climate).day).toBe(day);
  expect(s.coins).toBe(1000);
  const land = landOf(s);
  expect(land.farmed).toBe(trial.plans.length * 20);

  // work today: organic manure on Farm Moja stores 40 kg (4 credits)
  s = reducer(s, { type: 'task', step: 'landprep', id: 'lp-manure', price: 40, name: 'Organic Manure' });
  const afterTask = s.coins;
  expect(s.climate.credits).toBeCloseTo(4, 6);
  // the same day: nothing paid yet
  expect(tick(s)).toBe(s);

  // the next morning: the land's day is recorded, and the day's credits are paid
  day = '2026-11-16';
  s = tick(s);
  const pay = payOf(s.climate);
  expect(pay.payments.length).toBe(1);
  const p = pay.payments[0];
  expect(p.landCredits).toBeCloseTo(land.credits, 6);
  expect(p.workCredits).toBeCloseTo(4, 6);
  expect(p.credits).toBeCloseTo(4 + land.credits, 6);
  expect(p.coins).toBe(coinsFor(p.credits, s.climate.level));
  expect(s.coins).toBeCloseTo(afterTask + p.coins, 6);
  expect(p.label).toBe('Sun 15 Nov');
  expect([p.farmed, p.bare, p.idle]).toEqual([land.farmed, land.bare, land.idle]);
  expect(s.climate.log[0].where).toBe('land');
  expect(s.climate.log[0].label).toContain(`${land.farmed} farmed`);
  expect(s.climate.total.stored).toBeCloseTo(40 + land.stored, 6);
  expect(s.award?.title).toContain('Climate payment');
  expect(pay.plotDays.farmed).toBe(land.farmed);
  expect(pay.day).toBe('2026-11-16');
  // paid once
  expect(tick(s)).toBe(s);

  // a week away: up to seven days of land are counted
  day = '2026-11-30';
  const back = tick(s);
  const q = payOf(back.climate).payments[0];
  expect(q.days).toBe(PAY.catchUpDays);
  expect(q.landCredits).toBeCloseTo(land.credits * PAY.catchUpDays, 6);
  expect(q.workCredits).toBeCloseTo(0, 6);
});

test('bare land loses carbon and takes credits back; idle land earns nothing', () => {
  day = '2026-11-15';
  // Farm 1 cleared, 8 plots planted; Farm 2 bare: the land loses more than it stores
  let s = tick(farm({ view: 'world', trial: TRIAL_SAMPLES.worldPlanting, field: TRIAL_SAMPLES.worldPlantingField }));
  day = '2026-11-16';
  s = tick(s);
  expect(s.climate.co2By.soil).toBeCloseTo(32 * 0.06, 6);
  expect(s.climate.total.soil).toBeLessThan(0);
  expect(s.climate.credits).toBe(0);
  expect(payOf(s.climate).payments.length).toBe(0);
  expect(s.coins).toBe(1000);

  // all idle: nothing recorded, nothing paid
  let i = tick(farm());
  day = '2026-11-17';
  i = tick(i);
  expect(i.climate.log.length).toBe(0);
  expect(i.coins).toBe(1000);
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
  expect(s.coins).toBeCloseTo(1000 + p.coins, 6);
  // the calendar day is still today: it is counted at midnight as usual
  expect(payOf(s.climate).day).toBe('2026-11-15');
});

test('nothing is counted or paid before the farm opens; a higher climate level pays more a credit', () => {
  day = '2026-11-15';
  const first = { ...farm({ view: 'classic', trial: TRIAL_SAMPLES.sixGrowing }), fs: { phase: 'walk1' as const, at: 'first' as const, opened: false } };
  expect(tick(first)).toBe(first);
  expect(payRate(0)).toBe(PAY.perCredit);
  expect(payRate(4)).toBeGreaterThan(payRate(1));
  expect(coinsFor(10, 4)).toBeGreaterThan(coinsFor(10, 0));
});
