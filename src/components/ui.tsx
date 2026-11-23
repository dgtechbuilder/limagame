import type { CSSProperties, ReactNode } from 'react';
import { img } from '../assets';
import { StarIcon } from './Icons';
import { money } from '../money';

export const fmt = (n: number) => n.toLocaleString('en-US');

export function Img({
  src,
  w,
  h,
  style,
  alt = '',
  className,
}: {
  src: string;
  w: number;
  h: number;
  style?: CSSProperties;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      width={w}
      height={h}
      alt={alt}
      draggable={false}
      className={className}
      style={{ width: w, height: h, objectFit: 'contain', ...style }}
    />
  );
}

/** Type scale: sizes passed as props are the old design sizes, drawn at 80% (rounded down to half a pixel, 7px at least). */
export const shrink = (px: number) => (px <= 7 ? px : Math.max(7, Math.floor(px * 1.6) / 2));

/** Gold price pill with the green cash note, e.g. "💵 $3.10": 12px bold, 28px tall (docs/ui-spacing-plan.md §4). */
export function PriceChip({ price, width, font = 12 }: { price: number; width?: number | string; font?: number }) {
  return (
    <span className="pp-price" style={{ width, fontSize: shrink(Math.max(12, font)) }}>
      <img src={img.cash} alt="" width={14} height={14} />
      <span>{money(price)}</span>
    </span>
  );
}

export function GoldButton({
  children,
  onClick,
  selected,
  style,
  font,
  height,
  ariaLabel,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  style?: CSSProperties;
  font?: number;
  height?: number;
  ariaLabel?: string;
  /** pp-main: the one main button of a pop-up (its size comes from the class) */
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`gold-btn${selected ? ' is-selected' : ''}${className ? ` ${className}` : ''}`}
      onClick={selected ? undefined : onClick}
      aria-pressed={selected || undefined}
      aria-label={ariaLabel}
      // 8px at least: the label floor in docs/ui-spacing-plan.md
      style={{ fontSize: font != null ? shrink(Math.max(10, font)) : className ? undefined : 8, height, ...style }}
    >
      {children}
    </button>
  );
}

export function Stars({ value, size = 10, max = 5 }: { value: number; size?: number; max?: number }) {
  return (
    <span className="stars" role="img" aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => (
        <StarIcon key={i} size={size} filled={i < value} />
      ))}
    </span>
  );
}

export function Coin({ size = 14 }: { size?: number }) {
  return <img src={img.cash} alt="" width={size} height={size} style={{ width: size, height: size }} />;
}

export function Partner({ top }: { top: number }) {
  return (
    <div className="partner" style={{ top }}>
      <span>in partnership with</span>
      <img src={img.partner} alt="" width={16} height={16} />
    </div>
  );
}
