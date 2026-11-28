import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { HubSection } from './hub';
import { Bush, Cottage, Countryside, Fence, Meadow, SB, Scribble, Tree, Tuft } from '../art/storybook';

/* The tractor yard: a small walkable place, seen from above, with a station for each of the tractor screen's sections
   (the practice course, the classroom, the safety board, the oil bay, the workbench, the diesel pump, the ox pen and
   the tractor at the gate). The farmer walks where the player taps (or with the arrow keys / WASD); tapping a station
   walks there and opens it, and standing on a station's pad shows a Play button. Each station shows its best stars
   and a red badge when it needs the farmer. Pure screen: what each station does is in TractorHub.tsx. */

export type Station = Exclude<HubSection, 'yard'>;

export interface StationInfo {
  id: Station;
  label: string;
  icon: string;
  /** best score so far, 0 to 1 (no stars before the first go) */
  best?: number;
  /** why the station needs the farmer now, if it does (a red badge) */
  due?: string;
  /** why it cannot be used now (greyed) */
  off?: string;
}

const W = 660;
const H = 334;
const SPEED = 150; // px a second
const NEAR = 30;

/** Where each station's pad is (the farmer stands here to use it). */
export const PADS: Record<Station, { x: number; y: number }> = {
  train: { x: 100, y: 136 },
  learn: { x: 250, y: 128 },
  safety: { x: 400, y: 128 },
  service: { x: 552, y: 136 },
  hire: { x: 96, y: 262 },
  drive: { x: 258, y: 268 },
  refuel: { x: 412, y: 268 },
  repair: { x: 566, y: 262 },
};

/** Where the farmer stands when the yard opens again (kept while the game runs). */
let last = { x: 300, y: 206 };

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (p: { x: number; y: number }) => ({ x: Math.max(24, Math.min(W - 24, p.x)), y: Math.max(70, Math.min(H - 18, p.y)) });

