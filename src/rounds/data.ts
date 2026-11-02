/* Field rounds: seven farms, one after the other. Each farm keeps one crop for 21 real days and meets a new
   situation every day (see hazards.ts). To add or move a farm, edit FARMS.
   {name} is replaced with the farmer's name everywhere. */

import type { Call, Condition, Crop } from '../first/data';
import { HAZARDS, situation, withCrop, type HazardId, type RoundPart, type Stage } from './hazards';
import type { Farm } from './farms';

export type { RoundPart } from './hazards';
export { FARMS, ROUND_POINTS, type Farm } from './farms';

export const ROUND_PARTS: RoundPart[] = ['crop', 'pests', 'soil', 'water', 'farm'];

export const ROUND_PART_LABELS: Record<RoundPart, string> = {
  crop: 'The crop',
  pests: 'Pests & disease',
  soil: 'Soil',
  water: 'Water',
  farm: 'State of the farm',
};

/** After a check, the same farm cannot be checked again for this long. */
export const CHECK_COOLDOWN_S = 30;

/** One farm as it is today: its crop, how far along it is, and what is going on. This is what a check shows. */
export interface Round extends Farm {
  crop: Crop;
  stage: Stage;
  /** 0 to 20, the day of the 21-day cycle */
  day: number;
  cycle: number;
  hazard: HazardId;
  /** what happened, in a few words */
  what: string;
  /** the condition the older drawn pictures know how to show (healthy, armyworm, drought, nitrogen, aphids) */
  cond: Condition;
  correct: Call;
  problemRows: number[];
  rows: number;
  /** the farmer's note */
  diary: string;
  /** One short sentence per picture. It points the eye, it never diagnoses. */
  captions: Record<RoundPart, string>;
  /** The picture to show, and the sentence to read, when the call is wrong. `ring` (percent of the photo: x, y, radius) circles the clue on a real photo. */
  clue: { part: RoundPart; text: string; ring?: [number, number, number] };
  right: string;
  practice: string;
}

const LEGACY: HazardId[] = ['healthy', 'drought', 'nitrogen', 'armyworm', 'aphids'];

/** The farm as it is on a given day of the player's season. force is for design review only. */
export function checkFor(farm: Farm, elapsedDays: number, force?: { hazard?: HazardId; crop?: Crop; stage?: Stage }): Round {
  const t = situation(farm.id, farm.base, elapsedDays, force);
  const h = HAZARDS[t.hazard];
  const w = (line: string) => withCrop(line, t.crop);
  const diary = typeof h.diary === 'string' ? h.diary : h.diary[t.stage];
  return {
    ...farm,
    crop: t.crop,
    stage: t.stage,
    day: t.day,
    cycle: t.cycle,
    hazard: t.hazard,
    what: h.name,
    cond: LEGACY.includes(t.hazard) && t.stage === 'grow' ? (t.hazard as Condition) : 'healthy',
    correct: h.call,
    problemRows: t.problemRows,
    rows: 5,
    diary: w(diary),
    captions: {
      crop: w(h.captions.crop),
      pests: w(h.captions.pests),
      soil: w(h.captions.soil),
      water: w(h.captions.water),
      farm: w(h.captions.farm),
    },
    clue: { part: h.clue.part, text: w(h.clue.text) },
    right: w(h.right),
    practice: w(h.practice),
  };
}

/** True when the older drawn pictures (art.tsx) show this farm; everything else uses scene.tsx. */
export const usesLegacyArt = (r: Round) => r.stage === 'grow' && LEGACY.includes(r.hazard);
