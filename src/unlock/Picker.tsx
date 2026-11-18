import { money } from '../money';
import { LockTag, OpenLine } from './Lock';
import { isOpen, type UnlockHost } from './model';

/* One dialog for choosing between a buying decision's options: a card for each (what it is, its numbers, its
   price), the ones that open later locked with the day or level that opens them. Used by the power system's parts,
   and anywhere else a choice is made before a mini-game or a purchase. */

export interface PickOption {
  id: string;
  name: string;
  does: string;
  /** short facts: "3 kW", "Room for 20 hens" */
  facts?: string[];
  /** its price (null: no price shown) */
  price?: number | null;
}

export function OptionPicker({
  s,
  kicker,
  title,
  lead,
  options,
  current,
  coins,
  verb = 'Choose',
  onPick,
  onClose,
}: {
  s: UnlockHost;
  kicker: string;
  title: string;
  lead?: string;
  options: PickOption[];
  /** the option already chosen, if any */
  current?: string | null;
  /** the money to hand: an option dearer than this can't be picked */
  coins?: number;
  verb?: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="mg" role="dialog" aria-modal="true" aria-label={`${title}: choose`}>
      <div className="scrim" onClick={onClose} />
      <div className="mg-card" style={{ width: 660 }}>
        <header className="mg-head">
          <small>{kicker}</small>
          <b>{title}</b>
          <button type="button" className="mg-x" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {lead && (
          <p className="pg-lead" style={{ margin: '4px 0 2px' }}>
            {lead}
          </p>
        )}
        <OpenLine s={s} total={options.length} />
        <div className="pg-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', overflowY: 'auto', maxHeight: 270 }}>
          {options.map((o, i) => {
            const open = isOpen(s, i);
            const short = coins !== undefined && o.price != null && coins < o.price;
            return (
              <div key={o.id} className={`pg-card${current === o.id ? ' is-done' : ''}${open ? '' : ' is-gated'}`} data-option={o.id}>
                <div className="pg-card-head">
                  <b>{o.name}</b>
                </div>
                <p>{o.does}</p>
                {o.facts && o.facts.length > 0 && <p className="opt-facts">{o.facts.join(' · ')}</p>}
                {open ? (
                  <button type="button" className="gold-btn" disabled={short} title={short ? `You need ${money(o.price!)}` : undefined} onClick={() => onPick(o.id)} aria-label={`${verb} ${o.name}`}>
                    {verb}
                    {o.price ? ` · ${money(o.price)}` : ''}
                  </button>
                ) : (
                  <LockTag s={s} index={i} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
