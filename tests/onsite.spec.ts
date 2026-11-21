import { expect, test } from '@playwright/test';
import { boot, doJobs, state, type Win } from './helpers';
import { initialState, reducer, type Action, type GameState } from '../src/state';
import { achClock } from '../src/achievements/track';
import { payClock } from '../src/climate/track';
import { CARE, COOPS, ISSUES, PREVENT, SHEDS } from '../src/livestock/config';
import { careDoneToday, lifeOf } from '../src/livestock/model';
import { POWER_STEPS } from '../src/power/config';
import { MEASURES } from '../src/security/config';
import { hubOf } from '../src/tractor/hub';
import { SHOP_TABS } from '../src/data';
import { PLACES } from '../src/world/engine';
import { choresCount, choresLeft, jobFor, treatJob, type JobSpec } from '../src/onsite/model';

/* Jobs done by hand on the 3D farm (src/onsite): a page's button becomes a walk to the spot and work there, and what
   the page asked for happens only once the work is done. The rules through the reducer, every spot checked against
   the places that open a page, and the walk and the work played on the farm. */

const day = '2026-11-15';
payClock.today = () => day;
achClock.today = () => day;

const game = (patch: Partial<GameState> = {}): GameState => ({ ...initialState, onboarded: true, view: 'world', fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, coins: 50_000, ...patch });
const inCare = (patch: Partial<GameState> = {}) => game({ life: { day: 2, started: 2, date: day }, ...patch });
const act = (s: GameState, ...as: Action[]) => as.reduce(reducer, s);
const add = (s: GameState, a: Action) => act(s, { type: 'jobAdd', job: { ...jobFor(s, a)!, then: a } });

test('a page’s action waits for the work on the farm: nothing is paid until the last spot is done', () => {
  let s = inCare({ modal: { kind: 'animals', tab: 'today' } });
  const feed: Action = { type: 'animalCare', id: 'cowFeed' };
  s = add(s, feed);
  // on the list, the page closed so the farmer can walk there; the cows are not fed yet and nothing is paid
  expect(s.jobs).toHaveLength(1);
  expect(s.jobs![0]).toMatchObject({ key: 'care:cowFeed', done: 0, title: 'Feed the cows' });
  expect(s.modal).toBeNull();
  expect(s.coins).toBe(50_000);
  expect(careDoneToday(s, 'cowFeed')).toBe(false);
  expect(s.toast?.text).toMatch(/walk to the cow pen/);
  // the same job twice is refused
  const again = add(s, feed);
  expect(again.jobs).toHaveLength(1);
  expect(again.toast?.text).toMatch(/Already on your jobs/);
  // spot by spot, then the action and the points
  const id = s.jobs![0].id;
  s = act(s, { type: 'jobStep', id });
  expect(s.jobs![0].done).toBe(1);
  s = act(s, { type: 'jobDone', id });
  expect(s.jobs).toHaveLength(0);
  expect(careDoneToday(s, 'cowFeed')).toBe(true);
  expect(s.coins).toBeLessThan(50_000);
  expect(s.points).toBe(5);
  expect(s.toast?.text).toMatch(/\+5 points for the work$/);
});

test('a job whose action can no longer be done stays at its last spot, with the reason and no points', () => {
  let s = add(game(), { type: 'powerInstall', id: 'panels', score: 1 });
  const id = s.jobs![0].id;
  s = act(s, { type: 'jobStep', id }, { type: 'jobStep', id });
  // the money went on something else while the farmer walked over
  s = act({ ...s, coins: 10 }, { type: 'jobDone', id });
  expect(s.jobs).toHaveLength(1);
  expect(s.jobs![0].done).toBe(s.jobs![0].stops.length - 1);
  expect(s.points).toBe(0);
  expect(s.toast?.text).toMatch(/You need/);
  // with the money back, the last spot finishes it
  s = act({ ...s, coins: 50_000 }, { type: 'jobDone', id });
  expect(s.jobs).toHaveLength(0);
  expect(s.points).toBeGreaterThan(0);
});

test('a job that cannot be done now is refused with the reason; a dropped job costs nothing', () => {
  // the inverter before the panels, and the panels with no money
  let s = game({ life: { day: 2, started: 2, date: day } });
  s = add(s, { type: 'powerInstall', id: 'inverter', score: 1 });
  expect(s.jobs ?? []).toHaveLength(0);
  expect(s.toast?.text).toMatch(/solar panels first/);
  const broke = add(game({ coins: 10 }), { type: 'powerInstall', id: 'panels', score: 1 });
  expect(broke.jobs ?? []).toHaveLength(0);
  expect(broke.toast?.text).toMatch(/You need/);
  // dropped: off the list, nothing paid or installed
  s = add(game(), { type: 'powerInstall', id: 'panels', score: 1 });
  expect(s.jobs).toHaveLength(1);
  s = act(s, { type: 'jobDrop', id: s.jobs![0].id });
  expect(s.jobs).toHaveLength(0);
  expect(s.coins).toBe(50_000);
  expect(s.toast?.text).toMatch(/Nothing was paid/);
});

