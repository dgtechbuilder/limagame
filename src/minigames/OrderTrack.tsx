import { useEffect, useMemo, useRef, useState, type KeyboardEvent as RKE, type PointerEvent as RPE } from 'react';
import { FloatUp, iconFor, shuffled } from './fun';

/* The order game: put the steps of a job in the right order. The steps sit in a list on the side; the player taps
   one to send it to the next checkpoint, or drags it onto a checkpoint on the track. The track is drawn big (round a
   big tractor for the tractor's safety check, or a winding farm road with a big tractor on it) and zooms in: the
   zoom buttons, the mouse wheel, a pinch, or a tap on a checkpoint. Close up, each checkpoint shows the picture of
   the step that belongs there and its clue, so the player can see where the job starts and which checkpoints are
   not open yet. The score is the same as ever: one less a share for every wrong step. */

/** A checkpoint on the track, in stage units (0–W across, 0–H down), with a short clue of where it is. */
export type TrackPt = { x: number; y: number; hint?: string };

type Spec = { steps: string[]; icons?: string[]; scene?: 'tractor'; track?: TrackPt[]; start?: { x: number; y: number } };
type P = { x: number; y: number };

const W = 400;
const H = 184;
const ZMAX = 3;
/** from this zoom on, each checkpoint shows its picture */
const ZCLUE = 1.5;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** Checkpoints along a winding road across the stage, when a game gives no places of its own. */
function roadOf(n: number): TrackPt[] {
  return Array.from({ length: n }, (_, k) => {
    const t = n === 1 ? 0.5 : k / (n - 1);
    return { x: 56 + t * (W - 100), y: H / 2 - Math.sin(t * Math.PI * 2) * 42 };
  });
}

/** One smooth piece of the track from point i to i+1 (Catmull-Rom through its neighbours). */
function piece(ps: P[], i: number) {
  const p0 = ps[i - 1] ?? ps[i];
  const p1 = ps[i];
  const p2 = ps[i + 1];
  const p3 = ps[i + 2] ?? p2;
  const r = (v: number) => Math.round(v * 10) / 10;
  return `M${r(p1.x)},${r(p1.y)} C${r(p1.x + (p2.x - p0.x) / 6)},${r(p1.y + (p2.y - p0.y) / 6)} ${r(p2.x - (p3.x - p1.x) / 6)},${r(p2.y - (p3.y - p1.y) / 6)} ${r(p2.x)},${r(p2.y)}`;
}

/** Where the track starts: just before the first checkpoint, away from the second. */
function startOf(pts: TrackPt[]): P {
  const [a, b] = pts;
  if (!b) return { x: clamp(a.x - 30, 8, W - 8), y: a.y };
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const l = Math.hypot(dx, dy) || 1;
  return { x: clamp(a.x + (dx / l) * 28, 10, W - 10), y: clamp(a.y + (dy / l) * 28, 10, H - 10) };
}

type View = { z: number; tx: number; ty: number };
const fit = (v: View): View => {
  const z = clamp(v.z, 1, ZMAX);
  return { z, tx: clamp(v.tx, W - W * z, 0), ty: clamp(v.ty, H - H * z, 0) };
};
const FULL: View = { z: 1, tx: 0, ty: 0 };

