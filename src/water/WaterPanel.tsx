import type { Dispatch } from 'react';
import type { Action, GameState } from '../state';
import { money } from '../money';
import { CREDIT_TYPES, ledgerOf, type CreditType } from '../credits/ledger';
import { WATER } from './config';
import { animalsUse, capacityOf, coverQuote, damDay, forecastOf, hasCover, irrigationWant, rainIn, tankOf, useToday } from './model';

/* Climate › Water: the tank as a real object (its level, what comes in and goes out today), buying water, the cows
   and hens, crop cover priced on the farm's water practices, and the shared catchment. Climate › Credits: the ledger
   of every kind of credit. */

const L = (n: number) => `${Math.round(n).toLocaleString('en-US')} L`;

/** The tank, drawn: its level as water in a barrel. */
export function TankGauge({ level, capacity, size = 64 }: { level: number; capacity: number; size?: number }) {
  const share = Math.max(0, Math.min(1, level / Math.max(1, capacity)));
  const low = share < WATER.tank.low;
  const h = size * 1.2;
  return (
    <svg viewBox={`0 0 ${size} ${h}`} width={size} height={h} aria-hidden="true" className="wt-gauge">
      <rect x={4} y={6} width={size - 8} height={h - 10} rx={8} fill="#e8f1f5" stroke="#3d6e86" strokeWidth={2.5} />
      <clipPath id={`wt-clip-${size}`}>
        <rect x={6} y={8} width={size - 12} height={h - 14} rx={6} />
      </clipPath>
      <rect clipPath={`url(#wt-clip-${size})`} x={6} y={8 + (h - 14) * (1 - share)} width={size - 12} height={(h - 14) * share} fill={low ? '#e0794a' : '#3aa0d8'} />
      <rect x={size / 2 - 8} y={1} width={16} height={6} rx={2} fill="#3d6e86" />
      {[0.25, 0.5, 0.75].map(k => (
        <line key={k} x1={size - 14} x2={size - 6} y1={8 + (h - 14) * (1 - k)} y2={8 + (h - 14) * (1 - k)} stroke="#3d6e86" strokeWidth={1.2} />
      ))}
    </svg>
  );
}

