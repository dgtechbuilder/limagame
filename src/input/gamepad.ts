/* Game controllers, the live part: any controller the browser sees (Xbox, PlayStation, Nintendo, 8BitDo, Logitech,
   PowerA, unbranded USB pads) plays the whole game. It is read every frame and turned into what the game already
   understands, so every screen works with it without code of its own:
   - the D-pad and the left stick press the arrow keys (walking, driving, steering, lanes); the left stick also walks
     the farmer on the 3D farm with analogue speed (padStick);
   - on menus and pages, where no game takes the arrows, they move the focus to the nearest button that way;
   - Confirm (A / ✕) presses Enter and the button in focus, or the farm's action button when nothing is in focus;
     Back (B / ○) presses Escape; X / □ presses Space; Y / △ walks to the next task;
   - the bumpers step through the buttons one by one; the triggers change the page's section;
   - Start opens the main menu; Select / View / Create opens Settings; the right stick scrolls.
   Settings → Controller shows the controller, its button names, and sets up the buttons of a controller the browser
   does not know. The mapping itself (which button is which, by make) is in pad.ts. */

import { DEFAULT_PAD, padFamily, padKey, padName, firstNewInput, readPad, PAD_ACTIONS, type PadAction, type PadBinding, type PadFamily, type PadLike, type PadRead, type PadSettings } from './pad';

export interface PadInfo {
  index: number;
  id: string;
  name: string;
  family: PadFamily;
  /** the browser knows its layout ("standard"); unmapped controllers use a best guess or the player's own setup */
  standard: boolean;
  /** it can rumble */
  rumble: boolean;
  /** the player has set up its buttons */
  custom: boolean;
}

let cfg: PadSettings = DEFAULT_PAD;
const held = new Map<number, Record<PadAction, boolean>>();
const repeatAt = new Map<string, number>();
const lastRaw = new Map<number, PadLike>();
let stick = { x: 0, y: 0 };
let raf = 0;
let poll = 0;
let started = false;
let known: PadInfo[] = [];
let lastFamily: PadFamily | null = null;
const listeners = new Set<() => void>();
const pressListeners = new Set<(on: Set<PadAction>) => void>();
let capture: ((b: PadBinding, pad: PadInfo) => void) | null = null;

const REPEAT_DELAY = 380;
const REPEAT_EVERY = 140;
const DIRS: PadAction[] = ['up', 'down', 'left', 'right'];
const ARROW: Record<string, { key: string; code: string }> = {
  up: { key: 'ArrowUp', code: 'ArrowUp' },
  down: { key: 'ArrowDown', code: 'ArrowDown' },
  left: { key: 'ArrowLeft', code: 'ArrowLeft' },
  right: { key: 'ArrowRight', code: 'ArrowRight' },
};

/* ---------------- the controllers the browser sees ---------------- */

function rawPads(): PadLike[] {
  try {
    const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    return Array.from(list ?? []).filter((p): p is Gamepad => !!p && p.connected !== false) as unknown as PadLike[];
  } catch {
    // a page in a frame without permission to use controllers
    return [];
  }
}

const canRumble = (p: PadLike) => !!(p as unknown as Gamepad).vibrationActuator;

function infoOf(p: PadLike): PadInfo {
  return { index: p.index, id: p.id, name: padName(p.id), family: padFamily(p.id), standard: p.mapping === 'standard', rumble: canRumble(p), custom: !!cfg.maps[padKey(p.id)] };
}

function refresh(list = rawPads(), schedule = true) {
  const next = list.map(infoOf);
  const same = next.length === known.length && next.every((p, i) => p.id === known[i].id && p.index === known[i].index && p.custom === known[i].custom);
  if (!same) {
    const added = next.filter(p => !known.some(k => k.index === p.index && k.id === p.id));
    const gone = known.filter(k => !next.some(p => p.index === k.index && p.id === k.id));
    known = next;
    for (const g of gone) held.delete(g.index), lastRaw.delete(g.index);
    if (next[0]) lastFamily = next[0].family;
    listeners.forEach(f => f());
    for (const a of added) window.dispatchEvent(new CustomEvent('lima:pad', { detail: { kind: 'connected', pad: a } }));
    for (const g of gone) window.dispatchEvent(new CustomEvent('lima:pad', { detail: { kind: 'disconnected', pad: g } }));
  }
  // the frame loop runs while a controller is connected (frame() keeps itself going)
  if (schedule && known.length && !raf) raf = requestAnimationFrame(frame);
}

