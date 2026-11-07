import type { CSSProperties } from 'react';
import { climateTag, type Delta } from './model';

/** A one-line climate tag beside a choice: what it emits, stores, uses or pollutes. */
export function ClimateTag({ d, short, style }: { d: Delta | null | undefined; short?: boolean; style?: CSSProperties }) {
  const t = climateTag(d, short);
  if (!t) return null;
  return (
    <span className={`climate-tag${t.tone === 'bad' ? ' is-bad' : t.tone === 'none' ? ' is-none' : ''}`} style={style} title="Climate effect (see the Climate page)">
      <span aria-hidden="true">🌍</span>
      <span>{t.text}</span>
    </span>
  );
}
