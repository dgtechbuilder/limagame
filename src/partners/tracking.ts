import { useEffect, useRef } from 'react';
import { callbackSink, createPartnerTracker, flatten, regionOf, storageSink, type Campaign, type PartnerContext, type PartnerTracker } from '@temolima/partner-tracking';
import { SHOP_TABS } from '../data';
import { track } from '../first/track';
import { REWARD_SPONSOR, offerCode, slotOf, type BrandId, type SlotId } from './data';
import type { GameState } from '../state';

/* The game's partner data tracking, built on the @temolima/partner-tracking package (packages/partner-tracking).

   Where each partner metric comes from:
   21 impressions, 22 taps:  every placement already counts its showings and taps (track.ts); each also goes here,
                             with the brand on it.
   23 products used:         a partner's branded shop item bought, then used for its job (Lima NPK for the NPK task).
   24 yield lift:            each harvest (the season's maize, each planted trial farm), with the brands whose products
                             went into it; the report compares harvests of the same kind with and without each brand.
   25 reach, 26 profile:     every event carries the country and its region, and whether the player is new or has
                             harvested before. The game asks no age, so no age band is sent.
   27 learning:              Farm basics lessons read and certificates claimed (the certification sponsor), courses
                             booked (the training sponsor).
   28 credits:               credits earned through a partner-linked practice (CREDIT_LINKS below).
   29 leads:                 offer codes taken, sponsored vouchers redeemed, courses booked, "Visit" taps.
   30 cost per engaged:      CAMPAIGNS below (the spend of each signed deal); the report divides it by engaged players.

   Events are kept on the device (the last 1,000, `lima-partner-events`) and go into the game's own event log as
   "partner_<type>", which sends them on through the outbox when VITE_EVENTS_URL is set. No new vendor; another sink
   plugs in with partnerTracker.addSink. Nothing is tracked in design review (?review, ?screen). */

const KEY = 'lima-partner-events';
const PLAYER_KEY = 'lima-partner-player';
const SEASON_KEY = 'lima-partner-season';

/** Partner campaigns and their spend (cost per engaged player). Empty until a partner signs a paid deal: add a row
    per campaign, e.g. { brand: 'hello-tractor', name: 'Planting 2027', spend: 5000, currency: 'USD', from: Date.UTC(2027, 0, 1) }. */
export const CAMPAIGNS: Campaign[] = [];

/** Credits earned through a practice linked to a partner: the credit type, the brand, the practice, and when it counts. */
const CREDIT_LINKS: { credit: 'co2' | 'water'; brand: BrandId; practice: string; when: (s: GameState) => boolean }[] = [
  { credit: 'water', brand: 'tangi', practice: 'rainwater stored in a Lima Tanks tank', when: s => s.inventory.includes('tank-tangi') },
  { credit: 'co2', brand: 'jua', practice: 'solar power', when: s => (s.power?.totals?.solar ?? 0) > 0 },
];

const reviewing = () => {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.has('review') || q.has('screen');
  } catch {
    return true;
  }
};

/** An anonymous id for this device's player: counts unique players and names no one (not the cloud player code). */
function playerId(): string {
  try {
    let id = window.localStorage.getItem(PLAYER_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      window.localStorage.setItem(PLAYER_KEY, id);
    }
    return id;
  } catch {
    return 'anonymous';
  }
}

/** The player as a partner report sees them; App's state keeps it current (usePartnerSignals). */
export const partnerContext: PartnerContext = { playerId: '' };

export const contextOf = (s: Pick<GameState, 'settings' | 'trialHistory' | 'season' | 'harvested'>): Omit<PartnerContext, 'playerId'> => ({
  country: s.settings.country || '',
  region: regionOf(s.settings.country),
  experience: s.trialHistory.length > 0 || s.season > 1 || !!s.harvested ? 'experienced' : 'new',
});

/** The device's partner event store (the Partners page or a test can read it). */
export const partnerStore = storageSink({ key: KEY, limit: 1000 });

export const partnerTracker: PartnerTracker = createPartnerTracker({
  context: () => ({ ...partnerContext, playerId: partnerContext.playerId || (partnerContext.playerId = playerId()) }),
  enabled: () => typeof window !== 'undefined' && !reviewing(),
  sinks: [
    partnerStore,
    callbackSink(e => {
      const f = flatten(e);
      track(f.name, f.data);
    }),
  ],
});

/** The brand on a slot, for placements that show one brand at a time. */
const brandOnSlot = (slot: SlotId) => slotOf(slot)?.brand ?? null;

/** 21: a placement showed (the brand: the one it shows, or the slot's own). */
export function partnerImpression(slot: SlotId | string, brand?: BrandId | null) {
  const b = brand ?? brandOnSlot(slot as SlotId);
  if (b) partnerTracker.impression(b, slot);
}

/** 22: a placement was tapped. */
export function partnerTap(slot: SlotId | string, brand?: BrandId | null) {
  const b = brand ?? brandOnSlot(slot as SlotId);
  if (b) partnerTracker.tap(b, slot);
}

/** 29: the player left for the partner's own site from its card. */
export const partnerVisit = (brand: BrandId) => partnerTracker.lead(brand, 'referral', 'visit');

