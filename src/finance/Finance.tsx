import { useState, type Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { fromLocal, money, toLocal } from '../money';
import type { Action, FinanceTab, GameState } from '../state';
import { walletOf } from '../wallet/model';
import { lifeOf } from '../livestock/model';
import { bizOf } from '../business/model';
import {
  ENTERPRISES,
  INVESTMENTS,
  PRODUCTS,
  dailyProfit,
  dayRate,
  depositBlock,
  farmProfit,
  financeOf,
  investedPrincipal,
  investedValue,
  marginOf,
  payoutOf,
  profitOf,
  type FinanceState,
  type ProductId,
} from './model';

/* Money: the farmer's finances in one place. Overview (what the farmer is worth and how the farm is doing), Savings
   (the SACCO account and a savings goal), Investments (a money market fund, Treasury bills, shares) and Profit (each
   part of the farm's money in, money out and profit, all time and day by day). The numbers live in model.ts. */

const TABS: { id: FinanceTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  { id: 'savings', label: 'Savings', icon: '🏦' },
  { id: 'invest', label: 'Investments', icon: '📈' },
  { id: 'profit', label: 'Profit', icon: '📊' },
];

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export function FinancePage({ s, dispatch, tab = 'overview' }: { s: GameState; dispatch: Dispatch<Action>; tab?: FinanceTab }) {
  const setTab = (t: FinanceTab) => dispatch({ type: 'open', modal: { kind: 'finance', tab: t } });
  const f = financeOf(s.finance);
  const worth = s.coins + f.savings + investedValue(f);
  return (
    <Page title="Money" icon="💰" tabs={TABS} tab={tab} onTab={setTab} dispatch={dispatch} foot={<>You are worth: <b>{money(worth)}</b></>}>
      {tab === 'overview' && <Overview s={s} f={f} setTab={setTab} />}
      {tab === 'savings' && <Savings s={s} f={f} dispatch={dispatch} />}
      {tab === 'invest' && <Invest s={s} f={f} dispatch={dispatch} />}
      {tab === 'profit' && <Profit s={s} f={f} />}
    </Page>
  );
}

/* ---------------- an amount box, typed in the player's currency ---------------- */

function Amount({ label, max, onGo, go, presets, block }: { label: string; max: number; onGo: (stored: number) => void; go: string; presets: number[]; block: (stored: number) => string | null }) {
  const [text, setText] = useState('');
  const stored = fromLocal(Number(text.replace(/[^0-9.]/g, '')) || 0);
  const why = text ? block(stored) : 'Type an amount';
  return (
    <div className="fin-amount">
      <label>
        <span>{label}</span>
        <input inputMode="decimal" value={text} placeholder="0" aria-label={label} onChange={e => setText(e.target.value)} />
      </label>
      <span className="fin-presets">
        {presets
          .filter(p => p > 0 && p <= max + 1e-9)
          .map(p => (
            <button key={p} type="button" className="pg-chip" onClick={() => setText(String(Math.floor(toLocal(p))))}>
              {money(p)}
            </button>
          ))}
        {max > 0 && (
          <button type="button" className="pg-chip" onClick={() => setText(String(Math.floor(toLocal(max))))}>
            All
          </button>
        )}
      </span>
      <button
        type="button"
        className="set-link fin-go"
        disabled={!!why}
        title={why ?? ''}
        onClick={() => {
          onGo(stored);
          setText('');
        }}
      >
        {go}
      </button>
      {text && why && <small className="fin-why">{why}</small>}
    </div>
  );
}

/* ---------------- overview ---------------- */

function Overview({ s, f, setTab }: { s: GameState; f: FinanceState; setTab: (t: FinanceTab) => void }) {
  const w = walletOf(s.wallet);
  const p = farmProfit(w, f);
  const days = dailyProfit(w, 7);
  const week = days.reduce((n, d) => n + profitOf(d.line), 0);
  const inv = investedValue(f);
  const biz = s.biz ? bizOf(s.biz) : null;
  const bizProfit = biz ? biz.history.reduce((n, d) => n + d.profit, 0) : 0;
  const lines = p.lines.filter(l => l.line.in || l.line.out).sort((a, b) => profitOf(b.line) - profitOf(a.line));
  const best = lines[0];
  const worst = lines[lines.length - 1];
  const name = (id: string) => ENTERPRISES.find(e => e.id === id)!.label.toLowerCase();
  return (
    <>
      <div className="pg-tiles">
        <Tile label="In your wallet" value={money(s.coins)} sub="to spend today" />
        <Tile label="Savings" value={money(f.savings)} sub={`${pct(PRODUCTS.savings.rate)} a year`} />
        <Tile label="Investments" value={money(inv)} sub={inv ? `${signed(inv - investedPrincipal(f))} on what went in` : 'nothing invested yet'} tone={inv - investedPrincipal(f) < 0 ? 'bad' : undefined} />
        <Tile label="Worth in all" value={money(s.coins + f.savings + inv)} sub="wallet, savings and investments" tone="good" />
      </div>
      <div className="pg-tiles">
        <Tile label="Farm profit, all time" value={signed(p.profit)} sub="every part of the farm, with what savings earned" tone={p.profit >= 0 ? 'good' : 'bad'} />
        <Tile label="The last 7 farm days" value={signed(week)} sub={days.length ? `days ${days[0].day} to ${days[days.length - 1].day}` : 'no days yet'} tone={week >= 0 ? 'good' : 'bad'} />
        <Tile label="Savings earned" value={signed(f.earned)} sub="interest and gains, all time" tone={f.earned >= 0 ? 'good' : 'bad'} />
        <Tile label="Tractor business" value={biz ? money(biz.cash) : '—'} sub={biz ? `its own account · profit ${signed(bizProfit)}` : 'not started'} />
      </div>
      <p className="pg-h">What the numbers say</p>
      <ul className="fin-tips">
        {best && profitOf(best.line) > 0 && (
          <li>
            Your best earner is <b>{name(best.id)}</b>: {signed(profitOf(best.line))} so far.
          </li>
        )}
        {worst && profitOf(worst.line) < 0 && (
          <li>
            <b>{name(worst.id)[0].toUpperCase() + name(worst.id).slice(1)}</b> cost {money(-profitOf(worst.line))} more than it brought in: open Profit to see why.
          </li>
        )}
        {f.savings + inv < s.coins * 0.1 && s.coins > 1000 && (
          <li>
            Less than a tenth of your money is saved. Farmers who keep some back get through a bad season:{' '}
            <button type="button" className="tc-link" onClick={() => setTab('savings')}>
              start saving
            </button>
            .
          </li>
        )}
        {f.goal && (
          <li>
            Saving for <b>{f.goal.name}</b>: {money(f.savings)} of {money(f.goal.target)} ({Math.min(100, Math.round((100 * f.savings) / f.goal.target))}%).
          </li>
        )}
        <li>Moving money into savings or an investment is not spending: it is still yours, and profit leaves it out.</li>
      </ul>
    </>
  );
}

/* ---------------- savings ---------------- */

function Savings({ s, f, dispatch }: { s: GameState; f: FinanceState; dispatch: Dispatch<Action> }) {
  const p = PRODUCTS.savings;
  const [goalName, setGoalName] = useState(f.goal?.name ?? '');
  const [goalText, setGoalText] = useState(f.goal ? String(Math.round(toLocal(f.goal.target))) : '');
  const daily = f.savings * dayRate(p.rate);
  const goalLeft = f.goal ? Math.max(0, f.goal.target - f.savings) : 0;
  const recent = f.days.slice(-14);
  const max = Math.max(1e-9, ...recent.map(d => d.savings));
  return (
    <>
      <p className="fin-lead">
        {p.icon} <b>{p.name}</b>. {p.does} {pct(p.rate)} a year: each farm day counts as a week, so it earns {pct(dayRate(p.rate))} a day.
      </p>
      <div className="pg-tiles">
        <Tile label="Saved" value={money(f.savings)} tone="good" />
        <Tile label="Earns a day" value={money(daily)} sub="added each night" />
        <Tile label="Interest so far" value={money(f.earnedBy.savings ?? 0)} sub="all time" />
        <Tile label="Farm day" value={`${lifeOf(s.life).day}`} sub="interest settles when a day ends" />
      </div>
      <div className="fin-row">
        <Amount label="Put in" max={s.coins} go="Save" presets={[500, 1000, 5000]} block={n => depositBlock('savings', n, s.coins)} onGo={n => dispatch({ type: 'finDeposit', amount: n })} />
        <Amount label="Take out" max={f.savings} go="Take out" presets={[500, 1000]} block={n => (n > 0 && n <= f.savings + 1e-9 ? null : n > 0 ? 'More than you have saved' : 'Pick an amount')} onGo={n => dispatch({ type: 'finWithdraw', amount: n })} />
      </div>
      <p className="pg-h">A savings goal</p>
      <div className="fin-goal">
        <input aria-label="What you are saving for" placeholder="e.g. a water tank" value={goalName} onChange={e => setGoalName(e.target.value)} />
        <input aria-label="Goal amount" inputMode="decimal" placeholder="Amount" value={goalText} onChange={e => setGoalText(e.target.value)} />
        <button type="button" className="set-link" disabled={!(Number(goalText) > 0)} onClick={() => dispatch({ type: 'finGoal', goal: { name: goalName, target: fromLocal(Number(goalText)) } })}>
          Set goal
        </button>
        {f.goal && (
          <button type="button" className="set-link" onClick={() => dispatch({ type: 'finGoal', goal: null })}>
            Clear
          </button>
        )}
      </div>
      {f.goal && (
        <div className="fin-bar" role="img" aria-label={`${money(f.savings)} of ${money(f.goal.target)} saved for ${f.goal.name}`}>
          <i style={{ width: `${Math.min(100, (100 * f.savings) / f.goal.target)}%` }} />
          <span>
            {f.goal.name}: {money(f.savings)} of {money(f.goal.target)}
            {goalLeft > 0 ? ` · ${money(goalLeft)} to go: save ${money(Math.ceil(goalLeft / 10))} a farm day to reach it in 10 days` : ' · reached!'}
          </span>
        </div>
      )}
      {recent.length > 1 && (
        <>
          <p className="pg-h">Your savings, day by day</p>
          <div className="pg-bars" role="img" aria-label={`Savings over the last ${recent.length} farm days`}>
            {recent.map(d => (
              <span key={d.day} style={{ height: `${Math.max(4, (d.savings / max) * 100)}%` }} title={`Day ${d.day}: ${money(d.savings)}`} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ---------------- investments ---------------- */

function Invest({ s, f, dispatch }: { s: GameState; f: FinanceState; dispatch: Dispatch<Action> }) {
  const [pick, setPick] = useState<Exclude<ProductId, 'savings'>>('mmf');
  const day = lifeOf(s.life).day;
  const p = PRODUCTS[pick];
  return (
    <>
      <div className="pg-chips" role="radiogroup" aria-label="Investment">
        {INVESTMENTS.map(id => (
          <button key={id} type="button" role="radio" aria-checked={pick === id} className={`pg-chip${pick === id ? ' is-on' : ''}`} onClick={() => setPick(id as Exclude<ProductId, 'savings'>)}>
            {PRODUCTS[id].icon} {PRODUCTS[id].name}
          </button>
        ))}
      </div>
      <p className="fin-lead">
        {p.does} About {pct(p.rate)} a year ({pct(dayRate(p.rate))} a farm day){p.swing ? `, and the price moves up to ${pct(p.swing)} a day either way` : ''}. Risk: <b>{p.risk === 'none' ? 'none' : p.risk}</b>. The least: {money(p.min)}.
      </p>
      <Amount label="Invest" max={s.coins} go="Invest" presets={[p.min, p.min * 5, p.min * 10]} block={n => depositBlock(pick, n, s.coins)} onGo={n => dispatch({ type: 'finInvest', product: pick, amount: n })} />
      <p className="pg-h">What you hold</p>
      {f.holdings.length ? (
        <table className="pg-table" aria-label="Your investments">
          <thead>
            <tr>
              <th>Investment</th>
              <th className="is-num">Put in</th>
              <th className="is-num">Worth now</th>
              <th className="is-num">Gain</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {f.holdings.map(h => {
              const out = payoutOf(h, day);
              const g = h.value - h.principal;
              return (
                <tr key={h.id}>
                  <td>
                    {PRODUCTS[h.product].icon} {PRODUCTS[h.product].name}
                    <small className="fin-sub">
                      {' '}
                      · day {h.since}
                      {h.matures ? (h.matures > day ? ` · paid back on day ${h.matures}` : ' · due tonight') : ''}
                    </small>
                  </td>
                  <td className="is-num">{money(h.principal)}</td>
                  <td className="is-num">{money(h.value)}</td>
                  <td className={`is-num ${g >= 0 ? 'pg-in' : 'pg-out'}`}>{signed(g)}</td>
                  <td className="is-num">
                    <button type="button" className="set-link" onClick={() => dispatch({ type: 'finSell', id: h.id })} title={out.early ? 'Out early: the interest is lost' : out.fee ? `A ${money(out.fee)} fee` : ''}>
                      {out.early ? 'Out early' : 'Take out'} · {money(out.pay)}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="cl-empty">Nothing invested yet. A money market fund is a safe first step; shares earn more over time, but can fall.</p>
      )}
      <p className="pg-h">Earned by each, all time</p>
      <p className="fin-lead">
        {INVESTMENTS.map(id => `${PRODUCTS[id].name}: ${signed(f.earnedBy[id] ?? 0)}`).join(' · ')}
      </p>
    </>
  );
}

/* ---------------- profit ---------------- */

function Profit({ s, f }: { s: GameState; f: FinanceState }) {
  const w = walletOf(s.wallet);
  const p = farmProfit(w, f);
  const days = dailyProfit(w, 14);
  const max = Math.max(1e-9, ...days.map(d => Math.abs(profitOf(d.line))));
  const trials = s.trialHistory ?? [];
  return (
    <>
      <p className="pg-h">Each part of the farm, all time</p>
      <p className="fin-lead">Seed and inputs are paid weeks before the harvest is sold, so a part of the farm can show a loss until its crop comes in. Money moved into savings is left out.</p>
      <table className="pg-table" aria-label="Money in, money out and profit for each part of the farm">
        <thead>
          <tr>
            <th>Part of the farm</th>
            <th className="is-num">In</th>
            <th className="is-num">Out</th>
            <th className="is-num">Profit</th>
            <th className="is-num">Margin</th>
          </tr>
        </thead>
        <tbody>
          {p.lines.map(({ id, line }) => {
            const e = ENTERPRISES.find(x => x.id === id)!;
            const m = marginOf(line);
            return (
              <tr key={id} title={e.note}>
                <th scope="row" style={{ fontSize: 10.5, textTransform: 'none', color: 'var(--ink)' }}>
                  {e.icon} {e.label}
                </th>
                <td className="is-num pg-in">{money(line.in)}</td>
                <td className="is-num pg-out">{money(line.out)}</td>
                <td className={`is-num ${profitOf(line) >= 0 ? 'pg-in' : 'pg-out'}`}>{signed(profitOf(line))}</td>
                <td className="is-num">{m === null ? '—' : pct(m)}</td>
              </tr>
            );
          })}
          <tr>
            <th scope="row" style={{ fontSize: 10.5, textTransform: 'none', color: 'var(--ink)' }}>
              🏦 Savings and investments earned
            </th>
            <td className="is-num" colSpan={2} />
            <td className={`is-num ${f.earned >= 0 ? 'pg-in' : 'pg-out'}`}>{signed(f.earned)}</td>
            <td />
          </tr>
          <tr className="fin-total">
            <th scope="row">The whole farm</th>
            <td className="is-num pg-in">{money(p.total.in)}</td>
            <td className="is-num pg-out">{money(p.total.out)}</td>
            <td className={`is-num ${p.profit >= 0 ? 'pg-in' : 'pg-out'}`}>{signed(p.profit)}</td>
            <td className="is-num">{marginOf(p.total) === null ? '—' : pct(marginOf(p.total)!)}</td>
          </tr>
        </tbody>
      </table>
      <p className="pg-h">Profit, farm day by farm day</p>
      {days.length ? (
        <div className="fin-days" role="img" aria-label={`Profit on each of the last ${days.length} farm days`}>
          {days.map(d => {
            const v = profitOf(d.line);
            return (
              <span key={d.day} className={v >= 0 ? 'is-up' : 'is-down'} title={`Day ${d.day}: in ${money(d.line.in)}, out ${money(d.line.out)}, profit ${signed(v)}`}>
                <i style={{ height: `${Math.max(3, (Math.abs(v) / max) * 50)}%` }} />
                <small>{d.day}</small>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="cl-empty">No farm days yet: profit shows here day by day.</p>
      )}
      {trials.length > 0 && (
        <>
          <p className="pg-h">The six farms: profit each cycle</p>
          <table className="pg-table" aria-label="Profit of each farm, cycle by cycle">
            <thead>
              <tr>
                <th>Cycle</th>
                {trials[trials.length - 1].profit.map((_, i) => (
                  <th key={i} className="is-num">
                    Farm {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {trials.slice(-6).map(t => (
                <tr key={t.cycle}>
                  <td>{t.cycle}</td>
                  {t.profit.map((v, i) => (
                    <td key={i} className={`is-num ${v >= 0 ? 'pg-in' : 'pg-out'}`}>
                      {signed(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
