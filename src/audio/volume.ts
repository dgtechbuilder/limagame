/* Settings → Sound: how loud the game is. One overall volume (2% to start, so the game is only just heard) and a
   share of it for each kind of sound. Every sound in the game reads its level here: the music, the footsteps, the
   farm animals (src/audio/ambience.ts), the reward cues (src/sfx.ts) and the tractor's drive (business/driveAudio.ts).
   Levels are whole percentages; a sound plays at overall × its own share. */

export type VolumeChannel = 'music' | 'steps' | 'animals' | 'effects';

export interface VolumeSettings {
  /** everything, 0–100 */
  master: number;
  /** the background score */
  music: number;
  /** the farmer's footsteps on grass and on soil */
  steps: number;
  /** the cows mooing and the hens clucking */
  animals: number;
  /** the reward cues and the tractor's drive */
  effects: number;
}

export const DEFAULT_VOLUME: VolumeSettings = { master: 2, music: 100, steps: 100, animals: 100, effects: 100 };

const clampPct = (n: unknown, fallback: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : fallback);

/** A save's volume settings, with the defaults for anything missing (saves made before Settings → Sound have none). */
export const volumeSettings = (v?: Partial<VolumeSettings>): VolumeSettings => ({
  master: clampPct(v?.master, DEFAULT_VOLUME.master),
  music: clampPct(v?.music, DEFAULT_VOLUME.music),
  steps: clampPct(v?.steps, DEFAULT_VOLUME.steps),
  animals: clampPct(v?.animals, DEFAULT_VOLUME.animals),
  effects: clampPct(v?.effects, DEFAULT_VOLUME.effects),
});

let now: VolumeSettings = DEFAULT_VOLUME;
const subs = new Set<() => void>();

/** App.tsx keeps this in step with the settings. */
export function setVolume(v: VolumeSettings) {
  if (v.master === now.master && v.music === now.music && v.steps === now.steps && v.animals === now.animals && v.effects === now.effects) return;
  now = v;
  subs.forEach(f => f());
}
export const volumeNow = () => now;
/** The gain (0–1) a kind of sound plays at: the overall volume times its share. */
export const gainOf = (ch: VolumeChannel) => (now.master / 100) * (now[ch] / 100);
/** Called whenever a level changes; returns the way to stop listening. */
export function onVolume(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}
