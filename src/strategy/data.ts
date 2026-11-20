/* Climate-smart farming: the choices every row of plots can make, and what each one does.

   Each farm's 20 plots make 4 rows of 5 (a row is 0.8 acre). Each row runs its own STRATEGY: one option on every
   dimension below. The first option of each dimension is "as the farm's plan does it": no extra cost, no change, so a
   farm whose rows are left alone grows exactly as before. Every other option has a cost (cash), labour (person-days),
   a payoff, and climate effects, and they all feed the farm's harvest, the climate page, the credits and soil health.

   THIS FILE IS THE WHOLE TABLE. A new dimension or option is one more entry here: no code changes. The dimensions and
   options are starting examples, to be confirmed with the climate-smart agriculture experts; every number is a
   PLACEHOLDER until verified (returns roughly: organic ~20% and DAP ~15% over the co-investment).

   Units (per row of 0.8 acre, per cycle):
   - cost: stored money (src/money.ts: 1 = KSh 10)
   - labour: person-days of work
   - ret: the return over the co-investment (cash + labour at LABOUR_DAY), e.g. 0.2 = 20%; it can differ by the
     season's forecast. The row's harvest grows by (1 + ret) × co-investment.
   - co2: kg CO₂e emitted; stored: kg CO₂ kept in the soil; water: litres on top of the rain (from the tank or the
     catchment); soil: soil-health points; pollution: points
   - risk: how much of a problem's damage this row still takes (0.6 = 40% less damage from drought, 1.4 = 40% more) */

import type { Forecast, TrialHazard } from '../trials/model';

/** A day of farm work, in stored money (KSh 500): what labour is worth in the co-investment. Placeholder. */
export const LABOUR_DAY = 50;
/** Person-days of the family's own work a farm has for its rows' extra work in a cycle; more is hired at LABOUR_DAY. */
export const FAMILY_LABOUR = 24;

export type DimensionGroup = 'fertilizer' | 'tilling' | 'sowing' | 'planting' | 'planning' | 'habits';

export const GROUPS: { id: DimensionGroup; label: string }[] = [
  { id: 'fertilizer', label: 'Fertilizer' },
  { id: 'tilling', label: 'Tilling' },
  { id: 'sowing', label: 'Sowing' },
  { id: 'planting', label: 'Planting' },
  { id: 'planning', label: 'Planning' },
  { id: 'habits', label: 'Farming habits' },
];

export interface StrategyOption {
  id: string;
  label: string;
  /** one line: what the farmer does */
  does: string;
  cost: number;
  labour: number;
  ret: number | Partial<Record<Forecast, number>>;
  co2?: number;
  stored?: number;
  water?: number;
  soil?: number;
  pollution?: number;
  risk?: Partial<Record<TrialHazard, number>>;
  /** a climate-smart practice (a green tag on the option) */
  smart?: boolean;
}

export interface Dimension {
  id: string;
  group: DimensionGroup;
  label: string;
  options: StrategyOption[];
}

const AS_PLANNED = (does: string): StrategyOption => ({ id: 'plan', label: 'As the farm plan', does, cost: 0, labour: 0, ret: 0 });

