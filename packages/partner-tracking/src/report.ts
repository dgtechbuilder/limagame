import { ENGAGED_TYPES, type Campaign, type OutcomeEvent, type PartnerContext, type PartnerEvent } from './events';

/* The partner report: the ten partner metrics for each brand, built from a list of events (from the device's store,
   or from the server's collected events). Pure: the same events give the same report. */

export interface OutcomeStats {
  n: number;
  /** mean yield */
  yield: number;
  /** mean profit, over the outcomes that had one */
  profit: number | null;
}

export interface Lift {
  /** the outcome kind compared (like with like) */
  kind: string;
  with: OutcomeStats;
  without: OutcomeStats;
  /** % more yield with the brand's product than without (null until both sides have outcomes) */
  yieldLiftPct: number | null;
  /** profit with minus profit without, per outcome */
  profitLift: number | null;
}

export interface BrandReport {
  brand: string;
  /** 21 */
  impressions: number;
  /** unique players who saw the brand */
  viewers: number;
  impressionsBySlot: Record<string, number>;
  /** 22 */
  taps: number;
  tapsBySlot: Record<string, number>;
  /** taps ÷ impressions (null with no impressions) */
  tapRate: number | null;
  /** 23 */
  products: { bought: number; used: number; byProduct: Record<string, { bought: number; used: number }> };
  /** 24 */
  lift: Lift[];
  /** 25: unique players who saw or engaged with the brand, by country and by region */
  reach: { players: number; byCountry: Record<string, number>; byRegion: Record<string, number> };
  /** 26: the players who engaged (tap, product, learning, lead), new vs experienced, and by age band where known */
  engagers: { players: number; byExperience: Record<string, number>; byAgeBand: Record<string, number> };
  /** 27 */
  learning: { completions: number; players: number; byKind: Record<string, number>; byContent: Record<string, number> };
  /** 28 */
  credits: { total: number; byCredit: Record<string, number>; byPractice: Record<string, number> };
  /** 29 */
  leads: { total: number; players: number; byKind: Record<string, number> };
  /** 30: one row for each of the brand's campaigns */
  campaigns: CampaignResult[];
}

export interface CampaignResult {
  name: string;
  spend: number;
  currency: string;
  /** unique players who engaged with the brand within the campaign's dates */
  engagedPlayers: number;
  /** spend ÷ engaged players (null with none) */
  costPerEngaged: number | null;
}

export interface PartnerReport {
  from: number | null;
  to: number | null;
  events: number;
  brands: BrandReport[];
}

export interface ReportOptions {
  campaigns?: Campaign[];
  /** brands to include even with no events (e.g. every signed partner), in this order; others follow */
  brands?: string[];
}

const add = (m: Record<string, number>, k: string, n = 1) => {
  m[k] = (m[k] ?? 0) + n;
};
const countBy = (players: Map<string, PartnerContext>, key: (c: PartnerContext) => string) => {
  const m: Record<string, number> = {};
  players.forEach(c => add(m, key(c)));
  return m;
};
const round = (x: number, dp = 2) => Math.round(x * 10 ** dp) / 10 ** dp;

function stats(list: OutcomeEvent[]): OutcomeStats {
  const withProfit = list.filter(o => typeof o.profit === 'number');
  return {
    n: list.length,
    yield: list.length ? round(list.reduce((n, o) => n + o.yield, 0) / list.length) : 0,
    profit: withProfit.length ? round(withProfit.reduce((n, o) => n + (o.profit ?? 0), 0) / withProfit.length) : null,
  };
}

/** Yield and profit with the brand's products against without, for each outcome kind it appears in. */
export function liftFor(brand: string, outcomes: OutcomeEvent[]): Lift[] {
  const kinds = [...new Set(outcomes.filter(o => o.partners.includes(brand)).map(o => o.kind))];
  return kinds.map(kind => {
    const same = outcomes.filter(o => o.kind === kind);
    const w = stats(same.filter(o => o.partners.includes(brand)));
    const wo = stats(same.filter(o => !o.partners.includes(brand)));
    return {
      kind,
      with: w,
      without: wo,
      yieldLiftPct: w.n && wo.n && wo.yield > 0 ? round(((w.yield - wo.yield) / wo.yield) * 100, 1) : null,
      profitLift: w.n && wo.n && w.profit !== null && wo.profit !== null ? round(w.profit - wo.profit) : null,
    };
  });
}

