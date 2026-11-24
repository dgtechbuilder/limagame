/* Climate Smart Agriculture: the practices the module teaches, in words. Each one is learned, then practised in its
   own hands-on game (src/csa/games), then drilled on the farm day after day (the CLIMATE-SMART chip on the farm).

   Eight practices: the three the module was asked for (half-moons, saving water, the right time of day), four more
   that are used by farmers in Kenya and West Africa: zaï pits, push-pull, kisiki hai (farmer-managed natural
   regeneration) and drought-tolerant seed with a legume between the rows, and resting the land (fallow and a
   green-manure cover crop, taken in turns across the six farms: src/soil, and the plan's Use row). Every figure here is for learning and
   needs an agronomist's review before a pilot (see README › Assumptions). No screens here. */

export type CsaId = 'halfmoon' | 'water' | 'clock' | 'zai' | 'pushpull' | 'fmnr' | 'seeds' | 'rest';

export interface Practice {
  id: CsaId;
  name: string;
  /** what farmers call it */
  aka: string;
  icon: string;
  /** the climate problem it answers, in a few words (the card's line) */
  fixes: string;
  /** where it is used: Kenya, then West Africa */
  kenya: string;
  westAfrica: string;
  /** what it is, in one or two sentences */
  what: string;
  /** how to do it, step by step: an icon and a line */
  steps: [icon: string, text: string][];
  /** why it is climate-smart: what it does for the harvest, for adapting, and for the climate */
  why: string[];
  /** what the practice game asks */
  task: string;
  /** one line to remember (the daily drill's reminder, and the result screen) */
  remember: string;
  /** the address word: #/climate/climate-smart-agriculture/<slug> */
  slug: string;
}

