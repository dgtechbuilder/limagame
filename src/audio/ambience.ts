/* The game's light audio, made on the phone with the Web Audio API (nothing is downloaded):
   · the score   — a calm background piece that never quite repeats: a soft pad on a four-chord loop
                   (G, Em, C, D), a round bass, a kalimba picking notes of the G major pentatonic with a little echo,
                   and a faint shaker. Every 16 bars it thins out to breathe.
   · footsteps   — one for each footfall of the farmer on the 3D farm. On grass, a soft swish and rustle over a
                   cushioned thud; on soil (the dirt yard and paths, a cleared or tilled plot), a drier crunch and a
                   little grit over a firmer thud. Close, but just different enough to hear where you walk.
   · the animals — while the 3D farm is showing: the hens cluck every 20 seconds, a cow gives a light moo every
                   minute (only when the farm has hens, or cows).
   Settings → Sound sets each level (src/audio/volume.ts); the overall volume starts at 2%, so all of it is only
   lightly heard. Browsers start sound only after a tap, so App.tsx calls startAudio() on the first one. The audio
   rests while the game is in the background.
   The farm work, the farm's air and the fridge and freezer hums are in src/audio/farm.ts, on this same context.
   Mixing (docs/audio.md): every kind of sound has its own bus and Settings level; the music bus runs through a duck,
   so a reward cue or a finished building dips the score for a moment and is heard clearly over it. */

import { gainOf, onVolume, type VolumeChannel } from './volume';

export type Ground = 'grass' | 'soil';

/** what played, newest last (the play-tests read it through window.__lima) */
export const audioLog: string[] = [];
export const log = (what: string) => {
  audioLog.push(what);
  if (audioLog.length > 80) audioLog.shift();
};

/* each kind of sound's own trim, under its Settings level: the music sits under everything else */
type Bus = Exclude<VolumeChannel, 'effects'>;
const BUSES: Bus[] = ['music', 'steps', 'animals', 'work', 'ambience'];
const TRIM: Record<Bus, number> = { music: 0.42, steps: 1, animals: 0.8, work: 0.75, ambience: 0.6 };

let ac: AudioContext | null = null;
let noise: AudioBuffer | null = null;
const bus = {} as Record<Bus, GainNode>;
/** the score's duck: 1 normally, dipped for a moment under a big cue */
let ducker: GainNode | null = null;
let started = false;

function context(): AudioContext | null {
  if (ac) return ac;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ac = new AC();
  } catch {
    return null;
  }
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -12;
  comp.ratio.value = 4;
  comp.connect(ac.destination);
  ducker = ac.createGain();
  ducker.connect(comp);
  for (const ch of BUSES) {
    const g = ac.createGain();
    g.gain.value = gainOf(ch) * TRIM[ch];
    g.connect(ch === 'music' ? ducker : comp);
    bus[ch] = g;
  }
  noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  onVolume(() => {
    if (!ac) return;
    for (const ch of BUSES) bus[ch].gain.setTargetAtTime(gainOf(ch) * TRIM[ch], ac.currentTime, 0.08);
  });
  return ac;
}

const running = () => !!ac && ac.state === 'running';

/** The live context and its buses, once sound is running (src/audio/farm.ts plays on them); null before the first tap. */
export function core(): { ac: AudioContext; bus: Record<Bus, GainNode>; noise: AudioBuffer } | null {
  return running() && noise ? { ac: ac!, bus, noise } : null;
}

/** Dip the score under a cue that should be heard clearly: down to `to` (0–1) fast, held, then slowly back.
    (The way mobile base-builders keep a reward or a finished building on top of the music.) */
export function duck(to: number, hold: number) {
  if (!ac || !ducker) return;
  const g = ducker.gain;
  const t = ac.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(Math.min(g.value, to), t + 0.06);
  g.setValueAtTime(Math.min(g.value, to), t + 0.06 + hold);
  g.linearRampToValueAtTime(1, t + 0.06 + hold + 0.9);
  log(`duck:${Math.round(to * 100)}`);
}

/* ---------------- small building blocks ---------------- */

export function env(g: GainNode, t: number, peak: number, attack: number, len: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
}

