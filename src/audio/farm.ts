/* The sounds of working the farm, its air, and the machines that hum (Web Audio, made on the phone, nothing
   downloaded; they play on src/audio/ambience.ts's context and buses). The design notes are in docs/audio.md.

   · work     — a stroke for every swing of the farmer's tool, in time with the arm (about three a second): the hoe
                biting soil, the sickle cutting grass (a swish and a snip) and weeds (a swish and a tug at the roots),
                seed pattering, fertiliser sprinkling, water pouring, the sprayer's mist, a crop snapped off, the
                hammer on timber, the wrench's ratchet, the crackle of wiring, diesel glugging, hay rustling, milk.
   · built    — a building or a part of one finished (the coop, the cow shed, a solar panel frame, the inverter …):
                three quick knocks, the frame settling and a little two-note "done" on top. The score ducks under it.
   · power on — the main switch thrown: a breaker clack, a rising electrical whine that settles into a soft hum,
                and a bright chime as the lights come on.
   · the air  — while the 3D farm shows: a soft breeze that swells and falls, birds now and then by day, crickets
                by night. It is the bed everything else sits on, so the farm never goes quite silent.
   · the hums — the restaurant's fridge and the storage annex's freezer hum when the farmer walks up to them: louder
                the closer, from the side they are on (stereo), and silent beyond a few metres. The fridge is a
                light, higher compressor; the freezer a deeper, fuller drone with its condenser fan.

   Levels: Settings → Sound → Farm work (work, built, power on) and Ambience (the air and the hums). */

import { core, duck, env, hiss, hz, jit, log, startAudio } from './ambience';
import { gainOf } from './volume';
import type { Fx } from '../world/engine';

export type Tool = string | null;

/* ---------------- the strokes of work ---------------- */

/** what each stroke sounds like, by the job's effect and the tool in hand */
export type Stroke = 'hoe' | 'grass' | 'weed' | 'seed' | 'fert' | 'water' | 'spray' | 'pick' | 'hammer' | 'ratchet' | 'zap' | 'lift' | 'glug' | 'hay' | 'milk';

export function strokeOf(fx: Fx, tool: Tool): Stroke {
  if (fx === 'spark') return tool === 'wrench' && Math.random() < 0.4 ? 'ratchet' : 'zap';
  if (tool === 'hammer') return 'hammer';
  if (tool === 'wrench' && fx !== 'water' && fx !== 'oil') return 'ratchet';
  switch (fx) {
    case 'dig':
    case 'drain':
    case 'mulch':
      return 'hoe';
    case 'clear':
      return 'grass';
    case 'weed':
      return 'weed';
    case 'seed':
      return 'seed';
    case 'fert':
      return 'fert';
    case 'water':
      return 'water';
    case 'spray':
      return 'spray';
    case 'harvest':
      return 'pick';
    case 'stone':
      return 'lift';
    case 'oil':
      return 'glug';
    case 'hay':
      return 'hay';
    case 'milk':
      return 'milk';
    default:
      return 'hoe';
  }
}

function tone(out: AudioNode, t: number, type: OscillatorType, f0: number, f1: number, len: number, peak: number, attack = 0.003) {
  const c = core()!;
  const o = c.ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + len);
  const g = c.ac.createGain();
  env(g, t, peak, attack, len);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + len + 0.05);
}

