import type { ShopTab, StepId } from './data';
import { STORY } from './first/data';
import { CHECK_DAYS, currentDay } from './trials/model';
import { dayNumber } from './rounds/farms';
import { PRACTICES, practiceOf } from './csa/data';
import type { AchTab, Action, AnimalsTab, ClimateTab, EventsTab, FsPhase, GameState, GlossaryTab, KakumaTab, MarketTab, Modal, StoreTab, PartnersTab, PowerTab, SecurityTab, SettingsTab, WalletTab, FinanceTab, TrackingTab } from './state';
import { BRANDS, type BrandId } from './partners/data';
import { REGIONS, type RegionId } from './events/regions';
import { PLANTS, type PlantKind } from './forest/model';

/* Web addresses: every screen has its own address after the # (…/limagame/#/settings/display), so a player can
   type one to go there, reload without losing their place, and use the browser's Back and Forward.

   The game's state stays the one source of truth. pathOf() names the screen the state shows; routeTo() turns an
   address back into the actions that open it. An address goes through the same rules as a tap: during the first
   session only its steps (and the menu and Settings) can be reached, and only steps the player has already
   reached. Anything else leaves the player where they are, with a short message, and the address is put back. */

const STORY_PAGES = STORY.length;

// friendly words in the address ↔ the ids in the code
const SETTINGS: Record<SettingsTab, string> = { farmer: 'my-farmer', game: 'game', sound: 'sound', display: 'display', home: 'home-screen', tractor: 'tractor', controller: 'controller', help: 'help' };
const CLIMATE: Record<ClimateTab, string> = { overview: 'overview', csa: 'climate-smart-agriculture', land: 'land-and-pay', areas: 'farm-areas', emissions: 'emissions', water: 'water-and-soil', tank: 'water-tank', credits: 'credits', shocks: 'shocks', activity: 'activity' };
const ACH: Record<AchTab, string> = { journey: 'journey', modules: 'modules', today: 'today', badges: 'badges', certificates: 'certificates' };
const PARTNERS: Record<PartnersTab, string> = { offers: 'offers', placements: 'placements', join: 'partner-with-us', shortlist: 'shortlist' };
const ANIMALS: Record<AnimalsTab, string> = { today: 'today', health: 'health', water: 'water', coop: 'coop', shed: 'cow-shed', herd: 'herd' };
const WALLET: Record<WalletTab, string> = { history: 'history', climate: 'climate-payments', summary: 'summary' };
const FINANCE: Record<FinanceTab, string> = { overview: 'overview', savings: 'savings', invest: 'investments', profit: 'profit' };
const TRACKING: Record<TrackingTab, string> = { overview: 'overview', sustainability: 'sustainability', climate: 'climate', water: 'water', soil: 'soil-and-inputs', power: 'power', money: 'profit-and-costs', harvest: 'harvests', animals: 'animals-and-safety' };
const POWER_TABS: Record<PowerTab, string> = { build: 'build', today: 'today', impact: 'impact', history: 'history' };
const MARKET_TABS: Record<MarketTab, string> = { sell: 'sell', restaurant: 'restaurant', nutrition: 'nutrition', sales: 'sales' };
const STORE_TABS: Record<StoreTab, string> = { store: 'store', harvest: 'harvest', produce: 'produce' };
const FOREST_TABS: Record<PlantKind, string> = { tree: 'trees', bush: 'bushes', grass: 'grasses' };
const SECURITY: Record<SecurityTab, string> = { protect: 'protect', risk: 'risks', reports: 'night-reports' };
const GLOSSARY: Record<GlossaryTab, string> = { basics: 'basics', feed: 'fertilizer', protect: 'sprays', pests: 'pests', seed: 'seeds', tools: 'tools', machines: 'tractors', water: 'water-and-storage', animals: 'animals', power: 'power-and-climate' };
const EVENTS: Record<EventsTab, string> = { now: 'happening-now', days: 'special-days', regions: 'regions', donate: 'donate' };
const REGION_WORD: Record<RegionId, string> = { horn: 'horn-of-africa', sahel: 'sahel', southern: 'southern-africa', lakechad: 'lake-chad', madagascar: 'madagascar', sudan: 'sudan' };
const KAKUMA: Record<KakumaTab, string> = { about: 'about', foods: 'foods', life: 'food-and-life', donate: 'donate' };
const BRAND_WORD = Object.fromEntries(BRANDS.map(b => [b.id, b.id])) as Record<BrandId, string>;
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
  training: 'training',
  tractorGame: 'tractor-game',
  checks: 'farm-checks',
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
      return `/climate/${CLIMATE[m.tab ?? 'overview']}${m.tab === 'csa' && m.practice ? `/${practiceOf(m.practice).slug}` : ''}`;
    case 'achievements':
      return `/progress/${ACH[m.tab ?? 'journey']}`;
    case 'partners':
      return `/partners/${PARTNERS[m.tab ?? 'offers']}${(m.tab ?? 'offers') === 'offers' && m.brand ? `/${BRAND_WORD[m.brand]}` : ''}`;
    case 'shop':
      return `/shop/${SHOP[m.tab]}`;
    case 'steps':
      return `/steps/${STEPS[m.step]}`;
    case 'loan':
      return m.view === 'quote' ? '/loan-calculator/quote' : '/loan-calculator';
    case 'animals':
      return `/animals/${ANIMALS[m.tab ?? 'today']}`;
    case 'security':
      return `/security/${SECURITY[m.tab ?? 'protect']}`;
    case 'wallet':
      return `/wallet/${WALLET[m.tab ?? 'history']}`;
    case 'finance':
      return `/money/${FINANCE[m.tab ?? 'overview']}`;
    case 'tracking':
      return `/tracking/${TRACKING[m.tab ?? 'overview']}`;
    case 'power':
      return `/power/${POWER_TABS[m.tab ?? 'build']}`;
    case 'market':
      return m.tab && m.tab !== 'sell' ? `/market/${MARKET_TABS[m.tab]}` : '/market';
    case 'serve':
      return `/serve/${m.shop}`;
    case 'greenhouse':
      return `/greenhouse/bed-${m.bed + 1}`;
    case 'storehouse':
      return `/storehouse/${STORE_TABS[m.tab ?? 'store']}`;
    case 'forest':
      return `/mini-forest/${FOREST_TABS[m.tab ?? 'tree']}${m.plant ? `/${m.plant}` : ''}`;
    case 'glossary':
      return `/farm-words/${GLOSSARY[m.tab ?? 'basics']}`;
    case 'events':
      return `/events/${EVENTS[m.tab ?? 'now']}${m.tab === 'regions' && m.region ? `/${REGION_WORD[m.region]}` : ''}`;
    case 'kakuma':
      return `/kakuma/${KAKUMA[m.tab ?? 'about']}`;
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
const NOT_FOUND = 'There is no page at that address.';

