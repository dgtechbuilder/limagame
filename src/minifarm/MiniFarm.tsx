import { useEffect, useRef, useState, type Dispatch, type PointerEvent as RPointerEvent } from 'react';
import { NavBar, useNav } from '../components/Nav';
import { CloseX } from '../components/Success';
import { GoldButton } from '../components/ui';
import { track } from '../first/track';
import { sfx } from '../sfx';
import type { Action } from '../state';
import { CELL, MINI_FARM, THING_NAME, newMiniFarm, shareOf, stepMini, timeLeft, type MiniControls, type MiniFarm, type MiniResult, type ThingKind } from './sim';

/* The mini farm tractor game (rules in sim.ts): a small farm from above with five rocks, three trees and four holes.
   Plough the farm in 30 seconds. Opened from the main menu, address #/tractor-game.
   Nothing here is React state while the tractor drives: the frame loop steps the game, paints only the newly
   ploughed cells, and writes the clock and the share straight into the bar at the top. */

/** canvas pixels per game pixel: sharp on phones and when the stage is scaled up */
const K = 2;
/** where the farm sits on the 874 × 402 stage */
const FIELD = { left: Math.round((874 - MINI_FARM.w) / 2), top: 54 };

type Phase = 'brief' | 'play' | 'over';

export function TractorGamePage({ dispatch }: { dispatch: Dispatch<Action> }) {
  const [phase, setPhase] = useState<Phase>('brief');
  const [farm, setFarm] = useState<MiniFarm>(() => newMiniFarm(String(Date.now())));
  const [result, setResult] = useState<MiniResult | null>(null);
  const [best, setBest] = useState<number | null>(() => readBest());
  const close = () => dispatch({ type: 'close' });

  const start = (fresh: boolean) => {
    if (fresh) setFarm(newMiniFarm(String(Date.now())));
    setResult(null);
    setPhase('play');
    track('minifarm_start', {});
  };
  const finish = (r: MiniResult) => {
    setResult(r);
    setPhase('over');
    track('minifarm_done', { outcome: r.outcome, share: Math.round(r.share * 100), left: r.left, bumps: r.bumps, stars: r.stars });
    if (r.outcome === 'win') {
      sfx.flow();
      if (best === null || r.left > best) {
        setBest(r.left);
        writeBest(r.left);
      }
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('.mg')) close();
      if (e.key === 'Enter' && phase !== 'play') start(phase === 'over');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="abs mf" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Tractor game: the mini farm">
      <p className="mf-title">
        <span aria-hidden="true">🚜</span> Tractor game · <b>Mini farm</b>
      </p>
      <Board farm={farm} playing={phase === 'play'} onDone={finish} />
      {phase === 'brief' && (
        <div className="mf-card" role="group" aria-label="How to play">
          <h2>Plough the mini farm in 30 seconds</h2>
          <p>
            Tap and hold where the tractor should go (or steer with the arrow keys). Plough <b>{Math.round(MINI_FARM.goal * 100)}%</b> of the land before the clock runs out.
          </p>
          <ul className="mf-legend">
            <li>
              <Swatch kind="rock" /> <b>{MINI_FARM.count.rock} rocks</b> · a knock costs {MINI_FARM.bumpCost} s
            </li>
            <li>
              <Swatch kind="tree" /> <b>{MINI_FARM.count.tree} trees</b> · a knock costs {MINI_FARM.bumpCost} s
            </li>
            <li>
              <Swatch kind="hole" /> <b>{MINI_FARM.count.hole} holes</b> · the tractor gets stuck: game over
            </li>
          </ul>
          <GoldButton font={13} height={34} style={{ width: 200 }} onClick={() => start(false)}>
            Start
          </GoldButton>
        </div>
      )}
      {phase === 'over' && result && <ResultCard r={result} best={best} onAgain={() => start(true)} onClose={close} />}
      <NavBar horizontal onBack={close} style={{ right: 62, top: 8 }} />
      <CloseX className="page-x" onClick={close} />
    </div>
  );
}

