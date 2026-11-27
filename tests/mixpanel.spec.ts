import { expect, test, type Page } from '@playwright/test';
import { state, type Win } from './helpers';

/* Mixpanel (src/analytics): the tracking plan's events, read from the game as it is played. The play-tests never send
   to Mixpanel; the test sink ('lima-mp-test') keeps every event on the page instead, in window.__limaMixpanel. */

type Ev = { name: string; props: Record<string, unknown> };
const sent = (page: Page) => page.evaluate(() => ((window as unknown as { __limaMixpanel?: Ev[] }).__limaMixpanel ?? []) as Ev[]);
const named = async (page: Page, name: string) => (await sent(page)).filter(e => e.name === name);
const dispatch = (page: Page, a: Record<string, unknown>) => page.evaluate(x => (window as unknown as Win).__lima.dispatch(x), a);

async function bootTracked(page: Page, query = '') {
  await page.goto('./?dev');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.localStorage.setItem('lima-mp-test', '1');
  });
  await page.goto(`./?dev${query}`);
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
}

test('a new player: first visit, onboarding, tutorial steps, learn pages, a level, the session', async ({ page }) => {
  await bootTracked(page, '&utm_source=radio&utm_campaign=launch');

  // first visit: where they came from, once
  await expect.poll(async () => (await named(page, 'first_visit')).length).toBe(1);
  const fv = (await named(page, 'first_visit'))[0].props;
  expect(fv).toMatchObject({ referrer: 'direct', utm_source: 'radio', utm_campaign: 'launch', device_type: 'desktop' });
  expect(String(fv.browser)).toMatch(/^Chrome \d+/);
  expect(String(fv.landing_page)).not.toContain('utm_');
  // every event carries the session and the version
  expect(fv.session_id).toBeTruthy();
  expect(fv.game_version).toBeTruthy();

  const started = await named(page, 'onboarding_started');
  expect(started).toHaveLength(1);
  expect(started[0].props).toMatchObject({ onboarding_variant: 'first_session_v1', entry_point: 'post_first_visit' });
  expect(started[0].props.locale).toBeTruthy();

  // create the farmer: step 1 done
  await page.locator('.name-chip', { hasText: 'Wanjiku' }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: "Twende! Let's go", exact: true }).click();
  await expect.poll(async () => (await state(page)).fs.phase).toBe('story');
  await expect.poll(async () => (await named(page, 'tutorial_step_completed')).length).toBe(1);
  const step = (await named(page, 'tutorial_step_completed'))[0].props;
  expect(step).toMatchObject({ step_id: 'create_farmer', step_number: 1, success: true });
  expect(typeof step.completion_time_seconds).toBe('number');

  // the rest of the first session, then done: onboarding completed once, with the country and its currency
  await dispatch(page, { type: 'settings', patch: { country: 'KE' } });
  await dispatch(page, { type: 'fs', phase: 'walk1' });
  await dispatch(page, { type: 'fs', phase: 'done', opened: true });
  await expect.poll(async () => (await named(page, 'onboarding_completed')).length).toBe(1);
  const done = (await named(page, 'onboarding_completed'))[0].props;
  expect(done).toMatchObject({ country_selected: 'KE', currency_selected: 'KES' });
  expect(typeof done.setup_complete_time_seconds).toBe('number');
  const steps = (await named(page, 'tutorial_step_completed')).map(e => e.props.step_id);
  expect(steps).toEqual(['create_farmer', 'farm_story', 'walk_to_maize']);

  // a Learn page, with the partner behind its section
  await dispatch(page, { type: 'open', modal: { kind: 'glossary', tab: 'feed' } });
  await expect.poll(async () => (await named(page, 'learn_page_viewed')).length).toBe(1);
  expect((await named(page, 'learn_page_viewed'))[0].props).toMatchObject({ section: 'glossary/feed', partner_id: 'rutuba', device_type: 'desktop' });
  await dispatch(page, { type: 'close' });

  // field rounds as a level: opened and left without a call is an exit
  await dispatch(page, { type: 'rounds', open: true });
  await expect.poll(async () => (await named(page, 'level_started')).length).toBe(1);
  expect((await named(page, 'level_started'))[0].props).toMatchObject({ level_id: 'field_rounds', difficulty_tier: 'Newcomer', campaign_cohort: 'none' });
  await dispatch(page, { type: 'rounds', open: false });
  await expect.poll(async () => (await named(page, 'level_completed_or_exited')).length).toBe(1);
  expect((await named(page, 'level_completed_or_exited'))[0].props).toMatchObject({ level_id: 'field_rounds', outcome: 'exited', attempt_count: 1 });

  // a finished climate-smart lesson: an activity, and the player's first win
  await dispatch(page, { type: 'csaDone', id: 'halfmoon', score: 3 });
  await expect.poll(async () => (await named(page, 'activity_completed')).length).toBeGreaterThan(0);
  expect((await named(page, 'activity_completed')).find(e => e.props.activity_type === 'lesson_completed')?.props).toMatchObject({ activity_value: 3, country: 'KE' });
  const win = await named(page, 'first_victory_completed');
  expect(win).toHaveLength(1);
  expect(win[0].props).toMatchObject({ level_id: 'csa:halfmoon', progress_path: 'solo_3d_farm' });
  expect(typeof win[0].props.first_win_time_seconds).toBe('number');

  // the page closing ends the session: its length and taps
  await page.mouse.click(400, 200);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const end = (await named(page, 'session_ended'))[0]?.props;
  expect(end).toBeTruthy();
  expect(end).toMatchObject({ country: 'KE', device_type: 'desktop', session_id: fv.session_id });
  expect(Number(end.click_count)).toBeGreaterThan(0);
  expect(typeof end.duration_seconds).toBe('number');
});

test('a reload sends no second first visit or onboarding start', async ({ page }) => {
  await bootTracked(page);
  await expect.poll(async () => (await named(page, 'first_visit')).length).toBe(1);
  await page.reload();
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
  await page.waitForTimeout(500);
  expect(await named(page, 'first_visit')).toHaveLength(0);
  expect(await named(page, 'onboarding_started')).toHaveLength(0);
});

test('nothing is recorded in a play-test without the test sink', async ({ page }) => {
  await page.goto('./?dev');
  await page.evaluate(() => window.localStorage.clear());
  await page.goto('./?dev');
  await page.waitForFunction(() => !!(window as unknown as Win).__lima);
  const requests: string[] = [];
  page.on('request', r => r.url().includes('mixpanel') && requests.push(r.url()));
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => (window as unknown as { __limaMixpanel?: unknown }).__limaMixpanel)).toBeUndefined();
  expect(requests.filter(u => !u.includes('localhost'))).toEqual([]);
});
