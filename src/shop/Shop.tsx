import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { CloseX } from '../components/Success';
import { lifeOf } from '../livestock/model';
import { money } from '../money';
import { PRODUCE, leftToday, priceOf, produceOf, type ProduceId } from '../produce/model';
import { MENU, NEEDS, dishOf, needsOf, platesLeft, type DishId } from '../produce/restaurant';
import { LOOKS } from '../first/data';
import type { Action, GameState } from '../state';
import { coldRoom } from '../systems/track';
import { useAnime } from '../art/style';
import {
  COOK,
  STATIONS,
  STATION_IDS,
  atCounter,
  billOf,
  booked,
  canMake,
  closeShop,
  cookFor,
  free,
  handOver,
  isReady,
  jobOf,
  kgOf,
  newPatron,
  newShift,
  orderItems,
  ordering,
  packItem,
  progressOf,
  serveMeal,
  setBags,
  shiftOver,
  shopClock,
  stationStatus,
  tick,
  unitOf,
  unpackItem,
  type Patron,
  type Shift,
  type ShopKind,
} from './model';
import { FOOD_COLOR, SHOP_H, SHOP_W, ShopScene, type SceneView } from './scene';

/* The shop floor (rules in model.ts, the 3D room in scene.ts): the market stall or the restaurant, played. Opened by
   walking to the Sell stall or the restaurant on the farm (the world's Open the market and Open the restaurant), and
   from the market page. At the stall customers queue and the farmer packs each order into bags; at the restaurant
   they sit and order, the farmer picks a dish off the menu, it cooks, and the farmer serves it, learning what each
   food does for the body. Every customer served sells the food from the store, as the market page does. */

const short = (id: ProduceId) => PRODUCE[id].name.replace(/ \(.*\)/, '');

type Phase = 'brief' | 'play' | 'over';