export function partnerReport(events: PartnerEvent[], opts: ReportOptions = {}): PartnerReport {
  const outcomes = events.filter((e): e is OutcomeEvent => e.type === 'outcome');
  const branded = events.filter(e => e.brand);
  const names = [...(opts.brands ?? [])];
  for (const e of branded) if (!names.includes(e.brand!)) names.push(e.brand!);
  for (const c of opts.campaigns ?? []) if (!names.includes(c.brand)) names.push(c.brand);
  const ats = events.map(e => e.at);

  const brands = names.map((brand): BrandReport => {
    const mine = branded.filter(e => e.brand === brand);
    const r: BrandReport = {
      brand,
      impressions: 0,
      viewers: 0,
      impressionsBySlot: {},
      taps: 0,
      tapsBySlot: {},
      tapRate: null,
      products: { bought: 0, used: 0, byProduct: {} },
      lift: liftFor(brand, outcomes),
      reach: { players: 0, byCountry: {}, byRegion: {} },
      engagers: { players: 0, byExperience: {}, byAgeBand: {} },
      learning: { completions: 0, players: 0, byKind: {}, byContent: {} },
      credits: { total: 0, byCredit: {}, byPractice: {} },
      leads: { total: 0, players: 0, byKind: {} },
      campaigns: [],
    };
    // each player's latest context: a country set later replaces "unknown"
    const reached = new Map<string, PartnerContext>();
    const engaged = new Map<string, PartnerContext>();
    const viewers = new Set<string>();
    const learners = new Set<string>();
    const leaders = new Set<string>();
    for (const e of mine) {
      const id = e.ctx.playerId;
      reached.set(id, e.ctx);
      if (ENGAGED_TYPES.has(e.type)) engaged.set(id, e.ctx);
      switch (e.type) {
        case 'impression':
          r.impressions++;
          viewers.add(id);
          add(r.impressionsBySlot, e.slot);
          break;
        case 'tap':
          r.taps++;
          add(r.tapsBySlot, e.slot);
          break;
        case 'product': {
          const p = (r.products.byProduct[e.product] ??= { bought: 0, used: 0 });
          p[e.stage] += e.qty;
          r.products[e.stage] += e.qty;
          break;
        }
        case 'learning':
          r.learning.completions++;
          learners.add(id);
          add(r.learning.byKind, e.kind);
          add(r.learning.byContent, e.content);
          break;
        case 'credits':
          r.credits.total = round(r.credits.total + e.amount);
          add(r.credits.byCredit, e.credit, e.amount);
          add(r.credits.byPractice, e.practice, e.amount);
          break;
        case 'lead':
          r.leads.total++;
          leaders.add(id);
          add(r.leads.byKind, e.kind);
          break;
      }
    }
    r.viewers = viewers.size;
    r.tapRate = r.impressions ? round(r.taps / r.impressions, 4) : null;
    r.reach = { players: reached.size, byCountry: countBy(reached, c => (c.country || 'Unknown').toUpperCase()), byRegion: countBy(reached, c => c.region || 'Unknown') };
    r.engagers = {
      players: engaged.size,
      byExperience: countBy(engaged, c => c.experience ?? 'unknown'),
      byAgeBand: countBy(engaged, c => c.ageBand ?? 'not collected'),
    };
    r.learning.players = learners.size;
    r.leads.players = leaders.size;
    r.campaigns = (opts.campaigns ?? [])
      .filter(c => c.brand === brand)
      .map(c => {
        const inWindow = new Set(mine.filter(e => ENGAGED_TYPES.has(e.type) && (c.from === undefined || e.at >= c.from) && (c.to === undefined || e.at <= c.to)).map(e => e.ctx.playerId));
        return { name: c.name ?? brand, spend: c.spend, currency: c.currency, engagedPlayers: inWindow.size, costPerEngaged: inWindow.size ? round(c.spend / inWindow.size) : null };
      });
    return r;
  });

  return { from: ats.length ? Math.min(...ats) : null, to: ats.length ? Math.max(...ats) : null, events: events.length, brands };
}
