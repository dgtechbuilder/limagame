import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent as RWheelEvent } from 'react';
import { useVoice } from '../art/style';
import { sfx } from '../sfx';
import { speak, stopSpeaking } from '../speech';
import { LIFE, issueOf, type IssueId } from './config';
import { ExamScene } from './ExamScene';
import { FINDINGS, PARTS, marksOf, partOf, spotsOf, stepsOf, type Finding, type PartId, type Reading } from './exam';

/* Examining a sick animal, up close. The whole animal first, with a ring on every part that shows something. START
   THE EXAMINATION plays it like a film: black bars close in, a title card, then the camera flies to each part in the
   standard order (exam.ts PARTS), the light closes round it, and a caption says what is there, with the measure
   (the thermometer, the breaths counted, the days of feed left). It moves on by itself; Back, Pause and Next take
   over. At the end the camera pulls back, the parts are numbered, and the player chooses the fix beside them.
   At any time the player can look for themselves: tap a part (on the animal or in the list), drag to look round,
   and zoom with the wheel, a pinch or the + and − buttons. */

type Mode = 'idle' | 'intro' | 'step' | 'end' | 'free';
interface Cam {
  x: number;
  y: number;
  z: number;
}

const SCENE_W = 480;
const SCENE_H = 270;
/** the whole scene, a little smaller than the stage so the buttons along its bottom edge cover nothing */
const WHOLE: Cam = { x: 240, y: 135, z: 0.86 };
const Z_MIN = 0.86;
const Z_MAX = 4.5;
/** the camera's flight to a part (ms), and how long the caption holds after it (ms): the caption bar runs this long */
const FLY = 1100;
const HOLD = 4200;
const RAIL = 132;
const SIDE = 300;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** No motion: the phone asks for it, or Settings › Reduce motion is on (it stops every animation, the caption bar too). */
const reduced = () => typeof window !== 'undefined' && (!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !!document.querySelector('.stage.reduce-motion'));

