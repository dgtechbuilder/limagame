import { Sentry } from './sentry';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!, {
  // React 19 error hooks: report errors React caught or could not recover from.
  onUncaughtError: Sentry.reactErrorHandler(),
  onCaughtError: Sentry.reactErrorHandler(),
  onRecoverableError: Sentry.reactErrorHandler(),
}).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p style={{ padding: 24 }}>Something went wrong. Please reload the game.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
