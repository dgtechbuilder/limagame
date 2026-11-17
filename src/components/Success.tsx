import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { GoldButton } from './ui';

/* Two shared pieces for every dialog in the game:
   - CloseX: the exit button in the top-right corner of a dialog (a round ✕).
   - SuccessCard: the "it worked" dialog that follows a sale, a booking, an upgrade or a quote. It replaces the short
     message at the top of the screen, which was easy to miss: the player reads what happened and taps on. */

export function CloseX({ onClick, label = 'Close', style, className }: { onClick: () => void; label?: string; style?: CSSProperties; className?: string }) {
  return (
    <button
      type="button"
      className={`x-btn${className ? ` ${className}` : ''}`}
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      style={style}
    >
      <svg viewBox="0 0 16 16" width={12} height={12} aria-hidden="true">
        <path d="M3.5 3.5 12.5 12.5 M12.5 3.5 3.5 12.5" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" fill="none" />
      </svg>
    </button>
  );
}

/** Escape closes the dialog on top, and only that one: the screen underneath keeps its own Escape. */
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    // capture on the document runs before the screens' own listeners on the window
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);
}

export interface SuccessAction {
  label: string;
  onClick: () => void;
  /** a quieter, outlined button */
  plain?: boolean;
}

export function SuccessCard({
  kicker,
  title,
  lead,
  badge,
  highlight,
  rows,
  children,
  actions,
  onClose,
  tone = 'green',
  label,
  width = 420,
}: {
  /** the small line above the title, e.g. "Sale complete" */
  kicker: string;
  title: ReactNode;
  lead?: ReactNode;
  /** the picture in the round badge (a check mark when left out) */
  badge?: ReactNode;
  /** the one number that matters, in a gold band */
  highlight?: { label: ReactNode; value: ReactNode };
  rows?: [ReactNode, ReactNode][];
  children?: ReactNode;
  actions: SuccessAction[];
  onClose: () => void;
  tone?: 'green' | 'gold';
  label?: string;
  width?: number;
}) {
  useEscape(onClose);
  return (
    <div className="abs success-layer" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label={label ?? kicker}>
      <div className="success-scrim" onClick={onClose} />
      <div className={`success-card is-${tone}`} style={{ width }}>
        <CloseX onClick={onClose} />
        <div className="success-badge" aria-hidden="true">
          <span className="success-rays" />
          <span className="success-disc">
            {badge ?? (
              <svg viewBox="0 0 24 24" width={28} height={28}>
                <path d="M5 12.5 10 17.5 19 7" stroke="#fff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            )}
          </span>
        </div>
        <p className="success-kicker">{kicker}</p>
        <p className="success-title">{title}</p>
        {lead && <p className="success-lead">{lead}</p>}
        {highlight && (
          <div className="success-highlight">
            <span>{highlight.label}</span>
            <b>{highlight.value}</b>
          </div>
        )}
        {rows && rows.length > 0 && (
          <dl className={`success-rows${rows.length > 3 ? ' is-grid' : ''}`}>
            {rows.map(([k, v], i) => (
              <div key={i}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {children}
        <div className="success-actions">
          {actions.map(a =>
            a.plain ? (
              <button key={a.label} type="button" className="success-plain" onClick={a.onClick}>
                {a.label}
              </button>
            ) : (
              <GoldButton key={a.label} font={11} height={32} style={{ minWidth: 150, padding: '0 16px' }} onClick={a.onClick}>
                {a.label}
              </GoldButton>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
