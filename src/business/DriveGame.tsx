import { useEffect, useRef, type PointerEvent as RPointerEvent } from 'react';
import { useNav } from '../components/Nav';
import { BASELINE, toolName } from './model';
import { BAGS, DRIVE_SECS, HAUL_Y, HOLE_NAME, LANES, OBSTACLE_NAME, CELL, laneX, stepField, stepHaul, type Drive, type DriveResult, type FieldControls, type FieldDrive, type HaulDrive } from './drive';

/* The ten-second tractor drive at a farm, drawn on a canvas inside the business map's box. The rules are in drive.ts.
   Nothing here is React state while the drive runs: the frame loop steps the drive, repaints only the cells that
   changed, and writes the clock and the count straight into the HUD, so a phone draws one small canvas a frame. */

/** canvas pixels per game pixel: sharp on phones and when the stage is scaled up */
const K = 2;
/** The map box this sits in (Business.tsx MAP_PX), and the HUD strip at its top. */
const BOX = { w: 520, h: 252, hud: 24 };

export interface DriveProps {
  drive: Drive;
  farm: string;
  /** the job, in a few words */
  job: string;
  onDone: (r: DriveResult) => void;
}

export function DriveGame({ drive, farm, job, onDone }: DriveProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const layers = useRef<{ bg: HTMLCanvasElement; work: HTMLCanvasElement } | null>(null);
  const ctl = useRef<FieldControls>({ target: null, hold: false, keys: {} });
  const clock = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const stat = useRef<HTMLSpanElement>(null);
  const note = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const nav = useNav();
  const menuOpen = useRef(false);
  menuOpen.current = nav.menuOpen;
  const left = Math.round((BOX.w - drive.w) / 2);
  const top = BOX.hud + Math.round((BOX.h - BOX.hud - drive.h) / 2);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    layers.current = drive.kind === 'field' ? makeFieldLayers(drive) : null;
    let raf = 0;
    let last = performance.now();
    let noteUntil = 0;
    let finished = false;
    const say = (text: string, now: number) => {
      if (note.current) note.current.textContent = text;
      noteUntil = now + 1600;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (!menuOpen.current && !drive.done) {
        const hit = drive.kind === 'field' ? stepField(drive, dt, ctl.current) : stepHaul(drive, dt);
        if (hit) say(drive.kind === 'field' ? `You hit ${OBSTACLE_NAME[hit as keyof typeof OBSTACLE_NAME]}! Steer round it.` : `${HOLE_NAME[hit as keyof typeof HOLE_NAME][0].toUpperCase()}${HOLE_NAME[hit as keyof typeof HOLE_NAME].slice(1)}: a bag fell off!`, now);
      }
      draw(cv, drive, layers.current, ctl.current);
      const t = Math.min(DRIVE_SECS, drive.t);
      if (clock.current) clock.current.textContent = `${(DRIVE_SECS - t).toFixed(1)} s`;
      if (bar.current) bar.current.style.width = `${(1 - t / DRIVE_SECS) * 100}%`;
      if (stat.current) stat.current.textContent = drive.kind === 'field' ? `${Math.round((drive.covered / Math.max(1, drive.total)) * 100)}% worked` : `${drive.bags} of ${BAGS} bags`;
      if (noteUntil && now > noteUntil && note.current) {
        note.current.textContent = '';
        noteUntil = 0;
      }
      if (drive.done && !finished) {
        finished = true;
        const r = drive.done;
        say(r.reason === 'done' ? 'The whole field: done!' : 'Time!', now + 9999);
        window.setTimeout(() => done.current(r), 700);
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const map: Record<string, keyof FieldControls['keys']> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    const onKey = (e: KeyboardEvent) => {
      const k = map[e.key.toLowerCase()];
      if (!k) return;
      e.preventDefault();
      if (drive.kind === 'haul') {
        if (e.type === 'keydown' && !e.repeat && (k === 'left' || k === 'right')) drive.lane = Math.max(0, Math.min(LANES - 1, drive.lane + (k === 'left' ? -1 : 1)));
        return;
      }
      ctl.current.keys[k] = e.type === 'keydown';
      if (e.type === 'keydown') ctl.current.target = null;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, [drive]);

  const point = (e: RPointerEvent<HTMLCanvasElement>, down: boolean) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * drive.w;
    const y = ((e.clientY - r.top) / r.height) * drive.h;
    if (drive.kind === 'haul') {
      if (down) drive.lane = Math.max(0, Math.min(LANES - 1, Math.floor(x / (drive.w / LANES))));
      return;
    }
    ctl.current.target = [Math.max(6, Math.min(drive.w - 6, x)), Math.max(6, Math.min(drive.h - 6, y))];
    ctl.current.hold = true;
    if (down) ctl.current.keys = {};
  };

  return (
    <div className="drv" role="group" aria-label={`Drive the tractor at ${farm}: ${job}`}>
      <div className="drv-hud">
        <span className="drv-clock" ref={clock}>
          {DRIVE_SECS.toFixed(1)} s
        </span>
        <span className="drv-bar" aria-hidden="true">
          <span ref={bar} />
        </span>
        <span className="drv-stat" ref={stat} aria-live="off">
          {drive.kind === 'field' ? '0% worked' : `${BAGS} of ${BAGS} bags`}
        </span>
        <span className="drv-note" ref={note} role="status" />
      </div>
      <canvas
        ref={canvas}
        className={`drv-canvas is-${drive.kind}`}
        width={drive.w * K}
        height={drive.h * K}
        style={{ left, top, width: drive.w, height: drive.h }}
        aria-label={drive.kind === 'field' ? `${farm}'s field from above: tap where the tractor should go, or steer with the arrow keys` : 'The road to the farm: tap a lane, or steer with the arrow keys, to miss the potholes'}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          point(e, true);
        }}
        onPointerMove={e => drive.kind === 'field' && ctl.current.hold && point(e, false)}
        onPointerUp={() => (ctl.current.hold = false)}
        onPointerCancel={() => (ctl.current.hold = false)}
      />
      <p className="drv-tip">{drive.kind === 'field' ? `${toolName(drive.tool)}: tap and hold where to go. Work every strip once; the hub driver manages ${Math.round(BASELINE * 100)}%.` : `Trailer: tap a lane to miss the potholes. Every hit drops a bag; the hub driver keeps ${Math.round(BASELINE * 100)}%.`}</p>
    </div>
  );
}

