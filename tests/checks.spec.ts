import { expect, test } from '@playwright/test';
import { boot, state, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { CHECKS, checkFix, earlyToday, plannedOf } from '../src/inspect/model';
import { CHECK_ORDER, subjectOf } from '../src/inspect/subjects';
import { urgentOf } from '../src/inspect/urgent';
import { issueRisk, lifeOf, type LifeState } from '../src/livestock/model';

/* Full checks (src/inspect, src/livestock/Exam.tsx): the parts in sections, the red parts of a problem first, the
   call to check the rest, the sweep of every other part, and the early signs it finds, fixed now or planned. */

const game = (life: Partial<LifeState> = {}, patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  onboarded: true,
  fs: { phase: 'done', at: 'first', opened: true },
  farmer: { name: 'Wanjiku', look: 0 },
  coins: 50_000,
  life: { day: 6, started: 2, date: '2026-11-20', ...life },
  ...patch,
});

test('every part of every check is in exactly one section, in the order they are checked; every early sign is on a part', () => {
  expect(CHECK_ORDER).toEqual(['cow', 'hen', 'plant', 'tractor', 'farm', 'water', 'power']);
  for (const id of CHECK_ORDER) {
    const def = subjectOf(id);
    const listed = def.sections.flatMap(s => s.parts);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(def.parts.map(p => p.id).sort());
    for (const e of def.early) expect(def.parts.map(p => p.id)).toContain(e.part);
    expect(new Set(def.early.map(e => e.id)).size).toBe(def.early.length);
    for (const p of def.parts) {
      expect(p.at.x).toBeGreaterThanOrEqual(0);
      expect(p.at.x).toBeLessThanOrEqual(480);
      expect(p.at.y).toBeGreaterThanOrEqual(0);
      expect(p.at.y).toBeLessThanOrEqual(270);
    }
    expect(def.sections.length).toBeGreaterThanOrEqual(3);
    expect(earlyToday(undefined, id, 3).length).toBeGreaterThanOrEqual(1);
  }
  expect(subjectOf('hen').title).toBe('Examine the chicken');
  expect(subjectOf('cow').sections.map(s => s.label)).toEqual(['Head', 'Body', 'Udder, legs & dung', 'Feed & water']);
});

test('early signs: the same few all day, none that grows into a problem already showing; fixed or planned in the reducer', () => {
  const a = earlyToday(undefined, 'cow', 6);
  expect(a.length).toBeGreaterThanOrEqual(CHECKS.min);
  expect(a.length).toBeLessThanOrEqual(CHECKS.max);
  expect(earlyToday(undefined, 'cow', 6).map(e => e.id)).toEqual(a.map(e => e.id));
  expect(earlyToday(undefined, 'cow', 6, ['ecf', 'mastitis', 'bloat', 'leak', 'heat']).every(e => !e.leads)).toBe(true);

  let s = game();
  const sign = a[0];
  // fixed now: its cost and points; it does not show again for a few days
  const r = checkFix(s, 'cow', sign.id, 6);
  expect('state' in r && r.state.coins).toBe(50_000 - sign.fix.cost);
  expect(checkFix({ ...s, coins: 0 }, 'cow', subjectOf('cow').early.find(e => e.fix.cost > 0)!.id, 6)).toHaveProperty('error');
  s = reducer(s, { type: 'checkFix', subject: 'cow', id: sign.id });
  expect(s.points).toBe(CHECKS.points.fix);
  expect(earlyToday(s.checks, 'cow', 7).map(e => e.id)).not.toContain(sign.id);
  // planned: it stays on the list until done, and shows on every check meanwhile
  const other = subjectOf('cow').early.find(e => e.id !== sign.id)!;
  s = reducer(s, { type: 'checkPlan', subject: 'cow', id: other.id, day: 8 });
  expect(plannedOf(s.checks).map(p => [p.early.id, p.day])).toEqual([[other.id, 8]]);
  expect(earlyToday(s.checks, 'cow', 7)[0]).toMatchObject({ id: other.id, planned: 8 });
  s = reducer(s, { type: 'checkFix', subject: 'cow', id: other.id });
  expect(plannedOf(s.checks)).toHaveLength(0);
  // a check of every part: points once a day; a part-check, none
  const before = s.points;
  s = reducer(s, { type: 'checkDone', subject: 'cow', checked: 6 });
  expect(s.points).toBe(before);
  s = reducer(s, { type: 'checkDone', subject: 'cow', checked: 15 });
  expect(s.points).toBe(before + CHECKS.points.full);
  expect(s.checks?.full?.cow).toBe(lifeOf(s.life).day);
  s = reducer(s, { type: 'checkDone', subject: 'cow', checked: 15 });
  expect(s.points).toBe(before + CHECKS.points.full);
});

