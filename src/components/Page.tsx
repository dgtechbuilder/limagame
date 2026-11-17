import { useEffect, type Dispatch, type ReactNode } from 'react';
import { NavBar } from './Nav';
import { CloseX } from './Success';
import type { Action } from '../state';

/* A full page with sections down the left, as Settings, Climate and Animals have: used by the Wallet, Power, the
   market stall and the new farms. */

export function Page<T extends string | number>({
  title,
  icon,
  tabs,
  tab,
  onTab,
  foot,
  dispatch,
  children,
  onClose,
}: {
  title: string;
  icon: string;
  tabs: { id: T; label: string; icon: string; badge?: number }[];
  tab: T;
  onTab: (t: T) => void;
  foot?: ReactNode;
  dispatch: Dispatch<Action>;
  children: ReactNode;
  onClose?: () => void;
}) {
  const close = onClose ?? (() => dispatch({ type: 'close' }));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('.mg') && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const here = tabs.find(t => t.id === tab) ?? tabs[0];
  return (
    <div className="abs settings-page" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="scrim" onClick={close} />
      <div className="fs-panel set-panel" style={{ left: 24, top: 46, width: 826, height: 334 }}>
        <nav className="set-tabs cl-tabs" aria-label={`${title} sections`}>
          <p className="set-heading">{title}</p>
          {tabs.map(t => (
            <button key={t.id} type="button" className={`set-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => onTab(t.id)}>
              <i aria-hidden="true">{t.icon}</i>
              {t.label}
              {!!t.badge && <b className="lv-count">{t.badge}</b>}
            </button>
          ))}
          {foot && <p className="set-foot">{foot}</p>}
        </nav>
        <section className="set-content cl-content" aria-label={here.label}>
          {children}
        </section>
      </div>
      <NavBar horizontal onBack={close} style={{ right: 62, top: 8 }} />
      <CloseX className="page-x" onClick={close} />
      <p className="set-title-bar">
        <span aria-hidden="true">{icon}</span> {title} · <b>{here.label}</b>
      </p>
    </div>
  );
}

/** A figure tile, as on the Climate page. */
export function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className={`cl-tile${tone ? ` is-${tone}` : ''}`}>
      <p className="cl-tile-label">{label}</p>
      <p className="cl-tile-value">{value}</p>
      {sub && <p className="cl-tile-sub">{sub}</p>}
    </div>
  );
}
