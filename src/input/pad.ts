/* Game controllers, the pure part: which kind of controller it is (Xbox, PlayStation, Nintendo or another make), what
   its buttons are called, and how its raw buttons and sticks are read as the game's actions. The browser's Gamepad
   API gives most controllers the "standard" layout (the same button numbers for an Xbox, a DualShock, a DualSense,
   a Switch Pro or an 8BitDo); others (older or cheaper pads, some browsers) arrive unmapped, and are read with a
   best guess that the player can correct in Settings → Controller → Set up buttons. The live part is gamepad.ts. */

export type PadFamily = 'xbox' | 'playstation' | 'nintendo' | 'generic';

/** What a controller does in the game. */
export type PadAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'x' | 'y' | 'prev' | 'next' | 'prevTab' | 'nextTab' | 'start' | 'select';

export const PAD_ACTIONS: PadAction[] = ['up', 'down', 'left', 'right', 'confirm', 'back', 'x', 'y', 'prev', 'next', 'prevTab', 'nextTab', 'start', 'select'];

/** One raw input: a button by its number, or one way of an axis (a stick or a D-pad reported as an axis). */
export type PadBinding = { b: number } | { a: number; s: 1 | -1 };
export type PadMap = Partial<Record<PadAction, PadBinding>>;

/** The player's controller settings (kept with the other settings, on this device). */
export interface PadSettings {
  /** use controllers at all */
  on: boolean;
  /** which button names to show: the controller's own (auto), or always one make's */
  glyphs: 'auto' | PadFamily;
  /** swap Confirm and Back (Nintendo-style: confirm on the right-hand button) */
  swap: boolean;
  /** short rumbles when something is done (controllers that can) */
  rumble: boolean;
  /** how far a stick must move before it counts */
  dead: 'small' | 'medium' | 'large';
  /** buttons the player set up themselves, by controller */
  maps: Record<string, PadMap>;
}

export const DEFAULT_PAD: PadSettings = { on: true, glyphs: 'auto', swap: false, rumble: true, dead: 'medium', maps: {} };

export const DEAD_ZONE: Record<PadSettings['dead'], number> = { small: 0.12, medium: 0.22, large: 0.35 };

/** Which make a controller is, from the name and USB vendor the browser reports. */
export function padFamily(id: string): PadFamily {
  const s = id.toLowerCase();
  const vendor = /vendor:\s*([0-9a-f]{4})/.exec(s)?.[1] ?? /^([0-9a-f]{4})-[0-9a-f]{4}-/.exec(s)?.[1];
  // the USB vendor is surest (Sony, Nintendo, Microsoft); then the name ("Wireless Controller" alone is a DualShock 4)
  if (vendor === '054c') return 'playstation';
  if (vendor === '057e') return 'nintendo';
  if (vendor === '045e') return 'xbox';
  if (/xbox|xinput|microsoft|x-box/.test(s)) return 'xbox';
  if (/playstation|dualshock|dualsense|ps[345]\b|sony|^wireless controller/.test(s)) return 'playstation';
  if (/nintendo|pro controller|joy-?con|switch/.test(s)) return 'nintendo';
  return 'generic';
}

/** A short, readable name for a controller ("Xbox Wireless Controller" rather than its long USB id). */
export function padName(id: string): string {
  const s = id
    .replace(/\(.*?(vendor|standard gamepad).*?\)/gi, '')
    .replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s && s.length <= 40) return s;
  return { xbox: 'Xbox controller', playstation: 'PlayStation controller', nintendo: 'Nintendo controller', generic: 'Controller' }[padFamily(id)];
}

export const FAMILY_NAME: Record<PadFamily, string> = { xbox: 'Xbox', playstation: 'PlayStation', nintendo: 'Nintendo', generic: 'Other controller' };

