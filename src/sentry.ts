/* Sentry error monitoring.
   The DSN is public by design (it only lets a client send events), so it can live in the
   bundle. VITE_SENTRY_DSN overrides it at build time; an empty value turns Sentry off. */
import * as Sentry from '@sentry/react';

const DEFAULT_DSN = '';

const env = import.meta.env;
const dsn: string = env.VITE_SENTRY_DSN ?? DEFAULT_DSN;

export function initSentry(): void {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: env.VITE_SENTRY_ENVIRONMENT ?? env.MODE,
    release: env.VITE_SENTRY_RELEASE,
    integrations: [Sentry.browserTracingIntegration()],
    // Performance traces: every one in dev, a sample in production.
    tracesSampleRate: env.DEV ? 1.0 : 0.2,
  });

  // Visiting the app with ?sentry-test sends one test error, to check the setup end to end.
  if (new URLSearchParams(window.location.search).has('sentry-test')) {
    Sentry.captureException(new Error('Sentry test error from Lima Farming Game'));
  }
}

export { Sentry };
