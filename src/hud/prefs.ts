import type { CSSProperties } from 'react';
import type { Settings } from '../state';

/* Home screen (Settings → Home screen): the buttons on the farm a player can hide, to keep the farm less crowded.
   Settings, Menu, the money, the tractor and the next task always stay. Everything hidden here is still in the Main
   menu, so nothing is lost. The left and right button columns close up over a hidden button (world/World.tsx). */

export type HudKey = 'mission' | 'shop' | 'water' | 'climate' | 'partners' | 'day' | 'points' | 'sustain' | 'chores' | 'tidy' | 'csa' | 'basics' | 'build' | 'status';

export type HudGroup = { title: string; items: { key: HudKey; label: string; body: string }[] };

export const HUD_GROUPS: HudGroup[] = [
  {
    title: 'Side buttons',
    items: [
      { key: 'mission', label: 'Mission', body: 'The six farms: plan, progress and results.' },
      { key: 'shop', label: 'Shop', body: 'Seeds, fertilizer and tools. The + beside the money still opens it.' },
      { key: 'water', label: 'Water tank', body: 'How full the tank is; it turns orange when it runs low.' },
      { key: 'climate', label: 'Climate', body: 'Emissions, water, soil and credits, with your rating.' },
      { key: 'partners', label: 'Partners', body: 'Offers and ways to partner with TemoLima.' },
    ],
  },
  {
    title: 'Top of the screen',
    items: [
      { key: 'day', label: 'Day counter', body: 'The day of the farming period, beside the money.' },
      { key: 'points', label: 'Points', body: 'Your points and the + for Rewards.' },
      { key: 'sustain', label: 'Sustainability score', body: 'How sustainable the farm is, out of 100. Tap it for Tracking.' },
    ],
  },
  {
    title: 'Daily chips and notes',
    items: [
      { key: 'chores', label: 'Animal chores', body: 'Today’s cow and hen chores, bottom right.' },
      { key: 'tidy', label: 'Daily tidy-up', body: 'Today’s bushes and rocks to clear, bottom right.' },
      { key: 'csa', label: 'Climate-smart drill', body: 'Today’s climate-smart practice and the field clock, bottom right.' },
      { key: 'basics', label: 'Farm basics lesson', body: 'Today’s short lesson, bottom left, until it is read.' },
      { key: 'build', label: 'Today’s build', body: 'The next thing to build or plant, bottom left.' },
      { key: 'status', label: 'Carrying and riding', body: 'What the farmer carries, or the tractor and tool when riding, bottom left.' },
    ],
  },
];

export const HUD_KEYS: HudKey[] = HUD_GROUPS.flatMap(g => g.items.map(i => i.key));

/** Is this button on the farm shown? Everything is shown until the player hides it. */
export const hudShown = (settings: Pick<Settings, 'hud'>, key: HudKey) => settings.hud?.[key] !== false;

/** How many of the farm's buttons are hidden. */
export const hudHiddenCount = (settings: Pick<Settings, 'hud'>) => HUD_KEYS.filter(k => settings.hud?.[k] === false).length;

/** The column slots on the farm (styles.css): a hidden button's slot goes to the next one down. The right column,
    top to bottom; the left one is Settings, Menu, Tractor, Partners, then the tucked special event. */
export const RIGHT_ORDER = ['mission', 'shop', 'water', 'climate'] as const satisfies readonly HudKey[];
export const RIGHT_SLOTS = [72, 134, 196, 258];
export const LEFT_SLOTS = [64, 124, 184, 244, 304];

/** The inline top for the n-th button in a column, only where it moved up (otherwise the stylesheet places it). */
export const slotTop = (slots: number[], natural: number, at: number): CSSProperties | undefined => (at === natural ? undefined : { top: slots[at] });
