import { expect, test } from '@playwright/test';
import { boot, state, type Win } from './helpers';
import { initialState, reducer, type GameState } from '../src/state';
import { payClock } from '../src/climate/track';
import { achClock } from '../src/achievements/track';
import { BASICS, SECTIONS, TERMS, lessonForDay, termFor, termList } from '../src/learn/glossary';
import { lessonDue } from '../src/learn/Basics';
import { FERTS, SEEDS, SPRAYERS } from '../src/plots/data';
import { IMPL, TRACTORS } from '../src/tractor/data';
import { KIT, PRODUCTS } from '../src/care/data';
import { TREATMENTS } from '../src/care/treatments';
import { SHOP_TABS, STEPS } from '../src/data';
import { lifeOf } from '../src/livestock/model';

/* Farm words: the ⓘ buttons beside every fertilizer, spray, tool and machine, the card they open, the Farm words page,
   and the Farm basics lessons in the first session and the first days (src/learn). */

test('every input, spray, tool and machine in the game has a farm word', () => {
  for (const o of [...SEEDS, ...FERTS, ...SPRAYERS]) expect(termFor(o.name), o.name).toBeTruthy();
  for (const k of Object.keys(IMPL) as (keyof typeof IMPL)[]) expect(termFor(IMPL[k].name), IMPL[k].name).toBeTruthy();
  for (const t of TRACTORS) expect(termFor(t.id), t.id).toBeTruthy();
  for (const k of KIT) expect(termFor(k.label), k.label).toBeTruthy();
  for (const list of Object.values(PRODUCTS)) for (const p of list) expect(termFor(p.name), p.name).toBeTruthy();
  for (const fert of SHOP_TABS.find(t => t.id === 'fertilizer')!.items) expect(termFor(fert.name), fert.name).toBeTruthy();
  for (const tool of SHOP_TABS.find(t => t.id === 'equipment')!.items.filter(i => i.id !== 'cultivator')) expect(termFor(tool.name), tool.name).toBeTruthy();
  for (const task of STEPS.find(s => s.id === 'pesticides')!.tasks) expect(termFor(task.name), task.name).toBeTruthy();
  // most ways to treat a problem name a word too (the chemical ones all do)
  for (const list of Object.values(TREATMENTS)) for (const w of list!) if (!w.smart && w.pollution) expect(termFor(w.label), w.label).toBeTruthy();
});

test('a name finds the right word: the longest name in it wins, and capitals matter for short ones', () => {
  expect(termFor('DAP at planting only')?.id).toBe('dap');
  expect(termFor('CAN top-dress')?.id).toBe('can');
  expect(termFor('Spray glyphosate over the field')?.id).toBe('glyphosate');
  expect(termFor('Selective herbicide')?.id).toBe('selectiveHerbicide');
  expect(termFor('Boom sprayer')?.id).toBe('boom');
  expect(termFor('Knapsack sprayer')?.id).toBe('knapsack');
  expect(termFor('Lithium, 10 kWh')?.id).toBe('lithium');
  expect(termFor('Hybrid with MPPT, 3 kW')?.id).toBe('mppt');
  // "can" the verb is not CAN the fertilizer
  expect(termFor('You can water the beds')).toBeUndefined();
  expect(termFor('Cassava')).toBeUndefined();
  // every word is whole: its links and lessons point at words that exist, and every section has words
  for (const t of termList) {
    expect(t.what && t.does && t.use, t.id).toBeTruthy();
    for (const id of t.see ?? []) expect(TERMS[id], `${t.id} → ${id}`).toBeTruthy();
  }
  for (const l of BASICS) for (const c of l.cards) expect(TERMS[c.term], c.term).toBeTruthy();
  for (const sec of SECTIONS) expect(termList.some(t => t.section === sec.id), sec.id).toBe(true);
});

