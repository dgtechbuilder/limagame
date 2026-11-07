import { useEffect, type Dispatch } from 'react';
import { REVIEW_BASE, SELLING, SOLD, initialState, type Action, type GameState, type SeasonResult } from '../state';
import { TRIAL_SAMPLES, wakalaCase } from '../trials/samples';

/* Design review (?review=1): a picker of every screen with sample data, and ?screen=<label> to open one. Loaded only in
   review, so players never pay for building the samples. */

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

/** From Wakala Agent: a farm-world moment, opened on one of its new screens. */
const wakala = (kind: Parameters<typeof wakalaCase>[0], worldDemo: string | null): Partial<GameState> => {
  const c = wakalaCase(kind);
  return { view: 'world', trial: c.trial, field: c.field, worldDemo };
};

const SCREENS: { label: string; group: string; state: Partial<GameState> }[] = [
  { group: 'Game Design', label: 'Game', state: {} },
  { group: 'First session', label: '1 · Create the farmer', state: { onboarded: false, farmer: null, fs: { phase: 'create', at: 'first', opened: false } } },
  { group: 'First session', label: '2 · Walk to the shamba', state: { onboarded: false, fs: { phase: 'walk1', at: 'first', opened: false } } },
  { group: 'First session', label: '3 · First review', state: { onboarded: false, fs: { phase: 'review1', at: 'first', opened: false } } },
  { group: 'First session', label: '3b · Walk to the back shamba', state: { onboarded: false, fs: { phase: 'walkRetry', at: 'first', opened: false } } },
  { group: 'First session', label: '3c · Retry review', state: { onboarded: false, fs: { phase: 'retry', at: 'lower', opened: false } } },
  { group: 'First session', label: '4 · Farm opens', state: { fs: { phase: 'walk2', at: 'first', opened: false } } },
  { group: 'First session', label: '5 · Second review (sukuma wiki)', state: { fs: { phase: 'review2', at: 'first', opened: true } } },
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
  { group: 'Added', label: 'Settings · My farmer', state: { modal: { kind: 'settings', tab: 'farmer' } } },
  { group: 'Added', label: 'Settings · Game', state: { modal: { kind: 'settings', tab: 'game' } } },
  { group: 'Added', label: 'Settings · Display', state: { modal: { kind: 'settings', tab: 'display' } } },
  { group: 'Added', label: 'Settings · Help & data', state: { modal: { kind: 'settings', tab: 'help' } } },
  { group: 'Farm world', label: 'Farm world · Start', state: { view: 'world' } },
  { group: 'Farm world', label: 'Farm world · Planting', state: { view: 'world', trial: TRIAL_SAMPLES.worldPlanting, field: TRIAL_SAMPLES.worldPlantingField } },
  { group: 'Farm world', label: 'Farm world · Growing', state: { view: 'world', trial: TRIAL_SAMPLES.worldGrowing, field: TRIAL_SAMPLES.worldGrowingField } },
  { group: 'Farm world', label: 'Farm world · Harvest', state: { view: 'world', trial: TRIAL_SAMPLES.worldHarvest, field: TRIAL_SAMPLES.worldHarvestField } },
  { group: 'From Wakala', label: 'Wakala · Mama Achieng in a check', state: wakala('voice', 'check') },
  { group: 'From Wakala', label: 'Wakala · Choose the fix', state: wakala('fix', 'prescribe') },
  { group: 'From Wakala', label: 'Wakala · Safety kit and product', state: wakala('spray', 'spray') },
  { group: 'From Wakala', label: 'Wakala · Follow-up due', state: wakala('followUp', null) },
  { group: 'From Wakala', label: 'Wakala · The problem came back', state: wakala('cameBack', 'check') },
  { group: 'From Wakala', label: 'Wakala · Tractor brief', state: wakala('tractor', 'tractor') },
  { group: 'From Wakala', label: 'Wakala · Tractor summary', state: wakala('tractor', 'tractor-summary') },
  { group: 'Plots A to D', label: 'Plots · Tractor type and tool', state: wakala('plots', 'rig') },
  { group: 'Plots A to D', label: 'Plots · Seed for each plot', state: wakala('plots', 'board') },
  { group: 'Plots A to D', label: 'Plots · Farm world', state: wakala('plots', null) },
  { group: 'Six farms', label: 'Six farms · Start', state: { trialsOpen: true } },
  { group: 'Six farms', label: 'Six farms · Plan two farms', state: { trialsOpen: true, trial: TRIAL_SAMPLES.guidedPlan } },
  { group: 'Six farms', label: 'Six farms · Two farms growing', state: { trialsOpen: true, trial: TRIAL_SAMPLES.guidedGrowing } },
  { group: 'Six farms', label: 'Six farms · Two farms compared', state: { trialsOpen: true, trial: TRIAL_SAMPLES.guidedDone } },
  { group: 'Six farms', label: 'Six farms · Plan six farms', state: { trialsOpen: true, trial: TRIAL_SAMPLES.sixPlan, trialHistory: TRIAL_SAMPLES.history } },
  { group: 'Six farms', label: 'Six farms · Growing', state: { trialsOpen: true, trial: TRIAL_SAMPLES.sixGrowing, trialHistory: TRIAL_SAMPLES.history } },
  { group: 'Six farms', label: 'Six farms · Check a farm', state: { roundsOpen: true, roundsTrial: true, roundsView: 'look', trial: TRIAL_SAMPLES.sixGrowing, trialHistory: TRIAL_SAMPLES.history } },
  { group: 'Six farms', label: 'Six farms · Results', state: { trialsOpen: true, trial: TRIAL_SAMPLES.sixDone, trialHistory: TRIAL_SAMPLES.history } },
  { group: 'Field rounds', label: 'Rounds · Map', state: { roundsOpen: true, roundsView: 'map' } },
  { group: 'Field rounds', label: 'Rounds · Look at five pictures', state: { roundsOpen: true, roundsView: 'look' } },
  { group: 'Field rounds', label: 'Rounds · Broken fence', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'livestock:maize:young' } },
  { group: 'Field rounds', label: 'Rounds · Hail', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'hail:tomato:grow' } },
  { group: 'Field rounds', label: 'Rounds · Flood', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'flood:kale:grow' } },
  { group: 'Field rounds', label: 'Rounds · Disease', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'disease:tomato:grow' } },
  { group: 'Field rounds', label: 'Rounds · Weeds', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'weeds:beans:young' } },
  { group: 'Field rounds', label: 'Rounds · Birds and monkeys', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'wildlife:maize:harvest' } },
  { group: 'Field rounds', label: 'Rounds · Planted too early', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'plantEarly:maize:young' } },
  { group: 'Field rounds', label: 'Rounds · Planted too late', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'plantLate:maize:grow' } },
  { group: 'Field rounds', label: 'Rounds · Harvested too early', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'harvestEarly:tomato:harvest' } },
  { group: 'Field rounds', label: 'Rounds · Harvested too late', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'harvestLate:maize:harvest' } },
  { group: 'Field rounds', label: 'Rounds · Healthy at harvest', state: { roundsOpen: true, roundsView: 'look', roundsDemo: 'healthy:beans:harvest' } },
  { group: 'Field rounds', label: 'Rounds · Judge', state: { roundsOpen: true, roundsView: 'judge' } },
  { group: 'Field rounds', label: 'Rounds · Right call', state: { roundsOpen: true, roundsView: 'right' } },
  { group: 'Field rounds', label: 'Rounds · Wrong call', state: { roundsOpen: true, roundsView: 'wrong' } },
  { group: 'Field rounds', label: 'Rounds · Summary', state: { roundsOpen: true, roundsView: 'summary' } },
];

