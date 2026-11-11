import type { CSSProperties, ReactNode } from 'react';
import sasha from './cast/sasha.webp';
import caro from './cast/caro.webp';
import aziza from './cast/aziza.webp';
import wekeza from './cast/wekeza.webp';
import gitonga from './cast/gitonga.webp';

/* Hello Tractor's five brand characters as in-game guides (the brief, §6.5): Sasha speaks for Hello Tractor (welcome,
   seasons, graduation), Caro coaches (tips, the CX Team's voice), Aziza is the agent's mirror (the portal, PAYG),
   Wekeza is the farmer's voice (scoping, confirmation), Gitonga the owner (ownership milestones, the fleet). The
   pictures are the brief's renders: never rotated, cropped below the head, on palette colours only. */

export type CastId = 'sasha' | 'caro' | 'aziza' | 'wekeza' | 'gitonga';

export const CAST: Record<CastId, { name: string; role: string; src: string }> = {
  sasha: { name: 'Sasha', role: 'Hello Tractor', src: sasha },
  caro: { name: 'Caro', role: 'Champion agent · the coach', src: caro },
  aziza: { name: 'Aziza', role: 'Booking agent', src: aziza },
  wekeza: { name: 'Wekeza', role: 'Farmer', src: wekeza },
  gitonga: { name: 'Gitonga', role: 'Equipment owner', src: gitonga },
};

/** A character's picture in a square frame, the figure bleeding off the bottom. */
export function Face({ who, size = 44, style }: { who: CastId; size?: number; style?: CSSProperties }) {
  return <img className="ht-face" src={CAST[who].src} alt="" width={size} height={size} draggable={false} style={{ width: size, height: size, ...style }} />;
}

/** A character speaking in the speech-bubble supergraphic: the face beside the bubble, its tail away from the mouth. */
export function Says({ who, children, tone = 'white', style }: { who: CastId; children: ReactNode; tone?: 'white' | 'blaze' | 'plum' | 'sage'; style?: CSSProperties }) {
  return (
    <div className={`ht-says is-${tone}`} style={style}>
      <span className="ht-says-face">
        <Face who={who} size={56} />
        <small>{CAST[who].name}</small>
      </span>
      <div className="ht-bubble">{children}</div>
    </div>
  );
}
