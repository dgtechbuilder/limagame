import { useState, type Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { Info } from '../learn/Info';
import { money, fromUsd } from '../money';
import { lifeOf } from '../livestock/model';
import { FACTORS } from '../climate/model';
import { areasOf, payRate } from '../climate/land';
import type { Action, GameState } from '../state';
import { PlantArt } from './art';
import {
  FOREST,
  FOREST_FULL,
  KINDS,
  PLANTS,
  REAL_PRICE_USD,
  SOURCES,
  forestOf,
  forestRate,
  grownOf,
  grownOn,
  plantOf,
  quoteSale,
  realTonnes,
  standRate,
  standStatus,
  type Plant,
  type PlantId,
  type PlantKind,
  type SaleQuote,
} from './model';

/* The mini forest: its native trees, bushes and grasses, a card for each (what it is, what it gives, what it does for
   the climate, where the figure comes from), and its harvests. Before anything is sold the player sees the money it
   brings against what it costs the climate: the CO₂ back in the air, the credits cancelled, the carbon it will not
   store while it grows back, and what else the land loses. Opened at the forest's sign on the farm, or the menu. */

const kg = (n: number) => `${n >= 100 ? Math.round(n).toLocaleString('en') : Math.round(n * 10) / 10} kg`;

export function ForestPage({ s, dispatch, tab = 'tree', plant }: { s: GameState; dispatch: Dispatch<Action>; tab?: PlantKind; plant?: PlantId }) {
  const day = lifeOf(s.life).day;
  const f = forestOf(s.forest);
  const open = (t: PlantKind, p?: PlantId) => dispatch({ type: 'open', modal: { kind: 'forest', tab: t, plant: p } });
  const now = forestRate(f, day);
  const ready = PLANTS.filter(p => p.kind === tab && standStatus(f.stands[p.id], day) === 'ready').length;
  return (
    <Page
      title="Mini forest"
      icon="🌳"
      tabs={KINDS.map(k => ({ id: k.id, label: k.label, icon: k.icon, badge: PLANTS.filter(p => p.kind === k.id && standStatus(f.stands[p.id], day) === 'ready').length || undefined }))}
      tab={tab}
      onTab={t => open(t)}
      dispatch={dispatch}
      className="fo-page"
      foot={
        <>
          {FOREST.acres} acres of plants native to Africa
          <br />
          Storing {kg(now)} CO₂ a day
        </>
      }
    >
      {plant && plantOf(plant).kind === tab ? (
        <PlantCard s={s} dispatch={dispatch} p={plantOf(plant)} onBack={() => open(tab)} />
      ) : (
        <>
          <div className="pg-tiles">
            <Tile label="Stores a day" value={kg(now)} sub={now < FOREST_FULL - 0.05 ? `${kg(FOREST_FULL)} when every stand is grown` : 'every stand fully grown'} tone={now < FOREST_FULL - 0.05 ? undefined : 'good'} />
            <Tile label="Credits a day" value={(now / FACTORS.credit.value).toFixed(1)} sub={`1 credit = ${FACTORS.credit.value} kg CO₂ kept out of the air`} />
            <Tile label="Earned here" value={money(PLANTS.reduce((n, p) => n + f.stands[p.id].earned, 0))} sub="from harvests and sales" />
            <Tile label="Ready to harvest" value={`${ready}`} sub={`${KINDS.find(k => k.id === tab)!.label.toLowerCase()} on this page`} tone={ready ? 'good' : undefined} />
          </div>
          <p className="pg-lead">
            {tab === 'tree'
              ? 'Trees hold the most carbon, in their trunks, branches and roots. Take their nuts, fruit and pods and they keep growing; fell them and that carbon goes back into the air.'
              : tab === 'bush'
                ? 'Bushes feed the soil, the bees and the animals. Most give berries or leaves again and again.'
                : 'Grasses keep their carbon in the soil, through their roots. Cut them and they grow back; their roots never leave.'}{' '}
            Tap a plant to learn what it does for the climate.
          </p>
          <div className="pg-grid fo-grid">
            {PLANTS.filter(p => p.kind === tab).map(p => {
              const st = f.stands[p.id];
              const status = standStatus(st, day);
              return (
                <button key={p.id} type="button" className={`pg-card fo-card${status === 'ready' ? ' is-due' : ''}`} onClick={() => open(tab, p.id)} aria-label={`${p.name}: ${statusWords(p, st, day)}`}>
                  <PlantArt id={p.id} size={132} young={grownOf(st, day)} />
                  <div className="pg-card-head">
                    <b>{p.name}</b>
                    <small>{p.acres} acre{p.acres === 1 ? '' : 's'}</small>
                  </div>
                  <p className="fo-latin">{p.latin}</p>
                  <p className="fo-rate">Stores {kg(standRate(st, day))} CO₂ a day</p>
                  <p className={`pg-status${status === 'ready' ? '' : ' is-wait'}`}>{statusWords(p, st, day)}</p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}

function statusWords(p: Plant, st: ReturnType<typeof forestOf>['stands'][PlantId], day: number) {
  const status = standStatus(st, day);
  if (status === 'growing') return `Growing from seedlings · grown on day ${grownOn(st)}`;
  if (status === 'regrowing') return `${p.crop.verb} again on day ${st.cropAt}`;
  return `Ready: ${p.crop.verb.toLowerCase()}`;
}

function PlantCard({ s, dispatch, p, onBack }: { s: GameState; dispatch: Dispatch<Action>; p: Plant; onBack: () => void }) {
  const day = lifeOf(s.life).day;
  const st = forestOf(s.forest).stands[p.id];
  const [ask, setAsk] = useState<'crop' | 'fell' | null>(null);
  const rate = payRate(s.climate.level);
  const crop = quoteSale(s.forest, p.id, 'crop', day, FACTORS.credit.value, rate);
  const fell = quoteSale(s.forest, p.id, 'fell', day, FACTORS.credit.value, rate);
  const src = SOURCES[p.source];
  const status = standStatus(st, day);
  return (
    <div className="fo-plant">
      <div className="fo-plant-top">
        <PlantArt id={p.id} size={150} young={grownOf(st, day)} label={`${p.name}, drawn`} />
        <div className="fo-plant-head">
          <button type="button" className="fo-back" onClick={onBack}>
            ‹ All {KINDS.find(k => k.id === p.kind)!.label.toLowerCase()}
          </button>
          <h3 className="fo-name">
            {p.name} <Info term={p.term} size={14} />
          </h3>
          <p className="fo-latin">
            {p.latin} · {p.local}
          </p>
          <p className="pg-lead">{p.what}</p>
        </div>
      </div>

      <p className="pg-h">What it does for the climate</p>
      <div className="pg-tiles">
        <Tile label="Stores an acre a day" value={kg(p.kgDay)} sub={`${Math.round((p.kgDay * 365) / 100) / 10} t CO₂ an acre a year`} tone="good" />
        <Tile label="This stand, today" value={kg(standRate(st, day))} sub={`${p.acres} acre${p.acres === 1 ? '' : 's'} · ${(standRate(st, day) / FACTORS.credit.value).toFixed(1)} credits a day`} tone="good" />
        <Tile label="Credited so far" value={kg(st.credited)} sub={`${(st.credited / FACTORS.credit.value).toFixed(1)} credits paid to you`} />
        <Tile label="In real life" value={p.fell ? `${realTonnes(p)} t` : p.real.split(';')[0]} sub={p.fell ? `CO₂ an acre holds at ${p.years} years` : 'how long it takes'} />
      </div>
      <ul className="fo-good" aria-label={`What ${p.name.toLowerCase()} gives the farm`}>
        {p.good.map(g => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      <p className="fo-source">
        {p.estimate ? 'Estimate. ' : ''}
        {p.how}. Source:{' '}
        <a href={src.url} target="_blank" rel="noreferrer">
          {src.name}
        </a>
        . {p.real}.
      </p>

      <p className="pg-h">Harvest or sell</p>
      <div className="pg-row">
        <i aria-hidden="true">🧺</i>
        <span className="pg-row-text">
          <b>
            {p.crop.verb}: {p.crop.what}
          </b>
          <small>{crop.ok ? p.crop.note : crop.why}</small>
        </span>
        <button type="button" className="gold-btn fo-btn" disabled={!crop.ok} onClick={() => setAsk('crop')}>
          {p.crop.verb} · +{money(crop.coins)}
        </button>
      </div>
      <div className="pg-row">
        <i aria-hidden="true">🪓</i>
        <span className="pg-row-text">
          <b>{p.fell ? `${p.fell.verb}: ${p.fell.what}` : 'Not felled'}</b>
          <small>{p.fell ? (fell.ok ? `Once, for ${money(fell.coins)}: then it grows again from seedlings for ${p.grow} days.` : fell.why) : p.noFell}</small>
        </span>
        {p.fell && (
          <button type="button" className="gold-btn fo-btn" disabled={!fell.ok} onClick={() => setAsk('fell')}>
            {p.fell.verb} · +{money(fell.coins)}
          </button>
        )}
      </div>
      {status === 'growing' && <p className="pg-lead">Growing back from seedlings: it stores {kg(standRate(st, day))} CO₂ a day now, {kg(p.kgDay * p.acres)} once grown on day {grownOn(st)}.</p>}

      {ask && <BeforeSale s={s} p={p} q={ask === 'crop' ? crop : fell} onClose={() => setAsk(null)} dispatch={dispatch} />}
    </div>
  );
}

/** Before a sale: the money against the climate. */
function BeforeSale({ s, p, q, onClose, dispatch }: { s: GameState; p: Plant; q: SaleQuote; onClose: () => void; dispatch: Dispatch<Action> }) {
  const fell = q.kind === 'fell';
  // the farm's daily credits now, and after: how long the next climate payments wait while the credits are earned back
  const daily = Math.max(0.01, areasOf(s).reduce((n, a) => n + a.credits, 0) - (q.before - q.after) / FACTORS.credit.value);
  const cancelled = Math.min(s.climate.credits, q.credits);
  const wait = Math.ceil(cancelled / daily);
  const real = realTonnes(p);
  const go = () => {
    dispatch({ type: 'forestSell', id: p.id, kind: q.kind });
    onClose();
  };
  const keep = () => {
    if (fell) dispatch({ type: 'forestKeep', id: p.id });
    onClose();
  };
  return (
    <div className="fo-ask" role="dialog" aria-modal="true" aria-label={`Before you sell: ${p.name}`}>
      <div className="fo-ask-card ui-sheet">
        <p className="ui-title">Before you sell: {fell ? `${p.fell!.verb.toLowerCase()}` : p.crop.verb.toLowerCase()}</p>
        <p className="ui-lead">
          {fell
            ? `The ${p.name.toLowerCase()} stand holds about ${kg(q.held)} of CO₂. Here is what selling it does to your money, the climate and your credits.`
            : `${p.crop.what[0].toUpperCase()}${p.crop.what.slice(1)}: here is what taking them does to your money, the climate and your credits.`}
        </p>
        <div className="fo-weigh">
          <div className="fo-side is-money">
            <p className="fo-side-h">Money</p>
            <p className="fo-big pg-in">+{money(q.coins)}</p>
            <p className="fo-small">now, for {fell ? p.fell!.what : p.crop.what}</p>
            {fell && cancelled > 0 && <p className="fo-small pg-out">Credits worth {money(cancelled * payRate(s.climate.level))} cancelled</p>}
          </div>
          <div className="fo-side is-climate">
            <p className="fo-side-h">Climate and land</p>
            <ul className="fo-list">
              <li className={q.co2 ? 'pg-out' : 'pg-in'}>{q.co2 ? `${kg(q.co2)} CO₂ back into the air${p.fell?.keeps ? ` (${Math.round(p.fell.keeps * 100)}% stays locked in ${p.fell.keptIn ?? 'the wood'})` : ''}` : 'No stored carbon goes back into the air'}</li>
              <li className={cancelled ? 'pg-out' : 'pg-in'}>{cancelled ? `${cancelled.toFixed(1)} credits cancelled` : 'No credits lost'}</li>
              {q.after < q.before - 0.01 ? (
                <li className="pg-out">
                  Stores {kg(q.after)} a day instead of {kg(q.before)} for {q.days} day{q.days === 1 ? '' : 's'}: {kg(q.missed)} CO₂ it will not take out of the air
                </li>
              ) : (
                <li className="pg-in">Keeps storing {kg(q.before)} CO₂ a day</li>
              )}
              {q.losses.map(l => (
                <li key={l} className="pg-out">
                  {l}
                </li>
              ))}
              {fell && wait > 0 && <li className="pg-out">Your climate payments wait about {wait} day{wait === 1 ? '' : 's'} while the farm earns those credits back</li>}
            </ul>
          </div>
        </div>
        <p className="fo-why">
          {fell ? (
            <>
              In real life an acre like this holds about <b>{real} t of CO₂</b> after {p.years} years: {money(fromUsd(real * REAL_PRICE_USD))} of carbon credits at ${REAL_PRICE_USD} a tonne. When trees that earned credits are cut, a carbon project cancels those credits (a reversal) <Info term="reversal" size={12} />. Trees cut faster than they regrow are a big cause of climate change.
            </>
          ) : (
            <>The carbon in a crop goes back into the air within weeks, when it is eaten or burned, but it was never counted as credits: the plant and its roots keep what they store. Harvesting like this is how a forest pays and stays a forest.</>
          )}
        </p>
        <div className="fo-ask-btns">
          <button type="button" className="fo-keep" onClick={keep}>
            {fell ? 'Keep it standing' : 'Not now'}
          </button>
          <button type="button" className="gold-btn" onClick={go}>
            {fell ? `Sell for ${money(q.coins)}` : `${p.crop.verb} · +${money(q.coins)}`}
          </button>
        </div>
      </div>
    </div>
  );
}


