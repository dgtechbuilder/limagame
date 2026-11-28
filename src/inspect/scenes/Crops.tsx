import type { ReactNode } from 'react';
import { INK } from '../../art/anime';

/* The farm's other crops, drawn like the maize plant (Plant.tsx) and the cow: one plant up close in its bed on the
   480 × 270 scene, a bean bush, a kale (sukuma wiki) plant and a staked tomato. Each stands at x 240 with its roots in
   the cut-away soil, the drip line and its emitter, the weeds round it and the next plant in the row. Their parts are
   in src/inspect/subjects.ts (where the camera looks and where the player taps), their early signs in
   src/inspect/earlyFarm.ts; `e` holds the ones showing today, drawn where a field check finds them. */

const SW = 1.3;
const SOIL = '#8a5d3b';
const ROOT = '#e6d2a8';

type Scene = { uid: string; e: Set<string>; r: Set<string> };

/* ---------------- the bed every crop stands in ---------------- */

function Bed({ uid, e, r, row, rowSign, behind, children }: { uid: string; e: Set<string>; r: Set<string>; row: ReactNode; rowSign: string; behind: string; children: ReactNode }) {
  const dry = r.has('dry');
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={dry ? '#ffd88a' : '#cfe8f0'} />
          <stop offset="1" stopColor={dry ? '#ffe9b8' : '#eef6e2'} />
        </linearGradient>
      </defs>
      <rect x={-400} y={-300} width={1280} height={530} fill={`url(#${uid}-sky)`} stroke="none" />
      {/* the field behind: the same crop in rows, fading back */}
      <path d="M-400,176 C-200,168 0,172 240,168 C480,164 700,170 880,166 L880,230 L-400,230 Z" fill="#a9c97a" stroke="none" />
      {[-30, 40, 120, 340, 470, 540].map((x, i) => (
        <ellipse key={x} cx={x} cy={188 + (i % 2) * 6} rx={26} ry={18} fill={behind} stroke="none" opacity={0.7} />
      ))}
      {/* the soil, cut away in front to show the roots */}
      <rect x={-400} y={222} width={1280} height={200} fill={SOIL} stroke="none" />
      <path d="M-400,222 H880" fill="none" />
      <path d="M-400,232 C-200,228 0,236 240,230 C480,226 700,234 880,230" fill="none" stroke="#6e4a2e" strokeWidth={1} />
      {e.has('soilCrack') ? (
        <path d="M96,240 l8,6 l-4,7 l9,5 M132,236 l-6,8 l5,5 M70,250 l10,3" fill="none" stroke="#3d2716" strokeWidth={1.4} />
      ) : (
        <g>
          <path d="M70,240 C90,236 120,238 150,236" fill="none" stroke="#a5774f" strokeWidth={2} opacity={0.6} />
          {/* mulch */}
          <path d="M84,224 l10,-3 M100,225 l9,-2 M118,224 l8,-3 M136,225 l7,-2" fill="none" stroke="#c9a45a" strokeWidth={1.6} />
        </g>
      )}

      {/* the next plant in the row */}
      <g>{row}</g>
      {e.has(rowSign) && (
        <g stroke="none" fill="#e8d24a" opacity={0.85}>
          <ellipse cx={388} cy={146} rx={8} ry={4} transform="rotate(-20 388 146)" />
          <ellipse cx={414} cy={160} rx={7} ry={3.6} transform="rotate(18 414 160)" />
          <ellipse cx={398} cy={174} rx={6} ry={3} />
          <path d="M380,150 l6,-2 M408,158 l8,3" fill="none" stroke="#9a8a2a" strokeWidth={0.8} />
        </g>
      )}

      {/* the drip line along the row, with its emitter */}
      <path d="M-400,228 H880" fill="none" stroke="#2d2d2d" strokeWidth={3} />
      <circle cx={196} cy={228} r={3.6} fill="#3c3c3c" />
      {e.has('dripBlock') ? (
        <path d="M192,232 l-2,4 M200,232 l2,4" fill="none" stroke="#c9b08a" strokeWidth={1} />
      ) : (
        <g>
          <ellipse cx={196} cy={236} rx={14} ry={3} fill="#6a4630" stroke="none" />
          <path className="ex-drip is-slow" d="M196,232 c-1.6,2.4 -1.6,4 0,4.6 c1.6,-0.6 1.6,-2.2 0,-4.6 Z" fill="#8fd0ea" strokeWidth={0.7} />
        </g>
      )}

      {/* the weeds round it */}
      {e.has('weedsBase') ? (
        <g fill="#7cbf4a">
          <path d="M286,224 C282,212 288,204 294,200 C294,210 292,218 292,224 Z" />
          <path d="M296,224 C300,210 310,206 318,206 C310,214 304,220 302,224 Z" />
          <path d="M304,224 C304,214 296,208 288,206 C296,214 298,220 298,224 Z" />
          <path d="M318,224 C322,214 330,212 336,214 C330,218 326,222 324,224 Z" />
          <circle cx={295} cy={199} r={2.2} fill="#f2d24a" />
        </g>
      ) : (
        <path d="M304,224 C304,218 308,216 310,214" fill="none" stroke="#7cbf4a" strokeWidth={1.4} />
      )}

      {children}
    </g>
  );
}

