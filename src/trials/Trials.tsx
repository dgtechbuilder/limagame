import { useState, type Dispatch, type ReactNode } from 'react';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { GoldButton, Stars, fmt } from '../components/ui';
import { say } from '../first/data';
import { GuideLine } from '../first/Review';
import { dayNumber } from '../rounds/farms';
import type { Action, GameState } from '../state';
import {
  CHECK_DAYS,
  FORECASTS,
  PLAN_STEPS,
  WATER_NEED,
  checkKey,
  currentDay,
  differences,
  explain,
  farmName,
  hazardFor,
  lower,
  optionOf,
  planCost,
  planProblem,
  samePlan,
  stageOfDay,
  stepOf,
  type StepKey,
  type Trial,
  type TrialHazard,
} from './model';

/* The six farms: plan → grow (a check of every farm each day) → harvest and compare.
   The first cycle is guided: two farms, Farm 1 grown a common way, Farm 2 with one change. */

const SHORT: Record<TrialHazard, string> = {
  healthy: 'Healthy',
  drought: 'Drought',
  flood: 'Waterlogged',
  nitrogen: 'Hungry',
  armyworm: 'Armyworm',
  disease: 'Leaf rust',
  weeds: 'Weeds',
  livestock: 'Goats',
  wildlife: 'Birds',
  hail: 'Hail',
  plantEarly: 'Planted early',
  plantLate: 'Planted late',
  harvestEarly: 'Picked early',
  harvestLate: 'Picked late',
};

const STAGE_WORD = { young: 'Seedlings', grow: 'Growing', harvest: 'Harvest time' } as const;

export function Trials({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const name = s.farmer?.name ?? 'Farmer';
  const t = (line: string) => say(line, name);
  const tr = s.trial;
  const close = () => dispatch({ type: 'trials', open: false });

  let title = 'Six farms';
  let body: ReactNode;
  if (!tr) {
    title = s.trialHistory.length ? 'Six farms' : 'Two farms';
    body = <Intro s={s} dispatch={dispatch} t={t} />;
  } else if (tr.phase === 'plan') {
    title = `Cycle ${tr.cycle} · plan`;
    body = <PlanBoard s={s} tr={tr} dispatch={dispatch} t={t} />;
  } else if (tr.phase === 'growing') {
    title = `Cycle ${tr.cycle} · growing`;
    body = <Growing tr={tr} dispatch={dispatch} t={t} />;
  } else {
    title = `Cycle ${tr.cycle} · results`;
    body = <Compare s={s} tr={tr} dispatch={dispatch} t={t} />;
  }

  return (
    <div className="abs fs-screen trials" style={{ inset: 0 }}>
      <FarmMap dim={0.45} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <img src={img.plank} alt="" width={203} height={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 12 }}>
          {title}
        </span>
      </div>
      {tr && <span className="rr-roundtag">Maize · {FORECASTS[tr.forecast].label.split(':')[0]}</span>}
      <button type="button" className="rr-exit" onClick={close}>
        My farm
      </button>
      {body}
    </div>
  );
}

type Props = { dispatch: Dispatch<Action>; t: (line: string) => string };

/* ---------------- start ---------------- */

function Intro({ s, dispatch, t }: Props & { s: GameState }) {
  const first = s.trialHistory.length === 0;
  return (
    <div className="abs ending" style={{ inset: 0, background: 'transparent' }}>
      <div className="tr-card">
        <p className="tr-card-title">{first ? t('Grow maize two ways, {name}') : t('Plan your six farms, {name}')}</p>
        {first ? (
          <>
            <p>Two farms, the same maize, one difference.</p>
            <ol>
              <li>Farm 1 is planted the way many farms grow maize. You change one thing on Farm 2.</li>
              <li>Check both farms every day for six days and treat what you find.</li>
              <li>Harvest them and see which grew more, and why.</li>
            </ol>
            <p className="tr-card-small">About 10 minutes. Your coins pay for the seed and inputs; the harvest is sold for you.</p>
          </>
        ) : (
          <p>Give each of your six farms a different plan, grow them side by side, and compare the harvests.</p>
        )}
        <GoldButton font={12} height={36} style={{ width: 220, marginTop: 8 }} onClick={() => dispatch({ type: 'trialNew' })}>
          {first ? 'Plan my two farms' : 'Plan my six farms'}
        </GoldButton>
      </div>
    </div>
  );
}

/* ---------------- plan ---------------- */

