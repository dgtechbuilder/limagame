import { useEffect, useRef, useState } from 'react';
import { img } from '../assets';
import { GoldButton } from '../components/ui';
import { CloseX } from '../components/Success';
import { useVoice } from '../art/style';
import { speak } from '../speech';
import { photoByKey, photoSrc } from '../rounds/photos';
import { Field, FIELD_H, FIELD_W, FarmerFigure, Hut, Kale, Tree } from './art';
import { CallIcon } from './Review';
import { ksh, say, STORY, STORY_CHORE_S, STORY_STEP_S, type Cheer, type Look, type StoryChore, type StoryPage } from './data';
import { track } from './track';
import { sfx } from '../sfx';

/* The story so far: three pages between naming the farmer and the first walk, each with something to do.
   1 · the farmer bought this farm: they sign for it, and their name goes on the deed and the signpost; then they give
       the first morning's work: dig the soil and water the seedlings for the crops, feed the cows, collect the eggs
   2 · last season, replayed a step at a time (plant, look after the farm, harvest: each a button and a short timer),
       then the sum: spent − earned, and the = button shows the loss
   3 · what went wrong: tap each mistake to see what to do instead, then start with the maize.
   Each action ends with a pop-up (Congratulations, Well done, Good job…) and Continue. Next shows once a page's part
   is done; Skip story is always there. */

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
  /** page 2's planting: the beds sown so far */
  sown: Seed[];
  /** page 1's morning work: the jobs done so far */
  cared: StoryChore['id'][];
}

/** The two seeds the farmer plants by hand on page 2. */
type Seed = 'maize' | 'kale';
const SEEDS: { id: Seed; name: string; bed: string }[] = [
  { id: 'maize', name: 'Maize seeds', bed: 'Maize bed' },
  { id: 'kale', name: 'Sukuma seeds', bed: 'Sukuma bed' },
];

