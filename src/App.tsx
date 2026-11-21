import { trackContext } from './first/track';
import { evidenceOf } from './evidence/model';
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FarmScene } from './components/FarmScene';
import { ShopModal, StepsModal } from './screens/Catalog';
import { InfoModal, OutcomeModal, ProcessModal, RewardsModal, SaleModal, StorageModal, TimingModal, ValueModal } from './screens/Journey';
import { FirstSession } from './first/FirstSession';
import { FarmMap } from './components/FarmMap';
import { FarmLoading } from './world/Loading';
import { ActivityLoading } from './components/ActivityLoading';
import { lazyPage, prefetchActivities } from './prefetch';
import { img } from './assets';

// the field rounds are loaded only when opened, so the first session stays as small as before
const Rounds = lazyPage(() => import('./rounds/Rounds').then(m => m.Rounds), 1);
const Trials = lazyPage(() => import('./trials/Trials').then(m => m.Trials), 1);
const Business = lazyPage(() => import('./business/Business').then(m => m.Business), 1);
const World = lazy(() => import('./world/World').then(m => ({ default: m.World })));
// the animals' and security pages are loaded when first opened
const AnimalsPage = lazyPage(() => import('./livestock/Animals').then(m => m.AnimalsPage), 1);
const ChecksPage = lazyPage(() => import('./inspect/Checks').then(m => m.ChecksPage), 1);
const SecurityPage = lazyPage(() => import('./security/Security').then(m => m.SecurityPage), 1);
const WalletPage = lazyPage(() => import('./wallet/Wallet').then(m => m.WalletPage), 1);
const FinancePage = lazyPage(() => import('./finance/Finance').then(m => m.FinancePage), 1);
const PowerPage = lazyPage(() => import('./power/Power').then(m => m.PowerPage), 1);
const TractorGamePage = lazyPage(() => import('./minifarm/MiniFarm').then(m => m.TractorGamePage), 1);
const MarketPage = lazyPage(() => import('./produce/Market').then(m => m.MarketPage), 1);
const EventsPage = lazyPage(() => import('./events/Events').then(m => m.EventsPage), 1);
const GreenhousePage = lazyPage(() => import('./greenhouse/Greenhouse').then(m => m.GreenhousePage), 1);
const StorehousePage = lazyPage(() => import('./storehouse/Storehouse').then(m => m.StorehousePage), 1);
const KakumaPage = lazyPage(() => import('./events/Kakuma').then(m => m.KakumaPage), 1);
// design review (?review=1) only: its sample screens are computed when it is opened, never for players
const ReviewPicker = lazy(() => import('./review/Review').then(m => ({ default: m.ReviewPicker })));
import { WelcomeModal } from './screens/Meta';
import { SettingsPage } from './screens/Settings';
import { ClimatePage } from './screens/Climate';
import { AchievementsPage } from './screens/Achievements';
import { PartnersPage } from './screens/Partners';
import { GlossaryPage } from './learn/Glossary';
import { InfoLayer } from './learn/Info';

import { ArtContext, VoiceContext } from './art/style';
import { speak, stopSpeaking } from './speech';
import { setSoundOn, sfx, warmSfx } from './sfx';
import { rumble, setPadConfig, startPads, type PadInfo } from './input/gamepad';
import { FAMILY_NAME, padSettings } from './input/pad';
import { MainMenu } from './screens/MainMenu';
import { LoanModal } from './screens/Loan';
import { TrainingModal } from './screens/Training';
import { SuccessLayer } from './screens/Success';
import { NavBar, NavContext } from './components/Nav';
import { reviewing, useGame } from './state';
import { pathOf } from './route';
import { setCountry } from './money';
import { fitScale } from './fit';



/* The stage is fitted to the space the page really has. Phones report a rotation late: Safari and Chrome on iOS fire
   "resize" (and "orientationchange") before the new width and height can be read, so a fit taken only then keeps the
   portrait size and the game sits small in the middle of a landscape screen. The fit is therefore re-taken on every
   signal a size change gives (resize, orientationchange, screen orientation, the visual viewport, a ResizeObserver on
   the page, coming back to the tab) and checked again for a moment after each one, until the size has settled. The
   size is the layout viewport's (the page's own box), so the on-screen keyboard and pinch zoom do not shrink it. */
