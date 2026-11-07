import { useState } from 'react';
import { NavBar } from '../components/Nav';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { GuideLine } from '../first/Review';
import { CHECK_DAYS, farmName, plotsOf, type Trial } from '../trials/model';
import { TRACTORS, IMPL, type ImplId } from '../tractor/data';
import { careLeft, isDone, setupLeft, type Field } from '../world/field';
import { JOB_INFO, TOOL_JOB, TOOL_USE, TRACTOR_PLOT, plotName, prepNeed, toolName, tractorName, type PlotJob, type TractorId } from './data';

/* At the tractor: before the engine starts, the farmer picks the tractor type and the tool for the job. Each one works
   one plot of a farm (Plots A to D), so a cycle's harvest compares tractors, tools and hand work side by side.
   Every card says what it is for, what it costs in fuel and where it has been used. */

export type Rig = { tractor: TractorId; tool: ImplId };

const JOB_ORDER: PlotJob[] = ['prep', 'sow', 'setupFeed', 'spray', 'harvest'];

/** The jobs some farm needs done today, and on which farms. */
export function jobsDue(field: Field, tr: Trial | null, day: number): Partial<Record<PlotJob, number[]>> {
  const out: Partial<Record<PlotJob, number[]>> = {};
  if (!tr || tr.phase !== 'growing') return out;
  const add = (j: PlotJob, farm: number) => (out[j] = [...(out[j] ?? []), farm]);
  tr.plans.forEach((_, i) => {
    const setup = setupLeft(field, tr, i);
    if (setup) return add(setup as PlotJob, i);
    if (day > CHECK_DAYS) {
      if (!isDone(field, tr, i, 'harvest')) add('harvest', i);
      return;
    }
    if (day >= 1 && careLeft(field, tr, i, day)?.job === 'spray') add('spray', i);
  });
  return out;
}

const farmsText = (farms: number[]) => (farms.length > 3 ? `${farms.length} farms` : farms.map(farmName).join(', '));

