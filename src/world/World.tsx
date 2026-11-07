import { Suspense, lazy, useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as RPointerEvent } from 'react';
import { img } from '../assets';
import { FarmerPortrait } from '../first/art';
import { LOOKS } from '../first/data';
import { Inspect } from '../rounds/Inspect';
import { dayNumber, ROUND_POINTS } from '../rounds/farms';
import { trialRounds } from '../rounds/trial';
import type { Action, GameState } from '../state';
import { CHECK_DAYS, DAMAGE, WRONG_FIX_COST, canTreat, causeOf, checkKey, farmName, hazardFor, plotsOf, returnedProblem } from '../trials/model';
import { fmt } from '../components/ui';
import { track } from '../first/track';
import { FOLLOW_UP, PRESCRIBE, fixOrder } from '../care/data';
import { voiceFor } from '../care/voice';
import {
  CARRY_NAME,
  TREAT_JOB,
  allHarvested,
  careLeft,
  doneMask,
  fieldDay,
  fixLeft,
  machinePrep,
  nextTask,
  setupLeft,
  signOf,
  sprayJobs,
  treatCost,
  type Place,
  type Task,
  type TaskIcon,
  type TreatJob,
} from './field';
import { FarmWorld, PLACES, STAGE_H, STAGE_W, TRACTOR_BOARD } from './engine';
import { useNav } from '../components/Nav';
import { TRACTOR_BONUS } from '../tractor/data';
import { JOB_INFO, KIND_WORDS, TOOL_JOB, toolName, tractorName, type PlotKind } from '../plots/data';
import type { Rig } from '../plots/TractorPick';

// from Wakala Agent: the screens after a right call, at the shed and at the Hire spot, loaded when first opened
const Prescribe = lazy(() => import('../care/Prescribe').then(m => ({ default: m.Prescribe })));
const Spray = lazy(() => import('../care/Spray').then(m => ({ default: m.Spray })));
const Tractor = lazy(() => import('../tractor/Tractor').then(m => ({ default: m.Tractor })));
const PlotScreen = lazy(() => import('../plots/PlotBoard').then(m => ({ default: m.PlotScreen })));
const TractorPick = lazy(() => import('../plots/TractorPick').then(m => ({ default: m.TractorPick })));

/** Design review (?review=1): the farm world opens straight into one of these (GameState.worldDemo). */
export type WorldDemo = 'check' | 'prescribe' | 'spray' | 'tractor' | 'tractor-summary' | 'rig' | 'board';

type Care = { kind: 'fix'; farm: number; day: number } | { kind: 'spray'; jobs: { farm: number; hazard: import('../trials/model').TrialHazard }[] } | { kind: 'tractor'; farm: number; demo?: 'summary' }
  // the plot board at a shed (then the item is picked up), and the tractor's type and tool
  | { kind: 'board'; farm: number; kinds: PlotKind[]; then: 'seeds' | 'fertilizer' | 'sprayer' }
  | { kind: 'rig' };

/** The tractor-hire farm whose before-planting drive is still to do, or -1. */
function farmToDrive(st: GameState) {
  const t = st.trial;
  if (!t || t.phase !== 'growing') return -1;
  const f = st.field.cycle === t.cycle ? st.field : { ...st.field, marks: {} };
  return t.plans.findIndex((p, i) => machinePrep(p) && p.land === 'tractor' && setupLeft(f, t, i) === 'prep' && !t.tractor?.[i]);
}

/* The farm world: the farmer walks the farm and does the work by hand. This is the HUD and the glue; the
   3D farm itself is engine.ts. */

const JOB_HINT: Record<TreatJob, string> = {
  weed: 'walk over the weeds to cut them',
  water: 'fill the watering can at the pond and water every row',
  feed: 'get fertilizer from the shed and top-dress every row',
  spray: 'get the sprayer from the shed and spray every row',
  drain: 'walk over the puddles to dig drains',
  goat: 'walk up to the goat to chase it out',
  birds: 'walk into the birds to scare them off',
};

const CHECK_WAIT_S = 30;

