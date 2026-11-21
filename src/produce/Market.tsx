import { useState, type Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { money } from '../money';
import { lifeOf } from '../livestock/model';
import type { Action, GameState, MarketTab } from '../state';
import { coldRoom } from '../systems/track';
import { dayText } from '../training/data';
import { CompareTable, FoodCard, NutriChips, NutriTotal, PlateBars } from '../nutrition/Nutri';
import { GROUPS, nutritionOf } from '../nutrition/data';
import { CROP_IDS, MARKET, PRODUCE, PRODUCE_IDS, growCost, leftToday, priceOf, produceName, produceOf, profitOf, storeKg, type ProduceId } from './model';
import { DISHES, RESTAURANT, dishOf, foodFor, plateNutrition, platesInStore, platesLeft, quote, type Dish, type DishId } from './restaurant';
import { recipeIcons } from '../shop/model';

/* The market stall: up to 25 kg of the store sold a day (what the farmer does not choose is sold for them when the
   day ends), the mini restaurant beside it, what each crop is worth to eat, and every sale. Opened by walking to the
   Sell stall or the restaurant (when the six farms' harvest is not waiting), or the main menu. */

const itemsWords = (items: Partial<Record<ProduceId, number>>) =>
  (Object.entries(items) as [ProduceId, number][])
    .map(([id, kg]) => `${kg} kg ${produceName(id).toLowerCase()}`)
    .join(', ');

export function MarketPage({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const tab: MarketTab = (s.modal?.kind === 'market' && s.modal.tab) || 'sell';
  const setTab = (t: MarketTab) => dispatch({ type: 'open', modal: { kind: 'market', tab: t } });
  const p = produceOf(s.produce);
  const day = lifeOf(s.life).day;
  const left = leftToday(p, day);
  const cold = coldRoom(s);
  return (
    <Page
      title="Market stall"
      icon="🧺"
      tabs={[
        { id: 'sell' as MarketTab, label: 'Sell today', icon: '🧺' },
        { id: 'restaurant' as MarketTab, label: 'Restaurant', icon: '🍲' },
        { id: 'nutrition' as MarketTab, label: 'Nutrition', icon: '🥗' },
        { id: 'sales' as MarketTab, label: 'Sales', icon: '≡' },
      ]}
      tab={tab}
      onTab={setTab}
      dispatch={dispatch}
      foot={
        <>
          Farm day {day} · {MARKET.dailyKg} kg a day · {RESTAURANT.dailyPlates} plates
          <br />
          {cold ? 'Cold room on: fresh produce +10%' : 'No cold room: fresh produce wilts in store'}
        </>
      }
    >
      {tab === 'sell' && <SellTab s={s} dispatch={dispatch} left={left} cold={cold} />}
      {tab === 'restaurant' && <RestaurantTab s={s} dispatch={dispatch} day={day} cold={cold} />}
      {tab === 'nutrition' && <NutritionTab s={s} />}
      {tab === 'sales' && <SalesTab s={s} />}
    </Page>
  );
}

function SellTab({ s, dispatch, left, cold }: { s: GameState; dispatch: Dispatch<Action>; left: number; cold: boolean }) {
  const p = produceOf(s.produce);
  const [want, setWant] = useState<Partial<Record<ProduceId, number>>>({});
  const have = PRODUCE_IDS.filter(id => (p.store[id] ?? 0) > 0);
  const total = Math.round(Object.values(want).reduce((n, v) => n + (v ?? 0), 0) * 10) / 10;
  const earn = (Object.entries(want) as [ProduceId, number][]).reduce((n, [id, kg]) => n + kg * priceOf(id, cold), 0);
  const change = (id: ProduceId, by: number) =>
    setWant(w => {
      const now = w[id] ?? 0;
      const room = left - (total - now);
      const next = Math.max(0, Math.min(now + by, p.store[id] ?? 0, room));
      return { ...w, [id]: Math.round(next * 10) / 10 };
    });
  return (
    <>
      <div className="pg-tiles">
        <Tile label="Left to sell today" value={`${left} kg`} sub={`of ${MARKET.dailyKg} kg a day`} tone={left > 0 ? 'good' : 'bad'} />
        <Tile label="In the store" value={`${Math.round(storeKg(p))} kg`} sub="from your harvests" />
        <Tile label="Sold in all" value={`${Math.round(p.totals.kg)} kg`} sub={`${money(p.totals.earned)} · profit ${money(p.totals.earned - p.totals.cost)}`} />
        <Tile label="This sale" value={`${total} kg`} sub={`${money(earn)} · profit ${money(earn - growCost(want))}`} />
      </div>
      <div className="pg-row nu-auto">
        <i aria-hidden="true">🔁</i>
        <span className="pg-row-text">
          <b>Daily selling {p.auto ? 'on' : 'off'}</b>
          <small>{p.auto ? `Every evening the stall sells what is left of the day’s ${MARKET.dailyKg} kg: a share of everything in the store. Choose below to sell more of one crop.` : `Only what you choose is sold. Turn it on to sell the day’s ${MARKET.dailyKg} kg every evening.`}</small>
        </span>
        <button type="button" className={`pg-toggle${p.auto ? ' is-on' : ''}`} aria-pressed={p.auto} onClick={() => dispatch({ type: 'produceAuto', on: !p.auto })}>
          {p.auto ? 'On' : 'Off'}
        </button>
      </div>
      <div className="fm-open">
        <span>
          <b>Serve customers at the stall</b>
          <small>They walk in and queue; pack each order into one bag or two, and they pay (and tip a quick, right order).</small>
        </span>
        <button type="button" className="gold-btn" onClick={() => dispatch({ type: 'open', modal: { kind: 'serve', shop: 'market' } })} disabled={left <= 0 || !have.length}>
          🧺 Open the stall
        </button>
      </div>
      {have.length ? (
        <>
          <p className="nu-store">
            <NutriTotal total={nutritionOf(p.store)} prefix="Your store feeds" />
          </p>
          <div className="fm-grid" role="list" aria-label="Food in the store">
            {have.map(id => (
              <div key={id} role="listitem" className={`fm-card fm-sell${(want[id] ?? 0) > 0 ? ' is-on' : ''}`} aria-label={PRODUCE[id].name}>
                <i aria-hidden="true">{PRODUCE[id].icon}</i>
                <b>{PRODUCE[id].name.replace(/ \(.*\)/, '')}</b>
                <small>
                  {money(priceOf(id, cold))} a kg · {p.store[id]} kg
                </small>
                <small className="fm-cost">
                  {PRODUCE[id].made ? 'made' : 'grown'} for {money(PRODUCE[id].cost)} a kg
                </small>
                <NutriChips food={id} max={2} compact />
                <span className="pg-stepper">
                  <button type="button" aria-label={`5 kg less ${PRODUCE[id].name}`} onClick={() => change(id, -5)}>
                    −
                  </button>
                  <b aria-label={`${PRODUCE[id].name} to sell`}>{want[id] ?? 0} kg</b>
                  <button type="button" aria-label={`5 kg more ${PRODUCE[id].name}`} onClick={() => change(id, 5)}>
                    +
                  </button>
                </span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="cl-empty">The storehouse is empty. Harvest the six farms, or pick the greenhouse: some of every harvest is kept there to sell, {MARKET.dailyKg} kg a day.</p>
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
  );
}

function RestaurantTab({ s, dispatch, day, cold }: { s: GameState; dispatch: Dispatch<Action>; day: number; cold: boolean }) {
  const p = produceOf(s.produce);
  const left = platesLeft(p, day);
  const t = p.mealTotals;
  return (
    <>
      <p className="pg-lead">
        Package food from your store as meals beside the stall. A plate sells for more than its food raw, after the cooking (fuel, oil, salt, the cook), and every plate shows what it gives the
        person who eats it.
      </p>
      <div className="pg-tiles">
        <Tile label="Plates left today" value={`${left}`} sub={`of ${RESTAURANT.dailyPlates} a day`} tone={left > 0 ? 'good' : 'bad'} />
        <Tile label="Plates served" value={`${t.plates}`} sub="in all" />
        <Tile label="Restaurant sales" value={money(t.earned)} sub={`food and cooking ${money(t.cost)}`} />
        <Tile label="Restaurant profit" value={money(t.earned - t.cost)} tone={t.earned - t.cost >= 0 ? 'good' : 'bad'} />
      </div>
      <div className="fm-open">
        <span>
          <b>Run the kitchen</b>
          <small>Take each customer’s order, cook it on the jiko, the stove or in the oven, plate it or box it, and serve it.</small>
        </span>
        <button type="button" className="gold-btn" onClick={() => dispatch({ type: 'open', modal: { kind: 'serve', shop: 'restaurant' } })} disabled={left <= 0}>
          🍲 Open the kitchen
        </button>
      </div>
      <div className="pg-grid nu-dishes">
        {DISHES.map(d => (
          <DishCard key={d.id} d={d} s={s} dispatch={dispatch} left={left} cold={cold} />
        ))}
      </div>
    </>
  );
}

function DishCard({ d, s, dispatch, left, cold }: { d: Dish; s: GameState; dispatch: Dispatch<Action>; left: number; cold: boolean }) {
  const can = Math.min(left, platesInStore(s.produce, d));
  const [n, setN] = useState(RESTAURANT.step);
  const plates = Math.max(0, Math.min(n, can));
  const q = quote(d, plates || RESTAURANT.step, cold);
  const store = produceOf(s.produce).store;
  const food = foodFor(d, 1);
  return (
    <div className={`pg-card nu-dish${can <= 0 ? ' is-locked' : ''}`} aria-label={d.name}>
      <div className="pg-card-head">
        <i aria-hidden="true">{d.icon}</i>
        <b>{d.name}</b>
        <small>{money(d.price)} a plate</small>
      </div>
      <p>{d.what}</p>
      <div className="fm-row" role="list" aria-label={`A plate of ${d.name}`}>
        {(Object.entries(food) as [ProduceId, number][]).map(([id, kg]) => (
          <span key={id} role="listitem" className={`fm-card fm-mini${(store[id] ?? 0) < kg ? ' is-short' : ''}`} title={`${PRODUCE[id].name}: ${(store[id] ?? 0)} kg in the store`}>
            <i aria-hidden="true">{PRODUCE[id].icon}</i>
            <b>{Math.round(kg * 1000)} g</b>
            <small>{PRODUCE[id].name.toLowerCase().replace(/ \(.*\)/, '')}</small>
          </span>
        ))}
      </div>
      <p className="fm-recipe">Cooked: {recipeIcons(d.id)}</p>
      <PlateBars total={plateNutrition(d)} />
      <p className="nu-money">
        {plates || RESTAURANT.step} plates: <b>{money(q.earned)}</b> · profit <b className={q.profit >= 0 ? 'pg-in' : 'pg-out'}>{money(q.profit)}</b>
        <br />
        <small>
          Raw at the stall the food fetches {money(q.raw)}: as meals, {money(q.extra)} more after cooking.
        </small>
      </p>
      <span className="nu-cook">
        <span className="pg-stepper">
          <button type="button" aria-label={`${RESTAURANT.step} plates fewer of ${d.name}`} onClick={() => setN(x => Math.max(RESTAURANT.step, x - RESTAURANT.step))}>
            −
          </button>
          <b aria-label={`Plates of ${d.name}`}>{plates}</b>
          <button type="button" aria-label={`${RESTAURANT.step} plates more of ${d.name}`} onClick={() => setN(x => Math.min(RESTAURANT.dailyPlates, x + RESTAURANT.step))}>
            +
          </button>
        </span>
        <button type="button" className="gold-btn" disabled={plates <= 0} onClick={() => dispatch({ type: 'restaurantCook', dish: d.id, plates })} aria-label={`Cook and sell ${plates} plates of ${d.name}`}>
          {can <= 0 ? (left <= 0 ? 'Closed today' : 'Not enough food') : `Cook & sell · ${money(d.price * plates)}`}
        </button>
      </span>
    </div>
  );
}

function NutritionTab({ s }: { s: GameState }) {
  const p = produceOf(s.produce);
  const [pick, setPick] = useState<ProduceId>('maize');
  return (
    <>
      <p className="pg-lead">
        What 100 g of each crop gives, as a share of an adult’s daily need. Maize is an <b>energy food</b>, beans a <b>body-building food</b>, leaves and fruit <b>protective foods</b>: a good
        plate has all three. Tap a crop to see all of it.
      </p>
      <p className="nu-legend">
        {Object.values(GROUPS).map(g => (
          <span key={g.name} className="nu-group" style={{ background: g.color }}>
            {g.name}: {g.role.toLowerCase()}
          </span>
        ))}
      </p>
      <CompareTable foods={CROP_IDS} onPick={setPick} picked={pick} />
      <div className="nu-pair">
        <FoodCard food={pick} />
        <div className="pg-card nu-card">
          <div className="pg-card-head">
            <i aria-hidden="true">🏠</i>
            <b>Everything in your store</b>
            <small>{Math.round(storeKg(p))} kg</small>
          </div>
          {storeKg(p) > 0 ? <NutriTotal total={nutritionOf(p.store)} top={7} prefix="A day's need for" /> : <p>The store is empty.</p>}
          <p>Sold at the stall or cooked in the restaurant, this food reaches the families who buy it.</p>
        </div>
      </div>
    </>
  );
}

function SalesTab({ s }: { s: GameState }) {
  const p = produceOf(s.produce);
  return (
    <>
      <p className="pg-h">The stall</p>
      {p.sales.length ? (
        <table className="pg-table" aria-label="Sales at the stall, newest first">
          <thead>
            <tr>
              <th>Day</th>
              <th>Sold</th>
              <th className="is-num">kg</th>
              <th className="is-num">Earned</th>
              <th className="is-num">Profit</th>
            </tr>
          </thead>
          <tbody>
            {p.sales.map((x, i) => (
              <tr key={i}>
                <td>
                  {dayText(x.date)} · day {x.day}
                  {x.auto ? ' · daily' : ''}
                </td>
                <td>{itemsWords(x.items)}</td>
                <td className="is-num">{x.kg}</td>
                <td className="is-num pg-in">+{money(x.earned)}</td>
                <td className={`is-num ${profitOf(x) >= 0 ? 'pg-in' : 'pg-out'}`}>{x.cost === undefined ? '—' : money(profitOf(x))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="cl-empty">No sales yet. The stall sells the day’s {MARKET.dailyKg} kg each evening.</p>
      )}
      <p className="pg-h">The restaurant</p>
      {p.meals.length ? (
        <table className="pg-table" aria-label="Meals sold at the restaurant, newest first">
          <thead>
            <tr>
              <th>Day</th>
              <th>Dish</th>
              <th className="is-num">Plates</th>
              <th className="is-num">Earned</th>
              <th className="is-num">Profit</th>
            </tr>
          </thead>
          <tbody>
            {p.meals.map((x, i) => (
              <tr key={i}>
                <td>
                  {dayText(x.date)} · day {x.day}
                </td>
                <td>{DISHES.some(d => d.id === x.dish) ? dishOf(x.dish as DishId).name : x.dish}</td>
                <td className="is-num">{x.plates}</td>
                <td className="is-num pg-in">+{money(x.earned)}</td>
                <td className={`is-num ${x.earned - x.cost >= 0 ? 'pg-in' : 'pg-out'}`}>{money(x.earned - x.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="cl-empty">No meals yet: cook some in the Restaurant.</p>
      )}
    </>
  );
}
