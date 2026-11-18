import { UNLOCK, lockText, openCount, tierNow, type UnlockHost } from './model';

/* The marks every buying decision uses for options that open later: a lock on the option, and a line over the list
   saying how many are open and when the next ones open. */

/** A lock on an option that opens later ("🔒 Opens on day 3 or at Level 3"); nothing when it is open. */
export function LockTag({ s, index }: { s: UnlockHost; index: number }) {
  const t = lockText(s, index);
  if (!t) return null;
  return (
    <span className="lock-tag" aria-label={t}>
      <span aria-hidden="true">🔒</span> {t}
    </span>
  );
}

/** "2 of 5 options open · more on day 2 or at Level 2"; nothing once every option is open. */
export function OpenLine({ s, total, what = 'options' }: { s: UnlockHost; total: number; what?: string }) {
  const open = openCount(s, total);
  if (open >= total) return null;
  const next = UNLOCK.tiers[tierNow(s) + 1];
  return (
    <p className="open-line">
      <span aria-hidden="true">🔓</span> {open} of {total} {what} open{next ? ` · more on day ${next.day} or at Level ${next.level}` : ''}
    </p>
  );
}
