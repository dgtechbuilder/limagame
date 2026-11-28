import { farmSignal } from './signal';
import { Info } from '../learn/Info';
import { TrendChart } from './TrendChart';
import { URGENT, traitsOf, urgencyOf, type Activity, type FarmSignal } from './model';
import { useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode } from 'react';
import { FarmMap } from '../components/FarmMap';
import { Page } from '../components/Page';
import { CloseX } from '../components/Success';
import { StarIcon } from '../components/Icons';
import { TractorArt } from '../components/TractorArt';
import { GoldButton } from '../components/ui';
import { GuideLine } from '../first/Review';
import type { Action, BizTab, GameState } from '../state';
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
  HUBS,
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
import { kshText, withMoney } from '../money';
import { sfx } from '../sfx';

/* The tractor business, to Hello Tractor's brief: Today (scout farms with Campbell, book each job, plan the route,
   drive the tractor at every stop, run the day), Hub (demo plots, follow-up calls, the agents' leaderboard),
   Calendar (Narok's year, the Marketplace), Trend, Partners and Fleet. It is laid out as every other full page in the
   game (components/Page.tsx): the sections down the left, one panel, the game's type and tokens. The game state holds
   the business (state.biz); today's bookings and route are this screen's own until the day is run. */

/** shillings on screen: 10 times the stored value (src/money.ts) */
const ksh = (n: number) => kshText(Math.round(n));
const pct = (x: number) => `${Math.round(x * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
const shortName = (id: string) => clientOf(id).name.replace('Mama ', '');
type Tab = BizTab;

/** The jobs in a word or two, for chips and rows. */
const JOB: Record<Activity, string> = { landprep: 'Land prep', planting: 'Planting', fertilizer: 'Fertilizer', transport: 'Transport', harvest: 'Harvest' };

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '📋' },
  { id: 'hub', label: 'Hub', icon: '🏢' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'trend', label: 'My trend', icon: '📈' },
  { id: 'partners', label: 'Partners', icon: '🤝' },
  { id: 'fleet', label: 'Fleet', icon: '🚜' },
];

/** The map is drawn in the model's own pixels (MAP_W × MAP_H) and shown at this scale, so it fits beside the panel. */
const MAP_SCALE = 0.82;
const MAP_BOX = { w: Math.round(MAP_W * MAP_SCALE), h: Math.round(MAP_H * MAP_SCALE) };

export function Business({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const b = useMemo(() => bizOf(s.biz), [s.biz]);
  // each section has its own address (src/route.ts): /tractor-business/hub
  const tab: Tab = s.bizTab ?? 'today';
  const setTab = (t: Tab) => dispatch({ type: 'biz', open: true, tab: t });
  const [result, setResult] = useState<DayResult | null>(null);
  // the graduation offer, put off until the business is opened again
  const [gradLater, setGradLater] = useState(false);
  const close = () => dispatch({ type: 'biz', open: false });
  const lvl = levelOf(b.helped);
  const nxt = nextLevel(b.helped);
  const name = s.farmer?.name ?? 'Farmer';
  const grad = graduation(b);

  return (
    <div className="abs fs-screen biz" style={{ inset: 0 }}>
      <FarmMap dim={0.5} />
      <Page
        title="Tractor business"
        icon="🚜"
        className="biz-page"
        tabs={TABS}
        tab={tab}
        onTab={setTab}
        dispatch={dispatch}
        onClose={close}
        foot={
          <span className="biz-foot">
            <b>Level {lvl.level}</b>
            <span>{lvl.name}</span>
            <span className="biz-bar" aria-hidden="true">
              <span style={{ width: `${nxt ? Math.min(100, ((b.helped - lvl.helped) / (nxt.helped - lvl.helped)) * 100) : 100}%` }} />
            </span>
            <small>{nxt ? `${plural(nxt.helped - b.helped, 'farmer')} to go` : 'Top level'}</small>
          </span>
        }
      >
        <Stats b={b} />
        {tab === 'today' && <Today key={b.day} b={b} name={name} dispatch={dispatch} onDone={r => setResult(r)} signal={farmSignal(s)} settings={s.settings} paused={!!s.modal} />}
        {tab === 'hub' && <Hub b={b} dispatch={dispatch} />}
        {tab === 'calendar' && <Calendar b={b} />}
        {tab === 'trend' && (
          <div className="biz-card biz-trend-card">
            <TrendChart history={b.history} />
          </div>
        )}
        {tab === 'partners' && <Partners b={b} dispatch={dispatch} />}
        {tab === 'fleet' && <Fleet b={b} dispatch={dispatch} />}
      </Page>

      {result && <Results r={result} b={b} onNext={() => setResult(null)} />}
      {!result && !b.intro && <Welcome name={name} onGo={() => dispatch({ type: 'bizIntro' })} />}
      {!result && b.intro && grad?.due && tab === 'today' && !gradLater && <Graduation b={b} name={name} onSign={() => dispatch({ type: 'bizGraduate' })} onLater={() => setGradLater(true)} />}
    </div>
  );
}

/* ---------------- the numbers at the top of every section ---------------- */

function Stats({ b }: { b: Biz }) {
  const grad = graduation(b);
  const tier = grad?.tier ?? PAYG.tiers[PAYG.tiers.length - 1];
  const rate = fulfilment(b);
  const week = b.history.filter(r => r.kind === 'farms' && r.km > 0).slice(-7);
  const ser = week.length ? week.reduce((n, r) => n + r.ser, 0) / week.length : null;
  const band = ser === null ? null : serBand(ser);
  return (
    <div className="biz-stats">
      <Stat icon="📅" value={`Day ${b.day}`} label={`${MONTHS[monthOf(b.day) - 1]} · year ${yearOf(b.day)}`} />
      <Stat icon="💰" value={ksh(b.cash)} label="Account" />
      <Stat
        icon="🌾"
        className="biz-counted"
        value={grad ? `${Math.floor(b.counted)} / ${tier.counted}` : String(Math.floor(b.counted))}
        label={grad ? 'Tractor goal' : 'Counted acres'}
        title={`Counted acres${grad ? ` to a ${tier.hp}HP tractor` : ''}: each acre counts once for every different job done on it`}
        frac={grad ? b.counted / tier.counted : 1}
      />
      <Stat icon="✅" value={pct(rate)} label="Jobs kept" title="Fulfilment rate: the jobs you closed, out of every job booked" tone={rate >= PAYG.fulfilment ? 'good' : rate >= PAYG.warn.fulfilment ? 'ok' : 'bad'} />
      <Stat
        icon="🛣️"
        value={ser === null ? '—' : ser.toFixed(2)}
        label="Acres per km"
        title="Service Efficiency Ratio (SER): acres worked for every km driven, over the last week"
        tone={band === null ? undefined : band === 'healthy' ? 'good' : band === 'ok' ? 'ok' : 'bad'}
      />
    </div>
  );
}

function Stat({ icon, value, label, title, tone, frac, className }: { icon: string; value: string; label: string; title?: string; tone?: 'good' | 'ok' | 'bad'; frac?: number; className?: string }) {
  return (
    <div className={`biz-stat${tone ? ` is-${tone}` : ''}${className ? ` ${className}` : ''}`} title={title}>
      <span className="biz-stat-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="biz-stat-text">
        <b>{value}</b>
        <small>{label}</small>
        {frac !== undefined && frac < 1 && (
          <span className="biz-bar" aria-hidden="true">
            <span style={{ width: `${Math.max(2, Math.min(100, frac * 100))}%` }} />
          </span>
        )}
      </span>
    </div>
  );
}

/* ---------------- Sasha's welcome, and the graduation moment ---------------- */

function Welcome({ name, onGo }: { name: string; onGo: () => void }) {
  const first = PAYG.tiers[0];
  const steps: [string, string, string][] = [
    ['🔍', 'Scout', 'Tap a farm to see its jobs.'],
    ['📋', 'Book', 'Give each job to the tractor or a partner.'],
    ['🚜', 'Drive', 'Drive the whole route: the road to each farm, and the job there.'],
    ['💵', 'Get paid', `${FARMER_PAY_X}× the hire, if your route is ${Math.round(PAY_EFFICIENCY * 100)}%+ efficient.`],
    ['🏆', 'Grow', `${first.counted} acres earns your own ${first.hp}HP tractor.`],
  ];
  return (
    <div className="abs ending biz-dialog" style={{ inset: 0 }} role="dialog" aria-label={`Welcome to the ${TERRITORY.hub}`}>
      <div className="fs-panel biz-pop">
        <CloseX onClick={onGo} />
        <p className="biz-pop-title">Welcome to the {TERRITORY.hub}</p>
        <Says who="sasha" tone="white">
          Hi {name}! Book tractor work for the farmers around the hub. Do it well and we help you buy your own tractor.
        </Says>
        <ol className="biz-steps">
          {steps.map(([icon, title, line]) => (
            <li key={title}>
              <span className="biz-ico" aria-hidden="true">
                {icon}
              </span>
              <b>{title}</b>
              <small>{line}</small>
            </li>
          ))}
        </ol>
        <GoldButton font={13} height={38} style={{ width: 200 }} onClick={onGo} ariaLabel="Let's go">
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
    <div className="abs ending biz-dialog" style={{ inset: 0 }} role="dialog" aria-label="Graduation">
      <div className="fs-panel biz-pop">
        <CloseX onClick={onLater} label="Not now" />
        <p className="biz-pop-title">{second ? 'Your second tractor' : 'Graduation day'}</p>
        <Says who="sasha" tone="white">
          Well done, {name}! {Math.floor(b.counted)} acres and {pct(fulfilment(b))} of jobs kept. You can now get a <b>{g.tier.name}</b>.
        </Says>
        <div className="biz-facts">
          <Fact label="Price" value={ksh(g.tier.price)} />
          <Fact label="You pay" value={`${Math.round(PAYG.share * 100)}% a day`} sub="of each day’s hire" />
          <Fact label="It works" value={`${g.tier.capacity} acres`} sub="a day" />
        </div>
        <p className="biz-pop-note">Keep it busy over half the time, or it goes back.</p>
        <div className="biz-pop-actions">
          <button type="button" className="set-link" onClick={onLater}>
            Not now
          </button>
          <GoldButton font={13} height={38} style={{ width: 230 }} onClick={onSign} ariaLabel="Sign the PAYG agreement">
            Sign the PAYG agreement
          </GoldButton>
        </div>
      </div>
    </div>
  );
}

function Fact({ label, value, sub, tone, className, children }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'good' | 'ok' | 'bad'; className?: string; children?: ReactNode }) {
  return (
    <div className={`biz-fact${tone ? ` is-${tone}` : ''}${className ? ` ${className}` : ''}`}>
      <small>{label}</small>
      <b>{value}</b>
      {sub && <span>{sub}</span>}
      {children}
    </div>
  );
}

/* ---------------- Today: scout, book, plan the route, drive, run the day ---------------- */

/* A day in three steps. Book: tap a farm, read Campbell's tip and pass it on, then give each job to the tractor or a
   partner. Route: tap the farms in the order the tractor will drive to them, along the roads; there is no route line
   and no km while planning. Run: the player drives the whole day without a break (DayDrive.tsx): the road to each farm,
   the job there and the road home, with a green line at the top showing the tractor moving from farm to farm; then
   the day's result, with the route score and the two numbers. */

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
  // the coach's one line: what to do now
  const line = run
    ? run.phase === 'work'
      ? `Take the wheel, ${name}: work every row once, round the stones and trees.`
      : run.last
        ? `${run.last} Next: ${run.at < run.stops.length ? clientOf(run.stops[run.at]).name : 'back to the yard'}.`
        : `On the road to ${plural(run.stops.length, 'farm')}.`
    : step === 'route'
      ? plan.unrouted.length
        ? route.length
          ? `Next stop after ${shortName(route[route.length - 1])}? Short drives save diesel.`
          : 'Tap the farms in the order to visit them.'
        : plan.dropped.length
          ? `Too spread out: ${plan.dropped.map(k => shortName(clientKey(k))).join(', ')} would be dropped.`
          : plan.refund > 0
            ? `Only ${Math.round(plan.efficiency * 100)}% efficient: farmers would pay back the hire. Try a shorter route.`
            : 'Route set. Start the day!'
      : plan.problem && Object.keys(bookings).length && !plan.problem.startsWith('Plan your route')
        ? plan.problem
        : pick
          ? scan?.rec && !(pick in b.advised)
            ? `Campbell has a tip for ${clientOf(pick).name}.`
            : 'Choose who does each job.'
          : `Tap a farm to see its jobs. Book at least ${plural(plan.needed, 'farm')}.`;

  const est = plan.revenue + plan.commission - plan.workDiesel - plan.wage - plan.hubFee - plan.refund;

  return (
    <div className="biz-today">
      <div className="biz-left" style={{ width: MAP_BOX.w }}>
        <div className="biz-map" style={{ width: MAP_BOX.w, height: MAP_BOX.h }}>
          <div className="biz-map-layer" style={{ width: MAP_W, height: MAP_H, transform: `scale(${MAP_SCALE})` }}>
            <TerritoryMap map={map} requests={requests} bookings={bookings} route={step === 'route' ? route : []} step={step} pick={pick} onPick={tapFarm} advised={b.advised} running={!!run} />
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
          {step === 'route' && !run && (
            <ol className="biz-route" aria-label="Your route">
              <li className="is-yard">Yard</li>
              {route.map((id, i) => (
                <li key={id} className={plan.dropped.some(k => clientKey(k) === id) ? 'is-drop' : ''}>
                  <b>{i + 1}</b> {shortName(id)}
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
        <div className="biz-meters">
          <Meter label="Farms" value={`${mine.length} of ${plan.needed} needed`} frac={plan.needed ? mine.length / plan.needed : 1} good={mine.length >= plan.needed} />
          <Meter
            label="Hours"
            value={`${plan.workH.toFixed(1)} of ${DAY_HOURS}`}
            frac={plan.workH / DAY_HOURS}
            warn={plan.workH > DAY_HOURS}
            title={rig.own ? `${plan.fieldAcres.toFixed(1)} of ${plan.capacity} acres` : 'Work hours, before the driving'}
          />
          <Meter
            label="Spread"
            value={mine.length ? (plan.serBand === 'healthy' ? 'Close by' : plan.serBand === 'ok' ? 'OK' : 'Too far') : '—'}
            frac={Math.min(1, plan.ser / SER.healthy)}
            warn={mine.length > 0 && plan.serBand === 'low'}
            good={plan.serBand === 'healthy'}
            title="Acres worked for every km driven: book farms close together"
          />
          <div
            className={`biz-meter biz-keep${plan.refund > 0 ? ' is-warn' : ''}`}
            title={`Hire ${ksh(plan.revenue + plan.commission)}, less work diesel ${ksh(plan.workDiesel)}, driver ${ksh(plan.wage)}${plan.hubFee ? ` and the hub’s share ${ksh(plan.hubFee)}` : ''}${plan.refund > 0 ? `. Route only ${Math.round(plan.efficiency * 100)}% efficient: farmers pay back ${ksh(plan.refund)}` : ''}. Road diesel comes off after the route.`}
          >
            <small>{est < 0 ? 'Est. loss' : 'Est. profit'}</small>
            <b className={est < 0 ? 'is-cost' : ''}>{ksh(est)}</b>
          </div>
        </div>
      </div>

      <aside className="biz-side">
        <GuideLine text={line} face={<Face who="caro" size={34} />} style={{ position: 'relative', left: 0, right: 0, bottom: 0, zIndex: 0, minHeight: 0 }} />
        <div className="biz-panel">
          {run ? (
            run.phase === 'work' && atFarm ? (
              <>
                <PanelHead title={`Stop ${run.at + 1}: ${atFarm.name}`} sub={jobText(requests, bookings, atFarm.id)} />
                <p className="biz-note">Drive it yourself for a cleaner job, or let the hub driver do it ({Math.round(BASELINE * 100)}%).</p>
                <button type="button" className="set-link biz-wide" onClick={() => game.current?.skip()}>
                  Let the driver do it
                </button>
              </>
            ) : (
              <>
                <PanelHead title={run.at < run.stops.length ? `To ${clientOf(run.stops[run.at]).name}` : 'Back to the yard'} sub="On the road" />
                <ol className="biz-stops">
                  {run.stops.map((id, i) => (
                    <li key={id} className={run.drives[id] !== undefined ? 'is-done' : i === run.at ? 'is-now' : ''}>
                      <b>{run.drives[id] !== undefined ? '✓' : i + 1}</b>
                      {shortName(id)}
                      {run.drives[id] !== undefined && <i>{pct(run.drives[id])}</i>}
                    </li>
                  ))}
                </ol>
              </>
            )
          ) : step === 'route' ? (
            <>
              <PanelHead title="Plan the route" sub={`${route.length} of ${plural(mine.length, 'stop')} placed`} />
              <div className="biz-tools">
                <button type="button" className="set-link" disabled={!route.length} onClick={() => setRoute(r => r.slice(0, -1))}>
                  Undo last stop
                </button>
                <button type="button" className="set-link" disabled={!route.length} onClick={() => setRoute([])}>
                  Clear route
                </button>
                {b.partners.includes('app') && (
                  <button type="button" className="set-link" onClick={() => setRoute(bestRoute(map, mine))}>
                    Shortest route (app)
                  </button>
                )}
              </div>
            </>
          ) : pick && scan ? (
            <>
              <PanelHead
                title={clientOf(pick).name}
                sub={
                  <>
                    {clientOf(pick).place}
                    {!clientOf(pick).inside && <em className="biz-tag is-out">Outside the hub area</em>}
                  </>
                }
                onClose={() => setPick(null)}
              />
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
                      <p className="biz-part-top">
                        <b>{JOB[activity]}</b>
                        <span>{part.name}</span>
                        <FarmerChips client={pick} activity={activity} signal={signal} />
                      </p>
                      <small>
                        {part.acres} ac {cropName(part.crop).toLowerCase()} · {toolName(part.tool)} · {ksh(hireOf(part.tool) * part.acres)}
                        {extra ? ' · your tip' : ''}
                      </small>
                      <span className="biz-seg" role="group" aria-label={`${part.name}: who does it`}>
                        <button type="button" className={v === 'me' ? 'is-on' : ''} disabled={!hasTool} onClick={() => book(k, v === 'me' ? null : 'me')} title={hasTool ? '' : `You have no ${toolName(part.tool).toLowerCase()}`}>
                          {hasTool ? (
                            <>
                              {rig.own ? 'My tractor' : 'Hub tractor'} <i className={m.keep < m.hire * 0.3 ? 'is-thin' : ''}>+{ksh(m.keep)}</i>
                            </>
                          ) : (
                            <>
                              No {toolName(part.tool).split(' ').pop()!.toLowerCase()} <i>Fleet</i>
                            </>
                          )}
                        </button>
                        {kimani && (
                          <button type="button" className={v === 'partner' ? 'is-on is-partner' : ''} onClick={() => book(k, v === 'partner' ? null : 'partner')}>
                            Partner <i title={`You keep ${Math.round(PARTNER_CUT * 100)}%`}>+{ksh(m.partner)}</i>
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })}
            </>
          ) : (
            <>
              <PanelHead title="Today’s farms" sub={`${plural(farms.length, 'farm')} want tractor work`} />
              <ul className="biz-farms">
                {farms.map(id => {
                  const keys = requests.filter(k => clientKey(k) === id);
                  const done = keys.filter(k => bookings[k]).length;
                  const onMe = keys.some(k => bookings[k] === 'me');
                  return (
                    <li key={id}>
                      <button type="button" onClick={() => tapFarm(id)} aria-label={`${clientOf(id).name}: ${plural(keys.length, 'job')}`}>
                        <b>{clientOf(id).name}</b>
                        <small>
                          {plural(keys.length, 'job')} · {[...new Set(keys.map(k => JOB[partOf(k).activity]))].join(', ')}
                        </small>
                        <em className={`biz-tag${done === keys.length ? ' is-good' : done ? ' is-part' : ''}`}>{done === keys.length ? (onMe ? 'Booked' : 'Passed on') : done ? `${done} of ${keys.length}` : 'Open'}</em>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {offers.length > 0 && (
                <div className="biz-offers">
                  <p className="biz-label">Marketplace</p>
                  {offers.map(o => (
                    <button key={o.id} type="button" className="biz-offer" onClick={() => takeOffer(o)} disabled={mine.length > 0} title={mine.length ? 'Clear today’s tractor jobs to take a contract' : ''}>
                      <b>
                        {o.hub.name} · {JOB[o.activity]}
                      </b>
                      <span>
                        {o.acres} acres for {ksh(o.pay)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="biz-actions">
          {b.partners.includes('county') && !Object.keys(bookings).length && step === 'book' && !run && (
            <button type="button" className="set-link" onClick={() => (dispatch({ type: 'bizHireOut' }), onDone(hireOutDay(b, requests.length).result))}>
              Hire out to the county
            </button>
          )}
          {run ? (
            <GoldButton font={13} height={36} style={{ flex: 1, opacity: 0.5 }} ariaLabel="On the road">
              {run.phase === 'work' ? 'Driving…' : 'On the road…'}
            </GoldButton>
          ) : step === 'book' ? (
            mine.length ? (
              <GoldButton font={13} height={36} style={{ flex: 1, opacity: booked ? 1 : 0.5 }} onClick={() => booked && (setPick(null), setStep('route'), sfx.action())} ariaLabel="Next: plan the route">
                Next: plan the route
              </GoldButton>
            ) : (
              <GoldButton font={13} height={36} style={{ flex: 1, opacity: plan.problem ? 0.5 : 1 }} onClick={() => !plan.problem && start()} ariaLabel="Start the day">
                Start the day
              </GoldButton>
            )
          ) : (
            <>
              <button type="button" className="set-link" onClick={() => setStep('book')}>
                Back
              </button>
              <GoldButton font={13} height={36} style={{ flex: 1, opacity: plan.problem ? 0.5 : 1 }} onClick={() => !plan.problem && start()} ariaLabel="Start the day">
                Start the day
              </GoldButton>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

function PanelHead({ title, sub, onClose }: { title: string; sub?: ReactNode; onClose?: () => void }) {
  return (
    <div className="biz-panel-head">
      <span>
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      {onClose && (
        <button type="button" className="biz-x" onClick={onClose} aria-label="Close the farm">
          ✕
        </button>
      )}
    </div>
  );
}

/** The tractor's jobs at a farm, in a few words. */
function jobText(requests: ReqKey[], bookings: Bookings, farm: string) {
  return requests
    .filter(k => bookings[k] === 'me' && clientKey(k) === farm)
    .map(k => {
      const { part, activity } = partOf(k);
      return `${JOB[activity]}, ${part.acres} ac`;
    })
    .join(' · ');
}

/** Campbell's tip on a farm: what the farmer does the slow way, and passing the tip on; then the farmer's answer. */
function Campbell({ b, scan, onDeliver }: { b: Biz; scan: ReturnType<typeof scanFarm>; onDeliver: () => void }) {
  const answered = scan.client.id in b.advised;
  const yes = b.advised[scan.client.id];
  const who = scan.client.name.split(' ').pop();
  return (
    <div className={`ht-campbell${answered ? ` is-${yes ? 'yes' : 'no'}` : ''}`}>
      <p className="ht-campbell-flag">
        <b>💡 Campbell:</b>{' '}
        {answered ? (
          <span className={`ht-answer is-${yes ? 'yes' : 'no'}`}>{yes ? `${who} said yes. A new job is on the list.` : scan.client.inside ? `${who} said no. A demo plot would help.` : `${who} said no: too far from the hub.`}</span>
        ) : scan.rec ? (
          `${who} ${scan.rec.flag}.`
        ) : (
          'Nothing more to suggest today.'
        )}
      </p>
      {scan.rec && !answered && (
        <button type="button" className="ht-deliver" onClick={onDeliver} aria-label={`Pass on Campbell's tip: ${ACTIVITY_NAME[scan.rec.activity].toLowerCase()}`} title={cap(scan.rec.advice)}>
          Suggest {JOB[scan.rec.activity].toLowerCase()} <i>{pct(scan.chance)} yes</i>
        </button>
      )}
    </div>
  );
}

