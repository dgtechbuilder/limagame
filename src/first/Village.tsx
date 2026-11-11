import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { FarmMap } from '../components/FarmMap';
import { FarmerFigure } from './art';
import type { Look } from './data';

/* The first session is played on the farmer's own farm: the map from Figma (the same painting as the
   farm screen). This layer only adds what moves or guides: the farmer, a dotted trail, the goal arrow,
   labels and the mist over the crops that open after the first check. The farmer walks along fixed routes
   traced over the painted path and grass, so a tap anywhere moves them to the nearest point ahead. */

type Pt = [number, number];

/** Beds on the painted map (stage coordinates), used for taps, arrows and labels. */
export const SPOTS = {
  /** front maize bed: the player's shamba */
  first: { poly: '405,250 510,194 557,222 455,272', cx: 482, cy: 232, label: [482, 166] as Pt },
  /** back maize bed: the retry shamba */
  lower: { poly: '328,222 440,176 470,192 360,246', cx: 400, cy: 210, label: [384, 146] as Pt },
  /** the two greens beds on the left: the farmer's sukuma wiki */
  sukuma: { poly: '172,275 300,226 432,290 305,346', cx: 300, cy: 280, label: [262, 216] as Pt },
  /** tomatoes on the right: checked in the field rounds */
  tomato: { poly: '512,276 600,230 740,282 640,334', cx: 626, cy: 280, label: [660, 222] as Pt },
};

/** In from the dirt path on the left, along it to the gate, then up the grass to the front maize bed. */
const MAIN: Pt[] = [
  [26, 292],
  [120, 322],
  [230, 352],
  [330, 378],
  [414, 388],
  [440, 350],
  [466, 312],
  [474, 290],
];
/** Round the right of the front bed, between it and the tomatoes, to the back bed. */
const TO_LOWER: Pt[] = [
  [474, 290],
  [506, 262],
  [546, 240],
  [574, 206],
  [520, 186],
  [474, 178],
];
/** Down to the path and along the front of the greens to the sukuma wiki. */
const TO_SUKUMA: Pt[] = [
  [474, 290],
  [452, 318],
  [420, 348],
  [330, 356],
  [236, 334],
  [196, 310],
];

export type Route = 'toFirst' | 'toLower' | 'toSukuma' | 'lowerToSukuma';

export function routePoints(route: Route): Pt[] {
  if (route === 'toFirst') return MAIN;
  if (route === 'toLower') return TO_LOWER;
  if (route === 'toSukuma') return TO_SUKUMA;
  return [...[...TO_LOWER].reverse(), ...TO_SUKUMA.slice(1)];
}

function measure(pts: Pt[]) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return cum;
}

function at(pts: Pt[], cum: number[], d: number): { p: Pt; dir: number } {
  for (let i = 1; i < pts.length; i++) {
    if (d <= cum[i] || i === pts.length - 1) {
      const seg = cum[i] - cum[i - 1] || 1;
      const t = Math.max(0, Math.min(1, (d - cum[i - 1]) / seg));
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      return { p: [ax + (bx - ax) * t, ay + (by - ay) * t], dir: bx >= ax ? 1 : -1 };
    }
  }
  return { p: pts[0], dir: 1 };
}

/** Distance along the route of the point nearest to (x, y). */
function project(pts: Pt[], cum: number[], x: number, y: number) {
  let best = { d: 0, dist: Infinity };
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2));
    const dist = Math.hypot(x - (ax + vx * t), y - (ay + vy * t));
    if (dist < best.dist) best = { d: cum[i - 1] + t * Math.sqrt(len2), dist };
  }
  return best;
}

const pathD = (pts: Pt[]) => 'M' + pts.map(p => p.join(',')).join(' L');

const SPEED = 156; // stage px per second: three times the old pace, so the first walk takes about 4 s

