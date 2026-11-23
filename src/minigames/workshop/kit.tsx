import { createContext, useContext, useEffect, useRef, useState, type KeyboardEvent as RKE, type PointerEvent as RPE, type ReactNode } from 'react';
import { Coach, type ArtId, type Mood } from '../fun';

/* The workshop's kit: what every hands-on lesson scene is built from. A scene is a drawing (360 × 220) the player works
   with their finger: parts dragged in and out of slots, handles dragged round, levers, switches and a pedal held down
   to drive. The frame (Workshop.tsx) holds the question, counts the wrong tries and says when it is done; a scene only
   says what happened (ws.say), when a try went wrong (ws.slip) and when the job is done (ws.win). */

export const W = 360;
export const H = 220;

export interface HandsQuestion {
  q: string;
  /** what to do with the drawing */
  task: string;
  options: string[];
  right: number;
  why: string;
  art: ArtId;
}

export type Tone = 'info' | 'bad' | 'good';
export interface Msg {
  text: string;
  tone: Tone;
  k: number;
}

export interface Ws {
  q: HandsQuestion;
  msg: Msg | null;
  won: boolean;
  /** tell the player what just happened */
  say: (text: string, tone?: Tone) => void;
  /** a try that went wrong: counted, and said */
  slip: (text: string) => void;
  /** the job is done */
  win: (text: string) => void;
}

export const WsCtx = createContext<Ws | null>(null);
export const useWs = () => useContext(WsCtx)!;

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** A frame clock: calls back with seconds since the last frame while mounted. */
export function useFrames(cb: (dt: number) => void) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      ref.current(Math.min(0.05, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/** Says a thing once (per key) until the key is reset. */
export function useOnce() {
  const seen = useRef(new Set<string>());
  return {
    run: (key: string, fn: () => void) => {
      if (seen.current.has(key)) return;
      seen.current.add(key);
      fn();
    },
    reset: (key: string) => seen.current.delete(key),
  };
}

export type P = { x: number; y: number };

/** The bench's pointer work: dragging parts (from the tray or out of the drawing) with a ghost under the finger, and
    dragging handles in the drawing. Points come back in the drawing's own units, whatever the stage's scale. */
export function useBench(opts: { onDrop?: (id: string, p: P | null) => void; onTap?: (id: string) => void } = {}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [ghost, setGhost] = useState<{ icon: ReactNode; x: number; y: number } | null>(null);
  const o = useRef(opts);
  o.current = opts;
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);
  const toSvg = (cx: number, cy: number): P | null => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return null;
    const p = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };
  const toRoot = (cx: number, cy: number) => {
    const r = rootRef.current!;
    const b = r.getBoundingClientRect();
    const k = b.width / r.offsetWidth || 1;
    return { x: (cx - b.left) / k, y: (cy - b.top) / k };
  };
  const listen = (move: (ev: PointerEvent) => void, up: (ev: PointerEvent) => void) => {
    stop.current?.();
    const end = (ev: PointerEvent) => {
      off();
      up(ev);
    };
    const off = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      stop.current = null;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    stop.current = off;
  };
  /** drag a handle in the drawing: move gets each point; end gets the last (and whether it moved at all) */
  const follow = (e: RPE, move: (p: P) => void, end?: (p: P | null, moved: boolean) => void) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    listen(
      ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
        moved = true;
        const p = toSvg(ev.clientX, ev.clientY);
        if (p) move(p);
      },
      ev => end?.(toSvg(ev.clientX, ev.clientY), moved),
    );
  };
  /** drag a part: a ghost follows the finger; dropped, the scene gets where (null: off the drawing); a tap is a tap */
  const drag = (id: string, e: RPE, icon: ReactNode) => {
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;
    listen(
      ev => {
        if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
        moved = true;
        setGhost({ icon, ...toRoot(ev.clientX, ev.clientY) });
      },
      ev => {
        setGhost(null);
        if (!moved) return o.current.onTap?.(id);
        const p = toSvg(ev.clientX, ev.clientY);
        o.current.onDrop?.(id, p && p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H ? p : null);
      },
    );
  };
  const tap = (id: string) => o.current.onTap?.(id);
  return { svgRef, rootRef, ghost, toSvg, follow, drag, tap };
}
export type BenchKit = ReturnType<typeof useBench>;

const MOOD: Record<Tone, Mood> = { info: 'think', bad: 'sad', good: 'cheer' };

/** The bench: the drawing on the left (with what the coach says over it), the question, the job, the parts and the
    controls on the right. */
