import { useMemo, useState } from 'react';
import { CLOCK_JOBS, hourText, rng, scoreClock, skyAt, type ClockJob } from '../rules';
import { GameFrame, Go, Say, type GameProps } from './common';

/* The right time of day, played: a farm under a moving sky. For each job, drag the hour: the sun moves, the heat,
   the wind, the bees and the dew change, and the water the sun would take shows. Then do the job at that hour and
   see how it went. Six jobs (three on the daily drill). */

const W = 600;
const H = 260;
const MIN_H = 4;
const MAX_H = 21;

/** The sky's colour at an hour. */
function skyColour(h: number) {
  if (h < 5 || h > 19.5) return ['#1d2547', '#33406b'];
  if (h < 6.5) return ['#f5a35c', '#f7d6a0'];
  if (h > 18) return ['#e07a4f', '#f5c48a'];
  if (h >= 11 && h <= 15) return ['#6cc3f0', '#fff3c4'];
  return ['#8fd0f5', '#e6f6ff'];
}

export function DayClockGame({ seed, drill, onDone }: GameProps) {
  const jobs = useMemo<ClockJob[]>(() => {
    const r = rng(seed);
    const list = [...CLOCK_JOBS];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return drill ? list.slice(0, 3) : list;
  }, [seed, drill]);
  const [at, setAt] = useState(0);
  const [hour, setHour] = useState(12);
  const [picks, setPicks] = useState<{ job: string; hour: number }[]>([]);
  const [said, setSaid] = useState<{ text: string; tone: 'good' | 'bad' } | null>(null);
  const job = jobs[at];
  const done = picks.length === jobs.length;
  const sky = skyAt(hour);
  const [top, bottom] = skyColour(hour);
  // the sun's arc from 6 am to 6:45 pm; the moon at night
  const sunT = (hour - 6.5) / 12.25;
  const sunX = 40 + sunT * 340;
  const sunY = 150 - Math.sin(Math.PI * Math.max(0, Math.min(1, sunT))) * 120;

  const doIt = () => {
    if (done) return;
    const s = job.at(hour);
    setPicks([...picks, { job: job.id, hour }]);
    const what = `${job.icon} ${job.name} at ${hourText(hour)}`;
    setSaid(s >= 0.8 ? { text: `${what}: ${s >= 1 ? 'the best time.' : 'a good time.'} ${job.good}`, tone: 'good' } : { text: `${what}: ${s >= 0.4 ? 'not the best.' : 'the wrong time.'} ${job.bad(hour)}`, tone: 'bad' });
    if (at < jobs.length - 1) setAt(at + 1);
  };

  const stage = (
    <svg viewBox={`0 0 ${W} ${H}`} className="csa-svg" aria-label={`The farm at ${hourText(hour)}`}>
      <defs>
        <linearGradient id="clock-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#clock-sky)" />
      {sky.day || (hour >= 6 && hour < 19) ? (
        <circle cx={sunX} cy={sunY} r={hour >= 11 && hour <= 15 ? 20 : 16} fill={hour >= 11 && hour <= 15 ? '#ffd23f' : '#ffb347'} />
      ) : (
        <circle cx={hour < 6 ? 360 : 60} cy={46} r={12} fill="#f3f0d0" />
      )}
      {/* heat shimmer at midday */}
      {sky.temp >= 28 &&
        [0, 1, 2].map(i => <path key={i} d={`M${80 + i * 90} 196 q 6 -8 0 -16 q -6 -8 0 -16`} stroke="#fff" strokeWidth={2} fill="none" opacity={0.6} />)}
      {/* the field */}
      <rect x={0} y={198} width={420} height={62} fill="#7aa548" />
      {Array.from({ length: 9 }, (_, i) => (
        <g key={i} transform={`translate(${24 + i * 44} 206)`}>
          <path d="M0 18 L0 0" stroke="#3e7d24" strokeWidth={3} />
          <path d="M0 8 q -9 -3 -12 -10 M0 4 q 9 -3 12 -10" stroke="#4e9a2f" strokeWidth={3} fill="none" />
          {sky.dew && <circle cx={6} cy={-6} r={1.8} fill="#e9f8ff" />}
        </g>
      ))}
      {/* the wind sock */}
      <g transform="translate(395 150)">
        <line x1={0} y1={0} x2={0} y2={48} stroke="#6b402b" strokeWidth={3} />
        <path d={sky.wind === 'Calm' ? 'M0 2 L6 2 L4 22 L0 22 Z' : sky.wind === 'Breezy' ? 'M0 2 L22 6 L22 14 L0 18 Z' : 'M0 2 L34 4 L34 10 L0 14 Z'} fill="#e05a3a" />
      </g>
      {/* bees */}
      {sky.bees && [0, 1, 2].map(i => <text key={i} x={140 + i * 70} y={186 - i * 6} className="csa-bee">🐝</text>)}
      {/* the job */}
      {!done && (
        <text x={210} y={190} textAnchor="middle" className="csa-job-icon">
          {job.icon}
        </text>
      )}
      {/* the readouts */}
      <g transform="translate(430 18)">
        <rect width={156} height={150} rx={10} fill="#fffaf0" opacity={0.94} />
        <text x={12} y={26} className="csa-clock-time">
          {hourText(hour)}
        </text>
        {[
          ['🌡', `${sky.temp} °C`],
          ['💨', sky.wind],
          ['💧', sky.evap ? `Sun takes ${sky.evap}% of water` : 'No sun on the water'],
          ['🐝', sky.bees ? 'Bees flying' : 'Bees at home'],
          ['🌫', sky.dew ? 'Dew on the leaves' : 'Leaves dry'],
        ].map(([i, t], n) => (
          <text key={n} x={12} y={50 + n * 20} className="csa-clock-line">
            {i} {t}
          </text>
        ))}
      </g>
    </svg>
  );

  const side = done ? (
    <>
      <p className="csa-step">All {jobs.length} jobs done</p>
      <ol className="csa-picks">
        {picks.map(p => {
          const j = CLOCK_JOBS.find(x => x.id === p.job)!;
          const s = j.at(p.hour);
          return (
            <li key={p.job} className={s >= 0.8 ? 'is-good' : 'is-bad'}>
              {j.icon} {j.name}: <b>{hourText(p.hour)}</b> {s >= 0.8 ? '✓' : '✗'}
            </li>
          );
        })}
      </ol>
      {said && <Say tone={said.tone}>{said.text}</Say>}
      <Go onClick={() => onDone(scoreClock(picks), `${picks.filter(p => CLOCK_JOBS.find(x => x.id === p.job)!.at(p.hour) >= 0.8).length} of ${picks.length} jobs at a good hour`)}>Finish</Go>
    </>
  ) : (
    <>
      <p className="csa-step">
        Job {at + 1} of {jobs.length}
      </p>
      <p className="csa-job">
        <span aria-hidden="true">{job.icon}</span> {job.name}
      </p>
      <label className="csa-slider">
        <span>
          When? <b>{hourText(hour)}</b>
        </span>
        <input type="range" min={MIN_H} max={MAX_H} step={1} value={hour} onChange={e => setHour(Number(e.target.value))} aria-label="The hour" aria-valuetext={hourText(hour)} />
        <small aria-hidden="true">
          <i>{hourText(MIN_H)}</i>
          <i>noon</i>
          <i>{hourText(MAX_H)}</i>
        </small>
      </label>
      <Say tone={said?.tone}>{said ? said.text : 'Drag the hour and watch the sun, the heat, the wind and the bees.'}</Say>
      <Go onClick={doIt}>Do it at {hourText(hour)}</Go>
    </>
  );
  return <GameFrame label="The right time of day" stage={stage} side={side} />;
}
