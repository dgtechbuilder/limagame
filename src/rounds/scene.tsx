/* Drawn pictures for the field rounds that the older first-session art does not cover: seedlings and harvest-time
   crops, a broken fence, hail, flooding, disease, weeds, birds, and planting or harvesting at the wrong time.
   Five pictures per farm (200 × 140 each). A real photo, when one has been added, replaces the drawing. */

import { useId, type ReactNode } from 'react';
import { Plant, PART_H, PART_W, SOIL, SoilPatch, blob, rng } from '../first/art';
import type { Crop } from '../first/data';
import type { Round, RoundPart } from './data';

const SKY = '#f6ead2';
const DIRT = '#6b4528';
type Produce = 'green' | 'ripe' | 'late' | 'pecked';

/* ---------------- produce: cob, fruit, pods (drawn at a nominal size, scaled by the caller) ---------------- */

function Feather({ x, y, rot = 0, s = 1 }: { x: number; y: number; rot?: number; s?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot}) scale(${s})`}>
      <path d="M-9,0 Q-3,-5 9,-1 Q-1,5 -9,0 Z" fill="#efe9dc" stroke="#8a8272" strokeWidth={0.6} />
      <path d="M-9,0 L9,-1" stroke="#8a8272" strokeWidth={0.6} />
    </g>
  );
}

/** Maize cob: stem end at the origin, tip at x = 60. Tomato: centred on the origin, radius 14. Bean pod: stem end at the origin, 40 long. */
function ProduceArt({ crop, state }: { crop: Crop; state: Produce }) {
  const rand = rng(77);
  if (crop === 'maize') {
    const kernel = state === 'green' ? '#dfe99a' : state === 'late' ? '#9a7428' : '#f2c230';
    const husk = state === 'green' ? '#5fae3a' : state === 'late' ? '#74552c' : '#d9c27a';
    return (
      <g>
        <ellipse cx={36} cy={0} rx={26} ry={11} fill={kernel} stroke="#8a6a24" strokeWidth={0.7} />
        {Array.from({ length: 8 }, (_, i) =>
          [-1, 0, 1].map(j => {
            const gone = state === 'pecked' && i > 2 && i < 6 && j !== 0;
            return <circle key={`${i}${j}`} cx={16 + i * 5.4} cy={j * 5.2} r={gone ? 2.8 : 2.3} fill={gone ? DIRT : state === 'green' ? '#cfdc7a' : '#e0a91c'} />;
          }),
        )}
        <path d="M0,0 Q10,-15 28,-10 Q14,-2 0,0 Z" fill={husk} stroke="#4a6a24" strokeWidth={0.6} />
        <path d="M0,0 Q10,15 28,10 Q14,2 0,0 Z" fill={husk} stroke="#4a6a24" strokeWidth={0.6} />
        {state !== 'late' && <path d="M60,0 q6,-3 10,-1 M60,1 q7,1 10,4 M60,-1 q6,-6 9,-7" stroke="#a87a3a" strokeWidth={0.9} fill="none" />}
        {state === 'late' &&
          Array.from({ length: 7 }, (_, k) => <circle key={k} cx={20 + rand() * 38} cy={-8 + rand() * 16} r={2 + rand() * 2.4} fill={k % 2 ? '#26421f' : '#1d1d1d'} opacity={0.85} />)}
        {state === 'pecked' && (
          <>
            <path d="M24,-9 q8,-6 12,-1 q-6,3 -12,1 Z M44,6 q6,4 10,0 q-5,-2 -10,0 Z" fill="#f3d9a0" stroke="#8a6a24" strokeWidth={0.5} />
            <Feather x={52} y={14} rot={20} s={0.9} />
          </>
        )}
      </g>
    );
  }
  if (crop === 'tomato') {
    const skin = state === 'green' ? '#7fbf4a' : state === 'late' ? '#8f2418' : '#d8382c';
    return (
      <g>
        <circle r={14} fill={skin} stroke={state === 'green' ? '#4f8a2a' : '#6a140e'} strokeWidth={0.8} />
        {state !== 'late' && <path d="M-8,-6 q2,-5 7,-6" stroke="#fff" strokeOpacity={0.5} strokeWidth={2} fill="none" strokeLinecap="round" />}
        <path d="M0,-14 l-6,-3 l5,1 l1,-4 l1,4 l5,-1 Z" fill="#3f8f2a" />
        {state === 'late' && (
          <>
            <path d="M-6,-8 l4,8 l-3,6 M5,-9 l-2,7 l4,5" stroke="#3a0a06" strokeWidth={1} fill="none" />
            {[[-8, 4], [6, 6], [2, -2], [8, -6]].map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r={3.2} fill="#ecefd8" opacity={0.85} />)}
          </>
        )}
        {state === 'pecked' && (
          <>
            <path d="M4,-12 q9,2 11,10 q-7,-1 -11,-10 Z" fill="#f0c8a0" stroke="#b0764a" strokeWidth={0.6} />
            <path d="M-12,2 q-3,6 2,10 q4,-5 -2,-10 Z" fill="#f0c8a0" />
            <Feather x={14} y={14} rot={-30} s={0.8} />
          </>
        )}
      </g>
    );
  }
  // beans
  const pod = state === 'green' ? '#6fbf3a' : state === 'late' ? '#6a4a22' : '#d2b668';
  return (
    <g>
      <path d="M0,0 Q20,-6 40,0 Q20,6 0,0 Z" fill={pod} stroke={state === 'green' ? '#3f7f22' : '#6a4a22'} strokeWidth={0.7} />
      {state === 'green' && [8, 16, 24, 32].map(x => <ellipse key={x} cx={x} cy={0} rx={2.4} ry={2.6} fill="#8fd85a" />)}
      {state === 'ripe' && [8, 16, 24, 32].map(x => <circle key={x} cx={x} cy={0} r={2.3} fill="#b79a4a" />)}
      {state === 'late' && (
        <>
          <path d="M6,0 Q20,-3 36,0" stroke="#1f140a" strokeWidth={1.4} fill="none" />
          {[[12, 7], [22, 9], [32, 7]].map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r={2.4} fill="#e9d9b0" />)}
        </>
      )}
      {state === 'pecked' && (
        <>
          <path d="M14,-3 l10,2 l-8,4 Z" fill={SKY} />
          <Feather x={34} y={9} rot={10} s={0.7} />
        </>
      )}
    </g>
  );
}

/* ---------------- one plant at one stage, with what has happened to it ---------------- */

type Mark = 'small' | 'bitten' | 'shred' | 'soggy' | 'spots' | 'weedy' | 'ripe' | 'green' | 'late' | 'pecked';
const BASE: Record<Crop, number> = { maize: 0.98, kale: 1.6, tomato: 1.35, beans: 1.55 };
const BOX: Record<Crop, { h: number; w: number }> = { maize: { h: 96, w: 48 }, beans: { h: 44, w: 24 }, kale: { h: 56, w: 30 }, tomato: { h: 68, w: 26 } };
const SPOT: Record<Crop, [string, string]> = { maize: ['#c2651c', '#7a3b10'], beans: ['#c2651c', '#7a3b10'], tomato: ['#5a3418', '#d7d58a'], kale: ['#d9c04a', '#7a5a1a'] };

function Specimen({ crop, early, x, y, marks, seed, uid }: { crop: Crop; early: boolean; x: number; y: number; marks: Mark[]; seed: number; uid: string }) {
  const has = (m: Mark) => marks.includes(m);
  const rand = rng(seed * 13 + 5);
  const { h, w } = BOX[crop];
  const s = BASE[crop] * (early ? 0.62 : has('small') ? 0.5 : 1);
  const produce: Produce | null = has('late') ? 'late' : has('pecked') ? 'pecked' : has('green') ? 'green' : has('ripe') ? 'ripe' : null;
  const cond = has('soggy') ? 'nitrogen' : has('late') ? 'drought' : 'healthy';
  const clip = `cut-${uid}-${seed}`;
  const body = <Plant crop={crop} x={0} y={0} s={1} cond={cond} seed={seed} bg={SKY} />;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <g transform={has('shred') ? 'rotate(8)' : has('bitten') ? 'rotate(10)' : undefined}>
        {has('bitten') ? (
          <>
            <clipPath id={clip}>
              <rect x={-90} y={-h * 0.4} width={180} height={h * 0.4 + 6} />
            </clipPath>
            <g clipPath={`url(#${clip})`}>{body}</g>
            <path d={`M-4,${-h * 0.4} l2,-4 l2,3 l2,-4 l2,5 l1,-3 l0,6 l-9,0 Z`} fill="#e6d6a4" stroke="#8a7a44" strokeWidth={0.6} />
          </>
        ) : (
          body
        )}
      </g>
      {has('bitten') && [[-22, 2], [16, 1], [30, 3], [-34, 0]].map(([px, py], i) => <ellipse key={i} cx={px} cy={py} rx={5} ry={1.8} fill="#4f9b35" transform={`rotate(${i * 25} ${px} ${py})`} />)}
      {has('spots') &&
        Array.from({ length: crop === 'tomato' ? 7 : 16 }, (_, i) => {
          const px = (rand() - 0.5) * w * 1.6;
          const py = -h * (0.2 + rand() * 0.75);
          return crop === 'tomato' ? (
            <circle key={i} cx={px} cy={py} r={4.6} fill={SPOT[crop][0]} stroke={SPOT[crop][1]} strokeWidth={1.6} />
          ) : (
            <circle key={i} cx={px} cy={py} r={crop === 'kale' ? 3.4 : 2.2} fill={SPOT[crop][0]} stroke={SPOT[crop][1]} strokeWidth={0.6} />
          );
        })}
      {has('shred') && (
        <>
          {Array.from({ length: 12 }, (_, i) => (
            <polygon key={i} points={blob((rand() - 0.5) * w * 1.5, -h * (0.15 + rand() * 0.8), 4 + rand() * 4, rand, 6)} fill={SKY} stroke="#7a5a24" strokeWidth={0.7} />
          ))}
          {Array.from({ length: 8 }, (_, i) => {
            const px = (rand() - 0.5) * w * 1.5;
            const py = -h * (0.2 + rand() * 0.7);
            return <path key={i} d={`M${px},${py} l${6 + rand() * 6},${3 + rand() * 4}`} stroke="#fff" strokeOpacity={0.8} strokeWidth={1.6} strokeLinecap="round" />;
          })}
        </>
      )}
      {has('soggy') && (
        <>
          <ellipse cx={0} cy={-h * 0.55} rx={w * 1.15} ry={h * 0.42} fill="#d9c94c" opacity={0.38} />
          <ellipse cx={0} cy={2} rx={w * 1.2} ry={7} fill="#8a7a4a" opacity={0.92} />
          <path d={`M${-w},1 h${w * 0.8} M${w * 0.2},4 h${w * 0.8}`} stroke="#d9cfa0" strokeWidth={1.4} strokeLinecap="round" />
        </>
      )}
      {has('weedy') && (
        <g>
          {[-1.1, -0.65, -0.2, 0.25, 0.7, 1.15].map((f, i) => (
            <g key={i} transform={`translate(${f * w},2)`}>
              {[-9, -3, 4, 10].map((a, k) => (
                <path key={k} d={`M0,0 Q${a * 0.4},${-h * 0.2} ${a},${-h * (0.3 + ((i + k) % 3) * 0.1)}`} stroke={k % 2 ? '#6fbf3a' : '#8fd45a'} strokeWidth={2.6} fill="none" strokeLinecap="round" />
              ))}
              {i % 2 === 0 && <circle cx={4} cy={-h * 0.45} r={3} fill="#f5d33a" />}
            </g>
          ))}
        </g>
      )}
      {produce && crop === 'maize' && (
        <g>
          <path d="M0,-96 L-9,-110 M0,-96 L0,-114 M0,-96 L9,-110 M0,-96 L-15,-104 M0,-96 L15,-104" stroke={produce === 'late' ? '#8a6a3a' : '#d8b24a'} strokeWidth={1.4} />
          <g transform={`translate(0,-58) rotate(${produce === 'late' ? 40 : -45}) scale(0.5)`}>
            <ProduceArt crop="maize" state={produce} />
          </g>
          <g transform={`translate(0,-44) rotate(${produce === 'late' ? 140 : -135}) scale(0.5)`}>
            <ProduceArt crop="maize" state={produce} />
          </g>
        </g>
      )}
      {produce && crop === 'tomato' &&
        [[-9, -14], [9, -11], [-4, -26], [12, -27], [-14, -33], [4, -40]].map(([fx, fy], i) => (
          <g key={i} transform={`translate(${fx},${fy}) scale(${i % 3 === 2 ? 0.28 : 0.34})`}>
            <ProduceArt crop="tomato" state={produce} />
          </g>
        ))}
      {produce && crop === 'beans' &&
        [[-8, -22, 70], [6, -24, 105], [-2, -30, 80], [12, -16, 120]].map(([px, py, a], i) => (
          <g key={i} transform={`translate(${px},${py}) rotate(${a}) scale(0.6)`}>
            <ProduceArt crop="beans" state={produce} />
          </g>
        ))}
      {produce === 'late' && crop !== 'kale' && [[-20, 4], [14, 5], [26, 3]].map(([px, py], i) => <circle key={i} cx={px} cy={py} r={4} fill="#4a2a14" opacity={0.85} />)}
      {produce === 'pecked' && <Feather x={26} y={2} rot={15} s={1.1} />}
    </g>
  );
}

