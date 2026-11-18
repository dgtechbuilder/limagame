/* Options that open as the farmer grows. Every buying decision in the game (the power system's parts, the coop and
   the cow shed, seeds, fertilizer and sprayers, the tractor, water, crop cover, the Shop, storage, security, the rows'
   strategies) offers several options, up to five, but not all of them at once: on day 1 the farmer chooses between
   the first two, the third opens on day 2 (or at Level 2), and the rest on day 3 (or at Level 3), whichever comes
   first. So the first days teach one choice at a time and the farm's mechanics come in slowly.

   An option's place in its list is its tier: lists are ordered from the simplest choice to the most advanced one.
   Every number to tune is in UNLOCK. No screens here, so the saved game can use it. */

export interface Tier {
  /** options open in a list at this tier (counted from the first) */
  open: number;
  /** the farm day it opens */
  day: number;
  /** or the certification level (My Progress) that opens it, if reached sooner */
  level: number;
}

export const UNLOCK = {
  tiers: [
    { open: 2, day: 1, level: 1 },
    { open: 3, day: 2, level: 2 },
    { open: 5, day: 3, level: 3 },
  ] as Tier[],
  /** the most options a buying decision offers */
  max: 5,
};

/** What the gate reads from the game: the farm day, and the levels reached. */
export interface UnlockHost {
  life?: { day?: number } | null;
  ach?: { levels?: Record<string, unknown> } | null;
}

const farmDay = (s: UnlockHost) => s.life?.day ?? 1;
/** The highest certification level reached (levels are reached in order: level-1, level-2, ...). */
export function levelReached(s: UnlockHost): number {
  const got = s.ach?.levels ?? {};
  let n = 0;
  while (got[`level-${n + 1}`]) n++;
  return n;
}

/** The tier the farmer is at (0, 1 or 2): the farm day or the level, whichever is further on. */
export function tierNow(s: UnlockHost): number {
  const day = farmDay(s);
  const level = levelReached(s);
  let t = 0;
  UNLOCK.tiers.forEach((x, i) => {
    if (day >= x.day || level >= x.level) t = i;
  });
  return t;
}

/** The tier an option opens at, by its place in its list (every option past the last tier's count opens with it). */
export function tierOf(index: number): number {
  const i = UNLOCK.tiers.findIndex(x => index < x.open);
  return i < 0 ? UNLOCK.tiers.length - 1 : i;
}

/** The option at this place in its list can be bought now. */
export const isOpen = (s: UnlockHost, index: number) => index < 0 || tierOf(index) <= tierNow(s);

/** How many of a list's options are open now. */
export const openCount = (s: UnlockHost, total: number) => Array.from({ length: total }, (_, i) => i).filter(i => isOpen(s, i)).length;

/** When a locked option opens, in a few words ("Day 3 or Level 3"); null when it is open. */
export function lockText(s: UnlockHost, index: number): string | null {
  if (isOpen(s, index)) return null;
  const t = UNLOCK.tiers[tierOf(index)];
  return `Opens on day ${t.day} or at Level ${t.level}`;
}

/** The same, short, for a small button ("Day 3 · Level 3"); null when it is open. */
export function lockShort(s: UnlockHost, index: number): string | null {
  if (isOpen(s, index)) return null;
  const t = UNLOCK.tiers[tierOf(index)];
  return `Day ${t.day} · Level ${t.level}`;
}

/** Why an option can't be chosen yet, for a toast: null when it can. */
export function lockBlock(s: UnlockHost, index: number, name: string): string | null {
  if (isOpen(s, index)) return null;
  const t = UNLOCK.tiers[tierOf(index)];
  return `${name} opens on day ${t.day} or at Level ${t.level}`;
}

/** The place of an option in its list, by id. */
export const indexIn = <T extends { id: string }>(list: readonly T[], id: string) => list.findIndex(x => x.id === id);

/** An option by id is open now (an id not in the list is not gated). */
export const idOpen = <T extends { id: string }>(s: UnlockHost, list: readonly T[], id: string) => isOpen(s, indexIn(list, id));

/** Why an option by id can't be chosen yet (null when it can). */
export function idBlock<T extends { id: string; name?: string; label?: string }>(s: UnlockHost, list: readonly T[], id: string): string | null {
  const i = indexIn(list, id);
  const o = list[i];
  return o ? lockBlock(s, i, o.name ?? o.label ?? id) : null;
}
