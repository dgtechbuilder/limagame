import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// a service worker keeps the game on the phone, so a second visit opens fast and plays on a weak signal (public/sw.js);
// only in the published game, never in development or design review
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* not available (private mode, an old browser): the game works without it */
    });
  });
}
