/* Mixpanel: the game's product analytics (who arrives, who finishes the first session, what they play, how long).

   One small wrapper, so no screen calls the SDK itself:
   - initMixpanel() runs once on boot (src/main.tsx). The SDK is fetched on its own after the first screen, so the game
     opens no slower on a weak signal; events tracked before it arrives wait in a queue and go when it is ready. The
     SDK keeps unsent events on the phone and retries them, so a dropped signal loses nothing.
   - mpTrack / mpRegister / mpIdentify / mpPeopleSet are all the game uses. Names are snake_case, numbers are numbers,
     and a property with no value is left out (never null or '').
   - Off in design review (?review / ?screen), with VITE_MIXPANEL=off, and in the play-tests (a browser driven by
     Playwright), so tests never send to the real project. A test can turn on the test sink instead: localStorage
     'lima-mp-test' = '1' keeps every event in window.__limaMixpanel and sends nothing (tests/mixpanel.spec.ts). */

import type { Mixpanel } from 'mixpanel-browser';

/** The TemoLima Mixpanel project (a public browser token: it can only send events). VITE_MIXPANEL_TOKEN overrides it. */
const TOKEN = '099b7dba13553673c44a3e3c5220df42';

type Props = Record<string, unknown>;
export interface MpEvent {
  name: string;
  props: Props;
}

const env = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

const reviewing = () => {
  const q = new URLSearchParams(window.location.search);
  return q.has('review') || q.has('screen');
};

/** The play-tests' sink: events are kept on the page, nothing is sent. */
export const testSink = () => {
  try {
    return window.localStorage.getItem('lima-mp-test') === '1';
  } catch {
    return false;
  }
};

type Mode = 'off' | 'live' | 'test';
let mode: Mode | null = null;
function modeOf(): Mode {
  if (mode) return mode;
  if (typeof window === 'undefined' || reviewing()) return (mode = 'off');
  if (testSink()) return (mode = 'test');
  if (str(env.VITE_MIXPANEL) === 'off' || navigator.webdriver) return (mode = 'off');
  return (mode = 'live');
}

/** Whether events are being recorded at all (sent, or kept for a test). */
export const mpOn = () => modeOf() !== 'off';

/* ---------------- the SDK, fetched once ---------------- */

let sdk: Mixpanel | null = null;
let loading = false;
const queue: ((m: Mixpanel) => void)[] = [];

function withSdk(fn: (m: Mixpanel) => void) {
  if (sdk) return fn(sdk);
  queue.push(fn);
}

/** Start Mixpanel: call once on boot. Later calls do nothing. */
export function initMixpanel() {
  const m = modeOf();
  if (m === 'test') {
    (window as unknown as { __limaMixpanel?: MpEvent[] }).__limaMixpanel ??= [];
    return;
  }
  if (m !== 'live' || loading) return;
  loading = true;
  import('mixpanel-browser/dist/mixpanel-core.cjs.js')
    .then(mod => {
      const mp = mod.default;
      mp.init(str(env.VITE_MIXPANEL_TOKEN) ?? TOKEN, {
        debug: !!env.DEV,
        persistence: 'localStorage',
        // the game is one page with its own addresses (#/farm…): its own events say where the player is
        track_pageview: false,
        // over a weak signal: send in batches, keep what failed on the phone, try again later
        batch_requests: true,
        ignore_dnt: false,
      });
      sdk = mp;
      queue.splice(0).forEach(fn => fn(mp));
    })
    .catch(() => {
      // no signal on the first visit: the SDK is fetched again on the next one; this visit's events are dropped
      loading = false;
      queue.length = 0;
    });
}

/* ---------------- what the game calls ---------------- */

/** Drop empty values: Mixpanel reads null and '' as values, so a property with nothing to say is left out. */
export function clean(props: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === '' || (typeof v === 'number' && !Number.isFinite(v))) continue;
    out[k] = v;
  }
  return out;
}

/** Track one event. `beacon` sends it at once by sendBeacon (for the page closing). */
export function mpTrack(name: string, props: Props = {}, beacon = false) {
  const m = modeOf();
  if (m === 'off') return;
  const p = clean(props);
  if (m === 'test') {
    (window as unknown as { __limaMixpanel: MpEvent[] }).__limaMixpanel.push({ name, props: { ...supers, ...p } });
    return;
  }
  withSdk(mp => mp.track(name, p, beacon ? { transport: 'sendBeacon', send_immediately: true } : undefined));
}

/** Properties sent with every event from now on (super properties). */
const supers: Props = {};
export function mpRegister(props: Props) {
  const m = modeOf();
  if (m === 'off') return;
  const p = clean(props);
  Object.assign(supers, p);
  if (m === 'live') withSdk(mp => mp.register(p));
}

/** Tie this device's events to a player id (called once the player exists, and on every later opening). */
let identified: string | null = null;
export function mpIdentify(id: string) {
  if (modeOf() !== 'live' || identified === id) return;
  identified = id;
  withSdk(mp => mp.identify(id));
}

/** Player profile properties (only after mpIdentify, so the profile belongs to the player). */
export function mpPeopleSet(props: Props, once = false) {
  if (modeOf() !== 'live' || !identified) return;
  const p = clean(props);
  withSdk(mp => (once ? mp.people.set_once(p) : mp.people.set(p)));
}
