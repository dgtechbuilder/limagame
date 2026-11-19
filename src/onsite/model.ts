import type { Dispatch } from 'react';
import type { Fx } from '../world/engine';
import type { Action, GameState } from '../state';
import { CARE, COOPS, ISSUES, PREVENT, SHEDS, careOf, issueOf, type CareId } from '../livestock/config';
import { careDoneToday, careDue, careOpen, countOf, lifeOf } from '../livestock/model';
import { POWER_STEPS } from '../power/config';
import { measureOf } from '../security/config';
import { SHOP_TABS } from '../data';
import { COOP, COW_MILK, COW_TROUGH, DELIVERY, FENCE_SPOTS, GARDEN_SPOTS, HEN_FEED, KENNEL, LAMP_SPOTS, PEN, POWER_SPOTS, STORE, TANK_SITE, TRACTOR_SPOTS, type Spot } from './spots';

/* Jobs done on the farm (the walk and the work by hand). A button on a page (buy the inverter, feed the cows, repair
   the tractor) no longer changes the farm by itself in the 3D farm: the page closes, the farmer walks to the spot (or
   round several: every corner of the coop, every wheel of the tractor), and at each spot a button starts a short
   timer while the farmer works there. The page's action happens when the last spot is done (`then`), so nothing is
   paid or installed until the work is done; dropping the job leaves everything as it was. In the classic farm view
   (and before the first session is done) the button does what it always did. The job's steps for each action are
   `jobFor` below; World.tsx walks and plays them. */

export type JobTool = 'hoe' | 'sickle' | 'can' | 'wand' | 'hammer' | 'wrench' | 'bucket' | 'basket' | null;

export interface JobStop extends Spot {
  /** the words on the button at this spot, and over the timer */
  button: string;
  doing: string;
  secs: number;
  fx: Fx;
  tool: JobTool;
  /** x and z are in the tractor's own frame (x to its right, z forward), turned into farm points where it stands */
  anchor?: 'tractor';
  /** the cows or the hens come over while the farmer works here */
  gather?: { group: 'cows' | 'hens'; x: number; z: number };
}

export interface Job {
  id: number;
  /** one job per key at a time (care:cowFeed, power:inverter, hub:repair…) */
  key: string;
  title: string;
  /** where it is done, for the task card */
  where: string;
  icon: string;
  stops: JobStop[];
  /** stops done so far */
  done: number;
  /** the page's action, done when the last stop is */
  then?: Action;
  /** carried on the back to the first spot (a part or a tool bought) */
  crate?: boolean;
  points: number;
}

export type JobSpec = Omit<Job, 'id' | 'done'>;

/** Points for each job done by hand on the farm. */
export const JOB_POINTS = 5;
/** The most jobs waiting at once. */
export const JOBS_MAX = 6;

const stop = (s: Spot, button: string, doing: string, fx: Fx, tool: JobTool, secs = 2, extra: Partial<JobStop> = {}): JobStop => ({ ...s, button, doing, fx, tool, secs, ...extra });
const tractorStop = (k: keyof typeof TRACTOR_SPOTS, button: string, doing: string, fx: Fx, tool: JobTool, secs = 2): JobStop => ({ ...TRACTOR_SPOTS[k], anchor: 'tractor', button, doing, fx, tool, secs });

/** The jobs waiting on the farm, oldest first. */
export const jobsOf = (s: Pick<GameState, 'jobs'>) => s.jobs ?? [];

/** Jobs are walked on the 3D farm once the first session is done; elsewhere a page's button acts at once. */
export const onFarm = (s: Pick<GameState, 'view' | 'fs'>) => s.view === 'world' && s.fs.phase === 'done';

/** A page's button: on the 3D farm, the walk and the work first (when the action has a job); otherwise at once. */
export function act(s: GameState, dispatch: Dispatch<Action>, a: Action) {
  const spec = onFarm(s) ? jobFor(s, a) : null;
  if (spec) dispatch({ type: 'jobAdd', job: { ...spec, then: a } });
  else dispatch(a);
}

/** The job waiting for this key, if any (a page shows "on your list" instead of its button). */
export const jobWaiting = (s: Pick<GameState, 'jobs'>, key: string) => jobsOf(s).find(j => j.key === key) ?? null;

/* ---------------- the cows and the hens ---------------- */

