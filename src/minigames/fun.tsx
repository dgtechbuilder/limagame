import type { ReactNode } from 'react';

/* The game layer every quiz, form and test shares: a coach who reacts, confetti for a right answer, a picture for each
   answer (picked from its words, so any list of options gets one without new data), and drawn pictures for the
   tractor lessons. Pure drawing: no state of the game here. */

/* ---------------- a picture for any answer, from its words ---------------- */

const ICONS: [RegExp, string][] = [
  // the specific ones first
  [/as hard as/i, '⬆️'],
  [/lower than/i, '⬇️'],
  [/^flat$/i, '🔻'],
  [/glyphosate|herbicide|weed killer/i, '🥀'],
  // tractor and machines
  [/\bpto\b|shaft/i, '⚙️'],
  [/steering/i, '🛞'],
  [/fuel cap|diesel|fuel|refuel|fill up/i, '⛽'],
  [/linkage|lift and hold|hitch/i, '🔗'],
  [/tyre|tire|pressure/i, '🛞'],
  [/radiator|cool|water and|the water/i, '💧'],
  [/battery|inverter|fuse|terminal|cable/i, '🔋'],
  [/seat|belt|sit down/i, '💺'],
  [/engine|start the/i, '🔑'],
  [/neutral|gear/i, '🕹️'],
  [/oil|grease/i, '🛢️'],
  [/brake|lower the tool|stop the/i, '🛑'],
  [/roll over|steep|slope/i, '⚠️'],
  [/go faster|faster/i, '💨'],
  [/less diesel|save/i, '💰'],
  [/walk round|nobody near|look/i, '👀'],
  [/only the driver|driver/i, '🧑‍🌾'],
  [/friends|passenger|two /i, '👥'],
  [/children/i, '🧒'],
  [/gloves|rings off/i, '🧤'],
  [/mask/i, '😷'],
  [/boots/i, '🥾'],
  [/plough|ploughing|subsoil|carbon/i, '🚜'],
  [/compaction|packs it hard|hard/i, '🧱'],
  [/softer|soft/i, '🪶'],
  [/nitrogen|can\b|top-dress|fertili[sz]er/i, '🌱'],
  [/yield/i, '📈'],
  [/weeds?/i, '🌿'],
  // crops and care
  [/insecticide|pest|caterpillar|aphid/i, '🐛'],
  [/fungicide|rust|fungus/i, '🍄'],
  [/spray/i, '🧴'],
  [/water|irrigat|drain/i, '💧'],
  [/hoe|dig|cut/i, '⛏️'],
  [/hand|pick off/i, '✋'],
  [/remove|leaves/i, '🍂'],
  [/sun|panel/i, '☀️'],
  [/cow|milk/i, '🐄'],
  [/hen|egg|chicken|coop/i, '🐔'],
  [/vaccin|vet|medicine|treat/i, '💉'],
  [/clean|wash/i, '🧽'],
  [/feed|hay|grain/i, '🌾'],
];

/** A picture for an answer or a step, from its words; a plain dot when nothing matches. */
/** A fixed shuffle (the same every time, so a retry is fair). */
export function shuffled<T>(xs: T[], salt = 3): T[] {
  return xs.map((x, i) => ({ x, k: (i * 7 + salt * 5) % 11 })).sort((a, b) => a.k - b.k).map(o => o.x);
}

export function iconFor(text: string, fallback = '🔸') {
  for (const [re, icon] of ICONS) if (re.test(text)) return icon;
  return fallback;
}

/* ---------------- confetti ---------------- */

const COLOURS = ['#ffae00', '#2f9b14', '#22ade2', '#e8742a', '#d9473a', '#ffd25c', '#7ccf5a'];

