import { useId, type ReactElement } from 'react';
import { INK } from '../art/anime';
import cowUrl from './art/cow.webp';
import henUrl from './art/hen.webp';
import { subjectOf } from '../inspect/subjects';
import type { SubjectId } from '../inspect/types';
import type { Mark } from './exam';
import { FarmScene } from '../inspect/scenes/Farm';
import { BeanScene, KaleScene, TomatoScene } from '../inspect/scenes/Crops';
import { PlantScene } from '../inspect/scenes/Plant';
import { PowerScene } from '../inspect/scenes/Power';
import { TractorScene } from '../inspect/scenes/Tractor';
import { WaterScene } from '../inspect/scenes/Water';

/** The drawings of the farm's machines and places: early signs `e`, and the red marks `r`. */
const SCENES: Partial<Record<SubjectId, (p: { uid: string; e: Set<string>; r: Set<string> }) => ReactElement>> = {
  plant: PlantScene,
  beans: BeanScene,
  kale: KaleScene,
  tomato: TomatoScene,
  tractor: TractorScene,
  farm: FarmScene,
  water: WaterScene,
  power: PowerScene,
};

/* What is being examined, drawn in SVG on a 480 × 270 scene in the game's ink-outline style: a cow in her pen (a
   feed trough, a milk pail, a water trough and the tank), a hen in the coop (the perch, the nest boxes and the egg
   tray), or one of the farm's machines and places (src/inspect/scenes). Each sign of a problem (exam.ts Mark) is drawn on the body where a vet would see it, and moves where it
   moves: the flank heaves, tears and drips fall, a hurt foot is held up. Early signs (src/inspect/early.ts) are drawn
   smaller, where a full check finds them: ticks in an ear, a dripping valve, a cracked perch. The parts are where the
   subject's parts (src/inspect/subjects.ts) put the camera. */

const W = 480;
const H = 270;
const SW = 1.3;
const HOOF = '#4e3e31';

export interface SceneProps {
  subject: SubjectId;
  /** the red signs to draw (an animal's problem: exam.ts Mark; elsewhere src/inspect/urgent.ts) */
  marks: Set<string>;
  /** the early signs to draw (not yet dealt with) */
  early?: string[];
  /** parts to pin with a pulsing red ring (the ones with a finding) */
  rings?: string[];
  /** parts with an early sign found: an amber ring */
  amber?: string[];
  /** parts not checked yet: a dashed ring */
  todo?: string[];
  /** numbered pins, after the examination */
  pins?: string[];
  /** the part the camera is on (its rings are hidden) */
  focus?: string | null;
  /** parts moved from their usual place by the animal's pose (exam.ts spotsOf) */
  spots?: Record<string, { x: number; y: number }>;
  /** the part to tap next: a glowing gold ring and a pointing hand */
  hint?: string | null;
  /** tap a part */
  onPart?: (id: string) => void;
  className?: string;
}

export function ExamScene({ subject, marks, early = [], rings = [], amber = [], todo = [], pins = [], focus, hint = null, spots = {}, onPart, className }: SceneProps) {
  const uid = `ex${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const parts = subjectOf(subject).parts.map(p => (spots[p.id] ? { ...p, at: { ...p.at, ...spots[p.id] } } : p));
  const at = (id: string) => parts.find(x => x.id === id)!.at;
  const e = new Set(early);
  // the part to tap next sits on top, so it wins where two parts' spots overlap
  const hits = hint ? [...parts.filter(p => p.id !== hint), ...parts.filter(p => p.id === hint)] : parts;
  return (
    <svg className={`ex-scene${className ? ` ${className}` : ''}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden={onPart ? undefined : true}>
      <g aria-hidden="true">{subject === 'cow' ? <Pen uid={uid} m={marks as Set<Mark>} e={e} /> : subject === 'hen' ? <Coop uid={uid} m={marks as Set<Mark>} e={e} /> : SCENES[subject]!({ uid, e, r: marks })}</g>
      {onPart &&
        hits.map(p => (
          <circle
            key={`hit-${p.id}`}
            className={`ex-hit${p.id === hint ? ' is-next' : ''}`}
            data-part={p.id}
            role="button"
            tabIndex={0}
            aria-label={p.label}
            cx={p.at.x}
            cy={p.at.y}
            r={p.id === 'stance' ? 11 : 14}
            onClick={ev => {
              ev.stopPropagation();
              onPart(p.id);
            }}
            onKeyDown={ev => {
              if (ev.key !== 'Enter' && ev.key !== ' ') return;
              ev.preventDefault();
              onPart(p.id);
            }}
          />
        ))}
      {todo
        .filter(id => id !== focus && !rings.includes(id))
        .map(id => (
          <circle key={`todo-${id}`} className="ex-todo-ring" cx={at(id).x} cy={at(id).y} r={7} />
        ))}
      {amber
        .filter(id => id !== focus && !rings.includes(id))
        .map(id => (
          <g key={`amber-${id}`} className="ex-ring is-amber" transform={`translate(${at(id).x} ${at(id).y})`}>
            <circle r={8} />
          </g>
        ))}
      {rings
        .filter(id => id !== focus)
        .map(id => (
          <g key={`ring-${id}`} className="ex-ring" transform={`translate(${at(id).x} ${at(id).y})`}>
            <circle r={9} />
            <circle r={9} className="ex-ring-wave" />
          </g>
        ))}
      {hint && parts.some(p => p.id === hint) && <Hint x={at(hint).x} y={at(hint).y} />}
      {pins.map((id, i) => (
        <g key={`pin-${id}`} transform={`translate(${at(id).x} ${at(id).y})`}>
          <g className="ex-pin" style={{ animationDelay: `${0.5 + i * 0.12}s` }}>
            <circle r={7} />
            <text y={2.6} textAnchor="middle">
              {i + 1}
            </text>
          </g>
        </g>
      ))}
    </svg>
  );
}

