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
  MAP_H,
  MAP_W,
  PARTNERS,
  PARTNER_CUT,
  POINTS_A_FARMER,
  SHOP,
  YARD,
  bestRoute,
  clientOf,
  handCost,
  hireOf,
  jobKeep,
  levelOf,
  newBiz,
  nextLevel,
  partOf,
  partnerBlock,
  planDay,
  requestsFor,
  runDay,
  hireOutDay,
  shopBlock,
  toolName,
  type Biz,
  type Booking,
  type Bookings,
  type DayResult,
  type Pt,
  type ReqKey,
} from './model';

/* The tractor business: Today (book each farm's jobs, plan the route, run the day), Partners and Fleet. The game state
   holds the business (state.biz); today's bookings and route are this screen's own until the day is run. */

const ksh = (n: number) => `KSh ${Math.round(n).toLocaleString('en-US')}`;
type Tab = 'today' | 'partners' | 'fleet';

/** The map drawn on the stage: km → pixels. */
const MAP_PX = { x: 16, y: 92, w: 520, h: 252 };
/** km on the map → pixels; the foot of the map is kept for the route strip */
const px = (p: Pt) => ({ x: 14 + (p.x / MAP_W) * (MAP_PX.w - 28), y: 10 + (p.y / MAP_H) * (MAP_PX.h - 50) });

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

