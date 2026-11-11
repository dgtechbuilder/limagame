import { useEffect, useMemo, useState, type Dispatch } from 'react';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { NavBar } from '../components/Nav';
import { GoldButton } from '../components/ui';
import { GuideLine } from '../first/Review';
import type { Action, GameState } from '../state';
import {
  CLIENTS,
  DAY_HOURS,
  DRIVER_WAGE,
  MAP_H,
  MAP_W,
  PARTNERS,
  PARTNER_CUT,
  POINTS_A_FARMER,
  BEST_ROUTE,
  SHOP,
  YARD,
  bestRoute,
  clientOf,
  effScore,
  handCost,
  hireOf,
  jobKeep,
  levelOf,
  mapFor,
  myFarms,
  newBiz,
  nextLevel,
  partOf,
  partnerBlock,
  planDay,
  requestsFor,
  legStops,
  roadPoints,
  runDay,
  hireOutDay,
  shopBlock,
  toolName,
  type Biz,
  type BizMap,
  type Booking,
  type Bookings,
  type DayResult,
  type Pt,
  type ReqKey,
} from './model';
import { kshText } from '../money';
import { sfx } from '../sfx';

/* The tractor business: Today (book each farm's jobs, plan the route, run the day), Partners and Fleet. The game state
   holds the business (state.biz); today's bookings and route are this screen's own until the day is run. */

/** shillings on screen: 10 times the stored value (src/money.ts) */
const ksh = (n: number) => kshText(Math.round(n));
type Tab = 'today' | 'partners' | 'fleet';

/** The map drawn on the stage (its own pixels are the model's map pixels; the foot is kept for the route strip). */
const MAP_PX = { x: 16, y: 92, w: MAP_W, h: MAP_H };

