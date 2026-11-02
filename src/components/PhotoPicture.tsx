import type { Photo } from '../rounds/photos';

/** A real photo with an optional clue ring and its credit (author and licence, as the licence requires). */
export function PhotoPicture({ photo, alt, clue = false, credit = false }: { photo: Photo; alt: string; clue?: boolean; credit?: boolean }) {
  const ring = clue ? photo.ring : undefined;
  return (
    <span className="rr-photo-wrap">
      <img className="rr-photo" src={photo.url} alt={alt} loading="lazy" decoding="async" draggable={false} />
      {ring && (
        <svg className="rr-ring" viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <circle className="clue-ring" cx={ring[0]} cy={ring[1] * 0.7} r={ring[2]} fill="none" stroke="#ffb005" strokeWidth={1.4} />
        </svg>
      )}
      {clue && !ring && <span className="rr-flag" />}
      {credit && (
        <span className="rr-credit">
          Photo: {photo.author} · {photo.license}
        </span>
      )}
    </span>
  );
}
