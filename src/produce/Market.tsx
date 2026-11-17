import { useState, type Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { money } from '../money';
import { lifeOf } from '../livestock/model';
import type { Action, GameState } from '../state';
import { coldRoom } from '../systems/track';
import { dayText } from '../training/data';
import { MARKET, PRODUCE, PRODUCE_IDS, leftToday, priceOf, produceOf, storeKg, type ProduceId } from './model';

/* The market stall: up to 25 kg of the store sold a day. Opened by walking to the Sell stall (when the six farms'
   harvest is not waiting), or the main menu. */

type Tab = 'sell' | 'sales';

export function MarketPage({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const [tab, setTab] = useState<Tab>('sell');
  const p = produceOf(s.produce);
  const day = lifeOf(s.life).day;
  const left = leftToday(p, day);
  const cold = coldRoom(s);
  const [want, setWant] = useState<Partial<Record<ProduceId, number>>>({});
  const have = PRODUCE_IDS.filter(id => (p.store[id] ?? 0) > 0);
  const total = Object.values(want).reduce((n, v) => n + (v ?? 0), 0);
  const earn = (Object.entries(want) as [ProduceId, number][]).reduce((n, [id, kg]) => n + kg * priceOf(id, cold), 0);
  const change = (id: ProduceId, by: number) =>
    setWant(w => {
      const now = w[id] ?? 0;
      const room = left - (total - now);
      const next = Math.max(0, Math.min(now + by, p.store[id] ?? 0, room));
      return { ...w, [id]: Math.round(next * 10) / 10 };
    });
  return (
    <Page
      title="Market stall"
      icon="🧺"
      tabs={[
        { id: 'sell' as Tab, label: 'Sell today', icon: '🧺' },
        { id: 'sales' as Tab, label: 'Sales', icon: '≡' },
      ]}
      tab={tab}
      onTab={setTab}
      dispatch={dispatch}
      foot={
        <>
          Farm day {day} · {MARKET.dailyKg} kg a day
          <br />
          {cold ? 'Cold room on: fresh produce +10%' : 'No cold room: fresh produce wilts in store'}
        </>
      }
    >
      {tab === 'sell' && (
        <>
          <div className="pg-tiles">
            <Tile label="Left to sell today" value={`${left} kg`} sub={`of ${MARKET.dailyKg} kg a day`} tone={left > 0 ? 'good' : 'bad'} />
            <Tile label="In the store" value={`${Math.round(storeKg(p))} kg`} sub="from your harvests" />
            <Tile label="Sold in all" value={`${Math.round(p.totals.kg)} kg`} sub={money(p.totals.earned)} />
            <Tile label="This sale" value={`${total} kg`} sub={money(earn)} />
          </div>
          {have.length ? (
            have.map(id => (
              <div key={id} className="pg-row">
                <i aria-hidden="true">{PRODUCE[id].icon}</i>
                <span className="pg-row-text">
                  <b>
                    {PRODUCE[id].name} · {money(priceOf(id, cold))} a kg
                  </b>
                  <small>{p.store[id]} kg in the store</small>
                </span>
                <span className="pg-step">
                  <button type="button" aria-label={`5 kg less ${PRODUCE[id].name}`} onClick={() => change(id, -5)}>
                    −
                  </button>
                  <b aria-label={`${PRODUCE[id].name} to sell`}>{want[id] ?? 0} kg</b>
                  <button type="button" aria-label={`5 kg more ${PRODUCE[id].name}`} onClick={() => change(id, 5)}>
                    +
                  </button>
                </span>
              </div>
            ))
          ) : (
            <p className="cl-empty">The store is empty. Harvest the six farms, or Farms 7 and 8: some of every harvest is kept here to sell, {MARKET.dailyKg} kg a day.</p>
          )}
          {have.length > 0 && (
            <button
              type="button"
              className="gold-btn mg-big"
              disabled={total <= 0 || left <= 0}
              onClick={() => {
                dispatch({ type: 'produceSell', items: want });
                setWant({});
              }}
            >
              {left <= 0 ? 'Sold out today: come back tomorrow' : `Sell ${total} kg · ${money(earn)}`}
            </button>
          )}
        </>
      )}
      {tab === 'sales' &&
        (p.sales.length ? (
          <table className="pg-table" aria-label="Sales at the stall, newest first">
            <thead>
              <tr>
                <th>Day</th>
                <th>Sold</th>
                <th className="is-num">kg</th>
                <th className="is-num">Earned</th>
              </tr>
            </thead>
            <tbody>
              {p.sales.map((x, i) => (
                <tr key={i}>
                  <td>
                    {dayText(x.date)} · day {x.day}
                  </td>
                  <td>
                    {(Object.entries(x.items) as [ProduceId, number][])
                      .map(([id, kg]) => `${kg} kg ${PRODUCE[id].name.toLowerCase()}`)
                      .join(', ')}
                  </td>
                  <td className="is-num">{x.kg}</td>
                  <td className="is-num pg-in">+{money(x.earned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="cl-empty">No sales yet.</p>
        ))}
    </Page>
  );
}
