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

Deep-link to any screen with `?screen=<name>`, e.g. `?screen=Storage` or `?screen=Shop · Equipments`.
On large screens a **Screen** picker below the game jumps between all Figma frames (hide it with `?picker=0`).

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
  App.tsx              stage scaling, modal routing, screen picker
  state.ts             game state (coins, water, XP, purchases, steps, choices) via useReducer
  data.ts              all copy, prices and item lists from the design
  assets.ts            image paths (all exported from Figma into public/assets)
  styles.css           design tokens (colours, gold button, cards, sidebar) and component styles
  components/          FarmScene (HUD + field), Modal shell + sidebars, Icons (inline SVG), ui helpers
  screens/             Catalog (Shop, Farming Steps), Journey (sale → storage → value → outcome, rewards)
design-refs/           PNG renders of every Figma frame, for visual comparison
```

## What is interactive

- **Farm**: tap the spinach plot to select *Farm Moja* (Info, Farm, Upgrade, Harvest actions); tap the maize
  plot for harvest timing and the tomatoes for harvest info. *Milk now* and *Harvest eggs* collect coins once.
  *Plant now* and the sprout bubbles open Planting; *Next Task* rows open the matching farming step.
- **Shop**: four tabs. Sell Food sells a bag (stock counts go down, coins go up); other tabs buy items.
- **Farming Steps**: six tabs; paying for every task in a step adds the green check in the sidebar.
  The Water tab has a working "water amount" field.
- **Harvest flow**: Harvest timing → Sale of produce (editable prices, live profit) → Storage → Value
  Addition → Select Process → Outcome comparison.
- **Outcome comparison**: switch between Farm 1–6; *Lima AI Tool* answers from the selected farm's data.
- **Rewards & Discounts Hub**: redeem vouchers. The coin sack (top right) opens it; the avatar opens results.
- Escape or the red ✕ closes any modal.

## Assumptions to review

- The HUD's gold meter shows coins in thousands (starts at 5 = 5,000 coins) and the blue meter shows water
  in thousands of litres (20). The design shows these numbers without labels.
- The design only details Farm 1 in *Outcome comparison*; Farms 2–6 use sample data in `data.ts`.
- *Lima AI Tool* is a rule-based stand-in that reads the farm's data; it does not call an AI service.
- Sale profit uses an illustrative formula, `(market − farmgate) × kg ÷ 6`, which reproduces the design's
  20/bag; replace it with the real pricing model.
- Settings and Messages show a "coming soon" toast; the design has no frames for them.
- Value Addition reuses the rewards clock icon for "Time".
- The faint 5% pattern texture on the cream panels is omitted.
- The farm background is exported at 1× (874 × 402); most other art is 2×.