/* ---------------- the five pictures ---------------- */

const lab = (x: number, text: string) => (
  <text x={x} y={133} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff" stroke="#3d2614" strokeWidth={2.4} paintOrder="stroke" fontFamily="Poppins, sans-serif">
    {text}
  </text>
);

/** What the problem plant looks like, in the crop picture. */
function marksFor(r: Round): Mark[] {
  const harvest = r.stage === 'harvest';
  const ripe: Mark[] = harvest && r.crop !== 'kale' ? ['ripe'] : [];
  switch (r.hazard) {
    case 'flood': return ['soggy', ...ripe];
    case 'disease': return ['spots', ...ripe];
    case 'weeds': return ['weedy'];
    case 'livestock': return ['bitten'];
    case 'wildlife': return ['pecked'];
    case 'hail': return ['shred', ...ripe];
    case 'plantLate': return ['small'];
    case 'harvestEarly': return ['green'];
    case 'harvestLate': return ['late'];
    default: return ripe;
  }
}

function CropPic({ r, uid }: { r: Round; uid: string }) {
  const harvest = r.stage === 'harvest' && r.crop !== 'kale';
  const early = r.stage === 'young';
  const refMarks: Mark[] = harvest ? ['ripe'] : [];
  const flooded = r.hazard === 'flood';
  const dryGround = r.hazard === 'plantEarly';
  const sparse = r.hazard === 'plantEarly';
  const rand = rng(61);
  return (
    <>
      <rect width={PART_W} height={PART_H} fill={SKY} />
      <rect y={112} width={PART_W} height={28} fill={DIRT} />
      {dryGround && <rect x={100} y={112} width={100} height={28} fill="#b9925f" />}
      {flooded && <rect x={100} y={112} width={100} height={28} fill="#8a7a4a" />}
      <line x1={100} y1={8} x2={100} y2={112} stroke="#6b402b" strokeOpacity={0.15} strokeDasharray="3 3" />
      <Specimen crop={r.crop} early={early} x={52} y={118} marks={refMarks} seed={11} uid={uid} />
      {sparse ? (
        <g>
          {[0, 1, 2, 3, 4, 5].map(k => (
            <circle key={k} cx={112 + k * 14 + rand() * 4} cy={119 + rand() * 6} r={1.5} fill="#e9d98a" stroke="#8a6a24" strokeWidth={0.4} />
          ))}
          <path d="M148,118 q-1,-9 5,-12 M149,118 q-6,-6 -3,-12" stroke="#9a9a4a" strokeWidth={1.6} fill="none" strokeLinecap="round" />
          <path d="M176,119 q2,-6 6,-7" stroke="#9a9a4a" strokeWidth={1.4} fill="none" strokeLinecap="round" />
          <path d="M108,119 q-1,-5 3,-7" stroke="#9a9a4a" strokeWidth={1.4} fill="none" strokeLinecap="round" />
        </g>
      ) : (
        <Specimen crop={r.crop} early={early} x={148} y={118} marks={marksFor(r)} seed={12} uid={uid} />
      )}
      {lab(52, 'A healthy plant')}
      {lab(148, 'This farm')}
    </>
  );
}