export function ShopFloor({ s, dispatch, kind }: { s: GameState; dispatch: Dispatch<Action>; kind: ShopKind }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<ShopScene | null>(null);
  const shift = useRef<Shift>(newShift(kind));
  const [, bump] = useReducer((x: number) => x + 1, 0);
  const [phase, setPhase] = useState<Phase>('brief');
  const [farmer, setFarmer] = useState<{ at: SceneView['farmer']['at']; until: number }>({ at: 'counter', until: 0 });
  const [shake, setShake] = useState<string | null>(null);
  // the restaurant: the seated customer the farmer is cooking for next, and what the last plate taught
  const [picked, setPicked] = useState<number | null>(null);
  const [learned, setLearned] = useState<{ id: number; dish: DishId; fit: boolean; text: string } | null>(null);
  const anime = useAnime();
  const live = useRef(s);
  live.current = s;
  const sh = shift.current;
  const day = lifeOf(s.life).day;
  const cold = coldRoom(s);
  const p = produceOf(s.produce);
  const close = () => dispatch({ type: 'close' });
  const book = () => dispatch({ type: 'open', modal: { kind: 'market', tab: kind === 'market' ? 'sell' : 'restaurant' } });

  // the 3D room
  useEffect(() => {
    if (!canvas.current) return;
    const look = LOOKS[live.current.farmer?.look ?? 0] ?? LOOKS[0];
    let sc: ShopScene | null = null;
    try {
      sc = new ShopScene(canvas.current, kind, look, { anime, low: live.current.settings.graphics === 'low', reduceMotion: live.current.settings.reduceMotion });
    } catch {
      sc = null;
    }
    scene.current = sc;
    // play-tests read the customers and their orders (dev builds only)
    if (import.meta.env.DEV) (window as unknown as { __limaShop?: unknown }).__limaShop = { get shift() { return shift.current; }, scene: sc };
    return () => {
      sc?.dispose();
      scene.current = null;
    };
  }, [kind, anime]);

  // the shop's clock: customers come, wait and lose patience; the food cooks
  useEffect(() => {
    if (phase !== 'play') return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.25, (now - last) / 1000) * shopClock.scale;
      last = now;
      if (document.hidden) return;
      const st = live.current;
      tick(shift.current, dt, { produce: st.produce, day: lifeOf(st.life).day, rng: Math.random });
      if (scene.current) scene.current.speed = shopClock.scale;
      if (shiftOver(shift.current)) setPhase('over');
      bump();
    }, 100);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // the farmer goes back to the counter after a moment at the shelf or a station
  useEffect(() => {
    if (!farmer.until) return;
    const id = window.setTimeout(() => setFarmer(f => (f.until && performance.now() >= f.until ? { at: kind === 'market' ? 'counter' : f.at, until: 0 } : f)), Math.max(0, farmer.until - performance.now()) + 20);
    return () => window.clearTimeout(id);
  }, [farmer, kind]);
  const go = (at: SceneView['farmer']['at'], ms = 700) => setFarmer({ at, until: performance.now() + ms });
  const nope = (key: string) => {
    setShake(key);
    window.setTimeout(() => setShake(k => (k === key ? null : k)), 400);
  };

  // what the 3D room shows
  const view: SceneView = {
    patrons: sh.patrons.map(c => ({ id: c.id, look: c.look, extra: c.extra, kid: c.kid, phase: c.phase, slot: c.slot, seat: c.seat, mood: c.mood, carry: c.carry })),
    farmer: { at: farmer.at, busy: !!farmer.until },
    stations: Object.fromEntries(
      STATION_IDS.map(id => {
        const st = stationStatus(sh, id);
        const food = st.job ? FOOD_COLOR[(Object.keys(dishOf(st.job.dish).plate) as ProduceId[])[0]] : null;
        return [id, { state: st.state === 'done' ? 'empty' : st.state, food }];
      }),
    ) as SceneView['stations'],
    bags: sh.bags.map(b => ({ kg: kgOf(b), colors: (Object.keys(b) as ProduceId[]).map(id => FOOD_COLOR[id]) })),
    pass: sh.jobs.filter(isReady).map(() => 'plate'),
    store: p.store,
  };
  scene.current?.setView(view);
  const anchors = scene.current?.anchors();

  const counter = atCounter(sh);
  const kgLeft = leftToday(p, day);
  const platesNow = platesLeft(p, day);
  // is there an order the store can still fill today (the brief's Open, and Open again)
  const canSell = !!newPatron(newShift(kind), s.produce, day, () => 0.5);

  /* ---------------- the stall ---------------- */
  const onFood = (id: ProduceId) => {
    if (phase !== 'play') return;
    if (kind === 'market') {
      if (packItem(sh, id, p.store)) go(id);
      else nope(id);
    }
    bump();
  };
  const onHand = () => {
    const r = handOver(sh, cold);
    if (r) {
      dispatch({ type: 'shopSell', given: r.given, asked: r.asked, tip: r.tip, name: r.patron.name });
      booked(sh, r.bill, r.tip);
    } else nope('hand');
    bump();
  };

  /* ---------------- the restaurant ---------------- */
  const waitingNow = ordering(sh);
  // the farmer cooks for the customer picked, or else the one who sat down first
  const chosen = waitingNow.find(c => c.id === picked) ?? waitingNow[0] ?? null;
  const freeNow = free(sh, s.produce, day, chosen?.id);
  const makeable = canMake(freeNow.store);
  const onDish = (d: DishId) => {
    if (phase !== 'play') return;
    if (!chosen) {
      nope(d);
      return;
    }
    if (cookFor(sh, chosen.id, d, s.produce, day)) {
      go(COOK[d].at, 700);
      setPicked(null);
    } else nope(d);
    bump();
  };
  const onServe = (c: Patron) => {
    const r = serveMeal(sh, c.id);
    if (r) {
      dispatch({ type: 'shopMeal', dishes: r.dishes, discount: r.discount, tip: r.tip, name: r.patron.name, ask: r.ask, fit: r.fit });
      booked(sh, r.bill, r.tip);
      setLearned({ id: r.patron.id, dish: r.dishes[0], fit: r.fit, text: r.lesson });
      go('counter', 600);
    }
    bump();
  };

  const stock = (Object.keys(PRODUCE) as ProduceId[]).filter(id => (p.store[id] ?? 0) > 0);
  const orderAsk = counter && counter.order.kind === 'market' ? orderItems(counter.order) : {};
  const packedAll: Partial<Record<ProduceId, number>> = {};
  for (const b of sh.bags) for (const [id, kg] of Object.entries(b) as [ProduceId, number][]) packedAll[id] = Math.round(((packedAll[id] ?? 0) + kg) * 10) / 10;

  return (
    <div className={`abs sf sf-${kind}`} style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label={kind === 'market' ? 'Market stall: serving customers' : 'Restaurant: serving customers'}>
      <canvas ref={canvas} className="sf-canvas" width={SHOP_W} height={SHOP_H} aria-hidden="true" />

      {/* the bar along the top */}
      <header className="sf-top">
        <p className="sf-title">
          <span aria-hidden="true">{kind === 'market' ? '🧺' : '🍲'}</span> {kind === 'market' ? 'Market stall' : 'Restaurant'} · <b>{phase === 'over' ? 'closed' : 'open'}</b>
        </p>
        <span className="sf-chip" aria-label={`Served ${sh.served}`}>
          🛍️ {sh.served}
        </span>
        <span className="sf-chip" aria-label={`Happy customers ${sh.happy}`}>
          😊 {sh.happy}
        </span>
        {sh.walked > 0 && (
          <span className="sf-chip is-bad" aria-label={`Walked out ${sh.walked}`}>
            🚶 {sh.walked}
          </span>
        )}
        <span className="sf-chip is-money" aria-label={`Taken this shift ${money(sh.earned + sh.tips)}`}>
          💰 {money(sh.earned + sh.tips)}
        </span>
        <span className="sf-chip" aria-label={kind === 'market' ? `${kgLeft} kg left to sell today` : `${platesNow} plates left today`}>
          {kind === 'market' ? `${kgLeft} kg left today` : `${platesNow} plates left`}
        </span>
        <span className="sf-gap" />
        <button type="button" className="sf-link" onClick={book}>
          {kind === 'market' ? 'Stall book' : 'Menu and prices'}
        </button>
        {phase === 'play' && !sh.closing && (
          <button type="button" className="sf-link" onClick={() => (closeShop(sh), bump())}>
            Close the shop
          </button>
        )}
      </header>
      <CloseX className="page-x" onClick={close} label={kind === 'market' ? 'Leave the market' : 'Leave the restaurant'} />

      {/* speech over the heads */}
      {phase === 'play' &&
        sh.patrons.map(c => {
          const a = anchors?.patrons[c.id];
          if (!a) return null;
          const text = bubbleOf(c, kind);
          if (!text) return null;
          return (
            <p key={c.id} className={`sf-bubble${c.phase === 'leave' ? ` is-${c.mood}` : ''}${c === counter ? ' is-counter' : ''}`} style={{ left: a.x, top: a.y }} aria-live={c === counter ? 'polite' : undefined}>
              {text}
            </p>
          );
        })}

      {/* the orders, down the left */}
      <section className="sf-orders" aria-label="Orders">
        <p className="sf-h">{kind === 'market' ? 'At the counter' : 'Orders'}</p>
        {kind === 'market' ? (
          counter && counter.order.kind === 'market' ? (
            <div className="sf-ticket" aria-label={`${counter.name}'s order`}>
              <p className="sf-who">
                <Face c={counter} /> <b>{counter.name}</b>
                <small>{counter.order.bags.length === 2 ? 'two bags' : 'one bag'}</small>
              </p>
              <Patience c={counter} />
              {counter.order.bags.map((b, i) => (
                <div key={i} className="sf-bagline">
                  {counter.order.kind === 'market' && counter.order.bags.length > 1 && <small>Bag {i + 1}</small>}
                  {(Object.entries(b) as [ProduceId, number][]).map(([id, kg]) => {
                    const got = (counter.order.kind === 'market' && counter.order.bags.length > 1 ? sh.bags[i]?.[id] : packedAll[id]) ?? 0;
                    return (
                      <span key={id} className={`sf-want${got === kg ? ' is-done' : got > kg ? ' is-over' : ''}`}>
                        <i aria-hidden="true">{PRODUCE[id].icon}</i> {short(id)} <b>{got}/{kg} kg</b>
                      </span>
                    );
                  })}
                </div>
              ))}
              <p className="sf-bill">Bill {money(billOf(counter.order, cold))}</p>
            </div>
          ) : (
            <p className="sf-empty">{phase === 'brief' ? 'Open the shop to let customers in.' : sh.closing ? 'No more customers today.' : 'The next customer is on the way…'}</p>
          )
        ) : (
          <MealTickets sh={sh} phase={phase} chosen={chosen} onPick={c => setPicked(c.id)} onServe={onServe} />
        )}
        {phase === 'play' && <Queue sh={sh} />}
      </section>

      {/* the bags, or what is in the farmer's hands, down the right */}
      <section className="sf-side" aria-label={kind === 'market' ? 'The bags' : 'In your hands'}>
        {kind === 'market' ? (
          <>
            <p className="sf-h">The bags</p>
            {sh.bags.map((b, i) => (
              <div key={i} className={`sf-bag${sh.bag === i ? ' is-on' : ''}`}>
                <button type="button" className="sf-bag-head" aria-pressed={sh.bag === i} aria-label={`Bag ${i + 1}`} onClick={() => ((sh.bag = i), bump())}>
                  🛍️ Bag {i + 1} <small>{kgOf(b)} kg</small>
                </button>
                <span className="sf-bag-items">
                  {(Object.entries(b) as [ProduceId, number][]).map(([id, kg]) => (
                    <button key={id} type="button" className="sf-item" aria-label={`Take ${unitOf(id)} kg ${short(id)} out of bag ${i + 1}`} onClick={() => (unpackItem(sh, i, id), bump())}>
                      {PRODUCE[id].icon} {kg}
                    </button>
                  ))}
                  {!kgOf(b) && <small className="sf-empty">Empty: tap the food below</small>}
                </span>
              </div>
            ))}
            <button type="button" className="sf-link is-block" onClick={() => (setBags(sh, sh.bags.length === 1 ? 2 : 1), bump())}>
              {sh.bags.length === 1 ? '+ A second bag' : 'Use one bag'}
            </button>
            <button type="button" className={`gold-btn sf-go${shake === 'hand' ? ' is-shake' : ''}`} disabled={!counter || phase !== 'play'} onClick={onHand} aria-label="Hand over the bags">
              Hand over{counter && counter.order.kind === 'market' ? ` · ${money(billOf(counter.order, cold))}` : ''}
            </button>
          </>
        ) : (
          <Plate learned={learned} />
        )}
      </section>

      {/* what is cooking on the kitchen's stations, on the 3D room */}
      {kind === 'restaurant' &&
        phase !== 'brief' &&
        STATION_IDS.map(id => {
          const a = anchors?.stations[id];
          const st = stationStatus(sh, id);
          if (!a || st.state === 'empty' || !st.job) return null;
          return (
            <p key={id} className={`sf-station is-${st.state}`} style={{ left: a.x, top: a.y, ['--p' as string]: `${Math.round(st.progress * 100)}%` }} aria-label={`${STATIONS[id].name}: ${dishOf(st.job.dish).name}, ${st.state === 'done' ? 'ready' : 'cooking'}`}>
              <i aria-hidden="true">{dishOf(st.job.dish).icon}</i>
              <span>{st.state === 'done' ? 'Ready!' : `${STATIONS[id].verb.replace(/e$/, '')}ing…`}</span>
            </p>
          );
        })}

      {/* the restaurant's menu: tap a dish to cook it for the customer picked */}
      {kind === 'restaurant' && (
        <section className="sf-pantry sf-menu" aria-label="The menu">
          {MENU.map(id => {
            const d = dishOf(id);
            const ok = makeable.includes(id);
            const want = !!chosen && chosen.order.kind === 'restaurant' && 'dish' in chosen.order.ask && chosen.order.ask.dish === id;
            return (
              <button
                key={id}
                type="button"
                className={`fm-card sf-food sf-dishcard${want ? ' is-want' : ''}${shake === id ? ' is-shake' : ''}`}
                aria-label={`Cook ${d.name}${chosen ? ` for ${chosen.name}` : ''}`}
                onClick={() => onDish(id)}
                disabled={phase !== 'play' || !ok}
              >
                <i aria-hidden="true">{d.icon}</i>
                <b>{d.name}</b>
                <small className="sf-kinds">
                  {needsOf(d).map(n => (
                    <span key={n} className={`sf-kind is-${n}`} title={NEEDS[n].name}>
                      {NEEDS[n].icon} {NEEDS[n].short}
                    </span>
                  ))}
                </small>
                <small>{ok ? (Object.keys(d.plate) as ProduceId[]).map(f => PRODUCE[f].icon).join(' ') : 'Not enough in the store'}</small>
              </button>
            );
          })}
        </section>
      )}

      {/* the food: a mini card for everything in the store */}
      {kind === 'market' && (
      <section className="sf-pantry" aria-label="The store">
        {stock.length ? (
          stock.map(id => {
            const want = (orderAsk[id] ?? 0) > (packedAll[id] ?? 0);
            return (
              <button
                key={id}
                type="button"
                className={`fm-card sf-food${want ? ' is-want' : ''}${shake === id ? ' is-shake' : ''}`}
                aria-label={`Pack ${unitOf(id)} kg ${short(id)}`}
                onClick={() => onFood(id)}
                disabled={phase !== 'play'}
              >
                <i aria-hidden="true">{PRODUCE[id].icon}</i>
                <b>{short(id)}</b>
                <small>
                  {p.store[id]} kg · {money(priceOf(id, cold))}
                </small>
              </button>
            );
          })
        ) : (
          <p className="sf-empty">The store is empty: harvest the farms or the greenhouse first.</p>
        )}
      </section>
      )}

      {sh.flash && phase === 'play' && (
        <p key={sh.flash.id} className={`sf-flash${sh.flash.bad ? ' is-bad' : ''}`} role="status">
          {sh.flash.text}
        </p>
      )}

      {phase === 'brief' && <Brief kind={kind} canSell={canSell} onStart={() => setPhase('play')} onClose={close} />}
      {phase === 'over' && <Summary kind={kind} sh={sh} onClose={close} onBook={book} onAgain={() => ((shift.current = newShift(kind)), setPhase('play'))} canAgain={canSell} />}
    </div>
  );
}

