import { Suspense, useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as RPointerEvent } from 'react';
import { KakumaPopup } from '../events/Kakuma';
import { kakumaOf, kakumaPhase } from '../events/model';
import { BasicsChip } from '../learn/Basics';
import { img } from '../assets';
import { FarmerPortrait } from '../first/art';
import { LOOKS } from '../first/data';
import { Inspect } from '../rounds/Inspect';
import { dayNumber, ROUND_POINTS } from '../rounds/farms';
import { CROP_NAME } from '../rounds/hazards';
import { trialRounds } from '../rounds/trial';
import type { Action, GameState } from '../state';
import { CHECK_DAYS, DAMAGE, WRONG_FIX_COST, canTreat, causeOf, checkKey, farmName, hazardFor, plotsOf, returnedProblem } from '../trials/model';
import { fmt } from '../components/ui';
import { track } from '../first/track';
import { FOLLOW_UP, PRESCRIBE, fixOrder } from '../care/data';
import { TREATMENTS } from '../care/treatments';
import { voiceFor } from '../care/voice';
import {
  CARRY_NAME,
  PLOT_WORK_S,
  FULL,
  rowName,
  rowsLeft,
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
  treatCostFor,
  type Place,
  type Task,
  type TaskIcon,
  type TreatJob,
  type SprayFor,
} from './field';
import { BILLBOARDS, FarmWorld, PLACES, STAGE_H, STAGE_W, TRACTOR_BOARD, type Fx } from './engine';
import { slotBrand, type SlotId } from '../partners/data';
import { useSlotView } from '../partners/track';
import { BrandMark, openOffer } from '../partners/ui';
import { useNav } from '../components/Nav';
import { ClimateIcon, PartnersIcon } from '../components/Icons';
import { rating } from '../climate/model';
import { TRACTOR_BONUS } from '../tractor/data';
import { JOB_INFO, KIND_WORDS, toolJobs, toolName, tractorName, type PlotKind } from '../plots/data';
import type { Rig } from '../plots/TractorPick';
import { currency, money, moneyShort } from '../money';
import { sfx } from '../sfx';
import { ProgressButton } from '../components/ProgressButton';
import { RiskHud, useRisk } from '../risk/RiskHud';
import { WaterButton } from '../water/WaterButton';
import { EvidenceAsk } from '../evidence/Ask';
import type { RiskItem } from '../risk/model';
import { achClock } from '../achievements/track';
import { TIDY, TIDY_TOTAL, tidyCount, tidyLeft, tidyStreak, type TidyItem } from '../tidy/model';
import { FARM_PERIOD_DAYS, careOpen, coopOpen, lifeOf, shedOpen } from '../livestock/model';
import { tankOf } from '../water/model';
import { LIFE, coopOption, shedOption } from '../livestock/config';
import { lightsLit, nextStep, powerOf, powerOn } from '../power/model';
import { cannotDrive, hubOf, speedOf, type HubSection } from '../tractor/hub';
import { BED_NAMES, GREENHOUSE, bedStage, ghNeeds, greenhouseOf } from '../greenhouse/model';
import { PRODUCE, PRODUCE_IDS, produceOf } from '../produce/model';
import { ShedOptions } from '../plots/ShedOptions';
import { FarmLoading } from './Loading';
import { careJob, choresCount, choresLeft, jobsOf, type Job, type JobStop } from '../onsite/model';
import { ActivityLoading } from '../components/ActivityLoading';
import { lazyPage, prefetchActivities } from '../prefetch';

// from Wakala Agent: the screens after a right call, at the shed and at the Hire spot, loaded when first opened
const Prescribe = lazyPage(() => import('../care/Prescribe').then(m => m.Prescribe), 0);
const Spray = lazyPage(() => import('../care/Spray').then(m => m.Spray), 0);
const Tractor = lazyPage(() => import('../tractor/Tractor').then(m => m.Tractor), 0);
const PlotScreen = lazyPage(() => import('../plots/PlotBoard').then(m => m.PlotScreen), 0);
const TractorPick = lazyPage(() => import('../plots/TractorPick').then(m => m.TractorPick), 0);
const TractorHub = lazyPage(() => import('../tractor/TractorHub').then(m => m.TractorHub), 0);

/** Design review (?review=1): the farm world opens straight into one of these (GameState.worldDemo). */
export type WorldDemo = 'check' | 'prescribe' | 'spray' | 'tractor' | 'tractor-summary' | 'rig' | 'board';

type Care = { kind: 'fix'; farm: number; day: number } | { kind: 'spray'; jobs: { farm: number; hazard: SprayFor }[] } | { kind: 'tractor'; farm: number; demo?: 'summary' }
  // the inputs board at a shed (then the item is picked up), and the tractor's type and tool
  | { kind: 'board'; farm: number; kinds: PlotKind[]; then: 'seeds' | 'fertilizer' | 'sprayer' }
  | { kind: 'rig' }
  /** at a shed spot: every seed, fertilizer or sprayer to choose from */
  | { kind: 'options'; of: PlotKind };

