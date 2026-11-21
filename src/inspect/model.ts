import type { Group, IssueId } from '../livestock/config';
import { roll, rollInt } from '../livestock/rand';
import { SUBJECTS, subjectOf } from './subjects';
import type { Early, SubjectId } from './types';

/* Full checks: what a check of every part finds early, and what is done about it. Each farm day, each subject shows a
   few early signs (drawn from its pool, the same ones all day). The player fixes one now (it takes a few seconds and
   its cost) or plans it for a later day; a planned sign stays until it is done. A sign dealt with keeps the problem it
   grows into away for a few days, and an animal check with its early signs dealt with lowers the chance of a problem
   that night; a planned job left past its day raises it. No screens here (src/livestock/Exam.tsx shows the check). */

export const CHECKS = {
  /** each early sign's chance to show on a day */
  chance: 0.3,
  /** at least and at most this many early signs a day, for each subject */
  min: 1,
  max: 3,
  /** a sign dealt with does not come back for this many days, and keeps its problem away as long */
  guard: 5,
  /** the night's chance of an animal problem, with the day's early signs dealt with, and with a plan overdue */
  dealt: 0.85,
  overdue: 1.2,
  /** points: an early sign fixed, and a check of every part (once a day for each subject) */
  points: { fix: 5, full: 15 },
  /** the days a sign can be planned for, from today */
  planDays: [1, 2, 3],
} as const;

export interface ChecksState {
  /** each subject, and the farm day every one of its parts was last checked */
  full: Partial<Record<SubjectId, number>>;
  /** each early sign (`subject:id`) and the farm day it was dealt with */
  fixed: Record<string, number>;
  /** each early sign (`subject:id`) planned, and the farm day it is planned for */
  planned: Record<string, number>;
}

export const newChecks = (): ChecksState => ({ full: {}, fixed: {}, planned: {} });
export const checksOf = (c: Partial<ChecksState> | undefined): ChecksState => ({ ...newChecks(), ...(c ?? {}) });
export const keyOf = (subject: SubjectId, id: string) => `${subject}:${id}`;

/** An early sign showing today; `planned` when the player planned it for a day. */
export interface Shown extends Early {
  planned?: number;
}

/** The early signs showing on this subject today: the planned ones, then the day's own (none that grows into a
    problem already showing). The same every time on the same day. */
export function earlyToday(c: Partial<ChecksState> | undefined, subject: SubjectId, day: number, active: IssueId[] = []): Shown[] {
  const ch = checksOf(c);
  const def = SUBJECTS[subject];
  if (!def) return [];
  const planned: Shown[] = def.early.filter(e => ch.planned[keyOf(subject, e.id)] !== undefined).map(e => ({ ...e, planned: ch.planned[keyOf(subject, e.id)] }));
  const open = def.early.filter(e => {
    if (ch.planned[keyOf(subject, e.id)] !== undefined) return false;
    const fixed = ch.fixed[keyOf(subject, e.id)];
    if (fixed !== undefined && day - fixed < CHECKS.guard) return false;
    return !(e.leads && active.includes(e.leads));
  });
  let today = open.filter(e => roll(`early:${subject}:${day}:${e.id}`) < CHECKS.chance);
  if (today.length < CHECKS.min && open.length) today = [open[rollInt(`early:${subject}:${day}`, 0, open.length - 1)]];
  return [...planned, ...today].slice(0, Math.max(CHECKS.max, planned.length));
}

/** Every planned job, soonest first. */
export function plannedOf(c: Partial<ChecksState> | undefined): { subject: SubjectId; early: Early; day: number }[] {
  const ch = checksOf(c);
  return Object.entries(ch.planned)
    .map(([k, day]) => {
      const [subject, id] = k.split(':') as [SubjectId, string];
      const early = SUBJECTS[subject]?.early.find(e => e.id === id);
      return early ? { subject, early, day } : null;
    })
    .filter((x): x is { subject: SubjectId; early: Early; day: number } => !!x)
    .sort((a, b) => a.day - b.day);
}