function bubbleOf(c: Patron, kind: ShopKind): string | null {
  if (c.phase === 'leave') return c.t < 2.6 && c.said ? c.said : null;
  if (c.phase === 'order' && c.slot === 0 && kind === 'market') return c.line;
  if (c.phase === 'order' && c.order.kind === 'restaurant') {
    const a = c.order.ask;
    return ('need' in a ? `${NEEDS[a.need].icon} ${NEEDS[a.need].short}?` : `${dishOf(a.dish).icon} ${dishOf(a.dish).name}`) + (c.patience < c.max * 0.3 ? ' 😠' : '');
  }
  if (c.phase === 'wait' && c.order.kind === 'restaurant' && c.order.dish) return `${dishOf(c.order.dish).icon} …` + (c.patience < c.max * 0.3 ? ' 😠' : '');
  if (c.phase === 'eat') return '😋';
  return null;
}

function Face({ c }: { c: Patron }) {
  return <span className="sf-face" aria-hidden="true" style={{ background: c.look.skin, borderColor: c.look.outfit }} />;
}

function Patience({ c }: { c: Patron }) {
  const k = Math.max(0, c.patience / c.max);
  return (
    <span className={`sf-patience${k < 0.3 ? ' is-low' : ''}`} role="meter" aria-label={`${c.name}'s patience`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(k * 100)}>
      <i style={{ width: `${k * 100}%` }} />
    </span>
  );
}