const CARE_JOBS: Record<CareId, (s: GameState) => Omit<JobSpec, 'key' | 'title' | 'then' | 'points'>> = {
  cowFeed: () => ({
    where: 'the cow pen',
    icon: '🌾',
    stops: [
      stop(PEN.feedStore, 'Scoop the dairy meal', 'Scooping the dairy meal', 'hay', 'bucket'),
      stop(PEN.trough, 'Fill the feeder', 'Napier, hay and dairy meal in', 'hay', 'bucket', 2.5, { gather: { group: 'cows', ...COW_TROUGH } }),
    ],
  }),
  cowWater: () => ({ where: 'the cow pen', icon: '💧', stops: [stop(PEN.trough, 'Fill the trough', 'Filling the trough from the tank', 'water', 'bucket', 2.5, { gather: { group: 'cows', ...COW_TROUGH } })] }),
  milk: () => ({
    where: 'the cow pen',
    icon: '🥛',
    stops: [stop(PEN.milk, 'Wash and milk', 'Washing the udder, then milking', 'milk', 'bucket', 3, { gather: { group: 'cows', ...COW_MILK } })],
  }),
  pen: () => ({
    where: 'the cow pen',
    icon: '🧹',
    stops: [stop(PEN.west, 'Muck out', 'Mucking out this corner', 'dig', 'hoe'), stop(PEN.east, 'Fresh bedding', 'Spreading dry bedding', 'mulch', 'hoe'), stop(PEN.trough, 'Look for ticks', 'Looking the cows over for ticks', 'clear', null)],
  }),
  henFeed: () => ({
    where: 'the chicken coop',
    icon: '🌽',
    stops: [stop(COOP.feedBin, 'Scoop the layers mash', 'Scooping the mash', 'seed', 'bucket'), stop(COOP.feed, 'Scatter the feed', 'Feeding the hens', 'seed', 'bucket', 2, { gather: { group: 'hens', ...HEN_FEED } })],
  }),
  henWater: () => ({ where: 'the chicken coop', icon: '💧', stops: [stop(COOP.drinker, 'Wash and refill', 'Washing the drinker and refilling it', 'water', 'can')] }),
  eggs: () => ({ where: 'the chicken coop', icon: '🥚', stops: [stop(COOP.nest, 'Collect the eggs', 'Taking the eggs from the nest boxes', 'harvest', 'basket', 2.5)] }),
  coopClean: () => ({ where: 'the chicken coop', icon: '🧹', stops: [stop(COOP.west, 'Rake out the litter', 'Raking out the wet litter', 'mulch', 'hoe'), stop(COOP.nest, 'Fresh litter in', 'Spreading dry litter, scrubbing perches', 'mulch', 'hoe')] }),
  closeCoop: () => ({ where: 'the chicken coop', icon: '🔒', stops: [stop(COOP.door, 'Shut the coop', 'Counting the hens in, door shut', 'clear', null, 1.5)] }),
};

/** A day's care for the cows or the hens: the steps at the pen or the coop. */
export function careJob(s: GameState, id: CareId): JobSpec {
  const c = careOf(id);
  return { key: `care:${id}`, title: c.label, points: JOB_POINTS, ...CARE_JOBS[id](s) };
}

/** Today's care still to do, cows first (what the chores chip counts and walks to next). */
export function choresLeft(s: GameState): CareId[] {
  if (!careOpen(s)) return [];
  const l = lifeOf(s.life);
  return CARE.filter(c => countOf(s, c.group) > 0 && careDue(s, c.id) && !careDoneToday(s, c.id) && !(c.id === 'closeCoop' && !l.coop)).map(c => c.id);
}

/** Today's care for each group: done of all due today. */
export function choresCount(s: GameState) {
  if (!careOpen(s)) return null;
  const l = lifeOf(s.life);
  const due = CARE.filter(c => countOf(s, c.group) > 0 && (careDue(s, c.id) || careDoneToday(s, c.id)) && !(c.id === 'closeCoop' && !l.coop));
  const of = (g: 'cows' | 'hens') => {
    const all = due.filter(c => c.group === g);
    return { done: all.filter(c => careDoneToday(s, c.id)).length, all: all.length };
  };
  return { cows: of('cows'), hens: of('hens') };
}

/* ---------------- every action with a job on the farm ---------------- */

