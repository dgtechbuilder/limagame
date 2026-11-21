import type { ProduceId } from '../produce/model';
import { PRODUCE } from '../produce/model';
import { DAILY, FOODS, GROUPS, NUTRIENTS, NUTRIENT_IDS, amount, dayShare, fmt, nutritionOf, peopleDays, pct, strongestOf, type NutrientId, type Nutrition } from './data';

/* The small nutrition markers seen across the game (seeds, the growing farms, harvests, the market stall and the
   restaurant), a crop's full nutrition as bars, a harvest's nutrition in people fed, and every crop side by side. */

/** A food's markers: what 100 g gives of a day's need, for the nutrients it is best for. */
export function NutriChips({ food, max = 3, label, compact }: { food: ProduceId; max?: number; label?: string; compact?: boolean }) {
  const f = FOODS[food];
  if (!f) return null;
  return (
    <span className={`nu-chips${compact ? ' is-compact' : ''}`} role="note" aria-label={`${label ?? PRODUCE[food].name} nutrition, in 100 g: ${GROUPS[f.group].role.toLowerCase()}; ${f.strong.slice(0, max).map(n => `${NUTRIENTS[n].name} ${pct(dayShare(food, n))} of a day`).join(', ')}`}>
      {!compact && (
        <span className="nu-group" style={{ background: GROUPS[f.group].color }} title={`${GROUPS[f.group].name}: ${GROUPS[f.group].role.toLowerCase()}`}>
          {GROUPS[f.group].role}
        </span>
      )}
      {f.strong.slice(0, max).map(n => (
        <span key={n} className="nu-chip" style={{ borderColor: NUTRIENTS[n].color }} title={`100 g: ${amount(n, f.per100[n])} of ${NUTRIENTS[n].name.toLowerCase()}, ${pct(dayShare(food, n))} of an adult's daily need`}>
          <i aria-hidden="true">{NUTRIENTS[n].icon}</i>
          {compact ? '' : `${NUTRIENTS[n].short} `}
          {pct(dayShare(food, n))}
        </span>
      ))}
    </span>
  );
}

/** A total's markers: the nutrients it is richest in, as people fed for a day. */
export function NutriTotal({ total, top = 3, prefix, compact }: { total: Nutrition; top?: number; prefix?: string; compact?: boolean }) {
  const d = peopleDays(total);
  const best = strongestOf(total, top);
  if (compact)
    return (
      <span className="nu-chips is-compact" role="note" aria-label={`${prefix ?? 'Feeds'}: ${best.map(n => `${NUTRIENTS[n].name} for ${fmt(d[n])} people for a day`).join(', ')}`}>
        {best.map(n => (
          <span key={n} className="nu-chip" style={{ borderColor: NUTRIENTS[n].color }} title={`${NUTRIENTS[n].name}: a day's need for ${fmt(d[n])} adults`}>
            <i aria-hidden="true">{NUTRIENTS[n].icon}</i>
            {fmt(d[n])}
          </span>
        ))}
      </span>
    );
  return (
    <span className="nu-chips" role="note" aria-label={`${prefix ?? 'Feeds'}: ${best.map(n => `${NUTRIENTS[n].name} for ${fmt(d[n])} people for a day`).join(', ')}`}>
      {prefix && <span className="nu-lead">{prefix}</span>}
      {best.map(n => (
        <span key={n} className="nu-chip" style={{ borderColor: NUTRIENTS[n].color }} title={`${amount(n, total[n])} of ${NUTRIENTS[n].name.toLowerCase()}: a day's need for ${fmt(d[n])} adults`}>
          <i aria-hidden="true">{NUTRIENTS[n].icon}</i>
          {NUTRIENTS[n].short} · {fmt(d[n])} {Math.round(d[n]) === 1 ? 'person' : 'people'}
        </span>
      ))}
    </span>
  );
}

/** A plate's nutrition, as a share of a day's need. */
export function PlateBars({ total }: { total: Nutrition }) {
  return (
    <div className="nu-bars" role="list" aria-label="One plate, as a share of an adult's daily need">
      {NUTRIENT_IDS.map(n => {
        const share = total[n] / DAILY[n];
        return (
          <div key={n} className="nu-bar" role="listitem" aria-label={`${NUTRIENTS[n].name}: ${amount(n, total[n])}, ${pct(share)} of a day`}>
            <span className="nu-bar-name">
              <i aria-hidden="true">{NUTRIENTS[n].icon}</i> {NUTRIENTS[n].short}
            </span>
            <span className="nu-bar-track">
              <span style={{ width: `${Math.min(100, share * 100)}%`, background: NUTRIENTS[n].color }} />
            </span>
            <b>{pct(share)}</b>
          </div>
        );
      })}
    </div>
  );
}

/** One food's whole nutrition in 100 g. */
export function FoodCard({ food }: { food: ProduceId }) {
  const f = FOODS[food];
  return (
    <div className="pg-card nu-card">
      <div className="pg-card-head">
        <i aria-hidden="true">{PRODUCE[food].icon}</i>
        <b>{PRODUCE[food].name}</b>
        <small>{GROUPS[f.group].name}</small>
      </div>
      <p>{f.note}</p>
      <PlateBars total={nutritionOf({ [food]: 0.1 })} />
    </div>
  );
}

const COLS: NutrientId[] = ['energy', 'protein', 'fibre', 'iron', 'calcium', 'vitA', 'vitC'];

/** Every crop side by side, in 100 g: the best of each nutrient is marked. */
export function CompareTable({ foods, onPick, picked }: { foods: ProduceId[]; onPick?: (f: ProduceId) => void; picked?: ProduceId }) {
  const best = Object.fromEntries(COLS.map(n => [n, Math.max(...foods.map(f => FOODS[f].per100[n]))])) as Record<NutrientId, number>;
  return (
    <table className="pg-table nu-table" aria-label="Nutrition in 100 g of each crop, as a share of an adult's daily need">
      <thead>
        <tr>
          <th>100 g of</th>
          {COLS.map(n => (
            <th key={n} className="is-num" title={NUTRIENTS[n].does}>
              <span aria-hidden="true">{NUTRIENTS[n].icon}</span> {NUTRIENTS[n].short}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {foods.map(f => (
          <tr key={f} className={picked === f ? 'is-picked' : undefined}>
            <td>
              {onPick ? (
                <button type="button" className="nu-pick" onClick={() => onPick(f)} aria-pressed={picked === f}>
                  {PRODUCE[f].icon} {PRODUCE[f].name}
                </button>
              ) : (
                <>
                  {PRODUCE[f].icon} {PRODUCE[f].name}
                </>
              )}
            </td>
            {COLS.map(n => {
              const v = FOODS[f].per100[n];
              const share = v / DAILY[n];
              return (
                <td key={n} className={`is-num nu-cell${v > 0 && v === best[n] ? ' is-best' : ''}`} title={`${amount(n, v)}: ${pct(share)} of a day`}>
                  <span className="nu-heat" style={{ opacity: Math.min(0.5, 0.06 + share * 0.45), background: NUTRIENTS[n].color }} aria-hidden="true" />
                  <b>{pct(share)}</b>
                  <small>{amount(n, v)}</small>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
