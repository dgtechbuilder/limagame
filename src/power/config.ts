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
  price: number;
  icon: string;
}

export const POWER_STEPS: PowerStep[] = [
  { id: 'panels', day: 1, name: 'Solar panels', icon: '☀️', price: 9000, does: 'Six 500 W panels on a frame: 3 kW of power on a sunny day.', task: 'Tilt the panels to face the sun' },
  { id: 'inverter', day: 2, name: 'Inverter', icon: '🔌', price: 4500, does: 'Turns the panels’ direct current into the 240 V the farm uses.', task: 'Wire each cable to its terminal' },
  { id: 'battery', day: 3, name: 'Battery bank', icon: '🔋', price: 7000, does: 'Four lithium batteries, 10 kWh: today’s sun, used tonight.', task: 'Connect the batteries in the safe order' },
  { id: 'lights', day: 4, name: 'Farm lights', icon: '💡', price: 2500, does: 'LED lights on poles over the yard, the paths, the pen and the coop.', task: 'Put a light where the dark spots are' },
  { id: 'generator', day: 5, name: 'Generator', icon: '⚙️', price: 6000, does: 'A 5 kVA diesel generator for cloudy days and heavy work.', task: 'Pull-start it: pull when the needle is in the green' },
  { id: 'fuel', day: 6, name: 'Diesel tank', icon: '⛽', price: 1200, does: 'A locked 200 L tank, filled with diesel for the generator and the tractor.', task: 'Fill the tank to the line without spilling' },
  { id: 'switchOn', day: 7, name: 'Switch on', icon: '⚡', price: 0, does: 'Commission the system: balance what it powers against what it makes.', task: 'Switch on enough loads without overloading the system' },
];
export const stepOf = (id: StepId) => POWER_STEPS.find(p => p.id === id)!;
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
