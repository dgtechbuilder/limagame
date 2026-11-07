import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { NavBar } from '../components/Nav';
import { FarmMap } from '../components/FarmMap';
import { GoldButton } from '../components/ui';
import type { Action, GameState, RoundsView } from '../state';
import { FarmerFigure, FarmerPortrait } from '../first/art';
import { LOOKS, say } from '../first/data';
import { GuideLine } from '../first/Review';
import { track } from '../first/track';
import { CHECK_COOLDOWN_S, FARMS, ROUND_POINTS, checkFor, type Round } from './data';
import { CROP_NAME, CYCLE_DAYS, STAGE_LABELS, dayNumber, type HazardId, type Stage } from './hazards';
import type { Crop } from '../first/data';
import { Inspect, type InspectView } from './Inspect';
import { trialRounds, type TrialRound } from './trial';
import { CHECK_DAYS, FORECASTS, checkKey, currentDay } from '../trials/model';
import { BEDS, START_NODE, START_POINT, measure, pointAt, routeBetween, standNode, type Pt } from './walk';

/* Field rounds: every bed on the farmer's farm, back to back.
   The farmer walks to each farm on the painted map, looks at five pictures (crop, pests & disease, soil, water,
   state of the farm), and makes a call. After a check a farm cannot be checked again for 30 seconds, so a missed
   bed is revisited later: from the chip bar at the top, or from the summary after the last round. */

type Phase = 'ready' | 'walking' | 'inspect' | 'between' | 'summary';
type Status = 'pending' | 'current' | 'first' | 'second' | 'missed';
interface Result {
  right: boolean;
  /** how many times this farm was checked in this run */
  looks: number;
}

const topLine = { top: 8, bottom: 'auto', left: 172, right: 190 } as const;

