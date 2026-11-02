import { useEffect, useRef, useState } from 'react';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { CheckBadge } from '../components/Icons';
import { FarmerFigure, PartArt, WaterArt } from '../first/art';
import { say, type Call, type Look } from '../first/data';
import { CallIcon, GuideLine } from '../first/Review';
import { track } from '../first/track';
import { CHECK_COOLDOWN_S, FARMS, ROUND_PARTS, ROUND_PART_LABELS, usesLegacyArt, type Round, type RoundPart } from './data';
import { CALL_GROUPS, CROP_NAME, CYCLE_DAYS, STAGE_LABELS, type CallGroup } from './hazards';
import { photoFor } from './photos';
import { ScenePart } from './scene';

/* One farm check: Look at five pictures (crop, pests & disease, soil, water, state of the farm) → Judge → Result.
   A picture is a real photo when one has been added for it (see photos.ts), and drawn art until then. */

export type InspectView = 'look' | 'judge' | 'right' | 'wrong';
type Step = InspectView;

export function RoundPicture({ round, part, flag = false }: { round: Round; part: RoundPart; flag?: boolean }) {
  const url = photoFor(round, part);
  const isClue = flag && round.clue.part === part;
  if (url) {
    const ring = isClue ? round.clue.ring : undefined;
    return (
      <span className="rr-photo-wrap">
        <img className="rr-photo" src={url} alt={`${ROUND_PART_LABELS[part]}: a real photo of the farm`} loading="lazy" decoding="async" draggable={false} />
        {isClue && ring && (
          <svg className="rr-ring" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <circle className="clue-ring" cx={ring[0]} cy={ring[1] * 0.7} r={ring[2]} fill="none" stroke="#ffb005" strokeWidth={1.4} />
          </svg>
        )}
        {isClue && !ring && <span className="rr-flag" />}
      </span>
    );
  }
  if (part === 'water') return <WaterArt dry={round.cond === 'drought' || round.hazard === 'plantEarly'} flood={round.hazard === 'flood'} ring={isClue} />;
  if (usesLegacyArt(round)) return <PartArt part={part === 'farm' ? 'layout' : part} crop={round.crop} cond={round.cond} problemRows={round.problemRows} rows={round.rows} ring={isClue} />;
  return <ScenePart round={round} part={part} ring={isClue} />;
}

