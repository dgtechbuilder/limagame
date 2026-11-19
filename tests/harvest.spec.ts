import { expect, test } from '@playwright/test';
import { boot, scenario } from './helpers';
import { money, moneyCompact } from '../src/money';
import { CHECK_DAYS, COMMON_PLAN, canTreat, checkKey, harvestFarm, newTrial, setChoice, type Trial } from '../src/trials/model';
import { riskOf } from '../src/risk/model';
import { dayNumber } from '../src/rounds/farms';
import { harvestEstimate, withTodayFixed } from '../src/risk/harvest';
import { FULL, emptyField, needOf, type Field } from '../src/world/field';

/* Harvest estimate: the button beside the farmer's portrait shows what the harvest is likely to bring in if it goes
   well, the way the player is farming, and under it what they are likely to lose if the problems now are not put
   right. */

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

function withProblems() {
  for (let cycle = 2; cycle < 3000; cycle++) {
    const { t, f } = planted(cycle);
    const r = riskOf(t, f, 0);
    if (r.items.length >= 2 && r.items.every(x => canTreat(x.hazard, t.plans[x.farm]))) return { t, f, r };
  }
  throw new Error('no cycle with two problems');
}

test('the estimate is every farm\'s harvest with today\'s problems put right; the risk is what they cost if left', () => {
  const { t, r } = withProblems();
  const est = harvestEstimate(t, r)!;
  expect(est.kind).toBe('growing');
  expect(est.farms.length).toBe(t.plans.length);
  // each farm: the harvest the model gives once today's problem is dealt with
  const fixed = withTodayFixed(t, r.day);
  est.farms.forEach(x => expect(x.income).toBe(harvestFarm(fixed, x.farm, r.day).income));
  expect(est.income).toBe(est.farms.reduce((n, x) => n + x.income, 0));
  // the risk: every open problem at its full cost, the number the check shows ("Will cost you about …")
  expect(est.atRisk).toBe(r.items.reduce((n, x) => n + x.stated, 0));
  expect(est.atRisk).toBeGreaterThan(0);
  expect(est.ifLeft).toBe(est.income - est.atRisk);
  expect(est.profit).toBe(est.income - est.costs);
});

test('putting a problem right takes its cost off the risk, and the estimate holds', () => {
  const { t, f, r } = withProblems();
  const before = harvestEstimate(t, r)!;
  const first = r.items[0];
  const t2: Trial = { ...t, checks: { ...t.checks, [checkKey(first.farm, 1)]: { right: true, tries: 1, treated: true } } };
  const after = harvestEstimate(t2, riskOf(t2, f, 0))!;
  expect(after.atRisk).toBe(before.atRisk - first.stated);
  expect(after.income).toBe(before.income);
});

test('a problem left until the harvest is no longer in the estimate: what was lost is lost', () => {
  const { t, f } = withProblems();
  const harvestDay: Trial = { ...t, day: CHECK_DAYS + 1 };
  const r = riskOf(harvestDay, f, 0);
  expect(r.items.length).toBe(0);
  const est = harvestEstimate(harvestDay, r)!;
  expect(est.atRisk).toBe(0);
  t.plans.forEach((_, farm) => expect(est.farms[farm].income).toBe(harvestFarm(harvestDay, farm, CHECK_DAYS).income));
  // a harvest done: the button shows what it brought in
  const done = harvestEstimate({ ...t, phase: 'done', results: t.plans.map((_, i) => harvestFarm(t, i)) }, r)!;
  expect(done.kind).toBe('done');
  expect(done.income).toBe(t.plans.reduce((n, _, i) => n + harvestFarm(t, i).income, 0));
  // nothing planted yet: no button
  expect(harvestEstimate({ ...t, phase: 'plan' }, r)).toBeNull();
  expect(harvestEstimate(null, r)).toBeNull();
});

test('the button beside the portrait, its risk line, and the sheet with each farm', async ({ page }) => {
  await boot(page);
  await scenario(page, 'fix');
  const btn = page.locator('.hud-harvest');
  await expect(btn).toBeVisible();
  await expect(btn).toContainText('Harvest estimate');
  // next to the portrait, and clear of the task card
  const [avatar, box, task] = await Promise.all([page.locator('.hud-avatar').boundingBox(), btn.boundingBox(), page.locator('.hud-task').boundingBox()]);
  expect(box!.x).toBeGreaterThan(avatar!.x + avatar!.width);
  expect(box!.x - (avatar!.x + avatar!.width)).toBeLessThan(30);
  expect(box!.x + box!.width).toBeLessThan(task!.x);
  // the same numbers the model gives for the save
  const est = await page.evaluate(() => {
    const st = (window as any).__lima.state;
    return { trial: st.trial, field: st.field };
  });
  const r = riskOf(est.trial, est.field, dayNumber());
  const h = harvestEstimate(est.trial, r)!;
  await expect(btn.locator('b')).toHaveText(moneyCompact(h.income));
  await expect(btn.locator('.hud-harvest-risk')).toContainText(h.atRisk > 0 ? `${moneyCompact(h.atRisk)} if not fixed` : 'Nothing at risk now');

  await btn.click();
  const sheet = page.getByRole('dialog', { name: 'Harvest estimate' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText(`${money(h.income)} if it goes well`);
  await expect(sheet.locator('.harvest-list li')).toHaveCount(est.trial.plans.length);
  if (h.atRisk > 0) {
    await expect(sheet.locator('.harvest-split .is-loss')).toContainText(money(h.atRisk));
    await sheet.getByRole('button', { name: 'See what is at risk' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Money at risk' })).toBeVisible();
  }
});

test('before anything is planted there is no estimate to show', async ({ page }) => {
  await boot(page);
  await page.waitForTimeout(800);
  const st = await page.evaluate(() => (window as any).__lima.state);
  if (!st.trial || st.trial.phase !== 'growing') expect(await page.locator('.hud-harvest').count()).toBe(0);
});