/** a burst of filtered noise */
export function hiss(out: AudioNode, t: number, len: number, type: BiquadFilterType, f: number, q: number, peak: number, attack = 0.004, sweepTo?: number) {
  const a = ac!;
  const src = a.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  const flt = a.createBiquadFilter();
  flt.type = type;
  flt.frequency.setValueAtTime(f, t);
  if (sweepTo) flt.frequency.exponentialRampToValueAtTime(sweepTo, t + len);
  flt.Q.value = q;
  const g = a.createGain();
  env(g, t, peak, attack, len);
  src.connect(flt).connect(g).connect(out);
  src.start(t, Math.random() * 0.8);
  src.stop(t + len + 0.05);
}

export const jit = (n: number, by = 0.1) => n * (1 + (Math.random() * 2 - 1) * by);
export const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/* ---------------- footsteps ---------------- */

let lastStep = 0;
/** One footfall of the farmer, on grass or on soil (world/engine.ts calls it as each foot lands). */
export function footstep(ground: Ground) {
  log(`step:${ground}`);
  if (!running() || gainOf('steps') <= 0) return;
  const a = ac!;
  const t = a.currentTime + 0.005;
  if (t - lastStep < 0.16) return;
  lastStep = t;
  const out = bus.steps;
  if (ground === 'grass') {
    // a cushioned thud, a soft swish of blades and a fine rustle just after it
    hiss(out, t, 0.09, 'lowpass', jit(190), 0.8, 0.45);
    hiss(out, t, 0.17, 'bandpass', jit(3400, 0.12), 0.9, 0.32, 0.012, jit(2600));
    hiss(out, t + 0.03, 0.12, 'highpass', jit(5200), 0.7, 0.12, 0.01);
  } else {
    // a firmer thud, a drier crunch and a little grit of soil
    hiss(out, t, 0.08, 'lowpass', jit(230), 0.9, 0.6);
    hiss(out, t, 0.12, 'bandpass', jit(1400, 0.12), 1.2, 0.36, 0.006, jit(1000));
    for (let i = 0; i < 3; i++) hiss(out, t + 0.012 + i * jit(0.022, 0.3), 0.03, 'highpass', jit(2600), 0.8, 0.1 - i * 0.025, 0.002);
  }
}

/* ---------------- the farm animals ---------------- */

/** A light moo: a breathy low voice through two formants, the mouth opening ("mm-ooo") and closing again. */
function moo() {
  const a = ac!;
  const t = a.currentTime + 0.02;
  const len = jit(1.5, 0.08);
  const f0 = jit(108, 0.06);
  const out = bus.animals;
  const voice = a.createOscillator();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(f0 * 0.92, t);
  voice.frequency.linearRampToValueAtTime(f0 * 1.25, t + len * 0.25);
  voice.frequency.linearRampToValueAtTime(f0 * 1.18, t + len * 0.6);
  voice.frequency.linearRampToValueAtTime(f0 * 0.86, t + len);
  const vib = a.createOscillator();
  vib.frequency.value = 5;
  const vibG = a.createGain();
  vibG.gain.value = 1.6;
  vib.connect(vibG).connect(voice.frequency);
  // the mouth: a low-pass that opens and closes
  const mouth = a.createBiquadFilter();
  mouth.type = 'lowpass';
  mouth.Q.value = 1.5;
  mouth.frequency.setValueAtTime(320, t);
  mouth.frequency.exponentialRampToValueAtTime(1300, t + len * 0.3);
  mouth.frequency.exponentialRampToValueAtTime(480, t + len);
  const f1 = a.createBiquadFilter();
  f1.type = 'bandpass';
  f1.frequency.value = 520;
  f1.Q.value = 2.5;
  const f2 = a.createBiquadFilter();
  f2.type = 'bandpass';
  f2.frequency.value = 1000;
  f2.Q.value = 3;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.32, t + 0.22);
  g.gain.setValueAtTime(0.32, t + len * 0.65);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const f2g = a.createGain();
  f2g.gain.value = 0.5;
  voice.connect(mouth);
  mouth.connect(f1).connect(g);
  mouth.connect(f2).connect(f2g).connect(g);
  g.connect(out);
  // a little breath through it
  hiss(out, t, len * 0.9, 'bandpass', 700, 1.2, 0.025, 0.25);
  for (const o of [voice, vib]) {
    o.start(t);
    o.stop(t + len + 0.1);
  }
}