/* ---------------- what changed in the game: products, harvests, learning, credits, leads ---------------- */

/** The shop's branded products, by item id. */
const BRANDED: Record<string, BrandId> = Object.fromEntries(SHOP_TABS.flatMap(t => t.items).flatMap(i => (i.partner ? [[i.id, i.partner]] : [])));
const DURABLE = new Set(SHOP_TABS.find(t => t.id === 'equipment')?.items.map(i => i.id) ?? []).add('tank-tangi');

const count = (list: string[], id: string) => list.reduce((n, x) => n + (x === id ? 1 : 0), 0);
const added = <T,>(a: T[] | undefined, b: T[] | undefined) => (b ?? []).filter(x => !(a ?? []).includes(x));

/** The brands whose consumable products were used this season (kept across visits, so a harvest days later knows). */
function seasonBrands(season: number, add?: BrandId): BrandId[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(SEASON_KEY) ?? 'null') as { season: number; brands: BrandId[] } | null;
    let brands = raw && raw.season === season ? raw.brands : [];
    if (add && !brands.includes(add)) {
      brands = [...brands, add];
      window.localStorage.setItem(SEASON_KEY, JSON.stringify({ season, brands }));
    }
    return brands;
  } catch {
    return add ? [add] : [];
  }
}

/** The brands behind a harvest: products used this season, and the partners' equipment the farm owns. */
const partnersIn = (s: GameState) => [...new Set([...seasonBrands(s.season), ...s.inventory.filter(i => DURABLE.has(i) && BRANDED[i]).map(i => BRANDED[i])])];

/** Compare the state before and after a change, and record the partner events it means. */
export function partnerSignals(prev: GameState, next: GameState, t: PartnerTracker = partnerTracker) {
  // 23: branded products bought (more of them) or used (fewer, with a task done)
  if (prev.inventory !== next.inventory) {
    for (const [item, brand] of Object.entries(BRANDED)) {
      const d = count(next.inventory, item) - count(prev.inventory, item);
      if (d > 0) t.product(brand, item, 'bought', d);
      if (d < 0 && next.doneTasks.length > prev.doneTasks.length) {
        t.product(brand, item, 'used', -d);
        seasonBrands(next.season, brand);
      }
    }
  }
  // 24: the season's harvest, and each planted farm of a trial cycle
  if (!prev.harvested && next.harvested) {
    t.outcome({ kind: 'season', yield: next.harvested.bags, partners: partnersIn(next), ref: `season-${next.season}` });
  }
  if (next.trialHistory.length > prev.trialHistory.length && next.trial?.results) {
    const partners = partnersIn(next);
    next.trial.results.forEach((r, farm) => {
      if (!r.rested) t.outcome({ kind: 'trial-farm', yield: r.bags, profit: r.profit, partners, ref: `cycle-${next.trial!.cycle}-farm-${farm + 1}` });
    });
  }
  // 27: learning tied to the certification and training sponsors
  const cert = brandOnSlot('certification');
  const course = brandOnSlot('training');
  if (cert) added(prev.basics, next.basics).forEach(i => t.learning(cert, `basics-${i}`, 'lesson'));
  if (cert && prev.ach !== next.ach) {
    const was = prev.ach?.levels ?? {};
    for (const [id, w] of Object.entries(next.ach?.levels ?? {})) if (w?.claimed && !was[id]?.claimed) t.learning(cert, `level-${id}`, 'certificate');
  }
  const booked = (next.trainings ?? []).filter(b => !(prev.trainings ?? []).some(p => p.id === b.id));
  if (course) booked.forEach(b => (t.learning(course, b.id, 'course'), t.lead(course, 'booking', b.ref)));
  // 28: credits earned through a partner-linked practice
  if (prev.ledger !== next.ledger) {
    for (const l of CREDIT_LINKS) {
      const d = (next.ledger?.earned?.[l.credit] ?? 0) - (prev.ledger?.earned?.[l.credit] ?? 0);
      if (d > 0 && l.when(next)) t.credits(l.brand, l.credit, d, l.practice);
    }
  }
  // 29: offer codes taken, sponsored vouchers redeemed
  added(prev.offers, next.offers).forEach(b => t.lead(b, 'offer_code', offerCode(b, next.farmer?.name)));
  added(prev.redeemed, next.redeemed).forEach(id => {
    const b = REWARD_SPONSOR[id];
    if (b) t.lead(b, 'voucher', id);
  });
}

let skip = false;
/** The next change replaces the whole game (a reset, a save loaded): it is not play, so it records nothing. */
export const skipPartnerSignals = () => {
  skip = true;
};

/** Keeps the partner context current and records what each change of the game's state means for partners. */
export function usePartnerSignals(state: GameState) {
  const prev = useRef(state);
  const ctx = contextOf(state);
  partnerContext.country = ctx.country;
  partnerContext.region = ctx.region;
  partnerContext.experience = ctx.experience;
  useEffect(() => {
    const before = prev.current;
    prev.current = state;
    // a whole new save (a reset, another farmer) is not play
    const replaced = skip || before.farmer?.name !== state.farmer?.name;
    skip = false;
    if (before === state || replaced) return;
    try {
      partnerSignals(before, state);
    } catch {
      /* tracking never stops play */
    }
  }, [state]);
}