/** The next plant: the same drawing, smaller, standing in the row at x 400 (no roots: they are under the soil). */
const Next = ({ children }: { children: ReactNode }) => <g transform="translate(400 224) scale(0.52) translate(-240 -226)">{children}</g>;

/** A leaf: an ellipse turned to its angle, with a midrib. */
function Leaf({ x, y, rx, ry, rot, fill, rib = true, w }: { x: number; y: number; rx: number; ry: number; rot: number; fill: string; rib?: boolean; w?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <ellipse rx={rx} ry={ry} fill={fill} strokeWidth={w} />
      {rib && <path d={`M${-rx + 2},0 H${rx - 3}`} fill="none" stroke="rgba(42,23,48,0.35)" strokeWidth={0.8} />}
    </g>
  );
}

/* ---------------- a bean bush, in flower and podding ---------------- */

const BEAN = '#6cb348';
const BEAN_DARK = '#4b8a33';

/** Three leaflets: the middle one forward, one each side. */
function Trifoliate({ x, y, s = 1, rot = 0, fill = BEAN }: { x: number; y: number; s?: number; rot?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <Leaf x={-11} y={4} rx={10} ry={6.5} rot={-150} fill={fill} />
      <Leaf x={11} y={4} rx={10} ry={6.5} rot={-30} fill={fill} />
      <Leaf x={0} y={-8} rx={12} ry={7.5} rot={-90} fill={fill} />
    </g>
  );
}

