import { LockTag, OpenLine } from '../unlock/Lock';
import { Info } from '../learn/Info';
import { isOpen } from '../unlock/model';
import type { Dispatch } from 'react';
import { money } from '../money';
import type { Action, GameState } from '../state';
import { plotsOf } from '../trials/model';
import { KIND_WORDS, OPTIONS, plotCost, type PlotKind } from './data';

/* At a shed spot (Seeds, Fertilizer, Sprayer): the button under the farmer opens every choice of that input. The one
   picked goes on every farm that can still take it (not yet sown, spread or sprayed), is kept for the next planting,
   and is picked up. */

const ITEM: Record<PlotKind, string> = { seed: 'Seeds', fert: 'Fertilizer', sprayer: 'Sprayer' };

export function ShedOptions({ s, of, dispatch, onClose }: { s: GameState; of: PlotKind; dispatch: Dispatch<Action>; onClose: () => void }) {
  const t = s.trial;
  const now = t && t.phase !== 'done' ? plotsOf(t, 0)[0]?.[of] : (s.prefs?.[of] ?? undefined);
  return (
    <div className="mg" role="dialog" aria-modal="true" aria-label={`${ITEM[of]}: choose`}>
      <div className="scrim" onClick={onClose} />
      <div className="mg-card" style={{ width: 640 }}>
        <header className="mg-head">
          <small>The shed</small>
          <b>{ITEM[of]}: choose one</b>
          <button type="button" className="mg-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p className="pg-lead" style={{ margin: '4px 0 8px' }}>
          {KIND_WORDS[of].rule} Your choice goes on every farm that can still take it, and on your next planting.
        </p>
        <OpenLine s={s} total={OPTIONS[of].length} />
        <div className="pg-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', overflowY: 'auto', maxHeight: 260 }}>
          {OPTIONS[of].map((o, i) => (
            <div key={o.id} className={`pg-card${now === o.id ? ' is-done' : ''}${isOpen(s, i) ? '' : ' is-gated'}`}>
              <div className="pg-card-head">
                <i aria-hidden="true" style={{ width: 12, height: 12, borderRadius: 4, background: o.color, display: 'inline-block' }} />
                <b>{o.name}</b>
                <Info term={o.name} />
              </div>
              <p>{o.does}</p>
              <p>
                <b>Best for:</b> {o.bestFor}
              </p>
              {isOpen(s, i) ? <button
                type="button"
                className="gold-btn"
                onClick={() => {
                  dispatch({ type: 'shedChoose', kind: of, id: o.id });
                  onClose();
                }}
                aria-label={`Choose ${o.name}`}
              >
                {now === o.id ? 'Take it' : `Choose${of === 'sprayer' ? '' : ` · ${money(plotCost(of, o.id))} a farm`}`}
              </button> : <LockTag s={s} index={i} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