/** Tap here: a gold ring that breathes, and a storybook hand that taps at it from above (below, near the top edge). */
function Hint({ x, y }: { x: number; y: number }) {
  const up = y < 46;
  return (
    <g className="ex-hint" transform={`translate(${x} ${y})`} aria-hidden="true">
      <circle r={12} className="ex-hint-wave" />
      <circle r={12} className="ex-hint-ring" />
      <g transform={up ? 'rotate(180) translate(-4 -14)' : 'translate(4 -14)'}>
        <g className="ex-hand">
          {/* the hand, pointing down at the part: a cuff, a fist, and the finger */}
          <path d="M-1.6 0 C-3 -1 -3 -3 -2.6 -9 L-2.6 -12 C-5.6 -12 -6.4 -14.5 -6 -17 L-5.4 -20.5 L6.4 -20.5 L7 -15 C7 -12 5.6 -11 3.4 -11 L2.4 -11 L2.4 -3 C2.4 -0.4 0.4 0.8 -1.6 0 Z" fill="#fdedd4" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
          <path d="M-2.6 -12 L2.4 -12 M-0.6 -15.5 L-0.6 -12.6 M2.2 -15.5 L2.2 -12.6" fill="none" stroke={INK} strokeWidth={0.7} strokeLinecap="round" opacity={0.6} />
          <rect x={-6.2} y={-25.5} width={13.4} height={5.4} rx={1.6} fill="#ffae00" stroke={INK} strokeWidth={1.1} />
        </g>
      </g>
    </g>
  );
}

/* ---------------- the cow in her pen ---------------- */

function Pen({ uid, m, e }: { uid: string; m: Set<Mark>; e: Set<string> }) {
  const hot = m.has('shade');
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={hot ? '#f1cb81' : '#f2e4c7'} />
          <stop offset="1" stopColor={hot ? '#f6dfac' : '#efdab5'} />
        </linearGradient>
      </defs>
      {/* sky, the far fence, the ground */}
      <rect x={-400} y={-300} width={W + 800} height={500} fill={`url(#${uid}-sky)`} stroke="none" />
      {hot && <Sun />}
      {[18, 128, 238, 348].map(x => (
        <rect key={x} x={x} y={138} width={7} height={70} rx={1.5} fill="#a67f56" />
      ))}
      <rect x={-400} y={150} width={W + 800} height={6} fill="#bd956d" />
      <rect x={-400} y={174} width={W + 800} height={6} fill="#bd956d" />
      <rect x={-400} y={200} width={W + 800} height={400} fill={hot ? '#dbc590' : '#d2c297'} stroke="none" />
      <path d="M-400,200 H880" fill="none" />
      {[40, 150, 205, 360, 470].map((x, i) => (
        <path key={x} d={`M${x},${252 - (i % 2) * 8} l3,-7 l2,6 l3,-8 l2,9`} fill="none" stroke="#939252" strokeWidth={1.1} />
      ))}
      {hot && <Shade />}
      {!hot && e.has('hotWeek') && (
        <g className="ex-sun-early">
          <Sun />
          <path d="M140,92 C150,70 176,64 190,76" fill="none" stroke="#dea14c" strokeWidth={1.2} strokeDasharray="3 3" />
        </g>
      )}

      {/* the tank, its pipe, and the water trough */}
      <Tank low={m.has('tankDrop')} />
      <Trough mud={m.has('mud')} low={m.has('drinkMore')} />
      {e.has('tapDrip') && !m.has('tankDrop') && (
        <g>
          <circle cx={446} cy={181} r={2.6} fill="#adccad" strokeWidth={0.8} />
          <path className="ex-drip" d="M446,184 c-1.8,2.6 -1.8,4.4 0,5 c1.8,-0.6 1.8,-2.4 0,-5 Z" fill="#adccad" strokeWidth={0.7} />
          <ellipse cx={446} cy={206} rx={7} ry={1.8} fill="#a4baa4" stroke="none" />
        </g>
      )}
      {e.has('valveDrip') && !m.has('mud') && (
        <g>
          <ellipse cx={414} cy={238} rx={13} ry={3} fill="#937959" stroke="none" />
          <path className="ex-drip is-slow" d="M417,204 c-1.8,2.6 -1.8,4.4 0,5 c1.8,-0.6 1.8,-2.4 0,-5 Z" fill="#adccad" strokeWidth={0.7} />
        </g>
      )}

      {/* the feed trough */}
      <g>
        <path d="M18,206 L108,206 L102,236 L24,236 Z" fill="#9c7049" />
        <path d="M24,216 H102 M26,226 H100" fill="none" stroke="#755032" strokeWidth={1} />
        {m.has('noFeed') ? (
          <g>
            <path d="M22,207 C26,186 44,180 58,186 C70,176 92,182 104,207 Z" fill="#77a657" />
            <path d="M34,196 l4,-8 M52,190 l2,-9 M70,188 l-2,-8 M86,194 l4,-7 M44,203 l-3,-7 M94,201 l3,-6" fill="none" stroke="#4e7935" strokeWidth={1.1} />
            <g className="ex-fly">
              <circle cx={60} cy={176} r={1.6} fill={INK} stroke="none" />
              <path d="M59,174 l-2,-2 M61,174 l2,-2" strokeWidth={0.7} />
            </g>
          </g>
        ) : (
          <g>
            <path d="M28,207 C40,202 60,204 74,201 C86,203 96,203 100,207 Z" fill="#82ab64" />
            {e.has('wetClover') && (
              <g strokeWidth={0.8}>
                <path d="M36,205 C38,194 52,190 60,196 C68,190 82,194 84,205 Z" fill="#548545" />
                {[44, 54, 64, 74].map((x, i) => (
                  <g key={x}>
                    <circle cx={x} cy={198 - (i % 2) * 2} r={2.6} fill="#6ea657" />
                    <circle cx={x + 2.6} cy={197 - (i % 2) * 2} r={2.2} fill="#6ea657" />
                  </g>
                ))}
                <g fill="#d0e1d0" stroke="none">
                  <circle cx={48} cy={195} r={1} />
                  <circle cx={62} cy={193} r={1.1} />
                  <circle cx={77} cy={197} r={0.9} />
                </g>
              </g>
            )}
          </g>
        )}
      </g>

      {/* the milk pail */}
      <Pail low={m.has('milkLow')} clots={m.has('clots')} />

      {/* dung */}
      {e.has('looseDung') ? (
        <g strokeWidth={1}>
          <path d="M374,253 C374,247 386,244 394,246 C404,243 414,248 412,253 C410,257 378,258 374,253 Z" fill="#685835" />
          <ellipse cx={392} cy={250} rx={8} ry={1.4} fill="rgba(255,255,255,0.35)" stroke="none" />
          {[368, 419, 380, 406].map((x, i) => (
            <circle key={x} cx={x} cy={252 - (i % 2) * 5} r={1.4} fill="#685835" stroke="none" />
          ))}
        </g>
      ) : (
        <path d="M380,252 C378,244 386,240 392,242 C396,236 406,240 404,247 C410,248 408,255 400,255 L384,255 C379,255 378,253 380,252 Z" fill="#69523c" />
      )}

      <Cow uid={uid} m={m} e={e} />
    </g>
  );
}


