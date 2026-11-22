import { useEffect, useState } from 'react';
import { online } from '../net/connection';

/* What shows the instant an activity is opened (the Train yard, the shed's seeds, fertilizer and sprayer, Mission,
   Power, the market, the animals…) while its code is still on its way: a small card with a spinning wheel over the
   dimmed farm, instead of a blank green screen. Its code is in the first download, so it never waits itself. Most
   activities are fetched ahead of time (src/prefetch.ts), so this is usually seen only on a slow connection; after
   a few seconds it says so, so a player on a weak signal knows the game has not frozen. */
export function ActivityLoading({
  label = "Loading…",
  full = false,
}: {
  label?: string;
  full?: boolean;
}) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setSlow(true), 5_000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div
      className={`abs act-loading${full ? " is-full" : ""}`}
      style={{ inset: 0 }}
      role="status"
      aria-live="polite"
    >
      <div className="act-loading-card">
        <span className="act-loading-wheel" aria-hidden="true" />
        <span className="act-loading-text">
          <b>{label}</b>
          {slow && <small>{online() ? "Weak signal: still downloading. It is kept on the phone once here." : "No signal: this opens when the signal is back."}</small>}
        </span>
      </div>
    </div>
  );
}
