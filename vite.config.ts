import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/bundler-plugins/vite';

// Source maps are built and uploaded to Sentry only when SENTRY_AUTH_TOKEN is set (in CI),
// then deleted from dist so they are never published with the game.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

export default defineConfig({
  base: './',
  build: {
    sourcemap: sentryAuthToken ? 'hidden' : false,
  },
  plugins: [
    react(),
    // Keep the Sentry plugin last.
    sentryVitePlugin({
      org: 'kunta-content',
      project: 'limagame',
      authToken: sentryAuthToken,
      disable: !sentryAuthToken,
      telemetry: false,
      sourcemaps: {
        filesToDeleteAfterUpload: ['./dist/**/*.map'],
      },
    }),
  ],
});
