import type { ReactNode } from 'react';
import { SB, Scribble } from '../art/storybook';
import type { ProduceId } from './model';

/* The food in the store, drawn in the storybook look (src/art/storybook.tsx): flat painted shapes with no outlines, a
   lighter and a darker tone of one colour for the shading, the pale looping scribble on leaves, and a soft shadow
   underneath. One 32 x 32 drawing a food, used on the market stall and the storehouse. Pure drawing, no state. */

const TOMATO = '#d9553f';
const TOMATO_DARK = '#b8412f';
const RED = '#c8402f';
const CORN = '#f0c544';
const CORN_DARK = '#d9a62c';
const BEAN = '#9a4a32';
const BEAN_DARK = '#7a3826';

const Shadow = ({ w = 22 }: { w?: number }) => <ellipse cx={16} cy={28.5} rx={w / 2} ry={2.2} fill={SB.shadow} />;
const Shine = ({ x, y, r = 1.6 }: { x: number; y: number; r?: number }) => <ellipse cx={x} cy={y} rx={r} ry={r * 0.7} fill={SB.white} opacity={0.55} />;

/** A jar of something made in the storehouse. */
const Jar = ({ fill, dark }: { fill: string; dark: string }) => (
  <>
    <Shadow w={18} />
    <rect x={9} y={9} width={14} height={19} rx={4} fill={fill} />
    <rect x={9} y={20} width={14} height={8} rx={4} fill={dark} />
    <rect x={10} y={5} width={12} height={5} rx={1.5} fill={SB.woodLight} />
    <rect x={10} y={8.5} width={12} height={1.5} fill={SB.wood} />
    <rect x={11} y={14} width={10} height={6} rx={1} fill={SB.wall} />
    <rect x={12.5} y={16.2} width={7} height={1.2} rx={0.6} fill={SB.wallShade} />
    <Shine x={12} y={12} r={1.2} />
  </>
);

