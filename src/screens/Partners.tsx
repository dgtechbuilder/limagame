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
      <p className="set-title">Offers from the partners who back your farm</p>
      <div className="pt-grid">
        {activeBrands().map(b => {
          const has = saved.includes(b.id);
          return (
            <article key={b.id} data-brand={b.id} className={`pt-card${focus === b.id ? ' is-focus' : ''}`} style={{ ['--brand' as string]: b.color, ['--accent' as string]: b.accent }} aria-label={`${b.name}: ${b.offer.title}`}>
              <header>
                <BrandMark b={b} size={26} />
                <span>
                  <b>{b.name}</b>
                  <small>
                    {b.category} · {b.tagline}
                  </small>
                </span>
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
                  <a className="set-link" href={b.url} target="_blank" rel="noopener noreferrer">
                    Visit ›
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

function Placements() {
  const e = engagement();
  const vouchers = REWARDS.filter(r => REWARD_SPONSOR[r.id]);
  return (
    <div className="pt-place">
      <div className="ach-row-head">
        <p className="set-title">Every place a partner can appear</p>
        <small className="pt-note">Views and taps are counted on this device only.</small>
      </div>
      <table className="pt-table">
        <thead>
          <tr>
            <th>Where</th>
            <th>Format</th>
            <th>Partner</th>
            <th>Views</th>
            <th>Taps</th>
          </tr>
        </thead>
        <tbody>
          {SLOTS.map(x => {
            const b = brandOf(x.brand);
            const n = e[x.id] ?? { views: 0, taps: 0 };
            return (
              <tr key={x.id}>
                <td>
                  <i>{x.surface}</i> {x.where}
                </td>
                <td>{x.format}</td>
                <td>
                  {b ? (
                    <span className="pt-brand">
                      <BrandMark b={b} size={12} /> {b.name}
                      {b.sample && <em>sample</em>}
                    </span>
                  ) : (
                    <span className="pt-open">Available</span>
                  )}
                </td>
                <td>{n.views.toLocaleString('en-US')}</td>
                <td>{n.taps.toLocaleString('en-US')}</td>
              </tr>
            );
          })}
          {vouchers.map(r => {
            const b = brandOf(REWARD_SPONSOR[r.id])!;
            return (
              <tr key={r.id}>
                <td>
                  <i>Rewards</i> Voucher: {r.name}
                </td>
                <td>Voucher sponsor ({r.off}% off)</td>
                <td>
                  <span className="pt-brand">
                    <BrandMark b={b} size={12} /> {b.name}
                    {b.sample && <em>sample</em>}
                  </span>
                </td>
                <td>–</td>
                <td>–</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="pg-foot">
        {BRANDS.filter(b => b.sample).length} sample brands hold slots for partners still to sign.
      </p>
    </div>
  );
}