export function Exam({ issue, since, day, onClose, decide }: { issue: IssueId; since: number; day: number; onClose: () => void; decide: ReactNode }) {
  const def = issueOf(issue);
  const group = def.group;
  const who = group === 'cows' ? 'cow' : 'hens';
  const steps = useMemo(() => stepsOf(issue), [issue]);
  const marks = useMemo(() => marksOf(issue), [issue]);
  const spots = useMemo(() => spotsOf(issue), [issue]);
  const found = useMemo(() => new Set<PartId>(FINDINGS[issue].map(f => f.part)), [issue]);
  const voice = useVoice();

  const [mode, setMode] = useState<Mode>('idle');
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [look, setLook] = useState<PartId | null>(null);
  const [cam, setCam] = useState<Cam>(WHOLE);
  const [seen, setSeen] = useState<Set<PartId>>(() => new Set());
  const [dragging, setDragging] = useState(false);

  /* ---- the stage's size (its own pixels, before the game's fit-to-screen scale) ---- */
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 850, h: 380 });
  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const read = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    read();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(read) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const s = Math.min(size.w / SCENE_W, size.h / SCENE_H);

  /** where on the stage the camera's point sits: right of the parts list, above the caption, or left of the summary */
  const anchor = (m: Mode) => {
    if (m === 'step' || m === 'intro') return { x: size.w * 0.56, y: size.h * 0.37 };
    if (m === 'end') return { x: (size.w - SIDE) / 2, y: size.h / 2 };
    if (m === 'free') return { x: RAIL + (size.w - RAIL) / 2, y: size.h * 0.42 };
    return { x: RAIL + (size.w - RAIL) / 2, y: size.h * 0.44 };
  };
  const endZoom = clamp((size.w - SIDE - 16) / (SCENE_W * s), 0.6, 0.95);
  const target: Cam = mode === 'step' ? steps[step].part.at : mode === 'free' ? cam : mode === 'intro' ? { ...WHOLE, z: 1.08 } : mode === 'end' ? { ...WHOLE, z: endZoom } : WHOLE;
  const a = anchor(mode);
  const tx = a.x - target.x * s * target.z;
  const ty = a.y - target.y * s * target.z;

  /* ---- the film ---- */
  const start = () => {
    sfx.action();
    setSeen(new Set());
    setLook(null);
    setPlaying(true);
    setStep(0);
    setMode('intro');
  };
  useEffect(() => {
    if (mode !== 'intro') return;
    const t = window.setTimeout(() => setMode('step'), reduced() ? 300 : 1500);
    return () => window.clearTimeout(t);
  }, [mode]);
  const go = useCallback(
    (to: number) => {
      if (to < 0) return;
      if (to >= steps.length) {
        setMode('end');
        return;
      }
      setStep(to);
    },
    [steps.length],
  );
  // each stop: mark it seen, a sound, and read it aloud when Read aloud is on
  useEffect(() => {
    if (mode !== 'step') return;
    const st = steps[step];
    setSeen(v => new Set(v).add(st.part.id));
    sfx.flow();
    if (voice) speak(`${st.part.label}. ${st.findings.map(f => `${f.title}. ${f.see}`).join(' ')}`);
  }, [mode, step, steps, voice]);
  // with no motion the caption bar does not run, so a timer moves the film on
  useEffect(() => {
    if (mode !== 'step' || !playing || !reduced()) return;
    const t = window.setTimeout(() => go(step + 1), FLY + HOLD);
    return () => window.clearTimeout(t);
  }, [mode, step, playing, go]);
  useEffect(() => () => stopSpeaking(), []);

  /* ---- looking for yourself ---- */
  const lookAt = (id: PartId) => {
    const p = partOf(group, id);
    setLook(id);
    setCam({ ...p.at, ...spots[id] });
    setMode('free');
    setSeen(v => new Set(v).add(id));
  };
  const wholeView = () => {
    setLook(null);
    setCam(WHOLE);
    setMode(m => (m === 'free' ? 'free' : 'idle'));
  };
  const freeCam = (): Cam => (mode === 'free' ? cam : mode === 'idle' ? WHOLE : target);
  const zoomBy = (f: number, px?: number, py?: number) => {
    const c = freeCam();
    const fa = anchor('free');
    const z = clamp(c.z * f, Z_MIN, Z_MAX);
    const p = { x: px ?? fa.x, y: py ?? fa.y };
    // keep the scene point under the pointer where it is
    const sx = c.x + (p.x - fa.x) / (s * c.z);
    const sy = c.y + (p.y - fa.y) / (s * c.z);
    setCam({ x: clamp(sx - (p.x - fa.x) / (s * z), 0, SCENE_W), y: clamp(sy - (p.y - fa.y) / (s * z), 0, SCENE_H), z });
    if (mode !== 'free') setMode('free');
  };

  /** pointer position in the stage's own pixels */
  const local = (e: { clientX: number; clientY: number }) => {
    const el = stage.current!;
    const r = el.getBoundingClientRect();
    const k = r.width / el.offsetWidth || 1;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ moved: boolean; pinch: number | null }>({ moved: false, pinch: null });
  const canLook = mode === 'idle' || mode === 'free';
  const onDown = (e: RPointerEvent) => {
    if (!canLook || (e.target as Element).closest('button')) return;
    pointers.current.set(e.pointerId, local(e));
    drag.current = { moved: false, pinch: null };
    if (pointers.current.size === 2) {
      const [p, q] = [...pointers.current.values()];
      drag.current.pinch = Math.hypot(p.x - q.x, p.y - q.y);
    }
  };
  const onMove = (e: RPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = local(e);
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 2 && drag.current.pinch) {
      const [p, q] = [...pointers.current.values()];
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      zoomBy(d / drag.current.pinch, (p.x + q.x) / 2, (p.y + q.y) / 2);
      drag.current.pinch = d;
      drag.current.moved = true;
      return;
    }
    const dx = now.x - prev.x;
    const dy = now.y - prev.y;
    if (!drag.current.moved && Math.hypot(dx, dy) < 3) return;
    if (!drag.current.moved) {
      drag.current.moved = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      setDragging(true);
    }
    const c = freeCam();
    setCam({ x: clamp(c.x - dx / (s * c.z), 0, SCENE_W), y: clamp(c.y - dy / (s * c.z), 0, SCENE_H), z: c.z });
    if (mode !== 'free') setMode('free');
  };
  const onUp = (e: RPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) setDragging(false);
  };
  const onWheel = (e: RWheelEvent) => {
    if (!canLook) return;
    const p = local(e);
    zoomBy(e.deltaY < 0 ? 1.18 : 1 / 1.18, p.x, p.y);
  };

  /* ---- keys: arrows step through the film, Escape closes the examination (and not the Animals page under it) ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      } else if (mode === 'step' && e.key === 'ArrowRight') go(step + 1);
      else if (mode === 'step' && e.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [mode, step, go, onClose]);

  const film = mode === 'intro' || mode === 'step';
  const cur = mode === 'step' ? steps[step] : null;
  const lookPart = mode === 'free' && look ? partOf(group, look) : null;
  const lookFindings = lookPart ? FINDINGS[issue].filter(f => f.part === lookPart.id) : [];

  // over the whole game screen, not just the Animals panel (the stage is the phone-shaped frame)
  const host = typeof document !== 'undefined' ? document.querySelector('.stage') : null;
  const view = (
    <div className={`ex is-${mode}${film ? ' is-film' : ''}`} role="dialog" aria-modal="true" aria-label={`Examine the ${who}`}>
      <div
        ref={stage}
        className={`ex-stage is-${group}${dragging ? ' is-dragging' : ''}${canLook ? ' can-look' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <div className="ex-cam" style={{ width: SCENE_W * s, height: SCENE_H * s, transform: `translate(${tx}px, ${ty}px) scale(${target.z})`, transitionDuration: dragging ? '0ms' : mode === 'free' ? '450ms' : `${FLY}ms` }}>
          <div className={`ex-drift${cur ? ' is-on' : ''}`} key={cur ? `d${step}` : 'still'} style={cur ? { transformOrigin: `${cur.part.at.x * s}px ${cur.part.at.y * s}px` } : undefined}>
            <ExamScene
              group={group}
              marks={marks}
              spots={spots}
              rings={canLook ? [...found] : []}
              pins={mode === 'end' ? steps.map(x => x.part.id) : []}
              focus={lookPart?.id ?? null}
              onPart={canLook ? lookAt : undefined}
            />
          </div>
        </div>
        <div className="ex-spot" style={{ background: `radial-gradient(circle at ${a.x}px ${a.y}px, transparent 0, transparent 70px, rgba(16,8,4,0.62) 210px)` }} />
        <div className="ex-vignette" />
      </div>

      {/* the black bars, and the title card */}
      <div className="ex-bar is-top" />
      <div className="ex-bar is-bottom" />
      {mode === 'intro' && (
        <div className="ex-title" aria-live="polite">
          <small>Examination</small>
          <b>{group === 'cows' ? 'The sick cow' : 'The sick hens'}</b>
          <span>
            Day {day} · signs since day {since} · {steps.length} things to see
          </span>
        </div>
      )}

      <header className="ex-head">
        <p>
          <b>{film ? 'Examination' : mode === 'end' ? 'What you saw' : `Examine the ${who}`}</b>
          <span>
            {group === 'cows' ? 'Cows' : 'Hens'} · since day {since}
          </span>
        </p>
        {film && (
          <ol className="ex-dots" aria-label={`Step ${step + 1} of ${steps.length}`}>
            {steps.map((x, i) => (
              <li key={x.part.id} className={i < step ? 'is-done' : i === step && mode === 'step' ? 'is-on' : ''} />
            ))}
          </ol>
        )}
        <button type="button" className="ex-x" aria-label="Close the examination" onClick={onClose}>
          ✕
        </button>
      </header>

      {/* the standard parts to check */}
      <nav className="ex-rail" aria-label={`Parts of the ${who === 'cow' ? 'cow' : 'hen'} to check`}>
        <p>{who === 'cow' ? 'Check the cow' : 'Check the hens'}</p>
        {PARTS[group].map(p => (
          <button
            key={p.id}
            type="button"
            className={`ex-part${look === p.id && mode === 'free' ? ' is-on' : ''}${seen.has(p.id) ? (found.has(p.id) ? ' is-found' : ' is-fine') : ''}`}
            onClick={() => lookAt(p.id)}
            tabIndex={canLook ? 0 : -1}
          >
            <i aria-hidden="true" />
            {p.label}
          </button>
        ))}
      </nav>

      {/* idle: start the film */}
      {mode === 'idle' && (
        <div className="ex-start">
          <button type="button" className="ex-go" onClick={start}>
            <span aria-hidden="true">▶</span> Start the examination
          </button>
          <small>or tap a part to look for yourself · drag and zoom to look closer</small>
        </div>
      )}

      {/* the film's caption */}
      {cur && (
        <div className="ex-caption" key={`c${step}`} aria-live="polite">
          <p className="ex-kicker">
            Step {step + 1} of {steps.length} · {cur.part.label}
          </p>
          {cur.findings.map(f => (
            <div key={f.mark} className="ex-find">
              <b>{f.title}</b>
              <span>{f.see}</span>
            </div>
          ))}
          <div className="ex-ctrl">
            <button type="button" onClick={() => go(step - 1)} disabled={step === 0}>
              ‹ Back
            </button>
            <button type="button" onClick={() => setPlaying(p => !p)} aria-label={playing ? 'Pause' : 'Play'}>
              {playing ? '❚❚' : '▶'}
            </button>
            <button type="button" className="is-next" onClick={() => go(step + 1)}>
              {step === steps.length - 1 ? 'Finish ›' : 'Next ›'}
            </button>
            <button type="button" className="is-skip" onClick={() => setMode('end')}>
              Skip to the end
            </button>
          </div>
          <span className="ex-timer">
            <span style={{ animationDuration: `${HOLD}ms`, animationDelay: `${FLY}ms`, animationPlayState: playing ? 'running' : 'paused' }} onAnimationEnd={() => go(step + 1)} />
          </span>
        </div>
      )}
      {cur && cur.findings.some(f => f.reading) && (
        <div className="ex-reading" key={`r${step}`} style={{ left: a.x + 64, top: Math.max(40, a.y - 96) }}>
          {cur.findings.filter(f => f.reading).map(f => (
            <ReadingCard key={f.mark} r={f.reading!} f={f} since={since} day={day} />
          ))}
        </div>
      )}

      {/* looking for yourself: what this part shows */}
      {lookPart && (
        <div className={`ex-caption is-look${lookFindings.length ? ' is-sign' : ' is-normal'}`} key={`l${lookPart.id}`} aria-live="polite">
          <p className="ex-kicker">{lookPart.label}</p>
          {lookFindings.length ? (
            lookFindings.map(f => (
              <div key={f.mark} className="ex-find">
                <b>{f.title}</b>
                <span>{f.see}</span>
                {f.reading && <ReadingLine r={f.reading} since={since} day={day} f={f} />}
              </div>
            ))
          ) : (
            <div className="ex-find">
              <b>Nothing wrong here</b>
              <span>Healthy: {lowerFirst(lookPart.normal)}</span>
            </div>
          )}
        </div>
      )}
      {canLook && (
        <div className="ex-zoom">
          <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.4)}>
            −
          </button>
          <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.4)}>
            +
          </button>
          <button type="button" className="is-whole" onClick={wholeView}>
            Whole {who === 'cow' ? 'cow' : 'coop'}
          </button>
          {mode === 'free' && (
            <button type="button" className="is-play" onClick={start}>
              ▶ Examination
            </button>
          )}
        </div>
      )}

      {/* the end: what you saw, and the choice */}
      {mode === 'end' && (
        <aside className="ex-side" aria-label="What you saw, and what you will do">
          <ol className="ex-list">
            {steps.map(st => (
              <li key={st.part.id}>
                <small>{st.part.label}</small>
                {st.findings.map(f => f.title).join('; ')}
              </li>
            ))}
          </ol>
          <p className="ex-ask">What will you do?</p>
          {decide}
          <div className="ex-again">
            <button type="button" onClick={start}>
              ↺ Watch again
            </button>
            <button type="button" onClick={() => setMode('idle')}>
              Look for yourself
            </button>
          </div>
        </aside>
      )}
    </div>
  );
  return host ? createPortal(view, host) : view;
}

