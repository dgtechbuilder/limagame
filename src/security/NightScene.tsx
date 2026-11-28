import { useId, type CSSProperties, type ReactNode } from 'react';
import type { LifeEvent, NightSceneId } from '../livestock/model';

/* The little moving picture in the morning dialog: what happened in the night, shown as it happened. A mongoose
   runs up the ramp into the coop and the feathers fly; a thief walks off with a sack of hens; a cow runs a fever.
   Plain SVG moved by CSS (styles.css, "night scenes"), on a four-second loop. With motion turned down, each scene
   stands still at its telling moment: the mongoose at the coop door, the thief with the full sack. */

export const SCENE_LABEL: Record<NightSceneId, string> = {
  mongoose: 'A mongoose gets into the chicken coop',
  henThief: 'A thief carries hens off in a sack',
  cowThief: 'A thief leads a cow away from the pen',
  crops: 'Thieves cut the cobs off the maize',
  shed: 'Someone breaks into the shed and takes a tool',
  house: 'A thief slips out of the house with the cash',
  water: 'Water is drawn off the tank into jerrycans',
  diesel: 'Diesel is siphoned from the tractor',
  sickCow: 'A cow with a fever',
  sickHen: 'A sick hen',
  deadCow: 'A cow lost in the night',
  deadHen: 'A hen lost in the night',
  thirst: 'The trough is dry and the animals are thirsty',
};

/** The scene for a night's event: the one it was given, or (for a save from before scenes) read off its words. */
export function sceneOf(e: LifeEvent): NightSceneId | null {
  if (e.scene) return e.scene;
  const t = e.text.toLowerCase();
  switch (e.kind) {
    case 'predator':
      return 'mongoose';
    case 'thirst':
      return 'thirst';
    case 'issue':
      return t.includes('the hens') ? 'sickHen' : t.includes('the cows') ? 'sickCow' : null;
    case 'death':
      return /\bcows?\b/.test(t) ? 'deadCow' : 'deadHen';
    case 'theft':
    case 'recovered':
      if (t.includes('mongoose')) return 'mongoose';
      if (/\bhens?\b/.test(t)) return 'henThief';
      if (t.includes('cow')) return 'cowThief';
      if (t.includes('cobs')) return 'crops';
      if (t.includes('shed')) return 'shed';
      if (t.includes('house')) return 'house';
      if (t.includes('tank')) return 'water';
      if (t.includes('diesel')) return 'diesel';
      return null;
    default:
      return null;
  }
}

const DAY: NightSceneId[] = ['sickCow', 'sickHen', 'deadCow', 'deadHen', 'thirst'];

/** One scene, 200 × 120 in its own units, drawn to fill the box it is given. */
export function NightScene({ id, tag, found, style }: { id: NightSceneId; tag?: ReactNode; found?: boolean; style?: CSSProperties }) {
  const uid = useId().replace(/:/g, '');
  const day = DAY.includes(id);
  return (
    <figure className={`ns ns-${id}${day ? ' is-day' : ''}`} role="img" aria-label={SCENE_LABEL[id]} style={style}>
      <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <linearGradient id={`${uid}sky`} x1="0" y1="0" x2="0" y2="1">
            {day ? (
              <>
                <stop offset="0" stopColor="#bee0bf" />
                <stop offset="1" stopColor="#faefd4" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="#4c3c2e" />
                <stop offset="1" stopColor="#434672" />
              </>
            )}
          </linearGradient>
          <radialGradient id={`${uid}glow`}>
            <stop offset="0" stopColor={day ? '#f7eeb8' : '#fbf4da'} stopOpacity="0.9" />
            <stop offset="1" stopColor={day ? '#f7eeb8' : '#fbf4da'} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="200" height="120" fill={`url(#${uid}sky)`} />
        {day ? (
          <g className={id === 'thirst' ? 'ns-hot' : undefined}>
            <circle cx="174" cy="20" r="22" fill={`url(#${uid}glow)`} />
            <circle cx="174" cy="20" r="10" fill={id === 'thirst' ? '#e9aa36' : '#ecc852'} />
          </g>
        ) : (
          <g>
            <circle cx="170" cy="20" r="20" fill={`url(#${uid}glow)`} opacity="0.5" />
            <circle cx="170" cy="20" r="8.5" fill="#faf2cd" />
            <circle cx="173.5" cy="17.5" r="7.5" fill="#284347" opacity="0.92" />
            {[
              [18, 14],
              [46, 26],
              [74, 10],
              [112, 20],
              [138, 8],
              [190, 42],
              [28, 44],
            ].map(([x, y], i) => (
              <circle key={i} className="ns-star" cx={x} cy={y} r={i % 3 ? 0.8 : 1.1} fill="#fbf8ee" style={{ animationDelay: `${i * 0.37}s` }} />
            ))}
          </g>
        )}
        <path d="M0 92 Q50 86 100 90 T200 88 V120 H0Z" fill={day ? '#7bb45a' : '#30422c'} />
        <path d="M0 104 Q60 98 120 103 T200 101 V120 H0Z" fill={day ? '#69a14a' : '#4b3b2d'} />
        {/* the actors a size up, standing on the same ground */}
        <g transform="translate(100 104) scale(1.3) translate(-100 -104)">{SCENES[id]}</g>
      </svg>
      {tag != null && <figcaption className={`ns-tag${found ? ' is-found' : ''}`}>{tag}</figcaption>}
    </figure>
  );
}

