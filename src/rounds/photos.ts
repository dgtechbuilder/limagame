/* Real-world photos for the crop checks (field rounds and the first session).

   Photos live in  src/rounds/photos/<situation>/<part>.webp  (also .jpg, .png, .avif) and replace the drawn picture
   for that situation. Narrower folders win:
     <situation>/<crop>/<stage>/<part>   stage is "young" (seedlings) or "grown" (growing and harvest time)
     <situation>/<crop>/<part>
     <situation>/<part>
     _normal/<part>                      a neutral photo, for situations where that picture looks normal (see NORMAL)
   Situations are the ids in hazards.ts, crops are maize, beans, kale and tomato, and parts are crop, pests, soil,
   water and farm. Photos are found when the app is built, so a missing photo never causes a failed request: that
   picture simply stays drawn. Every photo needs an entry in photos/credits.json (author, licence, source, and an
   optional ring that circles the clue); see photos/CREDITS.md. */

import type { Crop } from '../first/data';
import type { HazardId, RoundPart, Stage } from './hazards';
import credits from './photos/credits.json';
import { lowData } from '../net/connection';

const files = import.meta.glob('./photos/**/*.{jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/* The light copy of each photo (photos-lite/, made by scripts/lite-photos.py: 480 × 336, about a third of the size),
   shown instead on Data saver (src/net/connection.ts). */
const liteFiles = import.meta.glob('./photos-lite/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const liteByKey: Record<string, string> = {};
for (const [path, url] of Object.entries(liteFiles)) {
  const m = path.match(/\.\/photos-lite\/(.+)\.webp$/);
  if (m) liteByKey[m[1]] = url;
}

const byKey: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const m = path.match(/\.\/photos\/(.+)\.[a-z]+$/);
  if (m) byKey[m[1]] = url;
}

export interface Credit {
  title: string;
  page: string;
  author: string;
  license: string;
  licenseUrl?: string;
  /** circles the clue: x, y and radius in percent of the photo */
  ring?: [number, number, number];
}

export interface Photo extends Credit {
  url: string;
  /** the light copy, for Data saver (photoSrc picks it) */
  lite?: string;
  key: string;
}

/** The file to show for a photo: the light copy on Data saver, else the full one. */
export const photoSrc = (p: Photo): string => (p.lite && lowData() ? p.lite : p.url);

const CREDITS = credits as unknown as Record<string, Credit>;

function find(keys: string[]): Photo | undefined {
  for (const key of keys) {
    const url = byKey[key];
    if (url) return { url, lite: liteByKey[key], key, ...(CREDITS[key] ?? { title: '', page: '', author: 'Unknown', license: '' }) };
  }
  return undefined;
}

/** Situations where a picture looks normal, so a neutral photo (photos/_normal/<part>) can stand in for it. */
const NORMAL: Partial<Record<RoundPart, HazardId[]>> = {
  soil: ['healthy', 'nitrogen', 'armyworm', 'aphids', 'disease', 'plantLate', 'virus'],
  water: ['healthy', 'nitrogen', 'armyworm', 'aphids', 'disease', 'weeds', 'livestock', 'wildlife', 'hail', 'plantLate', 'harvestEarly', 'harvestLate', 'virus', 'wind', 'striga', 'rodents'],
};

/** Pictures that look the same as another situation's: planting before the rains leaves the same cracked, dry soil as a drought. */
const SAME_AS: Record<string, string> = { 'plantEarly/soil': 'drought/soil' };

/** The photo for one picture of a crop check, if one has been added. */
export function photoInfo(round: { hazard: HazardId; crop: Crop; stage?: Stage }, part: RoundPart): Photo | undefined {
  const age = round.stage === 'young' ? 'young' : 'grown';
  const h = round.hazard;
  const keys = [`${h}/${round.crop}/${age}/${part}`, `${h}/${round.crop}/${part}`, `${h}/${part}`];
  if (SAME_AS[`${h}/${part}`]) keys.push(SAME_AS[`${h}/${part}`]);
  if (NORMAL[part]?.includes(h)) keys.push(`_normal/${part}`);
  return find(keys);
}

export const photoFor = (round: { hazard: HazardId; crop: Crop; stage?: Stage }, part: RoundPart): string | undefined => {
  const p = photoInfo(round, part);
  return p && photoSrc(p);
};

/** A photo by its key (its path under photos/ without the extension), e.g. "armyworm/pests". */
export const photoByKey = (key: string): Photo | undefined => find([key]);

/** How many real photos have been added so far. */
export const photoCount = () => Object.keys(byKey).length;
