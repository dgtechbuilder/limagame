/* The beds of the farmer's one farm, and the points a check pays. Kept apart from the situations (hazards.ts)
   so the saved game can count beds without loading the pictures and texts. There are no neighbours: every bed
   is the farmer's own, named by where it is on the farm because its crop changes every 21 days. */

import type { Crop } from '../first/data';
import type { BedId } from './walk';

/** Points for reading a bed right: on the first look, or on a second look after the cooldown. Paid once per bed per day. */
export const ROUND_POINTS = { first: 100, second: 50 };

/** A bed on the farm map. Its crop changes only every 21 days. */
export interface Farm {
  id: string;
  /** 1 to 6: the order of the rounds */
  n: number;
  /** which bed on the painted map this is */
  bed: BedId;
  /** the crop in the first 21 days; the rotation moves it on after that */
  base: Crop;
  title: string;
  short: string;
}

export const FARMS: Farm[] = [
  { id: 'r1', n: 1, bed: 'maizeFront', base: 'maize', title: "{name}'s middle bed", short: 'Middle bed' },
  { id: 'r2', n: 2, bed: 'maizeBack', base: 'maize', title: "{name}'s back bed", short: 'Back bed' },
  { id: 'r3', n: 3, bed: 'greensLeft', base: 'kale', title: "{name}'s left bed", short: 'Left bed' },
  { id: 'r4', n: 4, bed: 'greensFront', base: 'kale', title: "{name}'s front-left bed", short: 'Front-left bed' },
  { id: 'r5', n: 5, bed: 'tomatoLeft', base: 'tomato', title: "{name}'s right bed", short: 'Right bed' },
  { id: 'r6', n: 6, bed: 'tomatoRight', base: 'tomato', title: "{name}'s front-right bed", short: 'Front-right bed' },
];

/** Whole days on the player's own clock, so a new day begins at their midnight. */
export const dayNumber = (ms: number = Date.now()) => Math.floor((ms - new Date(ms).getTimezoneOffset() * 60000) / 86400000);
