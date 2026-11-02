import { img } from '../assets';

/** The farm map from Figma. It is the ground of the whole game: the first-session walk,
    the farm screen, and the backdrop behind every review and modal. */
export function FarmMap({ alt = '', dim = 0 }: { alt?: string; dim?: number }) {
  return (
    <>
      <img className="farm-bg" src={img.bg} srcSet={`${img.bg} 1x, ${img.bg2x} 2x`} alt={alt} draggable={false} decoding="async" />
      {dim > 0 && <div className="abs" style={{ inset: 0, background: `rgba(12, 20, 8, ${dim})`, pointerEvents: 'none' }} />}
    </>
  );
}