test('early signs dealt with keep their problem away and lower the night’s risk; a plan left past its day raises it', () => {
  const base = game({ done: { cowFeed: 6, cowWater: 6 } });
  const plain = issueRisk(base, 'cows').chance;
  // checked all over today, a sign fixed: lower
  const dealt = { ...base, checks: { full: { cow: 6 }, fixed: { 'cow:ticks': 6 }, planned: {} } };
  expect(issueRisk(dealt, 'cows').chance).toBeCloseTo(plain * CHECKS.dealt);
  expect(issueRisk(dealt, 'cows').why).toContain('checked all over, early signs dealt with');
  // a planned job overdue: higher
  const late = { ...base, checks: { full: {}, fixed: {}, planned: { 'cow:longHoof': 5 } } };
  expect(issueRisk(late, 'cows').chance).toBeCloseTo(plain * CHECKS.overdue);
  // the hens are not touched by the cows' checks
  expect(issueRisk(dealt, 'hens').chance).toBe(issueRisk(base, 'hens').chance);
  expect(lifeOf(dealt.life).day).toBe(6);
});

test('examining the sick cow: red parts first in their sections, then Finish asks for the rest and the sweep checks them', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ view: 'classic', coins: 20000, life: { day: 6, started: 2, date: new Date().toISOString().slice(0, 10), issues: [{ id: 'ecf', since: 4 }] }, modal: { kind: 'animals', tab: 'health' } });
  });
  await page.getByRole('button', { name: 'Examine the cow up close' }).click();
  const exam = page.getByRole('dialog', { name: 'Examine the cow' });
  // four sections; the six parts that show East Coast fever are red, and said to be first
  await expect(exam.locator('.ex-sec')).toHaveCount(4);
  await expect(exam.locator('.ex-sec-head').first()).toContainText('Head');
  await expect(exam.locator('.ex-part.is-red')).toHaveCount(6);
  await expect(exam.locator('.ex-first')).toContainText('6 red parts first');
  // only the red parts, by the film
  await exam.getByRole('button', { name: /Start the examination/ }).click();
  for (let i = 0; i < 6; i++) await exam.getByRole('button', { name: /^(Next|Finish) ›$/ }).click();
  await expect(exam.locator('.ex-list li')).toHaveCount(6);
  // Finish the check: nine parts are not checked yet, so it asks for them
  await exam.getByRole('button', { name: /Finish the check/ }).click();
  const ask = page.getByRole('alertdialog', { name: 'Check the rest too?' });
  await expect(ask).toContainText('6 of 6 red parts seen');
  await expect(ask).toContainText('9 parts not checked yet');
  await ask.getByRole('button', { name: 'Check the other 9' }).click();
  // the sweep: healthy parts pass by themselves; each early sign waits to be fixed or planned
  const signs = earlyToday(undefined, 'cow', 6, ['ecf']);
  let fixed = false;
  for (let i = 0; i < 40 && !(await exam.locator('.ex-done').count()); i++) {
    const fix = exam.locator('.ex-caption.is-sweep .is-fix');
    if (await fix.count()) {
      if (!fixed) {
        await fix.click();
        await expect(exam.locator('.ex-work')).toBeVisible();
        fixed = true;
      } else await exam.locator('.ex-caption.is-sweep .ex-plan button').first().click();
    }
    await page.waitForTimeout(600);
  }
  await expect(exam.locator('.ex-done')).toBeVisible();
  await expect(exam.locator('.ex-done-head')).toContainText('15 of 15');
  await expect(exam.locator('.ex-early-list li')).toHaveCount(signs.length);
  const s = await state(page);
  expect(s.checks.full.cow).toBe(6);
  expect(Object.keys(s.checks.fixed)).toHaveLength(1);
  expect(Object.keys(s.checks.planned)).toHaveLength(signs.length - 1);
  // the fix for the problem itself is chosen beside the summary
  await exam.getByRole('button', { name: /Call the vet now/ }).click();
  await expect(exam).toHaveCount(0);
  // the planned jobs wait on the Health page
  await expect(page.locator('.lv-planned .lv-job')).toHaveCount(signs.length - 1);
});