function LeafClose({ r }: { r: Round }) {
  const rand = rng(91);
  const maize = r.crop === 'maize';
  const base = r.crop === 'kale' ? '#4f9070' : '#4fae3c';
  const fill = r.hazard === 'flood' ? '#c9cf5a' : base;
  const shape = maize ? 'M6,76 Q96,36 194,60 Q100,92 6,76 Z' : 'M16,72 Q50,18 100,16 Q152,18 186,72 Q150,128 100,128 Q50,128 16,72 Z';
  const at = () => (maize ? { x: 20 + rand() * 160, y: 0 } : { x: 36 + rand() * 128, y: 0 });
  const yOf = (x: number) => (maize ? 78 - (x / 200) * 18 - Math.sin((x / 200) * Math.PI) * 18 : 72);
  const spread = maize ? 12 : 38;
  const items = Array.from({ length: r.hazard === 'disease' ? (r.crop === 'tomato' ? 6 : r.crop === 'kale' ? 0 : 26) : r.hazard === 'hail' ? 9 : 0 }, () => {
    const p = at();
    return { x: p.x, y: yOf(p.x) + (rand() - 0.5) * spread * 2 };
  });
  return (
    <>
      <rect width={PART_W} height={PART_H} fill={SKY} />
      <path d={shape} fill={fill} stroke={r.crop === 'kale' ? '#2f6a50' : '#2a6f24'} strokeWidth={2} />
      <path d={maize ? 'M10,76 Q100,52 190,62' : 'M18,72 L184,72 M60,72 L90,40 M60,72 L90,104 M110,72 L140,42 M110,72 L140,102'} stroke={r.hazard === 'flood' ? '#f0efb0' : '#a9dd86'} strokeWidth={2} fill="none" />
      {r.hazard === 'disease' && r.crop === 'tomato' && items.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={7 + (i % 3) * 2} fill="#5a3418" stroke="#d9d86a" strokeWidth={3} />)}
      {r.hazard === 'disease' && (r.crop === 'maize' || r.crop === 'beans') && items.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={2.6} fill="#c2651c" stroke="#7a3b10" strokeWidth={0.8} />)}
      {r.hazard === 'disease' && r.crop === 'kale' && (
        <>
          <path d="M40,70 L18,60 L24,92 Z" fill="#d9c04a" stroke="#7a5a1a" />
          <path d="M100,16 L82,40 L118,40 Z M160,60 L186,72 L160,88 Z M100,128 L84,104 L118,106 Z" fill="#d9c04a" stroke="#7a5a1a" />
          <path d="M50,74 L24,70 M100,22 L100,34 M170,72 L182,72" stroke="#7a5a1a" strokeWidth={2} />
        </>
      )}
      {r.hazard === 'hail' && (
        <>
          {items.map((p, i) => <polygon key={i} points={blob(p.x, p.y, 7 + (i % 3) * 3, rand, 7)} fill={SKY} stroke="#7a5a24" strokeWidth={1.2} />)}
          {[[40, 60], [120, 90], [150, 50], [70, 100]].map(([x, y], i) => <path key={i} d={`M${x},${y} l14,6`} stroke="#fff" strokeOpacity={0.85} strokeWidth={3} strokeLinecap="round" />)}
        </>
      )}
      {r.hazard === 'flood' && [[60, 50], [130, 98], [150, 56]].map(([x, y], i) => <path key={i} d={`M${x},${y} q5,8 0,11 q-5,-3 0,-11 Z`} fill="#8fd0f0" />)}
    </>
  );
}

