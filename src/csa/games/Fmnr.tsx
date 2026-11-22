import { useEffect, useMemo, useState } from 'react';
import { FMNR, STEM_NAME, scoreFmnr, stumpsFor, type Stem } from '../rules';
import { GameFrame, Go, Say, animate, type GameProps } from './common';

/* Kisiki hai (farmer-managed natural regeneration), played: four old stumps in a field, each sprouting seven stems.
   Tap a stem to cut it (tap again to keep it). Keep 3 to 5 of the tallest, straightest, strongest on each stump and
   cut the thin, crooked and broken ones. Then let the years pass: the stems kept become trees, with shade, leaves for
   the soil, fodder and firewood. */

type Phase = 'prune' | 'years' | 'done';
const W = 600;
const H = 260;
const GROUND = 214;
const STUMP_X = [84, 226, 368, 510];
const LEN = 112;

/** A stem's path from the stump: straight, crooked (zig-zag) or broken (snapped short). */
function stemPath(st: Stem, x: number, grow = 0) {
  const len = LEN * st.height * (1 + grow * 0.4);
  // the stems kept grow up straighter as they become trees
  const a = (st.angle * (1 - grow * 0.45) * Math.PI) / 180;
  const ex = x + Math.sin(a) * len;
  const ey = GROUND - 4 - Math.cos(a) * len;
  if (st.kind === 'crooked') {
    const m1x = x + Math.sin(a) * len * 0.33 + 10;
    const m1y = GROUND - 4 - Math.cos(a) * len * 0.33;
    const m2x = x + Math.sin(a) * len * 0.66 - 10;
    const m2y = GROUND - 4 - Math.cos(a) * len * 0.66;
    return { d: `M${x} ${GROUND - 4} L${m1x} ${m1y} L${m2x} ${m2y} L${ex} ${ey}`, ex, ey };
  }
  return { d: `M${x} ${GROUND - 4} L${ex} ${ey}`, ex, ey };
}

