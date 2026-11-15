/* My Progress: the farmer's learning journey over their first days and weeks.

   It is built in modules, one for each part of the game (the same parts as the badges) plus farmer courses. Every
   badge won pays learning credits into its module, and every course booked pays credits into Courses. Certification
   levels sit on top: each one opens on a day of play (day 1, day 2, day 4, then weeks 1, 2 and 4) and asks for credits
   and for modules started or advanced, so the levels come one after another over the first weeks, not all at once.

   A level reached is a certificate (kept with the others on the Certificates tab) and a reward to claim. Everything a
   designer might tune is in the tables below: what each badge tier pays, the module stages, and the levels. Adding a
   module is one more entry in MODULES. */

import { ACHIEVEMENTS, type AchGame, type AchState, type AchView, type Tier } from '../achievements/model';

/* ---------------- credits ---------------- */

/** Learning credits a badge pays into its module, by tier. */
export const TIER_CREDITS: Record<Tier, number> = { day1: 1, bronze: 2, silver: 4, gold: 8, special: 4 };
/** Credits for each farmer course booked, and the most that count. */
export const COURSE_CREDITS = 5;
export const COURSES_COUNTED = 4;

/* ---------------- modules ---------------- */

export type ModuleId = AchGame | 'courses';

export interface Module {
  id: ModuleId;
  name: string;
  icon: string;
  /** what it teaches */
  subject: string;
  /** how credits are earned in it, in a few words */
  how: string;
}

export const MODULES: Module[] = [
  { id: 'farm', name: 'Farm Moja', icon: '🌽', subject: 'Maize farming, start to sale', how: 'Farming tasks, seasons sold, coins earned' },
  { id: 'rounds', name: 'Field rounds', icon: '🔍', subject: 'Crop scouting', how: 'Beds read right' },
  { id: 'six', name: 'Six farms', icon: '🧪', subject: 'Farm trials and crop care', how: 'Plantings, daily checks, treatments, harvests' },
  { id: 'tractor', name: 'Tractor', icon: '🚜', subject: 'Tractor driving', how: 'Drives, three-star jobs, jobs from the seat' },
  { id: 'business', name: 'Tractor business', icon: '🤝', subject: 'Tractor services', how: 'Business days, farmers helped, a tractor of your own' },
  { id: 'climate', name: 'Climate', icon: '🌍', subject: 'Climate-smart farming', how: 'Climate credits earned' },
  { id: 'daily', name: 'Every day', icon: '🔥', subject: 'Coming back and growing', how: 'Streaks, days played, levels' },
  { id: 'courses', name: 'Courses', icon: '📚', subject: 'Farmer training', how: `Courses booked in Training (+${COURSE_CREDITS} each)` },
];
export const moduleOf = (id: ModuleId) => MODULES.find(m => m.id === id)!;

/** What the progress reads: the achievements, and the courses booked. */
export interface ProgressView {
  ach: AchState;
  v: AchView;
  courses: number;
}

const badgesIn = (id: ModuleId) => ACHIEVEMENTS.filter(x => x.game === id);

/** The credits there are to earn in a module. */
export function moduleMax(id: ModuleId): number {
  if (id === 'courses') return COURSE_CREDITS * COURSES_COUNTED;
  return badgesIn(id).reduce((n, x) => n + TIER_CREDITS[x.tier], 0);
}

/** The credits earned in a module. */
export function moduleCredits(id: ModuleId, p: ProgressView): number {
  if (id === 'courses') return COURSE_CREDITS * Math.min(COURSES_COUNTED, p.courses);
  return badgesIn(id)
    .filter(x => p.ach.won[x.id])
    .reduce((n, x) => n + TIER_CREDITS[x.tier], 0);
}

export const totalCredits = (p: ProgressView) => MODULES.reduce((n, m) => n + moduleCredits(m.id, p), 0);

/** A module's stage, from the share of its credits earned. */
export type Stage = 'new' | 'started' | 'practising' | 'proficient' | 'mastered';
export const STAGES: { id: Stage; name: string; from: number }[] = [
  { id: 'new', name: 'Not started', from: 0 },
  { id: 'started', name: 'Started', from: 0.0001 },
  { id: 'practising', name: 'Practising', from: 0.25 },
  { id: 'proficient', name: 'Proficient', from: 0.5 },
  { id: 'mastered', name: 'Mastered', from: 1 },
];
const STAGE_RANK: Record<Stage, number> = { new: 0, started: 1, practising: 2, proficient: 3, mastered: 4 };