function BeanBody({ e, near }: { e: Set<string>; near?: boolean }) {
  return (
    <g>
      {/* the stem and its branches */}
      <path d="M240,226 C238,194 242,150 240,96" fill="none" stroke={INK} strokeWidth={6} />
      <path d="M240,226 C238,194 242,150 240,96" fill="none" stroke="#8cc45a" strokeWidth={3.8} />
      <path d="M240,172 C226,162 212,152 200,142 M240,150 C258,142 274,136 290,130 M240,124 C228,116 218,108 206,102 M240,112 C254,104 268,98 282,94 M239,186 C224,184 204,182 186,182 M241,158 C250,160 258,160 264,156" fill="none" stroke={BEAN_DARK} strokeWidth={2} />
      {near && e.has('beanFly') && (
        <g>
          <ellipse cx={239} cy={204} rx={5.2} ry={9} fill="#b07a48" />
          <path d="M237,198 l3,5 l-2,4 M241,206 l-1,5" fill="none" stroke="#5a3a20" strokeWidth={0.9} />
        </g>
      )}

      {/* the leaves; the low left one turned up to show its underside */}
      <Trifoliate x={200} y={140} s={1} rot={-14} />
      <Trifoliate x={294} y={128} s={1.12} rot={16} />
      <Trifoliate x={206} y={100} s={0.86} rot={-20} />
      <Trifoliate x={282} y={92} s={0.86} rot={18} />
      {near && (
        <g>
          <Leaf x={176} y={182} rx={14} ry={8} rot={-170} fill="#b9da94" />
          <path d="M166,180 l5,4 M174,177 l4,5 M182,178 l3,5" fill="none" stroke="rgba(42,23,48,0.3)" strokeWidth={0.7} />
        </g>
      )}
      {near && e.has('rust') && (
        <g fill="#c4672a" stroke="none">
          {[
            [286, 124],
            [292, 118],
            [300, 126],
            [296, 134],
            [306, 120],
            [282, 132],
            [304, 132],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={1.3} />
          ))}
        </g>
      )}

      {/* the young leaves at the top */}
      <Trifoliate x={240} y={84} s={0.62} fill="#9fd66e" />
      {near && e.has('beanAphids') && (
        <g fill="#26301f" stroke="none">
          {[
            [236, 80],
            [240, 76],
            [244, 81],
            [238, 86],
            [246, 87],
            [233, 85],
            [242, 90],
          ].map(([x, y]) => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={1.3} ry={0.9} />
          ))}
        </g>
      )}

      {/* the flowers: lilac, in a little cluster */}
      {!(near && e.has('flowerDrop')) ? (
        <g>
          {[
            [206, 124],
            [214, 120],
            [218, 130],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
              <path d="M0,0 C-4,-4 -4,-8 0,-7 C4,-8 4,-4 0,0 Z" fill="#e7c8f0" strokeWidth={0.9} />
              <path d="M0,0 C-3,2 -5,1 -5,-2 M0,0 C3,2 5,1 5,-2" fill="#f7eefa" strokeWidth={0.8} />
            </g>
          ))}
        </g>
      ) : (
        <g>
          <path d="M206,124 l0,-5 M214,120 l0,-5 M218,130 l0,-5" fill="none" stroke={BEAN_DARK} strokeWidth={1} />
          {/* the dropped flowers, on the soil */}
          <circle cx={212} cy={222} r={2.2} fill="#d9b7e2" strokeWidth={0.7} />
          <circle cx={222} cy={223} r={1.8} fill="#d9b7e2" strokeWidth={0.7} />
        </g>
      )}

      {/* the pods, hanging */}
      <g fill="#8fcf5a">
        <path d="M262,156 C266,166 268,176 266,188 C263,190 261,186 262,176 C261,168 259,162 260,156 Z" />
        <path d="M266,156 C274,164 278,174 280,184 C277,187 274,182 273,174 C270,166 266,162 264,158 Z" />
        <path d="M258,157 C256,168 252,178 248,186 C245,186 246,180 248,172 C251,166 254,160 256,156 Z" />
      </g>
      {near && e.has('podBorer') && (
        <g>
          <circle cx={264} cy={176} r={1.8} fill="#3a2414" strokeWidth={0.7} />
          <g fill="#d8c08a" stroke="none">
            <circle cx={266} cy={182} r={0.9} />
            <circle cx={263} cy={184} r={0.8} />
          </g>
        </g>
      )}
    </g>
  );
}

export function BeanScene({ uid, e, r }: Scene) {
  return (
    <Bed uid={uid} e={e} r={r} rowSign="mosaic" behind="#7fb850" row={<Next><BeanBody e={e} /></Next>}>
      {/* the roots, with their pink nodules (they take nitrogen from the air) */}
      <g fill="none" stroke={e.has('noNodules') ? '#c9b08a' : ROOT} strokeWidth={1.5}>
        <path d="M240,226 C236,238 228,248 218,258 M240,226 C244,240 254,250 266,258 M240,226 C240,242 238,254 240,266 M234,232 C224,236 214,240 206,246 M246,232 C256,236 266,238 276,244" />
      </g>
      {!e.has('noNodules') && (
        <g fill="#e6a0a0" strokeWidth={0.7}>
          {[
            [226, 248],
            [254, 248],
            [239, 256],
            [214, 242],
            [264, 240],
            [232, 238],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={2} />
          ))}
        </g>
      )}
      <BeanBody e={e} near />
    </Bed>
  );
}

/* ---------------- a kale plant (sukuma wiki), picked from the bottom up ---------------- */

const KALE = '#5f9c74';
const KALE_DARK = '#3f7556';

