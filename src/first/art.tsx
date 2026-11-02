/* Drawn-in-code art for the first session. Everything a player needs to judge a shamba is in the
   picture itself (leaf colour, height, holes, droppings, wilting, dry soil), never in a number.
   Drawing in SVG keeps the download tiny for slow connections and lets one component draw any
   crop in any condition from the shamba data. */

import { memo, type ReactNode } from 'react';
import type { Condition, Crop, Look, PartId } from './data';

/* ------------------------------------------------------------------ */
/* helpers                                                              */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Irregular polygon, used for ragged holes and soil crumbs. */
function blob(cx: number, cy: number, r: number, rand: () => number, n = 7) {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (0.55 + rand() * 0.6);
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr * 0.8).toFixed(1)}`);
  }
  return pts.join(' ');
}

const LEAF = {
  healthy: { fill: '#3f9b35', rib: '#8fd16b', edge: '#2a6f24' },
  armyworm: { fill: '#5d9e3a', rib: '#a9d67f', edge: '#3d6f24' },
  drought: { fill: '#86985a', rib: '#b3bf86', edge: '#5f6d3a' },
  nitrogen: { fill: '#9fb43c', rib: '#e3d55a', edge: '#6f7f26' },
  aphids: { fill: '#79a947', rib: '#c1e093', edge: '#47782b' },
};

const SOIL = { moist: '#5b3a22', moistDark: '#432916', dry: '#c39b68', dryDark: '#8a6a40' };

/* ------------------------------------------------------------------ */
/* Plants                                                               */
/* ------------------------------------------------------------------ */

interface PlantProps {
  x: number;
  y: number;
  s?: number;
  cond: Condition;
  seed: number;
  /** colour seen through holes in the leaves */
  bg: string;
}

/** Young maize (knee-to-waist high, before tasselling: the stage fall armyworm attacks). */
export const Maize = memo(function Maize({ x, y, s = 1, cond, seed, bg }: PlantProps) {
  const rand = rng(seed);
  const c = LEAF[cond];
  const height = cond === 'healthy' || cond === 'armyworm' ? 96 : 80;
  const droop = cond === 'drought' ? 30 : 7;
  const width = cond === 'drought' ? 4 : 8;
  const leaves: ReactNode[] = [];
  const holes: ReactNode[] = [];
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const ay = -12 - i * 13;
    const L = (50 - i * 4) * (0.9 + rand() * 0.2) * (cond === 'armyworm' ? 0.86 : 1);
    const tipY = ay - 8 + droop + i * 2;
    const lower = cond === 'nitrogen' && i < 3;
    const fill = lower ? '#d8c64a' : c.fill;
    const rib = lower ? '#f3e7a0' : c.rib;
    const d = `M0,${ay} Q${side * L * 0.45},${ay - 20 - width} ${side * L},${tipY} Q${side * L * 0.5},${ay - 10 + width / 2} 0,${ay + 4} Z`;
    leaves.push(
      <g key={i}>
        <path d={d} fill={fill} stroke={c.edge} strokeWidth={0.8} />
        <path d={`M0,${ay} Q${side * L * 0.47},${ay - 15 - width / 2} ${side * L},${tipY}`} fill="none" stroke={rib} strokeWidth={0.9} />
      </g>,
    );
    if (cond === 'armyworm' && i >= 1) {
      // ragged "shot-hole" damage and pale scraped windows along the blade
      const n = i >= 3 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const t = 0.3 + (k / n) * 0.55 + rand() * 0.08;
        const hx = side * L * t;
        const hy = ay + (tipY - ay) * t * t - 13 * Math.sin(Math.PI * t);
        holes.push(<polygon key={`h${i}${k}`} points={blob(hx, hy, 3.4 + rand() * 2.2, rand)} fill={bg} stroke="#7a5a24" strokeWidth={0.8} />);
        holes.push(<ellipse key={`w${i}${k}`} cx={hx - side * 5} cy={hy + 1.5} rx={3.4} ry={1.7} fill="#eef3d2" />);
      }
    }
  }
  const top = -height;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d={`M-2.4,0 L-1.6,${top + 10} L1.6,${top + 10} L2.4,0 Z`} fill={cond === 'drought' ? '#7d8b4c' : '#5c8f2c'} />
      {leaves}
      {holes}
      {/* whorl: the young leaves rolled into a funnel at the top */}
      <path d={`M-1,${top + 12} Q-7,${top + 2} -5,${top - 8 + (cond === 'drought' ? 6 : 0)} L-1,${top + 4} Z`} fill={c.fill} stroke={c.edge} strokeWidth={0.7} />
      <path d={`M1,${top + 12} Q8,${top + 3} 5,${top - 10 + (cond === 'drought' ? 6 : 0)} L1,${top + 4} Z`} fill={c.fill} stroke={c.edge} strokeWidth={0.7} />
      {cond === 'armyworm' &&
        Array.from({ length: 9 }, (_, k) => (
          <circle key={k} cx={-3.5 + rand() * 7} cy={top + 6 + rand() * 6} r={0.9 + rand() * 0.8} fill="#c9a66b" stroke="#8a6a3a" strokeWidth={0.3} />
        ))}
    </g>
  );
});

/** Bush bean: trifoliate leaves on short stems. Drought makes the leaves hang and dull. */
export const Bean = memo(function Bean({ x, y, s = 1, cond, seed }: PlantProps) {
  const rand = rng(seed);
  const dry = cond === 'drought';
  const c = LEAF[cond];
  const stems: ReactNode[] = [];
  const tips = [
    [-20, -24],
    [-10, -36],
    [0, -42],
    [11, -35],
    [21, -23],
  ];
  tips.forEach(([tx, ty], i) => {
    const sx = tx * (0.9 + rand() * 0.2);
    const sy = ty * (dry ? 0.82 : 1) * (0.92 + rand() * 0.16);
    const out = Math.atan2(sy, sx) * (180 / Math.PI) + 90; // leaves point away from the base
    const rot = dry ? out + (sx < 0 ? -95 : 95) : out; // wilting: leaflets hang down
    stems.push(
      <g key={i}>
        <path d={`M0,0 Q${sx * 0.3},${sy * 0.7} ${sx},${sy}`} fill="none" stroke={dry ? '#7c8a4a' : '#4f8a2a'} strokeWidth={1.6} />
        <g transform={`translate(${sx},${sy}) rotate(${rot})`}>
          {[-38, 0, 38].map(a => (
            <g key={a} transform={`rotate(${a})`}>
              <ellipse cx={0} cy={-8} rx={dry ? 4.6 : 5.6} ry={8} fill={c.fill} stroke={dry ? '#8f7034' : c.edge} strokeWidth={dry ? 1 : 0.7} />
              <path d="M0,-1 L0,-14" stroke={c.rib} strokeWidth={0.6} />
            </g>
          ))}
        </g>
      </g>,
    );
  });
  return <g transform={`translate(${x},${y}) scale(${s})`}>{stems}</g>;
});

/** Sukuma wiki (collard kale): a bare stem where lower leaves were picked, broad blue-green leaves on top.
    Thirsty plants hang their leaves down, turn dull and brown at the edges. */
export const Kale = memo(function Kale({ x, y, s = 1, cond, seed }: PlantProps) {
  const rand = rng(seed);
  const dry = cond === 'drought';
  const aphids = cond === 'aphids';
  const leafFill = dry ? '#93a274' : aphids ? '#6f9a62' : '#4f9070';
  const edge = dry ? '#8f7034' : '#2f6a50';
  const rib = dry ? '#c9cfa8' : '#bfe0cc';
  const top = -24;
  const angles = [-72, -44, -16, 12, 40, 68, -2];
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d={`M-1.8,0 L-1.4,${top} L1.4,${top} L1.8,0 Z`} fill={dry ? '#9a9f7a' : '#88a890'} />
      {[-6, -12, -18].map(yy => (
        <path key={yy} d={`M-1.6,${yy} l-2.4,-1.4 M1.6,${yy - 3} l2.4,-1.4`} stroke="#6f8a74" strokeWidth={1} />
      ))}
      {angles.map((a, i) => {
        const tilt = a + (rand() - 0.5) * 8;
        const rot = dry ? tilt + (tilt < 0 ? -62 : 62) : tilt;
        return (
          <g key={i} transform={`translate(0,${top}) rotate(${rot})`}>
            <path d="M0,0 L0,-9" stroke={rib} strokeWidth={1.4} />
            <path
              d={dry || aphids ? 'M0,-8 Q-6,-14 -4.5,-24 Q0,-28 4.5,-24 Q6,-14 0,-8 Z' : 'M0,-8 Q-9,-12 -8,-22 Q-6,-30 0,-31 Q6,-30 8,-22 Q9,-12 0,-8 Z'}
              fill={leafFill}
              stroke={edge}
              strokeWidth={dry ? 1.1 : 0.8}
            />
            <path d="M0,-8 L0,-28 M0,-14 L-4,-18 M0,-14 L4,-18 M0,-20 L-4,-24 M0,-20 L4,-24" stroke={rib} strokeWidth={0.7} fill="none" />
            {aphids && i % 2 === 0 && [0, 1, 2, 3, 4].map(k => <circle key={k} cx={-2 + k * 1.2} cy={-22 + (k % 2) * 3} r={1} fill="#31461f" />)}
          </g>
        );
      })}
    </g>
  );
});

/** Staked tomato: compound leaves up a stem, red fruit low down. Hungry plants go yellow from the lowest leaves up;
    thirsty plants hang their leaves and carry less fruit. */
export const Tomato = memo(function Tomato({ x, y, s = 1, cond, seed }: PlantProps) {
  const rand = rng(seed);
  const dry = cond === 'drought';
  const hungry = cond === 'nitrogen';
  const c = LEAF[cond];
  const height = dry ? 52 : 64;
  const leaves: ReactNode[] = [];
  for (let i = 0; i < 5; i++) {
    const ay = -8 - i * (height / 5.4);
    const side = i % 2 ? 1 : -1;
    const yellow = hungry && i < 3;
    const fill = yellow ? '#d9c94c' : dry ? '#8f9d5e' : hungry ? '#8fae45' : c.fill;
    const reach = (22 - i * 2) * (0.9 + rand() * 0.2);
    const sag = dry ? 18 : 2;
    leaves.push(
      <g key={i} transform={`translate(0,${ay})`}>
        <path d={`M0,0 Q${side * reach * 0.5},${-4 + sag * 0.4} ${side * reach},${sag}`} fill="none" stroke={dry ? '#7d8b4c' : '#4f8a2a'} strokeWidth={1.2} />
        {[0.45, 0.75, 1].map((t, k) => (
          <ellipse key={k} cx={side * reach * t} cy={sag * t - (k % 2 ? 4 : -1)} rx={5.4 - k} ry={3.2} transform={`rotate(${side * (20 + k * 12) + (dry ? side * 30 : 0)} ${side * reach * t} ${sag * t})`} fill={fill} stroke={c.edge} strokeWidth={0.6} />
        ))}
      </g>,
    );
  }
  const fruit = dry ? [[-5, -10]] : [[-6, -11], [5, -9], [-2, -17]];
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <path d={`M3,0 L3,${-height - 6}`} stroke="#9a7a48" strokeWidth={1.2} />
      <path d={`M0,0 L0,${-height}`} stroke={dry ? '#7d8b4c' : '#5c8f2c'} strokeWidth={2} />
      {leaves}
      {fruit.map(([fx, fy], i) => (
        <circle key={i} cx={fx} cy={fy} r={3.4} fill={hungry ? '#e2573c' : '#d8382c'} stroke="#8f1f17" strokeWidth={0.5} />
      ))}
      <path d={`M-1,${-height} q-3,-4 0,-8 q3,4 0,8 Z`} fill={dry ? '#8f9d5e' : '#5c9f35'} />
    </g>
  );
});

export function Plant(p: PlantProps & { crop: Crop }) {
  if (p.crop === 'maize') return <Maize {...p} />;
  if (p.crop === 'kale') return <Kale {...p} />;
  if (p.crop === 'tomato') return <Tomato {...p} />;
  return <Bean {...p} />;
}

/* ------------------------------------------------------------------ */
/* Field: the shamba in three-quarter view, rows from front (0) to back */
/* ------------------------------------------------------------------ */

export const FIELD_W = 600;
export const FIELD_H = 260;

export function rowGeometry(rows: number, i: number) {
  const f = rows > 1 ? i / (rows - 1) : 0;
  const y = 228 - f * 150;
  const s = 1 - f * 0.42;
  const half = 270 - f * 150;
  return { y, s, x0: 300 - half, x1: 300 + half, band: 150 / (rows - 1) };
}

export function Field({
  crop,
  cond,
  problemRows,
  rows,
  healed = false,
  seed = 1,
}: {
  crop: Crop;
  cond: Condition;
  problemRows: number[];
  rows: number;
  healed?: boolean;
  seed?: number;
}) {
  const dryBack = cond === 'drought';
  const order = Array.from({ length: rows }, (_, i) => rows - 1 - i); // back to front
  return (
    <g>
      <defs>
        <linearGradient id={`soil-${seed}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dryBack ? SOIL.dry : '#6b4528'} />
          <stop offset="0.55" stopColor={dryBack ? '#a27c4c' : '#5f3c22'} />
          <stop offset="1" stopColor={SOIL.moist} />
        </linearGradient>
      </defs>
      <polygon points="120,48 480,48 596,252 4,252" fill={`url(#soil-${seed})`} stroke="#3d2614" strokeWidth={2} />
      {dryBack &&
        (() => {
          const rand = rng(seed + 9);
          return Array.from({ length: 16 }, (_, k) => {
            const x = 150 + rand() * 300;
            const y = 56 + rand() * 70;
            return <polyline key={k} points={`${x},${y} ${x + 8},${y + 5} ${x + 4},${y + 11} ${x + 13},${y + 15}`} fill="none" stroke={SOIL.dryDark} strokeWidth={1.2} />;
          });
        })()}
      {dryBack && <path d="M2,254 L598,254" stroke="#4fa3d1" strokeWidth={7} strokeLinecap="round" opacity={0.9} />}
      {order.map(i => {
        const g = rowGeometry(rows, i);
        const bad = problemRows.includes(i) && !healed;
        const n = 9;
        return (
          <g key={i}>
            <ellipse cx={300} cy={g.y + 3} rx={(g.x1 - g.x0) / 2 + 6} ry={6 * g.s} fill="rgba(40,22,10,0.35)" />
            {Array.from({ length: n }, (_, k) => {
              const x = g.x0 + 18 * g.s + (k / (n - 1)) * (g.x1 - g.x0 - 36 * g.s);
              return <Plant key={k} crop={crop} x={x} y={g.y} s={(crop === 'maize' ? 0.62 : crop === 'kale' ? 0.95 : crop === 'tomato' ? 1 : 1.05) * g.s} cond={bad ? cond : 'healthy'} seed={seed * 100 + i * 10 + k} bg={bad && cond === 'drought' ? SOIL.dry : '#6b4528'} />;
            })}
          </g>
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Review parts: the four pictures a player looks at (200 × 140 each)   */
/* ------------------------------------------------------------------ */

export const PART_W = 200;
export const PART_H = 140;

const label = (x: number, y: number, text: string) => (
  <text x={x} y={y} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff" stroke="#3d2614" strokeWidth={2.4} paintOrder="stroke" fontFamily="Poppins, sans-serif">
    {text}
  </text>
);

function rowName(rows: number, problemRows: number[]) {
  const mid = problemRows.reduce((a, b) => a + b, 0) / problemRows.length;
  return mid >= rows - 1.6 ? 'Back row' : mid <= 0.6 ? 'Front row' : 'Middle row';
}

/** Where the clue sits in each part, for the ring shown after a wrong call. */
export function cluePoint(part: PartId, crop: Crop): [number, number, number] {
  if (part === 'pests') return crop === 'maize' ? [100, 66, 34] : [100, 70, 40];
  if (part === 'soil') return [148, 78, 40];
  if (part === 'crop') return [148, 64, 44];
  return [100, 60, 50];
}

export function PartArt({
  part,
  crop,
  cond,
  problemRows,
  rows,
  ring = false,
}: {
  part: PartId;
  crop: Crop;
  cond: Condition;
  problemRows: number[];
  rows: number;
  ring?: boolean;
}) {
  const sky = '#f6ead2';
  const healthyName = problemRows.includes(0) ? 'Back row' : 'Front row';
  const sickName = rowName(rows, problemRows);
  let body: ReactNode;

  if (part === 'crop') {
    const scale = crop === 'maize' ? 0.98 : crop === 'kale' ? 1.6 : crop === 'tomato' ? 1.35 : 1.55;
    body = (
      <>
        <rect width={PART_W} height={PART_H} fill={sky} />
        <rect y={112} width={PART_W} height={28} fill={cond === 'drought' ? '#b9925f' : '#6b4528'} />
        <rect x={0} y={112} width={100} height={28} fill="#6b4528" />
        <Plant crop={crop} x={52} y={118} s={scale} cond="healthy" seed={11} bg={sky} />
        <Plant crop={crop} x={148} y={118} s={scale} cond={cond} seed={12} bg={sky} />
        <line x1={100} y1={8} x2={100} y2={112} stroke="#6b402b" strokeOpacity={0.15} strokeDasharray="3 3" />
        {label(52, 133, healthyName)}
        {label(148, 133, sickName)}
      </>
    );
  } else if (part === 'pests') {
    body = crop === 'maize' ? <Whorl cond={cond} /> : <LeafUnderside cond={cond} kale={crop === 'kale'} />;
  } else if (part === 'soil') {
    const dry = cond === 'drought';
    body = (
      <>
        <rect width={PART_W} height={PART_H} fill={sky} />
        <SoilPatch x={8} y={18} w={88} h={98} dry={false} seed={3} />
        <SoilPatch x={104} y={18} w={88} h={98} dry={dry} seed={4} />
        {label(52, 133, healthyName)}
        {label(148, 133, sickName)}
      </>
    );
  } else {
    body = <TopDown crop={crop} cond={cond} problemRows={problemRows} rows={rows} />;
  }

  const [rx, ry, rr] = cluePoint(part, crop);
  return (
    <svg viewBox={`0 0 ${PART_W} ${PART_H}`} width="100%" height="100%" role="img" aria-label={`${part} of the shamba`}>
      {body}
      {ring && <circle className="clue-ring" cx={rx} cy={ry} r={rr} fill="none" stroke="#ffb005" strokeWidth={3.5} />}
    </svg>
  );
}

function SoilPatch({ x, y, w, h, dry, seed }: { x: number; y: number; w: number; h: number; dry: boolean; seed: number }) {
  const rand = rng(seed);
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={dry ? SOIL.dry : SOIL.moist} />
      {dry
        ? Array.from({ length: 7 }, (_, k) => {
            const sx = x + 6 + rand() * (w - 20);
            const sy = y + 6 + rand() * (h - 24);
            return (
              <polyline
                key={k}
                points={`${sx},${sy} ${sx + 7},${sy + 6} ${sx + 3},${sy + 13} ${sx + 12},${sy + 18} ${sx + 9},${sy + 24}`}
                fill="none"
                stroke={SOIL.dryDark}
                strokeWidth={1.6}
                strokeLinejoin="round"
              />
            );
          })
        : Array.from({ length: 16 }, (_, k) => (
            <polygon key={k} points={blob(x + 8 + rand() * (w - 16), y + 8 + rand() * (h - 16), 2.5 + rand() * 3, rand)} fill={k % 3 ? SOIL.moistDark : '#6e4a2e'} />
          ))}
      {!dry && (
        <>
          <path d={`M${x + w - 22},${y + 18} q4,7 0,10 q-4,-3 0,-10 Z`} fill="#8fd0f0" opacity={0.9} />
          <path d={`M${x + 16},${y + h - 26} q3,5 0,7 q-3,-2 0,-7 Z`} fill="#8fd0f0" opacity={0.8} />
        </>
      )}
      {dry && <rect x={x} y={y} width={w} height={h} rx={8} fill="#fff" opacity={0.08} />}
    </g>
  );
}

/** Looking down into the maize funnel (whorl). Fall armyworm: ragged holes, sawdust-like droppings, a caterpillar. */
function Whorl({ cond }: { cond: Condition }) {
  const rand = rng(21);
  const bg = '#6b4528';
  const worm = cond === 'armyworm';
  const blades = [-150, -70, 10, 95, 170];
  return (
    <>
      <rect width={PART_W} height={PART_H} fill={bg} />
      {blades.map((a, i) => (
        <g key={a} transform={`translate(100,70) rotate(${a})`}>
          <path d="M0,-6 Q55,-24 112,-6 Q55,10 0,6 Z" fill={i % 2 ? '#3f9b35' : '#47a83b'} stroke="#2a6f24" strokeWidth={1} />
          <path d="M4,0 Q55,-8 110,-6" stroke="#8fd16b" strokeWidth={1.2} fill="none" />
          {worm &&
            [36, 62, 86].map(t => (
              <polygon key={t} points={blob(t, -3 + rand() * 6, 4 + rand() * 4, rand, 8)} fill={bg} stroke="#7a5a24" strokeWidth={1} />
            ))}
          {worm && <ellipse cx={74} cy={4} rx={7} ry={2.6} fill="#e4ecc0" opacity={0.85} />}
        </g>
      ))}
      <circle cx={100} cy={70} r={15} fill="#2f7d27" stroke="#1f5a1a" strokeWidth={1.5} />
      <circle cx={100} cy={70} r={9} fill="#255f1f" />
      {worm && (
        <>
          {Array.from({ length: 34 }, (_, k) => {
            const a = rand() * Math.PI * 2;
            const r = rand() * 20;
            return <circle key={k} cx={100 + Math.cos(a) * r} cy={70 + Math.sin(a) * r * 0.8} r={1.3 + rand() * 1.4} fill="#cfae74" stroke="#8a6a3a" strokeWidth={0.4} />;
          })}
          {/* caterpillar: green-brown body with dark spots, dark head with a pale upside-down Y */}
          <g transform="translate(108,60) rotate(-25) scale(1.7)">
            {[0, 1, 2, 3, 4, 5].map(k => (
              <g key={k}>
                <circle cx={k * 5.2} cy={Math.sin(k) * 1.5} r={4} fill="#6f7a3a" stroke="#3f4520" strokeWidth={0.6} />
                <circle cx={k * 5.2} cy={Math.sin(k) * 1.5 - 2} r={0.8} fill="#222" />
              </g>
            ))}
            <circle cx={-4.5} cy={0} r={4.4} fill="#3a2414" />
            <path d="M-6.5,2.5 L-4.5,-0.5 L-2.5,2.5 M-4.5,-0.5 L-4.5,-3.5" stroke="#f2e6c8" strokeWidth={0.9} fill="none" />
          </g>
        </>
      )}
    </>
  );
}

/** Underside of a bean leaf. Drought: limp, curling, dull edges, and no insects anywhere. */
function LeafUnderside({ cond, kale = false }: { cond: Condition; kale?: boolean }) {
  const dry = cond === 'drought';
  return (
    <>
      <rect width={PART_W} height={PART_H} fill="#f6ead2" />
      <g transform={`translate(100,72) rotate(${dry ? 18 : -8})`}>
        <path
          d={dry ? 'M-70,0 Q-40,-38 0,-40 Q42,-36 70,4 Q40,30 0,34 Q-44,30 -70,0 Z' : 'M-74,0 Q-40,-46 0,-48 Q46,-44 76,0 Q44,44 0,46 Q-44,42 -74,0 Z'}
          fill={dry ? '#a4b27a' : cond === 'nitrogen' ? '#cdd36a' : kale ? '#86b89c' : '#8cc86a'}
          stroke={dry ? '#8f7034' : kale ? '#2f6a50' : '#3f8f2f'}
          strokeWidth={dry ? 3 : 1.5}
        />
        <path d="M-70,0 L72,2" stroke="#e8f2d0" strokeWidth={2} />
        {[-50, -25, 0, 25, 50].map(x => (
          <path key={x} d={`M${x},1 Q${x + 10},-18 ${x + 18},-30 M${x},1 Q${x + 10},18 ${x + 18},28`} stroke="#e8f2d0" strokeWidth={1.1} fill="none" />
        ))}
        {dry && <path d="M50,-26 Q66,-12 70,4" stroke="#7a5a24" strokeWidth={3} fill="none" />}
        {cond === 'aphids' &&
          (() => {
            const rand = rng(41);
            return [
              [-40, -14],
              [-8, 12],
              [30, -10],
              [10, -26],
            ].flatMap(([cx, cy], g) =>
              Array.from({ length: 16 }, (_, k) => (
                <ellipse key={`${g}-${k}`} cx={cx + (rand() - 0.5) * 22} cy={cy + (rand() - 0.5) * 14} rx={2.3} ry={1.6} transform={`rotate(${rand() * 180} ${cx} ${cy})`} fill={k % 4 ? '#52703a' : '#9bb36a'} stroke="#2f4521" strokeWidth={0.4} />
              )),
            );
          })()}
      </g>
    </>
  );
}

/** The shamba from above: problem rows stand out as a band. A blue furrow marks where water comes in. */
function TopDown({ crop, cond, problemRows, rows }: { crop: Crop; cond: Condition; problemRows: number[]; rows: number }) {
  const rand = rng(31);
  const dry = cond === 'drought';
  const rowH = 104 / rows;
  return (
    <>
      <rect width={PART_W} height={PART_H} fill="#7fb24a" />
      <rect x={14} y={14} width={172} height={112} rx={6} fill={SOIL.moist} stroke="#3d2614" strokeWidth={2} />
      {Array.from({ length: rows }, (_, i) => {
        const y = 122 - (i + 0.5) * rowH; // row 0 at the bottom (front)
        const bad = problemRows.includes(i);
        return (
          <g key={i}>
            {bad && dry && <rect x={16} y={y - rowH / 2} width={168} height={rowH} fill={SOIL.dry} />}
            {Array.from({ length: 9 }, (_, k) => {
              const x = 28 + k * 18;
              if (crop === 'maize') {
                const col = bad ? (cond === 'armyworm' ? '#7f9a3a' : '#a4a856') : '#3f9b35';
                return (
                  <g key={k} transform={`translate(${x},${y}) rotate(${rand() * 60})`}>
                    {[0, 60, 120, 180, 240, 300].map(a => (
                      <path key={a} d="M0,0 L7,-1.4 L7,1.4 Z" transform={`rotate(${a})`} fill={col} />
                    ))}
                    {bad && cond === 'armyworm' && <circle r={1.8} fill="#c9a66b" />}
                    {bad && cond === 'armyworm' && <circle cx={4} cy={2} r={1.4} fill={SOIL.moist} />}
                  </g>
                );
              }
              const healthy = crop === 'kale' ? '#4f9070' : '#4fae3c';
              return <circle key={k} cx={x} cy={y} r={bad ? 4.4 : 6} fill={bad ? '#9aa66a' : healthy} stroke={bad ? '#8f7034' : '#2f6a50'} strokeWidth={0.8} />;
            })}
          </g>
        );
      })}
      {dry && <rect x={14} y={126} width={172} height={6} rx={3} fill="#4fa3d1" />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Farmer                                                               */
/* ------------------------------------------------------------------ */

/** The player's farmer. Feet at (0,0), about 80 units tall. */
export function FarmerFigure({ look, pose = 'stand', facing = 1 }: { look: Look; pose?: 'stand' | 'walk' | 'cheer'; facing?: 1 | -1 }) {
  const arm = pose === 'cheer' ? 'M-9,-52 L-17,-70 M9,-52 L17,-70' : 'M-9,-52 L-13,-34 M9,-52 L13,-34';
  return (
    <g transform={`scale(${facing},1)`} className={`farmer farmer-${pose}`}>
      <ellipse cx={0} cy={0} rx={13} ry={3} fill="rgba(0,0,0,0.25)" />
      <g className="leg-l">
        <path d="M-4,-24 L-5,-3" stroke="#3b2a1e" strokeWidth={5} strokeLinecap="round" />
        <ellipse cx={-6} cy={-1.5} rx={4} ry={2} fill="#2a1d14" />
      </g>
      <g className="leg-r">
        <path d="M4,-24 L5,-3" stroke="#3b2a1e" strokeWidth={5} strokeLinecap="round" />
        <ellipse cx={6} cy={-1.5} rx={4} ry={2} fill="#2a1d14" />
      </g>
      <path d={arm} stroke={look.skin} strokeWidth={4.5} strokeLinecap="round" />
      <path d="M-10,-56 Q0,-60 10,-56 L13,-22 Q0,-18 -13,-22 Z" fill={look.outfit} />
      <path d="M-12,-30 L12,-30" stroke={look.trim} strokeWidth={2.5} />
      <path d="M-6,-56 L0,-50 L6,-56" stroke={look.trim} strokeWidth={1.6} fill="none" />
      <rect x={-3} y={-62} width={6} height={6} fill={look.skin} />
      <circle cx={0} cy={-69} r={9.5} fill={look.skin} />
      <circle cx={3.6} cy={-70} r={1.2} fill="#1d120b" />
      <circle cx={-2.6} cy={-70} r={1.2} fill="#1d120b" />
      <path d={pose === 'cheer' ? 'M-3,-65 Q1,-61 5,-65' : 'M-2,-65 Q1,-63 4,-65'} stroke="#1d120b" strokeWidth={1} fill={pose === 'cheer' ? '#7a2a1a' : 'none'} />
      {look.head === 'wrap' && (
        <>
          <path d="M-10.5,-71 Q-10,-84 0,-85 Q11,-84 10.5,-71 Q0,-76 -10.5,-71 Z" fill={look.headColor} />
          <circle cx={-9} cy={-80} r={3.4} fill={look.headColor} />
        </>
      )}
      {look.head === 'cap' && (
        <>
          <path d="M-10,-72 Q-9,-82 0,-82 Q9,-82 10,-72 Z" fill={look.headColor} />
          <path d="M6,-73 L18,-71 L10,-70 Z" fill={look.headColor} />
        </>
      )}
      {look.head === 'none' && <path d="M-9.8,-70 Q-9,-80 0,-80 Q9,-80 9.8,-70 Q6,-75 0,-75 Q-6,-75 -9.8,-70 Z" fill={look.headColor} />}
    </g>
  );
}

/** Head-and-shoulders portrait for the HUD and picker. */
export function FarmerPortrait({ look, size = 48 }: { look: Look; size?: number }) {
  return (
    <svg viewBox="-20 -92 40 44" width={size} height={size * 1.1} aria-hidden="true">
      <FarmerFigure look={look} />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Village pieces                                                       */
/* ------------------------------------------------------------------ */

export function Hut({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <ellipse cx={0} cy={2} rx={30} ry={8} fill="rgba(0,0,0,0.2)" />
      <path d="M-24,0 L-24,-26 Q0,-32 24,-26 L24,0 Q0,6 -24,0 Z" fill="#c98d55" stroke="#8a5a30" strokeWidth={1.5} />
      <rect x={-6} y={-18} width={12} height={18} rx={2} fill="#5a3618" />
      <path d="M-32,-24 L0,-58 L32,-24 Q0,-16 -32,-24 Z" fill="#d6aa52" stroke="#9a7428" strokeWidth={1.5} />
      <path d="M-20,-30 L0,-52 M0,-52 L20,-30 M-8,-28 L0,-52 L8,-28" stroke="#b08a3a" strokeWidth={1.2} fill="none" />
    </g>
  );
}

export function Tree({ x, y, s = 1, kind = 'acacia' }: { x: number; y: number; s?: number; kind?: 'acacia' | 'banana' | 'bush' }) {
  if (kind === 'banana')
    return (
      <g transform={`translate(${x},${y}) scale(${s})`}>
        <rect x={-2.5} y={-30} width={5} height={30} fill="#7a8a3a" />
        {[-60, -20, 25, 65].map(a => (
          <path key={a} d="M0,-30 Q14,-44 30,-38 Q14,-34 0,-30 Z" transform={`rotate(${a} 0 -30)`} fill="#5fae3a" stroke="#3f7f26" strokeWidth={0.8} />
        ))}
      </g>
    );
  if (kind === 'bush')
    return (
      <g transform={`translate(${x},${y}) scale(${s})`}>
        <ellipse cx={0} cy={-8} rx={16} ry={10} fill="#3f8a2e" />
        <ellipse cx={-6} cy={-12} rx={8} ry={6} fill="#5aa83e" />
      </g>
    );
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <ellipse cx={0} cy={2} rx={22} ry={5} fill="rgba(0,0,0,0.18)" />
      <path d="M-2,0 L-1,-30 L-10,-44 M-1,-30 L8,-46" stroke="#6a4a2a" strokeWidth={4} fill="none" strokeLinecap="round" />
      <ellipse cx={0} cy={-50} rx={36} ry={11} fill="#3f8a2e" />
      <ellipse cx={-8} cy={-54} rx={22} ry={7} fill="#56a23c" />
    </g>
  );
}

/** A shamba on the village map. */
export function MapShamba({
  x,
  y,
  w,
  h,
  crop,
  dim = false,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  crop: 'maize' | 'beans' | 'kale' | 'tea';
  dim?: boolean;
}) {
  const skew = h * 0.35;
  const rows = 4;
  const plants: ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    const fy = y + 10 + (r * (h - 18)) / (rows - 1);
    const off = skew * (1 - (fy - y) / h);
    for (let k = 0; k < 6; k++) {
      const fx = x + off + 12 + (k * (w - skew - 24)) / 5;
      if (crop === 'maize')
        plants.push(
          <g key={`${r}-${k}`} transform={`translate(${fx},${fy})`}>
            <path d="M0,0 L-5,-14 M0,0 L0,-17 M0,0 L5,-14 M0,-6 L-7,-9 M0,-6 L7,-9" stroke="#3f9b35" strokeWidth={2} strokeLinecap="round" />
          </g>,
        );
      else if (crop === 'tea') plants.push(<ellipse key={`${r}-${k}`} cx={fx} cy={fy - 3} rx={11} ry={6} fill="#2f7a35" stroke="#1f5a24" />);
      else plants.push(<circle key={`${r}-${k}`} cx={fx} cy={fy - 3} r={crop === 'kale' ? 5.5 : 4.5} fill={crop === 'kale' ? '#4f8f7a' : '#4fae3c'} stroke="#2a6a2a" strokeWidth={0.8} />);
    }
  }
  return (
    <g opacity={dim ? 0.55 : 1}>
      <polygon points={`${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}`} fill="#6b4528" stroke="#4a2e18" strokeWidth={2} />
      {Array.from({ length: rows }, (_, r) => {
        const fy = y + 10 + (r * (h - 18)) / (rows - 1);
        const off = skew * (1 - (fy - y) / h);
        return <line key={r} x1={x + off + 6} y1={fy + 1} x2={x + off + w - skew - 6} y2={fy + 1} stroke="#4f3018" strokeWidth={3} />;
      })}
      {plants}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Water: the furrow that feeds the shamba and the level in the tank    */
/* ------------------------------------------------------------------ */

export function WaterArt({ dry, ring = false }: { dry: boolean; ring?: boolean }) {
  const rand = rng(51);
  const level = dry ? 0.14 : 0.7;
  return (
    <svg viewBox={`0 0 ${PART_W} ${PART_H}`} width="100%" height="100%" role="img" aria-label="Water for the shamba">
      <rect width={PART_W} height={PART_H} fill="#f6ead2" />
      <rect y={92} width={PART_W} height={48} fill={dry ? '#c39b68' : '#6b4528'} />
      {/* tank with a gauge */}
      <rect x={14} y={14} width={54} height={86} rx={9} fill="#2e86c1" stroke="#1d5a86" strokeWidth={2} />
      <rect x={22} y={22} width={14} height={70} rx={5} fill="#d9eaf5" />
      <rect x={22} y={22 + 70 * (1 - level)} width={14} height={70 * level} rx={5} fill="#2fa8e6" />
      <path d="M40,32 h20 M40,50 h14 M40,68 h20 M40,86 h14" stroke="#d9eaf5" strokeWidth={1.4} />
      <rect x={32} y={100} width={6} height={10} fill="#1d5a86" />
      {/* furrow between the rows */}
      <path d="M72,112 L196,104 L196,126 L72,134 Z" fill={dry ? '#a27c4c' : '#4a2f1b'} stroke="#3d2614" strokeWidth={1.5} />
      {dry ? (
        <>
          {Array.from({ length: 9 }, (_, k) => {
            const x = 84 + rand() * 100;
            const y = 112 + rand() * 14;
            return <polyline key={k} points={`${x},${y} ${x + 5},${y + 4} ${x + 2},${y + 8}`} fill="none" stroke="#8a6a40" strokeWidth={1.3} />;
          })}
        </>
      ) : (
        <>
          <path d="M76,117 L194,109 L194,121 L76,129 Z" fill="#4fb3e8" opacity={0.95} />
          <path d="M90,119 h24 M130,115 h28 M168,112 h18" stroke="#d6f0fb" strokeWidth={1.6} strokeLinecap="round" />
        </>
      )}
      {ring && <circle className="clue-ring" cx={dry ? 130 : 100} cy={dry ? 118 : 60} r={dry ? 40 : 46} fill="none" stroke="#ffb005" strokeWidth={3.5} />}
    </svg>
  );
}
