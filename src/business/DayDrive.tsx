import { useEffect, useMemo, useRef, useState, type MutableRefObject, type PointerEvent as RPointerEvent } from 'react';
import { useNav } from '../components/Nav';
import { sfx, soundOn } from '../sfx';
import { BASELINE, toolName, type BizTool, type BizTractor } from './model';
import {
  BAGS,
  HOLE_NAME,
  LANES,
  LANE_H,
  OBSTACLE_NAME,
  ROAD_TOP,
  VIEW_H,
  VIEW_W,
  driveClock,
  newDrive,
  newHaulDrive,
  stepField,
  stepHaul,
  travelSecs,
  type Drive,
  type DriveHit,
  type DriveResult,
  type FieldControls,
  type HaulDrive,
} from './drive';
import { DUST, Fx, K, ROAD_TRACTOR_X, drawGuides, drawObstacle, drawRoad, drawTractor, makeField, makeRoad, paintWork, stackAt, type FieldScene, type RoadScene } from './driveArt';
import { tractorAudio, type TractorAudio } from './driveAudio';
import { FX_MUL, VOLUME, tuneOf, type TractorSettings } from './tune';

/* The business day's drive, start to finish without a break. Once the day starts this one canvas plays the whole
   route: the murram road from the yard to the first farm, the job there, the road to the next farm, and so on, and
   the road home. Across the top, a green line runs Yard → farm → farm → Yard with a little tractor on it that moves
   from farm to farm as the player drives, filling the line behind it; each farm's score appears under its stop.
   The rules are in drive.ts, the painting in driveArt.ts, the sounds in driveAudio.ts.

   Nothing here is React state while the drive runs: the frame loop steps the drive, paints the canvas, moves the
   little tractor and writes the clock and the count straight into the page; React only hears when a stage changes. */

export interface DriveStop {
  id: string;
  /** the farmer's name */
  name: string;
  /** the job, in a few words */
  job: string;
  tool: BizTool;
  /** the same farm and day always lays out the same field */
  seed: string;
}

export interface DayDriveApi {
  /** hand the job at this farm to the hub driver (BASELINE) and drive on */
  skip(): void;
}

export interface DayDriveProps {
  stops: DriveStop[];
  /** the road from the yard to each stop and back, in map pixels (stops.length + 1 legs) */
  legs: number[];
  tractor: BizTractor;
  settings: TractorSettings;
  reduceMotion?: boolean;
  /** a page or the menu is open over the drive: it waits */
  paused?: boolean;
  seed: string;
  api: MutableRefObject<DayDriveApi | null>;
  /** a new stage: on the road to stop `at` (stops.length is the yard), or at work at stop `at` */
  onStage: (at: number, kind: 'road' | 'work') => void;
  onFarm: (id: string, r: DriveResult) => void;
  onFinish: () => void;
  onSettings: () => void;
}

/** keep a finger's moves on the element it pressed (some browsers refuse, which is fine) */
const capture = (e: { currentTarget: Element; pointerId: number }) => {
  try {
    e.currentTarget.setPointerCapture?.(e.pointerId);
  } catch {
    /* no capture: the press still counts */
  }
};

type Stage = { kind: 'road'; to: number; secs: number } | { kind: 'work'; at: number };
/** seconds the scene takes to slide over to the next, and the pause on a finished field */
const SLIDE = 0.65;
const OUTRO = 1.1;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const short = (name: string) => name.replace('Mama ', '').replace('Mzee ', '');

const HIT: Record<DriveHit['kind'], { word: string; color: string }> = {
  rock: { word: 'CLONK!', color: '#ffd84a' },
  tree: { word: 'CRUNCH!', color: '#9be36a' },
  stump: { word: 'THUNK!', color: '#ffb347' },
  stone: { word: 'tink', color: '#eef6ff' },
  pothole: { word: 'BUMP!', color: '#ffd84a' },
  puddle: { word: 'SPLASH!', color: '#9fd8f5' },
  rut: { word: 'THUD!', color: '#ffb347' },
  rubble: { word: 'CLATTER!', color: '#eef6ff' },
};