/** What the loading card says while a care screen's code is still on its way (usually it is already fetched). */
const CARE_LOADING: Record<Care['kind'], string> = {
  fix: 'Opening the fix…',
  spray: 'Opening the sprayer…',
  tractor: 'Starting the tractor…',
  board: 'Opening the shed…',
  rig: 'Opening the tractor…',
  options: 'Opening the shed…',
};

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
  water: 'fill the can at the pond and water every row',
  feed: 'top-dress every row',
  spray: 'spray every row',
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
  const [anchors, setAnchors] = useState<Anchors>({ farmer: { x: 437, y: 160 }, sign: null, riding: false, nearTractor: false, plot: null, tidy: null, place: null, job: false });
  /** the tractor screen (src/tractor/TractorHub.tsx), open at a section */
  const [hub, setHub] = useState<HubSection | null>(null);
  /** clearing or planting one plot: started at, and how long it takes (ms) */
  const [working, setWorking] = useState<(PlotHere & { start: number; ms: number }) | null>(null);
  /** clearing one of the day's bushes or rocks: which, started at, and how long it takes (ms) */
  const [tidying, setTidying] = useState<{ item: TidyItem; start: number; ms: number } | null>(null);
  /** the farmer is walking to the tractor to hop on */
  const rideIntent = useRef(false);
  /** the farm's first frame is drawn (the loading screen fades), and a moment later it is gone */
  const [loaded, setLoaded] = useState(false);
  const [loadGone, setLoadGone] = useState(false);
  useEffect(() => {
    if (!loaded) return;
    const id = window.setTimeout(() => setLoadGone(true), 320);
    return () => window.clearTimeout(id);
  }, [loaded]);
  const nav = useNav();
  /** the farm whose check opens when the farmer reaches its sign (after a tap on the task card) */
  const intent = useRef<number | null>(null);

  const t = s.trial;
  const grade = rating(s.climate.total);
  const look = LOOKS[s.farmer?.look ?? 0];
  const name = s.farmer?.name ?? 'Farmer';
  const day = fieldDay(t, today);
  const task = useMemo(() => nextTask(s.field, t, today, s.coins), [s.field, t, today, s.coins]);
  /** money at risk on the six farms (src/risk) */
  const risk = useRisk(s, today);

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
        // at the seed or fertilizer shed: first, which seed or fertilizer the farm gets (once, before any of it is in the ground)
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
    // the loading screen stays until the farm's first frame is drawn; play-tests start then too
    let live = true;
    void w.ready.then(() => {
      if (!live) return;
      (window as unknown as { __limaWorld?: FarmWorld }).__limaWorld = w;
      setLoaded(true);
      // every activity's code, fetched now while the player looks round, so opening one does not wait (src/prefetch.ts)
      window.setTimeout(prefetchActivities, 800);
    });
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
      const jb = jobRef.current;
      const jst = jb?.stops[jb.done];
      const jp = jst ? stopPoint(jst, w) : null;
      const me = w.farmerAt();
      const jobNear = !!jp && !w.isRiding() && Math.hypot(me.x - jp.x, me.z - jp.z) < JOB_REACH;
      const next = { farmer: f, sign: sg ? w.project(sg.x, 2.5, sg.z) : null, riding: w.isRiding(), nearTractor: w.nearTractor(), plot: w.plotJobHere(), bill: billboardNear(w), tidy: w.tidyHere(), place: w.placeHere(), job: jobNear };
      // the HUD follows the farmer: re-render only when something on it would move or change
      setAnchors(a => (sameAnchors(a, next) ? a : next));
    }, 120);
    return () => {
      live = false;
      window.removeEventListener('resize', fit);
      window.clearInterval(tick);
      w.dispose();
      eng.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const atSignRef = useRef(-1);
  atSignRef.current = atSign;
  /** the job being walked and done by hand (src/onsite): the first on the list, once the first session is done */
  const job: Job | null = s.fs.phase === 'done' ? jobsOf(s)[0] ?? null : null;
  const jobRef = useRef(job);
  jobRef.current = job;

  const overlay = paused || !!checking || !!night || !!care || !!hub;

  // the first planting period starts as soon as the farm opens: Farm 1's maize to clear, Farm 2's sukuma wiki to plant
  useEffect(() => {
    if (!s.trial && s.trialHistory.length === 0) dispatch({ type: 'trialNew' });
  }, [s.trial, s.trialHistory.length, dispatch]);

  /* ---------------- clearing and planting: a button on each row of plots, then a 3-second timer ---------------- */

  function startPlot(p: PlotHere) {
    const w = eng.current;
    if (!w || working) return;
    // a press while still walking stops the farmer on this plot, so the work isn't cut short by walking off it
    w.stopWalking();
    setWorking({ ...p, start: performance.now(), ms: PLOT_WORK_S * 1000 * w.workScale });
  }
  useEffect(() => {
    if (!working) return;
    const id = window.setInterval(() => {
      const w = eng.current;
      if (!w) return;
      // walking off the row (or a screen opening on top) stops the work; the row stays as it was
      if (overlay || !samePlot(w.plotJobHere(), working)) {
        setWorking(null);
        if (!overlay) say('Stay on the row until the timer is done');
        return;
      }
      w.plotWorking(working.fx);
      if (performance.now() - working.start < working.ms) return;
      w.plotFinished(working.farm, working.bits, working.job, working.fx);
      setWorking(null);
      const st = sRef.current;
      const done = st.trial ? doneMask(st.field.cycle === st.trial.cycle ? st.field : { ...st.field, marks: {} }, st.trial.cycle, working.farm, working.job) : 0;
      const left = rowsLeft(FULL, done | working.bits);
      sfx.action();
      say(`${rowName(working.row)} ${working.job === 'prep' ? 'cleared' : 'planted'}${left ? ` · ${left} row${left === 1 ? '' : 's'} to go on ${farmName(working.farm)}` : ` · ${farmName(working.farm)} is ${working.job === 'prep' ? 'cleared' : 'planted'}!`}`);
    }, 120);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working, overlay]);
  /* ---------------- the daily tidy-up: 3 bushes and 5 rocks around the farm, every day ---------------- */

  /** the player's calendar day (the streak's clock), as YYYY-MM-DD: it moves on with `today` */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const date = useMemo(() => achClock.today(), [today]);
  const tidyOn = s.fs.phase === 'done' && s.tidy?.date === date;
  // the farm opened on a new day, or a new day started while it was open: today's bushes and rocks turn up
  useEffect(() => {
    if (s.fs.phase === 'done' && s.tidy?.date !== date) dispatch({ type: 'tidyDay' });
  }, [date, s.tidy?.date, s.fs.phase, dispatch]);
  const tidyItemsLeft = useMemo(() => (tidyOn ? tidyLeft(s.tidy, date) : []), [tidyOn, s.tidy, date]);
  useEffect(() => {
    eng.current?.setTidy(tidyItemsLeft);
  }, [tidyItemsLeft]);
  const tidy = tidyCount(s.tidy, date);

  function startTidy(item: TidyItem) {
    const w = eng.current;
    if (!w || tidying || working) return;
    w.stopWalking();
    setTidying({ item, start: performance.now(), ms: TIDY.workS[item.kind] * 1000 * w.workScale });
  }
  useEffect(() => {
    if (!tidying) return;
    const id = window.setInterval(() => {
      const w = eng.current;
      if (!w) return;
      // walking away (or a screen opening on top) stops the work; the bush or rock stays
      if (overlay || w.tidyHere()?.id !== tidying.item.id) {
        setTidying(null);
        if (!overlay) say(`Stay by the ${tidying.item.kind} until the timer is done`);
        return;
      }
      w.tidyWorking(tidying.item);
      if (performance.now() - tidying.start < tidying.ms) return;
      const done = tidying.item;
      setTidying(null);
      dispatch({ type: 'tidyClear', id: done.id });
      const after = tidyLeft({ ...sRef.current.tidy!, cleared: [...(sRef.current.tidy?.cleared ?? []), done.id] }, date);
      const bushes = after.filter(i => i.kind === 'bush').length;
      const rocks = after.filter(i => i.kind === 'rock').length;
      const left = [bushes ? `${bushes} bush${bushes === 1 ? '' : 'es'}` : '', rocks ? `${rocks} rock${rocks === 1 ? '' : 's'}` : ''].filter(Boolean).join(' and ');
      // the last one: the toast says the farm is tidy, with the bonus
      if (left) say(`${done.kind === 'bush' ? 'Bush cleared' : 'Rock moved'} · +${TIDY.pointsEach} points · ${left} to go`);
    }, 120);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tidying, overlay]);

  /** The tidy-up chip: walk to the nearest bush or rock still to clear. */
  const goToTidy = () => {
    const w = eng.current;
    if (!w) return;
    if (!tidyItemsLeft.length) return say('The farm is tidy today. New bushes and rocks turn up tomorrow');
    if (w.isRiding()) w.dismount();
    const i = w.nearestTidy();
    if (!i) return;
    // stop beside it, on the side the farmer comes from
    const at = w.farmerAt();
    const d = Math.hypot(at.x - i.x, at.z - i.z) || 1;
    w.walkTo(i.x + ((at.x - i.x) / d) * 0.9, i.z + ((at.z - i.z) / d) * 0.9);
    say(`Walking to the ${i.kind}`);
  };

  /* ---------------- jobs done by hand (src/onsite): walk to each spot, press its button, work while the timer runs ---------------- */

  const jobKey = job ? `${job.id}:${job.done}` : '';
  const jobStop = job ? job.stops[job.done] ?? null : null;
  const pageOpen = !!(s.modal || s.roundsOpen || s.trialsOpen || s.bizOpen);
  /** the job's spot being worked: started at, and how long it takes (ms) */
  const [jobWork, setJobWork] = useState<{ key: string; start: number; ms: number } | null>(null);

  /** Walk to the job's next spot (off the tractor first). */
  function goToJob(first = false) {
    const w = eng.current;
    const jb = jobRef.current;
    const st = jb?.stops[jb.done];
    if (!w || !jb || !st) return;
    if (w.isRiding()) w.dismount();
    intent.current = null;
    const p = stopPoint(st, w);
    const at = w.farmerAt();
    if (Math.hypot(at.x - p.x, at.z - p.z) < JOB_REACH) return;
    w.walkTo(p.x, p.z);
    if (first) say(`Walking to ${jb.where}`);
  }
  // a new job, or its next spot: the farmer sets off as soon as nothing is open on top
  const walkedFor = useRef('');
  useEffect(() => {
    if (!job || overlay || pageOpen || walkedFor.current === jobKey) return;
    walkedFor.current = jobKey;
    // the message that put the job on the list already says where to walk
    goToJob(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobKey, overlay, pageOpen]);
  // a job added from the tractor screen or a care screen closes it, so the walk can start
  const jobIds = jobsOf(s).map(j => j.id);
  const seenJobs = useRef(new Set(jobIds));
  useEffect(() => {
    const fresh = jobIds.some(id => !seenJobs.current.has(id));
    seenJobs.current = new Set(jobIds);
    if (!fresh) return;
    setHub(null);
    setCare(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobIds.join()]);
  // a part or a tool bought rides on the farmer's back to its first spot
  useEffect(() => {
    eng.current?.setCrate(!!job?.crate && job.done === 0);
  }, [job?.crate, job?.done, job?.id]);

  function startJobWork() {
    const w = eng.current;
    const jb = jobRef.current;
    const st = jb?.stops[jb.done];
    if (!w || !jb || !st || jobWork || working || tidying) return;
    w.stopWalking();
    if (st.gather) w.gather(st.gather.group, st.gather.x, st.gather.z, st.secs * w.workScale + 5);
    setJobWork({ key: `${jb.id}:${jb.done}`, start: performance.now(), ms: st.secs * 1000 * w.workScale });
  }
  useEffect(() => {
    if (!jobWork) return;
    const id = window.setInterval(() => {
      const w = eng.current;
      const jb = jobRef.current;
      if (!w) return;
      const st = jb?.stops[jb.done];
      if (!jb || !st || `${jb.id}:${jb.done}` !== jobWork.key) return setJobWork(null);
      const p = stopPoint(st, w);
      const me = w.farmerAt();
      // walking away (or a screen opening on top) stops the work; the spot stays to do
      if (overlay || Math.hypot(me.x - p.x, me.z - p.z) > JOB_REACH + 0.4) {
        setJobWork(null);
        if (!overlay) say('Stay at the spot until the timer is done');
        return;
      }
      w.jobWorking(p.face, st.fx, st.tool);
      if (performance.now() - jobWork.start < jobWork.ms) return;
      setJobWork(null);
      w.jobFinished(p.face ?? p, st.fx);
      sfx.action();
      const last = jb.done + 1 >= jb.stops.length;
      if (!last) {
        dispatch({ type: 'jobStep', id: jb.id });
        say(`${st.button}: done · next: ${jb.stops[jb.done + 1].button.toLowerCase()}`);
        return;
      }
      // the last spot: what the page asked for happens now (paid, installed, fed) and the job comes off the list; if
      // it cannot happen now, the job stays at this spot and the message says why (state.ts jobDone)
      dispatch({ type: 'jobDone', id: jb.id });
    }, 120);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobWork, overlay]);

  /** The animal chores chip: walk to the job in hand at the pen or the coop, or start the next chore of the day. */
  const goToChores = () => {
    const st = sRef.current;
    const jb = jobRef.current;
    if (jb?.key.startsWith('care:')) return goToJob(true);
    const left = choresLeft(st);
    if (!left.length) return say('The cows and hens are cared for today');
    const waiting = jobsOf(st).find(j => j.key.startsWith('care:'));
    if (waiting) return say(`${waiting.title} is on your jobs list: finish ${jb?.title.toLowerCase() ?? 'the job in hand'} first`);
    dispatch({ type: 'jobAdd', job: { ...careJob(st, left[0]), then: { type: 'animalCare', id: left[0] } } });
  };
  const chores = s.fs.phase === 'done' ? choresCount(s) : null;
  const choresDone = chores ? chores.cows.done + chores.hens.done : 0;
  const choresAll = chores ? chores.cows.all + chores.hens.all : 0;

  useEffect(() => {
    const w = eng.current;
    if (!w) return;
    const target = task.target;
    // the job in hand points the arrow at its spot; otherwise the task card's target
    const jp = jobStop ? stopPoint(jobStop, w) : null;
    const arrowAt = jp ?? ('place' in target ? PLACES[target.place] : target.at === 'sign' ? signOf(target.farm) : w.nextTile(target.farm));
    w.setView({ trial: t, field: s.field, today, look, arrowAt: arrowAt ? { x: arrowAt.x, z: arrowAt.z } : null, focus: 'farm' in target ? target.farm : null, paused: overlay });
  }, [t, s.field, today, look, task, overlay, jobStop]);

  // the herd and the coop on the 3D farm follow the game: a stolen hen is gone, a built coop stands
  const herd = tankOf(s.tank).herd;
  // each coop and shed shows as the model it looks like (five options, two models each)
  const coop = coopOption(lifeOf(s.life).coop)?.look ?? null;
  const shed = shedOption(lifeOf(s.life).shed)?.look ?? null;
  useEffect(() => {
    eng.current?.setLife({ cows: herd.cows, hens: herd.hens, coop, shed });
  }, [herd.cows, herd.hens, coop, shed]);

  // the power yard as built, and the lights lit (src/power)
  const pw = powerOf(s.power);
  const partsKey = Object.keys(pw.parts).sort().join();
  const lit = lightsLit(s);
  useEffect(() => {
    eng.current?.setPower({ parts: partsKey ? partsKey.split(',') : [], lit });
  }, [partsKey, lit]);
  // night mode: the phone's clock (7 pm to 6 am), or always day, or always night (Settings › Display)
  const hour = new Date(now).getHours();
  const nightMode = s.settings.night === 'night' || ((s.settings.night ?? 'auto') === 'auto' && (hour >= 19 || hour < 6));
  useEffect(() => {
    eng.current?.setNight(nightMode);
  }, [nightMode]);
  // the greenhouse's beds and the storehouse's shelves (src/greenhouse, src/storehouse)
  const farmDay = lifeOf(s.life).day;
  const gh = greenhouseOf(s.greenhouse);
  const ghOpen = farmDay >= GREENHOUSE.openDay;
  const needs = ghNeeds(gh, farmDay);
  const ghKey = gh.beds.map((b, i) => `${b.crop}:${bedStage(b, farmDay)}:${needs.statuses[i]}`).join('|');
  useEffect(() => {
    eng.current?.setGreenhouse(
      gh.beds.map((b, i) => {
        const st = needs.statuses[i];
        return { crop: b.crop, stage: bedStage(b, farmDay), need: st === 'empty' ? 'plant' : st === 'thirsty' ? 'water' : st === 'ready' ? 'pick' : null };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghKey]);
  const store = produceOf(s.produce).store;
  const COLORS: Partial<Record<string, string>> = { tomatoes: '#e2382a', capsicum: '#3f9a3a', cucumber: '#2f7a32', strawberries: '#e0364a', chillies: '#d42a1e', sukuma: '#2f7d3a', sauce: '#b8281e', jam: '#c21f45', chillisauce: '#e0581e', pickles: '#8fae3a', flour: '#f3ead2' };
  const shelf = {
    fresh: PRODUCE_IDS.filter(id => PRODUCE[id].fresh && (store[id] ?? 0) > 0).map(id => ({ color: COLORS[id] ?? '#6aa336', kg: store[id]! })),
    keeps: PRODUCE_IDS.filter(id => !PRODUCE[id].fresh && !PRODUCE[id].made).reduce((n, id) => n + (store[id] ?? 0), 0),
    made: PRODUCE_IDS.filter(id => PRODUCE[id].made && (store[id] ?? 0) > 0).map(id => ({ color: COLORS[id] ?? '#c4302b', kg: store[id]! })),
  };
  const shelfKey = JSON.stringify(shelf);
  useEffect(() => {
    eng.current?.setStorehouse(shelf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shelfKey]);
  // the tractor drives as fast as its driver and its condition allow
  const tractor = hubOf(s.hub);
  useEffect(() => {
    if (eng.current) eng.current.tractorSpeed = speedOf(tractor);
  }, [tractor.xp, tractor.condition]);

  function targetOf(tk: Task, w: FarmWorld) {
    const target = tk.target;
    if ('place' in target) return PLACES[target.place];
    if (target.at === 'sign') return signOf(target.farm);
    return w.nextTile(target.farm);
  }

  /* ---------------- the tractor seat: a type and a tool, and bonus points ---------------- */

  /** At the tractor: pick its type and tool first (while the farms grow), then hop on. */
  function mountTractor() {
    const w = eng.current;
    if (!w) return;
    if (w.isBusy()) return say('The tractor is busy ploughing');
    const why = cannotDrive(hubOf(sRef.current.hub));
    if (why) {
      say(why);
      return setHub(why.includes('repair') ? 'repair' : 'refuel');
    }
    if (sRef.current.trial?.phase === 'growing') return setCare({ kind: 'rig' });
    ride(null);
  }

  function ride(rig: Rig | null) {
    const w = eng.current;
    if (!w) return;
    const r = w.mount(rig ?? undefined);
    if (r === 'busy') return say('The tractor is busy ploughing');
    if (r === 'far') return;
    setRig(rig);
    track('tractor_ride', { stage: 'seat', ...(rig ?? {}) });
    if (rig) {
      const jobs = toolJobs(rig.tool).map(j => JOB_INFO[j].name.toLowerCase());
      say(`${tractorName(rig.tractor)} tractor, ${toolName(rig.tool).toLowerCase()}: drive over plots to ${jobs.join(' or ')}. +${TRACTOR_BONUS.perJob} points a farm`);
    } else say('On the tractor');
  }

  /** The Tractor button: get off, or open the tractor screen in its yard (train, learn, service, repair, refuel, hire, drive). */
  const toggleRide = () => {
    const w = eng.current;
    if (!w) return;
    if (w.isRiding()) {
      w.dismount();
      return say('Off the tractor: small jobs are done on foot');
    }
    const h = hubOf(sRef.current.hub);
    setHub(h.condition <= 0 ? 'repair' : h.fuel <= 0 ? 'refuel' : 'yard');
  };
  /** Drive (from the tractor screen): walk to the tractor and hop on. */
  const driveTractor = () => {
    const w = eng.current;
    if (!w) return;
    setHub(null);
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
    // already standing in the place the card points to: the tap on the card is the player's choice, so it opens now.
    // Walking there only brings the farmer to its white square, where a button opts in (nothing opens by itself).
    if ('place' in task.target && w.placeHere() === task.target.place) return enterPlace();
    const p = targetOf(task, w);
    intent.current = 'place' in task.target ? null : task.target.at === 'sign' ? task.target.farm : null;
    // already at the sign: open the check
    if (intent.current !== null && 'farm' in task.target && atSign === task.target.farm) {
      intent.current = null;
      return openCheck(task.target.farm);
    }
    w.walkTo(p.x, p.z);
  };

  /** The button on a place's white square: the farmer opts into that activity (nothing starts by just walking in). */
  function enterPlace() {
    const w = eng.current;
    if (!w) return;
    w.enterPlace();
  }

  /** From the at-risk list: straight to that farm's sign, into its check (or the fix, or the work left). */
  function goToProblem(item: RiskItem) {
    const w = eng.current;
    if (!w) return;
    if (w.isRiding()) w.dismount();
    const sg = signOf(item.farm);
    w.spawn(sg.x, sg.z + 0.7);
    intent.current = null;
    if (item.status === 'work') {
      const st = sRef.current;
      const tr = st.trial;
      const pend = tr ? careLeft(st.field.cycle === tr.cycle ? st.field : { ...st.field, marks: {} }, tr, item.farm, fieldDay(tr, dayNumber())) : null;
      if (pend) say(`${farmName(item.farm)}: ${JOB_HINT[pend.job]}`);
      const tile = w.nextTile(item.farm);
      w.walkTo(tile.x, tile.z);
      return;
    }
    openCheck(item.farm);
  }

  function onPlace(p: Place) {
    const st = sRef.current;
    const tr = st.trial;
    const d = fieldDay(tr, dayNumber());
    if (p === 'mission') return dispatch({ type: 'trials', open: true });
    // the cow pen and the chicken coop: the animals' page (a coop still to build opens on it)
    if (p === 'power') return dispatch({ type: 'open', modal: { kind: 'power', tab: powerOn(st) ? 'today' : 'build' } });
    if (p === 'pen' || p === 'coop') {
      const l = lifeOf(st.life);
      // the coop is upgraded from day 1, the cow shed from day 3; the daily care starts on day 2
      if (p === 'coop' && coopOpen(st) && (!l.coop || !careOpen(st))) return dispatch({ type: 'open', modal: { kind: 'animals', tab: 'coop' } });
      if (p === 'pen' && shedOpen(st) && !l.shed) return dispatch({ type: 'open', modal: { kind: 'animals', tab: 'shed' } });
      if (!careOpen(st)) return say(`The cows are in your care from day ${LIFE.startDay}: sleep at the farmhouse first`);
      return dispatch({ type: 'open', modal: { kind: 'animals', tab: 'today' } });
    }
    if (p === 'hire') return setHub(hireInfo(st).ready ? 'hire' : 'yard');
    if (p === 'market') return onMarket();
    // the restaurant opens on its shop floor: customers walk in and order (src/shop)
    if (p === 'restaurant') return dispatch({ type: 'open', modal: { kind: 'serve', shop: 'restaurant' } });
    // the greenhouse opens on the bed that needs the farmer most (pick, then water, then plant); the storehouse on its
    // Harvest when a bed is ripe
    if (p === 'greenhouse' || p === 'storehouse') {
      const day = lifeOf(st.life).day;
      if (day < GREENHOUSE.openDay) return say(`The ${p} opens on day ${GREENHOUSE.openDay}: sleep at the farmhouse first`);
      const n = ghNeeds(st.greenhouse, day).statuses;
      const first = (['ready', 'thirsty', 'empty'] as const).map(k => n.indexOf(k)).find(i => i >= 0) ?? 0;
      if (p === 'greenhouse') return dispatch({ type: 'open', modal: { kind: 'greenhouse', bed: first } });
      return dispatch({ type: 'open', modal: { kind: 'storehouse', tab: n.includes('ready') ? 'harvest' : 'store' } });
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

  /** What Hire would do now (the tractor screen's Hire section). */
  function hireInfo(st: GameState): { ready: boolean; text: string } {
    const tr = st.trial;
    if (!tr || tr.phase !== 'growing') return { ready: false, text: 'Nothing to hire now: plan your farms first (Mission).' };
    const f = st.field.cycle === tr.cycle ? st.field : { ...st.field, marks: {} };
    const farms = tr.plans.map((_, i) => i).filter(i => machinePrep(tr.plans[i]) && setupLeft(f, tr, i) === 'prep');
    if (!farms.length) return { ready: false, text: 'No farm needs ploughing now. A farm whose plan hires oxen or a tractor is ploughed from here.' };
    const drive = farmToDrive(st);
    return { ready: true, text: drive >= 0 ? `${farmName(drive)} hires the tractor: you drive it first, then it ploughs the farm.` : `${farms.map(farmName).join(', ')}: the ${tr.plans[farms[0]].land === 'ox' ? 'oxen plough' : 'tractor ploughs'} by itself while you work elsewhere.` };
  }

  /** Hire (from the tractor screen): the drive for a tractor-hire farm, or the oxen and the tractor plough by themselves. */
  function startHire() {
    const st = sRef.current;
    setHub(null);
    // a tractor-hire farm is driven by the player first (from Wakala Agent); oxen plough by themselves
    const drive = farmToDrive(st);
    if (drive >= 0) {
      track('tractor_open', { farm: drive, stage: 'prep' });
      return setCare({ kind: 'tractor', farm: drive });
    }
    dispatch({ type: 'fieldHire' });
    say('The ploughing has begun');
  }

  /** The Sell stall: the six farms' harvest when it is all in, otherwise the market stall's shop floor (customers
      walk in and buy from the store, 25 kg a day: src/shop). */
  function onMarket() {
    const st = sRef.current;
    const tr = st.trial;
    const d = fieldDay(tr, dayNumber());
    if (!tr || tr.phase !== 'growing' || d <= CHECK_DAYS || !allHarvested(st.field, tr)) return dispatch({ type: 'open', modal: { kind: 'serve', shop: 'market' } });
    dispatch({ type: 'trialHarvest' });
    window.setTimeout(() => dispatch({ type: 'trials', open: true }), 1400);
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
          then={job ? `${JOB_HINT[job]} (${money(treatCostFor(tr, c.farm, c.day, h))}).${FOLLOW_UP[h] ? ` ${FOLLOW_UP[h]!.why}` : ''}` : 'deal with it.'}
          onPick={op => dispatch({ type: 'prescribe', farm: c.farm, day: c.day, pick: op.id, right: op.right })}
          treatments={TREATMENTS[h]}
          treatment={rec?.treatment}
          baseCost={treatCost(h)}
          onTreat={w => {
            dispatch({ type: 'treatChoose', farm: c.farm, day: c.day, id: w.id });
            track('treatment_choice', { farm: c.farm, day: c.day, hazard: h, way: w.id });
          }}
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
          gate={s}
          tr={tr}
          farm={c.farm}
          kinds={c.kinds}
          field={f}
          coins={s.coins}
          dispatch={dispatch}
          tag={`The shed · ${KIND_WORDS[k].title.toLowerCase()}`}
          line={`${KIND_WORDS[k].rule} Tap a box for choices.`}
          done={{ label: c.then === 'sprayer' ? 'Pick up the sprayer' : c.then === 'seeds' ? 'Take the seed' : 'Take the fertilizer', onClick: pick }}
          onLeave={() => setCare(null)}
        />
      );
    }
    if (c.kind === 'options') return <ShedOptions s={s} of={c.of} dispatch={dispatch} onClose={() => setCare(null)} />;
    if (c.kind === 'rig')
      return (
        <TractorPick
          gate={s}
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
        gate={s}
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
    else if (job && canTreat(h, plan)) then = `Now ${JOB_HINT[job]} (${money(DAMAGE[h].treat)}).`;
    else if (DAMAGE[h].treat > 0) then = 'Untreated: the damage goes on.';
    const voice = voiceFor(t.cycle, checking.farm, checking.day, h, !!returnedProblem(t, checking.farm, checking.day));
    return { r, voice, after: { right: [cause, h === 'healthy' ? '' : then].filter(Boolean).join(' '), wrong: DAMAGE[h].missed ? `Look again in ${CHECK_WAIT_S} seconds: until read right, it costs harvest.` : '' } };
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

  // today's build: the next power part, the coop (day 1), the cow shed (day 3), the greenhouse (day 4)
  const build = useMemo(() => {
    if (s.fs.phase !== 'done') return null;
    const step = nextStep(s);
    if (step && farmDay >= step.day) return { icon: step.icon, title: step.id === 'switchOn' ? 'Switch on the power' : `Put in the ${step.name.toLowerCase()}`, go: { kind: 'power', tab: 'build' } as const, power: true };
    const l = lifeOf(s.life);
    if (coopOpen(s) && !l.coop) return { icon: '🐔', title: 'Upgrade the chicken coop', go: { kind: 'animals', tab: 'coop' } as const };
    if (shedOpen(s) && !l.shed) return { icon: '🐄', title: 'Upgrade the cow shed', go: { kind: 'animals', tab: 'shed' } as const };
    const empty = ghOpen ? gh.beds.findIndex(b => !b.crop) : -1;
    if (empty >= 0) return { icon: '🍅', title: `Plant greenhouse ${BED_NAMES[empty].toLowerCase()}`, go: { kind: 'greenhouse', bed: empty } as const };
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.power, s.life, s.greenhouse, s.fs.phase, farmDay]);
  const shedKind: PlotKind | null = anchors.place === 'shed-seeds' ? 'seed' : anchors.place === 'shed-fertilizer' ? 'fert' : anchors.place === 'shed-sprayer' ? 'sprayer' : null;
  const powerHasLights = !!pw.parts.lights;
  const placeBtn = anchors.place ? placeButton(anchors.place, s.field.carry) : null;
  // at the greenhouse's door: what its beds need now
  const placeSub =
    anchors.place === 'greenhouse'
      ? !ghOpen
        ? `Opens on day ${GREENHOUSE.openDay}`
        : [needs.ready && `${needs.ready} to pick`, needs.thirsty && `${needs.thirsty} to water`, needs.empty && `${needs.empty} to plant`].filter(Boolean).join(' · ') || 'Every bed growing'
      : anchors.place === 'storehouse' && !ghOpen
        ? `Opens on day ${GREENHOUSE.openDay}`
        : null;

  return (
    <div className={`abs world${nightMode ? ' is-night' : ''}${kakumaPhase() !== 'over' && !kakumaOf(s.kakuma).tucked ? ' has-event' : ''}`} style={{ inset: 0 }}>
      <canvas ref={canvas} className="world-canvas" width={STAGE_W} height={STAGE_H} />
      <div ref={pad} className="world-pad" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
      {!loadGone && <FarmLoading done={loaded} />}

      {stick && (
        <div className="joy" style={{ left: stick.x - 40, top: stick.y - 40 }} aria-hidden="true">
          <span style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
        </div>
      )}

      {/* the HUD gives way to the full-screen rounds and six-farms screens, which have their own navigation, and to every
          screen on top (a pop-up never shares the stage with HUD buttons: docs/ui-spacing-plan.md) */}
      {!(s.roundsOpen || s.trialsOpen || s.bizOpen || s.modal) && (
        <>
      {/* the farmer and their level */}
      <div className="hud-avatar">
        <span className="hud-hex">
          <FarmerPortrait look={look} size={40} />
        </span>
        <span className="hud-level">{s.level}</span>
      </div>
      <button type="button" className="hud-round" style={{ left: 12, top: 66 }} onClick={() => dispatch({ type: 'open', modal: { kind: 'settings' } })} aria-label="Settings">
        <GearIcon />
        <span>SETTINGS</span>
      </button>
      <button type="button" className="hud-round hud-menu" onClick={nav.menu} aria-label="Main menu">
        <MenuIcon />
        <span>MENU</span>
      </button>
      <button
        type="button"
        data-pad-x
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

      {/* coins and points, and the day of the farming period beside the money */}
      <div className="hud-pills">
        <button
          type="button"
          className={`hud-day${farmDay >= FARM_PERIOD_DAYS ? ' is-done' : ''}`}
          onClick={() => dispatch({ type: 'open', modal: { kind: 'achievements', tab: 'journey' } })}
          aria-label={`Day ${Math.min(farmDay, FARM_PERIOD_DAYS)} of the ${FARM_PERIOD_DAYS}-day farming period`}
        >
          Day&nbsp;<b>{Math.min(farmDay, FARM_PERIOD_DAYS)}</b>/{FARM_PERIOD_DAYS}
        </button>
        <span className="hud-pill" title={`Money (${currency().name})`}>
          <img src={img.cash} alt="" width={26} height={26} />
          <b>
            <button type="button" className="hud-wallet" onClick={() => dispatch({ type: 'open', modal: { kind: 'wallet', tab: 'history' } })} aria-label={`Wallet: ${money(s.coins)}. Every payment in and out`}>
              {moneyShort(s.coins)}
            </button>
          </b>
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
        {/* night: a small chip under the day, out of the way of the farm */}
        {nightMode && (
          <span className="hud-moon" aria-label={`Night${lit ? ': the farm lights are on' : ''}`}>
            🌙 Night{lit ? ' · lights on' : powerHasLights ? ' · lights off' : ''}
          </span>
        )}
      </div>
      <button type="button" className="hud-round hud-climate" onClick={() => dispatch({ type: 'open', modal: { kind: 'climate' } })} aria-label={`Climate: emissions, water, soil and credits${grade ? ` (rating ${grade.grade})` : ''}`}>
        <ClimateIcon />
        <span>CLIMATE</span>
        {grade && <i className="hud-badge" aria-hidden="true">{grade.grade}</i>}
      </button>
      <ProgressButton s={s} dispatch={dispatch} />
      <button type="button" className="hud-round hud-mission" onClick={() => dispatch({ type: 'trials', open: true })} aria-label="Mission: plan, progress and results of your farms">
        <ClipboardIcon />
        <span>MISSION</span>
      </button>
      <WaterButton s={s} dispatch={dispatch} />
      <button type="button" className="hud-round hud-partners" onClick={() => dispatch({ type: 'open', modal: { kind: 'partners' } })} aria-label="Partners: offers, placements and ways to partner with TemoLima">
        <PartnersIcon />
        <span>PARTNERS</span>
      </button>
      {/* the Kakuma special event: a pop-up on the bottom left, or tucked into a round button under Partners */}
      <KakumaPopup s={s} dispatch={dispatch} />
      <button type="button" className="hud-round hud-shop" onClick={() => dispatch({ type: 'open', modal: { kind: 'shop', tab: 'food' } })} aria-label="Shop">
        <img src={img.cart} alt="" width={30} height={30} />
        <span>SHOP</span>
      </button>

      {/* the job in hand (src/onsite): it takes the task card's place until it is done or dropped */}
      {job && jobStop ? (
        <div className="hud-task is-job" role="group" aria-label={`Job in hand: ${job.title}`}>
          <button type="button" data-pad-y className="hud-job-go" onClick={() => (anchors.job ? startJobWork() : goToJob(true))} aria-label={`Job: ${job.title}. ${anchors.job ? jobStop.button : 'Tap to walk there.'}`}>
            <span className="hud-task-icon">
              <i className="hud-job-icon" aria-hidden="true">
                {job.icon}
              </i>
              <small>
                {job.done + 1}/{job.stops.length}
              </small>
            </span>
            <span className="hud-task-text">
              <b>{job.title}</b>
              <i>
                {anchors.job ? `Here: ${jobStop.button.toLowerCase()}` : `Walk to ${job.where}`}
                {jobsOf(s).length > 1 ? ` · ${jobsOf(s).length - 1} more waiting` : ''}
              </i>
            </span>
          </button>
          <button type="button" className="hud-job-drop" onClick={() => (setJobWork(null), dispatch({ type: 'jobDrop', id: job.id }))} aria-label={`Drop the job: ${job.title}`} title="Drop this job">
            ✕
          </button>
        </div>
      ) : (
      /* what to do next: tap it to walk there */
      <button type="button" data-pad-y className="hud-task" onClick={goToTask} aria-label={`Next: ${task.title}. Tap to walk there.`}>
        <span className="hud-task-icon">
          <TaskGlyph icon={task.icon} />
          {(task.coins !== undefined || task.points) && (
            <small className={task.coins !== undefined && task.coins < 0 ? 'is-cost' : ''}>
              {task.points && <img src={img.star} alt="" width={10} height={10} />}
              {task.points ? `+${task.points}` : money(Math.abs(task.coins ?? 0))}
            </small>
          )}
        </span>
        <span className="hud-task-text">
          <b>{task.title}</b>
          {task.note && <i>{task.note}</i>}
        </span>
      </button>
      )}

      {/* the daily chips, bottom right: small, one line each (the animals' care, then the tidy-up) */}
      <div className="hud-daily">
      {/* the cows' and hens' care, every day: tap to walk to the next chore at the pen or the coop */}
      {chores && choresAll > 0 && (
        <button
          type="button"
          className={`hud-tidy hud-chores${choresDone === choresAll ? ' is-done' : ''}`}
          onClick={goToChores}
          aria-label={choresDone === choresAll ? 'Animal chores done today' : `Animal chores: cows ${chores.cows.done} of ${chores.cows.all}, hens ${chores.hens.done} of ${chores.hens.all}. Tap to walk to the next one.`}
        >
          <b className="hud-tidy-head">{choresDone === choresAll ? '✓ Animals cared for' : 'Animal chores'}</b>
          <span className="hud-tidy-row">
            <span className={chores.cows.done === chores.cows.all ? 'is-full' : ''}>
              🐄 {chores.cows.done}/{chores.cows.all}
            </span>
            <span className={chores.hens.done === chores.hens.all ? 'is-full' : ''}>
              🐔 {chores.hens.done}/{chores.hens.all}
            </span>
          </span>
        </button>
      )}
      {/* the daily tidy-up: today's bushes and rocks; tap to walk to the nearest one */}
      {tidyOn && (
        <button
          type="button"
          className={`hud-tidy${tidy.done === TIDY_TOTAL ? ' is-done' : ''}`}
          onClick={goToTidy}
          aria-label={
            tidy.done === TIDY_TOTAL
              ? `Daily tidy-up done${tidyStreak(s.tidy, date) > 1 ? `, ${tidyStreak(s.tidy, date)} days in a row` : ''}`
              : `Daily tidy-up: ${tidy.bushes} of ${TIDY.bushes} bushes and ${tidy.rocks} of ${TIDY.rocks} rocks cleared. Tap to walk to the nearest.`
          }
        >
          <b className="hud-tidy-head">{tidy.done === TIDY_TOTAL ? '✓ Farm tidy' : 'Daily tidy-up'}</b>
          <span className="hud-tidy-row">
            <span className={tidy.bushes === TIDY.bushes ? 'is-full' : ''}>
              <TidyGlyph kind="bush" /> {tidy.bushes}/{TIDY.bushes}
            </span>
            <span className={tidy.rocks === TIDY.rocks ? 'is-full' : ''}>
              <TidyGlyph kind="rock" /> {tidy.rocks}/{TIDY.rocks}
            </span>
          </span>
          {tidyStreak(s.tidy, date) > 0 && <i className="hud-tidy-streak">🧹{tidyStreak(s.tidy, date)}</i>}
        </button>
      )}
      </div>

      {/* bottom left, one stack that never overlaps: today's lesson, today's build, then the day and what the farmer
          carries (moved right of the special event's card while it shows) */}
      <div className="hud-dock">
      {/* the first days: today's Farm basics lesson, until it is read */}
      <BasicsChip day={lifeOf(s.life).day} read={s.basics ?? []} />
      {build && !anchors.riding && !job && (
        <button type="button" className="hud-build" onClick={() => dispatch({ type: 'open', modal: build.go })} aria-label={`Today: ${build.title}`}>
          <i aria-hidden="true">{build.icon}</i>
          <span>
            {build.title}
            <small>Day {farmDay} · tap to start</small>
          </span>
        </button>
      )}
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

      </div>
        </>
      )}

      {/* the evidence layer: now and then, "have you tried this on your own farm?" */}
      {!overlay && !(s.roundsOpen || s.trialsOpen || s.bizOpen || s.modal) && <EvidenceAsk s={s} dispatch={dispatch} />}

      {/* money at risk on the six farms: the first thing on the farm the eye lands on, beside the task card */}
      <RiskHud s={s} risk={risk} dispatch={dispatch} hud={!(s.roundsOpen || s.trialsOpen || s.bizOpen || s.modal) && !overlay} busy={overlay || s.roundsOpen || s.trialsOpen || s.bizOpen} onGo={goToProblem} />

      {/* clearing and planting: the button on the plot under the farmer, then its timer */}
      {working && !overlay && <PlotTimer at={anchors.farmer} start={working.start} ms={working.ms} verb={working.job === 'prep' ? 'Clearing' : 'Planting'} what={rowName(working.row)} />}
      {tidying && !overlay && <PlotTimer at={anchors.farmer} start={tidying.start} ms={tidying.ms} verb={tidying.item.kind === 'bush' ? 'Clearing' : 'Moving'} what={`the ${tidying.item.kind}`} />}
      {jobWork && jobStop && !overlay && <PlotTimer at={anchors.farmer} start={jobWork.start} ms={jobWork.ms} verb={jobStop.doing} what="" />}
      {!working && !tidying && !jobWork && job && jobStop && anchors.job && !overlay && !pageOpen && (
        <button
          type="button"
          data-pad-primary
          className="hud-plot is-job"
          style={{ left: Math.min(STAGE_W - 90, Math.max(90, anchors.farmer.x)), top: Math.min(STAGE_H - 60, anchors.farmer.y + 70) }}
          onClick={startJobWork}
          aria-label={`${jobStop.button} (${jobStop.secs} seconds, step ${job.done + 1} of ${job.stops.length})`}
        >
          <i className="hud-job-icon" aria-hidden="true">
            {job.icon}
          </i>
          <span>
            <b>{jobStop.button}</b>
            <i>
              {job.title} · {job.done + 1} of {job.stops.length}
            </i>
          </span>
        </button>
      )}
      {!working && !tidying && !jobWork && !anchors.job && !anchors.plot && anchors.tidy && tidyOn && !overlay && !(s.roundsOpen || s.trialsOpen || s.bizOpen || s.modal) && (
        <button
          type="button"
          data-pad-primary
          className={`hud-plot is-tidy is-${anchors.tidy.kind}`}
          style={{ left: Math.min(STAGE_W - 90, Math.max(90, anchors.farmer.x)), top: Math.min(STAGE_H - 60, anchors.farmer.y + 70) }}
          onClick={() => startTidy(anchors.tidy!)}
          aria-label={`${anchors.tidy.kind === 'bush' ? 'Clear the bush' : 'Move the rock'} (${TIDY.workS[anchors.tidy.kind]} seconds, +${TIDY.pointsEach} points)`}
        >
          <TidyGlyph kind={anchors.tidy.kind} />
          <span>
            <b>{anchors.tidy.kind === 'bush' ? 'Clear bush' : 'Move rock'}</b>
            <i>+{TIDY.pointsEach} points</i>
          </span>
        </button>
      )}
      {!working && !tidying && !jobWork && !anchors.job && anchors.plot && !overlay && !(s.roundsOpen || s.trialsOpen || s.bizOpen || s.modal) && (
        <button
          type="button"
          data-pad-primary
          className={`hud-plot is-${anchors.plot.job}`}
          style={{ left: Math.min(STAGE_W - 90, Math.max(90, anchors.farmer.x)), top: Math.min(STAGE_H - 60, anchors.farmer.y + 70) }}
          onClick={() => startPlot(anchors.plot!)}
          aria-label={`${anchors.plot.job === 'prep' ? 'Clear' : 'Plant'} ${rowName(anchors.plot.row)} of ${farmName(anchors.plot.farm)} (${PLOT_WORK_S} seconds)`}
        >
          <TaskGlyph icon={anchors.plot.job === 'prep' ? 'hoe' : 'seeds'} />
          <span>
            <b>{anchors.plot.job === 'prep' ? 'Clear' : 'Plant'}</b>
            <i>{rowName(anchors.plot.row)}</i>
          </span>
        </button>
      )}

      {/* a place's white square (Train, Seeds, Sell, Sleep…): a button opts into its activity; walking in starts nothing */}
      {!working && !tidying && !jobWork && !anchors.job && !anchors.plot && !anchors.riding && placeBtn && !overlay && !(s.roundsOpen || s.trialsOpen || s.bizOpen || s.modal) && (
        <div className="hud-place" style={{ left: Math.min(STAGE_W - 150, Math.max(150, anchors.farmer.x)), top: Math.min(STAGE_H - 60, anchors.farmer.y + 70) }}>
          <button type="button" data-pad-primary className={`hud-plot is-enter is-${anchors.place}`} onClick={enterPlace} aria-label={placeBtn.aria}>
            {placeBtn.icon ? <TaskGlyph icon={placeBtn.icon} /> : <span className="hud-place-emoji" aria-hidden>{placeBtn.emoji}</span>}
            <span>
              <b>{placeBtn.label}</b>
              <i>{placeSub ?? placeBtn.sub}</i>
            </span>
          </button>
          {shedKind && (
            <button
              type="button"
              className="hud-plot is-options"
              onClick={() => setCare({ kind: 'options', of: shedKind })}
              aria-label={`${SHED_WORD[shedKind]}: choose from every option`}
            >
              <span>
                <b>Options ▾</b>
                <i>Every {SHED_WORD[shedKind].toLowerCase()} choice</i>
              </span>
            </button>
          )}
        </div>
      )}

      {anchors.bill && !overlay && !(s.roundsOpen || s.trialsOpen || s.bizOpen || s.modal) && (
        <BillboardTag bill={anchors.bill} dispatch={dispatch} />
      )}

      {hint && (
        <div key={hint.id} className="hud-hint" style={{ left: Math.min(STAGE_W - 120, Math.max(120, anchors.farmer.x)), top: Math.max(HUD_TOP_CLEAR + 30, anchors.farmer.y - 34) }}>
          {hint.text}
        </div>
      )}

      {signVoice && anchors.sign?.visible && !overlay && (
        <p className="voice-bubble is-sign" role="note" style={{ left: Math.min(STAGE_W - 170, Math.max(170, anchors.sign.x)), top: signTop(anchors.sign.y) - 40 }}>
          <b>{signVoice.name}:</b> {signVoice.say}
        </p>
      )}
      {showCheck && anchors.sign?.visible && (
        <button type="button" data-pad-primary className="hud-check" style={{ left: Math.min(STAGE_W - 90, Math.max(90, anchors.sign.x)), top: signTop(anchors.sign.y) }} disabled={wait > 0} onClick={() => openCheck(signFarm)}>
          {wait > 0 ? `Look again in ${wait}s` : `Check ${farmName(signFarm)}`}
        </button>
      )}


      {hub && (
        <div className="abs world-check" style={{ inset: 0 }}>
          <Suspense fallback={<ActivityLoading label="Opening the tractor yard…" />}>
            <TractorHub s={s} dispatch={dispatch} section={hub} onSection={setHub} hire={hireInfo(s)} onHire={startHire} onDrive={driveTractor} onClose={() => setHub(null)} />
          </Suspense>
        </div>
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
            note={`${CROP_NAME[check.r.crop]} · day ${checking.day} of ${CHECK_DAYS}`}
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
            progress={{ done: t.plans.filter((_, i) => t.checks[checkKey(i, checking.day)]?.right).length, total: t.plans.length, unit: 'farm' }}
            stake={risk.items.find(x => x.farm === checking.farm)?.amount}
          />
        </div>
      )}

      {care && t && (
        <div className="abs world-check" style={{ inset: 0 }}>
          <Suspense fallback={<ActivityLoading label={CARE_LOADING[care.kind]} />}>{careScreen(care, t)}</Suspense>
        </div>
      )}
    </div>
  );
}


/** The plot under the farmer that is waiting to be cleared or planted (its button shows). */
/** The row of plots under the farmer waiting for the button: its plots still to do are bits. */
type PlotHere = { farm: number; plot: number; row: number; bits: number; job: 'prep' | 'sow'; fx: Fx };
type Anchors = {
  farmer: { x: number; y: number };
  sign: { x: number; y: number; visible: boolean } | null;
  riding: boolean;
  nearTractor: boolean;
  plot: PlotHere | null;
  /** a partner billboard the farmer is near, where it shows on the stage */
  bill?: { slot: SlotId; x: number; y: number } | null;
  /** one of the day's bushes or rocks the farmer stands by */
  tidy?: TidyItem | null;
  /** the place the farmer stands in (a shed spot shows its options button) */
  place?: Place | null;
  /** the farmer stands at the spot of the job in hand (src/onsite): its button shows */
  job?: boolean;
};
const samePlot = (a: PlotHere | null, b: PlotHere | null) => a === b || (!!a && !!b && a.farm === b.farm && a.row === b.row && a.job === b.job);
const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;
function sameAnchors(a: Anchors, b: Anchors) {
  if (a.riding !== b.riding || a.nearTractor !== b.nearTractor || !near(a.farmer, b.farmer) || !samePlot(a.plot, b.plot)) return false;
  if (a.bill?.slot !== b.bill?.slot || (a.bill && b.bill && !near(a.bill, b.bill))) return false;
  if (a.tidy?.id !== b.tidy?.id || !!a.job !== !!b.job) return false;
  if (a.place !== b.place) return false;
  if (!a.sign || !b.sign) return a.sign === b.sign;
  return a.sign.visible === b.sign.visible && near(a.sign, b.sign);
}

/** How close the farmer must stand to a job's spot to work there. */
const JOB_REACH = 1.0;

/** A job's spot on the farm: around the tractor, its own frame is turned into farm points where it stands now. */
function stopPoint(st: JobStop, w: FarmWorld): { x: number; z: number; face: { x: number; z: number } | null } {
  if (st.anchor !== 'tractor') return { x: st.x, z: st.z, face: st.face ?? null };
  const p = w.tractorPose();
  const fx = Math.sin(p.ry);
  const fz = Math.cos(p.ry);
  return { x: p.x + fz * st.x + fx * st.z, z: p.z - fx * st.x + fz * st.z, face: { x: p.x, z: p.z } };
}

/** The partner billboard the farmer is standing under (and that shows on screen): its offer tag goes over it.
    A world unit is about a metre (the farmer stands ~1.65 tall); the pole keeps the farmer 0.8 away, so the tag
    shows only from right beneath the board, within a metre of its pole. */
const BILL_REACH = 1.0;
function billboardNear(w: FarmWorld): Anchors['bill'] {
  const me = w.farmerAt();
  for (const bb of BILLBOARDS) {
    if (!slotBrand(bb.slot) || Math.hypot(me.x - bb.x, me.z - bb.z) > BILL_REACH) continue;
    const p = w.project(bb.x, 0.2, bb.z + 0.9);
    if (p.visible) return { slot: bb.slot, x: p.x, y: p.y };
  }
  return null;
}

/** The timer over the farmer while a plot is cleared or planted: a stopwatch whose ring fills, and the seconds left. */
function PlotTimer({ at, start, ms, verb, what }: { at: { x: number; y: number }; start: number; ms: number; verb: string; what: string }) {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const done = Math.min(1, (now - start) / ms);
  const left = Math.max(0, Math.ceil(((1 - done) * ms) / 1000));
  const R = 15;
  const L = 2 * Math.PI * R;
  return (
    <div className="hud-timer" role="timer" aria-live="polite" aria-label={`${verb} ${what}: ${left} seconds left`} style={{ left: Math.min(STAGE_W - 70, Math.max(70, at.x)), top: Math.max(70, at.y - 12) }}>
      <svg viewBox="-20 -24 40 44" width={46} height={50} aria-hidden="true">
        <rect x={-3} y={-23} width={6} height={5} rx={1.5} fill="#5b3418" />
        <path d="M11,-14 L15,-18" stroke="#5b3418" strokeWidth={3} strokeLinecap="round" />
        <circle r={R + 3} fill="#fff" stroke="#5b3418" strokeWidth={2} />
        <circle r={R} fill="none" stroke="#f1e2c8" strokeWidth={5} />
        <circle r={R} fill="none" stroke="#f39c12" strokeWidth={5} strokeDasharray={`${L * done} ${L}`} transform="rotate(-90)" />
        <text y={5} textAnchor="middle" fontSize={14} fontWeight={900} fill="#5b3418">
          {left}
        </text>
      </svg>
      <span>
        {verb} {what}
      </span>
    </div>
  );
}

/* ---------------- icons ---------------- */

/** What the button on each place's white square says: the player taps it to start that activity. */
function placeButton(p: Place, carry: GameState['field']['carry']): { label: string; sub: string; aria: string; icon?: TaskIcon; emoji?: string } {
  const pick = (item: 'seeds' | 'fertilizer' | 'sprayer' | 'water', label: string, icon: TaskIcon) => {
    const held = carry === item;
    return { label, sub: held ? 'In your hands' : 'Tap to pick up', aria: `${label}${held ? ' (already carrying it)' : ''}`, icon };
  };
  switch (p) {
    case 'shed-seeds':
      return pick('seeds', 'Pick up seeds', 'seeds');
    case 'shed-fertilizer':
      return pick('fertilizer', 'Pick up fertilizer', 'fertilizer');
    case 'shed-sprayer':
      return pick('sprayer', 'Pick up the sprayer', 'spray');
    case 'pond':
      return pick('water', 'Fill the watering can', 'water');
    case 'hire':
      return { label: 'Start training', sub: 'Tractor yard', aria: 'Start training at the tractor yard', icon: 'tractor' };
    case 'market':
      return { label: 'Open the market', sub: 'Serve customers', aria: 'Open the market', icon: 'corn' };
    case 'restaurant':
      return { label: 'Open the restaurant', sub: 'Cook and serve meals', aria: 'Open the restaurant', emoji: '🍲' };
    case 'house':
      return { label: 'Go to sleep', sub: 'End the day', aria: 'Go to sleep', icon: 'sleep' };
    case 'mission':
      return { label: 'Plan the farms', sub: 'Mission board', aria: 'Plan the farms', icon: 'plan' };
    case 'pen':
      return { label: 'See the cows', sub: 'Cow pen', aria: 'See the cows', emoji: '🐄' };
    case 'coop':
      return { label: 'See the hens', sub: 'Chicken coop', aria: 'See the hens', emoji: '🐔' };
    case 'power':
      return { label: 'Open power', sub: 'Power yard', aria: 'Open the power yard', emoji: '⚡' };
    case 'greenhouse':
      return { label: 'Open the greenhouse', sub: 'Four beds under glass', aria: 'Open the greenhouse', emoji: '🍅' };
    case 'storehouse':
      return { label: 'Open the storehouse', sub: 'Store, harvest, produce', aria: 'Open the storehouse', emoji: '📦' };
  }
}

const SHED_WORD: Record<PlotKind, string> = { seed: 'Seeds', fert: 'Fertilizer', sprayer: 'Sprayer' };

/** The daily tidy-up's pieces: a scruffy bush, a rock. */
function TidyGlyph({ kind }: { kind: 'bush' | 'rock' }) {
  return kind === 'bush' ? (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
      <circle cx={8} cy={14} r={6} fill="#2f7d1f" />
      <circle cx={15} cy={12} r={6.5} fill="#4fa62b" />
      <circle cx={13} cy={17} r={5} fill="#c9a85c" />
      <path d="M12 6l-2-4M16 6l2-4M7 9L4 6" stroke="#8a4a14" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
      <path d="M3 19l3-8 6-4 7 3 3 9z" fill="#a7a7a0" stroke="#6f6f68" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M8 12l4-2 4 2" stroke="#d4d4cc" strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </svg>
  );
}

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

/** The top band of the farm HUD (the task card, the harvest card and the money): bubbles in the world stay under it. */
const HUD_TOP_CLEAR = 88;
/** Where the sign's Check button sits: on the sign, but never so high that it or Mama Achieng's bubble above it reaches
    into the HUD's top band (they covered the task card when the sign was near the top of the screen). */
const signTop = (y: number) => Math.max(y, HUD_TOP_CLEAR + 72);

/** The tag over a partner billboard the farmer walked up to: tap it for the brand's offer. */
function BillboardTag({ bill, dispatch }: { bill: NonNullable<Anchors['bill']>; dispatch: Dispatch<Action> }) {
  const b = slotBrand(bill.slot)!;
  useSlotView(bill.slot);
  return (
    <button
      type="button"
      className="hud-bill"
      style={{ left: Math.min(STAGE_W - 80, Math.max(80, bill.x)), top: Math.min(STAGE_H - 40, Math.max(HUD_TOP_CLEAR + 30, bill.y)), ['--brand' as string]: b.color, ['--accent' as string]: b.accent }}
      onClick={() => openOffer(dispatch, bill.slot, b.id)}
      aria-label={`${b.name} billboard: see the offer`}
    >
      <BrandMark b={b} size={18} />
      <i>Partner</i>
      <b>{b.name}</b>
      <span>See offer ›</span>
    </button>
  );
}