function ProduceClose({ r, state }: { r: Round; state: Produce }) {
  return (
    <>
      <rect width={PART_W} height={PART_H} fill="#e9dcc0" />
      <rect y={118} width={PART_W} height={22} fill={DIRT} />
      {r.crop === 'maize' && (
        <g transform="translate(26,66) rotate(-6) scale(2.3)">
          <ProduceArt crop="maize" state={state} />
        </g>
      )}
      {r.crop === 'tomato' && (
        <g transform="translate(100,72) scale(3.2)">
          <ProduceArt crop="tomato" state={state} />
        </g>
      )}
      {r.crop === 'beans' &&
        [[16, 46, -6], [30, 92, 3]].map(([x, y, a], i) => (
          <g key={i} transform={`translate(${x},${y}) rotate(${a}) scale(4)`}>
            <ProduceArt crop="beans" state={state} />
          </g>
        ))}
      {state === 'late' && r.crop === 'beans' && [[40, 128], [70, 124], [100, 130], [140, 126]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx={5} ry={3.4} fill="#e9d9b0" stroke="#8a6a3a" strokeWidth={0.6} />)}
      {state === 'pecked' && (
        <>
          <Feather x={168} y={118} rot={-15} s={2.4} />
          <Feather x={150} y={104} rot={30} s={1.8} />
        </>
      )}
    </>
  );
}