export function Inspect({
  round,
  name,
  look,
  second,
  points,
  startView = 'look',
  continueLabel,
  onResult,
  onContinue,
  onLeave,
}: {
  round: Round;
  name: string;
  look: Look;
  /** a second look, after the 30-second wait: the picture that held the clue is highlighted */
  second: boolean;
  /** what a right call pays now (0 when this farm has already paid) */
  points: number;
  startView?: InspectView;
  continueLabel: string;
  /** called once, when the player makes a call */
  onResult: (right: boolean) => void;
  onContinue: () => void;
  onLeave: () => void;
}) {
  const [step, setStep] = useState<Step>(startView);
  const [seen, setSeen] = useState<RoundPart[]>(startView === 'look' ? [] : ROUND_PARTS);
  // what this call pays, fixed when the check starts (the saved result changes `points` as soon as the call is made)
  const [payout] = useState(points);
  const [zoom, setZoom] = useState<RoundPart | null>(null);
  const [group, setGroup] = useState<CallGroup | null>(null);
  const started = useRef(performance.now());
  const t = (line: string) => say(line, name);

  useEffect(() => {
    started.current = performance.now();
  }, [round.id]);

  const allSeen = seen.length === ROUND_PARTS.length;
  const nextPart = ROUND_PARTS.find(p => !seen.includes(p)) ?? null;
  const hintPart = second && !allSeen ? round.clue.part : null;

  const openPart = (p: RoundPart) => {
    setZoom(p);
    if (!seen.includes(p)) {
      setSeen(v => [...v, p]);
      track('round_part_viewed', { round: round.id, part: p });
    }
  };

  const judge = (c: Call) => {
    const right = c === round.correct;
    track('round_call', { round: round.id, call: c, right, second, secs: Math.round((performance.now() - started.current) / 1000) });
    setStep(right ? 'right' : 'wrong');
    onResult(right);
  };

  const steps: [Step[], string][] = [
    [['look'], 'Look'],
    [['judge'], 'Judge'],
    [['right', 'wrong'], 'Result'],
  ];
  const stepAt = steps.findIndex(([s]) => s.includes(step));

  let line: string = '';
  let action: { label: string; onClick: () => void } | undefined;
  if (zoom) {
    line = round.captions[zoom];
    action = allSeen || step !== 'look' ? { label: 'Done looking', onClick: () => setZoom(null) } : { label: 'Next picture', onClick: () => nextPart && openPart(nextPart) };
  } else if (step === 'look') {
    line =
      seen.length === 0
        ? t(second ? 'Second look, {name}. Look at every picture again.' : 'Look at every picture first, {name}.')
        : allSeen
          ? t('Now make your call, {name}.')
          : `${ROUND_PARTS.length - seen.length} more to look at.`;
    if (allSeen) action = { label: 'Make your call', onClick: () => setStep('judge') };
  } else if (step === 'judge') {
    line = group ? t('Which one, {name}?') : t('What is going on at this farm, {name}?');
  } else if (step === 'right') {
    line = `${t(round.right)} ${round.practice}`;
    action = { label: continueLabel, onClick: onContinue };
  } else {
    line = t(round.clue.text);
    action = { label: continueLabel, onClick: onContinue };
  }

  return (
    <div className="abs fs-screen review" style={{ inset: 0 }}>
      <FarmMap dim={0.42} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <img src={img.plank} alt="" width={203} height={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 11 }}>
          {t(round.title)}
        </span>
      </div>
      <span className="rr-roundtag">
        Round {round.n} of {FARMS.length}
        {second ? ' · second look' : ''}
      </span>
      <span className="rr-roundtag rr-cropnote">
        {CROP_NAME[round.crop]} · {STAGE_LABELS[round.stage]} · day {round.day + 1} of {CYCLE_DAYS}
      </span>
      <button type="button" className="close-btn" style={{ left: 826, top: 4, width: 36, height: 36 }} aria-label="Back to my farm" onClick={onLeave}>
        <img src={img.close} alt="" style={{ width: 36, height: 36 }} />
      </button>

      <ol className="review-steps" aria-label="Check steps">
        {steps.map(([, label], i) => (
          <li key={label} className={i === stepAt ? (step === 'wrong' ? 'is-wrong' : 'is-now') : i < stepAt ? 'is-done' : ''}>
            {label}
          </li>
        ))}
      </ol>

      <div className="fs-panel" style={{ left: 24, top: 78, width: 826, height: 246 }}>
        {step === 'look' && (
          <div className="part-row five">
            <p className="rr-progress">
              Tap each picture to look closer · {seen.length} of {ROUND_PARTS.length} seen
            </p>
            {ROUND_PARTS.map(p => (
              <button
                type="button"
                key={p}
                className={`part-tile${p === hintPart ? ' is-next' : ''}${seen.includes(p) ? ' is-seen' : ''}`}
                onClick={() => openPart(p)}
                aria-label={`Look at ${ROUND_PART_LABELS[p]}`}
              >
                <span className="part-img">
                  <RoundPicture round={round} part={p} />
                </span>
                <span className="part-label">
                  {ROUND_PART_LABELS[p]} {seen.includes(p) && <CheckBadge size={12} />}
                </span>
              </button>
            ))}
            <p className="rr-diary">
              <b>Farmer's note:</b> {t(round.diary)}
            </p>
          </div>
        )}

        {step === 'judge' && (
          <>
            <div className="judge-thumbs five">
              {ROUND_PARTS.map(p => (
                <button type="button" key={p} className="part-tile small" onClick={() => setZoom(p)} aria-label={`Look again at ${ROUND_PART_LABELS[p]}`}>
                  <span className="part-img">
                    <RoundPicture round={round} part={p} />
                  </span>
                </button>
              ))}
            </div>
            <p className="rr-diary judge">
              <b>Farmer's note:</b> {t(round.diary)}
            </p>
            <div className={`calls five${group ? ' sub' : ''}`}>
              {group ? (
                <>
                  <button type="button" className="call-back" onClick={() => setGroup(null)}>
                    ← Back
                  </button>
                  {group.calls.map(c => (
                    <button type="button" key={c.id} className="call-btn" onClick={() => judge(c.id)}>
                      <CallIcon id={c.id} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </>
              ) : (
                CALL_GROUPS.map(g => (
                  <button type="button" key={g.id} className={`call-btn${g.id === 'ok' ? ' wide' : ''}`} onClick={() => (g.calls.length === 1 ? judge(g.calls[0].id) : setGroup(g))}>
                    <CallIcon id={g.icon} />
                    <span>{g.label}</span>
                    {g.calls.length > 1 && <i aria-hidden="true">›</i>}
                  </button>
                ))
              )}
            </div>
          </>
        )}

        {(step === 'right' || step === 'wrong') && (
          <>
            <div className="clue-art">
              <RoundPicture round={round} part={round.clue.part} flag={step === 'wrong'} />
              <span className="zoom-label">{ROUND_PART_LABELS[round.clue.part]}</span>
            </div>
            <div className="wrong-note rr-result">
              {step === 'right' ? (
                <>
                  <p className="wrong-title" style={{ color: '#2f9b14' }}>
                    {name}!
                  </p>
                  <svg viewBox="-40 -100 80 104" width={104} height={136} className="cheer" aria-hidden="true">
                    <FarmerFigure look={look} pose="cheer" />
                  </svg>
                  <span className="rr-points">{payout > 0 ? `+${payout} points` : 'Points already earned'}</span>
                </>
              ) : (
                <>
                  <p className="wrong-title">Not quite, {name}.</p>
                  <svg viewBox="-40 -100 80 104" width={92} height={120} aria-hidden="true">
                    <FarmerFigure look={look} />
                  </svg>
                  <span className="rr-wait">
                    <img src={img.clock} alt="" width={16} height={16} />
                    You can check this farm again in {CHECK_COOLDOWN_S} seconds.
                  </span>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {zoom && (
        <div className="abs zoom" style={{ inset: 0 }} onClick={() => setZoom(null)} role="dialog" aria-label={ROUND_PART_LABELS[zoom]}>
          <div className="zoom-art" onClick={e => e.stopPropagation()}>
            <RoundPicture round={round} part={zoom} />
            <span className="zoom-label">{ROUND_PART_LABELS[zoom]}</span>
          </div>
        </div>
      )}

      <GuideLine text={line} action={action} />
    </div>
  );
}
