import { INK } from '../../art/anime';

/* The farm's tractor in the yard, side on and facing left, drawn on the 480 × 270 scene: the engine under the bonnet
   (oil dipstick, radiator, air filter, fan belt), the small front wheel and the big rear one, the fuel cap, the battery
   box, the work light, the seat and controls, the lift arms and the hitch. Early signs (src/inspect/early.ts
   TRACTOR_EARLY) are drawn where the walk-round check finds them; `r` holds the red ones (worn, low on fuel). */

const SW = 1.3;
const RED = '#c8402e';
const RED_DARK = '#9a2d20';
const STEEL = '#8d969c';
const TYRE = '#2e2a28';

function Wheel({ cx, cy, rr, soft, cut }: { cx: number; cy: number; rr: number; soft?: boolean; cut?: boolean }) {
  const ry = soft ? rr * 0.9 : rr;
  return (
    <g>
      <ellipse cx={cx} cy={cy + (rr - ry)} rx={rr} ry={ry} fill={TYRE} />
      {Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return <path key={i} d={`M${cx + Math.cos(a) * (rr - 1)},${cy + (rr - ry) + Math.sin(a) * (ry - 1)} L${cx + Math.cos(a) * (rr - 7)},${cy + (rr - ry) + Math.sin(a) * (ry - 7)}`} stroke="#4a4442" strokeWidth={2.4} />;
      })}
      <circle cx={cx} cy={cy + (rr - ry)} r={rr * 0.52} fill="#e0b13a" />
      <circle cx={cx} cy={cy + (rr - ry)} r={rr * 0.2} fill="#b98a22" />
      {cut && <path d={`M${cx - rr * 0.78},${cy + rr * 0.42} l7,-5 l2,4`} fill="none" stroke="#f1e3cf" strokeWidth={1.4} />}
    </g>
  );
}

