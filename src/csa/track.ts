/* The field clock on the farm (src/csa): after every action, work done by hand in the farm world is weighed against
   the hour on the phone's own clock, as the module's "right time of day" lesson teaches.

   - A dry farm watered by hand in the midday heat (11 am to 4 pm) loses more water to the sun: it comes out of the
     tank too. Watered in the cool of the morning or the evening, it earns points.
   - Any other job finished by hand: the cool hours earn points; in the midday heat or the dark the farmer is told,
     once a day, when the work is better done.
   The farm world sends the hour with each piece of work (fieldMark's `hour`); actions without it are not weighed. */

import { achClock } from '../achievements/track';
import type { Action, GameState } from '../state';
import { tankOf } from '../water/model';
import { CSA, clockNow, csaOf, wateringAt } from './model';

const hourText = (h: number) => (h === 0 ? '12 am' : h < 12 ? `${h} am` : h === 12 ? '12 pm' : `${h - 12} pm`);

export function trackCsa(prev: GameState, next: GameState, a: Action): GameState {
  if (a.type !== 'fieldMark' || a.hour === undefined) return next;
  // a job finished: the reducer says so (a treatment, a follow-up, the scheduled care)
  const finished = !!next.toast && next.toast !== prev.toast && !/^(You need|The tank has)/.test(next.toast.text);
  if (!finished) return next;
  const c = csaOf(next.csa);
  const today = achClock.today();
  const drawn = tankOf(prev.tank).level - tankOf(next.tank).level;
  const lines: string[] = [];
  let clock = { ...c.clock };
  let points = 0;
  let tank = next.tank;
  if (drawn > 0) {
    const w = wateringAt(a.hour, drawn);
    if (w.lost > 0) {
      const t = tankOf(next.tank);
      const lost = Math.min(t.level, w.lost);
      tank = { ...t, level: t.level - lost };
      clock = { ...clock, hot: clock.hot + 1, lost: clock.lost + lost };
      lines.push(`☀ ${hourText(a.hour)}: ${Math.round(lost)} L more lost to the sun. Water before 10 or after 4`);
    } else if (w.points) {
      points += w.points;
      clock = { ...clock, good: clock.good + 1 };
      lines.push(`${w.now.icon} watered in the cool: +${w.points} points`);
    }
  } else {
    const now = clockNow(a.hour);
    if (now.work === 'good') {
      points += CSA.coolPoints;
      clock = { ...clock, good: clock.good + 1 };
      lines.push(`${now.icon} done in the cool: +${CSA.coolPoints} points`);
    } else if (now.work === 'hot' || now.work === 'dark') {
      clock = now.work === 'hot' ? { ...clock, hot: clock.hot + 1 } : { ...clock, dark: clock.dark + 1 };
      if (clock.tipDate !== today) {
        clock = { ...clock, tipDate: today };
        lines.push(now.work === 'hot' ? `☀ ${hourText(a.hour)}: rest in the shade from noon to 3, and drink water` : '🌙 work in the light: crops and weeds look alike in the dark');
      }
    }
  }
  if (!lines.length && clock === c.clock) return next;
  return {
    ...next,
    tank,
    points: next.points + points,
    csa: { ...c, clock },
    toast: lines.length ? { id: next.toast!.id, text: `${next.toast!.text} · ${lines.join(' · ')}` } : next.toast,
  };
}
