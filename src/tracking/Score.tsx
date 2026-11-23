import { bandOf, type Part } from './model';

/* The sustainability score, drawn: a ring with the number out of 100, and a bar for each part. Used by the Tracking
   page and by the Sustainability section of Mission. */

export function ScoreRing({ score, size = 86 }: { score: number; size?: number }) {
  const band = bandOf(score);
  const rad = size / 2 - 6;
  const len = 2 * Math.PI * rad;
  return (
    <div className={`sus-ring is-${band.tone}`} style={{ width: size, height: size }} role="img" aria-label={`Sustainability score ${score} out of 100: ${band.word}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={rad} className="sus-ring-track" />
        <circle cx={size / 2} cy={size / 2} r={rad} className="sus-ring-fill" strokeDasharray={`${(len * score) / 100} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <span>
        <b>{score}</b>
        <small>/100</small>
      </span>
    </div>
  );
}

export function PartBars({ parts, tips = false }: { parts: Part[]; tips?: boolean }) {
  return (
    <ul className="sus-parts" aria-label="What the score is made of">
      {parts.map(p => {
        const tone = p.score === null ? 'none' : bandOf(p.score).tone;
        return (
          <li key={p.id} className={`sus-part is-${tone}`}>
            <span className="sus-part-head">
              <i aria-hidden="true">{p.icon}</i>
              <b>{p.label}</b>
              <small>{p.weight}%</small>
              <em>{p.score === null ? '—' : p.score}</em>
            </span>
            <span className="sus-bar" aria-hidden="true">
              <i style={{ width: `${p.score ?? 0}%` }} />
            </span>
            <small className="sus-why">
              {p.why}
              {tips && p.score !== null && p.score < 85 && <> · <span className="sus-tip">{p.tip}</span></>}
            </small>
          </li>
        );
      })}
    </ul>
  );
}
