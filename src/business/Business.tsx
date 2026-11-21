import { farmSignal } from './signal';
import { Info } from '../learn/Info';
import { TrendChart } from './TrendChart';
import { URGENT, traitsOf, urgencyOf, type FarmSignal } from './model';
import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import { GoldButton } from '../components/ui';
import { GuideLine } from '../first/Review';
import type { Action, GameState } from '../state';
import {
  ACTIVITIES,
  ACTIVITY_NAME,
  BASELINE,
  BEST_ROUTE,
  CLEAN_DRIVE,
  CLIENTS,
  CLUSTER,
  CROPS,
  DAY_HOURS,
  FARMER_PAY_X,
  PAY_EFFICIENCY,
  TOOLS,
  HUBS,
  HUB_SHARE,
  MAP_H,
  MAP_W,
  MONTHS,
  PARTNERS,
  PARTNER_CUT,
  PAYG,
  SER,
  SHOP,
  TERRITORY,
  YARD,
  activitiesDone,
  bestRoute,
  bizOf,
  clientKey,
  clientOf,
  contractDay,
  cropName,
  demoSlots,
  effScore,
  fulfilment,
  graduation,
  handCost,
  hireOf,
  hireOutDay,
  inWindow,
  jobKeep,
  leaderboard,
  legStops,
  levelOf,
  mapFor,
  monthOf,
  myFarms,
  nextLevel,
  offersFor,
  partOf,
  partnerBlock,
  planDay,
  requestsFor,
  roadPoints,
  runDay,
  scanFarm,
  serBand,
  shopBlock,
  toolName,
  tractorOf,
  yearOf,
  type Biz,
  type BizMap,
  type Booking,
  type Bookings,
  type Crop,
  type DayResult,
  type Drives,
  type Offer,
  type Pt,
  type ReqKey,
} from './model';
import type { DriveResult } from './drive';
import { DayDrive, type DayDriveApi, type DriveStop } from './DayDrive';
import { tractorSettings } from './tune';
import { Face, Says } from './Cast';
import { kshReal, kshText, withMoney } from '../money';
import { sfx } from '../sfx';

/* The tractor business, to Hello Tractor's brief: Today (scout farms with Campbell, book each job, plan the route,
   drive the tractor at every stop, run the day), Hub (the Hub Manager, the CX Team, the agents' leaderboard),
   Calendar (Narok's year, the Marketplace), Partners and Fleet. The game state holds the business (state.biz);
   today's bookings and route are this screen's own until the day is run. */

/** stored money on screen, in the player's currency (src/money.ts) */
const ksh = (n: number) => kshText(Math.round(n));
const pct = (x: number) => `${Math.round(x * 100)}%`;
type Tab = 'today' | 'hub' | 'calendar' | 'trend' | 'partners' | 'fleet';

/** The map drawn on the stage (its own pixels are the model's map pixels; the foot is kept for the route strip). */
const MAP_PX = { x: 16, y: 92, w: MAP_W, h: MAP_H };

/** Hello Tractor's type: Merriweather for headings and Manrope for body copy (the brand's web fallbacks), fetched
    only when the business opens so the game's first screen stays light. */
function useBrandFonts() {
  useEffect(() => {
    if (document.getElementById('ht-fonts')) return;
    const link = document.createElement('link');
    link.id = 'ht-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Manrope:wght@500;700;800&family=Merriweather:wght@700;900&display=swap';
    document.head.appendChild(link);
  }, []);
}

