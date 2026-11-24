import type { Dispatch } from 'react';
import { img } from '../assets';
import { ModalShell } from '../components/Modal';
import { GoldButton } from '../components/ui';
import { Cast } from '../art/Cast';
import type { Action, GameState } from '../state';

type Props = { s: GameState; dispatch: Dispatch<Action> };

const POINTS = [
  ['Farm step by step', 'Six real maize steps, land prep to harvest.'],
  ['Good practice, bigger harvest', 'Recommended tasks keep the crop healthy.'],
  ['Sell smart, earn rewards', 'Choose harvest timing, storage and processing. Points unlock partner discounts.'],
];

/** First-run introduction. */
export function WelcomeModal({ s, dispatch }: Props) {
  // read from the menu before the farm is open (the first session): the guide closes back to the game, and the
  // farming steps stay shut until the first crops are checked
  const early = s.fs.phase !== 'done';
  const start = () => {
    if (early) return dispatch({ type: 'close' });
    dispatch({ type: 'onboarded' });
    dispatch({ type: 'open', modal: { kind: 'steps', step: 'landprep' } });
  };
  return (
    <ModalShell frame="shop" x={178} y={28} title="How the farm works" onClose={() => {
      if (!early) dispatch({ type: 'onboarded' });
      dispatch({ type: 'close' });
    }}>
      <div className="panel" style={{ left: 215, top: 78, width: 197, height: 254, borderRadius: '16px 0 0 16px', background: '#f1dcbd' }}>
        <Cast id="guide" w={197} h={183} alt="Your farming guide" style={{ position: 'absolute', bottom: 0 }} imgStyle={{ objectFit: 'cover', objectPosition: 'top' }} />
        <div className="speech" style={{ left: 8, top: 8, width: 130, height: 80 }}>
          <img src={img.tipBubble} alt="" />
          <span style={{ width: 104, fontSize: 7, padding: '12px 0 0' }}>Karibu! Let's grow maize on Farm Moja.</span>
        </div>
      </div>
      <div className="panel right-round" style={{ left: 412, top: 78, width: 247, height: 254, padding: '14px 16px' }}>
        <p className="section-title" style={{ fontSize: 8.5 }}>Your goal: a big, healthy maize harvest</p>
        <ol style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {POINTS.map(([t, b], i) => (
            <li key={t} style={{ display: 'flex', gap: 7 }}>
              <span style={{ flexShrink: 0, width: 16, height: 16, borderRadius: 100, background: 'var(--gold)', color: '#fff', fontSize: 7, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{i + 1}</span>
              <span>
                <b style={{ fontSize: 8 }}>{t}</b>
                <span style={{ display: 'block', fontSize: 7, lineHeight: 1.4, opacity: 0.85 }}>{b}</span>
              </span>
            </li>
          ))}
        </ol>
        <GoldButton font={10} height={26} style={{ position: 'absolute', left: 16, right: 16, bottom: 14 }} onClick={start}>
          {early ? 'Back to the game' : 'Start farming'}
        </GoldButton>
      </div>
    </ModalShell>
  );
}
