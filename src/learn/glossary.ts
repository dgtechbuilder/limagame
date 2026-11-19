/* Farm words: what every fertilizer, spray, pest, tool, machine and farm idea in the game is, in a few plain lines,
   for a player who has never farmed. An info button (learn/Info.tsx) beside a name opens its card; the Farm words page
   (learn/Glossary.tsx) lists them all; the Farm basics lessons (BASICS below) introduce the most basic ones during the
   first session and the first days.

   THIS FILE IS THE WHOLE TABLE: a new word is one more entry, and every name in `aka` finds it (termFor). Words are
   for an agronomist to review: rates are typical Kenyan smallholder advice, not a product label. No screens here. */

export type SectionId = 'feed' | 'protect' | 'pests' | 'seed' | 'tools' | 'machines' | 'water' | 'animals' | 'power';

export const SECTIONS: { id: SectionId; label: string; tab: string; icon: string; lead: string }[] = [
  { id: 'feed', label: 'Fertilizer & soil', tab: 'Fertilizer', icon: '🌱', lead: 'What feeds a crop: fertilizers, manure and the nutrients in them.' },
  { id: 'protect', label: 'Sprays & safety', tab: 'Sprays & safety', icon: '🧴', lead: 'Pesticides (insecticides, fungicides, herbicides), natural sprays and the kit that keeps you safe.' },
  { id: 'pests', label: 'Pests & diseases', tab: 'Pests & disease', icon: '🐛', lead: 'What attacks crops and animals, and how to spot it.' },
  { id: 'seed', label: 'Seeds & planting', tab: 'Seeds & planting', icon: '🌽', lead: 'Kinds of seed, and the work before and at planting.' },
  { id: 'tools', label: 'Hand tools & sprayers', tab: 'Hand tools', icon: '🧰', lead: 'The tools a farmer carries.' },
  { id: 'machines', label: 'Tractors & implements', tab: 'Tractors', icon: '🚜', lead: 'Tractors, and the tools (implements) they pull.' },
  { id: 'water', label: 'Water & storage', tab: 'Water & storage', icon: '💧', lead: 'Keeping water for the crop, and keeping the harvest safe.' },
  { id: 'animals', label: 'Animals', tab: 'Animals', icon: '🐄', lead: 'Feeding, housing and keeping cows and hens healthy.' },
  { id: 'power', label: 'Power & climate', tab: 'Power & climate', icon: '☀️', lead: 'Solar power, generators, and the climate words on the Climate page.' },
];

export interface Term {
  id: string;
  /** the name on its card */
  name: string;
  section: SectionId;
  /** what kind of thing it is, in a word or two: "Fertilizer", "Insecticide", "Hand tool" */
  type: string;
  icon: string;
  /** what it is */
  what: string;
  /** what it does */
  does: string;
  /** when and how it is used: what it is for */
  use: string;
  /** a warning or a tip */
  care?: string;
  /** other names it is found by in the game (case-insensitive; a name in capitals, like CAN, matches only in capitals) */
  aka?: string[];
  /** related words, shown as links on its card */
  see?: string[];
}

