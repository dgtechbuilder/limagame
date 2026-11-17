import { useEffect, useRef, type Dispatch } from 'react';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import { BRANDS, REWARD_SPONSOR, SLOTS, activeBrands, brandOf, type BrandId } from '../partners/data';
import { engagement } from '../partners/track';
import { BrandMark } from '../partners/ui';
import { REWARDS } from '../data';
import type { Action, GameState, PartnersTab } from '../state';

/* Partners: for players, the offers from the brands that sponsor the game, to save to Messages; for partners (and
   the team selling to them), every place in the game a brand can appear, who has it, and how often it was seen and
   tapped on this device. The brands and slots are set in src/partners/data.ts. */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: PartnersTab; brand?: BrandId };

const TABS: { id: PartnersTab; label: string; icon: string }[] = [
  { id: 'offers', label: 'Offers', icon: '🎁' },
  { id: 'placements', label: 'Placements', icon: '📍' },
];

export function PartnersPage({ s, dispatch, tab: startTab, brand }: Props) {
  const tab: PartnersTab = startTab ?? 'offers';
  const close = () => dispatch({ type: 'close' });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'close' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  const taken = SLOTS.filter(x => x.brand).length;
  return (
    <div className="abs settings-page partners-page" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Partners">
      <div className="scrim" onClick={close} />
      <div className="fs-panel set-panel" style={{ left: 18, top: 40, width: 838, height: 348 }}>
        <nav className="set-tabs" aria-label="Partners sections">
          <p className="set-heading">Partners</p>
          {TABS.map(t => (
            <button key={t.id} type="button" className={`set-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => dispatch({ type: 'open', modal: { kind: 'partners', tab: t.id } })}>
              <i aria-hidden="true">{t.icon}</i>
              {t.label}
              {t.id === 'offers' && (s.offers ?? []).length > 0 && <small className="ach-count">{(s.offers ?? []).length} saved</small>}
            </button>
          ))}
          <p className="set-foot">
            {activeBrands().length} partners · {taken} of {SLOTS.length} placements taken
          </p>
        </nav>
        <section className="set-content ach-content" aria-label={TABS.find(t => t.id === tab)!.label}>
          {tab === 'offers' ? <Offers s={s} dispatch={dispatch} focus={brand} /> : <Placements />}
        </section>
      </div>
      <NavBar horizontal onBack={close} hideHome={s.fs.phase !== 'done'} style={{ right: 44, top: 6 }} />
      <CloseX className="page-x" onClick={close} />
      <p className="set-title-bar">
        <span aria-hidden="true">🤝</span> Partners · <b>{TABS.find(t => t.id === tab)!.label}</b>
      </p>
    </div>
  );
}

function Offers({ s, dispatch, focus }: { s: GameState; dispatch: Dispatch<Action>; focus?: BrandId }) {
  const saved = s.offers ?? [];
  const box = useRef<HTMLDivElement>(null);
  // opened from a billboard or a sponsor line: that brand's card is brought into view
  useEffect(() => {
    if (focus) box.current?.querySelector(`[data-brand="${focus}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [focus]);
  return (
    <div ref={box}>
      <div className="ach-row-head pt-offers-head">
        <p className="set-title">Offers from the partners who back your farm</p>
        <small className="pt-note">Saved offers go to Messages</small>
      </div>
      <div className="pt-offers">
        {activeBrands().map(b => {
          const has = saved.includes(b.id);
          return (
            <article key={b.id} data-brand={b.id} className={`pt-card${focus === b.id ? ' is-focus' : ''}${has ? ' is-saved' : ''}`} style={{ ['--brand' as string]: b.color, ['--accent' as string]: b.accent }} aria-label={`${b.name}: ${b.offer.title}`}>
              <header>
                <BrandMark b={b} size={30} />
                <span className="pt-who">
                  <b>{b.name}</b>
                  <small>{b.tagline}</small>
                </span>
                <em className="pt-tag">{b.category}</em>
              </header>
              <p className="pt-offer">
                <b>{b.offer.title}</b>
                <small>{b.offer.line}</small>
              </p>
              <footer>
                <button type="button" className={`ach-claim${has ? ' is-done' : ''}`} disabled={has} onClick={() => dispatch({ type: 'partnerSave', id: b.id })} aria-label={has ? `${b.name} offer saved` : `Save the ${b.name} offer`}>
                  {has ? 'Saved ✓' : 'Save offer'}
                </button>
                {b.url && (
                  <a className="pt-visit" href={b.url} target="_blank" rel="noopener noreferrer">
                    Visit site <span aria-hidden="true">›</span>
                  </a>
                )}
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

type Row = { id: string; surface: string; where: string; format: string; brand?: BrandId | null; n?: { views: number; taps: number } };

function Placements() {
  const e = engagement();
  const rows: Row[] = [
    ...SLOTS.map(x => ({ id: x.id, surface: x.surface, where: x.where, format: x.format, brand: x.brand, n: e[x.id] ?? { views: 0, taps: 0 } })),
    ...REWARDS.filter(r => REWARD_SPONSOR[r.id]).map(r => ({ id: r.id, surface: 'Rewards', where: `Voucher: ${r.name}`, format: `Voucher sponsor (${r.off}% off)`, brand: REWARD_SPONSOR[r.id] })),
  ];
  // the rows by where in the game they sit, in the order they are listed
  const groups = [...new Set(rows.map(r => r.surface))].map(surface => ({ surface, rows: rows.filter(r => r.surface === surface) }));
  const taken = SLOTS.filter(x => x.brand).length;
  const views = SLOTS.reduce((t, x) => t + (e[x.id]?.views ?? 0), 0);
  const taps = SLOTS.reduce((t, x) => t + (e[x.id]?.taps ?? 0), 0);
  const num = (v: number) => v.toLocaleString('en-US');
  return (
    <div className="pt-place">
      <div className="ach-row-head pt-offers-head">
        <p className="set-title">Every place a partner can appear</p>
        <small className="pt-note">Views and taps are counted on this device only</small>
      </div>
      <div className="pt-stats">
        <p>
          <b>
            {taken}
            <small> / {SLOTS.length}</small>
          </b>
          <small>Placements taken</small>
        </p>
        <p className="is-open">
          <b>{SLOTS.length - taken}</b>
          <small>Open to a partner</small>
        </p>
        <p>
          <b>{num(views)}</b>
          <small>Views</small>
        </p>
        <p>
          <b>{num(taps)}</b>
          <small>Taps</small>
        </p>
      </div>
      <div className="pt-table-card">
        <table className="pt-table">
          <thead>
            <tr>
              <th scope="col">Placement</th>
              <th scope="col">Partner</th>
              <th scope="col">Views</th>
              <th scope="col">Taps</th>
            </tr>
          </thead>
          {groups.map(g => (
            <tbody key={g.surface}>
              <tr className="pt-group">
                <th scope="colgroup" colSpan={4}>
                  {g.surface} <small>{g.rows.length}</small>
                </th>
              </tr>
              {g.rows.map(r => {
                const b = brandOf(r.brand ?? undefined);
                return (
                  <tr key={r.id} className={b ? undefined : 'is-open'}>
                    <td>
                      <b className="pt-where">{r.where}</b>
                      <small className="pt-format">{r.format}</small>
                    </td>
                    <td>
                      {b ? (
                        <span className="pt-brand">
                          <BrandMark b={b} size={16} /> {b.name}
                          {b.sample && <em>sample</em>}
                        </span>
                      ) : (
                        <span className="pt-open">Available</span>
                      )}
                    </td>
                    <td className={r.n?.views ? undefined : 'is-zero'}>{r.n ? num(r.n.views) : '–'}</td>
                    <td className={r.n?.taps ? undefined : 'is-zero'}>{r.n ? num(r.n.taps) : '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      </div>
      <p className="pg-foot pt-foot">
        {BRANDS.filter(b => b.sample).length} sample brands stand in for partners still to sign. Slots marked Available are open to a partner.
      </p>
    </div>
  );
}