export function Bench({ b, scene, label, tray, trayLabel = 'Parts: drag one onto the tractor', controls }: { b: BenchKit; scene: ReactNode; label: string; tray?: ReactNode; trayLabel?: string; controls?: ReactNode }) {
  const ws = useWs();
  return (
    <div className="ws-body" ref={b.rootRef}>
      <div className={`ws-stage${ws.won ? ' is-won' : ''}`}>
        <svg ref={b.svgRef} viewBox={`0 0 ${W} ${H}`} className="ws-svg" role="img" aria-label={label}>
          {scene}
        </svg>
        {ws.msg && (
          <div key={ws.msg.k} className={`ws-say is-${ws.msg.tone}`} role="status">
            <Coach mood={MOOD[ws.msg.tone]} size={24} />
            <p>{ws.msg.text}</p>
          </div>
        )}
      </div>
      <div className="ws-side">
        <p className="mg-q">{ws.q.q}</p>
        <p className="ws-task">
          <span aria-hidden="true">👉 </span>
          {ws.q.task}
        </p>
        {tray && (
          <div className="ws-tray" role="group" aria-label={trayLabel}>
            <small>{trayLabel}</small>
            {tray}
          </div>
        )}
        {controls && <div className="ws-controls">{controls}</div>}
      </div>
      {b.ghost && (
        <div className="ws-ghost" style={{ left: b.ghost.x, top: b.ghost.y }} aria-hidden="true">
          {b.ghost.icon}
        </div>
      )}
    </div>
  );
}

/** A part in the tray: drag it into the drawing, or tap it to fit it (tap again to take it out). */
export function PartCard({ b, id, icon, label, letter, fitted, note }: { b: BenchKit; id: string; icon: ReactNode; label: string; letter?: string; fitted?: boolean; note?: string }) {
  return (
    <button
      type="button"
      className={`ws-part${fitted ? ' is-fitted' : ''}`}
      data-part={id}
      aria-pressed={!!fitted}
      onPointerDown={e => b.drag(id, e, icon)}
      onClick={e => e.detail === 0 && b.tap(id)}
    >
      {letter && (
        <span className="mg-opt-key" aria-hidden="true">
          {letter}
        </span>
      )}
      <span className="ws-part-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="ws-part-text">
        {label}
        {note && <small>{note}</small>}
      </span>
    </button>
  );
}

/** A button held down (a pedal): on while the finger (or Space/Enter) is down. */
export function Hold({ label, onHold, ctl, disabled }: { label: ReactNode; onHold: (on: boolean) => void; ctl: string; disabled?: boolean }) {
  const [on, setOn] = useState(false);
  const cb = useRef(onHold);
  cb.current = onHold;
  const set = (v: boolean) => {
    setOn(v);
    cb.current(v);
  };
  useEffect(() => {
    if (disabled && on) set(false);
  });
  useEffect(() => () => cb.current(false), []);
  const down = (e: RPE) => {
    if (disabled) return;
    e.preventDefault();
    set(true);
    const up = () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      set(false);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  const key = (v: boolean) => (e: RKE) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) set(v);
    }
  };
  return (
    <button type="button" className={`ws-btn ws-hold${on ? ' is-on' : ''}`} data-ctl={ctl} disabled={disabled} onPointerDown={down} onKeyDown={key(true)} onKeyUp={key(false)} onContextMenu={e => e.preventDefault()}>
      {label}
    </button>
  );
}

/** A switch: on or off. */
export function Switch({ label, on, onChange, ctl, onText = 'On', offText = 'Off' }: { label: string; on: boolean; onChange: (v: boolean) => void; ctl: string; onText?: string; offText?: string }) {
  return (
    <button type="button" className={`ws-btn ws-switch${on ? ' is-on' : ''}`} data-ctl={ctl} aria-pressed={on} onClick={() => onChange(!on)}>
      <span>{label}</span>
      <i aria-hidden="true">
        <b />
      </i>
      <small>{on ? onText : offText}</small>
    </button>
  );
}

/** A plain button for one step. */
export function Step({ label, onClick, ctl, disabled }: { label: ReactNode; onClick: () => void; ctl: string; disabled?: boolean }) {
  return (
    <button type="button" className="ws-btn" data-ctl={ctl} disabled={disabled} onClick={onClick}>
      {label}
    </button>
  );
}

/** A lever: a slider with its value. */
export function Lever({ label, value, min, max, step = 1, onChange, show, ctl }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; show: string; ctl: string }) {
  return (
    <label className="ws-lever">
      <span>{label}</span>
      <input type="range" data-ctl={ctl} min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={label} aria-valuetext={show} />
      <b>{show}</b>
    </label>
  );
}

/* ---------------- drawings ---------------- */

