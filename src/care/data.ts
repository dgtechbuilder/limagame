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
    { id: 'water', label: 'Water every row, today and tomorrow', right: true, lesson: 'Dry soil needs water, more than once.' },
    { id: 'insecticide', label: 'Spray an insecticide', right: false, lesson: 'Dry soil needs water, not spray.' },
    { id: 'fertilizer', label: 'Add a top-dress of fertilizer', right: false, lesson: 'Fertilizer burns roots in dry soil. Water first.' },
  ],
  // Wakala: armyworm
  armyworm: [
    { id: 'spray', label: 'Spray the leaf funnels', right: true, lesson: 'Caterpillars hide deep in the funnel, out of hand’s reach.' },
    { id: 'hand', label: 'Only pick off caterpillars by hand', right: false, lesson: 'Too many to pick by hand. Spray the funnels.' },
    { id: 'glyphosate', label: 'Spray glyphosate', right: false, lesson: 'Glyphosate kills weeds, and the maize too.' },
  ],
  // Wakala: aphids on beans
  aphids: [
    { id: 'spray', label: 'Spray under the leaves', right: true, lesson: 'Aphids sit under the leaves: spray there.' },
    { id: 'fertilizer', label: 'Add fertilizer (CAN)', right: false, lesson: 'Fertilizer feeds the pests too. Insects first.' },
    { id: 'water', label: 'Water more', right: false, lesson: 'Water does not stop insects sucking the leaves.' },
  ],
  // Wakala: low nutrients
  nitrogen: [
    { id: 'topdress', label: 'Top-dress with CAN beside each plant', right: true, lesson: 'Yellow lower leaves mean low nitrogen: CAN puts it back.' },
    { id: 'insecticide', label: 'Spray an insecticide', right: false, lesson: 'No pests here. Yellow lower leaves mean low nitrogen.' },
    { id: 'hoe', label: 'Hoe the field', right: false, lesson: 'Hoeing won’t add the missing nitrogen.' },
  ],
  // Wakala: weeds
  weeds: [
    { id: 'cut', label: 'Cut the weeds out today', right: true, lesson: 'Weeds steal the maize’s water and food. Out before they seed.' },
    { id: 'glyphosate', label: 'Spray glyphosate over the field', right: false, lesson: 'Glyphosate would kill the maize too.' },
    { id: 'water', label: 'Water more', right: false, lesson: 'Water feeds the weeds too. Remove them first.' },
  ],
  // new
  disease: [
    { id: 'fungicide', label: 'Remove the worst leaves; spray fungicide', right: true, lesson: 'Rust is a fungus: remove the worst, protect the rest.' },
    { id: 'insecticide', label: 'Spray an insecticide', right: false, lesson: 'Rust is a fungus: it needs a fungicide.' },
    { id: 'wet', label: 'Water the leaves more', right: false, lesson: 'Wet leaves spread rust. Water the soil.' },
  ],
  flood: [
    { id: 'drain', label: 'Dig drains so the water runs off', right: true, lesson: 'Roots need air too. Drains let the extra water out.' },
    { id: 'fertilizer', label: 'Add fertilizer to help the plants', right: false, lesson: 'Fertilizer washes out of waterlogged soil. Drain first.' },
    { id: 'fungicide', label: 'Spray a fungicide now', right: false, lesson: 'Spray won’t move water. Dig drains.' },
  ],
  livestock: [
    { id: 'chase', label: 'Chase the goat out and mend the fence', right: true, lesson: 'Get the animal out, then close the gap.' },
    { id: 'spray', label: 'Spray the eaten plants', right: false, lesson: 'Spray doesn’t stop a goat.' },
    { id: 'wait', label: 'Wait for the goat to leave', right: false, lesson: 'Chase the goat out now and mend the fence.' },
  ],
  wildlife: [
    { id: 'scare', label: 'Scare the birds off and guard the cobs', right: true, lesson: 'Birds come back: chase them off and keep watching.' },
    { id: 'insecticide', label: 'Spray an insecticide on the cobs', right: false, lesson: 'Spray on ripe cobs is unsafe to eat. Scare the birds off.' },
    { id: 'pick', label: 'Pick the cobs now, dry or not', right: false, lesson: 'Cobs picked wet lose weight and rot. Guard them until ready.' },
  ],
  // new: the newer problems (trials/model.ts NEW_HAZARDS)
  virus: [
    { id: 'uproot', label: 'Pull out and burn the sick plants', right: true, lesson: 'Maize lethal necrosis is a virus: no spray cures it. Out and burnt, it cannot spread.' },
    { id: 'fungicide', label: 'Spray a fungicide on the leaves', right: false, lesson: 'Fungicide kills fungus. This is a virus: pull the sick plants out.' },
    { id: 'fertilizer', label: 'Top-dress so they grow out of it', right: false, lesson: 'Food cannot cure a virus. The sick plants spread it: pull them out.' },
  ],
  wind: [
    { id: 'prop', label: 'Stand the plants up and earth up the roots', right: true, lesson: 'Stood up within a day and earthed up, a flattened plant still fills its cobs.' },
    { id: 'cut', label: 'Cut the fallen plants for fodder', right: false, lesson: 'Most fallen plants still have a harvest in them. Stand them up first.' },
    { id: 'fertilizer', label: 'Top-dress to make them stronger', right: false, lesson: 'Fertilizer cannot lift a plant off the ground. Stand them up and earth up.' },
  ],
  striga: [
    { id: 'pull', label: 'Pull the striga before it flowers, and burn it', right: true, lesson: 'Striga feeds on the maize roots. Pulled before it seeds, next season has less.' },
    { id: 'glyphosate', label: 'Spray glyphosate over the field', right: false, lesson: 'Glyphosate would kill the maize too.' },
    { id: 'water', label: 'Water more: the maize is wilting', right: false, lesson: 'The soil is damp. The maize wilts because striga drinks from its roots.' },
  ],
  erosion: [
    { id: 'trench', label: 'Dig trenches across the slope', right: true, lesson: 'Trenches across the slope slow the water so it soaks in, and the soil stays.' },
    { id: 'down', label: 'Dig channels straight down the slope', right: false, lesson: 'Channels down the slope make the water faster and carry more soil away.' },
    { id: 'fertilizer', label: 'Add fertilizer to replace the lost soil', right: false, lesson: 'The next rain washes it off too. Stop the water first.' },
  ],
  rodents: [
    { id: 'trap', label: 'Set traps on their runs and clear the bush', right: true, lesson: 'Traps on the runs catch them; with the bush cleared they have nowhere to hide.' },
    { id: 'poison', label: 'Scatter rat poison over the rows', right: false, lesson: 'Loose poison kills hens, dogs and the owls that hunt rats, and children find it.' },
    { id: 'flood', label: 'Flood the field to drive them out', right: false, lesson: 'Flooding drowns the maize roots too, and the rats come back.' },
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
export const KIT_LESSON = 'Spray drifts onto skin and into lungs. Always wear the kit.';

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
    { id: 'glyphosate', name: 'Glyphosate', kind: 'weed killer', right: false, lesson: 'Glyphosate kills the maize, not caterpillars.' },
    { id: 'copper', name: 'Copper oxychloride', kind: 'fungicide', right: false, lesson: 'Copper oxychloride treats disease, not caterpillars.' },
  ],
  // Wakala
  aphids: [
    { id: 'lambda', name: 'Lambda-cyhalothrin', kind: 'insecticide for sucking insects', right: true, lesson: 'Kills sucking insects like aphids.' },
    { id: 'glyphosate', name: 'Glyphosate', kind: 'weed killer', right: false, lesson: 'Glyphosate kills the crop, not aphids.' },
    { id: 'mancozeb', name: 'Mancozeb', kind: 'fungicide', right: false, lesson: 'Mancozeb treats leaf disease. It does not kill aphids.' },
  ],
  // new: stalk borer on maize (scheduled care, plots/data.ts ROUTINE), sprayed into the leaf funnels
  borer: [
    { id: 'lambda', name: 'Lambda-cyhalothrin', kind: 'insecticide for stem borers', right: true, lesson: 'Sprayed into the leaf funnels, it kills the young borers before they tunnel into the stem.' },
    { id: 'glyphosate', name: 'Glyphosate', kind: 'weed killer', right: false, lesson: 'Glyphosate kills plants. It would kill the maize, not the borers.' },
    { id: 'mancozeb', name: 'Mancozeb', kind: 'fungicide', right: false, lesson: 'Mancozeb treats leaf disease. It does not kill stem borers.' },
  ],
  // new: herbicide against weeds (the "selective herbicide" way of weeding: care/treatments.ts)
  weeds: [
    { id: 'nicosulfuron', name: 'Nicosulfuron', kind: 'herbicide safe for maize', right: true, lesson: 'A selective herbicide kills grass and broad-leaf weeds but not the maize.' },
    { id: 'glyphosate', name: 'Glyphosate', kind: 'weed killer for everything', right: false, lesson: 'Glyphosate kills every green plant, the maize too.' },
    { id: 'mancozeb', name: 'Mancozeb', kind: 'fungicide', right: false, lesson: 'Mancozeb treats leaf disease. It does not kill weeds.' },
  ],
  // new: the insects that carry maize lethal necrosis (the "spray the carriers" way: care/treatments.ts)
  virus: [
    { id: 'lambda', name: 'Lambda-cyhalothrin', kind: 'insecticide for thrips and beetles', right: true, lesson: 'It kills the thrips and beetles that carry the virus from plant to plant.' },
    { id: 'mancozeb', name: 'Mancozeb', kind: 'fungicide', right: false, lesson: 'Mancozeb treats fungus. The virus is carried by insects.' },
    { id: 'glyphosate', name: 'Glyphosate', kind: 'weed killer', right: false, lesson: 'Glyphosate kills the maize, not the insects.' },
  ],
  // new: leaf rust on maize
  disease: [
    { id: 'mancozeb', name: 'Mancozeb', kind: 'fungicide for leaf disease', right: true, lesson: 'Fungicide protects leaves rust hasn’t reached.' },
    { id: 'emamectin', name: 'Emamectin benzoate', kind: 'insecticide for caterpillars', right: false, lesson: 'Emamectin kills caterpillars, not rust fungus.' },
    { id: 'glyphosate', name: 'Glyphosate', kind: 'weed killer', right: false, lesson: 'Glyphosate kills the maize, not rust.' },
  ],
};

