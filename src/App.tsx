import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FarmScene } from './components/FarmScene';
import { ShopModal, StepsModal } from './screens/Catalog';
import { InfoModal, OutcomeModal, ProcessModal, RewardsModal, SaleModal, StorageModal, TimingModal, ValueModal } from './screens/Journey';
import { FirstSession } from './first/FirstSession';
import { FarmMap } from './components/FarmMap';

// the field rounds are loaded only when opened, so the first session stays as small as before
const Rounds = lazy(() => import('./rounds/Rounds').then(m => ({ default: m.Rounds })));
const Trials = lazy(() => import('./trials/Trials').then(m => ({ default: m.Trials })));
const Business = lazy(() => import('./business/Business').then(m => ({ default: m.Business })));
const World = lazy(() => import('./world/World').then(m => ({ default: m.World })));
// design review (?review=1) only: its sample screens are computed when it is opened, never for players
const ReviewPicker = lazy(() => import('./review/Review').then(m => ({ default: m.ReviewPicker })));
import { WelcomeModal } from './screens/Meta';
import { SettingsPage } from './screens/Settings';
import { ClimatePage } from './screens/Climate';
import { AchievementsPage } from './screens/Achievements';
import { ArtContext, VoiceContext } from './art/style';
import { speak, stopSpeaking } from './speech';
import { setSoundOn, sfx, warmSfx } from './sfx';
import { MainMenu } from './screens/MainMenu';
import { NavBar, NavContext } from './components/Nav';
import { reviewing, useGame } from './state';
import { pathOf } from './route';

const STAGE_W = 874;
const STAGE_H = 402;


function useStageScale(roomForPicker: boolean) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const small = window.innerWidth < 700 || window.innerHeight < 420;
      const padX = small ? 0 : 48;
      const padY = small ? 0 : roomForPicker ? 112 : 48;
      setScale(Math.min((window.innerWidth - padX) / STAGE_W, (window.innerHeight - padY) / STAGE_H));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [roomForPicker]);
  return scale;
}

export default function App() {
  const [s, dispatch] = useGame();
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
    document.title = `${words.join(' · ')} · Lima Farming Game`;
    if (window.location.hash === `#${path}`) return;
    const url = `${window.location.pathname}${window.location.search}#${path}`;
    if (replace) window.history.replaceState(null, '', url);
    else window.history.pushState(null, '', url);
  }, [path, urlSeq, review]);

  // The farm world (and its 3D engine) is fetched while the player is busy elsewhere, so it opens without a wait.
  useEffect(() => {
    if (s.view === 'world' || review) return;
    const id = window.setTimeout(() => void import('./world/World'), 5000);
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
  useEffect(() => {
    if (!voiceOn) stopSpeaking();
  }, [voiceOn]);

  // Sound effects (src/sfx.ts): a happy ping for each completed action, a fanfare for each completed flow
  useLayoutEffect(() => setSoundOn(s.settings.sound !== false), [s.settings.sound]);
  useEffect(() => {
    if (s.sfx) sfx[s.sfx.kind]();
  }, [s.sfx]);
  // the cues are made once, after the first tap (browsers start sound only after one)
  useEffect(() => {
    if (s.settings.sound === false) return;
    window.addEventListener('pointerdown', warmSfx, { once: true });
    return () => window.removeEventListener('pointerdown', warmSfx);
  }, [s.settings.sound]);

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
                style={{ right: 6, top: 4 }}
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
              <Suspense fallback={<div className="abs world" style={{ inset: 0 }} />}>
                {/* a new farm is built when the character style or the graphics change */}
                <World key={`${s.settings.art}-${s.settings.graphics}`} s={s} dispatch={dispatch} paused={s.roundsOpen || s.trialsOpen || s.bizOpen || !!m} />
              </Suspense>
            ) : (
              !s.roundsOpen && !s.trialsOpen && !s.bizOpen && <FarmScene s={s} dispatch={dispatch} />
            )}
            {s.roundsOpen ? (
              <Suspense fallback={<FarmMap />}>
                <Rounds s={s} dispatch={dispatch} />
              </Suspense>
            ) : s.trialsOpen ? (
              <Suspense fallback={<FarmMap />}>
                <Trials s={s} dispatch={dispatch} />
              </Suspense>
            ) : s.bizOpen ? (
              <Suspense fallback={<FarmMap />}>
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

        {awardVisible && s.award && !m && (
          <div key={`award-${s.award.id}`} className="award-pop" role="status">
            <span aria-hidden="true">🏅</span>
            <span>
              <b>{s.award.title}</b>
              <small>{s.award.line}</small>
            </span>
          </div>
        )}
        {toastVisible && s.toast && (
          <div key={s.toast.id} className="toast" role="status">
            {s.toast.text}
          </div>
        )}
      </div>

      {review && (
        <Suspense fallback={null}>
          <ReviewPicker s={s} dispatch={dispatch} />
        </Suspense>
      )}
      <div className="rotate-hint">Rotate your phone to landscape to play Lima Farming Game.</div>
    </div>
    </VoiceContext.Provider>
    </ArtContext.Provider>
    </NavContext.Provider>
  );
}
