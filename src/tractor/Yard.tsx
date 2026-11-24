import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { HubSection } from './hub';

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
      <rect width={W} height={H} fill="#8cc152" />
      {Array.from({ length: 40 }, (_, i) => (
        <path key={i} d={`M${(i * 157) % W} ${60 + ((i * 89) % (H - 60))} l3 -6 l3 6`} stroke="#6fa83c" strokeWidth={1.5} fill="none" />
      ))}
      {/* the yard: packed earth, a loop of track round the middle */}
      <rect x={30} y={78} width={600} height={240} rx={40} fill="#d9b77e" />
      <rect x={160} y={172} width={340} height={70} rx={35} fill="#c9a26a" />
      <rect x={184} y={186} width={292} height={42} rx={21} fill="#d9b77e" />
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={60 + ((i * 131) % 540)} cy={96 + ((i * 53) % 200)} r={1.6 + (i % 3)} fill="#b8925d" />
      ))}
      {/* the fence at the back */}
      <rect x={0} y={44} width={W} height={4} fill="#8a5a32" />
      <rect x={0} y={56} width={W} height={4} fill="#8a5a32" />
      {Array.from({ length: 23 }, (_, i) => (
        <rect key={i} x={6 + i * 29} y={36} width={6} height={30} rx={2} fill="#a06a3a" />
      ))}
      {/* trees and the sky strip */}
      <rect width={W} height={36} fill="#bfe6f5" />
      {[30, 200, 360, 455, 640].map((x, i) => (
        <g key={x} transform={`translate(${x},${30 + (i % 2) * 4})`}>
          <rect x={-3} y={-2} width={6} height={12} fill="#7a4a24" />
          <circle r={14} cy={-10} fill="#4c9a2a" />
          <circle r={9} cx={-9} cy={-4} fill="#5aae33" />
        </g>
      ))}
      <circle cx={644} cy={12} r={8} fill="#ffd25c" />
      {/* the sign over the yard */}
      <g transform="translate(552,22)">
        <rect x={-74} y={-13} width={148} height={24} rx={6} fill="#6b402b" />
        <rect x={-70} y={-10} width={140} height={18} rx={4} fill="#ffce7e" />
        <text y={4} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#6b402b">
          🚜 TRACTOR YARD
        </text>
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
          {/* a practice field from above: a ploughed row up the middle, rocks and a tree in the way */}
          <rect x={-58} y={-58} width={116} height={40} rx={8} fill="#c79f62" />
          <rect x={-10} y={-58} width={20} height={40} fill="#5f3a1d" />
          <line x1={-12} x2={-12} y1={-56} y2={-20} stroke="#fff" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.8} />
          <line x1={12} x2={12} y1={-56} y2={-20} stroke="#fff" strokeWidth={1.2} strokeDasharray="4 3" opacity={0.8} />
          <ellipse cx={20} cy={-46} rx={6} ry={4.5} fill="#8e9196" />
          <ellipse cx={-26} cy={-30} rx={5} ry={4} fill="#8e9196" />
          <circle cx={-44} cy={-46} r={9} fill="#2f6b2a" />
          <circle cx={-46} cy={-48} r={5} fill="#3f8a35" />
          <circle cx={44} cy={-28} r={8} fill="#2f6b2a" />
        </g>
      );
    case 'learn':
      return (
        <g>
          <rect x={-40} y={-66} width={80} height={46} rx={4} fill="#c98a4b" />
          <polygon points="-48,-64 0,-86 48,-64" fill="#a8452f" />
          <rect x={-28} y={-58} width={56} height={26} rx={2} fill="#2f4a3a" stroke="#8a5a32" strokeWidth={2} />
          <text y={-41} textAnchor="middle" fontSize={7} fill="#fff" fontFamily="monospace">
            A B C ✓
          </text>
          <rect x={-6} y={-32} width={12} height={12} fill="#7a4a24" />
        </g>
      );
    case 'safety':
      return (
        <g>
          <rect x={-3} y={-40} width={6} height={24} fill="#7a4a24" />
          <rect x={-34} y={-76} width={68} height={40} rx={5} fill="#ffd25c" stroke="#6b402b" strokeWidth={2} />
          <text y={-60} textAnchor="middle" fontSize={11}>
            🦺⛑️
          </text>
          <text y={-43} textAnchor="middle" fontSize={7} fontWeight={800} fill="#6b402b">
            SAFETY FIRST
          </text>
        </g>
      );
    case 'service':
      return (
        <g>
          <rect x={-52} y={-72} width={104} height={52} rx={4} fill="#7c8a96" />
          <polygon points="-58,-70 0,-88 58,-70" fill="#56636e" />
          <rect x={-40} y={-60} width={80} height={40} fill="#3a444c" />
          {[-24, -4].map(x => (
            <g key={x} transform={`translate(${x},-38)`}>
              <rect x={-8} y={-14} width={16} height={22} rx={3} fill="#c0432f" />
              <rect x={-8} y={-8} width={16} height={3} fill="#8f2f20" />
            </g>
          ))}
          <text x={22} y={-30} fontSize={12.5} textAnchor="middle">
            🛢️
          </text>
        </g>
      );
    case 'repair':
      return (
        <g>
          <rect x={-46} y={-44} width={92} height={10} rx={2} fill="#8a5a32" />
          <rect x={-42} y={-34} width={6} height={16} fill="#6b402b" />
          <rect x={36} y={-34} width={6} height={16} fill="#6b402b" />
          <rect x={-46} y={-80} width={92} height={34} rx={3} fill="#a06a3a" />
          <text y={-58} textAnchor="middle" fontSize={12}>
            🔧🔩🪛
          </text>
          <circle cx={-30} cy={-50} r={7} fill="#2a2a2a" />
        </g>
      );
    case 'refuel':
      return (
        <g>
          <rect x={-18} y={-74} width={36} height={56} rx={6} fill="#ffae00" stroke="#c88900" strokeWidth={2} />
          <rect x={-12} y={-66} width={24} height={14} rx={2} fill="#2a2a2a" />
          <text y={-55} textAnchor="middle" fontSize={7} fill="#7cff6a" fontFamily="monospace">
            DIESEL
          </text>
          <path d="M18 -50 Q34 -48 30 -28" stroke="#2a2a2a" strokeWidth={3} fill="none" />
          <rect x={26} y={-30} width={8} height={10} rx={2} fill="#2a2a2a" />
        </g>
      );
    case 'hire':
      return (
        <g>
          <rect x={-56} y={-70} width={112} height={50} rx={6} fill="#c9a26a" stroke="#8a5a32" strokeWidth={3} strokeDasharray="2 6" />
          <text x={-18} y={-34} fontSize={17.5} textAnchor="middle">
            🐂
          </text>
          <text x={20} y={-38} fontSize={16} textAnchor="middle">
            🐂
          </text>
        </g>
      );
    case 'drive':
      return (
        <g transform="translate(0,-26)">
          <rect x={-40} y={-26} width={56} height={20} rx={5} fill="#2b8a4a" />
          <rect x={4} y={-50} width={28} height={30} rx={4} fill="#2b8a4a" stroke="#1d5e33" strokeWidth={2} />
          <rect x={9} y={-45} width={18} height={14} rx={3} fill="#bfe3f2" />
          <rect x={-34} y={-36} width={5} height={11} fill="#555" />
          <circle cx={-26} cy={-2} r={11} fill="#2a2a2a" />
          <circle cx={-26} cy={-2} r={4.5} fill="#f2c230" />
          <circle cx={20} cy={-8} r={17} fill="#2a2a2a" />
          <circle cx={20} cy={-8} r={7} fill="#f2c230" />
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
      <ellipse cy={14} rx={10} ry={3.5} fill="rgba(0,0,0,0.18)" />
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
      <ellipse cy={2} rx={11} ry={4} fill="rgba(0,0,0,0.22)" />
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