export function TractorScene({ uid, e, r }: { uid: string; e: Set<string>; r: Set<string> }) {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9ecf3" />
          <stop offset="1" stopColor="#f3e9cf" />
        </linearGradient>
      </defs>
      <rect x={-400} y={-300} width={1280} height={500} fill={`url(#${uid}-sky)`} stroke="none" />
      {/* the shed behind, and the yard */}
      <path d="M-400,120 L40,120 L60,90 L460,90 L480,120 L880,120 L880,210 L-400,210 Z" fill="#c9b28a" stroke="none" opacity={0.55} />
      <rect x={-400} y={204} width={1280} height={300} fill="#cdb98c" stroke="none" />
      <path d="M-400,204 H880" fill="none" />
      {[30, 190, 420].map(x => (
        <path key={x} d={`M${x},252 l10,-2 M${x + 20},258 l8,1`} fill="none" stroke="#a99668" strokeWidth={1} />
      ))}
      <ellipse cx={250} cy={256} rx={190} ry={7} fill="rgba(60,40,30,0.2)" stroke="none" />

      {/* a drip under the tractor: hydraulic oil */}
      {e.has('hydraulicSeep') && <ellipse cx={392} cy={252} rx={14} ry={3} fill="#5a4a2a" stroke="none" opacity={0.8} />}

      {/* the lift arms and the hitch at the back */}
      <path d="M370,176 L414,196 L414,206 L366,190 Z" fill={STEEL} />
      <path d="M386,150 L400,194" fill="none" stroke={STEEL} strokeWidth={4} />
      <path d="M386,150 L400,194" fill="none" />
      <circle cx={414} cy={202} r={4.4} fill="#cfd5d8" />
      <rect x={404} y={210} width={18} height={6} rx={2} fill="#6c7378" />
      {!e.has('dryGrease') && <circle cx={414} cy={202} r={1.6} fill="#e0b13a" stroke="none" />}
      {e.has('dryGrease') && <path d="M408,196 l2,2 M418,198 l2,-2" fill="none" stroke="#b5651d" strokeWidth={1.2} />}
      {e.has('hydraulicSeep') && (
        <g>
          <circle cx={390} cy={168} r={2.4} fill="#7a6a3a" strokeWidth={0.7} />
          <path className="ex-drip is-slow" d="M391,172 c-1.6,2.4 -1.6,4 0,4.6 c1.6,-0.6 1.6,-2.2 0,-4.6 Z" fill="#7a6a3a" strokeWidth={0.6} />
        </g>
      )}

      {/* the body: the bonnet, the step, the fender and the seat */}
      <path d="M108,126 L262,118 L268,180 L112,184 Z" fill={RED} />
      <path d="M118,140 H258 M118,154 H260" fill="none" stroke={RED_DARK} strokeWidth={1} />
      {/* the engine side panel and the oil dipstick */}
      <rect x={180} y={138} width={46} height={30} rx={3} fill="#3c3c3c" />
      <path d="M186,144 H220 M186,150 H220 M186,156 H220 M186,162 H220" fill="none" stroke="#5a5a5a" strokeWidth={1} />
      <path d="M204,138 L204,124" fill="none" stroke="#e0b13a" strokeWidth={2.4} />
      <circle cx={204} cy={122} r={2.6} fill="#e0b13a" />
      {e.has('lowOil') && (
        <g>
          <rect x={210} y={104} width={26} height={8} rx={2} fill="#f6efe0" strokeWidth={0.8} />
          <rect x={212} y={106} width={8} height={4} rx={1} fill="#5a4a2a" stroke="none" />
          <path d="M224,106 V110 M232,106 V110" fill="none" strokeWidth={0.6} />
        </g>
      )}
      {/* the radiator grille at the front */}
      <path d="M100,124 L116,124 L118,184 L102,184 Z" fill="#4a4a4a" />
      {[132, 140, 148, 156, 164, 172].map(y => (
        <path key={y} d={`M103,${y} H116`} fill="none" stroke="#7a7a7a" strokeWidth={1} />
      ))}
      <circle cx={118} cy={120} r={4} fill={STEEL} />
      {e.has('coolantLow') && (
        <g fill="#7ccf8a" stroke="none">
          <circle cx={114} cy={118} r={1.6} />
          <circle cx={121} cy={117} r={1.3} />
          <circle cx={117} cy={115} r={1.1} />
        </g>
      )}
      {/* the fan belt, behind the grille */}
      <ellipse cx={138} cy={162} rx={9} ry={14} fill="none" stroke="#2a2a2a" strokeWidth={3} />
      <circle cx={138} cy={152} r={3} fill={STEEL} />
      <circle cx={138} cy={172} r={4} fill={STEEL} />
      {e.has('beltCrack') && <path d="M131,158 l2,1 M131,164 l2,-1 M146,160 l-2,1" fill="none" stroke="#e8e0d0" strokeWidth={0.9} />}
      {/* the air filter bowl on the bonnet, and the exhaust */}
      <rect x={156} y={98} width={18} height={24} rx={4} fill={e.has('dustyFilter') ? '#b9a27a' : '#3c3c3c'} />
      {e.has('dustyFilter') && <path d="M158,104 h14 M158,110 h14 M158,116 h14" fill="none" stroke="#8a7650" strokeWidth={1} />}
      <path d="M184,118 L184,70 L190,64" fill="none" stroke="#3a3a3a" strokeWidth={5} />
      <path d="M184,118 L184,70 L190,64" fill="none" />
      {/* the fuel cap */}
      <rect x={226} y={110} width={14} height={8} rx={2} fill="#2f2f2f" />
      <circle cx={233} cy={108} r={3} fill="#5a5a5a" />
      {e.has('waterInFuel') && (
        <g>
          <rect x={244} y={160} width={10} height={14} rx={3} fill="rgba(240,240,220,0.85)" />
          <rect x={245} y={168} width={8} height={5} rx={2} fill="#8fd0ea" stroke="none" />
        </g>
      )}
      {/* the step and the battery box under it */}
      <rect x={240} y={180} width={34} height={16} rx={2} fill="#4a4a4a" />
      <rect x={246} y={184} width={8} height={4} fill="#c9c9c9" stroke="none" />
      <rect x={260} y={184} width={8} height={4} fill="#c9c9c9" stroke="none" />
      {e.has('batteryCorrosion') && (
        <g fill="#f4f6ef" strokeWidth={0.6}>
          <circle cx={249} cy={184} r={2.4} />
          <circle cx={252} cy={183} r={1.8} />
          <circle cx={247} cy={182} r={1.4} />
        </g>
      )}
      {/* the fender over the big wheel, the seat and the steering wheel */}
      <path d="M268,180 C268,120 300,106 336,106 C370,106 392,124 396,150 L396,160 L380,160 C376,136 360,124 336,124 C306,124 288,142 288,180 Z" fill={RED} />
      <path d="M300,128 L328,124 L330,132 L302,136 Z" fill="#2f2f2f" />
      <path d="M326,104 L320,82 L340,80 L346,102" fill="#2f2f2f" />
      <path d="M262,118 L276,88" fill="none" stroke="#2f2f2f" strokeWidth={3} />
      <ellipse cx={278} cy={86} rx={10} ry={3} fill="none" stroke="#2f2f2f" strokeWidth={2.4} />
      {/* the work light on the fender */}
      <path d="M350,104 L356,92 L366,92 L366,104 Z" fill="#3c3c3c" />
      <circle cx={362} cy={97} r={3.6} fill={e.has('lightOut') ? '#5a5a5a' : '#fff4b0'} />
      {e.has('lightOut') && <path d="M359,94 l6,6 M365,94 l-6,6" fill="none" stroke="#2a2a2a" strokeWidth={0.8} />}
      {/* the headlight */}
      <circle cx={108} cy={134} r={4} fill="#fff4b0" />

      {/* the wheels */}
      <Wheel cx={140} cy={218} rr={34} soft={e.has('softTyre')} />
      <Wheel cx={334} cy={196} rr={56} cut={e.has('tyreCut')} />
      {/* the rear wheel's nuts */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return <circle key={i} cx={334 + Math.cos(a) * 16} cy={196 + Math.sin(a) * 16} r={2.4} fill="#7a6a2a" strokeWidth={0.8} />;
      })}
      {e.has('looseNut') && <path d="M350,196 C352,204 351,212 352,220" fill="none" stroke="#b5651d" strokeWidth={1.6} />}

      {/* red: worn out, and low on fuel */}
      {r.has('worn') && (
        <g className="ex-haze" fill="none" stroke="#6a6a6a" strokeWidth={2.4} opacity={0.6}>
          <path d="M190,58 q6,-8 0,-16 q-6,-8 0,-16" />
          <path d="M198,52 q6,-8 0,-16 q-6,-8 0,-16" />
        </g>
      )}
      {r.has('fuel') && (
        <g>
          <rect x={212} y={88} width={42} height={14} rx={4} fill="#fff" />
          <path d="M218,98 A14,14 0 0 1 246,98" fill="none" strokeWidth={1} />
          <path d="M232,98 L221,92" fill="none" stroke="#b3321f" strokeWidth={1.6} />
          <text x={216} y={97} fontSize={5} fontWeight={800} fill="#b3321f" stroke="none">
            E
          </text>
        </g>
      )}
    </g>
  );
}
