import { useState } from 'react';
import { Info } from '../learn/Info';
import { NavBar } from '../components/Nav';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { GuideLine } from '../first/Review';
import { track } from '../first/track';
import { RoundPicture } from '../rounds/Inspect';
import { ROUND_PART_LABELS, type Round } from '../rounds/data';
import { HAZARD_WORDS, type TrialHazard } from '../trials/model';
import type { FixOption } from './data';
import type { Treatment } from './treatments';
import { money } from '../money';
import { Confetti, iconFor } from '../minigames/fun';

/* From Wakala Agent: after a right call in the farm world, pick the fix. One of three is right; a wrong one costs
   coins and says why it would not work, then the player picks again. The right one leads to the work by hand. */

export function Prescribe({
  round,
  hazard,
  farmName,
  tag,
  options,
  name,
  cost,
  wrongBefore,
  then,
  onPick,
  onDone,
  onLeave,
  treatments,
  treatment,
  baseCost = 0,
  onTreat,
}: {
  /** after the right fix: the ways to do it, each with its cost, labour and payoff (care/treatments.ts) */
  treatments?: Treatment[];
  /** the way chosen so far (missing: the first, the standard way) */
  treatment?: string;
  /** the standard treatment's cost, which each way's costX multiplies */
  baseCost?: number;
  onTreat?: (t: Treatment) => void;
  round: Round;
  hazard: TrialHazard;
  farmName: string;
  tag: string;
  /** the three fixes, in the order to show them */
  options: FixOption[];
  name: string;
  /** coins a wrong fix costs */
  cost: number;
  /** wrong fixes already picked for this farm today (from the save) */
  wrongBefore: number;
  /** what the right fix leads to, as a sentence end, e.g. "walk over the weeds to cut them (300 coins)." */
  then: string;
  onPick: (option: FixOption) => void;
  onDone: () => void;
  onLeave: () => void;
}) {
  const [tried, setTried] = useState<string[]>([]);
  const [picked, setPicked] = useState<FixOption | null>(null);
  const right = picked?.right ? picked : null;

  const pick = (op: FixOption) => {
    if (right || tried.includes(op.id)) return;
    track('prescribe', { hazard, pick: op.id, right: op.right });
    onPick(op);
    setPicked(op);
    if (!op.right) setTried(v => [...v, op.id]);
  };

  let line = `${name}, what will fix ${farmName}? A wrong fix costs ${money(cost)}.`;
  if (wrongBefore > 0 && !picked) line = `Pick again, ${name}. A wrong fix costs ${money(cost)}.`;
  if (picked && !picked.right) line = `${picked.lesson} −${money(cost)}. Pick again.`;
  if (right) line = `${right.lesson} Now ${then}`;

  return (
    <div className="abs fs-screen review care-screen" style={{ inset: 0 }}>
      <FarmMap dim={0.42} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <img src={img.plank} alt="" width={203} height={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 11 }}>
          Choose the fix
        </span>
      </div>
      <span className="rr-roundtag">{tag}</span>
      <span className="rr-roundtag rr-cropnote">Read right: {HAZARD_WORDS[hazard]}</span>
      <NavBar horizontal onBack={right ? onDone : onLeave} style={{ right: 28, top: 8 }} />

      <div className="fs-panel" style={{ left: 30, top: 78, width: 814, height: 246 }}>
        <div className="clue-art">
          <RoundPicture round={round} part={round.clue.part} credit />
          <span className="zoom-label">{ROUND_PART_LABELS[round.clue.part]}</span>
        </div>
        <div className="care-opts" role="group" aria-label="Fixes">
          <p className="care-ask">What will fix it?</p>
          {options.map(op => {
            const wrong = tried.includes(op.id);
            const isRight = right?.id === op.id;
            return (
              <button
                type="button"
                key={op.id}
                className={`care-opt${wrong ? ' is-wrong' : ''}${isRight ? ' is-right' : ''}`}
                disabled={wrong || (!!right && !isRight)}
                aria-pressed={isRight || undefined}
                onClick={() => pick(op)}
              >
                <span className="care-mark" aria-hidden="true">
                  {wrong ? '✕' : isRight ? '✓' : ''}
                </span>
                <span className="care-icon" aria-hidden="true">
                  {iconFor(op.label)}
                </span>
                <span>{op.label}</span>
                {wrong && <small>−{money(cost)}</small>}
                <Info term={op.label} nested size={17} />
              </button>
            );
          })}
          {right && (
            <span className="care-cheer">
              <Confetti n={24} />
            </span>
          )}
          {right && treatments && treatments.length > 1 && (
            <div className="care-ways" role="group" aria-label="How to do it">
              <p className="care-ask">How will you do it?</p>
              <div className="care-ways-row">
                {treatments.map((w, i) => {
                  const on = (treatment ?? treatments[0].id) === w.id;
                  return (
                    <button
                      type="button"
                      key={w.id}
                      className={`care-way${on ? ' is-on' : ''}${w.smart ? ' is-smart' : ''}`}
                      aria-pressed={on}
                      onClick={() => onTreat?.(w)}
                      title={w.does}
                    >
                      <b>
                        {w.label}
                        <Info term={w.label} nested size={13} />
                      </b>
                      <small>
                        {money(Math.round(baseCost * w.costX))} · {w.labour} day{w.labour === 1 ? '' : 's'} · stops {Math.round(w.effect * 100)}%
                      </small>
                      <i>{w.smart ? 'Climate-smart' : i === 0 ? 'Standard' : ''}</i>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <GuideLine text={line} action={right ? { label: 'Back to the farm', onClick: onDone } : undefined} />
    </div>
  );
}
