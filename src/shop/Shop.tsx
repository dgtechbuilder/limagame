import { useEffect, useReducer, useRef, useState, type Dispatch } from 'react';
import { CloseX } from '../components/Success';
import { lifeOf } from '../livestock/model';
import { money } from '../money';
import { PRODUCE, leftToday, priceOf, produceOf, type ProduceId } from '../produce/model';
import { dishOf, platesLeft } from '../produce/restaurant';
import { LOOKS } from '../first/data';
import type { Action, GameState } from '../state';
import { coldRoom } from '../systems/track';
import { useAnime } from '../art/style';
import {
  RECIPES,
  STATIONS,
  STATION_IDS,
  atCounter,
  binDish,
  billOf,
  booked,
  closeShop,
  gather,
  handOver,
  jobOf,
  kgOf,
  mealReady,
  needsFood,
  newPatron,
  newShift,
  nextStation,
  orderItems,
  packDish,
  packItem,
  readyToPack,
  serveMeal,
  setBags,
  shiftOver,
  shopClock,
  startJob,
  stationStatus,
  takeOrder,
  tick,
  unitOf,
  unpackItem,
  atStation,
  type Job,
  type Patron,
  type Shift,
  type ShopKind,
  type StationId,
} from './model';
import { FOOD_COLOR, SHOP_H, SHOP_W, ShopScene, type SceneView } from './scene';

