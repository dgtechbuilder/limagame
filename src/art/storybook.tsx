/* The storybook look for every drawn farm scene (Dean's reference, 2026-11-27): a soft, flat, painted countryside.
   Sage sky with cream clouds, rolling hills in layered greens, round trees whose crowns carry pale looping scribbles,
   grass dotted with tufts and small flowers, cream walls under terracotta roofs, warm wood, teal water. No black
   outlines: shapes sit on each other and a lighter or darker tone of the same colour does the shading.

   Screens draw their own props, but take their colours from SB and their trees, grass, hills, clouds and fences from
   here, so every scene in the game reads as one picture book. Pure drawing, no state. */

import type { ReactNode } from 'react';

/** The palette, picked off the reference. */
export const SB = {
  sky: '#cfe4c6',
  skyLow: '#e4eed2',
  cloud: '#f6f1dd',
  cloudLine: '#ffffff',
  hillFar: '#9cc97a',
  hillMid: '#7fb85e',
  hillNear: '#6aa94f',
  grass: '#79b457',
  grassDark: '#5c9a43',
  grassLight: '#9ccb74',
  meadow: '#e3cf6a', // the yellow field
  leaf: '#3f7f47',
  leafMid: '#4f9450',
  leafLight: '#6aac5c',
  leafLine: '#b6dca0',
  trunk: '#6e4a2f',
  earth: '#e6cf98',
  earthDark: '#d2b47a',
  earthDeep: '#b98a55',
  path: '#efe0b4',
  soil: '#a8703f',
  soilDark: '#8a5832',
  wood: '#a8744a',
  woodDark: '#82573a',
  woodLight: '#c8925f',
  wall: '#f4e8cc',
  wallShade: '#e2d2ae',
  roof: '#c8553d',
  roofDark: '#a84432',
  shed: '#4f9a5c',
  shedDark: '#3c7d49',
  water: '#6cc7b8',
  waterLight: '#a6e0d2',
  stone: '#b9b4a4',
  stoneDark: '#97917f',
  ink: '#5a3a26',
  white: '#fbf8ee',
  flower: ['#fbf8ee', '#f3d35a', '#f0a7b3', '#e8774f'],
  shadow: 'rgba(60, 70, 30, 0.18)',
} as const;

/** A fixed pseudo-random number in 0..1 for a seed, so a scene is drawn the same every time. */
export const rnd = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** The pale looping scribble the reference draws on tree crowns and bushes. */
export function Scribble({ x, y, w = 14, color = SB.leafLine, opacity = 0.75, width = 0.9 }: { x: number; y: number; w?: number; color?: string; opacity?: number; width?: number }) {
  const s = w / 14;
  return (
    <path
      d={`M${x} ${y} c${2 * s} ${-3 * s} ${4 * s} ${-3 * s} ${4 * s} ${-0.5 * s} c0 ${2 * s} ${-3 * s} ${2 * s} ${-2 * s} 0 c${1.5 * s} ${-2.5 * s} ${4.5 * s} ${-3 * s} ${5 * s} ${-0.5 * s} c${0.4 * s} ${2 * s} ${-2.6 * s} ${2.2 * s} ${-1.8 * s} ${0.2 * s} c${1.2 * s} ${-2 * s} ${4 * s} ${-2.4 * s} ${4.8 * s} 0`}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      opacity={opacity}
    />
  );
}

/** A round storybook tree: a trunk, a crown of three overlapping blobs in two greens, scribbles on the light side. */
export function Tree({ x, y, r = 14, tone = 0, shadow = true }: { x: number; y: number; r?: number; tone?: 0 | 1 | 2; shadow?: boolean }) {
  const dark = [SB.leaf, '#356f3f', SB.leafMid][tone];
  const light = [SB.leafMid, SB.leaf, SB.leafLight][tone];
  return (
    <g transform={`translate(${x},${y})`}>
      {shadow && <ellipse cy={1} rx={r * 0.8} ry={r * 0.22} fill={SB.shadow} />}
      <path d={`M${-r * 0.12} 0 L${-r * 0.08} ${-r * 0.9} L${r * 0.08} ${-r * 0.9} L${r * 0.14} 0 Z`} fill={SB.trunk} />
      <path d={`M0 ${-r * 0.55} l${-r * 0.3} ${-r * 0.3} M0 ${-r * 0.65} l${r * 0.25} ${-r * 0.3}`} stroke={SB.trunk} strokeWidth={r * 0.08} strokeLinecap="round" />
      <circle cx={-r * 0.45} cy={-r * 1.05} r={r * 0.62} fill={dark} />
      <circle cx={r * 0.45} cy={-r * 1.1} r={r * 0.6} fill={dark} />
      <circle cy={-r * 1.45} r={r * 0.72} fill={dark} />
      <circle cx={-r * 0.25} cy={-r * 1.55} r={r * 0.5} fill={light} />
      <circle cx={-r * 0.55} cy={-r * 1.15} r={r * 0.34} fill={light} />
      <Scribble x={-r * 0.7} y={-r * 1.5} w={r * 0.75} />
      <Scribble x={-r * 0.1} y={-r * 1.0} w={r * 0.6} opacity={0.5} />
    </g>
  );
}