/** A burst of confetti from the middle of its box; re-key it to fire again. */
export function Confetti({ n = 26, spread = 1, className = '' }: { n?: number; spread?: number; className?: string }) {
  return (
    <span className={`fun-confetti ${className}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 3) * 0.3;
        const r = (60 + ((i * 37) % 70)) * spread;
        return (
          <i
            key={i}
            style={{
              ['--dx' as string]: `${Math.round(Math.cos(a) * r)}px`,
              ['--dy' as string]: `${Math.round(Math.sin(a) * r * 0.75 - 30)}px`,
              ['--rot' as string]: `${(i * 97) % 360}deg`,
              background: COLOURS[i % COLOURS.length],
              animationDelay: `${(i % 5) * 0.02}s`,
              borderRadius: i % 4 === 0 ? '50%' : '2px',
            }}
          />
        );
      })}
    </span>
  );
}

/** Words that float up and fade: "+1", "Right!", "🔥 3 in a row". Re-key it to show again. */
export function FloatUp({ children, tone = 'good' }: { children: ReactNode; tone?: 'good' | 'bad' | 'gold' }) {
  return (
    <span className={`fun-float is-${tone}`} aria-hidden="true">
      {children}
    </span>
  );
}

/* ---------------- the coach ---------------- */

export type Mood = 'idle' | 'happy' | 'sad' | 'think' | 'cheer';

/** The coach, in a work cap: smiles at a right answer, winces at a wrong one, cheers a win. */
export function Coach({ mood = 'idle', size = 64 }: { mood?: Mood; size?: number }) {
  const happy = mood === 'happy' || mood === 'cheer';
  return (
    <svg viewBox="0 0 80 90" width={size} height={size * 1.125} className={`fun-coach is-${mood}`} aria-hidden="true">
      <ellipse cx={40} cy={86} rx={22} ry={4} fill="rgba(0,0,0,0.15)" />
      {/* body: overalls */}
      <path d="M18 88 Q18 60 40 58 Q62 60 62 88 Z" fill="#2b8a4a" />
      <rect x={30} y={62} width={20} height={16} rx={3} fill="#237a3f" />
      <circle cx={33} cy={66} r={1.6} fill="#ffd25c" />
      <circle cx={47} cy={66} r={1.6} fill="#ffd25c" />
      {/* arms */}
      {mood === 'cheer' ? (
        <>
          <path d="M20 66 L8 44" stroke="#8a5634" strokeWidth={7} strokeLinecap="round" />
          <path d="M60 66 L72 44" stroke="#8a5634" strokeWidth={7} strokeLinecap="round" />
        </>
      ) : mood === 'think' ? (
        <>
          <path d="M21 70 L16 84" stroke="#8a5634" strokeWidth={7} strokeLinecap="round" />
          <path d="M59 68 Q66 56 52 50" stroke="#8a5634" strokeWidth={7} strokeLinecap="round" fill="none" />
        </>
      ) : (
        <>
          <path d="M21 70 L16 84" stroke="#8a5634" strokeWidth={7} strokeLinecap="round" />
          <path d="M59 70 L64 84" stroke="#8a5634" strokeWidth={7} strokeLinecap="round" />
        </>
      )}
      {/* head */}
      <circle cx={40} cy={36} r={19} fill="#8a5634" />
      <ellipse cx={22} cy={38} rx={3} ry={4.5} fill="#7a4a2c" />
      <ellipse cx={58} cy={38} rx={3} ry={4.5} fill="#7a4a2c" />
      {/* cap */}
      <path d="M21 30 Q22 14 40 14 Q58 14 59 30 Z" fill="#ffae00" />
      <rect x={36} y={18} width={8} height={5} rx={1.5} fill="#fff" opacity={0.85} />
      <path d="M21 30 Q12 31 10 34 L30 32 Z" fill="#c88900" />
      {/* eyes */}
      {happy ? (
        <>
          <path d="M31 37 q3 -4 6 0" stroke="#2a1a10" strokeWidth={2.2} fill="none" strokeLinecap="round" />
          <path d="M43 37 q3 -4 6 0" stroke="#2a1a10" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        </>
      ) : mood === 'sad' ? (
        <>
          <path d="M31 35 l6 2" stroke="#2a1a10" strokeWidth={2.2} strokeLinecap="round" />
          <path d="M49 35 l-6 2" stroke="#2a1a10" strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={34} cy={39} r={2} fill="#2a1a10" />
          <circle cx={46} cy={39} r={2} fill="#2a1a10" />
        </>
      ) : (
        <>
          <circle cx={34} cy={37} r={2.4} fill="#2a1a10" />
          <circle cx={46} cy={37} r={2.4} fill="#2a1a10" />
          <circle cx={34.8} cy={36.2} r={0.8} fill="#fff" />
          <circle cx={46.8} cy={36.2} r={0.8} fill="#fff" />
        </>
      )}
      <circle cx={29} cy={43} r={2.6} fill="#e8742a" opacity={happy ? 0.55 : 0.25} />
      <circle cx={51} cy={43} r={2.6} fill="#e8742a" opacity={happy ? 0.55 : 0.25} />
      {/* mouth */}
      {happy ? <path d="M33 45 Q40 53 47 45 Z" fill="#5a1d10" /> : mood === 'sad' ? <path d="M34 49 Q40 44 46 49" stroke="#5a1d10" strokeWidth={2.2} fill="none" strokeLinecap="round" /> : mood === 'think' ? <path d="M36 47 h7" stroke="#5a1d10" strokeWidth={2.2} strokeLinecap="round" /> : <path d="M35 46 Q40 50 45 46" stroke="#5a1d10" strokeWidth={2.2} fill="none" strokeLinecap="round" />}
      {mood === 'think' && (
        <g className="fun-think">
          <circle cx={66} cy={22} r={2} fill="#fff" />
          <circle cx={71} cy={14} r={3} fill="#fff" />
          <text x={71} y={17} fontSize={6} textAnchor="middle" fill="#6b402b" fontWeight={800}>
            ?
          </text>
        </g>
      )}
    </svg>
  );
}

/** The coach with something to say. */
export function CoachSays({ mood, children, size = 58 }: { mood?: Mood; children: ReactNode; size?: number }) {
  return (
    <div className="fun-says">
      <Coach mood={mood} size={size} />
      <p className="fun-bubble">{children}</p>
    </div>
  );
}

/* ---------------- pictures for the tractor lessons ---------------- */

export type ArtId = 'pto' | 'linkage' | 'radiator' | 'slope' | 'getoff' | 'rider' | 'wetsoil' | 'deep' | 'tyre';

/** A small side-on tractor, for the lesson pictures. */
function MiniTractor({ x = 0, y = 0, s = 1, tilt = 0, hi }: { x?: number; y?: number; s?: number; tilt?: number; hi?: 'pto' | 'linkage' | 'radiator' | 'tyre' }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${tilt}) scale(${s})`}>
      <rect x={-44} y={-30} width={60} height={22} rx={5} fill="#2b8a4a" />
      <rect x={4} y={-58} width={30} height={34} rx={4} fill="#2b8a4a" stroke="#1d5e33" strokeWidth={2} />
      <rect x={9} y={-53} width={20} height={16} rx={3} fill="#bfe3f2" />
      <rect x={-38} y={-40} width={5} height={12} fill="#555" />
      {/* radiator grille at the front */}
      <rect x={-48} y={-28} width={7} height={18} rx={2} fill={hi === 'radiator' ? '#ffd25c' : '#1d5e33'} className={hi === 'radiator' ? 'fun-hi' : ''} />
      <circle cx={-30} cy={-4} r={13} fill="#2a2a2a" className={hi === 'tyre' ? 'fun-hi' : ''} />
      <circle cx={-30} cy={-4} r={5} fill="#f2c230" />
      <circle cx={22} cy={-12} r={20} fill="#2a2a2a" className={hi === 'tyre' ? 'fun-hi' : ''} />
      <circle cx={22} cy={-12} r={8} fill="#f2c230" />
      {/* linkage arms and PTO at the back */}
      <path d="M38 -16 L58 -8 M38 -26 L56 -18" stroke={hi === 'linkage' ? '#ffd25c' : '#777'} strokeWidth={4} strokeLinecap="round" className={hi === 'linkage' ? 'fun-hi' : ''} />
      <rect x={38} y={-15} width={22} height={4} rx={2} fill={hi === 'pto' ? '#ffd25c' : '#999'} className={hi === 'pto' ? 'fun-hi' : ''} />
    </g>
  );
}