/* The cow: Dean's picture of a brown cow (its white and the generator's watermark cut away), placed on the 480 × 270
   scene with her muzzle at the left and her hooves on the ground. Signs are drawn over the picture where a vet sees
   them: tears and flies at the eye, a runny nose, an open mouth, the lump under the ear, ticks in the ear, a swollen
   quarter, a sore or overgrown hoof, a bloated left flank, fast breathing, fever and the thermometer under the tail. */
const COW_IMG = { x: 66, y: 38.4, w: 320, h: 201.6 };
const COW_COAT = '#a8561e';

function Cow({ m, e }: { uid: string; m: Set<Mark>; e: Set<string> }) {
  const fast = m.has('fastBreath');
  const open = m.has('pant') || m.has('tongueBlisters');
  return (
    <g>
      <ellipse cx={262} cy={238} rx={116} ry={7} fill="rgba(60,40,30,0.18)" stroke="none" />
      {/* her body, breathing */}
      <g className={`ex-breathe${fast ? ' is-fast' : ''}`}>
        <image href={cowUrl} x={COW_IMG.x} y={COW_IMG.y} width={COW_IMG.w} height={COW_IMG.h} preserveAspectRatio="none" />
        {m.has('bloat') && (
          <g transform="translate(-13 -16)">
            <path d="M262,90 C266,56 330,52 346,90 Z" fill={COW_COAT} />
            <path d="M282,74 C292,66 312,66 322,74" fill="none" stroke="#7a3a12" strokeWidth={1} />
            <Drum />
          </g>
        )}
        {/* the ribs, seen when she breathes hard */}
        {fast && <path d="M188,104 C198,118 200,136 194,154 M202,100 C212,116 214,136 208,156 M216,98 C226,114 228,134 222,154" fill="none" stroke="#6e3210" strokeWidth={1.2} />}
      </g>
      {/* the udder: a swollen, hot quarter; a cracked teat */}
      <g transform="translate(28 -26)">
        {m.has('quarter') && (
          <g>
            <ellipse cx={304} cy={182} rx={12} ry={11} fill="#d28272" />
            <rect x={304} y={190} width={4.5} height={9} rx={2} fill="#dda99f" />
            <path className="ex-haze" d="M298,170 q2,-4 0,-8 q-2,-4 0,-8 M308,170 q2,-4 0,-8 q-2,-4 0,-8" fill="none" stroke="#ce6a56" strokeWidth={1} />
          </g>
        )}
        {e.has('teatCrack') && (
          <g>
            <path d="M283.4,191 C285,192 286,193.6 287.4,194.6" fill="none" stroke="#9e4534" strokeWidth={0.9} />
            <path d="M282.6,186 C285,185 288,186 289,189 L284,190 Z" fill="#836949" stroke="none" opacity={0.85} />
          </g>
        )}
      </g>
      {/* the front hoof: sore and blistered, or grown too long */}
      {m.has('hoofBlisters') && (
        <g>
          <ellipse className="ex-glow" cx={206} cy={232} rx={12} ry={7} fill="rgba(229,84,63,0.3)" stroke="none" />
          <g fill="#fdf6f0" strokeWidth={0.8}>
            <circle cx={202} cy={232} r={1.8} />
            <circle cx={208} cy={234} r={1.5} />
            <circle cx={212} cy={231} r={1.3} />
          </g>
        </g>
      )}
      {/* kicking up at her belly: the back leg's swing */}
      {m.has('kick') && <path className="ex-tap" d="M346,206 a14,14 0 0 0 4,-22 M354,212 a22,22 0 0 0 6,-34" fill="none" stroke="#964b3c" strokeWidth={1.4} />}
      {e.has('longHoof') && <path d="M178,229 C171,232 167,236 165,239 C169,238 173,237 176,237 Z" fill={HOOF} strokeWidth={1} transform="translate(0 -1)" />}
      {/* ticks in the ear */}
      {e.has('ticks') && (
        <g fill="#2e1d12" strokeWidth={0.6} transform="translate(-34 -33)">
          <ellipse cx={148} cy={99.5} rx={2} ry={1.5} />
          <ellipse cx={153.5} cy={98.4} rx={2.3} ry={1.7} />
          <ellipse cx={157.6} cy={99.6} rx={1.7} ry={1.3} />
        </g>
      )}
      {/* the swollen lymph node, under the ear behind the jaw */}
      {m.has('lump') && (
        <g transform="translate(-11 -33)">
          <ellipse className="ex-glow" cx={138} cy={126} rx={15} ry={12} fill="rgba(229,84,63,0.3)" stroke="none" />
          <path d="M126,124 C126,114 134,110 142,112 C152,114 154,126 150,134 C144,140 130,138 126,124 Z" fill="#c9733c" />
          <path d="M131,119 C135,115 142,115 146,118" fill="none" stroke="#8a4318" strokeWidth={1} />
        </g>
      )}
      {/* the mouth: open, panting or sore */}
      {open && (
        <g transform="translate(-11 -42)">
          <path d="M78,155 C86,154 98,155 106,152 L104,162 C96,168 84,168 78,163 Z" fill="#623c35" />
          <path d="M80,158 C80,170 86,178 92,176 C98,174 98,166 94,159 Z" fill={m.has('tongueBlisters') ? '#dba296' : '#e0a599'} />
          {m.has('tongueBlisters') && (
            <g fill="#fdf6f0" strokeWidth={0.8}>
              <circle cx={86} cy={165} r={2.2} />
              <circle cx={91} cy={170} r={1.8} />
              <circle cx={84} cy={171} r={1.5} />
              <circle cx={100} cy={157} r={1.4} />
            </g>
          )}
          <path className="ex-drool" d="M88,176 C88,186 89,194 88,202 M95,172 C96,180 97,186 96,192" fill="none" stroke="#d0e1d0" strokeWidth={1.4} />
        </g>
      )}
      {/* at the eye */}
      <g transform="translate(-15 -27)">
        {e.has('flies') && (
          <g className="ex-fly">
            {[
              [119, 101],
              [103, 113],
              [117, 113],
            ].map(([x, y]) => (
              <g key={x * y}>
                <circle cx={x} cy={y} r={1.3} fill={INK} stroke="none" />
                <path d={`M${x - 1},${y - 1.6} l-1.6,-1.6 M${x + 1},${y - 1.6} l1.6,-1.6`} strokeWidth={0.6} />
              </g>
            ))}
          </g>
        )}
        {m.has('tears') && (
          <g>
            <path d="M107,111 C104,118 104,126 101,134" fill="none" stroke="#adccad" strokeWidth={2} />
            <path className="ex-drip" d="M101,134 c-2,3 -2,5 0,6 c2,-1 2,-3 0,-6 Z" fill="#adccad" strokeWidth={0.8} />
          </g>
        )}
      </g>
      {m.has('runny') && (
        <g transform="translate(-12 -41)">
          <path d="M80,148 C79,152 79,156 80,158" fill="none" stroke="#d0e1d0" strokeWidth={2.2} />
          <path className="ex-drip is-slow" d="M80,158 c-2.4,3.4 -2.4,6 0,7 c2.4,-1 2.4,-3.6 0,-7 Z" fill="#d0e1d0" strokeWidth={0.8} />
        </g>
      )}
      {m.has('pant') && <Puffs x={61} y={118} />}
      {fast && <Puffs x={58} y={103} />}
      {m.has('fever') && <Fever />}
    </g>
  );
}

