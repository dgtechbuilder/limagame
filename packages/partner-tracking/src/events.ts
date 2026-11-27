/* The partner events: one type for each thing a partner pays to learn about its place in the game.

   Every event names the brand it is about (null only for an outcome, which compares players with and without the
   partners' products), when it happened, and who the player is in the few words a partner report needs: an anonymous
   id, the country and region (reach), and whether they are new or experienced (the profile of the players who engage).
   Nothing here names the player. */

/** Who the player is, as far as a partner report goes. The app supplies it with each event. */
export interface PartnerContext {
  /** an anonymous id for this player (or device): counts unique players, never names them */
  playerId: string;
  /** ISO country code, e.g. "KE"; "" or missing when the player has not set one */
  country?: string;
  /** a region the country is in (see regionOf), e.g. "East Africa" */
  region?: string;
  /** new: still learning the game's first season; experienced: has played a harvest through */
  experience?: 'new' | 'experienced';
  /** an age band, only if the app collects one (e.g. "18-24"); left out otherwise */
  ageBand?: string;
}

interface Base {
  at: number;
  brand: string | null;
  ctx: PartnerContext;
}

/** 21. The brand was shown: a billboard, a sponsor line, a branded card or product. Once per showing, not per frame. */
export interface ImpressionEvent extends Base {
  type: 'impression';
  brand: string;
  /** where it was shown (a placement id) */
  slot: string;
}

/** 22. The player tapped the brand's placement, card or product. */
export interface TapEvent extends Base {
  type: 'tap';
  brand: string;
  slot: string;
}

/** 23. A partner's product in play: bought, or used for the job it does (seeds, inputs, equipment). */
export interface ProductEvent extends Base {
  type: 'product';
  brand: string;
  product: string;
  stage: 'bought' | 'used';
  qty: number;
}

/** 24. A harvest's result, with the partners whose products went into it (none: the baseline). The report compares
    outcomes of the same kind with and without each brand: the yield and profit lift. */
export interface OutcomeEvent extends Base {
  type: 'outcome';
  brand: null;
  /** what was harvested, so like is compared with like, e.g. "season" or "trial-farm" */
  kind: string;
  /** the yield, in the kind's own unit (bags) */
  yield: number;
  profit?: number;
  /** brands whose products were used for this harvest */
  partners: string[];
  /** e.g. the cycle and farm */
  ref?: string;
}

/** 27. Learning content tied to the partner was completed: a lesson, a course booked, a certificate. */
export interface LearningEvent extends Base {
  type: 'learning';
  brand: string;
  content: string;
  kind: 'lesson' | 'course' | 'certificate' | 'practice';
}

/** 28. Carbon (or water) credits earned through a practice linked to the partner. */
export interface CreditsEvent extends Base {
  type: 'credits';
  brand: string;
  /** the credit type, e.g. "co2" or "water" */
  credit: string;
  amount: number;
  /** the partner-linked practice that earned it, e.g. "solar power" */
  practice: string;
}

/** 29. A lead or referral sent to the partner: an offer code taken, a voucher redeemed, a booking, a contact request. */
export interface LeadEvent extends Base {
  type: 'lead';
  brand: string;
  kind: 'offer_code' | 'voucher' | 'booking' | 'referral' | 'contact';
  ref?: string;
}

export type PartnerEvent = ImpressionEvent | TapEvent | ProductEvent | OutcomeEvent | LearningEvent | CreditsEvent | LeadEvent;
export type PartnerEventType = PartnerEvent['type'];

/** Events that show a player chose to engage with the brand (an impression alone does not; credits and outcomes follow
    from play). These count as "engaged players" for reach of engagement, the profile, and cost per engaged player. */
export const ENGAGED_TYPES: ReadonlySet<PartnerEventType> = new Set(['tap', 'product', 'learning', 'lead']);

/** 30. A partner's campaign: what it spent, in which currency, over which dates. Supplied by the app (or the team's
    deal sheet); the report divides the spend by the players who engaged in that window. */
export interface Campaign {
  brand: string;
  name?: string;
  spend: number;
  currency: string;
  /** ms since epoch; open-ended when left out */
  from?: number;
  to?: number;
}
