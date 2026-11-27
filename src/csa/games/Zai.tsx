import { useEffect, useState } from 'react';
import { ZAI, newPits, scoreZai, type Pit } from '../rules';
import { GameFrame, Go, Say, Sprout, Tool, animate, type GameProps } from './common';

/* Zaï pits, played: a crusted field in the dry season. Dig a pit at every mark with the hoe, put manure in each,
   bring the first rain and watch it fill the pits while it runs off the hard ground between them; then sow. Seed put
   in a dry pit before the rain is lost; after the rain the ground is too wet and late to dig. */

type ToolId = 'hoe' | 'manure' | 'seed';
type Phase = 'dry' | 'raining' | 'wet' | 'grow';
const W = 600;
const H = 260;
const X0 = 70;
const DX = 92;
const Y0 = 78;
const DY = 72;
const at = (i: number) => ({ x: X0 + (i % ZAI.cols) * DX, y: Y0 + Math.floor(i / ZAI.cols) * DY });

export function ZaiGame({ onDone }: GameProps) {
  const [pits, setPits] = useState<Pit[]>(newPits);
  const [tool, setTool] = useState<ToolId>('hoe');
  const [phase, setPhase] = useState<Phase>('dry');
  const [t, setT] = useState(0);
  const [say, setSay] = useState<{ text: string; tone?: 'good' | 'bad' }>({ text: 'The dry season. Dig a pit at every mark, then put manure in each. Sow when the rain has come.' });

  useEffect(() => {
    if (phase === 'raining') return animate(2200, setT, () => setPhase('wet'));
    if (phase === 'grow') return animate(1600, setT, () => {});
  }, [phase]);
  useEffect(() => {
    if (phase === 'wet') {
      setTool('seed');
      const dug = pits.filter(p => p.dug).length;
      setSay({ text: `The first rain! ${dug} pit${dug === 1 ? '' : 's'} filled with water; the rest ran off the crust. Now sow in the pits.`, tone: dug === pits.length ? 'good' : 'bad' });
    }
  }, [phase]);

  const tap = (i: number) => {
    const p = pits[i];
    const set = (patch: Partial<Pit>, line: string, tone?: 'good' | 'bad') => {
      setPits(pits.map((x, j) => (j === i ? { ...x, ...patch } : x)));
      setSay({ text: line, tone });
    };
    if (phase === 'raining' || phase === 'grow') return;
    if (tool === 'hoe') {
      if (phase !== 'dry') return setSay({ text: 'The ground is wet and the rain has run off already: zaï are dug in the dry season.', tone: 'bad' });
      if (p.dug) return setSay({ text: 'Already dug.' });
      return set({ dug: true }, 'Dug: about 25 cm wide and 15 cm deep, the earth heaped on the downhill side.');
    }
    if (tool === 'manure') {
      if (!p.dug) return setSay({ text: 'Dig the pit first: manure on the crust just washes away.', tone: 'bad' });
      if (p.manure) return setSay({ text: 'It has its handful of manure.' });
      return set({ manure: true }, 'A handful of manure: termites come, and open the soil for the water.');
    }
    if (!p.dug) return setSay({ text: 'Seed on the hard crust will not grow: sow in a pit.', tone: 'bad' });
    if (p.seed !== 'none') return setSay({ text: 'Already sown.' });
    if (phase === 'dry') return set({ seed: 'early' }, 'Seed in a dry pit: birds and ants take it before the rain comes. Wait for the rain.', 'bad');
    set({ seed: 'good' }, p.manure ? 'Sown in the damp, on the manure.' : 'Sown, but this pit has no manure: it will grow weak.', p.manure ? 'good' : 'bad');
  };

  const r = scoreZai(pits);
  const wet = phase !== 'dry';
  const water = phase === 'raining' ? t : wet ? 1 : 0;

  const stage = (
    <svg viewBox={`0 0 ${W} ${H}`} className="csa-svg" aria-label="A crusted field, with marks for the pits">
      <rect width={W} height={H} fill={wet ? '#b08f6b' : '#cdb085'} />
      {/* the crust's cracks */}
      {Array.from({ length: 24 }, (_, i) => (
        <path key={i} d={`M${(i * 97) % W} ${(i * 61) % H} l ${12 + (i % 3) * 6} ${8 - (i % 4) * 5} l ${10} ${-6}`} stroke="#ab895e" strokeWidth={1.2} fill="none" />
      ))}
      {/* rain, and the water running off the crust */}
      {phase === 'raining' &&
        Array.from({ length: 46 }, (_, i) => <line key={i} x1={(i * 59) % W} y1={((i * 41 + t * 1000) % H) - 10} x2={((i * 59) % W) - 3} y2={((i * 41 + t * 1000) % H) + 3} stroke="#6cc1b8" strokeWidth={1.4} opacity={0.7} />)}
      {wet &&
        [30, 130, 230, 330, 430, 530].map(x => <path key={x} d={`M${x + 20} 0 q 10 ${H / 2} -6 ${H}`} stroke="#a5bea6" strokeWidth={2} fill="none" opacity={0.35 * water} strokeDasharray="6 6" />)}
      {pits.map((p, i) => {
        const { x, y } = at(i);
        const grown = phase === 'grow' ? t : 0;
        return (
          <g
            key={i}
            role="button"
            tabIndex={0}
            className="csa-pit"
            aria-label={`Pit ${i + 1}: ${p.dug ? 'dug' : 'not dug'}${p.manure ? ', manure in' : ''}${p.seed === 'good' ? ', sown' : p.seed === 'early' ? ', sown too early' : ''}`}
            onClick={() => tap(i)}
            onKeyDown={e => e.key === 'Enter' && tap(i)}
          >
            <rect x={x - 40} y={y - 32} width={80} height={64} fill="transparent" />
            {!p.dug ? (
              <g>
                <line x1={x - 6} y1={y - 6} x2={x + 6} y2={y + 6} stroke="#815b3c" strokeWidth={2} />
                <line x1={x + 6} y1={y - 6} x2={x - 6} y2={y + 6} stroke="#815b3c" strokeWidth={2} />
              </g>
            ) : (
              <g>
                <path d={`M${x - 24} ${y + 12} q 24 14 48 0`} stroke="#936b46" strokeWidth={7} fill="none" strokeLinecap="round" />
                <ellipse cx={x} cy={y} rx={20} ry={12} fill="#67462b" />
                {wet && <ellipse cx={x} cy={y + 1} rx={17 * water} ry={9 * water} fill="#5bbfb2" opacity={0.75} />}
                {p.manure && <circle cx={x + (wet ? 6 : 0)} cy={y} r={6} fill="#4e3d2f" />}
                {p.seed === 'early' && !wet && [-5, 0, 5].map(d => <circle key={d} cx={x + d} cy={y - 2} r={1.8} fill="#e4cc78" />)}
                {p.seed === 'good' && <Sprout x={x} y={y + 2} g={phase === 'grow' ? grown * (p.manure ? 1 : 0.45) : 0.15} />}
              </g>
            )}
          </g>
        );
      })}
      <text x={10} y={18} className="csa-svg-note">
        {phase === 'dry' ? 'Dry season · marks about 80 cm apart' : phase === 'raining' ? 'The first rain' : phase === 'wet' ? 'After the first rain: the pits hold water' : 'The season: tall where the pits were fed'}
      </text>
    </svg>
  );

  const side = (
    <>
      <p className="csa-step">{phase === 'dry' ? '1 · Dig and feed, in the dry' : phase === 'grow' ? '3 · The season' : '2 · Sow after the rain'}</p>
      <div className="csa-tools">
        <Tool on={tool === 'hoe'} onClick={() => setTool('hoe')}>⛏️ Hoe</Tool>
        <Tool on={tool === 'manure'} onClick={() => setTool('manure')}>💩 Manure</Tool>
        <Tool on={tool === 'seed'} onClick={() => setTool('seed')}>🌱 Seed</Tool>
      </div>
      <Say tone={say.tone}>{say.text}</Say>
      <p className="csa-count">
        Dug {pits.filter(p => p.dug).length}/{pits.length} · manure {pits.filter(p => p.manure).length} · sown {pits.filter(p => p.seed === 'good').length}
        {r.early ? ` · ${r.early} sown too early` : ''}
      </p>
      {phase === 'dry' && (
        <Go onClick={() => setPhase('raining')} disabled={!pits.some(p => p.dug)}>
          🌧 Bring the first rain
        </Go>
      )}
      {phase === 'wet' && <Go onClick={() => setPhase('grow')}>🌾 Grow the season</Go>}
      {phase === 'grow' && <Go onClick={() => onDone(r.score, `${r.ready} of ${pits.length} pits dug, fed and sown in time${r.early ? ` · ${r.early} sown before the rain` : ''}`)}>Finish</Go>}
    </>
  );
  return <GameFrame label="Zaï pits" stage={stage} side={side} />;
}