function CloseUp({ r }: { r: Round }) {
  const rand = rng(101);
  if (r.hazard === 'wildlife') return <ProduceClose r={r} state="pecked" />;
  if (r.hazard === 'harvestEarly') return <ProduceClose r={r} state="green" />;
  if (r.hazard === 'harvestLate') return <ProduceClose r={r} state="late" />;
  if (r.hazard === 'healthy' && r.stage === 'harvest' && r.crop !== 'kale') return <ProduceClose r={r} state="ripe" />;
  if (r.hazard === 'weeds') {
    return (
      <>
        <rect width={PART_W} height={PART_H} fill={DIRT} />
        <path d="M100,140 L100,40" stroke="#5c8f2c" strokeWidth={6} />
        <path d="M100,60 Q60,40 40,56 M100,76 Q140,52 166,66" stroke="#4fae3c" strokeWidth={9} fill="none" strokeLinecap="round" />
        {Array.from({ length: 16 }, (_, k) => {
          const x = 10 + rand() * 180;
          const hgt = 40 + rand() * 60;
          return <path key={k} d={`M${x},142 Q${x + (rand() - 0.5) * 30},${142 - hgt * 0.5} ${x + (rand() - 0.5) * 36},${142 - hgt}`} stroke={k % 2 ? '#8fd45a' : '#6fbf3a'} strokeWidth={3.2} fill="none" strokeLinecap="round" />;
        })}
        {[[34, 56], [150, 40], [70, 34], [176, 80]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4} fill="#f5d33a" stroke="#b98a10" strokeWidth={0.8} />)}
      </>
    );
  }
  if (r.hazard === 'livestock') {
    return (
      <>
        <rect width={PART_W} height={PART_H} fill={DIRT} />
        <path d="M70,140 L70,66 L66,60 L72,56 L76,62 L80,56 L82,64 L78,70 L80,140 Z" fill="#9ac76a" stroke="#4f7a2a" strokeWidth={1} />
        <path d="M60,64 l20,0" stroke="#e6d6a4" strokeWidth={4} />
        <ellipse cx={140} cy={60} rx={30} ry={7} fill="#4f9b35" transform="rotate(-20 140 60)" />
        <ellipse cx={30} cy={100} rx={24} ry={6} fill="#4f9b35" transform="rotate(14 30 100)" />
        {Array.from({ length: 18 }, (_, k) => <ellipse key={k} cx={104 + rand() * 80} cy={96 + rand() * 36} rx={3.6} ry={2.4} fill="#2a1a10" transform={`rotate(${rand() * 180} 140 110)`} />)}
        {[[130, 82], [172, 92]].map(([x, y], i) => (
          <g key={i} transform={`translate(${x},${y}) rotate(${i * 14})`} fill="#2a1a10" opacity={0.75}>
            <path d="M-6,0 q-3,-8 2,-12 q3,6 -2,12 Z M6,0 q3,-8 -2,-12 q-3,6 2,12 Z" />
          </g>
        ))}
      </>
    );
  }
  if (r.hazard === 'plantEarly') {
    const kernel = r.crop === 'beans' ? '#8a5a30' : r.crop === 'tomato' ? '#e8dcaa' : '#f2c230';
    return (
      <>
        <rect width={PART_W} height={PART_H} fill="#c39b68" />
        {Array.from({ length: 9 }, (_, k) => {
          const x = 10 + rand() * 170;
          const y = 8 + rand() * 120;
          return <polyline key={k} points={`${x},${y} ${x + 10},${y + 7} ${x + 5},${y + 16} ${x + 16},${y + 22}`} fill="none" stroke="#8a6a40" strokeWidth={1.8} />;
        })}
        {[[40, 50], [100, 90], [150, 40], [70, 112], [160, 100], [120, 30]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={r.crop === 'tomato' ? 4 : 8} ry={r.crop === 'tomato' ? 2.6 : 5.4} fill={kernel} stroke="#8a6a24" strokeWidth={0.8} transform={`rotate(${i * 40} ${x} ${y})`} />
        ))}
        <path d="M96,86 q-6,-14 6,-22 q-2,10 4,12" stroke="#7a6a3a" strokeWidth={2} fill="none" strokeLinecap="round" />
      </>
    );
  }
  return <LeafClose r={r} />;
}