function ResultCard({ r, best, onAgain, onClose }: { r: MiniResult; best: number | null; onAgain: () => void; onClose: () => void }) {
  const pct = Math.round(r.share * 100);
  const head = r.outcome === 'win' ? 'Farm ploughed!' : r.outcome === 'hole' ? 'Stuck in a hole!' : 'Time’s up!';
  const line =
    r.outcome === 'win'
      ? `${pct}% ploughed with ${r.left.toFixed(1)} s to spare${r.bumps ? `, ${r.bumps} knock${r.bumps === 1 ? '' : 's'}` : ', not one knock'}.`
      : r.outcome === 'hole'
        ? `The tractor drove into a hole with ${pct}% ploughed. Steer round the holes: they end the game.`
        : `${pct}% ploughed of the ${Math.round(MINI_FARM.goal * 100)}% needed${r.bumps ? `; ${r.bumps} knock${r.bumps === 1 ? '' : 's'} cost ${r.bumps * MINI_FARM.bumpCost} s` : ''}. Drive in long, straight rows.`;
  return (
    <div className={`mf-card is-${r.outcome}`} role="alertdialog" aria-label={head}>
      <h2>{head}</h2>
      <p className="mf-stars" aria-label={`${r.stars} of 3 stars`}>
        {[1, 2, 3].map(i => (
          <span key={i} className={i <= r.stars ? 'is-on' : ''} aria-hidden="true">
            ★
          </span>
        ))}
      </p>
      <p>{line}</p>
      {best !== null && <p className="mf-best">Best: {best.toFixed(1)} s to spare</p>}
      <div className="mf-row">
        <GoldButton font={12} height={32} style={{ width: 160 }} onClick={onAgain}>
          Play again
        </GoldButton>
        <GoldButton font={12} height={32} style={{ width: 160 }} onClick={onClose}>
          Done
        </GoldButton>
      </div>
    </div>
  );
}

/** The farm on a canvas, and the bar with the clock above it. */
function Board({ farm, playing, onDone }: { farm: MiniFarm; playing: boolean; onDone: (r: MiniResult) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const ctl = useRef<MiniControls>({ target: null, hold: false, keys: {} });
  const clock = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const share = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const note = useRef<HTMLSpanElement>(null);
  const done = useRef(onDone);
  done.current = onDone;
  const nav = useNav();
  const menuOpen = useRef(false);
  menuOpen.current = nav.menuOpen;

  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const L = makeLayers(farm);
    // the play-tests reach the farm being played (?dev only)
    if ('__lima' in window) (window as unknown as { __limaMini?: MiniFarm }).__limaMini = farm;
    let raf = 0;
    let last = performance.now();
    let noteUntil = 0;
    // (the board is drawn again when the game ends: a tractor already in a hole stays down)
    let fallAt = farm.fell ? -1e9 : 0;
    let finished = false;
    // a note from the last game does not stay over the card
    if (!playing && note.current) note.current.textContent = '';
    const say = (text: string, now: number, ms = 1400) => {
      if (note.current) note.current.textContent = text;
      noteUntil = now + ms;
    };
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (playing && !menuOpen.current && !farm.done) {
        const ev = stepMini(farm, dt, ctl.current);
        if (ev?.kind === 'bump') say(`You hit ${THING_NAME[ev.thing]}! −${MINI_FARM.bumpCost} s`, now);
        if (ev?.kind === 'hole') {
          say('Into a hole!', now, 99999);
          fallAt = now;
        }
      }
      const fall = fallAt ? Math.min(1, (now - fallAt) / 700) : 0;
      draw(cv, farm, L, ctl.current, fall);
      const left = timeLeft(farm);
      if (clock.current) clock.current.textContent = `${left.toFixed(1)} s`;
      if (bar.current) {
        bar.current.style.width = `${(left / MINI_FARM.secs) * 100}%`;
        bar.current.classList.toggle('is-low', left < 8);
      }
      const p = shareOf(farm);
      if (share.current) share.current.textContent = `${Math.round(p * 100)}% of ${Math.round(MINI_FARM.goal * 100)}% ploughed`;
      if (fill.current) fill.current.style.width = `${Math.min(100, (p / MINI_FARM.goal) * 100)}%`;
      if (noteUntil && now > noteUntil && note.current) {
        note.current.textContent = '';
        noteUntil = 0;
      }
      if (farm.done && !finished) {
        finished = true;
        const r = farm.done;
        if (r.outcome === 'win') say('The farm is ploughed!', now, 99999);
        if (r.outcome === 'time') say('Time!', now, 99999);
        window.setTimeout(() => done.current(r), r.outcome === 'hole' ? 1000 : 700);
      }
      if (!finished || fall < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const map: Record<string, keyof MiniControls['keys']> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
    const onKey = (e: KeyboardEvent) => {
      const k = map[e.key.toLowerCase()];
      if (!k || !playing) return;
      e.preventDefault();
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
  }, [farm, playing]);

  const point = (e: RPointerEvent<HTMLCanvasElement>, down: boolean) => {
    if (!playing) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * farm.w;
    const y = ((e.clientY - r.top) / r.height) * farm.h;
    ctl.current.target = [Math.max(6, Math.min(farm.w - 6, x)), Math.max(6, Math.min(farm.h - 6, y))];
    ctl.current.hold = true;
    if (down) ctl.current.keys = {};
  };

  return (
    <>
      <div className="mf-hud" style={{ left: FIELD.left, width: MINI_FARM.w }}>
        <span className="mf-clock" ref={clock} aria-label="Time left">
          {MINI_FARM.secs.toFixed(1)} s
        </span>
        <span className="mf-bar" aria-hidden="true">
          <span ref={bar} />
        </span>
        <span className="mf-goal" aria-hidden="true">
          <span ref={fill} />
        </span>
        <span className="mf-share" ref={share}>
          0% of {Math.round(MINI_FARM.goal * 100)}% ploughed
        </span>
        <span className="mf-note" ref={note} role="status" />
      </div>
      <canvas
        ref={canvas}
        className={`mf-canvas${playing ? ' is-on' : ''}`}
        width={MINI_FARM.w * K}
        height={MINI_FARM.h * K}
        style={{ left: FIELD.left, top: FIELD.top, width: MINI_FARM.w, height: MINI_FARM.h }}
        aria-label="The mini farm from above: tap and hold where the tractor should go, or steer with the arrow keys"
        onPointerDown={e => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          point(e, true);
        }}
        onPointerMove={e => ctl.current.hold && point(e, false)}
        onPointerUp={() => (ctl.current.hold = false)}
        onPointerCancel={() => (ctl.current.hold = false)}
      />
      <p className="mf-tip" style={{ top: FIELD.top + MINI_FARM.h + 6 }}>
        Plough {Math.round(MINI_FARM.goal * 100)}% in {MINI_FARM.secs} seconds · rocks and trees cost {MINI_FARM.bumpCost} s · a hole ends the game
      </p>
    </>
  );
}

