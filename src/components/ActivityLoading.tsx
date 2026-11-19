/* What shows the instant an activity is opened (the Train yard, the shed's seeds, fertilizer and sprayer, Mission,
   Power, the market, the animals…) while its code is still on its way: a small card with a spinning wheel over the
   dimmed farm, instead of a blank green screen. Its code is in the first download, so it never waits itself. Most
   activities are fetched ahead of time (src/prefetch.ts), so this is usually seen only on a slow connection. */
export function ActivityLoading({
  label = "Loading…",
  full = false,
}: {
  label?: string;
  full?: boolean;
}) {
  return (
    <div
      className={`abs act-loading${full ? " is-full" : ""}`}
      style={{ inset: 0 }}
      role="status"
      aria-live="polite"
    >
      <div className="act-loading-card">
        <span className="act-loading-wheel" aria-hidden="true" />
        <b>{label}</b>
      </div>
    </div>
  );
}
