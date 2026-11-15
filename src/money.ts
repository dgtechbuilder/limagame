/* Money on screen, in US dollars.

   The game's own maths keeps its stored amounts (and old saves stay as they are), so every comparison, unlock and
   reward works as before. A stored amount is 10 Kenyan shillings (the game's prices were set in shillings, shown 10
   times the stored value), and is shown in US dollars at KSH_PER_USD. Points, litres, km, acres and days are not
   money and are not converted. */

/** Kenyan shillings a stored amount stands for. */
export const VALUE_X = 10;
/** Kenyan shillings to the US dollar (game rate). */
export const KSH_PER_USD = 129;
/** US dollars a stored amount is worth. */
export const USD_PER_UNIT = VALUE_X / KSH_PER_USD;

/** A stored amount in US dollars, unrounded. */
export const toUsd = (n: number) => n * USD_PER_UNIT;
/** US dollars as a stored amount. */
export const fromUsd = (usd: number) => usd / USD_PER_UNIT;

/** Dollars as a plain number, without the sign: cents below $100, whole dollars above, e.g. "27.91" or "1,180". */
export function usdNumber(n: number): string {
  const d = Math.abs(toUsd(n));
  const cents = d < 100 && Math.round(d * 100) % 100 !== 0;
  return d.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
}

/** A money amount as the player sees it, in US dollars: "$27.91", "$1,180", "−$3.10". */
export const money = (n: number) => `${toUsd(n) <= -0.005 ? '−' : ''}$${usdNumber(n)}`;

/** The same as money(): kept for screens that once showed shillings. */
export const kshText = money;
