/* Real photos of each security measure, shown on its card in Security → Protect so a player sees what they are
   buying (the neighbours of the community watch, the padlock on the door, the ear tag on the cow) before they pay.

   Photos live in  src/security/photos/<measure id>.webp  (10:7, about 1000 × 700, 80 KB or less), each with an entry
   in photos/credits.json (title, page, author, licence) that the card shows on the photo. Their light copies for Data
   saver are in photos-lite/, made by  python3 scripts/lite-photos.py . A measure without a photo shows a drawn icon. */

import type { Credit, Photo } from '../rounds/photos';
import type { MeasureId } from './config';
import credits from './photos/credits.json';

const files = import.meta.glob('./photos/*.{jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const liteFiles = import.meta.glob('./photos-lite/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

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

/** The photo of a security measure, if one has been added. */
export function measurePhoto(id: MeasureId): Photo | undefined {
  const url = byKey[id];
  if (!url) return undefined;
  return { url, lite: liteByKey[id], key: `security/${id}`, ...(CREDITS[id] ?? { title: '', page: '', author: 'Unknown', license: '' }) };
}
