/* Money on screen, in the player's own currency.

   The game's own maths keeps its stored amounts (and old saves stay as they are), so every comparison, unlock and
   reward works as before. A stored amount is 10 Kenyan shillings (the game's prices were set in shillings, shown 10
   times the stored value). It is shown in the currency of the country the player picked when they made their farmer
   (Settings › Farmer can change it), at a fixed game rate to the US dollar; with no country picked it is shown in US
   dollars. Points, litres, km, acres and days are not money and are not converted. */

/** Kenyan shillings a stored amount stands for. */
export const VALUE_X = 10;
/** Kenyan shillings to the US dollar (game rate). */
export const KSH_PER_USD = 129;
/** US dollars a stored amount is worth. */
export const USD_PER_UNIT = VALUE_X / KSH_PER_USD;

export interface Currency {
  /** ISO 4217 code, e.g. "KES" */
  code: string;
  /** what goes in front of the amount, e.g. "KSh" or "$" */
  symbol: string;
  /** the currency's name, as a player would say it */
  name: string;
  /** units to the US dollar (a fixed game rate, rounded from 2025 market rates) */
  perUsd: number;
  /** shows cents on small amounts (a currency whose smallest coin is worth something) */
  cents: boolean;
}

export interface Country {
  /** ISO 3166 code, e.g. "KE"; "" is "somewhere else" (US dollars) */
  id: string;
  name: string;
  /** flag emoji */
  flag: string;
  currency: Currency;
}

const USD: Currency = { code: 'USD', symbol: '$', name: 'US dollars', perUsd: 1, cents: true };

/** The countries the player can pick, East Africa first (where the game is set), then the rest of the continent. */
export const COUNTRIES: Country[] = [
  { id: 'KE', name: 'Kenya', flag: '🇰🇪', currency: { code: 'KES', symbol: 'KSh', name: 'Kenyan shillings', perUsd: KSH_PER_USD, cents: false } },
  { id: 'UG', name: 'Uganda', flag: '🇺🇬', currency: { code: 'UGX', symbol: 'USh', name: 'Ugandan shillings', perUsd: 3650, cents: false } },
  { id: 'TZ', name: 'Tanzania', flag: '🇹🇿', currency: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian shillings', perUsd: 2550, cents: false } },
  { id: 'RW', name: 'Rwanda', flag: '🇷🇼', currency: { code: 'RWF', symbol: 'FRw', name: 'Rwandan francs', perUsd: 1430, cents: false } },
  { id: 'ET', name: 'Ethiopia', flag: '🇪🇹', currency: { code: 'ETB', symbol: 'Br', name: 'Ethiopian birr', perUsd: 140, cents: false } },
  { id: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: { code: 'NGN', symbol: '₦', name: 'Nigerian naira', perUsd: 1530, cents: false } },
  { id: 'GH', name: 'Ghana', flag: '🇬🇭', currency: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian cedis', perUsd: 12, cents: true } },
  { id: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: { code: 'ZAR', symbol: 'R', name: 'South African rand', perUsd: 18, cents: true } },
  { id: 'ZM', name: 'Zambia', flag: '🇿🇲', currency: { code: 'ZMW', symbol: 'K', name: 'Zambian kwacha', perUsd: 25, cents: true } },
  { id: 'MW', name: 'Malawi', flag: '🇲🇼', currency: { code: 'MWK', symbol: 'MK', name: 'Malawian kwacha', perUsd: 1750, cents: false } },
  { id: 'US', name: 'United States', flag: '🇺🇸', currency: USD },
  { id: '', name: 'Somewhere else', flag: '🌍', currency: USD },
];

/** A country by its code; an unknown or empty code is "somewhere else" (US dollars). */
export const countryOf = (id: string | null | undefined): Country => COUNTRIES.find(c => c.id === (id ?? '')) ?? COUNTRIES[COUNTRIES.length - 1];

/** A good first guess at the player's country, from the device's time zone and then its language (e.g. "en-KE"). */
export function guessCountry(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    const byZone: Record<string, string> = {
      'Africa/Nairobi': 'KE',
      'Africa/Kampala': 'UG',
      'Africa/Dar_es_Salaam': 'TZ',
      'Africa/Kigali': 'RW',
      'Africa/Addis_Ababa': 'ET',
      'Africa/Lagos': 'NG',
      'Africa/Accra': 'GH',
      'Africa/Johannesburg': 'ZA',
      'Africa/Lusaka': 'ZM',
      'Africa/Blantyre': 'MW',
    };
    if (byZone[zone]) return byZone[zone];
    for (const lang of navigator.languages ?? [navigator.language]) {
      const region = /-([A-Z]{2})\b/.exec(lang ?? '')?.[1];
      if (region && COUNTRIES.some(c => c.id === region)) return region;
    }
  } catch {
    /* no Intl or navigator (an old browser, the tests): no guess */
  }
  return '';
}

let current: Currency = USD;

/** Show money in this country's currency from now on (App sets it from Settings before each picture). */
export function setCountry(id: string | null | undefined) {
  current = countryOf(id).currency;
}
/** The currency money is shown in. */
export const currency = () => current;

/** A stored amount in US dollars, unrounded. */
export const toUsd = (n: number) => n * USD_PER_UNIT;
/** US dollars as a stored amount. */
export const fromUsd = (usd: number) => usd / USD_PER_UNIT;
/** A stored amount in the player's currency, unrounded. */
export const toLocal = (n: number) => toUsd(n) * current.perUsd;
/** An amount in the player's currency as a stored amount. */
export const fromLocal = (v: number) => fromUsd(v / current.perUsd);

const sep = (c: Currency) => (/^[A-Za-z]/.test(c.symbol) && c.symbol.length > 1 ? ' ' : '');

/** The amount as a plain number, without the sign: cents below 100 (in a currency that has them), whole units above,
    e.g. "27.91" or "1,180". */
export function localNumber(n: number, c: Currency = current): string {
  const d = Math.abs(toUsd(n) * c.perUsd);
  const cents = c.cents && d < 100 && Math.round(d * 100) % 100 !== 0;
  return d.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });
}
/** @deprecated the amount in the player's currency: use localNumber() */
export const usdNumber = (n: number) => localNumber(n);

/** A money amount in a given currency: "$27.91", "KSh 3,600", "₦42,800", "−$3.10". */
export const moneyIn = (n: number, c: Currency) => `${toUsd(n) * c.perUsd <= -0.005 ? '−' : ''}${c.symbol}${sep(c)}${localNumber(n, c)}`;

/** A money amount as the player sees it, in their currency. */
export const money = (n: number) => moneyIn(n, current);

/** A money amount kept short for the small meters: "KSh 300k", "USh 8.6M"; small amounts as money() shows them. */
export function moneyShort(n: number): string {
  const v = Math.abs(toLocal(n));
  if (v < 100_000) return money(n);
  const [d, unit] = v >= 1e9 ? [v / 1e9, 'B'] : v >= 1e6 ? [v / 1e6, 'M'] : [v / 1e3, 'k'];
  const num = d >= 100 ? Math.round(d).toString() : (Math.round(d * 10) / 10).toString();
  return `${toLocal(n) < 0 ? '−' : ''}${current.symbol}${sep(current)}${num}${unit}`;
}

/** The same as money(): kept for screens that once showed shillings. */
export const kshText = money;