const lowerFirst = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/* ---------------- the measures ---------------- */

/** A number that counts up to its value as the card opens. */
function useCount(to: number, from: number, ms = 1200, decimals = 0) {
  const [v, setV] = useState(reduced() ? to : from);
  useEffect(() => {
    if (reduced()) return setV(to);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const e = 1 - Math.pow(1 - k, 3);
      setV(from + (to - from) * e);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, from, ms]);
  return Number(v.toFixed(decimals));
}

/** The days a sign has lasted (at most the last five), each with what was seen that day. */
function daysOf(r: Extract<Reading, { kind: 'days' }>, since: number, day: number) {
  const first = Math.max(since, day - 4);
  const out: { day: number; text: string; bad: boolean }[] = [];
  if (r.what === 'eggs') {
    const usual = Math.round(LIFE.eggs.perHen * 5);
    if (first > 1) out.push({ day: first - 1, text: `${usual} eggs`, bad: false });
    for (let d = first, n = 0; d <= day; d++, n++) out.push({ day: d, text: `${Math.max(0, usual - 1 - n)} egg${usual - 1 - n === 1 ? '' : 's'}`, bad: true });
    return out;
  }
  if (first > 1) out.push({ day: first - 1, text: 'eaten', bad: false });
  for (let d = first; d <= day; d++) out.push({ day: d, text: 'untouched', bad: true });
  return out;
}

