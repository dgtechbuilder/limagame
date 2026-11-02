import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { img } from '../assets';
import { CheckBadge } from '../components/Icons';
import { FarmMap } from '../components/FarmMap';
import { GoldButton } from '../components/ui';
import { Field, FIELD_H, FIELD_W, FarmerFigure, PartArt, rowGeometry } from './art';
import { CALLS, PART_LABELS, say, type Call, type Look, type PartId, type ShambaReview } from './data';
import { track } from './track';

/* One review, driven entirely by a ShambaReview record:
   Look (four parts, tap to zoom) → Spot (tap the rows that look wrong) → Judge (pick a call) → Result. */

const PARTS: PartId[] = ['crop', 'pests', 'soil', 'layout'];
type Step = 'look' | 'spot' | 'judge' | 'right' | 'wrong';

/** One-sentence line from the guide, with an optional button. Used on every first-session screen. */
export function GuideLine({ text, action, style }: { text: ReactNode; action?: { label: string; onClick: () => void; aria?: string }; style?: CSSProperties }) {
  return (
    <div className="guide-line" style={style}>
      <span className="guide-face">
        <img src={img.guide} alt="" />
      </span>
      <p key={String(text)} className="guide-text" role="status">
        {text}
      </p>
      {action && (
        <GoldButton font={11} height={34} style={{ minWidth: 150, padding: '0 14px', flexShrink: 0 }} onClick={action.onClick} ariaLabel={action.aria}>
          {action.label}
        </GoldButton>
      )}
    </div>
  );
}

export function CallIcon({ id }: { id: Call }) {
  const common = { width: 30, height: 30, viewBox: '0 0 30 30' };
  if (id === 'healthy')
    return (
      <svg {...common}>
        <path d="M15,27 C15,18 15,12 15,8" stroke="#2f7d27" strokeWidth={2.4} fill="none" />
        <path d="M15,14 Q5,12 4,4 Q13,4 15,14 Z M15,11 Q25,9 26,2 Q17,2 15,11 Z" fill="#3fae3a" />
      </svg>
    );
  if (id === 'water')
    return (
      <svg {...common}>
        <path d="M15,3 Q24,15 24,19 A9,9 0 0 1 6,19 Q6,15 15,3 Z" fill="#22ade2" stroke="#137aa3" strokeWidth={1.2} />
      </svg>
    );
  if (id === 'pests')
    return (
      <svg {...common}>
        {[0, 1, 2, 3].map(k => (
          <circle key={k} cx={8 + k * 5} cy={17 + (k % 2) * 1.5} r={4.2} fill="#7a8a3a" stroke="#3f4520" />
        ))}
        <circle cx={5} cy={16} r={4.4} fill="#3a2414" />
        <path d="M3,18 L5,15 L7,18 M5,15 L5,12.5" stroke="#f2e6c8" strokeWidth={0.9} fill="none" />
      </svg>
    );
  if (id === 'flood')
    return (
      <svg {...common}>
        <path d="M15,3 Q23,13 23,17 A8,8 0 0 1 7,17 Q7,13 15,3 Z" fill="#22ade2" stroke="#137aa3" strokeWidth={1.2} />
        <path d="M2,23 q4,-4 7,0 t7,0 t7,0 t5,0 M2,27 q4,-4 7,0 t7,0 t7,0 t5,0" stroke="#137aa3" strokeWidth={1.6} fill="none" />
      </svg>
    );
  if (id === 'disease')
    return (
      <svg {...common}>
        <path d="M4,22 Q4,6 24,5 Q26,24 8,26 Z" fill="#6fbf3a" stroke="#2a6f24" strokeWidth={1.1} />
        <circle cx={12} cy={14} r={3} fill="#7a3b10" />
        <circle cx={19} cy={10} r={2} fill="#7a3b10" />
        <circle cx={16} cy={19} r={2.2} fill="#7a3b10" />
      </svg>
    );
  if (id === 'weeds')
    return (
      <svg {...common}>
        <path d="M4,27 L26,27" stroke="#7a5230" strokeWidth={2} />
        <path d="M9,27 Q7,17 4,11 M9,27 Q10,15 12,8 M16,27 Q15,17 19,9 M21,27 Q22,19 26,14" stroke="#4fae3c" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <circle cx={12} cy={7} r={2.4} fill="#f5d33a" />
      </svg>
    );
  if (id === 'animals')
    return (
      <svg {...common}>
        <ellipse cx={14} cy={18} rx={9} ry={5.6} fill="#f3efe6" stroke="#8a7a64" strokeWidth={1.1} />
        <circle cx={23} cy={14} r={3.6} fill="#f3efe6" stroke="#8a7a64" strokeWidth={1.1} />
        <path d="M22,10.5 l-1,-4 M25,11 l2,-4 M8,23 v4 M12,23.5 v4 M17,23.5 v4 M21,22 v5" stroke="#5a4a38" strokeWidth={1.4} />
      </svg>
    );
  if (id === 'hail')
    return (
      <svg {...common}>
        <path d="M6,15 Q2,15 3,11 Q4,7 9,8 Q11,3 17,5 Q22,3 24,9 Q29,9 27,14 Q27,16 24,15 Z" fill="#9aa7b4" stroke="#5f6b78" strokeWidth={1.1} />
        {[[9, 21], [15, 24], [21, 20], [12, 28], [19, 28]].map(([x, y], k) => (
          <circle key={k} cx={x} cy={y} r={2.2} fill="#fff" stroke="#6b8aa0" strokeWidth={0.9} />
        ))}
      </svg>
    );
  if (id === 'plantEarly' || id === 'plantLate' || id === 'harvestEarly' || id === 'harvestLate')
    return (
      <svg {...common}>
        <rect x={4} y={6} width={22} height={21} rx={3} fill="#fff8ec" stroke="#7a5230" strokeWidth={1.4} />
        <rect x={4} y={6} width={22} height={6} rx={3} fill="#c9925a" stroke="#7a5230" strokeWidth={1.4} />
        {id.startsWith('plant') ? (
          <path d="M15,25 L15,18 M15,19 Q10,18 9,14 Q14,14 15,19 Z M15,18 Q20,17 21,13 Q16,13 15,18 Z" fill="#4fae3c" stroke="#2a6f24" strokeWidth={1} />
        ) : (
          <path d="M11,25 Q9,18 14,14 Q20,16 18,24 Z" fill="#f2c230" stroke="#8a6a24" strokeWidth={1} />
        )}
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M7,9 Q15,5 23,9 L25,26 Q15,29 5,26 Z" fill="#c9925a" stroke="#7a5230" strokeWidth={1.2} />
      <path d="M9,9 Q15,3 21,9" fill="#e9d29a" stroke="#7a5230" strokeWidth={1} />
      <text x={15} y={21} textAnchor="middle" fontSize={7} fontWeight={700} fill="#fff" fontFamily="Poppins, sans-serif">
        NPK
      </text>
    </svg>
  );
}