export function WaterTab({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const tank = tankOf(s.tank);
  const cap = capacityOf(s);
  const f = forecastOf(s);
  const rain = rainIn(f);
  const use = useToday(s);
  const net = rain - use.total;
  const daysLeft = net < 0 ? Math.floor(tank.level / -net) : null;
  const q = coverQuote(s);
  const covered = hasCover(s);
  const want = irrigationWant(s);
  const dam = damDay(tank.dam, f, want, tank.policy);
  const low = tank.level < cap * WATER.tank.low;
  const herd = tank.herd;
  const setHerd = (cows: number, hens: number) => dispatch({ type: 'herdSet', cows, hens });
  return (
    <div className="wt">
      <div className="wt-col">
        <div className={`wt-tank${low ? ' is-low' : ''}`}>
          <TankGauge level={tank.level} capacity={cap} size={56} />
          <div>
            <p className="set-title">The tank</p>
            <p className="wt-big">{L(tank.level)}</p>
            <p className="wt-sub">
              of {L(cap)} · {Math.round((100 * tank.level) / cap)}% full{low ? ' · low' : ''}
            </p>
            <p className="wt-sub">{daysLeft === null ? 'The rain keeps up with the use.' : `At today’s use: about ${daysLeft} day${daysLeft === 1 ? '' : 's'} left.`}</p>
          </div>
        </div>
        <dl className="wt-flows" aria-label="Water today">
          <div>
            <dt>Rain off the roofs ({f})</dt>
            <dd className="is-in">+{L(rain)}</dd>
          </div>
          <div>
            <dt>The house</dt>
            <dd>−{L(use.house)}</dd>
          </div>
          <div>
            <dt>Cows and hens</dt>
            <dd>−{L(use.animals)}</dd>
          </div>
          <div>
            <dt>The rows, by hand</dt>
            <dd>−{L(use.farms)}</dd>
          </div>
          <div className="is-total">
            <dt>A day</dt>
            <dd className={net < 0 ? 'is-out' : 'is-in'}>
              {net >= 0 ? '+' : '−'}
              {L(Math.abs(net))}
            </dd>
          </div>
        </dl>
        <div className="wt-buy">
          <button type="button" onClick={() => dispatch({ type: 'waterBuy', kind: 'piped' })}>
            <b>Piped water</b>
            <small>
              {L(WATER.piped.litres)} · {money(Math.round((WATER.piped.litres / 1000) * WATER.piped.per1000))}
            </small>
          </button>
          <button type="button" onClick={() => dispatch({ type: 'waterBuy', kind: 'transported' })}>
            <b>A bowser</b>
            <small>
              {L(WATER.transported.litres)} · {money(WATER.transported.price)}
            </small>
          </button>
        </div>
        <p className="set-body wt-note">
          A bigger tank (Shop › Tanks) catches more of the rain. With the tank low, a drought costs more and the rows can’t be watered by hand.
        </p>
      </div>

      <div className="wt-col">
        <p className="set-title">Animals</p>
        <div className="wt-herd">
          {(['cow', 'hen'] as const).map(k => {
            const n = k === 'cow' ? herd.cows : herd.hens;
            const step = k === 'cow' ? 1 : 4;
            const max = k === 'cow' ? WATER.herd.maxCows : WATER.herd.maxHens;
            const set = (v: number) => (k === 'cow' ? setHerd(v, herd.hens) : setHerd(herd.cows, v));
            return (
              <div key={k} className="wt-animal">
                <span>
                  <b>
                    {n} {WATER.animals[k].label.toLowerCase()}
                    {n === 1 ? '' : 's'}
                  </b>
                  <small>
                    {L(n * WATER.animals[k].litres)} a day · {Math.round(n * WATER.animals[k].co2 * 10) / 10} kg CO₂e
                  </small>
                </span>
                <button type="button" aria-label={`One ${k} fewer`} disabled={n <= 0} onClick={() => set(n - step)}>
                  −
                </button>
                <button type="button" aria-label={`One ${k} more`} disabled={n >= max} onClick={() => set(n + step)}>
                  +
                </button>
              </div>
            );
          })}
          <p className="wt-sub">Together {L(animalsUse(herd))} a day. A cow drinks as much as about 170 hens. Bought and sold at market prices (Animals › Herd).</p>
        </div>

        <p className="set-title" style={{ marginTop: 8 }}>
          Crop cover
        </p>
        <div className={`wt-cover${covered ? ' is-on' : ''}`}>
          <p className="wt-sub">
            Pays back {Math.round(WATER.cover.payout * 100)}% of what drought, flood and hail take at harvest. Water practices bring the price down:
          </p>
          <ul className="cl-list">
            {q.lines.length ? q.lines.map(l => <li key={l.label}>{l.label}: −{Math.round(l.off * 100)}%</li>) : <li>No water practices yet: mulch, zai pits, morning watering, a full tank.</li>}
          </ul>
          {covered ? (
            <p className="wt-cover-on">Covered this cycle ({money(tankOf(s.tank).cover!.premium)})</p>
          ) : (
            <button type="button" className="wt-cover-buy" onClick={() => dispatch({ type: 'coverBuy' })} aria-label={`Cover this cycle for ${money(q.premium)}`}>
              <span>Cover this cycle</span>
              <b>
                {money(q.premium)}
                {q.off > 0 && <s>{money(q.base)}</s>}
              </b>
            </button>
          )}
        </div>
      </div>

      <div className="wt-col">
        <p className="set-title">Shared catchment · {WATER.catchment.name}</p>
        <div className="wt-dam">
          <span className="wt-dam-bar">
            <i style={{ width: `${(100 * tank.dam) / WATER.catchment.capacity}%` }} className={dam.rationed ? 'is-low' : ''} />
          </span>
          <p className="wt-sub">
            {Math.round((100 * tank.dam) / WATER.catchment.capacity)}% full · {dam.rationed ? 'rationed: every household gets a share' : 'enough for everyone today'}
          </p>
        </div>
        <dl className="wt-flows is-dam" aria-label="Draws on the dam">
          <div>
            <dt>Your six farms</dt>
            <dd>
              {L(dam.got)}
              {want > dam.got ? ` of ${L(want)}` : ''}
            </dd>
          </div>
          {dam.neighbours.map(n => (
            <div key={n.name}>
              <dt>{n.name}</dt>
              <dd>{L(n.got)}</dd>
            </div>
          ))}
          <div className="is-total">
            <dt>Rain in today</dt>
            <dd className="is-in">+{L(dam.inflow)}</dd>
          </div>
        </dl>
        <div className="wt-policy" role="radiogroup" aria-label="When the dam runs low">
          <button type="button" role="radio" aria-checked={tank.policy === 'full'} className={tank.policy === 'full' ? 'is-on' : ''} onClick={() => dispatch({ type: 'drawPolicy', policy: 'full' })}>
            Take what the plans need
          </button>
          <button type="button" role="radio" aria-checked={tank.policy === 'fair'} className={tank.policy === 'fair' ? 'is-on' : ''} onClick={() => dispatch({ type: 'drawPolicy', policy: 'fair' })}>
            Take a fair share
          </button>
        </div>
        <p className="set-body wt-note">A fair share leaves water for the neighbours when the dam is low: +{WATER.catchment.fairBonus} water credits a rationed day, and cheaper cover.</p>
      </div>
    </div>
  );
}

export function CreditsTab({ s }: { s: GameState }) {
  const l = ledgerOf(s.ledger);
  const types = Object.keys(CREDIT_TYPES) as CreditType[];
  return (
    <div className="cl-rows">
      <div className="cl-tiles is-two">
        {types.map(k => (
          <div key={k} className="cl-tile">
            <p className="cl-tile-label">{CREDIT_TYPES[k].label}</p>
            <p className="cl-tile-value">{(Math.round(l.paid[k] * 10) / 10).toLocaleString('en-US')}</p>
            <p className="cl-tile-sub">
              Paid {money(l.coins[k])} · 1 credit = {CREDIT_TYPES[k].unit}
            </p>
          </div>
        ))}
      </div>
      <p className="set-title" style={{ marginTop: 10 }}>
        Latest payments
      </p>
      {l.entries.length ? (
        <ul className="wt-ledger">
          {l.entries.slice(0, 12).map(e => (
            <li key={e.id}>
              <i className={`wt-tag is-${e.type}`}>{e.type === 'co2' ? 'CO₂' : 'Water'}</i>
              <span>{e.label}</span>
              <b>
                {Math.round(e.amount * 10) / 10} · +{money(e.coins)}
              </b>
            </li>
          ))}
        </ul>
      ) : (
        <p className="set-body">No credits paid yet. They are paid at the end of each day: CO₂ credits for carbon kept in the soil and the forest, water credits for every 100 L under the farm’s baseline of {WATER.credits.baseline} L a day.</p>
      )}
    </div>
  );
}
