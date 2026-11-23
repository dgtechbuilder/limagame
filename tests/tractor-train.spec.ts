import { expect, test } from '@playwright/test';
import { boot, state, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { hubOf } from '../src/tractor/hub';
import { DRILLS, RACK, judgeRow, obstaclesFor, COURSE } from '../src/tractor/training';
import { IMPL } from '../src/tractor/data';

/* Train: the tractor school. A job on the left, a field from above, any implement from the rack; the end of the row
   says whether the implement was right. */

test('every tractor job is a drill, and each implement on the rack is the answer to one', () => {
  expect(DRILLS.map(d => d.tool).sort()).toEqual([...RACK].sort());
  for (const d of DRILLS) {
    // the wrong implement fails the row, with the hint first and the answer on the next wrong try
    const wrong = RACK.find(t => t !== d.tool)!;
    const first = judgeRow(d, wrong, 0, 1, 0);
    expect(first).toMatchObject({ pass: false, right: false, score: 0 });
    expect(first.text).toContain(d.hint);
    expect(judgeRow(d, wrong, 0, 1, 1).text).toContain(IMPL[d.tool].name.toLowerCase());
    // the right one, driven cleanly, passes; too many knocks fail it
    expect(judgeRow(d, d.tool, 0, 1, 0)).toMatchObject({ pass: true, score: 1 });
    expect(judgeRow(d, d.tool, COURSE.maxHits + 1, 1, 0).pass).toBe(false);
  }
  // the rocks and trees change with each try
  expect(obstaclesFor(0, 0)).not.toEqual(obstaclesFor(0, 1));
});

test('a drill passed pays in full once, a repeat pays a third', () => {
  const s0: GameState = { ...initialState, onboarded: true, coins: 1000 };
  const s1 = reducer(s0, { type: 'tractorHub', section: 'train', score: 1, drill: 'plough' });
  expect(hubOf(s1.hub).drills.plough).toBe(1);
  expect(hubOf(s1.hub).xp).toBe(30);
  expect(s1.points).toBeGreaterThan(s0.points);
  const s2 = reducer(s1, { type: 'tractorHub', section: 'train', score: 1, drill: 'plough' });
  expect(hubOf(s2.hub).xp).toBe(40);
  expect(s2.points).toBe(s1.points);
  // the station's stars: the share of the school passed
  expect(hubOf(s2.hub).best.train).toBeCloseTo(1 / DRILLS.length);
});

test('Train: the wrong implement fails the row, Try again resets it, the right one passes', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'world', life: { day: 4, date: null, started: 2 } } as never));
  await page.waitForFunction(() => !!(window as unknown as Win).__limaWorld);
  await page.evaluate(() => (window.location.hash = '#/farm'));
  await page.getByRole('button', { name: /Walk to the tractor|Drive the tractor/ }).click();
  const hub = page.getByRole('dialog', { name: 'Tractor' });
  await hub.locator('.set-tab', { hasText: 'Train' }).click();
  await hub.getByRole('button', { name: 'Start training', exact: true }).click();

  const school = page.getByRole('dialog', { name: 'Train: tractor school' });
  await expect(school.getByLabel('Your task')).toContainText('Plough');
  const drive = school.getByRole('button', { name: '▶ Drive the row' });
  await expect(drive).toBeDisabled();

  // the sprayer on hard stubble: driven to the end, then failed with a hint
  await school.getByRole('radio', { name: 'Boom sprayer' }).click();
  await drive.click();
  await expect(school.getByRole('button', { name: 'Steer left' })).toBeVisible();
  const result = school.getByRole('status');
  await expect(result).toContainText('Failed', { timeout: 40_000 });
  await expect(result).toContainText(DRILLS[0].hint);

  // Try again: a fresh row, nothing hitched
  await school.getByRole('button', { name: 'Try again' }).click();
  await expect(result).toHaveCount(0);
  await expect(drive).toBeDisabled();

  // the disc plough, steered out right of the rocks in the row: passed
  await school.getByRole('radio', { name: 'Disc plough' }).click();
  await drive.click();
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(1000);
  await page.keyboard.up('ArrowRight');
  await expect(result).toContainText('Passed', { timeout: 40_000 });
  await expect.poll(async () => hubOf((await state(page)).hub).drills.plough ?? 0).toBeGreaterThan(0);
  await expect(school.locator('.tf-drill.is-done')).toHaveCount(1);
  // Next task: harrowing
  await school.getByRole('button', { name: 'Next task' }).click();
  await expect(school.getByLabel('Your task')).toContainText('Harrow');
});