/** A hen: a run of short "buk"s, now and then ending in a longer "ba-gawk". */
function cluck() {
  const a = ac!;
  const out = bus.animals;
  let t = a.currentTime + 0.02;
  const n = 3 + Math.floor(Math.random() * 3);
  const bawk = Math.random() < 0.4;
  for (let i = 0; i < n; i++) {
    const long = bawk && i === n - 1;
    const len = long ? 0.26 : jit(0.075, 0.15);
    const f = jit(long ? 620 : 760, 0.08);
    const o = a.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(f, t);
    if (long) {
      o.frequency.linearRampToValueAtTime(f * 1.45, t + 0.07);
      o.frequency.exponentialRampToValueAtTime(f * 1.05, t + len);
    } else o.frequency.exponentialRampToValueAtTime(f * 0.6, t + len);
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = long ? 1500 : 1250;
    bp.Q.value = 2.2;
    const g = a.createGain();
    env(g, t, long ? 0.5 : 0.42, 0.006, len);
    o.connect(bp).connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.05);
    // the click of the beak
    hiss(out, t, 0.02, 'bandpass', 2400, 1.5, 0.12, 0.002);
    t += long ? 0 : jit(0.13, 0.15) + (i === n - 2 && bawk ? 0.05 : 0);
  }
}

/** Every 20 seconds the hens cluck; every minute a cow moos (half a minute out of step with the hens' minute). */
export const HEN_EVERY_S = 20;
export const COW_EVERY_S = 60;
let herd = { cows: 0, hens: 0 };
let farmSecs = 0;
let farmTimer: number | undefined;

function farmTick() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  farmSecs++;
  const animals = gainOf('animals') > 0;
  if (herd.hens > 0 && farmSecs % HEN_EVERY_S === 0) {
    log('cluck');
    if (running() && animals) cluck();
  }
  if (herd.cows > 0 && farmSecs % COW_EVERY_S === COW_EVERY_S / 2) {
    log('moo');
    if (running() && animals) moo();
  }
}

/** The 3D farm is showing with this many cows and hens (World.tsx); 0 and 0 when it is not. */
export function farmAnimals(cows: number, hens: number) {
  const was = herd.cows + herd.hens > 0;
  herd = { cows, hens };
  const on = cows + hens > 0;
  if (on && !was && typeof window !== 'undefined') {
    farmSecs = 0;
    window.clearInterval(farmTimer);
    farmTimer = window.setInterval(farmTick, 1000);
  } else if (!on && was) window.clearInterval(farmTimer);
}

/** Settings → Sound's buttons to hear each sound. */
export function preview(what: 'grass' | 'soil' | 'moo' | 'cluck' | 'music') {
  startAudio();
  const go = () => {
    if (!running()) return;
    if (what === 'grass' || what === 'soil') {
      lastStep = 0;
      footstep(what);
      window.setTimeout(() => {
        lastStep = 0;
        footstep(what);
      }, 300);
    } else if (what === 'moo') {
      log('moo');
      moo();
    } else if (what === 'cluck') {
      log('cluck');
      cluck();
    }
  };
  if (ac && ac.state !== 'running') void ac.resume().then(go, () => undefined);
  else go();
}

/* ---------------- the score ---------------- */

const BPM = 76;
const EIGHTH = 60 / BPM / 2;
// two bars each: G, Em, C, D (root, then the chord, as MIDI notes)
const CHORDS: { root: number; notes: number[] }[] = [
  { root: 43, notes: [55, 59, 62] },
  { root: 40, notes: [55, 59, 64] },
  { root: 36, notes: [55, 60, 64] },
  { root: 38, notes: [54, 57, 62] },
];
// the G major pentatonic, G4 to E6, for the kalimba
const SCALE = [67, 69, 71, 74, 76, 79, 81, 83, 86, 88];

let echo: AudioNode | null = null;
function musicOut(): { dry: AudioNode; wet: AudioNode } {
  const a = ac!;
  if (!echo) {
    // a dotted-eighth echo, softened, for a little space
    const d = a.createDelay(2);
    d.delayTime.value = EIGHTH * 1.5;
    const fb = a.createGain();
    fb.gain.value = 0.28;
    const lp = a.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;
    const send = a.createGain();
    send.gain.value = 0.35;
    send.connect(d);
    d.connect(lp).connect(fb).connect(d);
    lp.connect(bus.music);
    echo = send;
  }
  return { dry: bus.music, wet: echo };
}

