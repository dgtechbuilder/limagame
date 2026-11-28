import { StrategyBoard } from '../strategy/StrategyBoard';
import { LockTag, OpenLine } from '../unlock/Lock';
import { chosen, rowLesson, strategiesOf } from '../strategy/model';
import { doneMask } from '../world/field';
import { useState, type Dispatch, type ReactNode } from 'react';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { ClimateTag } from '../climate/Tag';
import { optionDelta } from '../climate/model';
import { hasSolar } from '../climate/track';
import { GoldButton, Stars } from '../components/ui';
import { say } from '../first/data';
import { GuideLine } from '../first/Review';
import { dayNumber } from '../rounds/farms';
import { PlotBoard, plotsLine } from '../plots/PlotBoard';
import { OPTIONS, ROUTINE, fertOf, seedOf, type FertId, type SeedId } from '../plots/data';
import { NutriChips, NutriTotal } from '../nutrition/Nutri';
import { nutritionOf } from '../nutrition/data';
import { MARKET } from '../produce/model';
import { Info } from '../learn/Info';
import type { Action, GameState } from '../state';
import {
  BUYING_STEPS,
  CROP_WORDS,
  planOptionOpen,
  cropOf,
  CHECK_DAYS,
  FARM_STEPS,
  FORECASTS,
  WATER_NEED,
  checkKey,
  currentDay,
  differences,
  explain,
  farmCost,
  farmName,
  hazardFor,
  isResting,
  lower,
  optionOf,
  planProblem,
  plantedFarms,
  plotLessons,
  plotsOf,
  restOf,
  samePlan,
  stageOfDay,
  stepOf,
  trialCost,
  type StepKey,
  type Trial,
  type TrialHazard,
} from './model';
import { money } from '../money';
import { REST, REST_KINDS, SOIL_WORD, restAdvice, soilEffect, soilOf, soilTone, type RestKind } from '../soil/model';
import { achClock } from '../achievements/track';
import { bandOf, sustainability, weakest } from '../tracking/model';
import { PartBars, ScoreRing } from '../tracking/Score';

/* The six farms: plan → grow (a check of every farm each day) → harvest and compare.
   The first cycle is guided: two farms, Farm 1 grown a common way, Farm 2 with one change.
   From the second cycle any farm can rest instead (the Use row, src/soil): under a cover crop or natural fallow. */

const SHORT: Record<TrialHazard, string> = {
  healthy: 'Healthy',
  drought: 'Drought',
  flood: 'Waterlogged',
  nitrogen: 'Hungry',
  armyworm: 'Armyworm',
  aphids: 'Aphids',
  disease: 'Leaf rust',
  weeds: 'Weeds',
  livestock: 'Goats',
  wildlife: 'Birds',
  hail: 'Hail',
  virus: 'Lethal necrosis',
  wind: 'Wind',
  striga: 'Striga',
  erosion: 'Erosion',
  rodents: 'Rats',
  plantEarly: 'Planted early',
  plantLate: 'Planted late',
  harvestEarly: 'Picked early',
  harvestLate: 'Picked late',
};

const STAGE_WORD = { young: 'Seedlings', grow: 'Growing', harvest: 'Harvest time' } as const;


/** The farm word (learn/glossary.ts) behind a plan option, for its ⓘ. */
function planTerm(key: string, id: string): string | null {
  if (key === 'seed') return seedOf(id as SeedId).name;
  if (key === 'fert') return fertOf(id as FertId).name;
  if (key === 'land') return ({ slash: 'landPrep', hoe: 'hoe', ox: 'plough', tractor: 'tractor', mulch: 'mulch' } as Record<string, string>)[id] ?? null;
  if (key === 'pest') return ({ scout: 'pesticide', spray: 'insecticide' } as Record<string, string>)[id] ?? null;
  if (key === 'water') return 'lpm2';
  return null;
}

