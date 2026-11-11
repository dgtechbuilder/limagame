import { useEffect, useRef, useState } from 'react';
import { img } from '../assets';
import { GoldButton } from '../components/ui';
import { useVoice } from '../art/style';
import { speak } from '../speech';
import { photoByKey } from '../rounds/photos';
import { Field, FIELD_H, FIELD_W, FarmerFigure, Hut, Kale, Tree } from './art';
import { CallIcon } from './Review';
import { ksh, say, STORY, STORY_STEP_S, type Look, type StoryPage } from './data';
import { track } from './track';

/* The story so far: three pages between naming the farmer and the first walk, each with something to do.
   1 · the farmer bought this farm: they sign for it, and their name goes on the deed and the signpost
   2 · last season, replayed a step at a time (plant, look after the farm, harvest: each a button and a short timer),
       then the sum: spent − earned, and the = button shows the loss
   3 · what went wrong: tap each mistake to see what to do instead, then start with the maize.
   Next shows once a page's part is done; Skip story is always there. */

const ARMYWORM = photoByKey('armyworm/pests');

/** What the player has done on each page (kept while the story is open, so Previous doesn't undo it). */
interface Progress {
  signed: boolean;
  /** replay steps done: 0 to 3 */
  steps: number;
  /** the = button has been pressed */
  summed: boolean;
  /** page 3's mistakes turned over, by index */
  flipped: number[];
}

