import { useId, type CSSProperties } from 'react';
import type { Look } from '../first/data';

/* Retro anime characters, drawn in SVG: flat cel colours with one hard shadow tone, a purple-black ink outline,
   tall eyes with two highlights, hatched blush, and screentone dots in the shadows (the late-80s TV anime look).
   One kit draws the player's farmer (every look), the farming guide, the shopkeeper and Ojuok.

   Head space: the face is centred on (0, 0), about 22 wide; the chin is at y = 14.6, the neck runs to y = 18.5 and
   the shoulders sit below it. A full figure stands with its feet at (0, 0), about 90 tall, like the original one. */

export const INK = '#2a1730';
const SHADE_TINT = '#5b3a7a';

export type Hair = 'coils' | 'hitop' | 'locs' | 'bun';
export type Headwear = 'wrap' | 'scarf' | 'cap' | 'none';
export type Extra = 'earrings' | 'lanyard' | 'necklace' | 'overalls' | 'plaid';
export type Mood = 'smile' | 'grin' | 'calm';

export interface Toon {
  skin: string;
  hair: Hair;
  hairColor: string;
  head: Headwear;
  headColor: string;
  /** the headwrap's pattern colour */
  headColor2?: string;
  outfit: string;
  trim: string;
  iris?: string;
  /** a flick at the outer corner of the eye */
  lashes?: boolean;
  extra?: Extra[];
}

/* ---------------- colour ---------------- */

