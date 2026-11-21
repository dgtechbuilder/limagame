import { INK } from '../../art/anime';

/* The farm's power, drawn on the 480 × 270 scene: the solar panels on the farmhouse roof and their frame, the cable
   down the wall, the power room cut open (the charge controller, the battery bank and its terminals, the inverter, a
   socket and the light) and the backup generator outside with its fuel can. Early signs (src/inspect/early.ts
   POWER_EARLY) are drawn where a walk round the system finds them; `r` holds the red ones (low on diesel, power
   short). */

const SW = 1.3;

export function PowerScene({ uid, e, r }: { uid: string; e: Set<string>; r: Set<string> }) {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfe6f0" />
          <stop offset="1" stopColor="#f6ecd2" />
        </linearGradient>
      </defs>
      <rect x={-400} y={-300} width={1280} height={520} fill={`url(#${uid}-sky)`} stroke="none" />
      <rect x={-400} y={226} width={1280} height={300} fill="#c9b07e" stroke="none" />
      <path d="M-400,226 H880" fill="none" />

      {/* the farmhouse wall and roof, with the panels */}
      <rect x={30} y={96} width={340} height={130} fill="#efe0c2" />
      <path d="M14,100 L120,40 L386,40 L386,100 Z" fill="#a86a4a" />
      <path d="M40,96 L130,46 M80,98 L160,52" fill="none" stroke="#8a5238" strokeWidth={1} />
      {/* a branch from the tree reaching over the panels */}
      {e.has('branchShade') && (
        <g>
          <path d="M430,10 C380,10 300,20 250,34" fill="none" stroke="#7c5332" strokeWidth={4} />
          <path d="M250,34 C240,22 226,22 222,32 C230,42 244,42 250,34 Z M276,28 C270,16 256,16 252,26 C260,36 272,36 276,28 Z" fill="#5f9a46" />
        </g>
      )}
      <g>
        {[0, 1, 2].map(i => (
          <g key={i} transform={`translate(${126 + i * 62} 44)`}>
            <path d="M0,0 L56,0 L50,40 L-8,40 Z" fill="#2b4f86" />
            <path d="M18,0 L14,40 M36,0 L32,40 M-4,13 L54,13 M-6,27 L52,27" fill="none" stroke="#6f93c9" strokeWidth={0.9} />
            {e.has('dusty') && <path d="M4,6 C14,4 26,10 40,6 L38,18 C26,22 14,16 2,20 Z" fill="#c9b07e" stroke="none" opacity={0.7} />}
            {e.has('dusty') && i === 1 && <circle cx={24} cy={30} r={2.4} fill="#f4f1e4" stroke="none" />}
          </g>
        ))}
        {/* the frame's bolts */}
        {[120, 182, 244, 306].map(x => (
          <circle key={x} cx={x} cy={86} r={2.2} fill="#9aa6ae" />
        ))}
        {e.has('looseMount') && <path d="M306,86 l4,6 M302,90 l8,2" fill="none" stroke="#b3321f" strokeWidth={1.1} />}
      </g>
      {/* the cable down the wall */}
      <path d="M330,84 C340,90 344,100 344,112 L344,124" fill="none" stroke="#2a2a2a" strokeWidth={3} />
      {e.has('cableSun') && <path d="M338,92 l3,2 M343,100 l3,1 M344,108 l-3,1" fill="none" stroke="#e8e0d0" strokeWidth={1} />}

      {/* the power room, cut open */}
      <rect x={60} y={116} width={300} height={110} fill="#d8c8a4" />
      <path d="M60,116 H360" fill="none" />
      {/* the charge controller */}
      <rect x={320} y={128} width={30} height={26} rx={3} fill="#3c4a5a" />
      <rect x={326} y={134} width={18} height={8} rx={1} fill={e.has('controllerBlink') ? '#e5543f' : '#7ccf8a'} stroke="none" className={e.has('controllerBlink') ? 'ex-hiss' : undefined} />
      <path d="M344,124 L344,128" fill="none" stroke="#2a2a2a" strokeWidth={3} />
      <path d="M335,154 L335,176 L300,176" fill="none" stroke="#2a2a2a" strokeWidth={2.4} />
      {/* the battery bank */}
      {[0, 1, 2].map(i => (
        <g key={i}>
          <rect x={232 + i * 24} y={180} width={20} height={42} rx={2} fill="#3a3f46" />
          <rect x={236 + i * 24} y={174} width={4} height={6} fill="#c9c9c9" />
          <rect x={244 + i * 24} y={174} width={4} height={6} fill="#c9c9c9" />
          <rect x={236 + i * 24} y={188} width={12} height={4} rx={1} fill={e.has('batteryWater') ? '#6a7a8a' : '#58b7e6'} stroke="none" />
        </g>
      ))}
      {e.has('terminalCrust') && (
        <g fill="#f4f6ef" strokeWidth={0.6}>
          <circle cx={238} cy={173} r={2.4} />
          <circle cx={241} cy={171} r={1.6} />
          <circle cx={262} cy={173} r={2} />
        </g>
      )}
      {/* the inverter */}
      <rect x={160} y={130} width={50} height={56} rx={4} fill="#e6e9ec" />
      <rect x={168} y={140} width={34} height={12} rx={2} fill="#2b4f86" stroke="none" />
      <path d="M170,164 H200 M170,170 H200 M170,176 H200" fill="none" stroke={e.has('inverterDust') ? '#8a7650' : '#9aa6ae'} strokeWidth={e.has('inverterDust') ? 2.4 : 1} />
      {r.has('short') && (
        <text x={171} y={149} fontSize={7} fontWeight={800} fill="#ff8a7a" stroke="none">
          LOW
        </text>
      )}
      <path d="M210,160 L232,160 L232,190" fill="none" stroke="#2a2a2a" strokeWidth={2.4} />
      {/* a socket, and what is plugged in */}
      <rect x={100} y={150} width={18} height={22} rx={3} fill="#f6f6f2" />
      <circle cx={106} cy={160} r={1.4} fill={INK} stroke="none" />
      <circle cx={112} cy={160} r={1.4} fill={INK} stroke="none" />
      <path d="M160,160 L118,160" fill="none" stroke="#2a2a2a" strokeWidth={2} />
      {e.has('overload') && (
        <g>
          <rect x={86} y={180} width={36} height={10} rx={2} fill="#f6f6f2" />
          {[92, 100, 108, 116].map(x => (
            <path key={x} d={`M${x},180 L${x},172`} fill="none" stroke="#2a2a2a" strokeWidth={1.6} />
          ))}
          <path className="ex-haze" d="M104,178 q3,-4 0,-8" fill="none" stroke="#e5543f" strokeWidth={1} />
        </g>
      )}
      {/* the light */}
      <path d="M130,116 L130,128" fill="none" stroke="#2a2a2a" strokeWidth={1.4} />
      <path d="M124,128 L136,128 L134,134 L126,134 Z" fill="#3c3c3c" />
      <circle cx={130} cy={139} r={5} fill="#fff4b0" />
      {e.has('dayLights') && (
        <g fill="none" stroke="#f0c43a" strokeWidth={1}>
          <path d="M120,142 l-4,2 M140,142 l4,2 M130,148 l0,4" />
        </g>
      )}

      {/* the generator outside, and its fuel can */}
      <rect x={400} y={188} width={60} height={40} rx={4} fill="#d8a32a" />
      <rect x={404} y={182} width={52} height={8} rx={2} fill="#3c3c3c" />
      <circle cx={420} cy={208} r={9} fill="#3c3c3c" />
      <circle cx={420} cy={208} r={4} fill="#6a6a6a" />
      <rect x={436} y={198} width={18} height={6} rx={1} fill="#3c3c3c" />
      <path d="M458,184 L458,170 L466,166" fill="none" stroke="#5a5a5a" strokeWidth={3} />
      {e.has('genOil') && <ellipse cx={428} cy={232} rx={12} ry={2.6} fill="#3a2a1a" stroke="none" opacity={0.8} />}
      <path d="M466,206 L486,206 L488,230 L464,230 Z" fill={e.has('oldFuel') ? '#9a5a3a' : '#c8402e'} />
      <path d="M470,206 L470,200 L480,200" fill="none" strokeWidth={2} />
      {r.has('fuel') && (
        <g>
          <rect x={436} y={150} width={44} height={14} rx={4} fill="#fff" />
          <path d="M444,160 A14,14 0 0 1 472,160" fill="none" strokeWidth={1} />
          <path d="M458,160 L447,154" fill="none" stroke="#b3321f" strokeWidth={1.6} />
        </g>
      )}
    </g>
  );
}