/** The controllers connected now. */
export const connectedPads = () => known;

/** The make of the controller played last (for the button names shown on screen), or null with none. */
export const activeFamily = () => (known.length ? (known.find(k => k.family === lastFamily)?.family ?? known[0].family) : null);

/** Hear when a controller comes or goes, or its setup changes. */
export function onPads(f: () => void) {
  listeners.add(f);
  return () => void listeners.delete(f);
}

/** Hear which actions are held, every time it changes (the button test in Settings). */
export function onPadPress(f: (on: Set<PadAction>) => void) {
  pressListeners.add(f);
  return () => void pressListeners.delete(f);
}

/** The player's controller settings (App.tsx keeps them in step with Settings). */
export function setPadConfig(next: PadSettings) {
  const mapsChanged = next.maps !== cfg.maps;
  cfg = next;
  if (!cfg.on) releaseAll();
  if (mapsChanged) {
    known = known.map(k => ({ ...k, custom: !!cfg.maps[padKey(k.id)] }));
    listeners.forEach(f => f());
  }
}

/** The left stick on the 3D farm: an analogue walk (0 when it rests, or controllers are off). */
export function padStick() {
  return stick;
}

/** Wait for the next button or stick the player presses (Set up buttons); the game ignores the controller meanwhile. */
export function captureInput(f: (b: PadBinding, pad: PadInfo) => void) {
  capture = f;
  for (const p of rawPads()) lastRaw.set(p.index, snapshot(p));
  releaseAll();
  return () => {
    if (capture === f) capture = null;
  };
}

/** A short rumble, on controllers that can (and when the player has not turned it off). */
export function rumble(kind: 'tap' | 'done' = 'tap') {
  if (!cfg.on || !cfg.rumble) return;
  for (const p of rawPads()) {
    const act = (p as unknown as Gamepad).vibrationActuator as (GamepadHapticActuator & { playEffect?: (t: string, o: object) => Promise<unknown> }) | null | undefined;
    try {
      void act?.playEffect?.('dual-rumble', kind === 'done' ? { duration: 180, strongMagnitude: 0.6, weakMagnitude: 0.4 } : { duration: 60, strongMagnitude: 0, weakMagnitude: 0.5 })?.catch?.(() => {});
    } catch {
      /* no rumble here */
    }
  }
}

const snapshot = (p: PadLike): PadLike => ({ id: p.id, index: p.index, mapping: p.mapping, connected: true, axes: [...p.axes], buttons: p.buttons.map(b => ({ pressed: b.pressed, value: b.value })) });

/* ---------------- every frame ---------------- */

function frame() {
  raf = 0;
  const list = rawPads();
  refresh(list, false);
  if (!list.length) {
    stick = { x: 0, y: 0 };
    return;
  }
  raf = requestAnimationFrame(frame);

  if (capture) {
    for (const p of list) {
      const got = firstNewInput(p, lastRaw.get(p.index) ?? null);
      lastRaw.set(p.index, snapshot(p));
      if (got) {
        const f = capture;
        capture = null;
        f(got, infoOf(p));
        break;
      }
    }
    return;
  }
  if (!cfg.on) return;

  // every controller plays: what any of them holds is held
  const on = Object.fromEntries(PAD_ACTIONS.map(a => [a, false])) as Record<PadAction, boolean>;
  let move = { x: 0, y: 0 };
  let look = { x: 0, y: 0 };
  let who: PadLike | null = null;
  for (const p of list) {
    const r: PadRead = readPad(p, cfg);
    let any = false;
    for (const a of PAD_ACTIONS) if (r.on[a]) (on[a] = true), (any = true);
    if (Math.hypot(r.stick.x, r.stick.y) > Math.hypot(move.x, move.y)) (move = r.stick), (any = true);
    if (Math.hypot(r.look.x, r.look.y) > Math.hypot(look.x, look.y)) look = r.look;
    if (any || r.look.x || r.look.y) who = p;
    lastRaw.set(p.index, p);
  }
  if (who) lastFamily = padFamily(who.id);
  stick = move;
  // the left stick counts as the D-pad past half way, so it walks, steers and moves the focus too
  if (move.y < -0.5) on.up = true;
  if (move.y > 0.5) on.down = true;
  if (move.x < -0.5) on.left = true;
  if (move.x > 0.5) on.right = true;

  const before = held.get(-1) ?? (Object.fromEntries(PAD_ACTIONS.map(a => [a, false])) as Record<PadAction, boolean>);
  held.set(-1, on);
  const now = performance.now();
  let changed = false;
  for (const a of PAD_ACTIONS) {
    if (on[a] !== before[a]) changed = true;
    if (on[a] && !before[a]) {
      padActive();
      down(a, false);
      repeatAt.set(a, now + REPEAT_DELAY);
    } else if (on[a] && DIRS.includes(a) && now >= (repeatAt.get(a) ?? Infinity)) {
      down(a, true);
      repeatAt.set(a, now + REPEAT_EVERY);
    } else if (!on[a] && before[a]) {
      up(a);
      repeatAt.delete(a);
    }
  }
  if (move.x || move.y) padActive();
  if (look.y || look.x) scroll(look);
  if (changed) {
    const set = new Set(PAD_ACTIONS.filter(a => on[a]));
    pressListeners.forEach(f => f(set));
  }
}