/* ---------- the pieces ---------- */

const INK = '#53331c';

function Coop({ x = 96, y = 58, open = true }: { x?: number; y?: number; open?: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="4" y="26" width="3" height="10" fill="#56351a" />
      <rect x="46" y="26" width="3" height="10" fill="#56351a" />
      <rect x="0" y="0" width="54" height="28" rx="2" fill="#ac7548" stroke={INK} strokeWidth="1" />
      {[7, 14, 21].map(v => (
        <line key={v} x1="1" x2="53" y1={v} y2={v} stroke="#895a35" strokeWidth="0.6" />
      ))}
      <path d="M-6 2 L27 -16 L60 2 Z" fill="#a0a7a1" stroke="#606a6a" strokeWidth="1" />
      {[-1, 7, 15, 23, 31, 39, 47].map(v => (
        <line key={v} x1={v + 2} y1="1.5" x2={27 + (v - 23) * 0.45} y2="-13" stroke="#908a7d" strokeWidth="0.5" />
      ))}
      <rect x="9" y="10" width="14" height="18" fill="#413327" />
      {open ? <rect x="-4" y="10" width="13" height="18" fill="#bd8b5e" stroke={INK} strokeWidth="0.8" transform="skewY(-8)" /> : <rect x="9" y="10" width="14" height="18" fill="#bd8b5e" stroke={INK} strokeWidth="0.8" />}
      <rect x="32" y="8" width="14" height="10" fill="#47382b" stroke={INK} strokeWidth="0.8" />
      <path d="M35 8v10M39 8v10M43 8v10M32 13h14" stroke="#969084" strokeWidth="0.4" />
      <path d="M9 28 L23 28 L18 38 L0 38 Z" fill="#986944" stroke={INK} strokeWidth="0.6" />
    </g>
  );
}

