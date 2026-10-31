import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { FarmerFigure, Hut, MapShamba, Tree } from './art';
import type { Look } from './data';

/* The village on the 874 × 402 stage. The farmer walks along fixed paths (no pathfinding),
   so a tap anywhere moves them to the nearest point of the path that is open now. */

type Pt = [number, number];

export const SPOTS = {
  first: { x: 600, y: 150, w: 170, h: 70 },
  lower: { x: 652, y: 262, w: 160, h: 64 },
  achieng: { x: 226, y: 112, w: 136, h: 60 },
  baraka: { x: 416, y: 64, w: 118, h: 52 },
  kiprono: { x: 24, y: 52, w: 150, h: 66 },
};

const MAIN: Pt[] = [
  [140, 346],
  [250, 322],
  [350, 284],
  [452, 254],
  [560, 236],
  [612, 228],
];
const TO_LOWER: Pt[] = [
  [612, 228],
  [630, 262],
  [640, 300],
  [646, 338],
];
const TO_ACHIENG: Pt[] = [
  [612, 228],
  [540, 208],
  [462, 194],
  [392, 184],
  [352, 182],
];

export type Route = 'toFirst' | 'toLower' | 'toAchieng' | 'lowerToAchieng';

export function routePoints(route: Route): Pt[] {
  if (route === 'toFirst') return MAIN;
  if (route === 'toLower') return TO_LOWER;
  if (route === 'toAchieng') return TO_ACHIENG;
  return [...[...TO_LOWER].reverse(), ...TO_ACHIENG.slice(1)];
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

/** Distance along the path of the point nearest to (x, y). */
function project(pts: Pt[], cum: number[], x: number, y: number) {
  let best = { d: 0, dist: Infinity };
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1];
    const [bx, by] = pts[i];
    const vx = bx - ax;
    const vy = by - ay;
    const len2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / len2));
    const px = ax + vx * t;
    const py = ay + vy * t;
    const dist = Math.hypot(x - px, y - py);
    if (dist < best.dist) best = { d: cum[i - 1] + t * Math.sqrt(len2), dist };
  }
  return best;
}

const pathD = (pts: Pt[]) => 'M' + pts.map(p => p.join(',')).join(' L');

