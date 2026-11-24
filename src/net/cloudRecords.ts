/* What the cloud save files in its own tables, worked out from the game state (src/net/cloud.ts sends it with each
   save; the database's temolima_save() writes each list to its table):
   - player:        temolima_players      the farmer, money, points, level, days played, streak, learning credits
   - achievements:  temolima_achievements every badge won, with its game, tier and name
   - certificates:  temolima_certificates every certificate given (weeks, streaks, mastery, levels)
   - modules:       temolima_learning_modules  My Progress: credits and stage in each module
   - levels:        temolima_learning_levels   certification levels reached
   - learning:      temolima_learning_activity Farm basics lessons read, climate-smart practices, courses booked
   - partnerCodes:  temolima_partner_codes     partner offers saved, with the player's code for each
   - rewards:       temolima_rewards           rewards redeemed with points
   Names and titles are copied in so the tables read on their own in the Supabase table editor. */

import type { GameState } from '../state';
import { ACHIEVEMENTS, achOfSave } from '../achievements/model';
import { achClock, viewOf } from '../achievements/track';
import { LEVELS, MODULES, moduleCredits, moduleMax, stageOf, totalCredits, type ProgressView } from '../progress/model';
import { PRACTICES } from '../csa/data';
import { csaOf } from '../csa/model';
import { COURSES } from '../training/data';
import { BASICS } from '../learn/glossary';
import { brandOf, offerCode } from '../partners/data';
import { REWARDS } from '../data';

export interface CloudRecords {
  player: {
    farmer_name: string | null;
    farmer_look: number | null;
    country: string | null;
    coins: number;
    points: number;
    level: number;
    xp: number;
    season: number;
    stage: number;
    days_played: number;
    streak: number;
    best_streak: number;
    learning_credits: number;
    levels_reached: number;
    badges_won: number;
    play_seconds: number;
    onboarded: boolean;
  };
  achievements: { badge_id: string; game: string | null; tier: string | null; title: string | null; won_on: string | null; claimed: boolean }[];
  certificates: { cert_id: string; kind: string; title: string; line: string | null; game: string | null; issued_on: string | null }[];
  modules: { module_id: string; name: string; credits: number; max_credits: number; stage: string }[];
  levels: { level_id: string; n: number; name: string; reached_on: string | null; claimed: boolean }[];
  learning: { kind: 'lesson' | 'practice' | 'course'; item_id: string; title: string | null; score: number | null; xp: number | null; on_date: string | null; ref: string | null }[];
  partnerCodes: { brand_id: string; brand_name: string | null; offer_title: string | null; code: string }[];
  rewards: { reward_id: string; name: string | null; percent_off: number | null }[];
}

const day = (d: unknown) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null);
const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0);

export function cloudRecords(s: GameState): CloudRecords {
  const a = achOfSave(s.ach);
  const v = viewOf(s, a, achClock.today());
  const p: ProgressView = { ach: a, v, courses: v.courses };
  const csa = csaOf(s.csa);
  const farmer = s.farmer?.name ?? '';

  return {
    player: {
      farmer_name: s.farmer?.name ?? null,
      farmer_look: s.farmer?.look ?? null,
      country: s.settings?.country || null,
      coins: Math.round(num(s.coins)),
      points: Math.round(num(s.points)),
      level: num(s.level),
      xp: Math.round(num(s.xp)),
      season: num(s.season),
      stage: num(s.stage),
      days_played: num(a.days),
      streak: num(v.streak),
      best_streak: num(a.streak.best),
      learning_credits: totalCredits(p),
      levels_reached: Object.keys(a.levels).length,
      badges_won: Object.keys(a.won).length,
      play_seconds: Math.round(num(s.playSeconds)),
      onboarded: !!s.onboarded,
    },
    achievements: Object.entries(a.won).map(([id, w]) => {
      const x = ACHIEVEMENTS.find(b => b.id === id);
      return { badge_id: id, game: x?.game ?? null, tier: x?.tier ?? null, title: x?.name ?? null, won_on: day(w.date), claimed: !!w.claimed };
    }),
    certificates: a.certs.map(c => ({ cert_id: c.id, kind: c.kind, title: c.title, line: c.line ?? null, game: c.game ?? null, issued_on: day(c.date) })),
    modules: MODULES.map(m => ({ module_id: m.id, name: m.name, credits: moduleCredits(m.id, p), max_credits: moduleMax(m.id), stage: stageOf(m.id, p) })),
    levels: Object.entries(a.levels).map(([id, w]) => {
      const l = LEVELS.find(x => x.id === id);
      return { level_id: id, n: l?.n ?? 0, name: l?.name ?? id, reached_on: day(w.date), claimed: !!w.claimed };
    }),
    learning: [
      ...(s.basics ?? []).map(i => ({ kind: 'lesson' as const, item_id: BASICS[i]?.id ?? String(i), title: BASICS[i]?.title ?? null, score: null, xp: null, on_date: null, ref: null })),
      ...PRACTICES.filter(x => csa.best[x.id] !== undefined || csa.xp[x.id] !== undefined).map(x => ({
        kind: 'practice' as const,
        item_id: x.id,
        title: x.name,
        score: csa.best[x.id] ?? null,
        xp: csa.xp[x.id] ?? null,
        on_date: null,
        ref: null,
      })),
      ...(s.trainings ?? []).map(t => ({ kind: 'course' as const, item_id: t.id, title: COURSES.find(c => c.id === t.id)?.title ?? null, score: null, xp: null, on_date: day(t.date), ref: t.ref ?? null })),
    ],
    partnerCodes: (s.offers ?? []).map(id => {
      const b = brandOf(id);
      return { brand_id: id, brand_name: b?.name ?? null, offer_title: b?.offer.title ?? null, code: offerCode(id, farmer) };
    }),
    rewards: s.redeemed.map(id => {
      const r = REWARDS.find(x => x.id === id);
      return { reward_id: id, name: r?.name ?? null, percent_off: r?.off ?? null };
    }),
  };
}
