/* Diagnose, then choose how to treat: after a problem is read right and the right kind of fix is picked, the farmer
   chooses HOW to do it. Each way has its cost, its labour and its payoff (how much of the damage it stops), and its
   effect on the climate, the water and the soil. THIS FILE IS THE WHOLE TABLE: a new treatment is one more entry, no
   code changes. Placeholders until the climate-smart agriculture experts confirm them.

   - costX: times the standard treatment's cost (DAMAGE[…].treat in src/trials/model.ts)
   - labour: person-days
   - effect: share of the avoidable damage it stops (1 = as well as the standard fix; the harvest then loses only the
     "caught" share; 0.8 = a fifth of the avoidable damage still happens)
   - co2 / water / soil / pollution / stored: for the whole farm (4 acres), as the climate page counts them
   The first option of each problem is the standard one (what the game did before choices). */

import type { TrialHazard } from '../trials/model';
import type { TreatJob } from '../world/field';

export interface Treatment {
  id: string;
  label: string;
  does: string;
  costX: number;
  labour: number;
  effect: number;
  co2?: number;
  water?: number;
  soil?: number;
  pollution?: number;
  stored?: number;
  /** a climate-smart way (a green tag) */
  smart?: boolean;
  /** the work by hand on the farm when it is not the problem's usual job (world/field.ts TREAT_JOB): weeding with a
      herbicide is done with the sprayer, weeding then mulching lays the cut weeds over the soil */
  job?: TreatJob;
}

