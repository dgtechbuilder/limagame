import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { img } from '../assets';
import { CheckBadge } from './Icons';
import { Img } from './ui';

const FRAMES = {
  /** 518 × 346 frame: Shop, Farming Steps, Storage, Value Addition, Select Process, Harvest Info */
  shop: { src: img.modalShop, w: 518, h: 346, titleTop: 20 },
  /** 647 × 346 frame: Sale of produce, Outcome comparison */
  wide: { src: img.modalWide, w: 647, h: 346, titleTop: 16 },
  /** 616 × 402 frame: Harvest timing, Rewards & Discounts Hub */
  tall: { src: img.modalTall, w: 616, h: 402, titleTop: 18 },
} as const;

export type FrameKind = keyof typeof FRAMES;

export function ModalShell({
  frame,
  x,
  y,
  title,
  titleSize = 14,
  close,
  onClose,
  children,
}: {
  frame: FrameKind;
  x: number;
  y: number;
  title: string;
  titleSize?: number;
  /** close button top-left, in stage coordinates */
  close: [number, number];
  onClose: () => void;
  children: ReactNode;
}) {
  const f = FRAMES[frame];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="abs" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label={title}>
      <div className="scrim" onClick={onClose} />
      <div className="modal-frame" style={{ left: x, top: y, width: f.w, height: f.h }}>
        <img className="frame-img" src={f.src} alt="" draggable={false} />
        <p className="modal-title" style={{ top: f.titleTop, fontSize: titleSize }}>{title}</p>
      </div>
      <div className="abs" style={{ inset: 0, pointerEvents: 'none', animation: 'pop 0.2s ease both' }}>
        <div style={{ pointerEvents: 'auto' }}>{children}</div>
      </div>
      <button
        type="button"
        className="close-btn"
        style={{ left: close[0], top: close[1], border: '1.5px solid #fff' }}
        onClick={onClose}
        aria-label="Close"
      >
        <img src={img.close} alt="" style={{ margin: -1.5 }} />
      </button>
    </div>
  );
}

export interface SideItem {
  id: string;
  label: string;
  icon: string;
  iconOn: string;
  size: [number, number];
  sizeOn: [number, number];
  done?: boolean;
}

/** Dark translucent column of tabs on the left of Shop / Farming Steps. */
export function IconSidebar({
  items,
  active,
  onPick,
  centerX,
  centerY,
  gap,
  label,
}: {
  items: SideItem[];
  active: string;
  onPick: (id: string) => void;
  centerX: number;
  centerY: number;
  gap: number;
  label: string;
}) {
  return (
    <nav
      className="sidebar"
      aria-label={label}
      style={{ left: centerX, top: centerY, translate: '-50% -50%', gap }}
    >
      {items.map((it, i) => {
        const on = it.id === active;
        const [w, h] = on ? it.sizeOn : it.size;
        return (
          <div key={it.id} style={{ display: 'contents' }}>
            {i > 0 && <span className="side-sep" style={{ width: 63 }} />}
            <button
              type="button"
              className="side-item"
              onClick={() => onPick(it.id)}
              aria-current={on ? 'page' : undefined}
            >
              <span style={{ position: 'relative' }}>
                <Img src={on ? it.iconOn : it.icon} w={w} h={h} />
                {it.done && <CheckBadge />}
              </span>
              <span>{it.label}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}

export function TextSidebar({
  items,
  active,
  onPick,
  style,
  label,
}: {
  items: { id: number; label: string }[];
  active: number;
  onPick: (id: number) => void;
  style: CSSProperties;
  label: string;
}) {
  return (
    <nav className="sidebar" aria-label={label} style={{ gap: 12, ...style }}>
      {items.map(it => {
        const on = it.id === active;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onPick(it.id)}
            aria-current={on ? 'page' : undefined}
            style={{
              width: 53,
              height: 31,
              borderRadius: 4,
              border: on ? '1px solid var(--select-ring)' : '1px solid transparent',
              background: on ? 'rgba(255,176,5,0.08)' : 'transparent',
              color: '#fff',
              fontSize: 11,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {it.label}
          </button>
        );
      })}
    </nav>
  );
}