/** The walk and the work for a page's action, or null when it is done at once (a choice, a quiz, a setting). */
export function jobFor(s: GameState, a: Action): JobSpec | null {
  switch (a.type) {
    case 'animalCare':
      return careJob(s, a.id);
    case 'animalPrevent': {
      const p = PREVENT.find(x => x.id === a.id)!;
      const atPen = p.group !== 'hens';
      const atCoop = p.group !== 'cows';
      const stops = [
        ...(atPen ? [stop(PEN.milk, p.id === 'dip' ? 'Spray for ticks' : p.id === 'deworm' ? 'Dose the cows' : 'Vaccinate', p.id === 'dip' ? 'Spraying each cow' : 'Treating each cow', p.id === 'dip' ? 'spray' : 'milk', p.id === 'dip' ? 'wand' : null, 2.5, { gather: { group: 'cows' as const, ...COW_MILK } })] : []),
        ...(atCoop ? [stop(COOP.feed, p.id === 'deworm' ? 'Dose the hens' : 'Vaccinate the hens', 'Treating each hen', 'milk', null, 2.5, { gather: { group: 'hens' as const, ...HEN_FEED } })] : []),
      ];
      return { key: `prevent:${a.id}`, title: p.label, where: atPen && atCoop ? 'the pen and the coop' : atPen ? 'the cow pen' : 'the chicken coop', icon: '💉', stops, points: JOB_POINTS };
    }
    case 'coopBuild': {
      const c = COOPS.find(x => x.id === a.id)!;
      const l = lifeOf(s.life);
      return {
        key: 'coop',
        title: `${l.coop ? 'Upgrade to' : 'Build'} the ${c.name.toLowerCase()}`,
        where: 'the chicken coop',
        icon: '🔨',
        crate: true,
        stops: [stop(COOP.west, 'Set the posts', 'Setting the posts and the frame', 'stone', 'hammer'), stop(COOP.nest, 'Nail the walls', 'Nailing the walls and nest boxes', 'stone', 'hammer'), stop(COOP.door, 'Hang the door', 'Hanging the door, roof on', 'stone', 'hammer')],
        points: JOB_POINTS * 2,
      };
    }
    case 'shedBuild': {
      const c = SHEDS.find(x => x.id === a.id)!;
      return {
        key: 'shed',
        title: `Build the ${c.name.toLowerCase()}`,
        where: 'the cow pen',
        icon: '🔨',
        crate: true,
        stops: [stop(PEN.shed, 'Raise the posts', 'Raising the posts', 'stone', 'hammer'), stop(PEN.east, 'Roof sheets on', 'Nailing the roof sheets', 'stone', 'hammer'), stop(PEN.west, 'Gutters and stalls', 'Fitting the gutters and stalls', 'stone', 'hammer')],
        points: JOB_POINTS * 2,
      };
    }
    case 'herdBuy': {
      const n = Math.abs(a.n);
      const what = a.group === 'cows' ? (n === 1 ? 'cow' : 'cows') : n === 1 ? 'hen' : 'hens';
      const home = a.group === 'cows' ? PEN.milk : COOP.feed;
      return a.n > 0
        ? { key: `herd:${a.group}`, title: `Bring the new ${what} home`, where: a.group === 'cows' ? 'the farm gate, then the pen' : 'the farm gate, then the coop', icon: a.group === 'cows' ? '🐄' : '🐔', stops: [stop(DELIVERY, `Meet the ${what}`, 'Paying the seller, checking each animal', 'clear', null), stop(home, `Let the ${what} in`, `Settling the ${what} in`, 'clear', null)], points: JOB_POINTS }
        : { key: `herd:${a.group}`, title: `Take the ${what} to the buyer`, where: 'the farm gate', icon: a.group === 'cows' ? '🐄' : '🐔', stops: [stop(home, `Lead the ${what} out`, `Bringing the ${what} out`, 'clear', null), stop(DELIVERY, 'Hand over', 'Handing over to the buyer', 'clear', null)], points: JOB_POINTS };
    }
    case 'powerInstall':
      return powerJob(a.id);
    case 'tractorHub':
      return hubJob(s, a.section);
    case 'securityBuy':
      return securityJob(a.id);
    case 'gardenWater': {
      const name = a.farm === 0 ? 'Farm 7' : 'Farm 8';
      return { key: `garden:${a.farm}:water`, title: `Water ${name}`, where: name, icon: '💧', stops: GARDEN_SPOTS(a.farm).map((sp, k) => stop(sp, k ? 'Water the next bed' : 'Water the first bed', 'Watering at the roots', 'water', 'can', 1.5)), points: JOB_POINTS };
    }
    case 'buy':
      return shopJob(a.id, a.name);
    default:
      return null;
  }
}

