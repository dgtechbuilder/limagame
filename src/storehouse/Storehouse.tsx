import { useState, type Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { MiniGame } from '../minigames/MiniGame';
import { money } from '../money';
import { lifeOf } from '../livestock/model';
import type { Action, GameState, StoreTab } from '../state';
import { coldRoom } from '../systems/track';
import { NutriChips } from '../nutrition/Nutri';
import { MARKET, PRODUCE, PRODUCE_IDS, priceOf, produceOf, storeKg, type ProduceId } from '../produce/model';
import { BED_NAMES, GREENHOUSE, bedStatus, ghCropOf, greenhouseOf, pickKg } from '../greenhouse/model';
import { pickGame } from '../greenhouse/Greenhouse';
import { RECIPES, STOREHOUSE, batchesInStore, batchesLeft, quoteMake, storehouseOf, type Recipe } from './model';

/* The storehouse: what the farm keeps (Store), the greenhouse's picks brought in (Harvest), and food made from the
   harvest that keeps and sells for more (Produce). Opened at its door on the farm, or the main menu. */

const short = (id: ProduceId) => PRODUCE[id].name.toLowerCase().replace(/ \(.*\)/, '');

export function StorehousePage({ s, dispatch, tab }: { s: GameState; dispatch: Dispatch<Action>; tab: StoreTab }) {
  const setTab = (t: StoreTab) => dispatch({ type: 'open', modal: { kind: 'storehouse', tab: t } });
  const day = lifeOf(s.life).day;
  const cold = coldRoom(s);
  const open = day >= GREENHOUSE.openDay;
  return (
    <Page
      title="Storehouse"
      icon="🏚️"
      tabs={[
        { id: 'store' as StoreTab, label: 'Store', icon: '📦' },
        { id: 'harvest' as StoreTab, label: 'Harvest', icon: '🧺' },
        { id: 'produce' as StoreTab, label: 'Produce', icon: '🫙' },
      ]}
      tab={tab}
      onTab={setTab}
      dispatch={dispatch}
      foot={
        <>
          Farm day {day} · {STOREHOUSE.dailyBatches} batches a day
          <br />
          {cold ? 'Cold room on: nothing wilts' : open ? `Shade and airflow: fresh produce wilts ${Math.round(MARKET.wilt * MARKET.shadeWilt * 100)}% a night` : `Fresh produce wilts ${Math.round(MARKET.wilt * 100)}% a night`}
        </>
      }
    >
      {!open && (
        <p className="pg-lead">
          The storehouse opens on <b>day {GREENHOUSE.openDay}</b>, with the greenhouse (today is day {day}). Until then your harvest waits in the old store behind the market stall.
        </p>
      )}
      {tab === 'store' && <StoreTabView s={s} dispatch={dispatch} cold={cold} open={open} />}
      {tab === 'harvest' && <HarvestTab s={s} dispatch={dispatch} day={day} />}
      {tab === 'produce' && <ProduceTab s={s} dispatch={dispatch} day={day} cold={cold} open={open} />}
    </Page>
  );
}

function StoreTabView({ s, dispatch, cold, open }: { s: GameState; dispatch: Dispatch<Action>; cold: boolean; open: boolean }) {
  const p = produceOf(s.produce);
  const have = PRODUCE_IDS.filter(id => (p.store[id] ?? 0) > 0);
  const value = have.reduce((n, id) => n + (p.store[id] ?? 0) * priceOf(id, cold), 0);
  const fresh = have.filter(id => PRODUCE[id].fresh).reduce((n, id) => n + (p.store[id] ?? 0), 0);
  const made = have.filter(id => PRODUCE[id].made).reduce((n, id) => n + (p.store[id] ?? 0), 0);
  const wilt = cold ? 0 : MARKET.wilt * (open ? MARKET.shadeWilt : 1);
  const groups: [string, ProduceId[]][] = [
    ['Fresh: sell or make it soon', have.filter(id => PRODUCE[id].fresh)],
    ['Keeps: dry grain and beans', have.filter(id => !PRODUCE[id].fresh && !PRODUCE[id].made)],
    ['Made here: keeps for months', have.filter(id => PRODUCE[id].made)],
  ];
  return (
    <>
      <p className="pg-lead">
        Everything your harvests keep back is stored here, behind glass walls you can see through from the farm. The market stall sells {MARKET.dailyKg} kg of it a day; fresh crops lose weight every
        night, so sell them or make them into something that keeps.
      </p>
      <div className="pg-tiles">
        <Tile label="In the store" value={`${Math.round(storeKg(p))} kg`} sub={`${Math.round(fresh)} kg fresh`} />
        <Tile label="Worth at the stall" value={money(value)} sub="at today’s prices" />
        <Tile label="Made here" value={`${Math.round(made)} kg`} sub="sauce, jam, pickles, flour" />
        <Tile label="Fresh wilts" value={cold ? 'Not at all' : `${Math.round(wilt * 100)}% a night`} sub={cold ? 'the cold room keeps it' : open ? 'half, in the shade' : 'no shade yet'} tone={cold ? 'good' : wilt > MARKET.wilt * 0.75 ? 'bad' : undefined} />
      </div>
      {have.length ? (
        groups.map(([title, ids]) =>
          ids.length ? (
            <div key={title}>
              <p className="pg-h">{title}</p>
              {ids.map(id => (
                <div key={id} className="pg-row" aria-label={`${PRODUCE[id].name} in the store`}>
                  <i aria-hidden="true">{PRODUCE[id].icon}</i>
                  <span className="pg-row-text">
                    <b>
                      {PRODUCE[id].name} · {p.store[id]} kg
                    </b>
                    <small>
                      {money(priceOf(id, cold))} a kg at the stall · worth {money((p.store[id] ?? 0) * priceOf(id, cold))}
                      {PRODUCE[id].fresh && !cold ? ` · loses about ${Math.round((p.store[id] ?? 0) * wilt * 10) / 10} kg tonight` : ''}
                    </small>
                    <NutriChips food={id} max={2} />
                  </span>
                </div>
              ))}
            </div>
          ) : null,
        )
      ) : (
        <p className="cl-empty">The store is empty. Pick the greenhouse and harvest the six farms: some of every harvest is kept here.</p>
      )}
      <button type="button" className="gold-btn mg-big" onClick={() => dispatch({ type: 'open', modal: { kind: 'market', tab: 'sell' } })}>
        Sell at the market stall
      </button>
    </>
  );
}

function HarvestTab({ s, dispatch, day }: { s: GameState; dispatch: Dispatch<Action>; day: number }) {
  const g = greenhouseOf(s.greenhouse);
  const [pick, setPick] = useState<number | null>(null);
  const b = pick === null ? null : g.beds[pick];
  return (
    <>
      <p className="pg-lead">Bring the greenhouse’s ripe beds in: each pick goes straight onto the storehouse shelves. A bed you do not pick waits for you, ripe, until you do.</p>
      {g.beds.map((x, i) => {
        const st = bedStatus(x, day);
        const c = x.crop ? ghCropOf(x.crop) : null;
        return (
          <div key={i} className="pg-row" aria-label={`Greenhouse ${BED_NAMES[i].toLowerCase()}`}>
            <i aria-hidden="true">{c?.icon ?? '▢'}</i>
            <span className="pg-row-text">
              <b>
                {BED_NAMES[i]}
                {c ? ` · ${c.name}` : ''}
              </b>
              <small>
                {st === 'locked'
                  ? `Opens on day ${GREENHOUSE.openDay}`
                  : st === 'empty'
                    ? 'Nothing planted: plant it in the greenhouse'
                    : st === 'ready'
                      ? `Ready: about ${pickKg(x, 1)} kg to bring in`
                      : `Next pick on day ${x.ready}${st === 'thirsty' ? ' · needs water today' : ''}`}
              </small>
            </span>
            {st === 'ready' ? (
              <button type="button" className="gold-btn" style={{ height: 30, padding: '0 14px', fontSize: 8.5 }} onClick={() => setPick(i)} aria-label={`Pick ${c!.name.toLowerCase()} from ${BED_NAMES[i].toLowerCase()}`}>
                Pick
              </button>
            ) : (
              <button type="button" className="pg-toggle" onClick={() => dispatch({ type: 'open', modal: { kind: 'greenhouse', bed: i } })} disabled={st === 'locked'} aria-label={`Open greenhouse ${BED_NAMES[i].toLowerCase()}`}>
                Open
              </button>
            )}
          </div>
        );
      })}
      <p className="pg-h">Brought in</p>
      {g.log.length ? (
        <table className="pg-table" aria-label="Greenhouse picks brought in, newest first">
          <thead>
            <tr>
              <th>Day</th>
              <th>Bed</th>
              <th>Crop</th>
              <th className="is-num">kg</th>
            </tr>
          </thead>
          <tbody>
            {g.log.map((x, i) => (
              <tr key={i}>
                <td>day {x.day}</td>
                <td>{BED_NAMES[x.bed]}</td>
                <td>
                  {ghCropOf(x.crop).icon} {ghCropOf(x.crop).name}
                </td>
                <td className="is-num">{x.kg}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="cl-empty">Nothing brought in yet: the greenhouse’s first picks come a few days after planting.</p>
      )}
      {b?.crop && pick !== null && (
        <MiniGame
          title={`Pick ${ghCropOf(b.crop).name.toLowerCase()}`}
          kicker={`Greenhouse · ${BED_NAMES[pick]}`}
          task="Tap every ripe one. Leave the green ones: they are not ripe yet."
          spec={pickGame(b.crop)}
          doneLabel="Into the storehouse"
          onClose={() => setPick(null)}
          onDone={score => {
            dispatch({ type: 'ghHarvest', bed: pick, score });
            setPick(null);
          }}
        />
      )}
    </>
  );
}

function ProduceTab({ s, dispatch, day, cold, open }: { s: GameState; dispatch: Dispatch<Action>; day: number; cold: boolean; open: boolean }) {
  const h = storehouseOf(s.storehouse);
  const left = batchesLeft(h, day);
  const [making, setMaking] = useState<{ r: Recipe; n: number } | null>(null);
  return (
    <>
      <p className="pg-lead">
        Make some of the store into food that keeps and sells for more: <b>value addition</b>. Each batch takes food from the store and a little money for jars, sugar or the mill, and puts the
        product back on the shelves for the stall to sell.
      </p>
      <div className="pg-tiles">
        <Tile label="Batches left today" value={`${left}`} sub={`of ${STOREHOUSE.dailyBatches} a day`} tone={left > 0 ? 'good' : 'bad'} />
        <Tile label="Batches made" value={`${h.totals.batches}`} sub={`${Math.round(h.totals.kg)} kg in all`} />
        <Tile label="Value added" value={money(h.totals.extra)} sub="over selling the food raw" tone={h.totals.extra >= 0 ? 'good' : 'bad'} />
      </div>
      <div className="pg-grid">
        {RECIPES.map(r => (
          <RecipeCard key={r.id} r={r} s={s} left={open ? left : 0} cold={cold} onMake={n => setMaking({ r, n })} />
        ))}
      </div>
      {making && (
        <MiniGame
          title={`Make ${short(making.r.out)}`}
          kicker="Storehouse"
          task="Tap the steps in the right order."
          spec={{ type: 'order', steps: making.r.steps }}
          doneLabel="Onto the shelves"
          onClose={() => setMaking(null)}
          onDone={score => {
            dispatch({ type: 'storeMake', recipe: making.r.id, batches: making.n, score });
            setMaking(null);
          }}
        />
      )}
    </>
  );
}

function RecipeCard({ r, s, left, cold, onMake }: { r: Recipe; s: GameState; left: number; cold: boolean; onMake: (n: number) => void }) {
  const can = Math.min(left, batchesInStore(s.produce, r));
  const [n, setN] = useState(1);
  const batches = Math.max(0, Math.min(n, can));
  const q = quoteMake(r, batches || 1, cold);
  const store = produceOf(s.produce).store;
  const out = PRODUCE[r.out];
  return (
    <div className={`pg-card${can <= 0 ? ' is-locked' : ''}`} aria-label={out.name}>
      <div className="pg-card-head">
        <i aria-hidden="true">{out.icon}</i>
        <b>{out.name}</b>
        <small>{money(priceOf(r.out, cold))} a kg</small>
      </div>
      <p>{r.what}</p>
      <p className="nu-food">
        A batch:{' '}
        {(Object.entries(r.input) as [ProduceId, number][]).map(([id, kg], i) => (
          <span key={id} className={(store[id] ?? 0) < kg ? 'is-short' : undefined}>
            {i ? ' · ' : ''}
            {kg} kg {short(id)} ({store[id] ?? 0} kg in store)
          </span>
        ))}{' '}
        → {r.yield} kg {short(r.out)}
      </p>
      <p className="nu-money">
        {batches || 1} batch{(batches || 1) === 1 ? '' : 'es'}: <b>{q.kg} kg</b> worth <b>{money(q.value)}</b>
        <br />
        <small>
          Raw, the food fetches {money(q.raw)}; made, {money(q.extra)} more after {money(q.making)} for the making.
        </small>
      </p>
      <span className="nu-cook">
        <span className="pg-stepper">
          <button type="button" aria-label={`One batch fewer of ${out.name}`} onClick={() => setN(x => Math.max(1, x - 1))}>
            −
          </button>
          <b aria-label={`Batches of ${out.name}`}>{batches}</b>
          <button type="button" aria-label={`One batch more of ${out.name}`} onClick={() => setN(x => Math.min(STOREHOUSE.dailyBatches, x + 1))}>
            +
          </button>
        </span>
        <button type="button" className="gold-btn" disabled={batches <= 0 || s.coins < q.making} onClick={() => onMake(batches)} aria-label={`Make ${batches} batch${batches === 1 ? '' : 'es'} of ${out.name}`}>
          {can <= 0 ? (left <= 0 ? 'Done for today' : 'Not enough food') : `Make · ${money(q.making)}`}
        </button>
      </span>
    </div>
  );
}