/** The button names each make prints on its controllers, by position (bottom, right, left, top face buttons). */
const LABELS: Record<PadFamily, Record<PadAction, string>> = {
  xbox: { up: 'D-pad ↑', down: 'D-pad ↓', left: 'D-pad ←', right: 'D-pad →', confirm: 'A', back: 'B', x: 'X', y: 'Y', prev: 'LB', next: 'RB', prevTab: 'LT', nextTab: 'RT', start: 'Menu', select: 'View' },
  playstation: { up: 'D-pad ↑', down: 'D-pad ↓', left: 'D-pad ←', right: 'D-pad →', confirm: '✕', back: '○', x: '□', y: '△', prev: 'L1', next: 'R1', prevTab: 'L2', nextTab: 'R2', start: 'Options', select: 'Create' },
  nintendo: { up: 'D-pad ↑', down: 'D-pad ↓', left: 'D-pad ←', right: 'D-pad →', confirm: 'B', back: 'A', x: 'Y', y: 'X', prev: 'L', next: 'R', prevTab: 'ZL', nextTab: 'ZR', start: '+', select: '−' },
  generic: { up: 'D-pad ↑', down: 'D-pad ↓', left: 'D-pad ←', right: 'D-pad →', confirm: 'Bottom button', back: 'Right button', x: 'Left button', y: 'Top button', prev: 'Left bumper', next: 'Right bumper', prevTab: 'Left trigger', nextTab: 'Right trigger', start: 'Start', select: 'Select' },
};

/** What a button is called on this make of controller (Confirm is "A" on Xbox, "✕" on PlayStation). With Confirm and
    Back swapped, the labels follow the buttons that now do each job. */
export function padLabel(action: PadAction, family: PadFamily, swap = false): string {
  const a = swap && action === 'confirm' ? 'back' : swap && action === 'back' ? 'confirm' : action;
  return LABELS[family][a];
}

/** The standard layout (w3c.github.io/gamepad/#remapping): the same numbers on every mapped controller. */
const STANDARD: Record<PadAction, PadBinding> = {
  confirm: { b: 0 },
  back: { b: 1 },
  x: { b: 2 },
  y: { b: 3 },
  prev: { b: 4 },
  next: { b: 5 },
  prevTab: { b: 6 },
  nextTab: { b: 7 },
  select: { b: 8 },
  start: { b: 9 },
  up: { b: 12 },
  down: { b: 13 },
  left: { b: 14 },
  right: { b: 15 },
};

/** Unmapped controllers: the face buttons usually come first and Start/Select after the shoulders. The D-pad is read
    from the hat (see readPad) as well as from these. A PlayStation pad that arrives unmapped puts ✕ second. */
const GUESS: Record<PadFamily, PadMap> = {
  generic: { confirm: { b: 0 }, back: { b: 1 }, x: { b: 2 }, y: { b: 3 }, prev: { b: 4 }, next: { b: 5 }, prevTab: { b: 6 }, nextTab: { b: 7 }, select: { b: 8 }, start: { b: 9 } },
  xbox: { confirm: { b: 0 }, back: { b: 1 }, x: { b: 2 }, y: { b: 3 }, prev: { b: 4 }, next: { b: 5 }, select: { b: 6 }, start: { b: 7 } },
  playstation: { x: { b: 0 }, confirm: { b: 1 }, back: { b: 2 }, y: { b: 3 }, prev: { b: 4 }, next: { b: 5 }, prevTab: { b: 6 }, nextTab: { b: 7 }, select: { b: 8 }, start: { b: 9 } },
  nintendo: { back: { b: 0 }, confirm: { b: 1 }, y: { b: 2 }, x: { b: 3 }, prev: { b: 4 }, next: { b: 5 }, prevTab: { b: 6 }, nextTab: { b: 7 }, select: { b: 8 }, start: { b: 9 } },
};

