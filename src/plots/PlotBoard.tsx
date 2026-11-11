import { useState, type Dispatch, type ReactNode } from 'react';
import { NavBar } from '../components/Nav';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { GuideLine } from '../first/Review';
import type { Action } from '../state';
import { farmName, plotsOf, type Trial } from '../trials/model';
import { plotLocked, type Field } from '../world/field';
import { JOB_INFO, KIND_WORDS, OPTIONS, PLOTS_PER_FARM, plotCost, toolName, tractorName, type PlotJob, type PlotKind, type PlotRecord } from './data';
import { money } from '../money';

/* The inputs board: the seed, fertilizer and sprayer a farm grows with, on all its 20 plots. One set per farm, so the
   harvest compares farms. Tap a box to see every choice, what it is for, and what it costs. */

export function PlotBoard({
  tr,
  farm,
  kinds,
  field,
  coins,
  dispatch,
  onFarm,
}: {
  tr: Trial;
  farm: number;
  kinds: PlotKind[];
  /** the work done so far (plots already sown or spread keep their inputs) */
  field?: Field;
  coins: number;
  dispatch: Dispatch<Action>;
  /** switch to another farm (tabs show when given) */
  onFarm?: (farm: number) => void;
}) {
  const rows = plotsOf(tr, farm);
  const [pick, setPick] = useState<{ kind: PlotKind; plot: number }>({ kind: kinds[0], plot: 0 });
  const kind = kinds.includes(pick.kind) ? pick.kind : kinds[0];
  const plot = pick.plot;
  const lockOf = (p: number, k: PlotKind) => (field && tr.phase === 'growing' ? plotLocked(field, tr, farm, p, k) : null);
  const current = rows[plot][kind] as string | undefined;
  const lock = lockOf(plot, kind);
  const growing = tr.phase === 'growing';
  const machines = rows.some(r => r.tractor);

  return (
    <div className="pb">
      {onFarm && tr.plans.length > 1 && (
        <div className="pb-tabs" role="tablist" aria-label="Farms">
          {tr.plans.map((_, i) => (
            <button type="button" key={i} role="tab" aria-selected={i === farm} className={i === farm ? 'is-on' : ''} onClick={() => onFarm(i)}>
              {farmName(i)}
            </button>
          ))}
        </div>
      )}
      <div className="pb-grid" style={{ gridTemplateColumns: `76px repeat(${rows.length}, minmax(0, 1fr))` }} role="grid" aria-label={`${farmName(farm)}: its inputs`}>
        <div className="pb-corner">{farmName(farm)}</div>
        <div className="pb-head">
          <b>All {PLOTS_PER_FARM} plots</b>
        </div>
        {kinds.map(k => (
          <Row key={k} label={KIND_WORDS[k].title}>
            {rows.map((r, p) => {
              const id = r[k] as string | undefined;
              const op = OPTIONS[k].find(x => x.id === id);
              const locked = lockOf(p, k);
              const on = k === kind && p === plot;
              return (
                <button
                  type="button"
                  key={p}
                  className={`pb-cell${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`}
                  onClick={() => setPick({ kind: k, plot: p })}
                  aria-pressed={on}
                  aria-label={`${farmName(farm)}, ${KIND_WORDS[k].one}: ${op?.label ?? 'not chosen'}${locked ? ` (${locked.toLowerCase()})` : ''}`}
                >
                  <span className="pb-dot" style={{ background: op?.color ?? '#ccc' }} aria-hidden="true" />
                  <span className="pb-name">{op?.label ?? '—'}</span>
                  {locked && <small>{locked}</small>}
                </button>
              );
            })}
          </Row>
        ))}
        {growing && machines && (
          <Row label="Tractor">
            {rows.map((r, p) => (
              <div key={p} className="pb-cell is-info">
                <span className="pb-name">{r.tractor ? tractorName(r.tractor) : 'By hand'}</span>
                {r.tools && <small>{toolsLine(r)}</small>}
              </div>
            ))}
          </Row>
        )}
      </div>

      <div className="pb-side" aria-live="polite">
        <p className="pb-side-title">
          {farmName(farm)} · {KIND_WORDS[kind].one}
        </p>
        <p className="pb-rule">{lock ? `${farmName(farm)} is ${lock.toLowerCase()}: it keeps what it has.` : KIND_WORDS[kind].rule}</p>
        <ul className="pb-opts">
          {OPTIONS[kind].map(op => {
            const at = rows.findIndex(r => r[kind] === op.id);
            const on = op.id === current;
            const price = plotCost(kind, op.id);
            return (
              <li key={op.id}>
                <button
                  type="button"
                  className={`pb-opt${on ? ' is-on' : ''}`}
                  disabled={!!lock || on || (at >= 0 && !!lockOf(at, kind))}
                  onClick={() => dispatch({ type: 'plotSet', farm, plot, kind, value: op.id })}
                >
                  <span className="pb-dot" style={{ background: op.color }} aria-hidden="true" />
                  <span className="pb-opt-text">
                    <b>{op.name}</b>
                    <span>{op.does}</span>
                    <em>{op.bestFor}</em>
                  </span>
                  <span className="pb-opt-side">
                    <i>{price ? `${money(price)} coins` : 'Free'}</i>
                    {at >= 0 && <small>This farm</small>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {growing && kind !== 'sprayer' && <p className="pb-note">Changing a seed or fertilizer now pays (or refunds) the difference. You have {money(coins)} coins.</p>}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="pb-label">{label}</div>
      {children}
    </>
  );
}

/** The tools a tractor used on a plot, in job order. */
export function toolsLine(r: PlotRecord) {
  const order: PlotJob[] = ['prep', 'sow', 'setupFeed', 'spray', 'harvest'];
  return order
    .filter(j => r.tools?.[j])
    .map(j => `${JOB_INFO[j].name}: ${toolName(r.tools![j]!).toLowerCase()}`)
    .join(' · ');
}

/** A farm's input of one kind, in words: "Long-season hybrid". */
export function plotsLine(rows: PlotRecord[], kind: PlotKind) {
  return rows.map(r => OPTIONS[kind].find(x => x.id === r[kind])?.label ?? '—').join(' · ');
}

/** The inputs board as a screen of its own: at a shed before the seed, fertilizer or sprayer is picked up. */
export function PlotScreen({
  tr,
  farm: start,
  kinds,
  field,
  coins,
  dispatch,
  tag,
  line,
  done,
  onLeave,
}: {
  tr: Trial;
  farm: number;
  kinds: PlotKind[];
  field?: Field;
  coins: number;
  dispatch: Dispatch<Action>;
  tag: string;
  line: string;
  done: { label: string; onClick: () => void };
  onLeave: () => void;
}) {
  const [farm, setFarm] = useState(start);
  return (
    <div className="abs fs-screen review care-screen" style={{ inset: 0 }}>
      <FarmMap dim={0.42} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <img src={img.plank} alt="" width={203} height={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 11 }}>
          Farm inputs
        </span>
      </div>
      <span className="rr-roundtag">{tag}</span>
      <NavBar horizontal onBack={onLeave} style={{ right: 6, top: 4 }} />
      <div className="fs-panel pb-panel">
        <PlotBoard tr={tr} farm={farm} kinds={kinds} field={field} coins={coins} dispatch={dispatch} onFarm={setFarm} />
      </div>
      <GuideLine text={line} action={done} />
    </div>
  );
}
