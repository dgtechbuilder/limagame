import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FarmScene } from './components/FarmScene';
import { ShopModal, StepsModal } from './screens/Catalog';
import { InfoModal, OutcomeModal, ProcessModal, RewardsModal, SaleModal, StorageModal, TimingModal, ValueModal } from './screens/Journey';
import { SettingsModal, WelcomeModal } from './screens/Meta';
import { SELLING, SOLD, initialState, reviewing, useGame, type GameState, type SeasonResult } from './state';

const STAGE_W = 874;
const STAGE_H = 402;

/* Sample game states so design review can open every Figma frame with realistic data. */
const allLandprep = ['land-selection', 'clearing', 'tilling', 'leveling', 'lp-manure', 'herbicide'];
const grown: Partial<GameState> = {
  day: 66,
  stepScores: { landprep: 1, planting: 1, fertilizer: 1, pesticides: 0.5, water: 1 },
  doneTasks: [...allLandprep, 'seeding', 'intercropping', 'f-nitrogen', 'f-npk', 'herbicides', 'w-5000'],
};
const selling: Partial<GameState> = { ...grown, stage: SELLING, harvested: { bags: 162, quality: 4 }, stepScores: { ...grown.stepScores, harvest: 0.67 } };
const sampleResult: SeasonResult = {
  season: 1,
  health: 0.9,
  stepScores: { ...grown.stepScores, harvest: 0.67 },
  choice: 'now',
  bagsHarvested: 145,
  bagsSold: 137,
  quality: 4,
  storage: 'home',
  processId: 'processing',
  revenue: 4250,
  spend: 760,
  profit: 3490,
  days: 66,
};
const at = (stage: number): Partial<GameState> => ({ ...grown, stage, doneTasks: grown.doneTasks });

const SCREENS: { label: string; group: string; state: Partial<GameState> }[] = [
  { group: 'Game Design', label: 'Game', state: {} },
  { group: 'Game Design', label: 'Game · first run', state: { onboarded: false, modal: { kind: 'welcome' } } },
  { group: 'Game Design', label: 'Game · farm selected', state: { plotSelected: true } },
  { group: 'Game Design', label: 'Shop · Sell Food', state: { modal: { kind: 'shop', tab: 'food' } } },
  { group: 'Game Design', label: 'Shop · Fertilizer', state: { modal: { kind: 'shop', tab: 'fertilizer' } } },
  { group: 'Game Design', label: 'Shop · Water tanks', state: { modal: { kind: 'shop', tab: 'tank' } } },
  { group: 'Game Design', label: 'Shop · Equipments', state: { modal: { kind: 'shop', tab: 'equipment' } } },
  { group: 'New Design', label: 'Farming Steps · Land Prep', state: { modal: { kind: 'steps', step: 'landprep' } } },
  { group: 'New Design', label: 'Farming Steps · Planting', state: { ...at(1), doneTasks: allLandprep, stepScores: { landprep: 1 }, modal: { kind: 'steps', step: 'planting' } } },
  { group: 'New Design', label: 'Farming Steps · Fertilizer', state: { ...at(2), modal: { kind: 'steps', step: 'fertilizer' } } },
  { group: 'New Design', label: 'Farming Steps · Pesticides', state: { ...at(3), modal: { kind: 'steps', step: 'pesticides' } } },
  { group: 'New Design', label: 'Farming Steps · Water', state: { ...at(4), modal: { kind: 'steps', step: 'water' } } },
  { group: 'New Design', label: 'Farming Steps · Harvest', state: { ...at(5), modal: { kind: 'steps', step: 'harvest' } } },
  { group: 'New Design', label: 'Land Prep · completed', state: { stage: 1, day: 3, doneTasks: allLandprep, stepScores: { landprep: 1 }, modal: { kind: 'steps', step: 'landprep' } } },
  { group: 'New Design', label: 'Sale of produce', state: { ...selling, modal: { kind: 'sale' } } },
  { group: 'New Design', label: 'Harvest Info', state: { ...at(3), modal: { kind: 'info' } } },
  { group: 'New features', label: 'Storage', state: { ...selling, modal: { kind: 'storage' } } },
  { group: 'New features', label: 'Outcome comparison', state: { ...grown, stage: SOLD, history: [sampleResult], modal: { kind: 'outcome' } } },
  { group: 'New features', label: 'Harvest timing', state: { ...at(5), modal: { kind: 'timing' } } },
  { group: 'New features', label: 'Rewards & Discounts Hub', state: { points: 2350, playSeconds: 22500, modal: { kind: 'rewards' } } },
  { group: 'New features', label: 'Value Addition', state: { ...selling, modal: { kind: 'value' } } },
  { group: 'New features', label: 'Select Process', state: { ...selling, modal: { kind: 'process' } } },
  { group: 'Added', label: 'Settings', state: { modal: { kind: 'settings' } } },
];

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

  // First run: show the welcome screen. Design review: jump to ?screen=<label>.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('screen');
    const hit = want && SCREENS.find(x => x.label.toLowerCase() === want.toLowerCase());
    if (hit) dispatch({ type: 'reset', state: { ...hit.state } });
    else if (!s.onboarded) dispatch({ type: 'open', modal: { kind: 'welcome' } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Count play time while the tab is visible (drives the rewards goal).
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') dispatch({ type: 'tick', seconds: 30 });
    }, 30000);
    return () => window.clearInterval(id);
  }, [dispatch]);

  useEffect(() => {
    if (!s.toast) return;
    setToastVisible(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 3200);
  }, [s.toast]);

  const m = s.modal;
  const current = SCREENS.findIndex(x => JSON.stringify(x.state.modal ?? null) === JSON.stringify(m) && (m || (x.state.plotSelected ?? false) === s.plotSelected));

  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <FarmScene s={s} dispatch={dispatch} />

        {m?.kind === 'welcome' && <WelcomeModal s={s} dispatch={dispatch} />}
        {m?.kind === 'settings' && <SettingsModal s={s} dispatch={dispatch} />}
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

        {toastVisible && s.toast && (
          <div key={s.toast.id} className="toast" role="status">
            {s.toast.text}
          </div>
        )}
      </div>

      {review && (
        <label className="picker">
          <span>Review · not saved</span>
          <select
            value={current >= 0 ? current : ''}
            onChange={e => {
              const sc = SCREENS[Number(e.target.value)];
              if (sc) dispatch({ type: 'reset', state: { ...initialState, onboarded: true, ...sc.state } });
            }}
          >
            {current < 0 && <option value="">—</option>}
            {['Game Design', 'New Design', 'New features', 'Added'].map(g => (
              <optgroup key={g} label={g}>
                {SCREENS.map((sc, i) =>
                  sc.group === g ? (
                    <option key={sc.label} value={i}>
                      {sc.label}
                    </option>
                  ) : null,
                )}
              </optgroup>
            ))}
          </select>
          <a href="./" style={{ color: '#e9f3df', fontSize: 11 }}>Exit</a>
        </label>
      )}
      <div className="rotate-hint">Rotate your phone to landscape to play Lima Farming Game.</div>
    </div>
  );
}
