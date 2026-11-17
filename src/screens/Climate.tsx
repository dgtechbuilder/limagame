import { useEffect, type Dispatch, type ReactNode } from 'react';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import {
  FACTORS,
  LEVELS,
  SOURCES,
  biggestSource,
  net,
  perBag,
  rating,
  waterProductivity,
  type ClimateEntry,
  type Footprint,
  type Where,
} from '../climate/model';
import { hasSolar } from '../climate/track';
import { TANK_LITRES } from '../data';
import { SponsorLine } from '../partners/ui';
import { LAND_FACTORS, LAND_PLOTS, PAY, areasOf, coinsFor, farmedShare, landOf, payRate, type AreaNow, type LandUse } from '../climate/land';
import { FARM_ACRES, FARM_SCALE } from '../farmSize';
import { payOf } from '../climate/model';
import { COLS } from '../world/field';
import { currency, fromUsd, money } from '../money';
import { FORECASTS } from '../trials/model';
import { WaterTab, CreditsTab } from '../water/WaterPanel';
import { capacityOf, tankOf, useToday } from '../water/model';
import { WATER } from '../water/config';
import { ledgerOf } from '../credits/ledger';
import type { Action, ClimateTab, GameState } from '../state';

/* The Climate page: everything the game tracks about the climate, in seven sections. Overview (rating, level,
   credits, the key figures), Land & pay (land farmed, bare and idle today, and the daily payments for credits), Farm areas (every area evaluated:
   the six farms, Farm Moja, the forest, the pen, the animals, the pond, the homestead),
   Emissions (by source, by season), Water & soil, Climate shocks, and Activity (each recorded job). Opened from the CLIMATE button on the farm, or the main menu. */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: ClimateTab };

const TABS: { id: ClimateTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'land', label: 'Land & pay', icon: '🌱' },
  { id: 'areas', label: 'Farm areas', icon: '🗺' },
  { id: 'emissions', label: 'Emissions', icon: '☁' },
  { id: 'tank', label: 'Water', icon: '🛢' },
  { id: 'credits', label: 'Credits', icon: '★' },
  { id: 'water', label: 'Water & soil', icon: '💧' },
  { id: 'shocks', label: 'Climate shocks', icon: '⚡' },
  { id: 'activity', label: 'Activity', icon: '≡' },
];

/* ---------------- formatting ---------------- */

