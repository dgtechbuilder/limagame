/* The game's Mixpanel events, read from the game as it is played. App calls useAnalytics once; nothing else in the UI
   changes. Each event is found by comparing the state before and after a change (and the actions that made it), so a
   refused action (not enough money) sends nothing. Event names and properties are the tracking plan
   (docs/analytics.md has the mapping from the plan's words to the game's). */

import { useCallback, useEffect, useRef, type Dispatch } from 'react';
import type { Action, GameState } from '../state';
import { FULL } from '../world/field';
import { JOBS_MAX } from '../onsite/model';
import { countryOf, toUsd } from '../money';
import { evidenceOf } from '../evidence/model';
import { LEVELS } from '../progress/model';
import { BRANDS, type PartnerCategory } from '../partners/data';
import { cloudPlayerId } from '../net/cloud';
import { trackListeners } from '../first/track';
import { countPage, mpIdentify, mpOn, mpPeopleSet, mpRegister, mpTrack } from './mixpanel';
import { forestOf, plantOf } from '../forest/model';
import { pathOf } from '../route';
import { browserOf, deepLinked, deviceOf, hashedId, keep, kept, landingOf, locale, randomId, referrerOf, secsSince, today, utmOf } from './context';

/** The first session has one version so far; a new one (an A/B test) gets a new name here. */
export const ONBOARDING_VARIANT = 'first_session_v1';
const SAVE_KEY = 'lima-farming-game:v2';
declare const __LIMA_VERSION__: string;
export const GAME_VERSION = typeof __LIMA_VERSION__ === 'string' ? __LIMA_VERSION__ : 'dev';

/* ---------------- the first session as tutorial steps ---------------- */

type Phase = GameState['fs']['phase'];
/** Each moment of the first session, in order (src/first/FirstSession.tsx); the retry moments come only after a wrong call. */
export const TUTORIAL_STEPS: Record<Exclude<Phase, 'done'>, { id: string; n: number }> = {
  create: { id: 'create_farmer', n: 1 },
  story: { id: 'farm_story', n: 2 },
  walk1: { id: 'walk_to_maize', n: 3 },
  update: { id: 'farm_update', n: 4 },
  review1: { id: 'first_crop_check', n: 5 },
  walkRetry: { id: 'walk_to_back_maize', n: 6 },
  retry: { id: 'retry_crop_check', n: 7 },
  walk2: { id: 'walk_to_sukuma', n: 8 },
  review2: { id: 'second_crop_check', n: 9 },
};

/* ---------------- learning pages and their partners ---------------- */

/** The partner category behind each Farm words section (its brand is the partner on that content). */
const SECTION_PARTNER: Partial<Record<string, PartnerCategory>> = {
  feed: 'Fertilizer',
  seed: 'Seed',
  water: 'Water',
  machines: 'Tractors',
  power: 'Solar',
  basics: 'Training',
};
const partnerFor = (section: string) => {
  const cat = SECTION_PARTNER[section];
  return cat ? BRANDS.find(b => b.category === cat)?.id : undefined;
};

/** The Learn page on show, if any: a Farm words section (or Farm basics), or a Climate Smart Agriculture lesson. */
function learnPage(s: GameState): string | null {
  const m = s.modal;
  if (m?.kind === 'glossary') return `glossary/${m.tab ?? 'basics'}`;
  if (m?.kind === 'climate' && m.tab === 'csa' && m.practice) return `csa/${m.practice}`;
  // a mini forest plant's card: what it is and what it does for the climate (src/forest)
  if (m?.kind === 'forest' && m.plant) return `forest/${m.plant}`;
  return null;
}

/* ---------------- levels ---------------- */

/** The certification level reached (My Progress), as the player's difficulty tier. */
function tierOf(s: GameState): string {
  const got = s.ach?.levels ?? {};
  const top = [...LEVELS].reverse().find(l => got[l.id]);
  return top ? top.name : 'Newcomer';
}
const cohortOf = (s: GameState) => evidenceOf(s.evidence).tags.join(',') || 'none';
const countryCode = (s: GameState) => s.settings.country || undefined;

/** Attempts at a level today (kept on the phone, so a reload does not reset them). */
function attempt(level: string): number {
  const k = kept();
  const a = k.attempts?.day === today() ? k.attempts : { day: today(), n: {} as Record<string, number> };
  const n = (a.n[level] ?? 0) + 1;
  keep({ attempts: { day: a.day, n: { ...a.n, [level]: n } } });
  return n;
}
const attemptsSoFar = (level: string) => {
  const a = kept().attempts;
  return a?.day === today() ? (a.n[level] ?? 1) : 1;
};

