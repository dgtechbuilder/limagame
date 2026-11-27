import type { PartnerEvent } from './events';
import type { PartnerSink } from './tracker';

/* Ready-made sinks. Any function that takes an event is a sink, so an analytics vendor, a server endpoint or the app's
   own event log plugs in with a line (see callbackSink). */

/** Keeps the last `limit` events in memory (tests, a live view). */
export function memorySink(limit = 1000): PartnerSink & { events: PartnerEvent[]; clear(): void } {
  const events: PartnerEvent[] = [];
  const sink = ((e: PartnerEvent) => {
    events.push(e);
    if (events.length > limit) events.splice(0, events.length - limit);
  }) as PartnerSink & { events: PartnerEvent[]; clear(): void };
  sink.events = events;
  sink.clear = () => void events.splice(0);
  return sink;
}

/** The part of Web Storage the store needs (localStorage, or a stand-in). */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Keeps the last `limit` events on the device under `key`, so a report can be built on it with no server. */
export function storageSink(opts: { key: string; limit?: number; storage?: KeyValueStore | null }): PartnerSink & { read(): PartnerEvent[]; clear(): void } {
  const limit = opts.limit ?? 1000;
  const store = () => {
    if (opts.storage !== undefined) return opts.storage;
    try {
      return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
      return null;
    }
  };
  const read = (): PartnerEvent[] => {
    try {
      const raw = JSON.parse(store()?.getItem(opts.key) ?? '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  };
  const sink = ((e: PartnerEvent) => {
    const s = store();
    if (!s) return;
    s.setItem(opts.key, JSON.stringify([...read(), e].slice(-limit)));
  }) as PartnerSink & { read(): PartnerEvent[]; clear(): void };
  sink.read = read;
  sink.clear = () => {
    try {
      store()?.removeItem(opts.key);
    } catch {
      /* nothing to clear */
    }
  };
  return sink;
}

/** Hands each event to a function: the app's analytics, a vendor's SDK, a server queue. `map` reshapes it first. */
export function callbackSink<T = PartnerEvent>(send: (x: T) => void, map?: (e: PartnerEvent) => T | null): PartnerSink {
  return e => {
    const x = map ? map(e) : (e as unknown as T);
    if (x !== null) send(x);
  };
}

/** Flattens an event into a name and plain fields, for event logs that take `track(name, data)`. Name: "partner_<type>". */
export function flatten(e: PartnerEvent): { name: string; data: Record<string, unknown> } {
  const { type, ctx, ...rest } = e;
  return { name: `partner_${type}`, data: { ...rest, player: ctx.playerId, country: ctx.country || undefined, region: ctx.region, experience: ctx.experience, ageBand: ctx.ageBand } };
}