export function Trials({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const name = s.farmer?.name ?? 'Farmer';
  const t = (line: string) => say(line, name);
  const tr = s.trial;
  const close = () => dispatch({ type: 'trials', open: false });
  // Mission's two sections: the farms (plan, grow, results) and the farm's sustainability
  // (each has its own address, src/route.ts: /mission and /mission/sustainability)
  const section = s.trialsTab ?? 'farms';
  const setSection = (tab: 'farms' | 'sustain') => dispatch({ type: 'trials', open: true, tab });
  const sus = sustainability(s, achClock.today());

  let title = 'Six farms';
  let body: ReactNode;
  const titled = (x: string) => (section === 'sustain' ? 'Sustainability' : x);
  if (!tr) {
    title = s.trialHistory.length ? 'Six farms' : 'Two farms';
    body = <Intro s={s} dispatch={dispatch} t={t} />;
  } else if (tr.phase === 'plan') {
    title = `Cycle ${tr.cycle} · plan`;
    body = <PlanBoard s={s} tr={tr} dispatch={dispatch} t={t} />;
  } else if (tr.phase === 'growing') {
    title = `Cycle ${tr.cycle} · growing`;
    body = <Growing s={s} tr={tr} dispatch={dispatch} t={t} inWorld={s.view === 'world'} />;
  } else {
    title = `Cycle ${tr.cycle} · results`;
    body = <Compare s={s} tr={tr} dispatch={dispatch} t={t} />;
  }

  return (
    <div className="abs fs-screen trials" style={{ inset: 0 }}>
      <FarmMap dim={0.45} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <img src={img.plank} alt="" width={203} height={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 9.5 }}>
          {titled(title)}
        </span>
      </div>
      {tr && <span className="rr-roundtag">{cropsLine(tr)} · {FORECASTS[tr.forecast].label.split(':')[0]}</span>}
      <NavBar horizontal onBack={section === 'sustain' ? () => setSection('farms') : close} style={{ right: 28, top: 8 }} />
      {/* Mission's two sections: the farms, and the farm's sustainability (src/tracking) */}
      {s.modal ? null : section === 'farms' ? (
        <button type="button" className={`ms-switch is-${bandOf(sus.score).tone}`} onClick={() => setSection('sustain')} aria-label={`Sustainability: ${sus.score} out of 100, ${bandOf(sus.score).word}. Open the section`}>
          <small>Sustainability</small>
          <span>
            🌱 <b>{sus.score}</b>/100
          </span>
        </button>
      ) : (
        <button type="button" className="ms-switch is-back" onClick={() => setSection('farms')} aria-label="Back to the farms">
          <small>Mission</small>
          <span>🌽 Farms</span>
        </button>
      )}
      {section === 'sustain' ? <SustainSection sus={sus} dispatch={dispatch} onBack={() => setSection('farms')} /> : body}
    </div>
  );
}

type Props = { dispatch: Dispatch<Action>; t: (line: string) => string };

/* ---------------- the Sustainability section: the score out of 100 and its parts ---------------- */

function SustainSection({ sus, dispatch, onBack }: { sus: ReturnType<typeof sustainability>; dispatch: Dispatch<Action>; onBack: () => void }) {
  const band = bandOf(sus.score);
  const next = weakest(sus.parts, 1)[0];
  return (
    <>
      <div className="tr-card ms-sustain" role="region" aria-label="Sustainability">
        <CloseX onClick={onBack} />
        <div className="sus-head">
          <ScoreRing score={sus.score} size={72} />
          <span className="sus-head-text">
            <b>
              Sustainability: {sus.score}/100 · <span className={`sus-word is-${band.tone}`}>{band.word}</span>
            </b>
            <small>How long this farm can keep going: its climate, water, soil, power, chemicals, practices, money and animals. Every plan you make here moves it.</small>
            {next && (
              <small>
                Next: <b>{next.tip}</b>
              </small>
            )}
          </span>
        </div>
        <PartBars parts={sus.parts} />
        <div className="tr-choice">
          <GoldButton font={12} height={34} style={{ flex: 1 }} onClick={() => dispatch({ type: 'open', modal: { kind: 'tracking', tab: 'overview' } })}>
            Open Tracking: every figure
          </GoldButton>
        </div>
      </div>
    </>
  );
}

/* ---------------- start ---------------- */

function Intro({ s, dispatch, t }: Props & { s: GameState }) {
  const first = s.trialHistory.length === 0;
  return (
    <div className="abs ending" style={{ inset: 0, background: 'transparent' }}>
      <div className="tr-card">
        <CloseX onClick={() => dispatch({ type: 'trials', open: false })} />
        <p className="tr-card-title">{first ? t('Your first planting, {name}') : t('Plan your six farms, {name}')}</p>
        {first ? (
          <>
            <p>Two farms: maize on Farm 1, sukuma wiki on Farm 2.</p>
            <ol>
              <li>Farm 1: clear each plot, then plant maize.</li>
              <li>Farm 2 is cleared: plant sukuma wiki.</li>
              <li>Check both daily for six days, then harvest.</li>
            </ol>
            <p className="tr-card-small">About 10 minutes. You pay for inputs; the harvest is sold for you.</p>
          </>
        ) : (
          <p>Give each farm a different plan and compare the harvests.</p>
        )}
        <GoldButton font={12} height={36} style={{ width: 220, marginTop: 8 }} onClick={() => dispatch({ type: 'trialNew' })}>
          {first ? 'Start planting' : 'Plan my six farms'}
        </GoldButton>
      </div>
    </div>
  );
}

/* ---------------- plan ---------------- */

