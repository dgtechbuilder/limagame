import { useEffect, useMemo, useState } from 'react';
import { ROT, rotBags, rotSeason, rotStart, scoreRot, type RotFarm, type RotPick } from '../rules';
import { REST, SOIL, soilTone } from '../../soil/model';
import { GameFrame, Go, Say, Sprout, animate, type GameProps } from './common';

/* Resting the land, played: six farms, each with its soil and the seasons it has been cropped in a row. Each season,
   tap a farm to choose: crop it, rest it under a green-manure cover crop, or leave it to natural fallow. At least
   three must be planted, and the family needs ROT.need bags a season. Grow the season and watch the harvest and the
   soil move; after the last season, the food grown and the soil left are counted against simple rotations. Four
   seasons (two on the daily drill). */

const W = 600;
const H = 260;
const CELL = { w: 170, h: 96, x0: 28, y0: 34, dx: 192, dy: 112 };
const at = (i: number) => ({ x: CELL.x0 + (i % 3) * CELL.dx, y: CELL.y0 + Math.floor(i / 3) * CELL.dy });
const NEXT: Record<'crop' | 'cover' | 'fallow', RotPick> = { crop: 'cover', cover: 'fallow', fallow: null };
const soilFill = (soil: number) => (soilTone(soil) === 'good' ? '#553a24' : soilTone(soil) === 'ok' ? '#826040' : '#bd996c');