/** A kale leaf from its stalk to its tip, the edges ruffled: a smooth outline with scallops along both sides. */
function KaleLeaf({ from, to, w, fill, ribs = true }: { from: [number, number]; to: [number, number]; w: number; fill: string; ribs?: boolean }) {
  const [x0, y0] = from;
  const [x1, y1] = to;
  const len = Math.hypot(x1 - x0, y1 - y0);
  const ux = (x1 - x0) / len;
  const uy = (y1 - y0) / len;
  const n = 26;
  const side = (k: 1 | -1) =>
    Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      // a short bare stalk, then the blade: widest past the middle, ruffled
      const blade = t < 0.12 ? 0.08 : Math.pow(Math.sin(Math.PI * Math.min(1, (t - 0.12) / 0.88)), 0.7);
      const ruffle = t < 0.12 ? 0 : 1.6 * Math.abs(Math.sin(t * Math.PI * 9));
      const d = k * (w * blade + ruffle);
      return [x0 + ux * len * t - uy * d, y0 + uy * len * t + ux * d];
    });
  const pts = [...side(1), ...side(-1).reverse()];
  const d = `M${pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' L')} Z`;
  const vein = (t: number, k: 1 | -1) => {
    const bx = x0 + ux * len * t;
    const by = y0 + uy * len * t;
    const ex = bx + ux * w * 0.5 - uy * k * w * 0.7;
    const ey = by + uy * w * 0.5 + ux * k * w * 0.7;
    return `M${bx.toFixed(1)},${by.toFixed(1)} L${ex.toFixed(1)},${ey.toFixed(1)}`;
  };
  return (
    <g>
      <path d={d} fill={fill} strokeWidth={1.3} />
      <path d={`M${x0},${y0} L${x0 + ux * len * 0.94},${y0 + uy * len * 0.94}`} fill="none" stroke="#c9dcc0" strokeWidth={1.6} />
      {ribs && <path d={[0.3, 0.5, 0.7].flatMap(t => [vein(t, 1), vein(t, -1)]).join(' ')} fill="none" stroke="rgba(42,23,48,0.28)" strokeWidth={0.8} />}
    </g>
  );
}

function KaleBody({ e, near }: { e: Set<string>; near?: boolean }) {
  return (
    <g>
      {/* the stem, with the scars of the leaves already picked */}
      <path d="M240,226 C238,196 242,150 240,72" fill="none" stroke={INK} strokeWidth={11} />
      <path d="M240,226 C238,196 242,150 240,72" fill="none" stroke="#a9c48a" strokeWidth={8.4} />
      {[200, 184, 168, 152, 136].map((y, i) => (
        <path key={y} d={i % 2 ? `M236,${y} C238,${y + 3} 242,${y + 3} 244,${y}` : `M244,${y} C242,${y + 3} 238,${y + 3} 236,${y}`} fill="none" stroke="#6e8a52" strokeWidth={1.2} />
      ))}
      {near && e.has('tornScars') && (
        <g>
          <path d="M235,150 l3,3 l2,-2 l3,3 M236,166 l2,3 l3,-2" fill="none" stroke="#4a3020" strokeWidth={1} />
          <ellipse cx={240} cy={152} rx={3.4} ry={2} fill="#6a4a2a" stroke="none" />
        </g>
      )}
      {near && e.has('cutworm') && (
        <g>
          <path d="M235,212 C238,216 242,216 245,212" fill="none" stroke="#6a4a2a" strokeWidth={1.6} />
          <path d="M218,222 C214,218 216,212 222,212 C228,212 230,218 226,220" fill="none" stroke="#7c7466" strokeWidth={3.4} />
          <path d="M218,222 C214,218 216,212 222,212 C228,212 230,218 226,220" fill="none" stroke={INK} strokeWidth={0.6} />
        </g>
      )}

      {/* the big leaves, ruffled at the edges; the low left one turned up to show its underside */}
      <KaleLeaf from={[240, 112]} to={[118, 92]} w={20} fill={KALE} />
      <KaleLeaf from={[241, 108]} to={[364, 96]} w={20} fill={KALE} />
      <KaleLeaf from={[241, 126]} to={[346, 152]} w={16} fill={KALE_DARK} />
      {near && <KaleLeaf from={[239, 128]} to={[150, 146]} w={14} fill="#a8c9b0" ribs={false} />}
      {near && e.has('kaleAphids') && (
        <g fill="#8b968f" stroke="none">
          {[
            [160, 142],
            [164, 138],
            [168, 143],
            [172, 139],
            [163, 147],
            [170, 148],
            [176, 141],
            [158, 138],
          ].map(([x, y]) => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={1.6} ry={1.1} />
          ))}
        </g>
      )}
      {near && e.has('blackRot') && (
        <g>
          <path d="M362,100 L340,92 L344,108 Z" fill="#e8d24a" stroke="none" />
          <path d="M358,100 L344,96 M356,102 L346,104" fill="none" stroke="#2a2a2a" strokeWidth={0.9} />
        </g>
      )}

      {/* the young leaves, upright, and the bud at the top */}
      <KaleLeaf from={[239, 92]} to={[212, 56]} w={9} fill="#7fbf8f" ribs={false} />
      <KaleLeaf from={[241, 92]} to={[282, 64]} w={10} fill="#7fbf8f" ribs={false} />
      {near && e.has('holes') && (
        <g>
          <g fill="#cfe8f0" strokeWidth={0.6}>
            <circle cx={264} cy={72} r={1.8} />
            <circle cx={270} cy={80} r={1.4} />
            <circle cx={260} cy={84} r={1.6} />
          </g>
          <path d="M272,88 c2,-1 4,-1 5,1" fill="none" stroke="#9bd36a" strokeWidth={2.2} />
        </g>
      )}
      <path d="M240,72 C234,64 234,56 238,48 C242,54 244,60 244,66 C246,60 248,56 250,54 C250,62 246,68 240,72 Z" fill="#9fd6a8" />
    </g>
  );
}