const SPEED = 52; // stage px per second: the first walk takes about 9 s

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
  /** null = the farmer stands at the start of the first walk (creation backdrop) */
  route: Route | null;
  /** shamba the player is heading to (arrow + label) */
  target: keyof typeof SPOTS | null;
  /** neighbours visible */
  open: boolean;
  /** play the opening animation */
  opening?: boolean;
  showTapHint?: boolean;
  /** ignore taps (while the village-opening moment plays) */
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
  // the mist lifts on screen when the village opens, instead of being gone on the first frame
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
  }, [route, moving, d]);

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
  useEffect(() => () => {
    if (step.current != null) cancelAnimationFrame(step.current);
  }, []);

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
  const firstWalk = route === 'toFirst';

  return (
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
      aria-label={route ? `Village map. Tap the path to walk ${name} to the shamba.` : 'Village map'}
    >
      <defs>
        <radialGradient id="grass" cx="50%" cy="60%" r="75%">
          <stop offset="0" stopColor="#7cb84a" />
          <stop offset="1" stopColor="#4f8f2e" />
        </radialGradient>
      </defs>
      <rect width={874} height={402} fill="url(#grass)" />

      {/* every path in the village; only the active one is bright */}
      {[MAIN, TO_LOWER, TO_ACHIENG].map((ps, i) => {
        const hidden = i === 2 && !lifted;
        return (
          <g key={i} opacity={hidden ? 0 : 1} className="fade-slow">
            <path d={pathD(ps)} fill="none" stroke="#a9824f" strokeWidth={26} strokeLinecap="round" strokeLinejoin="round" />
            <path d={pathD(ps)} fill="none" stroke="#d9b47c" strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        );
      })}
      {route && <path d={pathD(pts)} fill="none" stroke="#ffe39a" strokeWidth={4} strokeDasharray="2 10" strokeLinecap="round" opacity={0.9} />}

      {/* decoration */}
      <Tree x={60} y={392} s={1.1} />
      <Tree x={548} y={392} s={0.9} kind="banana" />
      <Tree x={840} y={130} s={1} />
      <Tree x={808} y={392} s={0.8} kind="bush" />
      <Tree x={500} y={318} kind="bush" />
      <Tree x={292} y={392} kind="banana" />
      <Hut x={92} y={330} s={1.05} />
      <Hut x={746} y={118} s={0.8} />

      <MapShamba {...SPOTS.first} crop="maize" />
      <MapShamba {...SPOTS.lower} crop="maize" />

      {/* neighbours, under mist until the village opens */}
      <g className={opening ? 'village-open' : undefined} style={{ opacity: open && !lifted ? 0 : 1, transition: 'opacity 1.4s ease' }}>
        <Hut x={200} y={96} s={0.75} />
        <Hut x={392} y={58} s={0.7} />
        <Hut x={182} y={196} s={0.7} />
        <Tree x={560} y={110} s={0.8} />
        <MapShamba {...SPOTS.kiprono} crop="tea" />
        <MapShamba {...SPOTS.achieng} crop="beans" />
        <MapShamba {...SPOTS.baraka} crop="kale" />
      </g>
      <g className={`mist ${lifted ? 'is-gone' : ''}`} pointerEvents="none">
        <path d="M0,0 L600,0 Q620,70 560,128 Q470,200 300,214 Q150,226 0,262 Z" fill="#eef3ea" opacity={0.86} />
        {[
          [120, 80, 70],
          [300, 120, 80],
          [470, 60, 70],
          [220, 190, 60],
        ].map(([cx, cy, r]) => (
          <ellipse key={cx} cx={cx} cy={cy} rx={r} ry={r * 0.45} fill="#fff" opacity={0.5} />
        ))}
        <g transform="translate(300,150)">
          <rect x={-15} y={-10} width={30} height={22} rx={4} fill="#8a6a40" />
          <path d="M-8,-10 v-6 a8,8 0 0 1 16,0 v6" fill="none" stroke="#8a6a40" strokeWidth={4} />
        </g>
      </g>

      {/* labels */}
      <MapLabel x={685} y={140} text={`${name}'s shamba`} strong={target === 'first'} />
      {(target === 'lower' || route === 'toLower') && <MapLabel x={732} y={256} text="Lower shamba" strong />}
      {open && (
        <g className={opening ? 'label-pop' : undefined}>
          <MapLabel x={294} y={104} text="Mama Achieng · beans" strong={target === 'achieng'} />
          <MapLabel x={475} y={128} text="Baraka · tomorrow" />
          <MapLabel x={99} y={132} text="Mzee Kiprono · tomorrow" />
        </g>
      )}

      {goal && (
        <g className="goal-arrow" transform={`translate(${goal.x + goal.w / 2},${goal.y + goal.h / 2 - 6})`}>
          <path d="M-10,-26 L10,-26 L10,-12 L18,-12 L0,4 L-18,-12 L-10,-12 Z" fill="#ffae00" stroke="#7a4a10" strokeWidth={2} />
        </g>
      )}

      {/* tap the shamba itself to walk all the way */}
      {route && goal && !frozen && (
        <rect
          x={goal.x}
          y={goal.y}
          width={goal.w}
          height={goal.h}
          fill="transparent"
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

      <g transform={`translate(${p[0]},${p[1]}) scale(0.62)`} pointerEvents="none">
        <FarmerFigure look={look} pose={moving ? 'walk' : 'stand'} facing={dir as 1 | -1} />
      </g>
      {firstWalk && d === 0 && <MapLabel x={p[0]} y={p[1] - 62} text={name} strong />}
    </svg>
  );
}

function MapLabel({ x, y, text, strong }: { x: number; y: number; text: string; strong?: boolean }) {
  const w = text.length * 5.6 + 18;
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      <rect x={-w / 2} y={-11} width={w} height={18} rx={9} fill={strong ? '#ffae00' : 'rgba(40,24,12,0.72)'} stroke={strong ? '#7a4a10' : 'none'} />
      <text y={2} textAnchor="middle" fontSize={10} fontWeight={700} fill="#fff" fontFamily="Poppins, sans-serif">
        {text}
      </text>
    </g>
  );
}