const T: Term[] = [
  /* ---------------- fertilizer & soil ---------------- */
  {
    id: 'fertilizer', name: 'Fertilizer', section: 'feed', type: 'Plant food', icon: '🌱',
    what: 'Food for plants, put on the soil: in a bag (granules) or from animals and plants (manure, compost).',
    does: 'Puts back the nutrients a crop takes out of the soil, mostly nitrogen (N), phosphorus (P) and potassium (K). Without it, maize on tired soil gives half the grain or less.',
    use: 'Some at planting (in the hole), some later as a top-dress. The numbers on a bag, like 18:46:0, are its percent of N, P and K.',
    care: 'More is not better: too much burns roots, wastes money and washes into rivers.',
    aka: ['fertilizers', 'fertiliser', 'fertilize'], see: ['dap', 'can', 'npk', 'manure'],
  },
  {
    id: 'dap', name: 'DAP fertilizer', section: 'feed', type: 'Planting fertilizer', icon: '🌱',
    what: 'Diammonium phosphate: grey-brown granules with 18% nitrogen and 46% phosphorus (18:46:0).',
    does: 'Its phosphorus grows strong roots; its nitrogen gets the young seedling going.',
    use: 'At planting: about a bottle-top (5 g) in each hole, mixed with a little soil. A 50 kg bag does about one acre of maize.',
    care: 'Seed lying right on DAP can burn and fail to come up. DAP has little nitrogen for later: top-dress with CAN.',
    aka: ['DAP', 'diammonium phosphate', 'DAP at planting'], see: ['can', 'topdress', 'phosphorus'],
  },
  {
    id: 'can', name: 'CAN fertilizer', section: 'feed', type: 'Top-dress fertilizer', icon: '🌿',
    what: 'Calcium ammonium nitrate: white or grey granules with 26% nitrogen, plus calcium.',
    does: 'Nitrogen makes green leaves and big cobs. The calcium makes it gentler on the soil than urea.',
    use: 'As a top-dress when maize is knee high (4–6 weeks): a small handful 5–10 cm from each plant, on moist soil.',
    care: 'Keep it off the leaves (it scorches them). Spread on bone-dry soil, it sits there and burns.',
    aka: ['CAN', 'calcium ammonium nitrate', 'CAN top-dress', 'DAP + CAN'], see: ['topdress', 'urea', 'nitrogen'],
  },
  {
    id: 'urea', name: 'Urea', section: 'feed', type: 'Nitrogen fertilizer', icon: '🌿',
    what: 'White granules with 46% nitrogen: the most nitrogen in one bag.',
    does: 'The cheapest nitrogen per kilo, for top-dressing like CAN.',
    use: 'About half as much as CAN. Bury it, or put it on just before rain.',
    care: 'Left on the surface in the sun, much of its nitrogen escapes into the air. Over years it makes soil more acid.',
    see: ['can', 'nitrousOxide'],
  },
  {
    id: 'npk', name: 'NPK fertilizer', section: 'feed', type: 'Compound fertilizer', icon: '🌱',
    what: 'A blend with all three main nutrients. The numbers, like 17:17:17 or 23:23:0, are its percent of nitrogen (N), phosphorus (P) and potassium (K).',
    does: 'Feeds the crop evenly when you do not know what the soil lacks.',
    use: 'At planting, or as a soil test advises.',
    care: 'A soil test shows which blend you really need, and saves money.',
    aka: ['NPK', 'Balance NPK', 'balanced NPK', 'Rutuba Gold NPK'], see: ['nitrogen', 'phosphorus', 'potassium', 'soilTest'],
  },
  {
    id: 'nitrogen', name: 'Nitrogen (N)', section: 'feed', type: 'Plant nutrient', icon: '🍃',
    what: 'The nutrient plants need most: the N on a fertilizer bag.',
    does: 'Grows green leaves and stems. Short of it, the lower leaves turn yellow from the tip in a V.',
    use: 'From CAN, urea, NPK and manure. Beans add some too: they take it from the air.',
    care: 'Too much makes soft, lush plants that pests love, and washes into water.',
    see: ['can', 'urea'],
    aka: ['nitrogen'],
  },
  {
    id: 'phosphorus', name: 'Phosphorus (P)', section: 'feed', type: 'Plant nutrient', icon: '🌱',
    what: 'The P on a fertilizer bag.',
    does: 'Builds roots and helps flowering and grain. Short of it, young maize leaves turn purple.',
    use: 'At planting, near the seed, from DAP or NPK: it barely moves in the soil.',
    see: ['dap'],
    aka: ['phosphorus'],
  },
  {
    id: 'potassium', name: 'Potassium (K)', section: 'feed', type: 'Plant nutrient', icon: '🌾',
    what: 'The K on a fertilizer bag (also called potash).',
    does: 'Strong stalks, full grain, and a crop that stands drought and disease better. Short of it, leaf edges turn brown and dry.',
    use: 'From NPK blends, muriate of potash, wood ash and manure.',
    aka: ['potassium', 'potash'],
  },
  {
    id: 'manure', name: 'Farmyard manure', section: 'feed', type: 'Organic fertilizer', icon: '💩',
    what: 'Animal dung mixed with bedding, left in a heap to rot for 2–3 months.',
    does: 'Feeds slowly, and adds organic matter so the soil holds water and air. Feeds soil life.',
    use: 'Dug in before planting, or two handfuls in each planting hole.',
    care: 'Use it well rotted: fresh manure burns roots and brings weed seeds.',
    aka: ['manure', 'organic manure', 'organic fertilizer'], see: ['compost', 'manureTea'],
  },
  {
    id: 'compost', name: 'Compost', section: 'feed', type: 'Organic fertilizer', icon: '🍂',
    what: 'Crop leftovers, weeds, kitchen waste and manure in a heap that rots into dark, crumbly soil.',
    does: 'Like manure: slow plant food, better soil, more water held.',
    use: 'Turn the heap every few weeks; it is ready in 2–3 months.',
  },
  {
    id: 'manureTea', name: 'Manure tea', section: 'feed', type: 'Liquid feed', icon: '🪣',
    what: 'Manure soaked in water for a week or two, then strained.',
    does: 'A quick liquid feed of nitrogen at the roots.',
    use: 'Mix 1 part with about 3 parts water and pour it beside the plant, not on the leaves.',
  },
  {
    id: 'topdress', name: 'Top-dressing', section: 'feed', type: 'Farm practice', icon: '✋',
    what: 'Putting fertilizer beside a crop that is already growing.',
    does: 'Gives nitrogen when the crop grows fastest, instead of at planting when much of it would wash away.',
    use: 'Maize: at knee height, 4–6 weeks after planting, with CAN or urea.',
    aka: ['top-dress', 'top dress', 'top-dressed', 'top-dresses'], see: ['can'],
  },
  {
    id: 'basal', name: 'Planting fertilizer', section: 'feed', type: 'Farm practice', icon: '🕳️',
    what: 'Fertilizer put in the hole or furrow at planting (also called a basal dressing).',
    does: 'Feeds the seedling from day one, mostly phosphorus for roots.',
    use: 'DAP or an NPK blend, mixed with soil so the seed does not touch it.',
    aka: ['basal dressing', 'basal fertilizer'], see: ['dap'],
  },
  {
    id: 'lime', name: 'Agricultural lime', section: 'feed', type: 'Soil treatment', icon: '⚪',
    what: 'Ground limestone.',
    does: 'Makes sour (acid) soil less acid, so the crop can take up the fertilizer you pay for.',
    use: 'Only when a soil test shows acid soil (pH below about 5.5). Spread and dig in weeks before planting.',
    aka: ['lime'], see: ['soilTest'],
  },
  {
    id: 'soilTest', name: 'Soil test', section: 'feed', type: 'Farm practice', icon: '🧪',
    what: 'A lab or kit test of soil taken from your field.',
    does: 'Shows how acid the soil is and which nutrients are short, so you buy the right fertilizer.',
    use: 'Every 2–3 years: mix soil from 10–15 spots across the field into one sample.',
    aka: ['test soil', 'soil testing'],
  },
  {
    id: 'controlPlot', name: 'Control plot', section: 'feed', type: 'Trial', icon: '📏',
    what: 'A farm or strip left without one thing (no fertilizer, no spray) on purpose.',
    does: 'Shows what that thing really adds, by comparing it with the farms that got it.',
    use: 'One small strip per field is enough.',
    aka: ['check strip', 'unsprayed check strip', 'no fertilizer'],
  },

  /* ---------------- sprays & safety ---------------- */
  {
    id: 'pesticide', name: 'Pesticide', section: 'protect', type: 'Crop protection', icon: '🧴',
    what: 'Any product that kills or keeps off a pest. Insecticides kill insects, fungicides stop fungus disease, herbicides kill weeds, nematicides protect roots from soil worms, acaricides kill ticks.',
    does: 'Saves a crop that a pest, disease or weeds would otherwise eat into.',
    use: 'Only after you have named the problem, and only the product made for it. Read the label for the dose and the days to wait before harvest.',
    care: 'Wear gloves, a mask and boots. Keep it away from children, food and water, and never reuse the container.',
    aka: ['pesticides', 'chemical spray', 'pesticide in the funnels'], see: ['insecticide', 'fungicide', 'herbicide', 'ppe'],
  },
  {
    id: 'herbicide', name: 'Herbicide', section: 'protect', type: 'Weed killer', icon: '🌾',
    what: 'A chemical that kills weeds.',
    does: 'Selective herbicides kill the weeds but spare the crop. Non-selective ones, like glyphosate, kill every green plant they touch.',
    use: 'Before planting to clear a field, just after planting before weeds come up (pre-emergence), or on young weeds.',
    care: 'Use the one made for your crop, and never spray on a windy day: drift kills the next field.',
    aka: ['herbicides', 'weed killer', 'weedkiller'], see: ['selectiveHerbicide', 'glyphosate', 'weeding'],
  },
  {
    id: 'selectiveHerbicide', name: 'Selective herbicide', section: 'protect', type: 'Weed killer', icon: '🌾',
    what: 'A weed killer made for one crop, such as maize.',
    does: 'Kills the weeds among the crop but not the crop itself.',
    use: 'On young weeds with 2–4 leaves.',
    care: 'It leaves the soil bare: new weeds come back and rain washes soil away. Mulch helps.',
    see: ['herbicide', 'mulch'],
  },
  {
    id: 'glyphosate', name: 'Glyphosate', section: 'protect', type: 'Non-selective herbicide', icon: '☠️',
    what: 'The most common weed killer (sold as Roundup and others).',
    does: 'Kills every green plant it lands on, roots and all.',
    use: 'Clearing a field before planting, or paths and fence lines.',
    care: 'It kills maize and beans too: never spray it over a growing crop.',
    see: ['herbicide'],
  },
  {
    id: 'insecticide', name: 'Insecticide', section: 'protect', type: 'Pesticide for insects', icon: '🐜',
    what: 'A product that kills insects.',
    does: 'Contact insecticides kill what they touch. Systemic ones move inside the plant and kill what eats it.',
    use: 'When scouting finds the pest: spray where it hides (in the maize funnel, under the leaves).',
    care: 'It also kills bees and the insects that eat pests. Spray late in the afternoon, only where needed.',
    aka: ['insecticides'], see: ['emamectin', 'lambda', 'neem'],
  },
  {
    id: 'fungicide', name: 'Fungicide', section: 'protect', type: 'Pesticide for disease', icon: '🍄',
    what: 'A product that stops fungus diseases like rust and blight.',
    does: 'Mostly protects healthy leaves. It cannot cure a leaf that is already sick.',
    use: 'At the first spots, above all in wet weather. Repeat as the label says.',
    aka: ['fungicides'], see: ['mancozeb', 'copper', 'rust'],
  },
  {
    id: 'nematicide', name: 'Nematicide', section: 'protect', type: 'Pesticide for soil worms', icon: '🪱',
    what: 'A product against nematodes: tiny worms in the soil that eat roots.',
    does: 'Protects roots, so plants stop wilting and staying small.',
    use: 'In the soil at planting, where nematodes are known. Rotating crops helps as much.',
    care: 'Among the most poisonous farm chemicals: full kit, exactly as the label says.',
    aka: ['nematicides', 'nematodes'],
  },
  {
    id: 'acaricide', name: 'Acaricide', section: 'protect', type: 'Tick killer', icon: '🐂',
    what: 'A product that kills ticks and mites.',
    does: 'Keeps off the ticks that carry East Coast fever and other cattle diseases.',
    use: 'Sprayed on the cattle, or in a dip, about every week.',
    care: 'Change between products now and then so the ticks do not become resistant.',
    aka: ['tick spray', 'spray the cows for ticks', 'ticks'], see: ['ecf'],
  },
  {
    id: 'emamectin', name: 'Emamectin benzoate', section: 'protect', type: 'Insecticide', icon: '🐛',
    what: 'An insecticide made for caterpillars.',
    does: 'Caterpillars like fall armyworm stop eating within hours and die in a few days.',
    use: 'Sprayed into the maize funnel, early morning or late afternoon, while the caterpillars are small.',
    see: ['armyworm', 'insecticide'],
  },
  {
    id: 'lambda', name: 'Lambda-cyhalothrin', section: 'protect', type: 'Insecticide', icon: '🐜',
    what: 'A pyrethroid insecticide that kills on contact.',
    does: 'Kills sucking insects like aphids, and young stem borers.',
    use: 'Under the leaves for aphids; into the funnel for stalk borer.',
    care: 'Very harmful to bees and fish: never near the pond, never on flowers in the day.',
    see: ['aphids', 'stalkBorer'],
  },
  {
    id: 'mancozeb', name: 'Mancozeb', section: 'protect', type: 'Fungicide', icon: '🍄',
    what: 'A protective fungicide.',
    does: 'Coats the leaves so fungus spores (rust, blight) cannot get in.',
    use: 'Before or at the first signs of disease. Every 7–10 days in wet weather: rain washes it off.',
    see: ['fungicide', 'rust'],
  },
  {
    id: 'copper', name: 'Copper spray', section: 'protect', type: 'Fungicide', icon: '🟢',
    what: 'A copper fungicide, such as copper oxychloride. Allowed in organic farming.',
    does: 'Protects leaves from fungus and bacteria diseases.',
    use: 'Every 7–14 days in wet weather.',
    care: 'Copper builds up in the soil over the years: do not overuse it.',
    aka: ['copper oxychloride'], see: ['fungicide'],
  },
  {
    id: 'neem', name: 'Neem spray', section: 'protect', type: 'Natural pesticide', icon: '🌿',
    what: 'A spray made from neem leaves or seeds soaked overnight and strained.',
    does: 'Puts insects off eating and laying eggs. Safe for bees and the soil.',
    use: 'Every few days on armyworm or aphids, while there are still few of them.',
  },
  {
    id: 'soap', name: 'Soapy water', section: 'protect', type: 'Natural pesticide', icon: '🫧',
    what: 'Plain bar soap dissolved in water.',
    does: 'Coats soft insects like aphids so they cannot breathe.',
    use: 'Spray under the leaves, and again after 3–5 days.',
    care: 'Too strong and it scorches leaves: try it on one plant first.',
    aka: ['soap spray'],
  },
  {
    id: 'ash', name: 'Ash in the funnel', section: 'protect', type: 'Natural control', icon: '🔥',
    what: 'A pinch of wood ash (or fine sand) dropped into each maize funnel.',
    does: 'Dries out and scratches young armyworm caterpillars.',
    use: 'By hand on young maize: slow work, almost free.',
    aka: ['wood ash', 'a pinch of ash'],
  },
  {
    id: 'ppe', name: 'Spray kit (PPE)', section: 'protect', type: 'Safety', icon: '🦺',
    what: 'Personal protective equipment: gloves, a face mask, boots, long sleeves and trousers.',
    does: 'Keeps spray off your skin and out of your lungs and eyes.',
    use: 'Every time you mix or spray a chemical. Wash the kit, and yourself, afterwards.',
    aka: ['PPE', 'safety kit', 'protective kit'], see: ['gloves', 'mask', 'boots'],
  },
  {
    id: 'gloves', name: 'Chemical gloves', section: 'protect', type: 'Safety', icon: '🧤',
    what: 'Rubber or nitrile gloves, long enough to cover the wrists.',
    does: 'Stop chemicals soaking through your hands, where most poisoning starts.',
    use: 'For mixing (the most dangerous step) and spraying. Cloth gloves soak it up: do not use them.',
    aka: ['gloves'], see: ['ppe'],
  },
  {
    id: 'mask', name: 'Face mask', section: 'protect', type: 'Safety', icon: '😷',
    what: 'A mask (and goggles) over nose, mouth and eyes.',
    does: 'Keeps spray mist out of your lungs and eyes.',
    use: 'Whenever you spray; stand with the wind behind you.',
    aka: ['face mask'], see: ['ppe'],
  },
  {
    id: 'boots', name: 'Gumboots', section: 'protect', type: 'Safety', icon: '🥾',
    what: 'Rubber boots, with trousers worn over the top.',
    does: 'Keep spray that drips off the crop away from your feet and legs.',
    use: 'Every time you spray, and in wet, muddy fields.',
    aka: ['boots', 'gumboots'], see: ['ppe'],
  },
  {
    id: 'phi', name: 'Pre-harvest interval', section: 'protect', type: 'Safety', icon: '📅',
    what: 'The number of days you must wait between the last spray and the harvest. It is printed on the label.',
    does: 'Gives the chemical time to break down, so the food is safe to eat and sell.',
    use: 'Count the days before every harvest: never spray ripe crops.',
    aka: ['PHI'],
  },

  /* ---------------- pests & diseases ---------------- */
  {
    id: 'armyworm', name: 'Fall armyworm', section: 'pests', type: 'Crop pest', icon: '🐛',
    what: 'A caterpillar that reached Africa in 2016. The moth lays eggs on maize leaves.',
    does: 'Caterpillars eat inside the leaf funnel: ragged holes and sawdust-like droppings.',
    use: 'Scout every week: look into 20 funnels across the field. Act early, while they are small.',
    aka: ['armyworm'], see: ['emamectin', 'ash'],
  },
  {
    id: 'aphids', name: 'Aphids', section: 'pests', type: 'Crop pest', icon: '🦟',
    what: 'Tiny soft insects, green or black, in crowds under the leaves.',
    does: 'Suck the sap, curl the leaves and spread virus diseases.',
    use: 'Look under the leaves. Ladybirds eat them: spray only when there are many.',
    aka: ['aphid'], see: ['soap', 'lambda'],
  },
  {
    id: 'stalkBorer', name: 'Stalk borer', section: 'pests', type: 'Crop pest', icon: '🐛',
    what: 'A moth caterpillar that tunnels into maize stems (also called stem borer).',
    does: 'Weakens the stem, which breaks, and the cob stays small.',
    use: 'Treat the funnels of young maize (3–5 weeks) before the caterpillars get into the stem.',
    aka: ['stem borer', 'stem borers', 'borer', 'borers', 'stalk-borer'], see: ['lambda'],
  },
  {
    id: 'rust', name: 'Leaf rust', section: 'pests', type: 'Crop disease', icon: '🍂',
    what: 'A fungus disease: small orange-brown powdery spots on the leaves.',
    does: 'Eats leaf area, so the plant makes less grain.',
    use: 'Plant resistant seed, give plants room, remove the worst leaves, and protect the rest with a fungicide in wet weather.',
    aka: ['rust', 'blight', 'leaf disease'], see: ['fungicide', 'mancozeb'],
  },
  {
    id: 'weeds', name: 'Weeds', section: 'pests', type: 'Crop problem', icon: '🌿',
    what: 'Any plant growing where you do not want it.',
    does: 'Steal the water, food and light meant for the crop. Left in the first six weeks, they can take a third of the harvest.',
    use: 'Weed early, before they seed: by hoe, by hand, with mulch, or with a herbicide.',
    aka: ['weed'], see: ['weeding', 'herbicide', 'mulch'],
  },
  {
    id: 'ecf', name: 'East Coast fever', section: 'pests', type: 'Cattle disease', icon: '🐄',
    what: 'A cattle disease carried by the brown ear tick.',
    does: 'Swollen glands, high fever, hard breathing: it kills in days.',
    use: 'Prevent it with weekly tick control. Caught early, the vet treats it with an injection (buparvaquone).',
    see: ['acaricide'],
  },
  {
    id: 'mastitis', name: 'Mastitis', section: 'pests', type: 'Cattle disease', icon: '🥛',
    what: 'An infection of the udder.',
    does: 'A hot, swollen quarter; clots or blood in the milk.',
    use: 'Clean hands and udders, milk a sick cow last, treat with the vet’s tubes and throw that milk away.',
  },
  {
    id: 'fmd', name: 'Foot-and-mouth disease', section: 'pests', type: 'Cattle disease', icon: '🦶',
    what: 'A fast-spreading virus of cattle, goats and pigs.',
    does: 'Blisters in the mouth and on the feet, drooling, limping, and the milk drops.',
    use: 'Vaccinate every six months. Any case must be reported to the county vet.',
    aka: ['foot-and-mouth'], see: ['vaccine'],
  },
  {
    id: 'newcastle', name: 'Newcastle disease', section: 'pests', type: 'Chicken disease', icon: '🐔',
    what: 'A virus of chickens.',
    does: 'Twisted necks, hard breathing, and many hens dead in days.',
    use: 'Vaccinate every three months: one eye drop per bird.',
    aka: ['Newcastle'], see: ['vaccine'],
  },
  {
    id: 'bloat', name: 'Bloat', section: 'pests', type: 'Cattle illness', icon: '🎈',
    what: 'Gas trapped in a cow’s first stomach (the rumen), often after lush legumes or wet grass.',
    does: 'The left side swells up hard. It can kill within hours.',
    use: 'Walk her, give a cooking-oil drench and call the vet. Prevent it: feed hay before lush fodder.',
  },

  /* ---------------- seeds & planting ---------------- */
  {
    id: 'certified', name: 'Certified hybrid seed', section: 'seed', type: 'Seed', icon: '🌽',
    what: 'Seed from a registered company, tested and labelled, made by crossing two parent lines.',
    does: 'Strong, even plants and the highest yields.',
    use: 'Buy new seed every season: grain from a hybrid does not grow true.',
    care: 'Check the label and the date on the packet: fake seed is common.',
    aka: ['certified seed', 'hybrid', 'certified hybrid', 'certified hybrid, long season', 'long-season hybrid'], see: ['saved', 'opv'],
  },
  {
    id: 'saved', name: 'Saved seed', section: 'seed', type: 'Seed', icon: '🫘',
    what: 'Grain kept from your own last harvest and planted again.',
    does: 'Free. Fine for open-pollinated varieties; poor for hybrids, which come up uneven and weak.',
    use: 'Only from an OPV crop, or when there is no money for seed.',
    see: ['opv'],
  },
  {
    id: 'dt', name: 'Drought-tolerant seed', section: 'seed', type: 'Seed', icon: '🌵',
    what: 'A variety bred to keep growing through dry spells, often early-maturing.',
    does: 'Loses less grain in a dry season and is ready 3–4 weeks sooner.',
    use: 'Dry areas and the short rains.',
    aka: ['drought-tolerant', 'drought-tolerant hybrid', 'drought-tolerant hybrid, early'],
  },
  {
    id: 'opv', name: 'Open-pollinated variety', section: 'seed', type: 'Seed', icon: '🌽',
    what: 'A variety that grows true: its grain grows into the same plant again (OPV).',
    does: 'Cheaper seed you can replant for 2–3 seasons, but it yields less than a hybrid.',
    use: 'A tight budget, or keeping your own seed.',
    aka: ['OPV', 'open-pollinated', 'improved open-pollinated variety'],
  },
  {
    id: 'intercrop', name: 'Intercropping', section: 'seed', type: 'Farm practice', icon: '🫛',
    what: 'Two crops in the same field at once, like a row of beans between maize rows.',
    does: 'Beans add nitrogen to the soil, cover it from the sun and give a second harvest.',
    use: 'One row of beans between maize rows 75 cm apart.',
    aka: ['intercrop', 'hybrid + beans', 'hybrid with a row of beans'],
  },
  {
    id: 'spacing', name: 'Plant spacing', section: 'seed', type: 'Farm practice', icon: '📐',
    what: 'How far apart the rows and the plants are.',
    does: 'Gives each plant its share of light, water and food. Too close spreads disease and gives small cobs.',
    use: 'Maize: rows 75 cm apart, one seed every 25–30 cm.',
    aka: ['close spacing', 'hybrid planted twice as close', 'seeding'],
  },
  {
    id: 'transplanting', name: 'Transplanting', section: 'seed', type: 'Farm practice', icon: '🪴',
    what: 'Moving seedlings from a nursery into the field, or into gaps where seed failed.',
    does: 'Gives an even crop with no empty spots.',
    use: 'In the cool of the evening, then water well.',
  },
  {
    id: 'landPrep', name: 'Land preparation', section: 'seed', type: 'Farm practice', icon: '⛏️',
    what: 'Everything before planting: choosing the land, clearing it, tilling and levelling.',
    does: 'A clean, loose, level seedbed lets seed sprout evenly and rain soak in.',
    use: 'Start 2–4 weeks before the rains: plough, then harrow to break the clods.',
    aka: ['land prep', 'prepare the land', 'tilling', 'clearing', 'leveling', 'levelling', 'land selection', 'seedbed'], see: ['plough', 'harrow'],
  },
  {
    id: 'weeding', name: 'Weeding', section: 'seed', type: 'Farm practice', icon: '🌿',
    what: 'Taking weeds out of the crop, by hoe, by hand, by a cultivator or with a herbicide.',
    does: 'Keeps water, food and light for the crop.',
    use: 'Twice in the first six weeks: about 2–3 and 5–6 weeks after planting. Hoe shallow, so you do not cut the crop’s roots.',
    aka: ['weeded', 'cut the weeds', 'hand weeding', 'cut them out by hand'], see: ['weeds', 'cultivator'],
  },
  {
    id: 'tasseling', name: 'Tasseling and silking', section: 'seed', type: 'Crop stage', icon: '🌽',
    what: 'When maize puts out its tassel (the flower at the top) and its silks (the threads on the young cob).',
    does: 'Pollen falls from the tassel onto the silks: each silk that catches it becomes a grain.',
    use: 'The thirstiest two weeks of the season: water then saves the most grain.',
    aka: ['tasseling', 'tassels', 'silks'],
  },

  /* ---------------- hand tools & sprayers ---------------- */
  {
    id: 'hoe', name: 'Hoe (jembe)', section: 'tools', type: 'Hand tool', icon: '⛏️',
    what: 'A broad blade on a long handle: the farmer’s main tool.',
    does: 'Digs, breaks clods, weeds and makes planting holes.',
    use: 'Weed shallow: deep hoeing cuts the maize’s roots.',
    aka: ['hoe', 'jembe', 'hand hoe'],
  },
  {
    id: 'spade', name: 'Spade', section: 'tools', type: 'Hand tool', icon: '🪏',
    what: 'A flat digging blade with a step for your foot.',
    does: 'Digs holes and drains, turns compost and moves soil.',
    use: 'Drains, tree holes, the compost heap.',
  },
  {
    id: 'wheelbarrow', name: 'Wheelbarrow', section: 'tools', type: 'Hand tool', icon: '🛒',
    what: 'A one-wheeled cart you push.',
    does: 'Carries manure, bags, soil and the harvest without a sore back.',
    use: 'Every day: a load of manure to the field, sacks to the store.',
    aka: ['wheel barrow'],
  },
  {
    id: 'rake', name: 'Rake', section: 'tools', type: 'Hand tool', icon: '🧹',
    what: 'A row of teeth on a long handle.',
    does: 'Levels the seedbed, gathers stalks and weeds, and spreads mulch.',
    use: 'After digging, before planting small seeds.',
  },
  {
    id: 'handCultivator', name: 'Hand cultivator', section: 'tools', type: 'Hand tool', icon: '🔱',
    what: 'A forked tool with three or more bent tines.',
    does: 'Loosens the top of the soil and pulls out small weeds between rows.',
    use: 'Light weeding in vegetables and young crops.',
  },
  {
    id: 'shears', name: 'Pruning shears', section: 'tools', type: 'Hand tool', icon: '✂️',
    what: 'Strong scissors for plants (secateurs).',
    does: 'Cut branches, dead stems and sick leaves cleanly.',
    use: 'Pruning fruit trees and tomatoes, taking off diseased leaves.',
    care: 'Wipe the blades between sick plants, or they carry the disease.',
    aka: ['shears', 'secateurs'],
  },
  {
    id: 'sickle', name: 'Sickle', section: 'tools', type: 'Hand tool', icon: '🌙',
    what: 'A curved blade on a short handle.',
    does: 'Cuts grass, weeds, fodder and ripe stalks.',
    use: 'Clearing bush, cutting napier grass, reaping.',
    aka: ['panga', 'slasher'],
  },
  {
    id: 'wateringCan', name: 'Watering can', section: 'tools', type: 'Hand tool', icon: '🚿',
    what: 'A can with a spout and a rose (the holed cap).',
    does: 'Puts water gently at the roots of each plant.',
    use: 'Seedlings, nurseries and small beds; water the soil, not the leaves.',
  },
  {
    id: 'knapsack', name: 'Knapsack sprayer', section: 'tools', type: 'Sprayer', icon: '🎒',
    what: 'A 16–20 litre tank carried on your back, with a hand pump and a lance.',
    does: 'Lets you aim the spray exactly where it is needed, such as into maize funnels.',
    use: 'Small farms. Pump steadily for an even spray.',
    care: 'Rinse it after every use, and keep a separate one for herbicide only.',
    aka: ['knapsack', 'hand sprayer', 'sprayer'], see: ['ppe'],
  },
  {
    id: 'mist', name: 'Motorised mist blower', section: 'tools', type: 'Sprayer', icon: '💨',
    what: 'A backpack sprayer with a small engine that blows spray out as a fine mist.',
    does: 'Covers leaves fast and well, but drifts, and misses deep inside funnels.',
    use: 'Leaf diseases, tall crops and trees.',
    care: 'Mist drifts far: never in wind, always with the full kit.',
    aka: ['mist blower'],
  },
  {
    id: 'battery', name: 'Battery knapsack sprayer', section: 'tools', type: 'Sprayer', icon: '🔋',
    what: 'A knapsack sprayer with a rechargeable electric pump.',
    does: 'Even pressure without pumping by hand, still aimed into each funnel.',
    use: 'Bigger farms, without tired arms.',
    aka: ['battery sprayer', 'electric sprayer'],
  },
  {
    id: 'boom', name: 'Boom sprayer', section: 'machines', type: 'Tractor implement', icon: '🚿',
    what: 'A long bar of nozzles behind a tractor, fed from a big tank.',
    does: 'Sprays a wide band in one pass: the fastest way to spray a field.',
    use: 'Big fields, young crops and weeds.',
    care: 'It cannot aim into funnels, and its wheels break tall maize.',
    aka: ['tractor boom sprayer', 'boom spraying'],
  },

  /* ---------------- tractors & implements ---------------- */
  {
    id: 'tractor', name: 'Tractor', section: 'machines', type: 'Machine', icon: '🚜',
    what: 'A strong engine on big wheels that pulls or carries farm tools (implements).',
    does: 'Does in hours what takes many people days: ploughing, planting, spraying, carrying.',
    use: 'Bigger fields, or hired by the acre for the heavy jobs.',
    care: 'Heavy tractors pack the soil, above all when it is wet.',
    aka: ['tractors'], see: ['hp', 'compaction', 'implement'],
  },
  {
    id: 'implement', name: 'Implement', section: 'machines', type: 'Machine', icon: '🔧',
    what: 'A tool a tractor pulls or carries: a plough, a harrow, a planter, a sprayer…',
    does: 'Each one does one job; the wrong one does a poor job or none.',
    use: 'Choose it for the job and the ground.',
    aka: ['implements'],
  },
  { id: 'compact', name: 'Compact tractor', section: 'machines', type: 'Tractor', icon: '🚜', what: 'A small, light tractor, about 35 hp.', does: 'Cheap to run and light on the soil; slow with heavy implements.', use: 'Small farms and light jobs.' },
  { id: 'standard', name: 'Standard tractor', section: 'machines', type: 'Tractor', icon: '🚜', what: 'A middle-sized tractor, about 60 hp.', does: 'A good all-rounder: enough power for most jobs on a small farm.', use: 'Ploughing, planting and carting.' },
  { id: 'walking', name: 'Walking tractor', section: 'machines', type: 'Tractor', icon: '🚜', what: 'A two-wheel tractor you walk behind, about 15 hp.', does: 'The cheapest to buy and run, and kind to the soil; the slowest.', use: 'Smallholdings, terraces and vegetables.', aka: ['two-wheel tractor', 'power tiller'] },
  { id: 'large', name: 'Large tractor', section: 'machines', type: 'Tractor', icon: '🚜', what: 'A big tractor, about 100 hp.', does: 'Fast and strong, but turns wide, burns the most diesel and packs the soil.', use: 'Big wheat and maize fields.' },
  { id: 'fourwd', name: '4WD tractor', section: 'machines', type: 'Tractor', icon: '🚜', what: 'A four-wheel-drive tractor: the engine turns all four wheels.', does: 'Grips wet and heavy ground with less slipping.', use: 'Clay soils, slopes and the rainy season.', aka: ['4WD', 'four-wheel drive'] },
  {
    id: 'hp', name: 'Horsepower (hp)', section: 'machines', type: 'Measure', icon: '🐎',
    what: 'How strong an engine is.',
    does: 'More hp pulls wider, heavier implements, and burns more fuel.',
    use: 'A disc plough wants about 60 hp or more; a walking tractor has about 15.',
    aka: ['hp', 'horsepower'],
  },
  {
    id: 'compaction', name: 'Soil compaction', section: 'machines', type: 'Soil problem', icon: '🧱',
    what: 'Soil pressed hard by heavy machines or animals, above all when it is wet.',
    does: 'Roots and rain cannot get in, and yields drop for years.',
    use: 'Keep heavy machines off wet fields, and drive the same tracks.',
    aka: ['packs the soil', 'compacted'],
  },
  {
    id: 'plough', name: 'Disc plough', section: 'machines', type: 'Tractor implement', icon: '⚙️',
    what: 'Big tilted steel discs pulled through the soil.',
    does: 'Turns over hard soil and buries old stalks and weeds.',
    use: 'The season’s first job on hard or grassy ground.',
    aka: ['plough', 'plow', 'ploughing'], see: ['harrow'],
  },
  {
    id: 'harrow', name: 'Disc harrow', section: 'machines', type: 'Tractor implement', icon: '⚙️',
    what: 'Rows of smaller discs that cut across ploughed ground.',
    does: 'Breaks clods into a fine, level seedbed.',
    use: 'After ploughing, before planting.',
    aka: ['harrow', 'harrowing'], see: ['plough'],
  },
  {
    id: 'ridger', name: 'Ridger', section: 'machines', type: 'Tractor implement', icon: '⚙️',
    what: 'A pair of curved blades that throw soil both ways.',
    does: 'Makes furrows and ridges, for water to run along or drain away.',
    use: 'Irrigated fields, potatoes, and wet ground.',
    aka: ['ridging'], see: ['ridges'],
  },
  {
    id: 'planter', name: 'Maize planter', section: 'machines', type: 'Tractor implement', icon: '🌽',
    what: 'A machine that opens a row, drops seed and fertilizer, and covers them.',
    does: 'Plants straight rows at the right spacing and depth, fast.',
    use: 'Maize: one seed every 25 cm in rows 75 cm apart.',
    aka: ['planter'], see: ['spacing'],
  },
  {
    id: 'drill', name: 'Seed drill', section: 'machines', type: 'Tractor implement', icon: '🌾',
    what: 'A machine that sows small seed in many close rows.',
    does: 'Even sowing of beans, wheat and barley.',
    use: 'Small seeds. Not for maize.',
  },
  {
    id: 'cultivator', name: 'Inter-row cultivator', section: 'machines', type: 'Tractor implement', icon: '🔱',
    what: 'Spring tines that run between the crop rows.',
    does: 'Rip out weeds and loosen the crust, without chemicals.',
    use: 'On weeding day, while the crop is still small.',
    aka: ['cultivator'], see: ['weeding'],
  },
  {
    id: 'spreader', name: 'Fertilizer spreader', section: 'machines', type: 'Tractor implement', icon: '🌀',
    what: 'A hopper with a spinning disc underneath.',
    does: 'Throws fertilizer evenly over a wide band.',
    use: 'At planting, and for the CAN top-dress.',
    aka: ['spreader', 'fertilizer spreading'],
  },
  {
    id: 'maizeH', name: 'Maize harvester', section: 'machines', type: 'Tractor implement', icon: '🌽',
    what: 'A machine that picks the cobs and shells off the grain.',
    does: 'Harvests and shells maize row by row.',
    use: 'When the cobs are dry and hard.',
    aka: ['maize harvesting', 'sheller'],
  },
  {
    id: 'beanH', name: 'Bean harvester', section: 'machines', type: 'Tractor implement', icon: '🫘',
    what: 'A machine that cuts dry bean plants and threshes out the beans.',
    does: 'Harvests beans in one pass.',
    use: 'Dry bean fields. It breaks maize cobs.',
    aka: ['thresher'],
  },
  {
    id: 'combine', name: 'Combine harvester', section: 'machines', type: 'Machine', icon: '🌾',
    what: 'A big self-driving machine that cuts, threshes and cleans grain in one go.',
    does: 'Harvests wheat and barley fields in hours.',
    use: 'Big wheat and barley fields, usually hired.',
    aka: ['combine'],
  },
  {
    id: 'trailer', name: 'Trailer', section: 'machines', type: 'Tractor implement', icon: '🛻',
    what: 'A cart pulled by the tractor.',
    does: 'Carries the harvest, inputs and water.',
    use: 'Carting to the store, the market or the cooperative.',
  },

  /* ---------------- water & storage ---------------- */
  {
    id: 'tank', name: 'Water tank', section: 'water', type: 'Water store', icon: '🛢️',
    what: 'A plastic or steel tank that keeps rain from the roof or water pumped from the pond.',
    does: 'Keeps water for dry spells, the animals and spraying.',
    use: '1 mm of rain on 1 m² of roof gives about 1 litre.',
    aka: ['water tank', 'tanks'], see: ['gutters'],
  },
  {
    id: 'waterPan', name: 'Water pan', section: 'water', type: 'Water store', icon: '🏞️',
    what: 'A pond dug in the ground and lined with plastic, filled by run-off from the rain.',
    does: 'Stores a lot of water cheaply.',
    use: 'Fence it, and cover it to cut evaporation.',
    aka: ['pond'],
  },
  {
    id: 'drip', name: 'Drip irrigation', section: 'water', type: 'Watering', icon: '💧',
    what: 'Pipes with small holes (emitters) beside each plant.',
    does: 'Puts water right at the roots: about half the water of a can or a sprinkler.',
    use: 'From a tank on a stand, or a pump.',
    aka: ['drip line', 'drip', 'irrigation'],
  },
  {
    id: 'mulch', name: 'Mulch', section: 'water', type: 'Farm practice', icon: '🍂',
    what: 'Dry stalks, grass or leaves laid on the soil around the plants.',
    does: 'Keeps the moisture in, keeps weeds down, cools the soil and rots into plant food.',
    use: 'A layer a few centimetres thick, after weeding and watering.',
    aka: ['mulching', 'mulched'],
  },
  {
    id: 'gutters', name: 'Gutters', section: 'water', type: 'Water', icon: '🏠',
    what: 'Channels along the edge of a roof.',
    does: 'Lead the rain from the roof into the tank.',
    use: 'On the house, the cow shed and the store.',
    aka: ['gutter'],
  },
  {
    id: 'drains', name: 'Drains', section: 'water', type: 'Farm practice', icon: '🕳️',
    what: 'Channels dug at the low end of a field.',
    does: 'Let extra water run off, so roots can breathe.',
    use: 'After heavy rain, where water stands.',
    aka: ['drain', 'dig drains'],
  },
  {
    id: 'ridges', name: 'Ridges and furrows', section: 'water', type: 'Farm practice', icon: '〰️',
    what: 'Raised rows of soil (ridges) with channels between them (furrows).',
    does: 'Furrows carry water along the field; the ridge keeps roots above a flood.',
    use: 'Irrigated fields and wet ground.',
    aka: ['ridges', 'raised ridges', 'furrows'],
  },
  {
    id: 'lpm2', name: 'Litres per square metre', section: 'water', type: 'Measure', icon: '📏',
    what: 'How much water goes on each square metre (L/m²). 1 L/m² is the same as 1 mm of rain.',
    does: 'Lets you compare watering with rain.',
    use: 'Maize at tasseling in hot weather uses about 5 L/m² a day.',
    aka: ['L/m²', 'L/m^2'],
  },
  {
    id: 'hermetic', name: 'Hermetic bags', section: 'water', type: 'Grain storage', icon: '🛍️',
    what: 'Airtight bags with several layers (such as PICS bags).',
    does: 'Insects inside run out of air and die: no chemical needed.',
    use: 'Only for well-dried grain. Tie each layer tight.',
    aka: ['hermetic', 'PICS'],
  },
  { id: 'homeStore', name: 'Home storage', section: 'water', type: 'Grain storage', icon: '🏚️', what: 'Grain kept in ordinary sacks in the house.', does: 'Free, but weevils, rats and damp take a share.', use: 'Only for a few weeks; keep sacks on pallets, off the floor.' },
  { id: 'warehouse', name: 'Cooperative warehouse', section: 'water', type: 'Grain storage', icon: '🏢', what: 'A shared store run by a farmers’ cooperative.', does: 'Dry, guarded, and the grain can be sold together for a better price.', use: 'Pay a small fee a bag.', aka: ['warehouse'] },
  { id: 'silo', name: 'Metal silo', section: 'water', type: 'Grain storage', icon: '🛢️', what: 'A sealed steel bin for grain.', does: 'Keeps out rats and insects for months.', use: 'Only for dry grain; seal it well.' },
  { id: 'cold', name: 'Cold storage', section: 'water', type: 'Storage', icon: '❄️', what: 'A cooled room or cooler.', does: 'Keeps milk, vegetables and fruit fresh for days instead of hours.', use: 'Fresh produce, often shared and powered by solar.', aka: ['cold room', 'milk cooler', 'cooler'] },
  {
    id: 'drying', name: 'Drying grain', section: 'water', type: 'After harvest', icon: '☀️',
    what: 'Spreading grain on a tarpaulin or rack in the sun.',
    does: 'Brings moisture down to 13%, so it does not go mouldy in store.',
    use: 'Dry until a grain cracks between your teeth, before storing.',
    aka: ['drying'], see: ['aflatoxin'],
  },
  {
    id: 'aflatoxin', name: 'Aflatoxin', section: 'water', type: 'Food safety', icon: '⚠️',
    what: 'A poison made by mould on damp maize and groundnuts.',
    does: 'Causes liver cancer and can kill. Grain with it cannot be sold.',
    use: 'Dry the grain fast, throw out mouldy cobs, store dry and off the floor.',
    aka: ['mould', 'mold'],
  },
  { id: 'processing', name: 'Processing', section: 'water', type: 'Value addition', icon: '🏭', what: 'Turning a crop into something more valuable, such as grain into flour.', does: 'Earns more per kilo and keeps longer.', use: 'Milling, drying, packing.', aka: ['milling', 'value addition'] },
  { id: 'packaging', name: 'Packaging', section: 'water', type: 'Value addition', icon: '📦', what: 'Clean, sealed and labelled bags or packets.', does: 'Keeps food dry and clean, and buyers trust and pay more.', use: 'After drying, sorting and processing.' },

  /* ---------------- animals ---------------- */
  { id: 'napier', name: 'Napier grass', section: 'animals', type: 'Cattle feed', icon: '🌾', what: 'A tall fodder grass, cut and carried to the cows.', does: 'Plenty of green feed from a small plot.', use: 'Cut it at about a metre high and chop it.', aka: ['napier'] },
  { id: 'dairyMeal', name: 'Dairy meal', section: 'animals', type: 'Cattle feed', icon: '🥣', what: 'A bought concentrate feed of grain, protein and minerals.', does: 'Gives a milking cow the energy and protein grass alone cannot.', use: 'About 1 kg for every 2 litres of milk above 7, at milking.' },
  { id: 'layersMash', name: 'Layers mash', section: 'animals', type: 'Chicken feed', icon: '🐔', what: 'A complete feed for laying hens, with extra calcium for eggshells.', does: 'A fed hen lays nearly every day.', use: 'About 120 g a hen a day, with clean water.', aka: ['layers mash'] },
  { id: 'litter', name: 'Coop litter', section: 'animals', type: 'Housing', icon: '🪵', what: 'Wood shavings or dry grass on the coop floor.', does: 'Soaks up droppings and keeps the hens’ feet dry.', use: 'Change it when it gets wet or caked: wet litter brings disease.', aka: ['litter'] },
  { id: 'zeroGrazing', name: 'Zero-grazing unit', section: 'animals', type: 'Housing', icon: '🏠', what: 'A cow house with a concrete floor, troughs and stalls: the feed is brought to the cows.', does: 'More milk, less disease, and all the manure collected.', use: 'Small farms with little grazing land.', aka: ['zero-grazing'] },
  { id: 'vaccine', name: 'Vaccination', section: 'animals', type: 'Animal health', icon: '💉', what: 'A dose that trains the body to fight one disease.', does: 'Prevents a disease before it starts: far cheaper than treating it.', use: 'On the vet’s schedule: foot-and-mouth every 6 months, Newcastle every 3.', aka: ['vaccinate', 'vaccine'] },
  { id: 'deworm', name: 'Deworming', section: 'animals', type: 'Animal health', icon: '💊', what: 'Medicine by mouth that kills worms in the gut.', does: 'The animal keeps its weight, milk and eggs.', use: 'About every three months, or as the vet advises.', aka: ['deworm'] },

  /* ---------------- power & climate ---------------- */
  { id: 'solar', name: 'Solar panel', section: 'power', type: 'Power', icon: '☀️', what: 'A panel that turns sunlight into electricity (direct current, DC).', does: 'Free power on a sunny day, with nothing to burn.', use: 'Tilted to face the sun, kept clean of dust.', aka: ['solar panels', 'panels', 'solar'] },
  { id: 'kw', name: 'kW and kWh', section: 'power', type: 'Measure', icon: '⚡', what: 'kW (kilowatt) is how much power something uses or makes at a moment. kWh is energy: 1 kW for one hour.', does: 'Panels are sized in kW; batteries and a day’s use in kWh.', use: 'A 3 kW array makes roughly 12–15 kWh on a sunny Kenyan day.', aka: ['kW', 'kWh', 'kilowatt'] },
  { id: 'inverter', name: 'Inverter', section: 'power', type: 'Power', icon: '🔌', what: 'A box that turns the panels’ and batteries’ direct current into the 240 V the farm uses.', does: 'Lets ordinary pumps, lights and fridges run on solar.', use: 'Size it above the biggest load you will run at once.', aka: ['inverters'] },
  { id: 'sine', name: 'Pure and modified sine wave', section: 'power', type: 'Power', icon: '〰️', what: 'Two kinds of inverter current: pure sine wave is clean, like the grid; modified sine wave is choppy.', does: 'Motors and pumps run hot and waste power on modified sine wave.', use: 'Pure sine wave for pumps, fridges and motors.', aka: ['pure sine wave', 'modified sine wave'] },
  { id: 'mppt', name: 'MPPT charger', section: 'power', type: 'Power', icon: '📈', what: 'Maximum power point tracking: a charger that keeps finding the panels’ best voltage.', does: 'Gets more power from the same sun.', use: 'Built into hybrid inverters.', aka: ['MPPT', 'hybrid with MPPT'] },
  { id: 'microinverter', name: 'Microinverters', section: 'power', type: 'Power', icon: '🔌', what: 'One small inverter on every panel.', does: 'A shaded or dirty panel no longer drags the others down.', use: 'Roofs with some shade.' },
  { id: 'batteryBank', name: 'Battery bank', section: 'power', type: 'Power', icon: '🔋', what: 'Batteries that store today’s solar power for the night.', does: 'Lights, pumps and the cooler keep running after dark.', use: 'Size it to the night’s use in kWh.', aka: ['batteries', 'battery bank'] },
  { id: 'leadAcid', name: 'Lead-acid battery', section: 'power', type: 'Power', icon: '🔋', what: 'The older, cheaper kind of battery, like a car battery.', does: 'Stores power, but only about half of it should be used, or it dies young.', use: 'A tight budget; keep it topped up and cool.', aka: ['lead-acid', 'deep-cycle'] },
  { id: 'lithium', name: 'Lithium battery', section: 'power', type: 'Power', icon: '🔋', what: 'The newer kind of battery, as in phones.', does: 'Nearly all its charge can be used, and it lasts many more years.', use: 'Costs more at the start, less over its life.', aka: ['lithium'] },
  { id: 'led', name: 'LED lights', section: 'power', type: 'Power', icon: '💡', what: 'Lights that use a tenth of the power of old bulbs.', does: 'Light the yard, the paths and the coop for little power; a lit yard keeps thieves off.', use: 'On poles, on a timer, or on motion sensors.', aka: ['LED', 'LED bulbs', 'floodlights', 'motion floodlights'] },
  { id: 'generator', name: 'Generator', section: 'power', type: 'Power', icon: '⚙️', what: 'An engine that burns diesel or petrol to make electricity. Sized in kVA (about the same as kW).', does: 'Power on cloudy days and for heavy work.', use: 'A backup to solar: it costs fuel and makes CO₂.', aka: ['generators', 'kVA', 'diesel generator', 'inverter generator'] },
  { id: 'biogas', name: 'Biogas', section: 'power', type: 'Power', icon: '🔥', what: 'Gas made by cow manure rotting in a sealed tank (a digester).', does: 'Fuel for cooking or a generator, and the slurry left over is a rich fertilizer.', use: 'Needs the dung of 2–3 cows every day.', aka: ['digester', 'biogas generator'] },
  { id: 'bunded', name: 'Bunded tank', section: 'power', type: 'Fuel', icon: '⛽', what: 'A fuel tank inside a second tank.', does: 'A leak is caught in the outer tank instead of spilling into the soil and water.', use: 'Storing diesel near a pond or well.', aka: ['bunded'] },
  { id: 'diesel', name: 'Diesel', section: 'power', type: 'Fuel', icon: '⛽', what: 'The fuel tractors and most generators burn.', does: 'Each litre burnt makes about 2.7 kg of CO₂.', use: 'Store it locked and bunded; buy in bulk when cheap.' },
  { id: 'co2', name: 'Carbon dioxide (CO₂)', section: 'power', type: 'Climate', icon: '🌍', what: 'The main gas that warms the climate, from burning diesel, wood and other fuels.', does: 'The more in the air, the hotter and less reliable the seasons.', use: 'The Climate page counts the farm’s CO₂ in kg.', aka: ['CO₂', 'CO2', 'carbon dioxide', 'emissions'] },
  { id: 'nitrousOxide', name: 'Nitrous oxide', section: 'power', type: 'Climate', icon: '🌍', what: 'A gas released when soil microbes break down nitrogen fertilizer.', does: 'Warms the climate about 270 times as much as the same weight of CO₂.', use: 'Use only the nitrogen the crop needs, at the right time.' },
  { id: 'carbonStored', name: 'Carbon stored in soil', section: 'power', type: 'Climate', icon: '🌳', what: 'Carbon held in soil organic matter and trees.', does: 'Takes CO₂ out of the air and makes the soil richer and wetter.', use: 'Mulch, manure, compost, hedges and trees all store it.', aka: ['stored carbon', 'carbon stored', 'stores carbon'] },
  { id: 'climateSmart', name: 'Climate-smart farming', section: 'power', type: 'Climate', icon: '🌿', what: 'Ways of farming that give good harvests, cope with drought and floods, and pollute less.', does: 'Mulch, drip lines, manure, natural sprays and drought-tolerant seed are examples.', use: 'Look for the green tag on a choice.', aka: ['climate-smart', 'climate smart'] },
  { id: 'carbonCredit', name: 'Carbon credits', section: 'power', type: 'Climate', icon: '💵', what: 'Payments for carbon a farm keeps out of the air or stores in its soil.', does: 'Turns climate-smart farming into income.', use: 'Paid through a programme that measures what the farm does.', aka: ['climate payments', 'carbon credit'] },
  { id: 'liveHedge', name: 'Live hedge', section: 'power', type: 'Farm practice', icon: '🌳', what: 'A fence of planted thorny shrubs.', does: 'Keeps animals out for years, breaks the wind and stores carbon.', use: 'Plant along the boundary at the start of the rains.', aka: ['live hedge', 'thorny hedge'] },
];

