/* What the analytics events say about the visit: the browser, the kind of device, where the player came from, and
   the first-visit and onboarding times kept on the phone (so a time from the first visit survives a reload). */

const KEY = 'lima-mp';

export interface Kept {
  /** ms since epoch: the first visit on this phone (missing for players from before analytics, whose start is unknown) */
  firstVisit?: number;
  /** ms since epoch: the first session (onboarding) began */
  onboardingStart?: number;
  /** onboarding_completed and first_victory_completed are sent once */
  onboarded?: boolean;
  firstWin?: boolean;
  /** level attempts today, by level id */
  attempts?: { day: string; n: Record<string, number> };
}

export function kept(): Kept {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    return {};
  }
}

export function keep(patch: Partial<Kept>): Kept {
  const next = { ...kept(), ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: times are counted from this opening */
  }
  return next;
}

/* ---------------- browser and device ---------------- */

/** Browser family and major version, e.g. "Chrome 131", "Safari 17", "Samsung Internet 26". */
export function browserOf(ua = navigator.userAgent): string {
  const tests: [string, RegExp][] = [
    ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
    ['Opera', /(?:OPR|Opera)\/(\d+)/],
    ['Samsung Internet', /SamsungBrowser\/(\d+)/],
    ['UC Browser', /UCBrowser\/(\d+)/],
    ['Opera Mini', /Opera Mini\/(\d+)/],
    ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
    ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
    ['Safari', /Version\/(\d+)[\d.]* (?:Mobile\/\S+ )?Safari/],
  ];
  for (const [name, re] of tests) {
    const m = ua.match(re);
    if (m) return `${name} ${m[1]}`;
  }
  return /Safari/.test(ua) ? 'Safari' : 'Other';
}

/** desktop, tablet or mobile, from the user agent (an iPad that says it is a Mac is told by its touch screen). */
export function deviceOf(ua = navigator.userAgent, touch = navigator.maxTouchPoints ?? 0): 'desktop' | 'tablet' | 'mobile' {
  if (/iPad|Tablet|PlayBook|Silk|Kindle/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (/Macintosh/.test(ua) && touch > 1) return 'tablet';
  if (/Mobi|iPhone|iPod|Android|Opera Mini|IEMobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

/* ---------------- where the player came from ---------------- */

const SEARCH = /(^|\.)(google|bing|yahoo|duckduckgo|baidu|yandex|ecosia|brave)\./i;
const SOCIAL = /(^|\.)(facebook|fb|instagram|t\.co|twitter|x\.com|linkedin|lnkd|tiktok|youtube|youtu\.be|whatsapp|wa\.me|telegram|t\.me|reddit|pinterest|snapchat)/i;

/** direct, search, social, or the referring site's host name (a campaign or partner page). Same-site counts as direct. */
export function referrerOf(ref = document.referrer, here = window.location.host): string {
  if (!ref) return 'direct';
  let host: string;
  try {
    host = new URL(ref).host;
  } catch {
    return 'direct';
  }
  if (!host || host === here) return 'direct';
  if (SEARCH.test(host)) return 'search';
  if (SOCIAL.test(host)) return 'social';
  return host.replace(/^www\./, '');
}

export function utmOf(search = window.location.search) {
  const q = new URLSearchParams(search);
  return { utm_source: q.get('utm_source') ?? undefined, utm_medium: q.get('utm_medium') ?? undefined, utm_campaign: q.get('utm_campaign') ?? undefined };
}

/** The address the player arrived at, without its query's tracking noise kept twice (UTMs are their own properties). */
export function landingOf(href = window.location.href): string {
  try {
    const u = new URL(href);
    return `${u.origin}${u.pathname}${u.hash}`;
  } catch {
    return href;
  }
}

/** Arrived through a link to a screen (#/climate…) or a programme link, not the plain front page. */
export function deepLinked(): boolean {
  const q = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#\/?/, '');
  return !!hash || q.has('cohort') || q.has('programme');
}

export const locale = () => navigator.language || 'unknown';

/* ---------------- time ---------------- */

export const secsSince = (ms: number | undefined, now = Date.now()) => (ms === undefined ? undefined : Math.max(0, Math.round((now - ms) / 1000)));
export const today = () => new Date().toISOString().slice(0, 10);

/** A random id (a session's), without needing crypto.randomUUID on older phones. */
export function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}

/** A one-way id for analytics from the player code (the code itself unlocks the farm on any phone, so it is never sent). */
export async function hashedId(code: string): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`temolima:${code}`));
    return Array.from(new Uint8Array(buf), x => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
  } catch {
    return null;
  }
}
