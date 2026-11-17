/* From Wakala Agent: a voice on the farm. Mama Achieng, the farmer's mother, walks the farm too and says what she
   has noticed. She is often right and sometimes not: what she says is her guess, never advice, and the pictures
   decide. Her lines sit beside the captions of a check; they never replace them.

   SAY: what she says when the farmer reaches a farm's sign. REMARK: what she says about each of the five pictures.
   WRONG_GUESS: from cycle 2, about one check in four, she is sure of the wrong thing (the same check always shows
   the same line). Lines marked "Wakala" are ported from Wakala Agent's SAY, REMARK and round lines. */

import type { RoundPart } from '../rounds/hazards';
import type { TrialHazard } from '../trials/model';

export const SPEAKER = { name: 'Mama Achieng', who: "the farmer's mother" };

export const SAY: Record<TrialHazard, string> = {
  healthy: 'Looks good to me. Check anyway?', // Wakala
  drought: 'These plants look thirsty. Little rain lately.', // Wakala
  flood: 'Water has stood here since the storm.',
  nitrogen: 'Part of this maize looks pale to me.', // Wakala
  armyworm: 'Something is eating this maize. I found droppings.', // Wakala
  aphids: 'The sukuma leaves are curling and sticky.',
  disease: 'These leaves have strange spots.',
  weeds: 'Something is growing between the rows.', // Wakala
  livestock: 'The gate was open. Something got in.',
  wildlife: 'The birds are loud here today.',
  hail: 'Last night’s storm was hard.',
  plantEarly: 'Some holes here have no plant coming up.',
  plantLate: 'This maize looks small for its age.',
  harvestEarly: 'These husks are still green.',
  harvestLate: 'These cobs have stood dry a long time.',
};

export const REMARK: Partial<Record<TrialHazard, Partial<Record<RoundPart, string>>>> = {
  healthy: {
    crop: 'They all look the same to me.', // Wakala
    pests: 'The leaves feel strong and green.', // Wakala
    soil: 'The soil is damp under the top.',
    water: 'The rain has been kind this week.',
    farm: 'Every row was planted on the same day.', // Wakala
  },
  drought: {
    crop: 'Look how the plants hang their heads by noon.', // Wakala
    pests: 'The leaves roll up and feel dry.', // Wakala
    soil: 'The soil cracks open.', // Wakala
    water: 'The tank by the house is nearly empty.', // Wakala
    farm: 'It is the same on every row.',
  },
  flood: {
    crop: 'The lower leaves are going yellow.',
    pests: 'I see no insects.',
    soil: 'My shoes sink in.',
    water: 'The water has nowhere to go.',
    farm: 'It is worst at the low end.',
  },
  nitrogen: {
    crop: 'One part is shorter than the rest.', // Wakala
    pests: 'The yellow runs from the tip down the middle.', // Wakala
    soil: 'The soil is damp enough.',
    water: 'We water the same as always.', // Wakala
    farm: 'Maize every season, no break.', // Wakala
  },
  armyworm: {
    crop: 'Some plants look torn at the top.', // Wakala
    pests: 'Holes, and droppings deep in the plant.', // Wakala
    soil: 'The soil seems fine to me.', // Wakala
    water: 'The plants have had enough water.',
    farm: 'It started in one corner of the farm.', // Wakala
  },
  aphids: {
    crop: 'The young leaves are curled and cupped.',
    pests: 'Turn a leaf over: grey-green insects, packed close.',
    soil: 'The soil seems fine to me.',
    water: 'The plants have had enough water.',
    farm: 'It started on a few plants at the edge.',
  },
  disease: {
    crop: 'The plants are standing up well.',
    pests: 'The spots rub off on my fingers.',
    soil: 'The soil is fine.',
    water: 'The mornings have been misty and wet.',
    farm: 'It is spreading from row to row.',
  },
  weeds: {
    crop: 'The maize there looks weak.', // Wakala
    pests: 'The weeds grow right up against the roots.', // Wakala
    soil: 'They seem to like this ground.', // Wakala
    water: 'The water is there, but who is drinking it?',
    farm: 'They are thickest in one part.', // Wakala
  },
  livestock: {
    crop: 'Some plants are bitten off at the top.',
    pests: 'Those are not insect bites.',
    soil: 'There are hoof marks in the soil.',
    water: 'The water is fine.',
    farm: 'Look at the fence on that side.',
  },
  wildlife: {
    crop: 'Some cobs are pecked open.',
    pests: 'I see no insects on the leaves.',
    soil: 'There are feathers on the ground.',
    water: 'The water is fine.',
    farm: 'They come at first light.',
  },
};

/** What she is sure of when she is wrong. */
export const WRONG_GUESS: Record<TrialHazard, string> = {
  healthy: 'Pests are hiding in there, I am sure.',
  drought: 'I think pests are back. The leaves are curling.',
  flood: 'I think this maize just needs fertilizer.',
  nitrogen: 'Pests are back: see the yellow stripe.', // Wakala
  armyworm: 'They just need water. They look tired.', // Wakala
  aphids: 'They just need water. The leaves curl.',
  disease: 'The sun burnt those leaves, that is all.',
  weeds: 'Those flowers can stay. The maize is fine.',
  livestock: 'I think the storm broke those plants.',
  wildlife: 'I think the cobs are just drying out.',
  hail: 'I think something has been eating the leaves.',
  plantEarly: 'I think birds took the seed from those holes.',
  plantLate: 'I think this maize just needs more fertilizer.',
  harvestEarly: 'These cobs look ready to me.',
  harvestLate: 'Leave them, they can stand a while longer.',
};

/** From this cycle on she sometimes guesses wrong, and how often (0 to 1). */
export const WRONG_FROM_CYCLE = 2;
export const WRONG_SHARE = 0.25;

/** When the problem came back because follow-up care was missed (Wakala: "The problem came back."). */
export const CAME_BACK = 'The problem came back.';

export interface Voice {
  name: string;
  say: string;
  /** she is sure of the wrong thing on this check */
  wrong: boolean;
  remarks: Partial<Record<RoundPart, string>>;
}

function rand01(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  return h / 4294967296;
}

/** What Mama Achieng says on one check: the same every time the same farm is checked on the same day. */
export function voiceFor(cycle: number, farm: number, day: number, h: TrialHazard, cameBack = false): Voice {
  const wrong = !cameBack && cycle >= WRONG_FROM_CYCLE && rand01(`voice:${cycle}:${farm}:${day}`) < WRONG_SHARE;
  const line = wrong ? WRONG_GUESS[h] : SAY[h];
  return { name: SPEAKER.name, say: cameBack ? `${CAME_BACK} ${line}` : line, wrong, remarks: REMARK[h] ?? {} };
}