export function World({ s, dispatch, paused }: { s: GameState; dispatch: Dispatch<Action>; paused: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  const eng = useRef<FarmWorld | null>(null);
  const sRef = useRef(s);
  sRef.current = s;
  const [today, setToday] = useState(dayNumber());
  const [hint, setHint] = useState<{ text: string; id: number } | null>(null);
  const [atSign, setAtSign] = useState(-1);
  const [checking, setChecking] = useState<{ farm: number; day: number; second: boolean } | null>(null);
  const [checkedAt, setCheckedAt] = useState<Record<string, number>>({});
  const checkedRef = useRef(checkedAt);
  checkedRef.current = checkedAt;
  const [now, setNow] = useState(Date.now());
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const [night, setNight] = useState<string | null>(null);
  const [care, setCare] = useState<Care | null>(null);
  /** the tractor type and tool on the tractor now */
  const [rig, setRig] = useState<Rig | null>(null);
  const [anchors, setAnchors] = useState<{ farmer: { x: number; y: number }; sign: { x: number; y: number; visible: boolean } | null; riding: boolean; nearTractor: boolean }>({ farmer: { x: 437, y: 160 }, sign: null, riding: false, nearTractor: false });
  /** the farmer is walking to the tractor to hop on */
  const rideIntent = useRef(false);
  const nav = useNav();
  /** the farm whose check opens when the farmer reaches its sign (after a tap on the task card) */
  const intent = useRef<number | null>(null);

  const t = s.trial;
  const look = LOOKS[s.farmer?.look ?? 0];
  const name = s.farmer?.name ?? 'Farmer';
  const day = fieldDay(t, today);
  const task = useMemo(() => nextTask(s.field, t, today, s.coins), [s.field, t, today, s.coins]);

  const say = (text: string) => setHint({ text, id: Date.now() });

  // the clock: a new real day can start while the game is open; the check waits tick
  useEffect(() => {
    const id = window.setInterval(() => {
      setToday(dayNumber());
      setNow(Date.now());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hint) return;
    const id = window.setTimeout(() => setHint(null), 3600);
    return () => window.clearTimeout(id);
  }, [hint]);

  // the 3D farm
  useEffect(() => {
    const w = new FarmWorld(canvas.current!, {
      mark: (farm, job, bits, tractor, rig) => {
        noteCare(farm, job, bits);
        dispatch({ type: 'fieldMark', farm, job, bits, tractor, rig });
      },
      carry: item => {
        // from Wakala Agent: the safety kit and the product before a spray job
        const st = sRef.current;
        if (item === 'sprayer' && st.trial) {
          const jobs = sprayJobs(st.field.cycle === st.trial.cycle ? st.field : { ...st.field, marks: {} }, st.trial, fieldDay(st.trial, dayNumber()));
          if (jobs.length) return setCare({ kind: 'spray', jobs });
        }
        // at the seed or fertilizer shed: first, which plot of the farm gets which (once, before any of it is in the ground)
        if ((item === 'seeds' || item === 'fertilizer') && st.trial?.phase === 'growing') {
          const f = st.field.cycle === st.trial.cycle ? st.field : { ...st.field, marks: {} };
          const job = item === 'seeds' ? 'sow' : 'setupFeed';
          const farm = st.trial.plans.findIndex((_, i) => setupLeft(f, st.trial!, i) === job);
          if (farm >= 0 && !doneMask(f, st.trial.cycle, farm, job)) return setCare({ kind: 'board', farm, kinds: [item === 'seeds' ? 'seed' : 'fert'], then: item });
        }
        dispatch({ type: 'carry', item });
        if (item) say(`Picked up: ${CARRY_NAME[item].toLowerCase()}`);
      },
      place: p => onPlace(p),
      sign: f => {
        setAtSign(f);
        if (f >= 0 && intent.current === f) {
          intent.current = null;
          openCheck(f);
        }
      },
      hint: say,
      arrived: () => {
        // walked to the tractor from the HUD or the menu: hop on
        if (rideIntent.current) {
          rideIntent.current = false;
          mountTractor();
        }
      },
    }, { anime: sRef.current.settings.art === 'anime', graphics: sRef.current.settings.graphics });
    eng.current = w;
    // for automated play-tests
    (window as unknown as { __limaWorld?: FarmWorld }).__limaWorld = w;
    // start at the farmhouse door, or (in design review) beside the job at hand
    const tk = nextTask(sRef.current.field, sRef.current.trial, dayNumber(), sRef.current.coins);
    const review = new URLSearchParams(window.location.search).has('review') || new URLSearchParams(window.location.search).has('screen');
    const spot = review ? targetOf(tk, w) : { x: 0, z: -13.4 };
    w.spawn(spot.x + (review ? 0.6 : 0), spot.z + (review ? 1.4 : 0));
    const fit = () => {
      const r = pad.current?.getBoundingClientRect();
      if (r) w.resize(r.width / STAGE_W);
    };
    fit();
    window.addEventListener('resize', fit);
    const tick = window.setInterval(() => {
      const f = w.farmerScreen();
      const sg = eng.current && atSignRef.current >= 0 ? signOf(atSignRef.current) : null;
      setAnchors({ farmer: f, sign: sg ? w.project(sg.x, 2.5, sg.z) : null, riding: w.isRiding(), nearTractor: w.nearTractor() });
    }, 120);
    return () => {
      window.removeEventListener('resize', fit);
      window.clearInterval(tick);
      w.dispose();
      eng.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const atSignRef = useRef(-1);
  atSignRef.current = atSign;

  const overlay = paused || !!checking || !!night || !!care;
  useEffect(() => {
    const w = eng.current;
    if (!w) return;
    const target = task.target;
    const arrowAt = 'place' in target ? PLACES[target.place] : target.at === 'sign' ? signOf(target.farm) : w.nextTile(target.farm);
    w.setView({ trial: t, field: s.field, today, look, arrowAt: arrowAt ? { x: arrowAt.x, z: arrowAt.z } : null, focus: 'farm' in target ? target.farm : null, paused: overlay });
  }, [t, s.field, today, look, task, overlay]);

  function targetOf(tk: Task, w: FarmWorld) {
    const target = tk.target;
    if ('place' in target) return PLACES[target.place];
    if (target.at === 'sign') return signOf(target.farm);
    return w.nextTile(target.farm);
  }

  /* ---------------- the tractor seat: a type and a tool, one plot each, and bonus points ---------------- */

  /** At the tractor: pick its type and tool first (while the farms grow), then hop on. */
  function mountTractor() {
    const w = eng.current;
    if (!w) return;
    if (w.isBusy()) return say('The tractor is busy ploughing: wait for it to finish');
    if (sRef.current.trial?.phase === 'growing') return setCare({ kind: 'rig' });
    ride(null);
  }

  function ride(rig: Rig | null) {
    const w = eng.current;
    if (!w) return;
    const r = w.mount(rig ?? undefined);
    if (r === 'busy') return say('The tractor is busy ploughing: wait for it to finish');
    if (r === 'far') return;
    setRig(rig);
    track('tractor_ride', { stage: 'seat', ...(rig ?? {}) });
    if (rig) {
      const j = TOOL_JOB[rig.tool];
      say(`${tractorName(rig.tractor)} tractor with the ${toolName(rig.tool).toLowerCase()}: drive onto a plot to ${JOB_INFO[j].name.toLowerCase()} it. +${TRACTOR_BONUS.perPlot} points a plot`);
    } else say('On the tractor');
  }

  /** The Tractor button: hop on, get off, or walk to the tractor first. */
  const toggleRide = () => {
    const w = eng.current;
    if (!w) return;
    if (w.isRiding()) {
      w.dismount();
      return say('You got off. Small jobs (weeds, water, spray) are done on foot');
    }
    if (w.nearTractor()) return mountTractor();
    rideIntent.current = true;
    w.walkTo(TRACTOR_BOARD.x, TRACTOR_BOARD.z);
    say('Walking to the tractor');
  };

  // "Tractor" in the main menu: back on the farm, walk to the tractor and hop on
  const rideSeen = useRef(s.rideReq);
  useEffect(() => {
    if (s.rideReq === rideSeen.current) return;
    rideSeen.current = s.rideReq;
    if (!eng.current?.isRiding()) toggleRide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.rideReq]);

  // "Farm" in any screen's navigation closes the screens this world keeps to itself (a check, the kit, the tractor drive)
  const navSeen = useRef(s.navSeq);
  useEffect(() => {
    if (s.navSeq === navSeen.current) return;
    navSeen.current = s.navSeq;
    setChecking(null);
    setCare(null);
  }, [s.navSeq]);

  const goToTask = () => {
    const w = eng.current;
    if (!w) return;
    if ('place' in task.target && task.target.place === 'mission') return dispatch({ type: 'trials', open: true });
    // already standing at the Hire spot: walking there again would not arrive, so open it
    if ('place' in task.target && task.target.place === 'hire') {
      const at = w.farmerAt();
      if (Math.hypot(at.x - PLACES.hire.x, at.z - PLACES.hire.z) < PLACES.hire.r) return onPlace('hire');
    }
    const p = targetOf(task, w);
    intent.current = 'place' in task.target ? null : task.target.at === 'sign' ? task.target.farm : null;
    // already at the sign: open the check
    if (intent.current !== null && 'farm' in task.target && atSign === task.target.farm) {
      intent.current = null;
      return openCheck(task.target.farm);
    }
    w.walkTo(p.x, p.z);
  };

  function onPlace(p: Place) {
    const st = sRef.current;
    const tr = st.trial;
    const d = fieldDay(tr, dayNumber());
    if (p === 'mission') return dispatch({ type: 'trials', open: true });
    if (p === 'hire') {
      // a tractor-hire farm is driven by the player first (from Wakala Agent); oxen plough by themselves
      const drive = farmToDrive(st);
      if (drive >= 0) {
        track('tractor_open', { farm: drive, stage: 'prep' });
        return setCare({ kind: 'tractor', farm: drive });
      }
      dispatch({ type: 'fieldHire' });
      return say('The ploughing has begun: watch it work the farms');
    }
    if (p === 'market') {
      if (!tr || tr.phase !== 'growing') return say('Nothing to sell yet: grow a cycle first');
      if (d <= CHECK_DAYS) return say(`The maize is still growing: harvest comes after day ${CHECK_DAYS}`);
      if (!allHarvested(st.field, tr)) return say('Harvest every farm first, then bring the corn here');
      dispatch({ type: 'trialHarvest' });
      window.setTimeout(() => dispatch({ type: 'trials', open: true }), 1400);
      return;
    }
    if (p === 'house') {
      const tk = nextTask(st.field, tr, dayNumber(), st.coins);
      if (tk.icon !== 'sleep') return say(tr?.phase === 'growing' ? `Not yet: ${tk.title.toLowerCase()} first` : 'Home sweet home');
      setNight('Good night');
      window.setTimeout(() => {
        dispatch({ type: 'trialNextDay' });
        setNight(d + 1 > CHECK_DAYS ? 'Harvest day!' : `Day ${d + 1}`);
      }, 1100);
      window.setTimeout(() => setNight(null), 2600);
    }
  }

  function openCheck(farm: number) {
    const st = sRef.current;
    const tr = st.trial;
    if (!tr || tr.phase !== 'growing') return;
    const d = fieldDay(tr, dayNumber());
    if (d < 1 || d > CHECK_DAYS) return;
    const rec = tr.checks[checkKey(farm, d)];
    if (rec?.right && fixLeft(tr, farm, d)) return setCare({ kind: 'fix', farm, day: d });
    if (rec?.right) return say(`${farmName(farm)} is read for today`);
    const key = `${farm}:${d}`;
    const waited = (Date.now() - (checkedRef.current[key] ?? 0)) / 1000;
    if (rec && waited < CHECK_WAIT_S) return say(`Look again in ${Math.ceil(CHECK_WAIT_S - waited)} seconds`);
    setChecking({ farm, day: d, second: !!rec });
  }

  /* ---------------- from Wakala Agent: care, the kit, the tractor ---------------- */

  // events for the work by hand after a right call (treatments) and the follow-ups, each logged once
  const logged = useRef(new Set<string>());
  function noteCare(farm: number, job: string, bits: number) {
    if (!/^[tf]\d$/.test(job)) return;
    const st = sRef.current;
    const tr = st.trial;
    if (!tr) return;
    const day = Number(job.slice(1));
    const pend = careLeft(st.field.cycle === tr.cycle ? st.field : { ...st.field, marks: {} }, tr, farm, day);
    if (!pend || pend.key !== job) return;
    const before = doneMask(st.field, tr.cycle, farm, job);
    const kind = job[0] === 't' ? 'treatment' : 'follow-up';
    const info = { farm, day, hazard: pend.hazard, job: pend.job, kind };
    const once = (what: string) => {
      const k = `${tr.cycle}:${farm}:${job}:${what}`;
      if (logged.current.has(k)) return false;
      logged.current.add(k);
      return true;
    };
    if (!before && once('started')) track('care_started', info);
    const complete = ((before | bits) & pend.need) === pend.need;
    if (complete && (kind === 'follow-up' || st.coins >= treatCost(pend.hazard)) && once('done')) track('care_done', info);
  }

  // a follow-up whose day ended undone: logged once, and its problem is back on that farm the next day
  useEffect(() => {
    if (!t?.followUps || t.phase !== 'growing') return;
    const d = fieldDay(t, today);
    const late = t.followUps.filter(u => !u.done && !u.missed && u.day < d);
    if (!late.length) return;
    late.forEach(u => track('care_missed', { farm: u.farm, day: u.day, hazard: u.hazard, job: u.job }));
    dispatch({ type: 'followUpMissed', keys: late.map(u => `${u.farm}:${u.day}`) });
  }, [t, today, dispatch]);

  // design review: open one of the new screens straight away
  useEffect(() => {
    const st = sRef.current;
    const demo = st.worldDemo as WorldDemo | null;
    const tr = st.trial;
    if (!demo || !tr) return;
    const d = fieldDay(tr, dayNumber());
    const f = st.field.cycle === tr.cycle ? st.field : { ...st.field, marks: {} };
    if (demo === 'check') setChecking({ farm: 0, day: d, second: false });
    if (demo === 'prescribe') {
      const farm = tr.plans.findIndex((_, i) => fixLeft(tr, i, d));
      if (farm >= 0) setCare({ kind: 'fix', farm, day: d });
    }
    if (demo === 'spray') {
      const jobs = sprayJobs(f, tr, d);
      if (jobs.length) setCare({ kind: 'spray', jobs });
    }
    if (demo === 'rig') setCare({ kind: 'rig' });
    if (demo === 'board') setCare({ kind: 'board', farm: 0, kinds: ['seed'], then: 'seeds' });
    if (demo === 'tractor' || demo === 'tractor-summary') {
      const farm = farmToDrive(st);
      if (farm >= 0) setCare({ kind: 'tractor', farm, demo: demo === 'tractor-summary' ? 'summary' : undefined });
    }
  }, [s.worldDemo]);

  function careScreen(c: Care, tr: NonNullable<GameState['trial']>) {
    if (c.kind === 'fix') {
      const h = hazardFor(tr, c.farm, c.day);
      const job = TREAT_JOB[h];
      const rec = tr.checks[checkKey(c.farm, c.day)];
      return (
        <Prescribe
          key={`${c.farm}:${c.day}`}
          round={trialRounds(tr, c.day)[c.farm]}
          hazard={h}
          farmName={farmName(c.farm)}
          tag={`${farmName(c.farm)} of ${tr.plans.length} · day ${c.day} of ${CHECK_DAYS}`}
          options={fixOrder(PRESCRIBE[h] ?? [], `${tr.cycle}:${c.farm}:${c.day}`)}
          name={name}
          cost={WRONG_FIX_COST[h] ?? 0}
          wrongBefore={rec?.wrongFixes ?? 0}
          then={job ? `${JOB_HINT[job]} (${treatCost(h)} coins).${FOLLOW_UP[h] ? ` ${FOLLOW_UP[h]!.why}` : ''}` : 'deal with it.'}
          onPick={op => dispatch({ type: 'prescribe', farm: c.farm, day: c.day, pick: op.id, right: op.right })}
          onDone={() => {
            setCare(null);
            if (job) say(`Now: ${JOB_HINT[job]}`);
          }}
          onLeave={() => setCare(null)}
        />
      );
    }
    if (c.kind === 'spray')
      return (
        <Spray
          jobs={c.jobs}
          name={name}
          onDone={() => setCare({ kind: 'board', farm: c.jobs[0]?.farm ?? 0, kinds: ['sprayer'], then: 'sprayer' })}
          onLeave={() => setCare(null)}
        />
      );
    if (c.kind === 'board') {
      const f = s.field.cycle === tr.cycle ? s.field : undefined;
      const k = c.kinds[0];
      const pick = () => {
        setCare(null);
        dispatch({ type: 'carry', item: c.then });
        say(c.then === 'sprayer' ? 'Picked up: sprayer · kit on' : `Picked up: ${CARRY_NAME[c.then].toLowerCase()}`);
      };
      return (
        <PlotScreen
          tr={tr}
          farm={c.farm}
          kinds={c.kinds}
          field={f}
          coins={s.coins}
          dispatch={dispatch}
          tag={`The shed · ${KIND_WORDS[k].title.toLowerCase()}`}
          line={`${KIND_WORDS[k].rule} Tap a plot to see every choice.`}
          done={{ label: c.then === 'sprayer' ? 'Pick up the sprayer' : c.then === 'seeds' ? 'Take the seed' : 'Take the fertilizer', onClick: pick }}
          onLeave={() => setCare(null)}
        />
      );
    }
    if (c.kind === 'rig')
      return (
        <TractorPick
          tr={tr}
          field={s.field.cycle === tr.cycle ? s.field : { ...s.field, marks: {} }}
          day={day}
          rig={rig}
          onGo={r => {
            setCare(null);
            ride(r);
          }}
          onLeave={() => setCare(null)}
        />
      );
    return (
      <Tractor
        farm={c.farm}
        cycle={tr.cycle}
        best={tr.tractor?.[c.farm] ?? null}
        name={name}
        demo={c.demo}
        onFinish={r => dispatch({ type: 'tractorDone', farm: c.farm, ...r })}
        onClose={() => {
          setCare(null);
          // a finished drive hands the farm to the 3D tractor, which shows the work on the plot
          if (sRef.current.trial?.tractor?.[c.farm]) {
            dispatch({ type: 'fieldHire' });
            const next = farmToDrive(sRef.current);
            say(next >= 0 ? `Watch the tractor plough ${farmName(c.farm)}. ${farmName(next)} needs the tractor too` : `Watch the tractor plough ${farmName(c.farm)}`);
          }
        }}
      />
    );
  }

  // the check of one farm: the same pictures and calls as the field rounds
  const check = useMemo(() => {
    if (!checking || !t) return null;
    const r = trialRounds(t, checking.day)[checking.farm];
    const h = hazardFor(t, checking.farm, checking.day);
    const plan = t.plans[checking.farm];
    const job = TREAT_JOB[h];
    const cause = causeOf(h, plan, t.forecast, plotsOf(t, checking.farm));
    let then = '';
    if (h === 'hail') then = 'Nothing to treat: hail-damaged plants often recover.';
    else if (job && canTreat(h, plan) && PRESCRIBE[h]) then = 'Next: choose the fix.';
    else if (job && canTreat(h, plan)) then = `Now ${JOB_HINT[job]} (${DAMAGE[h].treat} coins).`;
    else if (DAMAGE[h].treat > 0) then = 'It stays untreated, so the damage goes on.';
    const voice = voiceFor(t.cycle, checking.farm, checking.day, h, !!returnedProblem(t, checking.farm, checking.day));
    return { r, voice, after: { right: [cause, h === 'healthy' ? '' : then].filter(Boolean).join(' '), wrong: DAMAGE[h].missed ? `Look again in ${CHECK_WAIT_S} seconds: until it is read right, it costs harvest.` : '' } };
  }, [checking, t]);

  /* ---------------- pointer: tap to walk, drag for the joystick ---------------- */

  const drag = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const stagePoint = (e: RPointerEvent) => {
    const r = pad.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * STAGE_W, y: ((e.clientY - r.top) / r.height) * STAGE_H };
  };
  const onDown = (e: RPointerEvent) => {
    const p = stagePoint(e);
    drag.current = { ...p, id: e.pointerId, moved: false };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const p = stagePoint(e);
    const dx = p.x - d.x;
    const dy = p.y - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 10) return;
    // the player has taken over: forget where the task card was taking them
    if (!d.moved) intent.current = null;
    d.moved = true;
    const len = Math.hypot(dx, dy);
    const k = Math.min(1, len / 46) / (len || 1);
    eng.current?.setJoystick(dx * k, dy * k);
    setStick({ x: d.x, y: d.y, dx: dx * k * 30, dy: dy * k * 30 });
  };
  const onUp = (e: RPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    setStick(null);
    eng.current?.setJoystick(0, 0);
    if (d && !d.moved) {
      const p = stagePoint(e);
      intent.current = null;
      eng.current?.tap(p.x, p.y);
    }
  };

  /* ---------------- the HUD ---------------- */

  const signFarm = atSign;
  const signRec = t && signFarm >= 0 && day >= 1 && day <= CHECK_DAYS ? t.checks[checkKey(signFarm, day)] : undefined;
  const wait = signFarm >= 0 && signRec && !signRec.right ? Math.max(0, CHECK_WAIT_S - Math.floor((now - (checkedAt[`${signFarm}:${day}`] ?? 0)) / 1000)) : 0;
  const showCheck = !!t && t.phase === 'growing' && signFarm >= 0 && day >= 1 && day <= CHECK_DAYS && !signRec?.right && !checking;
  // Mama Achieng says what she has noticed when the farmer reaches a sign with a check to do
  const signVoice = useMemo(
    () => (t && showCheck && !signRec ? voiceFor(t.cycle, signFarm, day, hazardFor(t, signFarm, day), !!returnedProblem(t, signFarm, day)) : null),
    [t, showCheck, signRec, signFarm, day],
  );

  return (
    <div className="abs world" style={{ inset: 0 }}>
      <canvas ref={canvas} className="world-canvas" width={STAGE_W} height={STAGE_H} />
      <div ref={pad} className="world-pad" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

      {stick && (
        <div className="joy" style={{ left: stick.x - 40, top: stick.y - 40 }} aria-hidden="true">
          <span style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
        </div>
      )}

      {/* the HUD gives way to the full-screen rounds and six-farms screens, which have their own navigation */}
      {!(s.roundsOpen || s.trialsOpen) && (
        <>
      {/* the farmer and their level */}
      <div className="hud-avatar">
        <span className="hud-hex">
          <FarmerPortrait look={look} size={40} />
        </span>
        <span className="hud-level">{s.level}</span>
      </div>
      <button type="button" className="hud-round" style={{ left: 14, top: 66 }} onClick={() => dispatch({ type: 'open', modal: { kind: 'settings' } })} aria-label="Settings">
        <GearIcon />
        <span>SETTINGS</span>
      </button>
      <button type="button" className="hud-round hud-menu" onClick={nav.menu} aria-label="Main menu">
        <MenuIcon />
        <span>MENU</span>
      </button>
      <button
        type="button"
        className={`hud-round hud-tractor${anchors.riding ? ' is-on' : ''}`}
        onClick={toggleRide}
        aria-pressed={anchors.riding}
        aria-label={anchors.riding ? 'Get off the tractor' : anchors.nearTractor ? 'Drive the tractor' : 'Walk to the tractor'}
      >
        <TractorBtnIcon />
        <span>{anchors.riding ? 'GET OFF' : 'TRACTOR'}</span>
      </button>
      {anchors.riding && t?.phase === 'growing' && (
        <button type="button" className="hud-rig" onClick={() => setCare({ kind: 'rig' })} aria-label="Change the tractor or tool">
          Change tool
        </button>
      )}

      {/* coins and points */}
      <div className="hud-pills">
        <span className="hud-pill" title="Coins">
          <img src={img.cash} alt="" width={26} height={26} />
          <b>{fmt(s.coins)}</b>
          <button type="button" aria-label="Shop" onClick={() => dispatch({ type: 'open', modal: { kind: 'shop', tab: 'food' } })}>
            +
          </button>
        </span>
        <span className="hud-pill is-points" title="Points: they unlock real partner discounts">
          <img src={img.star} alt="" width={22} height={22} />
          <b>{fmt(s.points)}</b>
          <button type="button" aria-label="Rewards" onClick={() => dispatch({ type: 'open', modal: { kind: 'rewards' } })}>
            +
          </button>
        </span>
      </div>
      <button type="button" className="hud-round hud-mission" onClick={() => dispatch({ type: 'trials', open: true })} aria-label="Mission: plan, progress and results of your farms">
        <ClipboardIcon />
        <span>MISSION</span>
      </button>
      <button type="button" className="hud-round hud-shop" onClick={() => dispatch({ type: 'open', modal: { kind: 'shop', tab: 'food' } })} aria-label="Shop">
        <img src={img.cart} alt="" width={30} height={30} />
        <span>SHOP</span>
      </button>

      {/* what to do next: tap it to walk there */}
      <button type="button" className="hud-task" onClick={goToTask} aria-label={`Next: ${task.title}. Tap to walk there.`}>
        <span className="hud-task-icon">
          <TaskGlyph icon={task.icon} />
          {(task.coins !== undefined || task.points) && (
            <small className={task.coins !== undefined && task.coins < 0 ? 'is-cost' : ''}>
              <img src={task.points ? img.star : img.coin} alt="" width={10} height={10} />
              {task.points ? `+${task.points}` : fmt(Math.abs(task.coins ?? 0))}
            </small>
          )}
        </span>
        <span className="hud-task-text">
          <b>{task.title}</b>
          {task.note && <i>{task.note}</i>}
        </span>
      </button>

      {/* the day, and what the farmer carries */}
      <div className="hud-status">
        {t && t.phase === 'growing' && (
          <span>
            Cycle {t.cycle} · {day > CHECK_DAYS ? 'harvest' : `day ${day} of ${CHECK_DAYS}`}
          </span>
        )}
        {anchors.riding && (
          <span className="is-carry">
            On the tractor{rig ? ` · ${tractorName(rig.tractor)} · ${toolName(rig.tool)}` : ''}
          </span>
        )}
        {s.field.carry && <span className="is-carry">Carrying: {CARRY_NAME[s.field.carry].toLowerCase()}</span>}
      </div>
        </>
      )}

      {hint && (
        <div key={hint.id} className="hud-hint" style={{ left: Math.min(STAGE_W - 120, Math.max(120, anchors.farmer.x)), top: Math.max(56, anchors.farmer.y - 34) }}>
          {hint.text}
        </div>
      )}

      {signVoice && anchors.sign?.visible && !overlay && (
        <p className="voice-bubble is-sign" role="note" style={{ left: Math.min(STAGE_W - 130, Math.max(130, anchors.sign.x)), top: anchors.sign.y - 40 }}>
          <b>{signVoice.name}:</b> {signVoice.say}
        </p>
      )}
      {showCheck && anchors.sign?.visible && (
        <button type="button" className="hud-check" style={{ left: anchors.sign.x, top: anchors.sign.y }} disabled={wait > 0} onClick={() => openCheck(signFarm)}>
          {wait > 0 ? `Look again in ${wait}s` : `Check ${farmName(signFarm)}`}
        </button>
      )}

      {night && (
        <div className="world-night" aria-live="polite">
          <span>{night}</span>
        </div>
      )}

      {checking && check && t && (
        <div className="abs world-check" style={{ inset: 0 }}>
          <Inspect
            key={`${checking.farm}-${checking.day}-${checking.second}`}
            round={check.r}
            name={name}
            look={look}
            second={checking.second}
            points={t.checks[checkKey(checking.farm, checking.day)]?.right ? 0 : checking.second ? ROUND_POINTS.second : ROUND_POINTS.first}
            tag={`${farmName(checking.farm)} of ${t.plans.length}`}
            note={`Maize · day ${checking.day} of ${CHECK_DAYS}`}
            after={check.after}
            voice={check.voice}
            continueLabel={t.checks[checkKey(checking.farm, checking.day)]?.right && fixLeft(t, checking.farm, checking.day) ? 'Choose the fix' : 'Back to the farm'}
            onResult={right => {
              const rec = t.checks[checkKey(checking.farm, checking.day)];
              dispatch({ type: 'trialCheck', farm: checking.farm, day: checking.day, right, tries: (rec?.tries ?? 0) + 1, physical: true });
              if (!right) setCheckedAt(c => ({ ...c, [`${checking.farm}:${checking.day}`]: Date.now() }));
            }}
            onContinue={() => {
              const c = checking;
              setChecking(null);
              if (fixLeft(sRef.current.trial ?? t, c.farm, c.day)) setCare({ kind: 'fix', farm: c.farm, day: c.day });
            }}
            onLeave={() => setChecking(null)}
          />
        </div>
      )}

      {care && t && (
        <div className="abs world-check" style={{ inset: 0 }}>
          <Suspense fallback={null}>{careScreen(care, t)}</Suspense>
        </div>
      )}
    </div>
  );
}


/* ---------------- icons ---------------- */

function GearIcon() {
  return (
    <svg viewBox="-12 -12 24 24" width={26} height={26} aria-hidden="true">
      <g fill="#fff">
        {Array.from({ length: 8 }, (_, i) => (
          <rect key={i} x={-2.2} y={-11} width={4.4} height={5} rx={1} transform={`rotate(${i * 45})`} />
        ))}
        <circle r={7.5} />
      </g>
      <circle r={3.2} fill="#e98a2e" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width={26} height={26} aria-hidden="true">
      <g fill="#fff">
        <rect x={3} y={5} width={18} height={3.2} rx={1.6} />
        <rect x={3} y={10.4} width={18} height={3.2} rx={1.6} />
        <rect x={3} y={15.8} width={18} height={3.2} rx={1.6} />
      </g>
    </svg>
  );
}

function TractorBtnIcon() {
  return (
    <svg viewBox="0 0 40 36" width={26} height={26} aria-hidden="true">
      <rect x={4} y={14} width={24} height={11} rx={2} fill="#fff" />
      <rect x={17} y={5} width={12} height={11} rx={1.5} fill="#fff" />
      <rect x={20} y={7} width={6} height={6} fill="#d9731f" />
      <circle cx={11} cy={28} r={7} fill="#fff" stroke="#8a4a14" strokeWidth={2} />
      <circle cx={31} cy={30} r={5} fill="#fff" stroke="#8a4a14" strokeWidth={2} />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 28" width={24} height={28} aria-hidden="true">
      <rect x={1} y={3} width={22} height={24} rx={3} fill="#a86a32" />
      <rect x={4} y={6} width={16} height={19} rx={1.5} fill="#fffaf0" />
      <rect x={7} y={1} width={10} height={5} rx={1.5} fill="#5c6b73" />
      <path d="M7 12l2 2 3-4M7 19l2 2 3-4" stroke="#2f9b14" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <path d="M14 12h4M14 19h4" stroke="#8b6b4a" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}

export function TaskGlyph({ icon }: { icon: TaskIcon }) {
  const common = { width: 34, height: 34, viewBox: '0 0 40 40', 'aria-hidden': true } as const;
  switch (icon) {
    case 'corn':
      return <img src={img.corn} alt="" width={34} height={34} style={{ objectFit: 'contain' }} />;
    case 'seeds':
      return (
        <svg {...common}>
          <ellipse cx={20} cy={24} rx={12} ry={13} fill="#d8bd8a" />
          <path d="M12 13q8-6 16 0" stroke="#a8875a" strokeWidth={3} fill="none" />
          {[0, 1, 2, 3].map(i => (
            <ellipse key={i} cx={15 + (i % 2) * 9} cy={22 + Math.floor(i / 2) * 7} rx={2.6} ry={3.4} fill="#f2c230" />
          ))}
        </svg>
      );
    case 'fertilizer':
      return (
        <svg {...common}>
          <rect x={9} y={8} width={22} height={26} rx={5} fill="#f5f5f0" stroke="#c9c9bf" />
          <rect x={9} y={18} width={22} height={7} fill="#3aa856" />
        </svg>
      );
    case 'hoe':
      return (
        <svg {...common}>
          <path d="M8 34L30 10" stroke="#8b5a2b" strokeWidth={4} strokeLinecap="round" />
          <path d="M26 6l9 9-6 2-5-5z" fill="#9aa3a8" />
        </svg>
      );
    case 'weed':
      return (
        <svg {...common}>
          {[0, 1, 2, 3, 4].map(i => (
            <path key={i} d={`M20 34Q${10 + i * 5} 20 ${6 + i * 7} ${8 + (i % 2) * 4}`} stroke={i % 2 ? '#2f7d1f' : '#5aa82a'} strokeWidth={3} fill="none" strokeLinecap="round" />
          ))}
        </svg>
      );
    case 'water':
      return (
        <svg {...common}>
          <path d="M20 5Q32 20 28 28A9 9 0 0 1 12 28Q8 20 20 5z" fill="#3fa0e0" />
          <ellipse cx={16} cy={24} rx={2.5} ry={4} fill="#a8defa" />
        </svg>
      );
    case 'spray':
      return (
        <svg {...common}>
          <rect x={8} y={12} width={14} height={22} rx={5} fill="#f2c230" />
          <path d="M22 16l10-6" stroke="#444" strokeWidth={3} strokeLinecap="round" />
          <circle cx={34} cy={8} r={2} fill="#a8defa" />
          <circle cx={36} cy={13} r={1.6} fill="#a8defa" />
        </svg>
      );
    case 'drain':
      return (
        <svg {...common}>
          <ellipse cx={20} cy={27} rx={15} ry={7} fill="#56b9e8" />
          <path d="M10 33L28 8" stroke="#8b5a2b" strokeWidth={3.5} strokeLinecap="round" />
        </svg>
      );
    case 'goat':
      return (
        <svg {...common}>
          <ellipse cx={18} cy={22} rx={11} ry={7} fill="#eae4da" />
          <rect x={26} y={10} width={9} height={9} rx={2} fill="#eae4da" />
          <path d="M28 10l-2-6M33 10l2-6" stroke="#5b524a" strokeWidth={2} />
          {[10, 15, 21, 26].map(x => (
            <rect key={x} x={x} y={27} width={3} height={8} fill="#5b524a" />
          ))}
        </svg>
      );
    case 'birds':
      return (
        <svg {...common}>
          <path d="M5 18q6-6 10 0q4-6 10 0" stroke="#5c3a20" strokeWidth={3} fill="none" />
          <path d="M18 30q5-5 8 0q3-5 8 0" stroke="#5c3a20" strokeWidth={3} fill="none" />
        </svg>
      );
    case 'tractor':
      return (
        <svg {...common}>
          <rect x={6} y={14} width={22} height={11} rx={2} fill="#f5c21b" />
          <rect x={18} y={6} width={11} height={10} rx={1} fill="#1f9d8f" />
          <circle cx={12} cy={29} r={7} fill="#2a2a2a" />
          <circle cx={30} cy={31} r={5} fill="#2a2a2a" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <circle cx={17} cy={17} r={10} fill="none" stroke="#2f7d27" strokeWidth={4} />
          <path d="M24 24l9 9" stroke="#2f7d27" strokeWidth={5} strokeLinecap="round" />
          <path d="M13 17q4-6 8 0" stroke="#5aa82a" strokeWidth={3} fill="none" />
        </svg>
      );
    case 'sleep':
      return (
        <svg {...common}>
          <path d="M26 6A14 14 0 1 0 34 26 11 11 0 0 1 26 6z" fill="#f2c230" />
        </svg>
      );
    case 'results':
    case 'plan':
      return <ClipboardIcon />;
    default:
      return (
        <svg {...common}>
          <circle cx={20} cy={20} r={14} fill="none" stroke="#a86a32" strokeWidth={3} />
          <path d="M20 11v10l6 4" stroke="#a86a32" strokeWidth={3} fill="none" strokeLinecap="round" />
        </svg>
      );
  }
}