function Hen({ x, y, s = 1, flip, sick, dead, className, style }: { x: number; y: number; s?: number; flip?: boolean; sick?: boolean; dead?: boolean; className?: string; style?: CSSProperties }) {
  const body = dead ? '#c7c2ba' : '#f5eee2';
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -s : s} ${s})${dead ? ' rotate(80)' : ''}`}>
      <g className={className} style={style}>
        <path d="M-9 -6 Q-15 -14 -11 -17 Q-8 -12 -6 -9 Z" fill={dead ? '#b5afa6' : '#dcc8a9'} stroke={INK} strokeWidth="0.6" />
        <ellipse cx="0" cy="-6" rx={sick ? 10 : 9} ry={sick ? 7.5 : 6.5} fill={body} stroke={INK} strokeWidth="0.8" />
        <path d="M-4 -7 Q0 -2 5 -6" fill="none" stroke="#d4c6ad" strokeWidth="0.8" />
        <g transform={sick ? 'translate(1 4) rotate(25 7 -12)' : undefined}>
          <circle cx="7" cy="-12" r="3.6" fill={body} stroke={INK} strokeWidth="0.8" />
          <path d="M5 -15.5 q1 -2.5 2 -0.5 q1 -2.5 2 -0.5 q1.5 -1.5 1.5 0.8 l-4.5 1.4z" fill={dead ? '#9e998e' : '#c95d47'} />
          <path d="M10.4 -12.6 l3.4 1.2 -3.4 1.2z" fill="#dd9b2f" />
          <path d="M9.2 -10 q0.6 2 -0.6 2.6" fill="none" stroke={dead ? '#9e998e' : '#c95d47'} strokeWidth="1.2" />
          {dead ? (
            <path d="M6.6 -13.6 l1.6 1.6 M8.2 -13.6 l-1.6 1.6" stroke="#37342f" strokeWidth="0.6" />
          ) : sick ? (
            <path d="M6.6 -12.6 h1.8" stroke="#37342f" strokeWidth="0.7" />
          ) : (
            <circle cx="7.8" cy="-12.6" r="0.75" fill="#403832" />
          )}
        </g>
        <path d="M-2 0.5 v4.5 l-1.5 1 M2 0.5 v4.5 l1.5 1" fill="none" stroke="#d3922f" strokeWidth="1" strokeLinecap="round" />
      </g>
    </g>
  );
}

function Mongoose() {
  return (
    <g>
      <path d="M-11 -2 Q-24 -5 -33 3 Q-24 0 -11 2 Z" fill="#68523a" stroke="#4a3a2c" strokeWidth="0.6" />
      <g className="ns-scurry">
        <path d="M-7 2 l-2 5 M-3 2 l1 5 M6 2 l-2 5 M10 2 l1 5" stroke="#4a3a2c" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <ellipse cx="0" cy="0" rx="13" ry="4.6" fill="#846b4e" stroke="#4a3a2c" strokeWidth="0.7" />
      <path d="M-8 -3 l2 5 M-3 -4 l2 6 M2 -4 l2 6 M7 -3 l1.5 5" stroke="#68523a" strokeWidth="0.7" />
      <path d="M10 -4 Q16 -6 22 -1 Q17 2 10 2 Z" fill="#846b4e" stroke="#4a3a2c" strokeWidth="0.7" />
      <circle cx="12.5" cy="-4.6" r="1.4" fill="#68523a" stroke="#4a3a2c" strokeWidth="0.5" />
      <circle cx="16" cy="-2.6" r="0.8" fill="#f0da7a" />
      <circle cx="22" cy="-1" r="0.8" fill="#403832" />
    </g>
  );
}

/** A thief in a dark hood, facing right; the feet at 0,0. */
function Thief({ children, arm = 'down' }: { children?: ReactNode; arm?: 'down' | 'up' | 'out' }) {
  const a = arm === 'up' ? 'M2 -21 L9 -30' : arm === 'out' ? 'M2 -21 L11 -18' : 'M2 -21 L6 -12';
  return (
    <g>
      <g className="ns-stride">
        <path d="M-1.5 -12 L-4 0 M1.5 -12 L4 0" stroke="#46372a" strokeWidth="3.4" strokeLinecap="round" />
      </g>
      <path d="M-5.5 -11 Q-7 -24 0 -25.5 Q7 -24 5.5 -11 Z" fill="#2c3d40" stroke="#6f8c91" strokeWidth="0.7" />
      <circle cx="0.5" cy="-29.5" r="4.8" fill="#2c3d40" stroke="#6f8c91" strokeWidth="0.7" />
      <rect x="0.5" y="-31" width="4.8" height="1.6" rx="0.8" fill="#e5f3e7" opacity="0.8" />
      <path d={a} stroke="#2c3d40" strokeWidth="2.6" strokeLinecap="round" />
      {children}
    </g>
  );
}

function Cow({ sick, dead, className }: { sick?: boolean; dead?: boolean; className?: string }) {
  const hide = dead ? '#cecac5' : '#fbf8ee';
  const spot = dead ? '#918b7e' : '#433c35';
  return (
    <g className={className}>
      <path d="M-18 -10 q-6 4 -5 12" fill="none" stroke={INK} strokeWidth="1.2" />
      <path d="M-14 4 v12 M-8 4 v12 M8 4 v12 M13 4 v12" stroke={spot} strokeWidth="3" strokeLinecap="round" />
      <rect x="-19" y="-12" width="36" height="18" rx="8" fill={hide} stroke={INK} strokeWidth="0.9" />
      <path d="M-12 -12 q4 6 -2 11 q-5 -2 -5 -7 q2 -4 7 -4z M4 -11 q6 1 6 6 q-4 4 -9 1z" fill={spot} />
      <ellipse cx="-2" cy="6" rx="4" ry="2.4" fill={dead ? '#c3b0ac' : '#eac6be'} />
      <g transform={sick ? 'rotate(22 18 -8)' : undefined}>
        <path d="M17 -14 q-2 -5 1 -6 M25 -14 q2 -5 -1 -6" fill="none" stroke="#d3c5a6" strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cx="21" cy="-9" rx="6.5" ry="5.5" fill={hide} stroke={INK} strokeWidth="0.9" />
        <ellipse cx="13.5" cy="-12" rx="3" ry="1.5" fill={spot} transform="rotate(-20 13.5 -12)" />
        <ellipse cx="22.5" cy="-4.5" rx="5" ry="3.4" fill={dead ? '#ccbab6' : '#efcfc8'} stroke={INK} strokeWidth="0.7" />
        <circle cx="21" cy="-4.5" r="0.7" fill={INK} />
        <circle cx="24.5" cy="-4.5" r="0.7" fill={INK} />
        {dead ? (
          <path d="M18 -11.5 l2 2 M20 -11.5 l-2 2 M23 -11.5 l2 2 M25 -11.5 l-2 2" stroke="#37342f" strokeWidth="0.7" />
        ) : sick ? (
          <path d="M18 -10.5 q1 -1 2 0 M23 -10.5 q1 -1 2 0" fill="none" stroke="#37342f" strokeWidth="0.7" />
        ) : (
          <>
            <circle cx="19" cy="-10.5" r="0.9" fill="#403832" />
            <circle cx="24" cy="-10.5" r="0.9" fill="#403832" />
          </>
        )}
        {sick && <ellipse cx="15.6" cy="-6" rx="2.6" ry="3" fill="#e5b5ab" stroke={INK} strokeWidth="0.5" />}
      </g>
    </g>
  );
}

function Feathers({ at = [0, 0] as [number, number] }) {
  const f: [number, number, number][] = [
    [-14, -22, 0],
    [12, -26, 0.08],
    [22, -12, 0.16],
    [-4, -30, 0.24],
    [-20, -8, 0.12],
  ];
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      {f.map(([dx, dy, d], i) => (
        <g key={i} className="ns-feather" style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${d}s` } as CSSProperties}>
          <path d="M0 0 q3 -3 6 -1 q-3 3 -6 1z M0 0 l7 -1" fill="#f9f3e8" stroke="#ad977a" strokeWidth="0.4" />
        </g>
      ))}
    </g>
  );
}

