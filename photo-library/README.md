# Crop-check photo library

Real farm photographs for the five pictures of every crop check (crop, pests, soil, water, farm), for maize, beans,
sukuma wiki (kale) and tomato. This folder holds every reviewed candidate; the best openly licensed one for each slot is
copied into `src/rounds/photos/`, where the game picks it up (see `src/rounds/photos/README.md`).

| File | What it is |
|---|---|
| `gallery.html` | Contact sheet: every slot, its candidates, match grade, confidence, licence and source. Open it in a browser from this folder. |
| `manifest.json` | Full metadata for every candidate, keyed by slot. |
| `GAPS.md` | Gap analysis: slots by best match, empty slots, photos that need permission, where African photos are missing. |
| `candidates/<slot>/NN-<id>.webp` | Every candidate, cropped to 10:7 and saved as 1000 × 700 WebP (≤ 80 KB, no metadata). `NN` is its rank in the slot. |

## Numbers

- **176 target slots**: each situation × crop × picture the game can show (healthy crops also by growth stage), plus the
  shared soil/water pictures and the two neutral `_normal` photos.
- **310 distinct photos** reviewed into **325 slot candidates** (some photos serve two slots).
- Best match per slot: **56 exact, 58 strong, 27 approximate, 35 with nothing usable**. Counting only open licences:
  48 / 54 / 24 / 50.
- **126 of the 176 slots** now have a photo in the game (open licence only). With the stage-specific weed photos and the
  three crop-agnostic fallbacks (`flood/farm`, `livestock/farm`, `wildlife/farm`) the game ships 131 photos, up from 42.
- Sources: Wikimedia Commons 215, Bugwood / IPM Images 70, Flickr via Openverse 24, iNaturalist 1.
- Licences: 257 open (public domain, CC0, CC BY, CC BY-SA); 53 non-commercial or no-derivatives, kept for review only.
- 33 photos are from East Africa and 7 from elsewhere in Africa. The rest are from outside Africa or give no location.

## Slots

Keys follow the game's lookup order: `<situation>/<crop>/<young|grown>/<part>` (healthy only), then
`<situation>/<crop>/<part>`, then `<situation>/<part>` (soil and water, shared by all crops). `_normal/soil` and
`_normal/water` stand in where soil or water is not the problem. Situations, crops and stages come from
`src/rounds/hazards.ts`; slot descriptions are in `manifest.json`.

## How each photo was judged

Every candidate was looked at, not just matched on its title. Each gets:

- **match**: *Exact* (shows the condition the slot asks for), *Strong* (right crop and a closely related sign, or the right
  sign on a close relative such as cabbage for kale or soybean for beans), *Approximate* (useful context, symptom not clear).
- **confidence** 1–5, and a **note** describing the visible evidence.
- **crop** `[cx, cy, zoom]`: centre of the 10:7 crop as a fraction of the source, zoom 1 = the largest 10:7 window.
  Close-up slots sometimes reuse a wider photo at zoom 1.6–2.6; those are noted.
- **region**: East Africa, Africa (other) or outside Africa / not stated, from the source's title and description.

## Licence fields

`license`, `licenseUrl`, `author` (also `copyrightHolder`), `source`, `page` (the source page that states the licence) and
`image` (the original file) come from the source's own records: Commons file metadata, Openverse's Flickr index, the
iNaturalist photo record or the Bugwood image record. Derived fields:

- `commercialUse`: false for NC licences.
- `modificationAllowed`: false for ND licences (cropping counts as a modification).
- `attributionRequired`, `shareAlike`, `redistribution`, `commercialRestrictions`, `modificationRestrictions`, `permissionStatus`.
- `selected`: true for the one photo per slot placed in the game. Only photos with `commercialUse` and
  `modificationAllowed` true are ever selected.
- `flags`: anything to check, for example a non-commercial licence or a source narrower than 1000 px that was upscaled.

No paid stock photos were licensed. No AI-generated images are included.

## Processing

Downloads used Wikimedia's standard thumbnail widths (up to 1920 px) or the source's largest public size, rotated
by EXIF, re-encoded without metadata (no GPS), cropped to 10:7 around the recorded centre, resized to 1000 × 700 with
Lanczos, and saved as WebP. Quality steps down from 80 until the file is ≤ 80 KB; busy foliage that still did not fit got
a light blur (radius 0.5–1.5 px) first, recorded in `processed.denoise`. Nothing was stretched: the crop is always cut
at 10:7 from the source.