function powerJob(id: (typeof POWER_STEPS)[number]['id']): JobSpec {
  const st = POWER_STEPS.find(x => x.id === id)!;
  const P = POWER_SPOTS;
  const stops: Record<string, JobStop[]> = {
    panels: [stop(P.panelsW, 'Bolt the frame down', 'Bolting the frame to its feet', 'stone', 'wrench'), stop(P.panelsS1, 'Lift the panels on', 'Clamping the panels on', 'spark', 'wrench'), stop(P.panelsS2, 'Tilt and tighten', 'Tilting to face the sun, tightening', 'spark', 'wrench')],
    inverter: [stop(P.inverter, 'Mount the inverter', 'Bolting the inverter to the wall', 'stone', 'hammer'), stop(P.hut, 'Run the cables', 'Running the cables from the panels', 'spark', 'wrench', 2.5)],
    battery: [stop(P.battery, 'Set the batteries down', 'Setting the batteries on the rack', 'stone', null), stop(P.hut, 'Connect to the inverter', 'Fuse first, then the cables', 'spark', 'wrench', 2.5)],
    lights: LAMP_SPOTS.map((sp, k) => stop(sp, `Fit light ${k + 1}`, 'Fitting the light to the pole', 'spark', 'wrench', 1.5)),
    generator: [stop(P.generator, 'Bolt the generator down', 'Bolting it on the slab', 'stone', 'wrench'), stop(P.hut, 'Wire the changeover', 'Wiring the changeover switch', 'spark', 'wrench')],
    fuel: [stop(P.fuel, 'Stand the tank up', 'Levelling the tank on its stand', 'stone', 'wrench'), stop(P.fuel, 'Fill it', 'Pouring the first diesel in', 'oil', 'bucket', 2.5)],
    switchOn: [stop(P.hut, 'Throw the main switch', 'Checking every breaker, then on', 'spark', null, 2)],
  };
  return {
    key: `power:${id}`,
    title: id === 'switchOn' ? 'Switch on the power' : `Put in the ${st.name.toLowerCase()}`,
    where: id === 'lights' ? 'the light poles' : 'the power yard',
    icon: st.icon,
    crate: id !== 'switchOn' && id !== 'lights',
    stops: stops[id],
    points: JOB_POINTS * 2,
  };
}

function hubJob(s: GameState, section: string): JobSpec | null {
  switch (section) {
    case 'service':
      return {
        key: 'hub:service',
        title: 'Service the tractor',
        where: 'the tractor',
        icon: '🛢',
        stops: [tractorStop('front', 'Change the oil', 'Draining and refilling the oil', 'oil', 'wrench', 2.5), tractorStop('left', 'Grease the wheels', 'Greasing the wheel nipples', 'oil', 'wrench'), tractorStop('right', 'New filters', 'Fitting the air and fuel filters', 'oil', 'wrench')],
        points: JOB_POINTS,
      };
    case 'repair':
      return {
        key: 'hub:repair',
        title: 'Repair the tractor',
        where: 'the tractor',
        icon: '🔧',
        crate: true,
        stops: [tractorStop('front', 'Fix the engine', 'Fitting the new parts in the engine', 'spark', 'wrench', 2.5), tractorStop('left', 'Fix the left wheel', 'Tightening the wheel nuts', 'stone', 'wrench'), tractorStop('back', 'Fix the hitch', 'Mending the three-point hitch', 'spark', 'hammer'), tractorStop('right', 'Fix the right wheel', 'Patching the tyre, pumping it up', 'stone', 'wrench')],
        points: JOB_POINTS * 2,
      };
    case 'refuel': {
      const fromTank = !!(s.power as { parts?: Record<string, unknown> } | undefined)?.parts?.fuel;
      return {
        key: 'hub:refuel',
        title: 'Refuel the tractor',
        where: fromTank ? 'the diesel tank, then the tractor' : 'the tractor',
        icon: '⛽',
        stops: [...(fromTank ? [stop(POWER_SPOTS.fuel, 'Fill the jerrycans', 'Filling the jerrycans', 'oil', 'bucket')] : []), tractorStop('left', 'Pour the diesel', 'Pouring steadily into the tank', 'oil', 'bucket', 2.5)],
        points: JOB_POINTS,
      };
    }
    case 'safety':
      return {
        key: 'hub:safety',
        title: 'Walk round the tractor',
        where: 'the tractor',
        icon: '🦺',
        stops: [tractorStop('front', 'Oil and water', 'Checking the oil and the water', 'oil', null, 1.2), tractorStop('left', 'Tyres', 'Checking the tyres', 'stone', null, 1.2), tractorStop('back', 'Hitch pins', 'Checking the hitch pins', 'stone', null, 1.2), tractorStop('right', 'All clear', 'Nobody near: all clear', 'clear', null, 1.2)],
        points: JOB_POINTS,
      };
    default:
      return null;
  }
}

