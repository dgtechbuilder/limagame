/* The seven farms and the points they pay. Kept apart from the situations (hazards.ts) so the saved game can
   count farms without loading the pictures and texts. */

import type { Crop } from '../first/data';
import type { BedId } from './walk';

/** Points for reading a farm right: on the first look, or on a second look after the cooldown. Paid once per farm per day. */
export const ROUND_POINTS = { first: 100, second: 50 };

/** A farm on the map. Its crop changes only every 21 days. */
export interface Farm {
  id: string;
  /** 1 to 7: the order of the rounds */
  n: number;
  /** which bed on the painted map this farm is */
  bed: BedId;
  /** the crop in the first 21 days; the rotation moves it on after that */
  base: Crop;
  title: string;
  short: string;
}

export const FARMS: Farm[] = [
  { id: 'r1', n: 1, bed: 'maizeFront', base: 'maize', title: "{name}'s shamba", short: 'Your shamba' },
  { id: 'r2', n: 2, bed: 'maizeBack', base: 'maize', title: "{name}'s back shamba", short: 'Back shamba' },
  { id: 'r3', n: 3, bed: 'greensLeft', base: 'kale', title: "Wambui's shamba", short: 'Wambui' },
  { id: 'r4', n: 4, bed: 'greensFront', base: 'kale', title: "Mama Achieng's shamba", short: 'Mama Achieng' },
  { id: 'r5', n: 5, bed: 'tomatoLeft', base: 'tomato', title: "Baraka's shamba", short: 'Baraka' },
  { id: 'r6', n: 6, bed: 'tomatoRight', base: 'tomato', title: "Mzee Kamau's shamba", short: 'Mzee Kamau' },
  { id: 'r7', n: 7, bed: 'maizeFront', base: 'maize', title: "{name}'s lower shamba", short: 'Lower shamba' },
];

/** Whole days on the player's own clock, so a new day begins at their midnight. */
export const dayNumber = (ms: number = Date.now()) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60000) / 86400000);