function ReadingCard({ r, f, since, day }: { r: Reading; f: Finding; since: number; day: number }) {
  if (r.kind === 'temp') return <TempCard r={r} />;
  if (r.kind === 'rate') return <RateCard r={r} />;
  if (r.kind === 'days')
    return (
      <div className="ex-card">
        <small>{r.what === 'eggs' ? 'Eggs collected' : 'Her feed'}</small>
        <ul className="ex-days">
          {daysOf(r, since, day).map((d, i) => (
            <li key={d.day} className={d.bad ? 'is-bad' : ''} style={{ animationDelay: `${0.25 + i * 0.18}s` }}>
              <span>Day {d.day}</span>
              {d.text}
            </li>
          ))}
        </ul>
      </div>
    );
  return <AmountCard r={r} f={f} />;
}

function TempCard({ r }: { r: Extract<Reading, { kind: 'temp' }> }) {
  const lo = 36;
  const hi = 42;
  const v = useCount(r.value, 38.4, 1600, 1);
  const pos = (t: number) => `${((t - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="ex-card">
      <small>Thermometer</small>
      <p className="ex-big is-bad">{v.toFixed(1)} °C</p>
      <div className="ex-scale">
        <span className="ex-band" style={{ left: pos(r.normal[0]), width: `calc(${pos(r.normal[1])} - ${pos(r.normal[0])})` }} />
        <span className="ex-needle" style={{ left: pos(v) }} />
      </div>
      <p className="ex-norm">
        Normal {r.normal[0]}–{r.normal[1]} °C
      </p>
    </div>
  );
}

function RateCard({ r }: { r: Extract<Reading, { kind: 'rate' }> }) {
  const v = useCount(r.value, 0, 1400);
  return (
    <div className="ex-card">
      <small>Counted for a minute</small>
      <p className="ex-big is-bad">
        <i className="ex-beat" style={{ animationDuration: `${60 / r.value}s` }} aria-hidden="true" />
        {v}
      </p>
      <p className="ex-norm">
        {r.unit} · normal {r.normal[0]}–{r.normal[1]}
      </p>
    </div>
  );
}

function AmountCard({ r, f }: { r: Extract<Reading, { kind: 'amount' }>; f: Finding }) {
  const v = useCount(r.value, r.usual, 1400);
  const max = Math.max(r.value, r.usual) * 1.1;
  return (
    <div className="ex-card">
      <small>{f.part === 'tank' ? 'The tank, a day' : 'Measured'}</small>
      <p className="ex-big is-bad">
        {v} <em>{r.unit}</em>
      </p>
      <div className="ex-bars">
        <span>
          Usual <b style={{ width: `${(r.usual / max) * 100}%` }} className="is-usual" />
        </span>
        <span>
          Now <b style={{ width: `${(v / max) * 100}%` }} />
        </span>
      </div>
    </div>
  );
}

/** The measure in a line, when the player looks for themselves. */
function ReadingLine({ r, since, day }: { r: Reading; f: Finding; since: number; day: number }) {
  const text =
    r.kind === 'temp'
      ? `${r.value} °C (normal ${r.normal[0]}–${r.normal[1]} °C)`
      : r.kind === 'rate'
        ? `${r.value} ${r.unit} (normal ${r.normal[0]}–${r.normal[1]})`
        : r.kind === 'amount'
          ? `${r.value} ${r.unit} (usually ${r.usual})`
          : daysOf(r, since, day)
              .map(d => `day ${d.day}: ${d.text}`)
              .join(' · ');
  return <em className="ex-measure">{text}</em>;
}