export function Village({
  look,
  name,
  route,
  target,
  open,
  opening,
  showTapHint,
  frozen = false,
  onFirstMove,
  onArrive,
}: {
  look: Look;
  name: string;
  /** null = no walk (backdrop for creating the farmer) */
  route: Route | null;
  /** bed the player is heading to (arrow + label) */
  target: keyof typeof SPOTS | null;
  /** the rest of the farm is open (no mist) */
  open: boolean;
  /** play the opening moment */
  opening?: boolean;
  showTapHint?: boolean;
  /** ignore taps (while the opening moment plays) */
  frozen?: boolean;
  onFirstMove?: () => void;
  onArrive?: () => void;
}) {
  const pts = useMemo(() => (route ? routePoints(route) : MAIN), [route]);
  const cum = useMemo(() => measure(pts), [pts]);
  const total = cum[cum.length - 1];
  const svgRef = useRef<SVGSVGElement>(null);
  const [d, setD] = useState(0);
  const [moving, setMoving] = useState(false);
  const target_ = useRef(0);
  const dRef = useRef(0);
  const dragging = useRef(false);
  const moved = useRef(false);
  const arrived = useRef(false);
  const [idleHint, setIdleHint] = useState(false);
  // the mist lifts on screen when the farm opens, instead of being gone on the first frame
  const [lifted, setLifted] = useState(open && !opening);
  useEffect(() => {
    if (!open) return setLifted(false);
    const id = window.setTimeout(() => setLifted(true), opening ? 350 : 0);
    return () => window.clearTimeout(id);
  }, [open, opening]);

  // new route: start at its beginning
  useEffect(() => {
    dRef.current = 0;
    target_.current = 0;
    arrived.current = false;
    moved.current = false;
    setD(0);
  }, [route]);

  // If the player has not moved for 6 s, show the tap hint again.
  useEffect(() => {
    if (!route || frozen || moving) return;
    setIdleHint(false);
    const id = window.setTimeout(() => setIdleHint(true), 6000);
    return () => window.clearTimeout(id);
  }, [route, frozen, moving, d]);

  const step = useRef<number | null>(null);
  const run = () => {
    if (step.current != null) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const diff = target_.current - dRef.current;
      if (Math.abs(diff) < 0.5) {
        step.current = null;
        setMoving(false);
        if (dRef.current >= total - 1 && !arrived.current) {
          arrived.current = true;
          window.setTimeout(() => onArrive?.(), 450);
        }
        return;
      }
      dRef.current += Math.sign(diff) * Math.min(Math.abs(diff), SPEED * dt);
      setD(dRef.current);
      step.current = requestAnimationFrame(tick);
    };
    setMoving(true);
    step.current = requestAnimationFrame(tick);
  };
  useEffect(
    () => () => {
      if (step.current != null) cancelAnimationFrame(step.current);
    },
    [],
  );

  const toStage = (e: RPointerEvent) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : pt;
  };

  const goTo = (e: RPointerEvent, toEnd = false) => {
    if (!route || frozen || arrived.current) return;
    const { x, y } = toStage(e);
    const t = toEnd ? total : project(pts, cum, x, y).d;
    target_.current = Math.max(target_.current, t); // never walk backwards: the goal is ahead
    if (!moved.current && target_.current > 2) {
      moved.current = true;
      onFirstMove?.();
    }
    run();
  };

  const { p, dir } = at(pts, cum, d);
  const hintAt = at(pts, cum, Math.min(total, d + 90)).p;
  const goal = target ? SPOTS[target] : null;

  // Open ground before the farm opens: the walk to the maize beds and the beds themselves.
  // Feathered edges come from stacked strokes, lightest and widest first (cheap on low-end phones;
  // no blur filter). Each level is drawn for every route before the next, so overlaps never re-add mist.
  const clear = (
    <>
      <ellipse cx={440} cy={224} rx={182} ry={96} fill="url(#hole)" />
      {[
        [56, '#c8c8c8'],
        [36, '#8a8a8a'],
        [18, '#444'],
        [0, '#000'],
      ].map(([extra, c]) =>
        [
          [MAIN, 48],
          [TO_LOWER, 44],
        ].map(([r, core]) => (
          <path key={`${extra}-${core}`} d={pathD(r as Pt[])} stroke={c as string} strokeWidth={(core as number) + (extra as number)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        )),
      )}
      <ellipse cx={440} cy={224} rx={140} ry={70} fill="#000" />
    </>
  );

  return (
    <div className="abs" style={{ inset: 0 }}>
      <FarmMap />
      <svg
        ref={svgRef}
        className="village"
        viewBox="0 0 874 402"
        width={874}
        height={402}
        onPointerDown={e => {
          dragging.current = true;
          goTo(e);
        }}
        onPointerMove={e => dragging.current && goTo(e)}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
        role="application"
        aria-label={route ? `Farm map. Tap the path to walk ${name} to the shamba.` : 'Farm map'}
      >
        <defs>
          <radialGradient id="hole">
            <stop offset="0.5" stopColor="#000" />
            <stop offset="1" stopColor="#fff" />
          </radialGradient>
          <mask id="mist-mask" maskUnits="userSpaceOnUse" x={0} y={0} width={874} height={402}>
            <rect width={874} height={402} fill="#fff" />
            {clear}
          </mask>
        </defs>

        {/* the rest of the farm under mist until it opens */}
        <g className={`mist ${lifted ? 'is-gone' : ''}`} pointerEvents="none">
          <rect width={874} height={402} fill="#eef3ea" opacity={0.78} mask="url(#mist-mask)" />
          {[
            [110, 90, 90],
            [250, 300, 80],
            [640, 300, 90],
            [720, 120, 90],
            [560, 70, 70],
          ].map(([cx, cy, r]) => (
            <ellipse key={cx} cx={cx} cy={cy} rx={r} ry={r * 0.42} fill="#fff" opacity={0.45} />
          ))}
          {[
            [262, 282],
            [626, 284],
            [640, 120],
          ].map(([x, y]) => (
            <g key={x} transform={`translate(${x},${y})`}>
              <rect x={-13} y={-8} width={26} height={19} rx={4} fill="#8a6a40" />
              <path d="M-7,-8 v-5 a7,7 0 0 1 14,0 v5" fill="none" stroke="#8a6a40" strokeWidth={3.5} />
            </g>
          ))}
        </g>

        {/* dotted trail for the current walk */}
        {route && <path d={pathD(pts)} fill="none" stroke="#fff6cf" strokeWidth={4} strokeDasharray="2 10" strokeLinecap="round" opacity={0.95} />}

        {/* labels */}
        <MapLabel x={SPOTS.first.label[0]} y={SPOTS.first.label[1]} text={name ? `${name}'s maize` : 'Your maize'} strong={target === 'first'} />
        {(target === 'lower' || route === 'toLower') && <MapLabel x={SPOTS.lower.label[0]} y={SPOTS.lower.label[1]} text="Back maize" strong />}
        {lifted && (
          <g className="label-pop">
            <MapLabel x={SPOTS.sukuma.label[0]} y={SPOTS.sukuma.label[1]} text="Your sukuma wiki" strong={target === 'sukuma'} />
            <MapLabel x={SPOTS.tomato.label[0]} y={SPOTS.tomato.label[1]} text="Your tomatoes" />
          </g>
        )}

        {goal && (
          <g className="goal-arrow" transform={`translate(${goal.cx},${goal.cy - 4})`} pointerEvents="none">
            <path d="M-10,-26 L10,-26 L10,-12 L18,-12 L0,4 L-18,-12 L-10,-12 Z" fill="#ffae00" stroke="#7a4a10" strokeWidth={2} />
          </g>
        )}

        {/* tap the bed itself to walk all the way */}
        {route && goal && !frozen && (
          <polygon
            points={goal.poly}
            fill="transparent"
            className="goal-hit"
            onPointerDown={e => {
              e.stopPropagation();
              goTo(e, true);
            }}
          />
        )}

        {route && (showTapHint || idleHint) && !moving && d < total - 1 && (
          <g transform={`translate(${hintAt[0]},${hintAt[1]})`} pointerEvents="none">
            <circle className="tap-ring" r={16} fill="none" stroke="#fff" strokeWidth={3} />
            <circle r={6} fill="#fff" opacity={0.9} />
          </g>
        )}

        {route && (
          <g transform={`translate(${p[0]},${p[1]}) scale(0.6)`} pointerEvents="none">
            <FarmerFigure look={look} pose={moving ? 'walk' : 'stand'} facing={dir as 1 | -1} />
          </g>
        )}
        {route === 'toFirst' && d === 0 && <MapLabel x={p[0] + 30} y={p[1] - 56} text={name} strong />}
      </svg>
    </div>
  );
}

function MapLabel({ x, y, text, strong }: { x: number; y: number; text: string; strong?: boolean }) {
  const w = text.length * 5.6 + 18;
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      <rect x={-w / 2} y={-11} width={w} height={18} rx={9} fill={strong ? '#ffae00' : 'rgba(40,24,12,0.75)'} stroke={strong ? '#7a4a10' : 'none'} />
      <text y={2} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff" fontFamily="Poppins, sans-serif">
        {text}
      </text>
    </g>
  );
}
