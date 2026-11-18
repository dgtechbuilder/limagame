import { FarmMap } from '../components/FarmMap';

/* The short loading screen while the 3D farm opens: its code is fetched (App.tsx) and its shaders are compiled
   (FarmWorld.ready). It shows the picture of the farm itself, so the farm seems to come to life behind it.
   `done`: the farm's first frame is drawn and the screen fades away. Kept out of World.tsx, so the app can show it
   before that chunk has arrived. */
export function FarmLoading({ done = false }: { done?: boolean }) {
  return (
    <div className={`abs world-loading${done ? ' is-done' : ''}`} style={{ inset: 0 }} role="status" aria-live="polite">
      <FarmMap world dim={0.35} />
      <div className="world-loading-card">
        <b>Opening your farm…</b>
        <span className="world-loading-bar" aria-hidden="true">
          <i />
        </span>
      </div>
    </div>
  );
}
