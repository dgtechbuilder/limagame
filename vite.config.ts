import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/* The service worker's file list (public/sw.js). After each build it is told exactly which files make up the game:
   - core: what the first screens and the 3D farm need (the entry code and its imports, the farm world's code, the
     stylesheet, the font, the 1× backgrounds): kept on the phone when the service worker installs;
   - rest: every other activity's code and every picture: kept when the game asks (src/net/offline.ts), on a good
     connection, or when the player taps Download for offline in Settings;
   - photos and lite photos: the crop-check photos, full and light (Data saver) copies, kept only on that tap;
   - public: the files in public/ (not renamed by the build) with a short hash of each, so the service worker serves
     them from the phone and fetches one again only when it really changed.
   The build id names this version, so a new deploy replaces the old files once it is installed. */
function serviceWorkerManifest(): Plugin {
  let outDir = 'dist';
  let core = new Set<string>();
  let rest = new Set<string>();
  let photos = new Set<string>();
  let lite = new Set<string>();
  return {
    name: 'lima-sw-manifest',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    generateBundle(_o, bundle) {
      core = new Set();
      rest = new Set();
      photos = new Set();
      lite = new Set();
      const byName = new Map(Object.entries(bundle));
      const walk = (name: string) => {
        if (core.has(name)) return;
        const f = byName.get(name);
        if (!f) return;
        core.add(name);
        if (f.type === 'chunk') {
          f.imports.forEach(walk);
          const meta = (f as unknown as { viteMetadata?: { importedCss: Set<string>; importedAssets: Set<string> } }).viteMetadata;
          meta?.importedCss.forEach(c => core.add(c));
        }
      };
      for (const [name, f] of byName) {
        if (f.type !== 'chunk') continue;
        // the entry, and the 3D farm (its code and the 3D engine), which opens right after the first screens
        if (f.isEntry || f.name === 'World' || f.name === 'models') walk(name);
      }
      for (const [name, f] of byName) {
        if (name.endsWith('.map') || core.has(name)) continue;
        const src = (f.type === 'asset' ? (f.originalFileNames ?? []) : []).join(' ').replace(/\\/g, '/');
        if (src.includes('src/rounds/photos-lite/')) lite.add(name);
        else if (src.includes('src/rounds/photos/')) photos.add(name);
        else if (/\.woff2?$/.test(name)) core.add(name);
        else rest.add(name);
      }
    },
    closeBundle() {
      const sw = join(outDir, 'sw.js');
      if (!existsSync(sw)) return;
      const pub: Record<string, string> = {};
      const list = (dir: string): string[] => readdirSync(dir).flatMap(n => (statSync(join(dir, n)).isDirectory() ? list(join(dir, n)) : [join(dir, n)]));
      const publicDir = resolve(outDir, '..', 'public');
      for (const file of existsSync(publicDir) ? list(publicDir) : []) {
        const rel = relative(publicDir, file).replace(/\\/g, '/');
        if (rel === 'sw.js') continue;
        pub[rel] = createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 10);
      }
      const html = readFileSync(join(outDir, 'index.html'));
      const build = createHash('sha1')
        .update(html)
        .update(JSON.stringify(pub))
        .digest('hex')
        .slice(0, 10);
      // the 2× backgrounds are kept only on sharp screens with data to spare (the game asks for them)
      const hires = Object.keys(pub).filter(p => /@2x\./.test(p));
      const firstPics = ['assets/bg-farm.webp', 'assets/bg-world.webp', 'assets/title-plank.png', 'icon-192.png', 'manifest.webmanifest'];
      const manifest = {
        build,
        core: [...core],
        rest: [...rest],
        photos: [...photos],
        lite: [...lite],
        public: pub,
        firstPublic: firstPics.filter(p => p in pub),
        hires,
      };
      const text = readFileSync(sw, 'utf8').replace('/*__LIMA_MANIFEST__*/ null', JSON.stringify(manifest));
      writeFileSync(sw, text);
    },
  };
}

/** The game's version for analytics (src/analytics): package version and the commit it was built from. */
function gameVersion(): string {
  const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };
  let sha = process.env.GITHUB_SHA ?? '';
  if (!sha) {
    try {
      sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch {
      sha = '';
    }
  }
  return sha ? `${pkg.version}+${sha.slice(0, 7)}` : pkg.version;
}

export default defineConfig({
  plugins: [react(), serviceWorkerManifest()],
  define: { __LIMA_VERSION__: JSON.stringify(gameVersion()) },
  base: './',
});
