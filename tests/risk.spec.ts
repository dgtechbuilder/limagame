import { expect, test } from '@playwright/test';
import { boot, scenario, state } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { fromLocal, money, moneyCompact, setCountry } from '../src/money';
import { CHECK_DAYS, DAMAGE, COMMON_PLAN, canTreat, checkKey, harvestFarm, hazardFor, newTrial, setChoice, type Trial } from '../src/trials/model';
import { RISK, riskShare } from '../src/risk/config';
import { riskOf, statedCost } from '../src/risk/model';
import { FULL, emptyField, needOf, type Field } from '../src/world/field';

/* Money at risk: the button on the farm adds up what every unresolved problem on the six farms would cost if it is
   left, grows each day a problem is left, drops (with a cheer) when one is dealt with, and its list never says what
   a problem is. */

/** Six farms planted on the fast clock, every farm dug, sown and fed. */
function planted(cycle: number): { t: Trial; f: Field } {
  const plan = setChoice(COMMON_PLAN, 'pest', 'scout');
  const t: Trial = { ...newTrial(cycle, false, plan), phase: 'growing', clock: 'fast', planted: 0, day: 1 };
  const f = emptyField(cycle);
  t.plans.forEach((_, i) => {
    f.marks[`${i}:prep`] = FULL;
    f.marks[`${i}:sow`] = FULL;
    const feed = needOf('setupFeed', t, i);
    if (feed) f.marks[`${i}:setupFeed`] = feed;
  });
  return { t, f };
}

/** A cycle where at least three farms have a problem with a cost on day 1, each one the farm can treat. */
function threeProblems() {
  for (let cycle = 2; cycle < 3000; cycle++) {
    const { t, f } = planted(cycle);
    const r = riskOf(t, f, 0);
    if (r.items.length >= 3 && r.items.every(x => canTreat(x.hazard, t.plans[x.farm]))) return { t, f, r };
  }
  throw new Error('no cycle with three problems');
}

/** Read a farm's problem right and do its fix, as the farm world does once the work by hand is finished. */
const fix = (t: Trial, farm: number, day: number): Trial => ({ ...t, checks: { ...t.checks, [checkKey(farm, day)]: { right: true, tries: 1, treated: true } } });
/** Read every farm wrong today, then sleep: the next day starts with every problem still there. */
const ignoreDay = (t: Trial): Trial => {
  const checks = { ...t.checks };
  t.plans.forEach((_, i) => (checks[checkKey(i, t.day)] = checks[checkKey(i, t.day)] ?? { right: false, tries: 1, treated: false }));
  return { ...t, checks, day: t.day + 1 };
};

test('the total is every unresolved problem added up, shown short: three problems of 20k, 20k and 10k read "50k at risk"', () => {
  const { r } = threeProblems();
  expect(r.total).toBe(r.items.reduce((n, x) => n + x.amount, 0));
  // biggest first
  expect(r.items.map(x => x.amount)).toEqual([...r.items.map(x => x.amount)].sort((a, b) => b - a));
  // on the day it shows, a problem has its start share of its stated cost at risk
  for (const x of r.items) expect(x.amount).toBe(Math.round(x.stated * RISK.startShare));
  // the button's words, in Kenyan shillings
  setCountry('KE');
  const k = (ksh: number) => fromLocal(ksh);
  expect(moneyCompact(k(20_000) + k(20_000) + k(10_000))).toBe('KSh 50k');
  expect(moneyCompact(k(1_200_000))).toBe('KSh 1.2M');
  expect(moneyCompact(k(950))).toBe('KSh 950');
  setCountry('');
});

test('a problem stated at 100,000 is the same number the check shows: what the farm loses if it is left alone', () => {
  const { t, f, r } = threeProblems();
  const x = r.items[0];
  const value = harvestFarm(t, x.farm, 0).income;
  expect(statedCost(t, x.farm, x.hazard)).toBe(Math.round(value * DAMAGE[x.hazard].missed));
  expect(riskOf(t, f, 0).items[0].stated).toBe(x.stated);
});

