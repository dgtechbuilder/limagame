import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/* The mini-games: short hands-on moments behind every new job (the power system's parts, the tractor's sections,
   building the coop and the cow shed, planting and harvesting the new farms). One frame for all of them: what to do,
   the game, then how it went (stars and a score from 0 to 1, which the job uses). Every game is played with taps or
   a held press, so it works on a phone; the keyboard works too. */

type Pt = { x: number; y: number; label: string };

export type GameSpec =
  /** a needle swings: press when it is in the green zone */
  | { type: 'timing'; rounds: number; zone: [number, number]; speed: number; verb: string; icon?: string }
  /** hold to fill; let go inside the band */
  | { type: 'hold'; rounds: number; band: [number, number]; rate: number; verb: string; liquid?: string }
  /** tap the right spots on a drawing before the time runs out (in order, if ordered); decoys cost points */
  | { type: 'tap'; scene: Scene; spots: Pt[]; decoys?: Pt[]; seconds: number; ordered?: boolean; verb: string; mark?: string; hidden?: boolean; spotMark?: string; decoyMark?: string }
  /** connect each cable to its terminal */
  | { type: 'wires'; pairs: { label: string; color: string }[] }
  /** tap the steps in the right order */
  | { type: 'order'; steps: string[] }
  /** answer the questions */
  | { type: 'quiz'; questions: { q: string; options: string[]; right: number; why: string }[] }
  /** turn something to face the right way: a slider, and a meter of how well it faces */
  | { type: 'aim'; target: number; label: string }
  /** drive down a lane and steer round the cones */
  | { type: 'steer'; seconds: number; speed?: number }
  /** switch on loads without going over what the system makes */
  | { type: 'balance'; loads: { id: string; name: string; kwh: number; need: boolean }[]; supply: number };

export type Scene = 'tractor' | 'yard' | 'rows' | 'orchard';

export const stars = (score: number) => (score >= 0.85 ? 3 : score >= 0.6 ? 2 : score > 0 ? 1 : 0);