const num = (n: number, dp = 0) => n.toLocaleString('en-US', { maximumFractionDigits: dp, minimumFractionDigits: 0 });
/** kg with a sensible precision */
export const kg = (n: number) => `${num(n, Math.abs(n) < 10 ? 1 : 0)} kg`;
export const litres = (n: number) => (n >= 10000 ? `${num(n / 1000, n >= 100000 ? 0 : 1)}k L` : `${num(n)} L`);
const signed = (n: number, dp = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n), dp)}`;

const GRADE_INK: Record<string, string> = { A: '#2e8b47', B: '#6aa336', C: '#c9921c', D: '#d9752b', E: '#c0432f' };

/* ---------------- pieces ---------------- */

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`cl-tile${tone ? ` is-${tone}` : ''}`}>
      <p className="cl-tile-label">{label}</p>
      <p className="cl-tile-value">{value}</p>
      {sub && <p className="cl-tile-sub">{sub}</p>}
    </div>
  );
}

/** A single-series horizontal bar chart: one row per item, the value written at the bar's end. */
function Bars({ rows, unit, label }: { rows: { name: string; value: number; note?: string }[]; unit: (n: number) => string; label: string }) {
  const max = Math.max(1e-9, ...rows.map(r => Math.abs(r.value)));
  return (
    <div className="cl-bars" role="table" aria-label={label}>
      {rows.map(r => (
        <div key={r.name} className="cl-bar-row" role="row" title={`${r.name}: ${unit(r.value)}${r.note ? ` · ${r.note}` : ''}`}>
          <span className="cl-bar-name" role="rowheader">
            {r.name}
          </span>
          <span className="cl-bar-track" role="cell">
            <span className="cl-bar" style={{ width: `${(Math.abs(r.value) / max) * 100}%` }} />
            <b className="cl-bar-value">{unit(r.value)}</b>
          </span>
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="cl-empty">{children}</p>;
}

/* ---------------- the page ---------------- */

export function ClimatePage({ s, dispatch, tab: startTab }: Props) {
  // the tab is part of the address (#/climate/emissions), so it lives in the game state
  const tab: ClimateTab = startTab ?? 'overview';
  const setTab = (t: ClimateTab) => dispatch({ type: 'open', modal: { kind: 'climate', tab: t } });
  const close = () => dispatch({ type: 'close' });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'close' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <div className="abs settings-page climate-page" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Climate">
      <div className="scrim" onClick={close} />
      <div className="fs-panel set-panel" style={{ left: 24, top: 46, width: 826, height: 334 }}>
        <nav className="set-tabs cl-tabs" aria-label="Climate sections">
          <p className="set-heading">Climate</p>
          {TABS.map(t => (
            <button key={t.id} type="button" className={`set-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <i aria-hidden="true">{t.icon}</i>
              {t.label}
            </button>
          ))}
          <p className="set-foot">
            Estimates for learning, not a certified carbon count.
            <br />1 credit = {FACTORS.credit.value} kg CO₂e kept out of the air
          </p>
        </nav>
        <section className="set-content cl-content" aria-label={TABS.find(t => t.id === tab)!.label}>
          {tab === 'overview' && <Overview s={s} go={setTab} />}
          {tab === 'land' && <LandPay s={s} dispatch={dispatch} />}
          {tab === 'areas' && <Areas s={s} />}
          {tab === 'emissions' && <Emissions s={s} />}
          {tab === 'water' && <WaterSoil s={s} />}
          {tab === 'tank' && <WaterTab s={s} dispatch={dispatch} />}
          {tab === 'credits' && <CreditsTab s={s} />}
          {tab === 'shocks' && <Shocks s={s} dispatch={dispatch} />}
          {tab === 'activity' && <Activity s={s} />}
        </section>
      </div>
      <NavBar horizontal onBack={close} hideHome={s.fs.phase !== 'done'} style={{ right: 62, top: 8 }} />
      <CloseX className="page-x" onClick={close} />
      <p className="set-title-bar">
        <span aria-hidden="true">🌍</span> Climate · <b>{TABS.find(t => t.id === tab)!.label}</b>
      </p>
    </div>
  );
}

/* ---------------- Overview ---------------- */

function Overview({ s, go }: { s: GameState; go: (t: ClimateTab) => void }) {
  const c = s.climate;
  const t = c.total;
  const r = rating(t);
  const lvl = LEVELS[c.level];
  const nextL = LEVELS[c.level + 1];
  const into = nextL ? (c.credits - lvl.credits) / (nextL.credits - lvl.credits) : 1;
  const bag = perBag(t);
  const wp = waterProductivity(t);
  const top = biggestSource(c);
  const started = c.log.length > 0;
  return (
    <div className="cl-overview">
      <div className="cl-head">
        <div className="cl-grade" aria-label={r ? `Climate rating ${r.grade}, ${r.score} out of 100` : 'Climate rating: after your first harvest'}>
          <span className="cl-grade-letter" style={{ background: r ? GRADE_INK[r.grade] : '#b9a58c' }}>{r ? r.grade : '–'}</span>
          <span>
            <b>Climate rating</b>
            <small>{r ? `${r.score}/100 · emissions, pollution, food lost and soil, per bag grown` : 'Shows after your first harvest'}</small>
          </span>
        </div>
        <div className="cl-level">
          <p>
            <b>{lvl.name}</b> · {num(c.credits, 1)} credits
          </p>
          <span className="cl-meter" role="progressbar" aria-label="Credits to the next climate level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(into * 100)}>
            <span style={{ width: `${Math.max(3, into * 100)}%` }} />
          </span>
          <small>{nextL ? `${num(nextL.credits - c.credits, 1)} credits to ${nextL.name} (+${nextL.points} points)` : 'Top level reached'}</small>
          <small>
            Paid {money(payOf(c).paid)} ·{' '}
            <button type="button" className="set-link cl-inline" onClick={() => go('land')}>
              Land &amp; pay
            </button>
          </small>
        </div>
        <div className="cl-net">
          <small>Net emissions</small>
          <b>{kg(net(t))}</b>
          <small>CO₂e: {kg(t.co2)} out, {kg(t.stored)} stored</small>
        </div>
      </div>

      <div className="cl-tiles">
        <Tile label="Emissions" value={kg(t.co2)} sub={`This season ${kg(c.season.co2)}`} />
        <Tile label="Carbon stored" value={kg(t.stored)} sub="Mulch, manure, beans" tone={t.stored > 0 ? 'good' : undefined} />
        <Tile label="Water used" value={litres(t.water)} sub={`This season ${litres(c.season.water)}`} />
        <Tile label="Pollution" value={num(t.pollution)} sub={`${num(t.sprays)} sprays · ${kg(t.fertN)} N`} tone={t.pollution > 40 * FARM_SCALE ? 'bad' : undefined} />
        <Tile label="Soil health" value={signed(t.soil)} sub={t.soil >= 0 ? 'Getting richer' : 'Wearing out'} tone={t.soil > 0 ? 'good' : t.soil < 0 ? 'bad' : undefined} />
        <Tile label="Diesel" value={`${num(t.diesel, 1)} L`} sub={c.drives.n ? `Drives: ${Math.round(c.drives.clim / c.drives.n)}/100 climate` : 'No tractor drives yet'} />
        <Tile label="Food lost" value={kg(t.foodLoss)} sub={`of ${kg(t.yieldKg + t.foodLoss)} grown`} tone={t.foodLoss > 0.1 * (t.yieldKg + t.foodLoss) ? 'bad' : undefined} />
        <Tile label="Efficiency" value={bag === null ? '–' : `${num(bag, 1)} kg`} sub={bag === null ? 'CO₂e per bag, after harvest' : `CO₂e per bag${wp ? ` · ${num(wp)} kg food/1,000 L` : ''}`} />
      </div>

      <p className="cl-tip">
        {!started ? (
          <>Every job you do is tracked here. Plant the six farms or do a Farm Moja task to start.</>
        ) : top ? (
          <>
            <b>Biggest source: {top.label.toLowerCase()} ({kg(top.kg)}).</b> {top.fix}{' '}
            <button type="button" className="set-link cl-more" onClick={() => go('emissions')}>
              See all sources
            </button>
          </>
        ) : (
          <>No emissions yet.</>
        )}
      </p>
    </div>
  );
}