export function TractorYard({ stations, onOpen, look, name, top, corner }: { stations: StationInfo[]; onOpen: (id: Station) => void; look?: { skin?: string; shirt?: string }; name: string; top?: ReactNode; corner?: ReactNode }) {
  const [pos, setPos] = useState(last);
  const [goal, setGoal] = useState<{ x: number; y: number; open?: Station } | null>(null);
  const [face, setFace] = useState(1);
  const [walking, setWalking] = useState(false);
  const [tap, setTap] = useState<{ x: number; y: number; k: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const keys = useRef(new Set<string>());
  const posRef = useRef(pos);
  posRef.current = pos;
  const goalRef = useRef(goal);
  goalRef.current = goal;
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  const near = stations.find(s => dist(pos, PADS[s.id]) < NEAR) ?? null;

  // the walk: towards the goal, or by the keys held
  useEffect(() => {
    let raf = 0;
    let t0 = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - t0) / 1000);
      t0 = now;
      const p = posRef.current;
      let dx = 0;
      let dy = 0;
      const k = keys.current;
      if (k.size) {
        dx = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
        dy = (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0);
        if (dx || dy) setGoal(null);
      }
      const g = goalRef.current;
      if (!dx && !dy && g) {
        const d = dist(p, g);
        if (d < 3) {
          setGoal(null);
          setWalking(false);
          if (g.open) {
            const id = g.open;
            window.setTimeout(() => openRef.current(id), 180);
          }
        } else {
          dx = (g.x - p.x) / d;
          dy = (g.y - p.y) / d;
        }
      }
      if (dx || dy) {
        const n = Math.hypot(dx, dy) || 1;
        const step = Math.min(SPEED * dt, g && !k.size ? dist(p, g) : Infinity);
        const next = clamp({ x: p.x + (dx / n) * step, y: p.y + (dy / n) * step });
        last = next;
        setPos(next);
        setWalking(true);
        if (Math.abs(dx) > 0.15) setFace(dx > 0 ? 1 : -1);
      } else if (!g) setWalking(false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // the keyboard: arrows / WASD walk, Enter or Space plays the station underfoot
  useEffect(() => {
    const map: Record<string, string> = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right', ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down' };
    const down = (e: KeyboardEvent) => {
      if (document.querySelector('.mg')) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (map[e.key]) {
        e.preventDefault();
        keys.current.add(map[e.key]);
      }
    };
    const up = (e: KeyboardEvent) => map[e.key] && keys.current.delete(map[e.key]);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const toSvg = (cx: number, cy: number) => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const pt = el.createSVGPoint();
    pt.x = cx;
    pt.y = cy;
    const p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const walkTo = (x: number, y: number, open?: Station) => {
    const p = clamp({ x, y });
    setGoal({ ...p, open });
    setTap(t => ({ ...p, k: (t?.k ?? 0) + 1 }));
  };

  const goStation = (id: Station) => {
    const p = PADS[id];
    if (dist(posRef.current, p) < NEAR) return onOpen(id);
    walkTo(p.x, p.y, id);
  };

  return (
    <div className="ty-yard">
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        className="ty-svg"
        role="group"
        aria-label="The tractor yard: tap the ground to walk, tap a station to go there"
        onPointerDown={e => {
          if ((e.target as Element).closest('[data-station],[data-play]')) return;
          const p = toSvg(e.clientX, e.clientY);
          if (p) walkTo(p.x, p.y);
        }}
      >
        <Ground />
        {stations.map(st => (
          <StationArt key={st.id} st={st} near={near?.id === st.id} onGo={() => goStation(st.id)} />
        ))}
        {tap && goal && (
          <g key={tap.k} transform={`translate(${tap.x},${tap.y})`} className="ty-tapmark" aria-hidden="true">
            <ellipse rx={12} ry={6} />
          </g>
        )}
        <Mechanic />
        <Farmer x={pos.x} y={pos.y} face={face} walking={walking} look={look} name={name} />
        {near && !goal && (
          <g transform={`translate(${PADS[near.id].x},${PADS[near.id].y - 66})`}>
            <g
              data-play
              data-pad-primary
              className={`ty-play${near.off ? ' is-off' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`Play ${near.label}`}
              onClick={() => onOpen(near.id)}
              onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(near.id))}
            >
              <rect x={-40} y={-13} width={80} height={24} rx={12} />
              <text y={4} textAnchor="middle">
                ▶ {near.id === 'drive' ? 'Drive' : near.id === 'hire' ? 'Hire' : 'Play'}
              </text>
            </g>
          </g>
        )}
      </svg>
      {top && <div className="ty-top">{top}</div>}
      {corner && <div className="ty-corner">{corner}</div>}
      <p className="ty-hint" aria-hidden="true">
        {near ? `${near.icon} ${near.label}${near.off ? `: ${near.off}` : near.due ? `: ${near.due}` : ''} · tap ▶ or press Enter` : 'Tap the ground to walk · tap a station to go there · arrow keys work too'}
      </p>
    </div>
  );
}

/* ---------------- the drawing ---------------- */

function Ground() {
  return (
    <g aria-hidden="true">
      {/* the countryside behind the yard: sage sky, cream clouds, rolling hills and a line of trees */}
      <Countryside w={W} y={52} seed={3} clouds={4} />
      {[22, 96, 196, 300, 372, 452, 640].map((x, i) => (
        <Tree key={x} x={x} y={56 + (i % 2) * 3} r={11 + (i % 3) * 2} tone={(i % 3) as 0 | 1 | 2} shadow={false} />
      ))}
      <rect y={60} width={W} height={H - 60} fill={SB.grass} />
      {[
        [20, 150, 26],
        [640, 230, 22],
        [330, 330, 60],
        [80, 330, 40],
      ].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.35} fill={SB.grassLight} opacity={0.55} />
      ))}
      <Meadow x={4} y={70} w={W - 8} h={H - 74} n={160} seed={7} flowers={0.45} avoid={(x, y) => x > 36 && x < 624 && y > 82 && y < 312} />
      <Fence x0={-6} x1={W + 6} y={70} gap={29} h={22} />
      {/* the yard: packed earth with a soft edge, a loop of track round the middle */}
      <rect x={30} y={81} width={600} height={240} rx={42} fill={SB.earthDark} />
      <rect x={30} y={78} width={600} height={238} rx={40} fill={SB.earth} />
      {[
        [120, 200, 50],
        [560, 210, 46],
        [330, 110, 70],
      ].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r} ry={r * 0.4} fill={SB.path} opacity={0.6} />
      ))}
      <rect x={160} y={172} width={340} height={70} rx={35} fill={SB.earthDark} />
      <rect x={184} y={186} width={292} height={42} rx={21} fill={SB.earth} />
      <rect x={172} y={179} width={316} height={56} rx={28} fill="none" stroke={SB.path} strokeWidth={1.2} strokeDasharray="5 6" opacity={0.8} />
      {Array.from({ length: 22 }, (_, i) => {
        const x = 52 + ((i * 131) % 556);
        const y = 96 + ((i * 53) % 206);
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx={1.8 + (i % 3)} ry={1.2 + (i % 3) * 0.6} fill={i % 4 ? SB.earthDark : SB.stone} />
            {i % 4 === 0 && <ellipse cx={x - 0.6} cy={y - 0.5} rx={1} ry={0.5} fill={SB.white} opacity={0.6} />}
          </g>
        );
      })}
      {[
        [44, 120],
        [40, 250],
        [616, 150],
        [620, 286],
        [330, 312],
        [150, 300],
      ].map(([x, y], i) => (
        <Tuft key={i} x={x} y={y} s={0.9} />
      ))}
      {/* the sign over the yard, on two posts */}
      <g transform="translate(552,24)">
        <rect x={-58} y={-4} width={5} height={30} fill={SB.woodDark} />
        <rect x={53} y={-4} width={5} height={30} fill={SB.woodDark} />
        <rect x={-74} y={-14} width={148} height={26} rx={6} fill={SB.woodDark} />
        <rect x={-70} y={-11} width={140} height={19} rx={4} fill={SB.wall} />
        <Scribble x={-64} y={-1} w={10} color={SB.wallShade} opacity={1} />
        <Scribble x={52} y={-1} w={10} color={SB.wallShade} opacity={1} />
        <text y={3.5} textAnchor="middle" fontSize={8.5} fontWeight={800} fill={SB.ink} letterSpacing={0.6}>
          TRACTOR YARD
        </text>
      </g>
    </g>
  );
}

/** An ox standing side-on (facing left; scale(-1,1) to face right). */
function Ox({ x, y, s = 1, face = 1 }: { x: number; y: number; s?: number; face?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s * face},${s})`}>
      <ellipse cy={1} rx={13} ry={2.5} fill={SB.shadow} />
      {[-8, -4, 5, 9].map(lx => (
        <rect key={lx} x={lx - 1.3} y={-8} width={2.6} height={9} rx={1} fill="#6e4330" />
      ))}
      <path d="M-11 -9 Q-12 -18 -3 -18 L8 -18 Q13 -18 12 -10 Q11 -6 6 -6 L-7 -6 Q-11 -6 -11 -9 Z" fill="#9a6142" />
      <path d="M-4 -18 Q2 -22 6 -18 Z" fill="#9a6142" />
      <ellipse cx={1} cy={-11} rx={6} ry={3} fill="#b47a55" opacity={0.7} />
      <path d="M12 -12 q4 2 3 8" stroke="#6e4330" strokeWidth={1.2} fill="none" strokeLinecap="round" />
      <g transform="translate(-13,-15)">
        <path d="M-1 -3 Q-7 -2 -7 3 Q-6 6 -3 6 Q1 5 2 1 Z" fill="#8a5634" />
        <ellipse cx={-6} cy={4} rx={2.3} ry={1.8} fill="#c9a08a" />
        <path d="M-1 -3 q-3 -4 1 -6 M1 -2 q4 -3 6 -1" stroke={SB.white} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        <circle cx={-3} cy={0} r={0.7} fill="#2a1a10" />
      </g>
    </g>
  );
}

/** The art behind each station's pad. */
function Prop({ id }: { id: Station }) {
  switch (id) {
    case 'train':
      return (
        <g>
          {/* a practice field: ploughed furrows, a guide row up the middle, rocks and trees in the way */}
          <rect x={-58} y={-56} width={116} height={40} rx={8} fill={SB.earthDark} />
          <rect x={-58} y={-58} width={116} height={40} rx={8} fill={SB.soil} />
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M-52 ${-52 + i * 6.4} Q0 ${-54 + i * 6.4} 52 ${-52 + i * 6.4}`} stroke={SB.soilDark} strokeWidth={1.4} fill="none" opacity={0.7} />
          ))}
          <rect x={-10} y={-58} width={20} height={40} fill={SB.soilDark} />
          <line x1={-12} x2={-12} y1={-56} y2={-20} stroke={SB.white} strokeWidth={1.2} strokeDasharray="4 3" opacity={0.85} />
          <line x1={12} x2={12} y1={-56} y2={-20} stroke={SB.white} strokeWidth={1.2} strokeDasharray="4 3" opacity={0.85} />
          <ellipse cx={22} cy={-45} rx={6} ry={4.5} fill={SB.stoneDark} />
          <ellipse cx={21} cy={-46.5} rx={4.5} ry={3} fill={SB.stone} />
          <ellipse cx={-26} cy={-29} rx={5} ry={4} fill={SB.stoneDark} />
          <ellipse cx={-27} cy={-30.3} rx={3.6} ry={2.6} fill={SB.stone} />
          <Tree x={-44} y={-36} r={10} />
          <Bush x={46} y={-20} r={7} />
        </g>
      );
    case 'learn':
      return (
        <g transform="translate(0,-20)">
          <Cottage w={74} h={34}>
            <rect x={-28} y={-29} width={46} height={22} rx={2} fill={SB.woodDark} />
            <rect x={-26} y={-27} width={42} height={18} rx={1.5} fill="#335443" />
            <text x={-5} y={-15} textAnchor="middle" fontSize={6.5} fill={SB.white} fontFamily="monospace">
              A B C ✓
            </text>
            <rect x={22} y={-20} width={10} height={20} rx={1} fill={SB.woodDark} />
            <circle cx={30} cy={-10} r={0.9} fill={SB.meadow} />
          </Cottage>
        </g>
      );
    case 'safety':
      return (
        <g>
          <ellipse cy={-16} rx={20} ry={3} fill={SB.shadow} />
          <rect x={-22} y={-44} width={5} height={28} fill={SB.woodDark} />
          <rect x={17} y={-44} width={5} height={28} fill={SB.woodDark} />
          <rect x={-36} y={-80} width={72} height={44} rx={6} fill={SB.woodDark} />
          <rect x={-33} y={-77} width={66} height={38} rx={4} fill="#f3d35a" />
          {/* a hard hat and a hi-vis vest */}
          <g transform="translate(-12,-58)">
            <path d="M-9 2 Q-9 -9 0 -9 Q9 -9 9 2 Z" fill="#e8963a" />
            <rect x={-11} y={1} width={22} height={3} rx={1.5} fill="#d07a28" />
            <path d="M-3 -8 Q0 -10 3 -8 L2 1 L-2 1 Z" fill="#f2b35a" />
          </g>
          <g transform="translate(13,-58)">
            <path d="M-8 -9 L-3 -9 L0 -4 L3 -9 L8 -9 L8 5 L-8 5 Z" fill="#e8774f" />
            <rect x={-8} y={-1} width={16} height={2} fill={SB.white} />
          </g>
          <text y={-43} textAnchor="middle" fontSize={6.8} fontWeight={800} fill={SB.ink} letterSpacing={0.3}>
            SAFETY FIRST
          </text>
        </g>
      );
    case 'service':
      return (
        <g>
          <ellipse cy={-19} rx={60} ry={4} fill={SB.shadow} />
          <rect x={-52} y={-70} width={104} height={50} fill={SB.shed} />
          <rect x={34} y={-70} width={18} height={50} fill={SB.shedDark} />
          <path d="M-60 -68 L0 -90 L60 -68 Z" fill={SB.roofDark} />
          <path d="M-60 -68 L60 -68" stroke="#8a3a2c" strokeWidth={2.4} />
          <rect x={-38} y={-60} width={70} height={40} fill="#3b4a3c" />
          {/* the open doors, with their white braces */}
          {[-50, 32].map(dx => (
            <g key={dx} transform={`translate(${dx},-60)`}>
              <rect width={12} height={40} fill={SB.shedDark} />
              <path d="M1 1 L11 39 M11 1 L1 39" stroke={SB.white} strokeWidth={1.4} opacity={0.85} />
              <rect width={12} height={40} fill="none" stroke={SB.white} strokeWidth={1.4} opacity={0.85} />
            </g>
          ))}
          {[-24, -6].map(x => (
            <g key={x} transform={`translate(${x},-34)`}>
              <rect x={-7} y={-14} width={14} height={20} rx={3} fill={SB.roof} />
              <rect x={-7} y={-8} width={14} height={2.4} fill={SB.roofDark} />
              <rect x={-5} y={-13} width={3} height={17} rx={1.5} fill="#e48a6f" opacity={0.7} />
            </g>
          ))}
          <g transform="translate(16,-30)">
            <rect x={-6} y={-12} width={12} height={16} rx={3} fill="#4f8db8" />
            <rect x={-6} y={-6} width={12} height={2} fill="#3a6f96" />
          </g>
        </g>
      );
    case 'repair':
      return (
        <g>
          <ellipse cy={-18} rx={48} ry={3.5} fill={SB.shadow} />
          <rect x={-46} y={-82} width={92} height={36} rx={3} fill={SB.woodLight} />
          {[-70, -62, -54].map(y => (
            <path key={y} d={`M-44 ${y} L44 ${y}`} stroke={SB.wood} strokeWidth={0.8} opacity={0.6} />
          ))}
          {/* a spanner, a hammer and a screwdriver on the board */}
          <g transform="translate(-20,-64) rotate(-30)">
            <rect x={-1.5} y={-9} width={3} height={18} rx={1.5} fill="#9aa3a8" />
            <path d="M-4 -12 a4 4 0 1 1 8 0 l-2 1 l-2 -3 l-2 3 Z" fill="#9aa3a8" />
          </g>
          <g transform="translate(0,-64)">
            <rect x={-1.4} y={-6} width={2.8} height={16} rx={1} fill={SB.woodDark} />
            <rect x={-6} y={-10} width={12} height={5} rx={1.5} fill="#7d878c" />
          </g>
          <g transform="translate(20,-64) rotate(25)">
            <rect x={-2.5} y={2} width={5} height={8} rx={2} fill={SB.roof} />
            <rect x={-0.8} y={-9} width={1.6} height={12} fill="#9aa3a8" />
          </g>
          <rect x={-48} y={-46} width={96} height={9} rx={2} fill={SB.wood} />
          <rect x={-48} y={-46} width={96} height={3} rx={1.5} fill={SB.woodLight} />
          <rect x={-42} y={-37} width={6} height={19} fill={SB.woodDark} />
          <rect x={36} y={-37} width={6} height={19} fill={SB.woodDark} />
          <circle cx={-28} cy={-28} r={9} fill="#4a4038" />
          <circle cx={-28} cy={-28} r={4} fill={SB.stone} />
        </g>
      );
    case 'refuel':
      return (
        <g>
          <ellipse cy={-18} rx={26} ry={3.5} fill={SB.shadow} />
          <rect x={-18} y={-74} width={36} height={56} rx={7} fill="#e9a13b" />
          <rect x={8} y={-74} width={10} height={56} rx={4} fill="#d48a2a" />
          <rect x={-18} y={-78} width={36} height={8} rx={3} fill={SB.roof} />
          <rect x={-12} y={-66} width={24} height={14} rx={2} fill={SB.wall} />
          <text y={-56} textAnchor="middle" fontSize={6.5} fontWeight={800} fill={SB.ink} fontFamily="monospace">
            DIESEL
          </text>
          <circle cy={-40} r={5} fill={SB.wall} opacity={0.9} />
          <path d="M18 -50 Q34 -48 30 -28" stroke="#4a4038" strokeWidth={3} fill="none" strokeLinecap="round" />
          <rect x={26} y={-30} width={8} height={10} rx={2} fill="#4a4038" />
        </g>
      );
    case 'hire':
      return (
        <g>
          {/* the ox pen: a patch of grass behind a rail fence */}
          <rect x={-56} y={-70} width={112} height={50} rx={10} fill={SB.grassLight} opacity={0.7} />
          <Meadow x={-52} y={-64} w={104} h={40} n={14} seed={21} flowers={0.2} />
          <Fence x0={-56} x1={56} y={-60} gap={22} h={16} />
          <Ox x={-16} y={-26} s={1} />
          <Ox x={22} y={-32} s={0.9} face={-1} />
          <Fence x0={-56} x1={56} y={-18} gap={28} h={12} />
        </g>
      );
    case 'drive':
      return (
        <g transform="translate(0,-26)">
          <ellipse cy={10} rx={46} ry={4} fill={SB.shadow} />
          <rect x={-40} y={-26} width={56} height={20} rx={6} fill="#4f9a4a" />
          <rect x={-40} y={-26} width={56} height={6} rx={3} fill="#6fb361" />
          <rect x={2} y={-52} width={32} height={34} rx={5} fill="#4f9a4a" />
          <rect x={0} y={-56} width={36} height={6} rx={2} fill={SB.roof} />
          <rect x={8} y={-46} width={20} height={15} rx={3} fill={SB.waterLight} />
          <path d="M11 -43 l5 0 l-6 9 Z" fill={SB.white} opacity={0.7} />
          <rect x={-34} y={-38} width={5} height={13} rx={1.5} fill="#5a524a" />
          <circle cx={-26} cy={-2} r={11} fill="#3f3a33" />
          <circle cx={-26} cy={-2} r={5} fill="#f3d35a" />
          <circle cx={20} cy={-8} r={17} fill="#3f3a33" />
          <circle cx={20} cy={-8} r={13} fill="none" stroke="#56504a" strokeWidth={2} strokeDasharray="3 3" />
          <circle cx={20} cy={-8} r={7} fill="#f3d35a" />
          <circle cx={18} cy={-10} r={2} fill={SB.white} opacity={0.7} />
        </g>
      );
  }
}

function StationArt({ st, near, onGo }: { st: StationInfo; near: boolean; onGo: () => void }) {
  const p = PADS[st.id];
  const stars = st.best === undefined ? -1 : st.best >= 0.85 ? 3 : st.best >= 0.6 ? 2 : st.best > 0 ? 1 : 0;
  return (
    <g
      data-station={st.id}
      transform={`translate(${p.x},${p.y})`}
      className={`ty-station${near ? ' is-near' : ''}${st.due ? ' is-due' : ''}${st.off ? ' is-off' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`${st.label}${st.due ? `: ${st.due}` : ''}${st.off ? `: ${st.off}` : ''}${stars >= 0 ? `, best ${stars} of 3 stars` : ''}`}
      onClick={onGo}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onGo())}
    >
      <rect x={-62} y={-96} width={124} height={108} fill="transparent" />
      <Prop id={st.id} />
      <ellipse className="ty-pad" rx={26} ry={10} />
      <ellipse className="ty-pad-ring" rx={26} ry={10} />
      <g transform="translate(0,22)">
        <rect className="ty-label" x={-40} y={-9} width={80} height={17} rx={8.5} />
        <text y={3.5} textAnchor="middle" className="ty-label-text">
          {st.icon} {st.label}
        </text>
      </g>
      {stars >= 0 && !near && (
        <text y={4} textAnchor="middle" className="ty-stars">
          {[0, 1, 2].map(i => (
            <tspan key={i} className={i < stars ? 'is-on' : ''}>
              ★
            </tspan>
          ))}
        </text>
      )}
      {st.due && (
        <g transform="translate(40,-78)">
          <g className="ty-badge">
            <circle r={9} />
            <text y={4} textAnchor="middle">
              !
            </text>
          </g>
        </g>
      )}
    </g>
  );
}

/** The yard's mechanic, by the workbench, with a tip that changes. */
const TIPS = ['Grease the nipples every week!', 'Walk round before you start.', 'Never step over a turning PTO.', 'Drive straight up a slope, never across.', 'Keep the radiator fins clean.', 'Lower tyre pressure in the field.'];

function Mechanic() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI(x => (x + 1) % TIPS.length), 5000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <g transform="translate(486,206)" aria-hidden="true" className="ty-mech">
      <ellipse cy={14} rx={10} ry={3.5} fill={SB.shadow} />
      <rect x={-6} y={-6} width={12} height={18} rx={4} fill="#2a4a7a" />
      <circle cy={-13} r={8} fill="#5a3420" />
      <path d="M-8 -16 Q0 -26 8 -16 Z" fill="#c0432f" />
      <path d="M6 0 L14 -8" stroke="#5a3420" strokeWidth={3.5} strokeLinecap="round" />
      <text x={17} y={-8} fontSize={7}>
        🔧
      </text>
      <g transform="translate(-62,-32)">
        <g key={i} className="ty-tip">
          <rect x={-74} y={-11} width={148} height={20} rx={10} fill="#fff8ea" stroke="#6b402b" strokeWidth={1} />
          <polygon points="62,9 70,9 66,15" fill="#fff8ea" />
          <text y={3} textAnchor="middle" fontSize={7} fontWeight={700} fill="#6b402b">
            {TIPS[i]}
          </text>
        </g>
      </g>
    </g>
  );
}

/** The farmer, walking: legs swing and the body bobs while moving. */
function Farmer({ x, y, face, walking, look, name }: { x: number; y: number; face: number; walking: boolean; look?: { skin?: string; shirt?: string }; name: string }) {
  const skin = look?.skin ?? '#8a5634';
  const shirt = look?.shirt ?? '#e8742a';
  return (
    <g transform={`translate(${x},${y})`} className={`ty-farmer${walking ? ' is-walking' : ''}`} aria-label={`${name}, in the yard`}>
      <ellipse cy={2} rx={11} ry={4} fill={SB.shadow} />
      <g transform={`scale(${face},1)`}>
        <g className="ty-legs">
          <rect className="ty-leg-a" x={-5} y={-10} width={4} height={11} rx={2} fill="#3b4a5a" />
          <rect className="ty-leg-b" x={1} y={-10} width={4} height={11} rx={2} fill="#3b4a5a" />
        </g>
        <g className="ty-body">
          <rect x={-8} y={-26} width={16} height={18} rx={5} fill={shirt} />
          <rect x={-11} y={-24} width={4} height={12} rx={2} fill={skin} />
          <rect x={7} y={-24} width={4} height={12} rx={2} fill={skin} />
          <circle cy={-33} r={8} fill={skin} />
          <circle cx={3} cy={-34} r={1.3} fill="#2a1a10" />
          <path d="M-9 -36 Q0 -46 9 -36 Z" fill="#ffae00" />
          <path d="M5 -37 L13 -36 L9 -34 Z" fill="#c88900" />
        </g>
      </g>
      <g transform="translate(0,-50)">
        <rect x={-24} y={-8} width={48} height={13} rx={6.5} fill="rgba(0,0,0,0.55)" />
        <text y={2} textAnchor="middle" fontSize={7} fontWeight={700} fill="#fff">
          {name.length > 10 ? `${name.slice(0, 9)}…` : name}
        </text>
      </g>
    </g>
  );
}