function Today({ b, name, dispatch, onDone }: { b: Biz; name: string; dispatch: Dispatch<Action>; onDone: (r: DayResult) => void }) {
  const requests = useMemo(() => requestsFor(b), [b]);
  const [bookings, setBookings] = useState<Bookings>({});
  /** farms in the order the player first booked them for their own tractor; they can move a stop earlier */
  const [route, setRoute] = useState<string[]>([]);
  const [pick, setPick] = useState<string | null>(null);
  const [run, setRun] = useState<{ start: number; stops: string[] } | null>(null);
  const plan = planDay(b, requests, bookings, route);
  const farms = [...new Set(requests.map(k => k.split(':')[0]))];
  const kimani = b.partners.includes('kimani');

  const book = (k: ReqKey, v: Booking | null) => {
    const next = { ...bookings };
    if (v) next[k] = v;
    else delete next[k];
    setBookings(next);
    const id = k.split(':')[0];
    const mine = Object.entries(next).some(([q, w]) => w === 'me' && q.startsWith(`${id}:`));
    setRoute(r => (mine ? (r.includes(id) ? r : [...r, id]) : r.filter(x => x !== id)));
  };
  const earlier = (id: string) =>
    setRoute(r => {
      const stops = r.filter(x => plan.stops.includes(x));
      const i = stops.indexOf(id);
      if (i <= 0) return r;
      [stops[i - 1], stops[i]] = [stops[i], stops[i - 1]];
      return [...stops, ...r.filter(x => !stops.includes(x))];
    });

  // the day on the map: the tractor drives the route (a second a leg, half a second at each farm), then the result
  const legs = plan.stops.length + 1;
  const runMs = legs * 1000 + plan.stops.length * 500;
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
    ? `On the road, ${name}: ${plan.stops.length} farm${plan.stops.length === 1 ? '' : 's'}, ${plan.km.toFixed(0)} km.`
    : plan.problem && Object.keys(bookings).length
      ? plan.problem
      : pick
        ? `Book each part of ${clientOf(pick).name}'s farm: your tractor, or a partner.`
        : `${farms.length} farms booked work today, ${name}. Tap a farm to plan its jobs.`;

  return (
    <>
      <div className="biz-map" style={{ left: MAP_PX.x, top: MAP_PX.y, width: MAP_PX.w, height: MAP_PX.h }}>
        <BizMap requests={requests} bookings={bookings} stops={plan.stops} pick={pick} onPick={setPick} run={run ? { ...run, ms: runMs } : null} />
        {plan.stops.length > 0 && (
          <ol className="biz-route" aria-label="Your route">
            <li className="is-yard">Yard</li>
            {plan.stops.map((id, i) => (
              <li key={id}>
                <b>{i + 1}</b> {clientOf(id).name.replace('Mama ', '')}
                {i > 0 && !run && (
                  <button type="button" onClick={() => earlier(id)} aria-label={`Visit ${clientOf(id).name} earlier`}>
                    ↑
                  </button>
                )}
              </li>
            ))}
            <li className="is-yard">Yard</li>
          </ol>
        )}
      </div>

      <aside className="biz-side">
        {pick ? (
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
            <p>Then put your stops in a good order: every km costs diesel and time.</p>
          </div>
        )}

        <div className="biz-meters">
          <Meter label="Hours" value={`${plan.hours.toFixed(1)} of ${DAY_HOURS}`} frac={plan.hours / DAY_HOURS} warn={plan.hours > DAY_HOURS} />
          <Meter
            label="Route"
            value={plan.stops.length ? `${plan.km.toFixed(0)} km · shortest ${plan.bestKm.toFixed(0)}` : '—'}
            frac={plan.stops.length ? plan.efficiency : 0}
            good={plan.efficiency >= 0.95}
            note={plan.stops.length > 1 ? `${Math.round(plan.efficiency * 100)}% efficient` : undefined}
          />
          <p className="biz-money">
            <span>
              Hire <b>{ksh(plan.revenue + plan.commission)}</b>
            </span>
            <span>
              Diesel <b className="is-cost">−{ksh(plan.diesel)}</b>
            </span>
            <span>
              Driver <b className="is-cost">−{ksh(plan.wage)}</b>
            </span>
            <span className="is-total">
              Profit <b className={plan.profit < 0 ? 'is-cost' : ''}>{ksh(plan.profit)}</b>
            </span>
          </p>
        </div>

        <div className="biz-actions">
          {b.partners.includes('app') && plan.stops.length > 1 && plan.efficiency < 0.999 && (
            <button type="button" className="biz-link" disabled={!!run} onClick={() => setRoute(r => [...bestRoute(plan.stops), ...r.filter(x => !plan.stops.includes(x))])}>
              Shortest route (app)
            </button>
          )}
          {b.partners.includes('county') && !Object.keys(bookings).length && (
            <button type="button" className="biz-link" disabled={!!run} onClick={() => (dispatch({ type: 'bizHireOut' }), onDone(hireOutDay(b, requests.length).result))}>
              Hire out to the county
            </button>
          )}
          <GoldButton font={12} height={34} style={{ flex: 1, opacity: plan.problem || run ? 0.5 : 1 }} onClick={() => !plan.problem && !run && setRun({ start: performance.now(), stops: plan.stops })} ariaLabel="Start the day">
            {run ? 'On the road…' : 'Start the day'}
          </GoldButton>
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

function BizMap({
  requests,
  bookings,
  stops,
  pick,
  onPick,
  run,
}: {
  requests: ReqKey[];
  bookings: Bookings;
  stops: string[];
  pick: string | null;
  onPick: (id: string) => void;
  run: { start: number; stops: string[]; ms: number } | null;
}) {
  const today = new Set(requests.map(k => k.split(':')[0]));
  const path = [YARD, ...stops.map(id => clientOf(id).at), YARD].map(px);
  const tractor = useTractorAt(run, path);
  return (
    <svg viewBox={`0 0 ${MAP_PX.w} ${MAP_PX.h}`} width={MAP_PX.w} height={MAP_PX.h} role="group" aria-label="The farms around your yard">
      <rect width={MAP_PX.w} height={MAP_PX.h} rx={12} fill="#9fcf6a" />
      {/* a river, a forest and the murram roads between the farms */}
      <path d={`M0,${MAP_PX.h * 0.62} C120,${MAP_PX.h * 0.5} 260,${MAP_PX.h * 0.92} ${MAP_PX.w},${MAP_PX.h * 0.7}`} stroke="#5fb4e0" strokeWidth={9} fill="none" opacity={0.75} />
      {[
        [440, 30],
        [470, 52],
        [452, 70],
        [490, 28],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={11} fill="#4f9a3a" />
      ))}
      {CLIENTS.map(c =>
        CLIENTS.filter(d => d.id > c.id && Math.hypot(d.at.x - c.at.x, d.at.y - c.at.y) < 8).map(d => {
          const a = px(c.at);
          const z = px(d.at);
          return <line key={c.id + d.id} x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke="#d9b98a" strokeWidth={4} strokeLinecap="round" opacity={0.6} />;
        }),
      )}
      {CLIENTS.filter(c => Math.hypot(c.at.x - YARD.x, c.at.y - YARD.y) < 9).map(c => {
        const a = px(YARD);
        const z = px(c.at);
        return <line key={`y${c.id}`} x1={a.x} y1={a.y} x2={z.x} y2={z.y} stroke="#d9b98a" strokeWidth={4} strokeLinecap="round" opacity={0.6} />;
      })}

      {/* the route: yard, each stop in order, home */}
      {stops.length > 0 && <polyline points={path.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#c0392b" strokeWidth={3} strokeDasharray="8 5" strokeLinejoin="round" />}

      {/* the yard */}
      <g transform={`translate(${px(YARD).x},${px(YARD).y})`}>
        <rect x={-18} y={-16} width={36} height={24} rx={3} fill="#c0392b" stroke="#fff" strokeWidth={2} />
        <path d="M-20,-16 L0,-28 L20,-16 Z" fill="#8a2a1f" stroke="#fff" strokeWidth={2} />
        <text y={24} textAnchor="middle" fontSize={11} fontWeight={800} fill="#3d2614">
          Your yard
        </text>
      </g>

      {/* the farms: today's are bright and can be tapped */}
      {CLIENTS.map(c => {
        const p = px(c.at);
        const on = today.has(c.id);
        const keys = requests.filter(k => k.startsWith(`${c.id}:`));
        const mine = keys.some(k => bookings[k] === 'me');
        const theirs = keys.some(k => bookings[k] === 'partner');
        const done = keys.length > 0 && keys.every(k => bookings[k]);
        const n = stops.indexOf(c.id);
        return (
          <g
            key={c.id}
            transform={`translate(${p.x},${p.y})`}
            className={`biz-pin${on ? ' is-on' : ''}${pick === c.id ? ' is-pick' : ''}`}
            onClick={on && !run ? () => onPick(c.id) : undefined}
            role={on ? 'button' : undefined}
            aria-label={on ? `${c.name}, ${keys.length} job${keys.length === 1 ? '' : 's'}` : undefined}
          >
            <rect x={-17} y={-13} width={34} height={24} rx={4} fill={on ? '#7a4224' : '#8aa860'} stroke={pick === c.id ? '#ffb005' : '#fff'} strokeWidth={pick === c.id ? 3.5 : 1.5} opacity={on ? 1 : 0.55} />
            {[-8, 0, 8].map(x => (
              <path key={x} d={`M${x},-9 V7`} stroke={on ? '#a8743f' : '#9fbf70'} strokeWidth={2} />
            ))}
            {on && (
              <>
                <circle cx={17} cy={-13} r={9} fill={done ? (mine ? '#ffb005' : theirs ? '#2b7fb8' : '#2f9b14') : '#fff'} stroke="#3d2614" strokeWidth={1.2} />
                <text x={17} y={-9.5} textAnchor="middle" fontSize={10} fontWeight={900} fill={done ? '#fff' : '#3d2614'}>
                  {n >= 0 ? n + 1 : keys.length}
                </text>
                <text y={26} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="#2a1a0e" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  {c.name}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* the tractor on the road */}
      {tractor && (
        <g transform={`translate(${tractor.x},${tractor.y})`}>
          <circle r={13} fill="#fff" stroke="#c0392b" strokeWidth={2.5} />
          <rect x={-8} y={-5} width={11} height={7} rx={1.5} fill="#c0392b" />
          <rect x={1} y={-9} width={6} height={6} rx={1} fill="#c0392b" />
          <circle cx={-5} cy={4} r={4} fill="#333" />
          <circle cx={5} cy={4.5} r={3} fill="#333" />
        </g>
      )}
    </svg>
  );
}

/** Where the tractor is on the route while the day runs: a second a leg, half a second at each farm. */
function useTractorAt(run: { start: number; ms: number } | null, path: { x: number; y: number }[]) {
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
  if (!run || path.length < 2) return null;
  let t = Math.max(0, now - run.start);
  for (let i = 0; i < path.length - 1; i++) {
    if (t < 1000) {
      const f = t / 1000;
      return { x: path[i].x + (path[i + 1].x - path[i].x) * f, y: path[i].y + (path[i + 1].y - path[i].y) * f };
    }
    t -= 1000;
    if (i < path.length - 2) {
      if (t < 500) return path[i + 1];
      t -= 500;
    }
  }
  return path[path.length - 1];
}

/* ---------------- the day's result ---------------- */

function Results({ r, b, onNext }: { r: DayResult; b: Biz; onNext: () => void }) {
  const helped = r.farmers + r.partnerFarmers;
  const lvl = levelOf(b.helped);
  const rose = levelOf(b.helped - helped).level < lvl.level;
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
          <p className="biz-result-line">
            {r.farmers} farmer{r.farmers === 1 ? '' : 's'} helped by your tractor{r.partnerFarmers ? `, ${r.partnerFarmers} through a partner` : ''}: {r.acres.toFixed(1)} acres in {r.km.toFixed(0)} km
            {r.km > 0 ? (r.km - r.bestKm > 0.5 ? ` (the shortest route was ${r.bestKm.toFixed(0)} km: ${(r.km - r.bestKm).toFixed(0)} km of diesel lost)` : ' (the shortest route)') : ''}.
          </p>
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
            <dt>Diesel</dt>
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