/* ---------------- the best time, kept on this phone ---------------- */

const BEST_KEY = 'lima.minifarm.best';
function readBest(): number | null {
  try {
    const v = window.localStorage.getItem(BEST_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function writeBest(v: number) {
  try {
    window.localStorage.setItem(BEST_KEY, String(v));
  } catch {
    /* storage blocked: the best is kept for this visit only */
  }
}

/* ---------------- drawing ---------------- */

const SOIL = { bg: '#b89468', grain: '#a8845a', worked: '#6d4426', ridge: '#5a361c' };

function Swatch({ kind }: { kind: ThingKind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext('2d');
    if (!c) return;
    c.setTransform(K, 0, 0, K, 0, 0);
    c.fillStyle = SOIL.bg;
    c.beginPath();
    c.roundRect(0, 0, 30, 30, 6);
    c.fill();
    drawThing(c, { x: 15, y: 15, r: kind === 'tree' ? 11 : 10, kind });
  }, [kind]);
  return <canvas ref={ref} className="mf-swatch" width={30 * K} height={30 * K} aria-hidden="true" />;
}

function makeLayers(d: MiniFarm) {
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
  c.fillStyle = SOIL.bg;
  c.fillRect(0, 0, d.w, d.h);
  // a little grain, the same every time
  let h = 11;
  c.fillStyle = SOIL.grain;
  for (let i = 0; i < 420; i++) {
    h = (h * 48271) % 2147483647;
    const x = (h % 1000) / 1000;
    h = (h * 48271) % 2147483647;
    const y = (h % 1000) / 1000;
    c.fillRect(Math.floor(x * d.w), Math.floor(y * d.h), 3, 1.5);
  }
  // the gate the tractor comes in at
  c.fillStyle = 'rgba(255,255,255,0.18)';
  c.fillRect(0, d.h - 44, 6, 44);
  // the holes first (they sit in the ground), then rocks and trees
  for (const t of d.things.filter(t => t.kind === 'hole')) drawThing(c, t);
  // anything already ploughed (the board is drawn again when the game ends)
  d.fresh = [];
  d.cell.forEach((v, i) => v === 1 && d.fresh.push(i));
  return { bg, work, things: d.things.filter(t => t.kind !== 'hole') };
}

function drawThing(c: CanvasRenderingContext2D, t: { x: number; y: number; r: number; kind: ThingKind }) {
  const { r } = t;
  c.save();
  c.translate(t.x, t.y);
  if (t.kind === 'tree') {
    c.fillStyle = 'rgba(0,0,0,0.22)';
    c.beginPath();
    c.ellipse(4, 5, r + 2, r - 1, 0, 0, 7);
    c.fill();
    c.fillStyle = '#5a3a1e';
    c.fillRect(-2, -2, 4, 6);
    c.fillStyle = '#2f7a34';
    c.beginPath();
    c.arc(0, 0, r, 0, 7);
    c.fill();
    c.fillStyle = '#46993f';
    c.beginPath();
    c.arc(-r * 0.25, -r * 0.25, r * 0.7, 0, 7);
    c.fill();
    c.fillStyle = '#6cbf55';
    c.beginPath();
    c.arc(-r * 0.4, -r * 0.4, r * 0.32, 0, 7);
    c.fill();
  } else if (t.kind === 'rock') {
    c.fillStyle = 'rgba(0,0,0,0.2)';
    c.beginPath();
    c.ellipse(2, 3, r, r * 0.8, 0.4, 0, 7);
    c.fill();
    c.fillStyle = '#6f6f6f';
    c.beginPath();
    c.ellipse(0, 0, r, r * 0.8, 0.4, 0, 7);
    c.fill();
    c.fillStyle = '#9a9a9a';
    c.beginPath();
    c.ellipse(-r * 0.2, -r * 0.2, r * 0.55, r * 0.4, 0.4, 0, 7);
    c.fill();
  } else {
    // a hole: a dark pit with a raised lip of dug-out soil
    c.fillStyle = '#8a6440';
    c.beginPath();
    c.ellipse(0, 0, r + 3, r * 0.85 + 3, 0, 0, 7);
    c.fill();
    c.fillStyle = '#2a1a0c';
    c.beginPath();
    c.ellipse(0, 0, r, r * 0.85, 0, 0, 7);
    c.fill();
    c.fillStyle = '#120a04';
    c.beginPath();
    c.ellipse(1, 2, r * 0.6, r * 0.45, 0, 0, 7);
    c.fill();
  }
  c.restore();
}

function draw(cv: HTMLCanvasElement, d: MiniFarm, L: ReturnType<typeof makeLayers>, ctl: MiniControls, fall: number) {
  const c = cv.getContext('2d')!;
  if (d.fresh.length) {
    const w = L.work.getContext('2d')!;
    w.setTransform(K, 0, 0, K, 0, 0);
    for (const i of d.fresh) {
      const gx = i % d.gw;
      const gy = Math.floor(i / d.gw);
      // furrows: every other row of cells a shade darker
      w.fillStyle = gy % 2 ? SOIL.ridge : SOIL.worked;
      w.fillRect(gx * CELL, gy * CELL, CELL, CELL);
    }
    d.fresh = [];
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.drawImage(L.bg, 0, 0);
  c.drawImage(L.work, 0, 0);
  c.setTransform(K, 0, 0, K, 0, 0);
  for (const t of L.things) drawThing(c, t);
  if (ctl.target && ctl.hold && !d.done) {
    c.strokeStyle = '#fff';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(ctl.target[0], ctl.target[1], 7, 0, 7);
    c.stroke();
  }
  // the tractor shakes for a moment after a knock, and sinks into a hole it drove into
  const shake = d.bumpCd > 0.5 ? Math.sin(d.t * 80) * 2 : 0;
  const x = d.fell ? d.x + (d.fell.x - d.x) * fall : d.x + shake;
  const y = d.fell ? d.y + (d.fell.y - d.y) * fall : d.y;
  drawTractor(c, x, y, d.hdg + (d.fell ? fall * 1.6 : 0), 1 - fall * 0.65, d.fell ? 1 - fall * 0.5 : 1);
}

function drawTractor(c: CanvasRenderingContext2D, x: number, y: number, hdg: number, s: number, alpha: number) {
  c.save();
  c.globalAlpha = alpha;
  c.translate(x, y);
  c.rotate(hdg);
  c.scale(s, s);
  const hw = MINI_FARM.swath / 2;
  // the hitch and the plough behind
  c.strokeStyle = '#444';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(-8, 0);
  c.lineTo(-15, 0);
  c.stroke();
  c.fillStyle = '#6b6f73';
  c.fillRect(-18, -hw, 6, hw * 2);
  c.fillStyle = '#4a4e52';
  for (let o = -hw + 2; o < hw; o += 5) c.fillRect(-19, o, 2, 2.5);
  // wheels, body, cab, lights
  c.fillStyle = '#1f1f1f';
  c.fillRect(-10, -13, 11, 5);
  c.fillRect(-10, 8, 11, 5);
  c.fillRect(6, -10, 7, 3.5);
  c.fillRect(6, 6.5, 7, 3.5);
  c.fillStyle = '#d6402b';
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
