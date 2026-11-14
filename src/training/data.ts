/* Farmer training: short courses the player can book a seat on. A booking is kept with the save and written into
   Messages as a reminder. Dates count from the day the course list is opened, so there is always one coming up.
   Hosts and places are the game's own (no real organisation is named). Prices are game coins, shown 10 times larger. */

export interface Course {
  id: string;
  title: string;
  /** what the player learns, in one line */
  learn: string;
  host: string;
  place: string;
  /** days from today */
  inDays: number;
  time: string;
  hours: number;
  seats: number;
  /** coins, as stored; 0 is free */
  price: number;
  bring: string;
  icon: string;
}

export const COURSES: Course[] = [
  {
    id: 'soil',
    title: 'Healthy soil, bigger harvests',
    learn: 'Test your soil, use manure and lime, and feed the crop at the right time.',
    host: 'Ward extension officer',
    place: 'Demo farm, Kiambu road',
    inDays: 3,
    time: '9:00 am',
    hours: 3,
    seats: 20,
    price: 0,
    bring: 'A cup of soil from your farm and a notebook',
    icon: '🌱',
  },
  {
    id: 'pests',
    title: 'Scouting pests early',
    learn: 'Walk your rows, spot fall armyworm and aphids, and treat only what needs it.',
    host: 'Lima field trainer',
    place: 'Co-op hall',
    inDays: 5,
    time: '10:00 am',
    hours: 2,
    seats: 25,
    price: 0,
    bring: 'Your phone, for photos of leaves',
    icon: '🐛',
  },
  {
    id: 'storage',
    title: 'Storing grain without losses',
    learn: 'Dry, sort and store maize so mould and weevils do not take the profit.',
    host: 'Cooperative warehouse team',
    place: 'Cooperative warehouse',
    inDays: 8,
    time: '2:00 pm',
    hours: 2,
    seats: 15,
    price: 50,
    bring: 'A sample bag of last season’s grain',
    icon: '🌽',
  },
  {
    id: 'money',
    title: 'Farm records and loans',
    learn: 'Keep simple records, price your harvest, and work out what a loan really costs.',
    host: 'Farm business coach',
    place: 'On your phone (online)',
    inDays: 10,
    time: '6:30 pm',
    hours: 1.5,
    seats: 40,
    price: 30,
    bring: 'Last season’s costs and sales, if you have them',
    icon: '📒',
  },
];

export const courseOf = (id: string) => COURSES.find(c => c.id === id);

/** A booking: the course, its date (YYYY-MM-DD) and the reference for the seat. */
export interface TrainingBooking {
  id: string;
  date: string;
  ref: string;
}

/** The course's date, counted from a given day (YYYY-MM-DD). */
export function courseDate(c: Course, from: string) {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + c.inDays);
  return d.toISOString().slice(0, 10);
}

/** e.g. "Thu 19 Nov" */
export function dayText(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** A short seat reference, the same for the same course and date: LIMA-SOIL-1119 */
export function bookingRef(c: Course, date: string) {
  return `LIMA-${c.id.toUpperCase().slice(0, 4)}-${date.slice(5, 7)}${date.slice(8, 10)}`;
}

/** Seats left: a few are taken already, more the closer the day. */
export const seatsLeft = (c: Course, booked: boolean) => Math.max(1, c.seats - Math.round(c.seats * (0.75 - c.inDays * 0.05)) - (booked ? 1 : 0));