export const TERMS: Record<string, Term> = Object.fromEntries(T.map(t => [t.id, t]));
export const termList = T;
export const termsIn = (section: SectionId) => T.filter(t => t.section === section);

/* ---------------- finding a word from a name in the game ---------------- */

interface Key {
  text: string;
  id: string;
  exact: boolean;
}
const isCaps = (w: string) => /[A-Z]/.test(w) && w === w.toUpperCase();
const KEYS: Key[] = T.flatMap(t => [t.name, ...(t.aka ?? [])].map(text => ({ text, id: t.id, exact: isCaps(text) })))
  // longest first: "CAN top-dress" before "CAN", "selective herbicide" before "herbicide"
  .sort((a, b) => b.text.length - a.text.length);

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS = new Map(KEYS.map(k => [k, new RegExp(`(^|[^A-Za-z0-9])${esc(k.text)}(?=$|[^A-Za-z0-9])`, k.exact ? '' : 'i')]));

/** The word a name in the game is about: an id, or a name such as "Knapsack sprayer", "Spray glyphosate" or "Lithium, 10 kWh"
    (the longest known name in it wins). Undefined when it names nothing in the table. */
export function termFor(nameOrId: string | undefined | null): Term | undefined {
  if (!nameOrId) return undefined;
  if (TERMS[nameOrId]) return TERMS[nameOrId];
  const low = nameOrId.toLowerCase();
  const whole = KEYS.find(k => (k.exact ? k.text === nameOrId : k.text.toLowerCase() === low));
  if (whole) return TERMS[whole.id];
  const part = KEYS.find(k => PATTERNS.get(k)!.test(nameOrId));
  return part ? TERMS[part.id] : undefined;
}

