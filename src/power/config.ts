/* The farm's power system: every number to tune, in one place. Placeholders for an energy officer to review.

   Over the first seven farm days the farmer builds a solar power system in the power yard (top right of the farm),
   one part a day, each with its own mini-game: the solar panels (day 1), the inverter (day 2), the battery bank
   (day 3), the lights (day 4), the generator (day 5), the diesel for it (day 6), and on day 7 the whole system is
   switched on. A part can be put in on its day or any day after, never before.

   Once it is on, it runs every day: the panels make power by day, the battery keeps it for the night, the generator
   (with diesel) covers what is short. What it powers reaches the rest of the game: the water pump fills the tank and
   drips the new farms, the milk cooler pays more for milk, the lights keep thieves off and the hens laying, the
   workshop makes tractor repairs cheaper, and the clean power counts for the climate. Money is stored money
   (src/money.ts: 1 = KSh 10); energy in kWh. */

import type { Forecast } from '../trials/model';

export type PartId = 'panels' | 'inverter' | 'battery' | 'lights' | 'generator' | 'fuel';
/** the seventh day's job: switch the whole system on */
export type StepId = PartId | 'switchOn';

export interface PowerStep {
  id: StepId;
  /** the farm day it can be done, at the earliest */
  day: number;
  name: string;
  /** what it is, in a line */
  does: string;
  /** what the mini-game asks */
  task: string;
  /** the default option's price (the option chosen sets what is paid) */
  price: number;
  icon: string;
  /** the options to choose between, simplest first: the first two from day 1, more from day 2 and day 3
      (src/unlock/model.ts). Switching on has none. */
  options: PartOption[];
  /** the option an older save (or a choice not made) has */
  default?: string;
}

/** One way to put a part in. `size` is the part's main number: panels kW, an inverter the kW it can carry, a battery
    kWh, lights kWh a day, a generator kWh a litre of diesel, a fuel tank litres. */
export interface PartOption {
  id: string;
  name: string;
  does: string;
  price: number;
  size: number;
  /** panels and inverters: a multiplier on what they give; a battery: the share of its kWh that can be used */
  out?: number;
  /** a battery: the share of a charge that comes back out */
  eff?: number;
  /** lights: more eggs from lit coops; and whether they keep thieves off (count as the solar security light) */
  eggs?: number;
  secure?: boolean;
  /** lights with their own panel and battery: lit even when the system is short */
  own?: boolean;
  /** a generator on biogas: kWh a day for each cow, burning no diesel */
  biogas?: number;
  /** a fuel tank: litres put in when it is filled the first time */
  fill?: number;
}

