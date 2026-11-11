/* Sound effects: two happy cues, made on the phone with the Web Audio API (nothing is downloaded).
   · action — a bright, bell-like double "ding" with a coin sparkle, for every completed action (a step done, a bed
     sown, an item bought, a check read right).
   · flow   — a short brassy fanfare that climbs to a held chord, with a drum hit and a sparkle tail, for every
     completed flow (the story told, the first session done, a season sold, a harvest in, a tractor job or a day
     of the tractor business finished).
   The feel follows the reward sounds of mobile base-building games: short, punchy, major key, metallic shimmer.
   Settings → Sound effects turns them off. */

export type SfxKind = 'action' | 'flow';

let on = true;
let ctx: AudioContext | null = null;
/** what played, newest last (the play-tests read it through window.__lima) */
export const sfxLog: SfxKind[] = [];

export const setSoundOn = (v: boolean) => {
  on = v;
};

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    ctx ??= new AC();
    return ctx;
  } catch {
    return null;
  }
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** One struck note: a few partials (a bell's are not whole multiples), a fast attack and an exponential ring-out. */
function bell(ac: BaseAudioContext, out: AudioNode, at: number, midi: number, len: number, gain: number) {
  const f = hz(midi);
  const partials: [number, number, OscillatorType][] = [
    [1, 1, 'triangle'],
    [2, 0.35, 'sine'],
    [2.76, 0.22, 'sine'],
    [5.4, 0.08, 'sine'],
  ];
  for (const [mul, g, type] of partials) {
    const o = ac.createOscillator();
    const v = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f * mul, at);
    v.gain.setValueAtTime(0.0001, at);
    v.gain.exponentialRampToValueAtTime(gain * g, at + 0.006);
    v.gain.exponentialRampToValueAtTime(0.0001, at + len / Math.sqrt(mul));
    o.connect(v).connect(out);
    o.start(at);
    o.stop(at + len + 0.05);
  }
}

/** A brassy note: two detuned saws through a filter that opens as it is blown, with a little vibrato. */
function brass(ac: BaseAudioContext, out: AudioNode, at: number, midi: number, len: number, gain: number) {
  const f = hz(midi);
  const lp = ac.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(f * 1.5, at);
  lp.frequency.exponentialRampToValueAtTime(f * 6, at + 0.06);
  lp.frequency.exponentialRampToValueAtTime(f * 3, at + len);
  const v = ac.createGain();
  v.gain.setValueAtTime(0.0001, at);
  v.gain.exponentialRampToValueAtTime(gain, at + 0.03);
  v.gain.setValueAtTime(gain, at + len * 0.7);
  v.gain.exponentialRampToValueAtTime(0.0001, at + len);
  lp.connect(v).connect(out);
  const lfo = ac.createOscillator();
  const depth = ac.createGain();
  lfo.frequency.value = 5.5;
  depth.gain.value = f * 0.006;
  lfo.connect(depth);
  for (const det of [-6, 6]) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f, at);
    o.detune.value = det;
    depth.connect(o.frequency);
    o.connect(lp);
    o.start(at);
    o.stop(at + len + 0.05);
  }
  lfo.start(at);
  lfo.stop(at + len + 0.05);
}

/** A soft drum hit: a sine that drops in pitch fast. */
function thump(ac: BaseAudioContext, out: AudioNode, at: number, gain: number) {
  const o = ac.createOscillator();
  const v = ac.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, at);
  o.frequency.exponentialRampToValueAtTime(45, at + 0.18);
  v.gain.setValueAtTime(gain, at);
  v.gain.exponentialRampToValueAtTime(0.0001, at + 0.25);
  o.connect(v).connect(out);
  o.start(at);
  o.stop(at + 0.3);
}

/** A quick run of tiny high bells: the sparkle on top. */
function sparkle(ac: BaseAudioContext, out: AudioNode, at: number, from: number, notes: number, gap: number, gain: number) {
  const scale = [0, 4, 7, 12, 16, 19, 24];
  for (let i = 0; i < notes; i++) bell(ac, out, at + i * gap, from + scale[i % scale.length], 0.25, gain * (1 - i / (notes + 2)));
}