/** A tree seen from straight above (for top-down scenes such as the tractor school's field). */
export function TreeTop({ x, y, r = 10 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx={r * 0.25} cy={r * 0.3} r={r} fill={SB.shadow} />
      <circle r={r} fill={SB.leaf} />
      <circle cx={-r * 0.25} cy={-r * 0.25} r={r * 0.68} fill={SB.leafMid} />
      <circle cx={-r * 0.4} cy={-r * 0.4} r={r * 0.32} fill={SB.leafLight} />
      <Scribble x={-r * 0.65} y={-r * 0.1} w={r * 0.9} />
    </g>
  );
}

/** A low bush: two blobs and a scribble. */
export function Bush({ x, y, r = 7 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <ellipse cy={0.5} rx={r * 1.3} ry={r * 0.25} fill={SB.shadow} />
      <circle cx={-r * 0.5} cy={-r * 0.55} r={r * 0.7} fill={SB.leaf} />
      <circle cx={r * 0.45} cy={-r * 0.6} r={r * 0.75} fill={SB.leaf} />
      <circle cx={-r * 0.1} cy={-r * 0.95} r={r * 0.6} fill={SB.leafMid} />
      <Scribble x={-r * 0.6} y={-r * 0.8} w={r} opacity={0.6} />
    </g>
  );
}

/** A tuft of grass: three thin blades. */
export function Tuft({ x, y, s = 1, color = SB.grassDark }: { x: number; y: number; s?: number; color?: string }) {
  return <path d={`M${x - 3 * s} ${y} q${1 * s} ${-4 * s} ${0.5 * s} ${-6 * s} M${x} ${y} q0 ${-5 * s} ${0.6 * s} ${-7.5 * s} M${x + 3 * s} ${y} q${-0.6 * s} ${-3.5 * s} ${0.8 * s} ${-5.5 * s}`} stroke={color} strokeWidth={1.1 * s} strokeLinecap="round" fill="none" />;
}

/** A small flower: five dots round a centre. */
export function Flower({ x, y, c = SB.flower[0], r = 1.4 }: { x: number; y: number; c?: string; r?: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {[0, 72, 144, 216, 288].map(a => (
        <circle key={a} cx={Math.cos((a * Math.PI) / 180) * r} cy={Math.sin((a * Math.PI) / 180) * r} r={r * 0.75} fill={c} />
      ))}
      <circle r={r * 0.55} fill="#f3c24a" />
    </g>
  );
}

/** Grass detail scattered over a box: tufts, a few flowers and white leaf strokes, the same every time. */
export function Meadow({ x, y, w, h, n = 30, seed = 1, flowers = 0.35, avoid }: { x: number; y: number; w: number; h: number; n?: number; seed?: number; flowers?: number; avoid?: (px: number, py: number) => boolean }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const px = x + rnd(seed + i * 3.1) * w;
    const py = y + rnd(seed + i * 7.7) * h;
    if (avoid?.(px, py)) continue;
    const k = rnd(seed + i * 11.3);
    if (k < flowers) out.push(<Flower key={i} x={px} y={py} c={SB.flower[i % SB.flower.length]} r={1 + rnd(i + seed) * 0.6} />);
    else if (k < flowers + 0.12) out.push(<path key={i} d={`M${px} ${py} q2 -3 5 -3 q-1 3 -5 3 Z`} fill={SB.white} opacity={0.7} />);
    else out.push(<Tuft key={i} x={px} y={py} s={0.7 + rnd(seed + i) * 0.5} color={k > 0.8 ? SB.grassLight : SB.grassDark} />);
  }
  return <g>{out}</g>;
}

/** A cream cloud with a white swirl, as in the reference sky. */
export function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d="M-22 4 Q-22 -4 -13 -4 Q-10 -12 -1 -11 Q6 -16 13 -9 Q22 -9 22 0 Q22 4 18 4 Z" fill={SB.cloud} />
      <path d="M-14 0 q4 -6 9 -3 q-3 3 -1 4 M2 -4 q4 -5 9 -1" stroke={SB.cloudLine} strokeWidth={1} fill="none" strokeLinecap="round" opacity={0.9} />
    </g>
  );
}