const PANELS: PartOption[] = [
  { id: 'p15', name: '1.5 kW kit', does: 'Three 500 W panels: enough for the pump on a sunny day, not much more.', price: 4800, size: 1.5, out: 1 },
  { id: 'p3', name: '3 kW array', does: 'Six 500 W panels on a frame: the pump, the cooler, lights and the house.', price: 9000, size: 3, out: 1 },
  { id: 'used', name: 'Second-hand 3 kW', does: 'Six used panels: cheap, but old cells give a fifth less power.', price: 5500, size: 3, out: 0.8 },
  { id: 'p5', name: '5 kW array', does: 'Ten 500 W panels: power to spare, if the inverter can carry it.', price: 14500, size: 5, out: 1 },
  { id: 'track', name: '3 kW bifacial on a tracker', does: 'Two-sided panels on a frame that follows the sun: about a third more power.', price: 13000, size: 3, out: 1.3 },
];
const INVERTERS: PartOption[] = [
  { id: 'msw', name: 'Modified sine wave, 3 kW', does: 'The cheapest: a choppy current that wastes power and makes motors run hot.', price: 2500, size: 3, out: 0.9 },
  { id: 'psw', name: 'Pure sine wave, 3 kW', does: 'Turns the panels’ direct current into clean 240 V, like the grid.', price: 4500, size: 3, out: 1 },
  { id: 'hyb', name: 'Hybrid with MPPT, 3 kW', does: 'Its charger tracks the panels’ best voltage: more power from the same sun.', price: 5800, size: 3, out: 1.08 },
  { id: 'hyb5', name: 'Hybrid with MPPT, 5 kW', does: 'The same, carrying up to 5 kW: what a 5 kW array needs.', price: 7500, size: 5, out: 1.08 },
  { id: 'micro', name: 'Microinverters', does: 'One small inverter on every panel: a shaded panel no longer drags the others down.', price: 8500, size: 99, out: 1.12 },
];
const BATTERIES: PartOption[] = [
  { id: 'lead5', name: 'Lead-acid, 5 kWh', does: 'Cheap car-type batteries. Use only half the charge, or they die young.', price: 3000, size: 5, out: 0.5, eff: 0.8 },
  { id: 'li10', name: 'Lithium, 10 kWh', does: 'Four lithium batteries: today’s sun, used tonight, nearly all of it.', price: 7000, size: 10, out: 1, eff: 0.9 },
  { id: 'li5', name: 'Lithium, 5 kWh', does: 'Two lithium batteries: enough for the lights and the house at night.', price: 4000, size: 5, out: 1, eff: 0.9 },
  { id: 'lead20', name: 'Lead-acid, 20 kWh', does: 'A big bank of deep-cycle batteries: half of it usable, heavy, cheaper than lithium.', price: 7500, size: 20, out: 0.5, eff: 0.8 },
  { id: 'li15', name: 'Lithium, 15 kWh', does: 'Six lithium batteries: two cloudy days covered.', price: 10000, size: 15, out: 1, eff: 0.92 },
];
const LIGHTS: PartOption[] = [
  { id: 'bulbs', name: 'LED bulbs, house and coop', does: 'A few bulbs indoors. Hens lay a little more; the yard stays dark to thieves.', price: 1000, size: 0.8, eggs: 0.05, secure: false },
  { id: 'poles', name: 'LED lights on poles', does: 'Lights over the yard, the paths, the pen and the coop.', price: 2500, size: 1.5, eggs: 0.1, secure: true },
  { id: 'motion', name: 'Motion floodlights', does: 'Come on when something moves: thieves startled, little power used.', price: 2200, size: 0.5, eggs: 0.05, secure: true },
  { id: 'own', name: 'Stand-alone solar lights', does: 'Each light has its own small panel and battery: lit even on a day the system is short.', price: 4500, size: 0, eggs: 0.1, secure: true, own: true },
  { id: 'smart', name: 'Smart lights on a timer', does: 'Poles and the coop on a timer: a longer day for the hens, lights off when not needed.', price: 3500, size: 1, eggs: 0.15, secure: true },
];
const GENERATORS: PartOption[] = [
  { id: 'small', name: 'Diesel, 2.5 kVA', does: 'A small generator: cheap, but it burns more for each kWh.', price: 3000, size: 2.5 },
  { id: 'std', name: 'Diesel, 5 kVA', does: 'A 5 kVA diesel generator for cloudy days and heavy work.', price: 6000, size: 3 },
  { id: 'used', name: 'Second-hand diesel, 5 kVA', does: 'Half the price, a worn engine: it drinks diesel.', price: 3500, size: 2.2 },
  { id: 'invgen', name: 'Inverter generator, 4 kVA', does: 'Quiet, and it slows down when little is needed: the least diesel a kWh.', price: 7500, size: 3.6 },
  { id: 'biogas', name: 'Biogas generator', does: 'Runs on gas from the cows’ manure in a digester; diesel only for what is short.', price: 12000, size: 3, biogas: 1.5 },
];
const FUEL_TANKS: PartOption[] = [
  { id: 'drum', name: '100 L drum', does: 'An old drum with a hand pump: cheap, easy to siphon from.', price: 600, size: 100, fill: 60 },
  { id: 'tank200', name: '200 L locked tank', does: 'A locked steel tank, filled with diesel for the generator and the tractor.', price: 1200, size: 200, fill: 120 },
  { id: 'bunded', name: '300 L bunded tank', does: 'A tank inside a tank: a leak is caught, not spilt into the pond.', price: 2000, size: 300, fill: 150 },
  { id: 'tank500', name: '500 L tank', does: 'Fewer trips to town: buy diesel in bulk when the price is low.', price: 3000, size: 500, fill: 200 },
  { id: 'tank1000', name: '1,000 L tank and pump', does: 'A farm fuel station for the generator, the tractor and the business.', price: 5500, size: 1000, fill: 300 },
];