function master(ac: BaseAudioContext, gain: number) {
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  const g = ac.createGain();
  g.gain.value = gain;
  g.connect(comp).connect(ac.destination);
  return g;
}

/** A completed action: ding-DING, with a coin sparkle. */
function drawAction(ac: BaseAudioContext) {
  const t = 0.01;
  const out = master(ac, 0.5);
  bell(ac, out, t, 88, 0.35, 0.5); // E6
  bell(ac, out, t + 0.085, 95, 0.6, 0.6); // B6
  sparkle(ac, out, t + 0.16, 100, 3, 0.04, 0.12);
}

/** A completed flow: a climbing fanfare, a held major chord, a drum hit and a sparkle tail. */
function drawFlow(ac: BaseAudioContext) {
  const t = 0.01;
  const out = master(ac, 0.42);
  thump(ac, out, t, 0.7);
  // G4 C5 E5 … then a held C major chord (C5 E5 G5 C6)
  [67, 72, 76].forEach((m, i) => brass(ac, out, t + i * 0.11, m, 0.16, 0.16));
  [72, 76, 79, 84].forEach(m => brass(ac, out, t + 0.36, m, 0.7, 0.11));
  thump(ac, out, t + 0.36, 0.55);
  bell(ac, out, t + 0.36, 96, 0.8, 0.35); // C7 on top of the chord
  sparkle(ac, out, t + 0.5, 96, 6, 0.05, 0.14);
}

/* Each cue is rendered once, off the main thread (an OfflineAudioContext), into a buffer; playing it is then a single
   buffer source, so a cue costs almost nothing while the 3D farm is drawing. The live context sleeps between cues. */
const LENGTH: Record<SfxKind, number> = { action: 0.8, flow: 1.6 };
const rendered: Partial<Record<SfxKind, Promise<AudioBuffer | null>>> = {};
function render(kind: SfxKind, rate: number): Promise<AudioBuffer | null> {
  const Off = typeof window !== 'undefined' ? (window.OfflineAudioContext ?? (window as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext) : undefined;
  if (!Off) return Promise.resolve(null);
  return (rendered[kind] ??= (async () => {
    try {
      const off = new Off(2, Math.ceil(LENGTH[kind] * rate), rate);
      if (kind === 'flow') drawFlow(off);
      else drawAction(off);
      return await off.startRendering();
    } catch {
      return null;
    }
  })());
}

let sleep: number | undefined;
async function play(kind: SfxKind) {
  sfxLog.push(kind);
  if (sfxLog.length > 50) sfxLog.shift();
  if (!on) return;
  const ac = audio();
  if (!ac) return;
  const buf = await render(kind, ac.sampleRate);
  if (!buf) return;
  try {
    window.clearTimeout(sleep);
    if (ac.state === 'suspended') await ac.resume();
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    src.start();
    // the audio thread rests once the cue has played
    sleep = window.setTimeout(() => void ac.suspend().catch(() => undefined), (buf.duration + 0.5) * 1000);
  } catch {
    /* no sound on this device: the game goes on */
  }
}

/** Render both cues ahead of time, so the first one plays without a wait. */
export function warmSfx() {
  const ac = audio();
  if (!ac) return;
  void render('action', ac.sampleRate);
  void render('flow', ac.sampleRate);
}

/** A short gap between cues, so one tap that finishes both an action and its flow plays only the bigger one. */
let lastAt = 0;
let lastKind: SfxKind | null = null;
function cue(kind: SfxKind) {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (now - lastAt < 250 && (lastKind === 'flow' || kind === lastKind)) return;
  lastAt = now;
  lastKind = kind;
  void play(kind);
}

export const sfx = {
  action: () => cue('action'),
  flow: () => cue('flow'),
};