export const DIMENSIONS: Dimension[] = [
  {
    id: 'fert',
    group: 'fertilizer',
    label: 'Fertilizer',
    options: [
      AS_PLANNED('The fertilizer in the farm plan, nothing more.'),
      { id: 'organic', label: 'Organic compost', does: 'Compost and manure dug into the row: little cash, more work, the soil keeps improving.', cost: 100, labour: 3, ret: 0.2, co2: 4, stored: 30, soil: 3, smart: true },
      { id: 'dap', label: 'DAP', does: 'A bag of DAP at planting: cheap (often subsidised), quick, but it does nothing for the soil.', cost: 280, labour: 0.5, ret: 0.15, co2: 22, soil: -1, pollution: 1 },
      { id: 'npk', label: 'Lima NPK', does: 'A branded NPK blend: a little dearer than DAP, a little more potassium.', cost: 320, labour: 0.5, ret: 0.16, co2: 22, soil: -0.5, pollution: 1 },
      { id: 'microdose', label: 'Micro-dosing', does: 'A bottle-cap of fertilizer in each planting hole: a third of the bag, the same yield in a dry season.', cost: 110, labour: 1.5, ret: { dry: 0.3, normal: 0.18, wet: 0.12 }, co2: 8, soil: 0, smart: true },
    ],
  },
  {
    id: 'till',
    group: 'tilling',
    label: 'Tilling',
    options: [
      AS_PLANNED('The land prep in the farm plan.'),
      { id: 'minimum', label: 'Minimum tillage', does: 'Rip only the planting lines and leave last season’s stalks on top: less work, the soil keeps its carbon.', cost: 30, labour: 1, ret: { dry: 0.25, normal: 0.1, wet: 0.05 }, stored: 25, soil: 2, risk: { drought: 0.8 }, smart: true },
      { id: 'deep', label: 'Deep ploughing', does: 'A hired tractor ploughs deep: quick, but it burns diesel and breaks up the soil.', cost: 260, labour: 0.2, ret: 0.05, co2: 30, soil: -2, risk: { weeds: 0.8 } },
    ],
  },
  {
    id: 'seed',
    group: 'sowing',
    label: 'Seed',
    options: [
      AS_PLANNED('The seed in the farm’s inputs.'),
      { id: 'dt', label: 'Drought-tolerant', does: 'A short-season, drought-tolerant variety: pays in a dry season.', cost: 120, labour: 0, ret: { dry: 0.4, normal: 0.05, wet: -0.05 }, co2: 1, risk: { drought: 0.6 }, smart: true },
      { id: 'local', label: 'Local saved seed', does: 'Seed kept from last harvest: free, but it yields less.', cost: 0, labour: 0.5, ret: -0.4 },
    ],
  },
  {
    id: 'spacing',
    group: 'sowing',
    label: 'Spacing',
    options: [
      AS_PLANNED('75 × 25 cm, one seed a hole.'),
      { id: 'wide', label: 'Wide (90 × 30)', does: 'Fewer plants, less disease, room for beans.', cost: 0, labour: 0, ret: { dry: 0.1, normal: -0.05, wet: 0.05 }, risk: { disease: 0.7 } },
      { id: 'close', label: 'Close (60 × 20)', does: 'More plants: more cobs if it rains well, more disease and hunger if not.', cost: 60, labour: 0.5, ret: { dry: -0.2, normal: 0.1, wet: 0.05 }, risk: { disease: 1.4, nitrogen: 1.3 } },
    ],
  },
  {
    id: 'seedbed',
    group: 'sowing',
    label: 'Seedbed',
    options: [
      AS_PLANNED('A flat seedbed.'),
      { id: 'zai', label: 'Zai pits', does: 'Small pits filled with manure catch every drop of rain: hard work, a lifesaver in a dry season.', cost: 40, labour: 4, ret: { dry: 0.6, normal: 0.15, wet: -0.05 }, stored: 10, soil: 2, water: -400, risk: { drought: 0.5 }, smart: true },
      { id: 'ridges', label: 'Tied ridges', does: 'Ridges with ties across hold water in a dry season and drain it in a wet one.', cost: 20, labour: 2.5, ret: { dry: 0.3, normal: 0.1, wet: 0.2 }, soil: 1, risk: { drought: 0.75, flood: 0.6 }, smart: true },
    ],
  },
  {
    id: 'timing',
    group: 'planting',
    label: 'Planting time',
    options: [
      AS_PLANNED('With the first good rains.'),
      { id: 'dry', label: 'Dry planting', does: 'Seed in the dust before the rains: up first if the rains come, lost if they stall.', cost: 0, labour: 0, ret: { dry: -0.3, normal: 0.1, wet: 0.15 }, risk: { drought: 1.3 } },
      { id: 'late', label: 'Two weeks late', does: 'Planted after the rush: the crop misses the best of the rain.', cost: 0, labour: 0, ret: -0.15, risk: { drought: 1.2 } },
    ],
  },
  {
    id: 'mulch',
    group: 'planting',
    label: 'Mulching',
    options: [
      AS_PLANNED('Bare soil between the rows.'),
      { id: 'residue', label: 'Crop-residue mulch', does: 'Stalks and leaves laid between the rows: the soil stays cool and damp, weeds stay down.', cost: 0, labour: 2, ret: { dry: 0.35, normal: 0.15, wet: 0.05 }, stored: 20, soil: 2, water: -600, risk: { drought: 0.6, weeds: 0.6 }, smart: true },
      { id: 'plastic', label: 'Plastic mulch', does: 'A plastic sheet with holes: weeds gone, but bought, and it ends up in the soil.', cost: 220, labour: 1, ret: 0.05, co2: 12, pollution: 3, water: -500, risk: { weeds: 0.3 } },
    ],
  },
  {
    id: 'crop',
    group: 'planning',
    label: 'Crop',
    options: [
      AS_PLANNED('The farm’s crop alone.'),
      { id: 'intercrop', label: 'Maize + beans', does: 'Beans between the maize fix nitrogen, cover the soil and give a second harvest.', cost: 90, labour: 1.5, ret: 0.25, stored: 15, soil: 2, risk: { nitrogen: 0.7, weeds: 0.8 }, smart: true },
      { id: 'sorghum', label: 'Sorghum instead', does: 'A hardy grain for dry land: sells for less than maize.', cost: 60, labour: 0.5, ret: { dry: 0.45, normal: -0.1, wet: -0.2 }, risk: { drought: 0.5 }, smart: true },
    ],
  },
  {
    id: 'rotation',
    group: 'planning',
    label: 'Rotation',
    options: [
      AS_PLANNED('Maize after maize.'),
      { id: 'legume', label: 'After a legume', does: 'Last season the row grew beans: the soil has nitrogen and fewer pests.', cost: 0, labour: 0, ret: 0.2, soil: 1, risk: { armyworm: 0.8, nitrogen: 0.7 }, smart: true },
      { id: 'cover', label: 'Cover crop', does: 'A cover crop between seasons, slashed before planting: carbon in, soil held.', cost: 50, labour: 1.5, ret: 0.1, stored: 25, soil: 3, smart: true },
    ],
  },
  {
    id: 'season',
    group: 'planning',
    label: 'Season',
    options: [
      AS_PLANNED('The long rains.'),
      { id: 'short', label: 'The short rains', does: 'A quicker season: less rain, fewer pests, a smaller harvest.', cost: 0, labour: 0, ret: { dry: -0.25, normal: -0.1, wet: 0.05 }, risk: { armyworm: 0.7 } },
    ],
  },
  {
    id: 'checks',
    group: 'habits',
    label: 'Check frequency',
    options: [
      AS_PLANNED('The farm’s daily check.'),
      { id: 'walk', label: 'Walk the row every morning', does: 'A short walk down the row each morning: pests and dry patches caught a day earlier.', cost: 0, labour: 2, ret: 0.1, risk: { armyworm: 0.7, aphids: 0.7, disease: 0.8, wildlife: 0.7 }, smart: true },
      { id: 'weekly', label: 'Once a week', does: 'Less time on the farm: problems grow before they are seen.', cost: 0, labour: -1, ret: -0.1, risk: { armyworm: 1.3, disease: 1.2, weeds: 1.2 } },
    ],
  },
  {
    id: 'watering',
    group: 'habits',
    label: 'Watering time',
    options: [
      AS_PLANNED('Watered when there is time.'),
      { id: 'morning', label: 'Early morning', does: 'Water at the roots before the sun is up: little lost to the air.', cost: 0, labour: 0.5, ret: 0.08, water: -300, risk: { drought: 0.85 }, smart: true },
      { id: 'midday', label: 'Midday', does: 'Water in the heat of the day: much of it goes up into the air.', cost: 0, labour: 0, ret: -0.05, water: 500, risk: { drought: 1.1, disease: 1.1 } },
    ],
  },
  {
    id: 'fertTiming',
    group: 'habits',
    label: 'Fertilizer timing',
    options: [
      AS_PLANNED('As the plan says.'),
      { id: 'split', label: 'Split: planting + knee-high', does: 'Half at planting, half when the maize is knee-high: less washed away, more taken up.', cost: 20, labour: 1, ret: 0.15, co2: -3, pollution: -1, risk: { nitrogen: 0.6 }, smart: true },
      { id: 'late', label: 'All late', does: 'Everything after the crop is up: the seedlings go hungry.', cost: 0, labour: 0, ret: -0.1, risk: { nitrogen: 1.3 } },
    ],
  },
];

export const dimensionOf = (id: string) => DIMENSIONS.find(d => d.id === id);
export const optionIn = (dim: string, id: string | undefined) => {
  const d = dimensionOf(dim);
  return d?.options.find(o => o.id === id) ?? d?.options[0];
};

/** A row's strategy: an option id for each dimension (missing: the first option, "as the farm plan"). */
export type RowStrategy = Record<string, string>;
export const ROWS_PER_FARM = 4;