test('every action with a job has spots on the farm, clear of the places that open a page', () => {
  const s = inCare({ power: { parts: { fuel: { day: 1, score: 1 } } } as never });
  const actions: Action[] = [
    ...CARE.map(c => ({ type: 'animalCare', id: c.id }) as Action),
    ...PREVENT.map(p => ({ type: 'animalPrevent', id: p.id }) as Action),
    ...COOPS.map(c => ({ type: 'coopBuild', id: c.id }) as Action),
    ...SHEDS.map(c => ({ type: 'shedBuild', id: c.id }) as Action),
    { type: 'herdBuy', group: 'cows', n: 1 },
    { type: 'herdBuy', group: 'hens', n: -5 },
    ...POWER_STEPS.map(p => ({ type: 'powerInstall', id: p.id, score: 1 }) as Action),
    ...(['service', 'repair', 'refuel', 'safety'] as const).map(section => ({ type: 'tractorHub', section, score: 1 }) as Action),
    ...MEASURES.filter(m => m.kind !== 'nightly' && !['watch', 'mpesa'].includes(m.id)).map(m => ({ type: 'securityBuy', id: m.id }) as Action),
    { type: 'ghWater', bed: -1 },
    { type: 'ghWater', bed: 2 },
    ...SHOP_TABS.filter(t => t.id !== 'food').flatMap(t => t.items.map(i => ({ type: 'buy', id: i.id, price: i.price, name: i.name }) as Action)),
  ];
  const specs: JobSpec[] = [...actions.map(a => jobFor(s, a)!), ...ISSUES.map(i => treatJob(i.id, i.fixes.find(f => f.right)!.id))];
  for (const [k, j] of specs.entries()) {
    expect(j, `${JSON.stringify(actions[k])}`).toBeTruthy();
    expect(j.stops.length).toBeGreaterThan(0);
    expect(j.title.length).toBeGreaterThan(3);
    for (const st of j.stops) {
      expect(st.secs).toBeGreaterThan(0);
      if (st.anchor) continue;
      expect(Math.abs(st.x)).toBeLessThan(21.6);
      expect(st.z).toBeGreaterThan(-20.4);
      expect(st.z).toBeLessThan(16.8);
      for (const [name, p] of Object.entries(PLACES)) expect(Math.hypot(st.x - p.x, st.z - p.z), `${j.title} · ${st.button} is in ${name}`).toBeGreaterThan(p.r + 0.15);
    }
  }
  // choices, quizzes and settings happen at once
  expect(jobFor(s, { type: 'tractorHub', section: 'learn', id: 'safety', score: 1 })).toBeNull();
  expect(jobFor(s, { type: 'securityHire', id: 'watchman', on: true })).toBeNull();
  expect(jobFor(s, { type: 'powerLoad', id: 'pump', on: true })).toBeNull();
});

test('a right fix for a sick animal is then given by hand; the classic farm acts at once', () => {
  const sick = inCare({ life: { day: 3, started: 2, date: day, issues: [{ id: 'mastitis', since: 3 }] } });
  const right = ISSUES.find(i => i.id === 'mastitis')!.fixes.find(f => f.right)!;
  const s = act(sick, { type: 'animalFix', issue: 'mastitis', fix: right.id });
  expect(lifeOf(s.life).issues).toHaveLength(0);
  expect(s.jobs?.[0]).toMatchObject({ key: 'treat:mastitis', title: 'Treat the cows' });
  expect(act({ ...sick, view: 'classic' }, { type: 'animalFix', issue: 'mastitis', fix: right.id }).jobs ?? []).toHaveLength(0);
});

test('the animal chores: today’s care counted for the chip, cows first', () => {
  let s = inCare();
  expect(choresLeft(s)[0]).toBe('cowFeed');
  const c0 = choresCount(s)!;
  expect(c0.cows.done).toBe(0);
  expect(c0.cows.all).toBeGreaterThanOrEqual(3);
  s = act(s, { type: 'animalCare', id: 'cowFeed' });
  expect(choresCount(s)!.cows.done).toBe(1);
  expect(choresLeft(s)).not.toContain('cowFeed');
  expect(choresCount(game())).toBeNull();
});

test('on the farm: the chores chip walks to the pen, the work is done by hand, then the cows are fed', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', coins: 20000, life: { day: 2, started: 2, date: new Date().toISOString().slice(0, 10) } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  const chip = page.locator('.hud-chores');
  await expect(chip).toContainText('Animal chores');
  await chip.click();
  // the task card shows the job, and the farmer sets off
  await expect(page.locator('.hud-task.is-job')).toContainText('Feed the cows');
  const coins = (await state(page)).coins;
  await doJobs(page);
  const s = await state(page);
  expect(s.coins).toBeLessThan(coins);
  expect(s.life.today.spent).toBeGreaterThan(0);
  await expect(chip).toContainText('🐄 1/');
});

test('on the farm: a tractor service is done round the tractor, and only then is it paid and its condition up', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', coins: 20000, hub: { condition: 40 } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.waitForTimeout(500);
  const coins = (await state(page)).coins;
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima as unknown as { dispatch: (a: unknown) => void; jobFor: (a: unknown) => unknown };
    const a = { type: 'tractorHub', section: 'service', score: 1 };
    L.dispatch({ type: 'jobAdd', job: { ...(L.jobFor(a) as object), then: a } });
  });
  await expect(page.locator('.hud-task.is-job')).toContainText('Service the tractor');
  expect(hubOf((await state(page)).hub).condition).toBe(40);
  expect((await state(page)).coins).toBe(coins);
  await doJobs(page);
  const s = await state(page);
  expect(hubOf(s.hub).condition).toBeGreaterThan(40);
  expect(s.coins).toBeLessThan(coins);
});