/** page: 0-based, kept in the game state so each page has its own address (#/story/2). */
export function Story({ name, look, page: at, onPage, onDone }: { name: string; look: Look; page: number; onPage: (page: number) => void; onDone: () => void }) {
  const i = Math.max(0, Math.min(STORY.length - 1, at));
  const page = STORY[i];
  const t = (line: string) => say(line, name);
  const last = i === STORY.length - 1;
  const [p, setP] = useState<Progress>({ signed: false, steps: 0, summed: false, flipped: [], sown: [], cared: [] });
  const set = (patch: Partial<Progress>) => setP(v => ({ ...v, ...patch }));
  /** the replay step whose timer is running, and when it started */
  const [running, setRunning] = useState<{ step: number; start: number } | null>(null);
  /** page 1: the morning job whose timer is running */
  const [caring, setCaring] = useState<StoryChore['id'] | null>(null);
  /** planting by hand: on while the player sows, and the bunch of seeds in their hand */
  const [planting, setPlanting] = useState(false);
  const [holding, setHolding] = useState<Seed | null>(null);
  /** the pop-up after an action, until Continue */
  const [cheer, setCheer] = useState<Cheer | null>(null);
  const voice = useVoice();
  const tell = (line: string) => voice && speak(line);
  const celebrate = (c: Cheer) => {
    sfx.action();
    setCheer(c);
    tell(`${t(c.title)} ${t(c.line)}`);
  };

  useEffect(() => track('story_page', { page: page.id }), [page.id]);

  // both beds sown: a moment to see the seed land, then the step is done
  useEffect(() => {
    if (!planting || p.sown.length < SEEDS.length) return;
    const id = window.setTimeout(() => {
      const step = page.replay?.[0];
      setPlanting(false);
      set({ steps: 1 });
      track('story_step', { step: step?.id });
      if (step) celebrate(step.cheer);
    }, 700);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planting, p.sown.length]);

  /** tap a bunch of seeds to pick it up; tap its bed to sow it */
  const pickSeed = (seed: Seed) => {
    if (p.sown.includes(seed)) return;
    setHolding(seed);
  };
  const sowBed = (seed: Seed) => {
    if (holding !== seed || p.sown.includes(seed)) return;
    setHolding(null);
    set({ sown: [...p.sown, seed] });
    track('story_sow', { seed });
    sfx.action();
  };

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
      if (step) celebrate(step.cheer);
    }, STORY_STEP_S * 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // page 1's morning work: each job runs a short timer, and the last one ends with a pop-up
  useEffect(() => {
    if (!caring) return;
    const id = window.setTimeout(() => {
      const cared = [...p.cared, caring];
      setCaring(null);
      set({ cared });
      track('story_care', { job: caring });
      sfx.action();
      if (page.morning && cared.length === page.morning.chores.length) celebrate(page.morning.cheer);
    }, STORY_CHORE_S * 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caring]);
  const caredAll = !page.morning || p.cared.length >= page.morning.chores.length;

  const ready = !cheer && (page.id === 'bought' ? p.signed && caredAll : page.id === 'failed' ? p.summed : p.flipped.length === (page.mistakes?.length ?? 0));
  const waiting = page.id === 'bought' ? (p.signed ? 'Do the morning work to go on' : 'Sign for your farm to go on') : page.id === 'failed' ? (p.steps < 3 ? 'Play each step of last season' : 'Press = to see how it went') : 'Tap each mistake to go on';

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
          <StoryArt page={page} look={look} name={name} p={p} running={running?.step ?? null} planting={planting} holding={holding} caring={caring} />
          {page.id === 'failed' && (running?.step ?? p.steps) === 2 && ARMYWORM && (
            <>
              {/* a close look, in a real photo: the caterpillar in the leaf funnel */}
              <span className="story-zoom">
                <img src={photoSrc(ARMYWORM)} alt="" draggable={false} />
              </span>
              <span className="story-credit">
                Photo: {ARMYWORM.author} · {ARMYWORM.license}
              </span>
            </>
          )}
        </div>

        {page.id === 'failed' && planting && (
          <div className="story-plant" role="group" aria-label="Plant the season by hand">
            {SEEDS.map(sd => {
              const sown = p.sown.includes(sd.id);
              return (
                <button
                  key={`bed-${sd.id}`}
                  type="button"
                  className={`story-bed is-${sd.id}${holding === sd.id ? ' is-ready' : ''}${sown ? ' is-sown' : ''}`}
                  aria-label={sown ? `${sd.bed}: sown` : `${sd.bed}: tap to sow`}
                  disabled={sown}
                  onClick={() => sowBed(sd.id)}
                >
                  {!sown && <span>{sd.bed}</span>}
                </button>
              );
            })}
            {SEEDS.map(sd => {
              const sown = p.sown.includes(sd.id);
              const turn = !sown && p.sown.length === SEEDS.findIndex(x => x.id === sd.id);
              return (
                <button
                  key={`seed-${sd.id}`}
                  type="button"
                  className={`story-seed is-${sd.id}${holding === sd.id ? ' is-held' : ''}${turn && !holding ? ' is-turn' : ''}${sown ? ' is-used' : ''}`}
                  aria-label={sd.name}
                  aria-pressed={holding === sd.id}
                  disabled={sown || !turn}
                  onClick={() => pickSeed(sd.id)}
                >
                  <SeedBunch seed={sd.id} />
                  <small>{sown ? 'Sown ✓' : sd.name}</small>
                </button>
              );
            })}
          </div>
        )}

        <div key={`t-${page.id}`} className="story-text">
          {page.lines.map(l => (
            <p key={l}>{t(l)}</p>
          ))}
          {page.deed && <Deed deed={page.deed} name={name} signed={p.signed} compact={p.signed && !!page.morning} onSign={() => (set({ signed: true }), track('story_signed'), celebrate(page.deed!.cheer))} />}
          {page.morning && p.signed && !(cheer && p.cared.length === 0) && (
            <div className="story-care" role="group" aria-label="Morning work on the farm">
              <p className="story-hint">{page.morning.intro}</p>
              <div className="story-care-row">
                {page.morning.chores.map(c => {
                  const done = p.cared.includes(c.id);
                  const on = caring === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`story-step story-chore${done ? ' is-done' : ''}${on ? ' is-on' : ''}${!done && !on && !caring && !cheer ? ' is-turn' : ''}`}
                      disabled={done || !!caring || !!cheer}
                      onClick={() => setCaring(c.id)}
                      aria-label={done ? `${c.button}: done` : c.button}
                    >
                      {on ? <ChoreRing /> : <span className="story-step-n" aria-hidden="true">{done ? '✓' : c.icon}</span>}
                      {on ? c.doing : done ? c.done : c.button}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {page.replay && (
            <Replay
              page={page}
              name={name}
              steps={p.steps}
              running={running}
              planting={planting ? (p.sown.includes('maize') ? 'kale' : 'maize') : null}
              paused={!!cheer}
              summed={p.summed}
              onStep={k => (page.replay![k].plant ? (setPlanting(true), setHolding(null), set({ sown: [] })) : setRunning({ step: k, start: performance.now() }))}
              onSum={() => (set({ summed: true }), track('story_sum'), sfx.action(), tell(`${page.sum!.done} ${ksh(page.ledger![2].ksh)} lost.`))}
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
            !cheer && <span className="story-wait">{waiting}</span>
          )}
        </div>

        {cheer && (
          <div className="story-cheer" role="dialog" aria-modal="true" aria-label={t(cheer.title)}>
            <div className="story-cheer-card">
              <CloseX onClick={() => (setCheer(null), track('story_cheer', { title: cheer.title }))} />
              <Burst />
              <p className="story-cheer-title">{t(cheer.title)}</p>
              <p className="story-cheer-line">{t(cheer.line)}</p>
              <GoldButton font={13} height={38} style={{ minWidth: 170, marginTop: 6 }} onClick={() => (setCheer(null), track('story_cheer', { title: cheer.title }))} ariaLabel="Continue">
                Continue
              </GoldButton>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

/* ---------------- page 1: sign for the farm ---------------- */

function Deed({ deed, name, signed, compact, onSign }: { deed: NonNullable<StoryPage['deed']>; name: string; signed: boolean; compact?: boolean; onSign: () => void }) {
  // the name is written a letter at a time, as if by hand
  const [shown, setShown] = useState(signed ? name.length : 0);
  useEffect(() => {
    if (!signed || shown >= name.length) return;
    const id = window.setTimeout(() => setShown(n => n + 1), 90);
    return () => window.clearTimeout(id);
  }, [signed, shown, name.length]);
  return (
    <div className={`story-deed${signed ? ' is-signed' : ''}${compact ? ' is-compact' : ''}`}>
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
  planting,
  paused,
  summed,
  onStep,
  onSum,
}: {
  page: StoryPage;
  name: string;
  steps: number;
  running: { step: number; start: number } | null;
  /** planting by hand: the seed to sow next, or null */
  planting: Seed | null;
  /** a pop-up is open: the next step waits for Continue */
  paused: boolean;
  summed: boolean;
  onStep: (k: number) => void;
  onSum: () => void;
}) {
  const replay = page.replay!;
  const [spent, earned, lost] = page.ledger!;
  const now = useNow(!!running);
  // once the financial result shows, the steps' words give way to it
  const caption = planting ? replay[0].plant![planting] : running ? replay[running.step].doing : steps > 0 && (steps < 3 || paused) ? say(replay[steps - 1].after, name) : '';
  return (
    <div className="story-replay">
      <ol className="story-steps">
        {replay.map((st, k) => {
          const done = k < steps;
          const on = running?.step === k || (!!planting && k === 0);
          const turn = !running && !planting && !paused && k === steps;
          const frac = running?.step === k ? Math.min(1, (now - running.start) / (STORY_STEP_S * 1000)) : 0;
          return (
            <li key={st.id}>
              <button type="button" className={`story-step${done ? ' is-done' : ''}${turn ? ' is-turn' : ''}${on ? ' is-on' : ''}`} disabled={!turn} onClick={() => onStep(k)}>
                {on && !planting ? <Ring frac={frac} /> : <span className="story-step-n">{done ? '✓' : k + 1}</span>}
                {st.button}
              </button>
            </li>
          );
        })}
      </ol>
      {caption && (
        <p className="story-caption" aria-live="polite">
          {caption}
        </p>
      )}
      {/* after the harvest and its pop-up: the season's financial result */}
      {steps >= 3 && !paused && <p className="story-sum-title">{page.sum!.title}</p>}
      {steps >= 3 && !paused && (
        <div className="story-sum" aria-label="The season's sum">
          <span className="is-out">
            <small>Spent</small>
            {ksh(spent.ksh)}
          </span>
          <b aria-hidden="true">−</b>
          <span className="is-in">
            <small>Earned</small>
            {ksh(earned.ksh)}
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
            <button type="button" className="story-equals" onClick={onSum} aria-label="Equals: see how the season went">
              =
            </button>
          )}
        </div>
      )}
      {steps >= 3 && !paused && !summed && <p className="story-hint">{page.sum!.ask}</p>}
      {summed && <p className="story-hint is-lost">{page.sum!.done}</p>}
    </div>
  );
}

/** The timer on one of the morning jobs: a ring that fills. */
function ChoreRing() {
  const start = useRef(performance.now());
  const now = useNow(true);
  return <Ring frac={Math.min(1, (now - start.current) / (STORY_CHORE_S * 1000))} />;
}

/** Stars bursting out behind a pop-up's title. */
function Burst() {
  return (
    <svg className="story-burst" viewBox="-60 -60 120 120" width={120} height={120} aria-hidden="true">
      {Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2;
        const r = k % 2 ? 44 : 52;
        return (
          <path
            key={k}
            d="M0,-6 L1.8,-1.8 L6,0 L1.8,1.8 L0,6 L-1.8,1.8 L-6,0 L-1.8,-1.8 Z"
            transform={`translate(${Math.cos(a) * r},${Math.sin(a) * r}) scale(${k % 2 ? 0.8 : 1.2})`}
            fill={['#e6a71e', '#449224', '#cb715f', '#48bca9'][k % 4]}
          />
        );
      })}
      <circle r={26} fill="#edc75f" stroke="#fbf8ee" strokeWidth={4} />
      <path d="M-11,1 L-3,9 L12,-8" stroke="#fbf8ee" strokeWidth={5.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
      <circle r={R} fill="#fbf8ee" stroke="#ede1cc" strokeWidth={3.5} />
      <circle r={R} fill="none" stroke="#dc9728" strokeWidth={3.5} strokeDasharray={`${L * frac} ${L}`} transform="rotate(-90)" />
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
function StoryArt({ page, look, name, p, running, planting, holding, caring }: { page: StoryPage; look: Look; name: string; p: Progress; running: number | null; planting: boolean; holding: Seed | null; caring?: StoryChore['id'] | null }) {
  if (page.id === 'bought')
    return (
      <svg viewBox="0 0 300 220" width={300} height={220}>
        <defs>
          <linearGradient id="story-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#b9d4b9" />
            <stop offset="1" stopColor="#c8e1b7" />
          </linearGradient>
        </defs>
        <rect width={300} height={220} fill="url(#story-sky)" />
        <circle cx={250} cy={40} r={20} fill="#eecc6b" />
        <path d="M0,120 Q80,100 160,116 T300,108 L300,220 L0,220 Z" fill="#8bb870" />
        <path d="M0,150 Q120,134 300,148 L300,220 L0,220 Z" fill="#9e744a" />
        {[0, 1, 2].map(r => (
          <path key={r} d={`M10,${166 + r * 18} Q150,${158 + r * 18} 290,${166 + r * 18}`} stroke="#755231" strokeWidth={3} fill="none" opacity={0.6} />
        ))}
        {/* the soil, once dug: dark turned beds with a light ridge along each */}
        <StoryBeds dug={p.cared.includes('soil')} digging={caring === 'soil'} />
        <Tree x={32} y={118} s={0.95} />
        <Hut x={228} y={128} s={1.1} />
        {/* the water tank */}
        <g transform="translate(278,130)">
          <rect x={-12} y={-34} width={24} height={34} rx={4} fill="#479c94" />
          <path d="M-12,-24 H12 M-12,-14 H12" stroke="#33766f" strokeWidth={1.4} />
          <ellipse cx={0} cy={-34} rx={12} ry={3} fill="#58b1a8" />
        </g>
        {/* the signpost: blank until the farmer signs, then their name and SOLD */}
        <g transform="translate(86,154)">
          <rect x={-2.5} y={-46} width={5} height={46} fill="#644a30" />
          <rect x={-46} y={-62} width={92} height={22} rx={3} fill="#f1e0be" stroke="#815b39" strokeWidth={1.6} />
          <text x={0} y={-47} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={p.signed ? '#6b402b' : '#b29f80'}>
            {p.signed ? (name.length > 9 ? 'My farm' : `${name}'s farm`) : 'FOR SALE'}
          </text>
          {p.signed && (
            <g transform="rotate(-8)" className="story-pop">
              <rect x={-6} y={-40} width={40} height={14} rx={2} fill="#ab5240" />
              <text x={14} y={-30} textAnchor="middle" fontSize={7} fontWeight={800} fill="#fbf8ee" letterSpacing={1}>
                SOLD
              </text>
            </g>
          )}
        </g>
        {/* the maize and sukuma wiki seedlings in their tray: limp and pale, then watered and green */}
        <StorySeedlings watered={p.cared.includes('seedlings')} watering={caring === 'seedlings'} />
        {/* the cows and hens that came with the farm: the cows fed, the eggs collected */}
        <StoryAnimals cared={p.cared} caring={caring ?? null} />
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
        <rect width={300} height={220} fill="#e2d5b7" />
        <rect width={300} height={70} fill="#d4ccad" />
        {stage === 0 && (planting ? <PlantBeds sown={p.sown} holding={holding} /> : <BareField />)}
        {stage === 1 && <Sprouts />}
        {stage === 2 && (
          <>
            <svg x={0} y={40} width={300} height={180} viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} preserveAspectRatio="xMidYMid slice">
              <Field crop="maize" cond="armyworm" problemRows={[0, 1, 2, 3, 4]} rows={5} seed={7} />
            </svg>
            {/* the sukuma wiki at the back, dry */}
            {[24, 52, 80].map((x, k) => (
              <Kale key={x} x={x} y={74} s={0.55} cond="drought" seed={k + 4} bg="#d4ccad" />
            ))}
          </>
        )}
        {stage >= 3 && <Harvested />}
        {stage === 2 && <path d="M206,92 L184,116" stroke="#815b39" strokeWidth={5} strokeLinecap="round" />}
        {running !== null && <rect width={300} height={220} fill="#fbf8ee" opacity={0.18} className="story-working" />}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 300 220" width={300} height={220}>
      <rect width={300} height={220} fill="#c9dfb9" />
      <svg x={0} y={60} width={300} height={160} viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} preserveAspectRatio="xMidYMid slice">
        <Field crop="maize" cond="armyworm" problemRows={[]} rows={5} seed={3} />
      </svg>
      {/* the farmer with a notebook: each lesson is ticked as it is turned over */}
      <g transform="translate(92,200) scale(1.3)">
        <FarmerFigure look={look} />
      </g>
      <g transform="translate(180,40) rotate(4)">
        <rect x={0} y={0} width={96} height={112} rx={6} fill="#fdfaf2" stroke="#815b39" strokeWidth={2} />
        <rect x={0} y={0} width={96} height={18} rx={6} fill="#bd8d61" />
        <text x={48} y={13} textAnchor="middle" fontSize={7} fontWeight={800} fill="#fbf8ee">
          THIS SEASON
        </text>
        {['Every 2 days', 'Feel the soil', 'Store, sell later'].map((l, k) => (
          <g key={l} transform={`translate(8,${34 + k * 28})`}>
            {p.flipped.includes(k) ? (
              <path className="story-pop" d="M0,0 L4,5 L11,-5" stroke="#449224" strokeWidth={2.4} fill="none" strokeLinecap="round" />
            ) : (
              <rect x={0} y={-6} width={11} height={11} rx={2} fill="none" stroke="#c3b090" strokeWidth={1.5} />
            )}
            <text x={15} y={4} fontSize={7} fontWeight={600} fill={p.flipped.includes(k) ? '#6b402b' : '#b29f80'}>
              {l}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Page 1's beds: once the soil is prepared, the three furrows become dark turned beds, each with a light ridge. */
function StoryBeds({ dug, digging }: { dug: boolean; digging: boolean }) {
  if (!dug && !digging) return null;
  return (
    <g className={dug ? undefined : 'story-working'}>
      {[0, 1, 2].map(r => (
        <g key={r} className="story-pop" style={{ animationDelay: `${r * 120}ms` }}>
          <path d={`M10,${166 + r * 18} Q150,${158 + r * 18} 290,${166 + r * 18}`} stroke="#5e3d22" strokeWidth={9} fill="none" strokeLinecap="round" />
          <path d={`M14,${163 + r * 18} Q150,${155 + r * 18} 286,${163 + r * 18}`} stroke="#b88a5a" strokeWidth={1.6} fill="none" strokeDasharray="5 4" />
        </g>
      ))}
    </g>
  );
}

/** Page 1's seedling tray: maize and sukuma wiki seedlings, limp and pale until watered, then green and upright with
    the soil in the tray dark and wet. */
function StorySeedlings({ watered, watering }: { watered: boolean; watering: boolean }) {
  const wet = watered || watering;
  const leaf = wet ? '#5c9c3a' : '#b4b26a';
  return (
    <g transform="translate(130,202)">
      <ellipse cy={3} rx={22} ry={3} fill="rgba(0,0,0,0.15)" />
      <rect x={-20} y={-7} width={40} height={9} rx={1.5} fill="#a8754a" stroke="#6b4a2c" strokeWidth={1} />
      <rect x={-18} y={-8} width={36} height={3} rx={1} fill={wet ? '#4a3220' : '#8a6744'} />
      {[-13, -6.5, 0, 6.5, 13].map((x, k) => (
        <g key={x} transform={`translate(${x},-8)`}>
          {k % 2 ? (
            // sukuma wiki: two round leaves
            <g transform={wet ? undefined : 'rotate(18)'}>
              <path d="M0,0 L0,-6" stroke={leaf} strokeWidth={1.1} />
              <ellipse cx={-2.2} cy={-6.5} rx={2.4} ry={1.6} fill={leaf} />
              <ellipse cx={2.2} cy={-7} rx={2.4} ry={1.6} fill={leaf} />
            </g>
          ) : (
            // maize: two thin blades
            <path d={wet ? 'M0,0 Q-1,-6 -3,-10 M0,0 Q1,-7 3,-11' : 'M0,0 Q-2,-4 -6,-5 M0,0 Q2,-4 6,-4'} stroke={leaf} strokeWidth={1.4} fill="none" strokeLinecap="round" />
          )}
        </g>
      ))}
      {/* the water drops while it is watered */}
      {watering && [-10, 0, 10].map((x, k) => <ellipse key={x} className="story-pop" style={{ animationDelay: `${k * 150}ms` }} cx={x} cy={-20} rx={1.2} ry={2} fill="#6fb6d8" />)}
    </g>
  );
}

/** Page 1's cows and hens: a cow by the tree (a feeder of hay once fed, her head down to eat), hens by the hut at
    their drinker, and a basket that fills with eggs. */
function StoryAnimals({ cared, caring }: { cared: StoryChore['id'][]; caring: StoryChore['id'] | null }) {
  const fed = cared.includes('cowFeed');
  const eggs = cared.includes('eggs');
  return (
    <g>
      {/* the cow */}
      <g transform="translate(44,150)">
        <ellipse cy={1} rx={24} ry={3.5} fill="rgba(0,0,0,0.15)" />
        {[-14, -8, 9, 15].map(x => (
          <rect key={x} x={x - 1.6} y={-12} width={3.2} height={12} rx={1.2} fill="#56463a" />
        ))}
        <ellipse cy={-17} rx={19} ry={9.5} fill="#f6f2eb" stroke="#56463a" strokeWidth={1.2} />
        <path d="M-8,-24 Q-2,-20 -6,-12 Q-12,-14 -12,-20 Z M6,-25 Q12,-22 10,-15 Q4,-17 5,-22 Z" fill="#4d3e30" />
        <path d="M-19,-18 Q-24,-14 -22,-8" stroke="#56463a" strokeWidth={1.4} fill="none" />
        <ellipse cx={-2} cy={-8} rx={4} ry={2.4} fill="#e9c1b9" />
        <g transform={fed ? 'translate(21,-8) rotate(28)' : 'translate(21,-18)'} className={fed || caring === 'cowFeed' ? 'story-eat' : undefined}>
          <ellipse rx={6.5} ry={5.5} fill="#f6f2eb" stroke="#56463a" strokeWidth={1.2} />
          <ellipse cx={4} cy={2} rx={3.4} ry={2.6} fill="#e9c1b9" />
          <circle cx={-1} cy={-1.5} r={1} fill="#46372a" />
          <path d="M-4,-5 L-7,-9 M2,-5 L4,-9" stroke="#d3c5a6" strokeWidth={1.6} strokeLinecap="round" />
        </g>
        {/* the feeder: empty, then full of hay */}
        <g transform="translate(30,-2)">
          <path d="M-10,-6 L10,-6 L7,0 L-7,0 Z" fill="#815b39" />
          {(fed || caring === 'cowFeed') && <path className="story-pop" d="M-9,-6 Q-6,-12 -2,-8 Q1,-13 4,-8 Q7,-12 9,-6 Z" fill="#dbc274" stroke="#ab9047" strokeWidth={0.8} />}
        </g>
      </g>
      {/* the hens and their drinker: they peck once the eggs are collected */}
      {[
        [204, 176, 1],
        [222, 182, -1],
        [244, 174, 1],
        [210, 192, -1],
      ].map(([x, y, f], k) => (
        <g key={k} transform={`translate(${x},${y}) scale(${f},1)`} className={eggs || caring === 'eggs' ? 'story-peck' : undefined} style={{ animationDelay: `${k * 120}ms` }}>
          <ellipse cy={1} rx={6} ry={1.5} fill="rgba(0,0,0,0.15)" />
          <path d="M-2,-1 L-2,1 M2,-1 L2,1" stroke="#c7853c" strokeWidth={1.2} />
          <ellipse cy={-5} rx={6.5} ry={4.8} fill={k % 2 ? '#804d2c' : '#a7663a'} />
          <path d="M-6,-6 L-9,-10 L-5,-8 Z" fill="#533019" />
          <circle cx={5} cy={-9} r={3} fill={k % 2 ? '#804d2c' : '#a7663a'} />
          <path d="M4.5,-12.5 Q5.5,-14.5 6.5,-12.5" stroke="#c05742" strokeWidth={1.6} fill="none" />
          <path d="M8,-9 L10,-8.4 L8,-7.8 Z" fill="#dfac47" />
        </g>
      ))}
      <g transform="translate(232,196)">
        <ellipse cy={0} rx={9} ry={2.4} fill="#a9a499" />
        <path d="M-6,-1 L-5,-9 L5,-9 L6,-1 Z" fill="#cdd2cd" stroke="#8d8679" strokeWidth={0.8} />
        <ellipse cy={-1.2} rx={7.5} ry={1.6} fill="#88be88" />
      </g>
      {/* the egg basket */}
      <g transform="translate(266,200)">
        <path d="M-10,-6 Q0,-16 10,-6" stroke="#815b39" strokeWidth={1.6} fill="none" />
        {(eggs || caring === 'eggs') &&
          [-5, 0, 5].map((x, k) => <ellipse key={x} className="story-pop" style={{ animationDelay: `${k * 150}ms` }} cx={x} cy={-7} rx={3} ry={3.8} fill="#f4eee2" stroke="#c3b090" strokeWidth={0.6} />)}
        <path d="M-10,-6 L10,-6 L7,2 L-7,2 Z" fill="#be9d65" stroke="#815b39" strokeWidth={1} />
      </g>
    </g>
  );
}

/** Page 2's planting, by hand: a maize bed at the front and a sukuma bed at the back. A bed fills with seed when
    the player taps its bunch of seeds onto it, and the first shoots come up. */
function PlantBeds({ sown, holding }: { sown: Seed[]; holding: Seed | null }) {
  const beds: { id: Seed; rows: number[]; y0: number }[] = [
    { id: 'kale', rows: [0, 1], y0: 70 },
    { id: 'maize', rows: [2, 3, 4], y0: 128 },
  ];
  return (
    <g>
      <path d="M40,58 L260,58 L298,220 L2,220 Z" fill="#815b3d" />
      {/* the path between the two beds */}
      <path d="M26,118 L274,118 L278,126 L22,126 Z" fill="#c0a073" />
      {beds.map(bed => (
        <g key={bed.id} className={holding === bed.id ? 'story-bed-glow' : undefined}>
          {bed.rows.map(r => {
            const y = 78 + r * 30 + (r >= 2 ? 6 : 0);
            const w = 110 + r * 26;
            return <path key={r} d={`M${150 - w},${y} L${150 + w},${y}`} stroke="#64432d" strokeWidth={6 + r} strokeLinecap="round" />;
          })}
          {sown.includes(bed.id) &&
            bed.rows.map(r => {
              const y = 76 + r * 30 + (r >= 2 ? 6 : 0);
              const w = (bed.id === 'maize' ? 84 : 92) + r * 26;
              const s = bed.id === 'maize' ? 0.6 + r * 0.12 : 1 + r * 0.2;
              const n = bed.id === 'maize' ? 8 : 6;
              return Array.from({ length: n + 1 }, (_, k) => {
                const x = 150 - w + (k / n) * 2 * w;
                return (
                  <g key={`${r}-${k}`} transform={`translate(${x},${y}) scale(${s})`} className="story-pop" style={{ animationDelay: `${(k + r) * 30}ms` }}>
                    {bed.id === 'maize' ? (
                      <>
                        <ellipse cx={0} cy={1} rx={3} ry={2.2} fill="#dfb843" />
                        <path d="M0,0 Q-6,-8 -9,-12 M0,0 Q5,-9 9,-13 M0,0 L0,-6" stroke="#6bb44a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
                      </>
                    ) : (
                      <>
                        <circle cx={0} cy={1} r={1.8} fill="#4a3a2c" />
                        <path d="M0,0 Q-8,-4 -7,-10 Q-1,-8 0,0 Q8,-4 7,-10 Q1,-8 0,0" fill="#5d9346" stroke="#3d682c" strokeWidth={0.8} />
                      </>
                    )}
                  </g>
                );
              });
            })}
        </g>
      ))}
    </g>
  );
}

/** A bunch of seeds in the hand: maize kernels, or the small round seeds of sukuma wiki. */
function SeedBunch({ seed }: { seed: Seed }) {
  const maize = seed === 'maize';
  const spots = maize
    ? [[-10, 4], [-3, 6], [4, 5], [11, 3], [-7, -1], [0, 0], [7, -2], [-3, -6], [4, -7]]
    : [[-9, 5], [-4, 6], [1, 6], [6, 5], [10, 3], [-7, 1], [-2, 1], [3, 1], [8, 0], [-4, -3], [1, -3], [5, -4], [-1, -7]];
  return (
    <svg viewBox="-20 -16 40 30" width={46} height={34} aria-hidden="true">
      {/* an open palm under the seeds */}
      <path d="M-18,6 Q-18,13 -8,13 L9,13 Q18,12 18,5 L18,2 L-18,2 Z" fill="#9a6c4d" />
      <path d="M-18,4 Q0,10 18,4" fill="none" stroke="#724c32" strokeWidth={1.2} />
      {spots.map(([x, y], k) =>
        maize ? (
          <path key={k} d={`M${x - 3},${y + 2} Q${x},${y - 4} ${x + 3},${y + 2} Z`} fill="#dfb843" stroke="#a8882a" strokeWidth={0.8} />
        ) : (
          <circle key={k} cx={x} cy={y} r={1.9} fill="#4f3e2f" stroke="#443529" strokeWidth={0.5} />
        ),
      )}
    </svg>
  );
}

/** Rows of dug soil, nothing planted yet. */
function BareField() {
  return (
    <g>
      <path d="M40,58 L260,58 L298,220 L2,220 Z" fill="#815b3d" />
      {[0, 1, 2, 3, 4].map(r => {
        const y = 78 + r * 30;
        const w = 110 + r * 26;
        return <path key={r} d={`M${150 - w},${y} L${150 + w},${y}`} stroke="#64432d" strokeWidth={6 + r} strokeLinecap="round" />;
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
              <path d="M0,0 Q-6,-8 -9,-12 M0,0 Q5,-9 9,-13 M0,0 L0,-6" stroke="#6bb44a" strokeWidth={2.4} fill="none" strokeLinecap="round" />
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
          return <path key={`${r}-${k}`} d={`M${x},${y} L${x},${y - 6 - r}`} stroke="#bea467" strokeWidth={2.5 + r * 0.4} strokeLinecap="round" />;
        });
      })}
      {/* the harvest: one small sack and a few cobs */}
      <g transform="translate(150,40)" className="story-pop">
        <rect x={-62} y={-24} width={124} height={26} rx={13} fill="#fdf8ee" stroke="#826842" strokeWidth={1.5} />
        <text y={-6} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#6b402b">
          The whole harvest
        </text>
      </g>
      <g transform="translate(232,182)" className="story-pop">
        <ellipse cy={2} rx={34} ry={6} fill="rgba(0,0,0,0.2)" />
        {/* a half-full sack, tied at the neck */}
        <path d="M-18,0 Q-24,-22 -12,-30 Q0,-34 12,-30 Q24,-22 18,0 Z" fill="#bfa273" stroke="#725832" strokeWidth={2} />
        <path d="M-12,-30 Q0,-24 12,-30" fill="none" stroke="#725832" strokeWidth={2} />
        <path d="M-6,-31 L-9,-40 M6,-31 L9,-40" stroke="#725832" strokeWidth={2} strokeLinecap="round" />
        <path d="M-10,-14 H10 M-12,-6 H12" stroke="#9f8253" strokeWidth={1.2} />
        {[-30, -22, 28].map((x, k) => (
          <ellipse key={x} cx={x} cy={-4 - (k % 2) * 3} rx={4} ry={9} transform={`rotate(${-35 + k * 30} ${x} ${-4 - (k % 2) * 3})`} fill="#dfb843" stroke="#a8882a" strokeWidth={1} />
        ))}
      </g>
    </g>
  );
}