const hex = (c: string) => {
  const h = c.replace('#', '');
  const f = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
  return [0, 2, 4].map(i => parseInt(f.slice(i, i + 2), 16));
};
const mix = (a: string, b: string, t: number) => {
  const A = hex(a);
  const B = hex(b);
  return `#${A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
};
/** the cel shadow: darker and a little purple, as retro anime paints it */
export const shade = (c: string, t = 0.34) => mix(c, SHADE_TINT, t);
export const light = (c: string, t = 0.35) => mix(c, '#ffffff', t);

/* ---------------- the player's looks and the cast ---------------- */

/** The player's look (first/data.ts LOOKS) as an anime character. */
export function lookToon(l: Look): Toon {
  if (l.head === 'wrap') return { skin: l.skin, hair: 'bun', hairColor: '#1d1410', head: 'wrap', headColor: l.headColor, headColor2: l.trim, outfit: l.outfit, trim: l.trim, lashes: true, extra: ['earrings'] };
  if (l.head === 'cap') return { skin: l.skin, hair: 'coils', hairColor: '#1d1410', head: 'cap', headColor: l.headColor, outfit: l.outfit, trim: l.trim };
  return { skin: l.skin, hair: 'hitop', hairColor: l.headColor, head: 'none', headColor: l.headColor, outfit: l.outfit, trim: l.trim };
}

export type CastId = 'guide' | 'shopkeeper' | 'ojuok';

export const CAST: Record<CastId, Toon> = {
  /** the farming guide (the green top, badge and headwrap of the original art) */
  guide: { skin: '#7b4a2d', hair: 'locs', hairColor: '#2a1a14', head: 'wrap', headColor: '#e3a63a', headColor2: '#c2462e', outfit: '#3f8f46', trim: '#e9b949', lashes: true, extra: ['earrings', 'lanyard', 'necklace'] },
  /** the shopkeeper (headscarf, gold hoops, overalls) */
  shopkeeper: { skin: '#6a3e25', hair: 'bun', hairColor: '#1f1410', head: 'scarf', headColor: '#e6b844', headColor2: '#7a3f8f', outfit: '#f1e6d2', trim: '#d9572b', lashes: true, extra: ['earrings', 'overalls'] },
  /** Ojuok, the rewards hub's farmer (red check shirt) */
  ojuok: { skin: '#5b3620', hair: 'coils', hairColor: '#1d1410', head: 'none', headColor: '#1d1410', outfit: '#d33b35', trim: '#ffffff', extra: ['plaid'] },
};

/* ---------------- shared defs ---------------- */

const uidOf = (raw: string) => `a${raw.replace(/[^a-zA-Z0-9]/g, '')}`;

function Defs({ uid, t }: { uid: string; t: Toon }) {
  return (
    <defs>
      {/* screentone: small ink dots laid over the cel shadows */}
      <pattern id={`${uid}-tone`} width={1.6} height={1.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <circle cx={0.8} cy={0.8} r={0.32} fill={INK} opacity={0.32} />
      </pattern>
      {t.extra?.includes('plaid') && (
        <pattern id={`${uid}-plaid`} width={6} height={6} patternUnits="userSpaceOnUse">
          <rect width={6} height={6} fill={t.outfit} />
          <rect width={3} height={6} fill={shade(t.outfit, 0.22)} />
          <rect width={6} height={3} fill={shade(t.outfit, 0.22)} />
          <rect width={3} height={3} fill={shade(t.outfit, 0.45)} />
          <path d="M 4.5,0 V 6 M 0,4.5 H 6" stroke="#fff" strokeWidth={0.45} opacity={0.75} />
        </pattern>
      )}
    </defs>
  );
}

/* ---------------- the head ---------------- */

const FACE = 'M -11,-2 C -11,-14 11,-14 11,-2 C 11,5 8,9.4 3.6,12.4 Q 0,14.6 -3.6,12.4 C -8,9.4 -11,5 -11,-2 Z';
const FACE_SHADE = 'M 11,-2 C 11,5 8,9.4 3.6,12.4 C 7.6,7 9,2 9.2,-2 Z';

const HAIR_FRONT: Partial<Record<Hair, string>> = {
  coils:
    'M -11.8,0 C -13.2,-9.5 -8.6,-16.2 -1.5,-16.6 C 6.5,-17 13.2,-11 11.8,0 C 11,-3.4 10,-5.6 7.6,-7.4 C 5.4,-8.8 2,-9.4 0,-9.2 C -3,-9.4 -6.4,-8.6 -8.4,-7 C -10.2,-5.6 -11.2,-3 -11.8,0 Z',
  hitop:
    'M -11.8,0 C -12.4,-6 -12.2,-12 -11.6,-17 L -9.2,-21.6 L -6.4,-19 L -3.4,-23.2 L -0.4,-19.6 L 2.8,-23.4 L 5.6,-19.2 L 8.8,-21.8 L 11.6,-17 C 12.2,-12 12.4,-6 11.8,0 C 11,-3.4 10,-5.6 7.6,-7.4 C 5.4,-8.8 2,-9.4 0,-9.2 C -3,-9.4 -6.4,-8.6 -8.4,-7 C -10.2,-5.6 -11.2,-3 -11.8,0 Z',
};
const WRAP = 'M -12.2,-0.5 C -14,-11 -8.6,-19.8 0,-20 C 8.6,-19.8 14,-11 12.2,-0.5 C 10.6,-4.8 6.2,-8.2 0,-8.4 C -6.2,-8.2 -10.6,-4.8 -12.2,-0.5 Z';
const WRAP_EDGE = 'M -12.2,-0.5 C -10.6,-4.8 -6.2,-8.2 0,-8.4 C 6.2,-8.2 10.6,-4.8 12.2,-0.5 C 11.4,-2.6 10.6,-4 9.6,-5.4 C 7,-8.8 3,-10 0,-10 C -3,-10 -7,-8.8 -9.6,-5.4 C -10.6,-4 -11.4,-2.6 -12.2,-0.5 Z';
const CAP = 'M -11.8,-2 C -12.4,-12.4 -6.4,-17.2 0,-17.2 C 6.4,-17.2 12.4,-12.4 11.8,-2 Z';
const BRIM = 'M -12.4,-2.6 C -5,-5.4 6,-5.6 12.6,-3.2 C 16.4,-2.4 18.6,-0.8 18.2,0.4 C 12,-1 2,-1.4 -12,-0.6 Z';

const stroke = (w: number, color = INK) => ({ stroke: color, strokeWidth: w, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const });

function Eye({ side, t }: { side: -1 | 1; t: Toon }) {
  const iris = t.iris ?? '#5a3220';
  const cx = side * 5.1;
  return (
    <g transform={`translate(${cx},1.2) scale(1.12) translate(${-cx},-1.2)`}>
      <g transform={side === 1 ? 'scale(-1,1)' : undefined}>
        <path d="M -8.6,-0.6 Q -5.4,-3.4 -1.9,-1.6 L -2.1,3.6 Q -5,5.2 -8.2,3.4 Z" fill="#fffaf2" />
      </g>
      <ellipse cx={cx} cy={1.4} rx={2.5} ry={3} fill={iris} />
      <ellipse cx={cx} cy={2.7} rx={1.8} ry={1.3} fill={light(iris, 0.45)} />
      <ellipse cx={cx} cy={1.1} rx={1.1} ry={1.6} fill={INK} />
      <ellipse cx={cx - 1.1} cy={-0.2} rx={1} ry={1.3} fill="#fff" />
      <circle cx={cx + 1.1} cy={3} r={0.55} fill="#fff" />
      <g transform={side === 1 ? 'scale(-1,1)' : undefined} fill="none">
        <path d="M -9.7,0.6 Q -5.5,-4.7 -1.1,-2.2 L -1.4,-1.2 Q -5.4,-3.2 -9.2,1.1 Z" fill={INK} {...stroke(0.5)} />
        {t.lashes && <path d="M -8.9,-0.5 L -10.6,-1.9" {...stroke(1)} />}
        <path d="M -7.6,3.9 Q -5.2,5 -2.8,4.2" {...stroke(0.55)} />
        <path d="M -8.8,-6.2 Q -5.6,-7.9 -2.4,-6.6" {...stroke(0.95, shade(t.hairColor === '#1d1410' ? '#3a2418' : t.hairColor, 0.2))} />
      </g>
    </g>
  );
}

function Mouth({ mood, skin }: { mood: Mood; skin: string }) {
  if (mood === 'grin')
    return (
      <g>
        <path d="M -3,8.3 Q 0,9 3,8.3 Q 2.2,12.2 0,12.2 Q -2.2,12.2 -3,8.3 Z" fill="#6b1f2a" {...stroke(0.6)} />
        <ellipse cx={0} cy={11.1} rx={1.4} ry={0.75} fill="#e0707a" />
      </g>
    );
  if (mood === 'calm') return <path d="M -1.8,9.4 Q 0,9.9 1.8,9.4" fill="none" {...stroke(0.7, shade(skin, 0.7))} />;
  return <path d="M -2.4,8.8 Q 0,10.4 2.4,8.8" fill="none" {...stroke(0.8, shade(skin, 0.75))} />;
}

/** One head, centred on the face. Drawn back to front: hair behind, ears, face, features, hair and headwear. */
export function AnimeHead({ t, mood = 'smile' }: { t: Toon; mood?: Mood }) {
  const skinS = shade(t.skin);
  const hairS = shade(t.hairColor, 0.25);
  const front = t.head === 'none' ? HAIR_FRONT[t.hair] : undefined;
  const earrings = t.extra?.includes('earrings');
  return (
    <g>
      {/* hair that falls behind the face */}
      {t.hair === 'locs' && (
        <g fill={t.hairColor} {...stroke(0.8)}>
          <path d="M -12.6,-2 C -13,-12 13,-12 12.6,-2 L 12.6,6 L -12.6,6 Z" />
          {[-13.4, -10.6, 10.6, 13.4].map(x => (
            <rect key={x} x={x - 1.6} y={-3} width={3.2} height={x * x > 150 ? 17 : 20} rx={1.6} />
          ))}
        </g>
      )}
      {/* ears */}
      {[-1, 1].map(s => (
        <g key={s}>
          <ellipse cx={s * 11.2} cy={1.6} rx={1.9} ry={2.7} fill={t.skin} {...stroke(0.9)} />
          <path d={`M ${s * 11.4},0.4 q ${s * 0.8},1.2 0,2.6`} fill="none" {...stroke(0.5, skinS)} />
        </g>
      ))}
      {/* the face, with its hard cel shadow */}
      <path d={FACE} fill={t.skin} />
      <path d={FACE_SHADE} fill={skinS} />
      <path d={FACE} fill="none" {...stroke(1.1)} />
      {/* shadow cast by the hair or headwear onto the forehead */}
      {front && <path d={front} fill={skinS} transform="translate(0,1.8)" />}
      {(t.head === 'wrap' || t.head === 'scarf') && <path d={WRAP} fill={skinS} transform="translate(0,1.8)" />}
      {t.head === 'cap' && <path d={BRIM} fill={skinS} transform="translate(0,2)" />}
      {/* features */}
      <Eye side={-1} t={t} />
      <Eye side={1} t={t} />
      <path d="M 0.9,3.2 L 1.7,6 L 0.3,6.4" fill="none" {...stroke(0.6, shade(t.skin, 0.7))} />
      <Mouth mood={mood} skin={t.skin} />
      <g {...stroke(0.5, '#e0605e')} opacity={0.8}>
        {[0, 1, 2].map(i => (
          <path key={i} d={`M ${-9.3 + i * 1.3},7.2 l 0.8,-1.5 M ${6.5 + i * 1.3},7.2 l 0.8,-1.5`} />
        ))}
      </g>
      {earrings && [-1, 1].map(s => <circle key={s} cx={s * 11.3} cy={6} r={1.9} fill="none" {...stroke(0.9, '#e7b23c')} />)}

      {/* hair in front */}
      {front && (
        <g>
          <path d={front} fill={t.hairColor} {...stroke(1)} />
          {t.hair === 'hitop' && (
            <>
              <path d="M -11.8,0 C -12.4,-6 -12.2,-12 -11.6,-17 L -10.2,-13 C -10.6,-8 -10.8,-4 -11.8,0 Z" fill={hairS} />
              <path d="M 11.8,0 C 12.4,-6 12.2,-12 11.6,-17 L 9.4,-11 C 10,-7 10.6,-4 11.8,0 Z" fill={hairS} />
              <path d="M 6,-10 L 8.2,-17.6" fill="none" {...stroke(0.5)} />
            </>
          )}
          {t.hair === 'coils' && (
            <path d="M -8,-12 q 1.2,-1.4 2.4,0 M -4,-14 q 1.2,-1.4 2.4,0 M 0.5,-14.4 q 1.2,-1.4 2.4,0 M 5,-13 q 1.2,-1.4 2.4,0 M -9.6,-7.8 q 1,-1.2 2,0 M 8,-9 q 1,-1.2 2,0" fill="none" {...stroke(0.5, light(t.hairColor, 0.25))} />
          )}
          {/* the shine band retro anime puts on dark hair */}
          <path d="M -8,-13.4 L -5.6,-14.6 M -3,-15.2 L 0,-15.6 M 2.6,-15.4 L 5.6,-14.4" fill="none" {...stroke(1.1, '#ffffff')} opacity={0.55} />
        </g>
      )}

      {/* headwear */}
      {(t.head === 'wrap' || t.head === 'scarf') && (
        <g>
          {t.head === 'scarf' && (
            <g fill={t.headColor} {...stroke(0.9)}>
              <path d="M -10.6,-6 C -16,-4 -18.4,3 -16.4,10 L -13.2,9.4 C -14.6,4 -13.4,-0.6 -9.8,-3 Z" />
              <path d="M -11.6,-4 C -14,2 -12.6,8 -11.2,12 L -9,11 C -10,7 -10.4,2 -9.4,-2.6 Z" fill={shade(t.headColor, 0.2)} />
            </g>
          )}
          <path d={WRAP} fill={t.headColor} />
          <path d={WRAP_EDGE} fill={shade(t.headColor, 0.3)} />
          {t.head === 'wrap' ? (
            <path d="M -11.4,-5.4 C -7,-11 7,-11 11.4,-5.4 M -9.6,-12.2 C -5,-16.6 5,-16.6 9.6,-12.2" fill="none" {...stroke(1.5, t.headColor2 ?? t.trim)} />
          ) : (
            <path d="M -10,-10 l 2,-2 2,2 2,-2 2,2 2,-2 2,2 2,-2 2,2 2,-2 M -7,-15.4 l 2,-2 2,2 2,-2 2,2 2,-2 2,2" fill="none" {...stroke(1.1, t.headColor2 ?? t.trim)} />
          )}
          <path d="M -6,-17.6 Q -2,-12 -1,-8.8 M 4,-18.8 Q 5,-13 7,-9" fill="none" {...stroke(0.55)} opacity={0.7} />
          <path d={WRAP} fill="none" {...stroke(1)} />
          {/* the knot */}
          <path
            d={t.head === 'wrap' ? 'M 1,-18.4 C 1.4,-26.6 12.4,-27.4 12.6,-19.8 C 15.6,-17.4 12.8,-13.2 8.6,-14.6 C 6,-15.4 3,-15.6 1,-18.4 Z' : 'M -1,-18.4 C -1.4,-25 -11.4,-25.4 -11.6,-18.6 C -14,-16.4 -11.6,-12.8 -7.8,-14.2 C -5.4,-15 -2.8,-15.6 -1,-18.4 Z'}
            fill={t.headColor}
            {...stroke(0.9)}
          />
          <path d={t.head === 'wrap' ? 'M 5,-20 Q 8,-22.6 10.6,-19.2' : 'M -4.6,-19.6 Q -7.6,-21.6 -9.8,-18.8'} fill="none" {...stroke(0.55)} />
        </g>
      )}
      {t.head === 'cap' && (
        <g>
          <path d="M -11.9,-2.2 C -12.4,0 -12,2.6 -11.2,4 L -10.4,-1 Z M 11.9,-2.2 C 12.4,0 12,2.6 11.2,4 L 10.4,-1 Z" fill={t.hairColor} {...stroke(0.7)} />
          <path d={CAP} fill={t.headColor} {...stroke(1)} />
          <path d="M 0,-17.2 L 0,-2.4 M -6,-16 Q -7.6,-9 -7,-2.4 M 6,-16 Q 7.6,-9 7,-2.4" fill="none" {...stroke(0.5)} opacity={0.6} />
          <path d="M 6,-16 Q 7.6,-9 7,-2.4 L 11.8,-2 C 12.2,-9 10,-14 6,-16 Z" fill={shade(t.headColor, 0.3)} />
          <circle cx={-3.4} cy={-8.4} r={2.3} fill={t.trim} {...stroke(0.5)} />
          <circle cx={0} cy={-17.2} r={1.1} fill={t.headColor} {...stroke(0.6)} />
          <path d={BRIM} fill={shade(t.headColor, 0.15)} {...stroke(0.9)} />
        </g>
      )}
    </g>
  );
}

/* ---------------- head and shoulders ---------------- */

const TORSO = 'M -23,48 L -22,28 C -21,21 -16,18.4 -9,17.2 L 9,17.2 C 16,18.4 21,21 22,28 L 23,48 Z';
const TORSO_SHADE = 'M 9,17.2 C 16,18.4 21,21 22,28 L 23,48 L 15,48 C 15.6,34 14,24 9,17.2 Z';

function Shoulders({ t, uid }: { t: Toon; uid: string }) {
  const ex = t.extra ?? [];
  const cloth = ex.includes('plaid') ? `url(#${uid}-plaid)` : t.outfit;
  const skinS = shade(t.skin);
  return (
    <g>
      <path d="M -3.8,8.5 L -4,18.5 L 4,18.5 L 3.8,8.5 Z" fill={t.skin} {...stroke(0.9)} />
      <path d="M -3.8,8.5 L 3.8,8.5 L 3.9,13 Q 0,15.4 -3.9,13 Z" fill={skinS} />
      <path d={TORSO} fill={cloth} />
      <path d={TORSO_SHADE} fill={shade(t.outfit)} opacity={ex.includes('plaid') ? 0.55 : 1} />
      <path d={TORSO_SHADE} fill={`url(#${uid}-tone)`} />
      <path d="M -17.6,22 Q -15.6,33 -16.6,48 M 17.6,22 Q 15.6,33 16.6,48" fill="none" {...stroke(0.6)} opacity={0.7} />
      <path d={TORSO} fill="none" {...stroke(1.1)} />
      {ex.includes('overalls') ? (
        <g>
          <path d="M -9.6,29 L 9.6,29 L 10.6,48 L -10.6,48 Z" fill="#3e6aa8" {...stroke(0.9)} />
          <path d="M 3,29 L 9.6,29 L 10.6,48 L 6,48 Z" fill={shade('#3e6aa8')} />
          {[-1, 1].map(s => (
            <g key={s} transform={s === 1 ? 'scale(-1,1)' : undefined}>
              <path d="M -9.6,29 L -13,18.4 L -10,18 L -6.8,29 Z" fill="#3e6aa8" {...stroke(0.8)} />
              <path d="M -12.2,21 L -9.2,20.6 M -11.6,23.4 L -8.6,23 M -11,25.8 L -8,25.4" fill="none" {...stroke(1, t.trim)} />
              <circle cx={-8.2} cy={30.6} r={0.95} fill="#e7b23c" {...stroke(0.4)} />
            </g>
          ))}
        </g>
      ) : (
        <>
          <path d="M -6,17.2 L 0,24.5 L 6,17.2 Z" fill={t.skin} {...stroke(0.8)} />
          <path d="M -6,17.2 L 0,21 L 6,17.2 Z" fill={skinS} />
          <path d="M -7.4,17 L 0,26 L 7.4,17" fill="none" {...stroke(1.7, t.trim)} />
          <path d="M -8.4,17 L 0,27.4 L 8.4,17" fill="none" {...stroke(0.6)} />
        </>
      )}
      {ex.includes('necklace') &&
        Array.from({ length: 9 }, (_, i) => {
          const a = (i / 8) * Math.PI;
          return <circle key={i} cx={-5.6 * Math.cos(a)} cy={18.6 + 3.4 * Math.sin(a)} r={0.9} fill={i % 2 ? '#e7b23c' : '#c2462e'} {...stroke(0.35)} />;
        })}
      {ex.includes('lanyard') && (
        <g>
          <path d="M -4.6,18.8 L -1.4,32 M 4.6,18.8 L 1.4,32" fill="none" {...stroke(1, '#2b6cb0')} />
          <rect x={-3.6} y={31.4} width={7.2} height={9} rx={0.8} fill="#fffaf2" {...stroke(0.6)} />
          <rect x={-3.6} y={31.4} width={7.2} height={2.4} fill="#3aa856" />
          <path d="M -2.4,36 H 2.4 M -2.4,38 H 1" fill="none" {...stroke(0.4)} opacity={0.6} />
        </g>
      )}
    </g>
  );
}

/** A head-and-shoulders picture: for the HUD, the look picker and the rewards hub. */
export function AnimeBust({ t, size = 48, mood = 'smile', style }: { t: Toon; size?: number; mood?: Mood; style?: CSSProperties }) {
  const uid = uidOf(useId());
  return (
    <svg viewBox="-22 -27.5 44 48.4" width={size} height={size * 1.1} aria-hidden="true" style={style} className="anime-art">
      <Defs uid={uid} t={t} />
      <Shoulders t={t} uid={uid} />
      <AnimeHead t={t} mood={mood} />
    </svg>
  );
}

/** A cast character standing in a panel: head and upper body, framed from the bottom edge up, with a retro sun. */
export function CastArt({ id, w, h, mood = 'smile', backdrop = 'sun', alt, style }: { id: CastId; w: number; h: number; mood?: Mood; backdrop?: 'sun' | 'panel' | 'none'; alt?: string; style?: CSSProperties }) {
  const uid = uidOf(useId());
  const t = CAST[id];
  // the picture runs from just above the headwear (y = -30) to the panel's bottom edge (y = 48)
  let H = 78;
  let W = (H * w) / h;
  if (W < 54) {
    W = 54;
    H = (W * h) / w;
  }
  const top = 48 - H;
  return (
    <svg viewBox={`${-W / 2} ${top} ${W} ${H}`} width={w} height={h} role={alt ? 'img' : undefined} aria-label={alt} aria-hidden={alt ? undefined : true} style={style} className="anime-art">
      <Defs uid={uid} t={t} />
      <defs>
        <linearGradient id={`${uid}-sun`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe08a" />
          <stop offset="1" stopColor="#ff7f6e" />
        </linearGradient>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbd9c4" />
          <stop offset="1" stopColor="#d9a8cf" />
        </linearGradient>
        <pattern id={`${uid}-dots`} width={2.4} height={2.4} patternUnits="userSpaceOnUse">
          <circle cx={1.2} cy={1.2} r={0.45} fill="#fff" opacity={0.45} />
        </pattern>
        <clipPath id={`${uid}-sunclip`}>
          <circle cx={0} cy={2} r={23} />
        </clipPath>
      </defs>
      {backdrop === 'panel' && (
        <>
          <rect x={-W / 2} y={top} width={W} height={H} fill={`url(#${uid}-sky)`} />
          <rect x={-W / 2} y={top} width={W} height={H} fill={`url(#${uid}-dots)`} />
        </>
      )}
      {backdrop !== 'none' && (
        <g clipPath={`url(#${uid}-sunclip)`}>
          <circle cx={0} cy={2} r={23} fill={`url(#${uid}-sun)`} />
          <circle cx={0} cy={2} r={23} fill={`url(#${uid}-dots)`} />
          {/* the cut stripes of an 80s sunset */}
          {[10, 15, 19.5, 23.5].map((y, i) => (
            <rect key={y} x={-24} y={y} width={48} height={1.2 + i * 0.7} fill={backdrop === 'panel' ? '#e3b3cc' : '#f1dcbd'} />
          ))}
        </g>
      )}
      <Shoulders t={t} uid={uid} />
      <AnimeHead t={t} mood={mood} />
    </svg>
  );
}

/* ---------------- full figure ---------------- */

const PANTS = '#34416b';
const BOOT = '#3a2418';

function Limb({ d, w, fill }: { d: string; w: number; fill: string }) {
  return (
    <>
      <path d={d} fill="none" {...stroke(w + 1.6)} />
      <path d={d} fill="none" {...stroke(w, fill)} />
    </>
  );
}

/** The player's farmer, full length, in the original figure's space (feet at 0,0) so it drops into every scene. */
export function AnimeFigure({ look, pose = 'stand', facing = 1 }: { look: Look; pose?: 'stand' | 'walk' | 'cheer'; facing?: 1 | -1 }) {
  const uid = uidOf(useId());
  const t = lookToon(look);
  const cheer = pose === 'cheer';
  const arm = (s: 1 | -1) =>
    cheer
      ? { arm: `M ${s * 9.6},-57.6 Q ${s * 15},-64 ${s * 17.4},-73`, sleeve: `M ${s * 9.6},-57.6 Q ${s * 12.4},-61 ${s * 13.8},-64.4`, hand: [s * 17.4, -73] }
      : { arm: `M ${s * 9.6},-57.6 Q ${s * 12.6},-47 ${s * 13.4},-37`, sleeve: `M ${s * 9.6},-57.6 Q ${s * 11.2},-52.4 ${s * 12},-48`, hand: [s * 13.4, -37] };
  const leg = (s: 1 | -1) => (
    <g className={s === -1 ? 'leg-l' : 'leg-r'}>
      <Limb d={`M ${s * 4.6},-27 L ${s * 5.4},-4.5`} w={5} fill={s === 1 ? shade(PANTS, 0.25) : PANTS} />
      <path
        d={s === -1 ? 'M -9.8,-0.2 C -10,-3.6 -7.4,-4.8 -4.6,-4.4 C -2.6,-4 -2.2,-1.4 -2.6,-0.2 Z' : 'M 9.8,-0.2 C 10,-3.6 7.4,-4.8 4.6,-4.4 C 2.6,-4 2.2,-1.4 2.6,-0.2 Z'}
        fill={BOOT}
        {...stroke(0.8)}
      />
    </g>
  );
  return (
    <g transform={`scale(${facing},1)`} className={`farmer farmer-${pose} anime-art`}>
      <Defs uid={uid} t={t} />
      <ellipse cx={0} cy={0} rx={13} ry={3} fill="rgba(42,23,48,0.28)" />
      {leg(-1)}
      {leg(1)}
      <path d="M -2.6,-67 L -2.8,-59.6 L 2.8,-59.6 L 2.6,-67 Z" fill={t.skin} {...stroke(0.7)} />
      <path d="M -2.6,-67 L 2.6,-67 L 2.7,-63.4 Q 0,-62 -2.7,-63.4 Z" fill={shade(t.skin)} />
      {/* torso */}
      <path d="M -9,-60.4 C -4,-61.6 4,-61.6 9,-60.4 C 11,-55 12,-40 11.4,-27 Q 0,-24 -11.4,-27 C -12,-40 -11,-55 -9,-60.4 Z" fill={t.outfit} />
      <path d="M 9,-60.4 C 11,-55 12,-40 11.4,-27 L 7,-26.2 C 8,-38 8.4,-52 6,-60.9 Z" fill={shade(t.outfit)} />
      <path d="M 9,-60.4 C 11,-55 12,-40 11.4,-27 L 7,-26.2 C 8,-38 8.4,-52 6,-60.9 Z" fill={`url(#${uid}-tone)`} />
      <path d="M -11.5,-30.6 Q 0,-28.4 11.5,-30.6" fill="none" {...stroke(2.4, t.trim)} />
      <path d="M -9,-60.4 C -4,-61.6 4,-61.6 9,-60.4 C 11,-55 12,-40 11.4,-27 Q 0,-24 -11.4,-27 C -12,-40 -11,-55 -9,-60.4 Z" fill="none" {...stroke(0.9)} />
      <path d="M -4.4,-60.8 L 0,-55.6 L 4.4,-60.8 Z" fill={t.skin} {...stroke(0.7)} />
      <path d="M -5.4,-60.6 L 0,-54.4 L 5.4,-60.6" fill="none" {...stroke(1.2, t.trim)} />
      {/* arms */}
      {([-1, 1] as const).map(s => {
        const a = arm(s);
        return (
          <g key={s}>
            <Limb d={a.arm} w={3.6} fill={s === 1 ? shade(t.skin, 0.25) : t.skin} />
            <Limb d={a.sleeve} w={5} fill={s === 1 ? shade(t.outfit) : t.outfit} />
            <circle cx={a.hand[0]} cy={a.hand[1]} r={2.2} fill={t.skin} {...stroke(0.8)} />
          </g>
        );
      })}
      <g transform="translate(0,-76) scale(0.74)">
        <AnimeHead t={t} mood={cheer ? 'grin' : 'smile'} />
      </g>
    </g>
  );
}