export function Business({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const b = s.biz ?? newBiz();
  const [tab, setTab] = useState<Tab>('today');
  const [result, setResult] = useState<DayResult | null>(null);
  const close = () => dispatch({ type: 'biz', open: false });
  const lvl = levelOf(b.helped);
  const nxt = nextLevel(b.helped);
  const name = s.farmer?.name ?? 'Farmer';

  return (
    <div className="abs fs-screen biz" style={{ inset: 0 }}>
      <FarmMap dim={0.5} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <img src={img.plank} alt="" width={203} height={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 12 }}>
          Tractor business
        </span>
      </div>
      <NavBar horizontal onBack={close} style={{ right: 6, top: 4 }} />

      {/* the business at a glance: its level, and the way to the next */}
      <div className="biz-head">
        <span className="biz-level">
          <span>
            <b>Level {lvl.level}</b> · {lvl.name}
          </span>
          <span className="biz-bar" aria-hidden="true">
            <span style={{ width: `${nxt ? Math.min(100, ((b.helped - lvl.helped) / (nxt.helped - lvl.helped)) * 100) : 100}%` }} />
          </span>
          <small>{nxt ? `${nxt.helped - b.helped} more farmers to level ${nxt.level}` : 'Top level'}</small>
        </span>
        <span className="biz-stat">
          <small>Day</small>
          {b.day}
        </span>
        <span className="biz-stat">
          <small>Business account</small>
          {ksh(b.cash)}
        </span>
        <span className="biz-stat">
          <small>Farmers helped</small>
          {b.helped}
        </span>
        <div className="biz-tabs" role="tablist" aria-label="Tractor business">
          {(
            [
              ['today', 'Today'],
              ['partners', 'Partners'],
              ['fleet', 'Fleet'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-on' : ''} onClick={() => setTab(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'today' && <Today key={b.day} b={b} name={name} dispatch={dispatch} onDone={r => setResult(r)} />}
      {tab === 'partners' && <Partners b={b} dispatch={dispatch} />}
      {tab === 'fleet' && <Fleet b={b} dispatch={dispatch} />}

      {result && <Results r={result} b={b} onNext={() => setResult(null)} />}
    </div>
  );
}

/* ---------------- Today: book, plan the route, run the day ---------------- */

/* A day in two steps. Book: tap a farm and give each part of it to your tractor or a partner (your tractor must visit
   at least three farms). Route: tap the farms in the order the tractor will drive to them, along the roads. The map has
   no distances on it and draws no route line: the player judges the shortest way round from the roads alone, and the
   efficiency score after the day says how close they came. */

type Step = 'book' | 'route';

function Today({ b, name, dispatch, onDone }: { b: Biz; name: string; dispatch: Dispatch<Action>; onDone: (r: DayResult) => void }) {
  const requests = useMemo(() => requestsFor(b), [b]);
  const map = useMemo(() => mapFor(b.day), [b.day]);
  const [bookings, setBookings] = useState<Bookings>({});
  /** the farms in the order the player tapped them on the route step */
  const [route, setRoute] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('book');
  const [pick, setPick] = useState<string | null>(null);
  const [run, setRun] = useState<{ start: number } | null>(null);
  const plan = planDay(b, requests, bookings, route);
  const farms = [...new Set(requests.map(k => k.split(':')[0]))];
  const mine = myFarms(bookings);
  const kimani = b.partners.includes('kimani');
  /** everything but the route is ready */
  const booked = !plan.problem || (plan.unrouted.length > 0 && plan.problem.startsWith('Plan your route'));

  const book = (k: ReqKey, v: Booking | null) => {
    const next = { ...bookings };
    if (v) next[k] = v;
    else delete next[k];
    setBookings(next);
    // a farm no longer on the tractor leaves the route
    const still = myFarms(next);
    setRoute(r => r.filter(id => still.includes(id)));
  };
  const tapFarm = (id: string) => {
    if (run) return;
    if (step === 'book') return setPick(id);
    if (!mine.includes(id) || route.includes(id)) return;
    // the last stop placed completes the route
    if (route.length + 1 === mine.length) sfx.action();
    setRoute(r => [...r, id]);
  };

  // the day on the map: the tractor drives the roads (time by length), stopping a moment at each farm
  const stopsKey = plan.stops.join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const drive = useMemo(() => driveOf(map, plan.stops), [map, stopsKey]);
  const runMs = drive.total;
  useEffect(() => {
    if (!run) return;
    const id = window.setTimeout(() => {
      dispatch({ type: 'bizRun', bookings, route });
      // the reducer works the same day out again from the same bookings and route
      onDone(runDay(b, plan).result);
    }, runMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  const line = run
    ? `On the road, ${name}: ${plan.stops.length} farm${plan.stops.length === 1 ? '' : 's'}. Let's see how good your route was.`
    : step === 'route'
      ? plan.unrouted.length
        ? route.length
          ? `Next stop? Tap the farm your tractor drives to after ${clientOf(route[route.length - 1]).name}. Every km costs diesel and time.`
          : `Plan the shortest route, ${name}: tap the farm your tractor visits first. Follow the roads with your eye: there are no distances.`
        : 'Your route is set. Start the day, or clear it and try another order.'
      : plan.problem && Object.keys(bookings).length && !plan.problem.startsWith('Plan your route')
        ? plan.problem
        : pick
          ? `Book each part of ${clientOf(pick).name}'s farm: your tractor, or a partner.`
          : `${farms.length} farms booked work today, ${name}. Your tractor must visit at least ${plan.needed}. Tap a farm to plan its jobs.`;

  return (
    <>
      <div className="biz-map" style={{ left: MAP_PX.x, top: MAP_PX.y, width: MAP_PX.w, height: MAP_PX.h }}>
        <BizMap map={map} requests={requests} bookings={bookings} route={step === 'route' ? route : []} step={step} pick={pick} onPick={tapFarm} run={run ? { ...run, drive } : null} />
        {step === 'route' && (
          <ol className="biz-route" aria-label="Your route">
            <li className="is-yard">Yard</li>
            {route.map((id, i) => (
              <li key={id}>
                <b>{i + 1}</b> {clientOf(id).name.replace('Mama ', '')}
              </li>
            ))}
            {plan.unrouted.map(id => (
              <li key={id} className="is-todo" aria-label="A stop still to place">
                <b>?</b>
              </li>
            ))}
            <li className="is-yard">Yard</li>
          </ol>
        )}
      </div>

      <aside className="biz-side">
        {step === 'route' ? (
          <div className="biz-farm">
            <p className="biz-farm-title">
              <b>Plan the route</b> · {route.length} of {mine.length} stops
            </p>
            <p className="biz-route-tip">Tap your farms in the order the tractor visits them, from the yard and back.</p>
            <div className="biz-route-tools">
              <button type="button" className="biz-link" disabled={!!run || !route.length} onClick={() => setRoute(r => r.slice(0, -1))}>
                Undo last stop
              </button>
              <button type="button" className="biz-link" disabled={!!run || !route.length} onClick={() => setRoute([])}>
                Clear route
              </button>
              {b.partners.includes('app') && (
                <button type="button" className="biz-link" disabled={!!run} onClick={() => setRoute(bestRoute(map, mine))}>
                  Shortest route (app)
                </button>
              )}
            </div>
          </div>
        ) : pick ? (
          <div className="biz-farm">
            <p className="biz-farm-title">
              <b>{clientOf(pick).name}</b> · {clientOf(pick).place}
              <button type="button" className="biz-x" onClick={() => setPick(null)} aria-label="Close the farm">
                ×
              </button>
            </p>
            {requests
              .filter(k => k.startsWith(`${pick}:`))
              .map(k => {
                const { part } = partOf(k);
                const v = bookings[k] ?? null;
                const hasTool = b.tools.includes(part.tool);
                // what each choice leaves the business: hire less the job's diesel, or the partner's share
                const m = jobKeep(b, part.tool, part.acres);
                return (
                  <div key={k} className="biz-part">
                    <span className="biz-part-text">
                      <b>{part.name}</b>
                      <small>
                        {toolName(part.tool)} · {part.acres} acre{part.acres === 1 ? '' : 's'} · hire {ksh(hireOf(part.tool) * part.acres)}
                      </small>
                    </span>
                    <span className="biz-seg" role="group" aria-label={`${part.name}: who does it`}>
                      <button type="button" className={v === 'me' ? 'is-on' : ''} disabled={!!run || !hasTool} onClick={() => book(k, v === 'me' ? null : 'me')} title={hasTool ? '' : `You have no ${toolName(part.tool).toLowerCase()}`}>
                        {hasTool ? (
                          <>
                            My tractor <i className={m.keep < m.hire * 0.3 ? 'is-thin' : ''}>keep ~{ksh(m.keep)}</i>
                          </>
                        ) : (
                          `No ${toolName(part.tool).split(' ').pop()!.toLowerCase()}`
                        )}
                      </button>
                      {kimani && (
                        <button type="button" className={v === 'partner' ? 'is-on is-partner' : ''} disabled={!!run} onClick={() => book(k, v === 'partner' ? null : 'partner')}>
                          Partner <i>{ksh(m.partner)}</i>
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="biz-farm is-empty">
            <p>Tap a farm on the map. Book each part for your tractor, or pass it to a partner (you keep {Math.round(PARTNER_CUT * 100)}%).</p>
            <p>
              Your tractor must visit at least <b>{plan.needed} farms</b>. Then you plan its route: the shorter the drive, the higher your efficiency score.
            </p>
          </div>
        )}

        <div className="biz-meters">
          <Meter label="Farms for your tractor" value={`${mine.length} of ${plan.needed} needed`} frac={plan.needed ? mine.length / plan.needed : 1} good={mine.length >= plan.needed} />
          <Meter label="Work" value={`${plan.workH.toFixed(1)} h of a ${DAY_HOURS} h day`} frac={plan.workH / DAY_HOURS} warn={plan.workH > DAY_HOURS} note="+ driving" />
          <p className="biz-money">
            <span>
              Hire <b>{ksh(plan.revenue + plan.commission)}</b>
            </span>
            <span>
              Work diesel <b className="is-cost">−{ksh(plan.workDiesel)}</b>
            </span>
            <span>
              Driver <b className="is-cost">−{ksh(mine.length ? DRIVER_WAGE : 0)}</b>
            </span>
            <span className="is-total">Road diesel: after the day</span>
          </p>
        </div>

        <div className="biz-actions">
          {b.partners.includes('county') && !Object.keys(bookings).length && step === 'book' && (
            <button type="button" className="biz-link" disabled={!!run} onClick={() => (dispatch({ type: 'bizHireOut' }), onDone(hireOutDay(b, requests.length).result))}>
              Hire out to the county
            </button>
          )}
          {step === 'book' ? (
            mine.length ? (
              <GoldButton font={12} height={34} style={{ flex: 1, opacity: booked ? 1 : 0.5 }} onClick={() => booked && (setPick(null), setStep('route'), sfx.action())} ariaLabel="Next: plan the route">
                Next: plan the route
              </GoldButton>
            ) : (
              <GoldButton font={12} height={34} style={{ flex: 1, opacity: plan.problem ? 0.5 : 1 }} onClick={() => !plan.problem && setRun({ start: performance.now() })} ariaLabel="Start the day">
                Start the day
              </GoldButton>
            )
          ) : (
            <>
              {!run && (
                <button type="button" className="biz-link" onClick={() => setStep('book')}>
                  Back to bookings
                </button>
              )}
              <GoldButton font={12} height={34} style={{ flex: 1, opacity: plan.problem || run ? 0.5 : 1 }} onClick={() => !plan.problem && !run && setRun({ start: performance.now() })} ariaLabel="Start the day">
                {run ? 'On the road…' : 'Start the day'}
              </GoldButton>
            </>
          )}
        </div>
      </aside>

      <GuideLine text={line} style={{ left: 16, right: 16, bottom: 4, minHeight: 0, padding: '2px 10px 2px 4px' }} />
    </>
  );
}

function Meter({ label, value, frac, warn, good, note }: { label: string; value: string; frac: number; warn?: boolean; good?: boolean; note?: string }) {
  return (
    <div className={`biz-meter${warn ? ' is-warn' : ''}${good ? ' is-good' : ''}`}>
      <span>
        {label} <b>{value}</b>
        {note && <i>{note}</i>}
      </span>
      <span className="biz-bar" aria-hidden="true">
        <span style={{ width: `${Math.max(0, Math.min(1, frac)) * 100}%` }} />
      </span>
    </div>
  );
}

/* ---------------- the map ---------------- */

/** How the drive plays on the map: the tractor keeps a steady speed along the roads and stops a moment at each farm. */
const DRIVE_PX_S = 300;
const STOP_MS = 450;
interface Drive {
  pts: Pt[];
  /** the points where a farm is, in the order they are reached */
  stopAt: number[];
  total: number;
}
function driveOf(map: BizMap, stops: string[]): Drive {
  if (!stops.length) return { pts: [], stopAt: [], total: 0 };
  const pts: Pt[] = [map.at[YARD]];
  const stopAt: number[] = [];
  let from = YARD;
  for (const id of [...stops, YARD]) {
    const leg = legPoints(map, from, id);
    pts.push(...leg.slice(1));
    if (id !== YARD) stopAt.push(pts.length - 1);
    from = id;
  }
  let px = 0;
  for (let i = 1; i < pts.length; i++) px += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return { pts, stopAt, total: Math.round((px / DRIVE_PX_S) * 1000 + stops.length * STOP_MS) };
}

/** The road points from one place to another, along the shortest way. */
function legPoints(map: BizMap, a: string, b: string): Pt[] {
  const way = legStops(map, a, b);
  const pts: Pt[] = [map.at[a]];
  for (let k = 1; k < way.length; k++) {
    const rd = map.roads.find(x => (x.a === way[k - 1] && x.b === way[k]) || (x.b === way[k - 1] && x.a === way[k]))!;
    pts.push(...roadPoints(map, rd, way[k - 1]).slice(1));
  }
  return pts;
}

const roadD = (map: BizMap, r: BizMap['roads'][number]) => `M${map.at[r.a].x},${map.at[r.a].y} Q${r.c.x},${r.c.y} ${map.at[r.b].x},${map.at[r.b].y}`;

function BizMap({
  map,
  requests,
  bookings,
  route,
  step,
  pick,
  onPick,
  run,
}: {
  map: BizMap;
  requests: ReqKey[];
  bookings: Bookings;
  /** the route as tapped so far (route step only) */
  route: string[];
  step: Step;
  pick: string | null;
  onPick: (id: string) => void;
  run: { start: number; drive: Drive } | null;
}) {
  const today = new Set(requests.map(k => k.split(':')[0]));
  const mine = myFarms(bookings);
  const tractor = useTractorAt(run);
  const yard = map.at[YARD];
  return (
    <svg viewBox={`0 0 ${MAP_PX.w} ${MAP_PX.h}`} width={MAP_PX.w} height={MAP_PX.h} role="group" aria-label="The farms around your yard, and the roads between them">
      <rect width={MAP_PX.w} height={MAP_PX.h} rx={12} fill="#9fcf6a" />
      {/* a river and a forest, under the roads */}
      <path d={`M0,${MAP_PX.h * 0.62} C120,${MAP_PX.h * 0.5} 260,${MAP_PX.h * 0.92} ${MAP_PX.w},${MAP_PX.h * 0.7}`} stroke="#5fb4e0" strokeWidth={9} fill="none" opacity={0.6} />
      {[
        [440, 30],
        [470, 52],
        [452, 70],
        [490, 28],
        [70, 196],
        [96, 206],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={11} fill="#4f9a3a" opacity={0.75} />
      ))}

      {/* the murram roads between every farm: an edge and a lighter middle, no distances */}
      <g aria-hidden="true">
        {map.roads.map(r => (
          <path key={`e${r.a}${r.b}`} d={roadD(map, r)} stroke="#a8825a" strokeWidth={8} fill="none" strokeLinecap="round" />
        ))}
        {map.roads.map(r => (
          <path key={`m${r.a}${r.b}`} d={roadD(map, r)} stroke="#e6cc9e" strokeWidth={5} fill="none" strokeLinecap="round" />
        ))}
        {map.junctions.map(j => (
          <circle key={j} cx={map.at[j].x} cy={map.at[j].y} r={5.5} fill="#e6cc9e" stroke="#a8825a" strokeWidth={1.5} />
        ))}
      </g>

      {/* the yard */}
      <g transform={`translate(${yard.x},${yard.y})`}>
        <rect x={-18} y={-16} width={36} height={24} rx={3} fill="#c0392b" stroke="#fff" strokeWidth={2} />
        <path d="M-20,-16 L0,-28 L20,-16 Z" fill="#8a2a1f" stroke="#fff" strokeWidth={2} />
        <text y={22} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="#3d2614" stroke="#fff" strokeWidth={3} paintOrder="stroke">
          Your yard
        </text>
      </g>

      {/* the farms: today's are bright and can be tapped */}
      {CLIENTS.map(c => {
        const p = map.at[c.id];
        const on = today.has(c.id);
        const keys = requests.filter(k => k.startsWith(`${c.id}:`));
        const isMine = mine.includes(c.id);
        const theirs = keys.some(k => bookings[k] === 'partner');
        const done = keys.length > 0 && keys.every(k => bookings[k]);
        const n = route.indexOf(c.id);
        // on the route step only the tractor's own farms can be tapped, each once
        const tappable = on && !run && (step === 'book' || (isMine && n < 0));
        const badge = step === 'route' ? (isMine ? (n >= 0 ? String(n + 1) : '?') : '') : String(keys.length);
        return (
          <g
            key={c.id}
            transform={`translate(${p.x},${p.y})`}
            className={`biz-pin${on ? ' is-on' : ''}${pick === c.id ? ' is-pick' : ''}${tappable ? ' is-tap' : ''}${step === 'route' && isMine && n < 0 ? ' is-next' : ''}`}
            onClick={tappable ? () => onPick(c.id) : undefined}
            role={on ? 'button' : undefined}
            aria-label={on ? (step === 'route' ? (isMine ? `${c.name}${n >= 0 ? `, stop ${n + 1}` : ', add as the next stop'}` : `${c.name}, not on your tractor`) : `${c.name}, ${keys.length} job${keys.length === 1 ? '' : 's'}`) : undefined}
            aria-disabled={on && !tappable ? true : undefined}
          >
            <rect x={-17} y={-13} width={34} height={24} rx={4} fill={on ? '#7a4224' : '#8aa860'} stroke={pick === c.id ? '#ffb005' : '#fff'} strokeWidth={pick === c.id ? 3.5 : 1.5} opacity={on ? (step === 'route' && !isMine ? 0.55 : 1) : 0.55} />
            {[-8, 0, 8].map(x => (
              <path key={x} d={`M${x},-9 V7`} stroke={on ? '#a8743f' : '#9fbf70'} strokeWidth={2} />
            ))}
            {on && (
              <>
                {badge && (
                  <>
                    <circle cx={17} cy={-13} r={9} fill={step === 'route' ? (n >= 0 ? '#ffb005' : '#fff') : done ? (isMine ? '#ffb005' : theirs ? '#2b7fb8' : '#2f9b14') : '#fff'} stroke="#3d2614" strokeWidth={1.2} />
                    <text x={17} y={-9.5} textAnchor="middle" fontSize={10} fontWeight={900} fill={(step === 'route' ? n >= 0 : done) ? '#fff' : '#3d2614'}>
                      {badge}
                    </text>
                  </>
                )}
                <text y={24} textAnchor="middle" fontSize={10} fontWeight={800} fill="#2a1a0e" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  {c.name}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* the tractor on the road */}
      {tractor !== null && run && <TractorOnRoad at={pointAlong(run.drive, tractor)} />}
    </svg>
  );
}

function TractorOnRoad({ at }: { at: Pt }) {
  return (
    <g transform={`translate(${at.x},${at.y})`}>
      <circle r={13} fill="#fff" stroke="#3d2614" strokeWidth={2} />
      <rect x={-8} y={-5} width={11} height={7} rx={1.5} fill="#3e8e3a" />
      <rect x={1} y={-9} width={6} height={6} rx={1} fill="#3e8e3a" />
      <circle cx={-5} cy={4} r={4} fill="#333" />
      <circle cx={5} cy={4.5} r={3} fill="#333" />
    </g>
  );
}

/** Milliseconds since the day started running, every frame. */
function useTractorAt(run: { start: number } | null) {
  const [now, setNow] = useState(performance.now());
  useEffect(() => {
    if (!run) return;
    let raf = 0;
    const tick = () => {
      setNow(performance.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run]);
  return run ? Math.max(0, now - run.start) : null;
}

/** Where the tractor is on its way along the roads after t ms: steady speed, a pause at each farm. */
function pointAlong(d: Drive, t: number): Pt {
  const pts = d.pts;
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 };
  let left = (t / 1000) * DRIVE_PX_S;
  const hold = (STOP_MS / 1000) * DRIVE_PX_S;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (left <= seg) {
      const f = seg ? left / seg : 1;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * f };
    }
    left -= seg;
    if (d.stopAt.includes(i)) {
      if (left <= hold) return pts[i];
      left -= hold;
    }
  }
  return pts[pts.length - 1];
}

/* ---------------- the day's result ---------------- */

function Results({ r, b, onNext }: { r: DayResult; b: Biz; onNext: () => void }) {
  const helped = r.farmers + r.partnerFarmers;
  const lvl = levelOf(b.helped);
  const rose = levelOf(b.helped - helped).level < lvl.level;
  const eff = r.efficiency ?? (r.km > 0 ? r.bestKm / r.km : 1);
  const score = effScore(eff);
  const bestOne = eff >= BEST_ROUTE;
  const names = (ids: string[]) => ['Yard', ...ids.map(id => clientOf(id).name.replace('Mama ', '')), 'Yard'].join(' → ');
  return (
    <div className="abs ending" style={{ inset: 0 }} role="dialog" aria-label={`Day ${r.day} done`}>
      <div className="fs-panel biz-result">
        <p className="biz-result-title">
          Day {r.day} done
          <span className="biz-stars" aria-label={`${r.stars} of 3 stars`}>
            {'★'.repeat(r.stars)}
            <i>{'★'.repeat(3 - r.stars)}</i>
          </span>
        </p>
        {r.kind === 'county' ? (
          <p className="biz-result-line">Your tractor worked on the county's roads all day: {ksh(r.revenue)}, the driver paid. No farms were served today.</p>
        ) : (
          <>
            {r.km > 0 && (
              <div className={`biz-eff${bestOne ? ' is-best' : ''}`} aria-label={`Efficiency score ${score} out of 100`}>
                <span className="biz-eff-score">
                  <small>Efficiency score</small>
                  <b>{score}</b>
                  <i>/100</i>
                </span>
                <span className="biz-eff-text">
                  <b>{bestOne ? 'The most efficient route!' : 'Not the most efficient route'}</b>
                  {bestOne ? (
                    <>You found the shortest way round: {r.km.toFixed(1)} km.</>
                  ) : (
                    <>
                      Yours was {r.km.toFixed(1)} km; the best was {r.bestKm.toFixed(1)} km: {(r.km - r.bestKm).toFixed(1)} km of diesel and time lost.
                    </>
                  )}
                  {r.route && <small>Your route: {names(r.route)}</small>}
                  {!bestOne && r.best && <small className="is-best">Best route: {names(r.best)}</small>}
                </span>
              </div>
            )}
            <p className="biz-result-line">
              {r.farmers} farmer{r.farmers === 1 ? '' : 's'} helped by your tractor{r.partnerFarmers ? `, ${r.partnerFarmers} through a partner` : ''}: {r.acres.toFixed(1)} acres
              {r.hours ? ` in ${r.hours.toFixed(1)} hours` : ''}
              {r.overH ? ` (${r.overH.toFixed(1)} h of overtime for the driver)` : ''}.
            </p>
          </>
        )}
        <dl className="biz-sheet">
          <div>
            <dt>Hire from farmers</dt>
            <dd>{ksh(r.revenue)}</dd>
          </div>
          {r.commission > 0 && (
            <div>
              <dt>From partner jobs</dt>
              <dd>{ksh(r.commission)}</dd>
            </div>
          )}
          <div>
            <dt>Diesel (work and road)</dt>
            <dd className="is-cost">−{ksh(r.diesel)}</dd>
          </div>
          <div>
            <dt>Driver</dt>
            <dd className="is-cost">−{ksh(r.wage)}</dd>
          </div>
          <div className="is-total">
            <dt>Profit</dt>
            <dd className={r.profit < 0 ? 'is-cost' : ''}>{ksh(r.profit)}</dd>
          </div>
        </dl>
        <p className="biz-result-line is-small">
          {r.saved > 0 && <>The farmers saved {ksh(r.saved)} against doing it by hand. </>}
          {r.missed > 0 ? `${r.missed} job${r.missed === 1 ? '' : 's'} nobody took: those farmers wait another day.` : 'No farmer was left waiting.'}
          {helped > 0 && ` +${helped * POINTS_A_FARMER} points.`}
        </p>
        {rose && <p className="biz-rose">Level {lvl.level}: {lvl.name}!</p>}
        <GoldButton font={12} height={36} style={{ width: 200, marginTop: 6 }} onClick={onNext} ariaLabel="Next day">
          Next day
        </GoldButton>
      </div>
    </div>
  );
}

/* ---------------- partners and the fleet ---------------- */

function Partners({ b, dispatch }: { b: Biz; dispatch: Dispatch<Action> }) {
  return (
    <div className="biz-cards" aria-label="Partners">
      {PARTNERS.map(p => {
        const block = partnerBlock(b, p.id);
        const signed = b.partners.includes(p.id);
        return (
          <div key={p.id} className={`biz-card${signed ? ' is-signed' : ''}`}>
            <small>{p.kind}</small>
            <b>{p.name}</b>
            <p>{p.does}</p>
            {signed ? (
              <span className="biz-tag">✓ Signed</span>
            ) : block ? (
              <span className="biz-tag is-off">{block}</span>
            ) : (
              <GoldButton font={10} height={26} style={{ width: '100%' }} onClick={() => dispatch({ type: 'bizPartner', id: p.id })} ariaLabel={`Sign with ${p.name}`}>
                {p.fee ? `Sign · ${ksh(p.fee)}` : 'Sign · free'}
              </GoldButton>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Fleet({ b, dispatch }: { b: Biz; dispatch: Dispatch<Action> }) {
  return (
    <div className="biz-cards" aria-label="Fleet">
      <div className="biz-card is-signed">
        <small>Your tractor</small>
        <b>{b.tractor === 'large' ? 'Large tractor' : 'Standard tractor'}</b>
        <p>Implements: {b.tools.map(t => toolName(t)).join(', ')}.</p>
        <p className="biz-totals">
          {b.day - 1} day{b.day === 2 ? '' : 's'} · {b.acres.toFixed(1)} acres · {b.km.toFixed(0)} km · {b.helped} farmers
        </p>
        <p>By hand, ploughing one acre would cost a farmer about {ksh(handCost('plough', 1))}. A job you have no implement for can go to a partner.</p>
      </div>
      {SHOP.map(item => {
        const block = shopBlock(b, item.id);
        return (
          <div key={item.id} className={`biz-card${block === 'Owned' ? ' is-signed' : ''}`}>
            <small>{item.id === 'large' ? 'Tractor' : 'Implement'}</small>
            <b>{item.name}</b>
            <p>{item.does}</p>
            {block === 'Owned' ? (
              <span className="biz-tag">✓ Owned</span>
            ) : block ? (
              <span className="biz-tag is-off">{block}</span>
            ) : (
              <GoldButton font={10} height={26} style={{ width: '100%' }} onClick={() => dispatch({ type: 'bizBuy', item: item.id })} ariaLabel={`Buy ${item.name}`}>
                Buy · {ksh(item.price)}
              </GoldButton>
            )}
          </div>
        );
      })}
    </div>
  );
}

