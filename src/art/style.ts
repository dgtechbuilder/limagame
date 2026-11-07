import { createContext, useContext } from 'react';
import type { Settings } from '../state';

/* Player settings that screens read without being handed the game state: how characters are drawn
   (Settings → Character style) and whether lines are read aloud (Settings → Read aloud). The 3D farm reads the
   style when it is built; the app builds a new farm when it changes. */

export type ArtStyle = Settings['art'];

export const ArtContext = createContext<ArtStyle>('anime');
export const useArt = () => useContext(ArtContext);
export const useAnime = () => useContext(ArtContext) === 'anime';

export const VoiceContext = createContext(false);
export const useVoice = () => useContext(VoiceContext);
