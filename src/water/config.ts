/* Water as a real resource: every number to tune, in one place. Placeholders until the climate-smart agriculture
   experts and the climate funders confirm them. Litres (L) throughout; money is stored money (src/money.ts:
   1 = KSh 10).

   The farm's TANK holds the water the household, the animals and the work by hand use: rain off the roofs fills it,
   piped water and a bought bowser top it up; the house, the cows and hens, watering by hand (a drought treatment, the
   rows' watering habits) draw from it. The six farms' IRRIGATION (the plan's litres a m² a week) comes from the SHARED
   CATCHMENT, a small dam the farm shares with its neighbours (docs/shared-water.md). */

export const WATER = {
  tank: {
    /** the farm's own tank at the start, and how full it is */
    base: 10_000,
    start: 6_000,
    /** litres each tank bought in the Shop adds */
    adds: { 'tank-s': 2_000, 'tank-m': 5_000, 'tank-l': 10_000, 'tank-tangi': 5_000 } as Record<string, number>,
    /** below this share of the tank it is low: a drought then costs more, and watering by hand may not be possible */
    low: 0.2,
  },
  rain: {
    /** roof and gutter area that runs into the tank, and how much of the rain reaches it */
    roofM2: 120,
    catchEff: 0.8,
  },
  /** piped water: a county connection, paid by the 1,000 L, up to a day's allowance */
  piped: { per1000: 15, litres: 5_000 },
  /** a water bowser: a whole load delivered, dearer a litre */
  transported: { litres: 10_000, price: 1_100 },
  /** a day's use */
  house: 100,
  /** litres a day an animal drinks (the same numbers as Climate › Farm areas) */
  animals: {
    cow: { litres: 50, co2: 5.2, label: 'Cow', note: 'Milk every day; drinks 50 L and gives off methane.' },
    hen: { litres: 0.3, co2: 0.02, label: 'Hen', note: 'Eggs every day; drinks a cup and gives off very little.' },
  },
  herd: { cows: 2, hens: 4, maxCows: 6, maxHens: 60 },
  /** a drought on a farm while the tank is low: what is at risk is this much bigger (there is no water to save it) */
  droughtLowTank: 1.5,
  /** litres a drought treatment by hand draws from the tank, when its way gives none (care/treatments.ts water) */
  droughtTreat: 4_000,
  /** water credits: litres a day the farm is expected to use; every `litresPerCredit` under it is a credit */
  credits: { baseline: 700, litresPerCredit: 100 },
  /** litres a sown row of plots gets by hand from the tank each day (a watering can), before its habits */
  rowCan: 20,
  /** at most this many days are counted after time away */
  catchUpDays: 7,

  /* ---- crop cover (insurance against drought, flood and hail) ---- */
  cover: {
    /** the premium for one cycle, for every farm, before the water practices are priced in */
    premiumPerFarm: 600,
    /** the forecast loads the premium */
    forecast: { dry: 1.3, normal: 1, wet: 1.15 } as Record<string, number>,
    /** discounts for water practices (each a share off, added up, at most `maxOff`) */
    tankFull: { share: 0.5, off: 0.1 },
    smartRows: { off: 0.25 },
    fairShare: { off: 0.05 },
    maxOff: 0.4,
    /** share of a weather shock's loss it pays back at harvest */
    payout: 0.7,
  },

  /* ---- the shared catchment (Phase 4: docs/shared-water.md) ---- */
  catchment: {
    name: 'Ewaso dam',
    capacity: 6_000_000,
    start: 3_600_000,
    /** land draining into the dam, and how much of the rain on it arrives */
    areaM2: 220_000,
    runoff: 0.5,
    /** the neighbours who draw from it, litres a day, by the season's forecast */
    neighbours: [
      { name: 'Kariuki', litres: { dry: 70_000, normal: 45_000, wet: 20_000 } },
      { name: 'Mama Njoki', litres: { dry: 50_000, normal: 35_000, wet: 15_000 } },
      { name: 'Ole Sankale', litres: { dry: 90_000, normal: 60_000, wet: 25_000 } },
      { name: 'The school garden', litres: { dry: 15_000, normal: 10_000, wet: 5_000 } },
    ],
    /** under this share of the dam, everyone's draw is cut to what is left, shared out */
    rationAt: 0.25,
    /** the farm's fair share of the dam: one of (neighbours + 1) households */
    fairBonus: 2,
  },
} as const;

export type Herd = { cows: number; hens: number };
export type DrawPolicy = 'full' | 'fair';