/** A screen that opens on top, from its address; null when the address is not one. */
function modalFor(s: GameState, path: string[]): Modal | null | 'bad' {
  let parts = path;
  const [first, second] = parts;
  const tab = <T extends string>(map: Record<T, string>): T | 'bad' | undefined => (second === undefined ? undefined : (key(map, second) ?? 'bad'));
  if (first === 'settings') {
    const t = tab(SETTINGS);
    return t === 'bad' ? 'bad' : { kind: 'settings', tab: settingsTab(s, t) };
  }
  if (first === 'climate') {
    const t = tab(CLIMATE);
    if (t === 'bad' || parts.length > 3) return 'bad';
    // a Climate Smart Agriculture lesson: /climate/climate-smart-agriculture/half-moons
    if (parts[2] !== undefined) {
      const p = t === 'csa' ? PRACTICES.find(x => x.slug === parts[2]) : undefined;
      return p ? { kind: 'climate', tab: 'csa', practice: p.id } : 'bad';
    }
    return { kind: 'climate', tab: t ?? 'overview' };
  }
  // My Progress; its old address (/achievements/…) still opens it
  if (first === 'progress' || first === 'achievements') {
    if (parts.length > 2) return 'bad';
    const t = tab(ACH);
    return t === 'bad' ? 'bad' : { kind: 'achievements', tab: t ?? 'journey' };
  }
  if (first === 'partners') {
    const t = tab(PARTNERS);
    if (t === 'bad' || parts.length > 3) return 'bad';
    if (parts[2] === undefined) return { kind: 'partners', tab: t ?? 'offers' };
    const brand = t === 'offers' ? key(BRAND_WORD, parts[2]) : undefined;
    return brand ? { kind: 'partners', tab: 'offers', brand } : 'bad';
  }
  if (first === 'shop') {
    const t = tab(SHOP);
    return t === 'bad' ? 'bad' : { kind: 'shop', tab: t ?? 'food' };
  }
  if (first === 'steps') {
    const t = tab(STEPS);
    return t === 'bad' ? 'bad' : { kind: 'steps', step: t ?? 'landprep' };
  }
  if (first === 'animals') {
    const t = tab(ANIMALS);
    return t === 'bad' || parts.length > 2 ? 'bad' : { kind: 'animals', tab: t ?? 'today' };
  }
  if (first === 'security') {
    const t = tab(SECURITY);
    return t === 'bad' || parts.length > 2 ? 'bad' : { kind: 'security', tab: t ?? 'protect' };
  }
  if (first === 'wallet') {
    const t = tab(WALLET);
    return t === 'bad' || parts.length > 2 ? 'bad' : { kind: 'wallet', tab: t ?? 'history' };
  }
  if (first === 'money') {
    const t = tab(FINANCE);
    return t === 'bad' || parts.length > 2 ? 'bad' : { kind: 'finance', tab: t ?? 'overview' };
  }
  if (first === 'tracking') {
    const t = tab(TRACKING);
    return t === 'bad' || parts.length > 2 ? 'bad' : { kind: 'tracking', tab: t ?? 'overview' };
  }
  // the sustainability score's short address
  if (first === 'sustainability' && parts.length === 1) return { kind: 'tracking', tab: 'sustainability' };
  if (first === 'power') {
    const t = tab(POWER_TABS);
    return t === 'bad' || parts.length > 2 ? 'bad' : { kind: 'power', tab: t ?? 'build' };
  }
  // the shop floor: the stall or the restaurant played
  if (first === 'serve') return parts.length === 2 && (second === 'market' || second === 'restaurant') ? { kind: 'serve', shop: second } : 'bad';
  if (first === 'market') {
    const t = tab(MARKET_TABS);
    return t === 'bad' || parts.length > 2 ? 'bad' : { kind: 'market', tab: t ?? 'sell' };
  }
  // the restaurant, and what each crop is worth to eat
  if ((first === 'restaurant' || first === 'nutrition') && parts.length === 1) return { kind: 'market', tab: first };
  if (first === 'farm-words') {
    const t = tab(GLOSSARY);
    return t === 'bad' || parts.length > 2 ? 'bad' : { kind: 'glossary', tab: t ?? 'basics' };
  }
  // Special events; /donate and /regions are short addresses for their sections
  if (first === 'donate' || first === 'regions') parts = ['events', ...parts];
  if (parts[0] === 'events') {
    const t = parts[1] === undefined ? 'now' : key(EVENTS, parts[1]);
    if (!t || parts.length > 3) return 'bad';
    if (parts[2] === undefined) return { kind: 'events', tab: t };
    const region = t === 'regions' ? (key(REGION_WORD, parts[2]) ?? REGIONS.find(r => r.id === parts[2])?.id) : undefined;
    return region ? { kind: 'events', tab: 'regions', region } : 'bad';
  }
  if (first === 'kakuma') {
    const t = tab(KAKUMA);
    return t === 'bad' || parts.length > 2 ? 'bad' : { kind: 'kakuma', tab: t ?? 'about' };
  }
  if (first === 'greenhouse') {
    if (parts.length > 2) return 'bad';
    const n = second === undefined ? 1 : Number(second.replace(/^bed-?/, ''));
    return Number.isInteger(n) && n >= 1 && n <= 4 ? { kind: 'greenhouse', bed: n - 1 } : 'bad';
  }
  if (first === 'mini-forest') {
    const t = second === undefined ? 'tree' : key(FOREST_TABS, second);
    if (!t || parts.length > 3) return 'bad';
    if (parts[2] === undefined) return { kind: 'forest', tab: t };
    const plant = PLANTS.find(p => p.id === parts[2] && p.kind === t);
    return plant ? { kind: 'forest', tab: t, plant: plant.id } : 'bad';
  }
  if (first === 'storehouse') {
    const t = tab(STORE_TABS);
    return t === 'bad' || parts.length > 2 ? 'bad' : { kind: 'storehouse', tab: t ?? 'store' };
  }
  // the old addresses of Farms 7 and 8: the greenhouse and the storehouse stand there now
  if (first === 'new-farms') {
    if (parts.length > 2) return 'bad';
    if (second === undefined || second === '7') return { kind: 'greenhouse', bed: 0 };
    return second === '8' ? { kind: 'storehouse', tab: 'store' } : 'bad';
  }
  if (first === 'loan-calculator') {
    if (second === undefined) return { kind: 'loan', view: 'calc' };
    return second === 'quote' ? { kind: 'loan', view: 'quote' } : 'bad';
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
    // the menu and Settings are open during the first session, as their buttons are; so is Partners, for a partner
    // visiting before they play, the Kakuma event, and the Donate page (it links to real organisations)
    if (modal) return modal.kind === 'menu' || modal.kind === 'settings' || modal.kind === 'partners' || modal.kind === 'glossary' || modal.kind === 'kakuma' || (modal.kind === 'events' && modal.tab === 'donate') ? [{ type: 'open', modal }] : say('Finish checking your first crops to open the farm.');
    const close: Action[] = s.modal ? [{ type: 'close' }, { type: 'close' }] : [];
    const step = (to: FsPhase, page?: number): Action[] => [...close, { type: 'fs', phase: to, page }];
    // the step the player is on (e.g. Back from the menu to it)
    const here = pathOf({ ...s, modal: null });
    if (path === here) return close;
    const early = EARLY.includes(phase);
    if (parts[0] === 'story') {
      const n = parts.length === 1 ? 1 : Number(parts[1]);
      if (parts.length > 2 || !Number.isInteger(n) || n < 1 || n > STORY_PAGES) return say(NOT_FOUND);
      if (!s.farmer) return say('Name your farmer first.');
      return early ? step('story', n - 1) : say('Story read: your farm is waiting.');
    }
    const to = key(FIRST, parts.join('/'));
    if (to === 'create') return early ? step('create') : say('Your farmer is ready: carry on.');
    if (to === 'walk1') return s.farmer && early ? step('walk1') : say('Read your story first.');
    // the farm update comes on arriving at the maize: it can be read again from the first check
    if (to === 'update') return phase === 'review1' ? step('update') : say('Walk to your maize first.');
    if (to || ['farm', 'rounds', 'mission', 'tractor-business'].includes(parts[0])) return say('Finish checking your first crops to open the farm.');
    return say(NOT_FOUND);
  }

  /* ---------- the farm ---------- */
  if (modal) return [{ type: 'open', modal }];
  if (path === '/farm') return [{ type: 'home' }];
  if (path === '/rounds') return [{ type: 'home' }, { type: 'rounds', open: true, trial: false }];
  if (path === '/rounds/six-farms') return sixFarmsDue(s) ? [{ type: 'home' }, { type: 'rounds', open: true, trial: true }] : say('Your farms have no checks today: plant them from Mission.');
  if (path === '/mission') return [{ type: 'home' }, { type: 'trials', open: true }];
  if (path === '/tractor-business') return [{ type: 'home' }, { type: 'biz', open: true }];
  if (parts[0] === 'story' || key(FIRST, parts.join('/'))) return say('You finished your first crop checks.');
  return say(NOT_FOUND);
}