test('a routine check of the hens, nothing wrong: every part in one sweep, and the plan done from the Health page', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ view: 'classic', coins: 20000, life: { day: 5, started: 2, date: new Date().toISOString().slice(0, 10) }, modal: { kind: 'animals', tab: 'health' } });
  });
  await page.getByRole('button', { name: /Examine the chicken/ }).click();
  const exam = page.getByRole('dialog', { name: 'Examine the chicken' });
  await expect(exam.locator('.ex-sec')).toHaveCount(3);
  await expect(exam.locator('.ex-part.is-red')).toHaveCount(0);
  await exam.getByRole('button', { name: /Check every part/ }).click();
  for (let i = 0; i < 40 && !(await exam.locator('.ex-done').count()); i++) {
    const plan = exam.locator('.ex-caption.is-sweep .ex-plan button');
    if (await plan.count()) await plan.first().click();
    await page.waitForTimeout(600);
  }
  await expect(exam.locator('.ex-done-head')).toContainText('11 of 11');
  await exam.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.lv-check').nth(1)).toContainText('Checked today');
  const n = earlyToday(undefined, 'hen', 5).length;
  await expect(page.locator('.lv-planned .lv-job')).toHaveCount(n);
  await page.locator('.lv-planned .lv-job').first().getByRole('button').click();
  await expect(page.locator('.lv-planned .lv-job')).toHaveCount(n - 1);
});

test('red parts on the farm come from the game: a low tank, a worn tractor low on diesel, a dry spell', () => {
  const s = game({}, { tank: { level: 100 }, hub: { condition: 40, fuel: 4 } });
  expect(urgentOf(s, 'water').map(u => u.part)).toEqual(['tank']);
  expect(urgentOf(s, 'tractor').map(u => u.part)).toEqual(['oil', 'fuel']);
  expect(urgentOf(game({}, { tank: { level: 9000 }, hub: { condition: 100, fuel: 60 } }), 'tractor')).toHaveLength(0);
  expect(urgentOf(game({}, { tank: { level: 9000 } }), 'water')).toHaveLength(0);
  expect(urgentOf(s, 'plant')).toHaveLength(0);
});