function Drum() {
  return (
    <g className="ex-tap" fill="none" stroke="#964b3c" strokeWidth={1.2}>
      <path d="M300,40 a8,8 0 0 1 0,14 M306,36 a14,14 0 0 1 0,22" />
      <path d="M294,40 a8,8 0 0 0 0,14 M288,36 a14,14 0 0 0 0,22" />
    </g>
  );
}

function Puffs({ x, y }: { x: number; y: number }) {
  return (
    <g className="ex-puff" fill="rgba(255,255,255,0.75)" stroke="rgba(42,23,48,0.35)" strokeWidth={0.8}>
      <circle cx={x - 8} cy={y} r={3} />
      <circle cx={x - 15} cy={y - 3} r={4} />
      <circle cx={x - 23} cy={y - 7} r={4.6} />
    </g>
  );
}

function Fever() {
  return (
    <g>
      <g className="ex-haze" fill="none" stroke="#ce6a56" strokeWidth={1.2} opacity={0.75} transform="translate(0 -22)">
        <path d="M200,74 q4,-6 0,-12 q-4,-6 0,-12" />
        <path d="M250,72 q4,-6 0,-12 q-4,-6 0,-12" />
        <path d="M300,72 q4,-6 0,-12 q-4,-6 0,-12" />
        <path d="M120,78 q4,-6 0,-12 q-4,-6 0,-12" />
      </g>
      {/* the thermometer, under the tail */}
      <g transform="translate(6 -32) rotate(-38 374 112)">
        <rect x={372} y={84} width={6} height={30} rx={3} fill="#fbf8ee" />
        <rect x={373.6} y={94} width={2.8} height={18} rx={1.4} fill="#ce6a56" stroke="none" className="ex-mercury" />
        <circle cx={375} cy={114} r={4} fill="#ce6a56" />
      </g>
    </g>
  );
}

