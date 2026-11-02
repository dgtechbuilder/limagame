# Real photos for the field rounds

Every farm check shows five pictures: the crop, pests and disease, soil, water, and the state of the farm. Until a
real photo is dropped in, the game draws the picture in code, so nothing is broken without them.

A farm meets a different situation each day (see `src/rounds/hazards.ts`), so photos are filed by **situation**, not by
round. One photo then serves every farm that meets that situation.

## How to add one

1. Save the photo as `src/rounds/photos/<situation>/<part>.jpg`, for example `src/rounds/photos/livestock/farm.jpg`.
2. For a photo of one crop only, add the crop: `src/rounds/photos/disease/tomato/pests.jpg`. A crop photo is used in
   preference to a general one.
3. Run `npm run build`. Photos are found at build time; no code change is needed. Each photo replaces the drawing for
   that one picture only, so you can add them a few at a time.

`<part>` is `crop`, `pests`, `soil`, `water` or `farm`. `<crop>` is `maize`, `beans`, `kale` or `tomato`.

## Photo specs

- Landscape, **10:7**, about **1000 × 700 px**; `.jpg` or `.webp`, **80 KB or less** each (the game is played on
  low-cost phones). `.png` and `.avif` also work.
- Taken in daylight, in focus, with the sign of the problem (or its absence) clearly in frame.
- Strip location and other EXIF metadata before committing (for example `exiftool -all= photo.jpg`).
- Only use photos you took or have a licence for, and get the farmer's permission if a person is recognisable.

## Optional: circle the clue

When the player looks again after a wrong call, the clue picture can show a ring around the sign. A photo has no ring
until one is set; without it the picture gets a gold frame instead.

## Situations to photograph

The **minimum set is 75 photos**: the five parts for each of the 15 situations below, any crop. Add crop-specific
photos where the crops look very different (for example blight on tomato and rust on maize).

| Folder | What it shows | Crops | When it can happen |
|---|---|---|---|
| `healthy` | A healthy farm | maize, beans, kale, tomato | seedlings, growing, harvest |
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