/** One stroke, at a level (1 a normal swing; more for the last, finishing one). */
function play(s: Stroke, level: number) {
  const c = core()!;
  const out = c.bus.work;
  const t = c.ac.currentTime + 0.005;
  const L = level;
  switch (s) {
    case 'hoe':
      // the blade bites: a dull thud into the soil, a crumbly crunch and a few clods falling back
      hiss(out, t, 0.1, 'lowpass', jit(170), 1, 0.7 * L);
      hiss(out, t + 0.005, 0.14, 'bandpass', jit(900, 0.15), 1.1, 0.4 * L, 0.004, jit(600));
      for (let i = 0; i < 3; i++) hiss(out, t + 0.07 + i * jit(0.035, 0.4), 0.03, 'bandpass', jit(2200, 0.2), 1.4, 0.08 * L, 0.002);
      break;
    case 'grass':
      // the sickle through grass: a fast airy swish, the snip of the blades and their rustle as they fall
      hiss(out, t, 0.13, 'bandpass', jit(2400), 1.6, 0.32 * L, 0.03, jit(6200));
      hiss(out, t + 0.1, 0.05, 'highpass', jit(4800), 0.8, 0.22 * L, 0.002);
      hiss(out, t + 0.13, 0.22, 'bandpass', jit(3600), 0.9, 0.08 * L, 0.02);
      break;
    case 'weed':
      // a weed cut and pulled: the swish, a wetter tear and the low pop of the roots coming out
      hiss(out, t, 0.12, 'bandpass', jit(2000), 1.4, 0.28 * L, 0.03, jit(5000));
      hiss(out, t + 0.09, 0.09, 'bandpass', jit(1300), 2.2, 0.22 * L, 0.004, jit(700));
      tone(out, t + 0.14, 'sine', jit(260), 110, 0.07, 0.25 * L);
      hiss(out, t + 0.15, 0.12, 'highpass', jit(3000), 0.7, 0.06 * L, 0.006);
      break;
    case 'seed':
      // seed pattering on soil from the hand
      for (let i = 0; i < 6; i++) hiss(out, t + i * jit(0.028, 0.4), 0.012, 'bandpass', jit(4200, 0.25), 3, jit(0.12, 0.4) * L, 0.001);
      break;
    case 'fert':
      // granules sprinkled: a fine falling hiss with a few hard grains
      hiss(out, t, 0.3, 'highpass', jit(5200), 0.6, 0.09 * L, 0.04);
      for (let i = 0; i < 4; i++) hiss(out, t + 0.04 + i * jit(0.05, 0.5), 0.01, 'bandpass', jit(6000, 0.2), 4, 0.1 * L, 0.001);
      break;
    case 'water': {
      // water pouring from the can: a running splash and a few bubbles rising
      hiss(out, t, 0.32, 'bandpass', jit(1100), 0.9, 0.18 * L, 0.05);
      hiss(out, t, 0.3, 'highpass', 4500, 0.6, 0.05 * L, 0.05);
      for (let i = 0; i < 3; i++) {
        const f = jit(700, 0.3);
        tone(out, t + 0.04 + i * jit(0.07, 0.4), 'sine', f, f * 1.8, 0.04, 0.06 * L, 0.002);
      }
      break;
    }
    case 'spray':
      // the knapsack: a squeak of the pump and the mist hissing out of the nozzle
      tone(out, t, 'triangle', jit(900), 1300, 0.06, 0.05 * L);
      hiss(out, t + 0.04, 0.3, 'highpass', jit(6500), 0.5, 0.12 * L, 0.03);
      break;
    case 'pick':
      // a crop snapped off and dropped in: a crisp stalk snap, the leaves shaking
      hiss(out, t, 0.025, 'bandpass', jit(2800), 3, 0.35 * L, 0.001);
      tone(out, t, 'sine', jit(420), 200, 0.05, 0.18 * L);
      hiss(out, t + 0.03, 0.16, 'bandpass', jit(3200), 1, 0.08 * L, 0.02);
      break;
    case 'hammer':
      // the hammer on timber: the knock of the head, the wood's short ring and a nail's tick
      hiss(out, t, 0.02, 'highpass', 3000, 0.7, 0.3 * L, 0.001);
      tone(out, t, 'sine', jit(620, 0.06), 480, 0.09, 0.4 * L);
      hiss(out, t, 0.1, 'bandpass', jit(1500, 0.08), 7, 0.35 * L, 0.001);
      tone(out, t, 'triangle', jit(2700, 0.05), 2600, 0.05, 0.05 * L);
      break;
    case 'ratchet':
      // the wrench: four quick ratchet clicks and the tink of steel
      for (let i = 0; i < 4; i++) hiss(out, t + i * 0.034, 0.012, 'bandpass', jit(3600, 0.1), 5, 0.22 * L, 0.001);
      tone(out, t + 0.15, 'sine', jit(2300, 0.05), 2250, 0.12, 0.04 * L);
      break;
    case 'zap': {
      // wiring: a short mains buzz with crackle on top (careful, quiet: it should read as "electric", not as a shock)
      const a = c.ac;
      const o = a.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = jit(100, 0.03);
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400;
      bp.Q.value = 1.2;
      const g = a.createGain();
      env(g, t, 0.1 * L, 0.01, 0.16);
      o.connect(bp).connect(g).connect(out);
      o.start(t);
      o.stop(t + 0.2);
      for (let i = 0; i < 5; i++) hiss(out, t + Math.random() * 0.16, 0.006, 'highpass', jit(7000, 0.2), 1, jit(0.14, 0.4) * L, 0.0005);
      break;
    }
    case 'lift':
      // something heavy set down or a rock lifted: a low thump and grit
      hiss(out, t, 0.14, 'lowpass', jit(120), 1.2, 0.8 * L, 0.006);
      for (let i = 0; i < 3; i++) hiss(out, t + 0.02 + i * jit(0.03, 0.4), 0.03, 'bandpass', jit(1800, 0.2), 1.5, 0.1 * L, 0.002);
      break;
    case 'glug':
      // diesel from the can: three glugs, each a bubble rising through the neck
      for (let i = 0; i < 3; i++) tone(out, t + i * jit(0.09, 0.2), 'sine', jit(170, 0.1), jit(300, 0.1), 0.07, 0.22 * L, 0.01);
      hiss(out, t, 0.3, 'bandpass', 600, 1, 0.05 * L, 0.04);
      break;
    case 'hay':
      // an armful of hay: a long dry rustle
      hiss(out, t, 0.3, 'bandpass', jit(2200), 0.8, 0.14 * L, 0.06, jit(1500));
      hiss(out, t + 0.05, 0.22, 'highpass', jit(5000), 0.7, 0.05 * L, 0.03);
      break;
    case 'milk':
      // milk into the bucket: a squirt that hisses down
      hiss(out, t, 0.12, 'bandpass', jit(3000), 2, 0.16 * L, 0.006, jit(1600));
      hiss(out, t + 0.04, 0.08, 'lowpass', 500, 1, 0.08 * L, 0.01);
      break;
  }
}

