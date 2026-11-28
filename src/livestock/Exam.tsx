import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as RPointerEvent, type ReactNode, type WheelEvent as RWheelEvent } from 'react';
import { useVoice } from '../art/style';
import { money } from '../money';
import { sfx } from '../sfx';
import { speak, stopSpeaking } from '../speech';
import type { Action, GameState } from '../state';
import { CHECKS, checksOf, earlyToday, keyOf, type Shown } from '../inspect/model';
import { subjectOf } from '../inspect/subjects';
import type { Part, SubjectId } from '../inspect/types';
import { LIFE, type IssueId } from './config';
import { ExamScene } from './ExamScene';
import { FINDINGS, marksOf, spotsOf, type Finding, type Reading } from './exam';
import { urgentOf } from '../inspect/urgent';
import { lifeOf } from './model';

/* A full check, up close: an animal (or, src/inspect/subjects.ts, anything else on the farm a routine check covers).
   The whole drawing first, its parts listed in sections in the order they are checked. When something is wrong, the
   parts that show it are red, first in line: START THE EXAMINATION (a title card) has the player tap each red part on
   the drawing itself, its eyes, its nose, its udder; a glowing ring and a pointing hand show which one is next. Each
   tap flies the camera there with a caption and the measure, and at the end the player chooses the fix beside them.
   FINISH THE CHECK then asks for the rest: a check of only the red parts misses what is starting elsewhere, so the
   player taps each part not seen yet, the hint moving on to the next. Healthy parts return to the whole drawing by
   themselves; an early sign (src/inspect/early.ts) waits, to be fixed now (a few seconds' work and its cost) or
   planned for a day. The list of parts is the progress readout. At any time the player can look for themselves: tap
   a part on the drawing, drag to look round, and zoom with the wheel, a pinch or the + and − buttons. */

/** A red sign: an animal's problem (exam.ts FINDINGS), or what is wrong now on a machine or place (inspect/urgent.ts). */
interface Sign {
  part: string;
  mark: string;
  title: string;
  see: string;
  reading?: Reading;
  at?: { x: number; y: number };
}
/** One stop of the film: a part, and its red signs. */
interface Step {
  part: Part;
  findings: Sign[];
}

/** hunt: the whole drawing, waiting for the player to tap the part the hint shows; step: a red part, up close; sweep: one of the rest, up close */
type Mode = 'idle' | 'intro' | 'hunt' | 'step' | 'end' | 'free' | 'ask' | 'sweep' | 'done';
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
/** a wrong tap's note stays this long (ms) */
const NUDGE = 2400;
/** the rest: the flight to a part, and how long a healthy part and a red one hold before the whole drawing comes back (ms) */
const SWEEP_FLY = 650;
const SWEEP_FINE = 1500;
const SWEEP_RED = 2600;
/** the parts list's right edge, and the summary's width */
const RAIL = 236;
const SIDE = 300;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** No motion: the phone asks for it, or Settings › Reduce motion is on (it stops every animation, the caption bar too). */
const reduced = () => typeof window !== 'undefined' && (!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || !!document.querySelector('.stage.reduce-motion'));

interface Props {
  s: GameState;
  dispatch: Dispatch<Action>;
  subject: SubjectId;
  /** the problem showing: its signs are the red parts. None for a routine check. */
  issue?: IssueId | null;
  /** the farm day the problem showed */
  since?: number;
  onClose: () => void;
  /** the fixes to choose from, at the end */
  decide?: ReactNode;
  /** a plant check: the crops to switch between (each its own drawing) */
  crops?: { list: { id: SubjectId; label: string }[]; pick: (id: SubjectId) => void };
  /** a check in steps (the farm: the plants first, then the farm): where this one is */
  stepOf?: string;
  /** and the next step, offered when this one is done */
  then?: { label: string; go: () => void };
}

