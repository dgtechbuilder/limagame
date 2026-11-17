import type { GameState } from '../state';
import { emptyField, setupLeft } from '../world/field';
import type { FarmSignal } from './model';

/** What the player's own six farms say about the season, for the tractor business: are they in their planting window
    (being planned, cleared or sown), and what rain is forecast. A planting window and rain on the way make the
    territory's land preparation and planting more urgent; a dry season, the harvest and transport. */
export function farmSignal(s: Pick<GameState, 'trial' | 'field'>): FarmSignal {
  const t = s.trial;
  if (!t) return { planting: true, forecast: 'normal' };
  const f = s.field.cycle === t.cycle ? s.field : emptyField(t.cycle);
  const sowing = t.phase === 'growing' && t.plans.some((_, i) => {
    const left = setupLeft(f, t, i);
    return left === 'prep' || left === 'sow';
  });
  return { planting: t.phase === 'plan' || sowing, forecast: t.forecast };
}