/* one stroke per swing of the arm (the engine swings it at sin(time × 18): a stroke every 0.35 s) */
const STROKE_S = 0.35;
let lastStroke = 0;

/** The farmer is working (called every frame or tick while a job, a row or a tidy-up is under way). */
export function working(fx: Fx, tool: Tool) {
  const c = core();
  const now = c ? c.ac.currentTime : typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  if (now - lastStroke < STROKE_S * jit(1, 0.08)) return;
  lastStroke = now;
  const s = strokeOf(fx, tool);
  log(`work:${s}`);
  if (!c || gainOf('work') <= 0) return;
  play(s, 1);
}

/** The work at a spot is done: one bigger, finishing stroke. */
export function workDone(fx: Fx, tool: Tool = null) {
  const s = strokeOf(fx, tool);
  log(`done:${s}`);
  const c = core();
  if (!c || gainOf('work') <= 0) return;
  lastStroke = c.ac.currentTime;
  play(s, 1.5);
}

/* ---------------- built, and the power coming on ---------------- */

/** A building or a part of one is finished: the coop, the cow shed, a part of the power system. */
export function built(what: string) {
  log(`built:${what}`);
  const c = core();
  if (!c || gainOf('work') <= 0) return;
  const out = c.bus.work;
  const t = c.ac.currentTime + 0.01;
  duck(0.45, 0.9);
  // three quick knocks, the last one the loudest
  [0, 0.11, 0.22].forEach((d, i) => {
    hiss(out, t + d, 0.1, 'bandpass', jit(1500, 0.05), 7, (0.25 + i * 0.08), 0.001);
    tone(out, t + d, 'sine', 600 - i * 40, 460, 0.09, 0.3 + i * 0.08);
  });
  // the frame settles: a low wooden thump and a creak
  hiss(out, t + 0.36, 0.22, 'lowpass', 140, 1.2, 0.8, 0.008);
  tone(out, t + 0.42, 'triangle', 260, 230, 0.25, 0.05, 0.05);
  // a little rising "done": two marimba notes a fifth apart (D5, A5)
  for (const [d, m] of [
    [0.5, 74],
    [0.62, 81],
  ] as const) {
    tone(out, t + d, 'sine', hz(m), hz(m), 0.5, 0.28);
    tone(out, t + d, 'sine', hz(m) * 4, hz(m) * 4, 0.12, 0.05);
  }
}

