import type { ShopTab, StepId } from './data';
import { STORY } from './first/data';
import { CHECK_DAYS, currentDay } from './trials/model';
import { dayNumber } from './rounds/farms';
import type { AchTab, Action, ClimateTab, FsPhase, GameState, Modal, SettingsTab } from './state';

/* Web addresses: every screen has its own address after the # (…/limagame/#/settings/display), so a player can
   type one to go there, reload without losing their place, and use the browser's Back and Forward.

   The game's state stays the one source of truth. pathOf() names the screen the state shows; routeTo() turns an
   address back into the actions that open it. An address goes through the same rules as a tap: during the first
   session only its steps (and the menu and Settings) can be reached, and only steps the player has already
   reached. Anything else leaves the player where they are, with a short message, and the address is put back. */

const STORY_PAGES = STORY.length;

// friendly words in the address ↔ the ids in the code
const SETTINGS: Record<SettingsTab, string> = { farmer: 'my-farmer', game: 'game', display: 'display', help: 'help' };
const CLIMATE: Record<ClimateTab, string> = { overview: 'overview', emissions: 'emissions', water: 'water-and-soil', shocks: 'shocks', activity: 'activity' };
const ACH: Record<AchTab, string> = { today: 'today', badges: 'badges', certificates: 'certificates' };
const SHOP: Record<ShopTab, string> = { food: 'food', fertilizer: 'fertilizer', tank: 'water-tanks', equipment: 'equipment' };
const STEPS: Record<StepId, string> = { landprep: 'land-prep', planting: 'planting', fertilizer: 'fertilizer', pesticides: 'pesticides', water: 'water', harvest: 'harvest' };
/** Screens with no sections, by address. */
const SIMPLE = {
  menu: 'menu',
  welcome: 'welcome',
  sale: 'sale',
  storage: 'storage',
  timing: 'harvest-timing',
  value: 'value-addition',
  process: 'process',
  info: 'farm-info',
  outcome: 'results',
  rewards: 'rewards',
} as const satisfies Partial<Record<Modal['kind'], string>>;

/** First-session steps, by address. The story is /story/1 to /story/3. */
const FIRST: Record<Exclude<FsPhase, 'done' | 'story'>, string> = {
  create: 'start',
  walk1: 'walk/maize',
  update: 'farm-update',
  review1: 'check/maize',
  walkRetry: 'walk/back-maize',
  retry: 'check/back-maize',
  walk2: 'walk/sukuma',
  review2: 'check/sukuma',
};
/** The early steps a player may step back between by address, as the Back button can. */
const EARLY: FsPhase[] = ['create', 'story', 'walk1', 'update', 'review1'];

const key = <T extends string>(map: Record<T, string>, word: string | undefined): T | undefined => (Object.keys(map) as T[]).find(k => map[k] === word);

const settingsTab = (s: GameState, tab?: SettingsTab): SettingsTab => tab ?? (s.farmer ? 'farmer' : 'game');

/** The six farms are being checked today (the Rounds button opens their checks). */
export const sixFarmsDue = (s: GameState) => !!s.trial && s.trial.phase === 'growing' && currentDay(s.trial, dayNumber()) <= CHECK_DAYS;

function modalPath(s: GameState, m: Modal): string {
  switch (m.kind) {
    case 'settings':
      return `/settings/${SETTINGS[settingsTab(s, m.tab)]}`;
    case 'climate':
      return `/climate/${CLIMATE[m.tab ?? 'overview']}`;
    case 'achievements':
      return `/achievements/${ACH[m.tab ?? 'today']}`;
    case 'shop':
      return `/shop/${SHOP[m.tab]}`;
    case 'steps':
      return `/steps/${STEPS[m.step]}`;
    default:
      return `/${SIMPLE[m.kind]}`;
  }
}

/** The address of the screen the state shows. */
export function pathOf(s: GameState): string {
  if (s.modal) return modalPath(s, s.modal);
  const phase = s.fs.phase;
  if (phase === 'story') return `/story/${Math.min(STORY_PAGES, (s.fs.page ?? 0) + 1)}`;
  if (phase !== 'done') return `/${FIRST[phase]}`;
  if (s.roundsOpen) return s.roundsTrial ? '/rounds/six-farms' : '/rounds';
  if (s.trialsOpen) return '/mission';
  if (s.bizOpen) return '/tractor-business';
  return '/farm';
}

