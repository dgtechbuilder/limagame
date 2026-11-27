import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initMixpanel } from './analytics/mixpanel';
import { CrashGuard } from './net/LoadGuard';
import { registerServiceWorker } from './net/offline';
import './fonts/poppins.css';
import './styles.css';

// Mixpanel starts on boot (src/analytics/mixpanel.ts): the SDK is fetched alongside the first screen
initMixpanel();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CrashGuard>
      <App />
    </CrashGuard>
  </StrictMode>,
);

// a service worker keeps the game on the phone, so a second visit opens fast and plays on a weak or missing signal
// (public/sw.js, src/net/offline.ts); only in the published game, never in development or design review
registerServiceWorker();
