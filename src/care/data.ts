/* From Wakala Agent: the care that follows a right call in the farm world.

   After a farm is read right, the player picks the fix from three (one right, two believable wrong ones, each with a
   one-line lesson), does it by hand, and comes back a day or two later for the follow-up. Spraying asks for the
   safety kit and the right product first. Everything here is data, so an agronomist can review the wording without
   touching any code. Lines marked "Wakala" are ported from Wakala Agent's careFor and PRODUCTS; the rest are new,
   in the same style. No pictures or screens here, so the saved game can use it. */

import type { TrialHazard } from '../trials/model';

export interface FixOption {
  id: string;
  /** what the player picks: a few words, what the farmer would do */
  label: string;
  right: boolean;
  /** one line: why it is right, or why it would not work */
  lesson: string;
}

/** The three fixes offered for each problem that can be treated. Keyed by hazard id: the six farms' maize hazards,
    plus aphids (a bean pest in the field rounds), ported for when beans join the six farms. */
export const PRESCRIBE: Record<string, FixOption[]> = {
  // Wakala: water
  drought: [
    { id: 'water', label: 'Water every row today, and again tomorrow', right: true, lesson: 'Dry soil needs water, and one watering is not enough to bring the plants back.' },
    { id: 'insecticide', label: 'Spray an insecticide', right: false, lesson: 'Insecticide kills pests. Dry soil needs water, not spray.' },
    { id: 'fertilizer', label: 'Add a top-dress of fertilizer', right: false, lesson: 'Fertilizer burns roots in dry soil. Water first.' },
  ],
  // Wakala: armyworm
  armyworm: [
    { id: 'spray', label: 'Spray the leaf funnels against armyworm', right: true, lesson: 'The caterpillars hide deep in the funnel: spray goes where hands cannot reach.' },
    { id: 'hand', label: 'Only pick off caterpillars by hand', right: false, lesson: 'There are too many to pick by hand. Spray the funnels, then check again.' },
    { id: 'glyphosate', label: 'Spray glyphosate', right: false, lesson: 'Glyphosate is a weed killer. It would kill the maize too.' },
  ],
  // Wakala: aphids on beans
  aphids: [
    { id: 'spray', label: 'Spray under the leaves against sucking insects', right: true, lesson: 'Aphids sit under the leaves: the spray has to reach them there.' },
    { id: 'fertilizer', label: 'Add fertilizer (CAN)', right: false, lesson: 'Fertilizer feeds the pests too. Deal with the insects first.' },
    { id: 'water', label: 'Water more', right: false, lesson: 'Water does not stop insects sucking the leaves.' },
  ],
  // Wakala: low nutrients
  nitrogen: [
    { id: 'topdress', label: 'Top-dress with CAN beside each plant', right: true, lesson: 'Yellow lower leaves mean the soil is short of nitrogen: CAN puts it back.' },
    { id: 'insecticide', label: 'Spray an insecticide', right: false, lesson: 'There are no pests. Yellow lower leaves mean the soil is short of nitrogen.' },
    { id: 'hoe', label: 'Hoe the field', right: false, lesson: 'Hoeing removes weeds, but the plants still lack nitrogen.' },
  ],
  // Wakala: weeds
  weeds: [
    { id: 'cut', label: 'Cut the weeds out today', right: true, lesson: 'Weeds take the water and food meant for the maize. Out before they seed.' },
    { id: 'glyphosate', label: 'Spray glyphosate over the field', right: false, lesson: 'Glyphosate would kill the maize too. Cut the weeds before they seed.' },
    { id: 'water', label: 'Water more', right: false, lesson: 'Water feeds the weeds too. Remove them first.' },
  ],
  // new
  disease: [
    { id: 'fungicide', label: 'Remove the worst leaves and spray a fungicide', right: true, lesson: 'Rust is a fungus: take off what is badly hit and protect the rest.' },
    { id: 'insecticide', label: 'Spray an insecticide', right: false, lesson: 'Insecticide kills insects. Rust is a fungus: it needs a fungicide.' },
    { id: 'wet', label: 'Water the leaves more', right: false, lesson: 'Wet leaves help the rust spread. Water the soil, not the leaves.' },
  ],
  flood: [
    { id: 'drain', label: 'Dig drains so the water runs off', right: true, lesson: 'Roots need air as well as water. Drains let the extra water out.' },
    { id: 'fertilizer', label: 'Add fertilizer to help the plants', right: false, lesson: 'In waterlogged soil the fertilizer washes away. Drain the water first.' },
    { id: 'fungicide', label: 'Spray a fungicide now', right: false, lesson: 'Spray will not move the water. The roots need air: dig drains.' },
  ],
  livestock: [
    { id: 'chase', label: 'Chase the goat out and mend the fence', right: true, lesson: 'Get the animal out first, then close the gap so it cannot come back.' },
    { id: 'spray', label: 'Spray the eaten plants', right: false, lesson: 'Spray does not stop a goat. Get it out and close the gap.' },
    { id: 'wait', label: 'Wait for the goat to leave', right: false, lesson: 'A goat in maize keeps eating. Chase it out now and mend the fence.' },
  ],
  wildlife: [
    { id: 'scare', label: 'Scare the birds off and guard the cobs', right: true, lesson: 'Birds come back to an easy meal: chase them off and keep watching the cobs.' },
    { id: 'insecticide', label: 'Spray an insecticide on the cobs', right: false, lesson: 'Birds are not insects, and spray on ripe cobs is not safe to eat. Scare them off.' },
    { id: 'pick', label: 'Pick the cobs now, dry or not', right: false, lesson: 'Cobs picked before they are dry lose weight and rot. Guard them until they are ready.' },
  ],
};

