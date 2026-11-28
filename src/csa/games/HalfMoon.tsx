import { useEffect, useState } from 'react';
import { HM, canDig, moonX, moonY, rainRun, scoreHalfMoon, type Moon, type Opening } from '../rules';
import { GameFrame, Go, Say, Sprout, Tool, animate, type GameProps } from './common';

/* Half-moons, played: the slope from above (uphill at the top). Pick which way the half-moon opens, tap the slope to
   dig (nine a day), let it rain and watch where the water goes, then put manure and seed in the ones holding water,
   and grow the season. A half-moon only holds water with its open side uphill; rows staggered under the gaps of the
   row above catch what slips past. */

type Phase = 'dig' | 'rain' | 'feed' | 'grow';
type ToolId = Opening | 'manure' | 'seed';
const W = 600;
const H = 260;

/** A half-moon's bank: a curve whose open side faces up (◡) or down (◠) the slope. */
function bank(m: Moon) {
  const x = moonX(m.col);
  const y = moonY(m.row);
  return m.open === 'up' ? `M${x - 40} ${y - 10} Q${x} ${y + 34} ${x + 40} ${y - 10}` : `M${x - 40} ${y + 10} Q${x} ${y - 34} ${x + 40} ${y + 10}`;
}
function pool(m: Moon) {
  const x = moonX(m.col);
  const y = moonY(m.row);
  return `M${x - 33} ${y - 8} Q${x} ${y + 24} ${x + 33} ${y - 8} Z`;
}

