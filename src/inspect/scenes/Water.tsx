import { INK } from '../../art/anime';

/* The farm's water, from the roof to the roots, drawn on the 480 × 270 scene: the gutter along the store's roof, the
   first-flush pipe, the tank on its stand with its lid, gauge and tap, the pump, the buried pipe, the filter and the
   drip lines with their emitters in a bed. Early signs (src/inspect/early.ts WATER_EARLY) are drawn where a walk along
   the water finds them; `r` holds the red ones (the tank low). */

const SW = 1.3;
const BLUE = '#3d6fa3';

export function WaterScene({ uid, e, r }: { uid: string; e: Set<string>; r: Set<string> }) {
  const low = r.has('low');
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe6f0" />
          <stop offset="1" stopColor="#f2ecd6" />
        </linearGradient>
      </defs>
      <rect x={-400} y={-300} width={1280} height={520} fill={`url(#${uid}-sky)`} stroke="none" />
      <rect x={-400} y={216} width={1280} height={300} fill="#c9b07e" stroke="none" />
      <path d="M-400,216 H880" fill="none" />

      {/* the store, its roof and the gutter */}
      <rect x={-60} y={86} width={150} height={130} fill="#e8d6b4" />
      <path d="M-70,88 L40,40 L104,70 L104,88 Z" fill="#9aa6ae" />
      <path d="M-40,82 L40,46 M0,86 L60,58" fill="none" stroke="#7d8890" strokeWidth={1} />
      <path d="M40,76 L118,76 L116,84 L42,84 Z" fill="#b5bec4" />
      {e.has('gutterLeaves') && (
        <g fill="#9a7a3a" strokeWidth={0.7}>
          <path d="M70,76 c4,-6 10,-4 9,1 c-4,3 -8,2 -9,-1 Z" />
          <path d="M82,75 c4,-5 9,-3 8,1 c-3,3 -7,2 -8,-1 Z" />
          <path d="M94,77 c3,-5 8,-3 7,1 c-3,2 -6,2 -7,-1 Z" />
        </g>
      )}
      {/* the downpipe and the first flush */}
      <path d="M112,84 L112,96 L150,96" fill="none" stroke="#8d989f" strokeWidth={5} />
      <path d="M112,84 L112,96 L150,96" fill="none" />
      <rect x={134} y={96} width={10} height={58} rx={2} fill={e.has('flushFull') ? '#8a7650' : '#d7dde0'} />
      <circle cx={139} cy={156} r={3} fill="#6c7a86" />
      {/* the tank on its stand */}
      <path d="M176,206 L176,216 M264,206 L264,216" fill="none" stroke="#7a5a3c" strokeWidth={3} />
      <rect x={170} y={170} width={100} height={8} fill="#a07a50" />
      <path d={e.has('standCrack') ? 'M182,178 L182,192 L186,196 L182,206 M258,178 L258,206' : 'M182,178 L182,206 M258,178 L258,206'} fill="none" stroke="#7a5a3c" strokeWidth={4} />
      {e.has('standCrack') && <path d="M180,192 l6,3" fill="none" stroke="#3a2414" strokeWidth={1.2} />}
      <rect x={180} y={84} width={80} height={86} rx={6} fill={BLUE} />
      <path d="M180,104 H260 M180,124 H260 M180,144 H260" fill="none" stroke="#2f5a87" strokeWidth={1} />
      <ellipse cx={220} cy={84} rx={40} ry={6} fill="#4f84b9" />
      <rect x={210} y={74} width={20} height={8} rx={2} fill="#2f5a87" />
      <path d="M150,96 L186,96 L186,84" fill="none" stroke="#8d989f" strokeWidth={4} />
      {e.has('lidOpen') && (
        <g>
          <path d="M213,76 l6,-4 l3,3 M224,74 l3,4" fill="none" stroke="#e8e0d0" strokeWidth={1} />
          <g fill={INK} stroke="none">
            <circle cx={232} cy={66} r={1} />
            <circle cx={240} cy={70} r={0.9} />
          </g>
        </g>
      )}
      {e.has('tankAlgae') && <path d="M182,90 C200,94 240,94 258,90 L258,96 C240,100 200,100 182,96 Z" fill="#6aa34a" stroke="none" opacity={0.9} />}
      {/* the gauge */}
      <rect x={250} y={92} width={6} height={72} rx={2} fill="#e8eef3" />
      <rect className={low ? 'ex-level is-falling' : 'ex-level'} x={251.2} y={low ? 150 : 104} width={3.6} height={low ? 13 : 59} rx={1.4} fill={low ? '#e5543f' : '#58b7e6'} stroke="none" />
      {/* the tap */}
      <path d="M262,160 L280,160 L280,166" fill="none" stroke="#8d989f" strokeWidth={4} />
      <rect x={272} y={154} width={8} height={5} rx={1} fill="#c9a24a" />
      {e.has('tapDrip') && <path className="ex-drip" d="M280,168 c-1.6,2.4 -1.6,4 0,4.6 c1.6,-0.6 1.6,-2.2 0,-4.6 Z" fill="#8fd0ea" strokeWidth={0.7} />}
      {/* the pump */}
      <path d="M280,166 L280,206 L296,206" fill="none" stroke="#8d989f" strokeWidth={4} />
      <rect x={296} y={192} width={30} height={22} rx={4} fill="#2f6f4a" />
      <circle cx={311} cy={203} r={6} fill="#3f8a5a" />
      {e.has('pumpNoise') && (
        <g fill="none" stroke="#b3321f" strokeWidth={1}>
          <path d="M330,190 l4,-4 M334,196 l6,-1 M330,202 l5,3" />
        </g>
      )}
      {/* the buried pipe, the filter, and the drip lines in the bed */}
      <path d="M326,206 L340,206 L340,226 L380,226" fill="none" stroke="#8d989f" strokeWidth={4} />
      {e.has('pipeSplit') && <ellipse cx={356} cy={220} rx={12} ry={3} fill="#8a6a42" stroke="none" />}
      <rect x={380} y={218} width={14} height={16} rx={3} fill="#e0e6ea" />
      <rect x={383} y={222} width={8} height={8} rx={1} fill={e.has('filterClog') ? '#7a6a3a' : '#cfe6f0'} stroke="none" />
      <path d="M394,226 L494,226" fill="none" stroke="#2d2d2d" strokeWidth={3} />
      <path d={e.has('dripKink') ? 'M394,240 L430,240 C436,240 434,234 440,236 C446,238 440,242 448,242 L494,242' : 'M394,240 L494,240'} fill="none" stroke="#2d2d2d" strokeWidth={3} />
      <path d="M394,226 L394,240" fill="none" stroke="#2d2d2d" strokeWidth={3} />
      {[410, 440, 470].map((x, i) => (
        <g key={x}>
          <path d={`M${x},224 c-2,-8 2,-14 5,-16 c2,4 2,10 -1,16 Z`} fill={e.has('emitterBlock') && i === 1 ? '#c9c06a' : '#6fb04a'} strokeWidth={0.8} />
          <circle cx={x + 6} cy={242} r={2} fill="#3c3c3c" />
          {!(e.has('emitterBlock') && i > 0) && <ellipse cx={x + 6} cy={250} rx={8} ry={2.2} fill="#9a7650" stroke="none" />}
        </g>
      ))}
      {/* the trough the cows drink from */}
      <path d="M-30,232 L40,232 L36,256 L-26,256 Z" fill="#9aa6ae" />
      <ellipse cx={5} cy={233} rx={33} ry={3} fill={low ? '#a9c9d6' : '#6fb6d9'} />
      {e.has('troughSlime') && <path d="M-24,234 C-10,232 10,236 30,233 L28,240 C10,242 -10,240 -22,240 Z" fill="#6aa34a" stroke="none" opacity={0.85} />}
    </g>
  );
}
