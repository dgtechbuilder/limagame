/* Real-world photos for the field rounds.

   Drop a photo at  src/rounds/photos/<situation>/<part>.jpg  (also .webp, .png) and it is used in place of the
   drawn picture, for that situation on any crop, e.g.  src/rounds/photos/livestock/farm.jpg.
   For a photo of one crop only, use  src/rounds/photos/<situation>/<crop>/<part>.jpg, e.g.
   src/rounds/photos/disease/tomato/pests.jpg  (a crop photo wins over a general one).
   Situations are the ids in hazards.ts, crops are maize, beans, kale and tomato, and parts are crop, pests, soil,
   water and farm. Photos are found when the app is built, so a missing photo never causes a failed request:
   that picture simply stays drawn. See src/rounds/photos/README.md for what each photo should show. */

import type { Crop } from '../first/data';
import type { HazardId, RoundPart } from './hazards';

const files = import.meta.glob('./photos/**/*.{jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const byKey: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/\.\/photos\/(.+)\.[a-z]+$/);
  if (m) byKey[m[1]] = url;
}

export const photoFor = (round: { hazard: HazardId; crop: Crop }, part: RoundPart): string | undefined => byKey[`${round.hazard}/${round.crop}/${part}`] ?? byKey[`${round.hazard}/${part}`];

/** How many real photos have been added so far. */
export const photoCount = () => Object.keys(byKey).length;