/** The main switch is thrown and the farm has power. */
export function powerOn() {
  log('power:on');
  const c = core();
  if (!c || gainOf('work') <= 0) return;
  const a = c.ac;
  const out = c.bus.work;
  const t = a.currentTime + 0.01;
  duck(0.35, 1.8);
  // the breaker: a hard clack and a low thump through the hut
  hiss(out, t, 0.02, 'highpass', 2500, 0.8, 0.5, 0.0008);
  hiss(out, t, 0.12, 'lowpass', 110, 1, 0.7, 0.003);
  // the inverter spins up: mains harmonics rising to pitch, then settling into a soft hum and fading
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(300, t);
  lp.frequency.exponentialRampToValueAtTime(2400, t + 1.0);
  lp.frequency.exponentialRampToValueAtTime(700, t + 2.2);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t + 0.05);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.9);
  g.gain.setValueAtTime(0.12, t + 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
  lp.connect(g).connect(out);
  for (const [mul, type] of [
    [1, 'sawtooth'],
    [2, 'triangle'],
    [3, 'sine'],
  ] as const) {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(25 * mul, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(100 * mul, t + 1.0);
    o.connect(lp);
    o.start(t + 0.05);
    o.stop(t + 2.7);
  }
  // the lights come on: a bright chime, G major up to the octave (G5 B5 D6 G6)
  [79, 83, 86, 91].forEach((m, i) => {
    tone(out, t + 1.05 + i * 0.07, 'sine', hz(m), hz(m), 0.7, 0.16);
    tone(out, t + 1.05 + i * 0.07, 'sine', hz(m) * 2.76, hz(m) * 2.76, 0.2, 0.03);
  });
}

/* ---------------- the farm's air ---------------- */

let air: { stop: () => void } | null = null;
let airWanted = false;
let night = false;
let airTimer: number | undefined;
let nextCall = 0;

function chirp(out: AudioNode, t: number) {
  // a small bird: two to four fast up-and-down whistles
  const n = 2 + Math.floor(Math.random() * 3);
  const base = jit(3200, 0.2);
  for (let i = 0; i < n; i++) {
    const at = t + i * jit(0.11, 0.3);
    tone(out, at, 'sine', base * 0.8, base * jit(1.4, 0.1), 0.06, 0.05, 0.004);
    tone(out, at + 0.06, 'sine', base * 1.3, base * 0.9, 0.05, 0.035, 0.004);
  }
}

function crickets(out: AudioNode, t: number) {
  // a cricket: a pulsed high trill
  const f = jit(4400, 0.05);
  for (let i = 0; i < 8; i++) tone(out, t + i * 0.045, 'sine', f, f, 0.02, 0.025, 0.002);
}

function startAir() {
  const c = core();
  if (!c || air) return;
  const a = c.ac;
  // a breeze: looped noise, low-passed, swelling and falling slowly
  const src = a.createBufferSource();
  src.buffer = c.noise;
  src.loop = true;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 420;
  lp.Q.value = 0.4;
  const g = a.createGain();
  g.gain.value = 0.05;
  const lfo = a.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = a.createGain();
  depth.gain.value = 0.03;
  lfo.connect(depth).connect(g.gain);
  const lfo2 = a.createOscillator();
  lfo2.frequency.value = 0.11;
  const sweep = a.createGain();
  sweep.gain.value = 160;
  lfo2.connect(sweep).connect(lp.frequency);
  src.connect(lp).connect(g).connect(c.bus.ambience);
  src.start();
  lfo.start();
  lfo2.start();
  nextCall = a.currentTime + 3;
  airTimer = window.setInterval(() => {
    const k = core();
    if (!k || k.ac.currentTime < nextCall) return;
    if (night) {
      crickets(k.bus.ambience, k.ac.currentTime + 0.02);
      nextCall = k.ac.currentTime + jit(2.5, 0.4);
    } else {
      chirp(k.bus.ambience, k.ac.currentTime + 0.02);
      nextCall = k.ac.currentTime + 6 + Math.random() * 8;
    }
  }, 500);
  air = {
    stop: () => {
      window.clearInterval(airTimer);
      for (const n of [src, lfo, lfo2]) n.stop();
      g.disconnect();
    },
  };
  log('air');
}

/* ---------------- the fridge and the freezer ---------------- */

export type HumKind = 'fridge' | 'freezer';
export interface HumSpot {
  kind: HumKind;
  x: number;
  z: number;
}
/** how far each is heard, in metres, and how loud right beside it */
export const HUM_REACH: Record<HumKind, number> = { fridge: 5, freezer: 6.5 };
const HUM_PEAK: Record<HumKind, number> = { fridge: 0.28, freezer: 0.42 };

interface Hum {
  spot: HumSpot;
  gain: GainNode;
  pan: StereoPannerNode | null;
  stop: () => void;
  level: number;
  /** when it went silent (it is stopped a second later) */
  quiet: number;
}
let spots: HumSpot[] = [];
let hums: Hum[] = [];

function makeHum(spot: HumSpot): Hum | null {
  const c = core();
  if (!c) return null;
  const a = c.ac;
  const gain = a.createGain();
  gain.gain.value = 0;
  const pan = typeof a.createStereoPanner === 'function' ? a.createStereoPanner() : null;
  if (pan) gain.connect(pan).connect(c.bus.ambience);
  else gain.connect(c.bus.ambience);
  const nodes: AudioScheduledSourceNode[] = [];
  const body = a.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = spot.kind === 'freezer' ? 520 : 900;
  body.Q.value = 0.7;
  // the compressor's slow wobble, so the hum breathes like a real one
  const wob = a.createGain();
  wob.gain.value = 1;
  const lfo = a.createOscillator();
  lfo.frequency.value = spot.kind === 'freezer' ? 0.23 : 0.37;
  const lfoD = a.createGain();
  lfoD.gain.value = 0.18;
  lfo.connect(lfoD).connect(wob.gain);
  nodes.push(lfo);
  body.connect(wob).connect(gain);
  // mains harmonics: the fridge a lighter, higher hum (100 and 200 Hz), the freezer deeper and fuller (60 to 240 Hz)
  const partials: [number, OscillatorType, number][] =
    spot.kind === 'freezer'
      ? [
          [60, 'sawtooth', 0.35],
          [120, 'sine', 0.5],
          [180, 'sine', 0.22],
          [240, 'triangle', 0.12],
        ]
      : [
          [100, 'sine', 0.5],
          [200, 'triangle', 0.22],
          [300, 'sine', 0.08],
        ];
  for (const [f, type, amp] of partials) {
    const o = a.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 6;
    const g = a.createGain();
    g.gain.value = amp;
    o.connect(g).connect(body);
    nodes.push(o);
  }
  // the fan: soft moving air (the freezer's condenser is the bigger one)
  const fan = a.createBufferSource();
  fan.buffer = c.noise;
  fan.loop = true;
  const fbp = a.createBiquadFilter();
  fbp.type = 'bandpass';
  fbp.frequency.value = spot.kind === 'freezer' ? 700 : 1500;
  fbp.Q.value = 0.8;
  const fg = a.createGain();
  fg.gain.value = spot.kind === 'freezer' ? 0.22 : 0.1;
  fan.connect(fbp).connect(fg).connect(gain);
  nodes.push(fan);
  for (const n of nodes) n.start();
  return {
    spot,
    gain,
    pan,
    level: 0,
    quiet: 0,
    stop: () => {
      for (const n of nodes) n.stop();
      gain.disconnect();
    },
  };
}

/** How loud a hum is with the farmer this far away: full beside it, falling off smoothly, silent past its reach. */
export function humLevel(kind: HumKind, dist: number) {
  const r = HUM_REACH[kind];
  if (dist >= r) return 0;
  const k = 1 - Math.max(0, dist - 0.6) / (r - 0.6);
  return HUM_PEAK[kind] * k * k;
}

let lastHear = 0;
/** where each hum is heard from now, newest values (the play-tests read them) */
export const humNow: Record<HumKind, number> = { fridge: 0, freezer: 0 };

/** The farmer is at (x, z): the hums near them come up, from their side; the rest fade out. Called every frame. */
export function hearAt(x: number, z: number) {
  if (!airWanted) return;
  const c = core();
  const now = c ? c.ac.currentTime : performance.now() / 1000;
  if (now - lastHear < 0.1) return;
  lastHear = now;
  if (c && !air) startAir();
  for (const spot of spots) {
    const d = Math.hypot(spot.x - x, spot.z - z);
    const level = humLevel(spot.kind, d);
    const was = humNow[spot.kind];
    humNow[spot.kind] = level;
    if (level > 0 && was === 0) log(`hum:${spot.kind}`);
    if (!c) continue;
    let h = hums.find(q => q.spot === spot);
    if (!h && level > 0) {
      const made = makeHum(spot);
      if (made) hums.push((h = made));
    }
    if (!h) continue;
    h.gain.gain.setTargetAtTime(level, c.ac.currentTime, 0.15);
    if (h.pan) h.pan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, (spot.x - x) / 3)), c.ac.currentTime, 0.15);
    if (level === 0 && h.level > 0) h.quiet = c.ac.currentTime;
    h.level = level;
  }
  // a hum far away for a while is stopped (it is made again when the farmer comes back)
  if (c)
    hums = hums.filter(h => {
      if (h.level > 0 || c.ac.currentTime - h.quiet < 1.2) return true;
      h.stop();
      return false;
    });
}