function viewSize() {
  const de = document.documentElement;
  return { w: de.clientWidth || window.innerWidth, h: de.clientHeight || window.innerHeight };
}

function useStageScale(roomForPicker: boolean) {
  const [scale, setScale] = useState(() => {
    const { w, h } = viewSize();
    return fitScale(w, h, roomForPicker);
  });
  useLayoutEffect(() => {
    let raf = 0;
    const timers: number[] = [];
    const fit = () => {
      const { w, h } = viewSize();
      if (w > 0 && h > 0) setScale(fitScale(w, h, roomForPicker));
    };
    const onChange = () => {
      fit();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fit);
      // a rotation settles over a few hundred milliseconds on iOS: look again until it has
      timers.splice(0).forEach(t => window.clearTimeout(t));
      for (const ms of [100, 300, 700]) timers.push(window.setTimeout(fit, ms));
    };
    onChange();
    window.addEventListener('resize', onChange);
    window.addEventListener('orientationchange', onChange);
    window.visualViewport?.addEventListener('resize', onChange);
    screen.orientation?.addEventListener?.('change', onChange);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onChange) : null;
    ro?.observe(document.documentElement);
    // coming back to the tab after rotating the phone while it was hidden
    const onShow = () => document.visibilityState === 'visible' && onChange();
    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('pageshow', onChange);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(t => window.clearTimeout(t));
      window.removeEventListener('resize', onChange);
      window.removeEventListener('orientationchange', onChange);
      window.visualViewport?.removeEventListener('resize', onChange);
      screen.orientation?.removeEventListener?.('change', onChange);
      ro?.disconnect();
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('pageshow', onChange);
    };
  }, [roomForPicker]);
  return scale;
}

