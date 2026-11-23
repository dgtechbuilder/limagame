import { IMPL, type ImplId } from './data';

/* Train: the tractor school. Each drill is one job on the farm (plough, harrow, ridge, plant, sow, spread, weed,
   spray, harvest) and one row of a field to drive. The farmer picks any implement from the rack, drives the row
   from above round the rocks and trees, and at the end of the row is told how it went: the wrong implement fails
   the row (with a hint, then the answer), too many knocks fail it too. The right implement, driven cleanly,
   passes. No screens here (TrainField.tsx draws it), so tests and the saved game can use it. */

/** How the field looks before the job. */
export type TrainGround = 'stubble' | 'clods' | 'seedbed' | 'weedy' | 'young' | 'ripeMaize' | 'dryBeans';

export interface Drill {
  id: string;
  /** the job, one word, for the list */
  verb: string;
  /** what to do on this row, as the instructor says it */
  task: string;
  /** the right implement */
  tool: ImplId;
  ground: TrainGround;
  /** after one wrong try: what the job needs, without naming the implement */
  hint: string;
  /** after a pass: why this implement is the one */
  lesson: string;
  icon: string;
}

export const DRILLS: Drill[] = [
  { id: 'plough', verb: 'Plough', icon: '🟫', tool: 'plough', ground: 'stubble', task: 'Plough this row: the ground is hard and full of last season’s stalks.', hint: 'You need big steel discs that cut deep and turn the soil right over.', lesson: 'The disc plough turns hard soil over and buries old stalks and weeds.' },
  { id: 'harrow', verb: 'Harrow', icon: '🟤', tool: 'harrow', ground: 'clods', task: 'Harrow this row: it is ploughed, but full of big clods.', hint: 'You need rows of small discs that run shallow and break clods into fine soil.', lesson: 'The disc harrow breaks clods into a fine, level seedbed, so seeds come up together.' },
  { id: 'ridge', verb: 'Ridge', icon: '〰️', tool: 'ridger', ground: 'seedbed', task: 'Make ridges and furrows along this row for the water to run in.', hint: 'You need a pair of curved bodies that throw soil to each side into a ridge.', lesson: 'The ridger digs a furrow and heaps a ridge: water runs along it to the roots.' },
  { id: 'plantMaize', verb: 'Plant maize', icon: '🌽', tool: 'planter', ground: 'seedbed', task: 'Plant maize along this row: one seed at a time, at the right spacing.', hint: 'You need units that drop big seeds one by one into wide rows, with fertilizer.', lesson: 'The maize planter drops one seed at a time, spaced out, with fertilizer beside it.' },
  { id: 'sowBeans', verb: 'Sow beans', icon: '🫘', tool: 'drill', ground: 'seedbed', task: 'Sow beans along this row, in close rows.', hint: 'You need a long seed box that feeds small seed down many tubes in close rows.', lesson: 'The seed drill sows small seeds such as beans in many close rows at once.' },
  { id: 'spread', verb: 'Spread fertilizer', icon: '⚪', tool: 'spreader', ground: 'seedbed', task: 'Spread fertilizer evenly over this row before planting.', hint: 'You need a hopper with a spinning disc underneath that throws granules wide.', lesson: 'The spreader’s spinning disc throws fertilizer evenly over a wide strip.' },
  { id: 'weed', verb: 'Weed', icon: '🌿', tool: 'cultivator', ground: 'weedy', task: 'Weeds are coming up between the young maize. Weed this row without spraying.', hint: 'You need spring tines that run between the crop rows and pull weeds out.', lesson: 'The inter-row cultivator’s tines rip weeds out between the rows and leave the maize.' },
  { id: 'spray', verb: 'Spray', icon: '💧', tool: 'sprayer', ground: 'young', task: 'Fall armyworm in the young maize: spray this row.', hint: 'You need a tank and a long boom of nozzles that mist the crop.', lesson: 'The boom sprayer mists the crop evenly. Spray when it is calm, with gloves and a mask on.' },
  { id: 'harvestMaize', verb: 'Harvest maize', icon: '🌾', tool: 'maizeH', ground: 'ripeMaize', task: 'The maize is dry and ready: harvest this row.', hint: 'You need a header in front with pointed dividers that pick the cobs row by row.', lesson: 'The maize harvester picks the cobs row by row and shells the grain.' },
  { id: 'harvestBeans', verb: 'Harvest beans', icon: '🍂', tool: 'beanH', ground: 'dryBeans', task: 'The bean plants are dry: harvest this row.', hint: 'You need a wide header in front with a turning reel that cuts the plants low.', lesson: 'The bean harvester cuts the dry plants low and threshes the beans out.' },
];

export const drillOf = (id: string) => DRILLS.find(d => d.id === id);

