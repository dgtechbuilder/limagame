import { INK } from '../../art/anime';

/* A maize plant in its bed, knee-high to tasselling, drawn on the 480 × 270 scene: the tassel and the whorl at the
   top, the leaves, a young cob with its silk, the stem and its brace roots, the soil cut away to show the roots, the
   drip line, the weeds round it and the next plants in the row. Early signs (src/inspect/early.ts PLANT_EARLY) are
   drawn where a field check finds them; `r` holds the red ones (a dry spell rolls the leaves). */

const SW = 1.3;
const LEAF = '#5fa83f';
const LEAF_DARK = '#3f7f2a';
const STALK = '#7fb24a';

export function PlantScene({ uid, e, r }: { uid: string; e: Set<string>; r: Set<string> }) {
  const roll = r.has('dry') || e.has('leafRoll');
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={r.has('dry') ? '#ffd88a' : '#cfe8f0'} />
          <stop offset="1" stopColor={r.has('dry') ? '#ffe9b8' : '#eef6e2'} />
        </linearGradient>
      </defs>
      <rect x={-400} y={-300} width={1280} height={530} fill={`url(#${uid}-sky)`} stroke="none" />
      {/* the field behind: rows fading back */}
      <path d="M-400,176 C-200,168 0,172 240,168 C480,164 700,170 880,166 L880,230 L-400,230 Z" fill="#a9c97a" stroke="none" />
      {[-20, 30, 330, 470, 520].map((x, i) => (
        <g key={x} opacity={0.75}>
          <path d={`M${x},200 L${x},${120 + (i % 2) * 10}`} fill="none" stroke={LEAF_DARK} strokeWidth={2.4} />
          <path d={`M${x},170 C${x - 18},160 ${x - 26},164 ${x - 34},176 M${x},158 C${x + 18},148 ${x + 26},152 ${x + 32},164`} fill="none" stroke={LEAF_DARK} strokeWidth={1.6} />
        </g>
      ))}
      {/* the soil, cut away in front to show the roots */}
      <rect x={-400} y={222} width={1280} height={200} fill="#8a5d3b" stroke="none" />
      <path d="M-400,222 H880" fill="none" />
      <path d="M-400,232 C-200,228 0,236 240,230 C480,226 700,234 880,230" fill="none" stroke="#6e4a2e" strokeWidth={1} />
      {e.has('soilCrack') && <path d="M96,240 l8,6 l-4,7 l9,5 M132,236 l-6,8 l5,5 M70,250 l10,3" fill="none" stroke="#3d2716" strokeWidth={1.4} />}
      {e.has('soilCrack') ? null : <path d="M70,240 C90,236 120,238 150,236" fill="none" stroke="#a5774f" strokeWidth={2} opacity={0.6} />}

      {/* the next plant in the row */}
      <g>
        <path d="M402,224 L398,104" fill="none" stroke={STALK} strokeWidth={5} />
        <path d="M402,224 L398,104" fill="none" />
        {[
          'M399,190 C380,176 362,176 344,188 C364,186 382,186 399,196 Z',
          'M399,160 C420,146 440,146 458,158 C438,158 420,160 399,168 Z',
          'M398,132 C380,118 364,116 350,124 C368,126 384,130 398,140 Z',
          'M398,112 C412,98 426,96 438,102 C424,106 410,110 398,118 Z',
        ].map(d => (
          <path key={d} d={d} fill={LEAF} />
        ))}
        {e.has('streak') && (
          <g fill="none" stroke="#f3e27a" strokeWidth={1}>
            <path d="M406,156 L452,156 M408,160 L446,159" />
            <path d="M356,184 L394,190 M362,186 L392,192" />
          </g>
        )}
      </g>

      {/* the drip line along the row, with its emitter */}
      <path d="M-400,228 H880" fill="none" stroke="#2d2d2d" strokeWidth={3} />
      <circle cx={198} cy={228} r={3.6} fill="#3c3c3c" />
      {e.has('dripBlock') ? (
        <path d="M194,232 l-2,4 M202,232 l2,4" fill="none" stroke="#c9b08a" strokeWidth={1} />
      ) : (
        <g>
          <ellipse cx={198} cy={236} rx={14} ry={3} fill="#6a4630" stroke="none" />
          <path className="ex-drip is-slow" d="M198,232 c-1.6,2.4 -1.6,4 0,4.6 c1.6,-0.6 1.6,-2.2 0,-4.6 Z" fill="#8fd0ea" strokeWidth={0.7} />
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
        <path d="M296,224 C296,218 300,216 302,214" fill="none" stroke="#7cbf4a" strokeWidth={1.4} />
      )}

      {/* the roots, in the cut soil */}
      <g fill="none" stroke="#e6d2a8" strokeWidth={1.6}>
        <path d="M240,226 C236,240 226,250 214,262 M240,226 C244,242 254,252 268,262 M240,226 C240,244 238,256 240,270 M232,234 C222,240 212,242 200,248 M248,234 C258,240 270,242 282,246" />
      </g>
      {/* the brace roots above the soil */}
      <path d="M236,212 C232,218 228,222 224,224 M244,212 C248,218 252,222 256,224" fill="none" stroke="#c97a4a" strokeWidth={2.2} />

      {/* the stalk */}
      <path d="M240,224 C240,170 241,110 240,58" fill="none" stroke={INK} strokeWidth={8.6} />
      <path d="M240,224 C240,170 241,110 240,58" fill="none" stroke={STALK} strokeWidth={6.2} />
      {[190, 156, 122, 90].map(y => (
        <path key={y} d={`M236,${y} H244`} fill="none" stroke="#5a8a34" strokeWidth={1.2} />
      ))}
      {e.has('stemHole') && (
        <g>
          <circle cx={241} cy={176} r={2.4} fill="#3a2414" strokeWidth={0.8} />
          <g fill="#d8c08a" stroke="none">
            <circle cx={244} cy={181} r={1} />
            <circle cx={242} cy={184} r={0.8} />
            <circle cx={245} cy={186} r={0.9} />
          </g>
        </g>
      )}

      {/* the leaves: rolled tight in a dry spell */}
      {roll ? (
        <g fill={LEAF_DARK}>
          <path d="M240,196 C214,186 190,176 168,176 C190,182 214,192 240,200 Z" />
          <path d="M241,166 C268,156 296,146 320,148 C296,154 268,164 241,170 Z" />
          <path d="M240,130 C214,120 192,110 170,110 C192,116 214,126 240,134 Z" />
          <path d="M241,104 C262,92 286,84 304,86 C286,92 262,100 241,108 Z" />
        </g>
      ) : (
        <g>
          <path d="M240,196 C214,176 182,166 150,176 C172,174 204,184 240,204 Z" fill={LEAF} />
          <path d="M241,164 C270,140 308,132 336,146 C312,146 276,156 241,172 Z" fill={LEAF} />
          <path d="M240,128 C212,104 180,98 156,108 C180,110 210,120 240,136 Z" fill={LEAF} />
          <path d="M241,102 C262,82 290,74 312,82 C292,86 266,96 241,110 Z" fill={LEAF} />
          <path d="M236,190 C214,180 188,174 166,176 M244,160 C270,148 300,142 322,146 M236,122 C212,110 186,104 164,108 M244,98 C262,88 284,82 302,84" fill="none" stroke={LEAF_DARK} strokeWidth={0.9} />
        </g>
      )}
      {e.has('yellowV') && (
        <g stroke="none">
          <path d="M150,176 C170,174 190,178 206,186 C190,186 172,182 150,176 Z" fill="#e8d24a" />
          <path d="M168,178 L196,184" fill="none" stroke="#c9a42a" strokeWidth={1} />
        </g>
      )}
      {/* the underside of a leaf, curled up to show it */}
      <path d="M156,108 C150,116 152,126 162,128 C170,128 176,122 174,116" fill="#8cc46a" />
      {e.has('aphids') && (
        <g fill="#2f4a2a" stroke="none">
          {[
            [158, 118],
            [162, 122],
            [166, 120],
            [161, 125],
            [168, 124],
            [164, 116],
          ].map(([x, y]) => (
            <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={1.4} ry={1} />
          ))}
        </g>
      )}

      {/* the cob and its silk */}
      <g>
        <path d="M244,160 C258,150 266,136 264,124 C256,128 248,138 244,148 Z" fill="#9fcf6a" />
        <path d="M244,154 C252,146 258,138 260,128" fill="none" stroke="#6a9a3a" strokeWidth={0.9} />
        <path d={e.has('silkCut') ? 'M263,124 l2,-4 M264,124 l4,-3 M262,124 l0,-4' : 'M263,124 C268,112 276,108 284,108 M264,124 C272,116 282,116 288,120 M262,124 C262,112 268,104 274,100'} fill="none" stroke="#e0b860" strokeWidth={1.4} />
        {e.has('silkCut') && (
          <g fill="#d9a02a" strokeWidth={0.7}>
            <ellipse cx={270} cy={120} rx={2.6} ry={1.8} />
            <path d="M268,118 l-1.6,-1.4 M272,118 l1.6,-1.4" fill="none" />
          </g>
        )}
      </g>

      {/* the whorl at the top, and the tassel */}
      <path d="M240,62 C232,52 230,44 234,36 C238,44 240,50 242,56 C246,48 250,42 254,40 C252,50 248,58 242,64 Z" fill="#7cbf4a" />
      {e.has('whorlFrass') && (
        <g>
          <g fill="#d8c08a" stroke="none">
            <circle cx={238} cy={58} r={1.4} />
            <circle cx={242} cy={55} r={1.2} />
            <circle cx={245} cy={60} r={1.5} />
            <circle cx={236} cy={62} r={1.1} />
          </g>
          <path d="M226,72 C232,70 236,72 238,76" fill="none" stroke="#a8c86a" strokeWidth={2.4} />
          <path d="M228,74 l3,-1 M232,73 l2,1" fill="none" strokeWidth={0.6} />
          <path d="M252,78 l4,0 M251,82 l5,1" fill="none" stroke="#b0d080" strokeWidth={1.6} />
        </g>
      )}
      <g fill="none" stroke="#c9a24a" strokeWidth={1.6}>
        <path d="M240,40 L240,14 M240,30 C232,24 228,18 226,10 M240,30 C248,24 252,18 254,10 M240,22 C234,16 232,10 232,4 M240,22 C246,16 248,10 248,4" />
      </g>
    </g>
  );
}