export function Business({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const b = useMemo(() => bizOf(s.biz), [s.biz]);
  const [tab, setTab] = useState<Tab>('today');
  const [result, setResult] = useState<DayResult | null>(null);
  // the graduation offer, put off until the business is opened again
  const [gradLater, setGradLater] = useState(false);
  const close = () => dispatch({ type: 'biz', open: false });
  const lvl = levelOf(b.helped);
  const nxt = nextLevel(b.helped);
  const name = s.farmer?.name ?? 'Farmer';
  const grad = graduation(b);
  const tier = grad?.tier ?? PAYG.tiers[PAYG.tiers.length - 1];
  const rate = fulfilment(b);
  const avgSer = b.history.filter(r => r.kind === 'farms' && r.km > 0).slice(-7);
  const ser = avgSer.length ? avgSer.reduce((n, r) => n + r.ser, 0) / avgSer.length : null;
  useBrandFonts();

  return (
    <div className="abs fs-screen biz ht" style={{ inset: 0 }}>
      <FarmMap dim={0.5} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <img src={img.plank} alt="" width={203} height={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 12 }}>
          Tractor business
        </span>
      </div>
      <NavBar horizontal onBack={close} style={{ right: 28, top: 8 }} />

      {/* the business at a glance: its level, the two numbers, and counted acres on the way to a tractor */}
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
          <small>Day {b.day}</small>
          {MONTHS[monthOf(b.day) - 1]} · Y{yearOf(b.day)}
        </span>
        <span className="biz-stat">
          <small>Account</small>
          {ksh(b.cash)}
        </span>
        <span className="biz-stat biz-counted" title="Counted acres: physical acres × unique activities booked on each part of a farm">
          <small>Counted acres {grad ? `· ${tier.counted} for the ${tier.hp}HP` : '· all yours'}</small>
          {Math.floor(b.counted)}
          <span className="biz-bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, (b.counted / tier.counted) * 100)}%` }} />
          </span>
        </span>
        <span className={`biz-stat biz-two is-${rate >= PAYG.fulfilment ? 'good' : rate >= PAYG.warn.fulfilment ? 'ok' : 'low'}`} title="Fulfilment rate: bookings closed against every booking there was">
          <small>Fulfilment</small>
          {pct(rate)}
        </span>
        <span className={`biz-stat biz-two is-${ser === null ? 'ok' : serBand(ser) === 'healthy' ? 'good' : serBand(ser) === 'ok' ? 'ok' : 'low'}`} title="Service Efficiency Ratio: acres serviced for every km driven, over the last week">
          <small>SER</small>
          {ser === null ? '—' : ser.toFixed(2)}
        </span>
        <div className="biz-tabs" role="tablist" aria-label="Tractor business">
          {(
            [
              ['today', 'Today'],
              ['hub', 'Hub'],
              ['calendar', 'Calendar'],
              ['trend', 'My trend'],
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

      {tab === 'today' && <Today key={b.day} b={b} name={name} dispatch={dispatch} onDone={r => setResult(r)} signal={farmSignal(s)} settings={s.settings} paused={!!s.modal} />}
      {tab === 'hub' && <Hub b={b} dispatch={dispatch} />}
      {tab === 'calendar' && <Calendar b={b} name={name} />}
      {tab === 'trend' && (
        <div className="biz-card biz-trend-card">
          <TrendChart history={b.history} />
        </div>
      )}
      {tab === 'partners' && <Partners b={b} dispatch={dispatch} />}
      {tab === 'fleet' && <Fleet b={b} dispatch={dispatch} />}

      {result && <Results r={result} b={b} onNext={() => setResult(null)} />}
      {!result && !b.intro && <Welcome name={name} onGo={() => dispatch({ type: 'bizIntro' })} />}
      {!result && b.intro && grad?.due && tab === 'today' && !gradLater && <Graduation b={b} name={name} onSign={() => dispatch({ type: 'bizGraduate' })} onLater={() => setGradLater(true)} />}
    </div>
  );
}

/* ---------------- Sasha's welcome, and the graduation moment ---------------- */

function Welcome({ name, onGo }: { name: string; onGo: () => void }) {
  return (
    <div className="abs ending" style={{ inset: 0 }} role="dialog" aria-label="Welcome to the Narok hub">
      <div className="fs-panel ht-card ht-plum">
        <CloseX onClick={onGo} />
        <Says who="sasha" tone="white">
          <b>Welcome to the {TERRITORY.hub}, {name}.</b> As our Booking Agent, find farmers who need mechanised work and book the hub tractor. Book
          densely, keep your word, and we finance your own tractor.
        </Says>
        <ul className="ht-steps">
          <li>
            <b>Scout.</b> Tap a farm: Campbell flags what is being done the slow way.
          </li>
          <li>
            <b>Book.</b> Each job goes on the hub tractor, or to a partner. The hub keeps {Math.round(HUB_SHARE * 100)}% of the hire.
          </li>
          <li>
            <b>Get paid.</b> Farmers pay {FARMER_PAY_X}× the market hire (ploughing: {ksh(hireOf('plough'))} an acre, not {kshReal(TOOLS.plough.marketKsh)}), but only for a route at least {Math.round(PAY_EFFICIENCY * 100)}% efficient. Under {Math.round(PAY_EFFICIENCY * 100)}, they pay back the hire and the day is a loss.
          </li>
          <li>
            <b>Drive.</b> You drive the whole route: the road to each farm, the job there, and home. Beat the hub driver’s {Math.round(BASELINE * 100)}% for a cleaner job.
          </li>
          <li>
            <b>Grow.</b> {PAYG.tiers[0].counted} counted acres at {Math.round(PAYG.fulfilment * 100)}% fulfilment earns a {PAYG.tiers[0].hp}HP tractor on Pay-As-You-Go.
          </li>
        </ul>
        <GoldButton font={12} height={36} style={{ width: 220, marginTop: 8 }} onClick={onGo} ariaLabel="Let's go">
          Let’s go
        </GoldButton>
      </div>
    </div>
  );
}

function Graduation({ b, name, onSign, onLater }: { b: Biz; name: string; onSign: () => void; onLater: () => void }) {
  const g = graduation(b)!;
  const second = b.owned.length > 0;
  return (
    <div className="abs ending" style={{ inset: 0 }} role="dialog" aria-label="Graduation">
      <div className="fs-panel ht-card ht-grad">
        <CloseX onClick={onLater} label="Not now" />
        <p className="ht-grad-title">{second ? 'Your second tractor' : 'Graduation day'}</p>
        <Says who="sasha" tone="white">
          <b>{name}, your book is underwritable.</b> {Math.floor(b.counted)} counted acres at {pct(fulfilment(b))} fulfilment. Hello Tractor finances you into a <b>{g.tier.name}</b> on
          Pay-As-You-Go: {ksh(g.tier.price)}, paid from {Math.round(PAYG.share * 100)}% of each day’s hire.
        </Says>
        <Says who="aziza" tone="sage">
          It does <b>{g.tier.capacity} acres a day</b>. Keep it over half busy, or it goes back. The Marketplace is now open.
        </Says>
        <GoldButton font={12} height={36} style={{ width: 260, marginTop: 6 }} onClick={onSign} ariaLabel="Sign the PAYG agreement">
          Sign the PAYG agreement
        </GoldButton>
      </div>
    </div>
  );
}

/* ---------------- Today: scout, book, plan the route, drive, run the day ---------------- */

/* A day in three steps. Book: tap a farm, read Campbell's scan and deliver its advice, then give each job to the
   tractor or a partner. Route: tap the farms in the order the tractor will drive to them, along the roads; there is no
   route line and no km while planning. Run: the player drives the whole day without a break (DayDrive.tsx): the road to
   each farm, the job there, and the road home, with a green line at the top showing the tractor moving from farm to
   farm; then the day's result, with the efficiency score and the two numbers. */

type Step = 'book' | 'route';

interface Run {
  stops: string[];
  /** the stop being driven to or worked at; stops.length is the way home */
  at: number;
  phase: 'road' | 'work' | 'home';
  drives: Drives;
  last: string | null;
  /** what the drive needs, fixed when the day starts */
  plan: { stops: DriveStop[]; legs: number[] };
}

function Today({ b, name, dispatch, onDone, signal, settings, paused }: { b: Biz; name: string; dispatch: Dispatch<Action>; onDone: (r: DayResult) => void; signal: FarmSignal; settings: GameState['settings']; paused: boolean }) {
  const requests = useMemo(() => requestsFor(b), [b]);
  const map = useMemo(() => mapFor(b.day), [b.day]);
  const [bookings, setBookings] = useState<Bookings>({});
  /** the farms in the order the player tapped them on the route step */
  const [route, setRoute] = useState<string[]>([]);
  const [step, setStep] = useState<Step>('book');
  const [pick, setPick] = useState<string | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const plan = planDay(b, requests, bookings, route, run?.drives ?? {}, signal);
  const farms = [...new Set(requests.map(clientKey))];
  const mine = myFarms(bookings);
  const kimani = b.partners.includes('kimani');
  const rig = tractorOf(b);
  const offers = useMemo(() => offersFor(b), [b]);
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

  // the day: the player drives the whole route in one go, the road to each farm and the job there
  const game = useRef<DayDriveApi | null>(null);
  const start = () => {
    const stops: DriveStop[] = plan.stops.map(farm => {
      const job = requests.filter(k => bookings[k] === 'me' && clientKey(k) === farm).map(partOf);
      const tool = job.find(x => x.activity !== 'transport')?.tool ?? job[0]?.tool ?? 'plough';
      return { id: farm, name: clientOf(farm).name, job: jobText(requests, bookings, farm), tool, seed: `${b.day}:${farm}` };
    });
    setRun({ stops: plan.stops, at: 0, phase: 'road', drives: {}, last: null, plan: { stops, legs: legsOf(map, plan.stops) } });
  };
  const onStage = (at: number, phase: 'road' | 'work') => setRun(r => (r ? { ...r, at, phase } : r));
  const driven = (farm: string, d: DriveResult) => setRun(r => (r ? { ...r, drives: { ...r.drives, [farm]: d.e }, last: d.detail } : r));
  const finished = () => setRun(r => (r ? { ...r, phase: 'home' } : r));
  useEffect(() => {
    if (!run || run.phase !== 'home') return;
    dispatch({ type: 'bizRun', bookings, route, drives: run.drives });
    // the reducer works the same day out again from the same bookings, route and drives
    const final = planDay(b, requests, bookings, route, run.drives, signal);
    onDone(runDay(b, final, activitiesDone(requests, bookings, final)).result);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.phase]);
  const takeOffer = (o: Offer) => {
    dispatch({ type: 'bizContract', id: o.id, bookings });
    onDone(contractDay(b, o, requests, bookings).result);
  };

  const scan = pick ? scanFarm(b, pick, requests) : null;
  const atFarm = run?.phase === 'work' ? clientOf(run.stops[run.at]) : null;
  const line = run
    ? run.phase === 'work'
      ? `${atFarm!.name}'s farm: take the wheel, ${name}. Work every row once, round the stones and trees.`
      : run.last
        ? `${run.last} On to ${run.at < run.stops.length ? clientOf(run.stops[run.at]).name : 'the yard'}.`
        : `On the road, ${name}: ${run.stops.length} farm${run.stops.length === 1 ? '' : 's'}. Let's test your route.`
    : step === 'route'
      ? plan.unrouted.length
        ? route.length
          ? `Next stop after ${clientOf(route[route.length - 1]).name}? Every km costs diesel and time.`
          : `Plan the shortest route, ${name}: tap the first farm. Follow the roads by eye.`
        : plan.dropped.length
          ? `Too sparse: ${plan.dropped.map(k => clientOf(clientKey(k)).name).join(', ')} would be dropped (${plan.ser.toFixed(2)} acres a km). Book denser, or go.`
          : 'Route set. Start the day, or clear it and try again.'
      : plan.problem && Object.keys(bookings).length && !plan.problem.startsWith('Plan your route')
        ? plan.problem
        : pick
          ? scan?.rec && !(pick in b.advised)
            ? `Campbell says ${clientOf(pick).name} ${scan.rec.flag}. Advise, then book.`
            : `Book each part of ${clientOf(pick).name}'s farm: ${rig.name}, or a partner.`
          : `${farms.length} farms booked work today, ${name}. ${rig.name[0].toUpperCase()}${rig.name.slice(1)} must visit at least ${plan.needed}. Tap a farm to scout.`;

  return (
    <>
      <div className="biz-map" style={{ left: MAP_PX.x, top: MAP_PX.y, width: MAP_PX.w, height: MAP_PX.h }}>
        <TerritoryMap map={map} requests={requests} bookings={bookings} route={step === 'route' ? route : []} step={step} pick={pick} onPick={tapFarm} advised={b.advised} running={!!run} />
        {step === 'route' && !run && (
          <ol className="biz-route" aria-label="Your route">
            <li className="is-yard">Yard</li>
            {route.map((id, i) => (
              <li key={id} className={plan.dropped.some(k => clientKey(k) === id) ? 'is-drop' : ''}>
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
        {run && (
          <DayDrive
            stops={run.plan.stops}
            legs={run.plan.legs}
            tractor={rig.tractor}
            settings={tractorSettings(settings.tractor)}
            reduceMotion={settings.reduceMotion}
            paused={paused}
            seed={`day:${b.day}`}
            api={game}
            onStage={onStage}
            onFarm={driven}
            onFinish={finished}
            onSettings={() => dispatch({ type: 'open', modal: { kind: 'settings', tab: 'tractor' } })}
          />
        )}
      </div>

      <aside className="biz-side">
        {run ? (
          <div className="biz-farm">
            <p className="biz-farm-title">
              <b>{run.phase === 'work' ? `Stop ${run.at + 1}: ${atFarm!.name}` : run.at < run.stops.length ? `To ${clientOf(run.stops[run.at]).name}` : 'Back to the yard'}</b>
            </p>
            {run.phase === 'work' && atFarm ? (
              <>
                <p className="biz-route-tip">{jobText(requests, bookings, atFarm.id)}</p>
                <p className="biz-route-tip">
                  Drive for a cleaner job, or hand it to the hub driver ({Math.round(BASELINE * 100)}%). Under {Math.round(BASELINE * 0.8 * 100)}% is left unfinished.
                </p>
                <div className="biz-route-tools">
                  <button type="button" className="biz-link" onClick={() => game.current?.skip()}>
                    Let the driver do it
                  </button>
                </div>
              </>
            ) : (
              <p className="biz-route-tip">
                {run.stops.map((id, i) => (
                  <span key={id} className={`biz-stop${i < run.at ? ' is-done' : i === run.at ? ' is-now' : ''}`}>
                    {i + 1} {clientOf(id).name.replace('Mama ', '')}
                    {run.drives[id] !== undefined && <i> {pct(run.drives[id])}</i>}
                  </span>
                ))}
              </p>
            )}
          </div>
        ) : step === 'route' ? (
          <div className="biz-farm">
            <p className="biz-farm-title">
              <b>Plan the route</b> · {route.length} of {mine.length} stops
            </p>
            <p className="biz-route-tip">Tap farms in visiting order, from the yard and back.</p>
            <div className="biz-route-tools">
              <button type="button" className="biz-link" disabled={!route.length} onClick={() => setRoute(r => r.slice(0, -1))}>
                Undo last stop
              </button>
              <button type="button" className="biz-link" disabled={!route.length} onClick={() => setRoute([])}>
                Clear route
              </button>
              {b.partners.includes('app') && (
                <button type="button" className="biz-link" onClick={() => setRoute(bestRoute(map, mine))}>
                  Shortest route (app)
                </button>
              )}
            </div>
          </div>
        ) : pick && scan ? (
          <div className="biz-farm">
            <p className="biz-farm-title">
              <b>{clientOf(pick).name}</b> · {clientOf(pick).place}
              {!clientOf(pick).inside && <span className="ht-tag is-out">outside</span>}
              <button type="button" className="biz-x" onClick={() => setPick(null)} aria-label="Close the farm">
                ×
              </button>
            </p>
            <Campbell b={b} scan={scan} onDeliver={() => dispatch({ type: 'bizAdvise', client: pick })} />
            {requests
              .filter(k => clientKey(k) === pick)
              .map(k => {
                const { part, activity } = partOf(k);
                const v = bookings[k] ?? null;
                const hasTool = b.tools.includes(part.tool);
                // what each choice leaves the business: hire less the job's diesel and the hub's share, or the partner's share
                const m = jobKeep(b, part.tool, part.acres);
                const extra = b.extra.includes(k);
                return (
                  <div key={k} className={`biz-part${extra ? ' is-extra' : ''}`}>
                    <span className="biz-part-text">
                      <b>
                        {part.name} · {ACTIVITY_NAME[activity].toLowerCase()}
                      </b>
                      <small>
                        {toolName(part.tool)} · {part.acres} acre{part.acres === 1 ? '' : 's'} of {cropName(part.crop).toLowerCase()} · hire {ksh(hireOf(part.tool) * part.acres)}
                        {extra ? ' · on your advice' : ''}
                      </small>
                      <FarmerChips client={pick} activity={activity} signal={signal} />
                    </span>
                    <span className="biz-seg" role="group" aria-label={`${part.name}: who does it`}>
                      <button type="button" className={v === 'me' ? 'is-on' : ''} disabled={!hasTool} onClick={() => book(k, v === 'me' ? null : 'me')} title={hasTool ? '' : `You have no ${toolName(part.tool).toLowerCase()}`}>
                        {hasTool ? (
                          <>
                            {rig.own ? 'My tractor' : 'Hub tractor'} <i className={m.keep < m.hire * 0.3 ? 'is-thin' : ''}>keep ~{ksh(m.keep)}</i>
                          </>
                        ) : (
                          `No ${toolName(part.tool).split(' ').pop()!.toLowerCase()}`
                        )}
                      </button>
                      {kimani && (
                        <button type="button" className={v === 'partner' ? 'is-on is-partner' : ''} onClick={() => book(k, v === 'partner' ? null : 'partner')}>
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
            <p>Tap a farm to scout it, then book it for {rig.name} or a partner (you keep {Math.round(PARTNER_CUT * 100)}%).</p>
            <p>
              Visit at least <b>{plan.needed} farms</b>, close together: acres per kilometre driven is your Service Efficiency Ratio.
            </p>
            {offers.length > 0 && (
              <div className="ht-offers">
                <small>Marketplace: a day away</small>
                {offers.map(o => (
                  <button key={o.id} type="button" className="ht-offer" onClick={() => takeOffer(o)} disabled={mine.length > 0} title={mine.length ? 'Nothing on your tractor today to take a contract' : ''}>
                    <b>
                      {o.hub.name} · {ACTIVITY_NAME[o.activity].toLowerCase()}
                    </b>
                    <span>
                      {o.agent} offers {o.acres} acres for {ksh(o.pay)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="biz-meters">
          <Meter label={`Farms for ${rig.own ? 'your' : 'the'} tractor`} value={`${mine.length} of ${plan.needed} needed`} frac={plan.needed ? mine.length / plan.needed : 1} good={mine.length >= plan.needed} />
          <div className="biz-meter-row">
            <Meter label="Work" value={`${plan.workH.toFixed(1)} of ${DAY_HOURS} h`} frac={plan.workH / DAY_HOURS} warn={plan.workH > DAY_HOURS} note={rig.own ? `${plan.fieldAcres.toFixed(1)}/${plan.capacity} ac` : '+ driving'} />
            <Meter label="Density" value={mine.length ? (plan.serBand === 'healthy' ? 'healthy' : plan.serBand === 'ok' ? 'serviceable' : 'too sparse') : '—'} frac={Math.min(1, plan.ser / SER.healthy)} warn={mine.length > 0 && plan.serBand === 'low'} good={plan.serBand === 'healthy'} />
          </div>
          <p className="biz-money">
            <span>
              Hire <b>{ksh(plan.revenue + plan.commission)}</b>
            </span>
            <span>
              Work diesel <b className="is-cost">−{ksh(plan.workDiesel)}</b>
            </span>
            <span>
              Driver <b className="is-cost">−{ksh(plan.wage)}</b>
            </span>
            {plan.hubFee > 0 && (
              <span>
                Hub <b className="is-cost">−{ksh(plan.hubFee)}</b>
              </span>
            )}
            {plan.refund > 0 && (
              <span title={`Under ${Math.round(PAY_EFFICIENCY * 100)}% route efficiency the farmers pay the hire back`}>
                Route {Math.round(plan.efficiency * 100)}%: paid back <b className="is-cost">−{ksh(plan.refund)}</b>
              </span>
            )}
          </p>
        </div>

        <div className="biz-actions">
          {b.partners.includes('county') && !Object.keys(bookings).length && step === 'book' && !run && (
            <button type="button" className="biz-link" onClick={() => (dispatch({ type: 'bizHireOut' }), onDone(hireOutDay(b, requests.length).result))}>
              Hire out to the county
            </button>
          )}
          {run ? (
            <GoldButton font={12} height={34} style={{ flex: 1, opacity: 0.5 }} ariaLabel="On the road">
              {run.phase === 'work' ? 'Driving…' : 'On the road…'}
            </GoldButton>
          ) : step === 'book' ? (
            mine.length ? (
              <GoldButton font={12} height={34} style={{ flex: 1, opacity: booked ? 1 : 0.5 }} onClick={() => booked && (setPick(null), setStep('route'), sfx.action())} ariaLabel="Next: plan the route">
                Next: plan the route
              </GoldButton>
            ) : (
              <GoldButton font={12} height={34} style={{ flex: 1, opacity: plan.problem ? 0.5 : 1 }} onClick={() => !plan.problem && start()} ariaLabel="Start the day">
                Start the day
              </GoldButton>
            )
          ) : (
            <>
              <button type="button" className="biz-link" onClick={() => setStep('book')}>
                Back to bookings
              </button>
              <GoldButton font={12} height={34} style={{ flex: 1, opacity: plan.problem ? 0.5 : 1 }} onClick={() => !plan.problem && start()} ariaLabel="Start the day">
                Start the day
              </GoldButton>
            </>
          )}
        </div>
      </aside>

      <GuideLine text={line} face={<Face who="caro" size={40} />} style={{ left: 30, right: 30, bottom: 8, minHeight: 0, padding: '2px 10px 2px 4px' }} />
    </>
  );
}

/** The tractor's jobs at a farm, in a few words. */
function jobText(requests: ReqKey[], bookings: Bookings, farm: string) {
  return requests
    .filter(k => bookings[k] === 'me' && clientKey(k) === farm)
    .map(k => {
      const { part, activity } = partOf(k);
      return `${part.name}: ${ACTIVITY_NAME[activity].toLowerCase()} with the ${toolName(part.tool).toLowerCase()}, ${part.acres} acre${part.acres === 1 ? '' : 's'}`;
    })
    .join('; ');
}

/** Project Campbell on a farm: the crop and its window, the practice flagged, the advice to deliver, and the answer. */
function Campbell({ b, scan, onDeliver }: { b: Biz; scan: ReturnType<typeof scanFarm>; onDeliver: () => void }) {
  const answered = scan.client.id in b.advised;
  const yes = b.advised[scan.client.id];
  const month = monthOf(b.day);
  const open = ACTIVITIES.filter(a => a !== 'transport' && inWindow(scan.crop, a, month));
  return (
    <div className="ht-campbell">
      <p className="ht-campbell-head">
        <b>Campbell</b> · {cropName(scan.crop)} on the {scan.part.name.toLowerCase()} · {MONTHS[month - 1]}: {open.length ? open.map(a => ACTIVITY_NAME[a].toLowerCase()).join(', ') : 'nothing in window'}
      </p>
      {scan.rec && !answered && (
        <>
          <p className="ht-campbell-flag">
            Flag: {scan.client.name.split(' ').pop()} {scan.rec.flag}. <i>{scan.rec.advice[0].toUpperCase() + scan.rec.advice.slice(1)}.</i>
          </p>
          <button type="button" className="ht-deliver" onClick={onDeliver} aria-label={`Deliver Campbell's advice: ${ACTIVITY_NAME[scan.rec.activity].toLowerCase()}`}>
            Deliver the advice: book {ACTIVITY_NAME[scan.rec.activity].toLowerCase()} too <i>{pct(scan.chance)} likely</i>
          </button>
          <small className="ht-campbell-why">{scan.chanceWhy.join(' · ')}</small>
        </>
      )}
      {answered && (
        <p className={`ht-answer is-${yes ? 'yes' : 'no'}`}>
          <Face who="wekeza" size={26} /> {yes ? `“Book it, and I will tell the neighbours.” A new job is on the list.` : scan.client.inside ? '“Show me it working first.” A demo plot would help.' : '“We are far from your hub.” Outside the territory, advice rarely lands.'}
        </p>
      )}
      {!scan.rec && !answered && <p className="ht-campbell-flag">All in-window work is booked. {scan.notNow ? `${ACTIVITY_NAME[scan.notNow.activity]}: ${scan.notNow.months}.` : ''}</p>}
      {scan.notNow && scan.rec && !answered && (
        <small className="ht-campbell-why">
          Not yet: {ACTIVITY_NAME[scan.notNow.activity].toLowerCase()} for {cropName(scan.crop).toLowerCase()} is {scan.notNow.months}.
        </small>
      )}
    </div>
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

/** The length of each leg of the day's drive along the roads, in map pixels: yard → stops in order → yard. */
function legsOf(map: BizMap, stops: string[]): number[] {
  const out: number[] = [];
  let from = YARD;
  for (const id of [...stops, YARD]) {
    const pts = legPoints(map, from, id);
    let px = 0;
    for (let i = 1; i < pts.length; i++) px += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    out.push(px);
    from = id;
  }
  return out;
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

function TerritoryMap({
  map,
  requests,
  bookings,
  route,
  step,
  pick,
  onPick,
  advised,
  running,
}: {
  map: BizMap;
  requests: ReqKey[];
  bookings: Bookings;
  /** the route as tapped so far (route step only) */
  route: string[];
  step: Step;
  pick: string | null;
  onPick: (id: string) => void;
  advised: Record<string, boolean>;
  /** the day is being driven: the map is not tappable */
  running: boolean;
}) {
  const today = new Set(requests.map(clientKey));
  const mine = myFarms(bookings);
  const yard = map.at[YARD];
  const terr = map.territory;
  return (
    <svg viewBox={`0 0 ${MAP_PX.w} ${MAP_PX.h}`} width={MAP_PX.w} height={MAP_PX.h} role="group" aria-label={`The ${TERRITORY.hub} territory: the farms around the yard, and the roads between them`}>
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
      {/* the hub territory (Loop B): inside it, the support system; outside, the high-risk zone */}
      <g className="ht-territory" aria-hidden="true">
        <ellipse cx={terr.cx} cy={terr.cy} rx={terr.rx} ry={terr.ry} fill="#93C393" fillOpacity={0.32} stroke="#FF461E" strokeWidth={2} strokeDasharray="7 5" />
        <text x={terr.cx} y={Math.min(MAP_PX.h - 8, terr.cy + terr.ry - 6)} textAnchor="middle" fontSize={9} fontWeight={800} fill="#2F1C54" stroke="#fff" strokeWidth={3} paintOrder="stroke">
          {TERRITORY.hub} territory
        </text>
      </g>

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
        <rect x={-18} y={-16} width={36} height={24} rx={3} fill="#FF461E" stroke="#fff" strokeWidth={2} />
        <path d="M-20,-16 L0,-28 L20,-16 Z" fill="#2F1C54" stroke="#fff" strokeWidth={2} />
        <text y={22} textAnchor="middle" fontSize={10.5} fontWeight={800} fill="#3d2614" stroke="#fff" strokeWidth={3} paintOrder="stroke">
          Hub yard
        </text>
      </g>

      {/* the farms: today's are bright and can be tapped */}
      {CLIENTS.map(c => {
        const p = map.at[c.id];
        const on = today.has(c.id);
        const keys = requests.filter(k => clientKey(k) === c.id);
        const isMine = mine.includes(c.id);
        const theirs = keys.some(k => bookings[k] === 'partner');
        const done = keys.length > 0 && keys.every(k => bookings[k]);
        const n = route.indexOf(c.id);
        // on the route step only the tractor's own farms can be tapped, each once
        const tappable = on && !running && (step === 'book' || (isMine && n < 0));
        const badge = step === 'route' ? (isMine ? (n >= 0 ? String(n + 1) : '?') : '') : String(keys.length);
        return (
          <g
            key={c.id}
            transform={`translate(${p.x},${p.y})`}
            className={`biz-pin${on ? ' is-on' : ''}${pick === c.id ? ' is-pick' : ''}${tappable ? ' is-tap' : ''}${step === 'route' && isMine && n < 0 ? ' is-next' : ''}`}
            onClick={tappable ? () => onPick(c.id) : undefined}
            role={on ? 'button' : undefined}
            aria-label={on ? (step === 'route' ? (isMine ? `${c.name}${n >= 0 ? `, stop ${n + 1}` : ', add as the next stop'}` : `${c.name}, not on your tractor`) : `${c.name}, ${keys.length} job${keys.length === 1 ? '' : 's'}${c.inside ? '' : ', outside the territory'}`) : undefined}
            aria-disabled={on && !tappable ? true : undefined}
          >
            <rect x={-17} y={-13} width={34} height={24} rx={4} fill={on ? '#7a4224' : '#8aa860'} stroke={pick === c.id ? '#ffb005' : c.inside ? '#fff' : '#F8285F'} strokeWidth={pick === c.id ? 3.5 : 1.5} strokeDasharray={c.inside || pick === c.id ? undefined : '3 2'} opacity={on ? (step === 'route' && !isMine ? 0.55 : 1) : 0.55} />
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
                {c.id in advised && (
                  <circle cx={-17} cy={-13} r={5} fill={advised[c.id] ? '#93C393' : '#F8285F'} stroke="#fff" strokeWidth={1.2}>
                    <title>{advised[c.id] ? 'Advice taken' : 'Advice declined'}</title>
                  </circle>
                )}
                <text y={24} textAnchor="middle" fontSize={10} fontWeight={800} fill="#2a1a0e" stroke="#fff" strokeWidth={3} paintOrder="stroke">
                  {c.name}
                </text>
              </>
            )}
          </g>
        );
      })}

    </svg>
  );
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
  const band = serBand(r.ser);
  const farmOf = (k: ReqKey) => clientOf(clientKey(k)).name;
  return (
    <div className="abs ending" style={{ inset: 0 }} role="dialog" aria-label={`Day ${r.day} done`}>
      <div className="fs-panel biz-result">
        <CloseX onClick={onNext} />
        <p className="biz-result-title">
          Day {r.day} done
          <span className="biz-stars" aria-label={`${r.stars} of 3 stars`}>
            {'★'.repeat(r.stars)}
            <i>{'★'.repeat(3 - r.stars)}</i>
          </span>
        </p>
        {r.kind === 'county' ? (
          <p className="biz-result-line">County road work all day: {ksh(r.revenue)}, driver paid. No farms served.</p>
        ) : r.kind === 'contract' ? (
          <p className="biz-result-line">
            A day in the {r.contract?.hub} for {r.contract?.agent}: {r.acres} acres of {ACTIVITY_NAME[r.contract?.activity ?? 'transport'].toLowerCase()}, {r.km} km there and back.
          </p>
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
                    <>Shortest way round: {r.km.toFixed(1)} km.</>
                  ) : (
                    <>
                      {r.km.toFixed(1)} km vs best {r.bestKm.toFixed(1)} km: {(r.km - r.bestKm).toFixed(1)} km lost.
                    </>
                  )}
                  {r.route && <small>Your route: {names(r.route)}</small>}
                  {!bestOne && r.best && <small className="is-best">Best route: {names(r.best)}</small>}
                </span>
                <span className={`ht-ser is-${band}`} title="Service Efficiency Ratio: acres serviced for every km driven">
                  <small>SER</small>
                  <b>{r.ser.toFixed(2)}</b>
                  <i>{band === 'healthy' ? 'healthy cluster' : band === 'ok' ? 'serviceable' : 'sparse'}</i>
                </span>
              </div>
            )}
            <p className="biz-result-line">
              {r.farmers} farmer{r.farmers === 1 ? '' : 's'} helped{r.partnerFarmers ? `, ${r.partnerFarmers} through a partner` : ''}: {r.acres.toFixed(1)} acres
              {r.hours ? ` in ${r.hours.toFixed(1)} hours` : ''}
              {r.overH ? ` (${r.overH.toFixed(1)} h overtime)` : ''}.
              {r.cleanFarms > 0 && ` ${r.cleanFarms} clean drive${r.cleanFarms === 1 ? '' : 's'} (+${r.cleanFarms * CLEAN_DRIVE.points} points).`}
              {r.cluster && ` ${r.cluster.farms} farms on ${ACTIVITY_NAME[r.cluster.activity].toLowerCase()} together: neighbourhood synced (+${CLUSTER.points} points).`}
            </p>
            {(r.dropped.length > 0 || r.unfinished.length > 0) && (
              <p className="biz-result-line is-warn">
                {r.dropped.length > 0 && `Dropped (too far for too little): ${r.dropped.map(farmOf).join(', ')}. Counted acres halved. `}
                {r.unfinished.length > 0 && `Unfinished: ${r.unfinished.map(farmOf).join(', ')}: not closed.`}
              </p>
            )}
          </>
        )}
        {r.kind === 'farms' && r.value !== undefined && (
          <p className="biz-result-line biz-value">
            <b>Day value {r.value}/100</b> · the shortest route is not always the best: {r.collected !== undefined && r.revenue ? `${Math.round((100 * r.collected) / r.revenue)}% of the hire collected` : 'all the hire collected'}
            {r.urgentServed ? `, ${r.urgentServed} urgent job${r.urgentServed === 1 ? '' : 's'} done (+${r.urgentServed * URGENT.points} points)` : ''}
            {r.urgentWaiting ? `, ${r.urgentWaiting} urgent left waiting` : ''}.
          </p>
        )}
        {(r.refund ?? 0) > 0 && (
          <p className="biz-result-line is-warn">
            Efficiency {score}/100 is under {Math.round(PAY_EFFICIENCY * 100)}: the farmers waited while the tractor took the long way round, so they paid back {ksh(r.refund ?? 0)} of the hire. The day is a loss. Find the shortest route to keep the full hire.
          </p>
        )}
        <dl className="biz-sheet">
          <div>
            <dt>Hire from farmers</dt>
            <dd>{ksh(r.revenue)}</dd>
          </div>
          {!!r.shortfall && (
            <div>
              <dt>{r.shortfall > 0 ? 'Not paid (bargained down, bad debt)' : 'Extra for urgent work'}</dt>
              <dd className={r.shortfall > 0 ? 'is-cost' : ''}>
                {r.shortfall > 0 ? '−' : '+'}
                {ksh(Math.abs(r.shortfall))}
              </dd>
            </div>
          )}
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
          {r.hubFee > 0 && (
            <div>
              <dt>The hub’s share of the tractor</dt>
              <dd className="is-cost">−{ksh(r.hubFee)}</dd>
            </div>
          )}
          {(r.refund ?? 0) > 0 && (
            <div>
              <dt>Paid back: route under {Math.round(PAY_EFFICIENCY * 100)}% efficient</dt>
              <dd className="is-cost">−{ksh(r.refund ?? 0)}</dd>
            </div>
          )}
          <div className="is-total">
            <dt>{r.profit < 0 ? 'Loss' : 'Profit'}</dt>
            <dd className={r.profit < 0 ? 'is-cost' : ''}>{ksh(r.profit)}</dd>
          </div>
          {r.instalment > 0 && (
            <div>
              <dt>PAYG instalment</dt>
              <dd className="is-cost">−{ksh(r.instalment)}</dd>
            </div>
          )}
        </dl>
        <p className="biz-result-line is-small">
          {r.saved > 0 && <>Farmers saved {ksh(r.saved)} vs by hand. </>}
          {r.missed > 0 ? `${r.missed} job${r.missed === 1 ? '' : 's'} not taken.` : 'No farmer left waiting.'}
          {` Fulfilment today ${r.fulfilled} of ${r.booked}; +${Math.floor(r.counted)} counted acres.`}
          {r.points > 0 && ` +${r.points} points.`}
        </p>
        {r.payg && (
          <p className={`biz-result-line is-small${r.payg.warn ? ' is-warn' : ''}`}>
            {r.payg.repossessed
              ? `Repossessed: too idle (${pct(r.payg.util)} used, ${pct(r.payg.fulfil)} fulfilment). Qualify again in ${PAYG.cooldown} days.`
              : r.payg.warn
                ? `Warning ${r.payg.warn} of ${PAYG.warn.days}: ${pct(r.payg.util)} used, ${pct(r.payg.fulfil)} fulfilment. Fill the calendar, or it goes back.`
                : r.payg.left > 0
                  ? `PAYG: ${ksh(r.payg.left)} to pay; ${pct(r.payg.util)} used this week.`
                  : 'Loan paid: the tractor is yours.'}
          </p>
        )}
        {rose && <p className="biz-rose">Level {lvl.level}: {lvl.name}!</p>}
        <GoldButton font={12} height={36} style={{ width: 200, marginTop: 6 }} onClick={onNext} ariaLabel="Next day">
          Next day
        </GoldButton>
      </div>
    </div>
  );
}

/* ---------------- the Hub: the support system, and the community of agents ---------------- */

function Hub({ b, dispatch }: { b: Biz; dispatch: Dispatch<Action> }) {
  const slots = demoSlots(b);
  const rows = leaderboard(b);
  const rank = rows.findIndex(r => r.you) + 1;
  return (
    <div className="biz-cards ht-hub" aria-label="The hub">
      <div className="biz-card">
        <small>The Hub Manager</small>
        <b>Demo plots · {b.demos.length} of {slots}</b>
        <p>A demo plot lifts advice uptake on its crop by {Math.round(100 * 0.25)} points. One a business level.</p>
        <div className="ht-chips">
          {(Object.keys(CROPS) as Crop[]).map(c => {
            const has = b.demos.includes(c);
            return (
              <button key={c} type="button" className={`ht-chip${has ? ' is-on' : ''}`} disabled={has || b.demos.length >= slots} onClick={() => dispatch({ type: 'bizDemo', crop: c })} aria-label={has ? `${cropName(c)} demo plot running` : `Ask for a ${cropName(c).toLowerCase()} demo plot`}>
                {has ? '✓ ' : ''}
                {cropName(c)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="biz-card">
        <small>The CX Team</small>
        <b>Outreach that repeats your advice</b>
        <Says who="caro" tone="sage" style={{ marginTop: 2 }}>
          We call every farmer you advise in the territory to repeat it. Outside, advice lands one time in four.
        </Says>
      </div>
      <div className="biz-card ht-board">
        <small>Agents · the community leaderboard</small>
        <b>Fulfilment rate · you are {rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`} of {rows.length}</b>
        <ol className="ht-rank">
          {rows.map((r, i) => (
            <li key={r.name} className={r.you ? 'is-you' : ''}>
              <i>{i + 1}</i>
              <span>
                {r.name} <small>{r.hub}</small>
              </span>
              <b>{pct(r.rate)}</b>
            </li>
          ))}
        </ol>
        <p>
          At {Math.round(0.9 * 100)}%+ one more farm books each day; under {Math.round(0.6 * 100)}%, one fewer.
        </p>
      </div>
    </div>
  );
}

/* ---------------- the Calendar: Narok's year, counted acres, and the Marketplace ---------------- */

function Calendar({ b, name }: { b: Biz; name: string }) {
  const month = monthOf(b.day);
  const year = yearOf(b.day);
  const rig = tractorOf(b);
  const grad = graduation(b);
  return (
    <div className="ht-cal" aria-label="The calendar">
      <div className="biz-card ht-cal-year">
        <small>Narok’s year · the Knowledge Graph’s windows</small>
        <table className="ht-months">
          <thead>
            <tr>
              <th />
              {MONTHS.map((m, i) => (
                <th key={m} className={i + 1 === month ? 'is-now' : ''}>
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(Object.keys(CROPS) as Crop[]).map(c => (
              <tr key={c}>
                <th>{cropName(c)}</th>
                {MONTHS.map((_, i) => {
                  const acts = ACTIVITIES.filter(a => a !== 'transport' && inWindow(c, a, i + 1));
                  return (
                    <td key={i} className={`${acts.length ? `is-${acts[0]}` : ''}${i + 1 === month ? ' is-now' : ''}`} title={acts.map(a => ACTIVITY_NAME[a]).join(', ') || 'Transport only'}>
                      {acts.map(a => ACTIVITY_NAME[a][0]).join('')}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="ht-worked">
              <th>{rig.own ? 'Busy' : 'Acres'}</th>
              {MONTHS.map((_, i) => {
                const m = b.months[`${year}-${i + 1}`];
                const util = m ? m.acres / (m.days * rig.capacity) : 0;
                return (
                  <td key={i} className={i + 1 === month ? 'is-now' : ''} title={m ? `${m.acres.toFixed(1)} acres in ${m.days} days` : 'Not yet'}>
                    {m ? (rig.own ? <span className={`ht-util${util < PAYG.warn.utilization ? ' is-low' : ''}`} style={{ height: `${Math.min(100, util * 100)}%` }} /> : m.acres.toFixed(0)) : i + 1 < month ? '·' : ''}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        <p className="ht-legend">
          L land prep · P planting · F fertilizer · H harvest · transport all year. A financed tractor must stay over {Math.round(PAYG.warn.utilization * 100)}% busy.
        </p>
      </div>
      <div className="biz-card">
        <small>{rig.own ? 'Pay-As-You-Go' : 'The path to a tractor'}</small>
        {rig.own ? (
          <>
            <b>
              {rig.name[0].toUpperCase()}
              {rig.name.slice(1)} · {ksh(Math.max(0, rig.own.price - rig.own.paid))} to pay
            </b>
            <Says who="gitonga" tone="sage">
              {rig.own.warn ? `Warning ${rig.own.warn} of ${PAYG.warn.days}. Fill the quiet days from the Marketplace.` : `Now keep ${rig.capacity} acres a day fed, all year.`}
            </Says>
          </>
        ) : (
          <>
            <b>
              {Math.floor(b.counted)} of {PAYG.tiers[0].counted} counted acres · {pct(fulfilment(b))} fulfilment
            </b>
            <Says who="aziza" tone="sage">
              {name}, counted acres = acres × activities. Sell the full cycle: prep, plant, feed, harvest. {grad?.why ? `You need ${grad.why}.` : ''}
            </Says>
          </>
        )}
      </div>
      <div className="biz-card">
        <small>The Marketplace · complementary hubs</small>
        <b>{rig.own ? 'Contracts from agents in other hubs' : 'Opens with your own tractor'}</b>
        <p>
          {HUBS.map(h => `${h.name}: ${h.note}`).join('. ')}. They fill Narok’s quiet weeks; offers show on Today.
        </p>
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
            <p>{withMoney(p.does)}</p>
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
  const rig = tractorOf(b);
  return (
    <div className="biz-cards" aria-label="Fleet">
      <div className="biz-card is-signed">
        <small>{rig.own ? `Your tractor · PAYG` : 'The tractor you dispatch'}</small>
        <b>{rig.own ? `${rig.name.replace('your ', 'Your ')}${rig.own.paid >= rig.own.price ? ' · paid off' : ''}` : b.tractor === 'large' ? 'Hub tractor (large)' : 'Hub tractor (standard)'}</b>
        <p>
          Implements: {b.tools.map(t => toolName(t)).join(', ')}. {rig.capacity} acres of field work a day.
        </p>
        <p className="biz-totals">
          {b.day - 1} day{b.day === 2 ? '' : 's'} · {b.acres.toFixed(1)} acres · {b.km.toFixed(0)} km · {b.helped} farmers
        </p>
        {rig.own ? (
          <p>
            {ksh(rig.own.paid)} of {ksh(rig.own.price)} paid.{b.owned.length > 1 ? ` The ${b.owned[0].hp}HP is paid off and works the Marketplace.` : ''}
          </p>
        ) : (
          <p>Ploughing an acre by hand costs about {ksh(handCost('plough', 1))}. Jobs without an implement go to a partner.</p>
        )}
      </div>
      {SHOP.map(item => {
        const block = shopBlock(b, item.id);
        return (
          <div key={item.id} className={`biz-card${block === 'Owned' ? ' is-signed' : ''}`}>
            <small>{item.id === 'large' ? 'Tractor' : item.id === 'combine' ? 'A separate asset' : 'Implement'}</small>
            <b>
              {item.name}
              <Info term={item.id === 'large' ? 'large' : item.id === 'harvester' ? 'maizeH' : item.name} size={14} />
            </b>
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

/** A farmer's traits on a booking: how urgent the job is today (the player's own farm can make it more so), what they
    pay, and whether they pay. */
function FarmerChips({ client, activity, signal }: { client: string; activity: import('./model').Activity; signal: FarmSignal }) {
  const tr = traitsOf(client);
  const u = urgencyOf(client, activity, signal);
  return (
    <span className="biz-traits">
      <i className={`is-u${u}`} title={u === 3 ? `Urgent: done today it pays ${Math.round(URGENT.premium * 100)}% more` : u === 2 ? 'This week' : 'Can wait'}>
        {u === 3 ? 'Urgent' : u === 2 ? 'This week' : 'Can wait'}
      </i>
      <i className={tr.pay >= 1 ? 'is-good' : 'is-warn'} title="What they pay against the list hire">
        Pays {Math.round(tr.pay * 100)}%
      </i>
      <i className={tr.reliability >= 0.9 ? 'is-good' : 'is-warn'} title="The share of what is owed they actually pay">
        {tr.reliability >= 0.95 ? 'Pays on time' : tr.reliability >= 0.85 ? 'Mostly pays' : 'Often late or unpaid'}
      </i>
    </span>
  );
}
