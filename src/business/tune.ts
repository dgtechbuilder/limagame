/* Settings → Tractor: how the tractor handles and sounds in the business day's drive (DayDrive.tsx). Kept with the
   game's settings on this device; an old save gains the defaults. */

import type { DriveTune } from './drive';

export type TractorSpeed = 'gentle' | 'normal' | 'quick' | 'fast';
export type TractorSteer = 'low' | 'medium' | 'high';
export type TractorVolume = 'off' | 'quiet' | 'normal' | 'loud';
export type TractorFx = 'off' | 'some' | 'lots';

export interface TractorSettings {
  /** driving speed: gentle is slowest (the time a field allows grows to match) */
  speed: TractorSpeed;
  /** steering sensitivity: how sharply the tractor turns and how fast it changes lane */
  steer: TractorSteer;
  /** on a touch screen: tap and hold where to go, or steering buttons (the tractor drives itself forward) */
  controls: 'tap' | 'buttons';
  /** the engine, the knocks and the horn */
  sound: TractorVolume;
  /** smoke from the exhaust, dust from the implement, and the bursts when something is hit */
  effects: TractorFx;
  /** the view shakes when the tractor hits something */
  shake: boolean;
  /** faint lines on the field where each pass should go */
  guides: boolean;
}

export const DEFAULT_TRACTOR: TractorSettings = { speed: 'normal', steer: 'medium', controls: 'tap', sound: 'normal', effects: 'lots', shake: true, guides: true };

export const tractorSettings = (t?: Partial<TractorSettings>): TractorSettings => ({ ...DEFAULT_TRACTOR, ...(t ?? {}) });

export const SPEED_MUL: Record<TractorSpeed, number> = { gentle: 0.7, normal: 1, quick: 1.25, fast: 1.5 };
export const STEER_MUL: Record<TractorSteer, number> = { low: 0.75, medium: 1, high: 1.3 };
export const VOLUME: Record<TractorVolume, number> = { off: 0, quiet: 0.3, normal: 0.6, loud: 1 };
export const FX_MUL: Record<TractorFx, number> = { off: 0, some: 0.45, lots: 1 };

export const tuneOf = (t: TractorSettings): DriveTune => ({ speed: SPEED_MUL[t.speed], steer: STEER_MUL[t.steer] });
