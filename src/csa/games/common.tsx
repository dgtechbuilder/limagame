import type { ReactNode } from 'react';

/* What every Climate Smart Agriculture game shares: its props, the frame (the drawn field on the left, the tools and
   what is happening on the right), and the tool buttons. */

export interface GameProps {
  /** the field, the moths, the stumps, the seasons: the same seed gives the same game (the daily drill's is the date's) */
  seed: number;
  /** the daily drill: a shorter game where the game has one */
  drill: boolean;
  /** the game is over: its score (0 to 1) and a line saying what happened */
  onDone: (score: number, summary: string) => void;
}

export function GameFrame({ stage, side, label }: { stage: ReactNode; side: ReactNode; label: string }) {
  return (
    <div className="csa-game">
      <div className="csa-stage" role="group" aria-label={label}>
        {stage}
      </div>
      <div className="csa-side">{side}</div>
    </div>
  );
}

export function Tool({ on, onClick, children, label, disabled }: { on?: boolean; onClick: () => void; children: ReactNode; label?: string; disabled?: boolean }) {
  return (
    <button type="button" className={`csa-tool${on ? ' is-on' : ''}`} aria-pressed={on} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** The line under the tools: what to do now, or what just happened. */
export function Say({ tone, children }: { tone?: 'good' | 'bad'; children: ReactNode }) {
  return (
    <p className={`csa-say${tone ? ` is-${tone}` : ''}`} role="status" aria-live="polite">
      {children}
    </p>
  );
}

export function Go({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className="gold-btn csa-go" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

/** Runs an animation from 0 to 1 over ms, calling back each frame; returns a stop function. */
export function animate(ms: number, frame: (t: number) => void, done: () => void) {
  const reduce = typeof document !== 'undefined' && document.querySelector('.reduce-motion');
  if (reduce) {
    frame(1);
    done();
    return () => {};
  }
  const start = performance.now();
  let id = 0;
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / ms);
    frame(t);
    if (t < 1) id = requestAnimationFrame(tick);
    else done();
  };
  id = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(id);
}

/** A small sprout, drawn at (x, y): its height grows with g (0 to 1). */
export function Sprout({ x, y, g = 1, tone = '#54933d' }: { x: number; y: number; g?: number; tone?: string }) {
  const h = 4 + 16 * g;
  return (
    <g transform={`translate(${x} ${y})`} aria-hidden="true">
      <path d={`M0 0 L0 ${-h}`} stroke="#4c7635" strokeWidth={2} strokeLinecap="round" />
      <path d={`M0 ${-h * 0.55} q -7 -2 -9 -8 q 7 0 9 8`} fill={tone} />
      <path d={`M0 ${-h * 0.8} q 7 -2 9 -8 q -7 0 -9 8`} fill={tone} />
      {g > 0.7 && <path d={`M0 ${-h} q -4 -6 0 -10 q 4 4 0 10`} fill={tone} />}
    </g>
  );
}