/** A wheel: lugs and a hub that turn with rot (degrees). */
export function Wheel({ cx, cy, r, rot = 0, squash = 0 }: { cx: number; cy: number; r: number; rot?: number; squash?: number }) {
  return (
    // a soft tyre squashes flat on the ground: the whole wheel, lugs and all, scaled from where it touches
    <g transform={`translate(${cx},${cy + r}) scale(${1 + (squash * 0.6) / r},${1 - (squash * 0.3) / r}) translate(0,${-r})`}>
      <circle r={r} fill="#2a2a2a" />
      <g transform={`rotate(${rot})`}>
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={-r * 0.1} y={-r - 1.2} width={r * 0.2} height={3.4} rx={1} fill="#151515" transform={`rotate(${i * 30})`} />
        ))}
        <circle r={r * 0.5} fill="#f2c230" />
        {[0, 72, 144, 216, 288].map(a => (
          <circle key={a} cx={r * 0.3} r={r * 0.06 + 0.6} fill="#9a7a10" transform={`rotate(${a})`} />
        ))}
      </g>
      <circle r={r * 0.15} fill="#c79a12" />
    </g>
  );
}

/** Puffs from the exhaust while the engine runs. */
export const Puffs = ({ x, y }: { x: number; y: number }) => (
  <g className="ws-puffs" aria-hidden="true">
    {[0, 1, 2].map(i => (
      <circle key={i} cx={x} cy={y} r={4} fill="#9aa3a8" style={{ animationDelay: `${i * 0.33}s` }} />
    ))}
  </g>
);

/** The farm's tractor side-on, facing left; its origin is the ground under the middle. Points (in its own units):
    front grille (-80, -47), PTO stub (64, -31), upper hitch (60, -56), lower hitch (62, -22), seat (30, -70). */
export function Tractor({ x, y, s = 1, roll = 0, tilt = 0, driver = true, running = false, front, back, children, sink = 0 }: { x: number; y: number; s?: number; roll?: number; tilt?: number; driver?: boolean; running?: boolean; front?: ReactNode; back?: ReactNode; children?: ReactNode; sink?: number }) {
  return (
    <g transform={`translate(${x},${y + sink}) rotate(${tilt}) scale(${s})`}>
      <g className={running ? 'ws-idle' : undefined}>
        {back}
        {/* the ROPS frame and its roof */}
        <path d="M4 -60 L6 -118 M50 -60 L48 -118" stroke="#1d5e33" strokeWidth={5} strokeLinecap="round" />
        <rect x={-2} y={-124} width={56} height={8} rx={3} fill="#2b8a4a" />
        <rect x={-56} y={-82} width={5} height={22} rx={1} fill="#555" />
        {running && <Puffs x={-53} y={-86} />}
        {/* bonnet and engine */}
        <rect x={-78} y={-62} width={88} height={30} rx={6} fill="#2b8a4a" />
        <rect x={-78} y={-62} width={88} height={7} rx={3} fill="#3aa35c" />
        <rect x={-24} y={-66} width={8} height={4} rx={1} fill="#c0432f" />
        <rect x={-6} y={-46} width={66} height={18} rx={4} fill="#237a3e" />
        <rect x={60} y={-34} width={6} height={6} rx={1} fill="#8b8b8b" />
        <rect x={-82} y={-58} width={6} height={22} rx={2} fill="#1d5e33" />
        {front}
        <Wheel cx={-52} cy={-17} r={17} rot={roll * 1.76} />
        <Wheel cx={28} cy={-30} r={30} rot={roll} />
        <path d="M-6 -34 A34 34 0 0 1 62 -34" fill="none" stroke="#2b8a4a" strokeWidth={6} strokeLinecap="round" />
        <rect x={0} y={-28} width={12} height={3} fill="#555" />
        {/* seat and steering */}
        <rect x={22} y={-70} width={22} height={6} rx={2} fill="#3a3a3a" />
        <rect x={38} y={-90} width={6} height={24} rx={2} fill="#3a3a3a" />
        <path d="M2 -60 L12 -80" stroke="#444" strokeWidth={3} />
        <ellipse cx={13} cy={-82} rx={9} ry={3} fill="none" stroke="#333" strokeWidth={2.5} transform="rotate(-25 13 -82)" />
        {driver && (
          <text x={30} y={-68} fontSize={26} textAnchor="middle">
            🧑‍🌾
          </text>
        )}
      </g>
      {children}
    </g>
  );
}

/** The sky and the ground line. */
export const Sky = ({ ground = 190, sun = true, soil = '#9a6b3e' }: { ground?: number; sun?: boolean; soil?: string }) => (
  <>
    <rect width={W} height={H} fill="#cfeaf6" />
    {sun && <circle cx={330} cy={26} r={13} fill="#ffd25c" />}
    <rect y={ground} width={W} height={H - ground} fill={soil} />
    <rect y={ground} width={W} height={3} fill="#7cb342" />
  </>
);