/* ---------------- drawing ---------------- */

const SOIL: Record<string, { bg: string; grain: string; worked: string; twice: string }> = {
  plough: { bg: '#b89468', grain: '#a8845a', worked: '#6d4426', twice: '#8d5a3a' },
  harrow: { bg: '#8a5a36', grain: '#7a4e2e', worked: '#c9a26e', twice: '#d9b98e' },
  ridger: { bg: '#a67c52', grain: '#966c44', worked: '#7a5230', twice: '#9a6a44' },
  planter: { bg: '#b08a5c', grain: '#9e7a4e', worked: '#7fb35a', twice: '#a7c77f' },
  spreader: { bg: '#6f9f4e', grain: '#5f8f42', worked: '#dfe6c4', twice: '#eef0d8' },
  harvester: { bg: '#d2a94a', grain: '#c49a3c', worked: '#e6d3a0', twice: '#efe2bd' },
  combine: { bg: '#d8b24c', grain: '#c8a23e', worked: '#ebdcae', twice: '#f2e8c8' },
};

function makeFieldLayers(d: FieldDrive) {
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = d.w * K;
    c.height = d.h * K;
    return c;
  };
  const bg = mk();
  const work = mk();
  const c = bg.getContext('2d')!;
  c.setTransform(K, 0, 0, K, 0, 0);
  const soil = SOIL[d.tool] ?? SOIL.plough;
  c.fillStyle = soil.bg;
  c.fillRect(0, 0, d.w, d.h);
  // a little grain, the same every time
  let h = 7;
  c.fillStyle = soil.grain;
  for (let i = 0; i < 260; i++) {
    h = (h * 48271) % 2147483647;
    const x = (h % 1000) / 1000;
    h = (h * 48271) % 2147483647;
    const y = (h % 1000) / 1000;
    c.fillRect(Math.floor(x * d.w), Math.floor(y * d.h), 3, 1.5);
  }
  // the rows the implement should follow, faint
  c.strokeStyle = 'rgba(255,255,255,0.12)';
  c.lineWidth = 1;
  for (let y = d.swath; y < d.h; y += d.swath) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(d.w, y);
    c.stroke();
  }
  for (const o of d.obs) drawObstacle(c, o.x, o.y, o.r, o.kind);
  return { bg, work };
}