function Sack({ full }: { full: boolean }) {
  return full ? (
    <g>
      <path d="M-7 -3 Q-11 -14 -4 -18 L4 -18 Q11 -14 7 -3 Q0 1 -7 -3Z" fill="#bfa174" stroke={INK} strokeWidth="0.8" />
      <path d="M-4 -18 l2 -3 h4 l2 3" fill="#bfa174" stroke={INK} strokeWidth="0.8" />
      <path d="M-3 -8 q3 2 6 0" fill="none" stroke="#9a7a4e" strokeWidth="0.6" />
    </g>
  ) : (
    <path d="M-4 -2 L-5 -14 L5 -14 L4 -2 Z" fill="#bfa174" stroke={INK} strokeWidth="0.8" />
  );
}

function Maize({ x, cobs }: { x: number; cobs: number[] }) {
  return (
    <g transform={`translate(${x} 94)`}>
      <path d="M0 0 V-46" stroke="#54893b" strokeWidth="2.2" />
      <path d="M0 -14 q-12 -2 -16 -12 M0 -26 q12 -2 16 -12 M0 -36 q-10 -2 -12 -10 M0 -46 l-3 -6 M0 -46 l3 -6" fill="none" stroke="#66a049" strokeWidth="2" strokeLinecap="round" />
      {cobs.map((d, i) => (
        <g key={i} transform={`translate(${i % 2 ? 2 : -2} ${-20 - i * 10}) rotate(${i % 2 ? 25 : -25})`}>
          <g className="ns-cob" style={{ animationDelay: `${d}s` }}>
            <ellipse cx="0" cy="-4" rx="2.8" ry="6" fill="#e4c44e" stroke="#a27e22" strokeWidth="0.6" />
            <path d="M-2.8 -2 q2.8 6 5.6 0" fill="#7bb45a" />
          </g>
        </g>
      ))}
    </g>
  );
}

