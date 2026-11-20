/* Money at risk: every number a designer might tune, in one place (no code changes needed to tune them).

   A problem on a farm (pests, water, plant food, weeds, animals, hail…) has a stated cost: what it takes off that
   farm's harvest if it is never dealt with (DAMAGE[…].missed in src/trials/model.ts, times what the farm's harvest is
   worth). On the day it shows, part of that cost is at risk; each day it is left, more is, up to the whole stated cost.
   Dealing with it (read right, and the fix done by hand) takes it off the list: that amount is saved. */

export const RISK = {
  /** Share of the stated cost at risk on the day a problem shows. */
  startShare: 0.5,
  /** Share of the stated cost added for each day a problem is left unresolved (capped at the whole stated cost). */
  escalatePerDay: 0.25,
  /** An unresolved problem stays on its farm the next day (and the next), until it is dealt with or the harvest.
      Off: each day's problem stands alone, as before this feature (a missed one is simply lost). */
  carryOver: true,

  /* ---- forecast shocks (drought, flood, hail): off until confirmed ---- */

  /** Add the season's forecast shock exposure to the total. */
  includeShocks: false,
  /** Chance of each shock in a season, by forecast (placeholders until the climate team sets them). */
  shockOdds: {
    dry: { drought: 0.35, flood: 0.02, hail: 0.06 },
    normal: { drought: 0.1, flood: 0.05, hail: 0.06 },
    wet: { drought: 0.02, flood: 0.3, hail: 0.08 },
  },
  /** Share of the shock exposure crop cover takes away (a player with cover: the Lima Insurance offer, for now). */
  coverCut: 0.7,
} as const;

/** The share of a problem's stated cost at risk after it has been left this many days (0 on the day it shows). */
export const riskShare = (daysOpen: number) => Math.min(1, RISK.startShare + RISK.escalatePerDay * Math.max(0, daysOpen));