export function OrderTrack({ spec, onEnd }: { spec: Spec; onEnd: (score: number) => void }) {
  const total = spec.steps.length;
  const cards = useMemo(() => shuffled(spec.steps.map((t, i) => ({ t, i, icon: spec.icons?.[i] ?? iconFor(t, '🔹') })), 5), [spec]);
  const icons = useMemo(() => spec.steps.map((t, i) => spec.icons?.[i] ?? iconFor(t, '🔹')), [spec]);
  const pts = useMemo(() => (spec.track && spec.track.length === total ? spec.track : roadOf(total)), [spec, total]);
  const route = useMemo(() => [spec.start ?? startOf(pts), ...pts], [spec.start, pts]);
  const tractor = spec.scene === 'tractor';

  const [done, setDone] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [pop, setPop] = useState<{ n: number; tone: 'good' | 'bad' | 'gold'; text: string; at: P } | null>(null);
  const [msg, setMsg] = useState('');
  const [view, setView] = useState<View>(FULL);
  /** the checkpoint whose clue is shown in words (the one tapped; else the next one) */
  const [focus, setFocus] = useState<number | null>(null);
  const [panning, setPanning] = useState(false);
  const [drag, setDrag] = useState<{ i: number; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const finished = done >= total;

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const say = (tone: 'good' | 'bad' | 'gold', text: string, at: P) => setPop(p => ({ n: (p?.n ?? 0) + 1, tone, text, at }));

  /** Put step i in at the next checkpoint. */
  const place = (i: number) => {
    if (finished) return;
    if (i !== done) {
      setWrong(w => w + 1);
      setStreak(0);
      setShake(i);
      window.setTimeout(() => setShake(null), 350);
      setMsg(`Not that one yet: checkpoint ${done + 1} is ${pts[done].hint ? pts[done].hint!.toLowerCase() : 'next on the track'}.`);
      say('bad', '✕ Not that one yet', route[done]);
      return;
    }
    const n = done + 1;
    setDone(n);
    setStreak(x => x + 1);
    setMsg('');
    setFocus(null);
    say(streak + 1 >= 3 ? 'gold' : 'good', streak + 1 >= 3 ? `🔥 ${streak + 1} in a row` : '✓ Next!', route[n]);
    // zoomed in: the view follows the walk to the next checkpoint
    if (n < total) setView(v => (v.z > 1 ? fit({ z: v.z, tx: W / 2 - pts[n].x * v.z, ty: H / 2 - pts[n].y * v.z }) : v));
    else {
      setView(FULL);
      window.setTimeout(() => onEnd(Math.max(0.2, 1 - wrong / total)), 900);
    }
  };

  /** A step dropped on checkpoint k (or off the track). */
  const drop = (i: number, k: number | null) => {
    if (k === null || finished) return;
    if (k < done) {
      setMsg(`Checkpoint ${k + 1} is done already.`);
      return;
    }
    if (k > done) {
      setMsg(`Checkpoint ${k + 1} is not open yet: start at checkpoint ${done + 1}, the one that glows.`);
      say('bad', '🔒 Not yet', route[k + 1]);
      return;
    }
    place(i);
  };

  /* ---- zoom ---- */
  const zoomAt = (z: number, ux = W / 2, uy = H / 2) =>
    setView(v => {
      const cx = (ux - v.tx) / v.z;
      const cy = (uy - v.ty) / v.z;
      const nz = clamp(z, 1, ZMAX);
      return fit({ z: nz, tx: ux - cx * nz, ty: uy - cy * nz });
    });
  const zoomTo = (k: number) => {
    if (focus === k && view.z > 1) {
      setFocus(null);
      setView(FULL);
      return;
    }
    setFocus(k);
    const z = Math.max(view.z, 2.4);
    setView(fit({ z, tx: W / 2 - pts[k].x * z, ty: H / 2 - pts[k].y * z }));
  };
  /** client pixels → stage units */
  const units = (cx: number, cy: number): P => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  };

  // the mouse wheel zooms round the pointer (a native listener: React's wheel listener cannot stop the page scrolling)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const u = units(e.clientX, e.clientY);
      setView(v => {
        const nz = clamp(v.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2), 1, ZMAX);
        const cx = (u.x - v.tx) / v.z;
        const cy = (u.y - v.ty) / v.z;
        return fit({ z: nz, tx: u.x - cx * nz, ty: u.y - cy * nz });
      });
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, []);

  // + and − zoom, 0 shows the whole track
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '+' || e.key === '=') zoomAt(view.z * 1.4);
      else if (e.key === '-' || e.key === '_') zoomAt(view.z / 1.4);
      else if (e.key === '0') (setView(FULL), setFocus(null));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  /* ---- the stage: pan with a drag, pinch to zoom, tap a checkpoint ---- */
  const touches = useRef(new Map<number, P>());
  const gesture = useRef<{ moved: boolean; start: P; view: View; pinch?: { d: number; mid: P } } | null>(null);
  const cpAt = (cx: number, cy: number) => {
    const el = document.elementFromPoint(cx, cy)?.closest('[data-cp]');
    return el ? Number(el.getAttribute('data-cp')) : null;
  };
  const stageDown = (e: RPE<SVGSVGElement>) => {
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
    const ps = [...touches.current.values()];
    if (ps.length === 2) {
      const mid = units((ps[0].x + ps[1].x) / 2, (ps[0].y + ps[1].y) / 2);
      gesture.current = { moved: true, start: ps[0], view, pinch: { d: Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) || 1, mid } };
    } else gesture.current = { moved: false, start: { x: e.clientX, y: e.clientY }, view };
  };
  const stageMove = (e: RPE<SVGSVGElement>) => {
    const g = gesture.current;
    if (!g || !touches.current.has(e.pointerId)) return;
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const ps = [...touches.current.values()];
    if (g.pinch && ps.length >= 2) {
      const d = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
      const v0 = g.view;
      const nz = clamp((v0.z * d) / g.pinch.d, 1, ZMAX);
      const cx = (g.pinch.mid.x - v0.tx) / v0.z;
      const cy = (g.pinch.mid.y - v0.ty) / v0.z;
      setView(fit({ z: nz, tx: g.pinch.mid.x - cx * nz, ty: g.pinch.mid.y - cy * nz }));
      return;
    }
    const dx = e.clientX - g.start.x;
    const dy = e.clientY - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) < 6) return;
    g.moved = true;
    if (g.view.z <= 1) return;
    setPanning(true);
    const r = svgRef.current!.getBoundingClientRect();
    setView(fit({ ...g.view, tx: g.view.tx + (dx / r.width) * W, ty: g.view.ty + (dy / r.height) * H }));
  };
  const stageUp = (e: RPE<SVGSVGElement>) => {
    touches.current.delete(e.pointerId);
    const g = gesture.current;
    if (touches.current.size > 0) {
      // one finger of a pinch lifted: carry on panning from here with the other
      const [rest] = [...touches.current.values()];
      gesture.current = { moved: true, start: rest, view };
      return;
    }
    gesture.current = null;
    setPanning(false);
    if (g && !g.moved) {
      const k = cpAt(e.clientX, e.clientY);
      if (k !== null) zoomTo(k);
    }
  };

  /* ---- the step cards: tap, or drag onto the track ---- */
  const press = useRef<{ i: number; id: number; x: number; y: number; dragging: boolean } | null>(null);
  const justDragged = useRef(false);
  const local = (cx: number, cy: number): P => {
    const el = wrapRef.current!;
    const r = el.getBoundingClientRect();
    const s = r.width / el.offsetWidth || 1;
    return { x: (cx - r.left) / s, y: (cy - r.top) / s };
  };
  const cardDown = (e: RPE<HTMLButtonElement>, i: number) => {
    if (i < done || finished || e.button > 0) return;
    press.current = { i, id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const cardMove = (e: RPE<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (!p.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 7) return;
    p.dragging = true;
    const at = local(e.clientX, e.clientY);
    setDrag({ i: p.i, ...at });
    setHover(cpAt(e.clientX, e.clientY));
  };
  const cardUp = (e: RPE<HTMLButtonElement>) => {
    const p = press.current;
    press.current = null;
    if (!p || p.id !== e.pointerId) return;
    if (p.dragging) {
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      setDrag(null);
      setHover(null);
      drop(p.i, cpAt(e.clientX, e.clientY));
    }
  };
  const cardCancel = () => {
    press.current = null;
    setDrag(null);
    setHover(null);
  };

  const mover = route[Math.min(done, total)];
  const clueAt = focus ?? (done < total ? done : null);
  const z = view.z;
  const dragCard = drag ? cards.find(c => c.i === drag.i) : null;
  const onCpKey = (e: RKE, k: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      zoomTo(k);
    }
  };

  return (
    <div className={`mg-order${drag ? ' is-dragging' : ''}`} ref={wrapRef}>
      <div className="mg-order-side">
        <p className="mg-order-head">
          Steps <small>tap one, or drag it onto the track</small>
        </p>
        <div className="mg-order-list">
          {cards.map(c => (
            <button
              key={c.i}
              type="button"
              className={`mg-card-btn${c.i < done ? ' is-done' : ''}${shake === c.i ? ' is-wrong' : ''}${drag?.i === c.i ? ' is-lifted' : ''}`}
              disabled={c.i < done || finished}
              aria-label={c.i < done ? `Step ${c.i + 1}: ${c.t}` : c.t}
              onPointerDown={e => cardDown(e, c.i)}
              onPointerMove={cardMove}
              onPointerUp={cardUp}
              onPointerCancel={cardCancel}
              onClick={() => !justDragged.current && place(c.i)}
            >
              <span className="mg-card-icon" aria-hidden="true">
                {c.i < done ? <b>{c.i + 1}</b> : c.icon}
              </span>
              <span className="mg-card-text">{c.t}</span>
              {c.i >= done && <span className="mg-grip" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mg-order-main">
        <p className="mg-progress">
          Steps in order · {done} of {total}
          {wrong > 0 && <b className="mg-time is-bad">{wrong} wrong</b>}
        </p>
        <div className={`mg-stage-wrap${tractor ? ' is-walk' : ''}${panning ? ' is-panning' : ''}${z > 1 ? ' is-zoomed' : ''}`}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="mg-stage"
            role="group"
            aria-label={`The track: ${total} checkpoints. Tap a checkpoint to zoom in on its clue.`}
            onPointerDown={stageDown}
            onPointerMove={stageMove}
            onPointerUp={stageUp}
            onPointerCancel={stageUp}
          >
            <g className="mg-track-g" style={{ transform: `translate(${view.tx}px, ${view.ty}px) scale(${z})` }}>
              {tractor ? <BigTractor running={finished} /> : <FarmRoad />}

              {/* the track: a road under every piece, green where the steps are in */}
              {route.slice(0, -1).map((_, i) => (
                <path key={`r${i}`} d={piece(route, i)} className="mg-track-bed" />
              ))}
              {route.slice(0, -1).map((_, i) => (
                <path key={`d${i}`} d={piece(route, i)} className={`mg-track-line${i < done ? ' is-done' : i === done ? ' is-next' : ''}`} />
              ))}

              {/* start and finish */}
              <g transform={`translate(${route[0].x},${route[0].y})`} className="mg-track-start">
                <circle r={5} />
                <g transform={`scale(${1 / z})`}>
                  <text y={14} textAnchor="middle">
                    START
                  </text>
                </g>
              </g>
              <text x={pts[total - 1].x + 8} y={pts[total - 1].y - 9} fontSize={10} className="mg-track-flag" aria-hidden="true">
                🏁
              </text>

              {/* the checkpoints */}
              {pts.map((p, k) => {
                const state = k < done ? 'done' : k === done ? 'next' : 'locked';
                return (
                  <g
                    key={k}
                    data-cp={k}
                    transform={`translate(${p.x},${p.y})`}
                    className={`mg-cp is-${state}${hover === k ? (state === 'next' ? ' is-over' : ' is-nope') : ''}${clueAt === k && z >= ZCLUE ? ' is-focus' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Checkpoint ${k + 1}${p.hint ? `: ${p.hint}` : ''}${state === 'done' ? `, done: ${spec.steps[k]}` : state === 'next' ? ', next' : ', not open yet'}`}
                    onKeyDown={e => onCpKey(e, k)}
                  >
                    <circle r={13} className="mg-cp-hit" />
                    {state === 'next' && <circle r={10} className="mg-cp-glow" />}
                    <circle r={7} className="mg-cp-dot" />
                    <text y={2.6} textAnchor="middle" className="mg-cp-num">
                      {state === 'done' ? '✓' : k + 1}
                    </text>
                    {/* close up: the picture of the step that goes here (and, for the one in focus, its clue) */}
                    {(z >= ZCLUE || state === 'done' || (state === 'next' && z < ZCLUE)) && (
                      <g transform={`scale(${1 / z})`} className="mg-cp-clue">
                        {state === 'next' && z < ZCLUE ? (
                          <g transform="translate(0,-21)">
                            <rect x={-26} y={-8} width={52} height={14} rx={7} className="mg-cp-tag" />
                            <text y={2.4} textAnchor="middle" className="mg-cp-tagtext">
                              {k === 0 ? '▶ Start here' : '▶ Next'}
                            </text>
                          </g>
                        ) : (
                          <>
                            <g transform="translate(0,-24)">
                              <circle r={10} className="mg-cp-bubble" />
                              <text y={4} textAnchor="middle" fontSize={8.5}>
                                {icons[k]}
                              </text>
                            </g>
                            {clueAt === k && z >= ZCLUE && p.hint && (
                              <g transform="translate(0,22)">
                                <rect x={-(p.hint.length * 2.15 + 8)} y={-7.5} width={p.hint.length * 4.3 + 16} height={14} rx={7} className="mg-cp-tag is-clue" />
                                <text y={2.4} textAnchor="middle" className="mg-cp-tagtext">
                                  {p.hint}
                                </text>
                              </g>
                            )}
                          </>
                        )}
                      </g>
                    )}
                  </g>
                );
              })}

              {/* who walks (or drives) the track */}
              <g className={`mg-mover${shake !== null ? ' is-stall' : ''}`} style={{ transform: `translate(${mover.x}px, ${mover.y}px)` }} aria-hidden="true">
                <g transform={`scale(${1 / Math.sqrt(z)})`}>
                  {tractor ? (
                    <text y={-6} textAnchor="middle" fontSize={12.5}>
                      🧑‍🌾
                    </text>
                  ) : (
                    <MiniTractor />
                  )}
                </g>
              </g>
            </g>
          </svg>

          {pop && (
            <span className="mg-pop-at" style={{ left: `${((view.tx + pop.at.x * z) / W) * 100}%`, top: `${((view.ty + pop.at.y * z) / H) * 100}%` }}>
              <FloatUp key={pop.n} tone={pop.tone}>
                {pop.text}
              </FloatUp>
            </span>
          )}

          <div className="mg-zoom" role="group" aria-label="Zoom the track">
            <button type="button" onClick={() => zoomAt(z * 1.4)} disabled={z >= ZMAX} aria-label="Zoom in">
              +
            </button>
            <button type="button" onClick={() => zoomAt(z / 1.4)} disabled={z <= 1} aria-label="Zoom out">
              −
            </button>
            <button
              type="button"
              onClick={() => {
                setView(FULL);
                setFocus(null);
              }}
              disabled={z <= 1}
              aria-label="Show the whole track"
            >
              ⤢
            </button>
          </div>
          <p className="mg-stage-tip" aria-live="polite">
            {msg || (z < ZCLUE ? '🔍 Zoom in, or tap a checkpoint, to see its clue' : 'Drag to look round · tap a checkpoint for its clue')}
          </p>
        </div>
      </div>

      {drag && dragCard && (
        <div className={`mg-ghost${hover === done ? ' is-over' : hover !== null ? ' is-nope' : ''}`} style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          <span className="mg-card-icon">{dragCard.icon}</span>
          <span className="mg-card-text">{dragCard.t}</span>
        </div>
      )}
    </div>
  );
}

/* ---------------- the stages ---------------- */

/** Where the big tractor drawing sits on the stage. */
const TRACTOR_AT = { x: 20, y: -10 };

/** A big tractor, side on and facing right, in the yard: the safety check's checkpoints sit on its parts. */
function BigTractor({ running }: { running: boolean }) {
  return (
    <g className={`mg-bigtractor${running ? ' is-running' : ''}`}>
      <rect width={W} height={H} fill="#e2ede1" />
      <path d={`M0,116 Q70,92 150,108 T290,100 T${W},106 V${H} H0 Z`} fill="#a9cd94" />
      <rect y={160} width={W} height={H - 160} fill="#bd996c" />
      <ellipse cx={196} cy={167} rx={150} ry={6} fill="rgba(0,0,0,0.18)" />
      {/* the tractor itself is drawn 360 wide and moved into the middle of the stage */}
      <g transform={`translate(${TRACTOR_AT.x},${TRACTOR_AT.y})`}>
      {/* the hitch at the back */}
      <rect x={32} y={140} width={44} height={6} rx={2} fill="#767064" />
      <rect x={40} y={128} width={4} height={18} fill="#767064" />
      <circle cx={44} cy={143} r={3.5} fill="#bf5a46" />
      {/* the chassis and the wheels */}
      <rect x={140} y={112} width={140} height={24} fill="#306829" />
      <circle cx={116} cy={134} r={42} fill="#433c35" />
      <circle cx={116} cy={134} r={37} fill="none" stroke="#4b473f" strokeWidth={6} strokeDasharray="6 5" />
      <circle cx={116} cy={134} r={17} fill="#dfb843" />
      <circle cx={116} cy={134} r={6} fill="#a8882a" />
      <circle cx={262} cy={152} r={24} fill="#433c35" />
      <circle cx={262} cy={152} r={20} fill="none" stroke="#4b473f" strokeWidth={5} strokeDasharray="5 4" />
      <circle cx={262} cy={152} r={10} fill="#dfb843" />
      <circle cx={262} cy={152} r={4} fill="#a8882a" />
      {/* the bonnet: the dipstick, the radiator cap, the grille and a headlight */}
      <rect x={146} y={88} width={140} height={40} rx={8} fill="#3f8437" />
      <rect x={152} y={91} width={128} height={5} rx={2.5} fill="#5ca254" />
      <rect x={280} y={92} width={10} height={34} rx={3} fill="#2c5c26" />
      {[98, 104, 110, 116].map(y => (
        <rect key={y} x={282} y={y} width={6} height={2} fill="#3f8437" />
      ))}
      <circle cx={290} cy={98} r={4} fill="#f7edb8" stroke="#b99a37" strokeWidth={1.5} />
      <circle cx={214} cy={85} r={3} fill="none" stroke="#dfb843" strokeWidth={2} />
      <rect x={213} y={87} width={2} height={4} fill="#dfb843" />
      <rect x={262} y={82} width={10} height={6} rx={2} fill="#5c574e" />
      {/* the exhaust (it puffs once the engine is running) */}
      <rect x={236} y={50} width={7} height={40} fill="#5c574e" />
      <rect x={234} y={46} width={11} height={6} rx={1.5} fill="#49463f" />
      <g className="mg-smoke">
        <circle cx={240} cy={40} r={5} />
        <circle cx={246} cy={30} r={7} />
        <circle cx={254} cy={18} r={9} />
      </g>
      {/* the cab: glass, the seat and its belt, the levers, the steering wheel and the key */}
      <rect x={84} y={26} width={72} height={60} fill="#d0e1d0" opacity={0.6} />
      <rect x={92} y={54} width={10} height={32} rx={3} fill="#3f3c35" />
      <rect x={92} y={82} width={32} height={8} rx={3} fill="#3f3c35" />
      <line x1={97} y1={60} x2={120} y2={84} stroke="#d5783d" strokeWidth={2} />
      <line x1={128} y1={92} x2={126} y2={70} stroke="#37342f" strokeWidth={2.5} />
      <circle cx={126} cy={69} r={3} fill="#bf5a46" />
      <line x1={134} y1={92} x2={136} y2={74} stroke="#37342f" strokeWidth={2.5} />
      <circle cx={136} cy={73} r={3} fill="#dfb843" />
      <line x1={150} y1={90} x2={140} y2={62} stroke="#37342f" strokeWidth={4} />
      <ellipse cx={138} cy={60} rx={10} ry={3.2} transform="rotate(-28 138 60)" fill="none" stroke="#403832" strokeWidth={3} />
      <rect x={146} y={70} width={10} height={16} rx={2} fill="#433c35" />
      <circle cx={151} cy={77} r={2.4} fill="#dfb843" />
      <rect x={78} y={24} width={6} height={90} fill="#2c5c26" />
      <rect x={156} y={24} width={6} height={66} fill="#2c5c26" />
      <rect x={70} y={16} width={100} height={10} rx={4} fill="#3f8437" />
      {/* the mudguard over the big wheel, and the step */}
      <path d="M62,134 A54,54 0 0 1 170,134 L162,134 A46,46 0 0 0 70,134 Z" fill="#36752f" />
      <rect x={150} y={138} width={18} height={4} rx={1} fill="#5c574e" />
      </g>
    </g>
  );
}

/** The tractor that drives the farm road: drawn, side on and facing right, its wheels on the track. */
function MiniTractor() {
  return (
    <g transform="scale(1.35)" className="mg-minitractor">
      <ellipse cx={0} cy={0} rx={17} ry={2.5} fill="rgba(0,0,0,0.2)" />
      <rect x={-4} y={-19} width={20} height={10} rx={2.5} fill="#3f8437" />
      <rect x={11} y={-25} width={2.5} height={8} fill="#5c574e" />
      <rect x={-16} y={-31} width={13} height={3} rx={1.2} fill="#3f8437" />
      <rect x={-15} y={-29} width={2} height={18} fill="#2c5c26" />
      <rect x={-6} y={-29} width={2} height={14} fill="#2c5c26" />
      <rect x={-13} y={-28} width={7} height={11} fill="#d0e1d0" opacity={0.75} />
      <circle cx={-8} cy={-9} r={9} fill="#433c35" />
      <circle cx={-8} cy={-9} r={4} fill="#dfb843" />
      <circle cx={11} cy={-5} r={5} fill="#433c35" />
      <circle cx={11} cy={-5} r={2.2} fill="#dfb843" />
    </g>
  );
}

/** A farm field with a winding road across it: the big tractor drives it, a checkpoint for each step. */
function FarmRoad() {
  return (
    <g>
      <rect width={W} height={H} fill="#96c678" />
      {[0, 1, 2, 3, 4, 5, 6].map(i => (
        <rect key={i} x={0} y={i * 28 + 6} width={W} height={12} fill="#8bbd6d" />
      ))}
      {[
        [374, 30],
        [22, 160],
        [112, 166],
        [200, 20],
        [320, 166],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x},${y})`}>
          <rect x={-2} y={0} width={4} height={10} fill="#714b2d" />
          <circle r={11} fill="#4f8939" />
          <circle cx={-3} cy={-3} r={5} fill="#6aa851" />
        </g>
      ))}
    </g>
  );
}