test('Farm basics: the first lesson in the first session, then one a day, each until it is read', () => {
  expect(BASICS[0].cards.map(c => c.term)).toEqual(['fertilizer', 'pesticide', 'herbicide']);
  expect(lessonForDay(1)).toBeNull();
  expect(lessonForDay(2)).toBe(1);
  expect(lessonForDay(1 + BASICS.length)).toBeNull();
  // on the farm: the first lesson not read yet, up to the day's own
  expect(lessonDue(1, [])).toBe(0);
  expect(lessonDue(1, [0])).toBeNull();
  expect(lessonDue(3, [0])).toBe(1);
  expect(lessonDue(3, [0, 1, 2])).toBeNull();
  expect(lessonDue(99, BASICS.map((_, i) => i))).toBeNull();

  // the morning news of day 3 carries the day's lesson; once read it is not offered again
  const day = '2026-11-15';
  payClock.today = () => day;
  achClock.today = () => day;
  const base: GameState = { ...initialState, onboarded: true, fs: { phase: 'done', at: 'first', opened: true }, farmer: { name: 'Wanjiku', look: 0 }, life: { day: 2, started: 2, date: '2026-11-14' } } as GameState;
  let s = reducer(base, { type: 'toast', text: 'a new day' });
  expect(lifeOf(s.life).day).toBe(3);
  expect(s.success?.kind).toBe('morning');
  const lines = s.success?.kind === 'morning' ? s.success.lines : [];
  expect(lines.some(l => l.lesson === 2 && /^Farm basics/.test(l.title))).toBe(true);
  s = reducer({ ...base, basics: [2] }, { type: 'toast', text: 'a new day' });
  const after = s.success?.kind === 'morning' ? s.success.lines : [];
  expect(after.some(l => l.lesson !== undefined)).toBe(false);
  // reading a lesson is kept once
  s = reducer(reducer(base, { type: 'basicsRead', lesson: 1 }), { type: 'basicsRead', lesson: 1 });
  expect(s.basics).toEqual([1]);
});

test('the farm update teaches fertilizer, pesticide and herbicide; an ⓘ opens a word’s card on top', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    const l = (window as unknown as Win).__lima;
    l.dispatch({ type: 'farmer', name: 'Wanjiku', look: 0 });
    l.dispatch({ type: 'fs', phase: 'update' });
  });
  const box = page.locator('.basics-box');
  await expect(box).toBeVisible();
  await expect(box).toContainText('Fertilizer');
  await expect(box).toContainText('Pesticide');
  await expect(box).toContainText('Herbicide');
  await box.getByRole('button', { name: 'What is Herbicide?' }).click();
  const card = page.getByRole('dialog', { name: 'Herbicide: what it is' });
  await expect(card).toContainText('What it is');
  await expect(card).toContainText('kills weeds');
  // a link to a related word, then Back
  await card.getByRole('button', { name: /Glyphosate/ }).click();
  await expect(page.getByRole('dialog', { name: 'Glyphosate: what it is' })).toContainText('never spray it over a growing crop');
  await page.getByRole('button', { name: '‹ Back' }).click();
  await expect(page.getByRole('dialog', { name: 'Herbicide: what it is' })).toBeVisible();
  // Escape closes the card, and the farm update stays
  await page.keyboard.press('Escape');
  await expect(page.locator('.info-layer')).toBeHidden();
  await expect(page.locator('.update-card')).toBeVisible();
  expect((await state(page)).fs.phase).toBe('update');

  // the whole first lesson, read to the end
  await box.getByRole('button', { name: 'Learn more' }).click();
  const lesson = page.getByRole('dialog', { name: /Farm basics: Three words/ });
  await expect(lesson.locator('.info-word')).toHaveCount(3);
  await lesson.getByRole('button', { name: 'Got it' }).click();
  await expect(lesson).toBeHidden();
  expect((await state(page)).basics).toEqual([0]);
});

test('in the Shop, an ⓘ explains a fertilizer without buying it; the Farm words page finds any word', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ fs: { phase: 'done', at: 'first', opened: true }, view: 'classic', coins: 500 }));
  await page.evaluate(() => (window as unknown as Win).__lima.dispatch({ type: 'open', modal: { kind: 'shop', tab: 'fertilizer' } }));
  const before = (await state(page)).coins;
  await page.locator('[data-option="npk"] [data-term="npk"]').click();
  await expect(page.getByRole('dialog', { name: 'NPK fertilizer: what it is' })).toContainText('nitrogen (N), phosphorus (P) and potassium (K)');
  expect((await state(page)).coins).toBe(before);
  expect((await state(page)).inventory).not.toContain('npk');
  // All farm words opens the page at the word's section
  await page.getByRole('button', { name: '📖 All farm words' }).click();
  await expect(page).toHaveURL(/#\/farm-words\/fertilizer$/);
  await expect(page.locator('.gl-word', { hasText: 'DAP fertilizer' })).toBeVisible();
  // the search finds a word in any section
  await page.getByRole('searchbox', { name: 'Find a farm word' }).fill('harrow');
  await page.locator('.gl-word', { hasText: 'Disc harrow' }).click();
  await expect(page.getByRole('dialog', { name: 'Disc harrow: what it is' })).toContainText('Breaks clods');
  await page.keyboard.press('Escape');
  // its address opens it, and Farm basics lists every lesson
  await page.goto('./?dev#/farm-words/basics');
  await expect(page.locator('.gl-lesson')).toHaveCount(BASICS.length);
  await page.goto('./?dev#/farm-words/sprays');
  await expect(page.locator('.gl-word', { hasText: 'Glyphosate' })).toBeVisible();
});
