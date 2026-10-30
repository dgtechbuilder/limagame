import type { CSSProperties, ReactNode } from 'react';
import { img } from '../assets';
import { StarIcon } from './Icons';

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

/** Gold price chip with the green cash note, e.g. "40 💵". */
export function PriceChip({ price, width, font = 8 }: { price: number; width?: number | string; font?: number }) {
  return (
    <span className="chip" style={{ width, fontSize: font }}>
      <img src={img.cash} alt="" width={14} height={14} />
      <span>{fmt(price)}</span>
    </span>
  );
}

export function GoldButton({
  children,
  onClick,
  selected,
  style,
  font = 8,
  height,
  ariaLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  style?: CSSProperties;
  font?: number;
  height?: number;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      className={`gold-btn${selected ? ' is-selected' : ''}`}
      onClick={selected ? undefined : onClick}
      aria-pressed={selected || undefined}
      aria-label={ariaLabel}
      style={{ fontSize: font, height, ...style }}
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
  return <img src={img.coin} alt="" width={size} height={size} style={{ width: size, height: size }} />;
}

export function Partner({ top }: { top: number }) {
  return (
    <div className="partner" style={{ top }}>
      <span>in partnership with</span>
      <img src={img.partner} alt="" width={16} height={16} />
    </div>
  );
}