export function KaleScene({ uid, e, r }: Scene) {
  return (
    <Bed uid={uid} e={e} r={r} rowSign="rowYellow" behind="#6aa57c" row={<Next><KaleBody e={e} /></Next>}>
      <g fill="none" stroke={ROOT} strokeWidth={1.6}>
        <path d="M240,226 C234,240 224,250 212,262 M240,226 C246,240 256,250 270,262 M240,226 C240,244 238,256 240,270 M232,234 C220,238 210,242 198,248 M248,234 C260,238 272,240 284,246" />
      </g>
      <KaleBody e={e} near />
    </Bed>
  );
}

/* ---------------- a tomato plant, tied to its stake ---------------- */

const TOM = '#5aa140';
const TOM_DARK = '#3f7f2a';

/** A tomato leaf: a stalk with leaflets in pairs and one at the tip. */
function Compound({ x, y, len, rot, fill = TOM, curl }: { x: number; y: number; len: number; rot: number; fill?: string; curl?: boolean }) {
  const n = 3;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <path d={`M0,0 L${len},0`} fill="none" stroke={TOM_DARK} strokeWidth={1.6} />
      {Array.from({ length: n }, (_, i) => {
        const at = ((i + 1) / (n + 1)) * len;
        return (
          <g key={i}>
            <Leaf x={at} y={-7} rx={7} ry={4.4} rot={-60} fill={fill} rib={false} />
            {!curl && <Leaf x={at} y={7} rx={7} ry={4.4} rot={60} fill={fill} rib={false} />}
          </g>
        );
      })}
      <Leaf x={len + 5} y={0} rx={8} ry={5} rot={0} fill={fill} rib={false} />
    </g>
  );
}

