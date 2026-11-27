import { useSyncExternalStore, type CSSProperties } from 'react';
import { GoldButton } from '../components/ui';
import { askConsent, onConsentChange, setConsent } from './mixpanel';

/* styled here (not in styles.css) so the card stands alone: the Shop look, a beige card in a soft brown edge */
const card: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 12,
  transform: 'translateX(-50%)',
  zIndex: 900,
  width: 560,
  maxWidth: 'calc(100% - 32px)',
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '10px 14px',
  background: '#f6e4cc',
  border: '2px solid var(--brown-20)',
  borderRadius: 12,
  boxShadow: '0 4px 14px rgba(60, 30, 10, 0.25)',
  color: 'var(--brown)',
  fontSize: 12,
  lineHeight: 1.35,
};
const noBtn: CSSProperties = { background: 'none', border: 0, color: 'var(--brown)', fontWeight: 600, fontSize: 12, padding: '6px 10px', cursor: 'pointer', textDecoration: 'underline' };

/* The analytics consent card: asked once, after the player has seen a few pages of the game (CONSENT_AFTER in
   ./mixpanel.ts). It sits at the foot of the screen and does not stop play; the answer is kept on the phone. */
export function AnalyticsConsent() {
  const ask = useSyncExternalStore(onConsentChange, askConsent, () => false);
  if (!ask) return null;
  return (
    <div className="mp-consent" style={card} role="dialog" aria-label="Help improve TemoLima">
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <b style={{ fontSize: 13 }}>Help improve TemoLima?</b>
        <span>We count how the game is played (screens, taps, time) to make it better. No names or messages are sent.</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <button type="button" className="mp-consent-no" style={noBtn} onClick={() => setConsent('denied')}>
          No thanks
        </button>
        <GoldButton font={12} height={32} style={{ minWidth: 96, padding: '0 14px' }} onClick={() => setConsent('granted')}>
          Allow
        </GoldButton>
      </div>
    </div>
  );
}
