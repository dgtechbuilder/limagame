import type { Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { money } from '../money';
import { achClock } from '../achievements/track';
import type { Action, GameState, TrackingTab } from '../state';
import { ScoreRing, PartBars } from './Score';
import { PARTS, animalFigures, bandOf, climateFigures, landFigures, moneyFigures, powerFigures, sustainability, waterFigures, weakest } from './model';

/* Tracking: how successful the farm is, in one page. The sustainability score out of 100 and what it is made of,
   then a section for each thing worth watching: climate, water, soil and inputs, power, money (expenses against the
   harvest), the harvests themselves, and the animals and security. Every figure comes from tracking/model.ts. */

const TABS: { id: TrackingTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'sustainability', label: 'Sustainability', icon: '🌱' },
  { id: 'climate', label: 'Climate', icon: '🌍' },
  { id: 'water', label: 'Water', icon: '💧' },
  { id: 'soil', label: 'Soil', icon: '🪱' },
  { id: 'power', label: 'Power', icon: '⚡' },
  { id: 'money', label: 'Profit', icon: '💰' },
  { id: 'harvest', label: 'Harvests', icon: '🌽' },
  { id: 'animals', label: 'Animals', icon: '🐄' },
];

const kg = (n: number) => `${Math.round(n).toLocaleString('en-US')} kg`;
const litres = (n: number) => `${Math.round(n).toLocaleString('en-US')} L`;
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;

export function TrackingPage({ s, dispatch, tab = 'overview' }: { s: GameState; dispatch: Dispatch<Action>; tab?: TrackingTab }) {
  const setTab = (t: TrackingTab) => dispatch({ type: 'open', modal: { kind: 'tracking', tab: t } });
  const sus = sustainability(s, achClock.today());
  const band = bandOf(sus.score);
  return (
    <Page title="Tracking" icon="📈" tabs={TABS} tab={tab} onTab={setTab} dispatch={dispatch} className="tracking-page" foot={<>Sustainability: <b>{sus.score}/100</b> · {band.word}</>}>
      {tab === 'overview' && <Overview s={s} sus={sus} setTab={setTab} />}
      {tab === 'sustainability' && <Sustain sus={sus} />}
      {tab === 'climate' && <Climate s={s} />}
      {tab === 'water' && <Water s={s} />}
      {tab === 'soil' && <Soil s={s} />}
      {tab === 'power' && <Power s={s} />}
      {tab === 'money' && <Money s={s} />}
      {tab === 'harvest' && <Harvest s={s} />}
      {tab === 'animals' && <Animals s={s} />}
    </Page>
  );
}

type Sus = ReturnType<typeof sustainability>;

function Overview({ s, sus, setTab }: { s: GameState; sus: Sus; setTab: (t: TrackingTab) => void }) {
  const band = bandOf(sus.score);
  const c = climateFigures(s);
  const w = waterFigures(s);
  const p = powerFigures(s);
  const m = moneyFigures(s);
  const next = weakest(sus.parts, 2);
  return (
    <>
      <div className="sus-head">
        <ScoreRing score={sus.score} />
        <span className="sus-head-text">
          <b>
            Sustainability score: {sus.score}/100 · <span className={`sus-word is-${band.tone}`}>{band.word}</span>
          </b>
          <small>How well the farm can keep going: its climate, water, soil, power, chemicals, practices, money and animals, together.</small>
          {next.length > 0 && (
            <small>
              To raise it: <b>{next[0].tip}</b>
            </small>
          )}
          <button type="button" className="tc-link" onClick={() => setTab('sustainability')}>
            See every part of the score
          </button>
        </span>
      </div>
      <div className="pg-tiles">
        <Tile label="Climate rating" value={c.rating ? `${c.rating.grade} · ${c.rating.score}` : '—'} sub={c.rating ? `${Math.round(c.perBag ?? 0)} kg CO₂e a bag` : 'after the first harvest'} tone={c.rating ? (c.rating.score >= 70 ? 'good' : c.rating.score < 55 ? 'bad' : undefined) : undefined} />
        <Tile label="Water from rain" value={w.used ? pct(Math.min(1, w.rain / w.used)) : '—'} sub={w.days ? `${w.dryDays} dry day${w.dryDays === 1 ? '' : 's'} in ${w.days}` : 'no days yet'} tone={w.dryDays ? 'bad' : undefined} />
        <Tile label="Solar share" value={pct(p.solarShare)} sub={`${p.parts}/${p.partsAll} power parts built`} tone={p.solarShare !== null && p.solarShare >= 0.8 ? 'good' : undefined} />
        <Tile label="Farm profit" value={signed(m.profit)} sub={m.margin !== null ? `${pct(m.margin)} margin` : 'nothing sold yet'} tone={m.profit >= 0 ? 'good' : 'bad'} />
      </div>
      <div className="pg-tiles">
        <Tile label="Harvest income" value={money(m.harvestIn)} sub="harvests and the stall" />
        <Tile label="Expenses" value={money(m.expenses)} sub="inputs, water, animals, power, tractor" />
        <Tile label="Return on inputs" value={m.harvestReturn === null ? '—' : `${m.harvestReturn.toFixed(1)}×`} sub="harvest money per unit spent on seed, inputs, water" tone={m.harvestReturn === null ? undefined : m.harvestReturn >= 1 ? 'good' : 'bad'} />
        <Tile label="Climate credits" value={Math.round(c.credits).toLocaleString('en-US')} sub={`${kg(c.stored)} CO₂ kept`} tone="good" />
      </div>
    </>
  );
}