export const TREATMENTS: Partial<Record<TrialHazard, Treatment[]>> = {
  armyworm: [
    { id: 'spray', label: 'Pesticide in the funnels', does: 'A chemical spray: fast and sure, but it costs, pollutes and kills the insects that eat armyworm.', costX: 1, labour: 1, effect: 1, co2: 8, pollution: 6, soil: -1 },
    { id: 'ash', label: 'A pinch of ash in each funnel', does: 'Wood ash (or sand) dropped into every funnel: almost free, slow work, works on young caterpillars.', costX: 0.15, labour: 4, effect: 0.8, soil: 0.5, smart: true },
    { id: 'neem', label: 'Neem spray', does: 'A home-made neem-leaf spray: cheap, safe for the soil and the bees, a little less sure.', costX: 0.4, labour: 2, effect: 0.9, pollution: 0.5, smart: true },
  ],
  aphids: [
    { id: 'spray', label: 'Insecticide under the leaves', does: 'A chemical spray: quick and sure, but it pollutes.', costX: 1, labour: 1, effect: 1, co2: 6, pollution: 5 },
    { id: 'soap', label: 'Soapy water', does: 'A bar of soap in a bucket, sprayed under the leaves: cheap, safe, needs doing twice.', costX: 0.15, labour: 3, effect: 0.8, smart: true },
    { id: 'neem', label: 'Neem spray', does: 'Neem leaves soaked overnight: safe for bees, nearly as good.', costX: 0.4, labour: 2, effect: 0.9, pollution: 0.5, smart: true },
  ],
  disease: [
    { id: 'fungicide', label: 'Fungicide', does: 'Remove the worst leaves and spray a fungicide: sure, but chemical.', costX: 1, labour: 1.5, effect: 1, co2: 6, pollution: 4 },
    { id: 'remove', label: 'Remove and burn the sick leaves', does: 'Take off every sick leaf and burn it away from the farm: no chemical, a lot of work.', costX: 0.1, labour: 4, effect: 0.75, smart: true },
    { id: 'copper', label: 'Copper spray', does: 'A copper spray allowed in organic farming: cheaper, a little less sure.', costX: 0.6, labour: 1.5, effect: 0.9, pollution: 2 },
  ],
  drought: [
    { id: 'can', label: 'Watering can, every row', does: 'Water every row by hand from the tank or the pond.', costX: 1, labour: 3, effect: 1, water: 8000 },
    { id: 'drip', label: 'Drip line from the tank', does: 'A drip line puts the water at the roots: dear to set up, uses half the water.', costX: 2.5, labour: 1, effect: 1, water: 4000, smart: true },
    { id: 'mulch', label: 'Water once, then mulch', does: 'One deep watering, then stalks over the soil to keep it in: less water, a little less sure.', costX: 0.5, labour: 3, effect: 0.85, water: 4500, stored: 20, soil: 1, smart: true },
  ],
  nitrogen: [
    { id: 'can', label: 'CAN top-dress', does: 'A handful of CAN beside each plant: quick, sure, emits nitrous oxide.', costX: 1, labour: 1.5, effect: 1, co2: 40, pollution: 2 },
    { id: 'manure', label: 'Manure tea and compost', does: 'Liquid manure poured at the roots, compost around them: slow, cheap, good for the soil.', costX: 0.3, labour: 3.5, effect: 0.8, co2: 6, stored: 30, soil: 2, smart: true },
    { id: 'urea', label: 'Urea', does: 'Urea is the cheapest nitrogen, but more of it escapes into the air if it is not covered.', costX: 0.7, labour: 1.5, effect: 0.9, co2: 55, pollution: 3 },
  ],
  weeds: [
    { id: 'hand', label: 'Cut them out by hand', does: 'Hoe or pull every weed before it seeds.', costX: 1, labour: 3, effect: 1, soil: 0.5 },
    { id: 'herbicide', label: 'Selective herbicide', does: 'A weed killer safe for maize: quick, but chemical, and the soil is left bare.', costX: 1.6, labour: 0.5, effect: 0.95, co2: 5, pollution: 5, soil: -1, job: 'spray' },
    { id: 'mulch', label: 'Weed, then mulch', does: 'Cut the weeds and lay them as mulch: they rot back into the soil and the next ones stay down.', costX: 0.8, labour: 3.5, effect: 1, stored: 15, soil: 1.5, smart: true, job: 'mulch' },
  ],
  flood: [
    { id: 'drain', label: 'Dig drains', does: 'Drains at the low end let the water out.', costX: 1, labour: 3, effect: 1, soil: 0.5 },
    { id: 'ridges', label: 'Drains and raised ridges', does: 'Drains now, and ridges so the roots sit above the next flood.', costX: 1.4, labour: 4, effect: 1, soil: 1, smart: true },
  ],
  livestock: [
    { id: 'chase', label: 'Chase it out and mend the fence', does: 'Get the goat out and close the gap.', costX: 1, labour: 1, effect: 1 },
    { id: 'hedge', label: 'Plant a live hedge', does: 'Chase it out, then plant a thorny hedge: it costs more now, keeps every animal out for years and stores carbon.', costX: 1.5, labour: 2, effect: 1, stored: 20, smart: true },
  ],
  wildlife: [
    { id: 'scare', label: 'Scare them off and guard', does: 'Chase the birds off and watch the cobs.', costX: 1, labour: 2, effect: 1 },
    { id: 'tins', label: 'Tins and tape on strings', does: 'Rattling tins and shiny tape over the rows: cheap, the birds learn in a week.', costX: 0.3, labour: 1, effect: 0.75, smart: true },
  ],
  // the newer problems (trials/model.ts NEW_HAZARDS)
  virus: [
    { id: 'uproot', label: 'Pull out and burn', does: 'Pull every sick plant, roots and all, and burn it away from the farm.', costX: 1, labour: 2, effect: 1 },
    { id: 'beans', label: 'Pull out, then beans in the gaps', does: 'Pull and burn the sick plants, then sow beans in the gaps: the virus cannot live in beans, and they feed the soil.', costX: 1.3, labour: 2.5, effect: 1, soil: 1, stored: 5, smart: true },
    { id: 'spray', label: 'Spray the insects that carry it', does: 'Kill the thrips and beetles that carry the virus: quick, but the sick plants stay and it pollutes.', costX: 1.8, labour: 1, effect: 0.7, co2: 6, pollution: 5, job: 'spray' },
  ],
  wind: [
    { id: 'prop', label: 'Stand them up, earth up', does: 'Lift each flattened plant and heap soil round its roots so it stands.', costX: 1, labour: 2, effect: 1, soil: 0.3 },
    { id: 'windbreak', label: 'Earth up, then a windbreak', does: 'Stand the plants up, then plant a line of grevillea and napier grass on the windy side: it breaks the next wind and stores carbon.', costX: 1.6, labour: 3, effect: 1, stored: 25, soil: 0.5, smart: true },
  ],
  striga: [
    { id: 'pull', label: 'Pull and burn', does: 'Pull every striga plant before it flowers and burn it.', costX: 1, labour: 3, effect: 1 },
    { id: 'pushpull', label: 'Pull, then desmodium', does: 'Pull the striga, then sow desmodium between the rows (push-pull): it stops striga seed waking, feeds the soil and keeps stem borer away.', costX: 1.4, labour: 3.5, effect: 1, soil: 1.5, stored: 10, smart: true },
    { id: 'manure', label: 'Pull, then manure', does: 'Pull the striga and dig in manure: striga does worst in well-fed soil.', costX: 0.8, labour: 3.5, effect: 0.9, soil: 1, stored: 8, smart: true },
  ],
  erosion: [
    { id: 'trench', label: 'Trenches across the slope', does: 'Dig trenches along the contour and throw the soil uphill (fanya juu): the water slows and soaks in.', costX: 1, labour: 3, effect: 1, soil: 1 },
    { id: 'grass', label: 'Trenches and grass strips', does: 'Trenches across the slope, with napier or vetiver grass on each bank: the roots hold the soil and the grass feeds the cows.', costX: 1.3, labour: 4, effect: 1, soil: 2, stored: 15, smart: true },
    { id: 'mulch', label: 'Cover the bare soil', does: 'Lay stalks and grass over the bare soil: rain lands softly and does not run. Cheap, a little less sure.', costX: 0.6, labour: 2, effect: 0.8, soil: 1, stored: 10, smart: true, job: 'mulch' },
  ],
  rodents: [
    { id: 'trap', label: 'Traps, and clear the bush', does: 'Set traps on their runs and slash the bush where they hide.', costX: 1, labour: 2, effect: 1 },
    { id: 'owls', label: 'Traps and owl perches', does: 'Set traps, then put up tall perches and an owl box: a pair of barn owls eats thousands of rats a year.', costX: 1.2, labour: 2.5, effect: 1, smart: true },
    { id: 'bait', label: 'Bait boxes', does: 'Poison in closed bait boxes on the runs: quick, but dead rats poison the owls and dogs that eat them.', costX: 0.8, labour: 1, effect: 0.9, pollution: 3 },
  ],
};

/** The treatment chosen for a check, or the standard one. */
export function treatmentOf(h: TrialHazard, id: string | undefined): Treatment | null {
  const list = TREATMENTS[h];
  if (!list) return null;
  return list.find(x => x.id === id) ?? list[0];
}