function securityJob(id: Parameters<typeof measureOf>[0]): JobSpec | null {
  const m = measureOf(id);
  const make = (where: string, icon: string, stops: JobStop[]): JobSpec => ({ key: `security:${id}`, title: m.name, where, icon, stops, crate: true, points: JOB_POINTS });
  switch (id) {
    case 'locks':
      return make('the shed', '🔒', [stop(STORE, 'Fit the padlocks', 'Fitting hasps and padlocks', 'stone', 'hammer', 2.5)]);
    case 'taplock':
      return make('the water tank', '🔒', [stop(TANK_SITE, 'Lock the tap', 'Fitting the lock on the tap', 'stone', 'wrench')]);
    case 'tags':
      return { ...make('the cow pen', '🏷', [stop(PEN.milk, 'Tag the cows', 'Ear-tagging and branding each cow', 'stone', null, 2.5, { gather: { group: 'cows', ...COW_MILK } })]), crate: false };
    case 'dog':
      return make('the farmhouse', '🐕', [stop(KENNEL, 'Build the kennel', 'Building the dog’s kennel', 'stone', 'hammer', 2.5)]);
    case 'light':
      return make('the light pole', '💡', [stop(LAMP_SPOTS[0], 'Fit the security light', 'Fitting the light and its panel', 'spark', 'wrench', 2.5)]);
    case 'fence':
      return make('the farm’s fence', '🚧', FENCE_SPOTS.map((sp, k) => stop(sp, k < 2 ? 'Hang the gate' : 'Mend the fence', k < 2 ? 'Hanging the gate, fitting the lock' : 'Stretching the wire, new posts', 'stone', 'hammer', 2)));
    case 'gps':
      return make('the tractor', '📡', [tractorStop('front', 'Fit the tracker', 'Hiding the GPS tracker in the cab', 'spark', 'wrench', 2), tractorStop('left', 'Locking fuel cap', 'Fitting the locking fuel cap', 'stone', 'wrench', 1.5)]);
    default:
      return null;
  }
}

function shopJob(id: string, name: string): JobSpec | null {
  const tab = SHOP_TABS.find(t => t.items.some(i => i.id === id))?.id;
  if (tab === 'tank')
    return { key: `shop:${id}`, title: `Put up the ${name.toLowerCase()} tank`, where: 'the farm gate, then the tank stand', icon: '🛢', stops: [stop(DELIVERY, 'Unload the tank', 'Rolling the tank off the lorry', 'stone', null), stop(TANK_SITE, 'Stand it and plumb it in', 'Levelling the stand, fitting the pipes', 'water', 'wrench', 2.5)], points: JOB_POINTS };
  if (tab === 'fertilizer' || tab === 'equipment')
    return { key: `shop:${id}`, title: `Store the ${name.toLowerCase()}`, where: 'the farm gate, then the shed', icon: '📦', crate: false, stops: [stop(DELIVERY, 'Collect it', 'Collecting it from the delivery', 'stone', null), stop(STORE, 'Put it in the shed', 'Stacking it in the shed', 'stone', null, 1.5)], points: JOB_POINTS };
  return null;
}

/** After a right fix for a sick animal: give it on the spot (the fix is chosen on the page, as a quiz). */
export function treatJob(issue: (typeof ISSUES)[number]['id'], fix: string): JobSpec {
  const def = issueOf(issue);
  const f = def.fixes.find(x => x.id === fix);
  const cows = def.group === 'cows';
  const leak = issue === 'leak';
  return {
    key: `treat:${issue}`,
    title: leak ? 'Fix the trough’s valve' : `Treat the ${def.group}`,
    where: cows ? 'the cow pen' : 'the chicken coop',
    icon: leak ? '🔧' : '💊',
    stops: [stop(leak ? PEN.trough : cows ? PEN.milk : COOP.feed, leak ? 'Fix the valve' : 'Give the treatment', f?.label ?? 'Treating', leak ? 'water' : 'milk', leak ? 'wrench' : null, 2.5, leak ? {} : { gather: cows ? { group: 'cows', ...COW_MILK } : { group: 'hens', ...HEN_FEED } })],
    points: JOB_POINTS,
  };
}
