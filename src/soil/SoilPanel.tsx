import type { Dispatch } from 'react';
import type { Action, GameState } from '../state';
import { farmName, isResting, restOf } from '../trials/model';
import { soilCare } from '../csa/model';
import { REST, SOIL, SOIL_WORD, restAdvice, soilEffect, soilOf, soilTone } from './model';

/* The six farms' soil, on Climate › Climate Smart Agriculture: each farm's soil health and what it does to the
   harvest, the cycles it has been cropped in a row, which farms rest this cycle, and which are worth resting next.
   From here the player rests the advised farms in the cycle's plan (or opens the plan), so learning a practice and
   farming with it are one step apart. */

export function SoilPanel({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const soil = soilOf(s.soil);
  const t = s.trial;
  const planning = !!t && t.phase === 'plan' && !t.guided;
  const growing = !!t && t.phase === 'growing';
  const advice = restAdvice(s.soil).filter(a => !t || a.farm < t.plans.length);
  const care = soilCare(s.csa);
  const openPlan = () => dispatch({ type: 'trials', open: true });
  const restAdvised = () => {
    for (const a of advice) dispatch({ type: 'trialRest', farm: a.farm, rest: 'cover' });
    openPlan();
  };
  const last = soil.last?.filter(x => x.to !== x.from) ?? [];

  return (
    <div className="soil-panel" aria-label="Your six farms' soil">
      <div className="soil-head">
        <p className="set-title">Your six farms’ soil</p>
        <p className="set-body">
          Every crop takes soil away; a rest under a cover crop or fallow brings it back. Soil {SOIL.start} grows the harvest the plan expects; worn-out soil grows less.
          {care.crop || care.rest ? ` Your skills: a crop takes ${care.crop} less, a rest gives ${care.rest} more.` : ''}
        </p>
      </div>
      <ul className="soil-farms">
        {soil.health.map((h, i) => {
          const rest = t && t.phase !== 'done' ? restOf(t, i) : null;
          const tone = soilTone(h);
          const change = last.find(x => x.farm === i);
          return (
            <li key={i} className={`soil-farm is-${tone}${rest ? ' is-resting' : ''}`}>
              <b>{farmName(i)}</b>
              <span className="soil-meter" role="meter" aria-label={`${farmName(i)} soil`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={h}>
                <span style={{ width: `${Math.max(4, h)}%` }} />
              </span>
              <small>
                {h} · {SOIL_WORD[tone]} · harvest {soilEffect(h)}
              </small>
              <small>
                {rest
                  ? `${REST[rest].icon} ${growing ? 'Resting' : 'To rest'}: ${REST[rest].short.toLowerCase()}`
                  : soil.streak[i]
                    ? `Cropped ${soil.streak[i]} cycle${soil.streak[i] === 1 ? '' : 's'} in a row`
                    : soil.rested[i]
                      ? `Rested ${soil.rested[i]} time${soil.rested[i] === 1 ? '' : 's'}`
                      : 'Not cropped yet'}
              </small>
              {change && (
                <small className={change.to > change.from ? 'is-up' : 'is-down'} title={change.why.join(' · ')}>
                  Last cycle {change.from} → {change.to}
                </small>
              )}
            </li>
          );
        })}
      </ul>
      <div className="soil-advice">
        {advice.length ? (
          <p>
            <b>Worth resting next:</b> {advice.map(a => `${farmName(a.farm)} (${a.why})`).join(', ')}.
          </p>
        ) : (
          <p>
            <b>No farm needs a rest yet.</b> Rest one in turns before its soil drops below {SOIL.restBelow}, or keep it up with mulch, manure and beans between the rows.
          </p>
        )}
        <div className="soil-btns">
          {planning && advice.some(a => !isResting(t!, a.farm)) && (
            <button type="button" className="gold-btn csa-go" onClick={restAdvised}>
              Rest {advice.map(a => farmName(a.farm)).join(' and ')} under a cover crop ›
            </button>
          )}
          {(!t || t.phase !== 'growing') && (
            <button type="button" className="set-link" onClick={openPlan}>
              {planning ? 'Open this cycle’s plan ›' : 'Plan the next cycle ›'}
            </button>
          )}
          {growing && <span className="soil-note">The farms are growing; choose what rests when you plan the next cycle.</span>}
        </div>
      </div>
    </div>
  );
}
