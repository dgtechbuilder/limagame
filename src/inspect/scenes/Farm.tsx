import { INK } from '../../art/anime';

/* The whole farm, from the lane, drawn on the 480 × 270 scene: the hedge and the fence along the boundary with the gate,
   the beds and the path between them, the drainage ditch, the store with its iron roof, the compost heap, the
   security light and the dog's kennel. Early signs (src/inspect/early.ts FARM_EARLY) are drawn where a walk round the
   farm finds them; `r` holds the red ones (today's bushes and rocks not cleared). */

const SW = 1.3;

export function FarmScene({ uid, e, r }: { uid: string; e: Set<string>; r: Set<string> }) {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#bfe0ee" />
          <stop offset="1" stopColor="#eef4dc" />
        </linearGradient>
      </defs>
      <rect x={-400} y={-300} width={1280} height={480} fill={`url(#${uid}-sky)`} stroke="none" />
      {/* hills */}
      <path d="M-400,140 C-200,110 0,100 140,118 C260,92 380,96 520,116 C640,100 760,110 880,120 L880,180 L-400,180 Z" fill="#9cc47a" stroke="none" />
      <rect x={-400} y={150} width={1280} height={400} fill="#b8d48a" stroke="none" />
      <path d="M-400,150 H880" fill="none" stroke="#8cae64" />

      {/* the hedge on the left boundary */}
      <g fill="#5f9a46">
        <path d="M-20,152 C-30,120 -10,96 14,100 C24,80 54,84 60,104 C76,104 82,128 70,152 Z" />
        <path d="M0,118 C10,112 20,114 26,120 M34,104 C42,100 50,102 54,108" fill="none" stroke="#3f7a32" strokeWidth={1} />
      </g>
      {e.has('hedgeGap') && (
        <g>
          <path d="M22,152 C22,134 30,128 38,128 C46,128 52,136 52,152 Z" fill="#b8d48a" stroke="none" />
          <path d="M24,150 C26,138 32,132 38,132 C44,132 50,138 50,150" fill="none" stroke="#8a6a42" strokeWidth={1} strokeDasharray="2 2" />
        </g>
      )}

      {/* the fence along the lane, with the gate */}
      {[110, 150, 190, 230, 270, 310].map(x => (
        <rect key={x} x={x} y={132} width={5} height={30} rx={1} fill="#9a6a3a" />
      ))}
      <path d={e.has('fenceGap') ? 'M66,140 H200 C214,146 222,146 232,140 H330 M66,152 H200 C214,160 222,160 232,152 H330' : 'M66,140 H330 M66,152 H330'} fill="none" stroke="#6a6a6a" strokeWidth={1.1} />
      {e.has('fenceGap') && <path d="M206,162 C210,156 222,156 226,162 Z" fill="#7a5a3a" stroke="none" />}
      {/* the gate */}
      <g transform={e.has('gateHinge') ? 'rotate(6 66 146)' : undefined}>
        <rect x={66} y={136} width={34} height={22} rx={1} fill="none" stroke="#9a6a3a" strokeWidth={2.4} />
        <path d="M66,136 L100,158 M66,147 H100" fill="none" stroke="#9a6a3a" strokeWidth={2} />
      </g>
      <rect x={62} y={130} width={5} height={32} rx={1} fill="#7a5030" />
      <rect x={100} y={130} width={5} height={32} rx={1} fill="#7a5030" />
      {e.has('gateHinge') && <path d="M104,154 l6,4" fill="none" stroke="#b3321f" strokeWidth={1.2} />}

      {/* the beds, and the path between them */}
      {[0, 1, 2].map(i => (
        <g key={i}>
          <path d={`M${136 + i * 62},178 L${186 + i * 62},178 L${192 + i * 66},232 L${124 + i * 66},232 Z`} fill="#8a5d3b" />
          {[0, 1, 2].map(j => (
            <g key={j}>
              {[0, 1, 2, 3].map(k => (
                <path
                  key={k}
                  d={`M${142 + i * 62 + k * 12 - j * 2 + i * 0},${190 + j * 14} c-2,-6 2,-10 4,-12 c2,2 4,6 2,12 Z`}
                  fill={e.has('molehills') && i === 1 && j === 2 && k > 1 ? '#c9c06a' : '#6fb04a'}
                  strokeWidth={0.8}
                />
              ))}
            </g>
          ))}
        </g>
      ))}
      {e.has('molehills') && (
        <g fill="#6e4a2e">
          <path d="M228,232 C230,224 240,224 242,232 Z" />
          <path d="M246,236 C248,230 255,230 256,236 Z" />
        </g>
      )}
      <path d="M200,236 C210,250 236,262 270,272 L330,272 C300,262 268,250 262,236 Z" fill="#d8c08a" />
      {e.has('puddles') && (
        <g fill="#9cc8dc" stroke="none">
          <ellipse cx={252} cy={252} rx={14} ry={3.4} />
          <ellipse cx={280} cy={264} rx={10} ry={2.6} />
        </g>
      )}
      {r.has('tidy') && (
        <g>
          <path d="M150,252 C142,240 152,230 162,236 C168,226 182,232 178,244 C186,248 180,258 170,256 Z" fill="#6f8f3a" />
          <path d="M296,246 C294,240 302,236 308,240 C314,238 318,246 312,250 Z" fill="#9a958a" />
          <path d="M320,256 C318,250 326,248 330,252 C334,252 334,258 328,258 Z" fill="#8a857a" />
        </g>
      )}

      {/* the drainage ditch */}
      <path d="M340,262 C360,246 400,244 430,250 C450,254 470,252 490,246 L490,262 Z" fill={e.has('ditchSilt') ? '#8a6a42' : '#7fb0c8'} />
      {e.has('ditchSilt') && <path d="M356,256 l4,-8 M372,252 l2,-9 M410,252 l-2,-8 M440,254 l3,-8" fill="none" stroke="#5f9a46" strokeWidth={1.4} />}

      {/* the store, its iron roof and gutter */}
      <rect x={360} y={118} width={100} height={66} fill="#e8d6b4" />
      <path d={e.has('looseSheet') ? 'M352,120 L410,90 L468,120 Z' : 'M352,120 L410,90 L468,120 Z'} fill="#9aa6ae" />
      <path d="M368,116 L410,95 M386,118 L410,105 M430,105 L452,116" fill="none" stroke="#7d8890" strokeWidth={1} />
      {e.has('looseSheet') && <path d="M412,92 L446,104 L450,98 L418,86 Z" fill="#b5bec4" transform="rotate(-8 430 96)" />}
      <rect x={398} y={146} width={22} height={38} fill="#8a5d3b" />
      <rect x={372} y={132} width={16} height={14} fill="#bfe0ee" />
      {e.has('rats') && (
        <g fill="#3a2a1e" stroke="none">
          <ellipse cx={396} cy={188} rx={1.2} ry={0.8} />
          <ellipse cx={392} cy={190} rx={1.2} ry={0.8} />
          <ellipse cx={399} cy={191} rx={1.1} ry={0.7} />
          <path d="M421,184 l4,0 l0,-3 Z" fill="#2a1a10" />
        </g>
      )}

      {/* the compost heap */}
      <path d="M30,238 C34,214 52,206 70,208 C86,206 100,218 100,238 Z" fill={e.has('dryCompost') ? '#a8875a' : '#6e4a2e'} />
      {!e.has('dryCompost') && (
        <g className="ex-haze" fill="none" stroke="#e8e0d0" strokeWidth={1} opacity={0.7}>
          <path d="M58,204 q3,-5 0,-10 q-3,-5 0,-10" />
          <path d="M72,204 q3,-5 0,-10 q-3,-5 0,-10" />
        </g>
      )}
      {e.has('dryCompost') && <path d="M46,226 l6,-4 M64,220 l4,-6 M82,226 l6,-2" fill="none" stroke="#d8c08a" strokeWidth={1.2} />}

      {/* the security light on its pole */}
      <rect x={336} y={60} width={4} height={100} fill="#6a6a6a" />
      <path d="M338,62 L352,62 L354,68 L346,68 Z" fill="#3c3c3c" />
      <circle cx={350} cy={70} r={3} fill={e.has('lightFlicker') ? '#d6d0b0' : '#fff4b0'} className={e.has('lightFlicker') ? 'ex-hiss' : undefined} />

      {/* the kennel */}
      <path d="M438,214 L458,198 L478,214 L478,238 L438,238 Z" fill="#b07f4c" />
      <path d="M450,238 C450,226 466,226 466,238 Z" fill="#3a2a1e" />
      <ellipse cx={428} cy={238} rx={7} ry={2.6} fill={e.has('dogBowl') ? '#c9c9c9' : '#8fd0ea'} />
    </g>
  );
}
