import { useState, type Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { money } from '../money';
import { lifeOf } from '../livestock/model';
import type { Action, GameState, MarketTab } from '../state';
import { coldRoom } from '../systems/track';
import { dayText } from '../training/data';
import { CompareTable, FoodCard, NutriChips, NutriTotal, PlateBars } from '../nutrition/Nutri';
import { GROUPS, nutritionOf } from '../nutrition/data';
import { CROP_IDS, MARKET, PRODUCE, PRODUCE_IDS, atRisk, gradePriceOf, gradesOf, growCost, leftToday, lotsOf, priceOf, produceName, produceOf, profitOf, storeKg, storeValue, type GradePicks, type ProduceId } from './model';
import { GRADED, GRADES, STORAGE, gradeName, gradeOf, isGraded, methodOf, nightsLeft, qualityOf, type Grade } from './quality';
import { FoodIcon } from './FoodIcon';
import { Info } from '../learn/Info';
import { dropWords, storeCtx } from '../systems/track';
import { askNotify, notifyPermission } from './remind';
import { DISHES, RESTAURANT, dishOf, foodFor, plateNutrition, platesInStore, platesLeft, quote, type Dish, type DishId } from './restaurant';
import { recipeIcons } from '../shop/model';

/* The market stall: up to 25 kg of the store sold a day (what the farmer does not choose is sold for them when the
   day ends), the restaurant (bottom left of the farm), what each crop is worth to eat, and every sale. Opened by walking to the
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
  const ctx = storeCtx(s);
  // graded crops are sold grade by grade; what the storehouse made (one grade) by the kg
  const [picks, setPicks] = useState<GradePicks>({});
  const [want, setWant] = useState<Partial<Record<ProduceId, number>>>({});
  const graded = GRADED.filter(id => (p.store[id] ?? 0) > 0);
  const made = PRODUCE_IDS.filter(id => !isGraded(id) && (p.store[id] ?? 0) > 0);
  const have = [...graded, ...made];
  const pickKg = Object.values(picks).reduce((n, g) => n + (g ? g[0] + g[1] + g[2] : 0), 0);
  const total = Math.round((pickKg + Object.values(want).reduce((n, v) => n + (v ?? 0), 0)) * 10) / 10;
  const earn =
    (Object.entries(picks) as [ProduceId, [number, number, number]][]).reduce((n, [id, g]) => n + g.reduce((m, kg, i) => m + kg * gradePriceOf(id, i as Grade, cold), 0), 0) +
    (Object.entries(want) as [ProduceId, number][]).reduce((n, [id, kg]) => n + kg * priceOf(id, cold), 0);
  const soldFood: Partial<Record<ProduceId, number>> = { ...want };
  for (const [id, g] of Object.entries(picks) as [ProduceId, [number, number, number]][]) soldFood[id] = (soldFood[id] ?? 0) + g[0] + g[1] + g[2];
  const room = (now: number) => left - (total - now);
  const changeGrade = (id: ProduceId, g: Grade, by: number) =>
    setPicks(w => {
      const cur: [number, number, number] = [...(w[id] ?? [0, 0, 0])] as [number, number, number];
      const now = cur[g];
      cur[g] = Math.round(Math.max(0, Math.min(now + by, gradesOf(p, id)[g], room(now))) * 10) / 10;
      return { ...w, [id]: cur };
    });
  const changeMade = (id: ProduceId, by: number) =>
    setWant(w => {
      const now = w[id] ?? 0;
      return { ...w, [id]: Math.round(Math.max(0, Math.min(now + by, p.store[id] ?? 0, room(now))) * 10) / 10 };
    });
  const risk = atRisk(p, ctx);
  const riskLoss = risk.reduce((n, d) => n + d.loss, 0);
  // pick what drops tonight, worst loss first, up to the day's kg left
  const pickRisk = () => {
    const next: GradePicks = {};
    let room0 = left;
    for (const d of [...risk].sort((a, b) => b.loss / b.kg - a.loss / a.kg)) {
      const kg = Math.min(d.kg, room0);
      if (kg <= 0) break;
      const cur = (next[d.id] ??= [0, 0, 0]);
      cur[d.from] = Math.round((cur[d.from] + kg) * 10) / 10;
      room0 -= kg;
    }
    setPicks(next);
    setWant({});
  };
  return (
    <>
      <div className="pg-tiles">
        <Tile label="Left to sell today" value={`${left} kg`} sub={`of ${MARKET.dailyKg} kg a day`} tone={left > 0 ? 'good' : 'bad'} />
        <Tile label="In the store" value={`${Math.round(storeKg(p))} kg`} sub={`worth ${money(have.reduce((n, id) => n + storeValue(p, id, cold), 0))}`} />
        <Tile label="Sold in all" value={`${Math.round(p.totals.kg)} kg`} sub={`${money(p.totals.earned)} · profit ${money(p.totals.earned - p.totals.cost)}`} />
        <Tile label="This sale" value={`${total} kg`} sub={`${money(earn)} · profit ${money(earn - growCost(soldFood))}`} />
      </div>
      {risk.length > 0 && (
        <div className="mk-risk" role="status" aria-label="Sell before prices drop">
          <i aria-hidden="true">⏳</i>
          <span>
            <b>
              Sell before prices drop tonight <Info term="qualityScore" size={14} />
            </b>
            <small>
              {dropWords(risk, 4)}: {money(riskLoss)} less if it waits.
            </small>
          </span>
          <button type="button" className="gold-btn" onClick={pickRisk} disabled={left <= 0}>
            Pick it to sell
          </button>
        </div>
      )}
      <div className="pg-row nu-auto">
        <i aria-hidden="true">🔁</i>
        <span className="pg-row-text">
          <b>Daily selling {p.auto ? 'on' : 'off'}</b>
          <small>{p.auto ? `Every evening the stall sells what is left of the day’s ${MARKET.dailyKg} kg: a share of everything in the store, what is closest to dropping a grade first.` : `Only what you choose is sold. Turn it on to sell the day’s ${MARKET.dailyKg} kg every evening.`}</small>
        </span>
        <button type="button" className={`pg-toggle${p.auto ? ' is-on' : ''}`} aria-pressed={p.auto} onClick={() => dispatch({ type: 'produceAuto', on: !p.auto })}>
          {p.auto ? 'On' : 'Off'}
        </button>
      </div>
      <RemindRow on={!!p.remind} dispatch={dispatch} />
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
          <p className="pg-h mk-h">
            Sell by grade <Info term="grades" size={14} /> <span className="mk-h-note">Each grade has its own price a kg. How a crop is stored decides how fast it drops a grade.</span>
          </p>
          <div className="mk-foods" role="list" aria-label="Food in the store">
            {graded.map(id => (
              <GradedCard key={id} id={id} s={s} cold={cold} picks={picks[id]} onChange={(g, by) => changeGrade(id, g, by)} dispatch={dispatch} />
            ))}
          </div>
          {made.length > 0 && (
            <>
              <p className="pg-h">Made in the storehouse: keeps for months</p>
              <div className="fm-grid" role="list" aria-label="Made in the storehouse">
                {made.map(id => (
                  <div key={id} role="listitem" className={`fm-card fm-sell${(want[id] ?? 0) > 0 ? ' is-on' : ''}`} aria-label={PRODUCE[id].name}>
                    <FoodIcon id={id} size={26} />
                    <b>{PRODUCE[id].name.replace(/ \(.*\)/, '')}</b>
                    <small>
                      {money(priceOf(id, cold))} a kg · {p.store[id]} kg
                    </small>
                    <small className="fm-cost">made for {money(PRODUCE[id].cost)} a kg</small>
                    <NutriChips food={id} max={2} compact />
                    <span className="pg-stepper">
                      <button type="button" aria-label={`5 kg less ${PRODUCE[id].name}`} onClick={() => changeMade(id, -5)}>
                        −
                      </button>
                      <b aria-label={`${PRODUCE[id].name} to sell`}>{want[id] ?? 0} kg</b>
                      <button type="button" aria-label={`5 kg more ${PRODUCE[id].name}`} onClick={() => changeMade(id, 5)}>
                        +
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
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
            if (pickKg > 0) dispatch({ type: 'produceSellGrades', picks });
            if (Object.values(want).some(v => (v ?? 0) > 0)) dispatch({ type: 'produceSell', items: want });
            setPicks({});
            setWant({});
          }}
        >
          {left <= 0 ? 'Sold out today: come back tomorrow' : `Sell ${total} kg · ${money(earn)}`}
        </button>
      )}
    </>
  );
}

/** One crop in the store: its storage, and its three grades with their price, kg and nights before they drop. */
function GradedCard({ id, s, cold, picks, onChange, dispatch }: { id: ProduceId; s: GameState; cold: boolean; picks?: [number, number, number]; onChange: (g: Grade, by: number) => void; dispatch: Dispatch<Action> }) {
  const p = produceOf(s.produce);
  const q = qualityOf(id);
  const m = methodOf(id, p.storage, storeCtx(s));
  const lots = lotsOf(p, id);
  const kg = gradesOf(p, id);
  const name = PRODUCE[id].name.replace(/ \(.*\)/, '');
  const step = q.dry ? 5 : 1;
  return (
    <div role="listitem" className={`mk-food${picks && picks.some(x => x > 0) ? ' is-on' : ''}`} aria-label={PRODUCE[id].name}>
      <div className="mk-food-head">
        <FoodIcon id={id} size={30} />
        <span className="mk-food-name">
          <b>
            {name} <Info term={q.term} size={13} />
          </b>
          <small>
            {p.store[id]} kg · grown for {money(PRODUCE[id].cost)} a kg
          </small>
        </span>
        <button type="button" className="mk-store-btn" onClick={() => dispatch({ type: 'open', modal: { kind: 'storehouse', tab: 'store' } })} aria-label={`${name} is stored: ${STORAGE[m].name}. Change how it is stored`}>
          <small>Stored</small>
          <b>{STORAGE[m].name}</b>
        </button>
        <Info term={STORAGE[m].term} size={13} />
      </div>
      <NutriChips food={id} max={2} compact />
      <ul className="mk-grades" aria-label={`${name} by grade`}>
        {GRADES.map(g => {
          const at = lots.filter(x => gradeOf(x.q) === g);
          const nights = at.length ? Math.min(...at.map(x => nightsLeft(id, x.q, m))) : 0;
          const n = picks?.[g] ?? 0;
          return (
            <li key={g} className={`mk-grade g${g + 1}${kg[g] <= 0 ? ' is-empty' : ''}`} aria-label={`${name} ${gradeName(g)}`}>
              <span className="mk-grade-tag">{gradeName(g)}</span>
              <span className="mk-grade-text">
                <b>
                  {money(gradePriceOf(id, g, cold))} a kg · {kg[g]} kg
                </b>
                <small>
                  {q.grades[g].name}
                  {kg[g] > 0 && <em className={nights <= 1 ? 'is-soon' : undefined}>{nights <= 1 ? (g === 2 ? ' · spoils tonight' : ' · drops tonight') : ` · ${g === 2 ? 'spoils' : 'drops'} in ${nights} nights`}</em>}
                </small>
              </span>
              <span className="pg-stepper">
                <button type="button" aria-label={`${step} kg less ${name} ${gradeName(g)}`} onClick={() => onChange(g, -step)} disabled={n <= 0}>
                  −
                </button>
                <b aria-label={`${name} ${gradeName(g)} to sell`}>{n} kg</b>
                <button type="button" aria-label={`${step} kg more ${name} ${gradeName(g)}`} onClick={() => onChange(g, step)} disabled={kg[g] <= n}>
                  +
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The daily reminder to come back and sell: on the morning's news in the game, and a phone notification if allowed. */
function RemindRow({ on, dispatch }: { on: boolean; dispatch: Dispatch<Action> }) {
  const perm = notifyPermission();
  return (
    <div className="pg-row nu-auto">
      <i aria-hidden="true">🔔</i>
      <span className="pg-row-text">
        <b>Daily sell reminder {on ? 'on' : 'off'}</b>
        <small>
          {on
            ? perm === 'granted'
              ? 'Each morning: a notification on this phone, and the farm’s news, with what drops a grade tonight.'
              : perm === 'denied'
                ? 'Each morning on the farm’s news. Notifications are blocked for this game in the browser’s settings.'
                : 'Each morning on the farm’s news, with what drops a grade tonight.'
            : 'Turn it on for a nudge each morning to sell before prices drop.'}
        </small>
      </span>
      <button
        type="button"
        className={`pg-toggle${on ? ' is-on' : ''}`}
        aria-pressed={on}
        aria-label={`Daily sell reminder ${on ? 'on' : 'off'}`}
        onClick={() => {
          if (!on) void askNotify();
          dispatch({ type: 'produceRemind', on: !on });
        }}
      >
        {on ? 'On' : 'Off'}
      </button>
    </div>
  );
}

function RestaurantTab({ s, dispatch, day, cold }: { s: GameState; dispatch: Dispatch<Action>; day: number; cold: boolean }) {
  const p = produceOf(s.produce);
  const left = platesLeft(p, day);
  const t = p.mealTotals;
  return (
    <>
      <p className="pg-lead">
        Package food from your store as meals in the restaurant. A plate sells for more than its food raw, after the cooking (fuel, oil, salt, the cook), and every plate shows what it gives the
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