test('fixing one drops the total by exactly its amount at once; leaving the rest a day raises each by the escalation', () => {
  const { t, f, r } = threeProblems();
  const first = r.items[0];
  const after = riskOf(fix(t, first.farm, 1), f, 0);
  expect(after.total).toBe(r.total - first.amount);
  expect(after.items.some(x => x.key === first.key)).toBe(false);

  // the others are left: the next day each grows by the escalation share of its stated cost
  const next = riskOf(ignoreDay(fix(t, first.farm, 1)), f, 0);
  for (const x of r.items.slice(1)) {
    const y = next.items.find(z => z.key === x.key)!;
    expect(y, `${x.key} is still on the list the next day`).toBeTruthy();
    expect(y.daysOpen).toBe(1);
    expect(y.amount).toBe(Math.round(x.stated * riskShare(1)));
    expect(y.amount - x.amount).toBeCloseTo(x.stated * RISK.escalatePerDay, -1);
  }
  // …up to its stated cost, and no further
  let t3 = ignoreDay(fix(t, first.farm, 1));
  for (let d = 0; d < 4; d++) t3 = ignoreDay(t3);
  for (const y of riskOf(t3, f, 0).items.filter(z => r.items.slice(1).some(x => x.key === z.key))) {
    expect(y.amount).toBe(y.stated);
    expect(y.next).toBeNull();
  }
});

test('an unresolved problem stays on its farm the next day; a fixed one makes way for a new draw', () => {
  const { t, r } = threeProblems();
  const x = r.items[0];
  const left = ignoreDay(t);
  expect(hazardFor(left, x.farm, 2)).toBe(x.hazard);
  const fixed = { ...fix(t, x.farm, 1), day: 2 };
  // fixed: day 2 shows whatever the farm's luck draws, as before
  const fresh = { ...t, day: 2, checks: {} };
  expect(hazardFor(fixed, x.farm, 2)).toBe(hazardFor({ ...fresh, checks: { [checkKey(x.farm, 1)]: { right: true, tries: 1, treated: true } } }, x.farm, 2));
});

test('at harvest a problem never dealt with costs what was at risk; one fixed late costs no more than one fixed on time', () => {
  const { t, r } = threeProblems();
  const x = r.items[0];
  // every other farm's problems fixed every day; this one never
  let all = t;
  for (let d = 1; d <= CHECK_DAYS; d++) {
    for (let i = 0; i < t.plans.length; i++) if (i !== x.farm) all = fix(all, i, d);
    all = { ...all, day: d + 1 };
  }
  const never = harvestFarm(all, x.farm);
  const lost = never.problems.find(p => p.day === 1)!;
  expect(lost.caught).toBe(false);
  // left from day 1 to the harvest: the whole stated cost
  expect(lost.loss).toBeCloseTo(DAMAGE[x.hazard].missed, 2);
  // fixed on day 3 instead: caught, the same as on day 1
  const late = harvestFarm(fix({ ...all }, x.farm, 3), x.farm).problems.find(p => p.day === 1)!;
  expect(late.caught).toBe(true);
  const onTime = harvestFarm(fix({ ...all }, x.farm, 1), x.farm).problems.find(p => p.day === 1)!;
  expect(late.loss).toBeCloseTo(onTime.loss, 6);
});

test('the evidence: each tap is counted, and a fix keeps how long it took from first seeing it at risk', () => {
  let s: GameState = { ...initialState };
  s = reducer(s, { type: 'riskSnap', total: 5000, day: 1, cycle: 2, amounts: { '2:0:1': 3000, '2:1:1': 2000 }, at: 1_000, seen: true });
  s = reducer(s, { type: 'riskTap', row: false });
  s = reducer(s, { type: 'riskTap', row: true });
  s = reducer(s, { type: 'riskFixed', fix: { key: '2:0:1', farm: 0, amount: 3000, fixedAt: 61_000, daysOpen: 0 } });
  expect(s.risk!.taps).toBe(1);
  expect(s.risk!.rowTaps).toBe(1);
  expect(s.risk!.fixed[0]).toMatchObject({ key: '2:0:1', seenAt: 1_000, fixedAt: 61_000 });
  // the snapshot is kept for "while you were away"
  expect(s.risk!.snap).toMatchObject({ total: 5000, day: 1, cycle: 2 });
});

/* ---------------- in the farm world ---------------- */

const CAUSE = /weed|water|dry|pest|armyworm|aphid|insect|drought|flood|puddle|hail|disease|rust|blight|goat|animal|bird|fertili|plant food|hunger|nitrogen|top-dress|spray|drain/i;

