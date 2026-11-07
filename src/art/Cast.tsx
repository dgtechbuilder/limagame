import type { CSSProperties } from 'react';
import { img } from '../assets';
import { Img } from '../components/ui';
import { CAST, AnimeBust, CastArt, type CastId } from './anime';
import { useAnime } from './style';

/* The guide, the shopkeeper and Ojuok: retro anime when Character style is anime, the original pictures otherwise. */

const ORIGINAL: Record<CastId, string> = { guide: img.guide, shopkeeper: img.shopkeeper, ojuok: img.rewardAvatar };

export function Cast({
  id,
  w,
  h,
  alt = '',
  backdrop = 'sun',
  style,
  imgStyle,
}: {
  id: CastId;
  w: number;
  h: number;
  alt?: string;
  backdrop?: 'sun' | 'panel' | 'none';
  /** position, for both styles */
  style?: CSSProperties;
  /** extra style for the original picture only (its cropping) */
  imgStyle?: CSSProperties;
}) {
  const anime = useAnime();
  if (anime) return <CastArt id={id} w={w} h={h} alt={alt || undefined} backdrop={backdrop} style={{ display: 'block', ...style }} />;
  return <Img src={ORIGINAL[id]} w={w} h={h} alt={alt} style={{ ...style, ...imgStyle }} />;
}

/** The guide's face in the round chip beside her lines. */
export function GuideFace() {
  const anime = useAnime();
  if (anime) return <AnimeBust t={CAST.guide} size={44} style={{ position: 'absolute', left: 0, top: -1 }} />;
  return <img src={img.guide} alt="" />;
}