/** The right-hand soil patch in the soil picture. */
function SoilPic({ r }: { r: Round }) {
  const rand = rng(121);
  const dry = r.hazard === 'plantEarly';
  const x0 = 104;
  return (
    <>
      <rect width={PART_W} height={PART_H} fill={SKY} />
      <SoilPatch x={8} y={18} w={88} h={98} dry={false} seed={3} />
      <SoilPatch x={x0} y={18} w={88} h={98} dry={dry} seed={4} />
      {r.hazard === 'flood' && (
        <g>
          <rect x={x0} y={18} width={88} height={98} rx={8} fill="#8a7a4a" opacity={0.92} />
          <path d={`M${x0 + 10},44 h30 M${x0 + 44},62 h32 M${x0 + 16},82 h34 M${x0 + 50},100 h26`} stroke="#d9cfa0" strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )}
      {r.hazard === 'livestock' &&
        [[16, 30], [52, 44], [26, 64], [60, 78], [30, 98]].map(([dx, dy], i) => (
          <g key={i} transform={`translate(${x0 + dx},${18 + dy}) rotate(${i * 25 - 20})`} fill="#2a1a10" opacity={0.85}>
            <path d="M-5,0 q-3,-9 2,-11 q3,5 -2,11 Z M5,0 q3,-9 -2,-11 q-3,5 2,11 Z" />
          </g>
        ))}
      {r.hazard === 'livestock' && Array.from({ length: 10 }, (_, k) => <ellipse key={k} cx={x0 + 8 + rand() * 72} cy={26 + rand() * 82} rx={2.6} ry={1.8} fill="#1d120a" />)}
      {r.hazard === 'hail' && Array.from({ length: 24 }, (_, k) => <circle key={k} cx={x0 + 6 + rand() * 76} cy={24 + rand() * 86} r={2 + rand() * 2.4} fill="#fff" stroke="#c9dfe8" strokeWidth={0.6} />)}
      {r.hazard === 'weeds' &&
        Array.from({ length: 9 }, (_, k) => {
          const x = x0 + 8 + rand() * 72;
          const y = 42 + rand() * 70;
          return <path key={k} d={`M${x},${y} q-5,-12 -8,-16 M${x},${y} q0,-14 2,-20 M${x},${y} q5,-12 9,-15`} stroke={k % 2 ? '#8fd45a' : '#6fbf3a'} strokeWidth={2.4} fill="none" strokeLinecap="round" />;
        })}
      {dry && Array.from({ length: 7 }, (_, k) => <ellipse key={k} cx={x0 + 10 + rand() * 68} cy={26 + rand() * 82} rx={4} ry={2.6} fill={r.crop === 'beans' ? '#8a5a30' : '#f2c230'} stroke="#8a6a24" strokeWidth={0.6} transform={`rotate(${k * 37} ${x0 + 40} ${60})`} />)}
      {r.hazard === 'wildlife' && (
        <>
          {Array.from({ length: 12 }, (_, k) => <circle key={k} cx={x0 + 8 + rand() * 72} cy={26 + rand() * 82} r={2} fill={r.crop === 'tomato' ? '#d8382c' : '#f2c230'} />)}
          <Feather x={x0 + 24} y={52} rot={-20} s={1.5} />
          <Feather x={x0 + 60} y={86} rot={30} s={1.3} />
        </>
      )}
      {r.hazard === 'harvestLate' && Array.from({ length: 5 }, (_, k) => <circle key={k} cx={x0 + 14 + rand() * 60} cy={30 + rand() * 76} r={6} fill="#8a6a34" stroke="#2a3a22" strokeWidth={1.6} />)}
      {r.hazard === 'harvestEarly' && Array.from({ length: 6 }, (_, k) => <path key={k} d={`M${x0 + 10 + rand() * 66},${40 + rand() * 66} q8,-8 16,-2 q-8,8 -16,2 Z`} fill="#7fbf4a" stroke="#4f8a2a" strokeWidth={0.8} />)}
      {lab(52, 'A healthy plot')}
      {lab(148, 'This farm')}
    </>
  );
}