/* ---------------- Land & pay ---------------- */

const USE_WORD: Record<LandUse, string> = { farmed: 'Farmed', bare: 'Bare', idle: 'Idle' };

function LandPay({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const c = s.climate;
  const pay = payOf(c);
  const l = landOf(s);
  const share = farmedShare(l);
  const areas = areasOf(s);
  const areaCredits = areas.reduce((n, a) => n + a.credits, 0);
  const forest = areas.find(a => a.id === 'forest')!;
  // today so far: the work's credits since the last payment, and every area's for a whole day
  const work = Math.max(0, c.credits - pay.creditsAt);
  const due = work + areaCredits;
  const rate = payRate(c.level);
  const pd = pay.plotDays;
  const allDays = pd.farmed + pd.bare + pd.idle;
  return (
    <div className="cl-two">
      <div>
        <p className="set-title">Land today</p>
        <p className="set-body">
          Six {FARM_ACRES}-acre farms, {LAND_PLOTS} plots. Crops store carbon daily; bare ground loses it; idle earns nothing. The forest stores {kg(forest.stored)} a
          day.
        </p>
        <div className="cl-land" role="img" aria-label={`Land today: ${l.farmed} plots farmed, ${l.bare} bare, ${l.idle} idle`}>
          {l.farms.map(f => (
            <div key={f.farm} className="cl-land-farm" title={`Farm ${f.farm + 1}${f.practices.length ? ` · ${f.practices.join(', ')}` : ''}${f.rate ? ` · ${num(f.rate, 1)} kg CO₂ an acre a day` : ''}`}>
              <span className="cl-land-grid" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                {f.uses.map((u, i) => (
                  <i key={i} className={`is-${u}`} />
                ))}
              </span>
              <small>Farm {f.farm + 1}</small>
            </div>
          ))}
        </div>
        <p className="cl-land-key" aria-hidden="true">
          {(['farmed', 'bare', 'idle'] as LandUse[]).map(u => (
            <span key={u}>
              <i className={`is-${u}`} />
              {USE_WORD[u]}
            </span>
          ))}
        </p>
        <div className="cl-tiles is-three">
          <Tile label={USE_WORD.farmed} value={`${l.farmed}`} sub={`${Math.round(share * 100)}% · +${kg(l.stored)} CO₂ a day`} tone={l.farmed ? 'good' : undefined} />
          <Tile label={USE_WORD.bare} value={`${l.bare}`} sub={l.bare ? `−${kg(l.lost)} CO₂ a day: plant it` : 'None: good'} tone={l.bare ? 'bad' : undefined} />
          <Tile label={USE_WORD.idle} value={`${l.idle}`} sub="No food, no credits" />
        </div>
        <p className="set-body cl-note">
          A farmed acre stores {LAND_FACTORS.farmed.value} kg CO₂ a day (more with mulch, beans, manure); a bare acre loses {LAND_FACTORS.bare.value} kg.
          {allDays > 0 && (
            <>
              {' '}
              All time: {num((100 * pd.farmed) / allDays)}% of plot-days farmed, {kg(pay.landKg.stored)} stored, {kg(pay.landKg.lost)} lost.
            </>
          )}
        </p>
      </div>
      <div>
        <p className="set-title">Daily payments</p>
        <p className="set-body">
          Each night, the day’s credits are paid to you in {currency().name}.
        </p>
        <div className="cl-tiles is-three" style={{ marginTop: 6 }}>
          <Tile label="Credits today" value={num(due, 1)} sub={`About ${money(coinsFor(due, c.level))} tonight`} tone={due > 0 ? 'good' : undefined} />
          <Tile label="A credit pays" value={money(rate)} sub={rate > PAY.perCredit ? `${LEVELS[c.level].name} premium` : `${money(fromUsd(25))} a tonne · more at higher levels`} />
          <Tile label="Paid in all" value={money(pay.paid)} sub={`for ${num(pay.creditsPaid, 1)} credits`} tone={pay.paid > 0 ? 'good' : undefined} />
        </div>
        {pay.payments.length ? (
          <ol className="cl-log cl-pay" aria-label="Payments, newest first">
            {pay.payments.slice(0, 6).map(p => (
              <li key={p.id}>
                <span className="cl-where">{p.label}</span>
                <span className="cl-log-text">
                  <b>+{money(p.coins)}</b>
                  <small>
                    {num(p.credits, 1)} credits ({num(p.landCredits, 1)} land, {num(p.workCredits, 1)} work) · {p.farmed} farmed, {p.bare} bare, {p.idle} idle plots
                  </small>
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <Empty>{pay.day ? 'Your first payment comes at the end of today.' : 'Payments start once your farm is open.'}</Empty>
        )}
        <button type="button" className="set-link" onClick={() => dispatch({ type: 'open', modal: { kind: 'wallet', tab: 'climate' } })}>
          Every payment, in your wallet ›
        </button>
      </div>
    </div>
  );
}

/* ---------------- Farm areas ---------------- */

const TONE_WORD = { good: 'Helping', bad: 'Watch', none: 'Steady' } as const;

function Areas({ s }: { s: GameState }) {
  const areas = areasOf(s);
  const totals = payOf(s.climate).areas ?? {};
  const em = (a: AreaNow) => Object.values(a.emit).reduce((n: number, v) => n + (v ?? 0), 0);
  const stored = areas.reduce((n, a) => n + a.stored, 0);
  const out = areas.reduce((n, a) => n + em(a), 0);
  const water = areas.reduce((n, a) => n + a.water, 0);
  const credits = areas.reduce((n, a) => n + a.credits, 0);
  return (
    <div className="cl-rows">
      <div className="cl-tiles">
        <Tile label="Stored a day" value={kg(stored)} sub="Forest, crops, grass" tone="good" />
        <Tile label="Emitted a day" value={kg(out)} sub="Animals, cooking, bare soil" tone={out > stored ? 'bad' : undefined} />
        <Tile label="Water drawn a day" value={litres(water)} sub="Animals and the house" />
        <Tile label="Credits a day" value={num(credits, 1)} sub={`About ${money(coinsFor(credits, s.climate.level))} a day`} tone={credits > 0 ? 'good' : undefined} />
      </div>
      <table className="cl-areas" aria-label="Every area of the farm, today">
        <thead>
          <tr>
            <th scope="col">Area</th>
            <th scope="col">Today</th>
            <th scope="col">CO₂ a day</th>
            <th scope="col">All time</th>
            <th scope="col">How it is doing</th>
          </tr>
        </thead>
        <tbody>
          {areas.map(a => {
            const t = totals[a.id];
            const netDay = a.stored - em(a);
            return (
              <tr key={a.id} className={`is-${a.tone}`}>
                <th scope="row">
                  <span aria-hidden="true">{a.icon}</span> {a.name}
                  <small>{a.size}</small>
                </th>
                <td>
                  {a.use}
                  {a.water > 0 && <small>{litres(a.water)} water a day</small>}
                </td>
                <td className="cl-num">
                  {a.stored || em(a) ? `${netDay >= 0 ? '+' : '−'}${kg(Math.abs(netDay))}` : '–'}
                  <small>{a.stored && em(a) ? 'net' : a.stored ? 'stored' : em(a) ? 'emitted' : ''}</small>
                </td>
                <td className="cl-num">
                  {t ? `${t.stored - t.emitted >= 0 ? '+' : '−'}${kg(Math.abs(t.stored - t.emitted))}` : '–'}
                </td>
                <td>
                  <b className="cl-tone">{TONE_WORD[a.tone]}</b> {a.note}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- Emissions ---------------- */

function Emissions({ s }: { s: GameState }) {
  const c = s.climate;
  const rows = SOURCES.map(x => ({ name: x.label, value: c.co2By[x.id] ?? 0, note: x.fix })).filter(r => r.value > 0);
  const cycles = [...c.cycles.slice(-5), ...(c.log.length && (c.season.co2 || c.season.stored) ? [{ label: 'This season so far', f: c.season, credits: c.seasonCredits }] : [])];
  return (
    <div className="cl-two">
      <div>
        <p className="set-title">By source, all time</p>
        <p className="set-body">kg of CO₂e (all gases, counted as CO₂).</p>
        {rows.length ? <Bars label="Emissions by source" rows={rows.sort((a, b) => b.value - a.value)} unit={kg} /> : <Empty>Nothing burned or applied yet.</Empty>}
        <p className="set-body cl-note">
          Stored in the soil: <b>{kg(c.total.stored)}</b>. Net: <b>{kg(net(c.total))}</b>.
        </p>
      </div>
      <div>
        <p className="set-title">Net emissions by season</p>
        <p className="set-body">Each finished season or cycle, with kg CO₂e per bag.</p>
        {cycles.length ? (
          <Bars
            label="Net emissions by season"
            rows={cycles.map((x: { label: string; f: Footprint }) => {
              const b = perBag(x.f);
              return { name: x.label, value: net(x.f), note: b === null ? undefined : `${num(b, 1)} kg per bag` };
            })}
            unit={kg}
          />
        ) : (
          <Empty>Your first harvest closes the first season here.</Empty>
        )}
      </div>
    </div>
  );
}

/* ---------------- Water & soil ---------------- */

function WaterSoil({ s }: { s: GameState }) {
  const t = s.climate.total;
  const wp = waterProductivity(t);
  const solar = hasSolar(s);
  const tanks = s.inventory.reduce((n, i) => n + (TANK_LITRES[i] ?? 0), 0);
  const tank = tankOf(s.tank);
  const cap = capacityOf(s);
  const today = useToday(s);
  const days = tank.days.slice(0, 7);
  const week = days.reduce((n, d) => n + d.house + d.animals + d.farms - d.short, 0);
  const credits = ledgerOf(s.ledger);
  return (
    <div className="cl-two">
      <div>
        <p className="set-title">Water</p>
        <div className="cl-tiles is-two">
          <Tile label="The tank now" value={`${litres(tank.level)} of ${litres(cap)}`} sub={tank.level < cap * WATER.tank.low ? 'Low: buy water in Water' : 'Rain off the roofs fills it'} tone={tank.level < cap * WATER.tank.low ? 'bad' : 'good'} />
          <Tile label="Used today" value={litres(today.total)} sub={`House ${litres(today.house)} · animals ${litres(today.animals)} · rows ${litres(today.farms)}`} />
          <Tile label="Last 7 days" value={days.length ? litres(week) : '–'} sub={days.length ? `${days.filter(d => d.short > 0).length} day(s) the tank ran dry` : 'Counted from tonight'} />
          <Tile label="Water credits" value={num(credits.paid.water, 1)} sub={`Under the ${WATER.credits.baseline} L baseline · ${money(credits.coins.water)} paid`} tone={credits.paid.water > 0 ? 'good' : undefined} />
          <Tile label="Irrigation, all time" value={litres(t.water)} sub={`On top of the rain · ${wp ? `${kg(wp)} of food a 1,000 L` : 'food a 1,000 L after a harvest'}${tanks ? ` · tanks bought ${litres(tanks)}` : ''}`} />
          <Tile label="Pumps" value={solar ? 'Solar' : 'Petrol'} sub={solar ? 'Clean pumping, cold store and mill' : 'Redeem the solar discount in Rewards'} tone={solar ? 'good' : undefined} />
        </div>
        <p className="set-body cl-note">Maize needs about 35 L/m² a week in all. Over 50 waterlogs roots and washes fertilizer away.</p>
      </div>
      <div>
        <p className="set-title">Pollution and soil</p>
        <div className="cl-tiles is-two">
          <Tile label="Pollution" value={num(t.pollution)} sub="Chemicals, runoff, exhaust" tone={t.pollution > 40 * FARM_SCALE ? 'bad' : undefined} />
          <Tile label="Sprays" value={num(t.sprays)} sub="Pesticide and herbicide applications" />
          <Tile label="Synthetic nitrogen" value={kg(t.fertN)} sub={`About ${kg(t.fertN * FACTORS.nitrogen.value)} CO₂e`} />
          <Tile label="Soil health" value={signed(t.soil)} sub="Mulch, manure, beans: up · bare soil, compaction: down" tone={t.soil > 0 ? 'good' : t.soil < 0 ? 'bad' : undefined} />
        </div>
        <p className="set-body cl-note">Check and treat instead of weekly spraying; hand weeding keeps herbicide out.</p>
      </div>
    </div>
  );
}

/* ---------------- Climate shocks ---------------- */

function Shocks({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const sh = s.climate.shocks;
  const f = s.trial?.forecast;
  return (
    <div className="cl-rows">
      <div className="cl-tiles is-three">
        <Tile label="Shocks met" value={num(sh.met)} sub="Drought, flood, hail on a farm" />
        <Tile label="Read right" value={num(sh.handled)} sub="Caught in time" tone={sh.handled ? 'good' : undefined} />
        <Tile label="Handled" value={sh.met ? `${Math.round((100 * sh.handled) / sh.met)}%` : '–'} sub="Of the shocks met" />
      </div>
      <p className="set-title" style={{ marginTop: 12 }}>
        This cycle's rain
      </p>
      <p className="set-body" style={{ maxWidth: 'none' }}>
        {f ? `${FORECASTS[f].label}.` : 'Plan the six farms to see the forecast.'} More dry spells, storms and hail are coming: spot them on field checks.
      </p>
      <ul className="cl-list">
        <li>
          <b>Drought:</b> mulch, and a rainwater tank for dry spells.
        </li>
        <li>
          <b>Flood:</b> dig drains; don’t water after heavy rain.
        </li>
        <li>
          <b>Hail:</b> beans and healthy soil help recovery.
        </li>
        <li>
          <b>Crop cover:</b> insurance so one bad season doesn’t end the farm.
        </li>
      </ul>
      <SponsorLine slot="climate" label="Crop cover with" dispatch={dispatch} style={{ marginTop: 8 }} />
    </div>
  );
}

/* ---------------- Activity ---------------- */

const WHERE: Record<Where, string> = { season: 'Farm Moja', farms: 'Six farms', field: 'Field work', tractor: 'Tractor', market: 'Market', checks: 'Checks', land: 'Farm areas' };

function Activity({ s }: { s: GameState }) {
  const log = s.climate.log;
  if (!log.length) return <Empty>Nothing tracked yet. Your jobs will show here.</Empty>;
  const bits = (e: ClimateEntry) =>
    [
      e.co2 ? `${signed(e.co2)} kg CO₂e` : '',
      e.d.stored ? `${num(e.d.stored, 1)} kg stored` : '',
      e.d.water ? litres(e.d.water) : '',
      e.d.pollution ? `pollution ${signed(e.d.pollution)}` : '',
      e.d.soil ? `soil ${signed(e.d.soil)}` : '',
      e.d.yieldKg ? `${kg(e.d.yieldKg)} grown` : '',
      e.d.foodLoss ? `${kg(e.d.foodLoss)} lost` : '',
      e.credits ? `+${num(e.credits, 1)} credits` : '',
    ].filter(Boolean);
  return (
    <ol className="cl-log" aria-label="Tracked jobs, newest first">
      {log.map(e => (
        <li key={e.id}>
          <span className="cl-where">{WHERE[e.where]}</span>
          <span className="cl-log-text">
            <b>{e.label}</b>
            <small>{bits(e).join(' · ')}</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
