import type { Dispatch } from 'react';
import { achClock } from '../achievements/track';
import type { Action, GameState } from '../state';
import type { CsaId } from './data';
import { practiceOf } from './data';
import { clockNow, csaOf, drillDone, drillOf, drillStreak, fieldClock } from './model';

/* The farm's CLIMATE-SMART chip, with the daily chips (the animals' care, the tidy-up): today's climate-smart drill,
   and the field clock (what the hour on the phone's clock is good for). Tap it to do today's drill. */

const SHORT: Record<CsaId, string> = { halfmoon: 'Half-moons', water: 'Save water', clock: 'Time of day', zai: 'Zaï pits', pushpull: 'Push-pull', fmnr: 'Kisiki hai', seeds: 'Seed mix', rest: 'Rest the land' };

export function CsaChip({ s, dispatch, now }: { s: GameState; dispatch: Dispatch<Action>; now: number }) {
  void now; // re-drawn every second by the farm, so the field clock follows the phone's clock
  const today = achClock.today();
  const c = csaOf(s.csa);
  const id = drillOf(today);
  const done = drillDone(c, today);
  const streak = drillStreak(c, today);
  const clock = clockNow(fieldClock.hour());
  return (
    <button
      type="button"
      className={`hud-csa${done ? ' is-done' : ''}`}
      onClick={() => dispatch({ type: 'open', modal: { kind: 'climate', tab: 'csa', practice: id, daily: true } })}
      aria-label={`Climate-smart: today's drill, ${practiceOf(id).name}${done ? ', done' : ''}. Field clock: ${clock.label}: ${clock.tip}`}
      title={clock.tip}
    >
      <b className="hud-tidy-head">{done ? '✓ Climate-smart' : 'Climate-smart'}</b>
      <span className="hud-tidy-row">
        <span className={done ? 'is-full' : ''}>
          {practiceOf(id).icon} {SHORT[id]}
        </span>
        <span className={clock.work === 'good' ? 'is-cool' : clock.work === 'hot' ? 'is-hot' : ''}>
          {clock.icon} {clock.short}
        </span>
      </span>
      {streak > 0 && <i className="hud-tidy-streak">🌿{streak}</i>}
    </button>
  );
}