/* ---------------- the farm from above ---------------- */

function Marker({ crop, stage, x, y, tone }: { crop: Crop; stage: Round['stage']; x: number; y: number; tone: 'ok' | 'pale' | 'sick' | 'small' | 'torn' | 'cut' | 'ripe' | 'late' }) {
  const green = crop === 'kale' ? '#4f9070' : crop === 'maize' ? '#3f9b35' : '#4fae3c';
  if (tone === 'cut') return <circle cx={x} cy={y} r={1.6} fill="#cfae74" stroke="#8a6a3a" strokeWidth={0.4} />;
  const fill = tone === 'pale' ? '#b7cc7a' : tone === 'sick' ? '#a98a3a' : tone === 'torn' ? '#7f8f4a' : tone === 'late' ? '#a89a52' : green;
  const r = stage === 'young' || tone === 'small' ? 2.6 : 5.4;
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} stroke="#2a5a24" strokeWidth={0.7} />
      {tone === 'ripe' && <circle cx={x + 1.5} cy={y - 1.5} r={1.8} fill={crop === 'tomato' ? '#d8382c' : crop === 'maize' ? '#f2c230' : '#e9d98a'} />}
      {tone === 'torn' && <path d={`M${x - 3},${y - 1} l6,2`} stroke="#fff" strokeWidth={1} />}
    </g>
  );
}

function Goat({ x, y, flip = 1 }: { x: number; y: number; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${flip * 1.5},1.5)`}>
      <ellipse cx={0} cy={0} rx={9} ry={4.6} fill="#f3efe6" stroke="#8a7a64" strokeWidth={0.8} />
      <ellipse cx={-2} cy={-1} rx={3.4} ry={2} fill="#a8794a" />
      <circle cx={9} cy={-1} r={3.2} fill="#f3efe6" stroke="#8a7a64" strokeWidth={0.8} />
      <path d="M8,-4 l-1,-4 M10,-4 l1,-4" stroke="#5a4a38" strokeWidth={1.1} />
    </g>
  );
}

function Bird({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`} fill="#2b2b2b">
      <ellipse cx={0} cy={0} rx={4} ry={1.8} />
      <path d="M-1,0 l-3,-6 l5,4 Z M-1,0 l-3,6 l5,-4 Z" />
    </g>
  );
}