function releaseAll() {
  const before = held.get(-1);
  held.delete(-1);
  stick = { x: 0, y: 0 };
  if (before) for (const a of PAD_ACTIONS) if (before[a]) up(a);
  pressListeners.forEach(f => f(new Set()));
}

/* ---------------- what each action does ---------------- */

/** The element keys go to: the one in focus, or the page. */
const keyTarget = (): Element => (document.activeElement && document.activeElement !== document.documentElement ? document.activeElement : document.body);

function key(type: 'keydown' | 'keyup', k: string, code: string, repeat = false, at: Element = keyTarget()) {
  const e = new KeyboardEvent(type, { key: k, code, bubbles: true, cancelable: true, composed: true, repeat });
  at.dispatchEvent(e);
  return e;
}

function down(a: PadAction, repeat: boolean) {
  if (DIRS.includes(a)) {
    const k = ARROW[a];
    const e = key('keydown', k.key, k.code, repeat);
    if (e.defaultPrevented) {
      // a game took the arrows (walking, driving): a button left in focus would steal Confirm from the farm's actions
      const f = document.activeElement as HTMLElement | null;
      if (f && f !== document.body && !f.closest(DIALOG)) f.blur();
      return;
    }
    navigate(a as 'up' | 'down' | 'left' | 'right');
    return;
  }
  if (repeat) return;
  switch (a) {
    case 'confirm':
      return confirm();
    case 'back': {
      const f = document.activeElement as HTMLElement | null;
      // leaving a text box comes first; Escape is the game's Back everywhere else
      if (f && isTyping(f)) return f.blur();
      key('keydown', 'Escape', 'Escape');
      return;
    }
    case 'x': {
      const e = key('keydown', ' ', 'Space');
      if (!e.defaultPrevented) clickFirst('[data-pad-x]');
      return;
    }
    case 'y':
      clickFirst('[data-pad-y]');
      return;
    case 'prev':
    case 'next':
      return cycle(a === 'next' ? 1 : -1);
    case 'prevTab':
    case 'nextTab':
      return changeTab(a === 'nextTab' ? 1 : -1);
    case 'start':
      if (!clickFirst('[aria-label="Main menu"]', true)) key('keydown', 'Escape', 'Escape');
      return;
    case 'select':
      clickFirst('button[aria-label="Settings"]', true);
      return;
  }
}

function up(a: PadAction) {
  if (DIRS.includes(a)) {
    const k = ARROW[a];
    key('keyup', k.key, k.code);
    // a key let go goes to the page too, in case the focus moved while it was held
    if (keyTarget() !== document.body) key('keyup', k.key, k.code, false, document.body);
  }
  if (a === 'confirm') key('keyup', 'Enter', 'Enter');
  if (a === 'x') key('keyup', ' ', 'Space');
}

/** Confirm: Enter goes to the game first (the timing games take it); then the button in focus is pressed, or the
    farm's action button, or the focus comes onto the screen on top. */
function confirm() {
  const scope = topScope();
  const f = document.activeElement as HTMLElement | null;
  const inside = !!f && f !== document.body && scope.contains(f) && visible(f);
  const e = key('keydown', 'Enter', 'Enter');
  if (e.defaultPrevented) return;
  if (inside) return activate(f!);
  const primary = first(scope, '[data-pad-primary]');
  if (primary) return activate(primary);
  focusStart(scope);
}

