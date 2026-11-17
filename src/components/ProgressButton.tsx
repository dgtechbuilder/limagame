import type { Dispatch } from 'react';
import { achOfSave, streakNow, unclaimed } from '../achievements/model';
import { achClock, viewOf } from '../achievements/track';
import { currentLevel, levelProgress } from '../progress/model';
import { slotBrand } from '../partners/data';
import { useSlotView } from '../partners/track';
import type { Action, GameState } from '../state';

/** The progress ring: the certification level in the middle, filling toward the next level. */
function LevelRing({ n, value }: { n: number; value: number }) {
  const r = 13;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#1e5b78" />
      <circle cx="16" cy="16" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <circle cx="16" cy="16" r={r} fill="none" stroke="#ffcf3f" strokeWidth="3" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 16 16)" />
      {/* a mortarboard over the level number */}
      <path d="M16 6.5l6 2.6-6 2.6-6-2.6z" fill="#ffcf3f" />
      <text x="16" y="23" textAnchor="middle" fontSize="10" fontWeight="800" fill="#fff">
        {n}
      </text>
    </svg>
  );
}

/** The PROGRESS button on the farm: the certification level and how close the next one is, the streak, and a dot
    while a reward waits to be claimed. It opens My Progress. */
export function ProgressButton({ s, dispatch, classic }: { s: GameState; dispatch: Dispatch<Action>; classic?: boolean }) {
  const today = achClock.today();
  const a = achOfSave(s.ach);
  const streak = streakNow(a, today);
  const waiting = unclaimed(a, today);
  const { level, next } = currentLevel(a);
  const v = viewOf(s, a, today);
  const toNext = next ? levelProgress(next, { ach: a, v, courses: v.courses }) : 1;
  const sponsor = slotBrand('progress-button');
  useSlotView('progress-button', !!sponsor);
  const label = `My Progress: ${level ? `level ${level.n}, ${level.name}` : 'not certified yet'}${next ? `, ${Math.round(toNext * 100)}% to level ${next.n}` : ''}, ${streak}-day streak${
    waiting ? `, ${waiting} reward${waiting === 1 ? '' : 's'} to claim` : ''
  }${sponsor ? `. Certification with ${sponsor.name}` : ''}`;
  const open = () => dispatch({ type: 'open', modal: { kind: 'achievements' } });
  if (classic)
    return (
      <button type="button" className="awards-chip progress-chip abs" style={{ left: 104, top: 96 }} onClick={open} aria-label={label}>
        <span aria-hidden="true">🎓</span>L{level?.n ?? 0} · PROGRESS
        <i className="progress-chip-bar" aria-hidden="true">
          <i style={{ width: `${Math.round(toNext * 100)}%` }} />
        </i>
        {waiting > 0 && <i className="awards-dot" aria-hidden="true" />}
      </button>
    );
  return (
    <button type="button" className="hud-round hud-progress" onClick={open} aria-label={label}>
      <LevelRing n={level?.n ?? 0} value={toNext} />
      <span>PROGRESS</span>
      <i className="hud-badge" aria-hidden="true">
        🔥{streak}
      </i>
      {waiting > 0 && <i className="awards-dot" aria-hidden="true" />}
    </button>
  );
}
