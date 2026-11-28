import type { ReactElement } from 'react';
import { Bush, Meadow, SB, Scribble, Tuft } from '../art/storybook';
import type { PlantId } from './model';

/* The mini forest's plants, drawn in the storybook look (src/art/storybook.tsx): flat painted shapes in the SB
   palette, lighter and darker tones of one colour for shading, pale scribbles on the crowns, no outlines. Each plant
   stands on a small patch of meadow under a sage sky. Pure drawing, no state. */

const W = 120;
const H = 90;
const GROUND = 72;

/** An umbrella thorn acacia: a thin leaning trunk that forks, and a wide flat crown. */
function Acacia() {
  return (
    <g>
      <ellipse cx={60} cy={GROUND + 1} rx={34} ry={4} fill={SB.shadow} />
      <path d="M57 72 L59 46 L50 30 M59 46 L70 31 M59 52 L64 72" stroke={SB.trunk} strokeWidth={4} strokeLinecap="round" fill="none" />
      <ellipse cx={60} cy={28} rx={44} ry={9} fill={SB.leaf} />
      <ellipse cx={52} cy={24} rx={30} ry={6.5} fill={SB.leafMid} />
      <ellipse cx={46} cy={22} rx={14} ry={3.5} fill={SB.leafLight} />
      <Scribble x={32} y={27} w={16} />
      <Scribble x={66} y={25} w={14} opacity={0.5} />
    </g>
  );
}

/** A baobab: a great swollen trunk, short stubby branches, a thin crown of leaves and hanging fruit. */
function Baobab() {
  return (
    <g>
      <ellipse cx={60} cy={GROUND + 1} rx={30} ry={4} fill={SB.shadow} />
      <path d="M40 72 C38 52 44 40 50 30 L70 30 C76 40 82 52 80 72 Z" fill="#a98466" />
      <path d="M48 72 C47 56 51 42 55 32 L60 32 C57 44 55 58 56 72 Z" fill="#b99678" />
      <path d="M52 31 L42 18 M57 30 L55 12 M64 30 L68 14 M68 31 L80 20" stroke="#a98466" strokeWidth={4} strokeLinecap="round" />
      {[[40, 16, 9], [55, 10, 8], [69, 12, 9], [82, 18, 8]].map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill={SB.leaf} />
          <circle cx={x - 2} cy={y - 2} r={r * 0.55} fill={SB.leafMid} />
        </g>
      ))}
      <Scribble x={50} y={11} w={10} opacity={0.5} />
      {[[45, 27], [74, 26], [62, 22]].map(([x, y], i) => (
        <g key={i}>
          <path d={`M${x} ${y - 6} L${x} ${y - 1}`} stroke={SB.trunk} strokeWidth={0.8} />
          <ellipse cx={x} cy={y + 2} rx={2.2} ry={3.4} fill="#c9b48a" />
        </g>
      ))}
    </g>
  );
}

/** A round-crowned tree (croton): a straight trunk and a big round crown in two greens. */
function RoundTree({ nuts }: { nuts?: boolean }) {
  return (
    <g>
      <ellipse cx={60} cy={GROUND + 1} rx={26} ry={4} fill={SB.shadow} />
      <path d="M57 72 L58 40 L62 40 L63 72 Z" fill={SB.trunk} />
      <circle cx={46} cy={34} r={16} fill={SB.leaf} />
      <circle cx={74} cy={33} r={15} fill={SB.leaf} />
      <circle cx={60} cy={22} r={19} fill={SB.leaf} />
      <circle cx={54} cy={18} r={11} fill={SB.leafMid} />
      <circle cx={44} cy={30} r={7} fill={SB.leafMid} />
      <Scribble x={40} y={22} w={16} />
      <Scribble x={60} y={34} w={12} opacity={0.5} />
      {nuts && [[50, 40], [68, 42], [76, 30], [62, 30]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.8} fill={SB.earthDeep} />)}
    </g>
  );
}

