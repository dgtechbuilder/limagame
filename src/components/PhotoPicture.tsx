import { useState } from 'react';
import { photoSrc, type Photo } from '../rounds/photos';

/** A real photo with an optional clue ring and its credit (author and licence, as the licence requires). On Data saver
    it shows the light copy (rounds/photos.ts). While it downloads the frame shows a soft placeholder; if a weak signal
    drops it, a tap tries again (the check's words still say what to look for). */
export function PhotoPicture({ photo, alt, clue = false, credit = false }: { photo: Photo; alt: string; clue?: boolean; credit?: boolean }) {
  const ring = clue ? photo.ring : undefined;
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [attempt, setAttempt] = useState(0);
  const src = photoSrc(photo);
  return (
    <span className={`rr-photo-wrap is-${state}`}>
      <img
        key={attempt}
        className="rr-photo"
        src={attempt ? `${src}${src.includes('?') ? '&' : '?'}try=${attempt}` : src}
        alt={alt}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => setState('ok')}
        onError={() => setState('failed')}
      />
      {state === 'failed' && (
        <button
          type="button"
          className="rr-photo-retry"
          onClick={e => {
            e.stopPropagation();
            setState('loading');
            setAttempt(n => n + 1);
          }}
        >
          📶 Photo did not load. Tap to try again
        </button>
      )}
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
