/* Money on screen. Every value in the game (Lima's coins and the shillings) is shown 10 times its stored amount:
   the sums, prices, costs and profits all gain a 0, while the game's own maths (and old saves) stay as they are,
   so every comparison, unlock and reward works exactly as before. Points, litres, km, acres and days are not money
   and are not scaled. */

export const VALUE_X = 10;

/** A money amount as the player sees it: 10 times the stored value, with thousands commas. */
export const money = (n: number) => Math.round(n * VALUE_X).toLocaleString('en-US');

/** Shillings as the player sees them, e.g. "KSh 380,000". */
export const kshText = (n: number) => `KSh ${money(n)}`;