/** page: 0-based, kept in the game state so each page has its own address (#/story/2). */
export function Story({ name, look, page: at, onPage, onDone }: { name: string; look: Look; page: number; onPage: (page: number) => void; onDone: () => void }) {
  const i = Math.max(0, Math.min(STORY.length - 1, at));
  const page = STORY[i];
  const t = (line: string) => say(line, name);
  const last = i === STORY.length - 1;
  const [p, setP] = useState<Progress>({ signed: false, steps: 0, summed: false, flipped: [] });
  const set = (patch: Partial<Progress>) => setP(v => ({ ...v, ...patch }));
  /** the replay step whose timer is running, and when it started */
  const [running, setRunning] = useState<{ step: number; start: number } | null>(null);
  const voice = useVoice();
  const tell = (line: string) => voice && speak(line);

  useEffect(() => track('story_page', { page: page.id }), [page.id]);

  // Read aloud: the page's opening words
  useEffect(() => {
    tell([page.title, ...page.lines.map(t)].join(' '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, i]);

  // the replay's timer: a step's picture and words change when it is done
  useEffect(() => {
    if (!running) return;
    const id = window.setTimeout(() => {
      const step = page.replay?.[running.step];
      setRunning(null);
      set({ steps: running.step + 1 });
      track('story_step', { step: step?.id });
      if (step) tell(t(step.after));
    }, STORY_STEP_S * 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const ready = page.id === 'bought' ? p.signed : page.id === 'failed' ? p.summed : p.flipped.length === (page.mistakes?.length ?? 0);
  const waiting = page.id === 'bought' ? 'Sign for your farm to go on' : page.id === 'failed' ? (p.steps < 3 ? 'Play each step of last season' : 'Press = to see how it went') : 'Tap each mistake to go on';

  const next = () => (last ? (track('story_done'), onDone()) : onPage(i + 1));
  const skip = () => (track('story_skipped', { page: page.id }), onDone());

  return (
    <div className="abs fs-screen" style={{ inset: 0 }}>
      <div className="abs" style={{ inset: 0, background: 'rgba(20,30,12,0.5)' }} />
      <section className="fs-panel story-card" style={{ left: 40, top: 40, width: 794, height: 334 }} aria-label="The story so far" aria-roledescription="story">
        <div className="abs" style={{ left: 280, top: -22, width: 234, height: 58 }}>
          <img src={img.plank} alt="" width={234} height={58} />
          <h2 className="label abs story-title">{page.title}</h2>
        </div>
        <button type="button" className="story-skip" onClick={skip}>
          Skip story
        </button>

        <div key={page.id} className="story-art" aria-hidden="true">
          <StoryArt page={page} look={look} name={name} p={p} running={running?.step ?? null} />
          {page.id === 'failed' && (running?.step ?? p.steps) === 2 && ARMYWORM && (
            <>
              {/* a close look, in a real photo: the caterpillar in the leaf funnel */}
              <span className="story-zoom">
                <img src={ARMYWORM.url} alt="" draggable={false} />
              </span>
              <span className="story-credit">
                Photo: {ARMYWORM.author} · {ARMYWORM.license}
              </span>
            </>
          )}
        </div>

        <div key={`t-${page.id}`} className="story-text">
          {page.lines.map(l => (
            <p key={l}>{t(l)}</p>
          ))}
          {page.deed && <Deed deed={page.deed} name={name} signed={p.signed} onSign={() => (set({ signed: true }), track('story_signed'), tell(t(page.deed!.done)))} />}
          {page.replay && (
            <Replay
              page={page}
              name={name}
              steps={p.steps}
              running={running}
              summed={p.summed}
              onStep={k => setRunning({ step: k, start: performance.now() })}
              onSum={() => (set({ summed: true }), track('story_sum'), tell(`${page.sum!.done} ${ksh(page.ledger![2].ksh)} lost.`))}
            />
          )}
          {page.mistakes && (
            <>
              <p className="story-hint">{page.tapHint}</p>
              <ol className="story-mistakes">
                {page.mistakes.map((m, k) => {
                  const open = p.flipped.includes(k);
                  return (
                    <li key={m.what}>
                      <button
                        type="button"
                        className={`story-flip${open ? ' is-open' : ''}`}
                        aria-expanded={open}
                        onClick={() => {
                          if (open) return;
                          set({ flipped: [...p.flipped, k] });
                          tell(`${m.what} ${m.lesson}`);
                        }}
                      >
                        <span className="story-icon">
                          <CallIcon id={m.icon} />
                        </span>
                        <span>
                          <s>{m.what}</s>
                          {open ? <b>{m.lesson}</b> : <i>Tap to see what to do instead</i>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        <div className="story-foot">
          <div className="story-dots" aria-label={`Page ${i + 1} of ${STORY.length}`} role="img">
            {STORY.map((q, k) => (
              <span key={q.id} className={k === i ? 'is-on' : k < i ? 'is-done' : ''} />
            ))}
          </div>
          {i > 0 && (
            <button type="button" className="story-back" onClick={() => onPage(i - 1)}>
              Previous
            </button>
          )}
          {ready ? (
            <GoldButton font={13} height={40} style={{ minWidth: last ? 210 : 140, padding: '0 18px' }} onClick={next} ariaLabel={page.button}>
              {page.button}
            </GoldButton>
          ) : (
            <span className="story-wait">{waiting}</span>
          )}
        </div>
      </section>
    </div>
  );
}

/* ---------------- page 1: sign for the farm ---------------- */

function Deed({ deed, name, signed, onSign }: { deed: NonNullable<StoryPage['deed']>; name: string; signed: boolean; onSign: () => void }) {
  // the name is written a letter at a time, as if by hand
  const [shown, setShown] = useState(signed ? name.length : 0);
  useEffect(() => {
    if (!signed || shown >= name.length) return;
    const id = window.setTimeout(() => setShown(n => n + 1), 90);
    return () => window.clearTimeout(id);
  }, [signed, shown, name.length]);
  return (
    <div className={`story-deed${signed ? ' is-signed' : ''}`}>
      <span className="story-deed-title">{deed.title}</span>
      <span className="story-deed-line">
        <i>{deed.owner}</i>
        <b className="story-sign" aria-label={signed ? name : 'not signed yet'}>
          {name.slice(0, shown)}
          {signed && shown < name.length && <span className="story-pen" aria-hidden="true" />}
        </b>
      </span>
      {signed ? (
        <span className="story-deed-done">{say(deed.done, name)}</span>
      ) : (
        <button type="button" className="story-do" onClick={onSign}>
          ✍ {deed.button}
        </button>
      )}
    </div>
  );
}

/* ---------------- page 2: last season, a step at a time, then the sum ---------------- */

function Replay({
  page,
  name,
  steps,
  running,
  summed,
  onStep,
  onSum,
}: {
  page: StoryPage;
  name: string;
  steps: number;
  running: { step: number; start: number } | null;
  summed: boolean;
  onStep: (k: number) => void;
  onSum: () => void;
}) {
  const replay = page.replay!;
  const [spent, earned, lost] = page.ledger!;
  const now = useNow(!!running);
  const caption = running ? replay[running.step].doing : steps > 0 ? say(replay[steps - 1].after, name) : '';
  return (
    <div className="story-replay">
      <ol className="story-steps">
        {replay.map((st, k) => {
          const done = k < steps;
          const on = running?.step === k;
          const turn = !running && k === steps;
          const frac = on ? Math.min(1, (now - running!.start) / (STORY_STEP_S * 1000)) : 0;
          return (
            <li key={st.id}>
              <button type="button" className={`story-step${done ? ' is-done' : ''}${turn ? ' is-turn' : ''}${on ? ' is-on' : ''}`} disabled={!turn} onClick={() => onStep(k)}>
                {on ? <Ring frac={frac} /> : <span className="story-step-n">{done ? '✓' : k + 1}</span>}
                {st.button}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="story-caption" aria-live="polite">
        {caption}
      </p>
      {steps >= 1 && (
        <div className="story-sum" aria-label="The season's sum">
          <span className="is-out">
            <small>Spent</small>
            {ksh(spent.ksh)}
          </span>
          <b aria-hidden="true">−</b>
          <span className={`is-in${steps >= 3 ? '' : ' is-wait'}`}>
            <small>Earned</small>
            {steps >= 3 ? ksh(earned.ksh) : '?'}
          </span>
          {summed ? (
            <>
              <b aria-hidden="true">=</b>
              <span className="is-lost">
                <small>Lost</small>
                <Count to={lost.ksh} />
              </span>
            </>
          ) : (
            <button type="button" className="story-equals" disabled={steps < 3} onClick={onSum} aria-label="Equals: see how the season went">
              =
            </button>
          )}
        </div>
      )}
      {steps >= 3 && !summed && <p className="story-hint">{page.sum!.ask}</p>}
      {summed && <p className="story-hint is-lost">{page.sum!.done}</p>}
    </div>
  );
}

/** A clock that ticks every frame while on (for the replay's timer ring). */
function useNow(on: boolean) {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return now;
}

/** The timer on a replay step: a ring that fills. */
function Ring({ frac }: { frac: number }) {
  const R = 8;
  const L = 2 * Math.PI * R;
  return (
    <svg className="story-ring" viewBox="-11 -11 22 22" width={22} height={22} role="timer" aria-label="Working">
      <circle r={R} fill="#fff" stroke="#f1e2c8" strokeWidth={3.5} />
      <circle r={R} fill="none" stroke="#f39c12" strokeWidth={3.5} strokeDasharray={`${L * frac} ${L}`} transform="rotate(-90)" />
    </svg>
  );
}

/** The loss, counted up from nothing. */
function Count({ to }: { to: number }) {
  const [n, setN] = useState(0);
  const start = useRef(performance.now());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const f = Math.min(1, (performance.now() - start.current) / 900);
      setN(Math.round((to * (1 - Math.pow(1 - f, 3))) / 100) * 100);
      if (f < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <>{ksh(n)}</>;
}

/* ---------------- the pictures ---------------- */

/** One picture per page, drawn in SVG with the first session's own art (300 × 220). It follows what the player has done. */
function StoryArt({ page, look, name, p, running }: { page: StoryPage; look: Look; name: string; p: Progress; running: number | null }) {
  if (page.id === 'bought')
    return (
      <svg viewBox="0 0 300 220" width={300} height={220}>
        <defs>
          <linearGradient id="story-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9fd6ee" />
            <stop offset="1" stopColor="#e9f4dc" />
          </linearGradient>
        </defs>
        <rect width={300} height={220} fill="url(#story-sky)" />
        <circle cx={250} cy={40} r={20} fill="#ffd45a" />
        <path d="M0,120 Q80,100 160,116 T300,108 L300,220 L0,220 Z" fill="#8cc163" />
        <path d="M0,150 Q120,134 300,148 L300,220 L0,220 Z" fill="#a8743f" />
        {[0, 1, 2].map(r => (
          <path key={r} d={`M10,${166 + r * 18} Q150,${158 + r * 18} 290,${166 + r * 18}`} stroke="#7d5229" strokeWidth={3} fill="none" opacity={0.6} />
        ))}
        <Tree x={32} y={118} s={0.95} />
        <Hut x={228} y={128} s={1.1} />
        {/* the water tank */}
        <g transform="translate(278,130)">
          <rect x={-12} y={-34} width={24} height={34} rx={4} fill="#2b7fb8" />
          <path d="M-12,-24 H12 M-12,-14 H12" stroke="#1d5f8c" strokeWidth={1.4} />
          <ellipse cx={0} cy={-34} rx={12} ry={3} fill="#3a93cf" />
        </g>
        {/* the signpost: blank until the farmer signs, then their name and SOLD */}
        <g transform="translate(86,154)">
          <rect x={-2.5} y={-46} width={5} height={46} fill="#6a4a2a" />
          <rect x={-46} y={-62} width={92} height={22} rx={3} fill="#f7e2b8" stroke="#8a5a30" strokeWidth={1.6} />
          <text x={0} y={-47} textAnchor="middle" fontSize={11} fontWeight={700} fill={p.signed ? '#6b402b' : '#b8a07a'}>
            {p.signed ? (name.length > 9 ? 'My farm' : `${name}'s farm`) : 'FOR SALE'}
          </text>
          {p.signed && (
            <g transform="rotate(-8)" className="story-pop">
              <rect x={-6} y={-40} width={40} height={14} rx={2} fill="#c0392b" />
              <text x={14} y={-30} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff" letterSpacing={1}>
                SOLD
              </text>
            </g>
          )}
        </g>
        <g transform="translate(172,198) scale(1.15)">
          <FarmerFigure look={look} pose={p.signed ? 'cheer' : 'stand'} />
        </g>
      </svg>
    );

  if (page.id === 'failed') {
    // the field as the replay has reached it: bare, sown, neglected, harvested
    const stage = running !== null ? running : p.steps;
    return (
      <svg viewBox="0 0 300 220" width={300} height={220}>
        <rect width={300} height={220} fill="#e7d7b2" />
        <rect width={300} height={70} fill="#d9cfa8" />
        {stage === 0 && <BareField />}
        {stage === 1 && <Sprouts />}
        {stage === 2 && (
          <>
            <svg x={0} y={40} width={300} height={180} viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} preserveAspectRatio="xMidYMid slice">
              <Field crop="maize" cond="armyworm" problemRows={[0, 1, 2, 3, 4]} rows={5} seed={7} />
            </svg>
            {/* the sukuma wiki at the back, dry */}
            {[24, 52, 80].map((x, k) => (
              <Kale key={x} x={x} y={74} s={0.55} cond="drought" seed={k + 4} bg="#d9cfa8" />
            ))}
          </>
        )}
        {stage >= 3 && <Harvested />}
        {stage === 2 && <path d="M206,92 L184,116" stroke="#8a5a30" strokeWidth={5} strokeLinecap="round" />}
        {running !== null && <rect width={300} height={220} fill="#fff" opacity={0.18} className="story-working" />}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 300 220" width={300} height={220}>
      <rect width={300} height={220} fill="#eaf3dc" />
      <svg x={0} y={60} width={300} height={160} viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} preserveAspectRatio="xMidYMid slice">
        <Field crop="maize" cond="armyworm" problemRows={[]} rows={5} seed={3} />
      </svg>
      {/* the farmer with a notebook: each lesson is ticked as it is turned over */}
      <g transform="translate(92,200) scale(1.3)">
        <FarmerFigure look={look} />
      </g>
      <g transform="translate(180,40) rotate(4)">
        <rect x={0} y={0} width={96} height={112} rx={6} fill="#fffaf0" stroke="#8a5a30" strokeWidth={2} />
        <rect x={0} y={0} width={96} height={18} rx={6} fill="#c98d55" />
        <text x={48} y={13} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">
          THIS SEASON
        </text>
        {['Check often', 'Water by the soil', 'Time the sale'].map((l, k) => (
          <g key={l} transform={`translate(8,${34 + k * 28})`}>
            {p.flipped.includes(k) ? (
              <path className="story-pop" d="M0,0 L4,5 L11,-5" stroke="#2f9b14" strokeWidth={2.4} fill="none" strokeLinecap="round" />
            ) : (
              <rect x={0} y={-6} width={11} height={11} rx={2} fill="none" stroke="#c9b18a" strokeWidth={1.5} />
            )}
            <text x={15} y={4} fontSize={8.2} fontWeight={600} fill={p.flipped.includes(k) ? '#6b402b' : '#b8a07a'}>
              {l}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Rows of dug soil, nothing planted yet. */
function BareField() {
  return (
    <g>
      <path d="M40,58 L260,58 L298,220 L2,220 Z" fill="#8a5a34" />
      {[0, 1, 2, 3, 4].map(r => {
        const y = 78 + r * 30;
        const w = 110 + r * 26;
        return <path key={r} d={`M${150 - w},${y} L${150 + w},${y}`} stroke="#6b4226" strokeWidth={6 + r} strokeLinecap="round" />;
      })}
    </g>
  );
}

/** Just sown: small green shoots in the rows. */
function Sprouts() {
  return (
    <g>
      <BareField />
      {[0, 1, 2, 3, 4].map(r => {
        const y = 76 + r * 30;
        const w = 100 + r * 26;
        const s = 0.6 + r * 0.12;
        return Array.from({ length: 9 }, (_, k) => {
          const x = 150 - w + (k / 8) * 2 * w;
          return (
            <g key={`${r}-${k}`} transform={`translate(${x},${y}) scale(${s})`} className="story-pop">
              <path d="M0,0 Q-6,-8 -9,-12 M0,0 Q5,-9 9,-13 M0,0 L0,-6" stroke="#5fbf3a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
            </g>
          );
        });
      })}
    </g>
  );
}

/** After the harvest: stubble in the rows and a small pile to sell. */
function Harvested() {
  return (
    <g>
      <BareField />
      {[0, 1, 2, 3, 4].map(r => {
        const y = 76 + r * 30;
        const w = 100 + r * 26;
        return Array.from({ length: 9 }, (_, k) => {
          const x = 150 - w + (k / 8) * 2 * w;
          return <path key={`${r}-${k}`} d={`M${x},${y} L${x},${y - 6 - r}`} stroke="#c9a85c" strokeWidth={2.5 + r * 0.4} strokeLinecap="round" />;
        });
      })}
      {/* the harvest: one small sack and a few cobs */}
      <g transform="translate(150,40)" className="story-pop">
        <rect x={-62} y={-24} width={124} height={26} rx={13} fill="#fff8ec" stroke="#8a6a3a" strokeWidth={1.5} />
        <text y={-6} textAnchor="middle" fontSize={11} fontWeight={800} fill="#6b402b">
          The whole harvest
        </text>
      </g>
      <g transform="translate(232,182)" className="story-pop">
        <ellipse cy={2} rx={34} ry={6} fill="rgba(0,0,0,0.2)" />
        {/* a half-full sack, tied at the neck */}
        <path d="M-18,0 Q-24,-22 -12,-30 Q0,-34 12,-30 Q24,-22 18,0 Z" fill="#c8a46a" stroke="#7a5a2a" strokeWidth={2} />
        <path d="M-12,-30 Q0,-24 12,-30" fill="none" stroke="#7a5a2a" strokeWidth={2} />
        <path d="M-6,-31 L-9,-40 M6,-31 L9,-40" stroke="#7a5a2a" strokeWidth={2} strokeLinecap="round" />
        <path d="M-10,-14 H10 M-12,-6 H12" stroke="#a8844a" strokeWidth={1.2} />
        {[-30, -22, 28].map((x, k) => (
          <ellipse key={x} cx={x} cy={-4 - (k % 2) * 3} rx={4} ry={9} transform={`rotate(${-35 + k * 30} ${x} ${-4 - (k % 2) * 3})`} fill="#f2c230" stroke="#b8901a" strokeWidth={1} />
        ))}
      </g>
    </g>
  );
}