export function DayDrive(p: DayDriveProps) {
  const { stops, legs } = p;
  const stages = useMemo<Stage[]>(() => {
    const out: Stage[] = [];
    stops.forEach((_, i) => out.push({ kind: 'road', to: i, secs: travelSecs(legs[i] ?? 120) }, { kind: 'work', at: i }));
    out.push({ kind: 'road', to: stops.length, secs: travelSecs(legs[stops.length] ?? 120) });
    return out;
  }, [stops, legs]);
  // where each place sits along the line: by the road between them, with room for every name
  const pos = useMemo(() => {
    const total = legs.reduce((n, l) => n + l, 0) || 1;
    const share = legs.map(l => Math.max(l / total, 0.6 / legs.length));
    const sum = share.reduce((n, s) => n + s, 0);
    const out = [0];
    share.forEach(s => out.push(out[out.length - 1] + s / sum));
    return out;
  }, [legs]);

  const canvas = useRef<HTMLCanvasElement>(null);
  const clock = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const stat = useRef<HTMLSpanElement>(null);
  const note = useRef<HTMLSpanElement>(null);
  const banner = useRef<HTMLDivElement>(null);
  const mini = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const ctl = useRef<FieldControls>({ target: null, hold: false, keys: {} });
  const [si, setSi] = useState(0);
  const [scores, setScores] = useState<Record<number, number>>({});
  /** the live drive and its scene, for the pointer handlers */
  const live = useRef<{ drive: Drive; scene: FieldScene | RoadScene | null } | null>(null);
  const horn = useRef<() => void>(() => undefined);

  const nav = useNav();
  // everything the frame loop reads that can change while it runs
  const cur = useRef(p);
  cur.current = p;
  const menuOpen = useRef(false);
  menuOpen.current = nav.menuOpen;
  const audioRef = useRef<TractorAudio | null>(null);
  const vol = soundOn() ? VOLUME[p.settings.sound] : 0;
  useEffect(() => audioRef.current?.volume(vol), [vol]);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const c = cv.getContext('2d')!;
    const fx = new Fx();
    const audio = tractorAudio(soundOn() ? VOLUME[cur.current.settings.sound] : 0);
    audioRef.current = audio;
    const prev = document.createElement('canvas');
    prev.width = cv.width;
    prev.height = cv.height;
    let road: RoadScene | null = null;
    const roadScene = () => (road ??= makeRoad(cur.current.seed));
    const tool = (st: Stage): BizTool => (st.kind === 'work' ? stops[st.at].tool : (stops[Math.min(st.to, stops.length - 1)]?.tool ?? 'plough'));

    const g = {
      si: 0,
      drive: null as unknown as Drive,
      scene: null as unknown as FieldScene | RoadScene,
      mode: 'play' as 'play' | 'outro' | 'slide' | 'over',
      timer: 0,
      shake: 0,
      steer: 0,
      roll: 0,
      hdg: 0,
      v: 0,
      ticked: 99,
      noteUntil: 0,
    };

    const say = (text: string, ms = 1600) => {
      if (note.current) note.current.textContent = text;
      g.noteUntil = performance.now() + ms;
    };
    let bannerTimer = 0;
    const show = (title: string, sub: string, ms = 1700) => {
      const el = banner.current;
      if (!el) return;
      el.innerHTML = '';
      const b = document.createElement('b');
      b.textContent = title;
      const s = document.createElement('small');
      s.textContent = sub;
      el.append(b, s);
      el.classList.add('is-on');
      window.clearTimeout(bannerTimer);
      bannerTimer = window.setTimeout(() => el.classList.remove('is-on'), ms / Math.max(1, driveClock.scale));
    };

    const begin = (i: number) => {
      const st = stages[i];
      const tune = tuneOf(cur.current.settings);
      g.si = i;
      g.ticked = 99;
      if (st.kind === 'road') {
        g.drive = newHaulDrive(`${cur.current.seed}:road:${i}`, cur.current.tractor, tune, { load: false, secs: st.secs });
        g.scene = roadScene();
      } else {
        const s = stops[st.at];
        g.drive = newDrive(s.seed, s.tool, cur.current.tractor, tune);
        g.scene = g.drive.kind === 'field' ? makeField(g.drive, s.name, s.seed) : roadScene();
      }
      ctl.current.target = null;
      live.current = { drive: g.drive, scene: g.scene };
      setSi(i);
      cur.current.onStage(st.kind === 'road' ? st.to : st.at, st.kind);
    };
    const announce = () => {
      const st = stages[g.si];
      if (st.kind === 'work') {
        const s = stops[st.at];
        audio.cue('arrive');
        show(`Stop ${st.at + 1} · ${s.name}`, g.drive.kind === 'field' ? `${toolName(s.tool)}: work every row once` : `Haul ${BAGS} bags: miss the potholes`);
      } else if (st.to < stops.length) show(`On the road to ${stops[st.to].name}`, 'Tap a lane to dodge the bumps', 1400);
      else show('Back to the yard', 'Last stretch of the day', 1400);
    };

    const nextStage = () => {
      prev.getContext('2d')!.drawImage(cv, 0, 0);
      if (g.si + 1 >= stages.length) {
        g.mode = 'over';
        audio.engine(0, 0);
        window.setTimeout(() => cur.current.onFinish(), 350);
        return;
      }
      begin(g.si + 1);
      g.mode = 'slide';
      g.timer = 0;
      audio.cue('whoosh');
    };

    const finishStage = (r: DriveResult) => {
      const st = stages[g.si];
      if (st.kind !== 'work') return nextStage();
      const s = stops[st.at];
      setScores(o => ({ ...o, [st.at]: r.e }));
      cur.current.onFarm(s.id, r);
      const pct = Math.round(r.e * 100);
      const beat = r.e >= BASELINE;
      show(r.reason === 'driver' ? `Hub driver: ${pct}%` : r.reason === 'done' ? `All done! ${pct}%` : `Time! ${pct}%`, r.reason === 'driver' ? `${s.name}'s job is done` : beat ? `Beat the hub driver's ${Math.round(BASELINE * 100)}%` : `Under the hub driver's ${Math.round(BASELINE * 100)}%`, 1300);
      if (beat && r.reason !== 'driver') {
        sfx.action();
        const [x, y] = tractorAt();
        fx.stars(x, y, 26);
      }
      g.mode = 'outro';
      g.timer = 0;
    };

    /** the tractor's middle in the view */
    const tractorAt = (): [number, number] => {
      const d = g.drive;
      if (d.kind === 'field') {
        const s = g.scene as FieldScene;
        return [s.fx + d.x, s.fy + d.y];
      }
      return [ROAD_TRACTOR_X, d.y];
    };

    const onHit = (h: DriveHit) => {
      const set = cur.current.settings;
      audio.cue(h.kind);
      const d = g.drive;
      const off: [number, number] = d.kind === 'field' ? [(g.scene as FieldScene).fx, (g.scene as FieldScene).fy] : [0, 0];
      const x = h.x + off[0];
      const y = h.y + off[1];
      if (set.shake && !cur.current.reduceMotion) g.shake = Math.max(g.shake, h.hard ? 1 : h.kind === 'stone' ? 0.25 : 0.55);
      const soil = d.kind === 'field' ? DUST[d.tool] : '#c79c63';
      const [tx, ty] = tractorAt();
      const [sx, sy] = stackAt(tx, ty, d.kind === 'field' ? d.hdg : 0, d.size);
      const w = HIT[h.kind];
      fx.text(x, y - 8, w.word, w.color);
      switch (h.kind) {
        case 'rock':
          fx.sparks(x, y, 14);
          fx.chips(x, y, ['#8a8780', '#b5b2aa', '#5f5c57'], 14, 110);
          fx.dust(x, y, soil, 16, 40, 3);
          fx.smoke(sx, sy, 8);
          fx.ring(x, y, '#ffffff', 12);
          say(`You hit ${OBSTACLE_NAME.rock}! Steer round it.`);
          break;
        case 'tree':
          fx.leaves(x, y, 30);
          fx.chips(x, y, ['#6b4a2a', '#8a6238', '#4a3018'], 8, 80);
          fx.dust(x, y, soil, 12, 35, 3);
          fx.smoke(sx, sy, 8);
          fx.ring(x, y, '#d8ffc0', 14);
          say(`You hit ${OBSTACLE_NAME.tree}! Steer round it.`);
          break;
        case 'stump':
          fx.chips(x, y, ['#c99a62', '#8a6238', '#5a3a1e'], 16, 100);
          fx.dust(x, y, soil, 12, 35, 3);
          fx.smoke(sx, sy, 6);
          fx.ring(x, y, '#ffe2b0', 12);
          say(`You hit ${OBSTACLE_NAME.stump}! Steer round it.`);
          break;
        case 'stone':
          fx.chips(x, y, ['#8a8780', '#b5b2aa'], 6, 70);
          fx.dust(x, y, soil, 6, 25, 2);
          fx.sparks(x, y, 3);
          break;
        case 'puddle':
          fx.splash(x, y, 22);
          fx.ring(x, y, '#bfe8ff', 14);
          break;
        default:
          fx.dust(x, y, soil, 16, 40, 3);
          fx.chips(x, y, h.kind === 'rubble' ? ['#8a8780', '#b5b2aa'] : ['#8a5d38', '#b08458'], 10, 80);
          fx.smoke(sx, sy, 4);
          break;
      }
      if (d.kind === 'haul' && d.load) {
        audio.cue('bag');
        fx.chips(tx - 34, ty, ['#efe0b4', '#c9b27a'], 8, 60);
        fx.text(tx - 34, ty - 18, '−1 bag', '#ff8a8a');
        say(`${HOLE_NAME[h.kind as keyof typeof HOLE_NAME][0].toUpperCase()}${HOLE_NAME[h.kind as keyof typeof HOLE_NAME].slice(1)}: a bag fell off!`);
      }
    };

    horn.current = () => {
      audio.cue('horn');
      const [tx, ty] = tractorAt();
      fx.text(tx + 10, ty - 16, 'BEEP BEEP!', '#ffffff');
    };

    cur.current.api.current = {
      skip: () => {
        const st = stages[g.si];
        if (st.kind !== 'work' || (g.mode !== 'play' && g.mode !== 'slide') || g.drive.done) return;
        const name = stops[st.at].name;
        g.drive.done = { e: BASELINE, secs: Math.round(g.drive.t * 10) / 10, hits: g.drive.hits, detail: `The hub driver did ${name}'s job.`, reason: 'driver' };
      },
    };

    const update = (dtR: number, now: number) => {
      const set = cur.current.settings;
      fx.mul = FX_MUL[set.effects];
      const dt = Math.min(0.1, dtR) * driveClock.scale;
      const d = g.drive;
      const st = stages[g.si];
      let rpm = 0.15;
      let load = 0;
      if (g.mode === 'play') {
        let hit: DriveHit | null = null;
        if (d.kind === 'field') {
          const k = ctl.current;
          const eff: FieldControls = set.controls === 'buttons' ? { target: null, hold: false, keys: { ...k.keys, up: k.keys.up || !k.keys.down } } : k;
          const before = d.v;
          hit = stepField(d, dtR, eff);
          paintWork(g.scene as FieldScene, d);
          rpm = 0.2 + Math.min(1, Math.abs(d.v) / d.speed) * 0.8;
          load = d.working ? 1 : 0;
          const s = g.scene as FieldScene;
          const [ax, ay] = [s.fx + d.x - Math.cos(d.hdg) * 20, s.fy + d.y - Math.sin(d.hdg) * 20];
          if (d.working && d.v > 20) {
            fx.dust(ax, ay, DUST[d.tool], 22 * dtR * (d.v / d.speed), 12, 2);
            if (Math.random() < 6 * dtR) fx.chips(ax, ay, d.tool === 'harvester' || d.tool === 'combine' ? ['#f1d77a', '#d6ac45'] : d.tool === 'spreader' ? ['#ffffff', '#e8e4d0'] : ['#5a361c', '#946240'], 2, 40);
          }
          // the black puff of a diesel pulling away
          if (d.v - before > d.speed * 1.6 * dt && d.v < d.speed * 0.6) fx.exhaust(...stackAt(s.fx + d.x, s.fy + d.y, d.hdg, d.size), 1, dtR, true);
        } else {
          hit = stepHaul(d, dtR);
          rpm = 0.72 + (d.jolt > 0 ? 0.1 : 0);
          load = d.load ? 0.6 : 0.25;
          if (Math.random() < 14 * dtR) fx.dust(ROAD_TRACTOR_X - 10, d.y + (Math.random() < 0.5 ? -10 : 10), '#d2a874', 1, 30, 1.5);
          for (const p of fx.list) if (p.k === 'dust' || p.k === 'chip' || p.k === 'drop') p.x -= d.speed * dt;
        }
        if (hit) onHit(hit);
        // the clock's last three seconds tick
        const left = d.secs - d.t;
        if (st.kind === 'work' && left <= 3 && left > 0 && Math.ceil(left) < g.ticked) {
          g.ticked = Math.ceil(left);
          audio.cue('tick');
        }
        if (d.done) finishStage(d.done);
      } else if (g.mode === 'outro') {
        g.timer += dt;
        if (d.kind === 'field') d.v *= Math.exp(-6 * dt);
        if (g.timer >= OUTRO) nextStage();
      } else if (g.mode === 'slide') {
        g.timer += dt;
        rpm = 0.6;
        if (g.timer >= SLIDE) {
          g.mode = 'play';
          announce();
        }
      }
      // the tractor's look: front wheels follow the turning, tyres roll, smoke from the stack
      const dd = g.drive;
      const hdg = dd.kind === 'field' ? dd.hdg : 0;
      const turnRate = dt > 0 ? Math.atan2(Math.sin(hdg - g.hdg), Math.cos(hdg - g.hdg)) / dt : 0;
      g.hdg = hdg;
      const want = dd.kind === 'field' ? Math.max(-1, Math.min(1, turnRate / Math.max(0.1, dd.turn))) * 0.5 : Math.max(-1, Math.min(1, (laneTarget(dd) - dd.y) / 20)) * 0.35;
      g.steer += (want - g.steer) * Math.min(1, dt * 10);
      g.roll += (dd.kind === 'field' ? dd.v : g.mode === 'play' ? dd.speed : 0) * dt;
      const [tx, ty] = tractorAt();
      if (g.mode !== 'over') fx.exhaust(...stackAt(tx, ty, hdg, dd.size), rpm, dtR);
      fx.step(dtR);
      g.shake = Math.max(0, g.shake - dtR * 2.4);
      audio.engine(g.mode === 'over' ? 0 : rpm, load);
      // the page: the clock, the count, the line at the top
      const left = Math.max(0, dd.secs - dd.t);
      if (clock.current) {
        clock.current.textContent = st.kind === 'work' ? `${left.toFixed(1)} s` : st.to < stops.length ? `→ ${short(stops[st.to].name)}` : '→ Yard';
        clock.current.classList.toggle('is-low', st.kind === 'work' && left <= 3 && g.mode === 'play');
      }
      if (bar.current) bar.current.style.width = `${(st.kind === 'work' ? left / dd.secs : 1 - dd.t / dd.secs) * 100}%`;
      if (stat.current) stat.current.textContent = dd.kind === 'field' ? `${Math.round((dd.covered / Math.max(1, dd.total)) * 100)}% worked` : dd.load ? `${dd.bags} of ${BAGS} bags` : dd.hits ? `${dd.hits} bump${dd.hits === 1 ? '' : 's'}` : 'Smooth ride';
      let at: number;
      if (st.kind === 'road') at = pos[st.to] + (pos[st.to + 1] - pos[st.to]) * (g.mode === 'slide' ? 0 : Math.min(1, dd.t / dd.secs));
      else at = pos[st.at + 1];
      if (mini.current) mini.current.style.left = `${at * 100}%`;
      if (fill.current) fill.current.style.width = `${at * 100}%`;
      if (g.noteUntil && now > g.noteUntil && note.current) {
        note.current.textContent = '';
        g.noteUntil = 0;
      }
    };
    const laneTarget = (d: Drive) => (d.kind === 'haul' ? ROAD_TOP + LANE_H * (d.lane + 0.5) : 0);

    const paint = (now: number) => {
      const d = g.drive;
      const set = cur.current.settings;
      const sh = g.shake > 0 ? g.shake * 3 : 0;
      const sx = sh ? (Math.random() - 0.5) * sh * 2 : 0;
      const sy = sh ? (Math.random() - 0.5) * sh * 2 : 0;
      c.setTransform(1, 0, 0, 1, 0, 0);
      let ox = 0;
      if (g.mode === 'slide') {
        const t = ease(Math.min(1, g.timer / SLIDE));
        c.drawImage(prev, -t * VIEW_W * K, 0);
        ox = (1 - t) * VIEW_W;
      }
      c.setTransform(K, 0, 0, K, (ox + sx) * K, sy * K);
      const [tx, ty] = tractorAt();
      if (d.kind === 'field') {
        const s = g.scene as FieldScene;
        c.drawImage(s.bg, 0, 0, VIEW_W, VIEW_H);
        c.drawImage(s.work, s.fx, s.fy, d.w, d.h);
        if (set.guides) drawGuides(c, s, d);
        c.save();
        c.translate(s.fx, s.fy);
        for (const o of d.obs) if (o.kind !== 'tree') drawObstacle(c, o, now);
        if (ctl.current.target && ctl.current.hold && g.mode === 'play') {
          c.strokeStyle = 'rgba(255,255,255,0.9)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(ctl.current.target[0], ctl.current.target[1], 6 + Math.sin(now / 120), 0, Math.PI * 2);
          c.stroke();
        }
        c.restore();
        drawTractor(c, tx, ty, d.hdg, { size: d.size, tool: d.tool, swath: d.swath, steer: g.steer, roll: g.roll, now, busy: d.working });
        c.save();
        c.translate(s.fx, s.fy);
        for (const o of d.obs) if (o.kind === 'tree') drawObstacle(c, o, now);
        c.restore();
      } else {
        drawRoad(c, g.scene as RoadScene, d);
        const st = stages[g.si];
        const bounce = d.jolt > 0 ? Math.sin(d.jolt * 50) * 2 : Math.sin(now / 70) * 0.25;
        const loaded = (d as HaulDrive).load;
        const next = tool(st);
        drawTractor(c, tx, ty + bounce, 0, { size: d.size, tool: next, swath: 30, steer: g.steer, roll: g.roll, now, raised: true, bags: loaded ? d.bags : next === 'trailer' ? 0 : undefined });
      }
      fx.draw(c);
    };

    begin(0);
    // the play-tests and screenshots read the live drive (dev server only)
    if (import.meta.env.DEV) (window as unknown as { __limaDrive?: typeof g }).__limaDrive = g;
    g.mode = 'play';
    announce();
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dtR = Math.min(0.1, (now - last) / 1000);
      last = now;
      const waiting = !!cur.current.paused || menuOpen.current || document.hidden;
      audio.pause(waiting);
      if (!waiting && g.mode !== 'over') update(dtR, now);
      if (g.mode !== 'over') paint(now);
      if (g.mode === 'over') return;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const map: Record<string, keyof FieldControls['keys']> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((key === ' ' || key === 'h') && e.type === 'keydown' && !e.repeat) {
        e.preventDefault();
        return horn.current();
      }
      const k = map[key];
      if (!k) return;
      e.preventDefault();
      const d = g.drive;
      if (d.kind === 'haul') {
        if (e.type === 'keydown' && !e.repeat && (k === 'up' || k === 'down')) d.lane = Math.max(0, Math.min(LANES - 1, d.lane + (k === 'up' ? -1 : 1)));
        return;
      }
      ctl.current.keys[k] = e.type === 'keydown';
      if (e.type === 'keydown') ctl.current.target = null;
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(bannerTimer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      audio.stop();
      audioRef.current = null;
      cur.current.api.current = null;
    };
    // the drive is built once, when the day starts: the stops and legs do not change while it runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stage = stages[si];
  const onRoad = stage.kind === 'road' || stops[stage.at]?.tool === 'trailer';
  const buttons = p.settings.controls === 'buttons';

  const point = (e: RPointerEvent<HTMLCanvasElement>, down: boolean) => {
    const l = live.current;
    if (!l) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * VIEW_W;
    const y = ((e.clientY - r.top) / r.height) * VIEW_H;
    const d = l.drive;
    if (d.kind === 'haul') {
      if (down) d.lane = Math.max(0, Math.min(LANES - 1, Math.floor((y - ROAD_TOP) / LANE_H)));
      return;
    }
    if (buttons) return;
    const s = l.scene as FieldScene;
    ctl.current.target = [Math.max(6, Math.min(d.w - 6, x - s.fx)), Math.max(6, Math.min(d.h - 6, y - s.fy))];
    ctl.current.hold = true;
    if (down) ctl.current.keys = {};
  };
  const press = (k: 'left' | 'right' | 'up' | 'down', on: boolean) => {
    const d = live.current?.drive;
    if (!d) return;
    if (d.kind === 'haul') {
      if (on && (k === 'up' || k === 'down')) d.lane = Math.max(0, Math.min(LANES - 1, d.lane + (k === 'up' ? -1 : 1)));
      return;
    }
    ctl.current.keys[k] = on;
  };
  const padBtn = (k: 'left' | 'right' | 'up' | 'down', label: string, aria: string) => (
    <button
      type="button"
      className={`drv-pad-btn is-${k}`}
      aria-label={aria}
      onPointerDown={e => {
        capture(e);
        press(k, true);
      }}
      onPointerUp={() => press(k, false)}
      onPointerCancel={() => press(k, false)}
      onPointerLeave={() => press(k, false)}
    >
      {label}
    </button>
  );

  const places = ['Yard', ...stops.map(s => short(s.name)), 'Yard'];
  const nowAt = stage.kind === 'road' ? stage.to : stage.at;
  const job = stage.kind === 'work' ? stops[stage.at] : null;

  return (
    <div className="drv" role="group" data-stage={stage.kind} aria-label={job ? `Drive the tractor at ${job.name}: ${job.job}` : 'The tractor on the road between farms'}>
      <div className="drv-route" aria-label={`The day's route: ${places.join(', ')}`}>
        <span className="drv-track" aria-hidden="true">
          <span className="drv-fill" ref={fill} />
          {places.map((name, i) => {
            const stop = i - 1;
            const done = i === 0 || (stop >= 0 && stop < stops.length && scores[stop] !== undefined);
            const here = stage.kind === 'work' ? stop === stage.at : false;
            const next = stage.kind === 'road' && stop === nowAt;
            return (
              <span key={i} className={`drv-node${i === 0 || i === places.length - 1 ? ' is-yard' : ''}${done ? ' is-done' : ''}${here ? ' is-here' : ''}${next ? ' is-next' : ''}`} style={{ left: `${pos[i] * 100}%` }}>
                <i />
                <b>
                  {name}
                  {stop >= 0 && scores[stop] !== undefined && <small className={scores[stop] >= BASELINE ? 'is-good' : ''}>{Math.round(scores[stop] * 100)}%</small>}
                </b>
              </span>
            );
          })}
          <span className="drv-mini" ref={mini} aria-hidden="true">
            <svg viewBox="0 0 30 22" width={22} height={16}>
              <rect x={9} y={2} width={10} height={9} rx={1.5} fill="#eef1f3" stroke="#1f2a33" strokeWidth={1.4} />
              <rect x={6} y={9} width={20} height={6} rx={2} fill="#3e8e3a" />
              <rect x={22} y={5} width={1.8} height={5} fill="#333" />
              <circle cx={10} cy={16} r={5} fill="#1d1d1d" stroke="#555" strokeWidth={1.2} />
              <circle cx={23} cy={17.5} r={3.4} fill="#1d1d1d" stroke="#555" strokeWidth={1} />
            </svg>
          </span>
        </span>
      </div>
      <canvas
        ref={canvas}
        className={`drv-canvas is-${onRoad ? 'haul' : 'field'}`}
        width={VIEW_W * K}
        height={VIEW_H * K}
        tabIndex={0}
        style={{ width: VIEW_W, height: VIEW_H }}
        aria-label={onRoad ? 'The road from above: tap a lane, or use the up and down arrow keys, to miss the potholes' : `${job?.name}'s field from above: tap and hold where the tractor should go, or steer with the arrow keys`}
        onPointerDown={e => {
          capture(e);
          point(e, true);
        }}
        onPointerMove={e => !onRoad && ctl.current.hold && point(e, false)}
        onPointerUp={() => (ctl.current.hold = false)}
        onPointerCancel={() => (ctl.current.hold = false)}
      />
      <div className="drv-hud">
        <span className="drv-clock" ref={clock} />
        <span className="drv-bar" aria-hidden="true">
          <span ref={bar} />
        </span>
        <span className="drv-stat" ref={stat} aria-live="off" />
        <button type="button" className="drv-icon" onClick={() => horn.current()} aria-label="Sound the horn" title="Horn (Space)">
          📢
        </button>
        <button type="button" className="drv-icon" onClick={p.onSettings} aria-label="Tractor settings" title="Tractor settings">
          ⚙
        </button>
      </div>
      <span className="drv-note" ref={note} role="status" />
      <div className="drv-banner" ref={banner} aria-live="polite" />
      {buttons && (
        <div className="drv-pad">
          {onRoad ? (
            <>
              {padBtn('up', '▲', 'Lane up')}
              {padBtn('down', '▼', 'Lane down')}
            </>
          ) : (
            <>
              {padBtn('left', '◀', 'Steer left')}
              {padBtn('right', '▶', 'Steer right')}
            </>
          )}
        </div>
      )}
      <p className="drv-tip">
        {job && !onRoad
          ? `${toolName(job.tool)}: ${buttons ? 'steer with ◀ ▶, the tractor drives itself' : 'tap and hold where to go'}. Beat the hub driver’s ${Math.round(BASELINE * 100)}%.`
          : job
            ? 'Trailer: tap a lane to miss potholes. Each hit drops a bag.'
            : 'On the road: tap a lane (or ▲ ▼) to dodge the bumps.'}
      </p>
    </div>
  );
}