/** An address as typed (with or without #, any case, extra slashes) → /words/like/this. */
export function cleanPath(raw: string): string {
  const words = decodeURIComponent(raw.replace(/^#/, ''))
    .toLowerCase()
    .split(/[/\s]+/)
    .filter(Boolean);
  return `/${words.join('/')}`;
}

const say = (text: string): Action[] => [{ type: 'toast', text }];
const NOT_FOUND = 'There is no page at that address, so you stayed where you were.';

/** A screen that opens on top, from its address; null when the address is not one. */
function modalFor(s: GameState, parts: string[]): Modal | null | 'bad' {
  const [first, second] = parts;
  const tab = <T extends string>(map: Record<T, string>): T | 'bad' | undefined => (second === undefined ? undefined : (key(map, second) ?? 'bad'));
  if (first === 'settings') {
    const t = tab(SETTINGS);
    return t === 'bad' ? 'bad' : { kind: 'settings', tab: settingsTab(s, t) };
  }
  if (first === 'climate') {
    const t = tab(CLIMATE);
    return t === 'bad' ? 'bad' : { kind: 'climate', tab: t ?? 'overview' };
  }
  if (first === 'achievements') {
    const t = tab(ACH);
    return t === 'bad' ? 'bad' : { kind: 'achievements', tab: t ?? 'today' };
  }
  if (first === 'shop') {
    const t = tab(SHOP);
    return t === 'bad' ? 'bad' : { kind: 'shop', tab: t ?? 'food' };
  }
  if (first === 'steps') {
    const t = tab(STEPS);
    return t === 'bad' ? 'bad' : { kind: 'steps', step: t ?? 'landprep' };
  }
  const simple = key(SIMPLE, first);
  if (!simple) return null;
  return second === undefined ? ({ kind: simple } as Modal) : 'bad';
}

/** The actions that take the player to an address, or a message saying why they stay where they are. */
export function routeTo(s: GameState, raw: string): Action[] {
  const path = cleanPath(raw);
  if (path === '/' || path === pathOf(s)) return [];
  const parts = path.slice(1).split('/');
  const modal = modalFor(s, parts);
  if (modal === 'bad') return say(NOT_FOUND);
  const phase = s.fs.phase;

  /* ---------- the first session ---------- */
  if (phase !== 'done') {
    // the menu and Settings are open during the first session, as their buttons are
    if (modal) return modal.kind === 'menu' || modal.kind === 'settings' ? [{ type: 'open', modal }] : say('Finish checking your first crops to open the rest of the farm.');
    const close: Action[] = s.modal ? [{ type: 'close' }, { type: 'close' }] : [];
    const step = (to: FsPhase, page?: number): Action[] => [...close, { type: 'fs', phase: to, page }];
    // the step the player is on (e.g. Back from the menu to it)
    const here = pathOf({ ...s, modal: null });
    if (path === here) return close;
    const early = EARLY.includes(phase);
    if (parts[0] === 'story') {
      const n = parts.length === 1 ? 1 : Number(parts[1]);
      if (parts.length > 2 || !Number.isInteger(n) || n < 1 || n > STORY_PAGES) return say(NOT_FOUND);
      if (!s.farmer) return say('Name your farmer first, then the story begins.');
      return early ? step('story', n - 1) : say('You have read the story already: your farm is waiting.');
    }
    const to = key(FIRST, parts.join('/'));
    if (to === 'create') return early ? step('create') : say('Your farmer is ready: carry on with your crops.');
    if (to === 'walk1') return s.farmer && early ? step('walk1') : say('Read your story first, then walk to your maize.');
    // the farm update comes on arriving at the maize: it can be read again from the first check
    if (to === 'update') return phase === 'review1' ? step('update') : say('Walk to your maize first: the farm update is waiting there.');
    if (to || ['farm', 'rounds', 'mission', 'tractor-business'].includes(parts[0])) return say('Finish checking your first crops to open the rest of the farm.');
    return say(NOT_FOUND);
  }

  /* ---------- the farm ---------- */
  if (modal) return [{ type: 'open', modal }];
  if (path === '/farm') return [{ type: 'home' }];
  if (path === '/rounds') return [{ type: 'home' }, { type: 'rounds', open: true, trial: false }];
  if (path === '/rounds/six-farms') return sixFarmsDue(s) ? [{ type: 'home' }, { type: 'rounds', open: true, trial: true }] : say('Your six farms have no checks today: plant them from Mission first.');
  if (path === '/mission') return [{ type: 'home' }, { type: 'trials', open: true }];
  if (path === '/tractor-business') return [{ type: 'home' }, { type: 'biz', open: true }];
  if (parts[0] === 'story' || key(FIRST, parts.join('/'))) return say('You have finished your first crop checks: welcome back to your farm.');
  return say(NOT_FOUND);
}
