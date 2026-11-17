/* Sentry error monitoring, tracing, logs and Session Replay.
   Imported first in main.tsx so it starts before the rest of the app.
   The DSN is public by design (it only lets a client send events), so it can live in the
   bundle. VITE_SENTRY_DSN overrides it at build time; an empty value turns Sentry off. */
import * as Sentry from '@sentry/react';

const DEFAULT_DSN = 'https://73c6e2d63b8e9bfae8c9b4a934ba5151@o4511382381854720.ingest.us.sentry.io/4512448508919808';

const env = import.meta.env;
const dsn: string = env.VITE_SENTRY_DSN ?? DEFAULT_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: env.VITE_SENTRY_ENVIRONMENT ?? (env.DEV ? 'development' : 'production'),
    // Left unset, the SDK uses the release the Sentry Vite plugin injects at build time.
    ...(env.VITE_SENTRY_RELEASE ? { release: env.VITE_SENTRY_RELEASE } : {}),
    integrations: [
      Sentry.browserTracingIntegration(),
      // Text and inputs are masked by default.
      Sentry.replayIntegration(),
    ],
    // Every trace locally, 10% in production.
    tracesSampleRate: env.DEV ? 1.0 : 0.1,
    // Replays: 10% of sessions, plus every session that hits an error.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

export { Sentry };