export function ReviewPicker({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  // Design review: jump to ?screen=<label>. (New players start in the first session, not a welcome screen.)
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get('screen');
    const hit = want && SCREENS.find(x => x.label.toLowerCase() === want.toLowerCase());
    if (hit) dispatch({ type: 'reset', state: { ...hit.state } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const firstSession = s.fs.phase !== 'done';
  const m = s.modal;
  const current = SCREENS.findIndex(x =>
    firstSession
      ? x.state.fs?.phase === s.fs.phase
      : s.roundsOpen
        ? x.state.roundsOpen && !!x.state.roundsTrial === s.roundsTrial && x.state.roundsView === s.roundsView && (x.state.roundsDemo ?? null) === s.roundsDemo
        : s.trialsOpen
          ? !!x.state.trialsOpen && (x.state.trial ?? null) === s.trial
          : !x.state.fs && !x.state.roundsOpen && !x.state.trialsOpen && JSON.stringify(x.state.modal ?? null) === JSON.stringify(m) && (m || (x.state.plotSelected ?? false) === s.plotSelected),
  );

  return (
    <label className="picker">
      <span>Review · not saved</span>
      <select
        value={current >= 0 ? current : ''}
        onChange={e => {
          const sc = SCREENS[Number(e.target.value)];
          if (sc) dispatch({ type: 'reset', state: { ...initialState, ...REVIEW_BASE, ...sc.state } });
        }}
      >
        {current < 0 && <option value="">—</option>}
        {['First session', 'Farm world', 'From Wakala', 'Plots A to D', 'Six farms', 'Field rounds', 'Game Design', 'New Design', 'New features', 'Added'].map(g => (
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
  );
}
