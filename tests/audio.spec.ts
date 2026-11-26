import { expect, test, type Page } from '@playwright/test';
import { boot, scenario, state } from './helpers';

/* The game's light audio (src/audio): Settings → Sound starts at 2% overall, the farmer's footsteps sound different on
   grass and on soil, the background score starts with the first tap, and on the farm the hens cluck every 20 seconds
   and a cow moos every minute. */

type W = Window & {
  __lima: { audio: () => string[] };
  __limaWorld: { spawn: (x: number, z: number) => void; walkTo: (x: number, z: number) => void; groundAt: (x: number, z: number) => string; speedScale: number };
};
const audio = (page: Page) => page.evaluate(() => (window as unknown as W).__lima.audio());
const dialog = (page: Page) => page.getByRole('dialog', { name: 'Settings' });

test('Settings → Sound: 2% overall to start, every level saved, and Reset volume brings it back', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  expect((await state(page)).settings.volume).toMatchObject({ master: 2, music: 100, steps: 100, animals: 100, effects: 100 });

  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await dialog(page).getByRole('button', { name: 'Sound', exact: true }).click();
  await expect(page).toHaveURL(/#\/settings\/sound$/);
  const overall = dialog(page).getByRole('slider', { name: 'Overall volume' });
  await expect(overall).toHaveValue('2');
  // the first tap started the score
  await expect.poll(() => audio(page)).toContain('score');

  await overall.fill('35');
  await dialog(page).getByRole('slider', { name: 'Music' }).fill('40');
  await expect.poll(async () => (await state(page)).settings.volume).toMatchObject({ master: 35, music: 40 });
  await expect(dialog(page).getByText('35%', { exact: true })).toBeVisible();

  // the buttons play each sound
  await dialog(page).getByRole('button', { name: 'Grass', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Soil', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Cluck', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Moo', exact: true }).click();
  await expect.poll(() => audio(page)).toEqual(expect.arrayContaining(['step:grass', 'step:soil', 'cluck', 'moo']));

  // kept after a reload
  await boot(page, false);
  expect((await state(page)).settings.volume).toMatchObject({ master: 35, music: 40 });
  await scenario(page, 'tractor');
  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await dialog(page).getByRole('button', { name: 'Sound', exact: true }).click();
  await dialog(page).getByRole('button', { name: 'Reset volume', exact: true }).click();
  await expect.poll(async () => (await state(page)).settings.volume).toMatchObject({ master: 2, music: 100 });
});

test('Footsteps: the farmer walks on grass and on soil, and each sounds as its own', async ({ page }) => {
  await boot(page);
  await scenario(page, 'tractor');
  await page.mouse.click(5, 395);
  const ground = (x: number, z: number) => page.evaluate(([x, z]) => (window as unknown as W).__limaWorld.groundAt(x, z), [x, z]);
  // the dirt yard between the farms is soil; the grass beyond the paths is grass
  expect(await ground(-4, 0)).toBe('soil');
  expect(await ground(-15, -8)).toBe('grass');

  const walk = async (from: [number, number], to: [number, number], want: string) => {
    await page.evaluate(
      ([fx, fz, tx, tz]) => {
        const w = (window as unknown as W).__limaWorld;
        w.speedScale = 0.6;
        w.spawn(fx, fz);
        w.walkTo(tx, tz);
      },
      [...from, ...to],
    );
    await expect.poll(async () => (await audio(page)).filter(a => a === want).length, { timeout: 10_000 }).toBeGreaterThan(1);
  };
  await walk([-4, -3], [-4, 3], 'step:soil');
  await walk([-15, -7], [-15, -9.5], 'step:grass');
});

test('On the farm the hens cluck every 20 seconds and a cow moos every minute', async ({ page }) => {
  test.setTimeout(90_000);
  await boot(page);
  await scenario(page, 'tractor');
  const t0 = Date.now();
  await expect.poll(() => audio(page), { timeout: 25_000, intervals: [1000] }).toContain('cluck');
  expect(Date.now() - t0).toBeGreaterThan(15_000);
  await expect.poll(() => audio(page), { timeout: 20_000, intervals: [1000] }).toContain('moo');
  expect((await audio(page)).filter(a => a === 'moo').length).toBe(1);
});