export const PRACTICES: Practice[] = [
  {
    id: 'halfmoon',
    name: 'Half-moons',
    aka: 'Demi-lunes · earth smiles',
    icon: '🌗',
    fixes: 'Rain that runs off hard, bare land',
    kenya: 'Kajiado, Laikipia, Makueni: Maasai and Kamba communities dig them to bring grass back to bare rangeland',
    westAfrica: 'Niger, Burkina Faso, Mali, Senegal: for sorghum, millet and trees on crusted land',
    what: 'A half-circle bank of earth on a slope. Rain running down the slope flows into its open side and is held there, so it soaks in instead of washing the soil away.',
    steps: [
      ['📐', 'Mark rows along the contour: across the slope, never down it'],
      ['⛏️', 'Dig a half-circle about 4 m across in the dry season; heap the earth into a bank about 20 cm high'],
      ['⬆️', 'The open side faces UPHILL; the curved bank sits on the downhill side to catch the water'],
      ['🔀', 'Stagger each row: the next row sits under the gaps of the row above, so water that slips past one is caught by the next'],
      ['💩', 'Put a few shovels of manure or compost in the middle'],
      ['🌱', 'Plant sorghum, millet, maize, grass or a tree inside when the rain comes'],
    ],
    why: ['Holds the rain where the roots are: crops get through dry spells', 'Stops soil washing away in storms', 'Brings grass and trees back: they store carbon'],
    task: 'Dig half-moons on the slope, the right way round and staggered, then let it rain',
    remember: 'Open side uphill, rows staggered along the contour, manure inside.',
    slug: 'half-moons',
  },
  {
    id: 'water',
    name: 'Saving water',
    aka: 'Mulch, water at the roots, drip, catch the rain',
    icon: '💧',
    fixes: 'Dry spells and an empty tank',
    kenya: 'Roof tanks and farm ponds across Kenya; bucket drip kits for sukuma wiki and tomatoes; mulch in every county',
    westAfrica: 'Bottle and bucket drip in market gardens in Senegal, Ghana and Nigeria; mulch with crop stalks in the Sahel',
    what: 'Every drop counts in a dry spell. Cover the soil so the sun cannot drink the water, put the water where the roots are, and catch the rain off your roofs.',
    steps: [
      ['🌾', 'Mulch: cover bare soil with dry grass or stalks, a hand thick; it can halve the water the sun takes'],
      ['🎯', 'Water the soil at the roots, not the leaves: water on the leaves mostly dries in the air'],
      ['🪣', 'Drip from a bucket kit or a bottle with a small hole: slow drops, all of it soaks in'],
      ['🌅', 'Water early in the morning, when it is cool and still'],
      ['🏠', 'Gutters on every roof into a tank: a 100 m² roof catches about 1,000 L from 10 mm of rain'],
      ['💦', 'Water deeply and less often, so roots grow down to the damp'],
    ],
    why: ['Crops get through dry spells on less water', 'The tank and the borehole last longer', 'Less pumping: less diesel and CO₂'],
    task: 'Keep a tomato plant alive through a hot day on as little water as you can',
    remember: 'Cover the soil, water the roots early in the morning, and less water does more.',
    slug: 'saving-water',
  },
  {
    id: 'clock',
    name: 'The right time of day',
    aka: 'The field clock',
    icon: '🕖',
    fixes: 'Heat, wind and water lost to the sun',
    kenya: 'Farmers across Kenya water and weed from first light and rest from noon, when the sun is hardest',
    westAfrica: 'In the Sahel and the savannah, field work starts before sunrise and stops by late morning in the hot months',
    what: 'The same job can work or fail depending on the hour. Near the equator the sun rises about 6:30 and sets about 6:45; the hottest hours are noon to 3 pm.',
    steps: [
      ['💧', 'Water from 6 to 9 am: cool and still, the roots drink before the heat. Late afternoon is second best'],
      ['🌱', 'Transplant seedlings in the late afternoon (4 to 6 pm): they settle overnight before the sun'],
      ['🧴', 'Spray early in the morning or in the evening: no wind, no bees flying, no midday heat'],
      ['⛏️', 'Dig and weed from 6 to 10 am and after 4 pm; rest in the shade from noon to 3 and drink water'],
      ['🥬', 'Pick sukuma wiki and other greens at dawn, when they are cool and crisp'],
      ['🌽', 'Harvest dry maize and beans late in the morning, once the dew is off, so they store without mould'],
    ],
    why: ['Less water lost to the sun', 'Sprays stay on the crop and away from bees and water', 'The farmer stays safe from heat stress'],
    task: 'Pick the best hour for six farm jobs, watching the sun, the heat and the wind',
    remember: 'Water and work in the cool; rest at midday; spray when it is still.',
    slug: 'time-of-day',
  },
  {
    id: 'zai',
    name: 'Zaï pits',
    aka: 'Zaï · tassa · planting pits',
    icon: '🕳️',
    fixes: 'Crusted, worn-out soil that sheds the rain',
    kenya: 'Machakos, Makueni and Kitui in eastern Kenya, for maize, sorghum and beans on dry, hard land',
    westAfrica: 'Burkina Faso (Yatenga), Niger (tassa) and Mali: farmers brought back thousands of hectares of bare land with them',
    what: 'Small pits dug in the dry season, each with a handful of manure. The first rain collects in the pit, termites open the soil, and the seed grows in a little pocket of water and food.',
    steps: [
      ['📏', 'Mark a grid about 80 cm apart'],
      ['⛏️', 'In the dry season, dig pits about 25 cm wide and 15 cm deep; heap the earth on the downhill side'],
      ['💩', 'Put a handful or two of manure or compost in every pit'],
      ['🌧️', 'Wait for the first good rain to fill the pits'],
      ['🌱', 'Then sow: a few seeds in each pit, in the damp'],
      ['🔁', 'Re-use the pits next season and add more manure'],
    ],
    why: ['Catches the first rain where the seed is', 'Manure feeds the soil and termites open it', 'Bare land comes back into use, storing carbon'],
    task: 'Dig the pits, feed them and sow them, in the right order and at the right time',
    remember: 'Dig and manure in the dry season; sow once the first rain fills the pits.',
    slug: 'zai-pits',
  },
  {
    id: 'pushpull',
    name: 'Push-pull',
    aka: 'Desmodium and Napier or Brachiaria',
    icon: '🌿',
    fixes: 'Stemborers, fall armyworm and striga',
    kenya: 'Began in western Kenya with icipe; now on the farms of hundreds of thousands of families in East Africa',
    westAfrica: 'Striga (witchweed) and fall armyworm hit maize, sorghum and millet across West Africa; push-pull answers both without sprays',
    what: 'Plant desmodium between the maize rows: its smell pushes moths away, it kills striga and feeds the soil with nitrogen. Plant Napier or Brachiaria grass around the edge: it pulls the moths in to lay their eggs there instead.',
    steps: [
      ['🌽', 'Sow maize in rows as usual'],
      ['🍀', 'Sow drought-tolerant (greenleaf) desmodium between every pair of maize rows: the push'],
      ['🌾', 'Plant 3 rows of Brachiaria or Napier grass all around the edge: the pull'],
      ['🦋', 'Moths go for the border grass; its sticky sap traps the young caterpillars'],
      ['🥀', 'Desmodium roots stop striga, and feed the maize nitrogen'],
      ['🐄', 'Cut the desmodium and the grass for the cows: fodder all year'],
    ],
    why: ['Far fewer pests with no spray', 'Nitrogen for free, and soil covered all year', 'Fodder for the cows, and more milk'],
    task: 'Lay out the field: push between the rows, pull around the edge; then the moths fly in',
    remember: 'Desmodium between the rows pushes; grass around the edge pulls.',
    slug: 'push-pull',
  },
  {
    id: 'fmnr',
    name: 'Kisiki hai',
    aka: 'Farmer-managed natural regeneration (FMNR) · living stumps',
    icon: '🌳',
    fixes: 'Bare, hot, windswept farms',
    kenya: '"Kisiki hai" (living stump) in Swahili: farmers in Baringo, Makueni and across the dry counties regrow trees from stumps',
    westAfrica: 'Niger: farmers regreened millions of hectares since the 1980s; also Senegal, Mali, Burkina Faso and Ghana',
    what: 'Old tree stumps in a field are still alive and sprout again. Choose the best few stems, cut the rest, and protect them: in a few years they are trees, for free.',
    steps: [
      ['🔍', 'Find living stumps in the field: they sprout new stems'],
      ['✅', 'Choose 3 to 5 of the tallest, straightest, healthiest stems'],
      ['✂️', 'Cut every other stem: thin, crooked, broken or sick ones'],
      ['🌿', 'Trim the side branches off the lower half of the stems you keep'],
      ['🐐', 'Protect them: tell the herders, mark them, keep goats away'],
      ['🔥', 'Each year, cut one stem for firewood and let a new one grow'],
    ],
    why: ['Shade and windbreaks: the soil holds water longer', 'Leaves feed the soil; fodder, firewood and fruit', 'Trees store a lot of carbon'],
    task: 'Prune the stumps: keep the best 3 to 5 stems on each, cut the rest, then watch the years pass',
    remember: 'Keep 3 to 5 straight, strong stems; cut the rest; protect them.',
    slug: 'kisiki-hai',
  },
  {
    id: 'seeds',
    name: 'Drought-tolerant seed and intercropping',
    aka: 'Plant for the season you are going to get',
    icon: '🫘',
    fixes: 'Short rains, late rains and dry spells',
    kenya: 'Drought-tolerant and early maize, sorghum, green grams, cowpeas and pigeon peas in eastern Kenya; maize with beans everywhere',
    westAfrica: 'Millet and sorghum with cowpea between the rows across the Sahel; early-maturing maize in Ghana and Nigeria',
    what: 'Read the season forecast, choose a crop that fits the rain you will get, plant a legume between the rows, and plant once the soil is wet a hand deep.',
    steps: [
      ['📻', 'Listen to the season forecast (KMD in Kenya, the national weather services in West Africa)'],
      ['🌽', 'Short or late rains: an early, drought-tolerant maize, sorghum or millet'],
      ['🫘', 'Plant beans, cowpeas or pigeon peas between the rows: food, nitrogen, and soil cover'],
      ['✋', 'Plant when the soil is wet a hand deep, not after the first shower: a false start kills the seed'],
      ['📅', 'Do not plant late: every week late loses harvest'],
      ['🧺', 'Two crops spread the risk: if one fails, the other feeds the family'],
    ],
    why: ['A harvest even in a bad season', 'Legumes feed the soil with nitrogen, so less fertilizer', 'Less money lost to a failed crop'],
    task: 'Three seasons, three forecasts: choose the crop, the partner between the rows and when to plant',
    remember: 'Match the seed to the rain; a legume between the rows; plant when the soil is wet a hand deep.',
    slug: 'seed-and-intercrop',
  },
  {
    id: 'rest',
    name: 'Resting the land',
    aka: 'Fallow, green manure and rotation · kupumzisha shamba',
    icon: '🍀',
    fixes: 'Worn-out soil and shrinking harvests',
    kenya: 'Lablab, mucuna and desmodium as green manure in western Kenya and the highlands; short grass fallows in Machakos and the coast',
    westAfrica: 'Improved fallows with mucuna and pigeon pea in Benin, Nigeria and Ghana; Faidherbia trees and grazed fallow in the Sahel',
    what: 'A farm cropped every season wears out: each harvest carries nutrients away and the soil loses its carbon. Rest one or two farms each season, in turns, under grass or a legume cover crop, and they come back richer.',
    steps: [
      ['🪱', 'Watch each farm’s soil: a pale crop, a hard crust and smaller harvests mean it is tired'],
      ['🔄', 'Rest in turns: each season, rest the farm that has been cropped longest or has the poorest soil'],
      ['🍀', 'Sow a legume cover (lablab, mucuna, desmodium): it fixes nitrogen and covers every bit of ground'],
      ['🌾', 'No seed? Let grass and bush grow back (natural fallow): slower, but free'],
      ['🔪', 'Before the next crop, slash the cover at flowering and dig it in, or leave it as mulch'],
      ['🍲', 'Keep enough farms planted to feed the family; mulch, manure and beans keep the planted ones from wearing out'],
    ],
    why: ['Richer soil: bigger harvests from every farm that follows', 'Soil covered all year: no wash-off, no bare ground losing carbon', 'Roots and cover store carbon; legumes replace bought nitrogen'],
    task: 'Six farms, four seasons: choose which farms rest each season, keep the family fed and leave the soil richer',
    remember: 'Rest in turns, under a legume cover; keep enough planted to feed the family.',
    slug: 'resting-the-land',
  },
];

export const practiceOf = (id: CsaId) => PRACTICES.find(p => p.id === id)!;
export const CSA_IDS = PRACTICES.map(p => p.id);