/** An early sign that grows into this problem was dealt with in the last few days: it keeps away. */
export function caughtEarly(c: Partial<ChecksState> | undefined, issue: IssueId, day: number): boolean {
  const ch = checksOf(c);
  return Object.values(SUBJECTS).some(d => d!.early.some(e => e.leads === issue && ch.fixed[keyOf(d!.id, e.id)] !== undefined && day - ch.fixed[keyOf(d!.id, e.id)] < CHECKS.guard));
}

/** What the checks do to the night's chance of an animal problem: the factor, and why. */
export function earlyRisk(c: Partial<ChecksState> | undefined, group: Group, day: number): { factor: number; why: string[] } {
  const ch = checksOf(c);
  const subject: SubjectId = group === 'cows' ? 'cow' : 'hen';
  const def = subjectOf(subject);
  let factor = 1;
  const why: string[] = [];
  if (def.early.some(e => ch.planned[keyOf(subject, e.id)] !== undefined && ch.planned[keyOf(subject, e.id)] < day)) (factor *= CHECKS.overdue), why.push('a planned job is overdue');
  else if (ch.full[subject] === day && def.early.some(e => ch.fixed[keyOf(subject, e.id)] === day)) (factor *= CHECKS.dealt), why.push('checked all over, early signs dealt with');
  return { factor, why };
}

interface CheckHost {
  coins: number;
  points: number;
  checks?: Partial<ChecksState>;
}

/** Deal with an early sign now: its cost, and points. */
export function checkFix<S extends CheckHost>(s: S, subject: SubjectId, id: string, day: number): { state: S; text: string } | { error: string } {
  const e = SUBJECTS[subject]?.early.find(x => x.id === id);
  if (!e) return { error: 'Nothing to fix there' };
  if (s.coins < e.fix.cost) return { error: `You need ${e.fix.cost - s.coins} more for that` };
  const ch = checksOf(s.checks);
  const k = keyOf(subject, id);
  const planned = { ...ch.planned };
  delete planned[k];
  return {
    state: { ...s, coins: s.coins - e.fix.cost, points: s.points + CHECKS.points.fix, checks: { ...ch, fixed: { ...ch.fixed, [k]: day }, planned } },
    text: `Caught early: ${e.fix.label.charAt(0).toLowerCase()}${e.fix.label.slice(1)} · +${CHECKS.points.fix} points`,
  };
}

/** Plan an early sign for a later day (today or later). */
export function checkPlan<S extends CheckHost>(s: S, subject: SubjectId, id: string, on: number, day: number): { state: S; text: string } | { error: string } {
  const e = SUBJECTS[subject]?.early.find(x => x.id === id);
  if (!e) return { error: 'Nothing to plan there' };
  const at = Math.max(day, Math.round(on));
  const ch = checksOf(s.checks);
  return { state: { ...s, checks: { ...ch, planned: { ...ch.planned, [keyOf(subject, id)]: at } } }, text: `Planned for day ${at}: ${e.fix.label.charAt(0).toLowerCase()}${e.fix.label.slice(1)}` };
}

/** A check is finished: every part looked at (points, once a day), or only some. */
export function checkDone<S extends CheckHost>(s: S, subject: SubjectId, checked: number, day: number): { state: S; text: string } {
  const def = subjectOf(subject);
  const total = def.parts.length;
  const ch = checksOf(s.checks);
  if (checked < total) return { state: s, text: `Checked ${checked} of ${total} parts of the ${def.name}` };
  const first = ch.full[subject] !== day;
  return {
    state: { ...s, points: s.points + (first ? CHECKS.points.full : 0), checks: { ...ch, full: { ...ch.full, [subject]: day } } },
    text: `Every part of the ${def.name} checked${first ? ` · +${CHECKS.points.full} points` : ''}`,
  };
}