export function FmnrGame({ seed, onDone }: GameProps) {
  const stumps = useMemo(() => stumpsFor(seed), [seed]);
  const [cut, setCut] = useState<boolean[][]>(() => stumps.map(s => s.map(() => false)));
  const [phase, setPhase] = useState<Phase>('prune');
  const [t, setT] = useState(0);
  const [say, setSay] = useState<{ text: string; tone?: 'good' | 'bad' }>({ text: 'Tap a stem to cut it. Keep 3 to 5 of the best on every stump.' });
  const r = scoreFmnr(stumps, cut);

  useEffect(() => {
    if (phase === 'years') return animate(2600, setT, () => setPhase('done'));
  }, [phase]);

  const tap = (s: number, i: number) => {
    if (phase !== 'prune') return;
    const st = stumps[s][i];
    const now = !cut[s][i];
    setCut(cut.map((row, a) => (a === s ? row.map((v, b) => (b === i ? now : v)) : row)));
    if (now) setSay(st.kind === 'strong' ? { text: 'That one was tall, straight and strong: one of the best to keep.', tone: 'bad' } : { text: `Cut: it was ${STEM_NAME[st.kind]}.`, tone: 'good' });
    else setSay({ text: `Kept: ${STEM_NAME[st.kind]}.`, tone: st.kind === 'strong' ? 'good' : 'bad' });
  };

  const grow = phase === 'prune' ? 0 : phase === 'years' ? t : 1;
  const yearsNow = Math.round(grow * 5);

  const stage = (
    <svg viewBox={`0 0 ${W} ${H}`} className="csa-svg" aria-label="Four stumps in a field">
      <rect width={W} height={H} fill={grow > 0.5 ? '#d9eef7' : '#f3e2b6'} />
      {/* wind across the bare field, slowed once the trees are up */}
      {[50, 90, 130].map(y => (
        <path key={y} d={`M0 ${y} q 60 -8 120 0 t 120 0 t 120 0 ${grow > 0.6 ? '' : 't 120 0 t 120 0'}`} stroke="#c9b48a" strokeWidth={2} fill="none" opacity={0.6 - grow * 0.3} strokeDasharray="10 8" />
      ))}
      <rect x={0} y={GROUND} width={W} height={H - GROUND} fill={grow > 0.4 ? '#7d5a3a' : '#a07a4f'} />
      {/* the crop under the trees: greener as they grow */}
      {Array.from({ length: 22 }, (_, i) => (
        <path key={i} d={`M${14 + i * 27} ${H - 8} l 0 -${10 + grow * 10}`} stroke={grow > 0.5 ? '#3e9b2f' : '#9aa35a'} strokeWidth={3} />
      ))}
      {stumps.map((stems, s) => {
        const x = STUMP_X[s];
        const kept = stems.filter((_, i) => !cut[s][i]).length;
        return (
          <g key={s}>
            {/* the canopy, once the years have passed */}
            {grow > 0 &&
              stems.map((st, i) => {
                if (cut[s][i]) return null;
                const p = stemPath(st, x, grow);
                const k = st.kind === 'strong' ? 1 : st.kind === 'thin' ? 0.5 : 0.35;
                return <circle key={`c${i}`} cx={p.ex} cy={p.ey} r={(6 + 22 * k) * grow} fill={st.kind === 'strong' ? '#3f8f3a' : '#8aa35a'} opacity={0.85} />;
              })}
            {stems.map((st, i) => {
              const isCut = cut[s][i];
              const p = stemPath(st, x, grow);
              const width = st.kind === 'strong' ? 6 + grow * 6 : st.kind === 'thin' ? 2 + grow : 4;
              const colour = st.kind === 'broken' ? '#8c6b3f' : '#6b4a2a';
              return (
                <g
                  key={i}
                  role="button"
                  tabIndex={0}
                  className="csa-stem"
                  aria-label={`Stump ${s + 1}, stem ${i + 1}: ${STEM_NAME[st.kind]}, ${isCut ? 'cut' : 'kept'}`}
                  aria-pressed={isCut}
                  onClick={() => tap(s, i)}
                  onKeyDown={e => e.key === 'Enter' && tap(s, i)}
                >
                  {/* the tap area: the upper part of the stem and its tip, where the stems are apart */}
                  <line x1={x + (p.ex - x) * 0.45} y1={GROUND - 4 + (p.ey - GROUND + 4) * 0.45} x2={p.ex} y2={p.ey} stroke="transparent" strokeWidth={14} />
                  <circle cx={p.ex} cy={p.ey} r={11} fill="transparent" />
                  {isCut ? (
                    <g>
                      <path d={stemPath({ ...st, height: 0.12 }, x).d} stroke={colour} strokeWidth={width} strokeLinecap="round" />
                      {phase === 'prune' && <path d={p.d} stroke="#6b4a2a" strokeWidth={1.5} strokeDasharray="3 4" fill="none" opacity={0.45} />}
                    </g>
                  ) : (
                    <g>
                      <path d={p.d} stroke={colour} strokeWidth={width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      {grow === 0 && st.kind !== 'broken' && <circle cx={p.ex} cy={p.ey} r={st.kind === 'strong' ? 6 : 4} fill="#5fae3c" />}
                      {grow === 0 && st.kind === 'broken' && <path d={`M${p.ex - 4} ${p.ey - 4} l 8 8 M${p.ex + 4} ${p.ey - 4} l -8 8`} stroke="#a0522d" strokeWidth={2} />}
                    </g>
                  )}
                </g>
              );
            })}
            <ellipse cx={x} cy={GROUND - 2} rx={16} ry={7} fill="#5a3a1f" />
            <text x={x} y={GROUND + 18} textAnchor="middle" className={`csa-svg-note${phase === 'prune' && (kept < FMNR.keepMin || kept > FMNR.keepMax) ? ' is-bad' : ''}`}>
              Keeping {kept}
            </text>
          </g>
        );
      })}
      {grow > 0 && (
        <text x={W / 2} y={20} textAnchor="middle" className="csa-svg-note">
          {yearsNow < 5 ? `Year ${Math.max(1, yearsNow)}…` : 'Five years on: shade, leaves for the soil, fodder and firewood'}
        </text>
      )}
    </svg>
  );

  const side = (
    <>
      <p className="csa-step">{phase === 'prune' ? '1 · Prune the stumps' : '2 · The years pass'}</p>
      <Say tone={say.tone}>{phase === 'prune' ? say.text : phase === 'years' ? 'Protected from the goats, the stems grow into trees…' : r.score >= 0.85 ? 'Strong, straight trees: shade for the crops and the cows, leaves that feed the soil, and a stem to cut for firewood each year.' : 'Some trees grew crooked, crowded or weak. Keep the straightest, strongest 3 to 5 and cut the rest.'}</Say>
      <ul className="csa-picks">
        {stumps.map((stems, s) => {
          const p = r.per[s];
          return (
            <li key={s} className={phase === 'prune' ? '' : p.score >= 0.85 ? 'is-good' : 'is-bad'}>
              Stump {s + 1}: keeping {p.kept}
              {phase !== 'prune' && ` · ${Math.round(p.right * stems.length)}/${stems.length} right`}
            </li>
          );
        })}
      </ul>
      {phase === 'prune' && <Go onClick={() => setPhase('years')}>⏩ Let five years pass</Go>}
      {phase === 'done' && (
        <>
          <Go onClick={() => onDone(r.score, `${r.per.filter(p => p.inRange).length} of ${stumps.length} stumps kept to 3–5 stems · ${Math.round(r.score * 100)}% of the stems decided right`)}>Finish</Go>
          <button type="button" className="set-link csa-again" onClick={() => (setPhase('prune'), setT(0))}>
            Prune again
          </button>
        </>
      )}
    </>
  );
  return <GameFrame label="Kisiki hai: pruning living stumps" stage={stage} side={side} />;
}
