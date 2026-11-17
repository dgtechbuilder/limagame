import { img } from '../assets';

/** The farm map from Figma. It is the ground of the whole game: the farm screen, and the backdrop behind every
    review and modal. `world`: the picture of the 3D farm instead (the first session is played on it). */
export function FarmMap({ alt = '', dim = 0, world = false }: { alt?: string; dim?: number; world?: boolean }) {
  const [one, two] = world ? [img.bgWorld, img.bgWorld2x] : [img.bg, img.bg2x];
  return (
    <>
      <img className="farm-bg" src={one} srcSet={`${one} 1x, ${two} 2x`} alt={alt} draggable={false} decoding="async" />
      {dim > 0 && <div className="abs" style={{ inset: 0, background: `rgba(12, 20, 8, ${dim})`, pointerEvents: 'none' }} />}
    </>
  );
}