export function Exam({ s, dispatch, subject, issue = null, since = 0, onClose, decide, crops, stepOf, then }: Props) {
  const def = subjectOf(subject);
  const day = lifeOf(s.life).day;
  const voice = useVoice();
  /** the parts in their sections' order */
  const order = useMemo(() => def.sections.flatMap(sc => sc.parts), [def]);
  // the red signs: the problem's, or (a machine or place) what is wrong now, as the check opened
  const [now] = useState(() => (def.group ? [] : urgentOf(s, subject)));
  const findings: Sign[] = useMemo(() => (issue ? (FINDINGS[issue] as Sign[]) : now), [issue, now]);
  const steps: Step[] = useMemo(
    () =>
      order
        .filter(id => findings.some(f => f.part === id))
        .map(id => {
          const mine = findings.filter(f => f.part === id);
          const p = def.parts.find(x => x.id === id)!;
          const moved = mine.find(f => f.at)?.at;
          return { part: moved ? { ...p, at: { ...p.at, ...moved } } : p, findings: mine };
        }),
    [findings, order, def],
  );
  const marks = useMemo(() => (issue ? (marksOf(issue) as Set<string>) : new Set(now.map(f => f.mark))), [issue, now]);
  const spots = useMemo(() => spotsOf(issue) as Record<string, { x: number; y: number }>, [issue]);
  const red = useMemo(() => new Set<string>(findings.map(f => f.part)), [findings]);
  // today's early signs, as the check opened (a sign dealt with stays on the list, ticked)
  const [signs] = useState<Shown[]>(() => earlyToday(s.checks, subject, day, lifeOf(s.life).issues.map(i => i.id)));
  const checks = checksOf(s.checks);
  const isFixed = (e: Shown) => checks.fixed[keyOf(subject, e.id)] === day;
  const plannedFor = (e: Shown) => checks.planned[keyOf(subject, e.id)];
  const signAt = (part: string) => signs.filter(e => e.part === part);
  const partOf = (id: string): Part => {
    const p = def.parts.find(x => x.id === id)!;
    return spots[id] ? { ...p, at: { ...p.at, ...spots[id] } } : p;
  };

  const [mode, setMode] = useState<Mode>('idle');
  const [look, setLook] = useState<string | null>(null);
  const [cam, setCam] = useState<Cam>(WHOLE);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [dragging, setDragging] = useState(false);
  /** the parts to tap, in order: the red ones (the examination) or the rest; the ones tapped so far; the one open now */
  const [run, setRun] = useState<'red' | 'rest'>('red');
  const [queue, setQueue] = useState<string[]>([]);
  const [got, setGot] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  /** a tap on a part that is not next: a note for a moment */
  const [nudge, setNudge] = useState<string | null>(null);
  /** an early sign being fixed (its timer runs), or just fixed */
  const [work, setWork] = useState<{ id: string; done: boolean } | null>(null);
  const see = useCallback((id: string) => setSeen(v => (v.has(id) ? v : new Set(v).add(id))), []);

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
  const sc = Math.min(size.w / SCENE_W, size.h / SCENE_H);

  const sweepPart = mode === 'sweep' ? open : null;
  /** the part the hint points at: the next one not tapped yet */
  const nextId = mode === 'hunt' || mode === 'step' || mode === 'sweep' ? (queue.find(id => !got.includes(id)) ?? null) : null;
  const stepAt = mode === 'step' && open ? got.indexOf(open) : -1;
  const curStep = stepAt >= 0 ? (steps.find(x => x.part.id === open) ?? null) : null;
  /** where on the stage the camera's point sits: right of the parts list, above the caption, or left of the summary */
  const anchor = (m: Mode) => {
    if (m === 'step' || m === 'intro') return { x: size.w * 0.56, y: size.h * 0.37 };
    if (m === 'end' || m === 'done') return { x: (size.w - SIDE) / 2, y: size.h / 2 };
    if (m === 'sweep') return { x: RAIL + (size.w - RAIL) / 2, y: size.h * 0.36 };
    if (m === 'free') return { x: RAIL + (size.w - RAIL) / 2, y: size.h * 0.42 };
    if (m === 'hunt') return { x: RAIL + (size.w - RAIL) / 2, y: size.h * 0.5 };
    return { x: RAIL + (size.w - RAIL) / 2, y: size.h * 0.46 };
  };
  const endZoom = clamp((size.w - SIDE - 16) / (SCENE_W * sc), 0.6, 0.95);
  const restZoom = clamp((size.w - RAIL - 12) / (SCENE_W * sc), 0.6, WHOLE.z);
  const target: Cam =
    mode === 'step' && curStep
      ? curStep.part.at
      : mode === 'sweep' && sweepPart
        ? partOf(sweepPart).at
        : mode === 'free'
          ? cam
          : mode === 'intro'
            ? { ...WHOLE, z: 1.08 }
            : mode === 'end' || mode === 'done'
              ? { ...WHOLE, z: endZoom }
              : { ...WHOLE, z: restZoom };
  const a = anchor(mode);
  const tx = a.x - target.x * sc * target.z;
  const ty = a.y - target.y * sc * target.z;

  /* ---- tapping the parts: the red ones first (the examination), then the rest ---- */
  const begin = (r: 'red' | 'rest', ids: string[]) => {
    sfx.action();
    setLook(null);
    setWork(null);
    setNudge(null);
    setRun(r);
    setQueue(ids);
    setGot([]);
    setOpen(null);
    setMode(r === 'red' ? 'intro' : 'hunt');
  };
  const start = () => begin('red', steps.map(x => x.part.id));
  useEffect(() => {
    if (mode !== 'intro') return;
    const t = window.setTimeout(() => setMode('hunt'), reduced() ? 300 : 1500);
    return () => window.clearTimeout(t);
  }, [mode]);
  /** a tap on the drawing while the hint shows the way */
  const tapPart = (id: string) => {
    if (!queue.includes(id) || got.includes(id)) {
      if (id !== open) setNudge(id);
      return;
    }
    setWork(null);
    setNudge(null);
    setGot(g => [...g, id]);
    setOpen(id);
    setMode(run === 'red' ? 'step' : 'sweep');
  };
  useEffect(() => {
    if (!nudge) return;
    const t = window.setTimeout(() => setNudge(null), NUDGE);
    return () => window.clearTimeout(t);
  }, [nudge]);
  // each red part tapped: mark it seen, a sound, and read it aloud when Read aloud is on
  useEffect(() => {
    if (mode !== 'step' || !curStep) return;
    see(curStep.part.id);
    sfx.flow();
    if (voice) speak(`${curStep.part.label}. ${curStep.findings.map(f => `${f.title}. ${f.see}`).join(' ')}`);
  }, [mode, curStep, voice, see]);
  useEffect(() => () => stopSpeaking(), []);

  /* ---- finishing: every part, or the sweep of the rest first ---- */
  const left = order.filter(id => !seen.has(id));
  const reported = useRef(false);
  const finishAll = () => {
    setLook(null);
    setMode('done');
    if (!reported.current) {
      reported.current = true;
      dispatch({ type: 'checkDone', subject, checked: order.length });
    }
  };
  const finish = () => {
    sfx.action();
    if (left.length === 0) finishAll();
    else {
      setLook(null);
      setMode('ask');
    }
  };
  const sweep = (ids = left) => begin('rest', ids);
  const leaveEarly = () => {
    dispatch({ type: 'checkDone', subject, checked: seen.size });
    onClose();
  };
  /** done with the part open: back to the whole drawing for the next tap, or on to the end */
  const next = useCallback(() => {
    setWork(null);
    setOpen(null);
    if (queue.some(id => !got.includes(id))) setMode('hunt');
    else if (run === 'red') setMode('end');
    else {
      setMode('done');
      if (!reported.current) {
        reported.current = true;
        dispatch({ type: 'checkDone', subject, checked: order.length });
      }
    }
  }, [queue, got, run, dispatch, subject, order.length]);
  const skip = () => {
    setOpen(null);
    if (run === 'red') setMode('end');
    else finishAll();
  };
  /** what the sweep found at its part: an early sign still to deal with, a red sign, or nothing */
  const sweepSign = sweepPart ? signAt(sweepPart).find(e => !isFixed(e) && plannedFor(e) === undefined) : undefined;
  const sweepRed = sweepPart ? findings.filter(f => f.part === sweepPart) : [];
  useEffect(() => {
    if (mode !== 'sweep' || !sweepPart) return;
    see(sweepPart);
    if (sweepSign) {
      sfx.flow();
      if (voice) speak(`${partOf(sweepPart).label}. An early sign: ${sweepSign.title}. ${sweepSign.risk}`);
    }
  }, [mode, open]); // eslint-disable-line react-hooks/exhaustive-deps
  // a healthy part (or a red one already known) moves on by itself
  useEffect(() => {
    if (mode !== 'sweep' || !sweepPart || sweepSign || work) return;
    const t = window.setTimeout(next, SWEEP_FLY + (sweepRed.length ? SWEEP_RED : SWEEP_FINE));
    return () => window.clearTimeout(t);
  }, [mode, open, sweepPart, sweepSign, sweepRed.length, work, next]);

  /** deal with an early sign now: its few seconds of work, then it is done */
  const fixNow = (e: Shown) => {
    if (s.coins < e.fix.cost) {
      dispatch({ type: 'checkFix', subject, id: e.id });
      return;
    }
    sfx.action();
    setWork({ id: e.id, done: false });
  };
  useEffect(() => {
    if (!work || work.done) return;
    const e = signs.find(x => x.id === work.id)!;
    const t = window.setTimeout(() => {
      dispatch({ type: 'checkFix', subject, id: e.id });
      setWork({ id: e.id, done: true });
    }, e.fix.secs * 1000);
    return () => window.clearTimeout(t);
  }, [work, signs, dispatch, subject]);
  useEffect(() => {
    if (!work?.done || mode !== 'sweep') return;
    const t = window.setTimeout(next, 700);
    return () => window.clearTimeout(t);
  }, [work, mode, next]);
  const plan = (e: Shown, on: number) => {
    sfx.action();
    dispatch({ type: 'checkPlan', subject, id: e.id, day: on });
    if (mode === 'sweep') next();
  };

  /* ---- looking for yourself ---- */
  const lookAt = (id: string) => {
    const p = partOf(id);
    setLook(id);
    setWork(null);
    setCam(p.at);
    setMode('free');
    see(id);
  };
  const wholeView = () => {
    setLook(null);
    setCam(WHOLE);
    setMode(m => (m === 'free' ? 'free' : 'idle'));
  };
  const freeCam = (): Cam => (mode === 'free' ? cam : mode === 'idle' ? { ...WHOLE, z: restZoom } : target);
  const zoomBy = (f: number, px?: number, py?: number) => {
    const c = freeCam();
    const fa = anchor('free');
    const z = clamp(c.z * f, Math.min(Z_MIN, restZoom), Z_MAX);
    const p = { x: px ?? fa.x, y: py ?? fa.y };
    // keep the scene point under the pointer where it is
    const sx = c.x + (p.x - fa.x) / (sc * c.z);
    const sy = c.y + (p.y - fa.y) / (sc * c.z);
    setCam({ x: clamp(sx - (p.x - fa.x) / (sc * z), 0, SCENE_W), y: clamp(sy - (p.y - fa.y) / (sc * z), 0, SCENE_H), z });
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
    setCam({ x: clamp(c.x - dx / (sc * c.z), 0, SCENE_W), y: clamp(c.y - dy / (sc * c.z), 0, SCENE_H), z: c.z });
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

  /* ---- keys: the right arrow moves on from a red part, Escape closes the examination (and not the page under it) ---- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        e.preventDefault();
        onClose();
      } else if (mode === 'step' && e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [mode, next, onClose]);

  const film = mode === 'intro' || mode === 'step';
  const cur = curStep;
  const tapping = mode === 'hunt' || mode === 'step' || mode === 'sweep';
  const step = Math.max(0, stepAt);
  const nextPart = nextId ? partOf(nextId) : null;
  const toGo = queue.filter(id => !got.includes(id));
  const lookPart = mode === 'free' && look ? partOf(look) : null;
  const lookFindings = lookPart ? findings.filter(f => f.part === lookPart.id) : [];
  const lookSigns = lookPart ? signAt(lookPart.id) : [];
  // what the drawing shows: the early signs not yet dealt with; amber rings on the ones found
  const showing = signs.filter(e => !isFixed(e) && !(work?.done && work.id === e.id));
  const amber = [...new Set(showing.filter(e => seen.has(e.part)).map(e => e.part))];
  const redSeen = [...red].filter(id => seen.has(id)).length;
  const focus = lookPart?.id ?? sweepPart ?? null;

  // over the whole game screen, not just the page under it (the stage is the phone-shaped frame)
  const host = typeof document !== 'undefined' ? document.querySelector('.stage') : null;
  const view = (
    <div className={`ex is-${mode}${film ? ' is-film' : ''}`} role="dialog" aria-modal="true" aria-label={def.title}>
      <div
        ref={stage}
        className={`ex-stage is-${subject}${dragging ? ' is-dragging' : ''}${canLook ? ' can-look' : ''}`}
        style={{ background: def.ground }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onWheel={onWheel}
      >
        <div
          className="ex-cam"
          style={{ width: SCENE_W * sc, height: SCENE_H * sc, transform: `translate(${tx}px, ${ty}px) scale(${target.z})`, transitionDuration: dragging ? '0ms' : mode === 'free' ? '450ms' : mode === 'sweep' ? `${SWEEP_FLY}ms` : `${FLY}ms` }}
        >
          <div className={`ex-drift${cur ? ' is-on' : ''}`} key={cur ? `d${step}` : 'still'} style={cur ? { transformOrigin: `${cur.part.at.x * sc}px ${cur.part.at.y * sc}px` } : undefined}>
            <ExamScene
              subject={subject}
              marks={marks}
              early={showing.map(e => e.id)}
              spots={spots}
              rings={canLook || mode === 'ask' ? [...red] : mode === 'hunt' && run === 'red' ? toGo.filter(id => id !== nextId) : []}
              amber={canLook || mode === 'ask' || mode === 'done' || mode === 'hunt' ? amber : []}
              todo={mode === 'ask' ? left : mode === 'hunt' && run === 'rest' ? toGo.filter(id => id !== nextId) : []}
              pins={mode === 'end' ? steps.map(x => x.part.id) : []}
              focus={focus}
              hint={mode === 'hunt' ? nextId : null}
              onPart={canLook ? lookAt : tapping ? tapPart : undefined}
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
          <b>{issue ? `The sick ${def.name}` : `The ${def.name}`}</b>
          <span>
            Day {day} · {issue ? `signs since day ${since} · ` : ''}
            {steps.length} {steps.length === 1 ? 'thing' : 'things'} to see
          </span>
        </div>
      )}

      <header className="ex-head">
        <p>
          <b>{film || (mode === 'hunt' && run === 'red') ? 'Examination' : mode === 'end' ? 'What you saw' : mode === 'sweep' || mode === 'hunt' ? 'Checking the rest' : mode === 'done' ? 'Check done' : def.title}</b>
          <span>{issue ? `${def.group === 'cows' ? 'Cows' : 'Hens'} · since day ${since}` : `Day ${day} · ${stepOf ?? 'a routine check'}`}</span>
        </p>
        {crops && (mode === 'idle' || mode === 'free' || mode === 'done') && (
          <span className="ex-crops" role="group" aria-label="Which plant">
            {crops.list.map(c => (
              <button key={c.id} type="button" className={c.id === subject ? 'is-on' : ''} aria-pressed={c.id === subject} onClick={() => c.id !== subject && crops.pick(c.id)}>
                {c.label}
              </button>
            ))}
          </span>
        )}
        {(film || mode === 'hunt') && run === 'red' && (
          <ol className="ex-dots" aria-label={`${got.length} of ${queue.length} red parts tapped`}>
            {queue.map(id => (
              <li key={id} className={id === open && mode === 'step' ? 'is-on' : got.includes(id) ? 'is-done' : ''} />
            ))}
          </ol>
        )}
        <button type="button" className="ex-x" aria-label="Close the examination" onClick={onClose}>
          ✕
        </button>
      </header>

      {/* the parts to check, in sections, as a progress readout; the red ones first in line. The parts are tapped on the drawing. */}
      <nav className="ex-rail" aria-label={`Parts of the ${def.name} to check`}>
        {mode === 'hunt' && nextPart && (
          <div className={`ex-hunt${nudge ? ' is-nudge' : ''}`} aria-live="polite">
            <p className="ex-kicker">
              {run === 'red' ? 'Red part' : 'Part'} {got.length + 1} of {queue.length}
            </p>
            <b>
              <i aria-hidden="true" /> {nextPart.label}
            </b>
            <small>Tap the glowing ring on the {def.name}</small>
            {nudge && <span>{got.includes(nudge) || seen.has(nudge) ? `${partOf(nudge).label}: already checked.` : run === 'red' ? 'The red parts first.' : 'Not that one yet.'}</span>}
            <button type="button" className="ex-link" onClick={skip}>
              Skip to the end
            </button>
          </div>
        )}
        <p className="ex-rail-head">
          {def.rail}
          <span>
            {seen.size}/{order.length}
          </span>
        </p>
        <span className="ex-meter" aria-hidden="true">
          <span style={{ width: `${(seen.size / order.length) * 100}%` }} />
        </span>
        {red.size > 0 && (
          <p className="ex-first">
            <i aria-hidden="true" /> {redSeen < red.size ? `Look at the ${red.size} red parts first` : 'Red parts seen: now the rest'}
          </p>
        )}
        {def.sections.map(sec => {
          const n = sec.parts.filter(id => seen.has(id)).length;
          const reds = sec.parts.filter(id => red.has(id)).length;
          return (
            <div key={sec.label} className={`ex-sec${reds ? ' has-red' : ''}${n === sec.parts.length ? ' is-done' : ''}`}>
              <p className="ex-sec-head">
                <span>{sec.label}</span>
                {reds > 0 && <b aria-label={`${reds} red`}>{reds}</b>}
                <small>{n === sec.parts.length ? '✓' : `${n}/${sec.parts.length}`}</small>
              </p>
              <div className="ex-sec-parts">
                {sec.parts.map(id => {
                  const p = def.parts.find(x => x.id === id)!;
                  const sign = seen.has(id) && signAt(id).some(e => !isFixed(e));
                  const state = !seen.has(id) ? '' : red.has(id) ? ' is-found' : sign ? ' is-early' : ' is-fine';
                  return (
                    <span
                      key={id}
                      className={`ex-part${red.has(id) ? ' is-red' : ''}${state}${(look === id && mode === 'free') || sweepPart === id ? ' is-on' : ''}${nextId === id && mode === 'hunt' ? ' is-next' : ''}`}
                    >
                      <i aria-hidden="true" />
                      {p.label}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
        {(mode === 'idle' || mode === 'free') && (
          <button type="button" className={`ex-finish${left.length === 0 ? ' is-ready' : ''}`} onClick={finish}>
            ✓ Finish the check
          </button>
        )}
      </nav>

      {/* idle: start the film of the red parts, or the check of every part */}
      {mode === 'idle' && (
        <div className="ex-start">
          {steps.length ? (
            <button type="button" className="ex-go" onClick={start}>
              <span aria-hidden="true">▶</span> Start the examination
            </button>
          ) : (
            <button type="button" className="ex-go" onClick={() => sweep(order.filter(id => !seen.has(id)))}>
              <span aria-hidden="true">▶</span> Check every part
            </button>
          )}
          <small>or tap any part of the {def.name} to look for yourself · drag and zoom to look closer</small>
          {then && (
            <button type="button" className="ex-link ex-then-link" onClick={then.go}>
              {then.label} ›
            </button>
          )}
        </div>
      )}

      {/* the film's caption */}
      {cur && (
        <div className="ex-caption" key={`c${step}`} aria-live="polite">
          <p className="ex-kicker">
            Step {step + 1} of {queue.length} · {cur.part.label}
          </p>
          {cur.findings.map(f => (
            <div key={f.mark} className="ex-find">
              <b>{f.title}</b>
              <span>{f.see}</span>
            </div>
          ))}
          <div className="ex-ctrl">
            <button type="button" className="is-next" onClick={next}>
              {toGo.length === 0 ? 'Finish ›' : 'Next ›'}
            </button>
            <button type="button" className="is-skip" onClick={skip}>
              Skip to the end
            </button>
          </div>
        </div>
      )}
      {cur && cur.findings.some(f => f.reading) && (
        <div className="ex-reading" key={`r${step}`} style={{ left: a.x + 64, top: Math.max(40, a.y - 96) }}>
          {cur.findings
            .filter(f => f.reading)
            .map(f => (
              <ReadingCard key={f.mark} r={f.reading!} f={f as Finding} since={since} day={day} />
            ))}
        </div>
      )}

      {/* looking for yourself: what this part shows */}
      {lookPart && (
        <div className={`ex-caption is-look${lookFindings.length ? ' is-sign' : lookSigns.length ? ' is-early' : ' is-normal'}`} key={`l${lookPart.id}`} aria-live="polite">
          <p className="ex-kicker">{lookPart.label}</p>
          {lookFindings.map(f => (
            <div key={f.mark} className="ex-find">
              <b>{f.title}</b>
              <span>{f.see}</span>
              {f.reading && <ReadingLine r={f.reading} since={since} day={day} f={f as Finding} />}
            </div>
          ))}
          {lookSigns.map(e => (
            <EarlySign key={e.id} e={e} day={day} fixed={isFixed(e)} planned={plannedFor(e)} working={work?.id === e.id ? work : null} coins={s.coins} onFix={() => fixNow(e)} onPlan={on => plan(e, on)} />
          ))}
          {!lookFindings.length && !lookSigns.length && (
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
            {def.whole}
          </button>
          {mode === 'free' && steps.length > 0 && (
            <button type="button" className="is-play" onClick={start}>
              ▶ Examination
            </button>
          )}
        </div>
      )}

      {/* only the red parts seen: check the rest too */}
      {mode === 'ask' && (
        <div className="ex-ask-card" role="alertdialog" aria-label="Check the rest too?">
          <p className="ex-kicker">{red.size ? `${redSeen} of ${red.size} red parts seen` : `${seen.size} of ${order.length} parts seen`}</p>
          <b>
            {left.length} part{left.length === 1 ? '' : 's'} not checked yet
          </b>
          <span>Problems start small. A quick look at each (about {Math.max(5, Math.round((left.length * (SWEEP_FLY + SWEEP_FINE)) / 1000))} seconds) finds what is starting, while it is cheap to fix or plan.</span>
          <ul className="ex-todo">
            {def.sections
              .filter(sec => sec.parts.some(id => !seen.has(id)))
              .map(sec => (
                <li key={sec.label}>
                  <small>{sec.label}</small>
                  {sec.parts
                    .filter(id => !seen.has(id))
                    .map(id => def.parts.find(x => x.id === id)!.label)
                    .join(' · ')}
                </li>
              ))}
          </ul>
          <div className="ex-ask-go">
            <button type="button" className="ex-go" onClick={() => sweep()}>
              <span aria-hidden="true">▶</span> Check the other {left.length}
            </button>
            <button type="button" className="ex-link" onClick={leaveEarly}>
              Finish without them
            </button>
          </div>
        </div>
      )}

      {/* the sweep: each part not seen yet, a moment each */}
      {mode === 'sweep' && sweepPart && (
        <div className={`ex-caption is-sweep${sweepSign || work ? ' is-early' : sweepRed.length ? ' is-sign' : ' is-normal'}`} key={`s${sweepPart}`} aria-live="polite">
          <p className="ex-kicker">
            Part {got.indexOf(sweepPart) + 1} of {queue.length} · {partOf(sweepPart).label}
          </p>
          {sweepRed.map(f => (
            <div key={f.mark} className="ex-find">
              <b>{f.title}</b>
              <span>{f.see}</span>
            </div>
          ))}
          {work ? (
            <EarlySign e={signs.find(x => x.id === work.id)!} day={day} fixed={work.done} working={work} coins={s.coins} onFix={() => undefined} onPlan={() => undefined} />
          ) : sweepSign ? (
            <EarlySign e={sweepSign} day={day} fixed={false} working={null} coins={s.coins} onFix={() => fixNow(sweepSign)} onPlan={on => plan(sweepSign, on)} onLeave={next} />
          ) : (
            !sweepRed.length && (
              <div className="ex-find">
                <b>✓ Looks healthy</b>
                <span>{partOf(sweepPart).normal}</span>
              </div>
            )
          )}
          {!sweepSign && !work && (
            <span className="ex-timer">
              <span style={{ animationDuration: `${sweepRed.length ? SWEEP_RED : SWEEP_FINE}ms`, animationDelay: `${SWEEP_FLY}ms` }} />
            </span>
          )}
          <div className="ex-ctrl">
            {!sweepSign && !work && (
              <button type="button" className="is-next" onClick={next}>
                {toGo.length === 0 ? 'Finish ›' : 'Next ›'}
              </button>
            )}
            <button type="button" className="is-skip" onClick={skip}>
              Skip to the end
            </button>
          </div>
        </div>
      )}

      {/* the film's end: what you saw, and the choice */}
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
          <button type="button" className="ex-finish is-wide" onClick={finish}>
            ✓ Finish the check
          </button>
          <div className="ex-again">
            <button type="button" onClick={start}>
              ↺ Examine again
            </button>
            <button type="button" onClick={() => setMode('idle')}>
              Look for yourself
            </button>
          </div>
        </aside>
      )}

      {/* every part checked: what was found, and what was done about it */}
      {mode === 'done' && (
        <aside className="ex-side ex-done" aria-label="The check, done">
          <p className="ex-done-head">
            <i aria-hidden="true">✓</i> Every part checked <small>{order.length} of {order.length}</small>
          </p>
          {red.size > 0 && decide && (
            <>
              <p className="ex-done-sub is-red">
                {red.size} red part{red.size === 1 ? '' : 's'}: {findings.map(f => f.title.toLowerCase()).slice(0, 3).join('; ')}
              </p>
              <p className="ex-ask">What will you do?</p>
              {decide}
            </>
          )}
          <p className="ex-done-sub">{signs.length ? `Early sign${signs.length === 1 ? '' : 's'} found (${signs.length})` : 'No early signs today'}</p>
          <ul className="ex-early-list">
            {signs.map(e => (
              <li key={e.id}>
                <EarlySign e={e} day={day} fixed={isFixed(e)} planned={plannedFor(e)} working={work?.id === e.id ? work : null} coins={s.coins} compact onFix={() => fixNow(e)} onPlan={on => plan(e, on)} />
              </li>
            ))}
          </ul>
          <p className="ex-done-sub is-fine">{order.length - red.size - new Set(signs.map(e => e.part)).size} parts healthy</p>
          {then && (
            <button type="button" className="ex-finish is-wide ex-then" onClick={then.go}>
              {then.label} ›
            </button>
          )}
          <div className="ex-again">
            <button type="button" onClick={onClose}>
              Close
            </button>
            <button type="button" onClick={() => setMode('idle')}>
              Look again
            </button>
          </div>
        </aside>
      )}
    </div>
  );
  return host ? createPortal(view, host) : view;
}

/* ---------------- an early sign: fix it now, or plan it ---------------- */

function EarlySign({
  e,
  day,
  fixed,
  planned,
  working,
  coins,
  compact,
  onFix,
  onPlan,
  onLeave,
}: {
  e: Shown;
  day: number;
  fixed: boolean;
  planned?: number;
  working: { id: string; done: boolean } | null;
  coins: number;
  compact?: boolean;
  onFix: () => void;
  onPlan: (day: number) => void;
  onLeave?: () => void;
}) {
  const cost = e.fix.cost ? money(e.fix.cost) : 'free';
  return (
    <div className={`ex-early${fixed ? ' is-fixed' : planned !== undefined ? ' is-planned' : ''}${compact ? ' is-compact' : ''}`}>
      <p className="ex-early-tag">{fixed ? '✓ Dealt with' : planned !== undefined ? `Planned · day ${planned}${planned < day ? ' (overdue)' : planned === day ? ' (today)' : ''}` : 'Early sign'}</p>
      <b>{e.title}</b>
      {!compact && <span>{e.see}</span>}
      {!fixed && <em className="ex-risk">Left alone: {lowerFirst(e.risk)}</em>}
      {working && !working.done ? (
        <div className="ex-work" role="status">
          <span>{e.fix.doing}</span>
          <span className="ex-work-bar">
            <span style={{ animationDuration: `${e.fix.secs}s` }} />
          </span>
        </div>
      ) : (
        !fixed && (
          <div className="ex-early-do">
            <button type="button" className="is-fix" onClick={onFix} disabled={coins < e.fix.cost} title={coins < e.fix.cost ? `You need ${money(e.fix.cost - coins)} more` : undefined}>
              {e.fix.label} · {cost} · {e.fix.secs} s
            </button>
            <span className="ex-plan" role="group" aria-label={`Plan: ${e.fix.label}`}>
              <small>or plan it:</small>
              {CHECKS.planDays.map(d => (
                <button key={d} type="button" className={planned === day + d ? 'is-on' : ''} onClick={() => onPlan(day + d)}>
                  {d === 1 ? 'Tomorrow' : `Day ${day + d}`}
                </button>
              ))}
            </span>
            {onLeave && (
              <button type="button" className="ex-link" onClick={onLeave}>
                Leave it
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
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
