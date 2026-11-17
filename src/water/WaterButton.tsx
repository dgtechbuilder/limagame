import type { Dispatch } from 'react';
import type { Action, GameState } from '../state';
import { WATER } from './config';
import { capacityOf, tankOf } from './model';

/** The tank on the farm's HUD: its level at a glance; tap it for Climate › Water. */
export function WaterButton({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const tank = tankOf(s.tank);
  const cap = capacityOf(s);
  const share = Math.max(0, Math.min(1, tank.level / cap));
  const low = share < WATER.tank.low;
  return (
    <button
      type="button"
      className={`hud-round hud-water${low ? ' is-low' : ''}`}
      onClick={() => dispatch({ type: 'open', modal: { kind: 'climate', tab: 'tank' } })}
      aria-label={`Water tank: ${Math.round(tank.level).toLocaleString('en-US')} of ${cap.toLocaleString('en-US')} litres${low ? ', low' : ''}`}
    >
      <span className="hud-water-tank" aria-hidden="true">
        <i style={{ height: `${share * 100}%` }} />
        <b>{Math.round(share * 100)}%</b>
      </span>
      <span>WATER</span>
    </button>
  );
}
