import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { TreeTop } from '../art/storybook';
import { Coach, Confetti } from '../minigames/fun';
import { IMPL, type ImplId } from './data';
import { COURSE, DRILLS, RACK, WIDTH, judgeRow, obstaclesFor, type Drill, type Obstacle, type RowResult } from './training';

/* Train: the tractor school, drawn from above. The task is on the left, the field in the middle, the implement rack
   on the right. Hitch any implement, drive one row (slowly) round the rocks and trees, and the row is judged at the
   end: the wrong implement fails it, with a hint, and Try again starts the row over to pick another. Every job the
   tractor does on the farm is a drill (training.ts). Played with held buttons (◀ ▶ sit under each thumb on a
   landscape phone) or the arrow keys. */

const VIEW_H = 300;
/** the tractor sits this far down the view; the field scrolls under it */
const TRACTOR_Y = 228;
/** the tractor starts on the headland, this far before the row */
const HEADLAND = 40;
/** a trail sample every this many field pixels */
const STEP = 3;

type Phase = 'ready' | 'drive' | 'result';

export function TrainField({ speed = 1, passed, onPass, onClose }: { speed?: number; passed: Partial<Record<string, number>>; onPass: (drill: string, score: number) => void; onClose: () => void }) {
  const [idx, setIdx] = useState(() => Math.max(0, DRILLS.findIndex(d => !passed[d.id])));
  const [tool, setTool] = useState<ImplId | null>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [attempt, setAttempt] = useState(0);
  const [wrong, setWrong] = useState<Record<string, number>>({});
  const [result, setResult] = useState<RowResult | null>(null);
  const [done, setDone] = useState<Partial<Record<string, number>>>(passed);
  const drill = DRILLS[idx];

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);

  const pick = (i: number) => {
    if (phase === 'drive') return;
    setIdx(i);
    setTool(null);
    setResult(null);
    setPhase('ready');
    setAttempt(a => a + 1);
  };
  const end = (hits: number, inRow: number) => {
    if (!tool) return;
    const r = judgeRow(drill, tool, hits, inRow, wrong[drill.id] ?? 0);
    setResult(r);
    setPhase('result');
    if (!r.right) setWrong(w => ({ ...w, [drill.id]: (w[drill.id] ?? 0) + 1 }));
    if (r.pass) {
      setDone(d => ({ ...d, [drill.id]: Math.max(d[drill.id] ?? 0, r.score) }));
      onPass(drill.id, r.score);
    }
  };
  /** start the row over: a fresh field, and the implement back on the rack */
  const retry = () => {
    setTool(null);
    setResult(null);
    setPhase('ready');
    setAttempt(a => a + 1);
  };
  const next = () => {
    const after = DRILLS.findIndex((d, i) => i > idx && !done[d.id]);
    const any = DRILLS.findIndex(d => !done[d.id]);
    pick(after >= 0 ? after : any >= 0 ? any : (idx + 1) % DRILLS.length);
  };
  const passedN = DRILLS.filter(d => done[d.id]).length;

  return (
    <div className="mg tf" role="dialog" aria-modal="true" aria-label="Train: tractor school">
      <div className="scrim" />
      <div className="mg-card tf-card">
        <header className="mg-head">
          <small>Tractor</small>
          <b>Train</b>
          <span className="tf-count">
            {passedN} of {DRILLS.length} jobs passed
          </span>
          <button type="button" className="mg-x" onClick={onClose} aria-label="Close the training">
            ×
          </button>
        </header>
        <div className="tf-body">
          <aside className="tf-task" aria-label="Your task">
            <div className="tf-brief">
              <small>
                Task {idx + 1} of {DRILLS.length}
              </small>
              <b>
                <span aria-hidden="true">{drill.icon} </span>
                {drill.verb}
              </b>
              <p>{drill.task}</p>
            </div>
            {phase === 'drive' ? (
              <HoldBtn dir={-1} />
            ) : (
              <ol className="tf-drills" aria-label="The jobs">
                {DRILLS.map((d, i) => (
                  <li key={d.id}>
                    <button type="button" className={`tf-drill${i === idx ? ' is-on' : ''}${done[d.id] ? ' is-done' : ''}`} aria-current={i === idx ? 'true' : undefined} onClick={() => pick(i)}>
                      <i aria-hidden="true">{done[d.id] ? '✓' : i + 1}</i>
                      {d.verb}
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </aside>

          <div className="tf-mid">
            <Field key={`${drill.id}:${attempt}`} drill={drill} drillIdx={idx} attempt={attempt} tool={tool} running={phase === 'drive'} speed={speed} onEnd={end} />
            {phase === 'ready' && (
              <div className="tf-over is-ready">
                <p>{tool ? `${IMPL[tool].name} hitched. Drive the row: hold ◀ ▶ to steer round the rocks and trees.` : 'Hitch an implement from the rack: any one. The end of the row tells you if it was right.'}</p>
              </div>
            )}
            {phase === 'result' && result && (
              <div className={`tf-over is-result${result.pass ? ' is-pass' : ' is-fail'}`} role="status">
                {result.pass && <Confetti n={18} spread={1.2} />}
                <div className="tf-res-head">
                  <Coach mood={result.pass ? 'cheer' : 'sad'} size={40} />
                  <div>
                    <b className="tf-verdict">{result.pass ? 'Passed' : 'Failed'}</b>
                    <strong>{result.title}</strong>
                  </div>
                </div>
                <p>{result.text}</p>
                <dl className="tf-stats">
                  <div>
                    <dt>Score</dt>
                    <dd>{Math.round(result.score * 100)}%</dd>
                  </div>
                  <div>
                    <dt>Implement</dt>
                    <dd>{result.right ? 'Right' : 'Wrong'}</dd>
                  </div>
                  <div>
                    <dt>Knocks</dt>
                    <dd>{result.hits}</dd>
                  </div>
                  <div>
                    <dt>In the row</dt>
                    <dd>{Math.round(result.inRow * 100)}%</dd>
                  </div>
                </dl>
                <div className="tf-res-btns">
                  <button type="button" className={result.pass ? 'mg-plain' : 'gold-btn mg-go'} onClick={retry}>
                    Try again
                  </button>
                  {result.pass && (
                    <button type="button" className="gold-btn mg-go" onClick={next}>
                      Next task
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          <aside className="tf-rack" aria-label="The implement rack">
            {phase === 'drive' ? (
              <>
                <div className="tf-hitched">
                  <small>Hitched</small>
                  <ImplIcon id={tool!} />
                  <b>{IMPL[tool!].name}</b>
                </div>
                <HoldBtn dir={1} />
              </>
            ) : (
              <>
                <small className="tf-rack-h">Implements</small>
                <div className="tf-impls" role="radiogroup" aria-label="Hitch an implement">
                  {RACK.map(id => (
                    <button key={id} type="button" role="radio" aria-checked={tool === id} disabled={phase === 'result'} className={`tf-impl${tool === id ? ' is-on' : ''}`} title={IMPL[id].does} onClick={() => setTool(id)}>
                      <ImplIcon id={id} />
                      <span>{IMPL[id].name}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="gold-btn tf-go" disabled={!tool || phase !== 'ready'} onClick={() => setPhase('drive')}>
                  ▶ Drive the row
                </button>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ---------------- steering ---------------- */

/** what the held buttons and arrow keys say: -1 left, 1 right, 0 straight on */
const steerNow = { left: false, right: false };
const steerOf = () => (steerNow.right ? 1 : 0) - (steerNow.left ? 1 : 0);

function HoldBtn({ dir }: { dir: -1 | 1 }) {
  const [held, setHeld] = useState(false);
  const key = dir < 0 ? 'left' : 'right';
  const set = (v: boolean) => {
    steerNow[key] = v;
    setHeld(v);
  };
  useEffect(() => () => void (steerNow[key] = false), [key]);
  return (
    <button
      type="button"
      className={`gold-btn tf-steer${held ? ' is-held' : ''}`}
      aria-label={dir < 0 ? 'Steer left' : 'Steer right'}
      onPointerDown={e => {
        (e.currentTarget as HTMLButtonElement).setPointerCapture?.(e.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onLostPointerCapture={() => set(false)}
      onContextMenu={e => e.preventDefault()}
    >
      {dir < 0 ? '◀ Left' : 'Right ▶'}
    </button>
  );
}

/* ---------------- the field ---------------- */

type Sample = { y: number; x: number };

function Field({ drill, drillIdx, attempt, tool, running, speed, onEnd }: { drill: Drill; drillIdx: number; attempt: number; tool: ImplId | null; running: boolean; speed: number; onEnd: (hits: number, inRow: number) => void }) {
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const obs = useMemo(() => obstaclesFor(drillIdx, attempt), [drillIdx, attempt]);
  const L = COURSE.rowLength;
  const sim = useRef({ y: L + HEADLAND, x: 120, stall: 0, hits: new Set<number>(), trail: [] as Sample[], inRow: 0, rowN: 0, ended: false, flash: 0 });
  const [, setTick] = useState(0);
  const w = tool ? WIDTH[tool] : 0;
  const front = tool ? !!IMPL[tool].front : false;

  useEffect(() => {
    const k = (e: KeyboardEvent, v: boolean) => {
      if (e.key === 'ArrowLeft') (e.preventDefault(), (steerNow.left = v));
      if (e.key === 'ArrowRight') (e.preventDefault(), (steerNow.right = v));
    };
    const down = (e: KeyboardEvent) => k(e, true);
    const up = (e: KeyboardEvent) => k(e, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      steerNow.left = steerNow.right = false;
    };
  }, []);

  useEffect(() => {
    if (!running || !tool) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const m = sim.current;
      if (m.ended) return;
      m.flash = Math.max(0, m.flash - dt);
      if (m.stall > 0) m.stall -= dt;
      else {
        m.y -= COURSE.speed * speed * dt;
        m.x = Math.max(14, Math.min(COURSE.width - 14, m.x + steerOf() * COURSE.steer * dt));
      }
      // the implement: behind the tractor, or in front for the harvesters
      const iy = front ? m.y - 42 : m.y + 28;
      const lastS = m.trail[m.trail.length - 1];
      if (iy <= L && iy >= 0 && (!lastS || lastS.y - iy >= STEP)) {
        m.trail.push({ y: iy, x: m.x });
        m.rowN++;
        if (m.x >= COURSE.row[0] && m.x <= COURSE.row[1]) m.inRow++;
      }
      // knocks: the tractor's body and the implement against each rock, tree and stump
      obs.forEach((o, i) => {
        if (m.hits.has(i)) return;
        const body = boxHit(o, m.x, m.y - 20, 13, 38);
        const impl = boxHit(o, m.x, front ? m.y - 49 : m.y + 23, w / 2, 14);
        if (body || impl) {
          m.hits.add(i);
          m.stall = COURSE.stall;
          m.flash = 0.6;
        }
      });
      setTick(t => t + 1);
      if (m.y <= -12) {
        m.ended = true;
        endRef.current(m.hits.size, m.rowN ? m.inRow / m.rowN : 0);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, tool, obs, speed, w, front, L]);

  const m = sim.current;
  const off = TRACTOR_Y - m.y;
  const progress = Math.max(0, Math.min(1, (L + HEADLAND - m.y) / (L + HEADLAND)));
  const crop = drill.ground === 'weedy' || drill.ground === 'young' || drill.ground === 'ripeMaize' || drill.ground === 'dryBeans';
  return (
    <div className={`tf-field${m.flash > 0 ? ' is-knock' : ''}`}>
      <svg viewBox={`0 0 ${COURSE.width} ${VIEW_H}`} className="tf-svg" aria-label={`A field from above: the row to ${drill.verb.toLowerCase()}, with rocks and trees in the way`} role="img">
        <defs>
          <Patterns />
        </defs>
        <g transform={`translate(0 ${off})`}>
          {/* headlands, then the field */}
          <rect x={0} y={-400} width={COURSE.width} height={L + 900} fill="#79a65c" />
          <rect x={0} y={0} width={COURSE.width} height={L} fill={`url(#tf-g-${drill.ground})`} />
          {crop && <rect x={0} y={0} width={COURSE.width} height={L} fill={`url(#tf-c-${drill.ground})`} />}
          {/* what the implement leaves behind */}
          {tool && <Trail trail={m.trail} w={w} tool={tool} />}
          {/* the row to work: white lines, and the start and end */}
          {COURSE.row.map(x => (
            <line key={x} x1={x} x2={x} y1={0} y2={L} stroke="#fbf8ee" strokeOpacity={0.75} strokeWidth={1.6} strokeDasharray="8 7" />
          ))}
          <rect x={COURSE.row[0]} y={-6} width={COURSE.row[1] - COURSE.row[0]} height={6} fill="url(#tf-flag)" />
          <text x={120} y={-12} textAnchor="middle" className="tf-svg-label">
            END OF ROW
          </text>
          <text x={44} y={L + 14} textAnchor="middle" className="tf-svg-label">
            START
          </text>
          {obs.map((o, i) => (
            <ObstacleArt key={i} o={o} hit={m.hits.has(i)} />
          ))}
          <g transform={`translate(${m.x} ${m.y})`}>
            {tool && <ImplTop id={tool} w={w} front={front} />}
            <TractorTop />
          </g>
        </g>
      </svg>
      <div className="tf-hud" aria-hidden={!running}>
        <span className="tf-bar">
          <i style={{ width: `${progress * 100}%` }} />
        </span>
        <b>💥 {m.hits.size}</b>
      </div>
      {m.flash > 0 && <span className="tf-knock">Knock!</span>}
    </div>
  );
}

/** A circle against a box centred on (cx, cy), half-widths hw and hh. */
function boxHit(o: Obstacle, cx: number, cy: number, hw: number, hh: number) {
  // trees: only the trunk and the low branches catch (the canopy is drawn wider)
  const r = o.k === 'tree' ? o.r * 0.6 : o.r;
  const dx = Math.max(Math.abs(o.x - cx) - hw, 0);
  const dy = Math.max(Math.abs(o.y - cy) - hh / 2, 0);
  return dx * dx + dy * dy < r * r;
}

/* ---------------- the drawings ---------------- */

function Patterns() {
  return (
    <>
      {/* the ground before the job */}
      <pattern id="tf-g-stubble" width={24} height={14} patternUnits="userSpaceOnUse">
        <rect width={24} height={14} fill="#bd9d6c" />
        <path d="M4 3v5M12 7v5M19 2v5M8 10v3" stroke="#dfcb95" strokeWidth={1.6} strokeLinecap="round" />
        <path d="M15 4l2 2M2 11l2-2" stroke="#997a4d" strokeWidth={1.2} />
      </pattern>
      <pattern id="tf-g-clods" width={30} height={26} patternUnits="userSpaceOnUse">
        <rect width={30} height={26} fill="#846040" />
        <ellipse cx={7} cy={7} rx={5} ry={4} fill="#68472e" />
        <ellipse cx={21} cy={16} rx={6} ry={4.5} fill="#64432b" />
        <ellipse cx={10} cy={21} rx={3.5} ry={3} fill="#705035" />
        <ellipse cx={6} cy={6} rx={2} ry={1.4} fill="#9f7a57" />
      </pattern>
      <pattern id="tf-g-seedbed" width={12} height={12} patternUnits="userSpaceOnUse">
        <rect width={12} height={12} fill="#916b47" />
        <circle cx={3} cy={4} r={0.9} fill="#ab855e" />
        <circle cx={9} cy={9} r={0.8} fill="#785435" />
      </pattern>
      <pattern id="tf-g-weedy" width={12} height={12} patternUnits="userSpaceOnUse">
        <rect width={12} height={12} fill="#8a6644" />
        <circle cx={3} cy={4} r={0.9} fill="#ab855e" />
      </pattern>
      <pattern id="tf-g-young" width={12} height={12} patternUnits="userSpaceOnUse">
        <rect width={12} height={12} fill="#8a6644" />
        <circle cx={9} cy={8} r={0.9} fill="#ab855e" />
      </pattern>
      <pattern id="tf-g-ripeMaize" width={12} height={12} patternUnits="userSpaceOnUse">
        <rect width={12} height={12} fill="#9c8057" />
      </pattern>
      <pattern id="tf-g-dryBeans" width={12} height={12} patternUnits="userSpaceOnUse">
        <rect width={12} height={12} fill="#977953" />
      </pattern>
      {/* the crop rows (30 apart, so the tractor's wheels run between them) */}
      <pattern id="tf-c-weedy" width={30} height={18} patternUnits="userSpaceOnUse">
        <path d="M15 4l-4 4M15 4l4 4M15 4v7" stroke="#58933c" strokeWidth={1.8} strokeLinecap="round" />
        <circle cx={4} cy={13} r={2.2} fill="#7cb951" />
        <circle cx={26} cy={6} r={1.8} fill="#7cb951" />
        <circle cx={25} cy={15} r={1.5} fill="#89c35d" />
      </pattern>
      <pattern id="tf-c-young" width={30} height={18} patternUnits="userSpaceOnUse">
        <path d="M15 2l-6 6M15 2l6 6M15 2l-5 11M15 2l5 11" stroke="#4f8937" strokeWidth={2} strokeLinecap="round" />
        <circle cx={15} cy={6} r={1.2} fill="#bec858" />
      </pattern>
      <pattern id="tf-c-ripeMaize" width={30} height={14} patternUnits="userSpaceOnUse">
        <path d="M15 1l-8 6M15 1l8 6M15 7l-7 6M15 7l7 6" stroke="#cdb16a" strokeWidth={2} strokeLinecap="round" />
        <ellipse cx={15} cy={7} rx={2.4} ry={3.6} fill="#dac177" stroke="#a48646" strokeWidth={0.8} />
      </pattern>
      <pattern id="tf-c-dryBeans" width={30} height={12} patternUnits="userSpaceOnUse">
        <circle cx={15} cy={6} r={6} fill="#826944" />
        <circle cx={13} cy={5} r={3} fill="#a88b5e" />
        <circle cx={17} cy={8} r={2} fill="#675136" />
      </pattern>
      {/* what each implement leaves */}
      <pattern id="tf-e-plough" width={8} height={10} patternUnits="userSpaceOnUse">
        <rect width={8} height={10} fill="#583b24" />
        <rect width={3} height={10} fill="#4e3d2f" />
        <rect x={5} width={1} height={10} fill="#724e31" />
      </pattern>
      <pattern id="tf-e-harrow" width={10} height={10} patternUnits="userSpaceOnUse">
        <rect width={10} height={10} fill="#755335" />
        <circle cx={3} cy={3} r={0.8} fill="#916c4b" />
        <circle cx={8} cy={7} r={0.8} fill="#916c4b" />
      </pattern>
      <pattern id="tf-e-ridger" width={14} height={10} patternUnits="userSpaceOnUse">
        <rect width={14} height={10} fill="#4e3e2f" />
        <rect x={3} width={8} height={10} fill="#866140" />
        <rect x={6} width={2} height={10} fill="#9f7753" />
      </pattern>
      <pattern id="tf-e-planter" width={21} height={16} patternUnits="userSpaceOnUse">
        <rect width={21} height={16} fill="#67472c" />
        <rect x={9} width={3} height={16} fill="#513721" />
        <circle cx={10.5} cy={5} r={1.6} fill="#e3ca6a" />
      </pattern>
      <pattern id="tf-e-drill" width={7} height={8} patternUnits="userSpaceOnUse">
        <rect width={7} height={8} fill="#67472c" />
        <rect x={3} width={1.5} height={8} fill="#513721" />
        <circle cx={3.7} cy={3} r={1} fill="#dbc7a7" />
      </pattern>
      <pattern id="tf-e-cultivator" width={10} height={10} patternUnits="userSpaceOnUse">
        <rect width={10} height={10} fill="rgba(90,55,26,0.55)" />
        <path d="M2 0v10M7 0v10" stroke="#543820" strokeWidth={1} />
      </pattern>
      <pattern id="tf-e-spreader" width={9} height={9} patternUnits="userSpaceOnUse">
        <rect width={9} height={9} fill="rgba(255,255,255,0.12)" />
        <circle cx={2} cy={2} r={0.9} fill="#fbf8ee" />
        <circle cx={6.5} cy={5} r={0.9} fill="#f5f4f3" />
        <circle cx={3} cy={7.5} r={0.7} fill="#fbf8ee" />
      </pattern>
      <pattern id="tf-e-sprayer" width={10} height={10} patternUnits="userSpaceOnUse">
        <rect width={10} height={10} fill="rgba(120,190,255,0.32)" />
        <circle cx={5} cy={5} r={1} fill="rgba(220,240,255,0.8)" />
      </pattern>
      <pattern id="tf-e-maizeH" width={8} height={6} patternUnits="userSpaceOnUse">
        <rect width={8} height={6} fill="#c4ae80" />
        <path d="M2 1v2M6 3v2" stroke="#967c4e" strokeWidth={1.2} />
      </pattern>
      <pattern id="tf-e-beanH" width={8} height={6} patternUnits="userSpaceOnUse">
        <rect width={8} height={6} fill="#baa277" />
        <circle cx={3} cy={3} r={0.8} fill="#87704b" />
      </pattern>
      <pattern id="tf-flag" width={12} height={6} patternUnits="userSpaceOnUse">
        <rect width={6} height={3} fill="#fbf8ee" />
        <rect x={6} width={6} height={3} fill="#403832" />
        <rect y={3} width={6} height={3} fill="#403832" />
        <rect x={6} y={3} width={6} height={3} fill="#fbf8ee" />
      </pattern>
    </>
  );
}

function Trail({ trail, w, tool }: { trail: Sample[]; w: number; tool: ImplId }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    out.push(<rect key={i} x={p.x - w / 2} y={p.y} width={w} height={STEP + 0.6} fill={`url(#tf-e-${tool})`} />);
  }
  return <g>{out}</g>;
}

function ObstacleArt({ o, hit }: { o: Obstacle; hit: boolean }) {
  const ring = hit ? <circle cx={o.x} cy={o.y} r={o.r + 3} fill="none" stroke="#cb5b45" strokeWidth={2} strokeDasharray="3 2" /> : null;
  if (o.k === 'tree')
    return (
      <g>
        <TreeTop x={o.x} y={o.y} r={o.r} />
        {ring}
      </g>
    );
  if (o.k === 'stump')
    return (
      <g>
        <ellipse cx={o.x + 2} cy={o.y + 3} rx={o.r} ry={o.r * 0.8} fill="rgba(0,0,0,0.25)" />
        <circle cx={o.x} cy={o.y} r={o.r} fill="#724c2e" />
        <circle cx={o.x} cy={o.y} r={o.r * 0.7} fill="#be9366" />
        <circle cx={o.x} cy={o.y} r={o.r * 0.4} fill="none" stroke="#926a44" strokeWidth={1} />
        {ring}
      </g>
    );
  return (
    <g>
      <ellipse cx={o.x + 2} cy={o.y + 3} rx={o.r} ry={o.r * 0.75} fill="rgba(0,0,0,0.25)" />
      <path d={`M${o.x - o.r} ${o.y + 2} Q${o.x - o.r} ${o.y - o.r} ${o.x} ${o.y - o.r * 0.9} Q${o.x + o.r} ${o.y - o.r} ${o.x + o.r} ${o.y + 1} Q${o.x} ${o.y + o.r * 0.9} ${o.x - o.r} ${o.y + 2}Z`} fill="#9b9589" />
      <ellipse cx={o.x - o.r * 0.3} cy={o.y - o.r * 0.35} rx={o.r * 0.4} ry={o.r * 0.25} fill="#c2beb7" />
      {ring}
    </g>
  );
}

/** The tractor from above, nose up; (0, 0) is the middle of the back axle. */
function TractorTop() {
  return (
    <g>
      <ellipse cx={3} cy={-14} rx={17} ry={26} fill="rgba(0,0,0,0.22)" />
      {/* the big back wheels and the small front ones */}
      <rect x={-19} y={-12} width={8} height={18} rx={2.5} fill="#3e3730" />
      <rect x={11} y={-12} width={8} height={18} rx={2.5} fill="#3e3730" />
      <rect x={-15} y={-38} width={5} height={10} rx={2} fill="#3e3730" />
      <rect x={10} y={-38} width={5} height={10} rx={2} fill="#3e3730" />
      {/* the bonnet and the cab */}
      <rect x={-7} y={-42} width={14} height={30} rx={4} fill="#3f8437" />
      <rect x={-11} y={-16} width={22} height={20} rx={4} fill="#377430" />
      <rect x={-8} y={-13} width={16} height={13} rx={2} fill="#d0e1d0" opacity={0.85} />
      <rect x={-4} y={-40} width={8} height={4} rx={1} fill="#e3ca6a" />
      <rect x={-2} y={4} width={4} height={6} fill="#5c574e" />
    </g>
  );
}

/** The implement hitched, from above, at its working width: behind the tractor, or in front for a harvester. */
function ImplTop({ id, w, front }: { id: ImplId; w: number; front: boolean }) {
  const y = front ? -56 : 16;
  const h = 14;
  return (
    <g transform={`translate(0 ${y})`}>
      <rect x={-2} y={front ? h : -6} width={4} height={8} fill="#5c574e" />
      <ImplShape id={id} w={w} h={h} />
    </g>
  );
}

function ImplShape({ id, w, h }: { id: ImplId; w: number; h: number }) {
  const x0 = -w / 2;
  const steel = '#817b6e';
  const paint = '#c15843';
  switch (id) {
    case 'plough':
      return (
        <g>
          <rect x={x0} y={4} width={w} height={4} rx={1} fill={paint} />
          {[0, 1, 2].map(i => (
            <ellipse key={i} cx={x0 + 7 + i * ((w - 14) / 2)} cy={6 + (i - 1) * 3} rx={3.5} ry={6} fill="#bdc3bd" stroke={steel} strokeWidth={1} transform={`rotate(-25 ${x0 + 7 + i * ((w - 14) / 2)} ${6 + (i - 1) * 3})`} />
          ))}
        </g>
      );
    case 'harrow':
      return (
        <g>
          {[2, 10].map(yy => (
            <g key={yy}>
              <rect x={x0} y={yy - 1} width={w} height={2} fill={paint} />
              {Array.from({ length: Math.floor(w / 6) }, (_, i) => (
                <ellipse key={i} cx={x0 + 3 + i * 6 + (yy > 5 ? 3 : 0)} cy={yy} rx={1.6} ry={3} fill="#bdc3bd" stroke={steel} strokeWidth={0.6} />
              ))}
            </g>
          ))}
        </g>
      );
    case 'ridger':
      return (
        <g>
          <rect x={x0} y={1} width={w} height={3} fill={paint} />
          {[-1, 1].map(s => (
            <path key={s} d={`M${s * 7} 4 l${-4} 9 l8 0 z`} fill="#bdc3bd" stroke={steel} strokeWidth={0.8} />
          ))}
        </g>
      );
    case 'planter':
      return (
        <g>
          <rect x={x0} y={1} width={w} height={3} fill="#3a6a6a" />
          {[-1, 1].map(s => (
            <g key={s}>
              <rect x={s * (w / 4) - 5} y={3} width={10} height={10} rx={2} fill="#559d9c" />
              <circle cx={s * (w / 4)} cy={8} r={2.5} fill="#e3ca6a" />
            </g>
          ))}
        </g>
      );
    case 'drill':
      return (
        <g>
          <rect x={x0} y={1} width={w} height={8} rx={2} fill="#559d9c" />
          {Array.from({ length: 6 }, (_, i) => (
            <rect key={i} x={x0 + 3 + i * ((w - 6) / 5) - 1} y={9} width={2} height={5} fill={steel} />
          ))}
        </g>
      );
    case 'cultivator':
      return (
        <g>
          <rect x={x0} y={1} width={w} height={3} fill="#cc9b2f" />
          {Array.from({ length: 5 }, (_, i) => (
            <path key={i} d={`M${x0 + 4 + i * ((w - 8) / 4)} 4 q3 5 0 10`} stroke={steel} strokeWidth={2} fill="none" />
          ))}
        </g>
      );
    case 'spreader':
      return (
        <g>
          <path d={`M-9 0 h18 l-5 11 h-8 z`} fill="#cc9b2f" stroke="#8e6a1d" strokeWidth={1} />
          <circle cx={0} cy={12} r={4} fill={steel} />
          <path d={`M${x0} 13 Q0 4 ${-x0} 13`} stroke="#fbf8ee" strokeOpacity={0.6} strokeDasharray="1 3" fill="none" />
        </g>
      );
    case 'sprayer':
      return (
        <g>
          <rect x={-7} y={0} width={14} height={9} rx={4} fill="#ebefeb" stroke="#a1a9a1" />
          <rect x={x0} y={10} width={w} height={2} fill="#cc9b2f" />
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx={x0 + 2 + i * ((w - 4) / 8)} cy={13} r={1.1} fill="#68c1b8" />
          ))}
        </g>
      );
    case 'maizeH':
      return (
        <g>
          <rect x={x0} y={6} width={w} height={8} rx={1} fill="#cc9b2f" />
          {Array.from({ length: 4 }, (_, i) => (
            <path key={i} d={`M${x0 + i * (w / 4)} 6 l${w / 8} -6 l${w / 8} 6z`} fill="#c28a25" stroke="#8e6a1d" strokeWidth={0.6} />
          ))}
        </g>
      );
    case 'beanH':
      return (
        <g>
          <rect x={x0} y={7} width={w} height={7} rx={1} fill="#ae5240" />
          <rect x={x0 + 2} y={1} width={w - 4} height={6} rx={3} fill="#dbcb77" stroke="#918235" strokeWidth={0.6} />
          {Array.from({ length: 6 }, (_, i) => (
            <line key={i} x1={x0 + 4 + i * ((w - 8) / 5)} x2={x0 + 4 + i * ((w - 8) / 5)} y1={1.5} y2={6.5} stroke="#918235" strokeWidth={0.8} />
          ))}
        </g>
      );
    default:
      return <rect x={x0} y={0} width={w} height={h} fill={steel} />;
  }
}

/** A small picture of an implement for the rack. */
export function ImplIcon({ id }: { id: ImplId }) {
  const w = Math.min(40, WIDTH[id] * 0.6 + 14);
  return (
    <svg viewBox="-22 -1 44 17" className="tf-icon" aria-hidden="true">
      <ImplShape id={id} w={w} h={14} />
    </svg>
  );
}

