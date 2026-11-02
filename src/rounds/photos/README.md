# Real photos for the field rounds

The seven field rounds show five pictures per farm. Until a real photo is dropped in, the game draws the
picture in code, so nothing is broken without them. **35 photos make the full set.**

## How to add one

1. Save the photo as `src/rounds/photos/<round>/<part>.jpg` (for example `src/rounds/photos/r3/pests.jpg`).
2. Run `npm run build`. Photos are found at build time; no code change is needed.
3. Each photo you add replaces the drawing for that picture only, so you can add them a few at a time.

`<round>` is `r1` to `r7`. `<part>` is `crop`, `pests`, `soil`, `water` or `farm`.

## Photo specs

- Landscape, **10:7**, about **1000 × 700 px**; `.jpg` or `.webp`, **80 KB or less** each (the game is played on
  low-cost phones). `.png` and `.avif` also work.
- Taken in daylight, in focus, with the sign of the problem (or its absence) clearly in frame.
- Strip location and other EXIF metadata before committing (for example `exiftool -all= photo.jpg`).
- Only use photos you took or have a licence for, and get the farmer's permission if a person is recognisable.

## Optional: circle the clue

When the player looks again after a wrong call, the clue picture can show a ring around the sign. Set `ring`
on the round's `clue` in `src/rounds/data.ts` as `[x%, y%, radius%]` of the photo, for example `ring: [42, 55, 14]`.

## Shot list

| Round | Farm | Problem to show |
|---|---|---|
| r1 | Maize (your shamba) | Fall armyworm |
| r2 | Maize (back shamba) | Healthy |
| r3 | Sukuma wiki (Wambui) | Aphids |
| r4 | Sukuma wiki (Mama Achieng) | Drought |
| r5 | Tomatoes (Baraka) | Nitrogen shortage |
| r6 | Tomatoes (Mzee Kamau) | Drought |
| r7 | Maize, six weeks on | Nitrogen shortage |

For every round, take one photo of each part:

| Part | File | What to shoot |
|---|---|---|
| crop | `crop.jpg` | Whole plants, front row vs further back (or lower vs upper leaves) |
| pests | `pests.jpg` | Close-up of leaf, funnel or underside |
| soil | `soil.jpg` | Soil surface between rows, hand in frame for scale |
| water | `water.jpg` | Furrow, drip line, tank, or the soil after watering |
| farm | `farm.jpg` | Wide shot of the whole bed from the path |

The problem should show clearly in the picture the round's clue points to (see `clue.part` in `src/rounds/data.ts`); the other four should look ordinary, so the player has to read all five.

### Full file list

- **r1** (Maize (your shamba), Fall armyworm): `r1/crop.jpg`, `r1/pests.jpg`, `r1/soil.jpg`, `r1/water.jpg`, `r1/farm.jpg`
- **r2** (Maize (back shamba), Healthy): `r2/crop.jpg`, `r2/pests.jpg`, `r2/soil.jpg`, `r2/water.jpg`, `r2/farm.jpg`
- **r3** (Sukuma wiki (Wambui), Aphids): `r3/crop.jpg`, `r3/pests.jpg`, `r3/soil.jpg`, `r3/water.jpg`, `r3/farm.jpg`
- **r4** (Sukuma wiki (Mama Achieng), Drought): `r4/crop.jpg`, `r4/pests.jpg`, `r4/soil.jpg`, `r4/water.jpg`, `r4/farm.jpg`
- **r5** (Tomatoes (Baraka), Nitrogen shortage): `r5/crop.jpg`, `r5/pests.jpg`, `r5/soil.jpg`, `r5/water.jpg`, `r5/farm.jpg`
- **r6** (Tomatoes (Mzee Kamau), Drought): `r6/crop.jpg`, `r6/pests.jpg`, `r6/soil.jpg`, `r6/water.jpg`, `r6/farm.jpg`
- **r7** (Maize, six weeks on, Nitrogen shortage): `r7/crop.jpg`, `r7/pests.jpg`, `r7/soil.jpg`, `r7/water.jpg`, `r7/farm.jpg`
