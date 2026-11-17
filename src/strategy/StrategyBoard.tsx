import { useState, type Dispatch } from 'react';
import type { Action } from '../state';
import { CloseX, useEscape } from '../components/Success';
import { money, moneyCompact } from '../money';
import { farmName, type Trial } from '../trials/model';
import { DIMENSIONS, FAMILY_LABOUR, GROUPS, ROWS_PER_FARM, optionIn, type Dimension } from './data';
import { retOf, rowEffect, strategiesOf } from './model';

/* Row strategies: each of a farm's four rows of plots runs its own bundle of choices (fertilizer, tilling, sowing,
   planting, planning, farming habits), each with its cost, labour and payoff, so the harvest shows which paid off.
   Every dimension and option comes from ./data.ts. */

const pct = (x: number) => `${x >= 0 ? '+' : '−'}${Math.round(Math.abs(x) * 100)}%`;

export function StrategyBoard({ tr, farm: farm0, locked, dispatch, onClose }: { tr: Trial; farm: number; locked: (farm: number) => boolean; dispatch: Dispatch<Action>; onClose: () => void }) {
  const [farm, setFarm] = useState(farm0);
  const [pick, setPick] = useState<{ row: number; dim: Dimension } | null>(null);
  useEscape(() => (pick ? setPick(null) : onClose()));
  const rows = strategiesOf(tr, farm);
  const effects = rows.map(st => rowEffect(st, tr.forecast));
  const labour = effects.reduce((n, e) => n + e.labour, 0);
  const isLocked = locked(farm);
  const set = (row: number, dim: string, option: string) => dispatch({ type: 'strategySet', farm, row, dim, option });
  const copyFirst = () => DIMENSIONS.forEach(d => set(-1, d.id, rows[0][d.id] ?? d.options[0].id));

  return (
    <div className="abs ending sg-layer" style={{ inset: 0 }} role="dialog" aria-label="Row strategies">
      <div className="fs-panel sg-panel">
        <CloseX onClick={onClose} />
        <div className="sg-top">
          <p className="sg-title">Row strategies</p>
          <div className="sg-farms" role="tablist" aria-label="Farm">
            {tr.plans.map((_, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === farm} className={i === farm ? 'is-on' : ''} onClick={() => setFarm(i)}>
                {farmName(i)}
              </button>
            ))}
          </div>
        </div>
        <p className="sg-lead">
          {isLocked
            ? `${farmName(farm)} is sown: its rows keep these strategies until the harvest.`
            : 'Give each row of 5 plots its own way of farming. Every choice has a cost, labour and a payoff; the harvest shows which paid off.'}
        </p>
        <div className="sg-scroll">
          <table className="sg-table">
            <thead>
              <tr>
                <th />
                {rows.map((_, r) => (
                  <th key={r}>Row {r + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(g => (
                <Group key={g.id} label={g.label}>
                  {DIMENSIONS.filter(d => d.group === g.id).map(d => (
                    <tr key={d.id}>
                      <th scope="row">{d.label}</th>
                      {rows.map((st, r) => {
                        const o = optionIn(d.id, st[d.id])!;
                        const changed = o !== d.options[0];
                        return (
                          <td key={r}>
                            <button
                              type="button"
                              className={`sg-cell${changed ? ' is-diff' : ''}${o.smart ? ' is-smart' : ''}`}
                              disabled={isLocked}
                              onClick={() => setPick({ row: r, dim: d })}
                              aria-label={`Row ${r + 1}, ${d.label}: ${o.label}${isLocked ? '' : '. Tap to change'}`}
                            >
                              {o.label}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Group>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Cost · labour</th>
                {effects.map((e, r) => (
                  <td key={r}>
                    {moneyCompact(e.cost)} · {e.labour.toFixed(1)} d
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">Payoff (est.)</th>
                {effects.map((e, r) => (
                  <td key={r} className={e.coInvest > 0 && e.gain - e.coInvest < 0 ? 'is-neg' : ''}>
                    {e.coInvest > 0 ? pct((e.gain - e.coInvest) / e.coInvest) : e.gain ? `${e.gain > 0 ? '+' : '−'}${moneyCompact(Math.abs(e.gain))}` : '—'}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row">CO₂ · stored · water</th>
                {effects.map((e, r) => (
                  <td key={r}>
                    {Math.round(e.co2)} · {Math.round(e.stored)} kg · {e.water > 0 ? '+' : ''}
                    {Math.round(e.water)} L
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="sg-foot">
          <span className={labour > FAMILY_LABOUR ? 'is-warn' : ''}>
            Extra work {labour.toFixed(1)} of {FAMILY_LABOUR} family days{labour > FAMILY_LABOUR ? ` · ${(labour - FAMILY_LABOUR).toFixed(1)} days hired` : ''}
          </span>
          {!isLocked && (
            <button type="button" className="tr-link" onClick={copyFirst}>
              Copy Row 1 to every row
            </button>
          )}
          <button type="button" className="sg-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      {pick && (
        <div className="abs ending sg-pick-layer" style={{ inset: 0 }} onClick={() => setPick(null)} role="dialog" aria-label={`Row ${pick.row + 1}: ${pick.dim.label}`}>
          <div className="sg-picker" onClick={e => e.stopPropagation()}>
            <CloseX onClick={() => setPick(null)} />
            <p className="sg-picker-title">
              Row {pick.row + 1} · {pick.dim.label}
            </p>
            <div className="sg-opts">
              {pick.dim.options.map(o => {
                const on = optionIn(pick.dim.id, rows[pick.row][pick.dim.id]) === o;
                const ret = retOf(o, tr.forecast);
                return (
                  <button
                    key={o.id}
                    type="button"
                    className={`sg-opt${on ? ' is-on' : ''}`}
                    onClick={() => {
                      set(pick.row, pick.dim.id, o.id);
                      setPick(null);
                    }}
                  >
                    <b>
                      {o.label}
                      {o.smart && <i className="sg-smart">Climate-smart</i>}
                    </b>
                    <span>{o.does}</span>
                    <small>
                      {o.cost || o.labour ? `${money(o.cost)} · ${o.labour} day${o.labour === 1 ? '' : 's'} of work · ` : 'No extra cost · '}
                      payoff {ret ? pct(ret) : 'as planned'} this season
                      {o.co2 ? ` · ${o.co2} kg CO₂` : ''}
                      {o.stored ? ` · stores ${o.stored} kg CO₂` : ''}
                      {o.water ? ` · ${o.water > 0 ? '+' : ''}${o.water} L water` : ''}
                    </small>
                  </button>
                );
              })}
            </div>
            <p className="sg-note">Numbers are placeholders until the climate-smart agriculture experts confirm them.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="sg-group">
        <th colSpan={ROWS_PER_FARM + 1}>{label}</th>
      </tr>
      {children}
    </>
  );
}