/* ---------------- follow-up care ---------------- */

/** Care that has to be done again after the first treatment: the job (a TreatJob in world/field.ts) and how many
    check days later. A follow-up is only set if it still falls inside the cycle's six check days. Follow-ups cost no
    coins: it is the work that counts. Missing one brings the problem back the next day. */
export const FOLLOW_UP: Partial<Record<TrialHazard, { afterDays: number; job: 'water' | 'spray' | 'weed' | 'feed' | 'drain' | 'uproot' | 'pull'; title: string; why: string }>> = {
  // Wakala: water morning and evening for 3 days
  drought: { afterDays: 1, job: 'water', title: 'Water {farm} again', why: 'Dry soil needs water again the next day.' },
  // Wakala: spray again in 7 days
  armyworm: { afterDays: 2, job: 'spray', title: 'Spray {farm} again', why: 'A second spray catches caterpillars from new eggs.' },
  aphids: { afterDays: 2, job: 'spray', title: 'Spray {farm} again', why: 'Aphids breed fast: a second spray catches the young.' },
  // Wakala: top-dress with CAN, then water it in the next day
  nitrogen: { afterDays: 1, job: 'water', title: 'Water the top-dress in on {farm}', why: 'Water fertilizer in to reach the roots.' },
  // Wakala: hoe again in 7 days
  weeds: { afterDays: 2, job: 'weed', title: 'Weed {farm} again', why: 'Weeds come back: catch them while small.' },
  // new
  disease: { afterDays: 2, job: 'spray', title: 'Spray {farm} again', why: 'Fungicide wears off: respray for new leaves.' },
  virus: { afterDays: 2, job: 'uproot', title: 'Pull new sick plants on {farm}', why: 'The virus shows late on some plants: walk the farm again and pull any new ones.' },
  striga: { afterDays: 2, job: 'pull', title: 'Pull the striga on {farm} again', why: 'Striga seed keeps waking: pull the new ones before they flower.' },
};

/** Words on the task card for a follow-up. */
export const followUpTitle = (h: TrialHazard, farmName: string) => (FOLLOW_UP[h]?.title ?? 'Care for {farm}').replace('{farm}', farmName);
