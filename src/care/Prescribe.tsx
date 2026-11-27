import { useState } from 'react';
import { Info } from '../learn/Info';
import { NavBar } from '../components/Nav';
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
   coins and says why it would not work, then the player picks again. The right one asks how to do it (the ways in
   care/treatments.ts, a climate-smart one among them); the player buys the way chosen, and the farmer walks straight
   off to do the work by hand on the farm (World.tsx goWork). */

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
  coins = Infinity,
  paid,
  onBuy,
}: {
  /** after the right fix: the ways to do it, each with its cost, labour and payoff (care/treatments.ts) */
  treatments?: Treatment[];
  /** the way chosen so far (missing: the first, the standard way) */
  treatment?: string;
  /** the standard treatment's cost, which each way's costX multiplies */
  baseCost?: number;
  onTreat?: (t: Treatment) => void;
  /** the player's coins, for the buy button */
  coins?: number;
  /** coins already paid for the way chosen (it is bought: the work is left) */
  paid?: number;
  /** buy the way chosen and go and do the work */
  onBuy?: () => void;
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
  const ways = treatments ?? [];
  const way = ways.find(w => w.id === treatment) ?? ways[0];
  const price = way ? Math.round(baseCost * way.costX) : baseCost;
  const bought = paid !== undefined;
  const short = !bought && coins < price;
  if (right) {
    line = bought
      ? `${right.lesson} Bought. Now ${then}`
      : onBuy
        ? `${right.lesson} ${ways.length > 1 ? 'Choose how, buy it, then ' : 'Buy it, then '}${then}`
        : `${right.lesson} Now ${then}`;
    if (short) line = `${right.lesson} ${way?.label ?? 'This fix'} costs ${money(price)} and you have ${money(coins)}: pick a cheaper way, or sell some harvest first.`;
  }
  const action = !right
    ? undefined
    : bought || !onBuy
      ? { label: 'Back to the farm', onClick: onDone }
      : { label: short ? `Need ${money(price)}` : `Buy · ${money(price)} → work`, onClick: onBuy, aria: short ? `Need ${money(price)} for ${way?.label ?? 'the fix'}` : `Buy ${way?.label ?? 'the fix'} for ${money(price)} and go to the farm` };

  return (
    <div className="abs fs-screen review care-screen" style={{ inset: 0 }}>
      <FarmMap dim={0.42} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <span className="title-tab" aria-hidden="true" />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 8.5 }}>
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
                      className={`care-way${on ? ' is-on' : ''}${w.smart ? ' is-smart' : ''}${bought && on ? ' is-bought' : ''}`}
                      aria-pressed={on}
                      disabled={bought && !on}
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
                      <i>{bought && on ? '✓ Bought' : w.smart ? 'Climate-smart' : i === 0 ? 'Standard' : ''}</i>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <GuideLine text={line} action={action} />
    </div>
  );
}
