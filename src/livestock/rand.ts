/* A seeded random number: the same farm, night and thing always draw the same result, so a night's events can be
   worked out again (and tested) and a reload never re-rolls them. */

function hash(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A number from 0 to 1 for this seed. */
export function roll(seed: string) {
  let a = hash(seed) | 0;
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A whole number from lo to hi (both included) for this seed. */
export const rollInt = (seed: string, lo: number, hi: number) => lo + Math.floor(roll(seed) * (hi - lo + 1));
