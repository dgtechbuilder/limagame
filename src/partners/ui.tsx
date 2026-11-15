import { useEffect, useState, type CSSProperties, type Dispatch } from 'react';
import type { Action } from '../state';
import { ROTATION_MS, activeBrands, brandOf, slotBrand, type Brand, type BrandId, type SlotId } from './data';
import { tapSlot, useSlotView } from './track';

/* The pieces every partner placement is made of: the brand's mark, a "with <brand>" line under a screen, and the
   billboard on the classic farm. Each counts its views and taps for the Placements tab, and opens the brand's offer
   on the Partners page. A slot with no partner signed shows nothing to players. */

/** Open the Partners page at a brand's offer, counting the tap for the slot it came from. */
export const openOffer = (dispatch: Dispatch<Action>, slot: SlotId, brand: BrandId) => {
  tapSlot(slot);
  dispatch({ type: 'open', modal: { kind: 'partners', tab: 'offers', brand } });
};

/** The brand's mark: a round badge in its colours. */
export function BrandMark({ b, size = 18 }: { b: Brand; size?: number }) {
  return (
    <span className="brand-mark" aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.58, background: b.color, boxShadow: `0 0 0 ${Math.max(1, size / 12)}px ${b.accent}` }}>
      {b.mark}
    </span>
  );
}

/** "<label> <brand>": a small tappable line naming a slot's partner. */
export function SponsorLine({ slot, label, dispatch, style, className = '' }: { slot: SlotId; label: string; dispatch: Dispatch<Action>; style?: CSSProperties; className?: string }) {
  const b = slotBrand(slot);
  useSlotView(slot, !!b);
  if (!b) return null;
  return (
    <button type="button" className={`sponsor-line ${className}`} style={style} onClick={() => openOffer(dispatch, slot, b.id)} aria-label={`${label} ${b.name}: see the offer`}>
      <span>{label}</span>
      <BrandMark b={b} size={14} />
      <b>{b.name}</b>
    </button>
  );
}

/** A branded product's ribbon in the Shop. */
export function PartnerRibbon({ brand }: { brand: BrandId }) {
  const b = brandOf(brand);
  if (!b) return null;
  return (
    <span className="partner-ribbon" style={{ background: b.color, color: '#fff' }}>
      {b.name}
    </span>
  );
}

/** The roadside sign on the classic farm: the partners in turn (or the slot's own partner, if one has bought it). */
export function ClassicBillboard({ dispatch, left, top }: { dispatch: Dispatch<Action>; left: number; top: number }) {
  const own = slotBrand('classic-billboard');
  const list = own ? [own] : activeBrands();
  const [i, setI] = useState(0);
  useSlotView('classic-billboard', list.length > 0);
  useEffect(() => {
    if (list.length < 2) return;
    const id = window.setInterval(() => setI(n => (n + 1) % list.length), ROTATION_MS);
    return () => window.clearInterval(id);
  }, [list.length]);
  const b = list[i % Math.max(1, list.length)];
  if (!b) return null;
  return (
    <button
      type="button"
      key={b.id}
      className="billboard abs"
      style={{ left, top, background: b.color, ['--accent' as string]: b.accent }}
      onClick={() => openOffer(dispatch, 'classic-billboard', b.id)}
      aria-label={`Partner sign: ${b.name}, ${b.tagline}. See the offer`}
    >
      <BrandMark b={b} size={20} />
      <span>
        <b>{b.name}</b>
        <small>{b.tagline}</small>
      </span>
      <i>Partner</i>
    </button>
  );
}
