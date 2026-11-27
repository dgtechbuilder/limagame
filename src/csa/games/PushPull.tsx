import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { PP, PP_CELLS, ppKind, scorePushPull, strigaOf, type PpPlant } from '../rules';
import { GameFrame, Go, Say, Tool, animate, type GameProps } from './common';

/* Push-pull, played: a maize field from above, with an edge all round and a gap between each pair of maize rows.
   Plant desmodium (the push) and Brachiaria grass (the pull): tap a square, or drag across several. Then the moths
   fly in from every side: the border grass traps them, desmodium beside the maize drives them off, and any that get
   through lay their eggs on the maize. At the end of the season, maize with no desmodium beside it has striga. */

type ToolId = PpPlant | 'clear';
type Phase = 'plant' | 'fly' | 'season';
const W = 600;
const H = 260;
const C = 33;
const OX = 14;
const OY = 14;
const cellXY = (i: number) => ({ x: OX + (i % PP.w) * C, y: OY + Math.floor(i / PP.w) * C });
const centre = (i: number) => {
  const { x, y } = cellXY(i);
  return { x: x + C / 2, y: y + C / 2 };
};
const KIND_NAME = { border: 'edge', maize: 'maize', gap: 'gap between the maize rows' } as const;

export function PushPullGame({ seed, onDone }: GameProps) {
  const [plants, setPlants] = useState<Record<number, PpPlant>>({});
  const [tool, setTool] = useState<ToolId>('desmodium');
  const [phase, setPhase] = useState<Phase>('plant');
  const [t, setT] = useState(0);
  const [say, setSay] = useState<{ text: string; tone?: 'good' | 'bad' }>({ text: 'Pick a plant and tap the squares, or drag across them. Maize is already sown.' });
  const painting = useRef(false);
  const svg = useRef<SVGSVGElement>(null);
  const r = scorePushPull(plants, seed);

  useEffect(() => {
    if (phase === 'fly') return animate(3000, setT, () => setPhase('season'));
  }, [phase]);
  useEffect(() => {
    if (phase !== 'season') return;
    const eggs = r.moths.filter(m => m.fate === 'eggs').length;
    setSay({
      text: `${r.moths.filter(m => m.fate === 'trapped' && !m.turned).length} moths pulled into the border grass, ${r.moths.filter(m => m.turned && m.fate !== 'eggs').length} pushed out by desmodium, ${eggs} laid eggs on the maize. ${r.striga ? `${r.striga} maize plants have striga.` : 'No striga.'}`,
      tone: eggs <= 2 && !r.striga ? 'good' : 'bad',
    });
  }, [phase]);

  const paint = (i: number) => {
    if (phase !== 'plant') return;
    const kind = ppKind(i);
    if (kind === 'maize') return;
    if (tool === 'clear') {
      if (!plants[i]) return;
      const next = { ...plants };
      delete next[i];
      return setPlants(next);
    }
    if (plants[i] === tool) return;
    setPlants(p => ({ ...p, [i]: tool }));
    if (tool === 'grass' && kind === 'gap') setSay({ text: 'Grass between the maize rows pulls the moths INTO the field. It belongs round the edge.', tone: 'bad' });
    else if (tool === 'desmodium' && kind === 'border') setSay({ text: 'Desmodium on the edge does not trap moths; it pushes best beside the maize, between the rows.', tone: 'bad' });
  };
  const cellAt = (e: RPointerEvent<SVGSVGElement>) => {
    const s = svg.current;
    if (!s) return -1;
    const m = s.getScreenCTM();
    if (!m) return -1;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    const cx = Math.floor((pt.x - OX) / C);
    const cy = Math.floor((pt.y - OY) / C);
    return cx < 0 || cy < 0 || cx >= PP.w || cy >= PP.h ? -1 : cy * PP.w + cx;
  };
  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    const i = cellAt(e);
    if (i < 0) return;
    painting.current = true;
    paint(i);
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!painting.current) return;
    const i = cellAt(e);
    if (i >= 0) paint(i);
  };
  const stop = () => {
    painting.current = false;
  };

  const striga = phase === 'season' ? new Set(strigaOf(plants)) : new Set<number>();

  const stage = (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className="csa-svg csa-paint"
      aria-label="A maize field from above"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      <rect width={W} height={H} fill="#e2d3af" />
      {PP_CELLS.map(i => {
        const { x, y } = cellXY(i);
        const kind = ppKind(i);
        const p = plants[i];
        return (
          <g key={i} role={kind === 'maize' ? undefined : 'button'} tabIndex={kind === 'maize' ? undefined : 0} aria-label={kind === 'maize' ? undefined : `${KIND_NAME[kind]}, row ${Math.floor(i / PP.w) + 1}, square ${(i % PP.w) + 1}: ${p ?? 'empty'}`} onKeyDown={e => e.key === 'Enter' && paint(i)} className="csa-cell">
            <rect x={x + 1} y={y + 1} width={C - 2} height={C - 2} rx={4} fill={kind === 'border' ? '#d1bd92' : kind === 'gap' ? '#c6af83' : '#af9065'} />
            {kind === 'maize' && (
              <g>
                <path d={`M${x + C / 2} ${y + C - 5} L${x + C / 2} ${y + 6}`} stroke="#477a2f" strokeWidth={3} />
                <path d={`M${x + C / 2} ${y + 18} q -9 -3 -11 -9 M${x + C / 2} ${y + 13} q 9 -3 11 -9`} stroke="#5e9b40" strokeWidth={3} fill="none" />
                {striga.has(i) && <circle cx={x + 7} cy={y + C - 7} r={4} fill="#a75eb8" />}
              </g>
            )}
            {p === 'desmodium' && (
              <g>
                {[8, 17, 26].map(d => (
                  <circle key={d} cx={x + d} cy={y + C / 2 + ((d / 9) % 2 ? 3 : -3)} r={5} fill="#78b45a" stroke="#4d8436" />
                ))}
              </g>
            )}
            {p === 'grass' && (
              <g>
                {[7, 13, 19, 25].map(d => (
                  <path key={d} d={`M${x + d} ${y + C - 4} l -3 -20 M${x + d} ${y + C - 4} l 3 -18`} stroke="#42782e" strokeWidth={2.4} />
                ))}
              </g>
            )}
          </g>
        );
      })}
      {/* the moths */}
      {phase !== 'plant' &&
        r.moths.map((m, k) => {
          const a = centre(m.from);
          const b = centre(m.to);
          // they start outside the field, beyond the edge square they fly over
          const sx = a.x + (a.x - (OX + (PP.w * C) / 2)) * 0.35;
          const sy = a.y + (a.y - (OY + (PP.h * C) / 2)) * 0.35;
          const tt = phase === 'season' ? 1 : Math.max(0, Math.min(1, t * 1.6 - (k % 5) * 0.12));
          let x: number;
          let y: number;
          if (!m.turned) {
            // straight in: stopped by the border grass, or on to lay on the maize
            const end = m.fate === 'trapped' ? a : b;
            x = sx + (end.x - sx) * tt;
            y = sy + (end.y - sy) * tt;
          } else {
            // in toward the maize, then driven back out by the desmodium: into the grass, or away for good
            const v = tt < 0.55 ? tt / 0.55 : 1 - (tt - 0.55) / 0.45;
            const back = m.fate === 'trapped' ? a : { x: sx, y: sy };
            const near = { x: a.x + (b.x - a.x) * 0.6, y: a.y + (b.y - a.y) * 0.6 };
            if (tt < 0.55) {
              x = sx + (near.x - sx) * v;
              y = sy + (near.y - sy) * v;
            } else {
              x = back.x + (near.x - back.x) * v;
              y = back.y + (near.y - back.y) * v;
            }
            if (m.fate === 'eggs' && tt >= 1) {
              x = b.x;
              y = b.y;
            }
          }
          return (
            <g key={k} transform={`translate(${x} ${y})`} aria-hidden="true">
              <path d="M0 0 l -6 -5 l 0 10 z M0 0 l 6 -5 l 0 10 z" fill={m.fate === 'eggs' ? '#916b44' : m.fate === 'trapped' ? '#776953' : '#b8a281'} opacity={phase === 'season' && m.fate === 'pushed' ? 0 : 0.95} />
              {phase === 'season' && m.fate === 'eggs' && <circle r={3} fill="#c75d48" />}
            </g>
          );
        })}
      {/* the key */}
      <g transform="translate(296 16)" className="csa-key">
        <rect width={292} height={110} rx={10} fill="#fdfaf2" opacity={0.94} />
        <text x={12} y={22}>🌽 Maize rows, sown</text>
        <text x={12} y={42}>🍀 Desmodium: pushes moths, stops striga</text>
        <text x={12} y={62}>🌾 Brachiaria / Napier grass: pulls, traps moths</text>
        <text x={12} y={82}>🦋 Moths fly in from every side</text>
        <text x={12} y={102}>🟣 Striga (witchweed) on the maize roots</text>
      </g>
      {phase === 'season' && (
        <g transform="translate(296 136)" className="csa-key">
          <rect width={292} height={110} rx={10} fill="#fdfaf2" opacity={0.94} />
          <text x={12} y={24}>Pulled into the border grass: {r.moths.filter(m => m.fate === 'trapped' && !m.turned).length}</text>
          <text x={12} y={46}>Pushed out by desmodium: {r.moths.filter(m => m.turned && m.fate !== 'eggs').length}</text>
          <text x={12} y={68}>Eggs on the maize: {r.moths.filter(m => m.fate === 'eggs').length}</text>
          <text x={12} y={90}>Maize with striga: {r.striga} of 18</text>
        </g>
      )}
    </svg>
  );

  const side = (
    <>
      <p className="csa-step">{phase === 'plant' ? '1 · Plant the push and the pull' : phase === 'fly' ? '2 · The moths fly in' : '3 · The season'}</p>
      {phase === 'plant' && (
        <div className="csa-tools">
          <Tool on={tool === 'desmodium'} onClick={() => setTool('desmodium')}>🍀 Desmodium</Tool>
          <Tool on={tool === 'grass'} onClick={() => setTool('grass')}>🌾 Brachiaria grass</Tool>
          <Tool on={tool === 'clear'} onClick={() => setTool('clear')}>✖ Clear</Tool>
        </div>
      )}
      <Say tone={say.tone}>{say.text}</Say>
      <p className="csa-count">
        Edge grass {Math.round(r.borderGrass * 100)}% · gaps with desmodium {Math.round(r.gapDesmo * 100)}%
      </p>
      {phase === 'plant' && <Go onClick={() => setPhase('fly')}>🦋 Let the moths come</Go>}
      {phase === 'season' && (
        <>
          <Go onClick={() => onDone(r.score, `${r.moths.filter(m => m.fate !== 'eggs').length} of ${r.moths.length} moths kept off the maize · ${18 - r.striga} of 18 maize plants free of striga`)}>Finish</Go>
          <button type="button" className="set-link csa-again" onClick={() => (setPhase('plant'), setSay({ text: 'Change the layout and try again.' }))}>
            Change the layout
          </button>
        </>
      )}
    </>
  );
  return <GameFrame label="Push-pull" stage={stage} side={side} />;
}