export function stageOf(id: ModuleId, p: ProgressView): Stage {
  const share = moduleCredits(id, p) / (moduleMax(id) || 1);
  let out: Stage = 'new';
  for (const st of STAGES) if (share >= st.from) out = st.id;
  return out;
}
export const stageName = (st: Stage) => STAGES.find(x => x.id === st)!.name;
/** Modules at a stage or beyond. */
export const modulesAt = (st: Stage, p: ProgressView) => MODULES.filter(m => STAGE_RANK[stageOf(m.id, p)] >= STAGE_RANK[st]).length;

/* ---------------- certification levels ---------------- */

export interface Level {
  /** 1, 2, 3 ... */
  n: number;
  id: string;
  name: string;
  /** when it opens: days played */
  day: number;
  /** when it opens, in words (on the journey) */
  when: string;
  credits: number;
  /** modules at a stage or beyond */
  modules: { stage: Stage; count: number };
  /** what reaching it pays when claimed */
  coins: number;
  points: number;
  /** one line for its certificate */
  line: string;
}

export const LEVELS: Level[] = [
  { n: 1, id: 'level-1', name: 'Farm Starter', day: 1, when: 'Day 1', credits: 3, modules: { stage: 'started', count: 2 }, coins: 100, points: 50, line: 'For a first day of work on the farm' },
  { n: 2, id: 'level-2', name: 'Farm Apprentice', day: 2, when: 'Day 2', credits: 10, modules: { stage: 'started', count: 4 }, coins: 200, points: 100, line: 'For learning four parts of the farm' },
  { n: 3, id: 'level-3', name: 'Smart Farmer', day: 4, when: 'Day 4', credits: 22, modules: { stage: 'started', count: 6 }, coins: 300, points: 150, line: 'For farming, scouting and caring for crops across six modules' },
  { n: 4, id: 'level-4', name: 'Certified Smart Farmer', day: 7, when: 'Week 1', credits: 40, modules: { stage: 'practising', count: 3 }, coins: 500, points: 250, line: 'For a first week of practice across the whole farm' },
  { n: 5, id: 'level-5', name: 'Advanced Smart Farmer', day: 14, when: 'Week 2', credits: 75, modules: { stage: 'proficient', count: 3 }, coins: 800, points: 400, line: 'For two weeks of skilled, climate-smart farming' },
  { n: 6, id: 'level-6', name: 'Master Farmer', day: 28, when: 'Week 4', credits: 130, modules: { stage: 'proficient', count: 6 }, coins: 1500, points: 750, line: 'For a month of farming mastered module by module' },
];
export const levelOf = (id: string) => LEVELS.find(l => l.id === id);

/** What a level still needs: days, credits, modules (each 0 when met). */
export function levelNeeds(l: Level, p: ProgressView) {
  return {
    days: Math.max(0, l.day - p.ach.days),
    credits: Math.max(0, l.credits - totalCredits(p)),
    modules: Math.max(0, l.modules.count - modulesAt(l.modules.stage, p)),
  };
}
export const levelMet = (l: Level, p: ProgressView) => {
  const n = levelNeeds(l, p);
  return n.days === 0 && n.credits === 0 && n.modules === 0;
};

/** How far toward a level, 0 to 1 (the days, the credits and the modules weigh the same). */
export function levelProgress(l: Level, p: ProgressView): number {
  const part = (have: number, need: number) => (need <= 0 ? 1 : Math.min(1, have / need));
  return (part(p.ach.days, l.day) + part(totalCredits(p), l.credits) + part(modulesAt(l.modules.stage, p), l.modules.count)) / 3;
}

/** The levels reached, in order (a level is reached only after the one before it). */
export function levelsReached(a: AchState): Level[] {
  const out: Level[] = [];
  for (const l of LEVELS) {
    if (!a.levels[l.id]) break;
    out.push(l);
  }
  return out;
}

/** The level the farmer holds now (0 before the first), and the next to reach. */
export function currentLevel(a: AchState): { level: Level | null; next: Level | null } {
  const got = levelsReached(a);
  const level = got[got.length - 1] ?? null;
  return { level, next: LEVELS[got.length] ?? null };
}

/** Levels now due that are not yet reached (in order: a level waits for the one before it). */
export function dueLevels(p: ProgressView): Level[] {
  const out: Level[] = [];
  for (const l of LEVELS) {
    if (p.ach.levels[l.id]) continue;
    if (!levelMet(l, p)) break;
    out.push(l);
  }
  return out;
}