function TomatoBody({ e, near }: { e: Set<string>; near?: boolean }) {
  return (
    <g>
      {/* the stake, and the ties round the stem */}
      <rect x={259} y={26} width={7} height={202} rx={1.5} fill="#b5875a" />
      {[96, 150, 200].map(y => (
        <path key={y} d={`M262,${y} C256,${y - 5} 248,${y + 5} 241,${y} C248,${y - 5} 256,${y + 5} 262,${y}`} fill="none" stroke="#f3ead2" strokeWidth={1.4} />
      ))}
      {near && e.has('tightTie') && (
        <g>
          <path d="M262,96 L241,96" fill="none" stroke="#f3ead2" strokeWidth={2.4} />
          <path d="M238,92 l3,4 l-3,4" fill="none" stroke="#b3321f" strokeWidth={1.4} />
        </g>
      )}

      {/* the stem, zig-zagging up */}
      <path d="M240,226 L238,182 L244,140 L238,100 L242,60 L240,36" fill="none" stroke={INK} strokeWidth={6.4} />
      <path d="M240,226 L238,182 L244,140 L238,100 L242,60 L240,36" fill="none" stroke="#8cc45a" strokeWidth={4.2} />
      {near && e.has('suckers') && (
        <g>
          <path d="M240,176 C248,170 252,162 254,154" fill="none" stroke="#8cc45a" strokeWidth={2.4} />
          <Leaf x={256} y={152} rx={5} ry={3.2} rot={-60} fill="#9fd66e" rib={false} />
        </g>
      )}

      {/* the leaves; the low right one curls up to show its underside */}
      <Compound x={238} y={124} len={56} rot={186} />
      <Compound x={238} y={182} len={56} rot={170} />
      <Compound x={242} y={80} len={44} rot={-30} />
      <Compound x={238} y={150} len={30} rot={210} fill={TOM_DARK} />
      {near && (
        <g>
          <Compound x={242} y={168} len={64} rot={10} fill="#a9d68a" curl />
        </g>
      )}
      {near && e.has('blight') && (
        <g>
          {[
            [172, 116],
            [188, 130],
          ].map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r={3.2} fill="#8a5a2a" strokeWidth={0.6} />
              <circle cx={x} cy={y} r={1.6} fill="none" stroke="#4a2a10" strokeWidth={0.6} />
            </g>
          ))}
        </g>
      )}
      {near && e.has('mines') && <path d="M160,124 c3,-3 6,2 9,-1 c3,-3 5,1 8,-1 M194,116 c2,2 5,-1 7,1" fill="none" stroke="#eef2c0" strokeWidth={1.8} />}
      {near && e.has('whitefly') && (
        <g fill="#fff" strokeWidth={0.5}>
          {[
            [300, 170],
            [306, 174],
            [312, 170],
            [318, 176],
            [324, 172],
            [310, 178],
          ].map(([x, y]) => (
            <path key={`${x}-${y}`} d={`M${x - 2},${y} l2,-1.4 l2,1.4 l-2,1.2 Z`} />
          ))}
        </g>
      )}

      {/* the flowers: a truss of yellow stars */}
      <path d="M240,70 C226,70 210,72 198,76" fill="none" stroke={TOM_DARK} strokeWidth={1.2} />
      {[
        [202, 80],
        [192, 76],
        [208, 86],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} transform={`translate(${x} ${y})`} d="M0,-5 L1.4,-1.4 L5,0 L1.4,1.4 L0,5 L-1.4,1.4 L-5,0 L-1.4,-1.4 Z" fill="#f2d24a" strokeWidth={0.8} />
      ))}

      {/* the fruit: a truss, the first one turning red */}
      <path d="M242,140 C250,142 256,146 258,150" fill="none" stroke={TOM_DARK} strokeWidth={1.2} />
      <circle cx={252} cy={158} r={7} fill="#e2502f" />
      <circle cx={266} cy={154} r={6.4} fill="#9fcf5a" />
      <circle cx={262} cy={167} r={6} fill="#b8d65a" />
      <path d="M250,152 l2,-2 l2,2 M264,149 l2,-2 l2,2" fill="none" stroke={TOM_DARK} strokeWidth={0.9} />
      {near && e.has('ber') && <ellipse cx={252} cy={163} rx={4} ry={2.4} fill="#3a2a1a" stroke="none" />}

      {/* the growing tip */}
      <Leaf x={234} y={36} rx={6} ry={3.6} rot={-120} fill="#9fd66e" rib={false} />
      <Leaf x={246} y={36} rx={6} ry={3.6} rot={-60} fill="#9fd66e" rib={false} />
    </g>
  );
}

export function TomatoScene({ uid, e, r }: Scene) {
  return (
    <Bed uid={uid} e={e} r={r} rowSign="wilt" behind="#69a54a" row={<Next><TomatoBody e={e} /></Next>}>
      <g fill="none" stroke={ROOT} strokeWidth={1.6}>
        <path d="M240,226 C236,240 226,250 214,262 M240,226 C244,242 254,252 268,262 M240,226 C240,244 238,256 240,270 M232,234 C222,240 212,242 200,248 M248,234 C258,240 270,242 282,246" />
      </g>
      <TomatoBody e={e} near />
    </Bed>
  );
}