export function RestGame({ seed, drill, onDone }: GameProps) {
  const start = useMemo(() => rotStart(seed), [seed]);
  const seasons = drill ? ROT.drillSeasons : ROT.seasons;
  const [farms, setFarms] = useState<RotFarm[]>(start);
  const [picks, setPicks] = useState<RotPick[]>(() => start.map(() => null));
  const [plan, setPlan] = useState<RotPick[][]>([]);
  const [shown, setShown] = useState<{ before: RotFarm[]; per: number[]; bags: number; short: number; cover: number } | null>(null);
  const [t, setT] = useState(1);
  const [running, setRunning] = useState(false);
  const [say, setSay] = useState<{ text: string; tone?: 'good' | 'bad' }>({
    text: `Season 1 of ${seasons}. Tap a farm to rest it: once for a cover crop, twice for natural fallow, again to crop it. Worn-out soil grows less.`,
  });
  const round = plan.length;
  const over = round >= seasons && !running;
  const planted = picks.filter(p => !p).length;
  const expected = Math.round(farms.reduce((n, f, i) => n + (picks[i] ? 0 : rotBags(f.soil)), 0) * 10) / 10;

  useEffect(() => {
    if (!running) return;
    return animate(1600, setT, () => setRunning(false));
  }, [running]);

  const tap = (i: number) => {
    if (running || round >= seasons) return;
    const now = picks[i] ?? 'crop';
    const next = NEXT[now];
    const after = picks.map((p, j) => (j === i ? next : p));
    if (after.filter(p => !p).length < ROT.minPlanted) return setSay({ text: `Keep at least ${ROT.minPlanted} farms planted: the family must eat.`, tone: 'bad' });
    setPicks(after);
    setShown(null);
    const f = farms[i];
    if (!next) setSay({ text: `Farm ${i + 1} will be cropped: about ${rotBags(f.soil)} bags on soil ${f.soil}${f.streak + 1 >= SOIL.streakFrom ? `, and it will be its ${f.streak + 1}th season in a row` : ''}.` });
    else setSay({ text: `Farm ${i + 1} rests: ${REST[next].short.toLowerCase()}, soil +${REST[next].soil}${next === 'cover' ? ` (seed costs ${ROT.coverBags} bag)` : ' (free)'}.`, tone: 'good' });
  };

  const grow = () => {
    const r = rotSeason(farms, picks);
    setShown({ before: farms, per: r.per, bags: r.bags, short: r.short, cover: r.cover });
    setFarms(r.farms);
    setPlan([...plan, picks]);
    setT(0);
    setRunning(true);
    const rested = picks.filter(Boolean).length;
    setSay(
      r.short > 0
        ? { text: `${r.bags} bags: ${r.short} short of the ${ROT.need} the family needs. Buying it costs double. ${rested ? `${rested} farm${rested === 1 ? '' : 's'} rested.` : ''}`, tone: 'bad' }
        : { text: `${r.bags} bags: the family is fed${rested ? `, and ${rested} farm${rested === 1 ? '' : 's'} got their soil back` : ', but every farm lost soil'}.`, tone: rested ? 'good' : undefined },
    );
    setPicks(r.farms.map(() => null));
  };

  const result = over ? scoreRot(start, plan) : null;
  const finish = () => {
    if (!result) return;
    const r = result.run;
    const avg0 = Math.round(start.reduce((n, f) => n + f.soil, 0) / start.length);
    const avg1 = Math.round(r.soil / r.farms.length);
    onDone(result.score, `${r.food} bags grown over ${seasons} seasons${r.short ? ` (${r.short} short)` : ''} · soil ${avg0} → ${avg1} on average`);
  };

  const stage = (
    <svg viewBox={`0 0 ${W} ${H}`} className="csa-svg" aria-label="Six farms seen from above, with their soil">
      <rect width={W} height={H} fill="#c2ddab" />
      {farms.map((f, i) => {
        const { x, y } = at(i);
        const pick = picks[i];
        const was = shown?.before[i];
        const soil = was && running ? Math.round(was.soil + (f.soil - was.soil) * t) : f.soil;
        const lastPick = running || shown ? plan[plan.length - 1]?.[i] : undefined;
        const showPick = shown ? lastPick ?? null : pick;
        const grownBags = shown ? shown.per[i] : 0;
        return (
          <g
            key={i}
            role="button"
            tabIndex={0}
            className="csa-pit"
            aria-label={`Farm ${i + 1}: soil ${f.soil}, cropped ${f.streak} seasons in a row; ${pick ? REST[pick].short.toLowerCase() : 'to crop'} this season`}
            onClick={() => tap(i)}
            onKeyDown={e => e.key === 'Enter' && tap(i)}
          >
            <rect x={x} y={y} width={CELL.w} height={CELL.h} rx={8} fill={showPick === 'cover' ? '#4b8433' : showPick === 'fallow' ? '#7bbf48' : soilFill(soil)} stroke={pick && !shown ? '#eeca68' : '#00000033'} strokeWidth={pick && !shown ? 3 : 1} />
            {/* rows of crop, or the rest's plants */}
            {Array.from({ length: 4 }, (_, r) =>
              Array.from({ length: 6 }, (_, c) => {
                const px = x + 18 + c * 27;
                const py = y + 30 + r * 18;
                if (showPick === 'cover') return <circle key={`${r}${c}`} cx={px} cy={py - 4} r={6} fill="#7cc25c" />;
                if (showPick === 'fallow') return <path key={`${r}${c}`} d={`M${px - 5} ${py} l 3 -10 l 2 10 l 3 -8 l 2 8`} stroke="#4f8431" strokeWidth={1.6} fill="none" />;
                return <Sprout key={`${r}${c}`} x={px} y={py} g={shown ? (0.3 + 0.7 * Math.min(1, grownBags / ROT.bags)) * (running ? t : 1) : 0.15} tone={soilTone(soil) === 'poor' ? '#b0b864' : '#54933d'} />;
              }),
            )}
            <rect x={x + 4} y={y + 4} width={CELL.w - 8} height={18} rx={4} fill="#ffffffd9" />
            <text x={x + 10} y={y + 17} className="csa-svg-note">
              Farm {i + 1} · soil {soil}
              {f.streak >= SOIL.streakFrom ? ` · ${f.streak} in a row` : ''}
            </text>
            {shown && (
              <text x={x + CELL.w - 10} y={y + CELL.h - 8} textAnchor="end" className="csa-svg-note" fill="#fbf8ee">
                {lastPick ? `${REST[lastPick].icon} +soil` : `${shown.per[i]} bags`}
              </text>
            )}
            {!shown && pick && (
              <text x={x + CELL.w - 10} y={y + CELL.h - 8} textAnchor="end" className="csa-svg-note">
                {REST[pick].icon} {REST[pick].short}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );

  const side = (
    <>
      <p className="csa-step">{over ? 'The seasons are over' : `Season ${Math.min(round + 1, seasons)} of ${seasons}`}</p>
      <Say tone={say.tone}>{say.text}</Say>
      {!over && !shown && (
        <p className="csa-count">
          Planted {planted} of {ROT.farms} · about {expected} bags (the family needs {ROT.need})
        </p>
      )}
      {result && (
        <p className="csa-count">
          {result.run.food} bags grown · {result.run.cover} paid for cover seed · {result.run.short} short · soil left {Math.round(result.run.soil / ROT.farms)} on average
        </p>
      )}
      {!over && !running && (shown ? <Go onClick={() => setShown(null)}>Plan season {round + 1} ›</Go> : <Go onClick={grow}>🌦 Grow the season</Go>)}
      {over && <Go onClick={finish}>Finish</Go>}
    </>
  );
  return <GameFrame label="Resting the land" stage={stage} side={side} />;
}