export function MiniGame({ title, kicker, task, spec, onDone, onClose, doneLabel = 'Done' }: { title: string; kicker?: string; task: string; spec: GameSpec; onDone: (score: number, data?: string[]) => void; onClose: () => void; doneLabel?: string }) {
  const [phase, setPhase] = useState<'intro' | 'play' | 'result'>('intro');
  const [score, setScore] = useState(0);
  const [data, setData] = useState<string[] | undefined>();
  const [round, setRound] = useState(0);
  const finish = (sc: number, d?: string[]) => {
    setScore(Math.max(0, Math.min(1, sc)));
    setData(d);
    setPhase('result');
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const n = stars(score);
  return (
    <div className="mg" role="dialog" aria-modal="true" aria-label={`${title}: mini-game`}>
      <div className="scrim" />
      <div className="mg-card">
        <header className="mg-head">
          {kicker && <small>{kicker}</small>}
          <b>{title}</b>
          <button type="button" className="mg-x" onClick={onClose} aria-label="Close the mini-game">
            ×
          </button>
        </header>
        {phase === 'intro' && (
          <div className="mg-intro">
            <p>{task}</p>
            <button type="button" className="gold-btn mg-go" onClick={() => setPhase('play')}>
              Start
            </button>
          </div>
        )}
        {phase === 'play' && (
          <div className="mg-play" key={round}>
            <Game spec={spec} onEnd={finish} />
          </div>
        )}
        {phase === 'result' && (
          <div className="mg-result" role="status">
            <p className="mg-stars" aria-label={`${n} of 3 stars`}>
              {[0, 1, 2].map(i => (
                <span key={i} className={i < n ? 'is-on' : ''}>
                  ★
                </span>
              ))}
            </p>
            <p className="mg-score">
              <b>{Math.round(score * 100)}%</b> {n === 3 ? 'Excellent work!' : n === 2 ? 'Well done.' : n === 1 ? 'Done, but it could go better.' : 'That did not work: try again.'}
            </p>
            <div className="mg-actions">
              <button
                type="button"
                className="mg-plain"
                onClick={() => {
                  setRound(r => r + 1);
                  setPhase('play');
                }}
              >
                Try again
              </button>
              <button type="button" className="gold-btn mg-go" disabled={score <= 0} onClick={() => onDone(score, data)}>
                {doneLabel}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Game({ spec, onEnd }: { spec: GameSpec; onEnd: (score: number, data?: string[]) => void }) {
  switch (spec.type) {
    case 'timing':
      return <Timing spec={spec} onEnd={onEnd} />;
    case 'hold':
      return <Hold spec={spec} onEnd={onEnd} />;
    case 'tap':
      return <Tap spec={spec} onEnd={onEnd} />;
    case 'wires':
      return <Wires spec={spec} onEnd={onEnd} />;
    case 'order':
      return <Order spec={spec} onEnd={onEnd} />;
    case 'quiz':
      return <Quiz spec={spec} onEnd={onEnd} />;
    case 'aim':
      return <Aim spec={spec} onEnd={onEnd} />;
    case 'steer':
      return <Steer spec={spec} onEnd={onEnd} />;
    case 'balance':
      return <Balance spec={spec} onEnd={onEnd} />;
  }
}

type Of<T extends GameSpec['type']> = { spec: Extract<GameSpec, { type: T }>; onEnd: (score: number, data?: string[]) => void };

/** A frame clock: calls back with seconds since the last frame while mounted. */
function useFrames(cb: (dt: number) => void, on = true) {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      ref.current(Math.min(0.05, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
}

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <p className="mg-progress">
      {label} {Math.min(done + 1, total)} of {total}
      <span>
        {Array.from({ length: total }, (_, i) => (
          <i key={i} className={i < done ? 'is-done' : ''} />
        ))}
      </span>
    </p>
  );
}

/* ---------------- timing: press in the green ---------------- */

function Timing({ spec, onEnd }: Of<'timing'>) {
  const [v, setV] = useState(0);
  const dir = useRef(1);
  const [hits, setHits] = useState<number[]>([]);
  const [flash, setFlash] = useState<'hit' | 'miss' | null>(null);
  useFrames(dt => {
    setV(x => {
      let n = x + dir.current * spec.speed * dt;
      if (n > 100) (n = 200 - n), (dir.current = -1);
      if (n < 0) (n = -n), (dir.current = 1);
      return n;
    });
  }, hits.length < spec.rounds);
  const press = () => {
    if (hits.length >= spec.rounds) return;
    const [a, b] = spec.zone;
    const mid = (a + b) / 2;
    const inZone = v >= a && v <= b;
    // full marks in the zone; partly near it
    const got = inZone ? 1 - (Math.abs(v - mid) / ((b - a) / 2)) * 0.2 : Math.max(0, 0.4 - Math.min(Math.abs(v - a), Math.abs(v - b)) / 25);
    const next = [...hits, got];
    setHits(next);
    setFlash(inZone ? 'hit' : 'miss');
    window.setTimeout(() => setFlash(null), 300);
    if (next.length >= spec.rounds) window.setTimeout(() => onEnd(next.reduce((n, x) => n + x, 0) / spec.rounds), 450);
  };
  useEffect(() => {
    const k = (e: KeyboardEvent) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), press());
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });
  return (
    <div className="mg-timing">
      <Progress done={hits.length} total={spec.rounds} label="Try" />
      <div className={`mg-gauge${flash ? ` is-${flash}` : ''}`} aria-hidden="true">
        <span className="mg-zone" style={{ left: `${spec.zone[0]}%`, width: `${spec.zone[1] - spec.zone[0]}%` }} />
        <span className="mg-needle" style={{ left: `${v}%` }} />
      </div>
      <button type="button" className="gold-btn mg-big" onClick={press}>
        {spec.icon ? `${spec.icon} ` : ''}
        {spec.verb}
      </button>
    </div>
  );
}

/* ---------------- hold to fill ---------------- */

function Hold({ spec, onEnd }: Of<'hold'>) {
  const [level, setLevel] = useState(0);
  const holding = useRef(false);
  const [held, setHeld] = useState(false);
  const [results, setResults] = useState<number[]>([]);
  const [msg, setMsg] = useState('');
  useFrames(dt => {
    if (holding.current) setLevel(l => Math.min(110, l + spec.rate * dt));
  });
  const start = () => {
    if (results.length >= spec.rounds) return;
    holding.current = true;
    setHeld(true);
    setMsg('');
  };
  const stop = () => {
    if (!holding.current) return;
    holding.current = false;
    setHeld(false);
    const [a, b] = spec.band;
    const got = level >= a && level <= b ? 1 : level > b ? Math.max(0, 0.5 - (level - b) / 20) : Math.max(0, level / a - 0.3);
    setMsg(level > b ? 'Too much: it spilt over' : level < a ? 'Not enough yet' : 'Just right!');
    const next = [...results, got];
    setResults(next);
    window.setTimeout(() => setLevel(0), 500);
    if (next.length >= spec.rounds) window.setTimeout(() => onEnd(next.reduce((n, x) => n + x, 0) / spec.rounds), 700);
  };
  return (
    <div className="mg-hold">
      <Progress done={results.length} total={spec.rounds} label="Fill" />
      <div className="mg-tank" aria-label={`Filled ${Math.round(level)}%`} role="meter" aria-valuenow={Math.round(level)} aria-valuemin={0} aria-valuemax={100}>
        <span className="mg-band" style={{ bottom: `${spec.band[0] * 0.9}%`, height: `${(spec.band[1] - spec.band[0]) * 0.9}%` }} />
        <span className="mg-liquid" style={{ height: `${Math.min(100, level) * 0.9}%`, background: spec.liquid ?? '#c9a227' }} />
      </div>
      <p className="mg-msg" aria-live="polite">
        {msg || 'Hold the button, let go on the line'}
      </p>
      <button type="button" className={`gold-btn mg-big${held ? ' is-held' : ''}`} onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onKeyDown={e => e.key === ' ' && start()} onKeyUp={e => e.key === ' ' && stop()}>
        {spec.verb}
      </button>
    </div>
  );
}

/* ---------------- tap the spots ---------------- */

function SceneArt({ scene }: { scene: Scene }) {
  if (scene === 'tractor')
    return (
      <g>
        <rect x={0} y={215} width={340} height={20} fill="#9a6b3e" />
        <rect x={60} y={120} width={170} height={60} rx={8} fill="#2b8a4a" />
        <rect x={180} y={60} width={80} height={80} rx={6} fill="#2b8a4a" stroke="#1d5e33" strokeWidth={3} />
        <rect x={192} y={72} width={56} height={44} rx={4} fill="#bfe3f2" />
        <rect x={60} y={100} width={110} height={26} rx={6} fill="#237a3f" />
        <rect x={76} y={84} width={10} height={20} fill="#555" />
        <circle cx={95} cy={195} r={30} fill="#2a2a2a" />
        <circle cx={95} cy={195} r={12} fill="#f2c230" />
        <circle cx={270} cy={180} r={45} fill="#2a2a2a" />
        <circle cx={270} cy={180} r={18} fill="#f2c230" />
        <rect x={300} y={150} width={36} height={8} fill="#777" />
      </g>
    );
  if (scene === 'yard')
    return (
      <g>
        <rect width={340} height={235} fill="#1b2a3a" />
        <circle cx={300} cy={34} r={14} fill="#f2f0d0" />
        <rect x={20} y={70} width={90} height={60} fill="#6b4a2e" />
        <polygon points="10,72 65,36 120,72" fill="#8a3a2a" />
        <rect x={220} y={110} width={80} height={50} fill="#5c4630" />
        <rect x={0} y={170} width={340} height={65} fill="#24402a" />
        <path d="M0 200 Q170 175 340 205" stroke="#6b5235" strokeWidth={16} fill="none" />
      </g>
    );
  if (scene === 'orchard')
    return (
      <g>
        <rect width={340} height={235} fill="#9bd06a" />
        {[0, 1, 2].map(r => (
          <rect key={r} x={10} y={30 + r * 70} width={320} height={44} rx={10} fill="#7a4a24" />
        ))}
      </g>
    );
  return (
    <g>
      <rect width={340} height={235} fill="#9bd06a" />
      {[0, 1, 2, 3].map(r => (
        <rect key={r} x={14} y={20 + r * 54} width={312} height={36} rx={8} fill="#7a4a24" />
      ))}
    </g>
  );
}

function Tap({ spec, onEnd }: Of<'tap'>) {
  const [found, setFound] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);
  const [left, setLeft] = useState(spec.seconds);
  const ended = useRef(false);
  const all = useMemo(() => [...spec.spots.map((p, i) => ({ ...p, i, real: true })), ...(spec.decoys ?? []).map((p, i) => ({ ...p, i: 100 + i, real: false }))].sort((a, b) => a.x - b.x), [spec]);
  const end = (f: number[], w: number, t: number) => {
    if (ended.current) return;
    ended.current = true;
    const share = f.length / spec.spots.length;
    window.setTimeout(() => onEnd(Math.max(0, share - w * 0.15 + (f.length === spec.spots.length ? Math.min(0.1, t / spec.seconds / 5) : 0))), 400);
  };
  useFrames(dt => {
    setLeft(t => {
      const n = Math.max(0, t - dt);
      if (n === 0 && !ended.current) end(found, wrong, 0);
      return n;
    });
  }, !ended.current);
  const hit = (p: (typeof all)[number]) => {
    if (ended.current || found.includes(p.i)) return;
    if (!p.real || (spec.ordered && p.i !== found.length)) {
      setWrong(w => w + 1);
      return;
    }
    const f = [...found, p.i];
    setFound(f);
    if (f.length === spec.spots.length) end(f, wrong, left);
  };
  const next = spec.ordered ? spec.spots[found.length] : null;
  return (
    <div className="mg-tap">
      <p className="mg-progress">
        {spec.verb}: {found.length} of {spec.spots.length}
        {next ? ` · next: ${next.label}` : ''}
        <b className="mg-time">{Math.ceil(left)} s</b>
      </p>
      <svg viewBox="0 0 340 235" className="mg-scene" role="group" aria-label={`${spec.verb}: tap the right places`}>
        <SceneArt scene={spec.scene} />
        {all.map(p => {
          const done = found.includes(p.i);
          return (
            <g key={p.i} transform={`translate(${p.x},${p.y})`}>
              <circle r={16} className={`mg-spot${done ? ' is-done' : ''}${spec.hidden ? ' is-hidden' : ''}`} />
              <text y={5} textAnchor="middle" fontSize={14} pointerEvents="none">
                {done ? (spec.mark ?? '✓') : p.real ? (spec.spotMark ?? (spec.hidden ? '?' : '')) : (spec.decoyMark ?? (spec.hidden ? '?' : ''))}
              </text>
              <rect x={-18} y={-18} width={36} height={36} fill="transparent" role="button" tabIndex={0} aria-label={p.label} onClick={() => hit(p)} onKeyDown={e => e.key === 'Enter' && hit(p)} style={{ cursor: 'pointer' }} />
            </g>
          );
        })}
      </svg>
      {wrong > 0 && <p className="mg-msg">{wrong} wrong tap{wrong === 1 ? '' : 's'}</p>}
    </div>
  );
}

/* ---------------- wires ---------------- */

/** A fixed shuffle (the same every time, so a retry is fair). */
function shuffled<T>(xs: T[], salt = 3): T[] {
  return xs.map((x, i) => ({ x, k: (i * 7 + salt * 5) % 11 })).sort((a, b) => a.k - b.k).map(o => o.x);
}

function Wires({ spec, onEnd }: Of<'wires'>) {
  const right = useMemo(() => shuffled(spec.pairs.map((p, i) => ({ ...p, i }))), [spec]);
  const [pick, setPick] = useState<number | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [wrong, setWrong] = useState(0);
  const connect = (i: number) => {
    if (pick === null) return;
    if (i !== pick) {
      setWrong(w => w + 1);
      setPick(null);
      return;
    }
    const d = [...done, i];
    setDone(d);
    setPick(null);
    if (d.length === spec.pairs.length) window.setTimeout(() => onEnd(Math.max(0.2, 1 - wrong * 0.2)), 400);
  };
  return (
    <div className="mg-wires">
      <p className="mg-progress">Tap a cable, then its terminal · {done.length} of {spec.pairs.length}</p>
      <div className="mg-cols">
        <div>
          {spec.pairs.map((p, i) => (
            <button key={i} type="button" className={`mg-wire${pick === i ? ' is-on' : ''}${done.includes(i) ? ' is-done' : ''}`} style={{ ['--c' as string]: p.color }} disabled={done.includes(i)} onClick={() => setPick(i)}>
              <i /> {p.label} cable
            </button>
          ))}
        </div>
        <div>
          {right.map(p => (
            <button key={p.i} type="button" className={`mg-wire is-term${done.includes(p.i) ? ' is-done' : ''}`} style={{ ['--c' as string]: p.color }} disabled={done.includes(p.i) || pick === null} onClick={() => connect(p.i)}>
              {p.label} terminal <i />
            </button>
          ))}
        </div>
      </div>
      {wrong > 0 && <p className="mg-msg">{wrong} wrong connection{wrong === 1 ? '' : 's'}: that would blow a fuse</p>}
    </div>
  );
}

/* ---------------- order ---------------- */

function Order({ spec, onEnd }: Of<'order'>) {
  const cards = useMemo(() => shuffled(spec.steps.map((t, i) => ({ t, i })), 5), [spec]);
  const [done, setDone] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const tap = (i: number) => {
    if (i !== done) {
      setWrong(w => w + 1);
      setShake(i);
      window.setTimeout(() => setShake(null), 350);
      return;
    }
    setDone(done + 1);
    if (done + 1 === spec.steps.length) window.setTimeout(() => onEnd(Math.max(0.2, 1 - wrong / spec.steps.length)), 400);
  };
  return (
    <div className="mg-order">
      <p className="mg-progress">Tap the steps in order · {done} of {spec.steps.length}</p>
      <div className="mg-cards">
        {cards.map(c => (
          <button key={c.i} type="button" className={`mg-card-btn${c.i < done ? ' is-done' : ''}${shake === c.i ? ' is-wrong' : ''}`} disabled={c.i < done} onClick={() => tap(c.i)}>
            {c.i < done && <b>{c.i + 1}</b>}
            {c.t}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- quiz ---------------- */

function Quiz({ spec, onEnd }: Of<'quiz'>) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const q = spec.questions[i];
  const pick = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    if (k === q.right) setRight(r => r + 1);
  };
  const next = () => {
    if (i + 1 >= spec.questions.length) return onEnd(right / spec.questions.length);
    setI(i + 1);
    setPicked(null);
  };
  return (
    <div className="mg-quiz">
      <Progress done={i} total={spec.questions.length} label="Question" />
      <p className="mg-q">{q.q}</p>
      <div className="mg-options">
        {q.options.map((o, k) => (
          <button key={k} type="button" className={`mg-opt${picked !== null && k === q.right ? ' is-right' : ''}${picked === k && k !== q.right ? ' is-wrong' : ''}`} disabled={picked !== null} onClick={() => pick(k)}>
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="mg-why" role="status">
          <p>
            <b>{picked === q.right ? 'Right.' : 'Not quite.'}</b> {q.why}
          </p>
          <button type="button" className="gold-btn mg-go" onClick={next}>
            {i + 1 >= spec.questions.length ? 'Finish' : 'Next question'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- aim ---------------- */

function Aim({ spec, onEnd }: Of<'aim'>) {
  const [v, setV] = useState(10);
  const out = Math.max(0, 1 - Math.abs(v - spec.target) / 45);
  return (
    <div className="mg-aim">
      <svg viewBox="0 0 340 150" className="mg-scene is-short" aria-hidden="true">
        <rect width={340} height={150} fill="#bfe3f2" />
        <circle cx={60 + spec.target * 2.2} cy={30 + Math.abs(50 - spec.target) * 0.6} r={18} fill="#f7c531" />
        <rect y={130} width={340} height={20} fill="#9bd06a" />
        <g transform={`translate(170,120) rotate(${-v + 45})`}>
          <rect x={-60} y={-6} width={120} height={12} fill="#2a4a7a" stroke="#c9d6e8" strokeWidth={2} />
        </g>
        <rect x={166} y={120} width={8} height={14} fill="#777" />
      </svg>
      <label className="mg-slider">
        <span>{spec.label}</span>
        <input type="range" min={0} max={100} value={v} onChange={e => setV(Number(e.target.value))} aria-label={spec.label} />
      </label>
      <div className="mg-meter" role="meter" aria-label="Power from the panels" aria-valuenow={Math.round(out * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${out * 100}%` }} />
        <b>{Math.round(out * 100)}% of full power</b>
      </div>
      <button type="button" className="gold-btn mg-big" onClick={() => onEnd(out)}>
        Fix the frame here
      </button>
    </div>
  );
}

/* ---------------- steer ---------------- */

function Steer({ spec, onEnd }: Of<'steer'>) {
  const [lane, setLane] = useState(1);
  const [t, setT] = useState(0);
  const [hits, setHits] = useState(0);
  const cones = useMemo(() => Array.from({ length: Math.round(spec.seconds * 1.4) }, (_, i) => ({ at: 1.2 + i * 0.72, lane: (i * 5 + Math.floor(i / 3)) % 3 })), [spec.seconds]);
  const hit = useRef(new Set<number>());
  const laneRef = useRef(lane);
  laneRef.current = lane;
  const ended = useRef(false);
  const speed = spec.speed ?? 1;
  useFrames(dt => {
    setT(x => {
      const n = x + dt * speed;
      cones.forEach((c, i) => {
        const y = (n - c.at) * 160;
        if (y > 150 && y < 175 && c.lane === laneRef.current && !hit.current.has(i)) {
          hit.current.add(i);
          setHits(h => h + 1);
        }
      });
      if (n >= spec.seconds && !ended.current) {
        ended.current = true;
        window.setTimeout(() => onEnd(Math.max(0, 1 - hit.current.size * 0.15)), 300);
      }
      return n;
    });
  }, !ended.current);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setLane(l => Math.max(0, l - 1));
      if (e.key === 'ArrowRight') setLane(l => Math.min(2, l + 1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  return (
    <div className="mg-steer">
      <p className="mg-progress">
        Steer round the cones · {hits} hit<b className="mg-time">{Math.max(0, Math.ceil(spec.seconds - t))} s</b>
      </p>
      <svg viewBox="0 0 240 200" className="mg-scene is-lane" aria-hidden="true">
        <rect width={240} height={200} fill="#9a6b3e" />
        {[80, 160].map(x => (
          <line key={x} x1={x} x2={x} y1={0} y2={200} stroke="#e8d2a6" strokeWidth={2} strokeDasharray="10 12" strokeDashoffset={-t * 160} />
        ))}
        {cones.map((c, i) => {
          const y = (t - c.at) * 160;
          if (y < -20 || y > 220) return null;
          return <polygon key={i} points={`${c.lane * 80 + 40},${y - 14} ${c.lane * 80 + 28},${y + 10} ${c.lane * 80 + 52},${y + 10}`} fill={hit.current.has(i) ? '#999' : '#ff7a1a'} stroke="#fff" strokeWidth={2} />;
        })}
        <g transform={`translate(${lane * 80 + 40},170)`}>
          <rect x={-16} y={-14} width={32} height={30} rx={5} fill="#2b8a4a" />
          <rect x={-22} y={4} width={9} height={16} rx={3} fill="#222" />
          <rect x={13} y={4} width={9} height={16} rx={3} fill="#222" />
        </g>
      </svg>
      <div className="mg-actions">
        <button type="button" className="gold-btn mg-big" onPointerDown={() => setLane(l => Math.max(0, l - 1))} aria-label="Steer left">
          ◀ Left
        </button>
        <button type="button" className="gold-btn mg-big" onPointerDown={() => setLane(l => Math.min(2, l + 1))} aria-label="Steer right">
          Right ▶
        </button>
      </div>
    </div>
  );
}

/* ---------------- balance the loads ---------------- */

function Balance({ spec, onEnd }: Of<'balance'>) {
  const [on, setOn] = useState<string[]>([]);
  const total = spec.loads.filter(l => on.includes(l.id)).reduce((n, l) => n + l.kwh, 0);
  const over = total > spec.supply + 1e-9;
  const needs = spec.loads.filter(l => l.need);
  const needOn = needs.filter(l => on.includes(l.id)).length;
  const score = over ? 0 : 0.5 * (needs.length ? needOn / needs.length : 1) + 0.5 * Math.min(1, total / spec.supply);
  return (
    <div className="mg-balance">
      <div className={`mg-meter${over ? ' is-over' : ''}`} role="meter" aria-label="Power used" aria-valuenow={Math.round(total * 10) / 10} aria-valuemin={0} aria-valuemax={spec.supply}>
        <span style={{ width: `${Math.min(100, (total / spec.supply) * 100)}%` }} />
        <b>
          {Math.round(total * 10) / 10} of {Math.round(spec.supply * 10) / 10} kWh a day{over ? ' · overloaded!' : ''}
        </b>
      </div>
      <div className="mg-loads">
        {spec.loads.map(l => (
          <button key={l.id} type="button" className={`mg-load${on.includes(l.id) ? ' is-on' : ''}`} aria-pressed={on.includes(l.id)} onClick={() => setOn(o => (o.includes(l.id) ? o.filter(x => x !== l.id) : [...o, l.id]))}>
            <b>{l.name}</b>
            <small>
              {l.kwh} kWh{l.need ? ' · needed' : ''}
            </small>
          </button>
        ))}
      </div>
      <button type="button" className="gold-btn mg-big" disabled={over || !on.length} onClick={() => onEnd(score, on)}>
        Switch on
      </button>
    </div>
  );
}

/** A line of small print under a mini-game's section card. */
export function GameNote({ children }: { children: ReactNode }) {
  return <p className="mg-note">{children}</p>;
}
