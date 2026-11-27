import { useEffect } from 'react';
import type { BrandId, SlotId } from './data';
import { partnerImpression, partnerTap } from './tracking';

/* Partner engagement on this device: how often each slot was seen and tapped. It is kept apart from the saved game
   (Reset progress does not clear it, and it never changes play), and shown on the Partners page's Placements tab,
   so a partner can see what a slot does. Each view and tap also goes to partner data tracking (tracking.ts), with the
   brand on the slot. */

const KEY = 'lima-farming-game:partners';

export type Engagement = Record<string, { views: number; taps: number }>;

export function engagement(): Engagement {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') as Engagement;
  } catch {
    return {};
  }
}

function bump(slot: SlotId, k: 'views' | 'taps') {
  try {
    const e = engagement();
    const row = e[slot] ?? { views: 0, taps: 0 };
    e[slot] = { ...row, [k]: row[k] + 1 };
    window.localStorage.setItem(KEY, JSON.stringify(e));
  } catch {
    /* storage blocked: nothing is counted */
  }
}

/** A slot was tapped (its offer opened); brand: the one it showed, when the slot shows partners in turn. */
export const tapSlot = (slot: SlotId, brand?: BrandId) => {
  bump(slot, 'taps');
  partnerTap(slot, brand);
};

/** Count one view each time a slot shows (once per showing, not per frame). A slot that shows partners in turn passes
    the brand showing, so each brand's turn is one impression for it (the slot's own count stays one per showing). */
export function useSlotView(slot: SlotId, showing = true, brand?: BrandId) {
  useEffect(() => {
    if (showing) bump(slot, 'views');
  }, [slot, showing]);
  useEffect(() => {
    if (showing) partnerImpression(slot, brand);
  }, [slot, showing, brand]);
}
