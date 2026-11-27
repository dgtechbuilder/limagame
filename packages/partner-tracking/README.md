# @temolima/partner-tracking

Partner data tracking for TemoLima, as its own package: the events a partner brand's placements, products and
campaigns produce in the game, pluggable sinks to send them anywhere, and a report of the ten partner metrics.
No dependencies and no analytics vendor.

## The ten metrics

| # | Metric | Event | In the report |
|---|--------|-------|---------------|
| 21 | Impressions of each brand | `impression(brand, slot)` | `impressions`, `viewers`, `impressionsBySlot` |
| 22 | Taps on partner cards and products | `tap(brand, slot)` | `taps`, `tapsBySlot`, `tapRate` |
| 23 | Partner products used in play | `product(brand, product, 'bought' \| 'used', qty)` | `products` |
| 24 | Yield or profit lift with the product | `outcome({ kind, yield, profit, partners })` | `lift` (same kind, with vs. without) |
| 25 | Reach by region and country | every event's `ctx.country`, `ctx.region` | `reach` |
| 26 | Profile of engagers | every event's `ctx.experience`, `ctx.ageBand` | `engagers` |
| 27 | Learning completions tied to the partner | `learning(brand, content, kind)` | `learning` |
| 28 | Carbon credits through partner-linked practices | `credits(brand, credit, amount, practice)` | `credits` |
| 29 | Leads and referrals | `lead(brand, 'offer_code' \| 'voucher' \| 'booking' \| 'referral' \| 'contact', ref)` | `leads` |
| 30 | Cost per engaged player | `Campaign { brand, spend, currency, from, to }` | `campaigns[].costPerEngaged` |

An engaged player is one who tapped, used a product, completed learning or became a lead. Impressions alone do not count.

## Use

```ts
import { createPartnerTracker, storageSink, callbackSink, flatten, partnerReport, regionOf } from '@temolima/partner-tracking';

const store = storageSink({ key: 'partner-events', limit: 1000 });
const tracker = createPartnerTracker({
  context: () => ({ playerId, country: 'KE', region: regionOf('KE'), experience: 'new' }),
  sinks: [store, callbackSink(e => myAnalytics.send(flatten(e)))],
});

tracker.impression('hello-tractor', 'world-tractor');
tracker.lead('hello-tractor', 'referral', 'visit');

const report = partnerReport(store.read(), { campaigns: [{ brand: 'hello-tractor', spend: 5000, currency: 'USD' }] });
```

A sink is any `(event) => void`. A sink that throws is skipped, and the tracker never throws into the game.

## In TemoLima

`src/partners/tracking.ts` connects the game to this package. It stores events on the device
(`lima-partner-events`) and sends them into the game's own event log as `partner_<type>`, which the outbox
forwards when `VITE_EVENTS_URL` is set. Campaign spend goes in `CAMPAIGNS` there.
Tests: `tests/partner-tracking.spec.ts`.
