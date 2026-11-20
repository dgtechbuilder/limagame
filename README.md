# TemoLima

*TemoLima* means **farming** in a combination of Swahili and Sesotho: *temo* is Sesotho and *lima* is Swahili.

A farming game for young Africans who farm or want to — including "satellite farmers" with a city job and a
rural farm — played on a landscape phone. It is **one farm, the player's own** — there are no neighbours. The
player learns to read their crops with their own eyes, then checks every bed on the farm often, so the farm keeps
growing healthy, nutritious food. Its core is **the six farms**: the same maize grown to six different plans side
by side, so a year or more of trial and error happens in a few weeks of play. Seasons of maize turn every choice
(doing the work, when to harvest, how to store, whether to process) into what they earn. Every job also records what it
does to the climate, the water and the soil, on its own Climate page. Points unlock real partner discounts.

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
- [The farm world](#the-farm-world)
  - [Scheduled care](#scheduled-care)
- [The daily tidy-up](#the-daily-tidy-up)
- [The six farms](#the-six-farms)
- [From Wakala Agent](#from-wakala-agent)
- [The tractor business](#the-tractor-business)
- [Plots and inputs](#plots-and-inputs)
- [Navigation and the main menu](#navigation-and-the-main-menu)
- [Page addresses](#page-addresses)
- [Sound effects](#sound-effects)
- [Money on screen](#money-on-screen)
- [Settings](#settings)
- [Game controllers](#game-controllers)
- [Money at risk](#money-at-risk)
- [Harvest estimate](#harvest-estimate)
- [Climate-smart farming: row strategies and treatment choices](#climate-smart-farming-row-strategies-and-treatment-choices)
- [Water as a real resource](#water-as-a-real-resource)
- [The animals: cows, hens and the chicken coop](#the-animals-cows-hens-and-the-chicken-coop)
- [Theft, and keeping the farm safe](#theft-and-keeping-the-farm-safe)
- [The evidence layer](#the-evidence-layer)
- [Climate tracking](#climate-tracking)
- [The wallet](#the-wallet)
- [The power system](#the-power-system)
- [Night mode](#night-mode)
- [The tractor screen](#the-tractor-screen)
- [The coop and the cow shed](#the-coop-and-the-cow-shed)
- [The shed's options](#the-sheds-options)
- [Options that open as you grow](#options-that-open-as-you-grow)
- [The market stall](#the-market-stall)
- [Farms 7 and 8](#farms-7-and-8)
- [Mini-games](#mini-games)
- [The tractor game: the mini farm](#the-tractor-game-the-mini-farm)
- [Achievements, the daily streak and certificates](#achievements-the-daily-streak-and-certificates)
- [My Progress: certification levels and learning credits](#my-progress-certification-levels-and-learning-credits)
- [Partners: billboards, branded products and offers](#partners-billboards-branded-products-and-offers)
- [Farm words: info buttons and Farm basics](#farm-words-info-buttons-and-farm-basics)
- [Character art: retro anime](#character-art-retro-anime)
- [Design review mode](#design-review-mode)
- [Saving, events and privacy](#saving-events-and-privacy)
- [Performance on low-cost phones](#performance-on-low-cost-phones)
- [Tests](#tests)
- [Assumptions and open decisions](#assumptions-and-open-decisions)

---

## What a player does

| When | What happens |
| --- | --- |
| **0:00** | Names a farmer (or taps *Wanjiku*, *Otieno* or *Chebet*) and picks a look. No menus or text walls first. |
| **0:05** | **The story so far**, three short pages: they bought this farm, last season's harvest results (they plant by hand, then watch the season fail and lose money), and this season they start by learning from each mistake. |
| **0:10** | Walks across their farm to the maize. The rest of the farm is under mist. |
| **0:25** | Checks the maize by looking: spots the rows with fall armyworm and makes the right call. This is the moment the game is built around. |
| **~2:00** | The whole farm opens. Their sukuma wiki needs the same kind of check, with fewer hints. |
| **~3:00** | **Field rounds**: checks every bed on the farm, one after another — and comes back often, because every bed changes every day. |
| **Then** | **The first planting period** (about 10 minutes): maize on Farm 1, which they clear plot by plot, and sukuma wiki on Farm 2, which they plant plot by plot; then they check both every day for six days and harvest. |
| **Every day** | **The daily tidy-up**: 3 bushes and 5 rocks turn up around the farm each new day; they clear them all to keep the farm and the neighbourhood tidy. |
| **Every week** | **Six farms**: a different plan on each farm, one day of checks each real day (or all now), then the harvests compared. The plan that worked becomes their recipe for the next cycle. |
| **Any time** | Plays seasons of maize on Farm Moja: six farming steps, harvest timing, storage, processing, selling, results, rewards. |
| **Any time** | Opens **Climate** to see what their farming did to the climate, the water and the soil, and the climate credits it earned. |
| **From day 2** | Looks after the **cows and hens** every day (feed, water, milk, eggs, cleaning), treats their diseases by their signs, and **keeps the farm safe from thieves** at night. |
| **Days 1 to 7** | **Builds a solar power system**, one part a day, each with its own mini-game: panels, inverter, battery, lights, generator, diesel, then switches it on. It powers the pump, the milk cooler, the lights, the house and the workshop. |
| **Day 1 · day 3** | **Upgrades the chicken coop** (day 1) and **the cow shed** (day 3), nail by nail. |
| **From day 4** | Plants **Farms 7 and 8**: spinach, tomatoes, French beans, onions, watermelon or a fruit orchard. |
| **Every day** | Sells up to **25 kg** of the store at the **market stall**; every payment in and out is kept in the **Wallet**. |
| **Any time** | Taps **TRACTOR** to train, learn, check, service, repair, refuel, hire or drive the tractor (each a mini-game). |

A wrong call is part of learning: the clue they missed is circled, and they try again on a second maize bed.

## Run it locally

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build in dist/
npm run preview    # serve the production build
npm run typecheck  # TypeScript, no output files
npm test           # Playwright play-tests (see Tests)
```

Needs Node 18 or newer (CI uses Node 20). There is no backend: everything runs in the browser.

**Stack**: React 19 and TypeScript 5, Vite 6, [three.js](https://threejs.org) 0.170 for the 3D farm, Playwright for
the play-tests. No other runtime dependencies. `package-lock.json` pins every install.

## Deploy

Every push to `main` builds the site and publishes it to GitHub Pages with
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (install → type-check → `vite build` →
deploy). A type error stops the deploy. The workflow can also be started by hand from the *Actions* tab. Pages is set
to deploy from **GitHub Actions** in the repository settings.

**Custom domain.** `CNAME` names `limathegame.online`. With Pages deploying from Actions, the domain that counts is
the one set under *Settings → Pages → Custom domain* (the file in the repository root is not part of the build);
set it there, with the domain's DNS pointing at GitHub Pages, and `dgtechbuilder.github.io/limagame/` redirects to it.

Pull requests run [`.github/workflows/tests.yml`](.github/workflows/tests.yml): type-check, build and the
Playwright play-tests, with the report and screenshots kept for 14 days. Its browser install tries three times.

`vite.config.ts` uses a relative base (`./`), so the same build works at
`https://<user>.github.io/<repo>/` or any other path.

Optional build setting: `VITE_EVENTS_URL=https://…` sends the first-session events (see below) to your
own collector.

## Project structure

```
src/
  main.tsx                 entry point
  App.tsx                  scales the 874 × 402 stage to the screen; routes first session / farm / modals
  state.ts                 game state, season rules and saving (useReducer + localStorage)
  route.ts                 page addresses: pathOf (the address of the page on show), routeTo (an address to the page); see Page addresses
  data.ts                  farm copy, prices, tasks, rewards, storage and processing options
  money.ts                 money on screen (money(), kshText()): see Money on screen
  sfx.ts                   the two sound effects, made in the browser (nothing downloaded)
  speech.ts                Read aloud: the phone's own voice (speechSynthesis)
  assets.ts                image paths (art exported from Figma into public/assets)
  styles.css               design tokens (colours, gold button, panels) and component styles
  input/
    gamepad.ts             game controllers, live: read every frame, turned into keys, focus moves and presses
    pad.ts                 game controllers, pure: which make, button names, standard and unmapped layouts
  components/
    Nav.tsx                Back / Menu / Farm buttons shared by every screen (NavBar, NavContext)
    FarmMap.tsx            the Figma farm map: the ground of the whole game (1× and 2×)
    FarmScene.tsx          the classic farm screen: HUD, Next Task, field bubbles, selected plot
    PhotoPicture.tsx       a real photo with its clue ring and credit (author and licence)
    TractorArt.tsx         the tractor types, drawn
    Modal.tsx, ui.tsx, Icons.tsx   modal frames, buttons, chips, inline SVG icons
  screens/
    MainMenu.tsx           the main menu
    Catalog.tsx            Shop and Farming Steps
    Journey.tsx            harvest timing → sale → storage → value addition → process → results; rewards; info
    Meta.tsx               How the farm works
    Settings.tsx           the Settings page: My farmer, Game, Display, Help & data
    Climate.tsx            the Climate page: Overview, Emissions, Water & soil, Climate shocks, Activity
    Achievements.tsx       My Progress: Journey, Modules, Today, Badges, Certificates
    Partners.tsx           the Partners page: Offers, Placements, Partner with us, Shortlist
  progress/model.ts        My Progress: modules, learning credits, certification levels (no screens)
  partners/                partner brands and every slot they can buy (data.ts), the ways to partner (catalogue.ts), engagement counts (track.ts),
                           sponsor lines, ribbons and the classic farm's sign (ui.tsx)
  art/                     retro anime characters: anime.tsx (SVG kit: farmer, guide, shopkeeper, Ojuok),
                           Cast.tsx (anime or original picture), style.ts (style and read-aloud contexts)
  achievements/            badges, the daily streak and certificates: model.ts (every rule), track.ts
  finance/loan.ts          the loan calculator (no coins change hands)
  wallet/                  every payment in and out: model.ts (trackWallet, addEntry), Wallet.tsx (the page)
  power/                   the solar power system: config.ts (every number), model.ts (a day of power), Power.tsx
  produce/                 the store and the market stall (25 kg a day): model.ts, Market.tsx
  garden/                  Farms 7 and 8 (spinach, orchard…): model.ts, Garden.tsx
  systems/track.ts         the newer systems through the days: power, gutters, drip, wilting, tractor wear, morning news
  minigames/MiniGame.tsx   the mini-games: timing, hold-to-fill, tap the spots, wires, order, quiz, aim, steer, balance
  minifarm/                the tractor game: sim.ts (the rules, no DOM), MiniFarm.tsx (the page and its canvas)
  components/Page.tsx      a page with sections down the left (Wallet, Power, Market, New farms, Tractor)
  training/data.ts         farmer training courses and bookings
  learn/                   Farm words: glossary.ts (every word, the sections, the Farm basics lessons, termFor),
                           Info.tsx (the ⓘ button and the card it opens), Glossary.tsx (the page), Basics.tsx
  farmSize.ts              how big the six farms are (4 acres, 20 plots) and FARM_SCALE
  fit.ts                   the 874 × 402 stage and how it fits the screen
  first/                   the first session (see below): Story.tsx the story so far, Update.tsx the farm update,
                           Village.tsx, Create.tsx, Review.tsx; data.ts its words, track.ts the events
  rounds/                  field rounds (see below), loaded only when opened:
    data.ts, farms.ts      the beds, their crops and the points a check pays
    hazards.ts             every situation, by crop and stage, and the calls
    walk.ts                the walking network over the painted map
    Rounds.tsx, Inspect.tsx, scene.tsx   the rounds, a bed's check, and the drawn pictures
    trial.ts               a six-farm check: what a farm shows today, from its own plan
    photos.ts, photos/     real photos from Wikimedia Commons by situation, credits.json + CREDITS.md (see photos/README.md)
  world/                   the 3D farm world (see below): field.ts the work by hand and the task card (no three.js),
                           engine.ts the scene, models.ts the low-poly models, toon.ts the cel shading, World.tsx the HUD
  trials/                  the six farms (see below): model.ts holds every number; Trials.tsx the screens (loaded when
                           opened); samples.ts sample cycles for design review and the play-tests
  care/                    from Wakala Agent: the fix after a right call, the safety kit and product, follow-ups (data.ts),
                           Mama Achieng's lines (voice.ts), and their screens Prescribe.tsx, Spray.tsx (loaded when opened)
  plots/                   plots and inputs: data.ts (20 plots a farm; seeds, fertilizers, sprayers, tractor types and
                           tools, scheduled care, with what each does and costs); PlotBoard.tsx (a farm's seed,
                           fertilizer and sprayer); TractorPick.tsx (the tractor's type and tool)
  strategy/                climate-smart rows: data.ts (every dimension and option), model.ts, StrategyBoard.tsx
  water/                   the tank, the animals, the shared catchment, crop cover: config.ts, model.ts, track.ts, WaterPanel.tsx
  credits/ledger.ts        every kind of credit (CO₂, water) earned and paid
  livestock/               the cows and the hens: config.ts (every number: care, coop, prevention, diseases), model.ts
                           (care, health, problems, a night), track.ts (the nights, day 2), Animals.tsx (the page),
                           HudButtons.tsx (ANIMALS and SECURITY), rand.ts (seeded nights)
  security/                theft: config.ts (what is taken, every measure and what it cuts), model.ts (tonight's risks,
                           a night's thefts, the harvest and store less theft), Security.tsx (the page)
  evidence/                the decision log, programme tags, "tried it on your own farm?": model.ts, Ask.tsx
  tidy/model.ts            the daily tidy-up: today's bushes and rocks, where they turn up, what they pay, the tidy streak
  risk/                    money at risk: config.ts (every number to tune), model.ts (the list, from the save), RiskHud.tsx (the button)
  tractor/                 from Wakala Agent: the tractor drive before planting: data.ts, sim.ts (no DOM), Tractor.tsx;
                           the tractor screen: hub.ts (training, condition, diesel), TractorHub.tsx
  business/                the tractor business (see below): model.ts every rule and number, drive.ts the ten-second
                           drive, Business.tsx and DriveGame.tsx the screens, Cast.tsx and cast/ the brand characters
  climate/                 climate tracking: model.ts (every factor, the ledger, rating, levels), track.ts (which
                           actions record what, and the end-of-day payment), land.ts (land farmed, bare or idle,
                           and what a credit pays), Tag.tsx (climate tags on choices), sample.ts (design review)
  review/Review.tsx        design review (?review=1): sample states for every screen, loaded only in review
  dev/hook.ts              ?dev in dev builds only: state and jump-to-state helpers for the play-tests
tests/                     Playwright play-tests (npm test, see Tests); helpers.ts the shared set-up
public/
  assets/                  130 images exported from Figma, incl. bg-farm.webp and bg-farm@2x.webp
  manifest.webmanifest     installable web app (landscape, full screen) + icon-192.png, icon-512.png
  sw.js                    service worker (published game only): a second visit opens without downloading again
design-refs/               PNG renders of the 22 Figma frames, for side-by-side checks
docs/                      screenshots used in this README (docs/wakala/ for the Wakala moments) and
                           plot-trials-plan.md (the November plan for plots A to D, kept for its reasoning)
.github/workflows/         deploy.yml (GitHub Pages, on main) and tests.yml (pull requests)
CNAME                      the custom domain (see Deploy)
```

## How the Figma design maps to code

The design is a landscape phone game on an **874 × 402** frame. The app draws everything on a fixed
874 × 402 stage and scales it to fit the screen, so positions match the Figma frames exactly. Portrait
phones see a "rotate your phone" prompt. The fit (`fitScale()` in `src/fit.ts`) uses the whole screen on phones and a
small margin (3–4%, at most 48px) on larger screens. It is re-taken on resize, rotation, the visual viewport and a
ResizeObserver, and re-checked for 700 ms after each, because iOS browsers report a rotation before the new size is
readable (the stage otherwise kept its portrait size, small in the middle of a landscape screen).

The stage is drawn as a phone, with rounded corners (a 50px radius). Nothing a player reads or taps sits in those
corners: the nav row and Close sit 28px in from the right and 8px down, the side-tab pages' panel is 24px in, and the
HUD pills, the stake banner and the guide line clear the curve. `tests/frame.spec.ts` checks every screen.

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
2. **The story so far** — three pages, each with something to do, in the first session's own art
   ([`src/first/Story.tsx`](src/first/Story.tsx); the words are `STORY` in [`src/first/data.ts`](src/first/data.ts)).
   Next shows once a page's part is done (*Sign for your farm to go on* until then); *Skip story* is always there,
   and *Previous* keeps what was done.
   Every action ends with a pop-up and **Continue**: signing — *Congratulations! Hi Chebet, welcome to your farm*;
   planting — *Well done, Chebet!*; weeding — *Good job!*; the harvest — *Congratulations! Your first harvest is
   done*, then *Your first harvest: here is the financial result* above the sum.
   - *A farm of my own*: the farmer saved from a job in town and bought this farm. The signpost says FOR SALE and the
     title deed's owner line is blank: **Sign for my farm** writes the player's name onto the deed a letter at a
     time, and the signpost becomes *Chebet's farm* with a SOLD sticker.
   - *Last season's Harvest results*: last season, played a step at a time. **Plant the season** is done by hand:
     the picture shows a maize bed and a sukuma bed, with a bunch of maize seeds and a bunch of sukuma seeds in an
     open palm; the player taps the maize seeds, then the maize bed (the seed lands and shoots come up), then the
     same with the sukuma seeds. **Weed the farm** and **Harvest** each run a short timer (`STORY_STEP_S`, 2 seconds,
     a ring in the button) while the picture changes: ragged maize with a real armyworm photo (credited) and dry
     sukuma wiki, then stubble and one small sack. The sum fills in as it goes (Spent KSh 380,000 − Earned ?), and
     **=** reveals the loss, counting up to KSh 235,000.
   - *What went wrong*: three mistakes, each crossed out; tap one to turn it over and see the practical fix, and its
     line is ticked in the farmer's notebook: walk every bed **every 2 days** and treat pests the same day (the maize
     check); feel the soil every 2 days and water at the roots when it is dry a finger deep, checking again after
     each step (planting, weeding, top-dressing), because the soil changes (the sukuma wiki check); dry, store in
     sealed bags and sell in batches as the price rises (the season). **Start with my maize** begins the walk once
     all three are turned over.

   The top Back button goes from the story to creating the farmer, and from the walk back to the story. Events:
   `story_page`, `story_signed`, `story_sow`, `story_step`, `story_sum`, `story_done`, `story_skipped`.
3. **Walk to the maize** — on the picture of the 3D farm (see [The first session on the 3D farm](#the-first-session-on-the-3d-farm)): out along the dirt lane to the front of Farm 1's maize.
   The first tap or drag moves the farmer; a pulsing ring shows where to tap. The farmer walks quickly (156 stage
   px a second, three times the first version's pace): about 4 seconds.
   - **The farm update** (on arriving, before the first check): *week 7 of the season*. The farm has been running for
     7 weeks and has cost KSh 214,000 in seed, fertilizer and labour; at this rate the harvest brings back about
     KSh 60,000, a loss of KSh 154,000 (a bar chart shows it). The maize (*some rows look ragged*) has KSh 100,000 at
     stake and the sukuma wiki (*the back rows look dull*) KSh 50,000: catching both turns most of the loss around.
     **Check my maize** opens the check. Words and numbers: `FARM_UPDATE` in `src/first/data.ts`; event
     `farm_update_shown`.
   - **What is at stake, on every check**: a red line at the top left while the player reads the crop, *This problem
     will cost you about KSh 100,000 of harvest if it is left alone* (KSh 50,000 on the sukuma wiki: `atStake` on each
     shamba), which turns green once it is caught: *Caught in time: about KSh 100,000 of harvest saved*.
4. **First check (the aha moment)** — four steps, the template for every check in TemoLima:
   - **Look** at four pictures (the crop, pests & disease, soil & water, layout). Tap to zoom; the next one glows.
   - **Spot** the rows that look wrong in the field.
   - **Judge**: healthy · needs water · pests · needs fertiliser.
   - **Result**. Right: the damaged rows light up, the farmer cheers by name and the maize recovers, ending on
     *"You can read your crops now, so check every one of them often."* Wrong: the missed clue is circled and
     the player walks round to the **back maize bed** to try again.
5. **The whole farm opens** — the mist lifts on screen and the crops are labelled. The farmer's **sukuma
   wiki** (the greens on the left of the map) needs a check with fewer hints. Its problem is subtler: no
   holes, just limp, dull leaves and cracked soil at the back.
6. **Into the field rounds** — *"Your tomatoes need a check too: healthy crops mean good food for your
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
| `Village.tsx` | Tap-to-walk over the picture of the 3D farm along fixed routes; mist, arrows and labels. Bed outlines and routes are in `SPOTS`, `MAIN`, `TO_LOWER`, `TO_SUKUMA`. |
| `Create.tsx`, `FirstSession.tsx` | Farmer creation and the order of moments |
| `Story.tsx` | The story so far: three pages, Previous / Next, Skip story, read aloud |
| `track.ts` | Event log (below) |

## The season

One season of maize on *Farm Moja* (the maize beds on the map):

1. **Farming Steps** run in order: Land prep → Planting → Fertilizer → Pesticides → Water → Harvest. Only the
   current step is open; later ones are locked and finished ones are read-only. Each task costs coins (free
   if the input was bought in the Shop, though its shop price still counts in the season's costs) and shows a
   one-line farming tip. *Finish* moves the calendar on by
   that step's days; *Skip* is allowed but scores zero for that step.
2. **Crop health** is the average score of the growing steps (tasks done ÷ recommended). It sets expected bags
   and quality, shown in Info and Harvest timing.
3. **Harvest timing**: harvest now, wait 2 days (best), or wait a week (lower quality).
4. **Sale → Storage → Value addition → Select process**: prices are editable; the harvest sells where it pays
   more a bag, at the gate or at market after transport and storage; the grade sets the price (a lower grade
   fetches less, as on the six farms: `PRICE_BY_QUALITY`); storage costs every bag put in store, against bags
   lost; processing raises the price. *Confirm and sell* pays out coins and points.
5. **Season results** compare seasons, name the three steps that cost the most, and *TemoLima AI* explains the
   result from the player's own numbers. *Start season N+1* keeps coins, points and history.

Points: +100 × score for each finished step, +5 per bag sold. Rewards cost 800 or 1,500 points. Play time
counts while the game is on screen. Milk and eggs can be collected once a day. Equipment is bought once; fertilizer
and tanks can be bought again. The farm always shows
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

## The farm world

After the first session the game's home is **a walkable 3D farm**: the farmer, in a straw hat, walks the farm and
does every farming step by hand. Tap the ground to walk there, drag anywhere for a joystick, or use the arrow keys or
WASD. The **task card** at the top says what to do next; tap it and the farmer walks there.

![The farm world](docs/farm-world.webp)

- **The mini forest**: 10 acres of idle land left to grow as forest, bottom right of the farm below the pond, with a
  *Mini forest · 10 acres* sign (`FOREST` in `src/world/engine.ts`). It is planted like a tree farm (`forest` in
  `src/world/models.ts`): short, round-crowned trees in straight rows with a few tall, skinny trees among them, and
  grass tufts and small bushes at the foot of each trunk. Only the trunks block the farmer, so the lanes between the
  rows can be run straight through. It is the farm's biggest carbon store (Climate → Farm areas).
- **The six farms** are **4 acres** each, with **20 plots** of a fifth of an acre (4 × 5 tiles, Plot 1 at the back left), Farms 1–3 at the back and 4–6 in
  front, each with a sign. The plots make **4 rows of 5** (each row runs from the back of the farm to the front).
  **Clearing and planting are done a row at a time**: the farmer stands anywhere in a row, a **Clear Row 1** or
  **Plant Row 1** button shows under them, and pressing it starts a **3-second timer** (a stopwatch over the farmer,
  its ring filling) that does all 5 plots of the row. Walking off the row stops the timer and the row stays as it
  was. The task card counts the rows left (*4 of 4 rows left*) and walks the farmer to the next one. The other jobs are done by walking over the plots with the tool
  or load they need:
  - **land prep** by hand is the Clear button (the plan says how: hoe, sickle or mulch); **tractor hire** and
    **oxen** are hired from the tractor screen (**Train** spot by the shed, or the TRACTOR button: *Hire*), and plough the farms themselves while the farmer works elsewhere;
  - **planting** is the Plant button (no seed sack to fetch); **fertilizer at planting** with the bag from the shed;
  - **each day's check**: walk to a farm's sign (a **!** badge) to read it, with the same real photos and calls as the
    field rounds. A right call turns into work by hand: **cut the weeds**, **water** (fill the can at the pond),
    **top-dress**, **spray** (the sprayer from the shed), **dig drains** through puddles, **chase the goat out**,
    **scare the birds off**. The treatment is paid for, and stops most of the damage, only once the work is done;
  - **harvest**: walk the dry rows, and the cobs stack up on the farmer's back; take them to the **Sell** stall.
- What a farm shows comes from its plan and its day: wild grass before digging, furrows, sprouts, knee-high and tall
  maize, dry cobs, stubble; drought-pale soil, yellow hunger, rust, armyworm specks, weeds, puddles, hail, a goat, birds.
  Problems missed earlier leave the farm yellower.
- **The tractor** waits by the shed. Tap **TRACTOR** (left edge) to walk to it; there the farmer picks its type and
  tool, then hops on (**GET OFF** to step down, **Change tool** to swap). The tool decides the job, and the tractor works
  the plots under it as it drives (a column of five plots a pass): see [Plots and inputs](#plots-and-inputs). It drives
  a little faster than walking. A farm whose 20 plots are all done from the seat pays **+30 bonus points** once per
  farm and job (`TRACTOR_BONUS.perJob`). The hired tractor (a *Tractor hire* plan) ploughs a whole farm in one pass.
- **Places answer when the farmer walks to them** (a shed, the pond, the Train spot, the power yard, the market, the house, the
  Mission board), or stops in them: a walk to somewhere else that only passes through picks nothing up and opens
  nothing. A tap on the task card at a place the farmer already stands in opens it again.
- **Sleep** at the farmhouse starts the next day (on the fast clock); **Plan** by the house, or **Mission** on the
  HUD, opens the plans, progress and results.
- The HUD: the farmer and their level (top left), settings, coins and points (top right; **+** opens the shop and
  the rewards), Mission and Shop, the day and what the farmer carries (bottom left).
- **Settings → Farm view** switches to the classic painted farm (Farm Moja seasons and the everyday field rounds),
  and back.

Built with [three.js](https://threejs.org) 0.170 from primitives (no model files): static scenery is merged into two
meshes, the six farms are instanced (one draw call per kind of tile), shadows come from one sun that follows the
farmer. The world is loaded only after the first session (`src/world/`, about 150 kB gzipped with three.js).
`src/world/field.ts` holds the field work (which jobs, in which order, which tiles), with no three.js, so the saved
game can use it.

A full guided cycle (clear → plant → fertilize → six days of checks, including a right call becoming weeding and
scaring off birds → harvest → sell) has been played end to end with no errors. **Not yet human-tested**: watering,
spraying, digging drains, chasing the goat, hiring the tractor or oxen, a full six-farm cycle, and the daily clock
(one day per real day). The first session's walk is played on a picture of this 3D farm, taken from above.

### Scheduled care

From the second cycle, every farm worked in the farm world also needs **care on set days after planting**, whatever
its checks show. It is what a farmer does every season, and missing it costs the harvest:

| Care | When | Which farms | By hand | From the seat | Missed |
| --- | --- | --- | --- | --- | --- |
| **Weed** | day 2 or 3 | every farm | walk over the plots | inter-row cultivator | a tenth of the harvest |
| **Spray against stalk borer** | day 3 or 4 | maize with a sprayer | the sprayer from the shed (safety kit, then the product) | boom sprayer | 8% of the harvest; a spray keeps what the farm's sprayer reaches |
| **Top-dress with CAN** | day 4 or 5 | DAP + CAN, or the double dose | the fertilizer bag from the shed | fertilizer spreader | the farm grows like DAP alone (0.75 instead of 1) and goes hungrier |

- The **task card** shows each job on its days (*Day 2 or 3*, then *Last day: day 3*), after the day's checks and any
  treatment or follow-up. With the sprayer or the fertilizer in hand, the farms that need it come first, so one trip
  to the shed does them all. A job counts once all 20 plots are done: **+40 points**.
- A farm with **no sprayer** (the check strip) is never sprayed and always loses its 8% to stalk borer: that is what
  the strip is for. Sukuma wiki is not sprayed against stalk borer.
- **At harvest** the results have a **Care** row (*All done*, or *Missed: weeding, top-dress*), and TemoLima AI says what a
  miss cost the farm that grew least.
- **Not in every cycle**: the guided first cycle, farms planted from the six farms screen in the classic farm view
  (it has no field work), and saves from before scheduled care have none (`Trial.routine` is missing). Without it,
  DAP + CAN pays without a top-dress, as it did before.
- Every day, word and number is in `ROUTINE`, `WEEDS_MISSED`, `STALK_BORER` and each fertilizer's `withoutTop` in
  `src/plots/data.ts`; the harvest maths is `growPlot` and `routineMissed` in `src/trials/model.ts`; the field work is
  `routineLeft` in `src/world/field.ts`. Proposed numbers, for the agronomist's review. The top-dress's CAN is counted
  in the climate ledger at planting, with the plan's fertilizer.
- Rebuilt from an earlier draft for four plots A to D, where each plot was planted a day apart with its own care.
  Planting the rows of a farm on different days is not in the game yet: it is an open decision (see below).

## The daily tidy-up

Every new day, **3 overgrown bushes and 5 rocks** turn up around the farm: on the grass, by the paths and on the
lanes between the farms, each on a patch of scuffed, dry ground. Clearing them is a chore every player does every
day, to keep the farm and the neighbourhood tidy. Everything is in `src/tidy/model.ts` (`TIDY` holds every number to
tune); the 3D pieces are `wildBush` and `rockPile` in `src/world/models.ts`, drawn as one mesh (`setTidy` in
`src/world/engine.ts`); the button, timer and chip are in `src/world/World.tsx`.

- **When they turn up.** The first time the farm opens on a new calendar day (the player's own midnight, the same
  clock as the daily streak), or when midnight passes while the game is open. A toast says *New day: 3 bushes and
  5 rocks to clear around the farm*. They show once the first session is done.
- **Where.** 3 of 12 bush spots and 5 of 12 rock spots (`BUSH_SPOTS`, `ROCK_SPOTS`), picked by the day's date. The
  same day always shows the same spots, however often the game is opened, and the next day shows others. No spot
  is on a farm's plots or at a place the farmer walks to, and no two are close enough to mix up their buttons.
- **Clearing.** Walk up to one and a **Clear bush** or **Move rock** button shows under the farmer. Pressing it
  starts a short timer: 2.5 seconds for a bush (with the sickle, leaves flying) and 2 for a rock (grit flying).
  Walking away stops it, and the piece stays. A cleared piece goes in a puff.
- **The chip** (bottom right): *Daily tidy-up* with bushes 0/3 and rocks 0/5. Tap it to walk to the nearest piece
  still to clear. When all 8 are cleared it turns green (*✓ Farm tidy*), with the tidy streak.
- **What it pays.** +5 points a piece; clearing all 8 adds **+40 points and KSh 600** (60 stored coins, shown in the
  player's currency: $4.65), so 80 points in all. Every piece counts the day as played for the daily streak, and the last one plays the flow sound.
- **The tidy streak and badges.** Days with the whole tidy-up done in a row make the tidy streak (🧹 on the chip);
  a missed day starts it again. Badges: *Tidy farm* (day one: the first whole tidy-up), then *Tidy farmer*,
  *Good neighbour* and *Pride of the village* for 3, 14 and 50 tidy days.
- **Saved** as `tidy` in the game (today's date, the pieces cleared, tidy days, the streak). Saves from before have
  none, and start with today's tidy-up.

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
   differ. **TemoLima AI** splits the gap between the best and worst farm into its causes from the player's own numbers
   (for example *Fertilizer: planting + top-dress instead of at planting only gave 0.6 bags more*), and says when the
   farm that grew most is not the one that made most. The player can keep any farm's plan as their **recipe**; the
   next cycle starts from it.

![Six harvests compared, with TemoLima AI's reasons](docs/six-farms-results.webp)

**The first planting period** (the first cycle) needs no planning: it starts as soon as the farm opens, with two
farms grown a common way (hand hoe, planted with the rains, fertilizer at planting only, no pest control, rain only,
harvested when ready), each a different crop at a different stage:

- **Farm 1: maize, before planting.** Its 20 plots are still wild grass: the farmer clears each one (the Clear button
  and its 3-second timer), then plants it.
- **Farm 2: sukuma wiki, at planting.** It starts cleared, ready to plant: the farmer plants each of its 20 plots
  (the Plant button, 3 seconds each).

The task card leads in that order: clear Farm 1's plots, then plant the sukuma wiki on Farm 2, then plant the maize on
Farm 1, then fertilizer at planting. Sukuma wiki grows as low, broad-leafed plants in the 3D farm; its checks use the
sukuma wiki pictures and photos of the field rounds, and it meets **aphids** where maize meets armyworm (no birds at
the cobs). The results show each farm's harvest and what it lost. **Sukuma wiki uses maize's yield and price numbers
for now** (bags, at maize prices) until an agronomist sets its own. The days move on as soon as both farms are
checked, so the whole cycle takes about 10 minutes. From the second cycle there are six farms of maize, the season's rain changes (normal, dry, normal, wet),
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

## From Wakala Agent

[Wakala Agent](https://github.com/dgtechbuilder/wakalarepotest2) is a sister game about a village agent who reads
farms and helps fix them. Its gameplay now runs inside TemoLima's farm world, on TemoLima's own state, clock, save and coins:
the logic and data were ported, not its HTML.

**What was added**

- **Choose the fix.** After a right call in the farm world, the check leads to *Choose the fix*: three fixes, one
  right. A wrong one costs coins (the same as the treatment, `WRONG_FIX_COST`), says in one line why it would not
  work, and the player picks again. The right one leads to the same work by hand as before. The pick is saved on the
  check (`fix`, `wrongFixes`), so a reload asks for the fix again only if it was not picked.
- **Safety kit and product.** Picking up the sprayer for a spray job asks for gloves, mask and boots, then which
  product goes in the sprayer (one question per problem being sprayed). A wrong product says why and costs nothing.
- **Follow-up care.** Some treatments need doing again on TemoLima's clock: water again the next day (drought), water the
  top-dress in (low nitrogen), spray again two days on (armyworm, leaf rust), weed again two days on. A follow-up shows
  on the task card on its day, always inside the six check days, and costs no coins. A follow-up whose day ends undone
  is logged, and the problem is back on that farm's next check ("The problem came back").
- **Mama Achieng**, the farmer's mother, says what she has noticed when the farmer reaches a sign, and about each of
  the five pictures. Her lines sit beside the captions, never instead of them. From cycle 2 she is sure of the wrong
  thing on about one check in four (the same check always shows the same line): her guess, never advice.
- **The tractor drive.** On a farm whose plan says *Tractor hire*, the tractor screen's *Hire* opens the drive before planting:
  a brief, then the player picks the tractor (compact, standard, large) and the implement (eight, nothing
  pre-picked), ticks the ready check and drives against the clock around rocks and trunks: tap and hold to steer,
  arrow keys or WASD, slow or fast, or autopilot (at most 2 stars). The summary scores the job, efficiency, climate
  and cost saving, and shows what the same work would cost by hand, in shillings, as real-world information. Then
  the 3D tractor ploughs the plot and the cycle carries on. Oxen still plough by themselves. Farms 1–4 are Wakala's
  four fields (a slope to plough across, a channel to dig furrows from, clods to harrow, old stalks to turn in);
  Farms 5 and 6 mix the same lessons. A poor job is scored, never blocked.

| Choose the fix | The tractor drive's summary |
| --- | --- |
| ![Choose the fix: a wrong fix crossed out, the right one ticked](docs/wakala/right-fix.webp) | ![The tractor summary: stars, score, four parts and the shillings](docs/wakala/tractor-summary.webp) |

**Try it**: `?review=1`, group **From Wakala**: *Mama Achieng in a check*, *Choose the fix*, *Safety kit and
product*, *Follow-up due*, *The problem came back*, *Tractor brief*, *Tractor summary*. In a real game, plan a farm
with *Tractor hire* or *Check and treat*, and the moments come up as you play.

**The data tables** (every word and number, for review without touching code)

| File | What is in it |
| --- | --- |
| `src/care/data.ts` | `PRESCRIBE` (three fixes and their lessons for drought, armyworm, aphids, nitrogen, weeds, disease, flood, livestock, wildlife), `KIT`, `PRODUCTS`, `FOLLOW_UP` |
| `src/care/voice.ts` | `SAY`, `REMARK`, `WRONG_GUESS`, how often she guesses wrong and from which cycle |
| `src/tractor/data.ts` | `TRACTORS`, `IMPL` (all eight), `RELATED` (how much a wrong implement still does), `LAYOUTS` (six fields), `MONEY`, `TRACTOR_REWARD` |
| `src/trials/model.ts` | `WRONG_FIX_COST`, and the proposed yield effects: `WAKALA_YIELD_EFFECTS` (off), `TRACTOR_Q_FACTOR`, `MISSED_FOLLOW_UP_RETURNS` |

Lines ported from Wakala are marked `// Wakala` in the data; the rest are new, in the same style.

**Money.** TemoLima's money (shown in the player's currency) stays the only money. Real-world costs appear only in the tractor summary, to compare, and its
*Sources* button lists each figure with its source: diesel KSh 228 a litre (EPRA's Nairobi cap for 15 October to
14 November 2026, via [Techish](https://tech-ish.com/2026/10/14/petrol-rises-to-kes-226-96-in-nairobi-and-kerosene-jumps-kes-28-49/)),
tractor ploughing KSh 3,000 and harrowing KSh 1,500 an acre ([Beyond Forest](https://www.beyondforest.org/post/ploughing-cost-per-acre-in-kenya-2026-guide-virgin-vs-uncultivated-land-explained)),
hand ploughing 24 person-days an acre at KSh 400 a day ([FarmBiz Africa](https://farmbizafrica.com/tractors-services-increase-farmer-earnings-lower-production-costs/)).
**Estimates**, labelled as such in the game: ridging, planting, spraying and harvesting hire; hand-work days for
everything but ploughing; diesel per acre for each implement; 2.68 kg of CO₂ a litre. One farm is 4 acres. The
summary shows these costs in the player's currency, from the shilling sources at KSh 129 to the US dollar.

**Rewards.** A drive pays 1.5 coins per score point and 50 points per star above the farm's best this cycle, as in
Wakala. *Try again* is allowed until the player is done with the drive, but a retry pays coins only for the score
above the farm's best (`TRACTOR_REWARD.retryPays = 'improvement'`), so a drive can't be replayed for coins. The
reducer works the pay out from the score and the best on file. Only the first clean drive on a farm each cycle earns
a climate credit.

**Yield.** Until the agronomist's review (Gate A), how well the tractor ploughed and whether follow-ups were done are
shown and saved but change no bags: `WAKALA_YIELD_EFFECTS = false`. With it on, a tractor-hire farm's land-prep
factor is scaled by the drive's job quality (`TRACTOR_Q_FACTOR`), and a problem that came back costs harvest like any
other. Wrong fixes cost coins now; those coins count in the farm's costs at harvest.

**Events** (with the first-session ones): `prescribe {hazard, pick, right}`, `kit_on`, `product {hazard, pick,
right}`, `care_started` and `care_done {farm, day, hazard, job, kind}` (treatment or follow-up), `care_missed`,
`tractor_open`, `tractor_pick {tractor, implement, right}`, `tractor_done {score, stars, job, cov, eff, clim, money,
saved, hits, secs, auto, reason}`.

**Not ported** (on purpose): Wakala's review screens and its five calls, its seven written rounds, its clock and
morning and evening windows, the three-misses rule, browser notifications, hold-to-act buttons, the planting and
harvest tractor stages, the boom-sprayer, delivery and route jobs, gems, hub maps, road walking and its onboarding.
Wakala's photos were not added yet (Wikimedia could not be reached from the build session).

**Tests.** The Wakala moments are played by `tests/care.spec.ts`, `tests/tractor.spec.ts` and `tests/tour.spec.ts`;
see [Tests](#tests).

## The tractor business

Built to Hello Tractor's game brief (*Tractor Wars: from Booking Agent to Tractor Owner*): **Tractor business** in
the main menu, or the **Tractor business** tab in the tractor screen (TRACTOR on the farm); address `#/tractor-business`. The player is a **Booking
Agent** in the **Narok hub territory**, with no land and no machine: they scout farms, book mechanised work on the
hub's tractor (or pass it to a partner), drive the tractor at every stop, and build a book of business dense and
reliable enough to be financed into a tractor of their own. Code: `src/business/model.ts` (every rule and number, no
screens; every value the brief calls tunable is a named constant), `src/business/drive.ts` (the minigame's rules),
`src/business/Business.tsx` and `src/business/DriveGame.tsx` (the screens), `src/business/Cast.tsx` and `cast/` (the
brand's five characters).

![Campbell scouts a farm](docs/business-campbell.webp)
![The ten-second drive at a farm](docs/business-drive.webp)
![The day's result with the efficiency score and the SER](docs/business-result.webp)

**A day** (the *Today* tab)

- **The territory.** A map of the Narok hub: the yard and nine farms, six **inside the territory** (a sage ellipse
  with a dashed Sunset Blaze edge) and three outside it, placed near the map's edges and marked with a dashed
  Hibiscus border. **The map is laid out afresh every day** (seeded by the day, so a reload shows the same map), with
  winding murram roads joining every farm to every other; distances are along the roads, and there is no route line,
  no km and no "shortest" hint while planning (`mapFor` in `model.ts`). Farms inside the territory book more often.
- **Narok's calendar and the Knowledge Graph.** Three business days make a month, and the game opens in February
  (`DAYS_A_MONTH`, `START_MONTH`): 36 days are a year. Each part of a farm grows a crop (maize, wheat, barley, beans
  or potatoes), and each day's bookings are **in window for that crop this month** (`CROPS`: land preparation,
  planting, fertilizer application, harvest; transport all year). The windows are seeded from public agronomy for
  Narok County and are to be signed off by Hello Tractor's agronomy team before the territory ships (the brief, §7.1).
- **Project Campbell (Loop A).** Tap a farm and Campbell scouts it: the crop on its first booked part, what is in
  window this month, the **practice it flags** (*plans to plant by hand two weeks after the land is ready*) and the
  recommendation (*plant with the tractor right after land prep, inside the window*). **Deliver the advice** and the
  farmer answers in Wekeza's voice: a yes adds the recommended job to today's bookings (*on your advice*); a no says
  why. One recommendation a farm a day. If the next activity is out of window, Campbell says when the window opens:
  the lesson is the window, by consequence, not by quiz.
- **The territory advantage (Loop B).** How likely a farmer is to take the advice (`ACCEPT`): inside the territory
  55%, plus 25 points for the **Hub Manager's demo plot** on that crop and 15 for the **CX Team's follow-up call**
  (95% with both); outside the territory 25%, with neither. The *Hub* tab lets the player ask the Hub Manager for one
  demo plot per business level, and explains the CX Team in Caro's voice.
- **My tractor or a partner.** Each part of the farm is booked for **the hub tractor** the agent dispatches, or
  passed to a **partner**. Each button shows what that choice leaves the business: the hire less the job's diesel and
  **the hub's 25% share of its tractor** (`HUB_SHARE`, until the agent owns one), or the partner's 10%. A job needs its
  tool on the tractor: a plough, a harrow and a trailer to start; the planter, spreader and harvester are bought in
  Fleet. Wheat and barley harvests need a combine (below): pass them on for the commission.
- **At least three farms, then the route**, as before: tap the farms in the order the tractor visits them (yard →
  stops → yard). The day only has to fit with the shortest way round (work + shortest drive ≤ 9 hours).
- **Density: the Service Efficiency Ratio (Loop C, §5.1).** `SER = acres serviced ÷ km driven`. The *Density* meter
  shows the band while booking (from the shortest route, which stays hidden). Below the **floor** the sparsest stop
  (the one whose acres are least worth the km driven for them) is **dropped as unserviceable**, then the next, until
  the rest clear the floor: the farmer waits, the booking does not close, and the day's counted acres are halved.
  The brief's real-world v1 values (1.0 and 4.0 acres a km) are scaled to the game's sprawling 13 km map: `SER =
  { floor: 0.1, healthy: 0.3 }`, tunable (the median day sits near 0.25).
- **Start the day: drive the tractor at every stop.** The tractor drives each leg along the roads on the map; at
  each farm the **ten-second drive** opens (`DriveGame.tsx`, rules in `drive.ts`):
  - **A field job** (plough, harrow, ridge, plant, spread, harvest): the farmer's field from above, four passes of
    the implement tall, with a rock, a tree or a stump in the way. Tap and hold where the tractor should go (or steer
    with the arrow keys): the implement works a swath behind it. The **field efficiency** is the share of the field
    worked when the time is up; a tidy serpentine makes 85–95% in about seven seconds; knocks stop the tractor.
  - **A transport job** (the trailer): a haulage run down a murram road with potholes, puddles and ruts, three
    lanes, ten bags on the trailer. Tap a lane (or the arrow keys) to miss them; every hit drops a bag.
  - **Let the driver do it** hands the stop to the hub driver at the brief's **65–75% field efficiency on small,
    irregular plots** (`BASELINE` = 0.7), which is exactly the planned job. A drive at or above the baseline closes
    the job; a better one saves up to 25% of its diesel and, at 90% or more, pays 15 points for *a clean drive*; one
    under 80% of the baseline leaves the job **unfinished**: the hire is cut to the share done and the booking does
    not close. The drives are seeded by the day and the farm, and the main menu pauses them.
- **The result.** The efficiency score (the shortest route's km against the player's) as before, now with the
  day's **SER** beside it, the farmers helped, clean drives, a **neighbourhood synchronised** (three or more farms
  booked on the same activity the same day: +30 points), anything dropped or unfinished, the money (hire, partner
  commissions, diesel, driver, the hub's share, and the PAYG instalment once the agent owns a tractor), the
  fulfilment of the day and the counted acres earned.

**The two numbers (§5)**, computed every day and shown in the header: the **fulfilment rate** (bookings closed
against every booking there was: unbooked requests expire, dropped and unfinished jobs do not close) and the **SER**
over the last week. Fulfilment is the agent's reputation: the *Hub* tab's **community leaderboard** ranks the player
among seven other agents (simulated, their rates drifting slowly); at 90% or better one more farm books each day, under
60% one fewer (`REPUTATION`).

**Counted acres (Loop D)** = physical acres × unique activities on each part of a farm this year (`Biz.done`): 100
acres of land prep alone count 100; the same acres prepared, planted, fertilised and harvested count 400. Every job the
agent books counts, on the tractor or through a partner; a repeat of the same activity on the same part counts
nothing more; the record starts afresh each year. The header's bar shows the way to the next threshold.

**Graduation and PAYG (§2.2, §5.4, §7.2)**, all in `PAYG`: at **700 counted acres and 80% fulfilment** Sasha delivers
the graduation moment and the agent signs for a **45HP tractor** (4 acres of field work a day; KSh 1,800,000 on screen,
paid from 30% of each day's hire); at **1,235** the **75HP** (10 acres a day). The hub's share ends; the capacity rule
begins (*Your 45HP tractor can do 4 acres of field work a day*; transport does not count against it). Utilisation of
the capacity under 50% over a rolling week, or fulfilment under 60%, puts the tractor in a **warning state**; five days
in a row and it is **repossessed** (seven days before the agent can qualify again). The *Fleet* tab shows the loan;
the *Calendar* tab shows each month's utilisation as a bar, with Gitonga's and Aziza's lines.

**The Marketplace (Loop E).** Once the agent owns a tractor, agents in Hello Tractor's other hubs (Nakuru, Kisumu,
Meru, Eldoret, their seasons offset from Narok's by `HUBS`) post **contracts** for the day: a day's work away in an
activity in window there. Offers appear on *Today* when nothing is on the player's tractor; taking one runs the day
away (the tractor's acres count toward utilisation and the loan; Narok's bookings that day can still be passed to a
partner). The brief wants peer-to-peer trading between live agents at launch; this game has no accounts or server,
so simulated peers stand in (the brief's "liquidity backstop"), and the data shape (`Offer`) is ready for a live feed.

**The combine** is a separate asset, not financed under PAYG: it opens in *Fleet* once the agent owns both tractors
(`shopBlock`), and takes the wheat and barley harvests that otherwise go to partners for a commission.

**Partners** (Kimani Tractor Hire, the Narok Farmers' Co-op, Rafiki Fuel, the County Roads Office, the Hello Tractor
app), **Fleet** (ridger, fertilizer spreader, maize planter, tractor harvester, the hub's large tractor, the combine)
and **levels** by farmers helped are as before. A day hired out to the county is booked like any other day's hire:
the hub keeps its share while the tractor is the hub's, and an owned tractor pays its PAYG instalment from it.

**Hello Tractor's voice (§6).** The business screens use the brand's palette (Sunset Blaze `#FF461E`, Hibiscus
`#F8285F`, Plum `#2F1C54`, Sage `#93C393`, Summer Breeze `#93C2C6`, Charcoal `#161616`) and type (Merriweather for
headings, Manrope for body copy: the brand's web fallbacks, fetched from Google Fonts only when the business opens, so
the game's first screen stays as light as before), the speech-bubble supergraphic for every character's line, and a
Sunset Blaze → Plum gradient for the graduation moment. The five characters from the brief are in-game guides:
**Sasha** (the welcome, graduation), **Caro** (the coach on the guide line, the CX Team), **Aziza** (the path to
ownership, PAYG), **Wekeza** (the farmer's answer to advice) and **Gitonga** (the owner, on the calendar and fleet).
Their pictures are cropped below the head and never rotated, on palette colours (`src/business/cast/*.webp`, 2–5 KB
each).

**Numbers.** The business keeps its own account in shillings (it starts with KSh 200,000 on screen). Hire per acre,
diesel and hand-work days are Wakala's figures (`tractor/data.ts` `MONEY`, `IMPL`), with their sources, shown at
10 times like every value in the game (see *Money on screen*); the trailer's and the combine's hire, road speed
(20 km/h) and diesel, work rates, the driver's KSh 10,000 a day, the hub's and the partner's shares, the shop's
prices, the SER thresholds, the acceptance chances and the PAYG prices are **game estimates**, marked in the code.
Saves from before the brief gain the new fields (`bizOf`).

## Plots and inputs

**Every farm is 20 plots**: its 4 × 5 tiles, Plot 1 at the back left to Plot 20 at the front right
(`PLOTS_PER_FARM` in `src/plots/data.ts`; `plotAt` in `src/world/field.ts` finds the plot under the farmer). The work
done is a 20-bit mask per farm and job, one bit per plot. The plots make 4 rows of 5 (`FARM_ROWS`, `rowMask` in
`src/world/field.ts`). **Clearing and planting are done a row at a time** with the Clear and Plant buttons and a
3-second timer (`PLOT_WORK_S`), which marks every plot of the row; the other jobs by walking over the plots.

**Inputs are one set per farm**: one seed, one fertilizer and one sprayer for all 20 plots, so the six farms compare
them. Every word and number is in `src/plots/data.ts`, for an agronomist's review.

- **The inputs board** shows a farm's seed, fertilizer and sprayer, with what each choice is, when it is the right one
  and what it costs. It opens in the plan (the *Inputs* row, one box per farm), and at the fertilizer and sprayer sheds.
  A farm already sown or spread keeps its input; a change while the farms grow pays or refunds the difference.
- **The tractor can be used at any point.** At the tractor the farmer picks its type (compact, standard, walking, large, 4WD: fuel,
  speed, how much it packs the soil) and its tool (plough, harrow, ridger, planter, seed drill, inter-row cultivator,
  fertilizer spreader, boom sprayer, maize or bean harvester), with what each tool is for and which farms need that
  job today. The tool decides the job, and the tractor works the plots it drives over. The spreader also does the
  CAN top-dress, and the boom sprayer the stalk-borer spray (`toolJobs`); the cultivator weeds. These three jobs show
  in the picker only in cycles with [scheduled care](#scheduled-care). Fuel is paid once per farm and job (24, 36 or 56
  coins); a farm whose 20 plots are all done from the seat pays 30 points. The first type and tool on a farm are kept
  with its results; spraying from the seat makes the farm's sprayer the boom sprayer. *Change tool* swaps the type or
  tool without getting off.
- **Growth on the field.** A farm's crop grows taller or shorter, greener or paler, with its inputs.
- **Results by input.** The results have a *By input* view: every farm's harvest beside its seed, fertilizer, sprayer
  and tractor, and TemoLima AI's lessons, each a fair comparison: a farm's harvest against the same farm with one input
  changed to a yardstick (long-season hybrid, no fertilizer, work by hand, the tool the farm needed, no spray),
  averaged over the farms with each choice.
- **Proposed numbers.** Seeds and fertilizers change yield as proposed in `docs/plot-trials-plan.md` (drought-tolerant
  seed in a dry season, DAP and CAN against no fertilizer, a large tractor's soil packing, the wrong tool for the
  ground). They are game estimates until reviewed.
- **Older saves.** A farm saved with four input plots (A to D) keeps Plot A's inputs for the whole farm.

## Navigation and the main menu

Every screen has at least two or three ways to move, and one of them is always the main menu:

| Screen | Back | Menu | Farm |
| --- | --- | --- | --- |
| Shop, Farming Steps, Rewards, Sale, Storage… | one step (to the menu if it was opened from there) | ☰ | ⌂ |
| Mission (six farms), Field rounds, a farm check, Choose the fix, the safety kit | one step | ☰ | ⌂ |
| Settings | close (to the menu if it was opened from there) | ☰ | ⌂ (not in the first session) |
| Climate | close (to the menu if it was opened from there); another tab keeps where Back goes | ☰ | ⌂ |
| The tractor drive | the previous step | ☰ (the clock waits while it is open) | ⌂ |
| First session | one step where that is safe | ☰ | Settings instead (the farm is not open yet) |

The **main menu** (`src/screens/MainMenu.tsx`, the **MENU** button on the farm) lists My farm, Mission, Field rounds,
Tractor, Tractor business, Animals, Security, Shop, My Progress (achievements), Climate, Rewards, Partners & offers, Training, Loan
calculator, Farming steps and Settings. In the first session it lists only Back to the game, How the farm works and
Settings. The list scrolls, with a gold
**scroll wheel** beside it (▲ and ▼ buttons and a thumb to drag, since phones hide scroll bars); the mouse wheel and
a swipe scroll it too. A screen opened from the menu goes back to the menu on *Back*;
*Farm* closes everything. The shared buttons are `NavBar` in `src/components/Nav.tsx`; `ModalShell` adds them to every
modal. `tests/nav.spec.ts` plays them.

**Every dialog has a ✕ in its top-right corner** to leave it: the framed modals (`ModalShell`), the full pages
(Settings, Climate, Achievements: beside Back · Menu · Farm), and the cards on top of a screen (the six farms' choices,
the rounds' summary, the tractor business's welcome, graduation and day result, the story's pop-ups, a zoomed
picture). The shared button is `CloseX` in `src/components/Success.tsx`.

### Success dialogs

Things that matter end in a dialog the player reads and closes, not a message that fades at the top
(`SuccessCard` in `src/components/Success.tsx`, the screens in `src/screens/Success.tsx`, `GameState.success`):

| After | The dialog |
| --- | --- |
| Selling food in the Shop | **Sale complete**: bags sold, what they earned, the price, bags left, coins now; *Sell another* adds to it |
| Selling the season's harvest | **Harvest sold**: bags, where they sold, what they earned, losses and costs, points; closes onto the season results |
| Booking a training course | **Booking confirmed**: when, where, the trainer, what to bring and a seat reference; a reminder goes into Messages |
| Moving the harvest to better storage | **Storage upgraded** (optional): spoilage before and after, bags saved, the extra cost; *Don't show this after an upgrade*, or Settings → Game → *Upgrade messages* |
| A right call on a farm check | **Farm visit complete**: what was found and what to do next, the points, first or second look, and the day's visits so far |

### Loan calculator and training

*Loan calculator* (Menu): what the loan is for (each purpose has its rate), how much, and over how many months, with
the monthly repayment as it changes. **Get my quote** opens the **Loan Quote Result**: the monthly repayment, the
interest, a 1.5% processing fee and the total to pay back; whether the farm can carry it against what it earns a month
(the last seasons' sales, or this season's expected harvest): *Comfortable* (under 30%), *Tight* (up to 50%) or
*Risky*, with the most that stays comfortable; and the loan and interest month by month. The *Phone Loan Discount*
voucher from Rewards takes 10% off the rate. It is a calculator only: no coins change hands
(`src/finance/loan.ts`, `src/screens/Loan.tsx`).

*Training* (Menu): four short courses, each with a date, place, trainer, seats and price (two are free). *Book a
seat* pays for it, keeps the booking with the save and opens the Booking Success dialog (`src/training/data.ts`,
`src/screens/Training.tsx`). `tests/success.spec.ts` plays all of this.

## Page addresses

Every page has its own web address after the `#`, so a player can type one in the address bar to go there,
reload without losing their place, bookmark a page, and use the browser's **Back** and **Forward**
(`src/route.ts`). For example `https://dgtechbuilder.github.io/limagame/#/settings/display`.

| Address | Page |
| --- | --- |
| `#/start` | Name your farmer (first session) |
| `#/story/1` · `/2` · `/3` | The story so far, page by page |
| `#/walk/maize` · `#/farm-update` · `#/check/maize` | Walk to the maize, the farm update, and its check |
| `#/walk/back-maize` · `#/check/back-maize` | The back maize, after a wrong call |
| `#/walk/sukuma` · `#/check/sukuma` | The sukuma wiki, and its check |
| `#/farm` | The farm |
| `#/menu` | Main menu |
| `#/rounds` · `#/rounds/six-farms` | Field rounds: every bed, or today's checks of the six farms |
| `#/mission` | Mission: the six farms |
| `#/tractor-business` | The tractor business |
| `#/tractor-game` | The tractor game: plough the mini farm in 30 seconds |
| `#/settings/my-farmer` · `game` · `display` · `help` | Settings, by section |
| `#/climate/overview` · `land-and-pay` · `farm-areas` · `emissions` · `water-and-soil` · `shocks` · `activity` | Climate, by section |
| `#/shop/food` · `fertilizer` · `water-tanks` · `equipment` | Shop, by tab |
| `#/steps/land-prep` · `planting` · `fertilizer` · `pesticides` · `water` · `harvest` | Farming steps |
| `#/harvest-timing` · `#/sale` · `#/storage` · `#/value-addition` · `#/process` | The season after harvest |
| `#/farm-info` · `#/results` · `#/rewards` · `#/welcome` | Farm info, season results, rewards, how the farm works |
| `#/loan-calculator` · `#/loan-calculator/quote` · `#/training` | The loan calculator and its quote, farmer training |
| `#/progress/journey` · `modules` · `today` · `badges` · `certificates` | My Progress, by section (`#/achievements/…` still works) |
| `#/partners/offers` · `#/partners/offers/<brand>` · `#/partners/placements` · `#/partners/partner-with-us` · `#/partners/shortlist` | Partners: offers (one brand's in view), placements, ways to partner, the shortlist (open before the farm too) |
| `#/animals/today` · `health` · `water` · `coop` · `herd` | Animals, by section |
| `#/security/protect` · `risks` · `night-reports` | Security, by section |

**The player's session decides where an address can go.** The game's saved state stays the one source of
truth: the address always names the page on show, and a typed address goes through the same rules as a tap.

- **First session:** only its steps, the main menu and Settings can be reached, and only steps the player has
  already reached. They can step back between naming the farmer, the story pages and the walk to the maize
  (as the Back button can), but not skip ahead to a check or open the farm early.
- **After the first session:** every farm page can be reached. The first-session steps can't, and
  `#/rounds/six-farms` works only on a day the six farms have checks.
- **Anything else** (a page that doesn't exist, or one the player can't reach yet) leaves them where they are,
  with a short message, and the address is put back. Addresses are tidied first: any case, extra slashes.
- Opening the game with an address goes straight to that page (if allowed); with no address, it opens where
  the player left off. Each new page adds a step to the browser's history. A correction replaces the address
  instead, so Back never lands on a page the player couldn't open.
- The browser tab's title names the page. *Settings → Help & data* explains addresses to players.
- Design review (`?review` / `?screen`) leaves the address alone.

## Sound effects

Every completed action and every completed flow plays a happy sound, made on the phone with the Web Audio API
(`src/sfx.ts`, nothing downloaded). There are two, in the punchy, major-key, metallic style of a mobile base-building
game's reward sounds:

- **Action** — a bright bell-like double *ding* with a coin sparkle: a bed sown, the deed signed, a story step, a
  check read right, an item bought or sold, a farming step done, a farm treated, a partner signed, the route set.
- **Flow** — a short brass fanfare climbing to a held chord, with a drum hit and a sparkle tail: the story told, the
  first session done, a season sold, a six-farm harvest in, a tractor job finished, a day of the tractor business run.

The reducer tags each action with the sound it earned (`soundOf` in `src/state.ts`): a refusal (*You need … coins*)
or a step back plays nothing. `App.tsx` plays the tag once; screens with their own pop-ups call `sfx.action()`.
Each cue is rendered once into a buffer off the main thread (an `OfflineAudioContext`), after the first tap; playing
it is a single buffer source, and the audio context sleeps between cues, so sound never slows the 3D farm.
Settings → Game → *Sound effects* turns them off.

## Money on screen

All money is shown in the **player's own currency** (`money()` in `src/money.ts`): balances, prices, costs,
profits, rewards, loans, training, the tractor summary's real-world costs and the climate payments. The currency
comes from the country picked on the second onboarding step ("Where do you farm?", after naming the farmer), and
can be changed in **Settings › Game › Country and money**. The country is kept with the settings, so it survives
Reset progress. Kenya, Uganda, Tanzania, Rwanda, Ethiopia, Nigeria, Ghana, South Africa, Zambia, Malawi and the
United States are offered; "Somewhere else" (and any save made before the step existed) shows US dollars. The step
pre-picks a country from the device's time zone, then its language (e.g. `en-KE`).

The game's own maths keeps its stored amounts, so every comparison, unlock and old save works as before: a stored
amount stands for 10 Kenyan shillings (the prices were set in shillings), worth US dollars at KSh 129 to the dollar
(`KSH_PER_USD`), and each currency has a fixed game rate to the dollar (`COUNTRIES`). Kenya therefore sees the
game's own shilling prices (a new game starts with KSh 300,000; $2,326 in dollars). Currencies with cents (dollar,
cedi, rand, kwacha) show them under 100 ($3.10); the rest show whole units. The small HUD meters use a short form
(`moneyShort()`: KSh 300k, USh 8.5M). Typed prices (Sale of produce) are typed in the player's currency. Where this
README says *coins*, it means this money. Points, litres, km, acres and days are not money.

## Settings

*Settings* (the **SETTINGS** button on the farm, the main menu, or the top bar in the first session) is a full page with
five sections. Every control works at once and is saved on the device; *Reset progress* keeps them.

| Section | Controls |
| --- | --- |
| **My farmer** | rename the farmer; change the look (the farm, the rounds and the HUD all follow) |
| **Game** | *Character style*: Retro anime or Original · *Farm view*: 3D farm or Classic · *Read aloud*: speaks the guide's lines and the game's messages with the phone's voice (a Kenyan English voice when the phone has one), with a Test button · *Sound effects*: on or off, with a button to hear each one · *Upgrade messages*: the dialog after a storage upgrade, on or off |
| **Display** | *Graphics*: Auto (shadows and a picture sized to the phone, lighter by itself if it slows down; see [Performance](#performance-on-low-cost-phones)), High (always shadows, the sharpest picture), Low (no shadows, 1× resolution) · *Reduce motion*: ends every animation and transition at once · *Full screen* |
| **Controller** | the controllers connected, by name and make · *Use a controller*: on or off · *Button names*: Auto (as printed on the controller in use), Xbox, PlayStation or Nintendo · *Confirm button*: Bottom (Xbox, PlayStation) or Right (Nintendo style) · *Stick dead zone*: Small, Medium or Large · *Rumble* · a chart of every button, lit while held · *Set up buttons*: press each button in turn, for a controller the browser does not know (see [Game controllers](#game-controllers)) |
| **Help & data** | How the farm works · Page addresses (what the address after the `#` does, with this page's) · Design review · Reset progress (asks twice) |

The settings live in `GameState.settings` (`src/state.ts`); each section has its own address (`#/settings/display`).
The 3D farm is rebuilt when the character style or the
graphics change. `tests/settings.spec.ts` plays every section.

## Game controllers

Any controller the browser sees plays the whole game: Xbox, PlayStation (DualShock, DualSense), Nintendo Switch
(Pro Controller, Joy-Con) and other makes (8BitDo, Logitech, PowerA, unbranded USB pads), by USB or Bluetooth.
`src/input/gamepad.ts` reads them every frame and turns them into what the game already understands, so every screen
works without code of its own:

| Controller | Does |
| --- | --- |
| Left stick, D-pad | walk (the left stick walks the 3D farm at analogue speed), drive, steer, change lanes; on menus and pages, move the focus to the nearest button that way |
| A / ✕ (Confirm) | press the button in focus, or the farm's action button underfoot (Clear, Plant, Check, Play); Enter for the timing and hold games |
| B / ○ (Back) | Back / close (Escape) |
| X / □ | Space for the hold and timing games; the tractor button on the farm |
| Y / △ | walk to the next task |
| LB / RB (L1 / R1) | the previous / next button, one by one |
| LT / RT (L2 / R2) | the page's previous / next section |
| Menu / Options / + | the main menu |
| View / Create / − | Settings |
| Right stick | scroll |

The make is told from the USB vendor (Sony, Nintendo, Microsoft) or the name, and Settings → Controller shows its own
button names. Controllers the browser maps to the standard layout share one set of button numbers; unmapped ones (some
older or unbranded pads, some browsers) are read with a best guess, including a D-pad reported as a hat axis, and the
player can set up each button in Settings → Controller (kept per controller model). `src/input/pad.ts` holds the
mapping; `tests/controller.spec.ts` plays it with pretend Xbox, PlayStation, Nintendo and unbranded controllers.

## Money at risk

The farm's first button, top centre beside the task card: **the money every unresolved problem on the six farms
would cost if it is left**, added up and written short in the player's currency (*KSh 50k at risk*, *KSh 1.2M at
risk*). It makes the daily loop's stakes visible at a glance and gives a reason to open the game every day.

![The at-risk list: each farm, what is at risk and when it grows, never the cause](docs/at-risk-list.webp)

- **What it counts.** Every farm that is planted and shows a problem with a cost (pests, water, plant food, weeds,
  animals, hail…) that has not been dealt with: read right, and the fix done by hand (hail: read right). A problem's
  **stated cost** is what the six-farm model takes off that farm's harvest if it is never dealt with
  (`DAMAGE[…].missed` × what the farm's harvest is worth as it grows), the same number the check shows: *Will cost you
  about KSh 10,730 if it is left alone*.
- **It grows if left.** On the day a problem shows, half its stated cost is at risk; each day it is left adds a
  quarter, up to the whole stated cost. **A problem left unresolved stays on its farm the next day** (until it is
  dealt with or the harvest), so a player can still catch it late; one never dealt with costs, at harvest, what was at
  risk by then. A problem the plan cannot treat (pests on a farm with no pest control) does not carry over, and once
  read right it leaves the list as lost, not saved. All of it is in `src/risk/config.ts` (`startShare`,
  `escalatePerDay`, `carryOver`).
- **Tap it** for the list, biggest first: the farm and its plots, what is at risk now, and what it will be in a day
  (or *Full cost*). The list never says what the problem is, only where the player is with it (*Not checked yet*,
  *Read wrong: look again*, *Read right: choose the fix*, *Read right: the work is left*). **Tap a farm** to go straight
  to its sign and into its check (or the fix, or the work left).
- **Live.** Dealing with a problem takes it off at once: the button pops, a *KSh 9.6k saved* chip floats off it and a
  *Caught in time* card follows (after any check or fix screen has closed). With nothing at risk the button turns calm
  green, *All clear* (*Harvest time* once the checks are over). It first appears with the first problem of the first
  planting period, and stays from then on.
- **While you were away.** The button as last seen is saved; a player coming back on a later day to more at risk sees
  what grew (*KSh 3.5k at risk when you left, KSh 11k now*) and can open the list from there.
- **Forecast shocks** (drought, flood, hail by the season's forecast, less what crop cover pays; cover is the Lima
  Insurance offer for now) can be added to the total: off (`RISK.includeShocks`) until confirmed.
- **Evidence** (for the evidence layer to come): every tap on the button and on a farm in its list is counted, and
  every problem dealt with is kept with when it was first on the button in front of the player and when it was fixed
  (`GameState.risk`, the last 100). Events: `risk_open`, `risk_row`, `risk_fixed` (with `msFromSeen`).
- **Not yet:** a push or SMS reminder (*KSh 50k at risk on Farm 2*) is out of scope until confirmed.

`src/risk/model.ts` works the list out from the save (no screens; `riskOf`), `src/risk/RiskHud.tsx` is the button, the
list and the two cards, and `tests/risk.spec.ts` plays the acceptance checks: three problems add up, a fix drops the
total by exactly its amount, a day left raises each by the escalation (up to its stated cost), a carried problem
stays on its farm, the list never names a cause and a tap opens that farm's check.

## Harvest estimate

Beside the farmer's portrait, top left, styled like the task card: **what the harvest is likely to bring in if it goes
well, the way the player is farming now**, and under it in small red text **what they are likely to lose if they do
not put right the problems on the farms now** (*$3.1k*, *−$315 if not fixed*).

![The harvest estimate beside the portrait, and its sheet](docs/harvest-estimate.webp)

- **The estimate** is every farm's harvest from the six-farm model (`harvestFarm`): its plan, its plots' inputs, the
  care done or missed, and every problem so far as it was dealt with, with today's open problems taken as put right.
  Nothing new is assumed to go wrong. At harvest time nothing more can be put right, so it is the harvest as the checks
  made it; once harvested, the button shows *Last harvest* and what it brought in.
- **The risk line** is every open problem at its full cost if it is left alone: the same number the check shows
  (*Will cost you about … if it is left alone*). The *at risk* button beside the task card shows what is at risk
  *today* (half of that on the day a problem shows, growing each day it is left); the harvest line shows where that
  ends up if nothing is done. With nothing open it reads *Nothing at risk now*.
- **Tap it** for the sheet: the successful harvest, what would be lost if not put right, the harvest if left alone,
  what the farms have cost so far and the profit after costs, then each farm's bags, cost, value and its own risk.
  *See what is at risk* opens the at-risk list, to go and deal with them.
- It shows only once a planting is growing (or harvested). Evidence: `harvest_open`.

`src/risk/harvest.ts` works it out from the save (no screens; `harvestEstimate`), the button and sheet are in
`src/risk/RiskHud.tsx`, and `tests/harvest.spec.ts` checks the estimate is the model's harvest with today's problems
put right, the risk is every open problem's full cost (and drops by exactly one when it is fixed), and the button sits
beside the portrait, clear of the task card, with the same numbers.

## Climate-smart farming: row strategies and treatment choices

Partners asked the game to teach climate-smart practices through real trade-offs. Two general systems do it.

**Row strategies.** Each farm's 20 plots make 4 rows of 5, and **each row runs its own strategy**: one option on every
dimension, grouped as *fertilizer* (as the plan, organic compost, DAP, Lima NPK, micro-dosing), *tilling*
(minimum tillage, deep ploughing), *sowing* (seed, spacing, seedbed: zai pits, tied ridges), *planting* (timing,
mulching), *planning* (crop, rotation, season) and *farming habits* (check frequency, watering time, fertilizer
timing). Every option has a cost, labour (person-days, 24 family days a farm, the rest hired), a payoff (the return
over the co-investment of cash and labour, which can differ by the season's forecast), and climate effects (emissions,
carbon stored, water, soil health, pollution, and how much of each problem's damage the row takes). Mission ›
*Rows* (plan) or *Row strategies* (growing) opens the board; a sown farm's rows are locked. After harvest, Mission ›
*By row* puts the four rows of each farm side by side (bags, profit, return, labour, CO₂, carbon, water) and TemoLima AI
names the row that paid best and what it did differently. A row left "as the farm plan" changes nothing, so a farm
whose rows are untouched grows exactly as before. The strategies are paid with the plan (or at once, while growing),
and their emissions, carbon, water and soil go into the climate ledger at harvest, so they move the climate rating,
the credits and soil health. **The whole table is `src/strategy/data.ts`**: a new dimension or option is one more entry,
no code. Returns are placeholders (organic about 20%, DAP about 15% over the co-investment) to be replaced with verified
values.

**Diagnose, then choose how to treat.** After the right fix is picked, *How will you do it?* offers the ways to do it,
each with its cost, labour and payoff: armyworm with pesticide, **a pinch of ash in each funnel** or neem; aphids with
insecticide, soapy water or neem; a drought with a watering can, a drip line from the tank, or one deep watering and
mulch; hunger with CAN, manure and compost, or urea; weeds by hand, with a herbicide, or weeded then mulched; and so on.
A way's `effect` is the share of the avoidable damage it stops (the standard way is 1, as before), so a gentler way
saves a little less: the money-at-risk cheer and the harvest both use it. Each way has its own climate effects.
**The table is `src/care/treatments.ts`.**

## Water as a real resource

- **The tank** is on the farm's HUD (**WATER**, under Shop, its level as water in a barrel; orange and pulsing when low)
  and in **Climate › Water**. 10,000 L to start, plus every tank bought in the Shop. Each day (the player's midnight, or
  a night slept on the fast clock): **rain** off 120 m² of roofs in (by the season's forecast), the **house** (100 L),
  the **animals** and the **rows** (a can a row a day by hand, plus their watering habits and mulches) out. **Piped
  water** (5,000 L), a **bowser** (10,000 L, dearer a litre), a donkey cart, a neighbour's borehole and a big bowser
  can be bought, the last three opening on days 2 and 3.
- **Cows or hens.** The herd can be changed (0–6 cows, 0–60 hens): a cow drinks 50 L a day and gives off methane, a hen
  a cup. The herd also sets the animals' emissions in Climate › Farm areas.
- **Shocks have consequences.** With the tank under 20%, a drought on a farm puts 1.5 times as much at risk, and a
  drought can't be watered by hand until there is water in the tank (the farm world's work waits; on the Mission
  screen it stays untreated).
- **Crop cover** (Climate › Water) is bought for a cycle; the standard plan pays back 70% of what drought, flood and
  hail took at harvest (five plans, from basic to full cover, open by day 3). **Its price is set by the farm's water practices**: a tank at least half full, rows that keep water in the
  soil (mulch, zai pits, tied ridges, morning watering, drought-tolerant seed, minimum tillage), and a fair share of the
  dam each take some off, up to 40%. A dry season loads it.
- **Credits of every kind.** The credit ledger (`src/credits/ledger.ts`) now holds more than CO₂: **water credits**, one
  for every 100 L a day under the farm's 700 L baseline (and two more on a rationed day drawn fairly), are paid with the
  day like CO₂ credits. *Climate › Credits* shows both kinds and every payment.
- **Climate › Water & soil** now shows real data: the tank now, today's use by what uses it, the last 7 days, water
  credits and the irrigation drawn.
- **The shared catchment** (Phase 4): the six farms' irrigation comes from a small dam shared with four neighbours,
  rationed when it runs low; the player chooses to take what the plans need or a fair share, and the share of the
  plans' irrigation that was delivered sets the harvest's watering. Design: [`docs/shared-water.md`](docs/shared-water.md).

Every number is in `src/water/config.ts` (placeholders until confirmed).

## The animals: cows, hens and the chicken coop

The farm's **2 cows and 4 hens** (the herd the water model already counts) come into the player's care on **day 2**
(`LIFE.startDay` in [`src/livestock/config.ts`](src/livestock/config.ts)). A farm day ends with a night slept on the
fast clock (the first cycle) or with a calendar day; the first night brings a **Day 2** dialog: *Your animals*, with
**Build the chicken coop**. Before then the Animals page shows what is coming and nothing can be done.

- **Where:** **Animals** in My Progress (PROGRESS on the farm; a badge counts the jobs waiting and the problems showing), the main menu,
  or walking to the **Cows** spot at the pen gate or the **Hens** spot at the coop in the 3D farm. The classic farm has
  the same buttons.
- **Today:** the day's jobs. Cows: *Feed* (napier, hay and dairy meal, paid a cow), *Fill the trough* (needs 50 L a cow
  in the tank), *Milk* (sold to the dairy) and *Clean the pen* every 3 days. Hens: *Feed* (layers mash), *Fresh water*,
  *Collect the eggs* (sold), *Clean the coop* every 3 days, and *Shut the coop for the night* once it is built. Milk and
  eggs depend on the animals' health and on being fed and watered first.
- **Health:** each group has a health of 0–100. At night, a missed feed, water or cleaning, a tank that ran dry, or a
  problem left costs health; a day of full care brings it back. Under 25 an animal dies. **Problems show by their
  signs** and the player chooses the fix (three choices, one right, as with the crops): East Coast fever, mastitis,
  foot-and-mouth, bloat, heat stress and a **leaking trough** for the cows; Newcastle disease, coccidiosis, mites and
  egg eating for the hens. A wrong fix costs money and teaches why; the right one clears it (+20 points). Some kill if
  left (East Coast fever after 3 days, bloat and Newcastle after 1). **Prevention:** tick spray (7 days), the
  foot-and-mouth and Newcastle vaccines, deworming. A dirty pen or coop, unfed animals and a crowded coop make
  problems likelier; good health and a dry, raised coop make them rarer.
- **Water:** what the cows and hens drink is drawn by the water model each day; on top, a dry season makes cows drink a
  fifth more, heat stress more again, and a leaking trough wastes **300 L a day** until its valve is fixed. The Water tab
  shows every litre and how many days the tank lasts at today's use.
- **Coop** (from day 2): five to choose from (a night shelter, a **simple coop**, a movable coop, the raised coop and a
  layer house: [Options that open as you grow](#options-that-open-as-you-grow)), such as a **simple coop** (room for 20, +15% eggs) or a **raised coop with wire mesh** (room for 60,
  +25% eggs, fewer coop diseases); with its door shut it keeps out most thieves and predators. With no coop, hens roost
  in the trees and lose 30% of their eggs in the bush. It stands in the 3D farm once built (a pile of timber before).
- **Herd:** cows and hens are bought at a price (a cow KSh 80,000, a hen KSh 700) and sold for 80% of it; the water
  panel's herd uses the same prices. The 3D farm shows as many as the farm has: a stolen hen is gone from the yard.

## Theft, and keeping the farm safe

From day 2, **every night has its risks** ([`src/security/config.ts`](src/security/config.ts)). Each thing worth taking
has a chance of being taken that night, and every measure in place cuts that chance by a share (shares from several
measures multiply, so together they never cut more than 95%). It reaches across the game:

| What | When it is out there | What is lost |
| --- | --- | --- |
| Maize in the field | the six farms from day 5 of a cycle, more once ripe and not harvested | 4–10% of one farm's cobs, taken off its bags and income at harvest |
| Hens · predators | always; no coop or an open door makes it likelier | 2–6 hens stolen; 1–2 to a mongoose or hawk |
| Cows | always | a cow |
| Tools in the shed | equipment bought in the Shop | one tool |
| Maize in the store | the classic season, while it waits to be sold | 6% in home storage, 0.5% in the co-op warehouse (in the sale quote) |
| Cash at home | the night after a harvest sale | 10–25% of it |
| Water from the tank | over 1,500 L in it; 2.5× in a dry season | 800–1,500 L |
| Diesel | once the tractor business is open | KSh 1,500–3,000 of fuel |

What a farmer can do (**Security** in My Progress, or the main menu): hire a **night watchman** (paid each night; he does
not come if he cannot be paid), keep a **guard dog**, put up a **fence and a locked gate**, **padlocks** on the shed and
store, a **solar security light**, **brand and ear-tag the cows** (a stolen cow is often found again), **join the
community watch** (Nyumba Kumi: thefts reported together are found more often), take payments on **mobile money**, a
**lock on the tank's tap**, and a **GPS tracker and locking fuel cap** for the business tractor; and, in the farming
itself, shut the coop every night, harvest on time, and store maize in the co-op warehouse. *Risks tonight* shows each
target's chance before and after the measures, with the best next step; *Night reports* keeps the last 14 nights. A
night with news opens a **morning dialog**: what was stolen or lost, its value, and what would have stopped it.

Nights are seeded (`src/livestock/rand.ts`): the same farm, night and target always draw the same result, so a reload
never re-rolls a night. `tests/livestock.spec.ts` plays all of this through the reducer and the two pages.

## The evidence layer

To show that playing changes behaviour (`src/evidence/model.ts`):

- **Every meaningful decision is logged with a timestamp** in the saved game (the last 600): each check (with hours since
  that farm's last check: check frequency), each fix and way of treating (with the plots it covered), inputs, plans and
  row strategies, watering time, water bought and used each day, the herd, the dam policy, crop cover, money-at-risk
  taps and fixes (with the time from first seeing a risk to fixing it), harvests and tractor-business days. Each is also
  an event (`decision_…`), sent to `VITE_EVENTS_URL` when one is set.
- **Cohort / programme tags**: Settings › Help & data › *Programme* (type a code), or a link with `?cohort=CODE` (or
  `?programme=CODE`). Tags go on every event and in the export.
- **"Have you tried this on your own farm?"**: after a climate-smart practice (a pinch of ash, mulch, zai pits, a fair
  share of the dam, fixing a problem the day it showed…), at most once a day and once per practice (again after a week
  for *not yet*), a card asks; *Yes, I have*, *Not yet, but I will*, *No* or *I don't farm (yet)* are kept.
- **Settings › Help & data › My evidence** sums it up (checks a day, climate-smart treatments, minutes from risk to fix)
  and downloads everything as JSON.

## Tractor business: farmers, urgency and a trend

- **Each farmer has an urgency, a willingness to pay and a payment reliability** (`TRAITS` in
  `src/business/model.ts`), shown on every booking (*Urgent*, *Pays 110%*, *Often late or unpaid*). The hire collected is
  the hire times what they pay and how reliably; urgent work done today pays 10% more and 10 points. The day's result
  shows what was not collected, and a **day value** (route efficiency, money collected, urgent work served): the
  shortest route is not always the best one.
- **The farm drives urgency.** While the player's own six farms are in their planting window, land preparation and
  planting bookings are more urgent; rain forecast makes them more so, a dry season makes the harvest and transport
  urgent (`farmSignal`, `urgencyOf`).
- **My trend**: a chart of the trainee's efficiency score and day value, day by day.

## Climate tracking

Every job in the game now records what it does to the climate, the water and the land. The **CLIMATE** button
(beside MISSION on the 3D farm, beside Rounds on the classic farm, and in the main menu) opens the **Climate page**.

**What is tracked**

| Measure | What feeds it |
| --- | --- |
| **Emissions** (kg CO₂e), by source | fertilizer (making nitrogen + the N₂O it gives off), diesel (tractor work and drives), chemicals (sprays), water pumping, seed, storage & milling, transport to market, manure |
| **Carbon stored** (kg CO₂) | mulch (no dig), manure, beans between the maize (they fix nitrogen) |
| **Water used** (litres, on top of the rain) | the plan's watering, emergency watering, Farm Moja's water tasks |
| **Pollution** | sprays and herbicide, synthetic nitrogen runoff, over-watering that washes fertilizer away, exhaust, wrong fixes (glyphosate on maize) |
| **Soil health** | up with mulch, manure, beans, hand weeding, drains; down with bare soil, tractor compaction, a double dose, heavy chemicals |
| **Efficiency** | kg CO₂e per 90 kg bag, kg of food per 1,000 L of water, the tractor drives' climate score |
| **Food lost** | bags spoiled in storage, yield lost to problems |
| **Climate shocks** | drought, flood and hail met on the farms, and how many were read right in time (adaptation) |
| **Climate credits** | 1 credit for every 10 kg CO₂ stored or kept out of the air (a real carbon credit is 1,000 kg), plus extras for checking before spraying, weeding by hand and clean tractor drives |

**Where it is recorded** (`src/climate/track.ts`): Farm Moja's tasks; the six farms' plans when planted; tractor
work from the seat in the farm world (by the share of tiles driven); each tractor drive (the diesel it actually burned);
treatments, follow-ups and wrong fixes; a contractor's diesel for tractor-hire farms nobody ploughed; harvests (food grown
and lost); and the trip to market (storage, milling, transport). A harvest closes a season in the history.

**The page** has seven sections: *Overview* (a climate rating A–E, the climate level and credits, eight key figures and
the biggest source with what to change), *Land & pay* and *Farm areas* (below), *Emissions* (by source and by season), *Water & soil*, *Climate shocks* and
*Activity* (every recorded job, newest first).

**In the game**: the climate effect shows beside each choice: on the six farms' plan options, the Farm Moja task
cards, and the storage and processing cards. The HUD button carries the climate rating once there is a harvest.
Climate levels (Seedling, Grower, Steward, Champion, Climate hero) pay 100 to 500 points once each. Redeeming the
*solar power discount* in Rewards switches pumping, cold storage and milling to solar.

### Every area of the farm, and the daily climate payment

`src/climate/land.ts` evaluates every area of the farm each day:

| Area | Size | A day |
| --- | --- | --- |
| **Six farms** | 4 acres each (24), 20 plots of 0.2 acre | each plot is *farmed* (a crop in the ground: stores 1 kg CO₂ an acre; +1.5 with mulch, +1 with beans between the rows, +1 with manure, +0.3 with an ox plough; −0.3 with tractor tillage, −1 with slash and burn; at least 0.2), *bare* (cleared or ploughed, not planted: loses 2 kg CO₂ an acre, source *Bare soil*, and soil points; the loss takes credits back) or *idle* (not worked this cycle, or harvested: nothing counted or paid, no food) |
| **Farm Moja** | 1 acre | the same, from its season's tasks: bare once cleared or tilled, farmed once seeded (manure and beans store more), idle after the harvest |
| **Mini forest** | 10 acres | idle land left to grow as forest, bottom right of the farm below the pond: stores 11 kg CO₂ an acre (about 10 t a hectare a year) |
| **Grazing pen** | 2 acres | grazed grass: stores 0.5 kg CO₂ an acre |
| **Cows and hens** | 2 cows, 4 hens | methane from the cows' digestion (4.6 kg CO₂e a cow, IPCC 2006) and their manure (0.6), the hens' manure; 50 L of water a cow, 0.3 L a hen (source *Cows and hens*) |
| **Pond** | 0.5 acre | the water the animals and the house draw from it, and its health (0–100): the season's fertilizer and spray runoff muddies it |
| **Homestead** | 0.5 acre | cooking on firewood, 3 kg CO₂e (source *Cooking*; less with solar), and 100 L of water for the house |

**Daily payments.** When a day ends (the player's own midnight, the same clock as the daily streak, or a night
slept on the fast clock of the first cycle), every area's day is recorded in Activity (*Farm areas*), and every credit
earned since the last payment, from the areas and from the work (manure, mulch, beans, hand weeding, checking before
spraying, clean tractor drives), is paid into the farmer's money with a pop-up. A credit (10 kg CO₂) pays **$0.25**
($25 a tonne, a nature-based carbon price), with a premium for the climate level reached: ×1.1 Grower, ×1.2 Steward,
×1.35 Champion, ×1.5 Climate hero. The forest alone earns about 11 credits a day. Emissions from the animals and the
kitchen are counted in the footprint, not taken off the pay; bare soil's loss is. Up to 7 days away are counted. The
game checks the clock on opening, on coming back to it, and every minute (`climateTick`). Payments start once the
farm is open; credits earned before this update are not paid again.

**Climate → Land & pay** (`#/climate/land-and-pay`) shows the six farms' plots coloured farmed, bare or idle, the
carbon a day, the credits earned today and what they will pay tonight, the rate, everything paid, and the latest
payments. **Climate → Farm areas** (`#/climate/farm-areas`) evaluates every area: what it is doing today, its CO₂ a
day and all time, the water it draws, and a line on how it is doing and what would help. The Overview shows the money
paid in all. `tests/climate-pay.spec.ts` plays it through the reducer; `tests/climate.spec.ts` pays a day at midnight
in the browser.

**The six farms are 4 acres each** (`src/farmSize.ts`). Their numbers were first set for a sixth of an acre;
`FARM_SCALE` (24) sizes them: a farm's potential harvest is 144 bags (36 an acre), and seed, fertilizer, plan
options, treatments, wrong fixes and tractor fuel cost 24 times as much, so every rule keeps its proportions. The
tractor drive works a 4-acre farm (`FARM_ACRES` in `src/tractor/data.ts`), and the six farms' climate effects
(inputs, water, diesel, pollution, credits) are for 4 acres; soil health, a state of the soil, is not scaled. Farm
Moja stays one acre.

All factors are in one table in `src/climate/model.ts` (`FACTORS` and the plan, task and market tables), like the six
farms' numbers: illustrative estimates for learning until an agronomist reviews them; the N₂O share cites the IPCC
2006 guidelines. `tests/climate.spec.ts` plays the tracking and the page.

## The wallet

Every change to the farmer's money is kept in the **Wallet** (`src/wallet/model.ts`): tap the money on the farm's
HUD, the main menu, or *Climate › Land & pay › Every payment, in your wallet*. Address `#/wallet/history`.

- **History**: every payment in and out, newest first, with the farm day and the balance after it; chips filter by kind
  (climate, water, harvests, market stall, animals, power, tractor, farm work, shop, business, rewards, security).
- **Climate payments**: every climate payment ever paid, with the credits it paid for and the wallet after it, a bar
  chart of the latest, and the totals. The daily payment (see [Climate tracking](#climate-tracking)) is written here by
  `settleDays` itself (`addEntry`), so it keeps its own words; the water credits too.
- **Summary**: money in and out by kind, all time (never trimmed; the history keeps the last 400 entries).

Any other change of money is written by `trackWallet` after each action, labelled by what the player did, so nothing
is missed and nothing counted twice: the wallet's entries always add up to the change in money.

**Fixed with it**: at midnight the *Good morning* dialogs (day 2, a night's news) used to open on top of whatever page
was up, the Climate page included, and block it. A morning's news now waits until the player is back on the farm
(`MORNING_KINDS` in `src/state.ts`; opening or closing a page keeps it).

## The power system

Over the **first 7 farm days** the farmer builds a solar power system in the **power yard**, top right of the farm
above the pond (where the mini forest was; the forest is now bottom right). One part a day, each with its own
mini-game; a part can go in on its day or any day after, in order (`src/power/config.ts` `POWER_STEPS`). Each part
has five options to choose from before its mini-game (see [Options that open as you grow](#options-that-open-as-you-grow));
the table gives the default ones:

| Day | Part | Mini-game |
| --- | --- | --- |
| 1 | Solar panels (3 kW) | tilt the frame to face the sun (a slider and a power meter) |
| 2 | Inverter | connect each cable to its terminal |
| 3 | Battery bank (10 kWh) | the connections in the safe order |
| 4 | Farm lights (poles along the paths, the pen, the coop) | put a light on every dark spot before the time runs out |
| 5 | Generator (5 kVA) | pull-start it when the needle is in the green |
| 6 | Diesel tank (200 L, filled with 120 L) | hold to pour, let go at the line |
| 7 | Switch on | switch on what it powers without overloading it |

A part put in well (its score) works better. The main menu, the day's build task on the farm, or the yard's gate opens the
page (`#/power/build`): *Build*, *Today* (sun, need, battery, diesel; switch each load on or off; buy diesel),
*Impact*, *History*. Each morning of days 1–7 says what goes in today, and a chip on the HUD (bottom left) takes the
player there.

**Once it is on**, every farm day it runs (`runDay` in `src/power/model.ts`): the panels make power by the season's sun,
the battery carries it into the night, the generator burns diesel for what is short. What it powers reaches the rest
of the game:

- **Water**: the solar pump lifts up to 600 L a day from the pond into the tank, and drips Farms 7 and 8 with 60% of the
  water (they need no watering by hand).
- **Climate**: clean power counts as credits (0.7 kg CO₂ avoided a kWh), paid with the day's climate payment; the
  generator's diesel counts as emissions. Pumping and cooking count as solar (`hasSolar`).
- **Profit**: chilled milk sells for 20% more (the milk cooler), lit coops lay 10% more eggs, the cold room keeps
  fresh produce from wilting and adds 10% at the stall; the savings on bills are on the page.
- **Tractor**: the workshop cuts servicing and repairs by 30%; the diesel tank refuels the tractor without a trip to town.
- **Security**: lit farm lights count as the *solar security light*.

## Night mode

**Settings › Display › Night mode**: *Auto* (night on the farm from 7 pm to 6 am by the phone's clock), *Day* or
*Night*. At night the sky goes dark blue, the moon lights the farm, the farmer carries a lantern, the farmhouse windows
glow, and once the power system's lights are lit the poles light the paths (`setNight`, `setPower` in the engine).
A chip at the bottom says *Night · lights on* or *off*.

## The tractor screen

The **Hire** spot is now the **Train** spot. Walking to it, or tapping **TRACTOR** on the HUD, opens the tractor screen
(`src/tractor/TractorHub.tsx`, numbers in `hub.ts`) in the **tractor yard** (`src/tractor/Yard.tsx`): a small place
seen from above that the farmer walks round. Tap the ground to walk there (or use the arrow keys / WASD); tap a station
to walk to it and open it; standing on a station's pad shows a **▶ Play** button (Enter works too). Each station
shows its best stars on its pad and a red **!** when it needs the farmer (a lesson to pass, today's walk-round, a
worn tractor, a low tank, a farm waiting to be ploughed). A mechanic by the workbench calls out tips, and **Hop on**
in the corner drives straight away. The yard opens on a section instead when one is urgent (Repair, Refuel, Hire).
The sections are still listed down the left, and **← Back to the yard** walks back out; a finished mini-game also
returns to the yard. Each station is a mini-game:

| Section | Mini-game | Does |
| --- | --- | --- |
| Yard | walk round the yard to the stations | — |
| Train | steer round the cones down the practice lane | experience: each driver level (60, 150, 300) drives 5% faster |
| Learn | three lessons of questions (parts, safety, soil) | points; the why after each answer |
| Safety check | the walk-round in the right order | points |
| Service | tap each service point in order | condition +10 to +35 (KSh 1,500; 30% less with workshop power) |
| Repair | fix the three faults, leave the parts that are fine | condition back to 60–100% (KSh 6,000; 30% less with power) |
| Refuel | hold to pour without spilling | diesel from the farm's tank, or the pump in town |
| Hire | — | the oxen or the tractor plough the farms whose plan hires them (as the Hire spot did) |
| Drive | — | walk to the tractor and hop on (the type and tool as before) |

The tractor wears as it works (0.15 a plot driven, more on a drive or a business day) and burns diesel; under 30% it
drives 20% slower, at 0% or with an empty tank it will not start (the screen opens on Repair or Refuel).

## The coop and the cow shed

The **chicken coop** is upgraded from **day 1** (a simple coop, then the raised coop with mesh) and the **cow shed**
from **day 3** (a roofed shed, then a zero-grazing unit), both by the player, with a hammer mini-game
(*Animals › Coop* and *Animals › Cow shed*, or walking to the coop or the pen). The cow shed adds milk (+10% / +25%),
cuts cow diseases and cow theft, and its gutters catch rain into the tank every day (`SHEDS` in
`src/livestock/config.ts`). Both stand on the 3D farm once built.

## The shed's options

Standing on the **Seeds**, **Fertilizer** or **Sprayer** spot, a button shows under the farmer: *Seeds ▾ Choose an
option*. It lists every option (what it is, what it is best for, its cost); the one chosen goes on every farm that can
still take it (not yet sown, spread or sprayed), is kept for the next planting (`prefs`), and is picked up
(`shedChoose` in `src/state.ts`).

## Options that open as you grow

Every buying decision offers several options, up to five, but not all at once, so the first days teach one choice at
a time and the farm's mechanics come in slowly (`src/unlock/model.ts`):

| When | Options open in each list |
| --- | --- |
| Day 1 | the first 2 |
| Day 2, or Level 2 reached sooner | the first 3 |
| Day 3, or Level 3 reached sooner | all of them (up to 5) |

An option's place in its list is its tier, so every list runs from the simplest choice to the most advanced. A locked
option still shows, greyed with a dashed border and a lock (*🔒 Opens on day 3 or at Level 3*), and a line over the
list says how many are open (*2 of 5 options open · more on day 2 or at Level 2*). The rules refuse a locked option
too, with the same words, so nothing gets round the lock. The days are farm days (`lifeOf(s.life).day`); the levels
are the certification levels in My Progress. `UNLOCK` holds the tiers to tune.

| Buying decision | Options, simplest first (day 1 · day 2 · day 3) |
| --- | --- |
| Solar panels | 1.5 kW kit, 3 kW array · second-hand 3 kW · 5 kW array, 3 kW bifacial on a tracker |
| Inverter | modified sine 3 kW, pure sine 3 kW · hybrid MPPT 3 kW · hybrid MPPT 5 kW, microinverters |
| Battery bank | lead-acid 5 kWh, lithium 10 kWh · lithium 5 kWh · lead-acid 20 kWh, lithium 15 kWh |
| Farm lights | LED bulbs, lights on poles · motion floodlights · stand-alone solar lights, smart lights on a timer |
| Generator | diesel 2.5 kVA, diesel 5 kVA · second-hand 5 kVA · inverter generator 4 kVA, biogas generator |
| Diesel tank | 100 L drum, 200 L locked tank · 300 L bunded tank · 500 L tank, 1,000 L tank and pump |
| Chicken coop | night shelter, simple coop · movable coop · raised coop with mesh, layer house |
| Cow shed (from day 3) | shade roof, roofed shed, shed with stalls and mats, zero-grazing unit, barn with a milking parlour |
| Seed | long-season hybrid, saved seed · drought-tolerant · open-pollinated, hybrid + beans, close spacing |
| Fertilizer | DAP at planting, DAP + CAN · manure · none (control), double dose |
| Sprayer | knapsack, mist blower · battery knapsack · boom sprayer, check strip |
| Tractor type | compact, standard · walking (two-wheel) · large, 4WD |
| Farm plan: land prep, pest control, water | the same rule, in each step's order (date and harvest timing are open) |
| Row strategies | *as the farm plan* and the next · the third · the rest |
| Buying water | piped water, a bowser · donkey cart · neighbour's borehole, big bowser |
| Crop cover | basic (50%), standard (70%) · drought index (80% of drought) · group cover, full cover (90%) |
| Shop: tanks | small, medium · large · 20,000 L, water pan (partners' products are never locked) |
| Shop: fertilizer, equipment | balanced NPK, manure · nitrogen · phosphorus, potassium; hoe, spade · wheelbarrow · the rest |
| Storage | home storage, hermetic bags · co-op warehouse · metal silo, cold storage |
| Security (from day 2) | community watch, padlocks · night watchman · the other seven |

**What the options change.** Each power option carries its own numbers (`PartOption` in `src/power/config.ts`): the
panels' kW, the most kW an inverter can carry (panels beyond it are wasted: a 5 kW array needs the 5 kW inverter),
the battery's usable share (lead-acid gives half), the lights' load, eggs and whether they keep thieves off, the
generator's kWh a litre (biogas burns the cows' manure first), the diesel tank's size and first fill. The chosen
option is kept with the part (`parts[id].option`); a save from before keeps the part it had. Coops and sheds keep
their upgrade rule (by price, paying the difference) and show on the 3D farm as the model they look like (`look`).
Crop cover's plans set what it pays back, of which shocks, and its premium.

Seeds already had six options; the sixth (close spacing, which shows why spacing matters) opens with the others on
day 3. Security's ten measures are add-ons, not alternatives, so they open by the same rule rather than being cut to
five. Farms 7 and 8 open on day 4, when every crop is open.

## The market stall

Some of every harvest goes into the **store**: 3% of each six-farm harvest (maize, sukuma wiki), and everything Farms 7
and 8 grow. The **Sell** stall (when the six farms' harvest is not waiting to be sold) opens the market stall
(`#/market`): up to **25 kg a day** in all, at a price a kg for each crop. Fresh produce wilts 4% a night in a store
without the power system's cold room. `src/produce/model.ts`.

## Farms 7 and 8

Two new farms, 4 × 3 tiles, at the bottom of the farm either side of the market path, open **after day 3** (from farm
day 4: `GARDEN.openDay`). At a farm's sign a button says what it needs: *Plant*, *Water*, *Harvest*. Crops
(`src/garden/model.ts`): **spinach** (cut every 2 days), **tomatoes**, **French beans**, **onions**, **watermelon** and a
**fruit orchard** (avocado and mango: fruit every 3 days, and the trees store carbon). Planting is a mini-game (tap
every planting hole), and so is the harvest (pick the ripe ones, leave the green ones). An unwatered day costs 15% of
the crop's health, unless the solar drip is on. The harvest goes into the store for the market stall.

## Mini-games

`src/minigames/MiniGame.tsx`: one frame (what to do, the game, then stars and a score from 0 to 1), nine games:
**timing** (press in the green), **hold** (hold to fill, let go at the line), **tap** (tap the right spots before the
time runs out, in order or not, decoys cost points), **wires**, **order**, **quiz**, **aim**, **steer** and
**balance**. Every game is played with taps or a held press (keyboard too).

**The game layer** (`src/minigames/fun.tsx`) is shared by every quiz, form and test in the game:

- **A coach** (in a work cap) introduces each mini-game in a speech bubble, thinks while a question is open, smiles
  at a right answer, winces at a wrong one and cheers a three-star result.
- **Pictures for answers**: `iconFor(text)` picks a picture for any answer or step from its words, so every list of
  options gets one without new data. The tractor lessons have drawn pictures for each question (`QuizArt`: the PTO
  shaft, the linkage, the radiator, a slope, getting off, one rider, wet soil, deep ploughing, tyre pressure).
- **Quiz**: a picture beside each question, answers as picture cards (A, B, C; keys 1–3 work), the answers shuffled
  so the right one is not always first, a ⚡ clock for a quick answer, a 🔥 streak, confetti and a float-up for a
  right answer, a shake for a wrong one. The score is still the share answered right.
- **Order**: each step has a picture, and a tractor rolls along a road of numbered checkpoints to the flag as the
  steps go in; a wrong step stalls it.
- **Results**: the stars pop in one by one, with confetti for two or three stars.
- **The care screens** (the spray kit and product at the shed, choosing the fix, the tractor's hitch and fill-up)
  give each answer a picture, shake a wrong one and throw confetti for the right one; a right crop call in field
  rounds and the first review throws confetti too; the "on your own farm?" question has the coach and picture
  answers.

## The tractor game: the mini farm

**Tractor game** in the main menu (address `#/tractor-game`): a small farm seen from above, with **five rocks, three
trees and four holes** on it, placed fresh every game. The player drives the tractor and plough over the farm and
has **30 seconds** to plough it.

- Tap and hold where the tractor should go (or steer with the arrow keys / WASD). The plough turns a 40-pixel strip
  behind the tractor; the land under the rocks, trees and holes doesn't count.
- **Plough 80% of the land before the clock runs out to win.** Running out of time loses.
- **A rock or a tree** stops the tractor and costs **3 seconds** off the clock.
- **A hole** swallows the tractor: the game is lost on the spot.
- A win scores stars by the time left (3 stars with 10 s or more, 2 with 5 s or more, else 1). The best time left
  is kept on the phone. The main menu pauses the clock.

Every thing on the farm sits clear of the gate, the fence and every other thing, with room for the tractor to pass
between. A tidy row-by-row drive on an open farm finishes with about 10 seconds to spare. All the numbers are in
`MINI_FARM` in `src/minifarm/sim.ts`. Events: `minifarm_start`, `minifarm_done {outcome, share, left, bumps, stars}`.
Tests: `tests/minifarm-sim.spec.ts` (the rules) and `tests/minifarm.spec.ts` (the page).

## The first session on the 3D farm

The first session (creating the farmer, the story, the walk to the maize, the checks) is played on a **picture of the
3D farm itself**, taken from above on the first day (`public/assets/bg-world.webp` and `@2x`; `FarmWorld.setOverview`
frames it). The walk routes, the beds, the mist and the labels are points of the 3D farm projected onto the picture
(`src/first/Village.tsx`): the maize is Farm 1, the sukuma wiki Farm 2, the tomatoes Farm 8. To take the picture
again, run the game with `?dev`, set up the first day and call `__limaWorld.setOverview({ x: -1, z: 1, h: 31, back: 19,
capture: true })`.

## Achievements, the daily streak and certificates

A reason to come back every day, and something won in every part of the game. Everything is in
`src/achievements/model.ts` (the badges, what they pay, the streak's rewards, which certificates are given);
`src/achievements/track.ts` watches each action, as climate tracking does; the page is `src/screens/Achievements.tsx`.

- **The daily streak.** A day counts once the player finishes something on it (any action that plays a happy
  sound). Days in a row build the streak; a whole day missed starts it again. The day turns at the player's own
  midnight. Each day played has a reward to claim: 200 coins and 10 points on day 1, growing to 1,400 coins and
  70 points from day 7 on (`STREAK_REWARD`).
- **Badges** (63), by part of the game: *Every day*, *Farm Moja*, *Six farms*, *Field rounds*, *Tractor*,
  *Tractor business*, *Climate*. Eleven **day-one badges** are easy firsts, one or two in each part (finish the first
  crop checks, do a farming task, buy in the Shop, collect the milk or eggs, finish the daily tidy-up, read a bed right, plant the farms, read
  a daily check right, finish a tractor drive, run a business day, earn a climate credit). The rest come in
  bronze, silver and gold (a 3-, 7- and 30-day streak; 10, 50 and 150 farming tasks; 3, 10 and 30 drives…), plus
  *Tractor owner*. Badges pay 25 (day one), 50, 100 or 250 points, and 150 for a special one.
- **Rewards wait to be claimed** on the Achievements page (*Claim*, or *Claim all*): an action never changes coins
  or points by itself, so every other rule in the game adds up as before.
- **Certificates**, kept on the page with the farmer's name and the date: one for every 7 days played (with what
  was done that week), one for each streak of 3, 7, 14, 30, 60 and 100 days, and a bronze, silver or gold
  certificate for a part of the game whose every badge of that tier is won.
- **On screen:** the badges, the streak and the certificates are part of **My Progress** (next section), opened
  from the PROGRESS button. A pop-up announces each badge, certificate, level and new day. *Today* has the streak,
  the last seven days, today's reward and the day-one goals; *Badges* filters by part of the game, closest to done
  first; *Certificates* keeps every certificate.
- Counting starts with the first action after this update; badges that read what the save already holds
  (seasons sold, cycles harvested, farmers helped, level, climate credits) are won at once. Badges open once the
  first crop checks are done.

## My Progress: certification levels and learning credits

The first days and weeks of play laid out as a learning journey, behind the **PROGRESS** button on the farm
(3D farm: under Climate; classic farm: under the farm's name). The button shows the certification level in a ring
that fills toward the next level, the streak, and a red dot while a reward waits. Everything a designer might tune
is in `src/progress/model.ts`; the page is `src/screens/Achievements.tsx`.
The page's left side also holds **Animals** and **Security** (they left the farm's HUD), each with the badge its old
button had. Beside the money at the top right of the farm, a small **Day X/30** button counts the day out of the
full farming period (`FARM_PERIOD_DAYS` in `src/livestock/model.ts`) and opens the journey.

- **Modules** (8), one for each part of the game plus *Courses*: Farm Moja, Field rounds, Six farms, Tractor,
  Tractor business, Climate, Every day, Courses. Every badge won pays **learning credits** into its module
  (day-one 1, bronze 2, silver 4, gold 8, special 4), and each farmer course booked in Training pays 5 into Courses
  (up to four). A module is *Not started*, *Started*, *Practising* (25% of its credits), *Proficient* (50%) or
  *Mastered* (100%). Adding a module is one more entry in `MODULES`.
- **Certification levels** (6), each opening on a day of play so they arrive over the first weeks, not at once:

  | Level | Opens | Credits | Modules |
  | --- | --- | --- | --- |
  | 1 · Farm Starter | Day 1 | 3 | 2 started |
  | 2 · Farm Apprentice | Day 2 | 10 | 4 started |
  | 3 · Smart Farmer | Day 4 | 22 | 6 started |
  | 4 · Certified Smart Farmer | Week 1 (day 7) | 40 | 3 practising |
  | 5 · Advanced Smart Farmer | Week 2 (day 14) | 75 | 3 proficient |
  | 6 · Master Farmer | Week 4 (day 28) | 130 | 6 proficient |

  "Day" is days played (the streak's count of days with something done), so a level waits for its day however
  many credits are earned early, and levels come in order. Reaching one gives a **certificate** (kept with the
  others, co-signed by the certification partner) and a reward to claim: KSh 1,000 and 50 points at Level 1, up to
  KSh 15,000 and 750 points at Level 6 (shown in the player's own currency). Rewards wait to be claimed, as badges' do.
- **The page:** *Journey* (the level now, credits, days played, modules started; the six levels on a path, each
  reached, next or locked until its day; what the next level still needs), *Modules* (each module's stage and
  credits; tap one to go and play it), then *Today*, *Badges* and *Certificates*. Main menu → *My Progress*.

## Partners: billboards, branded products and offers

Places across the game a partner brand can appear, and a page for the offers. The whole set-up is one table:
`src/partners/data.ts` lists the **brands** and the **slots** (every place a brand can appear) with the brand on
each. To sign a partner, add or edit its brand and put its id on the slots it bought; no screen changes.

| Slot | Where | Brand now |
| --- | --- | --- |
| Billboards (4) | 3D farm: two in the yard either side of the farmhouse path, one by the seed shed, one between Farm 8 and the mini forest; walk up to one and a *See offer* tag appears | Lima Fertilizer, Lima Insurance, Lima Seeds, Lima Tanks |
| Tractor livery | 3D farm: the partner's name on the bonnet and both sides of the tractor | Hello Tractor |
| Market stall awning | 3D farm | *Available* |
| Roadside sign | Classic farm: each partner in turn, every 6 seconds (or one brand, if it buys the slot) | All partners |
| Branded fertilizer | Shop › Buy Fertilizer: *Lima NPK*, 10% under the plain NPK; it does the NPK task's job | Lima Fertilizer |
| Branded tank | Shop › Buy Tank: a 5,000 L tank | Lima Tanks |
| Branded tool | Shop › Buy Equipment | *Available* |
| Voucher sponsors | Rewards & Discounts Hub: "with <brand>" on each voucher | Lima Fertilizer, Lima Seeds, Hello Tractor, Lima Solar, Lima Credit |
| Loan quotes | Loan calculator and quote | Lima Credit |
| Courses | Training | Lima Training |
| Certification | My Progress: the journey, the modules and every certificate | Lima Training |
| Crop cover | Climate › Shocks | Lima Insurance |
| Progress sponsor | The PROGRESS button | Lima Training |

- **The billboards** (`BILLBOARDS` in `src/world/engine.ts`, built by `makeBillboard` and `billboardTexture` in
  `src/world/models.ts`) are premium roadside boards: one gunmetal pole on a concrete footing, a dark cabinet in a
  gold frame with a *★ Partner ★* plaque on top, a catwalk with a rail and three lamps, and the head tilted back a
  little so the face reads from the farm camera. The face is the brand's colours in a deep gradient with a sheen:
  its mark in a ringed medallion, the category, name and tagline, the offer in a pill (*10% off Lima NPK*),
  and a foot bar (*Official TemoLima partner* · *Tap for the offer*). Every few seconds a band of light sweeps across
  each face; at night the lamps glow and the boards stay lit. Each board is turned a little toward the path, and
  only its pole blocks the farmer. The *See offer* tag over a board is dark glass with a gold rim and chip. The face
  is redrawn once the Poppins font has loaded.
- **Sample brands.** Hello Tractor is the game's tractor partner. Every other brand (Lima Fertilizer, Lima Seeds,
  Lima Tanks, Lima Credit, Lima Insurance, Lima Solar, Lima Training) is made up for the game
  (`sample: true`) and stands in until a real partner signs; no real company is named or implied.
- **The Partners page** (Main menu → *Partners & offers*; every billboard, sign and "with <brand>" line opens it at
  that brand, with its offer open): *Offers* lists each brand's offer (and a *Visit* link for brands with a web
  address); *Placements* lists every slot, its brand or *Available*, and how often it was seen and tapped.
- **Getting an offer.** *Get offer* opens a sheet with what the offer gives and where it is used; *Get this offer*
  takes it and shows the player's code (`offerCode()`: the brand's first letters and four from the farmer's name,
  so it needs nothing more in the save), which also goes into Messages. The sheet's button, and *Use it* on the card
  afterwards, go to where the offer is used (`offer.use.to`, a game address: the Shop's fertilizer or tank section,
  the Rewards hub, the Loan calculator, Climate › Shocks, My Progress or the Tractor business). Offers do not change
  prices in the game yet.
- **Engagement** (views and taps per slot) is counted on the device only, apart from the saved game
  (`src/partners/track.ts`): nothing is sent anywhere, and Reset progress does not clear it.
- **PARTNERS on the farm** opens the page too: on the 3D farm left of WATER (under PROGRESS), on the classic farm
  beside Shop. The page also opens before the farm does (`#/partners`), so a partner can visit without playing.
- **Partner with us** (`src/partners/catalogue.ts`): every way a brand, school or service could be part of TemoLima, for
  partners still to sign. 23 ways in five areas: *Farm inputs* (seed, fertilizer, crop protection, safety kit),
  *Tools & machines* (hardware, equipment, water tanks, solar, fuel), *Transport & market* (trucks, buyers, storage,
  millers, co-ops and booking apps), *Learning* (training courses, certificates, agronomists, a sponsored mission),
  *Money & climate* (loans, crop insurance, carbon partners, a weather service, telcos). Each card shows a status:
  *In the game now* (the moment exists; a brand goes onto it), *Small build* (a short new step adds the partner's
  part) or *New idea*. Tapping a card shows where players meet it, what the partner gets, who holds its placement
  today (from `SLOTS`), *+ Interested* and, once the farm is open, a button to the screen it is about. The rules every
  partner keeps are under the list: fair play, no personal data, advice checked by an agronomist.
- **Shortlist**: the ways tapped *Interested*, saved with the game (`partnerPicks`). *Copy the shortlist* puts it on
  the clipboard as text; set `VITE_PARTNER_EMAIL` at build time to add an *Email it to the TemoLima team* button.

## Farm words: info buttons and Farm basics

Many players have never farmed, so the game assumes nothing: a small blue **ⓘ** sits beside the name of almost every
fertilizer, spray, pest, seed, tool, machine and farm idea. Tapping it opens that word's card on top of the screen
(nothing is bought or chosen): **what it is**, **what it does**, **when and how** it is used, and a **take care**
line where there is a risk (the spray kit, glyphosate on a growing crop, seed touching DAP…). Related words are links
on the card, it can be read aloud, and *All farm words* opens the word's section.

| Where | The ⓘ explains |
| --- | --- |
| Seed, fertilizer and sprayer sheds, the inputs board, the six farms' plan | every seed, fertilizer (DAP, CAN, manure…) and sprayer |
| Shop and Farming steps | NPK, nitrogen, phosphorus, potassium, manure; tanks; hoe, spade, rake…; herbicides, fungicides, nematicides, insecticides |
| Spraying | the spray kit (gloves, mask, boots) and each product (emamectin benzoate, lambda-cyhalothrin, mancozeb, glyphosate…) |
| Choosing a fix | the fixes and the ways to do them (fungicide, neem spray, copper spray, urea, selective herbicide, mulch, drip line…) |
| Tractor screens and the tractor business | each tractor type, each implement (disc plough, harrow, ridger, planter, spreader, boom sprayer…) |
| Storage and value addition | hermetic bags, the cooperative warehouse, metal silo, cold storage, drying, processing, packaging |
| Animals | Napier grass, layers mash, coop litter, acaricide, vaccinations, deworming, the diseases, zero-grazing |
| Power | solar panels, inverters (pure and modified sine wave, MPPT, microinverters), lead-acid and lithium batteries, LED lights, generators, biogas, bunded tanks |

**Farm words** (main menu, or `#/farm-words/…`) lists all of them by section, with a search box.

**Farm basics** introduces the most basic words to a new player, in seven short lessons:

1. *Three words every farmer uses* (fertilizer, pesticide, herbicide): in a box on the first session's farm update,
   before the first check, with a *Learn more* button.
2. From day 2, one lesson a morning: feeding the crop (DAP, CAN, NPK, manure), protecting it (insecticide, fungicide,
   the spray kit, neem), weeds and herbicides, seeds and planting, tools and machines, water and the harvest. Each comes
   in the morning news and as a chip under the task card on the farm, until it is read; the chip catches up one lesson
   at a time if days are missed. All seven are on the Farm basics page.

Every word is one entry in `src/learn/glossary.ts` (for an agronomist to review: rates are typical Kenyan smallholder
advice, not a product label). An entry's `aka` names find it from any name in the game (`termFor`: the longest name in
a text wins; a name in capitals, like CAN, only matches in capitals), so a new product or tool with a known name gets
its ⓘ with no code change.

## Character art: retro anime

The characters are drawn in a **retro anime** style by default: flat cel colours with one hard, slightly purple
shadow tone, a purple-black ink outline, tall eyes with two highlights, hatched blush, screentone dots in the shadows
and an 80s cut-stripe sun behind the cast. It is one SVG kit in `src/art/anime.tsx`, so there is nothing extra to
download:

- **The player's farmer**, in all four looks (headwrap, cap, hi-top, headwrap), full length in the first session and
  the field rounds, and as a bust on the HUD, the look picker and the rewards hub.
- **The farming guide**, **the shopkeeper** and **Ojuok** (the rewards hub), replacing the Figma pictures.
- **The 3D farm**: the farmer and the animals use toon shading (three hard light steps) and an inverted-hull ink outline
  (`src/world/toon.ts`); the farmer gets a bigger head with a painted anime face and the look's headwear.

*Settings → Game → Character style → Original* brings back the original pictures and models.

## Design review mode

Open **`?review=1`** (or *Settings → Design review*) for a sandbox with a menu of every screen filled with
sample data: each first-session moment (including *1b · The story so far*), every Figma frame, and the added screens
(Settings, the farm world, Wakala's moments, plots and inputs, the six farms, field rounds and every Climate tab). Deep-link with
`?screen=<name>`, for example `?screen=Storage` or `?screen=3 · First review`. Review mode never touches the
player's saved game or events.

## Saving, events and privacy

- **Progress** saves on the device in `localStorage` (`lima-farming-game:v2`): farmer, first-session progress,
  coins, points, seasons. *Settings → Reset progress* erases it and starts again with a new farmer. Saves from
  before the first session existed keep their coins and play the first session once.
- **Events**: one per first-session moment, so drop-off can be measured — `create_shown`, `farmer_created`,
  `story_page`, `story_done`, `story_skipped`, `walk_start`, `first_move`, `shamba_reached`, `review_start`, `part_viewed`, `spot_found`, `call`,
  `review_failed`, `review_passed`, `farm_opened`, `session_close`; the field-round events (`round_start`,
  `round_part_viewed`, `round_call`); `tractor_ride` (getting on the tractor, with its type and tool); and the
  farm-world events from Wakala Agent (see [From Wakala Agent](#from-wakala-agent)). Each has a
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
- Animations respect *reduce motion*, from the phone or from *Settings → Display*.
- *Settings → Display → Graphics → Low* turns off shadows and draws the 3D farm at 1× for the oldest phones.

**The 3D farm on a phone** (`tests/perf.spec.ts` measures it on a 740 × 340 phone screen at 3× and prints the numbers):

- Only the tiles that show are drawn: each kind of tile (crop stages, weeds, puddles…) is an instanced mesh packed
  with what is on the field and its count set to that, instead of all 120 tiles with the hidden ones moved away. A
  two-farm cycle went from about **515,000 triangles a frame to 61,000** (shadows included); the software renderer
  in the test drew **3× as many frames**.
- *Auto* graphics on a phone (a touch screen, a small screen, or 4 GB of memory or 4 cores or fewer) draws at up to
  1.5× pixels (2× on a computer), with a 1,024 shadow map and plain shadow edges (2,048 and soft on a computer), the
  shadows redrawn every other frame. *High* keeps the computer's picture on any device.
- A still farm is drawn about 30 times a second on a phone (60 while anything moves): a cooler phone and a longer
  battery. Nothing is drawn under a full-screen page.
- If frames still come slowly while the farmer moves (under about 25 a second, in the first minute), *Auto* steps
  down by itself: a computer to the phone picture, a phone to no shadows at 1×.
- Every shader is built while the farm opens, not on the first walk; a farm rebuilt (new art style or graphics)
  frees the old one's GPU memory.
- How a farm has fared and how its plots grow is worked out once per day, not on every tile the farmer works.
- The HUD re-renders only when the farmer or a sign moved on screen; the game is saved after a short pause (and at
  once when the phone hides the game), not on every tile.
- Design review's sample screens are a separate chunk: players do not build them at start (about 25 ms on a
  computer, several times that on a phone). The farm world is fetched in the background a few seconds after the
  game opens, so it is ready when the farm does. The Poppins font no longer holds up the first picture.
- **The tractor business and its drive minigame** (`tests/perf.spec.ts`, the CPU slowed 4× over the software
  renderer): the business is its own chunk (about 31 KB compressed, the five characters' pictures included), fetched
  when it opens; the brand fonts load only then. While the tractor drives a road leg on the map, its position is set
  straight on a composited element each frame (no React re-render, the SVG map underneath not repainted): about 18
  frames a second here. The ten-second drive draws one small canvas (420 × 224 or less, at 2×): the field's
  background is painted once, only the cells the implement just worked are repainted, and the clock and the count
  are written straight into the HUD, not through React state: about 23 frames a second here, with no long task
  over 140 ms. A real phone rasterises on its GPU, so both run far smoother there.
- A service worker (`public/sw.js`, published game only) keeps the game on the phone: a second visit opens without
  downloading it again, and the game plays on a weak signal. The page is fetched fresh when there is a connection,
  so an update shows at once.

## Tests

`npm test` runs the Playwright play-tests in `tests/` against the dev server, one at a time, on an 874 × 402 screen
(the 3D farm uses software WebGL, so no GPU is needed). Run `npx playwright install chromium`
once. To use a Chromium already on the machine instead: `LIMA_CHROMIUM=/path/to/chromium npm test`; to test a
running build: `LIMA_URL=http://…/ npm test`. The dev server's `?dev` hook (`src/dev/hook.ts`) lets a test jump to
a moment (`__lima.scenario('spray')`, from `src/trials/samples.ts`) and walk the farmer (`__limaWorld.walkTo`).
Some tests use no browser: they call the game's rules directly.

| File | What it plays |
| --- | --- |
| `first-session.spec.ts` | the story so far, the farm update, the first check read right and wrong, saving and *Reset progress* |
| `routes.spec.ts`, `nav.spec.ts` | every page by address with Back, Forward and reload; Back, Menu and Farm on every screen |
| `plots.spec.ts` | the first planting period (Clear and Plant a row at a time); one set of inputs per farm and the results by input |
| `care.spec.ts` | a world check with a wrong then right fix and the work by hand; a follow-up done and one missed; a spray job with the safety kit and product, walking past the fertilizer shed |
| `routine.spec.ts` | scheduled care: what a miss costs, its days, by hand (weeding, the stalk-borer spray, the top-dress) and the cultivator from the seat |
| `tractor-ride.spec.ts`, `tractor-sim.spec.ts`, `tractor.spec.ts` | the tractor's type and tool, fuel and the bonus; the hired tractor; the before-planting drive, on autopilot and steered |
| `business.spec.ts` | the tractor business: routes, Campbell, SER, counted acres, PAYG, and a day played through the screen |
| `climate.spec.ts` | the climate ledger: tasks, planting, diesel, selling, credits |
| `settings.spec.ts` | the Settings page |
| `tour.spec.ts` | the Wakala moments on a 740 × 340 touch screen, with screenshots in `test-results/tour/` |
| `perf.spec.ts` | start-up, the farm world's frame cost and draw calls, and the tractor business on a slow phone |
| `fixes.spec.ts` | the guide in the menu, and a walk that only passes a shed |
| `money.spec.ts`, `country.spec.ts`, `climate-pay.spec.ts` | sales, storage, drives and treatments paid once; money in the country's currency; 4-acre farms, land and climate credits paid each day |
| `phases.spec.ts`, `risk.spec.ts` | climate-smart row strategies and treatment choices; money at risk and the evidence log |
| `achievements.spec.ts`, `progress.spec.ts`, `success.spec.ts` | badges, the streak and certificates; My Progress and partners; the success dialogs, training and the loan quote |
| `frame.spec.ts` | every screen keeps its boxes and buttons inside the rounded frame |
| `unlock.spec.ts` | options that open as you grow: two on day 1, three on day 2, five on day 3 or Level 3, across every buying decision, and the power yard's picker |

They run on every pull request (`.github/workflows/tests.yml`), with one retry on CI; the report and screenshots are
kept with the run for 14 days.

## Assumptions and open decisions

- **Game balance** (task counts, yields, prices, point costs) is illustrative, not agronomic data.
- **Farming advice** in the game (e.g. ash or sand in the maize funnel for fall armyworm; watering at the
  roots in the cool of the morning) should be checked by an agronomist or extension officer.
- **Field-round advice** (ash or sand for armyworm, soapy water for aphids, top-dressing, drainage after floods, what to
  do after hail, when each crop is ready to pick) needs agronomist review, and so do the crop calendar (21 real days
  stand in for a whole season) and the rotation. Round points are illustrative.
- **TemoLima AI** is a rule-based stand-in that reads the season's numbers; it does not call an AI service.
- **Rewards** are saved in the game but nothing is sent to a partner; there is no redemption backend.
- **Missed checks** cost harvest on the six farms (see `DAMAGE` in `src/trials/model.ts`); a problem left unresolved
  now stays on its farm until it is dealt with, and costs at harvest what was at risk by then (`src/risk/config.ts`). In the everyday field
  rounds they still only show as a bed to look at again.
- **The six-farm model** (yields, problem odds, damage, prices) is illustrative and needs agronomist review before any
  pilot. Only maize is planned in it so far; beans, sukuma wiki and tomatoes would each need their own table. In the first
  planting period, **sukuma wiki borrows maize's yield and price** (bags, at maize prices) until an agronomist sets its own.
- **The story so far** uses illustrative numbers (KSh 38,000 spent, 14,500 earned) for a failed first season.
- **No two plans the same** is enforced; *one change per farm* is suggested, not enforced.
- **The 3D farm world** needs human play-testing on watering, spraying, drains, the goat, tractor/oxen hire,
  scheduled care, a full six-farm cycle and the daily (one-day-per-real-day) clock — only a two-farm guided cycle
  has been run so far.
- **Scheduled care** days and losses (weeding 10%, stalk borer 8%, DAP + CAN without its CAN growing like DAP) are
  proposed, for the agronomist's review. On the daily clock a job's two days are two real days: a player who skips
  both misses it.
- **Planting rows on different days** (Row 1 on day 1 … Row 4 on day 4, each row with its own care) is not decided:
  with six check days, the last row would have only two days of care before harvest.
- **Art styles**: the farm and UI are the painted Figma art; the first-session crops and the farmer are
  drawn flat in code.
- **Language**: English with a little Swahili (*Karibu*, *Twende*, shamba, sukuma wiki). Full Swahili is not done.
- **Messages** shows a reminder to check every bed; there is no inbox yet.
- The faint 5% pattern texture on the cream panels in Figma is omitted.
- **From Wakala Agent**, waiting on a decision: the fix lessons, products, follow-up days and Mama Achieng's lines
  need the agronomist's review; the proposed yield effects stay off until Gate A; only the before-planting tractor
  stage is played; a retried drive pays only for beating the farm's best; wrong fixes count in the farm's costs at
  harvest; fuel for the drive is
  free (the plan's hire price covers it); Wakala's photos are still to add.

---

Design: Figma file *29 Oct Farm Management App*. Code built with [Claude](https://claude.ai).
