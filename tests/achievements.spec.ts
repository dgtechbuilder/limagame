import { expect, test } from '@playwright/test';
import { initialState, reducer, type GameState } from '../src/state';
import { ACHIEVEMENTS, DAY_ONE, achOfSave, daysBetween, initialAch, playDay, streakNow, streakReward, unclaimed } from '../src/achievements/model';
import { achClock } from '../src/achievements/track';
import { wakalaCase } from '../src/trials/samples';
import { boot, state, type Win } from './helpers';

/* Achievements without a browser: the daily streak, badges won from what the player really did, rewards that wait
   to be claimed, and certificates for streaks, weeks played and a part of the game mastered. */

let day = '2026-11-13';
achClock.today = () => day;

const farm = (patch: Partial<GameState> = {}): GameState => ({
  ...initialState,
  onboarded: true,
  fs: { phase: 'done', at: 'first', opened: true },
  farmer: { name: 'Wanjiku', look: 0 },
  coins: 1000,
  points: 0,
  // the first session's badge, won and claimed long ago
  ach: { ...initialAch, won: { welcome: { date: '2026-11-01', claimed: true } } },
  ...patch,
});

test('the streak: on with each day played, held on the same day, broken by a missed day', () => {
  let a = playDay(initialAch, '2026-11-13');
  expect(a.streak).toEqual({ count: 1, best: 1, last: '2026-11-13' });
  expect(playDay(a, '2026-11-13')).toBe(a);
  a = playDay(a, '2026-11-14');
  a = playDay(a, '2026-11-15');
  expect(a.streak.count).toBe(3);
  expect(a.days).toBe(3);
  expect(streakNow(a, '2026-11-16')).toBe(3);
  // a day missed: the streak is over, and starts again on the next day played
  expect(streakNow(a, '2026-11-17')).toBe(0);
  a = playDay(a, '2026-11-17');
  expect(a.streak).toEqual({ count: 1, best: 3, last: '2026-11-17' });
  // across the end of a month and a year
  expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  // the reward grows for a week, then stays
  expect(streakReward(1).coins).toBeLessThan(streakReward(7).coins);
  expect(streakReward(30)).toEqual(streakReward(7));
});

test('a badge is won from what was done, and its points wait to be claimed', () => {
  day = '2026-11-13';
  const s0 = farm();
  const s1 = reducer(s0, { type: 'task', step: 'landprep', id: 'clearing', price: 40, name: 'Clearing' });
  const a1 = achOfSave(s1.ach);
  expect(a1.stats.tasks).toBe(1);
  expect(a1.won['first-task']).toEqual({ date: day, claimed: false });
  // nothing is paid behind the player's back: only the task's cost moved the coins
  expect(s1.points).toBe(0);
  expect(s1.coins).toBe(960);
  expect(s1.award?.title).toContain('First task');
  // claiming pays once
  const s2 = reducer(s1, { type: 'achClaim', id: 'first-task' });
  expect(s2.points).toBe(DAY_ONE.find(x => x.id === 'first-task')!.points);
  expect(achOfSave(s2.ach).won['first-task'].claimed).toBe(true);
  expect(reducer(s2, { type: 'achClaim', id: 'first-task' })).toBe(s2);
  // a refused task counts nothing
  const broke = reducer(farm({ coins: 0 }), { type: 'task', step: 'landprep', id: 'tilling', price: 40, name: 'Tilling' });
  expect(achOfSave(broke.ach).stats.tasks).toBe(0);
});

test('today’s reward: once a day, bigger as the streak grows', () => {
  day = '2026-11-13';
  let s = reducer(farm(), { type: 'task', step: 'landprep', id: 'clearing', price: 40, name: 'Clearing' });
  expect(achOfSave(s.ach).daily).toEqual({ date: day, streak: 1, claimed: false });
  const coins = s.coins;
  s = reducer(s, { type: 'achDaily' });
  expect(s.coins).toBe(coins + streakReward(1).coins);
  expect(reducer(s, { type: 'achDaily' })).toBe(s);
  // the next day, the first thing done moves the streak on
  day = '2026-11-14';
  expect(unclaimed(achOfSave(s.ach), day)).toBe(1); // the first-task badge is still to claim
  s = reducer(s, { type: 'task', step: 'landprep', id: 'tilling', price: 40, name: 'Tilling' });
  expect(achOfSave(s.ach).streak.count).toBe(2);
  expect(s.award?.title).toBeTruthy();
  const before = { coins: s.coins, points: s.points };
  s = reducer(s, { type: 'achClaimAll' });
  expect(s.coins).toBe(before.coins + streakReward(2).coins);
  expect(s.points).toBe(before.points + streakReward(2).points + DAY_ONE.find(x => x.id === 'first-task')!.points);
  expect(unclaimed(achOfSave(s.ach), day)).toBe(0);
});