function Meter({ label, value, frac, warn, good, title }: { label: string; value: string; frac: number; warn?: boolean; good?: boolean; title?: string }) {
  return (
    <div className={`biz-meter${warn ? ' is-warn' : ''}${good ? ' is-good' : ''}`} title={title}>
      <small>{label}</small>
      <b>{value}</b>
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

/** A name under a place on the map: dark text on a white pill (drawn in map pixels, so about 10px on screen). */
function MapLabel({ y, text, strong }: { y: number; text: string; strong?: boolean }) {
  const w = text.length * 6.7 + 14;
  return (
    <g className="biz-map-label">
      <rect x={-w / 2} y={y} width={w} height={17} rx={8.5} fill="#fff" fillOpacity={strong ? 1 : 0.92} />
      <text y={y + 12.5} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#4a2a10">
        {text}
      </text>
    </g>
  );
}

/** A tree: a trunk and a round, two-tone crown. */
function Tree({ x, y, r = 11 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x},${y})`} aria-hidden="true">
      <ellipse cy={r * 0.95} rx={r * 0.8} ry={r * 0.22} fill="rgba(40,70,20,0.22)" />
      <rect x={-1.6} y={r * 0.2} width={3.2} height={r * 0.75} rx={1} fill="#7a5233" />
      <circle r={r} fill="#3f8a35" />
      <circle cx={-r * 0.3} cy={-r * 0.3} r={r * 0.55} fill="#5aa847" />
    </g>
  );
}

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
    <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} width={MAP_W} height={MAP_H} role="group" aria-label={`The ${TERRITORY.hub} area: the farms around the yard, and the roads between them`}>
      <rect width={MAP_W} height={MAP_H} fill="#a9d67b" />
      {/* soft patches of grass, then a river and a few trees under the roads */}
      <g aria-hidden="true">
        <ellipse cx={90} cy={60} rx={120} ry={46} fill="#b6de8c" />
        <ellipse cx={420} cy={200} rx={140} ry={40} fill="#b6de8c" />
        <ellipse cx={300} cy={40} rx={90} ry={26} fill="#9fcf70" />
        <path d={`M-10,${MAP_H * 0.62} C120,${MAP_H * 0.5} 260,${MAP_H * 0.92} ${MAP_W + 10},${MAP_H * 0.7}`} stroke="#5fb0dc" strokeWidth={11} fill="none" strokeLinecap="round" />
        <path d={`M-10,${MAP_H * 0.62} C120,${MAP_H * 0.5} 260,${MAP_H * 0.92} ${MAP_W + 10},${MAP_H * 0.7}`} stroke="#9ad6f2" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
      </g>
      {[
        [444, 26, 11],
        [474, 46, 13],
        [452, 70, 10],
        [496, 24, 9],
        [66, 200, 12],
        [92, 214, 9],
      ].map(([x, y, r]) => (
        <Tree key={`${x}${y}`} x={x} y={y} r={r} />
      ))}
      {/* the hub's area: inside it, the support system; outside, the high-risk zone */}
      <g className="ht-territory" aria-hidden="true">
        <ellipse cx={terr.cx} cy={terr.cy} rx={terr.rx} ry={terr.ry} fill="#fff" fillOpacity={0.16} stroke="#fff" strokeOpacity={0.9} strokeWidth={2} strokeDasharray="8 6" />
        {/* its key, in the corner where no place is ever put */}
        <g transform={`translate(${MAP_W - 166},${MAP_H - 28})`}>
          <rect width={158} height={20} rx={10} fill="#2e6b35" fillOpacity={0.9} />
          <path d="M10,10 H30" stroke="#fff" strokeWidth={2} strokeDasharray="5 3" />
          <text x={36} y={14.2} fontSize={9} fontWeight={700} fill="#fff">
            {TERRITORY.hub} territory
          </text>
        </g>
      </g>

      {/* the murram roads between every farm: an edge and a lighter middle, no distances */}
      <g aria-hidden="true">
        {map.roads.map(r => (
          <path key={`e${r.a}${r.b}`} d={roadD(map, r)} stroke="#b08a5f" strokeWidth={9} fill="none" strokeLinecap="round" />
        ))}
        {map.roads.map(r => (
          <path key={`m${r.a}${r.b}`} d={roadD(map, r)} stroke="#e6cc9e" strokeWidth={5.5} fill="none" strokeLinecap="round" />
        ))}
        {map.junctions.map(j => (
          <circle key={j} cx={map.at[j].x} cy={map.at[j].y} r={5} fill="#e6cc9e" />
        ))}
      </g>

      {/* the hub yard: a barn */}
      <g transform={`translate(${yard.x},${yard.y})`} aria-hidden="true">
        <ellipse cy={13} rx={22} ry={4} fill="rgba(0,0,0,0.2)" />
        <rect x={-17} y={-8} width={34} height={21} rx={2} fill="#c8432b" />
        <path d="M-21,-6 L0,-24 L21,-6 Z" fill="#7a2e1d" />
        <path d="M-21,-6 L0,-24 L21,-6" fill="none" stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
        <rect x={-7} y={0} width={14} height={13} fill="#f6e6c6" />
        <path d="M-7,0 L7,13 M7,0 L-7,13" stroke="#c8432b" strokeWidth={1.8} />
        <circle cy={-12} r={3.2} fill="#f6e6c6" />
        <MapLabel y={17} text="Hub yard" strong />
      </g>

      {/* the farms: today's can be tapped */}
      {CLIENTS.map(c => {
        const p = map.at[c.id];
        const on = today.has(c.id);
        if (!on)
          return (
            <g key={c.id} transform={`translate(${p.x},${p.y})`} className="biz-pin" aria-hidden="true">
              <rect x={-13} y={-9} width={26} height={18} rx={4} fill="#c3e39c" />
              {[-5, 0, 5].map(y => (
                <path key={y} d={`M-9,${y} H9`} stroke="#a3cf73" strokeWidth={2} strokeLinecap="round" />
              ))}
            </g>
          );
        const keys = requests.filter(k => clientKey(k) === c.id);
        const isMine = mine.includes(c.id);
        const theirs = keys.some(k => bookings[k] === 'partner');
        const done = keys.length > 0 && keys.every(k => bookings[k]);
        const n = route.indexOf(c.id);
        const picked = pick === c.id;
        const dim = step === 'route' && !isMine;
        // on the route step only the tractor's own farms can be tapped, each once
        const tappable = !running && (step === 'book' || (isMine && n < 0));
        const badge = step === 'route' ? (isMine ? (n >= 0 ? String(n + 1) : '?') : '') : done ? '✓' : String(keys.length);
        const badgeFill = step === 'route' ? (n >= 0 ? '#ffae00' : '#fff') : done ? (isMine ? '#ffae00' : theirs ? '#6c4fa3' : '#2f9b14') : '#fff';
        const badgeInk = badgeFill === '#fff' ? '#4a2a10' : badgeFill === '#ffae00' ? '#4a2a10' : '#fff';
        return (
          <g
            key={c.id}
            transform={`translate(${p.x},${p.y})`}
            className={`biz-pin is-on${picked ? ' is-pick' : ''}${tappable ? ' is-tap' : ''}${step === 'route' && isMine && n < 0 ? ' is-next' : ''}`}
            onClick={tappable ? () => onPick(c.id) : undefined}
            role="button"
            opacity={dim ? 0.5 : 1}
            aria-label={step === 'route' ? (isMine ? `${c.name}${n >= 0 ? `, stop ${n + 1}` : ', add as the next stop'}` : `${c.name}, not on your tractor`) : `${c.name}, ${plural(keys.length, 'job')}${c.inside ? '' : ', outside the territory'}`}
            aria-disabled={!tappable ? true : undefined}
          >
            {/* a bigger tap area than the drawing */}
            <rect x={-26} y={-22} width={52} height={58} fill="transparent" />
            <ellipse cy={16} rx={19} ry={3.5} fill="rgba(0,0,0,0.2)" />
            <rect className="biz-pin-mat" x={-20} y={-15} width={40} height={30} rx={7} fill="#fff" stroke={picked ? '#ffae00' : c.inside ? '#fff' : '#e0752d'} strokeWidth={picked ? 3.5 : 2} strokeDasharray={c.inside || picked ? undefined : '4 3'} />
            <rect x={-16} y={-11} width={32} height={22} rx={4} fill="#a0693b" />
            {[-6, 0, 6].map(y => (
              <path key={y} d={`M-12,${y} H12`} stroke="#c48d58" strokeWidth={2.4} strokeLinecap="round" />
            ))}
            {[-9, -3, 3, 9].map(x => (
              <circle key={x} cx={x} cy={-6} r={1.8} fill="#6cc04a" />
            ))}
            {badge && (
              <g transform="translate(19,-15)">
                <circle r={10} fill={badgeFill} stroke="#4a2a10" strokeOpacity={0.35} strokeWidth={1.2} />
                <text y={4.3} textAnchor="middle" fontSize={9.5} fontWeight={800} fill={badgeInk}>
                  {badge}
                </text>
              </g>
            )}
            {c.id in advised && (
              <g transform="translate(-19,-15)">
                <circle r={7} fill={advised[c.id] ? '#2f9b14' : '#a8382a'} stroke="#fff" strokeWidth={1.5} />
                <text y={3.4} textAnchor="middle" fontSize={7} fontWeight={900} fill="#fff">
                  {advised[c.id] ? '✓' : '✕'}
                </text>
                <title>{advised[c.id] ? 'Said yes to the tip' : 'Said no to the tip'}</title>
              </g>
            )}
            <MapLabel y={19} text={shortName(c.id)} strong={picked} />
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
  const names = (ids: string[]) => ['Yard', ...ids.map(shortName), 'Yard'].join(' → ');
  const band = serBand(r.ser);
  const farmOf = (k: ReqKey) => shortName(clientKey(k));
  const earned = r.revenue - (r.shortfall ?? 0) + r.commission;
  const refund = r.refund ?? 0;
  const costs = r.diesel + r.wage + r.hubFee + refund;
  const extras = [
    r.cleanFarms > 0 && `${plural(r.cleanFarms, 'clean drive')} +${r.cleanFarms * CLEAN_DRIVE.points}`,
    r.cluster && `Neighbours synced +${CLUSTER.points}`,
    r.urgentServed && `${plural(r.urgentServed, 'urgent job')} +${r.urgentServed * URGENT.points}`,
  ].filter(Boolean) as string[];
  return (
    <div className="abs ending biz-dialog" style={{ inset: 0 }} role="dialog" aria-label={`Day ${r.day} done`}>
      <div className="fs-panel biz-pop biz-result">
        <CloseX onClick={onNext} />
        <p className="biz-pop-title">
          Day {r.day} done
          <span className="biz-stars" aria-label={`${r.stars} of 3 stars`}>
            {[0, 1, 2].map(i => (
              <StarIcon key={i} size={18} filled={i < r.stars} />
            ))}
          </span>
        </p>

        {r.kind === 'farms' && r.km > 0 ? (
          <div className={`biz-eff${bestOne ? ' is-best' : ''}`} aria-label={`Route score ${score} out of 100`}>
            <Fact label="Route score" value={<>{score}<i>/100</i></>} sub={bestOne ? 'The best route!' : `${(r.km - r.bestKm).toFixed(1)} km longer than the best`} tone={bestOne ? 'good' : 'ok'} />
            {r.value !== undefined && <Fact label="Day value" value={<>{r.value}<i>/100</i></>} sub={r.urgentWaiting ? `${r.urgentWaiting} urgent left waiting` : 'Route, pay and urgent work'} />}
            <Fact className="ht-ser" label="Acres per km (SER)" value={r.ser.toFixed(2)} sub={band === 'healthy' ? 'Close together' : band === 'ok' ? 'OK' : 'Too far apart'} tone={band === 'healthy' ? 'good' : band === 'ok' ? 'ok' : 'bad'} />
            <Fact label="Farmers helped" value={helped} sub={`${r.acres.toFixed(1)} acres${r.hours ? ` · ${r.hours.toFixed(1)} h` : ''}`} />
          </div>
        ) : (
          <p className="biz-result-line">
            {r.kind === 'county'
              ? `A day of county road work: ${ksh(r.revenue)}. No farms served.`
              : r.kind === 'contract'
                ? `A day in the ${r.contract?.hub} for ${r.contract?.agent}: ${r.acres} acres of ${JOB[r.contract?.activity ?? 'transport'].toLowerCase()}.`
                : `${plural(helped, 'farmer')} helped through partners.`}
          </p>
        )}

        {r.kind === 'farms' && r.route && (
          <p className="biz-route-line">
            <span>
              <b>Your route</b> {names(r.route)} · {r.km.toFixed(1)} km
            </span>
            {!bestOne && r.best && (
              <span className="is-best">
                <b>Best</b> {names(r.best)} · {r.bestKm.toFixed(1)} km
              </span>
            )}
          </p>
        )}

        <div className="biz-sheet">
          <Fact label="Earned" value={ksh(earned)} sub={r.shortfall && r.shortfall > 0 ? `${ksh(r.shortfall)} not paid` : r.commission ? `incl. ${ksh(r.commission)} from partners` : 'from farmers'} tone="good" />
          <Fact label="Costs" value={`−${ksh(costs)}`} sub={`Diesel ${ksh(r.diesel)} · driver ${ksh(r.wage)}${r.hubFee ? ` · hub ${ksh(r.hubFee)}` : ''}${refund ? ` · paid back ${ksh(refund)}` : ''}`} tone="bad" />
          <Fact className="is-total" label={r.profit < 0 ? 'Loss' : 'Profit'} value={ksh(r.profit)} sub={r.instalment > 0 ? `−${ksh(r.instalment)} tractor payment` : r.saved > 0 ? `Farmers saved ${ksh(r.saved)}` : undefined} tone={r.profit < 0 ? 'bad' : undefined} />
        </div>

        {(r.dropped.length > 0 || r.unfinished.length > 0 || refund > 0 || r.payg?.warn || r.payg?.repossessed) && (
          <p className="biz-result-line is-warn">
            {refund > 0 && `Route under ${Math.round(PAY_EFFICIENCY * 100)}% efficient: farmers paid back ${ksh(refund)}. A shorter route keeps the full hire. `}
            {r.dropped.length > 0 && `Dropped (too far): ${r.dropped.map(farmOf).join(', ')}. `}
            {r.unfinished.length > 0 && `Not finished: ${r.unfinished.map(farmOf).join(', ')}. `}
            {r.payg?.repossessed
              ? `The tractor went back: too idle. Try again in ${PAYG.cooldown} days.`
              : r.payg?.warn
                ? `Warning ${r.payg.warn} of ${PAYG.warn.days}: only ${pct(r.payg.util)} busy. Keep it working, or it goes back.`
                : ''}
          </p>
        )}

        <p className="biz-result-line is-small">
          Jobs done {r.fulfilled} of {r.booked} · +{Math.floor(r.counted)} counted acres
          {r.points > 0 && ` · +${r.points} points`}
          {extras.length > 0 && ` (${extras.join(', ')})`}
          {r.payg && !r.payg.warn && !r.payg.repossessed && (r.payg.left > 0 ? ` · ${ksh(r.payg.left)} left on the tractor` : ' · Tractor paid off!')}
        </p>
        {rose && <p className="biz-rose">Level {lvl.level}: {lvl.name}!</p>}
        <GoldButton font={13} height={38} style={{ width: 200 }} onClick={onNext} ariaLabel="Next day">
          Next day
        </GoldButton>
      </div>
    </div>
  );
}

/* ---------------- the Hub: the support system, and the community of agents ---------------- */

function CardHead({ icon, title, sub, tag }: { icon: ReactNode; title: ReactNode; sub?: ReactNode; tag?: ReactNode }) {
  return (
    <header className="biz-card-head">
      <span className="biz-ico" aria-hidden="true">
        {icon}
      </span>
      <span className="biz-card-who">
        <b>{title}</b>
        {sub && <small>{sub}</small>}
      </span>
      {tag}
    </header>
  );
}

function Hub({ b, dispatch }: { b: Biz; dispatch: Dispatch<Action> }) {
  const slots = demoSlots(b);
  const rows = leaderboard(b);
  const rank = rows.findIndex(r => r.you) + 1;
  const nth = rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`;
  return (
    <div className="biz-cards ht-hub" aria-label="The hub">
      <div className="biz-card">
        <CardHead icon="🌱" title="Demo plots" sub={`${b.demos.length} of ${slots} running`} />
        <p>Farmers say yes more often when they can see a crop working. One plot per level.</p>
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
        <CardHead icon={<Face who="caro" size={32} />} title="Follow-up calls" sub="The hub team" />
        <p>We call every farmer you give a tip to inside the hub area. Outside it, only 1 in 4 say yes.</p>
      </div>
      <div className="biz-card ht-board">
        <CardHead icon="🏆" title="Agents’ leaderboard" sub={`Jobs kept · you are ${nth} of ${rows.length}`} />
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
        <p className="biz-card-note">Over 90%: one more farm a day. Under 60%: one fewer.</p>
      </div>
    </div>
  );
}

/* ---------------- the Calendar: Narok's year, the path to a tractor, and the Marketplace ---------------- */

const LEGEND: [Activity, string][] = [
  ['landprep', 'L'],
  ['planting', 'P'],
  ['fertilizer', 'F'],
  ['harvest', 'H'],
];

function Calendar({ b }: { b: Biz }) {
  const month = monthOf(b.day);
  const year = yearOf(b.day);
  const rig = tractorOf(b);
  const grad = graduation(b);
  const first = PAYG.tiers[0];
  return (
    <div className="ht-cal" aria-label="The calendar">
      <div className="biz-card ht-cal-year">
        <CardHead icon="🗓️" title="Narok’s farming year" sub="When each crop needs each job" />
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
                    {m ? rig.own ? <span className={`ht-util${util < PAYG.warn.utilization ? ' is-low' : ''}`} style={{ height: `${Math.min(100, util * 100)}%` }} /> : m.acres.toFixed(0) : ''}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
        <p className="ht-legend">
          {LEGEND.map(([a, l]) => (
            <span key={a}>
              <i className={`is-${a}`}>{l}</i> {JOB[a]}
            </span>
          ))}
          <span>Transport all year</span>
        </p>
      </div>
      <div className="ht-cal-side">
        <div className="biz-card">
          {rig.own ? (
            <>
              <CardHead icon={<TractorArt kind={rig.tractor} width={30} />} title={cap(rig.name)} sub={`${ksh(Math.max(0, rig.own.price - rig.own.paid))} left to pay`} />
              <p>{rig.own.warn ? `Warning ${rig.own.warn} of ${PAYG.warn.days}: take Marketplace jobs on quiet days.` : `Keep it busy: ${rig.capacity} acres a day, all year.`}</p>
              <span className="biz-bar" aria-hidden="true">
                <span style={{ width: `${Math.min(100, (rig.own.paid / rig.own.price) * 100)}%` }} />
              </span>
            </>
          ) : (
            <>
              <CardHead icon="🎯" title="Your own tractor" sub={`${Math.floor(b.counted)} of ${first.counted} counted acres`} />
              <span className="biz-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(2, Math.min(100, (b.counted / first.counted) * 100))}%` }} />
              </span>
              <p>Each job on an acre counts once. Book the whole season: prep, plant, feed, harvest.</p>
              {grad?.why && <p className="biz-card-note">Still needed: {grad.why}.</p>}
            </>
          )}
        </div>
        <div className="biz-card">
          <CardHead icon="🛒" title="Marketplace" sub={rig.own ? 'Jobs from other hubs show on Today' : 'Opens with your own tractor'} />
          <p>
            {HUBS.map((h, i) => (
              <span key={h.id} title={cap(h.note)}>
                {i > 0 && ' · '}
                {h.name.replace(' hub', '')}
              </span>
            ))}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- partners and the fleet ---------------- */

const PARTNER_ICON: Record<string, string> = { kimani: '🚜', coop: '🧑🏾‍🌾', fuel: '⛽', county: '🛣️', app: '📱' };

function Partners({ b, dispatch }: { b: Biz; dispatch: Dispatch<Action> }) {
  return (
    <div className="biz-cards" aria-label="Partners">
      {PARTNERS.map(p => {
        const block = partnerBlock(b, p.id);
        const signed = b.partners.includes(p.id);
        return (
          <div key={p.id} className={`biz-card${signed ? ' is-signed' : ''}`}>
            <CardHead icon={PARTNER_ICON[p.id] ?? '🤝'} title={p.name} sub={p.kind} />
            <p>{withMoney(p.does)}</p>
            <footer>
              {signed ? (
                <span className="biz-tag is-good">✓ Signed</span>
              ) : block ? (
                <span className="biz-tag">{block}</span>
              ) : (
                <button type="button" className="ach-claim" onClick={() => dispatch({ type: 'bizPartner', id: p.id })} aria-label={`Sign with ${p.name}`}>
                  {p.fee ? `Sign · ${ksh(p.fee)}` : 'Sign · free'}
                </button>
              )}
            </footer>
          </div>
        );
      })}
    </div>
  );
}

const SHOP_ICON: Record<string, string> = { ridger: '🥔', spreader: '🧪', planter: '🌱', harvester: '🌽', combine: '🌾' };

function Fleet({ b, dispatch }: { b: Biz; dispatch: Dispatch<Action> }) {
  const rig = tractorOf(b);
  return (
    <div className="biz-cards" aria-label="Fleet">
      <div className="biz-card is-signed is-wide">
        <CardHead
          icon={<TractorArt kind={rig.tractor} width={30} />}
          title={rig.own ? `${cap(rig.name)}${rig.own.paid >= rig.own.price ? ' · paid off' : ''}` : b.tractor === 'large' ? 'Hub tractor (large)' : 'Hub tractor (standard)'}
          sub={`${rig.capacity} acres a day${rig.own ? ` · ${ksh(rig.own.paid)} of ${ksh(rig.own.price)} paid` : ''}`}
        />
        <p>Tools: {b.tools.map(t => toolName(t)).join(', ')}.</p>
        <p className="biz-totals">
          {plural(b.day - 1, 'day')} · {b.acres.toFixed(1)} acres · {b.km.toFixed(0)} km · {plural(b.helped, 'farmer')}
        </p>
        {!rig.own && <p className="biz-card-note">By hand, an acre of ploughing costs a farmer about {ksh(handCost('plough', 1))}.</p>}
      </div>
      {SHOP.map(item => {
        const block = shopBlock(b, item.id);
        return (
          <div key={item.id} className={`biz-card${block === 'Owned' ? ' is-signed' : ''}`}>
            <CardHead
              icon={item.id === 'large' ? <TractorArt kind="large" width={30} /> : SHOP_ICON[item.id] ?? '⚙️'}
              title={
                <>
                  {item.name}
                  <Info term={item.id === 'large' ? 'large' : item.id === 'harvester' ? 'maizeH' : item.name} size={14} />
                </>
              }
              sub={item.id === 'large' ? 'Tractor' : item.id === 'combine' ? 'Its own machine' : 'Tool'}
            />
            <p>{item.does}</p>
            <footer>
              {block === 'Owned' ? (
                <span className="biz-tag is-good">✓ Owned</span>
              ) : block ? (
                <span className="biz-tag">{block}</span>
              ) : (
                <button type="button" className="ach-claim" onClick={() => dispatch({ type: 'bizBuy', item: item.id })} aria-label={`Buy ${item.name}`}>
                  Buy · {ksh(item.price)}
                </button>
              )}
            </footer>
          </div>
        );
      })}
    </div>
  );
}

/** What stands out about a farmer on a job: how urgent it is today (the player's own farm can make it more so) and
    whether they pay in full and on time. Only what needs attention is shown. */
function FarmerChips({ client, activity, signal }: { client: string; activity: Activity; signal: FarmSignal }) {
  const tr = traitsOf(client);
  const u = urgencyOf(client, activity, signal);
  return (
    <span className="biz-traits">
      {u >= 2 && (
        <i className={`is-u${u}`} title={u === 3 ? `Urgent: done today it pays ${Math.round(URGENT.premium * 100)}% more` : 'Needed this week'}>
          {u === 3 ? 'Urgent' : 'This week'}
        </i>
      )}
      {tr.pay < 1 && (
        <i className="is-warn" title="What they pay against the list hire">
          Pays {Math.round(tr.pay * 100)}%
        </i>
      )}
      {tr.pay > 1 && (
        <i className="is-good" title="What they pay against the list hire">
          Pays {Math.round(tr.pay * 100)}%
        </i>
      )}
      {tr.reliability < 0.85 && (
        <i className="is-warn" title="The share of what is owed they actually pay">
          Often pays late
        </i>
      )}
    </span>
  );
}

