import { useEffect, useState } from 'react';
import { HOW_NAME, WATER_GAME, WHEN_NAME, hourText, scoreWater, waterDay, type WaterChoice, type WaterHow, type WaterWhen } from '../rules';
import { GameFrame, Go, Say, Tool, animate, type GameProps } from './common';

/* Saving water, played: one tomato plant, a hot dry-season day and the night after it. Choose bare soil or mulch, how
   to water and when, and how many litres; then run the day and watch the soil's water hour by hour, with the wilting
   line. The plant must not wilt, on as little water as can be. Try as often as you like: the best try counts. */

const W = 600;
const H = 260;
const CHART = { x: 300, y: 28, w: 285, h: 150 };

export function WaterSaveGame({ onDone }: GameProps) {
  const [c, setC] = useState<WaterChoice>({ mulch: false, how: 'leaves', when: 13, litres: 6 });
  const [shown, setShown] = useState<WaterChoice | null>(null);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState<{ score: number; line: string } | null>(null);
  const [tries, setTries] = useState(0);
  const day = shown ? waterDay(shown) : null;

  useEffect(() => {
    if (!running) return;
    return animate(2400, setT, () => setRunning(false));
  }, [running]);

  const runDay = () => {
    setShown(c);
    setT(0);
    setRunning(true);
    setTries(n => n + 1);
    const r = scoreWater(c);
    const line = `${c.mulch ? 'Mulch' : 'Bare soil'}, ${HOW_NAME[c.how].toLowerCase()} at ${WHEN_NAME[c.when]}, ${c.litres} L: ${r.day.alive ? 'the plant made it' : 'the plant wilted'}`;
    if (!best || r.score > best.score) setBest({ score: r.score, line });
  };
  const pick = (patch: Partial<WaterChoice>) => !running && setC({ ...c, ...patch });

  // the chart: soil water, 6 am to 6 am
  const xOf = (i: number) => CHART.x + (i / 24) * CHART.w;
  const yOf = (m: number) => CHART.y + CHART.h - (Math.max(0, Math.min(WATER_GAME.cap, m)) / WATER_GAME.cap) * CHART.h;
  const upTo = Math.round((running ? t : 1) * 24);
  const pts = day ? day.curve.slice(0, upTo + 1).map((m, i) => `${xOf(i)},${yOf(m)}`).join(' ') : '';
  const now = day ? day.curve[Math.min(upTo, 24)] : WATER_GAME.start;
  const wilting = now < WATER_GAME.wilt;
  const hourNow = 6 + upTo;
  const sunUp = !day || hourNow < 18;
  const sunX = 40 + Math.min(1, (day ? upTo : 7) / 12) * 200;

  const stage = (
    <svg viewBox={`0 0 ${W} ${H}`} className="csa-svg" aria-label="A tomato plant through a hot day, and its soil's water">
      <rect width={W} height={H} fill={sunUp ? '#dceadc' : '#344f51'} />
      {/* the sun (or the moon) */}
      {sunUp ? <circle cx={sunX} cy={30 + Math.abs(sunX - 140) * 0.15} r={14} fill="#ecc050" /> : <circle cx={220} cy={34} r={10} fill="#efedd4" />}
      {/* the soil in section */}
      <rect x={0} y={150} width={290} height={H - 150} fill="#835f44" />
      <rect x={0} y={150} width={290} height={H - 150} fill="#5bbfb2" opacity={Math.max(0, Math.min(0.55, (now / WATER_GAME.cap) * 0.6))} />
      {(shown ?? c).mulch && <rect x={0} y={142} width={290} height={10} rx={3} fill="#cbaf67" stroke="#a58742" />}
      {/* roots */}
      <path d="M145 152 q -6 30 -24 54 M145 152 q 4 34 22 58 M145 152 l 0 70" stroke="#e2d1b5" strokeWidth={2} fill="none" />
      {/* the plant: droops when the soil is below the wilting line */}
      <g transform={`translate(145 150) rotate(${wilting ? 18 : 0})`}>
        <path d="M0 0 L0 -70" stroke="#4c7635" strokeWidth={4} />
        {[-60, -44, -28].map((y, i) => (
          <g key={y}>
            <path d={`M0 ${y} q ${-22 - i * 2} ${wilting ? 14 : -6} ${-34} ${wilting ? 22 : 2}`} stroke="#54933d" strokeWidth={6} fill="none" strokeLinecap="round" />
            <path d={`M0 ${y + 6} q ${22 + i * 2} ${wilting ? 14 : -6} ${34} ${wilting ? 22 : 2}`} stroke="#54933d" strokeWidth={6} fill="none" strokeLinecap="round" />
          </g>
        ))}
        {!wilting && <circle cx={10} cy={-34} r={6} fill="#c75d48" />}
      </g>
      {/* water lost to the air: steam off bare soil in the heat */}
      {day && running && sunUp &&
        Array.from({ length: (shown?.mulch ? 3 : 7) }, (_, i) => (
          <path key={i} d={`M${20 + i * 38} ${146 - ((t * 400 + i * 23) % 40)} q 5 -6 0 -12 q -5 -6 0 -12`} stroke="#fbf8ee" strokeWidth={2} fill="none" opacity={0.7} />
        ))}
      <text x={10} y={H - 8} className="csa-svg-note is-light">
        {shown ? `${shown.mulch ? 'Mulched' : 'Bare'} · ${HOW_NAME[shown.how].toLowerCase()} · ${WHEN_NAME[shown.when]} · ${shown.litres} L` : 'Choose, then run the day'}
      </text>
      {/* the chart */}
      <rect x={CHART.x - 8} y={CHART.y - 18} width={CHART.w + 18} height={CHART.h + 68} rx={8} fill="#fdfaf2" opacity={0.95} />
      <text x={CHART.x} y={CHART.y - 6} className="csa-svg-note">
        Water in the soil
      </text>
      <line x1={CHART.x} x2={CHART.x + CHART.w} y1={yOf(WATER_GAME.wilt)} y2={yOf(WATER_GAME.wilt)} stroke="#ac5543" strokeDasharray="4 3" />
      <text x={CHART.x + CHART.w} y={yOf(WATER_GAME.wilt) - 3} textAnchor="end" className="csa-svg-note is-bad">
        wilting line
      </text>
      <rect x={xOf(12)} y={CHART.y} width={xOf(24) - xOf(12)} height={CHART.h} fill="#344f51" opacity={0.08} />
      {['6am', 'noon', '6pm', 'midnight', '6am'].map((l, i) => (
        <text key={i} x={xOf(i * 6)} y={CHART.y + CHART.h + 14} textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'} className="csa-svg-tick">
          {l}
        </text>
      ))}
      {day && <polyline points={pts} fill="none" stroke={day.alive ? '#4cafa5' : '#ac5543'} strokeWidth={3} strokeLinejoin="round" />}
      {day && !running && (
        <g>
          <text x={CHART.x} y={CHART.y + CHART.h + 29} className={`csa-svg-note${day.alive ? '' : ' is-bad'}`}>
            {day.alive ? 'Made it through the day and the night' : `Wilted at ${hourText(day.wiltAt! % 24)}`}
            {day.fungus ? ' · fungus on wet leaves' : ''}
          </text>
          <text x={CHART.x} y={CHART.y + CHART.h + 43} className="csa-svg-tick">
            {`Lost to the air ${day.toAir} L${day.drained ? ` · drained past the roots ${day.drained} L` : ''}`}
          </text>
        </g>
      )}
    </svg>
  );

  const r = shown && !running ? scoreWater(shown) : null;
  const side = (
    <>
      <p className="csa-step">Keep it alive on the least water</p>
      <div className="csa-pick" role="group" aria-label="The soil">
        <small>Soil</small>
        <Tool on={!c.mulch} onClick={() => pick({ mulch: false })}>Bare</Tool>
        <Tool on={c.mulch} onClick={() => pick({ mulch: true })}>🌾 Mulch</Tool>
      </div>
      <div className="csa-pick" role="group" aria-label="How to water">
        <small>How</small>
        {(['leaves', 'roots', 'drip'] as WaterHow[]).map(h => (
          <Tool key={h} on={c.how === h} onClick={() => pick({ how: h })}>
            {h === 'leaves' ? 'Leaves' : h === 'roots' ? 'Roots' : 'Drip'}
          </Tool>
        ))}
      </div>
      <div className="csa-pick" role="group" aria-label="When to water">
        <small>When</small>
        {([6, 13, 17] as WaterWhen[]).map(w => (
          <Tool key={w} on={c.when === w} onClick={() => pick({ when: w })}>
            {WHEN_NAME[w]}
          </Tool>
        ))}
      </div>
      <div className="csa-pick" role="group" aria-label="Litres">
        <small>Litres</small>
        {WATER_GAME.litres.map(l => (
          <Tool key={l} on={c.litres === l} onClick={() => pick({ litres: l })}>
            {l}
          </Tool>
        ))}
      </div>
      <Say tone={r ? (r.day.alive ? 'good' : 'bad') : undefined}>
        {r
          ? r.day.alive
            ? r.score >= 0.95
              ? 'Perfect: mulch, drip, early morning, and the least water.'
              : 'It made it. Can you do it on less water, or a better way?'
            : c.mulch
              ? 'It wilted. Water earlier, at the roots, or a little more.'
              : 'It wilted: bare soil lets the sun take the water. Try mulch.'
          : 'Choose, then run the day. Try as often as you like: the best try counts.'}
      </Say>
      <Go onClick={runDay} disabled={running}>
        ☀ Run the day
      </Go>
      <button type="button" className="set-link csa-again" disabled={!best || running} onClick={() => best && onDone(best.score, `Best of ${tries} tr${tries === 1 ? 'y' : 'ies'}: ${best.line}`)}>
        Finish{best ? ` (best ${Math.round(best.score * 100)}%)` : ''}
      </button>
    </>
  );
  return <GameFrame label="Saving water" stage={stage} side={side} />;
}