/** The 3D farm is showing (with its fridge and freezer where they stand), or not (null). */
export function farmSounds(where: HumSpot[] | null) {
  airWanted = !!where;
  spots = where ?? [];
  if (!where) {
    air?.stop();
    air = null;
    for (const h of hums) h.stop();
    hums = [];
    humNow.fridge = humNow.freezer = 0;
  }
}

/** Night on the farm: crickets instead of birds. */
export function farmNight(on: boolean) {
  night = on;
}

/** Settings → Sound's buttons to hear a few of these. */
export function previewFarm(what: 'grass' | 'weed' | 'hammer' | 'power' | 'fridge' | 'freezer') {
  const go = () => {
    const c = core();
    if (!c) return;
    if (what === 'power') return powerOn();
    if (what === 'grass' || what === 'weed' || what === 'hammer') {
      play(what, 1.2);
      window.setTimeout(() => core() && play(what, 1.2), 360);
      log(`work:${what}`);
      return;
    }
    // a hum for two seconds, as if standing beside it
    const h = makeHum({ kind: what, x: 0, z: 0 });
    if (!h) return;
    log(`hum:${what}`);
    const t = c.ac.currentTime;
    h.gain.gain.setTargetAtTime(HUM_PEAK[what], t, 0.15);
    h.gain.gain.setTargetAtTime(0, t + 1.8, 0.15);
    window.setTimeout(h.stop, 2800);
  };
  startAudio();
  const c = core();
  if (c) go();
  else window.setTimeout(go, 150);
}