test('Farm checks: a card for each check; the tractor’s red parts first, the rest swept, an early sign fixed', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ view: 'classic', coins: 20000, hub: { condition: 40, fuel: 4 }, life: { day: 4, started: 2, date: new Date().toISOString().slice(0, 10) }, modal: { kind: 'menu' } });
  });
  await page.getByRole('button', { name: 'Farm checks', exact: true }).click();
  const hub = page.getByRole('dialog', { name: 'Farm checks' });
  await expect(hub.locator('.ck-card')).toHaveCount(7);
  await expect(hub.locator('.ck-card').nth(3)).toContainText('2 red');
  await hub.getByRole('button', { name: /Examine the tractor/ }).click();
  const exam = page.getByRole('dialog', { name: 'Examine the tractor' });
  await expect(exam.locator('.ex-sec')).toHaveCount(4);
  await expect(exam.locator('.ex-part.is-red')).toHaveCount(2);
  // the film of the two red parts, then Finish asks for the other eleven
  await exam.getByRole('button', { name: /Start the examination/ }).click();
  await expect(exam.locator('.ex-caption')).toContainText('Worn: due a service');
  await exam.getByRole('button', { name: /^(Next|Finish) ›$/ }).click();
  await expect(exam.locator('.ex-caption')).toContainText('Almost out of diesel');
  await exam.getByRole('button', { name: /^(Next|Finish) ›$/ }).click();
  await exam.getByRole('button', { name: /Finish the check/ }).click();
  await page.getByRole('alertdialog', { name: 'Check the rest too?' }).getByRole('button', { name: 'Check the other 11' }).click();
  const signs = earlyToday(undefined, 'tractor', 4);
  for (let i = 0; i < 40 && !(await exam.locator('.ex-done').count()); i++) {
    const fix = exam.locator('.ex-caption.is-sweep .is-fix');
    if (await fix.count()) await fix.click();
    await page.waitForTimeout(600);
  }
  await expect(exam.locator('.ex-done-head')).toContainText('13 of 13');
  // a sign on a part already seen in the film is fixed from the summary
  for (let i = 0; i < 6 && (await exam.locator('.ex-done .is-fix').count()); i++) {
    await exam.locator('.ex-done .is-fix').first().click();
    await expect(exam.locator('.ex-work')).toHaveCount(0, { timeout: 8000 });
  }
  await expect(exam.locator('.ex-early.is-fixed')).toHaveCount(signs.length);
  const s = await state(page);
  expect(s.checks.full.tractor).toBe(4);
  expect(Object.keys(s.checks.fixed).sort()).toEqual(signs.map(e => `tractor:${e.id}`).sort());
  await exam.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(hub.locator('.ck-card').nth(3)).toContainText('Checked today');
});

test('each new check opens from its own page or address, drawn with its parts', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const L = (window as unknown as Win).__lima;
    L.jump({ view: 'classic', coins: 20000, life: { day: 3, started: 2, date: new Date().toISOString().slice(0, 10) }, modal: { kind: 'power', tab: 'build' } });
  });
  await page.getByRole('button', { name: /Examine the power setup/ }).click();
  await expect(page.getByRole('dialog', { name: 'Examine the power setup' }).locator('.ex-part')).toHaveCount(11);
  await page.keyboard.press('Escape');
  await page.evaluate(() => (window as unknown as Win).__lima.dispatch({ type: 'open', modal: { kind: 'animals', tab: 'water' } }));
  await page.getByRole('button', { name: /Examine the water setup/ }).click();
  await expect(page.getByRole('dialog', { name: 'Examine the water setup' }).locator('.ex-part')).toHaveCount(11);
  await page.keyboard.press('Escape');
  for (const [id, title, n] of [
    ['plant', 'Examine the plant', 12],
    ['farm', 'Examine the farm', 11],
  ] as const) {
    await page.evaluate(sub => (window as unknown as Win).__lima.dispatch({ type: 'open', modal: { kind: 'checks', subject: sub } }), id);
    const exam = page.getByRole('dialog', { name: title });
    await expect(exam.locator('.ex-part')).toHaveCount(n);
    // tap a part to look for yourself
    await exam.locator('.ex-part').first().click();
    await expect(exam.locator('.ex-caption.is-look')).toBeVisible();
    await page.keyboard.press('Escape');
  }
  // the page's address
  await page.evaluate(() => (window as unknown as Win).__lima.dispatch({ type: 'open', modal: { kind: 'checks' } }));
  await expect(page).toHaveURL(/#\/farm-checks/);
});
