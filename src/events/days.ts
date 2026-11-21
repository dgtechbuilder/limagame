/* Special days: the world days about food, farming, water and the climate, through the year. Each is on for a week
   (three days either side of its date). While one is on, it shows first in Events › Happening now with a job on the
   farm that fits it, and gifts to the regions earn double giving points (src/events/regions.ts). */

import { achClock } from '../achievements/track';

export interface SpecialDay {
  id: string;
  name: string;
  icon: string;
  /** month (1–12) and day of its date */
  month: number;
  day: number;
  /** what the day is about */
  line: string;
  /** what to do in the game while it is on */
  task: string;
  /** the page that task is on (src/route.ts) */
  go: string;
}

export const DAYS: SpecialDay[] = [
  { id: 'wetlands', name: 'World Wetlands Day', icon: '🦆', month: 2, day: 2, line: 'Swamps, marshes and river banks store water and carbon.', task: 'Check how your farm draws on the shared dam.', go: '/climate/water-and-soil' },
  { id: 'pulses', name: 'World Pulses Day', icon: '🫘', month: 2, day: 10, line: 'Beans, peas and lentils feed people and put nitrogen back in the soil.', task: 'Plant beans on one of the new farms.', go: '/new-farms/7' },
  { id: 'forests', name: 'International Day of Forests', icon: '🌳', month: 3, day: 21, line: 'Trees cool the land, hold the soil and bring rain.', task: 'See what your farm’s trees store on Climate.', go: '/climate/farm-areas' },
  { id: 'water', name: 'World Water Day', icon: '💧', month: 3, day: 22, line: 'Every farm, herd and family depends on clean water.', task: 'Top up your water tank and see what each job uses.', go: '/climate/water-tank' },
  { id: 'earth', name: 'Earth Day', icon: '🌍', month: 4, day: 22, line: 'A day for the planet, and the soil under every farm.', task: 'Read your farm’s emissions and cut one.', go: '/climate/emissions' },
  { id: 'plants', name: 'International Day of Plant Health', icon: '🌱', month: 5, day: 12, line: 'Pests and diseases take a large share of the world’s crops each year.', task: 'Walk your field rounds and read every bed.', go: '/rounds' },
  { id: 'bees', name: 'World Bee Day', icon: '🐝', month: 5, day: 20, line: 'Bees pollinate many of the crops we eat.', task: 'Learn which sprays harm bees in Farm words.', go: '/farm-words/sprays' },
  { id: 'africa', name: 'Africa Day', icon: '🌍', month: 5, day: 25, line: 'The continent’s day: its farmers grow most of the food it eats.', task: 'Give to a region in need on Events › Regions.', go: '/events/regions' },
  { id: 'environment', name: 'World Environment Day', icon: '🌿', month: 6, day: 5, line: 'The United Nations’ day for the environment.', task: 'Clear today’s bushes and rocks: a tidy farm.', go: '/farm' },
  { id: 'drought', name: 'Desertification and Drought Day', icon: '🏜️', month: 6, day: 17, line: 'Land that dries out and turns to desert feeds no one.', task: 'Give to the Sahel or the Horn of Africa.', go: '/events/regions' },
  { id: 'waste', name: 'Food Loss and Waste Day', icon: '🧺', month: 9, day: 29, line: 'A large share of food is lost between the field and the plate.', task: 'Pick better storage for your harvest.', go: '/storage' },
  { id: 'disaster', name: 'Day for Disaster Risk Reduction', icon: '🛟', month: 10, day: 13, line: 'Getting ready before a flood or a drought saves lives and harvests.', task: 'Look at the climate shocks your farm has met.', go: '/climate/shocks' },
  { id: 'rural', name: 'International Day of Rural Women', icon: '👩🏾‍🌾', month: 10, day: 15, line: 'Women grow a large share of Africa’s food.', task: 'Book a farmer training course.', go: '/training' },
  { id: 'food', name: 'World Food Day', icon: '🍲', month: 10, day: 16, line: 'A day for a world where everyone has enough good food.', task: 'Donate to the World Food Programme or another organisation.', go: '/events/donate' },
  { id: 'soil', name: 'World Soil Day', icon: '🪱', month: 12, day: 5, line: 'Healthy soil grows healthy food, and stores carbon.', task: 'See your farm’s soil on Climate.', go: '/climate/water-and-soil' },
];

/** Days either side of a special day's date while it is on. */
export const DAY_SPAN = 3;

const MS = 86400000;
const at = (date: string) => Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));

/** A special day's next date on or after `today` minus its span (so one that is on now has its date this time round). */
export function nextDate(d: SpecialDay, today = achClock.today()): string {
  const y = +today.slice(0, 4);
  for (const year of [y - 1, y, y + 1]) {
    const t = Date.UTC(year, d.month - 1, d.day);
    if (t + DAY_SPAN * MS >= at(today)) return new Date(t).toISOString().slice(0, 10);
  }
  return `${y + 1}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}

/** Days from today to a special day's date (negative once it has passed but is still on). */
export const daysTo = (d: SpecialDay, today = achClock.today()) => Math.round((at(nextDate(d, today)) - at(today)) / MS);

export const isOn = (d: SpecialDay, today = achClock.today()) => Math.abs(daysTo(d, today)) <= DAY_SPAN;

/** The special days that are on today. */
export const daysOn = (today = achClock.today()) => DAYS.filter(d => isOn(d, today));

/** Every special day, soonest first (the ones on now at the top). */
export const daysAhead = (today = achClock.today()) => [...DAYS].sort((a, b) => daysTo(a, today) - daysTo(b, today));