export function Review({
  shamba,
  name,
  look,
  ending,
  onPassed,
  onFailed,
  onEnd,
}: {
  shamba: ShambaReview;
  name: string;
  look: Look;
  /** the one-line card after a right call, and its button */
  ending: { line: string; button: string };
  onPassed: () => void;
  /** wrong call on a shamba that has a retry shamba: the player goes there */
  onFailed: () => void;
  onEnd: () => void;
}) {
  const full = shamba.hints === 'full';
  const [step, setStep] = useState<Step>('look');
  const [seen, setSeen] = useState<PartId[]>([]);
  const [zoom, setZoom] = useState<PartId | null>(null);
  const [misses, setMisses] = useState(0);
  const [miss, setMiss] = useState<{ x: number; y: number; id: number } | null>(null);
  const [found, setFound] = useState(false);
  const [wrongCall, setWrongCall] = useState<Call | null>(null);
  const [phase, setPhase] = useState(0); // result animation: 0 lit rows, 1 recovering, 2 ending card
  const started = useRef(performance.now());
  const t = (line: string) => say(line, name);

  useEffect(() => {
    track('review_start', { shamba: shamba.id });
    started.current = performance.now();
  }, [shamba.id]);

  useEffect(() => {
    if (step !== 'right') return;
    const a = window.setTimeout(() => setPhase(1), 1700);
    const b = window.setTimeout(() => setPhase(2), 4300);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [step]);

  const nextPart = PARTS.find(p => !seen.includes(p)) ?? null;
  const allSeen = seen.length === PARTS.length;

  const openPart = (p: PartId) => {
    setZoom(p);
    if (!seen.includes(p)) {
      setSeen(v => [...v, p]);
      track('part_viewed', { shamba: shamba.id, part: p });
    }
  };

  const tapRow = (row: number, x: number, y: number) => {
    if (found) return;
    if (shamba.problemRows.includes(row)) {
      setFound(true);
      track('spot_found', { shamba: shamba.id, misses });
      window.setTimeout(() => setStep('judge'), 1300);
    } else {
      setMisses(m => m + 1);
      setMiss({ x, y, id: Date.now() });
    }
  };

  const judge = (c: Call) => {
    const right = c === shamba.correct;
    track('call', { shamba: shamba.id, call: c, right, secs: Math.round((performance.now() - started.current) / 1000) });
    if (right) {
      setPhase(0);
      setStep('right');
      onPassed();
    } else {
      setWrongCall(c);
      setStep('wrong');
    }
  };

  const steps: [Step[], string][] = [
    [['look'], 'Look'],
    [['spot'], 'Spot'],
    [['judge'], 'Judge'],
    [['right', 'wrong'], 'Result'],
  ];
  const stepAt = steps.findIndex(([s]) => s.includes(step));

  /* ---------------- guide line for the current moment ---------------- */
  let line: ReactNode = '';
  let action: { label: string; onClick: () => void; aria?: string } | undefined;
  if (zoom) {
    line = shamba.captions[zoom];
    action = allSeen || step !== 'look' ? { label: 'Done looking', onClick: () => setZoom(null) } : { label: 'Next part', onClick: () => nextPart && openPart(nextPart) };
  } else if (step === 'look') {
    line = allSeen ? t('Now find the rows that look wrong, {name}.') : seen.length === 0 ? t(shamba.intro ?? (full ? 'Look at each part of your shamba, {name}. Tap the glowing one.' : 'Same as before, {name}: look at every part first.')) : full ? 'Good. Tap the next glowing picture.' : `${PARTS.length - seen.length} more to look at.`;
    if (allSeen) action = { label: 'Spot the problem', onClick: () => setStep('spot') };
  } else if (step === 'spot') {
    line = found ? 'You found it!' : misses === 0 ? t('Tap the rows that look wrong, {name}.') : full ? (misses >= 2 ? 'Those rows are fine. Look where the leaves are pale and torn.' : 'Those rows are fine. Compare the leaves.') : misses >= 3 ? 'Compare the back rows with the front.' : 'Those look fine. Look again.';
  } else if (step === 'judge') {
    line = t("What's wrong in those rows, {name}?");
  } else if (step === 'right') {
    line = phase === 0 ? t(shamba.right) : shamba.practice;
  } else if (step === 'wrong') {
    line = t(shamba.clue.text);
    action = shamba.retry
      ? {
          label: 'Try the back maize',
          onClick: () => {
            track('review_failed', { shamba: shamba.id, call: wrongCall });
            onFailed();
          },
        }
      : {
          label: 'Judge again',
          onClick: () => {
            track('review_failed', { shamba: shamba.id, call: wrongCall });
            setStep('judge');
          },
        };
  }

  const glowRows = (strong: boolean) =>
    shamba.problemRows.map(i => {
      const g = rowGeometry(shamba.rows, i);
      const h = (shamba.crop === 'maize' ? 66 : 50) * g.s;
      return <rect key={i} className={strong ? 'row-glow' : 'row-hint'} x={g.x0 - 4} y={g.y - h} width={g.x1 - g.x0 + 8} height={h + 10} rx={10} />;
    });

  return (
    <div className="abs fs-screen review" style={{ inset: 0 }}>
      <FarmMap dim={0.42} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <img src={img.plank} alt="" width={203} height={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 13 }}>
          {t(shamba.title)}
        </span>
      </div>

      <ol className="review-steps" aria-label="Review steps">
        {steps.map(([, label], i) => (
          <li key={label} className={i === stepAt ? (step === 'wrong' ? 'is-wrong' : 'is-now') : i < stepAt ? 'is-done' : ''}>
            {label}
          </li>
        ))}
      </ol>

      <div className="fs-panel" style={{ left: 24, top: 78, width: 826, height: 246 }}>
        {step === 'look' && (
          <div className="part-row">
            {PARTS.map(p => (
              <button
                type="button"
                key={p}
                className={`part-tile${full && p === nextPart ? ' is-next' : ''}${seen.includes(p) ? ' is-seen' : ''}`}
                onClick={() => openPart(p)}
                aria-label={`Look at ${PART_LABELS[p]}`}
              >
                <span className="part-img">
                  <PartArt part={p} crop={shamba.crop} cond={shamba.condition} problemRows={shamba.problemRows} rows={shamba.rows} />
                </span>
                <span className="part-label">
                  {PART_LABELS[p]} {seen.includes(p) && <CheckBadge size={12} />}
                </span>
              </button>
            ))}
          </div>
        )}

        {(step === 'spot' || step === 'right') && (
          <svg
            className="field-svg"
            viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
            style={{ position: 'absolute', left: step === 'right' ? 70 : 143, top: 4, width: 552, height: 239 }}
            role={step === 'spot' ? 'group' : 'img'}
            aria-label={step === 'spot' ? 'The shamba. Tap the rows that look wrong.' : 'The shamba recovering'}
          >
            <g className="heal-from" style={{ opacity: step === 'right' && phase >= 1 ? 0 : 1 }}>
              <Field crop={shamba.crop} cond={shamba.condition} problemRows={shamba.problemRows} rows={shamba.rows} seed={7} />
            </g>
            {step === 'right' && (
              <g className="heal-to" style={{ opacity: phase >= 1 ? 1 : 0 }}>
                <Field crop={shamba.crop} cond={shamba.condition} problemRows={shamba.problemRows} rows={shamba.rows} seed={7} healed />
              </g>
            )}
            {((step === 'spot' && found) || (step === 'right' && phase === 0)) && glowRows(true)}
            {step === 'spot' && !found && full && misses >= 2 && glowRows(false)}
            {step === 'spot' &&
              Array.from({ length: shamba.rows }, (_, i) => {
                const g = rowGeometry(shamba.rows, i);
                const h = g.band;
                return (
                  <rect
                    key={i}
                    className="row-hit"
                    x={g.x0 - 10}
                    y={g.y - h * 0.85}
                    width={g.x1 - g.x0 + 20}
                    height={h}
                    onClick={e => {
                      const svg = e.currentTarget.ownerSVGElement!;
                      const pt = svg.createSVGPoint();
                      pt.x = e.clientX;
                      pt.y = e.clientY;
                      const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
                      tapRow(i, p.x, p.y);
                    }}
                    aria-label={`Row ${i + 1} from the front`}
                    role="button"
                  />
                );
              })}
            {miss && step === 'spot' && (
              <g key={miss.id} className="miss-mark" transform={`translate(${miss.x},${miss.y})`}>
                <path d="M-9,-9 L9,9 M9,-9 L-9,9" stroke="#c0392b" strokeWidth={5} strokeLinecap="round" />
              </g>
            )}
            {step === 'right' && phase >= 1 && (
              <g className="sparkles">
                {[120, 230, 340, 450].map((x, i) => (
                  <path key={x} d="M0,-8 L2,-2 L8,0 L2,2 L0,8 L-2,2 L-8,0 L-2,-2 Z" transform={`translate(${x},${110 + (i % 2) * 30})`} fill="#fff6c2" />
                ))}
              </g>
            )}
          </svg>
        )}

        {step === 'right' && (
          <svg viewBox="-40 -100 80 104" className="cheer" style={{ position: 'absolute', left: 650, top: 36, width: 118, height: 154 }} aria-hidden="true">
            <FarmerFigure look={look} pose="cheer" />
          </svg>
        )}
        {step === 'right' && (
          <div className="name-bubble" style={{ left: 620, top: 12 }}>
            {name}!
          </div>
        )}

        {step === 'judge' && (
          <>
            <div className="judge-thumbs">
              {PARTS.map(p => (
                <button type="button" key={p} className="part-tile small" onClick={() => setZoom(p)} aria-label={`Look again at ${PART_LABELS[p]}`}>
                  <span className="part-img">
                    <PartArt part={p} crop={shamba.crop} cond={shamba.condition} problemRows={shamba.problemRows} rows={shamba.rows} />
                  </span>
                </button>
              ))}
            </div>
            <div className="calls">
              {CALLS.map(c => (
                <button type="button" key={c.id} className="call-btn" onClick={() => judge(c.id)}>
                  <CallIcon id={c.id} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'wrong' && (
          <>
            <div className="clue-art">
              <PartArt part={shamba.clue.part} crop={shamba.crop} cond={shamba.condition} problemRows={shamba.problemRows} rows={shamba.rows} ring />
            </div>
            <div className="wrong-note">
              <p className="wrong-title">Not quite, {name}.</p>
              <svg viewBox="-40 -100 80 104" width={92} height={120} aria-hidden="true">
                <FarmerFigure look={look} />
              </svg>
            </div>
          </>
        )}
      </div>

      {zoom && (
        <div className="abs zoom" style={{ inset: 0 }} onClick={() => setZoom(null)} role="dialog" aria-label={PART_LABELS[zoom]}>
          <div className="zoom-art" onClick={e => e.stopPropagation()}>
            <PartArt part={zoom} crop={shamba.crop} cond={shamba.condition} problemRows={shamba.problemRows} rows={shamba.rows} />
            <span className="zoom-label">{PART_LABELS[zoom]}</span>
          </div>
        </div>
      )}

      {step === 'right' && phase === 2 ? (
        <div className="abs ending" style={{ inset: 0 }}>
          <div className="ending-card">
            <p>{t(ending.line)}</p>
            <GoldButton font={12} height={38} style={{ width: 240, marginTop: 14 }} onClick={onEnd}>
              {ending.button}
            </GoldButton>
          </div>
        </div>
      ) : (
        <GuideLine text={line} action={action} />
      )}
    </div>
  );
}