function drawObstacle(c: CanvasRenderingContext2D, x: number, y: number, r: number, kind: string) {
  c.save();
  c.translate(x, y);
  if (kind === 'tree') {
    c.fillStyle = 'rgba(0,0,0,0.18)';
    c.beginPath();
    c.ellipse(3, 4, r + 2, r - 1, 0, 0, 7);
    c.fill();
    c.fillStyle = '#3f8a3a';
    c.beginPath();
    c.arc(0, 0, r + 2, 0, 7);
    c.fill();
    c.fillStyle = '#58a84c';
    c.beginPath();
    c.arc(-3, -3, r - 3, 0, 7);
    c.fill();
  } else if (kind === 'rock') {
    c.fillStyle = '#6f6f6f';
    c.beginPath();
    c.ellipse(0, 0, r, r * 0.8, 0.4, 0, 7);
    c.fill();
    c.fillStyle = '#9a9a9a';
    c.beginPath();
    c.ellipse(-2, -2, r * 0.55, r * 0.4, 0.4, 0, 7);
    c.fill();
  } else {
    c.fillStyle = '#5a3a1e';
    c.beginPath();
    c.arc(0, 0, r, 0, 7);
    c.fill();
    c.fillStyle = '#c99a62';
    c.beginPath();
    c.arc(0, 0, r * 0.6, 0, 7);
    c.fill();
    c.strokeStyle = '#8a6238';
    c.lineWidth = 1;
    c.beginPath();
    c.arc(0, 0, r * 0.35, 0, 7);
    c.stroke();
  }
  c.restore();
}