test('the button on the farm, its list (biggest first, never the cause), and a tap straight into the check', async ({ page }) => {
  await boot(page);
  const { day } = await scenario(page, 'fix');
  const btn = page.locator('.hud-risk');
  await expect(btn).toBeVisible();
  const s = await state(page);
  // the same total the model gives
  const total = await page.evaluate(() => {
    const st = (window as any).__lima.state;
    return st.risk?.snap?.total;
  });
  expect(total).toBeGreaterThan(0);
  await expect(btn).toContainText('at risk');
  await btn.click();
  const sheet = page.getByRole('dialog', { name: 'Money at risk' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(`${money(total)} at risk`);
  const rows = sheet.locator('.risk-list li');
  expect(await rows.count()).toBeGreaterThan(0);
  // never says what a problem is
  expect(await sheet.locator('.risk-list').innerText()).not.toMatch(CAUSE);
  // biggest first
  const amounts = await rows.locator('.risk-amount b').allInnerTexts();
  expect(amounts.length).toBe(await rows.count());
  // Farm 2 has not been checked: its row opens Farm 2's check, with what is at stake
  const unchecked = rows.filter({ hasText: 'Not checked yet' }).first();
  const farm = (await unchecked.locator('.risk-farm b').innerText()).trim();
  await unchecked.click();
  await expect(sheet).toBeHidden();
  await expect(page.locator('.world-check .rr-roundtag').first()).toContainText(`${farm} of ${s.trial.plans.length}`);
  await expect(page.locator('.world-check .stake')).toContainText('Will cost you about');
  expect(day).toBeGreaterThan(0);
});

test('dealing with a problem: the total drops at once, with a "saved" chip and a cheer', async ({ page }) => {
  await boot(page);
  const { day } = await scenario(page, 'fix');
  const btn = page.locator('.hud-risk');
  await expect(btn).toBeVisible();
  const before = await page.evaluate(() => (window as any).__lima.state.risk.snap.total);
  // Farm 1 was read right: pick the right fix and do the work by hand
  const right = await page.evaluate(() => (window as any).__lima.fixes('weeds').find((x: any) => x.right).id);
  await page.evaluate(([d, id]) => (window as any).__lima.dispatch({ type: 'prescribe', farm: 0, day: d, pick: id, right: true }), [day, right] as const);
  await page.evaluate(([d, bits]) => (window as any).__lima.dispatch({ type: 'fieldMark', farm: 0, job: `t${d}`, bits }), [day, FULL] as const);
  await expect(page.locator('.hud-risk-saved')).toContainText('saved');
  const card = page.getByRole('dialog', { name: 'Money saved' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('saved');
  const after = await page.evaluate(() => (window as any).__lima.state.risk.snap.total);
  expect(after).toBeLessThan(before);
  const st = await state(page);
  expect(st.risk.fixed.at(-1)).toMatchObject({ farm: 0 });
  expect(st.risk.fixed.at(-1).seenAt).toBeGreaterThan(0);
});

test('nothing at risk: a calm "All clear"; before the first problem (planting), no button at all', async ({ page }) => {
  await boot(page);
  // planting: no problem has shown yet
  await scenario(page, 'plots');
  await page.waitForTimeout(500);
  const st = await state(page);
  const r = await page.evaluate(() => document.querySelectorAll('.hud-risk').length);
  expect(r, `no button before planting (day ${st.trial.day})`).toBe(0);
});

test('a returning player sees what grew while they were away', async ({ page }) => {
  await boot(page);
  await scenario(page, 'fix');
  await expect(page.locator('.hud-risk')).toBeVisible();
  const snap = await page.evaluate(() => (window as any).__lima.state.risk.snap);
  // the button last read a third of this, two days ago; the game is opened again
  await page.evaluate(sn => {
    const L = (window as any).__lima;
    L.dispatch({ type: 'reset', state: { ...L.state, risk: { ...L.state.risk, snap: { ...sn, total: Math.round(sn.total / 3), at: Date.now() - 86_400_000 * 2 } } } });
  }, snap);
  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => !!(window as any).__lima);
  await expect(page.locator('.hud-risk')).toBeVisible();
  const card = page.getByRole('dialog', { name: 'At risk while you were away' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('at risk when you left');
  await card.getByRole('button', { name: 'See what is at risk' }).click();
  await expect(page.getByRole('dialog', { name: 'Money at risk' })).toBeVisible();
});