const DRAW: Record<ProduceId, () => ReactNode> = {
  maize: () => (
    <>
      <Shadow />
      {/* the husk leaves behind the cob */}
      <path d="M16 29 C9 26 6 18 8 10 C11 16 13 21 16 24 Z" fill={SB.leafMid} />
      <path d="M16 29 C23 26 26 18 24 10 C21 16 19 21 16 24 Z" fill={SB.leaf} />
      <ellipse cx={16} cy={15} rx={5.2} ry={11} fill={CORN} />
      <path d="M16 4 C19.5 6 21 11 21 15 C21 21 18.5 25 16 26 C18 22 18.6 18 18.4 14 C18.2 9 17.4 6 16 4 Z" fill={CORN_DARK} />
      {[7, 10, 13, 16, 19, 22].map(y => (
        <g key={y} fill={SB.white} opacity={0.45}>
          <circle cx={14} cy={y} r={0.8} />
          <circle cx={16.6} cy={y + 1.4} r={0.8} />
        </g>
      ))}
      <path d="M16 29 C12 27 10 23 10.5 19 C12.5 22 14 24 16 25 Z" fill={SB.leafLight} />
      <Scribble x={9.5} y={20} w={5} color={SB.leafLine} width={0.6} />
    </>
  ),
  drybeans: () => (
    <>
      <Shadow />
      {[
        [10, 21, -20],
        [20, 21, 25],
        [15, 14, 5],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x},${y}) rotate(${r})`}>
          <path d="M-6 0 C-6 -5 -1 -5.5 0 -3 C1 -5.5 6 -5 6 0 C6 4.5 -6 4.5 -6 0 Z" fill={BEAN} />
          <path d="M-6 0 C-6 4.5 6 4.5 6 0 C4 2.4 -4 2.4 -6 0 Z" fill={BEAN_DARK} />
          <ellipse cx={-2.5} cy={-1.6} rx={1.6} ry={0.8} fill={SB.white} opacity={0.4} />
          <circle cx={1.5} cy={1} r={0.6} fill={SB.wall} opacity={0.7} />
        </g>
      ))}
    </>
  ),
  sukuma: () => (
    <>
      <Shadow />
      <path d="M16 28 C7 25 4 15 9 7 C12 3 20 3 23 7 C28 15 25 25 16 28 Z" fill={SB.leaf} />
      <path d="M16 28 C10 24 8.5 15 11 8 C13 5.5 16 5 16 5 Z" fill={SB.leafMid} />
      <path d="M16 28 L16 6" stroke={SB.leafLine} strokeWidth={1.1} strokeLinecap="round" />
      {[11, 15, 19, 23].map(y => (
        <g key={y} stroke={SB.leafLine} strokeWidth={0.8} strokeLinecap="round" opacity={0.8}>
          <path d={`M16 ${y} L${11} ${y - 3}`} />
          <path d={`M16 ${y} L${21} ${y - 3}`} />
        </g>
      ))}
      <Scribble x={18} y={12} w={6} width={0.6} />
    </>
  ),
  spinach: () => (
    <>
      <Shadow />
      <ellipse cx={10.5} cy={17} rx={6} ry={9} transform="rotate(-25 10.5 17)" fill={SB.leafMid} />
      <ellipse cx={21.5} cy={17} rx={6} ry={9} transform="rotate(25 21.5 17)" fill={SB.leafMid} />
      <ellipse cx={16} cy={14} rx={6.5} ry={10} fill={SB.leafLight} />
      <path d="M16 26 L16 7" stroke={SB.leafLine} strokeWidth={1} strokeLinecap="round" />
      <rect x={14.5} y={24} width={3} height={4.5} rx={1.2} fill={SB.leaf} />
      <Scribble x={10.5} y={13} w={5} width={0.6} />
    </>
  ),
  tomatoes: () => (
    <>
      <Shadow />
      <circle cx={16} cy={18} r={10} fill={TOMATO} />
      <path d="M16 28 C22 28 26 23.5 26 18 C26 15 25 13 23.5 11.5 C24 16 22 24 16 28 Z" fill={TOMATO_DARK} />
      <path d="M16 8 L13 10.5 L9.5 9.5 L12 12 L10.5 14.5 L14 13.2 L16 15 L18 13.2 L21.5 14.5 L20 12 L22.5 9.5 L19 10.5 Z" fill={SB.leafMid} />
      <rect x={15.2} y={5} width={1.6} height={4} rx={0.8} fill={SB.leaf} />
      <Shine x={11.5} y={17} r={2} />
    </>
  ),
  capsicum: () => (
    <>
      <Shadow />
      <path d="M8 13 C8 9 11.5 8 13.5 9.5 C14.8 8.5 17.2 8.5 18.5 9.5 C20.5 8 24 9 24 13 C24 20 22 27 16 27 C10 27 8 20 8 13 Z" fill={SB.leafMid} />
      <path d="M16 27 C22 27 24 20 24 13 C24 11 23 9.5 21.5 9.2 C22.4 15 21 23 16 27 Z" fill={SB.leaf} />
      <path d="M16 9.5 C16 7 17 5 19 4" stroke={SB.leaf} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Shine x={11.5} y={15} r={1.8} />
    </>
  ),
  cucumber: () => (
    <>
      <Shadow w={26} />
      <g transform="rotate(-28 16 17)">
        <rect x={3} y={12} width={26} height={10} rx={5} fill={SB.leafMid} />
        <path d="M3 17 C3 20 5 22 8 22 L24 22 C27 22 29 20 29 17 C25 19.5 8 19.5 3 17 Z" fill={SB.leaf} />
        {[8, 12, 16, 20, 24].map((x, i) => (
          <circle key={x} cx={x} cy={i % 2 ? 14.5 : 16} r={0.7} fill={SB.leafLine} />
        ))}
        <rect x={27.5} y={15.5} width={2.5} height={3} rx={1} fill={SB.trunk} />
      </g>
    </>
  ),
  strawberries: () => (
    <>
      <Shadow />
      <path d="M16 28 C10 24 6 18 7 13 C8 9.5 12 9 16 10.5 C20 9 24 9.5 25 13 C26 18 22 24 16 28 Z" fill={RED} />
      <path d="M16 28 C21 24.5 25 18.5 25 13 C25 12 24.6 11 24 10.5 C24 17 21 23 16 28 Z" fill={TOMATO_DARK} />
      {[
        [11, 14],
        [15, 13.5],
        [19.5, 14],
        [13, 18],
        [17.5, 18],
        [15.3, 22],
        [21, 18.5],
        [10.5, 18.5],
      ].map(([x, y]) => (
        <ellipse key={`${x}${y}`} cx={x} cy={y} rx={0.6} ry={0.9} fill={SB.flower[1]} />
      ))}
      <path d="M16 11 L12 8 L10 10 L13 11.5 L11 13 L16 12 L21 13 L19 11.5 L22 10 L20 8 Z" fill={SB.leafMid} />
    </>
  ),
  chillies: () => (
    <>
      <Shadow />
      <path d="M9 8 C12 9 13 13 15 17 C17 21 21 25 26 26 C20 28.5 13 26 10 20 C8 16 7.5 11 9 8 Z" fill={RED} />
      <path d="M10 20 C13 26 20 28.5 26 26 C20 25 17 23 14 19 Z" fill={TOMATO_DARK} />
      <path d="M9 8 C8 6 7 5 5 4.5" stroke={SB.leafMid} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <ellipse cx={9.6} cy={8.4} rx={2.4} ry={1.6} fill={SB.leafMid} />
      <Shine x={10.5} y={13} r={1.2} />
    </>
  ),
  sauce: () => <Jar fill={TOMATO} dark={TOMATO_DARK} />,
  jam: () => <Jar fill={RED} dark="#9b2b3a" />,
  chillisauce: () => <Jar fill="#e0623a" dark={RED} />,
  pickles: () => <Jar fill={SB.leafLight} dark={SB.leafMid} />,
  flour: () => (
    <>
      <Shadow />
      <path d="M8 12 C8 9 10 8 12 8 L20 8 C22 8 24 9 24 12 L25 25 C25 27 23.5 28 21.5 28 L10.5 28 C8.5 28 7 27 7 25 Z" fill={SB.wall} />
      <path d="M24 12 L25 25 C25 27 23.5 28 21.5 28 L16 28 C20 26 22 18 22 9 C23.2 9.5 24 10.5 24 12 Z" fill={SB.wallShade} />
      <path d="M11 8 C12 5.5 14 5 16 6 C18 5 20 5.5 21 8 Z" fill={SB.wallShade} />
      <rect x={10.5} y={7.2} width={11} height={1.8} rx={0.9} fill={SB.wood} />
      <path d="M12.5 17 C14 15 18 15 19.5 17 C18 19 14 19 12.5 17 Z" fill={CORN} />
      <path d="M16 15.5 L16 18.5" stroke={SB.leafMid} strokeWidth={0.8} />
    </>
  ),
};

/** A food's storybook drawing. */
export function FoodIcon({ id, size = 32, title }: { id: ProduceId; size?: number; title?: string }) {
  const draw = DRAW[id];
  return (
    <svg className="food-icon" width={size} height={size} viewBox="0 0 32 32" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      {draw ? draw() : null}
    </svg>
  );
}