/** a soft pad chord: two detuned triangles a note, through a warm filter, slowly in and out */
function pad(t: number, notes: number[], len: number, level: number) {
  const a = ac!;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  lp.Q.value = 0.5;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(level, t + 1.4);
  g.gain.setValueAtTime(level, t + len - 1.2);
  g.gain.linearRampToValueAtTime(0.0001, t + len + 0.6);
  lp.connect(g).connect(musicOut().dry);
  for (const m of notes)
    for (const det of [-7, 7]) {
      const o = a.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz(m);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.7);
    }
}

function bass(t: number, midi: number, len: number, level: number) {
  const a = ac!;
  const o = a.createOscillator();
  o.type = 'sine';
  o.frequency.value = hz(midi);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.03);
  g.gain.exponentialRampToValueAtTime(level * 0.4, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(musicOut().dry);
  o.start(t);
  o.stop(t + len + 0.05);
}

/** a kalimba tine: a round fundamental, a bright metallic overtone that dies quickly, and a soft click */
function kalimba(t: number, midi: number, level: number) {
  const a = ac!;
  const f = hz(midi);
  const { dry, wet } = musicOut();
  const g = a.createGain();
  g.connect(dry);
  g.connect(wet);
  const parts: [number, number, number][] = [
    [1, 1, 1.5],
    [3.0, 0.12, 0.25],
    [5.4, 0.08, 0.12],
  ];
  for (const [mul, amp, len] of parts) {
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.value = f * mul;
    const v = a.createGain();
    env(v, t, level * amp, 0.004, len);
    o.connect(v).connect(g);
    o.start(t);
    o.stop(t + len + 0.05);
  }
  hiss(g, t, 0.015, 'bandpass', f * 4, 2, level * 0.15, 0.001);
}

function shaker(t: number, level: number) {
  hiss(musicOut().dry, t, 0.06, 'highpass', 6500, 0.7, level, 0.012);
}

let step = 0;
let nextAt = 0;
let note = 4;

/** Lay down every eighth note up to a second ahead (a stall of the 3D farm never makes the music stumble). */
function schedule() {
  const a = ac;
  if (!a || a.state !== 'running') return;
  if (nextAt < a.currentTime + 0.05) nextAt = a.currentTime + 0.1;
  const on = gainOf('music') > 0;
  while (nextAt < a.currentTime + 1.2) {
    const t = nextAt;
    const inBar = step % 8;
    const bar = Math.floor(step / 8);
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    // bars 13–16 of every 16 thin out to breathe
    const sparse = bar % 16 >= 12;
    if (on) {
      if (inBar === 0 && bar % 2 === 0) pad(t, chord.notes, EIGHTH * 16, sparse ? 0.05 : 0.06);
      if (!sparse && (inBar === 0 || inBar === 4)) bass(t, chord.root + (inBar === 4 && bar % 2 ? 7 : 0), EIGHTH * 3.5, 0.32);
      if (sparse && inBar === 0) bass(t, chord.root, EIGHTH * 6, 0.22);
      // the kalimba: more often on the beat than off it, in short steps up and down the scale
      const chance = sparse ? (inBar === 0 ? 0.5 : 0.08) : inBar % 2 === 0 ? 0.55 : 0.28;
      if (Math.random() < chance) {
        const move = [-2, -1, -1, 0, 1, 1, 2][Math.floor(Math.random() * 7)];
        note = Math.max(0, Math.min(SCALE.length - 1, note + move));
        // pull back toward the middle so it never sits at the top or the bottom for long
        if (note > 7 && Math.random() < 0.4) note -= 2;
        if (note < 2 && Math.random() < 0.4) note += 2;
        kalimba(t, SCALE[note], inBar === 0 ? 0.3 : 0.22);
      }
      if (!sparse && inBar % 2 === 1) shaker(t, inBar === 3 || inBar === 7 ? 0.05 : 0.03);
    }
    step++;
    nextAt += EIGHTH;
  }
}

/** Start the game's audio (the first tap: browsers start sound only after one). Safe to call again. */
export function startAudio() {
  const a = context();
  if (!a) return;
  if (a.state !== 'running' && !(typeof document !== 'undefined' && document.visibilityState === 'hidden')) void a.resume().catch(() => undefined);
  if (started) return;
  started = true;
  log('score');
  window.setInterval(schedule, 250);
  schedule();
  // rest while the game is in the background
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.visibilityState === 'hidden') void ac.suspend().catch(() => undefined);
    else void ac.resume().then(schedule, () => undefined);
  });
}