export const POWER_STEPS: PowerStep[] = [
  { id: 'panels', day: 1, name: 'Solar panels', icon: '☀️', price: 9000, does: 'Panels on a frame: power on a sunny day.', task: 'Tilt the panels to face the sun', options: PANELS, default: 'p3' },
  { id: 'inverter', day: 2, name: 'Inverter', icon: '🔌', price: 4500, does: 'Turns the panels’ direct current into the 240 V the farm uses.', task: 'Wire each cable to its terminal', options: INVERTERS, default: 'psw' },
  { id: 'battery', day: 3, name: 'Battery bank', icon: '🔋', price: 7000, does: 'Batteries: today’s sun, used tonight.', task: 'Connect the batteries in the safe order', options: BATTERIES, default: 'li10' },
  { id: 'lights', day: 4, name: 'Farm lights', icon: '💡', price: 2500, does: 'Lights for the yard, the paths, the pen and the coop.', task: 'Put a light where the dark spots are', options: LIGHTS, default: 'poles' },
  { id: 'generator', day: 5, name: 'Generator', icon: '⚙️', price: 6000, does: 'A generator for cloudy days and heavy work.', task: 'Pull-start it: pull when the needle is in the green', options: GENERATORS, default: 'std' },
  { id: 'fuel', day: 6, name: 'Diesel tank', icon: '⛽', price: 1200, does: 'A tank of diesel for the generator and the tractor.', task: 'Fill the tank to the line without spilling', options: FUEL_TANKS, default: 'tank200' },
  { id: 'switchOn', day: 7, name: 'Switch on', icon: '⚡', price: 0, does: 'Commission the system: balance what it powers against what it makes.', task: 'Switch on enough loads without overloading the system', options: [] },
];
export const stepOf = (id: StepId) => POWER_STEPS.find(p => p.id === id)!;
/** A part's option by id, or its default (an older save, or no choice made). */
export const partOptionOf = (id: StepId, option?: string | null): PartOption | null => {
  const st = stepOf(id);
  return st.options.find(o => o.id === option) ?? st.options.find(o => o.id === st.default) ?? null;
};
export const PART_IDS: PartId[] = ['panels', 'inverter', 'battery', 'lights', 'generator', 'fuel'];

export const POWER = {
  /** kW of panels, and the sun hours a day by the season's rain */
  panelsKw: 3,
  sunHours: { dry: 6, normal: 5, wet: 3.5 } as Record<Forecast, number>,
  /** battery capacity, kWh, and the share of a charge that comes back out */
  batteryKwh: 10,
  batteryEff: 0.9,
  /** kWh a litre of diesel makes in the generator; diesel's price a litre (KSh 180) and kg CO₂ a litre burned */
  genKwhPerL: 3,
  dieselPrice: 18,
  dieselCo2: 2.68,
  /** the fuel tank's size (L) and what is put in it when it is filled the first time */
  tankL: 200,
  firstFill: 120,
  /** kg CO₂ a kWh from the grid or a small diesel genset that the farm no longer needs (East African mix + diesel) */
  avoidedCo2: 0.7,
  /** what a kWh costs from the grid, for the savings (KSh 25) */
  gridPrice: 2.5,
  /** what the system powers: kWh a day, and what it does for the farm */
  loads: {
    pump: { kwh: 4, name: 'Water pump', does: 'Lifts pond water into the tank and drips the new farms' },
    cooler: { kwh: 2.5, name: 'Milk cooler', does: 'Chilled milk fetches a better price at the dairy' },
    lights: { kwh: 1.5, name: 'Lights', does: 'Lights the yard at night: thieves keep away, hens lay more' },
    house: { kwh: 1.5, name: 'House', does: 'Lights, phone charging and a radio: no paraffin' },
    workshop: { kwh: 1, name: 'Workshop', does: 'Power tools: tractor repairs and servicing cost less' },
  },
  /** litres the solar pump lifts into the tank a day, at full power */
  pumpLitres: 600,
  /** the milk cooler's premium on milk, the lights' extra eggs, the workshop's cut on tractor repairs */
  milkPremium: 0.2,
  eggBoost: 0.1,
  repairCut: 0.3,
  /** drip irrigation on the new farms: they water themselves, with this share of the water */
  dripShare: 0.6,
  /** cooking: the share of the kitchen's emissions left with power in the house */
  cookingShare: 0.8,
  /** the points each part pays once put in, and switching on pays */
  points: 40,
  switchOnPoints: 150,
  /** a part put in well (its mini-game's score) works better: this share of its output at a score of 0 */
  floor: 0.75,
  /** the days of history kept */
  keep: 30,
} as const;

export type LoadId = keyof typeof POWER.loads;
export const LOAD_IDS = Object.keys(POWER.loads) as LoadId[];
