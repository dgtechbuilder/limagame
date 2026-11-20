import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { FarmMap } from '../components/FarmMap';
import { FarmerFigure } from './art';
import type { Look } from './data';

/* The first session is played on the farmer's own farm: a picture of the 3D farm itself, taken from above
   (public/assets/bg-world.webp: FarmWorld.setOverview, the farm as it stands on the first day). This layer only adds
   what moves or guides: the farmer, a dotted trail, the goal arrow, labels and the mist over the crops that open
   after the first check. The farmer walks along fixed routes traced over the picture's paths, so a tap anywhere moves
   them to the nearest point ahead. Every point below is a point of the 3D farm projected onto the picture. */

type Pt = [number, number];

/** Beds on the picture (stage coordinates), used for taps, arrows and labels. */
export const SPOTS = {
  /** the front of Farm 1, the maize: the player's shamba */
  first: { poly: '307,170 312,137 376,137 373,170', cx: 342, cy: 153, label: [342, 96] as Pt },
  /** the back of Farm 1: the retry shamba */
  lower: { poly: '312,137 317,107 378,107 376,137', cx: 346, cy: 122, label: [262, 118] as Pt },
  /** Farm 2: the farmer's sukuma wiki */
  sukuma: { poly: '418,170 419,107 481,107 484,170', cx: 450, cy: 137, label: [450, 96] as Pt },
  /** the tomatoes at the bottom right of the first day's picture (taken before the storehouse stood there): checked in the field rounds */
  tomato: { poly: '545,400 538,348 619,348 631,400', cx: 582, cy: 372, label: [582, 334] as Pt },
};

/** Out of the shed lane on the left, along the dirt to the front of Farm 1's maize. */
const MAIN: Pt[] = [
  [212, 190],
  [238, 189],
  [272, 189],
  [306, 191],
  [330, 182],
  [339, 174],
];
/** Round the right of Farm 1, up the lane between Farms 1 and 2, to the back of the maize. */
const TO_LOWER: Pt[] = [
  [339, 174],
  [372, 182],
  [395, 170],
  [397, 133],
  [396, 101],
  [374, 99],
  [348, 102],
];
/** Along the front of the farms to the sukuma wiki on Farm 2. */
const TO_SUKUMA: Pt[] = [
  [339, 174],
  [372, 184],
  [400, 189],
  [429, 182],
  [451, 174],
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

const SPEED = 60; // stage px per second over the picture of the whole farm: the first walk takes about 3 s

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
  const hintAt = at(pts, cum, Math.min(total, d + 50)).p;
  const goal = target ? SPOTS[target] : null;

  // Open ground before the farm opens: the walk to the maize beds and the beds themselves.
  // Feathered edges come from stacked strokes, lightest and widest first (cheap on low-end phones;
  // no blur filter). Each level is drawn for every route before the next, so overlaps never re-add mist.
  const clear = (
    <>
      <ellipse cx={344} cy={146} rx={150} ry={86} fill="url(#hole)" />
      {[
        [56, '#c8c8c8'],
        [36, '#8a8a8a'],
        [18, '#444'],
        [0, '#000'],
      ].map(([extra, c]) =>
        [
          [MAIN, 30],
          [TO_LOWER, 28],
        ].map(([r, core]) => (
          <path key={`${extra}-${core}`} d={pathD(r as Pt[])} stroke={c as string} strokeWidth={(core as number) + (extra as number)} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        )),
      )}
      <ellipse cx={344} cy={140} rx={62} ry={44} fill="#000" />
    </>
  );

  return (
    <div className="abs" style={{ inset: 0 }}>
      <FarmMap world alt="Your farm, from above: the farmhouse, the six farms, the pond, the mini forest, the greenhouse and the storehouse" />
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
            [520, 140, 90],
            [460, 260, 90],
            [600, 360, 90],
            [740, 300, 90],
            [680, 80, 80],
            [160, 330, 80],
          ].map(([cx, cy, r]) => (
            <ellipse key={cx} cx={cx} cy={cy} rx={r} ry={r * 0.42} fill="#fff" opacity={0.45} />
          ))}
          {[
            [450, 140],
            [582, 372],
            [557, 140],
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
          <g transform={`translate(${p[0]},${p[1]}) scale(0.34)`} pointerEvents="none">
            <FarmerFigure look={look} pose={moving ? 'walk' : 'stand'} facing={dir as 1 | -1} />
          </g>
        )}
        {route === 'toFirst' && d === 0 && <MapLabel x={p[0] + 4} y={p[1] - 42} text={name} strong />}
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
