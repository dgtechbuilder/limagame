/* Real-world photos for the field rounds.

   Drop a photo at  src/rounds/photos/<round>/<part>.jpg  (also .webp, .png) and it is used in place of the drawn
   picture, e.g.  src/rounds/photos/r1/pests.jpg.  Rounds are r1 to r7; parts are crop, pests, soil, water, farm.
   Photos are found when the app is built, so a missing photo never causes a failed request: that picture
   simply stays drawn. See src/rounds/photos/README.md for what each photo should show. */

import type { RoundPart } from './data';

const files = import.meta.glob('./photos/*/*.{jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const byKey: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/\.\/photos\/([^/]+)\/([^/.]+)\./);
  if (m) byKey[`${m[1]}/${m[2]}`] = url;
}

export const photoFor = (roundId: string, part: RoundPart): string | undefined => byKey[`${roundId}/${part}`];

/** How many of the 35 pictures are real photos so far. */
export const photoCount = () => Object.keys(byKey).length;
