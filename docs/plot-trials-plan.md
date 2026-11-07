# Plan: four mini plots per farm, and learning by using each input

Written 7 Nov 2026. Request: every farm gets 4 mini plots (6 farms × 4 = 24 plots); the tractor can be used at any
point, with the tractor type and tool chosen at the tractor and a tool picker that says what each tool is for; seed,
fertilizer and sprayer pickers with a choice for each plot; each input used on only one plot of a farm, so the player
compares them side by side and sees the results of what they chose.

## How it teaches

A real on-farm trial: strips side by side under the same weather, the same problems and the same care, each with a
different input. The player sows, feeds, sprays and drives each strip themselves, watches the strips grow
differently in the 3D farm, and at harvest the results are shown plot by plot, with what each choice did.

- **Plots.** Each farm's 4 columns of tiles are Plots A to D (left to right, 5 tiles each). Thin lines and A–D
  letters mark them in the 3D farm; the crop on each plot grows taller or shorter with its inputs.
- **One of each per farm.** On a farm, a seed, a fertilizer, a sprayer, a tractor type and a tool can each be used on
  one plot only. Choosing one already on another plot swaps the two, so the rule never blocks a pick.
- **What is chosen where.**

| Input | Choices | Chosen | Kept |
| --- | --- | --- | --- |
| Seed | Saved seed, certified hybrid (long season), drought-tolerant hybrid (early), improved open-pollinated, hybrid with beans, hybrid close spacing | Plot board at the seed shed (and in the planner) | from the first sown tile |
| Fertilizer | None (a control plot), manure, DAP at planting, DAP + CAN top-dress, double dose | Plot board at the fertilizer shed (and in the planner) | from the first fed tile |
| Sprayer | Knapsack, motorised mist blower, tractor boom sprayer, unsprayed check strip | Plot board at the sprayer shed, after the safety kit and product | all season, from the first spray |
| Tractor | Compact, standard, large; the fourth plot is worked by hand | At the tractor, every time the player gets on | claimed by the first tile it works on a farm |
| Tool | Disc plough, disc harrow, ridger, maize planter, seed drill, fertilizer spreader, boom sprayer, maize harvester, bean harvester | At the tractor, with what each is for, which job it does and which farms need it now | one plot of a farm per tool |

- **The tractor at any point.** The tool decides the job: plough, harrow or ridger prepare the land; planter or
  drill sow; the spreader puts fertilizer down at planting; the boom sprayer sprays; the harvesters harvest. On the
  tractor, only the plot under it is worked (one pass down a plot does it). A plot already worked by another tractor
  type, or a tool already used on another plot of that farm, gets a hint instead of work. Each plot-job costs fuel
  coins by tractor type.
- **Farm plans stay.** The six-farm planner keeps the farm-wide steps (land prep by hand or hired machine, planting
  date, pest control, water, harvest time) and gains three plot rows (seeds, fertilizer, sprayers) whose cells open
  the same plot board. Defaults are filled in, the same on every farm, so farm-to-farm comparisons stay fair.

## What each choice does (proposed numbers, in `src/plots/data.ts`, for the agronomist)

Each plot is a quarter of the farm's potential (1.5 of 6 bags). Its harvest multiplies:

- seed: its yield factor in this season's rain (a drought-tolerant early hybrid does best in a dry season; a long-season
  hybrid in a normal or wet one; saved seed loses vigour), and its traits against problems (drought, leaf rust);
- fertilizer: its yield factor and how badly the plot suffers in a hungry week (none worst, with a top-dress least);
- tools: a tool that does not suit the job takes up to 15% off (the farm's need: plough, harrow or ridger, from the
  drive's field layouts; a seed drill sows maize too close; a bean harvester loses maize cobs);
- tractor type: a large tractor packs the soil (−4%), a standard one a little (−1%), a compact one not at all; land
  turned by a tractor gets the tractor's land-prep factor;
- sprayer: on a day a pest or disease was treated, how much of the damage the sprayer stopped on that plot (a knapsack
  aims into the maize funnels where armyworm hides; a mist blower covers leaves well for rust; a boom sprayer is fast
  but misses the funnels and its wheels break tall maize; the check strip shows the untreated damage).

The farm-wide plan and the day's problems apply to all four plots. Costs: seed and fertilizer by plot (a quarter of a
farm's), fuel by plot-job, paid at planting and adjusted when a plot board is changed.

## Results

The results add a **By plot** view: every farm's four plots with their bags and inputs, and Lima AI's lessons from
all the plots together: which seed, fertilizer, tractor, tool and sprayer gave the most, other things equal.

## Steps

1. `src/plots/data.ts`: the catalogue (every word and number), defaults and the one-per-farm rule.
2. Model: plots on the trial, plot harvests, costs, results, explanations; old saves keep working (all four plots
   follow the farm plan).
3. Field work: plot masks; fertilizer and spray only where the plot gets them; tractor claims by plot.
4. State: set a plot input (swap, coins), tractor claims and fuel on the tractor's marks.
5. 3D farm: plot lines and letters, crop height by plot, the tractor working only its plot, tractor speed by type.
6. Screens: plot board (seed, fertilizer, sprayer sheds, planner), tractor and tool picker at the tractor, the
   sprayer step in the spray screen, planner plot rows, results by plot; design-review entries.
7. Tests: plot board rules, tractor pick and plot claims, results by plot, updated tractor tests, tour screenshots;
   a smoke test of the live site after deploy.
8. README, PR, CI green, merge, check the live site.