const Sky = () => (
  <>
    <rect width={160} height={110} fill="#cfeaf6" />
    <circle cx={138} cy={18} r={9} fill="#ffd25c" />
  </>
);

/** A drawn picture for a lesson question. */
export function QuizArt({ art }: { art: ArtId }) {
  let body: ReactNode = null;
  switch (art) {
    case 'pto':
    case 'linkage':
    case 'radiator':
      body = (
        <>
          <Sky />
          <rect y={92} width={160} height={18} fill="#9a6b3e" />
          <MiniTractor x={66} y={92} s={1} hi={art} />
          {art !== 'radiator' && <rect x={128} y={76} width={26} height={14} rx={3} fill="#c0432f" />}
          <text x={art === 'radiator' ? 16 : 124} y={art === 'radiator' ? 48 : 60} fontSize={14} textAnchor="middle">
            👉
          </text>
        </>
      );
      break;
    case 'tyre':
      body = (
        <>
          <Sky />
          <rect y={86} width={160} height={24} fill="#7a4a24" />
          <ellipse cx={52} cy={86} rx={30} ry={6} fill="#2a2a2a" />
          <circle cx={52} cy={62} r={26} fill="#2a2a2a" className="fun-hi" />
          <circle cx={52} cy={62} r={10} fill="#f2c230" />
          <circle cx={118} cy={56} r={22} fill="#fff" stroke="#6b402b" strokeWidth={3} />
          <path d="M118 56 L106 66" stroke="#c0432f" strokeWidth={3} strokeLinecap="round" />
          <text x={118} y={44} fontSize={7} textAnchor="middle" fill="#6b402b" fontWeight={800}>
            PSI
          </text>
        </>
      );
      break;
    case 'slope':
      body = (
        <>
          <Sky />
          <path d="M0 110 L0 92 L160 40 L160 110 Z" fill="#7cb342" />
          <MiniTractor x={84} y={70} s={0.8} tilt={-18} />
          <text x={30} y={46} fontSize={17.5}>
            ⚠️
          </text>
        </>
      );
      break;
    case 'getoff':
      body = (
        <>
          <Sky />
          <rect y={92} width={160} height={18} fill="#9a6b3e" />
          <MiniTractor x={60} y={92} s={0.9} />
          <text x={128} y={62} fontSize={17.5} textAnchor="middle">
            🛑
          </text>
          <text x={128} y={88} fontSize={11} textAnchor="middle">
            🔑
          </text>
        </>
      );
      break;
    case 'rider':
      body = (
        <>
          <Sky />
          <rect y={92} width={160} height={18} fill="#9a6b3e" />
          <MiniTractor x={70} y={92} s={1} />
          <text x={86} y={46} fontSize={12.5} textAnchor="middle">
            🧑‍🌾
          </text>
          <text x={128} y={60} fontSize={17.5} textAnchor="middle">
            ☝️
          </text>
        </>
      );
      break;
    case 'wetsoil':
      body = (
        <>
          <rect width={160} height={110} fill="#9fb6c4" />
          {[20, 50, 80, 110, 140].map((x, i) => (
            <path key={x} d={`M${x} ${8 + (i % 2) * 8} l-4 10`} stroke="#fff" strokeWidth={2} strokeLinecap="round" opacity={0.8} />
          ))}
          <rect y={84} width={160} height={26} fill="#5a3a20" />
          <ellipse cx={50} cy={92} rx={20} ry={4} fill="#3e2714" />
          <ellipse cx={110} cy={92} rx={20} ry={4} fill="#3e2714" />
          <MiniTractor x={80} y={88} s={0.85} />
          <text x={140} y={36} fontSize={14} textAnchor="middle">
            🌧️
          </text>
        </>
      );
      break;
    case 'deep':
      body = (
        <>
          <Sky />
          <rect y={52} width={160} height={20} fill="#6b4320" />
          <rect y={72} width={160} height={38} fill="#b98a55" />
          <path d="M70 52 L74 98" stroke="#555" strokeWidth={5} strokeLinecap="round" />
          <path d="M74 98 L96 92" stroke="#555" strokeWidth={5} strokeLinecap="round" />
          <text x={124} y={92} fontSize={7} textAnchor="middle" fill="#5a3a20" fontWeight={800}>
            subsoil
          </text>
          <text x={124} y={66} fontSize={7} textAnchor="middle" fill="#fdedd4" fontWeight={800}>
            topsoil
          </text>
          <MiniTractor x={40} y={52} s={0.6} />
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 160 110" className="fun-art" aria-hidden="true">
      {body}
    </svg>
  );
}

/** A big picture for a question that has no drawing: its words' icon on a soft disc. */
export function IconArt({ icon }: { icon: string }) {
  return (
    <div className="fun-iconart" aria-hidden="true">
      <span>{icon}</span>
    </div>
  );
}