function Jerrycan({ x, y, className, style }: { x: number; y: number; className?: string; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className={className} style={style}>
        <rect x="-6" y="-14" width="12" height="14" rx="1.5" fill="#dcb630" stroke={INK} strokeWidth="0.8" />
        <path d="M-3 -14 v-3 h6 v3" fill="none" stroke={INK} strokeWidth="1.2" />
        <path d="M-4 -10 l8 8 M4 -10 l-8 8" stroke="#c29c21" strokeWidth="0.8" />
      </g>
    </g>
  );
}

function Thermometer({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-3" y="-30" width="6" height="28" rx="3" fill="#fbf8ee" stroke="#714b2d" strokeWidth="0.8" />
      <circle cx="0" cy="0" r="4.5" fill="#ca5e48" stroke="#714b2d" strokeWidth="0.8" />
      <rect className="ns-mercury" x="-1.3" y="-27" width="2.6" height="26" rx="1.3" fill="#ca5e48" />
      {[-24, -19, -14, -9].map(v => (
        <line key={v} x1="3" x2="5" y1={v} y2={v} stroke="#714b2d" strokeWidth="0.5" />
      ))}
    </g>
  );
}

function Fence({ x0, x1, y = 92 }: { x0: number; x1: number; y?: number }) {
  const posts: number[] = [];
  for (let v = x0; v <= x1; v += 14) posts.push(v);
  return (
    <g>
      <path d={`M${x0} ${y - 14} H${x1} M${x0} ${y - 6} H${x1}`} stroke="#714b2d" strokeWidth="1.6" />
      {posts.map(v => (
        <rect key={v} x={v - 1.5} y={y - 20} width="3" height="21" fill="#855b36" stroke={INK} strokeWidth="0.5" />
      ))}
    </g>
  );
}

/* ---------- the scenes ---------- */

