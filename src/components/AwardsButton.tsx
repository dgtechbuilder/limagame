import type { Dispatch } from 'react';
import { achOfSave, streakNow, unclaimed } from '../achievements/model';
import { achClock } from '../achievements/track';
import type { Action, GameState } from '../state';

/** A medal on a ribbon. */
function MedalIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M9 3h6l3 9h-6z" fill="#2a7fd0" />
      <path d="M23 3h-6l-3 9h6z" fill="#e0483c" />
      <circle cx="16" cy="20" r="9" fill="#ffcf3f" stroke="#c88900" strokeWidth="2" />
      <path d="M16 14.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8-3.4-1.8-3.4 1.8.7-3.8-2.8-2.6 3.8-.5z" fill="#fff6d6" />
    </svg>
  );
}

/** The AWARDS button on the farm: the streak on it, and a dot while a reward waits to be claimed. */
export function AwardsButton({ s, dispatch, classic }: { s: GameState; dispatch: Dispatch<Action>; classic?: boolean }) {
  const today = achClock.today();
  const a = achOfSave(s.ach);
  const streak = streakNow(a, today);
  const waiting = unclaimed(a, today);
  const label = `Achievements: ${streak}-day streak${waiting ? `, ${waiting} reward${waiting === 1 ? '' : 's'} to claim` : ''}`;
  const open = () => dispatch({ type: 'open', modal: { kind: 'achievements' } });
  if (classic)
    return (
      <button type="button" className="awards-chip abs" style={{ left: 104, top: 96 }} onClick={open} aria-label={label}>
        <span aria-hidden="true">🔥</span>
        {streak} · AWARDS
        {waiting > 0 && <i className="awards-dot" aria-hidden="true" />}
      </button>
    );
  return (
    <button type="button" className="hud-round hud-awards" onClick={open} aria-label={label}>
      <MedalIcon />
      <span>AWARDS</span>
      <i className="hud-badge" aria-hidden="true">
        🔥{streak}
      </i>
      {waiting > 0 && <i className="awards-dot" aria-hidden="true" />}
    </button>
  );
}
