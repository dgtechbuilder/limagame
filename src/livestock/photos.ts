/* Real photos of each chicken coop, shown on its card in Animals → Coop so a player sees what they are building
   (how big it is, what it is made of) before they choose.

   Photos live in  src/livestock/photos/coop/<coop id>.webp  (10:7, about 1000 × 700, 80 KB or less), each with an
   entry in photos/credits.json (title, page, author, licence) that the card shows on the photo. Their light copies for
   Data saver are in photos-lite/, made by  python3 scripts/lite-photos.py . A coop without a photo simply shows none. */

import type { Credit, Photo } from '../rounds/photos';
import type { CoopId } from './config';
import credits from './photos/credits.json';

const files = import.meta.glob('./photos/**/*.{jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const liteFiles = import.meta.glob('./photos-lite/**/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const keyed = (all: Record<string, string>, folder: string) => {
  const out: Record<string, string> = {};
  for (const [path, url] of Object.entries(all)) {
    const m = path.match(new RegExp(`^\\./${folder}/(.+)\\.[a-z]+$`));
    if (m) out[m[1]] = url;
  }
  return out;
};
const byKey = keyed(files, 'photos');
const liteByKey = keyed(liteFiles, 'photos-lite');
const CREDITS = credits as unknown as Record<string, Credit>;

/** The photo of a coop, if one has been added. */
export function coopPhoto(id: CoopId): Photo | undefined {
  const key = `coop/${id}`;
  const url = byKey[key];
  if (!url) return undefined;
  return { url, lite: liteByKey[key], key, ...(CREDITS[key] ?? { title: '', page: '', author: 'Unknown', license: '' }) };
}
