import { useState, type Dispatch } from 'react';
import { img } from '../assets';
import { ModalShell } from '../components/Modal';
import { GoldButton, Img } from '../components/ui';
import { clearSave, initialState, type Action, type GameState } from '../state';

type Props = { s: GameState; dispatch: Dispatch<Action> };

const POINTS = [
  ['Farm step by step', 'Six steps from land prep to harvest, each a real maize practice.'],
  ['Good practice, bigger harvest', 'Recommended tasks keep the crop healthy. Skipping them costs bags.'],
  ['Sell smart, earn rewards', 'Pick when to harvest, how to store and whether to process. Points unlock real partner discounts.'],
];

/** First-run introduction. */
export function WelcomeModal({ dispatch }: Props) {
  const start = () => {
    dispatch({ type: 'onboarded' });
    dispatch({ type: 'open', modal: { kind: 'steps', step: 'landprep' } });
  };
  return (
    <ModalShell frame="shop" x={178} y={28} title="Welcome to Lima" close={[633, 56]} onClose={() => {
      dispatch({ type: 'onboarded' });
      dispatch({ type: 'close' });
    }}>
      <div className="panel" style={{ left: 215, top: 78, width: 197, height: 254, borderRadius: '16px 0 0 16px', background: '#f1dcbd' }}>
        <Img src={img.guide} w={197} h={183} alt="Your farming guide" style={{ position: 'absolute', bottom: 0, objectFit: 'cover', objectPosition: 'top' }} />
        <div className="speech" style={{ left: 8, top: 8, width: 130, height: 80 }}>
          <img src={img.tipBubble} alt="" />
          <span style={{ width: 104, fontSize: 9, padding: '12px 0 0' }}>Karibu! Let's grow maize on Farm Moja.</span>
        </div>
      </div>
      <div className="panel right-round" style={{ left: 412, top: 78, width: 247, height: 254, padding: '14px 16px' }}>
        <p className="section-title" style={{ fontSize: 11 }}>Your goal: a big, healthy maize harvest</p>
        <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {POINTS.map(([t, b], i) => (
            <li key={t} style={{ display: 'flex', gap: 7 }}>
              <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 100, background: 'var(--gold)', color: '#fff', fontSize: 9, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
              <span>
                <b style={{ fontSize: 10 }}>{t}</b>
                <span style={{ display: 'block', fontSize: 8, lineHeight: 1.4, opacity: 0.85 }}>{b}</span>
              </span>
            </li>
          ))}
        </ol>
        <GoldButton font={10} height={26} style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }} onClick={start}>
          Start farming
        </GoldButton>
      </div>
    </ModalShell>
  );
}

/** Settings: replay intro, full screen, design-review picker and reset. */
export function SettingsModal({ s, dispatch }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  const fullScreen = () => {
    const el = document.documentElement;
    const p = document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.();
    Promise.resolve(p).catch(() => dispatch({ type: 'toast', text: 'Full screen is not available here. Add the game to your home screen instead.' }));
  };
  const rows: { title: string; body: string; action: string; onClick: () => void; danger?: boolean }[] = [
    {
      title: 'Replay the introduction',
      body: 'See how the game works again.',
      action: 'Replay',
      onClick: () => dispatch({ type: 'open', modal: { kind: 'welcome' } }),
    },
    {
      title: 'Full screen',
      body: 'On phones, add Lima to your home screen for the best fit.',
      action: 'Toggle',
      onClick: fullScreen,
    },
    {
      title: 'Design review',
      body: 'Opens a sandbox with a menu of every Figma screen. Your game is not changed.',
      action: 'Open',
      onClick: () => {
        window.location.search = '?review=1';
      },
    },
    {
      title: 'Reset progress',
      body: confirmReset ? 'This erases your seasons, coins and points on this device.' : 'Start again from season 1.',
      action: confirmReset ? 'Yes, erase' : 'Reset',
      danger: true,
      onClick: () => {
        if (!confirmReset) return setConfirmReset(true);
        clearSave();
        dispatch({ type: 'reset', state: { ...initialState, onboarded: true, modal: null, toast: { id: Date.now(), text: 'Progress reset · season 1' } } });
      },
    },
  ];
  return (
    <ModalShell frame="shop" x={178} y={28} title="Settings" close={[633, 56]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254, padding: '12px 18px' }}>
        <p className="section-title">
          Season {s.season} · Day {s.day} · Level {s.level} <span style={{ fontWeight: 400, opacity: 0.75 }}>· progress saves on this device</span>
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
          {rows.map((r, i) => (
            <div key={r.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderTop: i ? '0.5px solid var(--brown-20)' : undefined }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 600 }}>{r.title}</p>
                <p style={{ fontSize: 8, opacity: 0.8, marginTop: 2 }}>{r.body}</p>
              </div>
              <GoldButton
                font={9}
                height={22}
                style={{ width: 96, flexShrink: 0, ...(r.danger && confirmReset ? { background: '#c0392b', borderColor: '#8e2a1f' } : {}) }}
                onClick={r.onClick}
              >
                {r.action}
              </GoldButton>
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
