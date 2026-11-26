"""Make the light copy of every photo, for Data saver (src/net/connection.ts).

   src/rounds/photos/<path>.<ext>     ->  src/rounds/photos-lite/<path>.webp     (the crop checks)
   src/livestock/photos/<path>.<ext>  ->  src/livestock/photos-lite/<path>.webp  (the coops)
   src/security/photos/<path>.<ext>   ->  src/security/photos-lite/<path>.webp   (the Security measures)
   480 x 336, WebP quality 50: about a third of the size. Run it after adding or changing a photo:  python3 scripts/lite-photos.py   (needs Pillow).
   Copies that are up to date are left alone; copies of photos that were removed are deleted."""

import os
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
FOLDERS = [(ROOT / 'src' / d / 'photos', ROOT / 'src' / d / 'photos-lite') for d in ('rounds', 'livestock', 'security')]
EXTS = {'.jpg', '.jpeg', '.png', '.webp', '.avif'}
SIZE = (480, 336)

made = 0
removed = 0
count = 0
total = 0
for SRC, DST in FOLDERS:
    wanted = set()
    for src in sorted(SRC.rglob('*')):
        if src.suffix.lower() not in EXTS:
            continue
        rel = src.relative_to(SRC).with_suffix('.webp')
        dst = DST / rel
        wanted.add(dst)
        if dst.exists() and dst.stat().st_mtime >= src.stat().st_mtime:
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        im = Image.open(src).convert('RGB')
        # the photos are 10:7; crop to that first if one is not, then shrink
        w, h = im.size
        tw = min(w, round(h * SIZE[0] / SIZE[1]))
        th = min(h, round(w * SIZE[1] / SIZE[0]))
        im = im.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th)).resize(SIZE, Image.LANCZOS)
        im.save(dst, 'WEBP', quality=50, method=6)
        made += 1

    for f in DST.rglob('*.webp') if DST.exists() else []:
        if f not in wanted:
            f.unlink()
            removed += 1

    count += len(wanted)
    total += sum(f.stat().st_size for f in DST.rglob('*.webp')) if DST.exists() else 0

print(f'{made} made, {removed} removed, {count} light photos, {total // 1024} KB in all', file=sys.stderr)