const SCENES: Record<NightSceneId, ReactNode> = {
  mongoose: (
    <>
      <g className="ns-shake">
        <Coop />
      </g>
      <g transform="translate(108 94)">
        <g className="ns-mg-run">
          <g className="ns-bob">
            <g transform="scale(1.25)">
              <Mongoose />
            </g>
          </g>
        </g>
      </g>
      <Feathers at={[112, 80]} />
      <Hen x={162} y={98} s={0.9} className="ns-flee" />
    </>
  ),
  henThief: (
    <>
      <Coop x={60} />
      <Feathers at={[76, 80]} />
      <g transform="translate(58 98)">
        <g className="ns-walk-off">
          <g className="ns-bob">
            <Thief arm="out">
              <g transform="translate(12 -10)">
                <g className="ns-early">
                  <Sack full={false} />
                </g>
                <g className="ns-late">
                  <g className="ns-wriggle">
                    <Sack full />
                  </g>
                </g>
              </g>
            </Thief>
          </g>
        </g>
      </g>
    </>
  ),
  cowThief: (
    <>
      <Fence x0={6} x1={70} />
      <rect x="66" y="72" width="3" height="21" fill="#855b36" />
      <path d="M69 78 l14 -10 M69 86 l14 -10" stroke="#714b2d" strokeWidth="1.6" />
      <g transform="translate(62 88)">
        <g className="ns-lead">
          <g className="ns-bob">
            <Cow className="ns-cow-walk" />
          </g>
          <path d="M28 -6 Q38 2 46 -18" fill="none" stroke="#c0a273" strokeWidth="0.9" />
          <g transform="translate(50 2)">
            <g className="ns-bob">
              <Thief arm="out" />
            </g>
          </g>
        </g>
      </g>
    </>
  ),
  crops: (
    <>
      <Maize x={28} cobs={[0.4, 1.1]} />
      <Maize x={60} cobs={[0.8, 1.6]} />
      <Maize x={92} cobs={[1.3, 2.0]} />
      <Maize x={170} cobs={[]} />
      <g transform="translate(122 98)">
        <g className="ns-cut-walk">
          <g transform="scale(-1 1)">
            <Thief arm="up">
              <g className="ns-swing">
                <path d="M9 -30 l7 -9" stroke="#ccd1cc" strokeWidth="2.2" strokeLinecap="round" />
              </g>
            </Thief>
          </g>
          <g transform="translate(14 0)">
            <Sack full />
          </g>
        </g>
      </g>
    </>
  ),
  shed: (
    <>
      <g transform="translate(28 50)">
        <rect x="0" y="6" width="58" height="38" fill="#9e7553" stroke={INK} strokeWidth="1" />
        <path d="M-5 8 L29 -8 L63 8 Z" fill="#919f9e" stroke="#606a6a" strokeWidth="1" />
        <rect x="20" y="16" width="20" height="28" fill="#3f3126" />
        <g className="ns-door">
          <rect x="40" y="16" width="20" height="28" fill="#bd8b5e" stroke={INK} strokeWidth="0.8" />
          <circle cx="44" cy="31" r="1" fill={INK} />
        </g>
        <path d="M23 26 l6 -6 M25 33 h10" stroke="#596665" strokeWidth="1.4" opacity="0.7" />
        <circle className="ns-lock" cx="40" cy="34" r="2.2" fill="none" stroke="#c3c8c3" strokeWidth="1" />
      </g>
      <g transform="translate(78 98)">
        <g className="ns-walk-right">
          <g className="ns-bob">
            <Thief arm="out">
              <path d="M8 -20 l18 -6" stroke="#815a35" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M24 -30 l6 0 l0 8 l-6 2z" fill="#b3b8b3" stroke="#596665" strokeWidth="0.6" />
            </Thief>
          </g>
        </g>
      </g>
    </>
  ),
  house: (
    <>
      <g transform="translate(18 46)">
        <rect x="0" y="12" width="70" height="36" fill="#d0af84" stroke={INK} strokeWidth="1" />
        <path d="M-6 14 L35 -6 L76 14 Z" fill="#91493b" stroke={INK} strokeWidth="1" />
        <rect className="ns-flicker" x="8" y="20" width="16" height="12" fill="#f0cf7a" stroke={INK} strokeWidth="0.8" />
        <path d="M16 20 v12 M8 26 h16" stroke={INK} strokeWidth="0.6" />
        <rect x="42" y="24" width="14" height="24" fill="#3f3126" />
        <rect x="56" y="24" width="10" height="24" fill="#734c2e" stroke={INK} strokeWidth="0.7" transform="skewY(-12)" />
      </g>
      <g transform="translate(74 98)">
        <g className="ns-sneak">
          <g className="ns-bob">
            <Thief arm="out">
              <g transform="translate(13 -12)">
                <path d="M-6 -2 Q-8 -12 -2 -14 L2 -14 Q8 -12 6 -2 Q0 2 -6 -2Z" fill="#50893b" stroke="#4f3e30" strokeWidth="0.8" />
                <path d="M-3 -14 l3 -3 3 3" fill="none" stroke="#4f3e30" strokeWidth="0.8" />
                <text x="0" y="-5" textAnchor="middle" fontSize="4.6" fontWeight="800" fill="#fbf8ee">KSh</text>
              </g>
            </Thief>
          </g>
        </g>
      </g>
    </>
  ),
  water: (
    <>
      <g transform="translate(30 30)">
        <rect x="4" y="44" width="4" height="18" fill="#797367" />
        <rect x="38" y="44" width="4" height="18" fill="#797367" />
        <rect x="0" y="42" width="46" height="4" fill="#8c8578" />
        <rect x="2" y="2" width="42" height="40" rx="5" fill="#499a97" stroke="#285a58" strokeWidth="1" />
        <rect x="8" y="8" width="6" height="30" rx="3" fill="#255452" />
        <rect className="ns-drain" x="9" y="9" width="4" height="28" rx="2" fill="#b3dbb4" />
        {[12, 20, 28].map(v => (
          <line key={v} x1="16" x2="40" y1={v} y2={v} stroke="#3c7f7d" strokeWidth="0.8" />
        ))}
        <ellipse cx="23" cy="2" rx="21" ry="3.5" fill="#57aca9" stroke="#285a58" strokeWidth="1" />
        <path d="M44 34 h8 v5" fill="none" stroke="#a9a499" strokeWidth="2.4" />
        <path className="ns-pour" d="M52 41 V58" stroke="#b3dbb4" strokeWidth="2" strokeDasharray="3 2" />
      </g>
      <Jerrycan x={82} y={94} />
      <Jerrycan x={100} y={98} className="ns-fill" />
      <g transform="translate(118 98)">
        <g className="ns-walk-right">
          <g className="ns-bob">
            <Thief arm="down">
              <Jerrycan x={8} y={-4} />
            </Thief>
          </g>
        </g>
      </g>
    </>
  ),
  diesel: (
    <>
      <g transform="translate(26 50)">
        <rect x="22" y="8" width="26" height="18" rx="2" fill="#be5742" stroke={INK} strokeWidth="1" />
        <rect x="4" y="18" width="40" height="12" rx="2" fill="#c8614d" stroke={INK} strokeWidth="1" />
        <path d="M26 8 V-4 h20 V8" fill="none" stroke="#37342f" strokeWidth="1.6" />
        <rect x="14" y="6" width="3" height="12" fill="#49463f" />
        <circle cx="38" cy="32" r="12" fill="#443c35" stroke="#38322c" strokeWidth="1" />
        <circle cx="38" cy="32" r="5" fill="#a9a499" />
        <circle cx="8" cy="36" r="7" fill="#443c35" stroke="#38322c" strokeWidth="1" />
        <circle cx="8" cy="36" r="3" fill="#a9a499" />
        <circle cx="35" cy="17" r="4.2" fill="#fbf8ee" stroke="#37342f" strokeWidth="0.7" />
        <path className="ns-needle" d="M35 17 L38 14.5" stroke="#ca5e48" strokeWidth="1" strokeLinecap="round" />
        <path d="M44 22 Q60 22 66 34 L70 44" fill="none" stroke="#3e3730" strokeWidth="1.6" />
      </g>
      <g className="ns-drip">
        <path d="M96 96 q-1.4 2 0 3 q1.4 -1 0 -3z" fill="#816b34" />
      </g>
      <Jerrycan x={98} y={106} />
      <g transform="translate(130 100)">
        <g className="ns-bob">
          <Thief arm="out" />
        </g>
      </g>
    </>
  ),
  sickCow: (
    <>
      <Fence x0={8} x1={190} y={86} />
      <g transform="translate(88 92)">
        <g className="ns-sway">
          <Cow sick />
        </g>
        <path className="ns-tear" d="M23 -7 q-1.3 2 0 3 q1.3 -1 0 -3z" fill="#a9d5aa" />
        <g className="ns-heat">
          <path d="M-6 -20 q2 -3 0 -6 q-2 -3 0 -6 M2 -22 q2 -3 0 -6 q-2 -3 0 -6 M10 -20 q2 -3 0 -6 q-2 -3 0 -6" fill="none" stroke="#e46f58" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </g>
      <Thermometer x={156} y={88} />
    </>
  ),
  sickHen: (
    <>
      <Coop x={20} open={false} />
      <g className="ns-sway">
        <Hen x={110} y={98} s={1.5} sick />
      </g>
      <g transform="translate(110 70)">
        <g className="ns-heat">
          <path d="M-4 0 q2 -3 0 -6 q-2 -3 0 -6 M4 0 q2 -3 0 -6 q-2 -3 0 -6" fill="none" stroke="#e46f58" strokeWidth="1.1" strokeLinecap="round" />
        </g>
      </g>
      <Thermometer x={156} y={88} />
    </>
  ),
  deadCow: (
    <>
      <Fence x0={8} x1={190} y={86} />
      <g transform="translate(96 96) rotate(-4)">
        <g className="ns-fade">
          {/* lying down: the legs folded under, the eyes crossed */}
          <g transform="matrix(1 0 0 0.62 0 -2)">
            <Cow dead />
          </g>
        </g>
      </g>
    </>
  ),
  deadHen: (
    <>
      <Coop x={20} open={false} />
      <g className="ns-fade">
        <Hen x={124} y={96} s={1.4} dead />
      </g>
    </>
  ),
  thirst: (
    <>
      <g transform="translate(36 70)">
        <path d="M0 0 h50 l-5 16 h-40 z" fill="#a39e93" stroke="#676257" strokeWidth="1" />
        <path d="M6 4 l6 4 5 -3 6 5 M28 4 l5 5 6 -4 5 4" fill="none" stroke="#767064" strokeWidth="0.8" />
        <g className="ns-dust">
          <circle cx="8" cy="-4" r="2.4" fill="#e0d0ae" />
          <circle cx="14" cy="-7" r="1.8" fill="#e0d0ae" />
        </g>
      </g>
      <g transform="translate(130 94)">
        <g className="ns-pant">
          <Cow sick />
        </g>
        <path className="ns-tongue" d="M14 0 q2 6 4 1" fill="#efac9f" stroke="#a5685b" strokeWidth="0.6" />
      </g>
      <g className="ns-sweat">
        <path d="M156 66 q-1.6 2.4 0 3.6 q1.6 -1.2 0 -3.6z M146 62 q-1.4 2 0 3 q1.4 -1 0 -3z" fill="#a9d5aa" />
      </g>
    </>
  ),
};
