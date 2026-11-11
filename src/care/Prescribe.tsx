import { useState } from 'react';
import { NavBar } from '../components/Nav';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { GuideLine } from '../first/Review';
import { track } from '../first/track';
import { RoundPicture } from '../rounds/Inspect';
import { ROUND_PART_LABELS, type Round } from '../rounds/data';
import { HAZARD_WORDS, type TrialHazard } from '../trials/model';
import type { FixOption } from './data';
import { money } from '../money';

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
}: {
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

  let line = `${name}, what will fix ${farmName}? A wrong fix costs ${money(cost)} coins.`;
  if (wrongBefore > 0 && !picked) line = `Pick again, ${name}. A wrong fix costs ${money(cost)} coins.`;
  if (picked && !picked.right) line = `${picked.lesson} −${money(cost)} coins. Pick again.`;
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
      <NavBar horizontal onBack={right ? onDone : onLeave} style={{ right: 6, top: 4 }} />

      <div className="fs-panel" style={{ left: 24, top: 78, width: 826, height: 246 }}>
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
                <span>{op.label}</span>
                {wrong && <small>−{money(cost)} coins</small>}
              </button>
            );
          })}
        </div>
      </div>

      <GuideLine text={line} action={right ? { label: 'Back to the farm', onClick: onDone } : undefined} />
    </div>
  );
}
