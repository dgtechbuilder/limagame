# Lima Farming Game

A farming game for young Africans who farm or want to — including "satellite farmers" with a city job and a
rural farm — played on a landscape phone. It is **one farm, the player's own** — there are no neighbours. The
player learns to read their crops with their own eyes, then checks every bed on the farm often, so the farm keeps
growing healthy, nutritious food. Its core is **the six farms**: the same maize grown to six different plans side
by side, so a year or more of trial and error happens in a few weeks of play. Seasons of maize turn every choice
(doing the work, when to harvest, how to store, whether to process) into what they earn. Points unlock real
partner discounts.

The game is built in React + TypeScript from the Figma file **"29 Oct Farm Management App"**
(`dvRxEJtTy8rGBPIVmCLb4E`, section *Farm game*). The Figma farm map is the ground of the whole game.

**▶ Play it: https://dgtechbuilder.github.io/limagame/** — best on a phone held sideways. On Android or
iPhone, *Add to Home screen* runs it full screen like an app.

![The first session on the Figma farm map](docs/first-session.webp)

---

## Contents

- [What a player does](#what-a-player-does)
- [Run it locally](#run-it-locally)
- [Deploy](#deploy)
- [Project structure](#project-structure)
- [How the Figma design maps to code](#how-the-figma-design-maps-to-code)
- [The first session](#the-first-session)
- [The season](#the-season)
- [Field rounds](#field-rounds)
- [The six farms](#the-six-farms)
- [Design review mode](#design-review-mode)
- [Saving, events and privacy](#saving-events-and-privacy)
- [Performance on low-cost phones](#performance-on-low-cost-phones)
- [Assumptions and open decisions](#assumptions-and-open-decisions)

---

## What a player does

| When | What happens |
| --- | --- |
| **0:00** | Names a farmer (or taps *Wanjiku*, *Otieno* or *Chebet*) and picks a look. No menus or text walls first. |
| **0:10** | Walks across their farm to the maize. The rest of the farm is under mist. |
| **0:25** | Checks the maize by looking: spots the rows with fall armyworm and makes the right call. This is the moment the game is built around. |
| **~2:00** | The whole farm opens. Their sukuma wiki needs the same kind of check, with fewer hints. |
| **~3:00** | **Field rounds**: checks every bed on the farm, one after another — and comes back often, because every bed changes every day. |
| **Then** | **Two farms** (about 10 minutes): Farm 1 grows maize a common way, the player changes one thing on Farm 2, checks both every day for six days, harvests and sees which grew more, and why. |
| **Every week** | **Six farms**: a different plan on each farm, one day of checks each real day (or all now), then the harvests compared. The plan that worked becomes their recipe for the next cycle. |
| **Any time** | Plays seasons of maize on Farm Moja: six farming steps, harvest timing, storage, processing, selling, results, rewards. |

A wrong call is part of learning: the clue they missed is circled, and they try again on a second maize bed.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
npm run typecheck  # TypeScript, no output files
```

Needs Node 18 or newer. There is no backend: everything runs in the browser.

## Deploy

Every push to `main` builds the site and publishes it to GitHub Pages with
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (install → type-check → `vite build` →
deploy). The workflow can also be started by hand from the *Actions* tab. Pages is set to deploy from
**GitHub Actions** in the repository settings.

`vite.config.ts` uses a relative base (`./`), so the same build works at
`https://<user>.github.io/<repo>/` or any other path.

Optional build setting: `VITE_EVENTS_URL=https://…` sends the first-session events (see below) to your
own collector.

## Project structure

```
src/
  main.tsx                 entry point
  App.tsx                  scales the 874 × 402 stage to the screen; routes first session / farm / modals; review menu
  state.ts                 game state, season rules and saving (useReducer + localStorage)
  data.ts                  farm copy, prices, tasks, rewards, storage and processing options
  assets.ts                image paths (art exported from Figma into public/assets)
  styles.css               design tokens (colours, gold button, panels) and component styles
  components/
    FarmMap.tsx            the Figma farm map: the ground of the whole game (1× and 2×)
    FarmScene.tsx          farm screen: HUD, Next Task, field bubbles, selected plot
    Modal.tsx, ui.tsx, Icons.tsx   modal frames, buttons, chips, inline SVG icons
  screens/
    Catalog.tsx            Shop and Farming Steps
    Journey.tsx            harvest timing → sale → storage → value addition → process → results; rewards; info
    Meta.tsx               How the farm works, Settings
  first/                   the first session (see below)
  trials/                  the six farms (see below): model.ts holds every number; Trials.tsx the screens (loaded when opened)
  rounds/                  field rounds: checks of every bed on the farm, back to back (see below); loaded only when opened
    trial.ts               a six-farm check: what a farm shows today, from its own plan
    photos/                real photos from Wikimedia Commons by situation, credits.json + CREDITS.md (see photos/README.md)
public/
  assets/                  130 images exported from Figma, incl. bg-farm.webp and bg-farm@2x.webp
  manifest.webmanifest     installable web app (landscape, full screen) + icons
design-refs/               PNG renders of the 22 Figma frames, for side-by-side checks
docs/                      screenshots used in this README
```

## How the Figma design maps to code

The design is a landscape phone game on an **874 × 402** frame. The app draws everything on a fixed
874 × 402 stage and scales it to fit the screen, so positions match the Figma frames exactly. Portrait
phones see a "rotate your phone" prompt.

| Figma group | Frames | Code |
| --- | --- | --- |
| Game Design | Game (3 variants), Food, Fertilizer, Water tanks, Equipments | `components/FarmScene.tsx`, `screens/Catalog.tsx` → `ShopModal` |
| New Design | Land Prep (+ completed), Planting, Fertilizer, Pesticides, Water, Harvest, Sale of produce, Info | `screens/Catalog.tsx` → `StepsModal`; `screens/Journey.tsx` → `SaleModal`, `InfoModal` |
| New features | Storage, Outcome comparison, Real world reward (Harvest timing), Reward hub, Value addition, Preview (Select process) | `screens/Journey.tsx` |
| Map (`IMG_5612 1`, in every frame) | The painted farm | `components/FarmMap.tsx`, used by the farm, the first session and behind every review |

Added beyond the Figma file: the first session, Settings, season results with history, empty states and
locked steps. They reuse the Figma frames, colours, wooden title plank and gold buttons.

![The farm screen](docs/farm.webp)

## The first session

A new player never sees the farm screen first. Everything happens on their own farm. In order:

1. **Create the farmer** — name plus one of four looks, saved immediately. The name is used in every line
   from then on, and the farmer's portrait replaces the HUD avatar.
2. **Walk to the maize** — on the Figma map: in along the dirt path, up the grass to the front maize bed.
   The first tap or drag moves the farmer; a pulsing ring shows where to tap. About 10–15 seconds.
3. **First check (the aha moment)** — four steps, the template for every check in Lima:
   - **Look** at four pictures (the crop, pests & disease, soil & water, layout). Tap to zoom; the next one glows.
   - **Spot** the rows that look wrong in the field.
   - **Judge**: healthy · needs water · pests · needs fertiliser.
   - **Result**. Right: the damaged rows light up, the farmer cheers by name and the maize recovers, ending on
     *"You can read your crops now, so check every one of them often."* Wrong: the missed clue is circled and
     the player walks round to the **back maize bed** to try again.
4. **The whole farm opens** — the mist lifts on screen and the crops are labelled. The farmer's **sukuma
   wiki** (the greens on the left of the map) needs a check with fewer hints. Its problem is subtler: no
   holes, just limp, dull leaves and cracked soil at the back.
5. **Into the field rounds** — *"Your tomatoes need a check too: healthy crops mean good food for your
   family."* **Check all my crops** opens the [field rounds](#field-rounds), where the player checks every
   bed on the farm. From then on the farm screen's **Rounds** button brings them back.

Passing the first check marks onboarding done, so it never repeats. Reloading mid-session resumes at the
current moment.

![A review: spot the rows that look wrong](docs/review.webp)

### Every review is data

All the pictures are drawn in SVG from a short record in [`src/first/data.ts`](src/first/data.ts), so every
later review is the same experience with new content:

```ts
first: {
  crop: 'maize',
  condition: 'armyworm',          // what the art draws: holes, droppings in the funnel, a caterpillar
  correct: 'pests',
  problemRows: [2, 3],            // rows that show the problem; the rest are healthy
  hints: 'full',                  // 'full' for the first review, 'few' afterwards
  captions: { crop: '…', pests: '…', soil: '…', layout: '…' },  // one sentence each; points the eye, never diagnoses
  clue: { part: 'pests', text: 'See the holes and the sawdust in the funnel, {name}?' },
  right: 'Fall armyworm! Well read, {name}.',
  practice: 'A pinch of ash or sand in each funnel stops them early.',
  retry: 'lower',                 // shamba to send the player to after a wrong call
}
```

Crops drawn today: maize, beans, sukuma wiki. Conditions: healthy, fall armyworm, drought (water stress),
nitrogen deficiency.

| File in `src/first/` | What it does |
| --- | --- |
| `data.ts` | Reviews, farmer looks, name suggestions, the four calls |
| `art.tsx` | Crops, soil, close-ups, field and farmer, drawn from the data |
| `Review.tsx` | The one review system: Look → Spot → Judge → Result |
| `Village.tsx` | Tap-to-walk over the Figma map along fixed routes; mist, arrows and labels. Bed outlines and routes are in `SPOTS`, `MAIN`, `TO_LOWER`, `TO_SUKUMA`. |
| `Create.tsx`, `FirstSession.tsx` | Farmer creation and the order of moments |
| `track.ts` | Event log (below) |

## The season

One season of maize on *Farm Moja* (the maize beds on the map):

1. **Farming Steps** run in order: Land prep → Planting → Fertilizer → Pesticides → Water → Harvest. Only the
   current step is open; later ones are locked and finished ones are read-only. Each task costs coins (free
   if the input was bought in the Shop) and shows a one-line farming tip. *Finish* moves the calendar on by
   that step's days; *Skip* is allowed but scores zero for that step.
2. **Crop health** is the average score of the growing steps (tasks done ÷ recommended). It sets expected bags
   and quality, shown in Info and Harvest timing.
3. **Harvest timing**: harvest now, wait 2 days (best), or wait a week (lower quality).
4. **Sale → Storage → Value addition → Select process**: prices are editable; storage trades cost per bag
   against bags lost; processing raises the price. *Confirm and sell* pays out coins and points.
5. **Season results** compare seasons, name the three steps that cost the most, and *Lima AI* explains the
   result from the player's own numbers. *Start season N+1* keeps coins, points and history.

Points: +100 × score for each finished step, +5 per bag sold. Rewards cost 800 or 1,500 points. Play time
counts while the game is on screen. Milk and eggs can be collected once a day. The farm always shows
**Now : &lt;task&gt;** and a bubble on the field for the current task.

Balance numbers live in `src/data.ts` (`STEP_META`, `HARVEST_EFFECT`, `STORAGE_OPTIONS`, `PROCESSES`,
`REWARDS`) and `src/state.ts` (`expectedHarvest`, `saleQuote`).

## Field rounds

The farmer has to check all their crops often for the farm to keep progressing and growing healthy food. Field
rounds are how: the first session ends in them, and **Rounds** on the farm screen (right edge, above Shop) opens
them again. The player checks **every bed on the farm back to back** — six beds, named by where they are (middle,
back, left, front-left, right, front-right) because their crops rotate. For every bed the farmer **walks there**
along the paths, then the player:

1. **Looks** at five pictures: the crop, pests & disease, soil, water, and the state of the farm, plus the farmer's
   note (planting date, weather, what was done).
2. **Judges** in two taps: a group (healthy, water, plant food, pests & disease, weeds, animals & weather, plant &
   harvest time), then the exact problem when the group has more than one.
3. Gets the answer. A wrong call shows the one picture that held the clue, then a second look.

### A crop stays for three weeks

Each bed keeps **one crop for 21 real days**, counted from the day the player first opened the rounds. The crop
moves through three stages: **seedlings** (days 1–7), **growing** (8–14) and **harvest time** (15–21). On day 22 the
bed rotates to the next crop (maize → beans → sukuma wiki → tomatoes), so pests and disease do not build up.

Every real day each bed gets a new situation, drawn from what can happen to that crop at that stage. The same farm
on the same day is always the same, so a re-check after 30 seconds shows the same farm. The mix and the stages are in
`src/rounds/hazards.ts`.

| Situation | What it is | Crops | Stages |
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

Animals that break the fence (`livestock`), birds and monkeys (`wildlife`), hail, flooding, disease, weeds, and
planting or harvesting at the wrong time are there on top of drought, pests and hunger. To add one, add it to
`HAZARDS` and give it a call and, if it needs a new picture, a drawing in `src/rounds/scene.tsx`.

### Rules

- **Every 30 seconds**: each bed can be checked once every 30 seconds (`CHECK_COOLDOWN_S` in `src/rounds/data.ts`).
  A pin shows the countdown. A missed bed can be checked again after 30 seconds, from the chip bar or the summary.
- **Points**: 100 for a right read first time, 50 after a second look, paid **once per bed per day**. Results reset at
  the player's midnight, because every bed is a new situation then.
- **Real photos**: the game ships with 42 real, openly licensed photos from Wikimedia Commons (CC0, public domain,
  CC BY and CC BY-SA): fall armyworm in a maize funnel, aphids on kale and beans, late blight on tomato, rust on maize
  and beans, black rot on sukuma, hail-stripped tomatoes, Striga and weeds between maize rows, flooded and drought
  fields, a quelea flock, goats, hoof prints, seedlings on dry soil and healthy crops. About half of all pictures
  (210 of 430) are photos: every one of the 86 situation, crop and stage combinations has at least one, and 58 show a
  photo as the clue, ringed where it helps. The first walkthrough uses them too. Each photo shows its author and
  licence when zoomed; the full list is in [`src/rounds/photos/CREDITS.md`](src/rounds/photos/CREDITS.md). Pictures
  without a photo stay drawn. To add more, see `src/rounds/photos/README.md`.
- **Review menu**: *Field rounds* lists the map, look, judge, right, wrong and summary screens, and one entry for
  each new situation.
- **Events**: `round_start`, `round_part_viewed`, `round_call` (no names).
- The Figma map has six beds, one round each. The beds are painted art and always show the same plants; the crop
  name on each pin says what is actually growing.

## The six farms

The six farms are LIMA's core idea: grow the same maize on up to six farms, each to a **different plan**, and
compare the harvests. Six chances to fail safely in one cycle, so a player sees in a few weeks what would take a
year or more on a real farm. **Six farms** on the farm screen opens them (a badge shows how many farms need a check
today, or **!** at harvest).

![Planning six farms](docs/six-farms-plan.webp)

**One cycle**

1. **Plan.** A table with one column per farm and one row per farming step: land prep, planting (seed), planting
   date, fertilizer, pest control, water (litres per m² a week on top of the rain) and harvest. Tap a box to choose;
   each choice says what the farmer does and what it costs, never how well it works. No two farms may have the same
   plan. Boxes that differ from Farm 1 are gold. *Suggest one change per farm* fills Farms 2–6 with one change each
   against Farm 1, so every farm tests one thing.
2. **Grow.** Six days of checks: two of seedlings, two growing, two at harvest time. Each day every farm gets a
   field check (the same five pictures and calls as the field rounds), and **what a farm shows comes from its own
   plan**: the farm with no watering in a dry season shows drought, the farm with fertilizer at planting only goes
   hungry mid-season, the farm with no pest control can't treat armyworm, a planting date before the rains shows on
   day 1. In the guided cycle both farms share each day's luck, so they differ only where their plans differ; with six
   farms each has its own luck, as real fields do, and the plans set the odds. A right call treats
   the problem (for a few coins) and stops most of the damage; a missed or wrong call lets it run. After the call the
   player is told why this farm has this problem and what was done about it.
3. **Harvest and compare.** Bags of maize, quality, and profit per farm, side by side, with the plan rows that
   differ. **Lima AI** splits the gap between the best and worst farm into its causes from the player's own numbers
   (for example *Fertilizer: planting + top-dress instead of at planting only gave 0.6 bags more*), and says when the
   farm that grew most is not the one that made most. The player can keep any farm's plan as their **recipe**; the
   next cycle starts from it.

![Six harvests compared, with Lima AI's reasons](docs/six-farms-results.webp)

**The first cycle is guided**: two farms, Farm 1 locked to a common way of growing maize (hand hoe, saved seed,
planted with the rains, fertilizer at planting only, no pest control, rain only, harvested when ready), and the
player changes one thing on Farm 2. Its days move on as soon as both farms are checked, so the whole cycle takes
about 10 minutes. From the second cycle there are six farms, the season's rain changes (normal, dry, normal, wet),
and the player chooses how the days pass: **one day each real day** (the daily habit, about a week a cycle) or
**all six days now**; they can switch at any time.

**The model** lives in one file, [`src/trials/model.ts`](src/trials/model.ts), so an agronomist can review it
without reading any screen code:

| Table | What it sets |
| --- | --- |
| `PLAN_STEPS` | every choice: its words, its cost in coins, and its yield factor |
| `FORECASTS`, `WATER_NEED`, `WATER_TOO_MUCH` | rain per week by season (8, 15 or 28 L/m²), what maize needs (35), when it waterlogs (above 50) |
| `BASE`, `weightsFor` | how likely each problem is on a day, and how each plan changes that (weeds from land prep, hunger from fertilizer, drought and waterlogging from water, disease from close spacing or a wet season, birds from a late harvest) |
| `DAMAGE` | the share of the harvest a problem costs when missed and when caught, and what the treatment costs |
| `POTENTIAL_BAGS`, `PRICE_BY_QUALITY` | 6 bags (90 kg) per farm when everything goes right; price by quality |

Yield = potential × each step's factor × (1 − loss) for every problem. With perfect checks, in a normal season, the
common plan grows about 2.1 bags; changing one thing on it gives about +0.7 bags (certified seed, a top-dress, or
20 L of water a week) down to −0.4 (planting before the rains or three weeks late); a plan that gets every step
right grows about 5.7. Missing every check costs a good plan about 0.9 bags. Spraying every week or a double dose of
fertilizer grows about as much as the right plan but costs more than it earns. **All of these numbers are
illustrative until an agronomist reviews them.**

*Tractor hire* is a land-prep choice with a placeholder price; it is where a tractor-hire partner would plug in.
Points: the field-check points (100, or 50 on a second look) for each farm each day, plus 50 per farm at harvest.
Events: the checks use the field-round events (`round_start`, `round_part_viewed`, `round_call`).

## Design review mode

Open **`?review=1`** (or *Settings → Design review*) for a sandbox with a menu of every screen filled with
sample data: each first-session moment, every Figma frame, and the added screens. Deep-link with
`?screen=<name>`, for example `?screen=Storage` or `?screen=3 · First review`. Review mode never touches the
player's saved game or events.

## Saving, events and privacy

- **Progress** saves on the device in `localStorage` (`lima-farming-game:v2`): farmer, first-session progress,
  coins, points, seasons. *Settings → Reset progress* erases it and starts again with a new farmer. Saves from
  before the first session existed keep their coins and play the first session once.
- **Events**: one per first-session moment, so drop-off can be measured — `create_shown`, `farmer_created`,
  `walk_start`, `first_move`, `shamba_reached`, `review_start`, `part_viewed`, `spot_found`, `call`,
  `review_failed`, `review_passed`, `farm_opened`, `session_close`. Each has a
  timestamp and time since the first event. They are kept on the device (`lima-events`, last 300) and, only
  if `VITE_EVENTS_URL` is set at build time, sent with `navigator.sendBeacon`.
- **No personal data is sent.** Events never include the farmer's name. There are no accounts, cookies or
  third-party scripts; the only outside request is the Poppins font from Google Fonts.

## Performance on low-cost phones

- Field rounds are a separate chunk (about 17 KB compressed) loaded when opened; they add about 3 KB to the first load.
- The first screen needs about **100 KB** of compressed code; it does not wait for the farm art.
- The farm map is **86 KB** at 1× and **194 KB** at 2× (phones with sharp screens pick 2×).
- All first-session crop art is SVG drawn in code: no images to download.
- Checked with the CPU slowed 6×: taps respond in 0.3–0.6 s and the crop-recovery animation holds ~60 fps.
- Animations respect *reduce motion*.

## Assumptions and open decisions

- **Game balance** (task counts, yields, prices, point costs) is illustrative, not agronomic data.
- **Farming advice** in the game (e.g. ash or sand in the maize funnel for fall armyworm; watering at the
  roots in the cool of the morning) should be checked by an agronomist or extension officer.
- **Field-round advice** (ash or sand for armyworm, soapy water for aphids, top-dressing, drainage after floods, what to
  do after hail, when each crop is ready to pick) needs agronomist review, and so do the crop calendar (21 real days
  stand in for a whole season) and the rotation. Round points are illustrative.
- **Lima AI** is a rule-based stand-in that reads the season's numbers; it does not call an AI service.
- **Rewards** are saved in the game but nothing is sent to a partner; there is no redemption backend.
- **Missed checks** cost harvest on the six farms (see `DAMAGE` in `src/trials/model.ts`). In the everyday field
  rounds they still only show as a bed to look at again.
- **The six-farm model** (yields, problem odds, damage, prices) is illustrative and needs agronomist review before any
  pilot. Only maize is planned in it so far; beans, sukuma wiki and tomatoes would each need their own table.
- **No two plans the same** is enforced; *one change per farm* is suggested, not enforced.
- **Art styles**: the farm and UI are the painted Figma art; the first-session crops and the farmer are
  drawn flat in code.
- **Language**: English with a little Swahili (*Karibu*, *Twende*, shamba, sukuma wiki). Full Swahili is not done.
- **Messages** shows a reminder to check every bed; there is no inbox yet.
- The faint 5% pattern texture on the cream panels in Figma is omitted.

---

Design: Figma file *29 Oct Farm Management App*. Code built with [Claude](https://claude.ai).