function draw(cv: HTMLCanvasElement, d: Drive, L: { bg: HTMLCanvasElement; work: HTMLCanvasElement } | null, ctl: FieldControls) {
  const c = cv.getContext('2d')!;
  if (d.kind === 'field' && L) {
    if (d.fresh.length) {
      const w = L.work.getContext('2d')!;
      w.setTransform(K, 0, 0, K, 0, 0);
      const soil = SOIL[d.tool] ?? SOIL.plough;
      for (const i of d.fresh) {
        w.fillStyle = d.cnt[i] > 1 ? soil.twice : soil.worked;
        w.fillRect((i % d.gw) * CELL, Math.floor(i / d.gw) * CELL, CELL, CELL);
      }
      d.fresh = [];
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(L.bg, 0, 0);
    c.drawImage(L.work, 0, 0);
    c.setTransform(K, 0, 0, K, 0, 0);
    if (ctl.target && ctl.hold) {
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(ctl.target[0], ctl.target[1], 7, 0, 7);
      c.stroke();
    }
    drawTractor(c, d.x, d.y, d.hdg, d.size, d.swath, d.tool);
  } else if (d.kind === 'haul') {
    drawRoad(c, d);
  }
}

function drawRoad(c: CanvasRenderingContext2D, d: HaulDrive) {
  c.setTransform(K, 0, 0, K, 0, 0);
  // grass, then the murram road with its edges and the stripes that roll by
  c.fillStyle = '#7fb15a';
  c.fillRect(0, 0, d.w, d.h);
  c.fillStyle = '#c9a26e';
  c.fillRect(18, 0, d.w - 36, d.h);
  c.fillStyle = '#a8825a';
  c.fillRect(18, 0, 6, d.h);
  c.fillRect(d.w - 24, 0, 6, d.h);
  c.fillStyle = 'rgba(255,255,255,0.35)';
  const off = d.rolled % 40;
  for (let y = -40 + off; y < d.h; y += 40) {
    for (let l = 1; l < LANES; l++) c.fillRect(laneX(l) - laneX(0) - 1, y, 2, 18);
  }
  for (const h of d.holes) {
    if (h.y < -30 || h.y > d.h + 30) continue;
    const x = laneX(h.lane);
    c.save();
    c.translate(x, h.y);
    if (h.kind === 'puddle') {
      c.fillStyle = '#5f9fd0';
      c.beginPath();
      c.ellipse(0, 0, 26, 12, 0, 0, 7);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.ellipse(-6, -3, 9, 3, 0, 0, 7);
      c.fill();
    } else if (h.kind === 'pothole') {
      c.fillStyle = '#5a3d22';
      c.beginPath();
      c.ellipse(0, 0, 22, 12, 0, 0, 7);
      c.fill();
      c.fillStyle = '#3d2614';
      c.beginPath();
      c.ellipse(2, 2, 15, 7, 0, 0, 7);
      c.fill();
    } else {
      c.fillStyle = '#9a7246';
      for (const dx of [-12, 0, 12]) c.fillRect(dx - 3, -16, 6, 32);
    }
    c.restore();
  }
  const shake = d.jolt > 0 ? Math.sin(d.jolt * 60) * 3 : 0;
  // the trailer behind (above on screen), then the tractor
  c.save();
  c.translate(d.x + shake, HAUL_Y);
  c.rotate(-Math.PI / 2);
  const s = d.size;
  c.fillStyle = '#5a3a1e';
  c.fillRect(-46 * s, -13 * s, 26 * s, 26 * s);
  c.fillStyle = '#1f1f1f';
  c.fillRect(-40 * s, -17 * s, 10 * s, 5 * s);
  c.fillRect(-40 * s, 12 * s, 10 * s, 5 * s);
  c.fillStyle = '#e9d7a8';
  for (let i = 0; i < d.bags; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    c.fillRect((-44 + row * 5) * s, (-11 + col * 12) * s, 4.5 * s, 10 * s);
  }
  c.strokeStyle = '#444';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-20 * s, 0);
  c.lineTo(-9 * s, 0);
  c.stroke();
  drawTractorBody(c, s, '#3e8e3a');
  c.restore();
}

function drawTractor(c: CanvasRenderingContext2D, x: number, y: number, hdg: number, size: number, swath: number, tool: string) {
  c.save();
  c.translate(x, y);
  c.rotate(hdg);
  const hw = swath / 2;
  c.strokeStyle = '#444';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-8, 0);
  c.lineTo(-15, 0);
  c.stroke();
  if (tool === 'harvester' || tool === 'combine') {
    c.fillStyle = '#c0392b';
    c.fillRect(-18, -hw, 6, hw * 2);
  } else {
    c.fillStyle = '#6b6f73';
    c.fillRect(-18, -hw, 6, hw * 2);
    c.fillStyle = '#4a4e52';
    for (let o = -hw + 2; o < hw; o += tool === 'spreader' ? 9 : 5) c.fillRect(-19, o, 2, 2.5);
  }
  drawTractorBody(c, size, tool === 'combine' ? '#d9a21b' : '#3e8e3a');
  c.restore();
}

function drawTractorBody(c: CanvasRenderingContext2D, s: number, color: string) {
  c.save();
  c.scale(s, s);
  c.fillStyle = '#1f1f1f';
  c.fillRect(-10, -13, 11, 5);
  c.fillRect(-10, 8, 11, 5);
  c.fillRect(6, -10, 7, 3.5);
  c.fillRect(6, 6.5, 7, 3.5);
  c.fillStyle = color;
  c.beginPath();
  c.roundRect(-9, -7, 23, 14, 3);
  c.fill();
  c.fillStyle = '#26323d';
  c.fillRect(-8, -6, 10, 12);
  c.fillStyle = 'rgba(160,210,240,.7)';
  c.fillRect(-1, -5, 2.5, 10);
  c.fillStyle = '#ffd166';
  c.fillRect(12, -5, 2, 3);
  c.fillRect(12, 2, 2, 3);
  c.restore();
}