export function TractorPick({ tr, field, day, rig, onGo, onLeave }: { tr: Trial; field: Field; day: number; rig: Rig | null; onGo: (rig: Rig) => void; onLeave: () => void }) {
  const due = jobsDue(field, tr, day);
  const firstDue = JOB_ORDER.find(j => due[j]);
  const [step, setStep] = useState<'tractor' | 'tool'>('tractor');
  const [tractor, setTractor] = useState<TractorId | null>(rig?.tractor ?? null);
  const [tool, setTool] = useState<ImplId | null>(rig && (!firstDue || TOOL_JOB[rig.tool] === firstDue) ? rig.tool : null);
  const plots = tr.plans.map((_, i) => plotsOf(tr, i));

  /** where a tractor type works: "Farm 1 Plot A" … */
  const worksOf = (k: TractorId) => plots.flatMap((rows, f) => rows.map((r, p) => (r.tractor === k ? `${farmName(f)} ${plotName(p)}` : '')).filter(Boolean));
  const usedOf = (k: ImplId) => plots.flatMap((rows, f) => rows.map((r, p) => (r.tools?.[TOOL_JOB[k]] === k ? `${farmName(f)} ${plotName(p)}` : '')).filter(Boolean));

  let line: string;
  if (step === 'tractor') {
    line = tractor
      ? `The ${tractorName(tractor).toLowerCase()} tractor: ${TRACTOR_PLOT[tractor].teach} Next, pick the tool.`
      : 'Pick a tractor. Each type works one plot of a farm, and one plot stays by hand, so the harvest shows what each one did.';
  } else if (!tool) {
    line = firstDue ? `Pick the tool. Due now: ${JOB_INFO[firstDue].name.toLowerCase()} on ${farmsText(due[firstDue]!)}.` : 'Pick the tool for the job you want to do. Nothing is due on the farms right now.';
  } else {
    const j = TOOL_JOB[tool];
    line = due[j] ? `${toolName(tool)}: ${JOB_INFO[j].name.toLowerCase()} on ${farmsText(due[j]!)}. Drive onto a plot to work it.` : `${toolName(tool)}: there is no ${JOB_INFO[j].name.toLowerCase()} job right now. You can still drive, or pick another tool.`;
  }

  return (
    <div className="abs fs-screen review care-screen" style={{ inset: 0 }}>
      <FarmMap dim={0.42} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <img src={img.plank} alt="" width={203} height={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 11 }}>
          The tractor
        </span>
      </div>
      <span className="rr-roundtag">Tractor · type and tool</span>
      <NavBar horizontal onBack={onLeave} style={{ right: 6, top: 4 }} />
      <ol className="review-steps" aria-label="Tractor steps">
        <li className={step === 'tractor' ? 'is-now' : 'is-done'}>Tractor</li>
        <li className={step === 'tool' ? (tool ? 'is-done' : 'is-now') : ''}>Tool</li>
      </ol>

      <div className="fs-panel tp-panel">
        {step === 'tractor' ? (
          <div className="tp-cards" role="radiogroup" aria-label="Tractor type">
            {TRACTORS.map(k => {
              const works = worksOf(k.id);
              return (
                <button type="button" key={k.id} role="radio" aria-checked={tractor === k.id} className={`tp-card${tractor === k.id ? ' is-on' : ''}`} onClick={() => setTractor(k.id)}>
                  <b>{k.name}</b>
                  <span className="tp-hp">{k.hp} hp</span>
                  <span>{TRACTOR_PLOT[k.id].teach}</span>
                  <span className="tp-note">{k.note}</span>
                  <span className="tp-meters">
                    {Object.entries(k.meters).map(([m, v]) => (
                      <span key={m}>
                        {m}
                        <i aria-label={`${v} of 5`}>{'●'.repeat(v)}{'○'.repeat(5 - v)}</i>
                      </span>
                    ))}
                  </span>
                  <span className="tp-meta">
                    Fuel <b>{TRACTOR_PLOT[k.id].fuel} coins</b> a plot · speed {Math.round(TRACTOR_PLOT[k.id].speed * 100)}%
                  </span>
                  <small>{works.length ? `Works ${works.slice(0, 3).join(', ')}${works.length > 3 ? '…' : ''}` : 'Not used yet this cycle'}</small>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="tp-tools" role="radiogroup" aria-label="Tool">
            {JOB_ORDER.map(j => (
              <div key={j} className={`tp-job${due[j] ? ' is-due' : ''}`}>
                <p className="tp-job-title">
                  {JOB_INFO[j].name}
                  <small>{due[j] ? `Due: ${farmsText(due[j]!)}` : JOB_INFO[j].when}</small>
                </p>
                {(Object.keys(TOOL_JOB) as ImplId[])
                  .filter(k => TOOL_JOB[k] === j)
                  .map(k => {
                    const used = usedOf(k);
                    const fits = j === 'prep' ? tr.plans.map((_, f) => f).filter(f => prepNeed(f).tool === k) : [];
                    return (
                      <button type="button" key={k} role="radio" aria-checked={tool === k} className={`tp-tool${tool === k ? ' is-on' : ''}`} onClick={() => setTool(k)}>
                        <b>{IMPL[k].name}</b>
                        <span>{TOOL_USE[k]}</span>
                        {fits.length > 0 && <em>Suits {farmsText(fits)}</em>}
                        <small>{used.length ? `Used: ${used.slice(0, 2).join(', ')}${used.length > 2 ? '…' : ''}` : 'Not used yet'}</small>
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        )}
      </div>

      <GuideLine
        text={line}
        action={
          step === 'tractor'
            ? tractor
              ? { label: 'Next: the tool', onClick: () => setStep('tool') }
              : undefined
            : tractor && tool
              ? { label: 'Start the engine', onClick: () => onGo({ tractor, tool }) }
              : { label: 'Back: tractor', onClick: () => setStep('tractor') }
        }
      />
    </div>
  );
}