/** Walks the farmer along the shortest route to a stand point, at a steady pace. */
function useWalker() {
  const [p, setP] = useState<Pt>(START_POINT);
  const [dir, setDir] = useState<1 | -1>(1);
  const [moving, setMoving] = useState(false);
  const at = useRef(START_NODE);
  const raf = useRef<number | undefined>(undefined);
  const timer = useRef<number | undefined>(undefined);

  const stop = () => {
    if (raf.current !== undefined) cancelAnimationFrame(raf.current);
    window.clearTimeout(timer.current);
    raf.current = undefined;
  };
  useEffect(() => stop, []);

  const walkTo = useCallback((to: string, done?: () => void) => {
    stop();
    const pts = routeBetween(at.current, to);
    const cum = measure(pts);
    const total = cum[cum.length - 1];
    if (total < 1) {
      done?.();
      return;
    }
    const speed = Math.max(120, total / 6); // about 1–6 seconds, whatever the distance
    let d = 0;
    let last = performance.now();
    setMoving(true);
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      d = Math.min(total, d + speed * dt);
      const here = pointAt(pts, cum, d);
      setP(here.p);
      setDir(here.dir);
      if (d >= total) {
        at.current = to;
        raf.current = undefined;
        setMoving(false);
        timer.current = window.setTimeout(() => done?.(), 250);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  return { p, dir, moving, walkTo };
}

export function Rounds({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const name = s.farmer?.name ?? 'Farmer';
  const look = LOOKS[s.farmer?.look ?? 0] ?? LOOKS[0];
  const t = (line: string) => say(line, name);
  const walker = useWalker();

  // each farm keeps one crop for 21 real days from the day the player first opened the rounds
  const today = useMemo(() => dayNumber(), []);
  const elapsed = today - (s.rounds.start ?? today);
  const demo = s.roundsDemo?.split(':') as [HazardId, Crop, Stage] | undefined;
  // the six farms: each farm's check comes from its own plan, on the cycle's day
  const trial = s.roundsTrial && s.trial?.phase === 'growing' ? s.trial : null;
  const tDay = trial ? currentDay(trial, today) : 0;
  const rounds: Round[] = useMemo(
    () =>
      trial && tDay <= CHECK_DAYS
        ? trialRounds(trial, tDay)
        : FARMS.map(f => checkFor(f, elapsed, demo && f.id === 'r3' ? { hazard: demo[0], crop: demo[1], stage: demo[2] } : undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [elapsed, s.roundsDemo, trial?.cycle, trial?.plans, tDay],
  );
  // results are for today only: tomorrow every farm is a new situation, and pays again
  const doneToday: Record<string, { right: boolean; tries: number }> = trial
    ? Object.fromEntries(rounds.flatMap(r => {
        const rec = trial.checks[checkKey((r as TrialRound).farmIndex, tDay)];
        return rec ? [[r.id, rec]] : [];
      }))
    : s.rounds.day === today
      ? s.rounds.done
      : {};
  const unit = trial ? 'farm' : 'bed';

  const [phase, setPhase] = useState<Phase>('ready');
  const [idx, setIdx] = useState(-1); // the round visited last in this run; the next is idx + 1
  const [visit, setVisit] = useState<{ round: Round; second: boolean } | null>(null);
  const [results, setResults] = useState<Record<string, Result>>({});
  const [checkedAt, setCheckedAt] = useState<Record<string, number>>({});
  const [earned, setEarned] = useState(0);
  const [demoView, setDemoView] = useState<InspectView | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // tick the cooldown rings while the map is showing
  useEffect(() => {
    if (phase === 'inspect') return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [phase]);

  // Design review: open a given part of the rounds with sample data (never touches a saved game).
  const view: RoundsView | null = s.roundsView;
  useEffect(() => {
    if (!view) return;
    const base = Date.now();
    setResults({});
    setCheckedAt({});
    setEarned(0);
    setIdx(-1);
    setDemoView(null);
    if (view === 'map') {
      setVisit(null);
      setPhase('ready');
    } else if (view === 'summary') {
      setIdx(rounds.length - 1);
      setResults({
        r1: { right: true, looks: 1 },
        r2: { right: true, looks: 1 },
        r3: { right: false, looks: 1 },
        r4: { right: true, looks: 2 },
        r5: { right: true, looks: 1 },
        r6: { right: false, looks: 1 },
      });
      setCheckedAt({ r3: base - 12000, r6: base - 45000 });
      setEarned(550);
      setPhase('summary');
    } else {
      setVisit({ round: rounds[2], second: false });
      setDemoView(view);
      setPhase('inspect');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, s.roundsDemo]);

  const left = (r: Round) => Math.max(0, CHECK_COOLDOWN_S - (now - (checkedAt[r.id] ?? -Infinity)) / 1000);
  // a farm already checked today (in an earlier run) counts as done, so a run picks up where it left off
  const resultOf = (r: Round): Result | undefined =>
    results[r.id] ?? (trial && doneToday[r.id] ? { right: doneToday[r.id].right, looks: doneToday[r.id].tries } : undefined);
  const nextIndex = rounds.findIndex((r, i) => i > idx && !resultOf(r));
  const next = nextIndex >= 0 ? rounds[nextIndex] : undefined;
  // the farm being walked to or looked at; when the map is waiting, the next farm in the run
  const target = visit && (phase === 'walking' || phase === 'inspect') ? visit.round : phase === 'between' || phase === 'ready' ? (next ?? null) : null;

  const statusOf = (r: Round): Status => {
    const res = resultOf(r);
    if (res?.right) return res.looks === 1 ? 'first' : 'second';
    if (res) return 'missed';
    if (target?.id === r.id) return 'current';
    return 'pending';
  };

  const readyAgain = (r: Round) => statusOf(r) === 'missed' && left(r) <= 0;
  const rightCount = rounds.filter(r => resultOf(r)?.right).length;

  const begin = (round: Round, second = false) => {
    setVisit({ round, second });
    setDemoView(null);
    setPhase('walking');
    walker.walkTo(standNode(round.bed), () => {
      setPhase('inspect');
      track('round_start', { round: round.id, second });
    });
  };

  const goNext = () => {
    if (!next) return setPhase('summary');
    setIdx(nextIndex);
    begin(next);
  };

  const onResult = (right: boolean) => {
    if (!visit) return;
    const r = visit.round;
    const looks = (results[r.id]?.looks ?? 0) + 1;
    const paid = right && !doneToday[r.id]?.right ? (looks === 1 ? ROUND_POINTS.first : ROUND_POINTS.second) : 0;
    setResults(prev => ({ ...prev, [r.id]: { right: right || !!prev[r.id]?.right, looks } }));
    setCheckedAt(prev => ({ ...prev, [r.id]: Date.now() }));
    setEarned(e => e + paid);
    if (trial) dispatch({ type: 'trialCheck', farm: (r as TrialRound).farmIndex, day: tDay, right, tries: looks });
    else dispatch({ type: 'roundResult', id: r.id, right, tries: looks, day: today, hazard: r.hazard });
  };

  const onContinue = () => {
    if (!visit) return;
    // `next` was worked out before this farm's result: skip it if it is this farm
    const after = rounds.findIndex((r, i) => i > idx && r.id !== visit.round.id && !resultOf(r));
    setPhase(after >= 0 ? 'between' : 'summary');
  };

  const restart = () => {
    setResults({});
    setCheckedAt({});
    setEarned(0);
    setIdx(-1);
    setVisit(null);
    setPhase('ready');
  };

  // a new day on the six farms starts a new run of checks; after the last day the farms are ready to harvest
  const lastDay = useRef(tDay);
  useEffect(() => {
    if (lastDay.current === tDay) return;
    lastDay.current = tDay;
    if (trial && tDay > CHECK_DAYS) dispatch({ type: 'rounds', open: false });
    else restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tDay]);
  const allChecked = rounds.every(r => resultOf(r));

  const tapRound = (r: Round) => {
    if (phase === 'walking' || phase === 'inspect') return;
    if (readyAgain(r)) return begin(r, true);
    if (statusOf(r) === 'missed') return dispatch({ type: 'toast', text: `${t(r.short)} can be checked again in ${Math.ceil(left(r))} seconds` });
    if ((phase === 'ready' || phase === 'between') && next && r.id === next.id) return goNext();
  };

  /* ---------------- inspecting a farm ---------------- */
  if (phase === 'inspect' && visit) {
    const r = visit.round;
    const last = !rounds.some((x, i) => i > idx && x.id !== r.id && !resultOf(x));
    const fresh = !doneToday[r.id]?.right;
    const tr = trial ? (r as TrialRound) : null;
    return (
      <Inspect
        tag={tr ? `${tr.short} of ${rounds.length}` : undefined}
        note={tr ? `Maize · ${STAGE_LABELS[r.stage]} · day ${tDay} of ${CHECK_DAYS}` : undefined}
        after={tr?.after}
        key={`${r.id}-${visit.second}-${demoView ?? ''}`}
        round={r}
        name={name}
        look={look}
        second={visit.second}
        points={fresh ? (visit.second ? ROUND_POINTS.second : ROUND_POINTS.first) : 0}
        startView={demoView ?? 'look'}
        continueLabel={last ? 'See my results' : 'On the map'}
        onResult={onResult}
        onContinue={onContinue}
        onLeave={() => dispatch({ type: 'rounds', open: false })}
      />
    );
  }

  /* ---------------- the map ---------------- */
  let line = '';
  let action: { label: string; onClick: () => void } | undefined;
  if (phase === 'ready') {
    line = trial
      ? next
        ? t(`Day ${tDay} of ${CHECK_DAYS} on your ${rounds.length} farms, {name}. Check every farm today.`)
        : t(`Every farm is checked for day ${tDay}, {name}.`)
      : t('Every bed on your farm needs a check today, {name}. Each keeps its crop for three weeks.');
    action = next ? { label: next.n === 1 ? 'Start round 1' : `Check ${next.short}`, onClick: goNext } : { label: 'See the day', onClick: () => setPhase('summary') };
  } else if (phase === 'walking' && visit) {
    line = visit.second ? t(`Back to ${visit.round.title}, {name}.`) : t(`Round ${visit.round.n} of ${rounds.length}: off to ${visit.round.title}.`);
  } else if (phase === 'between') {
    const again = rounds.filter(readyAgain);
    line = next
      ? t(`Round ${idx + 1} done, {name}. Next: ${next.title}.`) + (again.length ? ` You can look at ${again[0].short} again.` : '')
      : '';
    action = next ? { label: `Next ${unit}`, onClick: goNext } : undefined;
  }

  return (
    <div className="abs fs-screen rounds" style={{ inset: 0 }}>
      <FarmMap />
      <svg className="village" viewBox="0 0 874 402" width={874} height={402} role="group" aria-label="Your farm. Tap a numbered pin to walk to that bed.">
        {/* the farm the farmer is heading for */}
        {target && (
          <polygon
            points={BEDS[target.bed].poly.map(q => q.join(',')).join(' ')}
            fill="rgba(255,226,120,0.18)"
            stroke="#ffd23f"
            strokeWidth={3}
            strokeDasharray="8 6"
            className="row-hint"
            pointerEvents="none"
          />
        )}

        {Object.values(BEDS).map(bed => {
          const here = rounds.filter(r => r.bed === bed.id);
          return here.map((r, k) => {
            const st = statusOf(r);
            const x = bed.pin[0] + (k - (here.length - 1) / 2) * 26;
            const y = bed.pin[1];
            const wait = st === 'missed' ? left(r) : 0;
            const frac = wait / CHECK_COOLDOWN_S;
            const C = 2 * Math.PI * 15;
            return (
              <g key={r.id} transform={`translate(${x},${y})`} className={`rr-pin is-${st}${readyAgain(r) ? ' is-ready' : ''}`} onClick={() => tapRound(r)} role="button" aria-label={`Round ${r.n}: ${t(r.title)}`}>
                {target?.id === r.id && <path className="goal-arrow-p" d="M-8,-30 L8,-30 L8,-20 L14,-20 L0,-8 L-14,-20 L-8,-20 Z" fill="#ffae00" stroke="#7a4a10" strokeWidth={2} />}
                <circle r={20} fill="transparent" />
                {wait > 0 && <circle r={15} fill="none" stroke="#fff" strokeOpacity={0.35} strokeWidth={4} />}
                {wait > 0 && <circle r={15} fill="none" stroke="#ffd23f" strokeWidth={4} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90)" />}
                <circle r={11} className="rr-pin-disc" />
                {k === 0 && (
                  <text x={((here.length - 1) / 2) * 26} y={27} textAnchor="middle" className="rr-pin-label" pointerEvents="none">
                    {CROP_NAME[r.crop]}
                  </text>
                )}
                <text y={4} textAnchor="middle" fontSize={11} fontWeight={800} fill="#fff" fontFamily="Poppins, sans-serif" pointerEvents="none">
                  {st === 'first' || st === 'second' ? '✓' : st === 'missed' && !readyAgain(r) ? Math.ceil(wait) : st === 'missed' ? '↺' : r.n}
                </text>
              </g>
            );
          });
        })}

        <g transform={`translate(${walker.p[0]},${walker.p[1]}) scale(0.6)`} pointerEvents="none">
          <FarmerFigure look={look} pose={walker.moving ? 'walk' : 'stand'} facing={walker.dir} />
        </g>
      </svg>

      <div className="farmer-chip">
        <FarmerPortrait look={look} size={34} />
        <span>{name}</span>
      </div>
      <NavBar horizontal onBack={() => dispatch({ type: 'rounds', open: false })} backLabel={trial ? 'Six farms' : 'Back'} style={{ right: 6, top: 4 }} />

      <p className="rr-cycle">
        {trial
          ? `Cycle ${trial.cycle} · maize · day ${tDay} of ${CHECK_DAYS} · ${FORECASTS[trial.forecast].label.split(':')[0]}`
          : `Week ${Math.floor(rounds[0].day / 7) + 1} of 3 · ${STAGE_LABELS[rounds[0].stage]} · crops change in ${CYCLE_DAYS - rounds[0].day} days`}
      </p>

      <ol className="rr-chips" aria-label="The rounds">
        {rounds.map(r => {
          const st = statusOf(r);
          const wait = st === 'missed' ? Math.ceil(left(r)) : 0;
          return (
            <li key={r.id}>
              <button type="button" className={`rr-chip is-${st}${readyAgain(r) ? ' is-ready' : ''}`} onClick={() => tapRound(r)} aria-label={`Round ${r.n}: ${t(r.short)}`}>
                {r.n}
                <i>{st === 'first' || st === 'second' ? '✓' : st === 'missed' ? (wait > 0 ? `${wait}s` : '↺') : ''}</i>
              </button>
            </li>
          );
        })}
      </ol>

      {phase !== 'summary' && <GuideLine style={topLine} text={line} action={action} />}

      {phase === 'summary' && (
        <div className="abs ending" style={{ inset: 0 }}>
          <div className="rr-summary">
            <p className="rr-summary-title">
              {rightCount === rounds.length
                ? t(trial ? `You read every farm on day ${tDay}, {name}!` : 'You read every bed on your farm, {name}!')
                : `${rightCount} of ${rounds.length} ${unit}s read right`}
            </p>
            <ol>
              {rounds.map(r => {
                const st = statusOf(r);
                const wait = Math.ceil(left(r));
                return (
                  <li key={r.id} className={`is-${st}`}>
                    <b>{r.n}</b>
                    <span className="rr-title">
                      {t(r.title)} <small>· {CROP_NAME[r.crop]}</small>
                    </span>
                    {st === 'first' && <span className="rr-state">{r.what}</span>}
                    {st === 'second' && <span className="rr-state">{r.what} · second look</span>}
                    {st === 'missed' &&
                      (wait > 0 ? (
                        <span className="rr-state is-wait">Look again in 0:{String(wait).padStart(2, '0')}</span>
                      ) : (
                        <GoldButton font={10} height={24} style={{ width: 110 }} onClick={() => begin(r, true)}>
                          Look again
                        </GoldButton>
                      ))}
                  </li>
                );
              })}
            </ol>
            <p className="rr-summary-points">{earned > 0 ? `+${earned} points this run` : 'No new points this run'}</p>
            <div className="rr-summary-buttons">
              <GoldButton font={11} height={34} style={{ width: 150 }} onClick={() => dispatch({ type: 'rounds', open: false })}>
                {trial ? 'Back to six farms' : 'Back to my farm'}
              </GoldButton>
              {!trial && (
                <GoldButton font={11} height={34} style={{ width: 150 }} onClick={restart}>
                  Play again
                </GoldButton>
              )}
              {trial?.clock === 'fast' && allChecked && (
                <GoldButton font={11} height={34} style={{ width: 150 }} onClick={() => dispatch({ type: 'trialNextDay' })}>
                  {tDay >= CHECK_DAYS ? 'Go to harvest' : `Start day ${tDay + 1}`}
                </GoldButton>
              )}
            </div>
            {trial?.clock === 'daily' && <p className="rr-summary-points">{tDay >= CHECK_DAYS ? 'Harvest is ready tomorrow.' : `Day ${tDay + 1} starts tomorrow.`}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