/** The implements on the rack, in the order they hang. */
export const RACK: ImplId[] = ['plough', 'harrow', 'ridger', 'planter', 'drill', 'spreader', 'cultivator', 'sprayer', 'maizeH', 'beanH'];

/** How the course plays: one row, slow enough to learn on. Distances are field pixels. */
export const COURSE = {
  /** the row's length, and how fast the tractor drives up it (a trained driver a little faster) */
  rowLength: 420,
  speed: 24,
  /** sideways speed while a steering button is held */
  steer: 58,
  /** the field is this wide; the row to work runs up the middle, this wide */
  width: 240,
  row: [92, 148] as [number, number],
  /** a knock costs this much of the score; more knocks than this fails the row */
  perHit: 0.2,
  maxHits: 2,
  /** the score a pass needs */
  pass: 0.5,
  /** how long the tractor stalls after a knock (seconds) */
  stall: 0.7,
};

/** How wide each implement is drawn and works, in field pixels (a wide boom needs room past the trees). */
export const WIDTH: Record<ImplId, number> = { plough: 34, harrow: 44, ridger: 30, planter: 42, drill: 46, cultivator: 42, spreader: 50, sprayer: 76, maizeH: 44, beanH: 50 };

export type Obstacle = { k: 'rock' | 'tree' | 'stump'; x: number; y: number; r: number };

/** The rocks and trees on a drill's row: the same each time for a drill and try, different on the next try. Field y
    runs from 0 (the far end) to rowLength (the start). */
export function obstaclesFor(drill: number, attempt: number): Obstacle[] {
  let seed = (drill + 1) * 9301 + attempt * 49297 + 233;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const out: Obstacle[] = [];
  const kinds: Obstacle['k'][] = ['rock', 'tree', 'rock', 'stump'];
  // four in the way, spread up the row, each a little to one side so there is always a way round
  for (let i = 0; i < 4; i++) {
    const k = kinds[(i + drill + attempt) % kinds.length];
    const side = (i + drill + attempt) % 2 ? 1 : -1;
    out.push({ k, x: 120 + side * (6 + rnd() * 22), y: 330 - i * 78 - rnd() * 20, r: k === 'tree' ? 15 : k === 'stump' ? 8 : 9 });
  }
  // trees along both edges of the field
  for (let y = 20; y < COURSE.rowLength + 80; y += 70 + Math.round(rnd() * 30)) {
    out.push({ k: 'tree', x: 8 + rnd() * 10, y, r: 14 });
    out.push({ k: 'tree', x: COURSE.width - 8 - rnd() * 10, y: y + 30, r: 14 });
  }
  return out;
}

export interface RowResult {
  drill: string;
  tool: ImplId;
  right: boolean;
  hits: number;
  /** the share of the row driven inside the row's lines */
  inRow: number;
  /** 0 to 1: nothing when the implement is wrong */
  score: number;
  pass: boolean;
  /** why, in one or two lines */
  title: string;
  text: string;
}

/** How a row went. wrongTries: wrong implements already tried on this drill (the second wrong try names the
    right implement). */
export function judgeRow(drill: Drill, tool: ImplId, hits: number, inRow: number, wrongTries: number): RowResult {
  const right = tool === drill.tool;
  const quality = Math.max(0, 1 - COURSE.perHit * hits) * (0.6 + 0.4 * Math.max(0, Math.min(1, inRow)));
  const score = right ? Math.round(quality * 100) / 100 : 0;
  const base = { drill: drill.id, tool, right, hits, inRow, score };
  const used = IMPL[tool].name;
  if (!right) {
    const why = `The ${used.toLowerCase()} ${IMPL[tool].does.charAt(0).toLowerCase()}${IMPL[tool].does.slice(1)}`;
    const help = wrongTries >= 1 ? `This job needs the ${IMPL[drill.tool].name.toLowerCase()}.` : drill.hint;
    return { ...base, pass: false, title: `Failed: the ${used.toLowerCase()} can’t ${drill.verb.toLowerCase()}`, text: `${why} ${help} Try again with another implement.` };
  }
  if (hits > COURSE.maxHits) return { ...base, pass: false, title: `Right implement, but ${hits} knocks`, text: `The ${used.toLowerCase()} is right, but you hit ${hits} rocks and trees. Look ahead: steer round them early, then come back into the row.` };
  if (score < COURSE.pass) return { ...base, pass: false, title: 'Right implement, but off the row', text: `Most of the row was missed. Keep between the white lines, and only step out to get round something.` };
  return { ...base, pass: true, title: `Passed: ${drill.verb} with the ${used.toLowerCase()}`, text: `${drill.lesson}${hits ? ` ${hits} knock${hits === 1 ? '' : 's'}: steer earlier next time.` : ' No knocks: clean driving.'}` };
}
