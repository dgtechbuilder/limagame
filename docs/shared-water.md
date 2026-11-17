# Shared water source: the catchment node

A design for water that a farm draws from **alongside its neighbours**, so a player learns that water used on one
farm is water a neighbour doesn't get. It is built and playable (Climate › Water, right-hand column); every number is
in `src/water/config.ts` (`WATER.catchment`) and the rules are in `src/water/model.ts` (`damDay`).

## What it is

One node, **Ewaso dam**: a small dam fed by the rain on the land around it, shared by the player's six farms and four
neighbours (three households and the school garden).

| | |
| --- | --- |
| Capacity | 6,000,000 L (starts at 3,600,000) |
| Inflow | the season's rain (L/m² a day, from the six farms' forecast) × 220,000 m² of land draining into it × 50% runoff |
| Player's draw | the six farms' plans: each farm's watering (L/m² a week on top of the rain) × its 16,187 m², a day |
| Neighbours' draw | fixed by season, e.g. Ole Sankale 90,000 L a day in a dry season, 25,000 in a wet one |

The farm's own **tank** (roof rain, piped water, a bowser) is separate: it serves the house, the animals and the work by
hand. The dam serves irrigation.

## A day at the dam

1. Rain flows in (capped at the dam's capacity).
2. Everyone asks for their draw.
3. **Plenty:** everyone gets what they asked for.
4. **Rationed** (the dam under 25% full, or more asked than there is): every household gets the same *share* of what it
   asked for, keeping a 5% reserve in the dam.
5. The player's **draw policy** decides how much they take when rationed:
   - *Take what the plans need*: the full rationed share.
   - *Take a fair share*: no more than one household's part of what is left (dam ÷ 5 households).

## What it changes

- **The harvest.** Each farm's watering factor at harvest uses the share of its planned irrigation the dam actually
  delivered over the cycle (`Trial.delivered`). A dry season with six thirsty plans and a fair-share policy means less
  water on the crop, and a smaller harvest.
- **Water credits.** A rationed day drawn fairly earns +2 water credits (`fairBonus`), on top of the credits for using
  less than the farm's baseline from the tank.
- **Crop cover.** Drawing a fair share takes 5% off the premium (`WATER.cover.fairShare`), next to a tank at least half
  full and rows that keep water in the soil (mulch, zai pits, tied ridges, morning watering, drought-tolerant seed).
- **Evidence.** Choosing the fair-share policy is logged (`water-policy`) and can lead to the "have you tried this on
  your own farm?" question about sharing water.

## The trade-off it teaches

Taking everything protects this season's harvest but empties the dam for everyone, sooner. Sharing fairly costs some
yield in a dry season and earns credits, cheaper cover and the neighbours' water. Climate-smart practices on the rows
(mulch, zai pits, drought-tolerant seed) cut how much the crop suffers from the smaller share: they are how a player
gets out of the dilemma.

## Next steps (not built)

- Real neighbours: other players in the same programme (cohort tag) drawing from one dam on a server, instead of the
  four simulated households. The data shape (`damDay`: inflow, each household's want and got) is ready for it.
- A water-users' association meeting: agree a rota or a cap each season, with a vote.
- The dam silting up when the land around it is farmed bare (link to soil health), and a desilting work day.
- Numbers to confirm with the climate-smart agriculture experts: catchment size, runoff, the neighbours' use, the
  ration rule and the bonus.