/* ---------------- boot: first visit, super properties ---------------- */

let session = { id: randomId(), start: Date.now(), clicks: 0 };
const device = () => deviceOf();
const browser = () => browserOf();

function hadSave(): boolean {
  try {
    return !!window.localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

/** Once on boot, before the first state is read: first_visit for a new player, and what every event carries. */
function boot(s: GameState) {
  mpRegister({ platform: 'web', game_version: GAME_VERSION, browser: browser(), device_type: device(), session_id: session.id, country: countryCode(s) });
  const k = kept();
  if (k.firstVisit !== undefined || (k as { seen?: boolean }).seen) return;
  if (hadSave()) {
    // a player from before analytics: no first visit to report, and no first win to time
    keep({ seen: true, onboarded: s.fs.phase === 'done', firstWin: s.fs.phase === 'done' } as Partial<typeof k>);
    return;
  }
  keep({ firstVisit: Date.now() });
  mpTrack('first_visit', { referrer: referrerOf(), ...utmOf(), landing_page: landingOf(), browser: browser(), device_type: device() });
}

/** Tie events to the player once they exist: a one-way id from the player code, never the code itself. */
function identify(s: GameState) {
  if (!s.farmer) return;
  const code = cloudPlayerId();
  if (!code) return;
  void hashedId(code).then(id => {
    if (!id) return;
    mpIdentify(id);
    const c = countryOf(s.settings.country);
    mpPeopleSet({ country: countryCode(s), currency: c.currency.code, onboarding_variant: ONBOARDING_VARIANT });
  });
}

/* ---------------- the hook ---------------- */

export function useAnalytics(s: GameState, dispatch: Dispatch<Action>): Dispatch<Action> {
  const prev = useRef<GameState | null>(null);
  const pending = useRef<Action[]>([]);
  const stepAt = useRef(Date.now());
  const roundsHit = useRef(false);

  const tracked = useCallback<Dispatch<Action>>(
    a => {
      if (mpOn()) pending.current.push(a);
      dispatch(a);
    },
    [dispatch],
  );

  // boot, clicks, the session's end, and the first session's own moments (a skipped story, a wrong call)
  useEffect(() => {
    if (!mpOn()) return;
    boot(s);
    identify(s);
    countPage();
    if (s.fs.phase === 'create' && !s.farmer) startOnboarding(s);
    const click = () => (session.clicks += 1);
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      const st = live.current;
      mpTrack('session_ended', { session_id: session.id, duration_seconds: secsSince(session.start), click_count: session.clicks, country: countryCode(st), device_type: device() }, true);
    };
    const vis = () => {
      if (document.visibilityState === 'hidden') return end();
      if (!ended) return;
      // back to the game: a new session
      ended = false;
      session = { id: randomId(), start: Date.now(), clicks: 0 };
      mpRegister({ session_id: session.id });
    };
    const heard = (name: string) => {
      if (name === 'story_skipped') storySkipped.current = true;
    };
    document.addEventListener('pointerdown', click, true);
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', end);
    trackListeners.push(heard);
    return () => {
      document.removeEventListener('pointerdown', click, true);
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('pagehide', end);
      trackListeners.splice(trackListeners.indexOf(heard), 1);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = useRef(s);
  live.current = s;
  const storySkipped = useRef(false);

  useEffect(() => {
    if (!mpOn()) return;
    const p = prev.current;
    prev.current = s;
    const actions = pending.current.splice(0);
    if (!p || p === s) return;
    observe(p, s, actions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s]);

  function startOnboarding(st: GameState) {
    const k = kept();
    if (k.onboardingStart !== undefined) return;
    keep({ onboardingStart: Date.now() });
    stepAt.current = Date.now();
    const entry = deepLinked() ? 'deep_link' : k.firstVisit !== undefined && Date.now() - k.firstVisit > 30 * 60_000 ? 'returning_visit' : 'post_first_visit';
    mpTrack('onboarding_started', { onboarding_variant: ONBOARDING_VARIANT, entry_point: entry, locale: locale(), country: countryCode(st) });
  }

  function activity(st: GameState, type: string, value?: number, extra: Record<string, unknown> = {}) {
    mpTrack('activity_completed', { session_id: session.id, activity_type: type, activity_value: value, country: countryCode(st), ...extra });
  }

  function win(p: GameState, st: GameState, level: string) {
    const k = kept();
    if (k.firstWin || st.fs.phase !== 'done') return;
    keep({ firstWin: true });
    mpTrack('first_victory_completed', {
      level_id: level,
      first_win_time_seconds: secsSince(k.firstVisit),
      progress_path: st.view === 'world' ? 'solo_3d_farm' : 'solo_classic_farm',
      energy_spent: Math.max(0, Math.round(toUsd(p.coins - st.coins) * 100) / 100),
    });
  }

  function levelStart(st: GameState, level: string) {
    const n = attempt(level);
    mpTrack('level_started', { level_id: level, campaign_cohort: cohortOf(st), difficulty_tier: tierOf(st), start_timestamp: new Date().toISOString(), attempt_count: n });
  }
  function levelEnd(level: string, outcome: 'completed' | 'failed' | 'exited' | 'timed_out' | 'energy_blocked') {
    mpTrack('level_completed_or_exited', { level_id: level, outcome, attempt_count: attemptsSoFar(level), game_version: GAME_VERSION });
  }

  function observe(p: GameState, st: GameState, actions: Action[]) {
    const did = <T extends Action['type']>(t: T) => actions.filter((a): a is Extract<Action, { type: T }> => a.type === t);

    // the country can change in Settings: every event after carries the new one
    if (p.settings.country !== st.settings.country) mpRegister({ country: countryCode(st) });

    // a new page (screen) seen: the consent card comes after a few (src/analytics/Consent.tsx)
    if (pathOf(p) !== pathOf(st)) countPage();

    /* ---- the first session ---- */
    const from = p.fs.phase;
    const to = st.fs.phase;
    if (to === 'create' && !st.farmer && from !== 'create') startOnboarding(st);
    if (from !== to && from !== 'done') {
      const step = TUTORIAL_STEPS[from];
      const now = Date.now();
      // a wrong call on the first check sends the farmer back to retry: that step did not succeed
      const success = !(from === 'review1' && to === 'walkRetry') && !(from === 'story' && storySkipped.current);
      mpTrack('tutorial_step_completed', { step_id: step.id, step_number: step.n, completion_time_seconds: secsSince(stepAt.current, now), success });
      stepAt.current = now;
      if (from === 'story') storySkipped.current = false;
      if (from === 'create') identify(st);
    }
    if (from !== 'done' && to === 'done' && !kept().onboarded) {
      const k = keep({ onboarded: true });
      const c = countryOf(st.settings.country);
      mpTrack('onboarding_completed', { country_selected: st.settings.country || 'other', currency_selected: c.currency.code, setup_complete_time_seconds: secsSince(k.onboardingStart), browser: browser() });
      identify(st);
    }

    /* ---- levels: jobs on the farm, field rounds, climate-smart lessons, a six-farm season ---- */
    const pj = p.jobs ?? [];
    const sj = st.jobs ?? [];
    for (const j of sj) if (!pj.some(x => x.id === j.id)) levelStart(st, `job:${j.key}`);
    for (const j of pj) {
      if (sj.some(x => x.id === j.id)) continue;
      const done = did('jobDone').some(a => a.id === j.id);
      levelEnd(`job:${j.key}`, done ? 'completed' : 'exited');
      if (done) {
        activity(st, 'onsite_job_completed', j.points, { job: j.key });
        win(p, st, `job:${j.key}`);
      }
    }
    // a job refused because the farmer's hands are full: out of energy
    for (const a of did('jobAdd')) if (sj.length === pj.length && pj.length >= JOBS_MAX && !pj.some(j => j.key === a.job.key)) levelEnd(`job:${a.job.key}`, 'energy_blocked');

    if (!p.roundsOpen && st.roundsOpen) {
      roundsHit.current = false;
      levelStart(st, 'field_rounds');
    }
    for (const a of did('roundResult')) {
      if (a.right) roundsHit.current = true;
      activity(st, 'round_check_completed', a.right ? 1 : 0, { correct: a.right });
    }
    if (p.roundsOpen && !st.roundsOpen) {
      levelEnd('field_rounds', roundsHit.current ? 'completed' : 'exited');
      if (roundsHit.current) win(p, st, 'field_rounds');
    }

    const pc = p.modal?.kind === 'climate' && p.modal.tab === 'csa' ? p.modal.practice : undefined;
    const sc = st.modal?.kind === 'climate' && st.modal.tab === 'csa' ? st.modal.practice : undefined;
    const csaDone = did('csaDone');
    for (const a of csaDone) {
      if (a.id !== pc) levelStart(st, `csa:${a.id}`); // finished straight from a daily drill
      levelEnd(`csa:${a.id}`, 'completed');
      activity(st, 'lesson_completed', a.score, { lesson: `csa:${a.id}` });
      win(p, st, `csa:${a.id}`);
    }
    if (sc && sc !== pc) levelStart(st, `csa:${sc}`);
    if (pc && pc !== sc && !csaDone.some(a => a.id === pc)) levelEnd(`csa:${pc}`, 'exited');

    const pt = p.trial?.phase;
    const stp = st.trial?.phase;
    // a season starts (the first one by itself when the farm opens); its planting is the sow job on the farm, below
    if (pt !== 'growing' && stp === 'growing') levelStart(st, 'six_farms_season');
    if (pt === 'growing' && stp === 'done') {
      levelEnd('six_farms_season', 'completed');
      activity(st, 'harvest_completed', Math.max(0, Math.round(toUsd(st.coins - p.coins) * 100) / 100), { where: 'six_farms' });
      win(p, st, 'six_farms_season');
    }
    if (pt === 'growing' && stp !== 'growing' && stp !== 'done') levelEnd('six_farms_season', 'exited');

    /* ---- other activities ---- */
    // the walkable farm's work: a farm's job finished on every tile (clear, sow, weed… harvest)
    if (p.field.cycle === st.field.cycle && p.field.marks !== st.field.marks) {
      for (const [key, bits] of Object.entries(st.field.marks)) {
        if (bits !== FULL || p.field.marks[key] === FULL) continue;
        const job = key.split(':')[1];
        const type = job === 'sow' ? 'plant_completed' : job === 'harvest' ? 'harvest_completed' : 'field_job_completed';
        activity(st, type, undefined, { job, where: 'farm_world' });
        win(p, st, `field:${job}`);
      }
    }
    // the classic farm's season
    if (!p.harvested && st.harvested) {
      activity(st, 'harvest_completed', st.harvested.bags, { where: 'classic_farm' });
      win(p, st, 'classic_harvest');
    }
    if (did('completeSale').length && p.stage !== st.stage) activity(st, 'sale_completed', Math.round(toUsd(st.coins - p.coins) * 100) / 100, { where: 'classic_farm' });
    if (did('produceSell').length && st.coins > p.coins) activity(st, 'sale_completed', Math.round(toUsd(st.coins - p.coins) * 100) / 100, { where: 'market_stall' });
    for (const a of did('ghPlant')) if (st.greenhouse !== p.greenhouse) activity(st, 'plant_completed', a.score, { where: 'greenhouse' });
    for (const a of did('ghHarvest'))
      if (st.greenhouse !== p.greenhouse) {
        activity(st, 'harvest_completed', a.score, { where: 'greenhouse' });
        win(p, st, 'greenhouse_harvest');
      }
    // the mini forest: a harvest or a sale after seeing its climate cost, or the stand kept standing
    for (const a of did('forestSell'))
      if (st.forest !== p.forest) {
        const last = forestOf(st.forest).log[0];
        const usd = Math.round(toUsd(last.coins) * 100) / 100;
        activity(st, a.kind === 'fell' ? 'sale_completed' : 'harvest_completed', usd, { where: 'mini_forest', plant: a.id });
        mpTrack('forest_sale_decision', { session_id: session.id, decision: a.kind === 'fell' ? 'felled' : 'harvested', plant: a.id, plant_kind: plantOf(a.id).kind, money_usd: usd, co2_kg: Math.round(last.co2), credits_cancelled: last.credits, country: countryCode(st) });
        if (a.kind === 'crop') win(p, st, 'forest_harvest');
      }
    for (const a of did('forestKeep'))
      if (st.forest !== p.forest) mpTrack('forest_sale_decision', { session_id: session.id, decision: 'kept_standing', plant: a.id, plant_kind: plantOf(a.id).kind, country: countryCode(st) });
    for (const a of did('tractorDone')) {
      activity(st, 'tractor_job_completed', a.score, { stars: a.stars });
      win(p, st, 'tractor_job');
    }
    if ((st.basics ?? []).length > (p.basics ?? []).length) activity(st, 'lesson_completed', undefined, { lesson: 'farm_basics' });

    /* ---- Learn pages ---- */
    const page = learnPage(st);
    if (page && page !== learnPage(p)) {
      const section = page.split('/')[1];
      mpTrack('learn_page_viewed', { section: page, partner_id: page.startsWith('glossary/') ? partnerFor(section) : undefined, browser: browser(), device_type: device() });
    }
  }

  return tracked;
}