/** An empty slot to drop a part in: a dashed ring that pulses. */
export const Slot = ({ x, y, r = 14, label }: { x: number; y: number; r?: number; label?: string }) => (
  <g className="ws-slot" aria-hidden="true">
    <circle cx={x} cy={y} r={r} />
    <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={800}>
      ?
    </text>
    {label && (
      <text x={x} y={y - r - 4} textAnchor="middle" fontSize={8} fontWeight={800} className="ws-slot-label">
        {label}
      </text>
    )}
  </g>
);

/** Small drawings of the parts, about 26 across, centred on 0,0: in the tray and in the drawing alike. */
export function PartArt({ kind, spin = 0 }: { kind: string; spin?: number }) {
  switch (kind) {
    case 'shaft':
      return (
        <g>
          <rect x={-13} y={-3.5} width={26} height={7} rx={2} fill="#9a9a9a" />
          <line x1={-12} y1={0} x2={12} y2={0} stroke="#ffae00" strokeWidth={7} strokeDasharray="3 4" strokeDashoffset={-spin / 20} opacity={0.85} />
          <rect x={-15} y={-6} width={4} height={12} rx={1} fill="#555" />
          <rect x={11} y={-6} width={4} height={12} rx={1} fill="#555" />
        </g>
      );
    case 'steering':
      return (
        <g transform={`rotate(${spin})`}>
          <circle r={10} fill="none" stroke="#333" strokeWidth={3} />
          <path d="M0 0 L0 -10 M0 0 L8.6 5 M0 0 L-8.6 5" stroke="#555" strokeWidth={2.2} />
          <circle r={3} fill="#c0432f" />
        </g>
      );
    case 'cap':
      return (
        <g>
          <rect x={-7} y={-5} width={14} height={9} rx={2.5} fill="#c0432f" />
          <path d="M-5 -5 v9 M-2 -5 v9 M1 -5 v9 M4 -5 v9" stroke="#8a2f22" strokeWidth={1} />
          <rect x={-4} y={4} width={8} height={4} fill="#777" />
        </g>
      );
    case 'arms':
      return (
        <g stroke="#6f6f6f" strokeWidth={3.4} strokeLinecap="round" fill="none">
          <path d="M-12 -8 L11 -2" />
          <path d="M-12 8 L11 4" />
          <path d="M11 -2 L11 4" stroke="#ffae00" />
          <circle cx={-12} cy={-8} r={2} fill="#333" stroke="none" />
          <circle cx={-12} cy={8} r={2} fill="#333" stroke="none" />
        </g>
      );
    case 'pump':
      return (
        <g>
          <rect x={-4} y={-8} width={8} height={18} rx={2} fill="#2f6fb0" />
          <path d="M0 -8 V-12 M-6 -12 H6" stroke="#444" strokeWidth={2.4} strokeLinecap="round" />
          <path d="M4 6 Q12 8 12 -2" stroke="#222" strokeWidth={1.6} fill="none" />
        </g>
      );
    case 'fan':
      return (
        <g transform={`rotate(${spin})`}>
          {[0, 90, 180, 270].map(a => (
            <ellipse key={a} cx={0} cy={-6} rx={3.4} ry={6.5} fill="#8b8b8b" transform={`rotate(${a})`} />
          ))}
          <circle r={2.6} fill="#444" />
        </g>
      );
    case 'radiator':
      return (
        <g>
          <rect x={-9} y={-12} width={18} height={24} rx={2} fill="#3d4a52" />
          {[-8, -4, 0, 4, 8].map(y => (
            <line key={y} x1={-7} x2={7} y1={y} y2={y} stroke="#b8c7cf" strokeWidth={1.4} />
          ))}
          <rect x={-3} y={-15} width={6} height={3} rx={1} fill="#777" />
        </g>
      );
    case 'battery':
      return (
        <g>
          <rect x={-11} y={-7} width={22} height={14} rx={2} fill="#333" />
          <rect x={-8} y={-10} width={4} height={3} fill="#c0432f" />
          <rect x={4} y={-10} width={4} height={3} fill="#111" />
          <text x={0} y={4} textAnchor="middle" fontSize={8} fill="#ffd25c" fontWeight={800}>
            12V
          </text>
        </g>
      );
    case 'seat':
      return (
        <g fill="#3a3a3a">
          <rect x={-10} y={2} width={18} height={5} rx={2} />
          <rect x={5} y={-11} width={5} height={16} rx={2} />
          <rect x={-2} y={7} width={3} height={5} fill="#777" />
        </g>
      );
    default:
      return null;
  }
}

/** A part's drawing on its own, for the tray and the ghost. */
export const PartIcon = ({ kind }: { kind: string }) => (
  <svg viewBox="-15 -15 30 30" width={28} height={28}>
    <PartArt kind={kind} />
  </svg>
);