/** A Nile tulip (Markhamia): tall and narrow, its crown in layers, yellow trumpet flowers. */
function Markhamia() {
  return (
    <g>
      <ellipse cx={60} cy={GROUND + 1} rx={18} ry={3.5} fill={SB.shadow} />
      <path d="M58.5 72 L59 18 L61 18 L61.5 72 Z" fill={SB.trunk} />
      <ellipse cx={60} cy={50} rx={15} ry={9} fill={SB.leaf} />
      <ellipse cx={60} cy={34} rx={13} ry={10} fill={SB.leaf} />
      <ellipse cx={60} cy={18} rx={10} ry={10} fill={SB.leafMid} />
      <ellipse cx={56} cy={32} rx={6} ry={5} fill={SB.leafMid} />
      <Scribble x={51} y={47} w={10} opacity={0.55} />
      <Scribble x={53} y={18} w={9} />
      {[[50, 44], [70, 47], [66, 30], [54, 26], [62, 12], [69, 38]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} l2 4 l2 -4 Z`} fill={SB.flower[1]} />
      ))}
    </g>
  );
}

/** A bush, with its flowers or berries. */
function FlowerBush({ dots, color, tall }: { dots: [number, number][]; color: string; tall?: boolean }) {
  return (
    <g>
      {tall && <path d="M54 72 L56 44 M60 72 L60 40 M66 72 L64 44" stroke={SB.trunk} strokeWidth={1.6} strokeLinecap="round" />}
      <Bush x={60} y={tall ? 52 : GROUND} r={tall ? 16 : 18} />
      {!tall && <Bush x={40} y={GROUND} r={10} />}
      {!tall && <Bush x={80} y={GROUND} r={11} />}
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2} fill={color} />
      ))}
    </g>
  );
}

/** A stand of grass: blades of one height, and its seed heads. */
function Grass({ tall, heads }: { tall: number; heads: 'plume' | 'finger' | 'spike' }) {
  const blades = Array.from({ length: 13 }, (_, i) => 26 + i * 5.6);
  return (
    <g>
      <ellipse cx={60} cy={GROUND + 1} rx={38} ry={3.5} fill={SB.shadow} />
      {blades.map((x, i) => {
        const h = tall * (0.75 + ((i * 7) % 5) * 0.07);
        const lean = ((i % 3) - 1) * 6;
        return (
          <g key={i}>
            <path d={`M${x} ${GROUND} q${lean * 0.3} ${-h * 0.5} ${lean} ${-h}`} stroke={i % 2 ? SB.grassDark : SB.leafMid} strokeWidth={heads === 'plume' ? 3 : 2} strokeLinecap="round" fill="none" />
            {i % 2 === 0 && heads === 'plume' && <ellipse cx={x + lean} cy={GROUND - h - 3} rx={1.6} ry={4} fill={SB.meadow} />}
            {i % 3 === 0 && heads === 'finger' && (
              <path d={`M${x + lean} ${GROUND - h} l-3 -5 M${x + lean} ${GROUND - h} l0 -6 M${x + lean} ${GROUND - h} l3 -5`} stroke={SB.earthDeep} strokeWidth={1} strokeLinecap="round" />
            )}
            {i % 3 === 1 && heads === 'spike' && <path d={`M${x + lean} ${GROUND - h} l1 -7`} stroke={SB.earthDeep} strokeWidth={1.6} strokeLinecap="round" />}
          </g>
        );
      })}
    </g>
  );
}

const DRAW: Record<PlantId, () => ReactElement> = {
  croton: () => <RoundTree nuts />,
  markhamia: () => <Markhamia />,
  acacia: () => <Acacia />,
  baobab: () => <Baobab />,
  sesbania: () => <FlowerBush tall color={SB.flower[1]} dots={[[50, 40], [68, 38], [60, 30], [72, 48], [46, 50]]} />,
  carissa: () => <FlowerBush color="#7a3a6a" dots={[[46, 60], [58, 52], [66, 58], [74, 50], [52, 64], [84, 64], [36, 66]]} />,
  vernonia: () => <FlowerBush color={SB.flower[0]} dots={[[48, 56], [56, 50], [64, 54], [72, 52], [60, 60], [40, 64], [82, 62]]} />,
  napier: () => <Grass tall={50} heads="plume" />,
  brachiaria: () => <Grass tall={30} heads="spike" />,
  rhodes: () => <Grass tall={22} heads="finger" />,
};

/** A plant on its patch of meadow under the sky. `young`: felled and growing back, drawn small. */
export function PlantArt({ id, size = 120, young = 1, label }: { id: PlantId; size?: number; young?: number; label?: string }) {
  const s = 0.35 + 0.65 * Math.max(0, Math.min(1, young));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={size} height={(size * H) / W} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="fo-art">
      <rect width={W} height={GROUND} fill={SB.sky} />
      <rect y={GROUND - 22} width={W} height={22} fill={SB.skyLow} />
      <path d={`M0 ${GROUND - 6} Q30 ${GROUND - 16} 62 ${GROUND - 8} T${W} ${GROUND - 10} V${GROUND} H0 Z`} fill={SB.hillFar} />
      <rect y={GROUND} width={W} height={H - GROUND} fill={SB.grass} />
      <Meadow x={0} y={GROUND + 2} w={W} h={H - GROUND - 4} n={14} seed={id.length * 7} flowers={0.3} />
      <g transform={`translate(60 ${GROUND}) scale(${s}) translate(-60 ${-GROUND})`}>{DRAW[id]()}</g>
      <Tuft x={10} y={GROUND + 2} />
      <Tuft x={110} y={GROUND + 3} s={0.9} />
    </svg>
  );
}

/** The mini forest's icon: three storybook trees of different greens on a mound, for buttons and the map. */
export function ForestIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <ellipse cx={12} cy={20.5} rx={10} ry={2.4} fill={SB.grassDark} />
      <path d="M6.6 20 L7 14 M17.4 20 L17 14 M12 20.5 L12 12" stroke={SB.trunk} strokeWidth={1.4} strokeLinecap="round" />
      <circle cx={6.6} cy={11.5} r={4} fill={SB.leafMid} />
      <circle cx={17.4} cy={11.5} r={4} fill={SB.leafLight} />
      <circle cx={12} cy={8} r={5.6} fill={SB.leaf} />
      <circle cx={10.4} cy={6.6} r={2.4} fill={SB.leafMid} />
      <path d="M9 9 c1 -1.4 2 -1.4 2.2 0 c0.3 1 -1.2 1 -0.8 0 c0.8 -1.2 2.3 -1.4 2.6 0" stroke={SB.leafLine} strokeWidth={0.6} fill="none" strokeLinecap="round" />
    </svg>
  );
}