function activate(el: HTMLElement) {
  if (isTyping(el)) return el.focus();
  if (el instanceof HTMLSelectElement) return el.focus();
  rumble('tap');
  if (typeof (el as HTMLElement).click === 'function') (el as HTMLElement).click();
  else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

/* ---------------- moving the focus ---------------- */

const DIALOG = '[aria-modal="true"], [role="dialog"], [role="alertdialog"], .mg';
const FOCUSABLE = 'button, a[href], input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="radio"], [role="tab"], [role="checkbox"], [role="switch"], [role="option"], [role="menuitem"]';

const isTyping = (el: Element) => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file'].includes(el.type));

function visible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) return false;
  if (r.right < 0 || r.bottom < 0 || r.left > window.innerWidth || r.top > window.innerHeight) {
    // off screen but inside a scrolling list: still reachable (it scrolls into view)
    if (!el.closest('.set-content, [data-pad-scroll]')) return false;
  }
  if (el.closest('[aria-hidden="true"], [inert]')) return false;
  const st = getComputedStyle(el);
  return st.visibility !== 'hidden' && st.display !== 'none' && st.pointerEvents !== 'none';
}

const usable = (el: Element) => !(el as HTMLButtonElement).disabled && el.getAttribute('aria-disabled') !== 'true' && visible(el);

/** The screen on top: the last dialog open, or the page. */
export function topScope(): HTMLElement {
  const open = Array.from(document.querySelectorAll<HTMLElement>(DIALOG)).filter(visible);
  return open[open.length - 1] ?? document.body;
}

function items(scope: HTMLElement): HTMLElement[] {
  const all = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(usable);
  // a button inside another (an SVG group in a button) is one stop
  return all.filter(el => !all.some(o => o !== el && o.contains(el) && o.matches('button, a[href]')));
}

function first(scope: HTMLElement, sel: string): HTMLElement | null {
  return Array.from(scope.querySelectorAll<HTMLElement>(sel)).find(usable) ?? null;
}

function clickFirst(sel: string, anywhere = false) {
  const el = first(topScope(), sel) ?? (anywhere ? first(document.body, sel) : null);
  if (!el) return false;
  activate(el);
  return true;
}

