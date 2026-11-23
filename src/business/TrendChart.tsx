import type { DayResult } from './model';
import { effScore } from './model';

/* The trainee's own trend, day by day: the route's efficiency score and the day's value (route, money collected,
   urgent work), out of 100, so the player (and a trainer) can see whether their booking and routing improve. */

const W = 520;
const H = 180;
const PAD = { l: 32, r: 12, t: 14, b: 26 };

export function TrendChart({ history }: { history: DayResult[] }) {
  const days = history.filter(r => r.kind === 'farms' && r.km > 0).slice(-20);
  if (days.length < 2)
    return (
      <div className="biz-trend-empty">
        <span aria-hidden="true">📈</span>
        <b>Your trend shows here</b>
        <small>Play two days with the tractor to see your route score and day value over time.</small>
      </div>
    );
  const x = (i: number) => PAD.l + (i * (W - PAD.l - PAD.r)) / Math.max(1, days.length - 1);
  const y = (v: number) => PAD.t + (1 - v / 100) * (H - PAD.t - PAD.b);
  const eff = days.map(r => effScore(r.efficiency ?? (r.km > 0 ? r.bestKm / r.km : 1)));
  const val = days.map(r => r.value ?? null);
  const line = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`))
      .filter(Boolean)
      .join(' ');
  const avg = (vals: number[]) => Math.round(vals.reduce((n, v) => n + v, 0) / vals.length);
  const half = Math.floor(days.length / 2);
  const early = avg(eff.slice(0, half));
  const late = avg(eff.slice(half));
  return (
    <figure className="biz-trend">
      <figcaption>
        <b>Your trend</b> Last {days.length} days
        <span className={late >= early ? 'is-up' : 'is-down'}>
          Route score {early} → {late}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label={`Route score from ${eff[0]} to ${eff[eff.length - 1]} over ${days.length} days`}>
        {[0, 50, 100].map(v => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="#e7d6bd" strokeWidth={1} />
            <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" fontSize={8.5} fill="#86604c">
              {v}
            </text>
          </g>
        ))}
        {days.map((r, i) => (
          <text key={r.day} x={x(i)} y={H - 8} textAnchor="middle" fontSize={8.5} fill="#86604c">
            {i === 0 || i === days.length - 1 || i % 4 === 0 ? `D${r.day}` : ''}
          </text>
        ))}
        <polyline points={line(eff)} fill="none" stroke="#e08e0b" strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round" />
        {val.some(v => v !== null) && <polyline points={line(val)} fill="none" stroke="#2e6b35" strokeWidth={2.4} strokeDasharray="5 4" strokeLinejoin="round" strokeLinecap="round" />}
        {eff.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill="#e08e0b" />
        ))}
      </svg>
      <p className="biz-trend-key">
        <span>
          <i className="is-eff" /> Route score
        </span>
        <span>
          <i className="is-val" /> Day value
        </span>
      </p>
    </figure>
  );
}
