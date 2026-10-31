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

## How a season plays

One season of maize on *Farm Moja*, from first tap to results:

1. **Welcome** (first run only) explains the goal, then opens Land prep.
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
- Messages shows "No messages yet"; the design has no frame for it.
- The HUD meters show coins and litres of water; the design shows these numbers without labels.
- The faint 5% pattern texture on the cream panels is omitted.
- The farm background is exported at 1× (874 × 402); most other art is 2×.