test('before the first crop checks are done, days count but no badge is won', () => {
  day = '2026-11-13';
  const s = reducer({ ...initialState, onboarded: false }, { type: 'farmer', name: 'Otieno', look: 1 });
  expect(achOfSave(s.ach).won).toEqual({});
  const t = reducer({ ...initialState, fs: { phase: 'walk2', at: 'first', opened: true } }, { type: 'fs', phase: 'done' });
  // finishing the first session is a badge of its own
  expect(achOfSave(t.ach).won.welcome).toBeTruthy();
  expect(achOfSave(t.ach).days).toBe(1);
});

test('a tractor drive, and a three-star one, are counted; a game put in place is not play', () => {
  day = '2026-11-13';
  const c = wakalaCase('tractor');
  const s = reducer(farm({ trial: c.trial }), { type: 'tractorDone', farm: 0, score: 90, stars: 3, Q: 0.9 });
  const a = achOfSave(s.ach);
  expect(a.stats.drives).toBe(1);
  expect(a.stats.topDrives).toBe(1);
  expect(a.won['first-drive']).toBeTruthy();
  expect(a.won['top-bronze']).toBeTruthy();
  // coins the drive paid count as earned
  expect(a.stats.coinsEarned).toBe(s.coins - 1000);
  const r = reducer(s, { type: 'reset', state: { coins: 99999 } });
  expect(achOfSave(r.ach).stats.coinsEarned).toBe(a.stats.coinsEarned);
});

test('certificates: a streak, a week of days played, a part of the game mastered', () => {
  // three days in a row
  let s = farm();
  for (const d of ['2026-11-13', '2026-11-14', '2026-11-15']) {
    day = d;
    s = reducer(s, { type: 'collect', id: `x-${d}`, coins: 1, text: 'collected' });
  }
  let a = achOfSave(s.ach);
  expect(a.certs.map(c => c.id)).toContain('streak-3');
  expect(a.won['streak-bronze']).toBeTruthy();
  // the seventh day played: the week's certificate, with what was done that week
  for (const d of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']) {
    day = d;
    s = reducer(s, { type: 'collect', id: `x-${d}`, coins: 1, text: 'collected' });
  }
  a = achOfSave(s.ach);
  const week = a.certs.find(c => c.id === 'week-1')!;
  expect(week).toBeTruthy();
  expect(a.certs.map(c => c.id)).toContain('streak-7');
  // every badge in field rounds of a tier: a mastery certificate
  const rounds = ACHIEVEMENTS.filter(x => x.game === 'rounds' && (x.tier === 'bronze' || x.tier === 'day1'));
  const ready = farm({ ach: { ...achOfSave(undefined), stats: { ...achOfSave(undefined).stats, roundsRight: 5 } } });
  // (the welcome badge is won here too: it is every-day's, not field rounds')
  day = '2026-11-20';
  const m = reducer(ready, { type: 'collect', id: 'milk', coins: 1, text: 'collected' });
  const am = achOfSave(m.ach);
  expect(rounds.every(x => am.won[x.id])).toBe(true);
  expect(am.certs.map(c => c.id)).toContain('mastery-rounds-bronze');
});

test('a save from before achievements loads with everything in place', () => {
  const a = achOfSave({ streak: { count: 4, best: 6, last: '2026-11-10' } } as never);
  expect(a.stats.tasks).toBe(0);
  expect(a.streak.best).toBe(6);
  expect(a.won).toEqual({});
  expect(a.certs).toEqual([]);
});

test('the Achievements page: a badge won on the farm is claimed on the page, and today’s reward with it', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as unknown as Win).__lima.jump({ view: 'classic', coins: 5000, points: 0 }));
  // a farming task: the pop-up says a badge was won
  await page.evaluate(() => (window as unknown as Win).__lima.dispatch({ type: 'task', step: 'landprep', id: 'clearing', price: 40, name: 'Clearing' }));
  await expect(page.locator('.award-pop')).toContainText('badges won');
  await expect(page.getByRole('button', { name: /^Achievements: 1-day streak, \d+ rewards? to claim/ })).toBeVisible();
  await page.evaluate(() => (window.location.hash = '#/achievements/today'));
  await expect(page.locator('.set-title-bar')).toContainText('Achievements · Today');
  await page.getByRole('button', { name: /^Claim First task/ }).click();
  await expect.poll(async () => (await state(page)).points).toBe(25);
  await page.getByRole('button', { name: /^Claim all/ }).click();
  await expect.poll(async () => (await state(page)).ach.daily.claimed).toBe(true);
  await expect(page.locator('.ach-daily')).toContainText('claimed');
  // the badges and the certificates
  await page.getByRole('button', { name: 'Badges', exact: true }).click();
  await expect(page).toHaveURL(/#\/achievements\/badges$/);
  await page.getByRole('tab', { name: /Tractor \d/ }).click();
  await expect(page.locator('.ach-badge').first()).toBeVisible();
  await page.getByRole('button', { name: 'Certificates', exact: true }).click();
  await expect(page.locator('.ach-none')).toContainText('Every 7 days played');
});