/* The shop floor (rules in model.ts, the 3D room in scene.ts): the market stall or the restaurant, played. Opened by
   walking to the Sell stall or the restaurant on the farm (the world's Open the market and Open the restaurant), and
   from the market page. Customers walk in and queue; the farmer packs each order into bags, or takes the order,
   cooks it and serves it, and every customer served sells the food from the store, as the market page does. */

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
        return [id, { state: st.state, food }];
      }),
    ) as SceneView['stations'],
    bags: sh.bags.map(b => ({ kg: kgOf(b), colors: (Object.keys(b) as ProduceId[]).map(id => FOOD_COLOR[id]) })),
    pass: sh.jobs.filter(j => j.where === 'pass').map(j => j.pack ?? 'plate'),
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
    } else {
      const r = gather(sh, id);
      if (r === 'wrong' || r === 'none') nope(id);
      else go('counter', 500);
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
  const onStation = (id: StationId) => {
    if (phase !== 'play') return;
    const r = atStation(sh, id);
    if (r === 'wrong' || r === 'none' || r === 'notyet' || r === 'busy') nope(id);
    setFarmer({ at: id, until: r === 'chop' || r === 'placed' || r === 'chopped' || r === 'taken' ? performance.now() + 450 : 0 });
    bump();
  };
  const onServe = (c: Patron) => {
    const r = serveMeal(sh, c.id);
    if (r) {
      dispatch({ type: 'shopMeal', dishes: r.dishes, discount: r.discount, tip: r.tip, name: r.patron.name });
      booked(sh, r.bill, r.tip);
      go('counter', 600);
    }
    bump();
  };

  const stock = (Object.keys(PRODUCE) as ProduceId[]).filter(id => (p.store[id] ?? 0) > 0);
  const hands = jobOf(sh, sh.hands);
  const need = hands && hands.step === 0 ? needsFood(hands) : [];
  const orderAsk = counter && counter.order.kind === 'market' ? orderItems(counter.order) : {};
  const packedAll: Partial<Record<ProduceId, number>> = {};
  for (const b of sh.bags) for (const [id, kg] of Object.entries(b) as [ProduceId, number][]) packedAll[id] = Math.round(((packedAll[id] ?? 0) + kg) * 10) / 10;

  return (
    <div className={`abs sf sf-${kind}`} style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label={kind === 'market' ? 'Market stall: serving customers' : 'Restaurant: serving customers'}>
      <canvas ref={canvas} className="sf-canvas" width={SHOP_W} height={SHOP_H} aria-hidden="true" />

      {/* the bar along the top */}
      <header className="sf-top">
        {/* Back: to the market page it was opened from, or the farm */}
        <button type="button" className="sf-link sf-back" onClick={close} aria-label="Back">
          ← Back
        </button>
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
          <MealTickets sh={sh} phase={phase} onTake={() => (takeOrder(sh), bump())} onStart={j => (startJob(sh, j.id) ? go('counter', 300) : nope(`job${j.id}`), bump())} onServe={onServe} shake={shake} />
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
          <Hands sh={sh} hands={hands} onPack={k => (packDish(sh, k) ? go('counter', 500) : nope(k), bump())} onBin={() => (binDish(sh), bump())} shake={shake} />
        )}
      </section>

      {/* the kitchen's stations, on the 3D room */}
      {kind === 'restaurant' &&
        phase !== 'brief' &&
        STATION_IDS.map(id => {
          const a = anchors?.stations[id];
          if (!a) return null;
          const st = stationStatus(sh, id);
          const wants = hands && nextStation(hands) === id && hands.where === 'hands';
          const word = st.state === 'empty' ? (wants ? 'Put it here' : STATIONS[id].short) : STATIONS[id].kind === 'chop' ? `Tap to chop` : st.state === 'working' ? `${STATIONS[id].verb.replace(/e$/, '')}ing…` : st.state === 'done' ? 'Take it out!' : st.state === 'over' ? 'Overcooking!' : 'Burnt!';
          return (
            <button
              key={id}
              type="button"
              className={`sf-station is-${st.state}${wants ? ' is-want' : ''}${shake === id ? ' is-shake' : ''}`}
              style={{ left: a.x, top: a.y, ['--p' as string]: `${Math.round(st.progress * 100)}%` }}
              aria-label={`${STATIONS[id].name}${st.job ? `: ${dishOf(st.job.dish).name}, ${word}` : ''}`}
              onClick={() => onStation(id)}
            >
              <i aria-hidden="true">{STATIONS[id].icon}</i>
              <span>{word}</span>
              {st.job && <small>{dishOf(st.job.dish).name}</small>}
            </button>
          );
        })}

      {/* the food: a mini card for everything in the store */}
      <section className="sf-pantry" aria-label="The store">
        {stock.length ? (
          stock.map(id => {
            const want = kind === 'market' ? (orderAsk[id] ?? 0) > (packedAll[id] ?? 0) : need.includes(id);
            return (
              <button
                key={id}
                type="button"
                className={`fm-card sf-food${want ? ' is-want' : ''}${shake === id ? ' is-shake' : ''}`}
                aria-label={kind === 'market' ? `Pack ${unitOf(id)} kg ${short(id)}` : `Take ${short(id)} from the store`}
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
  if (c.phase === 'order' && c.slot === 0) return kind === 'market' ? c.line : c.order.kind === 'restaurant' && !c.order.taken ? 'Ready to order!' : null;
  if (c.phase === 'wait' && c.order.kind === 'restaurant') return c.order.dishes.map(d => dishOf(d).icon).join(' ') + (c.patience < c.max * 0.3 ? ' 😠' : '');
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

const WHERE: Record<string, string> = { ticket: 'to start', hands: 'in your hands', pass: 'ready on the pass' };

function MealTickets({ sh, phase, onTake, onStart, onServe, shake }: { sh: Shift; phase: Phase; onTake: () => void; onStart: (j: Job) => void; onServe: (c: Patron) => void; shake: string | null }) {
  const counter = atCounter(sh);
  const seated = sh.patrons.filter(c => c.phase === 'wait');
  if (!counter && !seated.length) return <p className="sf-empty">{phase === 'brief' ? 'Open the shop to let customers in.' : sh.closing ? 'No more customers today.' : 'The next customer is on the way…'}</p>;
  return (
    <div className="sf-tickets">
      {counter && counter.order.kind === 'restaurant' && !counter.order.taken && (
        <div className="sf-ticket is-new">
          <p className="sf-who">
            <Face c={counter} /> <b>{counter.name}</b> <small>at the counter</small>
          </p>
          <Patience c={counter} />
          <button type="button" className="gold-btn sf-take" onClick={onTake} aria-label={`Take ${counter.name}'s order`}>
            Take the order
          </button>
        </div>
      )}
      {seated.map(c => {
        if (c.order.kind !== 'restaurant') return null;
        const jobs = sh.jobs.filter(j => j.patron === c.id);
        const ready = mealReady(sh, c.id);
        return (
          <div key={c.id} className={`sf-ticket${ready ? ' is-ready' : ''}`} aria-label={`${c.name}'s order`}>
            <p className="sf-who">
              <Face c={c} /> <b>{c.name}</b>
              <small>{c.order.to === 'here' ? '🍽️ eat here' : '🥡 take away'}</small>
            </p>
            <Patience c={c} />
            {jobs.map(j => (
              <span key={j.id} className={`sf-dish is-${j.where === 'pass' ? 'done' : j.where === 'ticket' ? 'todo' : 'doing'}${shake === `job${j.id}` ? ' is-shake' : ''}`}>
                <i aria-hidden="true">{dishOf(j.dish).icon}</i>
                <span>
                  <b>{dishOf(j.dish).name}</b>
                  <small>{j.where in STATIONS ? `on the ${STATIONS[j.where as StationId].name.toLowerCase()}` : WHERE[j.where]}</small>
                </span>
                {j.where === 'ticket' && (
                  <button type="button" className="sf-mini" onClick={() => onStart(j)} aria-label={`Start ${dishOf(j.dish).name} for ${c.name}`}>
                    Start
                  </button>
                )}
                {j.where === 'pass' && <b aria-hidden="true">✓</b>}
              </span>
            ))}
            {ready && (
              <button type="button" className="gold-btn sf-take" onClick={() => onServe(c)} aria-label={`Serve ${c.name}`}>
                Serve {c.name}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Hands({ sh, hands, onPack, onBin, shake }: { sh: Shift; hands: Job | null; onPack: (k: 'plate' | 'box') => void; onBin: () => void; shake: string | null }) {
  const c = hands ? sh.patrons.find(x => x.id === hands.patron) : null;
  let todo = 'Tap Start on an order to begin a dish.';
  if (hands) {
    const next = nextStation(hands);
    if (hands.step === 0) todo = `Take from the store: ${needsFood(hands).map(short).join(', ')}`;
    else if (next) todo = `${STATIONS[next].verb} it: tap the ${STATIONS[next].name.toLowerCase()}`;
    else if (readyToPack(hands)) todo = c && c.order.kind === 'restaurant' && c.order.to === 'away' ? 'Ready! Box it to take away' : 'Ready! Plate it to eat here';
  }
  return (
    <>
      <p className="sf-h">In your hands</p>
      {hands ? (
        <div className="sf-hand">
          <p className="sf-who">
            <i aria-hidden="true">{dishOf(hands.dish).icon}</i> <b>{dishOf(hands.dish).name}</b>
          </p>
          <small>for {c?.name ?? 'a customer'}</small>
          <ol className="sf-steps" aria-label="The recipe">
            <li className={hands.step > 0 ? 'is-done' : 'is-now'}>🧺 Gather</li>
            {RECIPES[hands.dish].map((st, i) => (
              <li key={i} className={hands.step > i + 1 ? 'is-done' : hands.step === i + 1 ? 'is-now' : ''}>
                {STATIONS[st.at].icon} {STATIONS[st.at].verb}
              </li>
            ))}
            <li className={readyToPack(hands) ? 'is-now' : ''}>🍽️ Pack</li>
          </ol>
          <p className="sf-todo">{todo}</p>
        </div>
      ) : (
        <p className="sf-empty">{todo}</p>
      )}
      <span className="sf-packs">
        <button type="button" className={`gold-btn${shake === 'plate' ? ' is-shake' : ''}`} disabled={!hands || !readyToPack(hands)} onClick={() => onPack('plate')} aria-label="Plate it (eat here)">
          🍽️ Plate
        </button>
        <button type="button" className={`gold-btn${shake === 'box' ? ' is-shake' : ''}`} disabled={!hands || !readyToPack(hands)} onClick={() => onPack('box')} aria-label="Box it (take away)">
          🥡 Box
        </button>
      </span>
      {hands && (
        <button type="button" className="sf-link is-block" onClick={onBin}>
          Start this dish again
        </button>
      )}
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
          <li>
            Customers walk in and order at the counter: <b>take the order</b>, and they sit down to wait.
          </li>
          <li>Start a dish, take its food from the store, then chop, boil, fry, bake or blend it at the kitchen’s stations. Take it off the fire before it burns!</li>
          <li>
            <b>Plate</b> it to eat here, or <b>box</b> it to take away, as they asked; then serve them.
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
