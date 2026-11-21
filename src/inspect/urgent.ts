import { achClock } from '../achievements/track';
import type { GameState } from '../state';
import { hubOf, HUB } from '../tractor/hub';
import { powerOf, has as powerHas, fuelTankL, servedShare } from '../power/model';
import { tidyLeft } from '../tidy/model';
import { WATER } from '../water/config';
import { capacityOf, tankOf } from '../water/model';
import type { SubjectId } from './types';

/* What is wrong right now, as the red parts of a full check of the farm's machines and places (the animals' red parts
   are their problems: src/livestock/exam.ts FINDINGS). Each comes from the game's own state: a tank under a fifth
   full, a worn tractor or one low on diesel, the generator's diesel low or a day the power fell short, today's bushes
   and rocks not cleared, a dry week for the maize. `mark` tells the drawing what to show. */

export interface Urgent {
  part: string;
  mark: string;
  title: string;
  see: string;
}

const L = (n: number) => `${Math.round(n).toLocaleString('en-US')} L`;

export function urgentOf(s: GameState, subject: SubjectId): Urgent[] {
  const out: Urgent[] = [];
  if (subject === 'water') {
    const level = tankOf(s.tank).level;
    const cap = capacityOf(s);
    if (level < cap * WATER.tank.low) out.push({ part: 'tank', mark: 'low', title: 'The tank is nearly empty', see: `${L(level)} left of ${L(cap)}: under a fifth. Buy water or cut what runs from it before the animals go thirsty.` });
  }
  if (subject === 'tractor') {
    const h = hubOf(s.hub);
    if (h.condition < 60) out.push({ part: 'oil', mark: 'worn', title: 'Worn: due a service', see: `Condition ${Math.round(h.condition)} of 100: black smoke and a rough idle. Under ${HUB.worn} it drives slower; at 0 it will not start.` });
    if (h.fuel < HUB.tankL * 0.2) out.push({ part: 'fuel', mark: 'fuel', title: 'Almost out of diesel', see: `${L(h.fuel)} left of ${L(HUB.tankL)}: refuel at the yard before the next job.` });
  }
  if (subject === 'power') {
    const p = powerOf(s.power);
    if (powerHas(s, 'fuel') && p.fuel < fuelTankL(s) * 0.2) out.push({ part: 'genFuel', mark: 'fuel', title: 'The diesel for the generator is low', see: `${L(p.fuel)} left: on a cloudy day the generator cannot cover the gap.` });
    if (p.history.length && servedShare(s) < 0.8) out.push({ part: 'inverter', mark: 'short', title: 'Power fell short yesterday', see: `It gave ${Math.round(servedShare(s) * 100)}% of what the farm needed: switch something off, or add panels or battery.` });
  }
  if (subject === 'farm' && s.fs.phase === 'done' && s.view === 'world') {
    const date = achClock.today();
    const left = s.tidy?.date === date ? tidyLeft(s.tidy, date).length : 0;
    if (left) out.push({ part: 'path', mark: 'tidy', title: `${left} bushes and rocks to clear today`, see: 'They turned up overnight by the paths and the lanes: clear them on the farm today.' });
  }
  if (subject === 'plant' && s.trial?.forecast === 'dry') out.push({ part: 'upper', mark: 'dry', title: 'Leaves rolling in the dry spell', see: 'A dry season: the leaves roll by mid-morning. Water at the roots and mulch to keep it in.' });
  return out;
}