export default function App() {
  const [s, dispatch] = useGame();
  // money is shown in the currency of the player's country (src/money.ts): set before anything below is drawn
  setCountry(s.settings.country);
  // every event carries the player's programme tags (src/evidence)
  trackContext.tags = evidenceOf(s.evidence).tags;
  // a programme link (?cohort=CODE or ?programme=CODE) tags the player once
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const code = q.get('cohort') ?? q.get('programme');
    if (code) dispatch({ type: 'evidenceTag', tag: code, on: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const review = reviewing();
  const scale = useStageScale(review);
  const toastTimer = useRef<number | undefined>(undefined);
  const [toastVisible, setToastVisible] = useState(false);
  const [awardVisible, setAwardVisible] = useState(false);
  const awardTimer = useRef<number | undefined>(undefined);


  // Play-tests: ?dev in a dev build exposes the state and jump-to-state helpers as window.__lima (never in production)
  const live = useRef(s);
  live.current = s;
  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('dev')) void import('./dev/hook').then(m => m.install(() => live.current, dispatch));
  }, [dispatch]);

  // Web addresses (src/route.ts): the address bar always names the screen on show. A new screen adds a step to the
  // browser's history (so Back and Forward work); a typed address the player may not go to yet is put back.
  const path = pathOf(s);
  const fromUrl = useRef(false);
  const firstSync = useRef(true);
  const [urlSeq, setUrlSeq] = useState(0);
  useEffect(() => {
    if (review) return;
    const onHash = () => {
      fromUrl.current = true;
      dispatch({ type: 'route', path: window.location.hash });
      setUrlSeq(n => n + 1);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [dispatch, review]);
  useEffect(() => {
    if (review) return;
    const replace = firstSync.current || fromUrl.current;
    firstSync.current = false;
    fromUrl.current = false;
    const words = path.slice(1).split('/').map(w => w.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase()));
    document.title = `${words.join(' · ')} · TemoLima`;
    if (window.location.hash === `#${path}`) return;
    const url = `${window.location.pathname}${window.location.search}#${path}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }, [path, urlSeq, review]);

  // The farm world (and its 3D engine) is fetched while the player is busy elsewhere (the first session, the classic
  // farm), so it opens without a wait; its picture is fetched too, for the loading screen (world/Loading.tsx). When
  // the farm is the first screen, World is already on its way and this costs nothing more.
  useEffect(() => {
    if (review) return;
    const id = window.setTimeout(() => {
      void import('./world/World').then(() => window.setTimeout(prefetchActivities, 1500));
      const pic = new Image();
      pic.src = (window.devicePixelRatio || 1) > 1 ? img.bgWorld2x : img.bgWorld;
    }, 2000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count play time while the tab is visible (drives the rewards goal).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') dispatch({ type: 'tick', seconds: 30 });
    }, 30000);
    return () => window.clearInterval(id);
  }, [dispatch]);

  // Read aloud: speak each new message
  const voiceOn = s.settings.voice;
  useEffect(() => {
    if (s.toast && voiceOn) speak(s.toast.text);
  }, [s.toast, voiceOn]);
  // read the dialog after something worked: what happened, in a few words
  useEffect(() => {
    const x = s.success;
    if (!x || !voiceOn) return;
    speak(x.kind === 'sale' ? `Sold ${x.qty} ${x.item}` : x.kind === 'training' ? 'Training booked' : x.kind === 'storage' ? 'Storage upgraded' : x.kind === 'day2' ? 'Day 2: your animals are in your care' : x.kind === 'morning' ? x.lines.map(l => l.title).join('. ') : x.events.map(e => e.text).join(' '));
  }, [s.success?.id, voiceOn]);
  useEffect(() => {
    if (!voiceOn) stopSpeaking();
  }, [voiceOn]);

  // Sound effects (src/sfx.ts): a happy ping for each completed action, a fanfare for each completed flow
  useLayoutEffect(() => setSoundOn(s.settings.sound !== false), [s.settings.sound]);
  useEffect(() => {
    if (s.sfx) sfx[s.sfx.kind]();
    // and a short rumble on a controller that can
    if (s.sfx) rumble(s.sfx.kind === 'flow' ? 'done' : 'tap');
  }, [s.sfx]);

  // Game controllers (src/input/gamepad.ts): any controller plays the whole game; Settings → Controller sets it up
  const pad = useMemo(() => padSettings(s.settings.pad), [s.settings.pad]);
  useLayoutEffect(() => setPadConfig(pad), [pad]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ kind: 'connected' | 'disconnected'; pad: PadInfo }>).detail;
      if (!live.current.settings.pad || live.current.settings.pad.on !== false)
        dispatch({ type: 'toast', text: d.kind === 'connected' ? `${FAMILY_NAME[d.pad.family] === 'Other controller' ? 'Controller' : `${FAMILY_NAME[d.pad.family]} controller`} connected. Settings → Controller shows the buttons.` : 'Controller disconnected.' });
    };
    window.addEventListener('lima:pad', on);
    startPads();
    return () => window.removeEventListener('lima:pad', on);
  }, [dispatch]);
  // the cues are made once, after the first tap (browsers start sound only after one)
  useEffect(() => {
    if (s.settings.sound === false) return;
    window.addEventListener('pointerdown', warmSfx, { once: true });
    return () => window.removeEventListener('pointerdown', warmSfx);
  }, [s.settings.sound]);

  // the daily climate payment (climate/land.ts): a day that has ended is paid on opening the game, on coming back
  // to it, and within a minute of midnight while it is open
  useEffect(() => {
    const tick = () => document.visibilityState !== 'hidden' && dispatch({ type: 'climateTick' });
    tick();
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [dispatch]);

  // a badge, a certificate or a new day of the streak: a pop-up for a few seconds
  useEffect(() => {
    if (!s.award) return;
    setAwardVisible(true);
    window.clearTimeout(awardTimer.current);
    awardTimer.current = window.setTimeout(() => setAwardVisible(false), 4200);
  }, [s.award]);
  useEffect(() => {
    if (!s.toast) return;
    setToastVisible(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 3200);
  }, [s.toast]);

  const m = s.modal;
  const nav = useMemo(
    () => ({ menu: () => dispatch({ type: 'open', modal: { kind: 'menu' as const } }), home: () => dispatch({ type: 'home' }), settings: () => dispatch({ type: 'open', modal: { kind: 'settings' as const } }), menuOpen: s.modal?.kind === 'menu' }),
    [dispatch, s.modal?.kind],
  );
  const firstSession = s.fs.phase !== 'done';

  return (
    <NavContext.Provider value={nav}>
    <ArtContext.Provider value={s.settings.art}>
    <VoiceContext.Provider value={s.settings.voice}>
    <div className="viewport">
      <div className={`stage${s.settings.reduceMotion ? ' reduce-motion' : ''}`} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {firstSession ? (
          <>
            <FirstSession s={s} dispatch={dispatch} />
            {/* before the farm opens: Back one step (where that is safe), the main menu, and Settings */}
            {!m && (
              <NavBar
                horizontal
                hideHome
                showSettings
                style={{ right: 28, top: 8 }}
                onBack={
                  s.fs.phase === 'story' ? () => dispatch({ type: 'fs', phase: 'create' }) : s.fs.phase === 'walk1' ? () => dispatch({ type: 'fs', phase: 'story' }) : s.fs.phase === 'update' ? () => dispatch({ type: 'fs', phase: 'walk1' }) : s.fs.phase === 'review1' ? () => dispatch({ type: 'fs', phase: 'update' }) : undefined
                }
              />
            )}
          </>
        ) : (
          <>
            {/* the farm stays underneath the rounds and the six farms, so it keeps its place */}
            {s.view === 'world' ? (
              <Suspense fallback={<FarmLoading />}>
                {/* a new farm is built when the character style or the graphics change */}
                <World key={`${s.settings.art}-${s.settings.graphics}`} s={s} dispatch={dispatch} paused={s.roundsOpen || s.trialsOpen || s.bizOpen || !!m} />
              </Suspense>
            ) : (
              !s.roundsOpen && !s.trialsOpen && !s.bizOpen && <FarmScene s={s} dispatch={dispatch} />
            )}
            {s.roundsOpen ? (
              <Suspense fallback={<><FarmMap /><ActivityLoading full label="Opening the field rounds…" /></>}>
                <Rounds s={s} dispatch={dispatch} />
              </Suspense>
            ) : s.trialsOpen ? (
              <Suspense fallback={<><FarmMap /><ActivityLoading full label="Opening Mission…" /></>}>
                <Trials s={s} dispatch={dispatch} />
              </Suspense>
            ) : s.bizOpen ? (
              <Suspense fallback={<><FarmMap /><ActivityLoading full label="Opening the business…" /></>}>
                <Business s={s} dispatch={dispatch} />
              </Suspense>
            ) : null}
          </>
        )}

        {m?.kind === 'menu' && <MainMenu s={s} dispatch={dispatch} />}
        {m?.kind === 'welcome' && <WelcomeModal s={s} dispatch={dispatch} />}
        {m?.kind === 'settings' && <SettingsPage s={s} dispatch={dispatch} tab={m.tab} />}
        {m?.kind === 'climate' && <ClimatePage s={s} dispatch={dispatch} tab={m.tab} />}
        {m?.kind === 'achievements' && <AchievementsPage s={s} dispatch={dispatch} tab={m.tab} />}
        {m?.kind === 'partners' && <PartnersPage s={s} dispatch={dispatch} tab={m.tab} brand={m.brand} />}
        {m?.kind === 'animals' && (
          <Suspense fallback={<ActivityLoading label="Opening the animals…" />}>
            <AnimalsPage s={s} dispatch={dispatch} tab={m.tab} />
          </Suspense>
        )}
        {m?.kind === 'security' && (
          <Suspense fallback={<ActivityLoading label="Opening security…" />}>
            <SecurityPage s={s} dispatch={dispatch} tab={m.tab} />
          </Suspense>
        )}
        {m?.kind === 'wallet' && (
          <Suspense fallback={<ActivityLoading label="Opening your wallet…" />}>
            <WalletPage s={s} dispatch={dispatch} tab={m.tab} />
          </Suspense>
        )}
        {m?.kind === 'finance' && (
          <Suspense fallback={<ActivityLoading label="Opening your money…" />}>
            <FinancePage s={s} dispatch={dispatch} tab={m.tab} />
          </Suspense>
        )}
        {m?.kind === 'checks' && (
          <Suspense fallback={<ActivityLoading label="Opening the farm checks…" />}>
            <ChecksPage key={m.subject ?? 'all'} s={s} dispatch={dispatch} subject={m.subject} />
          </Suspense>
        )}
        {m?.kind === 'power' && (
          <Suspense fallback={<ActivityLoading label="Opening the power yard…" />}>
            <PowerPage s={s} dispatch={dispatch} tab={m.tab} />
          </Suspense>
        )}
        {m?.kind === 'market' && (
          <Suspense fallback={<ActivityLoading label="Opening the market…" />}>
            <MarketPage s={s} dispatch={dispatch} />
          </Suspense>
        )}
        {m?.kind === 'tractorGame' && (
          <Suspense fallback={<ActivityLoading label="Opening the tractor game…" />}>
            <TractorGamePage dispatch={dispatch} />
          </Suspense>
        )}
        {m?.kind === 'greenhouse' && (
          <Suspense fallback={<ActivityLoading label="Opening the greenhouse…" />}>
            <GreenhousePage s={s} dispatch={dispatch} bed={m.bed} />
          </Suspense>
        )}
        {m?.kind === 'storehouse' && (
          <Suspense fallback={<ActivityLoading label="Opening the storehouse…" />}>
            <StorehousePage s={s} dispatch={dispatch} tab={m.tab ?? 'store'} />
          </Suspense>
        )}
        {m?.kind === 'events' && (
          <Suspense fallback={<ActivityLoading label="Opening special events…" />}>
            <EventsPage s={s} dispatch={dispatch} tab={m.tab} region={m.region} />
          </Suspense>
        )}
        {m?.kind === 'kakuma' && (
          <Suspense fallback={<ActivityLoading label="Opening the Kakuma event…" />}>
            <KakumaPage s={s} dispatch={dispatch} tab={m.tab} />
          </Suspense>
        )}
        {m?.kind === 'shop' && <ShopModal s={s} tab={m.tab} dispatch={dispatch} />}
        {m?.kind === 'steps' && <StepsModal s={s} step={m.step} dispatch={dispatch} />}
        {m?.kind === 'sale' && <SaleModal s={s} dispatch={dispatch} />}
        {m?.kind === 'storage' && <StorageModal s={s} dispatch={dispatch} />}
        {m?.kind === 'timing' && <TimingModal s={s} dispatch={dispatch} />}
        {m?.kind === 'value' && <ValueModal s={s} dispatch={dispatch} />}
        {m?.kind === 'process' && <ProcessModal s={s} dispatch={dispatch} />}
        {m?.kind === 'info' && <InfoModal s={s} dispatch={dispatch} />}
        {m?.kind === 'outcome' && <OutcomeModal s={s} dispatch={dispatch} />}
        {m?.kind === 'rewards' && <RewardsModal s={s} dispatch={dispatch} />}
        {m?.kind === 'loan' && <LoanModal s={s} dispatch={dispatch} view={m.view} />}
        {m?.kind === 'training' && <TrainingModal s={s} dispatch={dispatch} />}
        {m?.kind === 'glossary' && <GlossaryPage key={m.tab ?? 'basics'} s={s} dispatch={dispatch} tab={m.tab} />}

        {/* the dialog after something worked: above every screen */}
        <SuccessLayer s={s} dispatch={dispatch} />

        {awardVisible && s.award && !m && (
          <div key={`award-${s.award.id}`} className="award-pop" role="status">
            <span aria-hidden="true">{s.award.title.startsWith('Certified') ? '🎓' : '🏅'}</span>
            <span>
              <b>{s.award.title}</b>
              <small>{s.award.line}</small>
            </span>
          </div>
        )}
        {toastVisible && s.toast && (
          <div key={s.toast.id} className={`toast${m ? ' is-over-screen' : ''}`} role="status">
            {s.toast.text}
          </div>
        )}
        {/* a farm word's card, or a Farm basics lesson: above everything */}
        <InfoLayer dispatch={dispatch} read={s.basics ?? []} />
      </div>

      {review && (
        <Suspense fallback={null}>
          <ReviewPicker s={s} dispatch={dispatch} />
        </Suspense>
      )}
      <div className="rotate-hint">Rotate your phone to landscape to play TemoLima.</div>
    </div>
    </VoiceContext.Provider>
    </ArtContext.Provider>
    </NavContext.Provider>
  );
}