function FarmPic({ r }: { r: Round }) {
  const rand = rng(131);
  const rows = 5;
  const rowH = 100 / rows;
  const ripe = r.stage === 'harvest';
  const out: ReactNode[] = [];
  const goatsIn = r.hazard === 'livestock';
  for (let i = 0; i < rows; i++) {
    const y = 118 - (i + 0.5) * rowH;
    for (let k = 0; k < 9; k++) {
      const x = 28 + k * 18;
      let tone: Parameters<typeof Marker>[0]['tone'] = ripe ? 'ripe' : 'ok';
      let gone = false;
      if (r.hazard === 'plantEarly') {
        tone = 'small';
        gone = rand() < 0.62;
      } else if (r.hazard === 'plantLate') tone = i >= 2 ? 'small' : 'ok';
      else if (r.hazard === 'disease') tone = rand() < 0.5 && k > 3 && i < 3 ? 'sick' : tone;
      else if (r.hazard === 'hail') tone = 'torn';
      else if (r.hazard === 'harvestEarly') tone = k % 3 === 0 ? 'cut' : 'ok';
      else if (r.hazard === 'harvestLate') tone = 'late';
      else if (r.hazard === 'wildlife') tone = rand() < 0.4 ? 'pale' : tone;
      else if (r.hazard === 'weeds') tone = 'pale';
      else if (r.hazard === 'flood') tone = 'pale';
      if (goatsIn && x > 108 && x < 170 && i > 1) gone = true;
      if (gone) continue;
      out.push(<Marker key={`${i}-${k}`} crop={r.crop} stage={r.stage} x={x} y={y} tone={tone} />);
    }
  }
  const post = (x: number, y: number, k: string) => <rect key={k} x={x - 1.6} y={y - 1.6} width={3.2} height={3.2} fill="#7a5230" />;
  const posts: ReactNode[] = [];
  const wires: ReactNode[] = [];
  const gap: [number, number] = [118, 162];
  for (let x = 8; x <= 192; x += 23) {
    if (!(goatsIn && x > gap[0] && x < gap[1])) posts.push(post(x, 12, `t${x}`));
    posts.push(post(x, 126, `b${x}`));
  }
  for (let y = 12; y <= 126; y += 19) {
    posts.push(post(8, y, `l${y}`));
    posts.push(post(192, y, `r${y}`));
  }
  wires.push(<path key="w1" d={goatsIn ? `M8,12 L${gap[0]},12 M${gap[1]},12 L192,12` : 'M8,12 L192,12'} stroke="#7a5230" strokeWidth={0.9} />);
  wires.push(<path key="w2" d="M8,126 L192,126 M8,12 L8,126 M192,12 L192,126" stroke="#7a5230" strokeWidth={0.9} />);
  return (
    <>
      <rect width={PART_W} height={PART_H} fill="#7fb24a" />
      <rect x={14} y={18} width={172} height={100} rx={6} fill={r.hazard === 'plantEarly' ? '#b9925f' : SOIL.moist} stroke="#3d2614" strokeWidth={2} />
      {r.hazard === 'flood' && [[40, 60, 22], [100, 80, 26], [150, 50, 20], [70, 32, 16], [140, 100, 20]].map(([x, y, w], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={w} ry={6} fill="#9a8a55" opacity={0.9} />
          <ellipse cx={x - 4} cy={y - 1} rx={w * 0.5} ry={2} fill="#7fb4d1" opacity={0.7} />
        </g>
      ))}
      {goatsIn && <path d="M104,76 q30,6 62,-2 L168,118 L104,118 Z" fill="#4a2f1b" opacity={0.7} />}
      {out}
      {r.hazard === 'weeds' &&
        Array.from({ length: 22 }, (_, k) => {
          const x = 22 + rand() * 156;
          const y = 24 + rand() * 88;
          return (
            <g key={k}>
              <polygon points={blob(x, y, 6 + rand() * 4, rand, 7)} fill={k % 2 ? '#9ad64a' : '#7fc23a'} stroke="#3f7a1f" strokeWidth={0.5} />
              {k % 3 === 0 && <circle cx={x + 1} cy={y - 1} r={1.6} fill="#f5d33a" />}
            </g>
          );
        })}
      {r.hazard === 'hail' && Array.from({ length: 36 }, (_, k) => <circle key={k} cx={18 + rand() * 164} cy={22 + rand() * 92} r={1.2 + rand() * 1.6} fill="#fff" stroke="#c9dfe8" strokeWidth={0.4} />)}
      {r.hazard === 'harvestEarly' && [[160, 108], [168, 102], [154, 102], [164, 112], [172, 110]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={4.2} fill="#7fbf4a" stroke="#4f8a2a" strokeWidth={0.8} />)}
      {r.hazard === 'harvestLate' && Array.from({ length: 9 }, (_, k) => <circle key={k} cx={26 + rand() * 148} cy={24 + rand() * 90} r={2.6} fill="#4a2a14" stroke="#ecefd8" strokeOpacity={0.6} strokeWidth={0.8} />)}
      {wires}
      {posts}
      {goatsIn && (
        <>
          <path d="M126,12 l-6,10 M152,12 l7,8" stroke="#7a5230" strokeWidth={2.4} strokeLinecap="round" />
          <Goat x={126} y={92} />
          <Goat x={146} y={102} flip={-1} />
          <Goat x={154} y={84} />
        </>
      )}
      {r.hazard === 'wildlife' && [[40, 8, 20], [92, 5, -10], [138, 9, 25], [60, 66, 0], [110, 40, 35], [152, 70, -20]].map(([x, y, a], i) => <Bird key={i} x={x} y={y} rot={a} />)}
    </>
  );
}

/* ---------------- the five pictures, together ---------------- */

export function ringFor(r: Round, part: RoundPart): [number, number, number] {
  if (part === 'farm') return r.hazard === 'livestock' ? [140, 70, 40] : [100, 66, 56];
  if (part === 'pests') return [100, 70, 50];
  if (part === 'soil') return [148, 70, 44];
  if (part === 'water') return [120, 100, 44];
  return [148, 64, 44];
}

export function ScenePart({ round, part, ring = false }: { round: Round; part: Exclude<RoundPart, 'water'>; ring?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [rx, ry, rr] = ringFor(round, part);
  const body = part === 'crop' ? <CropPic r={round} uid={uid} /> : part === 'pests' ? <CloseUp r={round} /> : part === 'soil' ? <SoilPic r={round} /> : <FarmPic r={round} />;
  return (
    <svg viewBox={`0 0 ${PART_W} ${PART_H}`} width="100%" height="100%" role="img" aria-label={`${part} of the shamba`}>
      {body}
      {ring && <circle className="clue-ring" cx={rx} cy={ry} r={rr} fill="none" stroke="#ffb005" strokeWidth={3.5} />}
    </svg>
  );
}