function PlanBoard({ s, tr, dispatch, t }: Props & { s: GameState; tr: Trial }) {
  const [pick, setPick] = useState<{ farm: number; key: StepKey } | null>(null);
  const [planting, setPlanting] = useState(false);
  const k = tr.plans.length;
  const total = tr.plans.reduce((n, p) => n + planCost(p), 0);
  const problem = planProblem(tr.plans, s.coins);
  const twinOf = (i: number) => tr.plans.findIndex((q, j) => j < i && samePlan(q, tr.plans[i]));
  const changed = tr.guided ? differences(tr.plans[0], tr.plans[1]) : [];

  let line: string;
  if (tr.guided) {
    line =
      changed.length === 0
        ? t('Farm 1 grows maize a common way, {name}. Change one thing on Farm 2: tap any of its boxes.')
        : changed.length === 1
          ? t(`Farm 2 now differs in one thing: ${stepOf(changed[0]).label.toLowerCase()}. Plant both farms and see what it does.`)
          : t(`Farm 2 differs in ${changed.length} things, {name}. With only one change you will know what made the difference.`);
  } else {
    line = problem ?? t('Each farm tests something, {name}. Change one thing per farm against Farm 1 to see what each choice does.');
  }

  const plant = () => {
    if (problem) return dispatch({ type: 'toast', text: problem });
    if (tr.guided) dispatch({ type: 'trialPlant', clock: 'fast' });
    else setPlanting(true);
  };

  return (
    <>
      <div className="fs-panel tr-panel">
        <div className="tr-grid" style={{ gridTemplateColumns: `104px repeat(${k}, minmax(0, 1fr))` }}>
          <div className="tr-head tr-corner">Your plans</div>
          {tr.plans.map((p, i) => {
            const twin = twinOf(i);
            return (
              <div key={i} className={`tr-head${twin >= 0 ? ' is-twin' : ''}`}>
                <b>{farmName(i)}</b>
                <small>{twin >= 0 ? `Same as ${farmName(twin)}` : tr.guided && i === 0 ? 'A common way' : `${fmt(planCost(p))} coins`}</small>
              </div>
            );
          })}
          {PLAN_STEPS.map(step => (
            <Row key={step.key} label={step.label}>
              {tr.plans.map((p, i) => {
                const locked = tr.guided && i === 0;
                const diff = i > 0 && String(p[step.key]) !== String(tr.plans[0][step.key]);
                return (
                  <button
                    type="button"
                    key={i}
                    className={`tr-cell${diff ? ' is-diff' : ''}${locked ? ' is-locked' : ''}`}
                    disabled={locked}
                    onClick={() => setPick({ farm: i, key: step.key })}
                    aria-label={`${farmName(i)}, ${step.label}: ${optionOf(step.key, p).label}${locked ? '' : '. Tap to change'}`}
                  >
                    {optionOf(step.key, p).label}
                  </button>
                );
              })}
            </Row>
          ))}
        </div>
        <div className="tr-foot">
          <span>
            Total <b>{fmt(total)}</b> coins · you have {fmt(s.coins)}
          </span>
          {!tr.guided && (
            <button type="button" className="tr-link" onClick={() => dispatch({ type: 'trialSuggest' })}>
              Suggest one change per farm
            </button>
          )}
        </div>
      </div>

      <GuideLine text={line} action={{ label: tr.guided ? 'Plant both farms' : `Plant all ${k} farms`, onClick: plant }} />

      {pick && <Picker s={s} tr={tr} farm={pick.farm} stepKey={pick.key} dispatch={dispatch} onClose={() => setPick(null)} />}

      {planting && (
        <div className="abs ending" style={{ inset: 0 }} onClick={() => setPlanting(false)}>
          <div className="tr-card" onClick={e => e.stopPropagation()}>
            <p className="tr-card-title">How should the days pass?</p>
            <p>Each cycle has six days of checks before the harvest.</p>
            <div className="tr-choice">
              <button type="button" onClick={() => dispatch({ type: 'trialPlant', clock: 'daily' })}>
                <b>One day each real day</b>
                <span>Check your farms once a day, like a real farm. Harvest in about a week.</span>
              </button>
              <button type="button" onClick={() => dispatch({ type: 'trialPlant', clock: 'fast' })}>
                <b>Play the six days now</b>
                <span>A new day starts as soon as every farm is checked.</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="tr-label">{label}</div>
      {children}
    </>
  );
}

function Picker({ s, tr, farm, stepKey, dispatch, onClose }: { s: GameState; tr: Trial; farm: number; stepKey: StepKey; dispatch: Dispatch<Action>; onClose: () => void }) {
  const step = stepOf(stepKey);
  const current = String(tr.plans[farm][stepKey]);
  return (
    <div className="abs ending" style={{ inset: 0 }} onClick={onClose} role="dialog" aria-label={`${farmName(farm)}: ${step.label}`}>
      <div className="tr-picker" onClick={e => e.stopPropagation()}>
        <p className="tr-card-title">
          {farmName(farm)} · {step.label}
        </p>
        {stepKey === 'water' && (
          <p className="tr-card-small">
            {FORECASTS[tr.forecast].label}.{s.trialHistory.length > 0 ? ` Maize needs about ${WATER_NEED} L/m² a week in all.` : ''}
          </p>
        )}
        <ul>
          {step.options.map(op => (
            <li key={op.id}>
              <button
                type="button"
                className={op.id === current ? 'is-on' : ''}
                onClick={() => {
                  dispatch({ type: 'trialPlan', farm, key: stepKey, value: op.id });
                  onClose();
                }}
              >
                <b>{op.label}</b>
                <span>{op.does}</span>
                <i>{op.cost ? `${fmt(op.cost)} coins` : 'Free'}</i>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- growing ---------------- */

function Growing({ tr, dispatch, t }: Props & { tr: Trial }) {
  const day = currentDay(tr, dayNumber());
  const ready = day > CHECK_DAYS;
  const k = tr.plans.length;
  const todayLeft = ready ? 0 : tr.plans.filter((_, i) => !tr.checks[checkKey(i, day)]).length;

  let line: string;
  let action: { label: string; onClick: () => void } | undefined;
  if (ready) {
    line = t('Harvest time, {name}! Pick every farm and see which grew the most.');
    action = { label: 'Harvest all farms', onClick: () => dispatch({ type: 'trialHarvest' }) };
  } else if (todayLeft > 0) {
    line = t(`Day ${day} of ${CHECK_DAYS}: ${todayLeft === k ? (k === 2 ? 'both farms need' : `all ${k} farms need`) : `${todayLeft} ${todayLeft === 1 ? 'farm needs' : 'farms need'}`} a check today, {name}.`);
    action = { label: 'Check my farms', onClick: () => dispatch({ type: 'rounds', open: true, trial: true }) };
  } else if (tr.clock === 'fast') {
    line = t(`Every farm is checked for day ${day}, {name}.`);
    action = { label: day >= CHECK_DAYS ? 'Go to harvest' : `Start day ${day + 1}`, onClick: () => dispatch({ type: 'trialNextDay' }) };
  } else {
    line = t(`Every farm is checked today, {name}. ${day >= CHECK_DAYS ? 'Harvest is ready tomorrow.' : `Day ${day + 1} starts tomorrow.`}`);
  }

  return (
    <>
      <div className="fs-panel tr-panel">
        <div className="tr-grid tr-days" style={{ gridTemplateColumns: `150px repeat(${CHECK_DAYS}, minmax(0, 1fr))` }}>
          <div className="tr-head tr-corner">Farm · what it tests</div>
          {Array.from({ length: CHECK_DAYS }, (_, d) => (
            <div key={d} className={`tr-head${d + 1 === day ? ' is-today' : ''}`}>
              <b>Day {d + 1}</b>
              <small>{STAGE_WORD[stageOfDay(d + 1)]}</small>
            </div>
          ))}
          {tr.plans.map((p, i) => {
            const diff = i === 0 ? [] : differences(tr.plans[0], p);
            const tests = i === 0 ? (tr.guided ? 'A common way' : 'Starting plan') : diff.length ? diff.map(key => `${stepOf(key).label}: ${lower(optionOf(key, p).label)}`).join(', ') : 'Same as Farm 1';
            return (
              <Row
                key={i}
                label={
                  <>
                    <b>{farmName(i)}</b>
                    <small>{tests}</small>
                  </>
                }
              >
                {Array.from({ length: CHECK_DAYS }, (_, dd) => {
                  const d = dd + 1;
                  const rec = tr.checks[checkKey(i, d)];
                  if (d > day) return <span key={d} className="tr-day is-later" />;
                  const h = hazardFor(tr, i, d);
                  if (d === day && !rec)
                    return (
                      <span key={d} className="tr-day is-due">
                        To check
                      </span>
                    );
                  if (rec?.right)
                    return (
                      <span key={d} className={`tr-day ${h === 'healthy' ? 'is-ok' : 'is-caught'}`}>
                        ✓ {SHORT[h]}
                      </span>
                    );
                  if (d === day)
                    return (
                      <span key={d} className="tr-day is-miss">
                        ✗ Look again
                      </span>
                    );
                  return (
                    <span key={d} className="tr-day is-miss">
                      {rec ? '✗' : 'Missed'} · {SHORT[h]}
                    </span>
                  );
                })}
              </Row>
            );
          })}
        </div>
        <div className="tr-foot">
          <span>{tr.clock === 'daily' ? 'One day each real day. Come back tomorrow for the next check.' : 'A new day starts once every farm is checked.'}</span>
          {!ready && tr.clock === 'daily' && (
            <button type="button" className="tr-link" onClick={() => dispatch({ type: 'trialClock', clock: 'fast' })}>
              Play the rest now
            </button>
          )}
          {!ready && tr.clock === 'fast' && !tr.guided && (
            <button type="button" className="tr-link" onClick={() => dispatch({ type: 'trialClock', clock: 'daily' })}>
              One day each real day instead
            </button>
          )}
        </div>
      </div>
      <GuideLine text={line} action={action} />
    </>
  );
}

/* ---------------- results ---------------- */

function Compare({ s, tr, dispatch, t }: Props & { s: GameState; tr: Trial }) {
  const results = tr.results ?? [];
  const why = explain(tr, results);
  const [keep, setKeep] = useState(why.best);
  const k = tr.plans.length;
  const maxBags = Math.max(6, ...results.map(r => r.bags));
  const income = results.reduce((n, r) => n + r.income, 0);
  const differing = PLAN_STEPS.filter(step => tr.plans.some(p => String(p[step.key]) !== String(tr.plans[0][step.key])));
  const kept = s.recipe && samePlan(s.recipe, tr.plans[keep]);

  return (
    <>
      <div className="fs-panel tr-panel tr-compare">
        <div className="tr-grid" style={{ gridTemplateColumns: `86px repeat(${k}, minmax(0, 1fr))` }}>
          <div className="tr-head tr-corner">Harvest</div>
          {results.map((_, i) => (
            <button type="button" key={i} className={`tr-head tr-pick${i === keep ? ' is-on' : ''}`} onClick={() => setKeep(i)} aria-pressed={i === keep}>
              <b>
                {farmName(i)}
                {i === why.best && <i>Most maize</i>}
              </b>
            </button>
          ))}
          <div className="tr-label">Maize</div>
          {results.map((r, i) => (
            <div key={i} className="tr-bar">
              <span style={{ height: `${Math.max(3, (r.bags / maxBags) * 100)}%` }} className={i === why.best ? 'is-best' : i === why.worst ? 'is-worst' : ''} />
              <b>{r.bags} bags</b>
            </div>
          ))}
          <div className="tr-label">Quality</div>
          {results.map((r, i) => (
            <div key={i} className="tr-val">
              <Stars value={r.quality} size={8} />
            </div>
          ))}
          <div className="tr-label">Profit</div>
          {results.map((r, i) => (
            <div key={i} className={`tr-val${r.profit < 0 ? ' is-neg' : ''}`} title={`Sold for ${fmt(r.income)}, cost ${fmt(r.costs)}`}>
              {fmt(r.profit)}
            </div>
          ))}
          {differing.map(step => (
            <Row key={step.key} label={step.label}>
              {tr.plans.map((p, i) => (
                <div key={i} className={`tr-val tr-small${i > 0 && String(p[step.key]) !== String(tr.plans[0][step.key]) ? ' is-diff' : ''}`}>
                  {optionOf(step.key, p).label}
                </div>
              ))}
            </Row>
          ))}
        </div>
        <aside className="tr-why">
          <p className="tr-why-title">Lima AI</p>
          {why.lines.map(l => (
            <p key={l}>{l}</p>
          ))}
          <GoldButton font={10} height={30} style={{ width: '100%', marginTop: 'auto' }} selected={!!kept} onClick={() => dispatch({ type: 'trialRecipe', farm: keep })}>
            {kept ? `${farmName(keep)}'s plan is your recipe` : `Keep ${farmName(keep)}'s plan as my recipe`}
          </GoldButton>
        </aside>
      </div>
      <GuideLine
        text={t(
          tr.guided
            ? `Both farms are harvested and sold for ${fmt(income)} coins, {name}. Next: six farms, each testing a different change.`
            : `Cycle ${tr.cycle} is harvested and sold for ${fmt(income)} coins, {name}. Keep the plan that worked and test more changes.`,
        )}
        action={{ label: 'Plan the next cycle', onClick: () => dispatch({ type: 'trialNew' }) }}
      />
    </>
  );
}
