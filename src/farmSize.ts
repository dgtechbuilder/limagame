/* How big the six farms are. Each farm is 4 acres, worked as 20 plots of a fifth of an acre. The six farms' numbers
   (harvests, seed, fertilizer, treatments, fuel, inputs' climate effects) were first set for a farm of a sixth of an
   acre; FARM_SCALE turns them into a 4-acre farm's, so every rule keeps its proportions. No imports, so every model
   can use it. */

/** Acres in one of the six farms. */
export const FARM_ACRES = 4;
/** A farm is 20 plots. */
export const PLOT_ACRES = FARM_ACRES / 20;
/** Square metres in an acre. */
export const M2_PER_ACRE = 4047;
/** The size the six farms' base numbers were set for: a sixth of an acre. */
export const BASE_FARM_ACRES = 1 / 6;
/** How many times the base numbers a 4-acre farm takes (24). */
export const FARM_SCALE = FARM_ACRES / BASE_FARM_ACRES;
