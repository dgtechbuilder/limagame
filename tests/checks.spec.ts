import { expect, test } from '@playwright/test';
import { boot, state, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { CHECKS, checkFix, earlyToday, plannedOf } from '../src/inspect/model';
import { subjectOf } from '../src/inspect/subjects';
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

test('every part of the cow and the hens is in exactly one section, in the order they are checked', () => {
  for (const id of ['cow', 'hen'] as const) {
    const def = subjectOf(id);
    const listed = def.sections.flatMap(s => s.parts);
    expect(new Set(listed).size).toBe(listed.length);
    expect([...listed].sort()).toEqual(def.parts.map(p => p.id).sort());
    for (const e of def.early) expect(def.parts.map(p => p.id)).toContain(e.part);
  }
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
  await page.getByRole('button', { name: /Check the hens all over/ }).click();
  const exam = page.getByRole('dialog', { name: 'Examine the hens' });
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
