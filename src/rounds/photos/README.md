# Real photos for the field rounds

Every bed check shows five pictures: the crop, pests and disease, soil, water, and the state of the farm. The game ships
with real, openly licensed photos from Wikimedia Commons for many of them (see `CREDITS.md`); any picture without a
photo is drawn in code, so nothing breaks while the set grows.

A bed meets a different situation each day (see `src/rounds/hazards.ts`), so photos are filed by **situation**, not by
round. One photo then serves every bed that meets that situation.

## How to add one

1. Save the photo as `src/rounds/photos/<situation>/<part>.webp`, for example `src/rounds/photos/livestock/farm.webp`.
2. To use it for one crop only, add the crop: `disease/tomato/pests.webp`. To use it only for seedlings or only for
   grown plants, add the stage too: `healthy/maize/young/farm.webp` or `healthy/maize/grown/farm.webp`.
   The most specific photo wins: `<situation>/<crop>/<young|grown>/<part>`, then `<situation>/<crop>/<part>`, then
   `<situation>/<part>`.
3. `_normal/<part>` holds neutral photos (healthy soil, a full tank) used where that picture is not the problem. The
   list of situations that use them is `NORMAL` in `src/rounds/photos.ts`.
4. Add an entry to `credits.json` with the same key (`title`, `page`, `author`, `license`, `licenseUrl`) and a row to
   `CREDITS.md`. The game shows the author and licence on the photo.
5. Run `npm run build`. Photos are found at build time; no code change is needed.

`<part>` is `crop`, `pests`, `soil`, `water` or `farm`. `<crop>` is `maize`, `beans`, `kale` or `tomato`.

## Photo specs

- Landscape, **10:7**, about **1000 × 700 px**; `.webp` (or `.jpg`), **80 KB or less** each (the game is played on
  low-cost phones). `.png` and `.avif` also work.
- Taken in daylight, in focus, with the sign of the problem (or its absence) clearly in frame.
- Strip location and other EXIF metadata before committing (for example `exiftool -all= photo.jpg`).
- Only use photos you took or that have a free licence (CC0, public domain, CC BY, CC BY-SA), and get the farmer's
  permission if a person is recognisable.

## Optional: circle the clue

When the player looks again after a wrong call, the clue picture can show a ring around the sign. Set it with `ring: [x, y, r]` in the
photo's `credits.json` entry (percent of the width and height, radius in percent of the width); without it the picture
gets a gold frame instead.

## Situations to photograph

The **minimum set is 75 photos**: the five parts for each of the 15 situations below, any crop. Add crop-specific
photos where the crops look very different (for example blight on tomato and rust on maize).

| Folder | What it shows | Crops | When it can happen |
|---|---|---|---|
| `healthy` | A healthy crop | maize, beans, kale, tomato | seedlings, growing, harvest |
| `drought` | Not enough water | maize, beans, kale, tomato | growing |
| `flood` | Too much water | maize, beans, kale, tomato | seedlings, growing, harvest |
| `nitrogen` | Short of plant food | maize, kale, tomato | growing |
| `armyworm` | Fall armyworm | maize | growing |
| `aphids` | Aphids | kale, tomato, beans | growing |
| `disease` | A leaf disease | maize, beans, kale, tomato | growing, harvest |
| `weeds` | Weeds | maize, beans, kale, tomato | seedlings, growing |
| `livestock` | Animals broke the fence | maize, beans, kale, tomato | seedlings, growing, harvest |
| `wildlife` | Birds and monkeys | maize, tomato, beans | harvest |
| `hail` | Hail damage | maize, beans, kale, tomato | growing, harvest |
| `plantEarly` | Planted too early | maize, beans, tomato | seedlings |
| `plantLate` | Planted too late | maize, beans, tomato | growing |
| `harvestEarly` | Harvested too early | maize, beans, tomato | harvest |
| `harvestLate` | Harvested too late | maize, beans, tomato | harvest |

What the five photos should show for each situation:

- `healthy`: a strong, even farm. At harvest: ripe, ready produce.
- `drought`: wilting plants, cracked dry soil, a low tank.
- `flood`: standing water between rows, a full tank, an overflowing furrow, yellowing lower leaves.
- `nitrogen`: the lowest leaves yellow from the tip, new leaves green.
- `armyworm`: ragged holes and sawdust-like droppings in the maize funnel; a caterpillar.
- `aphids`: clusters of small insects under a curled leaf.
- `disease`: leaf spots with no insects: late blight on tomato, rust on maize or beans, black rot on kale.
- `weeds`: weeds taller than or crowding the crop, green patches between the rows.
- `livestock`: a broken fence, animals inside, nibbled or trampled plants, hoof prints and droppings.
- `wildlife`: pecked or torn cobs, fruit or pods, feathers on the ground, an intact fence.
- `hail`: shredded leaves, white ice on the ground, flattened plants.
- `plantEarly`: dry, crusted soil with gaps in the rows and few small seedlings.
- `plantLate`: front rows well grown, back rows much smaller.
- `harvestEarly`: green, immature cobs, fruit or pods that have been picked.
- `harvestLate`: over-ripe, split, mouldy produce, some lying on the ground.