function Sun() {
  return (
    <g className="ex-sun">
      <circle cx={420} cy={36} r={20} fill="#edca5f" stroke="#d39b2f" />
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return <path key={i} d={`M${420 + Math.cos(a) * 26},${36 + Math.sin(a) * 26} L${420 + Math.cos(a) * 34},${36 + Math.sin(a) * 34}`} stroke="#d39b2f" strokeWidth={2} />;
      })}
    </g>
  );
}

/** One tree's shade over the pen: the cow stands in it; the rest of the pen shimmers in the sun. */
function Shade() {
  return (
    <g>
      <ellipse cx={250} cy={236} rx={150} ry={18} fill="rgba(70,90,40,0.28)" stroke="none" />
      <rect x={238} y={40} width={16} height={60} fill="#755439" />
      <path d="M140,62 C120,34 160,8 200,18 C222,-4 280,-4 300,16 C342,6 376,34 356,62 C366,80 330,96 300,86 C276,100 220,100 196,86 C164,96 128,84 140,62 Z" fill="#679451" />
      <path d="M170,52 C190,44 210,48 220,40 M260,40 C276,48 300,44 320,52" fill="none" stroke="#4d773c" strokeWidth={1.2} />
      <g className="ex-haze" fill="none" stroke="#dea14c" strokeWidth={1.2} opacity={0.7}>
        <path d="M30,196 q4,-6 0,-12 q-4,-6 0,-12" />
        <path d="M60,192 q4,-6 0,-12 q-4,-6 0,-12" />
        <path d="M430,196 q4,-6 0,-12 q-4,-6 0,-12" />
      </g>
    </g>
  );
}

function Tank({ low }: { low: boolean }) {
  return (
    <g>
      <path d="M428,176 L428,206 M464,176 L464,206" fill="none" stroke="#745a42" strokeWidth={3} />
      <rect x={420} y={102} width={52} height={76} rx={6} fill="#518f8c" />
      <path d="M420,118 H472 M420,134 H472 M420,150 H472 M420,166 H472" fill="none" stroke="#417573" strokeWidth={1} />
      <ellipse cx={446} cy={102} rx={26} ry={5} fill="#64a4a1" />
      {/* the level gauge */}
      <rect x={462} y={110} width={6} height={60} rx={2} fill="#ecefec" />
      <rect className={low ? 'ex-level is-falling' : 'ex-level'} x={463.2} y={low ? 150 : 120} width={3.6} height={low ? 19 : 49} rx={1.4} fill="#86b886" stroke="none" />
      <path d="M446,178 L446,192 L418,192 L418,200" fill="none" stroke="#718180" strokeWidth={2.4} />
    </g>
  );
}

function Trough({ mud, low }: { mud: boolean; low: boolean }) {
  return (
    <g>
      {mud && (
        <g>
          <path d="M386,232 C380,218 400,206 420,212 C446,204 486,210 486,226 C492,244 460,252 430,248 C404,252 384,246 386,232 Z" fill="#745a41" stroke="none" />
          <ellipse cx={408} cy={240} rx={10} ry={3} fill="#a4baa4" stroke="none" />
          <ellipse cx={470} cy={242} rx={8} ry={2.6} fill="#a4baa4" stroke="none" />
        </g>
      )}
      <path d="M402,202 L478,202 L474,232 L406,232 Z" fill="#a0a7a1" />
      <path d="M402,202 L478,202" fill="none" />
      <ellipse cx={440} cy={204} rx={36} ry={3.4} fill={low ? '#b8c7b8' : '#91b791'} />
      {/* the float valve */}
      <rect x={412} y={196} width={10} height={7} rx={1.5} fill="#cbcfcb" />
      {mud && (
        <g>
          <path className="ex-drip" d="M416,233 c-2,3 -2,5 0,6 c2,-1 2,-3 0,-6 Z" fill="#adccad" strokeWidth={0.8} />
          <path d="M440,232 l-2,6 M452,232 l1,5" fill="none" stroke="#553e29" strokeWidth={1} />
          <text className="ex-hiss" x={400} y={190} fontSize={7} fontWeight={800} fill="#417573" stroke="none" fontStyle="italic">
            sss…
          </text>
        </g>
      )}
    </g>
  );
}