function focus(el: HTMLElement) {
  try {
    (el.focus as (o?: FocusOptions & { focusVisible?: boolean }) => void)({ preventScroll: true, focusVisible: true });
  } catch {
    el.focus();
  }
  el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

/** Not hidden by a scrolled list or a panel on top: what is drawn at its middle is it. */
function onScreen(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return !!hit && (hit === el || el.contains(hit));
}

/** Where the focus starts on a screen: its main button, the choice that is on, or the first button. */
function focusStart(scope: HTMLElement) {
  const list = items(scope);
  const pick =
    list.find(el => el.matches('[data-pad-primary], [autofocus]')) ??
    list.find(el => el.matches('.gold-btn, .gold-btn *') && onScreen(el)) ??
    list.find(el => el.matches('[aria-current="page"], [aria-selected="true"], [aria-checked="true"]')) ??
    list[0];
  if (pick) focus(pick);
  return pick ?? null;
}

/** The nearest button in a direction (the D-pad on a menu). */
function navigate(dir: 'up' | 'down' | 'left' | 'right') {
  const scope = topScope();
  const f = document.activeElement as HTMLElement | null;
  if (!f || f === document.body || !scope.contains(f) || !visible(f)) return void focusStart(scope);
  // a slider or a drop-down list in focus: left and right change it, up and down leave it
  if ((dir === 'left' || dir === 'right') && (f instanceof HTMLSelectElement || (f instanceof HTMLInputElement && f.type === 'range'))) return nudge(f, dir === 'right' ? 1 : -1);
  const from = f.getBoundingClientRect();
  const cx = from.left + from.width / 2;
  const cy = from.top + from.height / 2;
  let best: HTMLElement | null = null;
  let score = Infinity;
  for (const el of items(scope)) {
    if (el === f || el.contains(f) || f.contains(el)) continue;
    const r = el.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const horiz = dir === 'left' || dir === 'right';
    const ahead = dir === 'right' ? ex - cx : dir === 'left' ? cx - ex : dir === 'down' ? ey - cy : cy - ey;
    if (ahead < 4) continue;
    // the gap along the way, and how far off to the side (none when the two overlap side-on)
    const gap = Math.max(0, dir === 'right' ? r.left - from.right : dir === 'left' ? from.left - r.right : dir === 'down' ? r.top - from.bottom : from.top - r.bottom);
    const side = horiz ? Math.max(0, r.top - from.bottom, from.top - r.bottom) : Math.max(0, r.left - from.right, from.left - r.right);
    const off = horiz ? Math.abs(ey - cy) : Math.abs(ex - cx);
    const sc = gap + side * 3 + off * 0.25 + ahead * 0.05;
    if (sc < score) (score = sc), (best = el);
  }
  if (best) focus(best);
}

/** Change a slider by a step, or a drop-down list by one choice, as the player would (React hears the change). */
function nudge(el: HTMLInputElement | HTMLSelectElement, step: 1 | -1) {
  if (el instanceof HTMLSelectElement) {
    const i = Math.max(0, Math.min(el.options.length - 1, el.selectedIndex + step));
    if (i === el.selectedIndex) return;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, el.options[i].value);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }
  const min = Number(el.min || 0);
  const max = Number(el.max || 100);
  const by = Math.max(Number(el.step) || 1, (max - min) / 40);
  const v = Math.max(min, Math.min(max, Number(el.value) + step * by));
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** The bumpers: the next or previous button, in reading order, round and round. */
function cycle(step: 1 | -1) {
  const scope = topScope();
  const list = items(scope);
  if (!list.length) return;
  const at = list.indexOf(document.activeElement as HTMLElement);
  const next = at < 0 ? (step > 0 ? 0 : list.length - 1) : (at + step + list.length) % list.length;
  focus(list[next]);
}

/** The triggers: the page's next or previous section (its tabs). */
function changeTab(step: 1 | -1) {
  const scope = topScope();
  const bar = Array.from(scope.querySelectorAll<HTMLElement>('.set-tabs, [role="tablist"]')).find(visible);
  if (!bar) return;
  const tabs = Array.from(bar.querySelectorAll<HTMLElement>('.set-tab, [role="tab"]')).filter(usable);
  if (!tabs.length) return;
  const at = tabs.findIndex(t => t.matches('[aria-current="page"], [aria-selected="true"], .is-on'));
  const next = tabs[(Math.max(0, at) + step + tabs.length) % tabs.length];
  activate(next);
  requestAnimationFrame(() => {
    const again = Array.from(bar.querySelectorAll<HTMLElement>('.set-tab, [role="tab"]')).find(t => t.matches('[aria-current="page"], [aria-selected="true"], .is-on'));
    if (again && again.isConnected) focus(again);
  });
}

/** The right stick scrolls the list under the focus (or the page's). */
function scroll(look: { x: number; y: number }) {
  const scope = topScope();
  const f = document.activeElement as HTMLElement | null;
  let el: HTMLElement | null = f && scope.contains(f) ? f : (scope.querySelector<HTMLElement>('.set-content, [data-pad-scroll]') ?? null);
  while (el && el !== document.body) {
    const st = getComputedStyle(el);
    if (/(auto|scroll)/.test(st.overflowY + st.overflowX) && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
      el.scrollBy({ top: look.y * 14, left: look.x * 14 });
      return;
    }
    el = el.parentElement;
  }
}

/* ---------------- on screen: the focus ring shows while a controller is used ---------------- */

function padActive() {
  const de = document.documentElement;
  if (!de.classList.contains('pad-active')) de.classList.add('pad-active');
}

/** Start listening for controllers (once, from App). */
export function startPads() {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('gamepadconnected', () => refresh());
  window.addEventListener('gamepaddisconnected', () => refresh());
  // a touch or the mouse hides the controller's focus ring again
  const off = () => document.documentElement.classList.remove('pad-active');
  window.addEventListener('pointerdown', off, true);
  window.addEventListener('mousemove', e => (Math.abs(e.movementX) + Math.abs(e.movementY) > 2 ? off() : undefined), true);
  // some browsers announce a controller only once a button is pressed, others not at all: look now and then
  poll = window.setInterval(() => !raf && refresh(), 1000);
  refresh();
}

/** For the tests: stop listening. */
export function stopPads() {
  cancelAnimationFrame(raf);
  clearInterval(poll);
  raf = 0;
  started = false;
}