/** The order the three fixes are shown in: shuffled, but the same every time for the same farm and day. */
export function fixOrder(options: FixOption[], seed: string): FixOption[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out = options.slice();
  for (let i = out.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ---------------- spraying: the safety kit, then the product ---------------- */

export const KIT: { id: string; label: string }[] = [
  { id: 'gloves', label: 'Gloves' },
  { id: 'mask', label: 'Face mask' },
  { id: 'boots', label: 'Boots' },
];

/** Wakala */
export const KIT_LESSON = 'Spray drifts onto skin and into lungs. Wear the kit every time.';

export interface Product {
  id: string;
  name: string;
  /** what kind of product it is, in a few words */
  kind: string;
  right: boolean;
  /** why a wrong product would not work (a wrong product costs nothing extra: it goes back on the shelf) */
  lesson: string;
}

/** What goes in the sprayer, by the problem being sprayed. */
export const PRODUCTS: Record<string, Product[]> = {
  // Wakala
  armyworm: [
    { id: 'emamectin', name: 'Emamectin benzoate', kind: 'insecticide for caterpillars', right: true, lesson: 'Made for caterpillars like fall armyworm.' },
    { id: 'glyphosate', name: 'Glyphosate', kind: 'weed killer', right: false, lesson: 'Glyphosate kills plants. It would kill the maize, not the caterpillars.' },
    { id: 'copper', name: 'Copper oxychloride', kind: 'fungicide', right: false, lesson: 'Copper oxychloride treats leaf disease. It does not kill caterpillars.' },
  ],
  // Wakala
  aphids: [
    { id: 'lambda', name: 'Lambda-cyhalothrin', kind: 'insecticide for sucking insects', right: true, lesson: 'Kills sucking insects like aphids.' },
    { id: 'glyphosate', name: 'Glyphosate', kind: 'weed killer', right: false, lesson: 'Glyphosate kills plants. It would kill the crop, not the aphids.' },
    { id: 'mancozeb', name: 'Mancozeb', kind: 'fungicide', right: false, lesson: 'Mancozeb treats leaf disease. It does not kill aphids.' },
  ],
  // new: leaf rust on maize
  disease: [
    { id: 'mancozeb', name: 'Mancozeb', kind: 'fungicide for leaf disease', right: true, lesson: 'A fungicide protects the leaves the rust has not reached yet.' },
    { id: 'emamectin', name: 'Emamectin benzoate', kind: 'insecticide for caterpillars', right: false, lesson: 'Emamectin kills caterpillars. It does not stop leaf rust, which is a fungus.' },
    { id: 'glyphosate', name: 'Glyphosate', kind: 'weed killer', right: false, lesson: 'Glyphosate kills plants. It would kill the maize, not the rust.' },
  ],
};

/* ---------------- follow-up care ---------------- */

/** Care that has to be done again after the first treatment: the job (a TreatJob in world/field.ts) and how many
    check days later. A follow-up is only set if it still falls inside the cycle's six check days. Follow-ups cost no
    coins: it is the work that counts. Missing one brings the problem back the next day. */
export const FOLLOW_UP: Partial<Record<TrialHazard, { afterDays: number; job: 'water' | 'spray' | 'weed' | 'feed' | 'drain'; title: string; why: string }>> = {
  // Wakala: water morning and evening for 3 days
  drought: { afterDays: 1, job: 'water', title: 'Water {farm} again', why: 'One watering does not last: dry soil needs water again the next day.' },
  // Wakala: spray again in 7 days
  armyworm: { afterDays: 2, job: 'spray', title: 'Spray {farm} again', why: 'Eggs hatch after the first spray: a second spray catches the new caterpillars.' },
  aphids: { afterDays: 2, job: 'spray', title: 'Spray {farm} again', why: 'Aphids breed fast: a second spray catches the young ones the first one missed.' },
  // Wakala: top-dress with CAN, then water it in the next day
  nitrogen: { afterDays: 1, job: 'water', title: 'Water the top-dress in on {farm}', why: 'Fertilizer only reaches the roots once it is watered in.' },
  // Wakala: hoe again in 7 days
  weeds: { afterDays: 2, job: 'weed', title: 'Weed {farm} again', why: 'Weeds come back from seed and root: catch them while they are small.' },
  // new
  disease: { afterDays: 2, job: 'spray', title: 'Spray {farm} again', why: 'The fungicide wears off: a second spray protects the new leaves.' },
};

/** Words on the task card for a follow-up. */
export const followUpTitle = (h: TrialHazard, farmName: string) => (FOLLOW_UP[h]?.title ?? 'Care for {farm}').replace('{farm}', farmName);
