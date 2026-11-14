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
import { FORECASTS } from '../trials/model';
import type { Action, ClimateTab, GameState } from '../state';

/* The Climate page: everything the game tracks about the climate, in five sections. Overview (rating, level,
   credits, the key figures), Emissions (by source, by season), Water & soil, Climate shocks, and Activity (each
   recorded job). Opened from the CLIMATE button on the farm, or the main menu. */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: ClimateTab };

const TABS: { id: ClimateTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'emissions', label: 'Emissions', icon: '☁' },
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
      <div className="fs-panel set-panel" style={{ left: 18, top: 40, width: 838, height: 348 }}>
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
          {tab === 'emissions' && <Emissions s={s} />}
          {tab === 'water' && <WaterSoil s={s} />}
          {tab === 'shocks' && <Shocks s={s} />}
          {tab === 'activity' && <Activity s={s} />}
        </section>
      </div>
      <NavBar horizontal onBack={close} hideHome={s.fs.phase !== 'done'} style={{ right: 44, top: 6 }} />
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
        <Tile label="Pollution" value={num(t.pollution)} sub={`${num(t.sprays)} sprays · ${kg(t.fertN)} N`} tone={t.pollution > 40 ? 'bad' : undefined} />
        <Tile label="Soil health" value={signed(t.soil)} sub={t.soil >= 0 ? 'Getting richer' : 'Wearing out'} tone={t.soil > 0 ? 'good' : t.soil < 0 ? 'bad' : undefined} />
        <Tile label="Diesel" value={`${num(t.diesel, 1)} L`} sub={c.drives.n ? `Drives: ${Math.round(c.drives.clim / c.drives.n)}/100 climate` : 'No tractor drives yet'} />
        <Tile label="Food lost" value={kg(t.foodLoss)} sub={`of ${kg(t.yieldKg + t.foodLoss)} grown`} tone={t.foodLoss > 0.1 * (t.yieldKg + t.foodLoss) ? 'bad' : undefined} />
        <Tile label="Efficiency" value={bag === null ? '–' : `${num(bag, 1)} kg`} sub={bag === null ? 'CO₂e per bag, after harvest' : `CO₂e per bag${wp ? ` · ${num(wp)} kg food/1,000 L` : ''}`} />
      </div>

      <p className="cl-tip">
        {!started ? (
          <>Every job you do is tracked here: fertilizer, diesel, sprays, water, storage and the trip to market. Plant the six farms or do a Farm Moja task to start.</>
        ) : top ? (
          <>
            <b>Biggest source: {top.label.toLowerCase()} ({kg(top.kg)}).</b> {top.fix}{' '}
            <button type="button" className="set-link cl-more" onClick={() => go('emissions')}>
              See all sources
            </button>
          </>
        ) : (
          <>No emissions yet: everything so far was done by hand or stored carbon.</>
        )}
      </p>
    </div>
  );
}

/* ---------------- Emissions ---------------- */

function Emissions({ s }: { s: GameState }) {
  const c = s.climate;
  const rows = SOURCES.map(x => ({ name: x.label, value: c.co2By[x.id], note: x.fix })).filter(r => r.value > 0);
  const cycles = [...c.cycles.slice(-5), ...(c.log.length && (c.season.co2 || c.season.stored) ? [{ label: 'This season so far', f: c.season, credits: c.seasonCredits }] : [])];
  return (
    <div className="cl-two">
      <div>
        <p className="set-title">By source, all time</p>
        <p className="set-body">kg of CO₂e (carbon dioxide and the other gases, counted as CO₂).</p>
        {rows.length ? <Bars label="Emissions by source" rows={rows.sort((a, b) => b.value - a.value)} unit={kg} /> : <Empty>Nothing burned or applied yet.</Empty>}
        <p className="set-body cl-note">
          Stored in the soil: <b>{kg(c.total.stored)}</b>. Net: <b>{kg(net(c.total))}</b>.
        </p>
      </div>
      <div>
        <p className="set-title">Net emissions by season</p>
        <p className="set-body">Each finished season or cycle of the six farms, and kg CO₂e per bag grown.</p>
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
  const tanks = s.inventory.filter(i => i.startsWith('tank-')).reduce((n, i) => n + ({ 'tank-s': 1000, 'tank-m': 5000, 'tank-l': 10000 }[i] ?? 0), 0);
  return (
    <div className="cl-two">
      <div>
        <p className="set-title">Water</p>
        <div className="cl-tiles is-two">
          <Tile label="Used, all time" value={litres(t.water)} sub="On top of the rain" />
          <Tile label="Food per 1,000 L" value={wp ? kg(wp) : '–'} sub="Higher is better" />
          <Tile label="Rainwater tanks" value={tanks ? litres(tanks) : 'None'} sub="Buy in the Shop: they carry a dry spell" tone={tanks ? 'good' : undefined} />
          <Tile label="Pumps" value={solar ? 'Solar' : 'Petrol'} sub={solar ? 'Clean pumping, cold store and mill' : 'Redeem the solar discount in Rewards'} tone={solar ? 'good' : undefined} />
        </div>
        <p className="set-body cl-note">Maize needs about 35 L/m² a week, rain and watering together. More than 50 waterlogs the roots and washes fertilizer into streams.</p>
      </div>
      <div>
        <p className="set-title">Pollution and soil</p>
        <div className="cl-tiles is-two">
          <Tile label="Pollution" value={num(t.pollution)} sub="Chemicals, runoff, exhaust" tone={t.pollution > 40 ? 'bad' : undefined} />
          <Tile label="Sprays" value={num(t.sprays)} sub="Pesticide and herbicide applications" />
          <Tile label="Synthetic nitrogen" value={kg(t.fertN)} sub={`About ${kg(t.fertN * FACTORS.nitrogen.value)} CO₂e`} />
          <Tile label="Soil health" value={signed(t.soil)} sub="Mulch, manure, beans: up · bare soil, compaction: down" tone={t.soil > 0 ? 'good' : t.soil < 0 ? 'bad' : undefined} />
        </div>
        <p className="set-body cl-note">Check and treat instead of spraying every week; weeding by hand keeps herbicide out of the soil.</p>
      </div>
    </div>
  );
}

/* ---------------- Climate shocks ---------------- */

function Shocks({ s }: { s: GameState }) {
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
        {f ? `${FORECASTS[f].label}.` : 'Plan the six farms to see the forecast.'} A changing climate brings more dry spells, heavier storms and hail. Each is a problem
        you can spot on the field checks.
      </p>
      <ul className="cl-list">
        <li>
          <b>Drought:</b> mulch keeps water in the soil; a rainwater tank carries the crop through a dry spell.
        </li>
        <li>
          <b>Flood:</b> dig drains and do not water on top of heavy rain.
        </li>
        <li>
          <b>Hail:</b> beans between the rows and a healthy soil help a crop recover.
        </li>
      </ul>
    </div>
  );
}

/* ---------------- Activity ---------------- */

const WHERE: Record<Where, string> = { season: 'Farm Moja', farms: 'Six farms', field: 'Field work', tractor: 'Tractor', market: 'Market', checks: 'Checks' };

function Activity({ s }: { s: GameState }) {
  const log = s.climate.log;
  if (!log.length) return <Empty>Nothing tracked yet. Every job you do will show here with what it did to the climate.</Empty>;
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
