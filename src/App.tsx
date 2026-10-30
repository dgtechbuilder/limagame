import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FarmScene } from './components/FarmScene';
import { ShopModal, StepsModal } from './screens/Catalog';
import { InfoModal, OutcomeModal, ProcessModal, RewardsModal, SaleModal, StorageModal, TimingModal, ValueModal } from './screens/Journey';
import { initialState, useGame, type GameState } from './state';

const STAGE_W = 874;
const STAGE_H = 402;

/** Every frame in the Figma file, so reviewers can jump straight to it. */
const SCREENS: { label: string; group: string; state: Partial<GameState> }[] = [
  { group: 'Game Design', label: 'Game', state: { modal: null, plotSelected: false, showHint: false } },
  { group: 'Game Design', label: 'Game · hint', state: { modal: null, plotSelected: false, showHint: true } },
  { group: 'Game Design', label: 'Game · farm selected', state: { modal: null, plotSelected: true } },
  { group: 'Game Design', label: 'Shop · Sell Food', state: { modal: { kind: 'shop', tab: 'food' } } },
  { group: 'Game Design', label: 'Shop · Fertilizer', state: { modal: { kind: 'shop', tab: 'fertilizer' } } },
  { group: 'Game Design', label: 'Shop · Water tanks', state: { modal: { kind: 'shop', tab: 'tank' } } },
  { group: 'Game Design', label: 'Shop · Equipments', state: { modal: { kind: 'shop', tab: 'equipment' } } },
  { group: 'New Design', label: 'Farming Steps · Land Prep', state: { modal: { kind: 'steps', step: 'landprep' } } },
  { group: 'New Design', label: 'Farming Steps · Planting', state: { modal: { kind: 'steps', step: 'planting' } } },
  { group: 'New Design', label: 'Farming Steps · Fertilizer', state: { modal: { kind: 'steps', step: 'fertilizer' } } },
  { group: 'New Design', label: 'Farming Steps · Pesticides', state: { modal: { kind: 'steps', step: 'pesticides' } } },
  { group: 'New Design', label: 'Farming Steps · Water', state: { modal: { kind: 'steps', step: 'water' } } },
  { group: 'New Design', label: 'Farming Steps · Harvest', state: { modal: { kind: 'steps', step: 'harvest' } } },
  {
    group: 'New Design',
    label: 'Land Prep · completed',
    state: { modal: { kind: 'steps', step: 'landprep' }, doneTasks: ['land-selection', 'clearing', 'tilling', 'leveling', 'lp-manure', 'herbicide'] },
  },
  { group: 'New Design', label: 'Sale of produce', state: { modal: { kind: 'sale' } } },
  { group: 'New Design', label: 'Harvest Info', state: { modal: { kind: 'info' } } },
  { group: 'New features', label: 'Storage', state: { modal: { kind: 'storage' } } },
  { group: 'New features', label: 'Outcome comparison', state: { modal: { kind: 'outcome' } } },
  { group: 'New features', label: 'Harvest timing', state: { modal: { kind: 'timing' } } },
  { group: 'New features', label: 'Rewards & Discounts Hub', state: { modal: { kind: 'rewards' } } },
  { group: 'New features', label: 'Value Addition', state: { modal: { kind: 'value' } } },
  { group: 'New features', label: 'Select Process', state: { modal: { kind: 'process' } } },
];

function useStageScale() {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => {
      const small = window.innerWidth < 700 || window.innerHeight < 420;
      const padX = small ? 0 : 48;
      const padY = small ? 0 : 112; // leaves room for the screen picker under the stage
      setScale(Math.min((window.innerWidth - padX) / STAGE_W, (window.innerHeight - padY) / STAGE_H));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return scale;
}

export default function App() {
  const [s, dispatch] = useGame();
  const scale = useStageScale();
  const toastTimer = useRef<number | undefined>(undefined);
  const [toastVisible, setToastVisible] = useState(false);

  // Allow deep links like ?screen=Storage for design review.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('screen');
    const hit = want && SCREENS.find(x => x.label.toLowerCase() === want.toLowerCase());
    if (hit) dispatch({ type: 'reset', state: { ...hit.state } });
    else {
      const t = window.setTimeout(() => dispatch({ type: 'hint', on: true }), 900);
      const t2 = window.setTimeout(() => dispatch({ type: 'hint', on: false }), 7500);
      return () => {
        window.clearTimeout(t);
        window.clearTimeout(t2);
      };
    }
  }, [dispatch]);

  useEffect(() => {
    if (!s.toast) return;
    setToastVisible(true);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 2200);
  }, [s.toast]);

  const showPicker = (window.innerHeight - STAGE_H * scale) / 2 >= 44 && new URLSearchParams(window.location.search).get('picker') !== '0';
  const m = s.modal;
  const current = SCREENS.findIndex(x => JSON.stringify(x.state.modal ?? null) === JSON.stringify(m) && (m || (x.state.plotSelected ?? false) === s.plotSelected));

  return (
    <div className="viewport">
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <FarmScene s={s} dispatch={dispatch} />

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

      {showPicker && (
      <label className="picker">
        <span>Screen</span>
        <select
          value={current >= 0 ? current : ''}
          onChange={e => {
            const sc = SCREENS[Number(e.target.value)];
            if (sc) dispatch({ type: 'reset', state: { ...initialState, ...sc.state, coins: s.coins, owned: s.owned } });
          }}
        >
          {current < 0 && <option value="">—</option>}
          {['Game Design', 'New Design', 'New features'].map(g => (
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
      </label>
      )}
      <div className="rotate-hint">Rotate your phone to landscape to play Lima Farming Game.</div>
    </div>
  );
}
