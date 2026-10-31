# Lima Farming Game

A working React + TypeScript build of the Figma file **"29 Oct Farm Management App"**
(`dvRxEJtTy8rGBPIVmCLb4E`, section *Farm game*). All 22 frames are implemented as one playable app.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
```

Requires Node 18+. No other services are needed; everything runs in the browser.

Pushing to `main` builds the site and deploys it to GitHub Pages (`.github/workflows/deploy.yml`).

Progress saves in the browser (`localStorage`, key `lima-farming-game:v2`). **Settings → Reset progress** clears it.

**Design review:** open `?review=1` (or Settings → Design review) for a sandbox with a menu of every Figma frame
filled with sample data. Deep-link with `?screen=<name>`, e.g. `?screen=Storage`. Review mode never saves.

## How the design maps to code

The design is a landscape phone game (874 × 402). The app renders on a fixed 874 × 402 stage that
scales to fit the window, so every position matches the Figma frames.

| Figma section | Frames | Code |
| --- | --- | --- |
| Game Design | Game (×3 variants), Food, Fertilizer, Water tanks, Equipments | `components/FarmScene.tsx`, `screens/Catalog.tsx` → `ShopModal` |
| New Design | Land Prep (+ completed), Planting, Fertilizer, Pesticides, Water, Harvest, Sale of produce, Info | `screens/Catalog.tsx` → `StepsModal`; `screens/Journey.tsx` → `SaleModal`, `InfoModal` |
| New features | Storage, Outcome comparison, Real world reward (Harvest timing), Reward hub, Value addition, Preview (Select Process) | `screens/Journey.tsx` |

```
src/
  App.tsx              stage scaling, modal routing, first-run welcome, review picker
  state.ts             game state and season rules (health, yield, sale maths), saved to localStorage
  data.ts              all copy, prices and item lists from the design
  assets.ts            image paths (all exported from Figma into public/assets)
  styles.css           design tokens (colours, gold button, cards, sidebar) and component styles
  components/          FarmScene (HUD + field), Modal shell + sidebars, Icons (inline SVG), ui helpers
  screens/             Catalog (Shop, Farming Steps), Journey (timing → sale → storage → value → results, rewards), Meta (Welcome, Settings)
design-refs/           PNG renders of every Figma frame, for visual comparison
```

## The first session

A new player never sees the farm first. They:

1. **Create a farmer**: name (or tap Wanjiku, Otieno or Chebet) and one of four looks. Saved at once.
2. **Walk to their shamba**: tap or drag on the path; the rest of the village is under mist.
3. **Review the shamba** (the aha moment): *Look* at four pictures (crop, pests & disease, soil & water,
   layout; tap to zoom) → *Spot* the rows that look wrong → *Judge* (healthy, needs water, pests,
   needs fertiliser) → *Result*. Right: the rows light up, the farmer cheers by name and the maize recovers.
   Wrong: the clue they missed is circled and they walk to the lower shamba to try again.
4. **The village opens**: the mist lifts, neighbours' shambas appear, and Mama Achieng's beans need a
   review with fewer hints. The session ends on a reason to come back, then opens the farm.

Passing the first review marks onboarding done. Code is in `src/first/`:

| File | What it does |
| --- | --- |
| `data.ts` | Every shamba review as data (crop, condition, problem rows, right call, captions, clue, retry). Add a review by adding an entry. |
| `art.tsx` | Crops, soil, close-ups, field, farmer and village pieces drawn in SVG from that data, so the pictures carry the information and cost almost nothing to download. |
| `Review.tsx` | The one review system: Look → Spot → Judge → Result. |
| `Village.tsx` | The map and tap-to-walk along fixed paths. |
| `Create.tsx`, `FirstSession.tsx` | Farmer creation and the order of moments. |
| `track.ts` | Event log: `create_shown`, `farmer_created`, `walk_start`, `first_move`, `shamba_reached`, `review_start`, `part_viewed`, `spot_found`, `call`, `review_failed`, `review_passed`, `village_unlocked`, `session_close`. Kept on the device (`lima-events`, last 300) and sent with `sendBeacon` to `VITE_EVENTS_URL` if set at build time. |

Design review has every first-session moment under **First session** in the `?review=1` menu.

## How a season plays

One season of maize on *Farm Moja*, from first tap to results:

1. After the first session the farm shows **Now : Land prep**; Settings → *How the farm works* explains the season.
2. **Farming Steps** run in order: Land prep → Planting → Fertilizer → Pesticides → Water → Harvest.
   Only the current step is open; later ones are locked, finished ones are read-only. Each task costs coins
   (or is free if you bought the input in the Shop) and shows a one-line agronomy tip. *Finish* moves the
   calendar on by that step's days; *Skip* is allowed but scores 0 for that step.
3. **Crop health** is the average of the growing steps' scores (tasks done ÷ recommended). It sets expected
   bags and quality, shown in Info and Harvest timing.
4. **Harvest timing**: harvest now, wait 2 days (best) or wait a week (lower quality).
5. **Sale → Storage → Value addition → Select process**: prices are editable; storage trades cost per bag
   against bags lost; processing raises the price. *Confirm and sell* pays out coins and points.
6. **Season results** compares seasons, lists the three steps that cost you most, and Lima AI explains the
   result from your own numbers. *Start season N+1* resets the field and keeps coins, points and history.

Points: +100 × score per finished step, +5 per bag sold. Rewards cost 800 or 1,500 points; play-time counts
while the tab is visible. Milk and eggs can be collected once per day. The farm always shows **Now : <task>**
and a bubble on the field for the current task.

## Assumptions to review

- Game balance (task counts, yields, prices, point costs) lives in `data.ts` → `STEP_META`, `HARVEST_EFFECT`,
  `STORAGE`, `PROCESSES`, `REWARDS` and in `state.ts` → `expectedHarvest`, `saleQuote`. The numbers are
  illustrative, not agronomic data; have an agronomist check them.
- *Lima AI Tool* is a rule-based stand-in that reads the season's data; it does not call an AI service.
- Rewards are saved in the game but nothing is sent to a partner; there is no redemption backend.
- Messages shows the reminder from the first session (the bean shamba to check); there is no inbox yet.
- The first session is drawn in a flat style in code, not the painted style of the Figma farm art.
- The HUD meters show coins and litres of water; the design shows these numbers without labels.
- The faint 5% pattern texture on the cream panels is omitted.
- The farm background is exported at 1× (874 × 402); most other art is 2×.
