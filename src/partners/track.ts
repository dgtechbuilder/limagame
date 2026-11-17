import { useEffect } from 'react';
import type { SlotId } from './data';

/* Partner engagement on this device: how often each slot was seen and tapped. It is kept apart from the saved game
   (Reset progress does not clear it, and it never changes play), and shown on the Partners page's Placements tab,
   so a partner can see what a slot does. Nothing leaves the phone. */

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

/** A slot was tapped (its offer opened). */
export const tapSlot = (slot: SlotId) => bump(slot, 'taps');

/** Count one view each time a slot shows (once per showing, not per frame). */
export function useSlotView(slot: SlotId, showing = true) {
  useEffect(() => {
    if (showing) bump(slot, 'views');
  }, [slot, showing]);
}
