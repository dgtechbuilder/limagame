/* The tractor's sounds in the business day's drive, made on the phone with the Web Audio API (nothing is
   downloaded): a diesel engine that chugs faster and growls louder as the tractor works, and a cue for every knock —
   the clonk of a rock, the crunch and rustle of a tree, the tink of a stone kicked aside, the thud of a pothole, the
   splash of a puddle — plus the horn, the clock's last ticks and a whoosh between scenes.
   It has its own audio context (the game's reward cues put theirs to sleep between cues). Settings → Tractor sets the
   volume; Settings → Sound effects off silences it too. */

import type { HoleKind, ObstacleKind } from './drive';

export type DriveCue = ObstacleKind | HoleKind | 'bag' | 'horn' | 'tick' | 'whoosh' | 'arrive';

export interface TractorAudio {
  /** the engine: rpm 0 (idle) to 1 (flat out), load 0 to 1 (the implement in the ground) */
  engine(rpm: number, load: number): void;
  cue(kind: DriveCue): void;
  volume(v: number): void;
  pause(on: boolean): void;
  stop(): void;
}

const silent: TractorAudio = { engine: () => undefined, cue: () => undefined, volume: () => undefined, pause: () => undefined, stop: () => undefined };

export function tractorAudio(vol: number): TractorAudio {
  if (typeof window === 'undefined') return silent;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return silent;
  let ac: AudioContext;
  try {
    ac = new AC();
  } catch {
    return silent;
  }
  let level = vol;
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 5;
  comp.connect(ac.destination);
  const master = ac.createGain();
  master.gain.value = level;
  master.connect(comp);

  // one second of white noise, looped or cut as each sound needs
  const noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  /* ---- the engine: a low sawtooth and its sub-octave through a filter, chopped by a "chug" LFO, over a rumble ---- */
  const eng = ac.createGain();
  eng.gain.value = 0;
  eng.connect(master);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  lp.Q.value = 3;
  const chop = ac.createGain();
  chop.gain.value = 0.55;
  lp.connect(chop).connect(eng);
  const saw = ac.createOscillator();
  saw.type = 'sawtooth';
  saw.frequency.value = 34;
  const sub = ac.createOscillator();
  sub.type = 'square';
  sub.frequency.value = 17;
  const subG = ac.createGain();
  subG.gain.value = 0.35;
  saw.connect(lp);
  sub.connect(subG).connect(lp);
  // the chug: the pistons, as a wobble on the level
  const lfo = ac.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 9;
  const lfoG = ac.createGain();
  lfoG.gain.value = 0.4;
  lfo.connect(lfoG).connect(chop.gain);
  // the rumble and rattle of the body and the implement
  const rum = ac.createBufferSource();
  rum.buffer = noise;
  rum.loop = true;
  const rumF = ac.createBiquadFilter();
  rumF.type = 'bandpass';
  rumF.frequency.value = 140;
  rumF.Q.value = 0.8;
  const rumG = ac.createGain();
  rumG.gain.value = 0.25;
  rum.connect(rumF).connect(rumG).connect(eng);
  const grit = ac.createBufferSource();
  grit.buffer = noise;
  grit.loop = true;
  const gritF = ac.createBiquadFilter();
  gritF.type = 'bandpass';
  gritF.frequency.value = 1600;
  gritF.Q.value = 0.6;
  const gritG = ac.createGain();
  gritG.gain.value = 0;
  grit.connect(gritF).connect(gritG).connect(master);
  const t0 = ac.currentTime + 0.02;
  for (const s of [saw, sub, lfo, rum, grit]) s.start(t0);
  // the engine turns over as the drive starts
  eng.gain.setValueAtTime(0, t0);
  eng.gain.linearRampToValueAtTime(0.32, t0 + 0.5);

  let paused = false;
  const resume = () => {
    if (!paused && ac.state === 'suspended') void ac.resume().catch(() => undefined);
  };
  resume();

  /* ---- one-off sounds ---- */
  const at = () => ac.currentTime + 0.005;
  function env(g: GainNode, t: number, peak: number, attack: number, len: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  }
  function burst(t: number, len: number, type: BiquadFilterType, f: number, q: number, peak: number, sweepTo?: number) {
    const src = ac.createBufferSource();
    src.buffer = noise;
    const flt = ac.createBiquadFilter();
    flt.type = type;
    flt.frequency.setValueAtTime(f, t);
    if (sweepTo) flt.frequency.exponentialRampToValueAtTime(sweepTo, t + len);
    flt.Q.value = q;
    const g = ac.createGain();
    env(g, t, peak, 0.004, len);
    src.connect(flt).connect(g).connect(master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + len + 0.05);
  }
  function tone(t: number, type: OscillatorType, f: number, len: number, peak: number, toF?: number, attack = 0.004) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (toF) o.frequency.exponentialRampToValueAtTime(toF, t + len);
    const g = ac.createGain();
    env(g, t, peak, attack, len);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  const cues: Record<DriveCue, () => void> = {
    // a heavy steel-on-stone clonk: a thump, a crack of noise and a ringing plough body
    rock: () => {
      const t = at();
      tone(t, 'sine', 130, 0.3, 0.9, 42);
      burst(t, 0.16, 'bandpass', 1100, 1.5, 0.9);
      tone(t, 'triangle', 540, 0.45, 0.22);
      tone(t, 'sine', 1235, 0.35, 0.12);
      tone(t + 0.02, 'sine', 1870, 0.25, 0.07);
    },
    // a deep thud, the trunk cracking and the leaves shaking
    tree: () => {
      const t = at();
      tone(t, 'sine', 95, 0.45, 1, 36);
      for (let i = 0; i < 4; i++) burst(t + 0.02 + i * 0.045 + Math.random() * 0.02, 0.05, 'highpass', 1800, 0.7, 0.6 - i * 0.1);
      burst(t + 0.05, 0.9, 'bandpass', 3200, 0.8, 0.28, 5200);
    },
    // a hollow, woody knock
    stump: () => {
      const t = at();
      tone(t, 'sine', 210, 0.25, 0.8, 110);
      burst(t, 0.12, 'bandpass', 620, 2, 0.7);
      burst(t + 0.03, 0.4, 'bandpass', 2600, 1, 0.12);
    },
    // a stone kicked by the steel: tink, and gravel
    stone: () => {
      const t = at();
      tone(t, 'sine', 2300 + Math.random() * 500, 0.14, 0.32);
      tone(t, 'sine', 3400, 0.08, 0.14);
      burst(t + 0.01, 0.18, 'highpass', 2500, 0.8, 0.2);
    },
    // the trailer drops into a hole: a thud and a rattle
    pothole: () => {
      const t = at();
      tone(t, 'sine', 80, 0.32, 1, 40);
      for (let i = 0; i < 5; i++) burst(t + 0.03 + i * 0.035, 0.04, 'bandpass', 900, 2, 0.4 - i * 0.06);
    },
    rut: () => {
      const t = at();
      tone(t, 'sine', 70, 0.25, 0.8, 38);
      tone(t + 0.12, 'sine', 75, 0.22, 0.6, 40);
      burst(t, 0.3, 'bandpass', 700, 1.2, 0.25);
    },
    puddle: () => {
      const t = at();
      burst(t, 0.45, 'lowpass', 3500, 0.7, 0.75, 400);
      tone(t, 'sine', 70, 0.2, 0.5, 40);
      for (let i = 0; i < 4; i++) tone(t + 0.08 + i * 0.05, 'sine', 900 + Math.random() * 900, 0.07, 0.08);
    },
    rubble: () => {
      const t = at();
      tone(t, 'sine', 90, 0.22, 0.7, 40);
      for (let i = 0; i < 6; i++) tone(t + i * 0.03 + Math.random() * 0.02, 'sine', 1800 + Math.random() * 1600, 0.06, 0.16);
      burst(t, 0.3, 'highpass', 2000, 0.7, 0.2);
    },
    // a bag of maize thumps onto the road
    bag: () => {
      const t = at() + 0.15;
      tone(t, 'sine', 160, 0.2, 0.6, 70);
      burst(t, 0.15, 'lowpass', 900, 0.7, 0.35);
    },
    // two-tone horn
    horn: () => {
      const t = at();
      for (const f of [370, 466]) {
        tone(t, 'sawtooth', f, 0.42, 0.18, undefined, 0.02);
        tone(t, 'square', f * 1.003, 0.42, 0.06, undefined, 0.02);
      }
    },
    // into the farm gate: a short double toot
    arrive: () => {
      const t = at();
      for (const dt of [0, 0.2]) for (const f of [392, 494]) tone(t + dt, 'sawtooth', f, 0.14, 0.13, undefined, 0.01);
    },
    tick: () => {
      const t = at();
      tone(t, 'square', 1250, 0.05, 0.12);
    },
    whoosh: () => {
      const t = at();
      burst(t, 0.55, 'bandpass', 400, 1.2, 0.25, 2400);
    },
  };

  let rpmNow = 0;
  return {
    engine(rpm, load) {
      if (paused) return;
      const t = ac.currentTime;
      const r = Math.max(0, Math.min(1, rpm));
      // let the revs move like a real engine's: up quickly, down slowly
      rpmNow += (r - rpmNow) * (r > rpmNow ? 0.12 : 0.05);
      const f = 30 + rpmNow * 34;
      saw.frequency.setTargetAtTime(f, t, 0.05);
      sub.frequency.setTargetAtTime(f / 2, t, 0.05);
      lfo.frequency.setTargetAtTime(7 + rpmNow * 11, t, 0.05);
      lp.frequency.setTargetAtTime(320 + rpmNow * 900 + load * 300, t, 0.08);
      eng.gain.setTargetAtTime(0.24 + rpmNow * 0.2 + load * 0.08, t, 0.1);
      rumF.frequency.setTargetAtTime(110 + rpmNow * 120, t, 0.1);
      gritG.gain.setTargetAtTime(load * 0.05 + rpmNow * 0.015, t, 0.1);
    },
    cue(kind) {
      if (paused || level <= 0) return;
      resume();
      try {
        cues[kind]();
      } catch {
        /* no sound here: the game goes on */
      }
    },
    volume(v) {
      level = v;
      master.gain.setTargetAtTime(v, ac.currentTime, 0.05);
    },
    pause(on) {
      if (on === paused) return;
      paused = on;
      if (on) void ac.suspend().catch(() => undefined);
      else resume();
    },
    stop() {
      try {
        const t = ac.currentTime;
        master.gain.setTargetAtTime(0, t, 0.06);
        window.setTimeout(() => void ac.close().catch(() => undefined), 300);
      } catch {
        /* already closed */
      }
    },
  };
}