function Pail({ low, clots }: { low: boolean; clots: boolean }) {
  return (
    <g>
      <path d="M238,212 L268,212 L264,238 L242,238 Z" fill="#bfc4bf" />
      <path d="M242,222 H264" fill="none" stroke="#9ea49e" strokeWidth={1} />
      <path d="M238,212 C238,198 268,198 268,212" fill="none" stroke="#919b9a" strokeWidth={1.2} />
      <ellipse cx={253} cy={212} rx={15} ry={3.6} fill={low ? '#919b9a' : '#fefcf7'} />
      {low && <ellipse cx={253} cy={213} rx={6} ry={1.4} fill="#fefcf7" stroke="none" />}
      {clots && (
        <g fill="#e3cb86" strokeWidth={0.6}>
          <circle cx={246} cy={212} r={1.6} />
          <circle cx={252} cy={211} r={1.2} />
          <circle cx={258} cy={213} r={1.8} />
          <circle cx={262} cy={211.5} r={1} />
        </g>
      )}
    </g>
  );
}

/* ---------------- the hen in the coop ---------------- */


function Coop({ uid, m, e }: { uid: string; m: Set<Mark>; e: Set<string> }) {
  return (
    <g stroke={INK} strokeWidth={SW} strokeLinejoin="round" strokeLinecap="round">
      <defs>
        <linearGradient id={`${uid}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#cfaf83" />
          <stop offset="1" stopColor="#bf9b6e" />
        </linearGradient>
      </defs>
      <rect x={-400} y={-300} width={W + 800} height={520} fill={`url(#${uid}-wall)`} stroke="none" />
      {Array.from({ length: 34 }, (_, i) => (
        <path key={i} d={`M${i * 38 - 390},-300 V220`} fill="none" stroke="#ae895f" strokeWidth={1} />
      ))}
      <rect x={-400} y={214} width={W + 800} height={400} fill="#dfcfa3" stroke="none" />
      <path d="M-400,214 H880" fill="none" />
      {[30, 140, 220, 300, 450].map((x, i) => (
        <path key={x} d={`M${x},${240 + (i % 3) * 8} l6,-2 M${x + 10},${236 + (i % 2) * 10} l5,2`} fill="none" stroke="#bca97a" strokeWidth={1} />
      ))}

      {/* the egg tray on its shelf */}
      <rect x={20} y={84} width={94} height={6} fill="#926b46" />
      <rect x={28} y={72} width={78} height={12} rx={3} fill="#e4dbc8" />
      {[0, 1, 2, 3, 4].map(i => (
        <ellipse key={i} cx={38 + i * 14.5} cy={74} rx={5} ry={6.4} fill={m.has('fewerEggs') && i > 0 ? '#d5cab4' : '#f2e7d6'} strokeWidth={m.has('fewerEggs') && i > 0 ? 0.8 : SW} opacity={m.has('fewerEggs') && i > 0 ? 0.55 : 1} />
      ))}
      {e.has('dirtyEggs') && (
        <g fill="#735a3f" stroke="none" opacity={0.85}>
          <path d="M49,72 C52,70 55,72 55,75 C53,77 50,76 49,72 Z" />
          <path d="M78,74 C81,71 84,73 84,77 C81,78 79,77 78,74 Z" />
        </g>
      )}

      {/* the perch */}
      <Perch specks={m.has('specks')} dead={m.has('dead')} cracks={e.has('perchCracks')} />

      {/* the nest box */}
      <g>
        <rect x={18} y={170} width={96} height={64} rx={3} fill="#9c7049" />
        <rect x={28} y={182} width={76} height={40} rx={20} fill="#583c26" />
        <path d="M30,216 C42,204 90,204 102,216 L102,222 L30,222 Z" fill="#d8bb5e" />
        {m.has('brokenEggs') ? (
          <g>
            <path d="M44,212 C46,200 58,200 60,212 L56,208 L52,213 L48,208 Z" fill="#f2e7d6" />
            <path d="M66,214 C64,206 76,202 80,212 C82,216 76,218 70,217 Z" fill="#e0ae2e" />
            <path d="M84,214 C84,206 94,204 96,212 L92,210 L90,215 Z" fill="#f2e7d6" />
            <path d="M68,218 C72,222 80,222 84,218" fill="none" stroke="#ce9325" strokeWidth={1.2} />
          </g>
        ) : (
          <g>
            <ellipse cx={58} cy={210} rx={6} ry={7.4} fill="#f2e7d6" />
            <ellipse cx={74} cy={211} rx={6} ry={7.4} fill="#f2e7d6" />
            {e.has('thinShell') && (
              <g>
                <path d="M84,214 C83,206 88,203 91,205 C95,207 96,214 92,217 C88,218 85,217 84,214 Z" fill="#ece5d8" strokeWidth={0.9} />
                <path d="M86,209 C88,211 90,210 92,212" fill="none" stroke="#b5a892" strokeWidth={0.8} />
              </g>
            )}
          </g>
        )}
      </g>

      {/* droppings */}
      {e.has('wetLitter') && (
        <g>
          <ellipse cx={372} cy={244} rx={34} ry={7} fill="rgba(110,84,44,0.5)" stroke="none" />
          <path d="M392,236 l3,-4 M402,238 l3,-4" fill="none" stroke="#b0c3a1" strokeWidth={1} className="ex-haze" />
        </g>
      )}
      <Droppings kind={m.has('bloodDrop') ? 'blood' : m.has('greenDrop') ? 'green' : 'normal'} />

      {e.has('wildBirds') && (
        <g className="ex-float-still" fill="#a8a399" strokeWidth={0.7}>
          <path d="M300,118 c6,-6 14,-4 12,4 c-6,4 -12,2 -12,-4 Z" />
          <path d="M306,116 l6,4" fill="none" />
          <path d="M206,204 c5,-5 12,-3 10,3 c-5,3 -10,2 -10,-3 Z" />
        </g>
      )}
      <Hen uid={uid} m={m} e={e} />
    </g>
  );
}

function Perch({ specks, dead, cracks }: { specks: boolean; dead: boolean; cracks: boolean }) {
  return (
    <g>
      {specks && <rect x={316} y={40} width={176} height={80} rx={8} fill="rgba(30,30,70,0.32)" stroke="none" />}
      <rect x={340} y={92} width={6} height={124} fill="#835b38" />
      <rect x={452} y={92} width={6} height={124} fill="#835b38" />
      <rect x={324} y={88} width={160} height={8} rx={4} fill="#9d744f" />
      {cracks && <path d="M362,90 l6,2 l5,-1 M392,93 l7,-2 l4,2 M420,90 l5,3 l6,-2 M446,93 l5,-2" fill="none" stroke="#543a22" strokeWidth={1.1} />}
      {dead && <DeadHen />}
      {specks && (
        <g>
          <path d="M470,52 a8,8 0 1 0 6,13 a6,6 0 1 1 -6,-13 Z" fill="#eee2b0" />
          <g fill="#b95541" stroke="none" className="ex-crawl">
            {[352, 360, 371, 384, 392, 404, 417, 428, 436, 449].map((x, i) => (
              <circle key={x} cx={x} cy={89 + (i % 3) * 2.4} r={1.1} />
            ))}
          </g>
          <path d="M330,64 L376,92 M330,64 L360,100" fill="none" stroke="rgba(255,240,180,0.5)" strokeWidth={4} />
        </g>
      )}
    </g>
  );
}

/** A hen dead on the perch at dawn: slumped over it, feet in the air, head hanging. */
function DeadHen() {
  return (
    <g>
      <path d="M396,84 C394,98 390,108 384,112" fill="none" stroke="#bb7748" strokeWidth={7} />
      <circle cx={382} cy={114} r={7} fill="#bb7748" />
      <path d="M379,111 l4,4 M383,111 l-4,4" fill="none" strokeWidth={1.1} />
      <path d="M380,121 l-2,6 l4,-3" fill="#c69c4a" strokeWidth={0.8} />
      <path d="M392,88 C390,72 404,62 420,64 C438,66 446,78 440,90 Z" fill="#8d5449" />
      <path d="M410,66 l-2,-12 M408,54 l-4,-3 M408,54 l1,-5 M424,66 l3,-11 M427,55 l-3,-4 M427,55 l4,-2" fill="none" stroke="#c69c4a" strokeWidth={1.8} />
    </g>
  );
}

function Droppings({ kind }: { kind: 'normal' | 'green' | 'blood' }) {
  if (kind === 'green')
    return (
      <g strokeWidth={0.9}>
        <path d="M332,248 C334,240 348,240 352,246 C360,244 366,250 360,254 C350,258 334,256 332,248 Z" fill="#79b44a" />
        <path d="M370,252 C372,246 382,246 384,250 C386,256 372,258 370,252 Z" fill="#8dc360" />
        <circle cx={344} cy={247} r={2} fill="#f2f0e6" stroke="none" />
      </g>
    );
  if (kind === 'blood')
    return (
      <g strokeWidth={0.9}>
        <path d="M334,248 C336,240 350,240 354,246 C360,246 364,252 358,255 C348,258 336,256 334,248 Z" fill="#684b33" />
        <path d="M340,247 C346,244 352,248 356,250" fill="none" stroke="#b14934" strokeWidth={2} />
        <path d="M368,252 C370,246 380,246 382,250 C384,256 370,258 368,252 Z" fill="#934434" />
      </g>
    );
  return (
    <g strokeWidth={0.9}>
      <path d="M340,250 C340,244 352,242 356,248 C358,254 342,256 340,250 Z" fill="#735a3f" />
      <circle cx={349} cy={246} r={2.4} fill="#f2f0e6" />
    </g>
  );
}

/* The hen: Dean's illustration (Unsplash, "A brown hen standing on a white background",
   https://unsplash.com/illustrations/a-brown-hen-standing-on-a-white-background-aKxMB1LBK3U), its white cut away,
   placed on the 480 × 270 scene. The head is a second copy of the picture clipped to a circle, so a sick hen's pose can
   move it (upside down, turned back to peck, stretched forward to gasp) while the body stays. Signs are drawn over
   the picture where they show: a pale comb, a half-shut eye, egg on the beak, a bare vent, scaly legs. */
const HEN_IMG = { x: 150, y: 43, w: 171, h: 197 };
/** the head's centre, and how far round it the head copy reaches */
const HEN_HEAD = { x: 166, y: 64, r: 21 };

function Hen({ uid, m, e }: { uid: string; m: Set<Mark>; e: Set<string> }) {
  const ruffled = m.has('ruffled');
  // the head's pose: upside down (a twisted neck), turned back to peck its feathers, stretched out gasping, or low and hunched
  const head = m.has('twist')
    ? `rotate(165 ${HEN_HEAD.x} ${HEN_HEAD.y})`
    : m.has('pecking')
      ? `translate(238 104) scale(-1 1) rotate(-20) translate(${-HEN_HEAD.x} ${-HEN_HEAD.y})`
      : m.has('gasp')
        ? 'translate(-6 -4)'
        : ruffled
          ? 'translate(0 10)'
          : undefined;
  const img = <image href={henUrl} x={HEN_IMG.x} y={HEN_IMG.y} width={HEN_IMG.w} height={HEN_IMG.h} preserveAspectRatio="none" />;
  return (
    <g>
      <defs>
        <clipPath id={`${uid}-head`}>
          <circle cx={HEN_HEAD.x} cy={HEN_HEAD.y} r={HEN_HEAD.r} />
        </clipPath>
        <clipPath id={`${uid}-body`}>
          <path d={`M0,0 H480 V270 H0 Z M${HEN_HEAD.x - HEN_HEAD.r},${HEN_HEAD.y} a${HEN_HEAD.r},${HEN_HEAD.r} 0 1 0 ${HEN_HEAD.r * 2},0 a${HEN_HEAD.r},${HEN_HEAD.r} 0 1 0 ${-HEN_HEAD.r * 2},0 Z`} clipRule="evenodd" />
        </clipPath>
      </defs>
      <ellipse cx={228} cy={239} rx={58} ry={6} fill="rgba(60,40,30,0.18)" stroke="none" />
      <g className={ruffled ? 'ex-shiver' : undefined} transform={ruffled ? 'translate(0 8)' : undefined}>
        {ruffled && <path d={ruffle()} fill="#b5602f" opacity={0.9} />}
        <g clipPath={head ? `url(#${uid}-body)` : undefined}>{img}</g>
        {/* the neck under a head that has moved */}
        {head && <path d="M156,70 C160,84 172,92 184,94 L190,76 C182,72 172,66 166,58 Z" fill="#9b3c15" stroke="none" />}
        {e.has('scalyLegs') && <path d="M219,207 l6,-1 M219,213 l6,-1 M219,219 l6,-1 M237,210 l6,1 M237,216 l6,1 M237,222 l6,1" fill="none" stroke="#705222" strokeWidth={1.2} />}
        {m.has('bareVent') ? (
          <g>
            <ellipse cx={276} cy={170} rx={12} ry={9} fill="#e7b8af" />
            <g fill="#b55f4e" stroke="none">
              <circle cx={272} cy={168} r={1.3} />
              <circle cx={279} cy={173} r={1.1} />
              <circle cx={282} cy={167} r={0.9} />
            </g>
          </g>
        ) : null}
      </g>
      <g transform={head}>
        {head && <g clipPath={`url(#${uid}-head)`}>{img}</g>}
        {m.has('pale') && (
          <g fill="#f4d3cb" stroke="none" opacity={0.82}>
            <ellipse cx={166} cy={53} rx={11} ry={8.5} transform="rotate(-18 166 53)" />
            <ellipse cx={166.5} cy={76} rx={6.5} ry={7} />
          </g>
        )}
        {e.has('combScab') && <ellipse cx={170} cy={49} rx={2.2} ry={1.7} fill="#442c28" strokeWidth={0.6} />}
        {m.has('halfShut') && <path d="M167,63.4 A4,4 0 0 1 175,63.4 Z" fill="#9b3c15" strokeWidth={0.9} />}
        {m.has('eggBeak') && (
          <g strokeWidth={0.8}>
            <path d="M151,67 C155,63 163,64 165,69 C161,73 153,73 151,67 Z" fill="#e0ae2e" />
            <path className="ex-drip is-slow" d="M157,72 c-1.6,2.6 -1.6,4.2 0,5 c1.6,-0.8 1.6,-2.4 0,-5 Z" fill="#e0ae2e" />
          </g>
        )}
        {m.has('gasp') && <Puffs x={150} y={72} />}
      </g>
      {m.has('pecking') && (
        <g className="ex-float" fill="#ba6d3e" strokeWidth={0.7}>
          <path d="M252,126 c4,-4 10,-2 8,4 c-4,2 -8,0 -8,-4 Z" />
          <path d="M226,118 c3,-3 8,-1 6,3 c-3,2 -6,0 -6,-3 Z" />
        </g>
      )}
    </g>
  );
}

/** Feathers standing up round the body's top edge. */
function ruffle() {
  const pts: string[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + (i / 16) * Math.PI;
    const r = i % 2 ? 50 : 58;
    pts.push(`${(240 + Math.cos(a) * (r + 22)).toFixed(1)},${(160 + Math.sin(a) * (r - 14)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}