/* ---------------- Farm basics: the first words, for a player who has never farmed ---------------- */

export interface Lesson {
  id: string;
  title: string;
  icon: string;
  /** one line: why it matters */
  lead: string;
  /** the words it teaches, each with a line in plain words */
  cards: { term: string; line: string; short?: string }[];
}

/** In order: the first in the first session (on the farm update), then one each morning from day 2 (BASICS_FROM_DAY). */
export const BASICS: Lesson[] = [
  {
    id: 'three',
    title: 'Three words every farmer uses',
    icon: '📖',
    lead: 'Most of what a farm buys is one of these three. Tap ⓘ beside any name in the game to learn what it is.',
    cards: [
      { term: 'fertilizer', line: 'Food for the crop. It goes on the soil and makes plants grow bigger and give more grain.', short: 'Food for the crop' },
      { term: 'pesticide', line: 'A spray that kills what attacks the crop: insects (insecticide) or disease (fungicide).', short: 'Kills insects and crop disease' },
      { term: 'herbicide', line: 'A spray that kills weeds: the plants you do not want, which steal the crop’s water and food.', short: 'Kills weeds' },
    ],
  },
  {
    id: 'feed',
    title: 'Feeding the crop: fertilizer',
    icon: '🌱',
    lead: 'Two bags and a heap feed most maize: DAP at planting, CAN later, and manure.',
    cards: [
      { term: 'dap', line: 'At planting, in each hole: builds strong roots.' },
      { term: 'can', line: 'When the maize is knee high, beside each plant: grows leaves and big cobs.' },
      { term: 'npk', line: 'A bag with all three main foods: N, P and K. The numbers are how much of each.' },
      { term: 'manure', line: 'Rotted animal dung: slow food that makes the soil hold water.' },
    ],
  },
  {
    id: 'protect',
    title: 'Protecting the crop: pesticides',
    icon: '🧴',
    lead: 'First name the problem, then use the spray made for it. The wrong spray does nothing, or kills the crop.',
    cards: [
      { term: 'insecticide', line: 'Kills insects, like the armyworm caterpillars in the maize funnel.' },
      { term: 'fungicide', line: 'Stops fungus diseases like rust: the orange spots on leaves.' },
      { term: 'ppe', line: 'Gloves, mask and boots, every time you mix or spray.' },
      { term: 'neem', line: 'A home-made spray from neem leaves: safer, cheaper, a little slower.' },
    ],
  },
  {
    id: 'weeds',
    title: 'Weeds and herbicides',
    icon: '🌾',
    lead: 'Weeds in the first six weeks can take a third of the harvest.',
    cards: [
      { term: 'weeding', line: 'By hoe or by hand, twice in the first six weeks.' },
      { term: 'selectiveHerbicide', line: 'A weed killer made for your crop: kills the weeds, spares the maize.' },
      { term: 'glyphosate', line: 'Kills every green plant, the crop too: only before planting.' },
      { term: 'mulch', line: 'Cut weeds and stalks laid on the soil: keeps new weeds down and water in.' },
    ],
  },
  {
    id: 'seed',
    title: 'Seeds and planting',
    icon: '🌽',
    lead: 'Good seed in the right place is half the harvest.',
    cards: [
      { term: 'certified', line: 'Bought new each season: the strongest, most even crop.' },
      { term: 'opv', line: 'Seed you can save and replant for a few seasons.' },
      { term: 'spacing', line: 'Maize rows 75 cm apart, a seed every 25 cm.' },
      { term: 'intercrop', line: 'Beans between the maize: more food, and nitrogen for the soil.' },
    ],
  },
  {
    id: 'tools',
    title: 'Tools and machines',
    icon: '🚜',
    lead: 'Each job has its tool. The right one is faster and does it better.',
    cards: [
      { term: 'hoe', line: 'The hand tool for digging and weeding.' },
      { term: 'knapsack', line: 'A tank on your back with a pump: aim the spray where the pest is.' },
      { term: 'plough', line: 'Pulled by a tractor: turns the hard soil over before planting.' },
      { term: 'harrow', line: 'After the plough: breaks the clods into a fine seedbed.' },
    ],
  },
  {
    id: 'water',
    title: 'Water and the harvest',
    icon: '💧',
    lead: 'Keep water for the dry weeks, and keep the harvest dry once it is in.',
    cards: [
      { term: 'tank', line: 'Rain from the roof, kept for a dry spell.' },
      { term: 'drip', line: 'Water at each root: half the water of a can.' },
      { term: 'hermetic', line: 'Airtight bags: insects die inside, no chemical needed.' },
      { term: 'aflatoxin', line: 'A poison from mould on damp grain: dry it well before storing.' },
    ],
  },
];

/** The day the second lesson comes: one a morning from then on. */
export const BASICS_FROM_DAY = 2;
/** The lesson for a farm day (from day 2), or null once they have all been given. */
export const lessonForDay = (day: number): number | null => {
  const i = day - BASICS_FROM_DAY + 1;
  return i >= 1 && i < BASICS.length ? i : null;
};
