import type { CreditsEvent, ImpressionEvent, LeadEvent, LearningEvent, OutcomeEvent, PartnerContext, PartnerEvent, ProductEvent, TapEvent } from './events';

/* The tracker: the one call for each partner event. It stamps the time and the player's context on each, and hands it
   to every sink plugged in (a store on the device, the app's own analytics, a test's list). A sink that throws is
   skipped; tracking never stops play. */

/** Where events go. Add as many as needed; each gets every event. */
export type PartnerSink = (e: PartnerEvent) => void;

export interface TrackerOptions {
  /** the player's context, read for each event (so a country set later is used from then on) */
  context: () => PartnerContext;
  sinks?: PartnerSink[];
  /** false: nothing is recorded (a design review, a test of something else). Read for each event. */
  enabled?: () => boolean;
  /** the clock (tests set it) */
  now?: () => number;
}

type Omitted<E> = Omit<E, 'at' | 'ctx' | 'type'>;

export interface PartnerTracker {
  /** 21: the brand was shown on a placement (call once per showing) */
  impression(brand: string, slot: string): void;
  /** 22: the player tapped the brand's placement, card or product */
  tap(brand: string, slot: string): void;
  /** 23: a partner's product bought, or used in play */
  product(brand: string, product: string, stage: ProductEvent['stage'], qty?: number): void;
  /** 24: a harvest's result and the partners whose products went into it */
  outcome(o: Omitted<OutcomeEvent> | Omit<Omitted<OutcomeEvent>, 'brand'>): void;
  /** 27: learning content tied to the brand completed */
  learning(brand: string, content: string, kind: LearningEvent['kind']): void;
  /** 28: credits earned through a practice linked to the brand */
  credits(brand: string, credit: string, amount: number, practice: string): void;
  /** 29: a lead or referral for the brand */
  lead(brand: string, kind: LeadEvent['kind'], ref?: string): void;
  /** any event, already built (replays, imports) */
  record(e: PartnerEvent): void;
  /** plug in another sink; returns its unplug */
  addSink(sink: PartnerSink): () => void;
}

export function createPartnerTracker(opts: TrackerOptions): PartnerTracker {
  const sinks = [...(opts.sinks ?? [])];
  const now = opts.now ?? (() => Date.now());
  const on = () => (opts.enabled ? opts.enabled() : true);

  const record = (e: PartnerEvent) => {
    if (!on()) return;
    for (const sink of sinks) {
      try {
        sink(e);
      } catch {
        /* one sink failing (storage full, a network error) does not stop the others */
      }
    }
  };
  const emit = <E extends PartnerEvent>(type: E['type'], body: Omitted<E>) => {
    if (!on()) return;
    let ctx: PartnerContext;
    try {
      // a copy: a context object the app changes later does not rewrite events already sent
      ctx = { ...opts.context() };
    } catch {
      ctx = { playerId: 'unknown' };
    }
    record({ type, at: now(), ctx, ...body } as E);
  };

  return {
    impression: (brand, slot) => emit<ImpressionEvent>('impression', { brand, slot }),
    tap: (brand, slot) => emit<TapEvent>('tap', { brand, slot }),
    product: (brand, product, stage, qty = 1) => emit<ProductEvent>('product', { brand, product, stage, qty }),
    outcome: o => emit<OutcomeEvent>('outcome', { ...o, brand: null, partners: [...new Set(o.partners)].sort() }),
    learning: (brand, content, kind) => emit<LearningEvent>('learning', { brand, content, kind }),
    credits: (brand, credit, amount, practice) => {
      if (amount > 0) emit<CreditsEvent>('credits', { brand, credit, amount, practice });
    },
    lead: (brand, kind, ref) => emit<LeadEvent>('lead', { brand, kind, ...(ref ? { ref } : {}) }),
    record,
    addSink(sink) {
      sinks.push(sink);
      return () => {
        const i = sinks.indexOf(sink);
        if (i >= 0) sinks.splice(i, 1);
      };
    },
  };
}