function Sustain({ sus }: { sus: Sus }) {
  const band = bandOf(sus.score);
  const next = weakest(sus.parts);
  return (
    <>
      <div className="sus-head">
        <ScoreRing score={sus.score} size={70} />
        <span className="sus-head-text">
          <b>
            {sus.score}/100 · <span className={`sus-word is-${band.tone}`}>{band.word}</span>
          </b>
          <small>Eight parts, each out of 100, weighted as shown. A part with nothing to go on yet is left out until it starts. 80+ is thriving, 65+ sustainable, under 50 at risk.</small>
        </span>
      </div>
      <PartBars parts={sus.parts} tips />
      {next.length > 0 && (
        <>
          <p className="pg-h">What would raise it most</p>
          <ul className="fin-tips">
            {next.map(p => (
              <li key={p.id}>
                <b>{p.label}</b> ({p.score}/100): {p.tip}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="pg-h">How each part is scored</p>
      <ul className="fin-tips">
        {PARTS.map(p => (
          <li key={p.id}>
            <b>{p.label}</b> ({p.weight}%): {p.what}.
          </li>
        ))}
      </ul>
    </>
  );
}

function Climate({ s }: { s: GameState }) {
  const c = climateFigures(s);
  return (
    <>
      <div className="pg-tiles">
        <Tile label="Emitted" value={kg(c.emitted)} sub="CO₂e, all time" tone="bad" />
        <Tile label="Kept in the soil" value={kg(c.stored)} sub="CO₂ stored or kept out of the air" tone="good" />
        <Tile label="Net" value={kg(c.net)} sub={c.net <= 0 ? 'the farm keeps more than it emits' : 'emitted, less what was kept'} tone={c.net <= 0 ? 'good' : 'bad'} />
        <Tile label="Rating" value={c.rating ? `${c.rating.grade} · ${c.rating.score}` : '—'} sub={c.perBag !== null ? `${Math.round(c.perBag)} kg CO₂e a bag` : 'after the first harvest'} />
      </div>
      <div className="pg-tiles">
        <Tile label="Climate credits" value={Math.round(c.credits).toLocaleString('en-US')} sub="earned, all time" tone="good" />
        <Tile label="Diesel burned" value={litres(c.diesel)} sub="tractor and generator" />
        <Tile label="Food lost" value={kg(c.foodLoss)} sub={c.lossShare !== null ? `${pct(c.lossShare)} of what was grown` : 'nothing grown yet'} tone={c.lossShare && c.lossShare > 0.1 ? 'bad' : undefined} />
        <Tile label="Shocks handled" value={c.shocks.met ? `${c.shocks.handled}/${c.shocks.met}` : '—'} sub="drought, flood and hail read right" tone={c.shocks.met && c.shocks.handled === c.shocks.met ? 'good' : undefined} />
      </div>
      <p className="pg-lead">The Climate page (on the farm, right) shows each source of emissions, the land’s daily pay and every entry.</p>
    </>
  );
}

function Water({ s }: { s: GameState }) {
  const w = waterFigures(s);
  return (
    <>
      <p className="pg-lead">The last {w.days || 'few'} days of the tank, and the farms’ water all time.</p>
      <div className="pg-tiles">
        <Tile label="In the tank" value={litres(w.level)} sub={`of ${litres(w.capacity)}`} tone={w.level < w.capacity * 0.25 ? 'bad' : undefined} />
        <Tile label="Rain caught" value={litres(w.rain)} sub={w.used ? `${pct(Math.min(1, w.rain / w.used))} of what was used` : 'no days yet'} tone="good" />
        <Tile label="Used" value={litres(w.used)} sub={`house ${litres(w.house)} · animals ${litres(w.animals)} · farms ${litres(w.farms)}`} />
        <Tile label="Dry days" value={String(w.dryDays)} sub={w.short ? `${litres(w.short)} wanted, not there` : 'the tank never ran dry'} tone={w.dryDays ? 'bad' : 'good'} />
      </div>
      <div className="pg-tiles">
        <Tile label="Irrigation met" value={pct(w.irrigation)} sub="of what the farms’ plans wanted" tone={w.irrigation !== null && w.irrigation < 0.8 ? 'bad' : undefined} />
        <Tile label="Water credits" value={Math.round(w.credits).toLocaleString('en-US')} sub="for using less than the baseline" tone="good" />
        <Tile label="Water bought" value={litres(w.bought)} sub="piped or carried in, all time" />
        <Tile label="Water productivity" value={w.productivity === null ? '—' : `${Math.round(w.productivity)} kg`} sub="of food for every 1,000 L used" />
      </div>
      {w.rationed > 0 && <p className="pg-lead">The shared dam was rationed on {w.rationed} of these days.</p>}
    </>
  );
}

function Soil({ s }: { s: GameState }) {
  const l = landFigures(s);
  const f = s.climate.total;
  return (
    <>
      <div className="pg-tiles">
        <Tile label="Soil health" value={`${l.soil >= 0 ? '+' : ''}${Math.round(l.soil)}`} sub="points up or down, all time" tone={l.soil >= 0 ? 'good' : 'bad'} />
        <Tile label="Land farmed" value={pct(l.plotDays ? l.farmed / l.plotDays : null)} sub={`${l.farmed.toLocaleString('en-US')} plot-days under a crop`} tone="good" />
        <Tile label="Land left bare" value={pct(l.bareShare)} sub={`${l.bare.toLocaleString('en-US')} plot-days: carbon and soil lost`} tone={l.bareShare && l.bareShare > 0.15 ? 'bad' : undefined} />
        <Tile label="The land’s carbon" value={kg(l.landStored - l.landLost)} sub={`${kg(l.landStored)} kept, ${kg(l.landLost)} lost`} tone={l.landStored >= l.landLost ? 'good' : 'bad'} />
      </div>
      <div className="pg-tiles">
        <Tile label="Pollution" value={String(Math.round(f.pollution))} sub="points: chemicals, runoff, exhaust" tone={f.pollution > 10 ? 'bad' : undefined} />
        <Tile label="Sprays" value={String(f.sprays)} sub="chemical spray applications" />
        <Tile label="Synthetic nitrogen" value={kg(f.fertN)} sub="applied, all time" />
        <Tile label="Water on the farms" value={litres(f.water)} sub="on top of the rain" />
      </div>
    </>
  );
}

function Power({ s }: { s: GameState }) {
  const p = powerFigures(s);
  return (
    <>
      {!p.days && <p className="pg-lead">The power figures start once the system is switched on (Power → Build). {p.parts} of {p.partsAll} parts are built.</p>}
      <div className="pg-tiles">
        <Tile label="From the sun" value={`${Math.round(p.solar)} kWh`} sub={`over ${p.days} day${p.days === 1 ? '' : 's'}`} tone="good" />
        <Tile label="From the generator" value={`${Math.round(p.gen)} kWh`} sub={`${litres(p.fuelL)} of diesel`} tone={p.gen > p.solar ? 'bad' : undefined} />
        <Tile label="Solar share" value={pct(p.solarShare)} sub="of all power made" tone={p.solarShare !== null && p.solarShare >= 0.8 ? 'good' : undefined} />
        <Tile label="Needs met" value={pct(p.served)} sub="average share of what was needed" tone={p.served !== null && p.served < 0.9 ? 'bad' : undefined} />
      </div>
      <div className="pg-tiles">
        <Tile label="Power used" value={`${Math.round(p.used)} kWh`} sub="lights, pump, cold room, tools" />
        <Tile label="CO₂ avoided" value={kg(p.avoided)} sub={`${kg(p.emitted)} emitted by the generator`} tone="good" />
        <Tile label="Saved on bills" value={money(Math.max(0, p.saved))} sub="grid power, paraffin, pumping" tone="good" />
        <Tile label="Water pumped" value={litres(p.pumped)} sub="by the solar pump" />
      </div>
    </>
  );
}

function Money({ s }: { s: GameState }) {
  const m = moneyFigures(s);
  const ratio = m.expenses > 0 ? m.harvestIn / m.expenses : null;
  return (
    <>
      <div className="pg-tiles">
        <Tile label="Money in" value={money(m.in)} sub="every part of the farm, all time" tone="good" />
        <Tile label="Money out" value={money(m.out)} sub="every part of the farm, all time" tone="bad" />
        <Tile label="Profit" value={signed(m.profit)} sub="with what savings earned" tone={m.profit >= 0 ? 'good' : 'bad'} />
        <Tile label="Margin" value={pct(m.margin)} sub="profit on what came in" tone={m.margin !== null && m.margin < 0 ? 'bad' : undefined} />
      </div>
      <p className="pg-h">Expenses against the harvest</p>
      <div className="sus-vs" role="img" aria-label={`Harvest income ${money(m.harvestIn)} against expenses ${money(m.expenses)}`}>
        <span className="sus-vs-row">
          <b>Harvest income</b>
          <span className="sus-bar is-good">
            <i style={{ width: `${(100 * m.harvestIn) / Math.max(1, m.harvestIn, m.expenses)}%` }} />
          </span>
          <em>{money(m.harvestIn)}</em>
        </span>
        <span className="sus-vs-row">
          <b>Expenses</b>
          <span className="sus-bar is-bad">
            <i style={{ width: `${(100 * m.expenses) / Math.max(1, m.harvestIn, m.expenses)}%` }} />
          </span>
          <em>{money(m.expenses)}</em>
        </span>
      </div>
      <div className="pg-tiles">
        <Tile label="Harvest ÷ expenses" value={ratio === null ? '—' : `${ratio.toFixed(2)}×`} sub="above 1× the harvest pays its way" tone={ratio === null ? undefined : ratio >= 1 ? 'good' : 'bad'} />
        <Tile label="Seed, inputs, water" value={money(m.inputs)} sub={m.costPerBag !== null ? `${money(m.costPerBag)} for each bag grown` : 'spent, all time'} />
        <Tile label="Other income" value={money(m.otherIn)} sub="milk, eggs, climate payments" />
        <Tile label="Kept back" value={money(m.savings + m.invested)} sub="savings and investments" tone={m.savings + m.invested > 0 ? 'good' : undefined} />
      </div>
    </>
  );
}

function Harvest({ s }: { s: GameState }) {
  const m = moneyFigures(s);
  const c = climateFigures(s);
  const best = m.cycleProfit.reduce<(typeof m.cycleProfit)[number] | null>((b, x) => (!b || x.profit > b.profit ? x : b), null);
  return (
    <>
      <div className="pg-tiles">
        <Tile label="Cycles finished" value={String(m.cycles)} sub="six-farm cycles harvested" />
        <Tile label="Grown" value={kg(s.climate.total.yieldKg)} sub={`${c.bags.toFixed(1)} bags of 90 kg`} tone="good" />
        <Tile label="Food lost" value={kg(c.foodLoss)} sub={c.lossShare !== null ? `${pct(c.lossShare)} of the harvest` : '—'} tone={c.lossShare && c.lossShare > 0.1 ? 'bad' : undefined} />
        <Tile label="Best cycle" value={best ? signed(best.profit) : '—'} sub={best ? `cycle ${best.cycle} · ${Math.round(best.bags)} bags` : 'none yet'} />
      </div>
      {m.cycleProfit.length ? (
        <table className="pg-table" aria-label="Each cycle's harvest and profit">
          <thead>
            <tr>
              <th>Cycle</th>
              <th className="is-num">Bags</th>
              <th className="is-num">Profit</th>
            </tr>
          </thead>
          <tbody>
            {[...m.cycleProfit].reverse().map(x => (
              <tr key={x.cycle}>
                <td>Cycle {x.cycle}</td>
                <td className="is-num">{Math.round(x.bags)}</td>
                <td className={`is-num ${x.profit >= 0 ? 'pg-in' : 'pg-out'}`}>{signed(x.profit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="cl-empty">Each cycle’s harvest shows here once the six farms are harvested (Mission).</p>
      )}
    </>
  );
}

function Animals({ s }: { s: GameState }) {
  const a = animalFigures(s);
  return (
    <>
      {!a.started && <p className="pg-lead">The animals’ care starts on day 2.</p>}
      <div className="pg-tiles">
        <Tile label="Cows’ health" value={`${Math.round(a.cows)}%`} tone={a.cows >= 70 ? 'good' : a.cows < 50 ? 'bad' : undefined} />
        <Tile label="Hens’ health" value={`${Math.round(a.hens)}%`} tone={a.hens >= 70 ? 'good' : a.hens < 50 ? 'bad' : undefined} />
        <Tile label="Problems now" value={String(a.issues)} sub={`${a.fixed} fixed, ${a.wrong} wrong fixes`} tone={a.issues ? 'bad' : 'good'} />
        <Tile label="Animals lost" value={String(a.deaths)} sub="all time" tone={a.deaths ? 'bad' : undefined} />
      </div>
      <div className="pg-tiles">
        <Tile label="Milk" value={litres(a.milk)} sub="all time" />
        <Tile label="Eggs" value={a.eggs.toLocaleString('en-US')} sub="all time" />
        <Tile label="Animals’ profit" value={signed(a.earned - a.spent)} sub={`${money(a.earned)} in, ${money(a.spent)} on care`} tone={a.earned >= a.spent ? 'good' : 'bad'} />
        <Tile label="Thefts" value={String(a.thefts)} sub={a.nights ? `in ${a.nights} nights · ${money(a.lost)} lost` : 'no nights yet'} tone={a.thefts ? 'bad' : undefined} />
      </div>
    </>
  );
}
