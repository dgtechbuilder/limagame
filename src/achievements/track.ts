/* Achievements, wired to the game: after every action, look at what it actually did (a task finished, a bed read
   right, a drive done, a day of business run) and count it; a day with something done moves the streak on; badges
   whose goal is met are won, and certificates that are due are given. Kept out of the main reducer, as climate
   tracking is, so the farming rules stay readable; the rules themselves are in model.ts.

   Nothing here changes coins or points: rewards wait on the Achievements page until the player claims them. */

import type { Action, GameState } from '../state';
import type { Trial } from '../trials/model';
import { money } from '../money';
import {
  achOf,
  achOfSave,
  dueCertificates,
  localDay,
  newlyWon,
  playDay,
  streakNow,
  weekSummary,
  type AchState,
  type AchStats,
  type AchView,
} from './model';

/** The day the game counts in (tests set their own). */
export const achClock = { today: () => localDay() };

/** What the badges read, from the saved game and the achievement counts. */
export function viewOf(s: GameState, a: AchState, today: string): AchView {
  return {
    stats: a.stats,
    streak: streakNow(a, today),
    days: a.days,
    onboarded: s.fs.phase === 'done',
    level: s.level,
    seasonsSold: s.history.length,
    harvests: s.trialHistory.length,
    bizDays: s.biz ? s.biz.day - 1 : 0,
    helped: s.biz?.helped ?? 0,
    owned: s.biz?.owned.length ?? 0,
    credits: s.climate.credits,
  };
}

const treated = (t: Trial | null | undefined) => (t ? Object.values(t.checks).filter(c => c.treated).length : 0);

/** The counts an action adds (only what it really did: a refused action adds nothing). */
function counted(prev: GameState, s: GameState, a: Action): Partial<AchStats> {
  const add: Partial<AchStats> = {};
  switch (a.type) {
    case 'task':
      if (s.doneTasks.length > prev.doneTasks.length) add.tasks = 1;
      break;
    case 'roundResult': {
      const before = prev.rounds.day === a.day && prev.rounds.done[a.id]?.right;
      if (a.right && !before && s.rounds.done[a.id]?.right) add.roundsRight = 1;
      break;
    }
    case 'trialCheck': {
      const key = `${a.farm}:${a.day}`;
      if (a.right && !prev.trial?.checks[key]?.right && s.trial?.checks[key]?.right) add.checksRight = 1;
      break;
    }
    case 'tractorDone':
      add.drives = 1;
      if (a.stars >= 3) add.topDrives = 1;
      break;
    case 'fieldMark':
      if (prev.field.cycle === s.field.cycle && (s.field.bonus?.length ?? 0) > (prev.field.bonus?.length ?? 0)) add.seatJobs = 1;
      break;
    case 'buy':
      if (s.inventory.length > prev.inventory.length) add.buys = 1;
      break;
    case 'collect':
      if (s.coins > prev.coins) add.collects = 1;
      break;
  }
  // a problem treated: in the rounds, or by hand in the farm world
  if (s.trial && prev.trial && s.trial.cycle === prev.trial.cycle) {
    const n = treated(s.trial) - treated(prev.trial);
    if (n > 0) add.treatments = n;
  }
  // the farms planted: from the plan, or the first planting period as it starts
  if (s.trial?.phase === 'growing' && (prev.trial?.phase !== 'growing' || prev.trial.cycle !== s.trial.cycle)) add.plantings = 1;
  // coins earned by playing (claimed rewards are not earnings)
  if (s.coins > prev.coins && a.type !== 'achClaim' && a.type !== 'achDaily' && a.type !== 'achClaimAll') add.coinsEarned = s.coins - prev.coins;
  return add;
}

let awardId = 0;

/** Every action's achievements: counts, the streak, badges won, certificates given, and the pop-up announcing them.
    `played`: the action finished something (it earned a sound), so today counts as a day played. */
export function trackAchievements(prev: GameState, s: GameState, a: Action, played: boolean, today = achClock.today()): GameState {
  // a whole game put in place (Reset progress, design review, play-tests) is not play
  if (a.type === 'reset') return s;
  // saves are filled in on loading (state.ts), so the state's own record is used as it is: an action that changes
  // nothing here returns the very same state
  let ach = s.ach ?? achOfSave(undefined);
  const add = counted(prev, s, a);
  if (Object.keys(add).length) {
    const stats = { ...ach.stats };
    for (const [k, n] of Object.entries(add) as [keyof AchStats, number][]) stats[k] += n;
    ach = { ...ach, stats };
  }
  const newDay = played && ach.streak.last !== today;
  if (played) ach = playDay(ach, today);
  // badges and certificates open with the farm, once the first crop checks are done
  if (s.fs.phase !== 'done') return ach === s.ach ? s : { ...s, ach };

  const v = viewOf(s, ach, today);
  const won = newlyWon(ach, v);
  if (won.length) ach = { ...ach, won: { ...ach.won, ...Object.fromEntries(won.map(x => [x.id, { date: today, claimed: false }])) } };
  const certs = dueCertificates(ach, v, today);
  if (certs.length) {
    const week = certs.some(c => c.kind === 'week');
    ach = {
      ...ach,
      certs: [...ach.certs, ...certs],
      // the next week's certificate sums up from here
      ...(week ? { weekFrom: { ...ach.stats, seasons: v.seasonsSold, helped: v.helped } } : {}),
    };
  }
  if (ach === s.ach) return s;

  // the pop-up: the biggest news first
  const n = won.length;
  const award =
    certs.length > 0
      ? { title: `Certificate: ${certs[0].title}`, line: n ? `and ${n} badge${n === 1 ? '' : 's'} won · see them in Achievements` : 'Yours to keep in Achievements' }
      : n > 0
        ? { title: n === 1 ? `Badge won: ${won[0].name}` : `${n} badges won`, line: `+${won.reduce((p, x) => p + x.points, 0)} points to claim in Achievements` }
        : newDay && ach.streak.count > 1
          ? { title: `Day ${ach.streak.count} in a row 🔥`, line: 'Today’s reward is waiting in Achievements' }
          : newDay
            ? { title: 'Welcome back 🔥', line: 'A new streak starts today: claim your reward in Achievements' }
            : null;
  return { ...s, ach, ...(award ? { award: { id: ++awardId, ...award } } : {}) };
}

/** A week's certificate summary, for screens that show the week so far. */
export const weekSoFar = (s: GameState, today = achClock.today()) => {
  const a = achOfSave(s.ach);
  return weekSummary(a, viewOf(s, a, today));
};

/** A badge's reward, as words. */
export const rewardText = (id: string) => {
  const x = achOf(id);
  if (!x) return '';
  return `+${x.points} points${x.coins ? ` · +${money(x.coins)} coins` : ''}`;
};