/** A sky band with clouds, and rolling hills in three greens down to `y` (where the scene's own ground starts). */
export function Countryside({ w, y, seed = 1, clouds = 3, fields = true }: { w: number; y: number; seed?: number; clouds?: number; fields?: boolean }) {
  const hill = (base: number, amp: number, phase: number, color: string) => {
    const steps = 8;
    let d = `M0 ${y + 2} L0 ${base}`;
    for (let i = 1; i <= steps; i++) {
      const x0 = ((i - 1) / steps) * w;
      const x1 = (i / steps) * w;
      const h = base - amp * (0.4 + rnd(seed + phase + i) * 0.9);
      d += ` Q${(x0 + x1) / 2} ${h} ${x1} ${base - amp * 0.2 * rnd(seed + phase + i * 2)}`;
    }
    return <path d={`${d} L${w} ${y + 2} Z`} fill={color} />;
  };
  return (
    <g>
      <defs>
        <linearGradient id={`sb-sky-${seed}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={SB.sky} />
          <stop offset="1" stopColor={SB.skyLow} />
        </linearGradient>
      </defs>
      <rect width={w} height={y + 2} fill={`url(#sb-sky-${seed})`} />
      {Array.from({ length: clouds }, (_, i) => (
        <Cloud key={i} x={(w / clouds) * (i + 0.3 + rnd(seed + i) * 0.4)} y={y * (0.22 + rnd(seed + i * 5) * 0.2)} s={0.55 + rnd(seed + i * 9) * 0.35} />
      ))}
      {hill(y * 0.78, y * 0.28, 1, SB.hillFar)}
      {fields && (
        <path d={`M${w * 0.18} ${y * 0.72} Q${w * 0.3} ${y * 0.55} ${w * 0.46} ${y * 0.7} Z`} fill={SB.meadow} opacity={0.85} />
      )}
      {hill(y * 0.92, y * 0.22, 4, SB.hillMid)}
      {hill(y + 1, y * 0.14, 9, SB.hillNear)}
    </g>
  );
}

/** A wooden post-and-rail fence from x0 to x1 with its rails at y (posts every `gap`). */
export function Fence({ x0, x1, y, gap = 26, h = 18 }: { x0: number; x1: number; y: number; gap?: number; h?: number }) {
  const posts = Math.max(2, Math.round((x1 - x0) / gap) + 1);
  return (
    <g>
      <rect x={x0} y={y - h * 0.62} width={x1 - x0} height={h * 0.16} rx={1} fill={SB.woodDark} />
      <rect x={x0} y={y - h * 0.3} width={x1 - x0} height={h * 0.16} rx={1} fill={SB.woodDark} />
      {Array.from({ length: posts }, (_, i) => {
        const px = x0 + ((x1 - x0) * i) / (posts - 1);
        return (
          <g key={i}>
            <rect x={px - 2.2} y={y - h} width={4.4} height={h} rx={1.2} fill={SB.wood} />
            <rect x={px - 2.2} y={y - h} width={1.6} height={h} rx={0.8} fill={SB.woodLight} />
          </g>
        );
      })}
    </g>
  );
}

/** A little cottage: cream walls, terracotta roof, a window and a door (bottom centre at 0,0). */
export function Cottage({ w = 60, h = 34, roof = SB.roof, wall = SB.wall, chimney = true, children }: { w?: number; h?: number; roof?: string; wall?: string; chimney?: boolean; children?: ReactNode }) {
  return (
    <g>
      <ellipse cy={1} rx={w * 0.6} ry={4} fill={SB.shadow} />
      <rect x={-w / 2} y={-h} width={w} height={h} fill={wall} />
      <rect x={w / 2 - w * 0.18} y={-h} width={w * 0.18} height={h} fill={SB.wallShade} />
      {chimney && <rect x={w * 0.18} y={-h - h * 0.75} width={w * 0.1} height={h * 0.4} fill={SB.roofDark} />}
      <path d={`M${-w / 2 - 6} ${-h + 1} L0 ${-h - h * 0.68} L${w / 2 + 6} ${-h + 1} Z`} fill={roof} />
      <path d={`M${-w / 2 - 6} ${-h + 1} L${w / 2 + 6} ${-h + 1}`} stroke={SB.roofDark} strokeWidth={2.4} />
      {[0.28, 0.5].map(k => (
        <path key={k} d={`M${-w * (0.5 - k * 0.55)} ${-h - h * k * 1.05} L${w * (0.5 - k * 0.55)} ${-h - h * k * 1.05}`} stroke={SB.roofDark} strokeWidth={0.8} opacity={0.6} />
      ))}
      {children}
    </g>
  );
}
