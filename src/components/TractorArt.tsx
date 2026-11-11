/* A side view of each tractor type, for the cards where the player picks one: the compact (small, orange, open seat
   under a roll bar), the standard (green, a cab and one exhaust) and the large (blue, a tall glass cab, big rear
   wheels, front weights and two exhausts). Drawn in SVG, so it is sharp on every phone and costs no download. */

export type TractorArtKind = 'compact' | 'standard' | 'large';

const PAINT: Record<TractorArtKind, { body: string; dark: string; rim: string }> = {
  compact: { body: '#e07b2a', dark: '#a8551a', rim: '#f2c14e' },
  standard: { body: '#3e8e3a', dark: '#2a6327', rim: '#f2c14e' },
  large: { body: '#2f6fb5', dark: '#1f4f85', rim: '#d9dde2' },
};

function Wheel({ x, y, r, rim }: { x: number; y: number; r: number; rim: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill="#2a2a2a" />
      {/* tread lugs */}
      {Array.from({ length: 12 }, (_, k) => {
        const a = (k / 12) * Math.PI * 2;
        return <rect key={k} x={x - 1.2} y={y - r - 1} width={2.4} height={3} rx={0.6} fill="#2a2a2a" transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`} />;
      })}
      <circle cx={x} cy={y} r={r * 0.55} fill={rim} />
      <circle cx={x} cy={y} r={r * 0.2} fill="#6b6f73" />
    </g>
  );
}

export function TractorArt({ kind, width = 96 }: { kind: TractorArtKind; width?: number }) {
  const c = PAINT[kind];
  return (
    <svg className="tractor-art" viewBox="0 0 96 60" width={width} height={(width * 60) / 96} aria-hidden="true">
      <ellipse cx={48} cy={57} rx={40} ry={2.6} fill="rgba(0,0,0,0.18)" />
      {kind === 'compact' && (
        <g>
          {/* hood and engine */}
          <path d="M44,30 L76,30 Q80,30 80,34 L80,42 L44,42 Z" fill={c.body} />
          <rect x={48} y={33} width={18} height={2} rx={1} fill={c.dark} />
          <rect x={48} y={37} width={18} height={2} rx={1} fill={c.dark} />
          <rect x={70} y={22} width={2.6} height={9} fill="#4a4e52" />
          {/* seat, steering and the roll bar */}
          <rect x={26} y={34} width={20} height={9} rx={2} fill={c.body} />
          <rect x={30} y={27} width={10} height={4} rx={1.5} fill="#26323d" />
          <path d="M42,30 L46,22" stroke="#26323d" strokeWidth={2} strokeLinecap="round" />
          <path d="M28,34 L28,10 L42,10 L42,30" fill="none" stroke="#4a4e52" strokeWidth={2.4} strokeLinejoin="round" />
          <Wheel x={30} y={46} r={10} rim={c.rim} />
          <Wheel x={72} y={49} r={7} rim={c.rim} />
        </g>
      )}
      {kind === 'standard' && (
        <g>
          <path d="M46,27 L80,27 Q85,27 85,32 L85,41 L46,41 Z" fill={c.body} />
          {[31, 35].map(y => (
            <rect key={y} x={52} y={y} width={22} height={2} rx={1} fill={c.dark} />
          ))}
          <rect x={83} y={33} width={4} height={6} rx={1} fill="#f2e6a0" />
          <rect x={72} y={14} width={3} height={14} fill="#4a4e52" />
          <rect x={71} y={12} width={5} height={3} rx={1} fill="#26323d" />
          {/* the cab */}
          <path d="M22,41 L22,10 Q22,7 25,7 L46,7 Q49,7 49,10 L49,41 Z" fill={c.body} />
          <path d="M25,11 L46,11 L46,26 L25,26 Z" fill="#a0d2f0" />
          <path d="M35,11 L35,26" stroke={c.body} strokeWidth={2} />
          <rect x={20} y={5} width={31} height={4} rx={1.5} fill={c.dark} />
          <Wheel x={32} y={44} r={13} rim={c.rim} />
          <Wheel x={76} y={48} r={8} rim={c.rim} />
        </g>
      )}
      {kind === 'large' && (
        <g>
          {/* front weights, hood, two exhausts */}
          <rect x={86} y={30} width={6} height={13} rx={1.5} fill="#26323d" />
          <path d="M48,24 L82,24 Q87,24 87,29 L87,42 L48,42 Z" fill={c.body} />
          {[28, 32, 36].map(y => (
            <rect key={y} x={54} y={y} width={24} height={2} rx={1} fill={c.dark} />
          ))}
          <rect x={70} y={9} width={3} height={16} fill="#4a4e52" />
          <rect x={76} y={11} width={3} height={14} fill="#4a4e52" />
          {/* the tall glass cab */}
          <path d="M18,42 L18,6 Q18,2 22,2 L48,2 Q52,2 52,6 L52,42 Z" fill={c.body} />
          <path d="M21,6 L49,6 L49,27 L21,27 Z" fill="#a0d2f0" />
          <path d="M21,6 L30,6 L21,15 Z" fill="#d8eefb" />
          <path d="M35,6 L35,27" stroke={c.body} strokeWidth={2} />
          <rect x={16} y={0.5} width={38} height={4} rx={1.5} fill={c.dark} />
          <rect x={10} y={30} width={8} height={4} rx={1} fill="#f2e6a0" />
          <Wheel x={30} y={42} r={16} rim={c.rim} />
          <Wheel x={76} y={47} r={9.5} rim={c.rim} />
        </g>
      )}
    </svg>
  );
}