function PlanBoard({ s, tr, dispatch, t }: Props & { s: GameState; tr: Trial }) {
  const [pick, setPick] = useState<{ farm: number; key: StepKey } | null>(null);
  const [planting, setPlanting] = useState(false);
  const [board, setBoard] = useState<number | null>(null);
  const [rowsFor, setRowsFor] = useState<number | null>(null);
  const [useFor, setUseFor] = useState<number | null>(null);
  const k = tr.plans.length;
  const total = trialCost(tr);
  const problem = planProblem(tr, s.coins);
  const soil = soilOf(s.soil);
  const planted = plantedFarms(tr).length;
  const advice = tr.guided ? [] : restAdvice(s.soil, k).filter(a => !isResting(tr, a.farm));
  // two farms with the same plan and the same plots teach nothing new
  const plotKey = (i: number) => JSON.stringify(plotsOf(tr, i).map(r => [r.seed, r.fert, r.sprayer]));
  const twinOf = (i: number) => (isResting(tr, i) ? -1 : tr.plans.findIndex((q, j) => j < i && !isResting(tr, j) && samePlan(q, tr.plans[i]) && plotKey(j) === plotKey(i)));
  const changed = tr.guided ? differences(tr.plans[0], tr.plans[1]) : [];

  let line: string;
  if (tr.guided) {
    line =
      changed.length === 0
        ? t('Change one thing on Farm 2, {name}: tap any of its boxes.')
        : changed.length === 1
          ? t(`Farm 2 now differs in one thing: ${stepOf(changed[0]).label.toLowerCase()}. Plant both to see what it does.`)
          : t(`Farm 2 differs in ${changed.length} things, {name}. Change just one to know what made the difference.`);
  } else {
    line =
      problem ??
      (advice.length
        ? t(`${advice.map(a => `${farmName(a.farm)} (${a.why})`).join(' and ')}: rest ${advice.length === 1 ? 'it' : 'them'} this cycle, {name}? Tap Use.`)
        : t('Change one thing per farm against Farm 1, {name}. Rest a tired farm in turns.'));
  }

  const inWorld = s.view === 'world';
  // in the farm world, planting sends the farmer out to do the work
  const sow = (clock: Trial['clock']) => {
    dispatch({ type: 'trialPlant', clock });
    if (inWorld) dispatch({ type: 'trials', open: false });
  };
  const plant = () => {
    if (problem) return dispatch({ type: 'toast', text: problem });
    if (tr.guided) sow('fast');
    else setPlanting(true);
  };

  return (
    <>
      <div className="fs-panel tr-panel">
        <div className="tr-grid is-plan" style={{ gridTemplateColumns: `104px repeat(${k}, minmax(0, 1fr))` }}>
          <div className="tr-head tr-corner">Your plans</div>
          {tr.plans.map((_, i) => {
            const twin = twinOf(i);
            return (
              <div key={i} className={`tr-head${twin >= 0 ? ' is-twin' : ''}${isResting(tr, i) ? ' is-resting' : ''}`}>
                <b>{farmName(i)}</b>
                <small>{twin >= 0 ? `Same as ${farmName(twin)}` : tr.guided && i === 0 ? 'A common way' : farmCost(tr, i) ? `${money(farmCost(tr, i))}` : 'Free'}</small>
              </div>
            );
          })}
          <Row label={<span title="Plant the farm, or rest it this cycle; and its soil now, with what the soil does to the harvest (src/soil)">Use · soil</span>}>
            {tr.plans.map((_, i) => {
              const rest = restOf(tr, i);
              const advised = advice.some(a => a.farm === i);
              const h = soil.health[i];
              const tip = `Soil ${h}, ${SOIL_WORD[soilTone(h)].toLowerCase()}: harvest ${soilEffect(h)}${soil.streak[i] ? ` · cropped ${soil.streak[i]} cycles in a row` : ''}`;
              const body = (
                <>
                  <span>
                    {rest ? `${REST[rest].icon} Rest` : '🌽 Plant'}
                    <small className={`tr-soil-n is-${soilTone(h)}`}> · soil {h}</small>
                  </span>
                  <span className={`soil-meter tr-use-meter is-${soilTone(h)}`} aria-hidden="true">
                    <span style={{ width: `${Math.max(4, h)}%` }} />
                  </span>
                </>
              );
              if (tr.guided)
                return (
                  <span key={i} className="tr-cell tr-use is-locked" title={tip}>
                    {body}
                  </span>
                );
              return (
                <button
                  type="button"
                  key={i}
                  className={`tr-cell tr-use${rest ? ' is-resting' : ''}${advised ? ' is-advised' : ''}`}
                  onClick={() => setUseFor(i)}
                  title={tip}
                  aria-label={`${farmName(i)}: ${rest ? REST[rest].label : 'plant a crop'}; soil ${h}. Tap to plant it or rest it this cycle`}
                >
                  {body}
                </button>
              );
            })}
          </Row>
          {FARM_STEPS.map(step => (
            <Row key={step.key} label={step.label}>
              {tr.plans.map((p, i) => {
                if (isResting(tr, i))
                  return (
                    <span key={i} className="tr-cell tr-rest-cell" aria-hidden="true">
                      —
                    </span>
                  );
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
          <Row label="Inputs">
            {tr.plans.map((_, i) =>
              isResting(tr, i) ? (
                <span key={i} className="tr-cell tr-rest-cell">
                  {REST[restOf(tr, i)!].icon} Resting
                </span>
              ) : (
              <button
                type="button"
                key={i}
                className="tr-cell tr-plots"
                onClick={() => setBoard(i)}
                aria-label={`${farmName(i)}, seed: ${plotsLine(plotsOf(tr, i), 'seed')}. Tap to choose the farm's seed, fertilizer and sprayer`}
              >
                {plotsOf(tr, i).map((r, p) => (
                  <span key={p} className="tr-input" title={`${seedOf(r.seed).label}, ${OPTIONS.fert.find(x => x.id === r.fert)?.label}`}>
                    <span className="tr-plot-chip" style={{ background: seedOf(r.seed).color }} aria-hidden="true" />
                    {seedOf(r.seed).label}
                  </span>
                ))}
                <NutriChips food={foodOf(tr, i)} max={2} compact />
              </button>
              ),
            )}
          </Row>
          <Row label="Rows">
            {tr.plans.map((_, i) => {
              if (isResting(tr, i))
                return (
                  <span key={i} className="tr-cell tr-rest-cell" aria-hidden="true">
                    —
                  </span>
                );
              const n = strategiesOf(tr, i).filter(st => chosen(st).length).length;
              return (
                <button type="button" key={i} className={`tr-cell tr-rows-cell${n ? ' is-diff' : ''}`} onClick={() => setRowsFor(i)} aria-label={`${farmName(i)}: row strategies. Tap to choose each row's way of farming`}>
                  {n ? `${n} of 4 rows changed` : 'Row strategies'}
                </button>
              );
            })}
          </Row>
        </div>
        <div className="tr-foot">
          <span>
            Total <b>{money(total)}</b> · you have {money(s.coins)}
          </span>
          {!tr.guided && (
            <button type="button" className="tr-link" onClick={() => dispatch({ type: 'trialSuggest' })}>
              Suggest one change per farm
            </button>
          )}
        </div>
      </div>

      <GuideLine text={line} action={{ label: tr.guided ? 'Plant both farms' : planted === k ? `Plant all ${k} farms` : `Plant ${planted} · rest ${k - planted}`, onClick: plant }} />

      {useFor !== null && <UsePicker s={s} tr={tr} farm={useFor} dispatch={dispatch} onClose={() => setUseFor(null)} />}

      {board !== null && (
        <div className="abs ending" style={{ inset: 0 }} onClick={() => setBoard(null)} role="dialog" aria-label="Farm inputs">
          <div className="fs-panel pb-panel is-over" onClick={e => e.stopPropagation()}>
            <CloseX onClick={() => setBoard(null)} />
            <PlotBoard gate={s} tr={tr} farm={board} kinds={['seed', 'fert', 'sprayer']} coins={s.coins} dispatch={dispatch} onFarm={setBoard} />
            <button type="button" className="pb-close" onClick={() => setBoard(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {pick && <Picker s={s} tr={tr} farm={pick.farm} stepKey={pick.key} dispatch={dispatch} onClose={() => setPick(null)} />}
      {rowsFor !== null && <StrategyBoard gate={s} tr={tr} farm={rowsFor} locked={() => false} dispatch={dispatch} onClose={() => setRowsFor(null)} />}

      {planting && (
        <div className="abs ending" style={{ inset: 0 }} onClick={() => setPlanting(false)}>
          <div className="tr-card" onClick={e => e.stopPropagation()}>
            <CloseX onClick={() => setPlanting(false)} />
            <p className="tr-card-title">How should the days pass?</p>
            <p>Six days of checks, then harvest.</p>
            <div className="tr-choice">
              <button type="button" onClick={() => sow('daily')}>
                <b>One day each real day</b>
                <span>Check once a day. Harvest in about a week.</span>
              </button>
              <button type="button" onClick={() => sow('fast')}>
                <b>Play the six days now</b>
                <span>A new day starts once every farm is checked.</span>
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
        <CloseX onClick={onClose} />
        <p className="tr-card-title">
          {farmName(farm)} · {step.label}
        </p>
        {stepKey === 'water' && (
          <p className="tr-card-small">
            {FORECASTS[tr.forecast].label}.{s.trialHistory.length > 0 ? ` Maize needs about ${WATER_NEED} L/m² a week in all.` : ''}
          </p>
        )}
        {BUYING_STEPS.includes(stepKey) && <OpenLine s={s} total={step.options.length} />}
        <ul>
          {step.options.map((op, i) => (
            <li key={op.id}>
              <button
                type="button"
                className={`${op.id === current ? 'is-on' : ''}${op.id !== current && !planOptionOpen(s, stepKey, op.id) ? ' is-gated' : ''}`}
                disabled={op.id !== current && !planOptionOpen(s, stepKey, op.id)}
                onClick={() => {
                  dispatch({ type: 'trialPlan', farm, key: stepKey, value: op.id });
                  onClose();
                }}
              >
                <b>
                  {op.label}
                  <Info term={planTerm(stepKey, op.id)} nested size={14} />
                </b>
                <span>{op.does}</span>
                <ClimateTag d={optionDelta(stepKey, op.id, tr.forecast, hasSolar(s))} />
                <i>{op.cost ? `${money(op.cost)}` : 'Free'}</i>
                {op.id !== current && !planOptionOpen(s, stepKey, op.id) && <LockTag s={s} index={i} />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** A farm's use this cycle: planted, or rested under a cover crop or natural fallow (src/soil). */
function UsePicker({ s, tr, farm, dispatch, onClose }: { s: GameState; tr: Trial; farm: number; dispatch: Dispatch<Action>; onClose: () => void }) {
  const soil = soilOf(s.soil);
  const h = soil.health[farm];
  const current = restOf(tr, farm);
  const choose = (rest: RestKind | null) => {
    dispatch({ type: 'trialRest', farm, rest });
    onClose();
  };
  const crop = CROP_WORDS[cropOf(tr, farm)].name;
  return (
    <div className="abs ending" style={{ inset: 0 }} onClick={onClose} role="dialog" aria-label={`${farmName(farm)}: plant or rest`}>
      <div className="tr-picker" onClick={e => e.stopPropagation()}>
        <CloseX onClick={onClose} />
        <p className="tr-card-title">{farmName(farm)} · plant or rest</p>
        <p className="tr-card-small">
          Soil {h} ({SOIL_WORD[soilTone(h)].toLowerCase()}): harvest {soilEffect(h)}.{soil.streak[farm] ? ` Cropped ${soil.streak[farm]} cycle${soil.streak[farm] === 1 ? '' : 's'} in a row.` : ''} A resting farm grows no harvest this
          cycle and needs no work; its soil comes back, and its plants store carbon every day.
        </p>
        <ul>
          <li>
            <button type="button" className={!current ? 'is-on' : ''} onClick={() => choose(null)}>
              <b>🌽 Plant {crop}</b>
              <span>Grow this cycle’s plan. A crop takes about 10 soil points; mulch, manure and beans give some back.</span>
              <i>{money(farmCost({ ...tr, rest: undefined }, farm))}</i>
            </button>
          </li>
          {REST_KINDS.map(kind => (
            <li key={kind}>
              <button type="button" className={current === kind ? 'is-on' : ''} onClick={() => choose(kind)}>
                <b>
                  {REST[kind].icon} {REST[kind].label}
                </b>
                <span>
                  {REST[kind].does} {REST[kind].why} Soil +{REST[kind].soil}.
                </span>
                <span className="clim-tag is-good">🌿 Stores {REST[kind].carbon} kg CO₂ an acre a day</span>
                <i>{REST[kind].cost ? money(REST[kind].cost) : 'Free'}</i>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- growing ---------------- */

function Growing({ s, tr, dispatch, t, inWorld }: Props & { s: GameState; tr: Trial; inWorld: boolean }) {
  const [rowsFor, setRowsFor] = useState<number | null>(null);
  const sown = (farm: number) => s.field.cycle === tr.cycle && doneMask(s.field, tr.cycle, farm, 'sow') > 0;
  const day = currentDay(tr, dayNumber());
  const ready = day > CHECK_DAYS;
  const k = plantedFarms(tr).length;
  const todayLeft = ready ? 0 : plantedFarms(tr).filter(i => !tr.checks[checkKey(i, day)]).length;

  let line: string;
  let action: { label: string; onClick: () => void } | undefined;
  if (ready) {
    line = t('Harvest time, {name}! See which farm grew the most.');
    action = inWorld
      ? { label: 'Go and harvest', onClick: () => dispatch({ type: 'trials', open: false }) }
      : { label: 'Harvest all farms', onClick: () => dispatch({ type: 'trialHarvest' }) };
  } else if (todayLeft > 0) {
    line = t(`Day ${day} of ${CHECK_DAYS}: ${todayLeft === k ? (k === 2 ? 'both farms need' : `all ${k} farms need`) : `${todayLeft} ${todayLeft === 1 ? 'farm needs' : 'farms need'}`} a check today, {name}.`);
    action = inWorld
      ? { label: 'Back to the farm', onClick: () => dispatch({ type: 'trials', open: false }) }
      : { label: 'Check my farms', onClick: () => dispatch({ type: 'rounds', open: true, trial: true }) };
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
            const rest = restOf(tr, i);
            if (rest)
              return (
                <Row
                  key={i}
                  label={
                    <>
                      <b>{farmName(i)}</b>
                      <small>Resting: {REST[rest].short.toLowerCase()}</small>
                    </>
                  }
                >
                  {Array.from({ length: CHECK_DAYS }, (_, dd) => (
                    <span key={dd} className="tr-day is-rest">
                      {dd === 0 ? `${REST[rest].icon} Resting` : ''}
                    </span>
                  ))}
                </Row>
              );
            const diff = i === 0 ? [] : differences(tr.plans[0], p);
            const tests = tr.crops
              ? cap(CROP_WORDS[cropOf(tr, i)].name)
              : i === 0
                ? tr.guided
                  ? 'A common way'
                  : 'Starting plan'
                : diff.length
                  ? diff.map(key => `${stepOf(key).label}: ${lower(optionOf(key, p).label)}`).join(', ')
                  : 'Same as Farm 1';
            return (
              <Row
                key={i}
                label={
                  <>
                    <b>{farmName(i)}</b>
                    <small>{tests}</small>
                    <NutriChips food={foodOf(tr, i)} max={3} compact label={`${farmName(i)} grows ${CROP_WORDS[cropOf(tr, i)].name}:`} />
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
          <span>{tr.clock === 'daily' ? 'One day each real day. Come back tomorrow.' : 'A new day starts once every farm is checked.'}</span>
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
          <button type="button" className="tr-link" onClick={() => setRowsFor(0)}>
            Row strategies
          </button>
        </div>
      </div>
      <GuideLine text={line} action={action} />
      {rowsFor !== null && <StrategyBoard gate={s} tr={tr} farm={rowsFor} locked={sown} dispatch={dispatch} onClose={() => setRowsFor(null)} />}
    </>
  );
}

/* ---------------- results ---------------- */

function Compare({ s, tr, dispatch, t }: Props & { s: GameState; tr: Trial }) {
  const results = tr.results ?? [];
  const why = explain(tr, results);
  const [keep, setKeep] = useState(why.best);
  const [byPlot, setByPlot] = useState(false);
  const [byRow, setByRow] = useState(false);
  const hasRows = results.some(r => r.rows);
  const lessons = plotLessons(tr);
  const k = tr.plans.length;
  const maxBags = Math.max(6, ...results.map(r => r.bags));
  const income = results.reduce((n, r) => n + r.income, 0);
  const differing = FARM_STEPS.filter(step => tr.plans.some((p, i) => !isResting(tr, i) && String(p[step.key]) !== String(tr.plans[plantedFarms(tr)[0] ?? 0][step.key])));
  const kept = s.recipe && samePlan(s.recipe, tr.plans[keep]);
  // the soil change this cycle made: shown once the cycle is the last one harvested (src/soil)
  const soilLast = tr.cycle === s.trialHistory[s.trialHistory.length - 1]?.cycle ? soilOf(s.soil).last : undefined;
  const restedLine = soilLast?.filter(x => x.rest).map(x => `${farmName(x.farm)} rested: soil ${x.from} → ${x.to}.`);
  const tiredLine = soilLast
    ?.filter(x => !x.rest && x.to < 50)
    .map(x => farmName(x.farm))
    .slice(0, 2);

  return (
    <>
      <div className="fs-panel tr-panel tr-compare">
        {byRow ? (
          <RowResults tr={tr} />
        ) : byPlot ? (
          <PlotResults tr={tr} />
        ) : (
        <div className="tr-grid" style={{ gridTemplateColumns: `100px repeat(${k}, minmax(0, 1fr))` }}>
          <div className="tr-head tr-corner">Harvest</div>
          {results.map((r, i) => (
            <button type="button" key={i} className={`tr-head tr-pick${i === keep ? ' is-on' : ''}${r.rested ? ' is-resting' : ''}`} onClick={() => !r.rested && setKeep(i)} disabled={!!r.rested} aria-pressed={i === keep}>
              <b>
                {farmName(i)}
                {i === why.best && !r.rested && <i>Most grown</i>}
                {r.rested && <i>Rested</i>}
              </b>
            </button>
          ))}
          <div className="tr-label">{tr.crops ? 'Harvest' : 'Maize'}</div>
          {results.map((r, i) =>
            r.rested ? (
              <div key={i} className="tr-bar is-rest">
                <b>
                  {REST[r.rested].icon} {REST[r.rested].short}
                </b>
              </div>
            ) : (
              <div key={i} className="tr-bar">
                <span style={{ height: `${Math.max(3, (r.bags / maxBags) * 100)}%` }} className={i === why.best ? 'is-best' : i === why.worst ? 'is-worst' : ''} />
                <b>{r.bags} bags</b>
              </div>
            ),
          )}
          {soilLast && (
            <Row label={<span title="Each farm's soil before and after this cycle (src/soil)">Soil</span>}>
              {results.map((_, i) => {
                const c = soilLast.find(x => x.farm === i);
                if (!c) return <div key={i} className="tr-val tr-small">—</div>;
                return (
                  <div key={i} className={`tr-val tr-small ${c.to > c.from ? 'is-up' : c.to < c.from ? 'is-neg' : ''}`} title={c.why.join(' · ')}>
                    {c.from} → {c.to}
                  </div>
                );
              })}
            </Row>
          )}
          <div className="tr-label">Quality</div>
          {results.map((r, i) => (
            <div key={i} className="tr-val">
              <Stars value={r.quality} size={8} />
            </div>
          ))}
          <div className="tr-label">Profit</div>
          {results.map((r, i) => (
            <div key={i} className={`tr-val${r.profit < 0 ? ' is-neg' : ''}`} title={`Sold for ${money(r.income)}, cost ${money(r.costs)}`}>
              {money(r.profit)}
            </div>
          ))}
          <div className="tr-label" title="What each farm's harvest gives the people who eat it: a day's need for this many adults">
            Feeds
          </div>
          {results.map((r, i) => (
            <div key={i} className="tr-val tr-small">
              <NutriTotal total={nutritionOf(harvestFood(tr, i, r))} top={2} compact prefix={`${farmName(i)}'s harvest feeds`} />
            </div>
          ))}
          {results.some(r => r.care?.length) && (
            <Row label="Care">
              {results.map((r, i) => {
                const missed = (r.care ?? []).filter(c => !c.done);
                return (
                  <div key={i} className={`tr-val tr-small${missed.length ? ' is-neg' : ''}`} title={(r.care ?? []).map(c => `${ROUTINE[c.job].title}: ${c.done ? 'done' : 'missed'}`).join(' · ')}>
                    {!r.care?.length ? '—' : missed.length ? `Missed: ${missed.map(c => ROUTINE[c.job].short).join(', ')}` : 'All done'}
                  </div>
                );
              })}
            </Row>
          )}
          {differing.map(step => (
            <Row key={step.key} label={step.label}>
              {tr.plans.map((p, i) => (
                <div key={i} className={`tr-val tr-small${i > 0 && String(p[step.key]) !== String(tr.plans[0][step.key]) ? ' is-diff' : ''}`}>
                  {isResting(tr, i) ? '—' : optionOf(step.key, p).label}
                </div>
              ))}
            </Row>
          ))}
        </div>
        )}
        <aside className="tr-why">
          <div className="tr-tabs" role="tablist" aria-label="Results">
            <button type="button" role="tab" aria-selected={!byPlot && !byRow} className={!byPlot && !byRow ? 'is-on' : ''} onClick={() => (setByPlot(false), setByRow(false))}>
              By farm
            </button>
            <button type="button" role="tab" aria-selected={byPlot} className={byPlot ? 'is-on' : ''} onClick={() => (setByPlot(true), setByRow(false))}>
              By input
            </button>
            {hasRows && (
              <button type="button" role="tab" aria-selected={byRow} className={byRow ? 'is-on' : ''} onClick={() => (setByRow(true), setByPlot(false))}>
                By row
              </button>
            )}
          </div>
          <p className="tr-why-title">TemoLima AI</p>
          {byRow ? (
            <div className="tr-lessons">
              {results.map((r, i) => (r.rows ? rowLesson(r.rows, farmName(i)) : null)).filter(Boolean).map(l => (
                <p key={l!}>{l}</p>
              ))}
            </div>
          ) : byPlot ? (
            <div className="tr-lessons">
              {lessons.map(l => (
                <p key={l.topic}>
                  <b>{l.topic}.</b> {cap(l.line.replace(/^[^,]+, /, ''))}
                </p>
              ))}
            </div>
          ) : (
            <>
              {why.lines.map(l => (
                <p key={l}>{l}</p>
              ))}
              {restedLine?.length ? <p>{restedLine.join(' ')} It comes back to the plan with a bigger harvest.</p> : null}
              {tiredLine?.length ? <p>{tiredLine.join(' and ')}: soil is worn out. Rest {tiredLine.length === 1 ? 'it' : 'them'} next cycle, or mulch and add manure.</p> : null}
            </>
          )}
          <GoldButton font={10} height={30} style={{ width: '100%', marginTop: 'auto' }} selected={!!kept} onClick={() => dispatch({ type: 'trialRecipe', farm: keep })}>
            {kept ? `${farmName(keep)}'s plan is your recipe` : `Keep ${farmName(keep)}'s plan as my recipe`}
          </GoldButton>
        </aside>
      </div>
      <GuideLine
        text={t(
          tr.guided
            ? `Both farms sold for ${money(income)}, {name}. Next: six farms, six changes.`
            : `Cycle ${tr.cycle} sold for ${money(income)}, {name}. Keep what worked; test more.`,
        )}
        action={{ label: 'Plan the next cycle', onClick: () => dispatch({ type: 'trialNew' }) }}
      />
    </>
  );
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/** The food a farm grows, for its nutrition markers. */
const foodOf = (tr: Trial, farm: number) => (cropOf(tr, farm) === 'kale' ? 'sukuma' : 'maize') as 'sukuma' | 'maize';
/** A farm's harvest as kg of food: its bags, and the beans grown between its maize rows. */
const harvestFood = (tr: Trial, farm: number, r: { bags: number; beans: number }) => ({ [foodOf(tr, farm)]: r.bags * MARKET.bagKg, ...(r.beans > 0 ? { drybeans: r.beans * MARKET.bagKg } : {}) });

/** The crops of a cycle, for its tag: "Maize" or "Maize & sukuma wiki". */
const cropsLine = (tr: Trial) => cap([...new Set(tr.plans.map((_, i) => CROP_WORDS[cropOf(tr, i)].name))].join(' & '));

/** Each farm's four rows side by side: what each row's strategy grew and earned, its return and its climate. */
function RowResults({ tr }: { tr: Trial }) {
  const results = tr.results ?? [];
  return (
    <div className="tr-rowres" aria-label="Harvest by row">
      <div className="tr-rowres-farm">
        <div className="tr-head tr-corner">By row</div>
        {[1, 2, 3, 4].map(r => (
          <div key={r} className="tr-head">
            <b>Row {r}</b>
          </div>
        ))}
      </div>
      {results.map((res, i) =>
        res.rows ? (
          <div key={i} className="tr-rowres-farm">
            <b>{farmName(i)}</b>
            {res.rows.map(row => {
              const best = res.rows!.every(x => x.profit <= row.profit);
              return (
                <div key={row.row} className={`tr-rowres-cell${best ? ' is-best' : ''}`} title={row.options.join(', ') || 'As the farm plan'}>
                  <b>{row.bags} bags</b> · {money(row.profit)}
                  <small>{row.ret === null ? 'As the plan' : `Return ${row.ret >= 0 ? '+' : '−'}${Math.round(Math.abs(row.ret) * 100)}%`} · {row.labour.toFixed(1)} days</small>
                  <small>{row.options.join(', ') || 'As the farm plan'}</small>
                  <small>
                    {Math.round(row.co2)} kg CO₂ · stores {Math.round(row.stored)} · {row.water > 0 ? '+' : ''}
                    {Math.round(row.water)} L
                  </small>
                </div>
              );
            })}
          </div>
        ) : null,
      )}
    </div>
  );
}

/** Every farm's harvest beside its inputs: what each seed, fertilizer, sprayer and machine grew under the same weather. */
function PlotResults({ tr }: { tr: Trial }) {
  const results = tr.results ?? [];
  const max = Math.max(1, ...results.map(r => r.bags));
  return (
    <div className="tr-grid pt-grid" style={{ gridTemplateColumns: `64px minmax(0, 1fr)` }} aria-label="Harvest by input">
      <div className="tr-head tr-corner">By input</div>
      <div className="tr-head">
        <b>Harvest · seed · fertilizer · sprayer</b>
      </div>
      {results.map((r, i) => {
        if (r.rested) return null;
        const inp = plotsOf(tr, i)[0];
        const fert = OPTIONS.fert.find(x => x.id === inp.fert)?.label;
        const spray = inp.sprayer && inp.sprayer !== 'none' ? OPTIONS.sprayer.find(x => x.id === inp.sprayer)?.label : '';
        const best = results.every(q => q.bags <= r.bags);
        return (
          <Row key={i} label={<b>{farmName(i)}</b>}>
            <div className={`pt-cell${best ? ' is-best' : ''}`}>
              <span className="pt-bar" style={{ width: `${Math.max(4, (r.bags / max) * 100)}%` }} />
              <b>
                {r.bags} {r.bags === 1 ? 'bag' : 'bags'}
                {inp.tractor && <i className="pt-tractor"> · {inp.tractor} tractor</i>}
              </b>
              <small>
                {seedOf(inp.seed).label} · {fert}
                {spray ? ` · ${spray}` : ''}
              </small>
            </div>
          </Row>
        );
      })}
    </div>
  );
}