/** The smallest piece of a Gamepad that is read (so the tests and old browsers can hand in look-alikes). */
export interface PadLike {
  id: string;
  index: number;
  mapping: string;
  connected: boolean;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

/** The key the player's own button setup is kept under: the same controller model shares it. */
export const padKey = (id: string) => id.replace(/\s+/g, ' ').trim().slice(0, 80);

export interface PadRead {
  /** which actions are held */
  on: Record<PadAction, boolean>;
  /** the left stick, past the dead zone and scaled back to 0..1 */
  stick: { x: number; y: number };
  /** the right stick, the same way */
  look: { x: number; y: number };
}

const press = (p: PadLike, bind: PadBinding | undefined): boolean => {
  if (!bind) return false;
  if ('b' in bind) {
    const btn = p.buttons[bind.b];
    return !!btn && (btn.pressed || btn.value > 0.5);
  }
  const v = p.axes[bind.a];
  return typeof v === 'number' && Math.abs(v) <= 1.05 && v * bind.s > 0.5;
};

/** A stick past its dead zone (radial, so diagonals are not cut), scaled so the first step past it starts at 0. */
export function deadZone(x: number, y: number, dead: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (!Number.isFinite(len) || len < dead) return { x: 0, y: 0 };
  const k = Math.min(1, (len - dead) / (1 - dead)) / len;
  return { x: x * k, y: y * k };
}

/** The D-pad of an unmapped controller, from its hat: Chrome reports it as one axis (often number 9) stepping round
    the eight ways from -1 (up) to 1 (up-left), and resting above 1; Firefox as two axes (6 and 7) of -1, 0 or 1. */
function hat(p: PadLike): { x: number; y: number } {
  const h = p.axes[9];
  if (p.axes.length >= 10 && typeof h === 'number' && h >= -1.05 && h <= 1.05) {
    const way = Math.round(((h + 1) * 7) / 2);
    if (way >= 0 && way <= 7) {
      const dirs: [number, number][] = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
      return { x: dirs[way][0], y: dirs[way][1] };
    }
  }
  if (p.axes.length >= 8) {
    const x = p.axes[6];
    const y = p.axes[7];
    // only when both sit on whole steps (a stick or a half-pressed trigger is not a D-pad)
    const step = (v: number) => Math.abs(v) < 0.05 || Math.abs(Math.abs(v) - 1) < 0.05;
    // both at -1 is two triggers at rest, not the D-pad held up-left
    if (step(x) && step(y) && (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) && !(x < -0.5 && y < -0.5)) return { x: Math.round(x), y: Math.round(y) };
  }
  return { x: 0, y: 0 };
}

/** Read a controller as the game's actions. */
export function readPad(p: PadLike, cfg: PadSettings): PadRead {
  const own = cfg.maps[padKey(p.id)] ?? {};
  const family = padFamily(p.id);
  const base: PadMap = p.mapping === 'standard' ? STANDARD : GUESS[family];
  // the player's own buttons win: a guessed binding on a button they gave another job is dropped
  const same = (x: PadBinding, y: PadBinding) => ('b' in x && 'b' in y ? x.b === y.b : 'a' in x && 'a' in y ? x.a === y.a && x.s === y.s : false);
  const taken = Object.values(own).filter((x): x is PadBinding => !!x);
  const bind = (a: PadAction) => own[a] ?? (base[a] && !taken.some(t => same(t, base[a]!)) ? base[a] : undefined);
  const on = {} as Record<PadAction, boolean>;
  for (const a of PAD_ACTIONS) on[a] = press(p, bind(a));
  if (cfg.swap) [on.confirm, on.back] = [on.back, on.confirm];
  const dead = DEAD_ZONE[cfg.dead] ?? DEAD_ZONE.medium;
  const stick = deadZone(p.axes[0] ?? 0, p.axes[1] ?? 0, dead);
  // the right stick: axes 2 and 3 on mapped controllers; unmapped ones often put it on 2 and 5 or 3 and 4
  const look = p.mapping === 'standard' ? deadZone(p.axes[2] ?? 0, p.axes[3] ?? 0, dead) : { x: 0, y: 0 };
  if (p.mapping !== 'standard') {
    const h = hat(p);
    if (h.y < 0) on.up = true;
    if (h.y > 0) on.down = true;
    if (h.x < 0) on.left = true;
    if (h.x > 0) on.right = true;
  }
  return { on, stick, look };
}

/** The first raw input held now that was not held before (for Set up buttons). */
export function firstNewInput(p: PadLike, before: PadLike | null): PadBinding | null {
  for (let i = 0; i < p.buttons.length; i++) {
    const now = p.buttons[i].pressed || p.buttons[i].value > 0.5;
    const was = !!before && !!before.buttons[i] && (before.buttons[i].pressed || before.buttons[i].value > 0.5);
    if (now && !was) return { b: i };
  }
  for (let i = 0; i < p.axes.length; i++) {
    const v = p.axes[i];
    if (Math.abs(v) > 1.05) continue;
    const was = before ? before.axes[i] ?? 0 : 0;
    // an axis counts when it is pushed most of the way from where it rested (triggers rest at -1)
    if (Math.abs(v) > 0.7 && Math.abs(was) < 0.3) return { a: i, s: v > 0 ? 1 : -1 };
  }
  return null;
}

export const bindingName = (b: PadBinding) => ('b' in b ? `Button ${b.b + 1}` : `Axis ${b.a + 1}${b.s > 0 ? '+' : '−'}`);

/** The controller settings of a save, filled in (older saves have none). */
export const padSettings = (p?: Partial<PadSettings>): PadSettings => ({ ...DEFAULT_PAD, ...(p ?? {}), maps: p?.maps ?? {} });
