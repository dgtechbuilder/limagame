import { useState, type Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { money } from '../money';
import type { Action, GameState, WalletTab } from '../state';
import { payOf } from '../climate/model';
import { WALLET_KINDS, climatePayments, walletOf, type WalletKind } from './model';
import { dayText } from '../training/data';

/* The farmer's wallet: every payment in and out, newest first (History), every climate payment the farm has been
   paid (Climate payments), and the money in and out by kind (Summary). Opened by tapping the money on the farm, the
   main menu, or Climate › Land & pay. */

const TABS: { id: WalletTab; label: string; icon: string }[] = [
  { id: 'history', label: 'History', icon: '≡' },
  { id: 'climate', label: 'Climate payments', icon: '🌍' },
  { id: 'summary', label: 'Summary', icon: '◎' },
];

const signed = (n: number) => `${n >= 0 ? '+' : '−'}${money(Math.abs(n))}`;

export function WalletPage({ s, dispatch, tab = 'history' }: { s: GameState; dispatch: Dispatch<Action>; tab?: WalletTab }) {
  const setTab = (t: WalletTab) => dispatch({ type: 'open', modal: { kind: 'wallet', tab: t } });
  const w = walletOf(s.wallet);
  return (
    <Page title="Wallet" icon="👛" tabs={TABS} tab={tab} onTab={setTab} dispatch={dispatch} foot={<>In your wallet now: <b>{money(s.coins)}</b></>}>
      {tab === 'history' && <History s={s} />}
      {tab === 'climate' && <Climate s={s} />}
      {tab === 'summary' && (
        <>
          <p className="pg-h">Money in and out, all time</p>
          <table className="pg-table" aria-label="Money in and out by kind">
            <thead>
              <tr>
                <th>Kind</th>
                <th className="is-num">In</th>
                <th className="is-num">Out</th>
                <th className="is-num">Net</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(WALLET_KINDS) as WalletKind[])
                .filter(k => w.totals[k])
                .map(k => {
                  const t = w.totals[k]!;
                  return (
                    <tr key={k}>
                      <th scope="row" style={{ fontSize: 10.5, textTransform: 'none', color: 'var(--ink)' }}>
                        {WALLET_KINDS[k].icon} {WALLET_KINDS[k].label}
                      </th>
                      <td className="is-num pg-in">{money(t.in)}</td>
                      <td className="is-num pg-out">{money(t.out)}</td>
                      <td className="is-num">{signed(t.in - t.out)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {!Object.keys(w.totals).length && <p className="cl-empty">Nothing yet: payments show here as they happen.</p>}
        </>
      )}
    </Page>
  );
}

function History({ s }: { s: GameState }) {
  const w = walletOf(s.wallet);
  const [kind, setKind] = useState<WalletKind | 'all'>('all');
  const kinds = (Object.keys(WALLET_KINDS) as WalletKind[]).filter(k => w.entries.some(e => e.kind === k));
  const rows = w.entries.filter(e => kind === 'all' || e.kind === kind);
  return (
    <>
      <div className="pg-chips" role="group" aria-label="Show">
        <button type="button" className={`pg-chip${kind === 'all' ? ' is-on' : ''}`} onClick={() => setKind('all')}>
          All
        </button>
        {kinds.map(k => (
          <button key={k} type="button" className={`pg-chip${kind === k ? ' is-on' : ''}`} onClick={() => setKind(k)}>
            {WALLET_KINDS[k].icon} {WALLET_KINDS[k].label}
          </button>
        ))}
      </div>
      {rows.length ? (
        <table className="pg-table" aria-label="Wallet history, newest first">
          <thead>
            <tr>
              <th>When</th>
              <th>What</th>
              <th className="is-num">Amount</th>
              <th className="is-num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 120).map(e => (
              <tr key={e.id}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {dayText(e.date)} · day {e.day}
                </td>
                <td>
                  {WALLET_KINDS[e.kind].icon} {e.label}
                </td>
                <td className={`is-num ${e.amount >= 0 ? 'pg-in' : 'pg-out'}`}>{signed(e.amount)}</td>
                <td className="is-num">{money(e.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="cl-empty">No payments yet. Everything you earn and spend from now on is kept here.</p>
      )}
    </>
  );
}

function Climate({ s }: { s: GameState }) {
  const pay = payOf(s.climate);
  const list = climatePayments(s.wallet);
  const total = list.reduce((n, e) => n + e.amount, 0);
  const credits = list.reduce((n, e) => n + (e.credits ?? 0), 0);
  const last = list.slice(0, 20).reverse();
  const max = Math.max(1e-9, ...last.map(e => e.amount));
  return (
    <>
      <div className="pg-tiles">
        <Tile label="Paid to your wallet" value={money(Math.max(total, pay.paid))} sub="climate credits, all time" tone="good" />
        <Tile label="Credits paid" value={`${Math.round(Math.max(credits, pay.creditsPaid) * 10) / 10}`} sub="1 credit = 10 kg CO₂" />
        <Tile label="Payments" value={`${list.length}`} sub="one each day that ends" />
        <Tile label="Latest" value={list[0] ? money(list[0].amount) : '—'} sub={list[0] ? `${dayText(list[0].date)} · farm day ${list[0].day}` : 'paid when a day ends'} />
      </div>
      {last.length > 1 && (
        <div className="pg-bars" role="img" aria-label={`The last ${last.length} climate payments, oldest first`}>
          {last.map(e => (
            <span key={e.id} style={{ height: `${Math.max(6, (e.amount / max) * 100)}%` }} title={`${dayText(e.date)}: ${money(e.amount)}`} />
          ))}
        </div>
      )}
      <p className="pg-h">Every climate payment, newest first</p>
      {list.length ? (
        <table className="pg-table" aria-label="Climate payments, newest first">
          <thead>
            <tr>
              <th>Paid</th>
              <th>For</th>
              <th className="is-num">Credits</th>
              <th className="is-num">Amount</th>
              <th className="is-num">Wallet after</th>
            </tr>
          </thead>
          <tbody>
            {list.map(e => (
              <tr key={e.id}>
                <td>
                  {dayText(e.date)} · day {e.day}
                </td>
                <td>{e.label.replace(/^Climate payment · /, '')}</td>
                <td className="is-num">{e.credits ?? '—'}</td>
                <td className="is-num pg-in">+{money(e.amount)}</td>
                <td className="is-num">{money(e.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="cl-empty">The first climate payment comes when today ends: the forest, the farms and your climate-smart work earn credits every day.</p>
      )}
    </>
  );
}
