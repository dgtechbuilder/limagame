/** The stage the game is laid out on (iPhone landscape), in CSS pixels; App scales it to fit the window. */
export const STAGE_W = 874;
export const STAGE_H = 402;

/** The scale that fits the stage in a w × h window. */
export function fitScale(w: number, h: number, roomForPicker = false) {
  // phones (and small windows) use the whole screen; larger screens keep a margin that grows with the screen, so the
  // stage's shadow and rounded corners show without wasting a fixed 48px on a small laptop
  const small = w < 700 || h < 420;
  const padX = small ? 0 : Math.min(48, Math.round(w * 0.03));
  const padY = small ? 0 : roomForPicker ? 112 : Math.min(48, Math.round(h * 0.04));
  return Math.max(0.1, Math.min((w - padX) / STAGE_W, (h - padY) / STAGE_H));
}