export function HalfMoonGame({ onDone }: GameProps) {
  const [moons, setMoons] = useState<Moon[]>([]);
  const [tool, setTool] = useState<ToolId>('up');
  const [phase, setPhase] = useState<Phase>('dig');
  const [t, setT] = useState(0);
  const [say, setSay] = useState<{ text: string; tone?: 'good' | 'bad' }>({ text: `Choose which way the half-moon opens, then tap the slope to dig. You have the labour for ${HM.budget}.` });
  const run = rainRun(moons);
  const held = new Set(run.ends.filter(e => e.moon !== null).map(e => e.moon!));

  useEffect(() => {
    if (phase === 'rain') return animate(2600, setT, () => setPhase('feed'));
    if (phase === 'grow') return animate(1600, setT, () => {});
  }, [phase]);
  useEffect(() => {
    if (phase !== 'feed') return;
    const wrong = moons.filter(m => m.open === 'down').length;
    setTool('manure');
    setSay({
      text: `The rain held: ${run.caught} of ${HM.streams} streams soaked in, ${HM.streams - run.caught} ran off${wrong ? `. ${wrong} half-moon${wrong > 1 ? 's' : ''} faced the wrong way: the water ran round the back` : ''}. Now put manure, then seed, in the half-moons holding water.`,
      tone: run.share >= 0.85 ? 'good' : 'bad',
    });
  }, [phase]);

  const tapSpot = (row: number, col: number) => {
    if (phase !== 'dig') return;
    const at = moons.findIndex(m => m.row === row && m.col === col);
    if (at >= 0) {
      setMoons(moons.filter((_, i) => i !== at));
      return setSay({ text: 'Filled back in.' });
    }
    const ok = canDig(moons, row, col);
    if (ok === 'close') return setSay({ text: 'Too close: two half-moons side by side would run into each other. Leave a space.', tone: 'bad' });
    if (ok === 'budget') return setSay({ text: `That is the day's ${HM.budget}. Tap one to fill it back in and dig it somewhere else.`, tone: 'bad' });
    if (tool !== 'up' && tool !== 'down') return;
    setMoons([...moons, { row, col, open: tool }]);
    setSay({ text: `${moons.length + 1} of ${HM.budget} dug.` });
  };
  const tapMoon = (i: number) => {
    if (phase === 'dig') return tapSpot(moons[i].row, moons[i].col);
    if (phase !== 'feed') return;
    const m = moons[i];
    if (!held.has(i)) return setSay({ text: m.open === 'down' ? 'This one faces downhill: no water in it, so manure and seed would be wasted.' : 'No water reached this one.', tone: 'bad' });
    if (tool === 'manure') {
      setMoons(moons.map((x, j) => (j === i ? { ...x, manure: true } : x)));
      setSay({ text: 'Manure in: it feeds the soil and holds the water.' });
    } else if (tool === 'seed') {
      if (!m.manure) return setSay({ text: 'Manure first, then the seed.', tone: 'bad' });
      setMoons(moons.map((x, j) => (j === i ? { ...x, seed: true } : x)));
      setSay({ text: 'Sorghum sown in the damp.', tone: 'good' });
    }
  };
  const finish = () => {
    const r = scoreHalfMoon(moons);
    onDone(r.score, `Held ${r.run.caught} of ${HM.streams} streams of rain · ${r.right} of ${moons.length} half-moons open uphill · ${r.fed} fed and sown`);
  };
  const restart = () => {
    setMoons([]);
    setPhase('dig');
    setTool('up');
    setT(0);
    setSay({ text: 'Start again: choose which way it opens, then dig.' });
  };

  const showWater = phase !== 'dig';
  const flow = phase === 'rain' ? t : 1;

  const stage = (
    <svg viewBox={`0 0 ${W} ${H}`} className="csa-svg" aria-label="The slope from above, uphill at the top">
      <defs>
        <linearGradient id="hm-slope" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcc296" />
          <stop offset="1" stopColor="#be996a" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#hm-slope)" />
      {/* the contour lines: the slope's same-height lines, across it */}
      {[40, 100, 160, 222].map(y => (
        <path key={y} d={`M0 ${y} Q150 ${y - 6} 300 ${y} T600 ${y}`} stroke="#ae895c" strokeWidth={1} strokeDasharray="3 5" fill="none" />
      ))}
      <g className="csa-slope-tag" aria-hidden="true">
        <text x={W - 8} y={16} textAnchor="end">▲ UPHILL</text>
        <text x={W - 8} y={H - 6} textAnchor="end">▼ downhill</text>
      </g>
      {/* rain */}
      {phase === 'rain' &&
        Array.from({ length: 40 }, (_, i) => <line key={i} x1={(i * 53) % W} y1={((i * 37 + t * 900) % H) - 10} x2={((i * 53) % W) - 3} y2={((i * 37 + t * 900) % H) + 2} stroke="#6cc1b8" strokeWidth={1.4} opacity={0.7} />)}
      {/* the streams of runoff, down the slope */}
      {showWater &&
        run.ends.map(e => {
          const endY = e.moon === null ? H : moonY(moons[e.moon].row) + 4;
          const y = Math.min(endY, flow * (H + 40));
          return (
            <g key={e.k}>
              <line x1={e.x} y1={0} x2={e.x} y2={y} stroke={e.moon === null ? '#866a4c' : '#5bbfb2'} strokeWidth={e.moon === null ? 2.5 : 2} strokeLinecap="round" opacity={0.85} />
              {e.moon === null && y >= H && <circle cx={e.x} cy={H - 3} r={4} fill="#866a4c" />}
            </g>
          );
        })}
      {/* the spots that can be dug */}
      {phase === 'dig' &&
        Array.from({ length: HM.rows * HM.cols }, (_, i) => {
          const row = Math.floor(i / HM.cols);
          const col = i % HM.cols;
          if (moons.some(m => m.row === row && m.col === col)) return null;
          const ok = canDig(moons, row, col) === 'ok';
          return (
            <g key={i} role="button" tabIndex={0} aria-label={`Contour row ${row + 1}, spot ${col + 1}: dig`} className={`csa-spot${ok ? '' : ' is-off'}`} onClick={() => tapSpot(row, col)} onKeyDown={e => e.key === 'Enter' && tapSpot(row, col)}>
              <rect x={moonX(col) - 28} y={moonY(row) - 24} width={56} height={44} fill="transparent" />
              <circle cx={moonX(col)} cy={moonY(row)} r={6} />
            </g>
          );
        })}
      {/* the half-moons */}
      {moons.map((m, i) => (
        <g
          key={`${m.row}-${m.col}`}
          role="button"
          tabIndex={0}
          aria-label={`Half-moon, row ${m.row + 1}, spot ${m.col + 1}, open side ${m.open === 'up' ? 'uphill' : 'downhill'}${held.has(i) && showWater ? ', holding water' : ''}${m.manure ? ', manure in' : ''}${m.seed ? ', sown' : ''}`}
          className="csa-moon"
          onClick={() => tapMoon(i)}
          onKeyDown={e => e.key === 'Enter' && tapMoon(i)}
        >
          <rect x={moonX(m.col) - 44} y={moonY(m.row) - 26} width={88} height={52} fill="transparent" />
          {phase === 'grow' && held.has(i) && <ellipse cx={moonX(m.col)} cy={moonY(m.row) - 4} rx={(m.seed ? 46 : 26) * t} ry={(m.seed ? 26 : 14) * t} fill="#79aa59" opacity={0.55} />}
          {showWater && held.has(i) && <path d={pool(m)} fill="#5bbfb2" opacity={(0.25 + 0.6 * flow) * (phase === 'grow' ? 1 - 0.6 * t : 1)} />}
          {m.manure && <circle cx={moonX(m.col)} cy={moonY(m.row) + 2} r={7} fill="#543a25" />}
          <path d={bank(m)} stroke="#724c2f" strokeWidth={9} fill="none" strokeLinecap="round" />
          <path d={bank(m)} stroke="#9e724a" strokeWidth={4} fill="none" strokeLinecap="round" />
          {m.seed && <Sprout x={moonX(m.col)} y={moonY(m.row) + 4} g={phase === 'grow' ? t : 0.15} />}
        </g>
      ))}
      {phase === 'grow' && t > 0.95 && (
        <text x={W / 2} y={18} textAnchor="middle" className="csa-svg-note">
          Season grown: green where the water stayed
        </text>
      )}
    </svg>
  );

  const side = (
    <>
      <p className="csa-step">{phase === 'dig' ? '1 · Dig the half-moons' : phase === 'rain' ? '2 · The rain' : phase === 'feed' ? '3 · Manure and seed' : '4 · The season'}</p>
      {phase === 'dig' && (
        <div className="csa-tools">
          <Tool on={tool === 'up'} onClick={() => setTool('up')} label="Dig with the open side uphill">
            <b className="csa-shape">◡</b> Open side uphill
          </Tool>
          <Tool on={tool === 'down'} onClick={() => setTool('down')} label="Dig with the open side downhill">
            <b className="csa-shape">◠</b> Open side downhill
          </Tool>
        </div>
      )}
      {phase === 'feed' && (
        <div className="csa-tools">
          <Tool on={tool === 'manure'} onClick={() => setTool('manure')}>
            💩 Manure
          </Tool>
          <Tool on={tool === 'seed'} onClick={() => setTool('seed')}>
            🌱 Seed
          </Tool>
        </div>
      )}
      <Say tone={say.tone}>{say.text}</Say>
      <p className="csa-count">
        Dug {moons.length}/{HM.budget}
        {showWater && ` · held ${run.caught}/${HM.streams}`}
      </p>
      {phase === 'dig' && (
        <Go onClick={() => setPhase('rain')} disabled={!moons.length}>
          🌧 Let it rain
        </Go>
      )}
      {phase === 'feed' && <Go onClick={() => setPhase('grow')}>🌾 Grow the season</Go>}
      {phase === 'grow' && <Go onClick={finish}>Finish</Go>}
      {phase !== 'dig' && phase !== 'rain' && (
        <button type="button" className="set-link csa-again" onClick={restart}>
          Dig again
        </button>
      )}
    </>
  );
  return <GameFrame label="Half-moons on a slope" stage={stage} side={side} />;
}