function Queue({ sh }: { sh: Shift }) {
  const line = sh.patrons.filter(c => (c.phase === 'queue' || c.phase === 'enter') && c.slot > 0);
  if (!line.length) return null;
  return (
    <p className="sf-queue">
      {line.map(c => (
        <Face key={c.id} c={c} />
      ))}
      <small>{line.length} in the queue</small>
    </p>
  );
}

function MealTickets({ sh, phase, chosen, onPick, onServe }: { sh: Shift; phase: Phase; chosen: Patron | null; onPick: (c: Patron) => void; onServe: (c: Patron) => void }) {
  const seated = sh.patrons.filter(c => (c.phase === 'order' || c.phase === 'wait') && c.order.kind === 'restaurant');
  if (!seated.length) return <p className="sf-empty">{phase === 'brief' ? 'Open the restaurant to let customers in.' : sh.closing ? 'No more customers today.' : 'The next customer is on the way…'}</p>;
  return (
    <div className="sf-tickets">
      {seated.map(c => {
        if (c.order.kind !== 'restaurant') return null;
        const a = c.order.ask;
        const j = jobOf(sh, c.id);
        const ready = !!j && isReady(j);
        const isChosen = chosen?.id === c.id;
        return (
          <div key={c.id} className={`sf-ticket${ready ? ' is-ready' : ''}${isChosen ? ' is-new' : ''}`} aria-label={`${c.name}'s order`}>
            <p className="sf-who">
              <Face c={c} /> <b>{c.name}</b>
              <small>table {Math.floor((c.seat ?? 0) / 2) + 1}</small>
            </p>
            <Patience c={c} />
            <p className="sf-ask">
              {'need' in a ? (
                <>
                  <i aria-hidden="true">{NEEDS[a.need].icon}</i> <span>“{c.line}”</span>
                </>
              ) : (
                <>
                  <i aria-hidden="true">{dishOf(a.dish).icon}</i> <span>{dishOf(a.dish).name}, please</span>
                </>
              )}
            </p>
            {c.phase === 'order' &&
              (isChosen ? (
                <small className="sf-todo">{'need' in a ? `Pick a dish that is ${NEEDS[a.need].short.toLowerCase()} food` : 'Pick it from the menu below'}</small>
              ) : (
                <button type="button" className="sf-mini" onClick={() => onPick(c)} aria-label={`Cook for ${c.name}`}>
                  Cook for {c.name}
                </button>
              ))}
            {j && !ready && (
              <span className="sf-dish is-doing">
                <i aria-hidden="true">{dishOf(j.dish).icon}</i>
                <span>
                  <b>{dishOf(j.dish).name}</b>
                  <small>cooking… {Math.round(progressOf(j) * 100)}%</small>
                </span>
              </span>
            )}
            {ready && j && (
              <button type="button" className="gold-btn sf-take" onClick={() => onServe(c)} aria-label={`Serve ${c.name}`}>
                Serve {dishOf(j.dish).name}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** The right-hand panel at the restaurant: the three kinds of food, and what the last plate served was made of. */
function Plate({ learned }: { learned: { id: number; dish: DishId; fit: boolean; text: string } | null }) {
  return (
    <>
      <p className="sf-h">Good food</p>
      {learned && (
        <div key={learned.id} className={`sf-learn${learned.fit ? '' : ' is-miss'}`} role="status">
          <p className="sf-who">
            <i aria-hidden="true">{dishOf(learned.dish).icon}</i> <b>{learned.fit ? 'Served!' : 'Served, but…'}</b>
          </p>
          <small>{learned.text}</small>
        </div>
      )}
      <ul className="sf-kindlist" aria-label="The three kinds of food">
        {(Object.keys(NEEDS) as (keyof typeof NEEDS)[]).map(n => (
          <li key={n} className={`sf-kind is-${n}`}>
            <b>
              {NEEDS[n].icon} {NEEDS[n].name}
            </b>
            <small>{NEEDS[n].does}</small>
          </li>
        ))}
      </ul>
      <small className="sf-tip">A good meal has all three: ugali, beans and greens.</small>
    </>
  );
}

function Brief({ kind, canSell, onStart, onClose }: { kind: ShopKind; canSell: boolean; onStart: () => void; onClose: () => void }) {
  return (
    <div className="sf-card" role="group" aria-label="How to play">
      <h2>{kind === 'market' ? 'Open the market stall' : 'Open the restaurant'}</h2>
      {kind === 'market' ? (
        <ul>
          <li>Customers walk in and queue at the counter. Each one asks for food from your store.</li>
          <li>
            Tap the food cards to pack the order. When they ask for <b>two bags</b>, add a second bag and keep the fresh food apart.
          </li>
          <li>Hand over the bags: they pay for what they asked for, and tip a perfect, quick job. Keep them waiting and they walk out.</li>
        </ul>
      ) : (
        <ul>
          <li>Customers walk in, sit down and order a dish, or ask for a kind of food: ⚡ energy, 💪 body-building or 🛡️ protective.</li>
          <li>
            Tap a dish on the <b>menu</b> to cook it from your store. Pick one that fits what they asked for!
          </li>
          <li>
            When it’s ready, <b>serve</b> it. The right food, served quickly, earns a tip.
          </li>
        </ul>
      )}
      {!canSell && <p className="sf-warn">{kind === 'market' ? 'Nothing to sell today: the store is empty, or the stall has sold its 25 kg.' : 'The kitchen can’t cook today: the store has the food for no dish, or the 30 plates are served.'}</p>}
      <span className="sf-row">
        <button type="button" className="gold-btn" onClick={onStart} disabled={!canSell} aria-label="Open the shop">
          Open the shop
        </button>
        <button type="button" className="sf-link" onClick={onClose}>
          Not now
        </button>
      </span>
    </div>
  );
}

function Summary({ kind, sh, onClose, onBook, onAgain, canAgain }: { kind: ShopKind; sh: Shift; onClose: () => void; onBook: () => void; onAgain: () => void; canAgain: boolean }) {
  return (
    <div className="sf-card" role="alertdialog" aria-label="The shop is closed">
      <h2>{sh.served ? `${sh.served} ${sh.served === 1 ? 'customer' : 'customers'} served` : 'The shop is closed'}</h2>
      <p className="sf-sum">
        <span>
          <b>{money(sh.earned)}</b>
          <small>{kind === 'market' ? 'for the food' : 'for the meals'}</small>
        </span>
        <span>
          <b>{money(sh.tips)}</b>
          <small>in tips</small>
        </span>
        <span>
          <b>{sh.happy}</b>
          <small>happy</small>
        </span>
        <span className={sh.walked ? 'is-bad' : ''}>
          <b>{sh.walked}</b>
          <small>walked out</small>
        </span>
      </p>
      <p>{canAgain ? 'There is still food to sell today: open again for more customers.' : kind === 'market' ? 'The stall has sold all it can today. Come back tomorrow.' : 'The kitchen has cooked all it can today. Come back tomorrow.'}</p>
      <span className="sf-row">
        {canAgain && (
          <button type="button" className="gold-btn" onClick={onAgain}>
            Open again
          </button>
        )}
        <button type="button" className="gold-btn" onClick={onClose}>
          Back to the farm
        </button>
        <button type="button" className="sf-link" onClick={onBook}>
          {kind === 'market' ? 'Stall book' : 'Menu and prices'}
        </button>
      </span>
    </div>
  );
}
