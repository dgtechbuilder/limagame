import { useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as RPointerEvent } from 'react';
import { img } from '../assets';
import { FarmerPortrait } from '../first/art';
import { LOOKS } from '../first/data';
import { Inspect } from '../rounds/Inspect';
import { dayNumber, ROUND_POINTS } from '../rounds/farms';
import { trialRounds } from '../rounds/trial';
import type { Action, GameState } from '../state';
import { CHECK_DAYS, DAMAGE, canTreat, causeOf, checkKey, farmName, hazardFor } from '../trials/model';
import { fmt } from '../components/ui';
import { CARRY_NAME, TREAT_JOB, allHarvested, fieldDay, nextTask, signOf, type Place, type Task, type TaskIcon, type TreatJob } from './field';
import { FarmWorld, PLACES, STAGE_H, STAGE_W } from './engine';

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
  const [anchors, setAnchors] = useState<{ farmer: { x: number; y: number }; sign: { x: number; y: number; visible: boolean } | null }>({ farmer: { x: 437, y: 160 }, sign: null });
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
      mark: (farm, job, bits) => dispatch({ type: 'fieldMark', farm, job, bits }),
      carry: item => {
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
      arrived: () => undefined,
    });
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
      setAnchors({ farmer: f, sign: sg ? w.project(sg.x, 2.5, sg.z) : null });
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

  const overlay = paused || !!checking || !!night;
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

  const goToTask = () => {
    const w = eng.current;
    if (!w) return;
    if ('place' in task.target && task.target.place === 'mission') return dispatch({ type: 'trials', open: true });
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
    if (rec?.right) return say(`${farmName(farm)} is read for today`);
    const key = `${farm}:${d}`;
    const waited = (Date.now() - (checkedRef.current[key] ?? 0)) / 1000;
    if (rec && waited < CHECK_WAIT_S) return say(`Look again in ${Math.ceil(CHECK_WAIT_S - waited)} seconds`);
    setChecking({ farm, day: d, second: !!rec });
  }

  // the check of one farm: the same pictures and calls as the field rounds
  const check = useMemo(() => {
    if (!checking || !t) return null;
    const r = trialRounds(t, checking.day)[checking.farm];
    const h = hazardFor(t, checking.farm, checking.day);
    const plan = t.plans[checking.farm];
    const job = TREAT_JOB[h];
    const cause = causeOf(h, plan, t.forecast);
    let then = '';
    if (h === 'hail') then = 'Nothing to treat: hail-damaged plants often recover.';
    else if (job && canTreat(h, plan)) then = `Now ${JOB_HINT[job]} (${DAMAGE[h].treat} coins).`;
    else if (DAMAGE[h].treat > 0) then = 'It stays untreated, so the damage goes on.';
    return { r, after: { right: [cause, h === 'healthy' ? '' : then].filter(Boolean).join(' '), wrong: DAMAGE[h].missed ? `Look again in ${CHECK_WAIT_S} seconds: until it is read right, it costs harvest.` : '' } };
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

  return (
    <div className="abs world" style={{ inset: 0 }}>
      <canvas ref={canvas} className="world-canvas" width={STAGE_W} height={STAGE_H} />
      <div ref={pad} className="world-pad" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />

      {stick && (
        <div className="joy" style={{ left: stick.x - 40, top: stick.y - 40 }} aria-hidden="true">
          <span style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} />
        </div>
      )}

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
        {s.field.carry && <span className="is-carry">Carrying: {CARRY_NAME[s.field.carry].toLowerCase()}</span>}
      </div>

      {hint && (
        <div key={hint.id} className="hud-hint" style={{ left: Math.min(STAGE_W - 120, Math.max(120, anchors.farmer.x)), top: Math.max(56, anchors.farmer.y - 34) }}>
          {hint.text}
        </div>
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
            continueLabel="Back to the farm"
            onResult={right => {
              const rec = t.checks[checkKey(checking.farm, checking.day)];
              dispatch({ type: 'trialCheck', farm: checking.farm, day: checking.day, right, tries: (rec?.tries ?? 0) + 1, physical: true });
              if (!right) setCheckedAt(c => ({ ...c, [`${checking.farm}:${checking.day}`]: Date.now() }));
            }}
            onContinue={() => setChecking(null)}
            onLeave={() => setChecking(null)}
          />
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
