import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { fmt } from '../components/ui';
import { money } from '../money';
import { SPEAKER } from '../care/voice';
import { track } from '../first/track';
import { farmName } from '../trials/model';
import { NavBar, useNav } from '../components/Nav';
import { CloseX } from '../components/Success';
import { FARM_ACRES, IMPL, IMPL_ORDER, MONEY, OBS_NAME, TRACTORS, TRACTOR_BONUS, TRACTOR_EDGE, TRACTOR_REWARD, type ImplId, type MoneyFigure, type TractorKind } from './data';
import { CELL, FH, FW, GW, createJob, finishJob, pct, rewardFor, setupJob, stepJob, tankOf, type Controls, type Job, type JobResult } from './sim';

/* From Wakala Agent: the tractor drive before planting. Brief → tractor → implement → ready → drive → summary,
   on Lima's 874 × 402 stage. The drive is drawn on a canvas; the rules are in sim.ts and the numbers in data.ts. */

type Phase = 'brief' | 'tractor' | 'implement' | 'ready' | 'drive' | 'done';
const STEPS: [Phase, string][] = [
  ['brief', 'Brief'],
  ['tractor', 'Tractor'],
  ['implement', 'Implement'],
  ['ready', 'Ready'],
  ['drive', 'Drive'],
  ['done', 'Summary'],
];

/** canvas pixels per game pixel: sharp on phones and when the stage is scaled up */
const K = 2;

/** shillings on screen: 10 times the stored value (src/money.ts), rounded to the nearest 100 */
const ksh = (n: number) => `KSh ${money(Math.abs(Math.round(n / 10) * 10))}`;
const acresText = `a sixth of an acre`;

export interface TractorProps {
  farm: number;
  cycle: number;
  /** the farm's best drive this cycle, if any */
  best: { stars: number; score: number } | null;
  name: string;
  /** design review: open on the summary of an autopilot drive */
  demo?: 'summary';
  onFinish: (r: { score: number; stars: number; Q: number; coins: number; points: number; diesel: number; co2: number; clim: number }) => void;
  onClose: () => void;
}

export function Tractor({ farm, cycle, best, name, demo, onFinish, onClose }: TractorProps) {
  const [job, setJob] = useState<Job>(() => createJob(farm));
  const [phase, setPhase] = useState<Phase>('brief');
  const [tractor, setTractor] = useState<TractorKind['id'] | null>(null);
  const [impl, setImpl] = useState<ImplId | null>(null);
  const [checks, setChecks] = useState<string[]>([]);
  const [fast, setFast] = useState(false);
  const [auto, setAuto] = useState(false);
  const [stats, setStats] = useState({ cov: 0, left: 0, fuel: 0, over: 0, hits: 0, acr: -1 });
  const [msg, setMsg] = useState<{ text: string; id: number } | null>(null);
  const [result, setResult] = useState<{ r: JobResult; coins: number; points: number; bonus: number } | null>(null);
  const [sources, setSources] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const layers = useRef<{ bg: HTMLCanvasElement; work: HTMLCanvasElement } | null>(null);
  const ctl = useRef<Controls>({ target: null, hold: false, keys: {}, fast: false, auto: false });
  const bestRef = useRef(best);
  bestRef.current = best;
  // the main menu is open on top of a drive: the clock waits
  const nav = useNav();
  const menuOpen = useRef(false);
  menuOpen.current = nav.menuOpen;
  const lay = job.lay;
  const tr = tractor ? TRACTORS.find(x => x.id === tractor)! : null;
  const right = IMPL[job.right];
  const title = `Before planting · ${farmName(farm)}`;

  useEffect(() => {
    if (!msg) return;
    const id = window.setTimeout(() => setMsg(null), 2400);
    return () => window.clearTimeout(id);
  }, [msg]);

  /* ---------------- drawing ---------------- */

  const draw = () => {
    const cv = canvas.current;
    if (!cv) return;
    if (!layers.current) layers.current = makeLayers(job);
    const L = layers.current;
    if (job.fresh.length) {
      const c = L.work.getContext('2d')!;
      c.setTransform(K, 0, 0, K, 0, 0);
      for (const i of job.fresh) paintCell(c, job, i);
      job.fresh = [];
    }
    const c = cv.getContext('2d')!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(L.bg, 0, 0);
    c.drawImage(L.work, 0, 0);
    c.setTransform(K, 0, 0, K, 0, 0);
    if (job.wOrder && waterShown.current > 0) {
      c.fillStyle = '#3f8fc8';
      for (let n = 0; n < Math.min(job.wOrder.length, waterShown.current); n++) {
        const i = job.wOrder[n];
        c.fillRect((i % GW) * CELL, Math.floor(i / GW) * CELL, CELL, CELL);
      }
    }
    const C = ctl.current;
    if (C.auto && phase === 'drive') {
      c.strokeStyle = 'rgba(255,255,255,.7)';
      c.lineWidth = 1.3;
      c.setLineDash([3, 5]);
      c.beginPath();
      job.wps.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
      c.stroke();
      c.setLineDash([]);
    }
    if (C.target && !C.auto && phase === 'drive') {
      c.strokeStyle = '#fff';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(C.target[0], C.target[1], 7, 0, 7);
      c.stroke();
    }
    if (phase === 'drive' || phase === 'done' || impl) drawTractor(c, job, tr ?? TRACTORS[1], impl ?? job.right);
  };
  const waterShown = useRef(0);

  // the first picture, and again whenever the choices change
  useEffect(() => {
    draw();
  });

  /* ---------------- the drive ---------------- */

  useEffect(() => {
    if (phase !== 'drive') return;
    let raf = 0;
    let last = performance.now();
    let statT = 0;
    const frame = (now: number) => {
      if (menuOpen.current) {
        last = now;
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const C = ctl.current;
      // a tap target reached: forget it unless the finger is still down
      if (C.target && !C.hold && Math.hypot(C.target[0] - job.x, C.target[1] - job.y) < 7) C.target = null;
      for (const e of stepJob(job, dt, C)) if (e.hit) setMsg({ text: `You hit ${OBS_NAME[e.hit]}! Steer around it.`, id: now });
      draw();
      statT += dt;
      if (statT > 0.12 || job.done) {
        statT = 0;
        setStats({
          cov: (job.covT / Math.max(1, job.nT)) * 100,
          left: Math.max(0, job.limit - job.t),
          fuel: job.fuelL,
          over: pct((job.ovT + job.waste * (job.strips ? 0.25 : 0)) / Math.max(1, job.covT)),
          hits: job.hits,
          acr: lay.slope && !job.strips && job.covT ? pct(job.acr / job.covT) : -1,
        });
      }
      if (job.done) return finished(job, job.done);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const key = (e: KeyboardEvent) => {
      const map: Record<string, keyof Controls['keys']> = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
      const k = map[e.key.toLowerCase()];
      if (!k) return;
      e.preventDefault();
      e.stopPropagation();
      ctl.current.keys = { ...ctl.current.keys, [k]: e.type === 'keydown' };
      if (e.type === 'keydown') ctl.current.target = null;
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, job]);

  // each drive finishes once (the Finish button and the frame loop can both see it end)
  const settled = useRef<Job | null>(null);
  function finished(j: Job, r: JobResult, quiet = false) {
    if (settled.current === j) return;
    settled.current = j;
    const pay = rewardFor(r, bestRef.current);
    setResult({ r, ...pay });
    setPhase('done');
    ctl.current = { target: null, hold: false, keys: {}, fast: false, auto: false };
    if (!quiet) {
      track('tractor_done', {
        farm,
        cycle,
        stage: 'prep',
        tractor: tr?.id,
        implement: impl,
        right: impl === j.right,
        score: r.score,
        stars: r.stars,
        job: pct(r.Q),
        cov: pct(r.cov),
        eff: r.eff,
        clim: r.clim,
        money: r.money,
        saved: Math.round(r.saved),
        hits: r.hits,
        secs: r.secs,
        auto: r.usedAuto,
        reason: r.reason,
      });
      onFinish({ score: r.score, stars: r.stars, Q: r.Q, coins: pay.coins, points: pay.points, diesel: r.usedL, co2: r.co2, clim: r.clim });
    }
    // furrows: show the water running down them
    const wet = j.wOrder;
    if (wet?.length) {
      const t0 = performance.now();
      const go = (now: number) => {
        waterShown.current = Math.round(((now - t0) / 1400) * wet.length);
        draw();
        if (waterShown.current < wet.length) requestAnimationFrame(go);
      };
      requestAnimationFrame(go);
    }
  }

  // design review: an autopilot drive with the right implement, straight to the summary
  useEffect(() => {
    if (demo !== 'summary') return;
    const j = createJob(farm);
    setupJob(j, 'compact', j.right);
    for (let n = 0; n < 60 * 600 && !j.done; n++) stepJob(j, 1 / 60, { target: null, hold: false, keys: {}, fast: false, auto: true });
    layers.current = null;
    setJob(j);
    setTractor('compact');
    setImpl(j.right);
    setChecks(['hitch', 'fuel']);
    finished(j, j.done ?? finishJob(j, 'done'), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = () => {
    if (!tractor || !impl) return;
    setupJob(job, tractor, impl);
    settled.current = null;
    layers.current = null;
    waterShown.current = 0;
    ctl.current = { target: null, hold: false, keys: {}, fast, auto };
    setResult(null);
    setPhase('drive');
  };

  const retry = () => {
    const j = createJob(farm);
    layers.current = null;
    waterShown.current = 0;
    setJob(j);
    setResult(null);
    setChecks([]);
    setAuto(false);
    setPhase('ready');
  };

  const point = (e: RPointerEvent<HTMLCanvasElement>, down: boolean) => {
    if (phase !== 'drive' || ctl.current.auto) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * FW;
    const y = ((e.clientY - r.top) / r.height) * FH;
    ctl.current.target = [Math.max(12, Math.min(FW - 12, x)), Math.max(12, Math.min(FH - 12, y))];
    if (down) ctl.current.hold = true;
  };

  /* ---------------- the side panel ---------------- */

  // Back goes one step back: the brief and the summary leave; the drive itself has no Back (Farm leaves it)
  const back = phase === 'drive' ? undefined : phase === 'tractor' ? () => setPhase('brief') : phase === 'implement' ? () => setPhase('tractor') : phase === 'ready' ? () => setPhase('implement') : onClose;
  const at = STEPS.findIndex(s => s[0] === phase);
  const steps = (
    <div className="tc-steps" aria-label="Steps">
      {STEPS.map(([p, label], i) => (
        <span key={p} className={i < at ? 'is-done' : i === at ? 'is-now' : ''} title={label}>
          {i + 1}
        </span>
      ))}
      <b>{STEPS[at][1]}</b>
    </div>
  );

  let side: ReactNode;
  let over: ReactNode = null;
  if (phase === 'brief') {
    side = (
      <>
        <p className="voice-bubble is-panel">
          <b>{SPEAKER.name}:</b> {lay.prep.ask}
        </p>
        <ul className="tc-info">
          <li>
            <b>Your task:</b> {lay.prep.task}.
          </li>
          <li>Time limit: {job.limit} seconds</li>
          <li>Field: {acresText}, with rocks and fallen trunks</li>
          <li>You choose the tractor and the implement. The wrong one does a poor job.</li>
          <li>
            A tractor works {TRACTOR_EDGE}× the ground of a farmer on foot, and earns +{TRACTOR_BONUS.perDrive} bonus points.
          </li>
        </ul>
        <div className="tc-row">
          <button type="button" className="tc-btn is-soft" onClick={onClose}>
            Back
          </button>
          <button type="button" className="tc-btn" onClick={() => setPhase('tractor')}>
            Choose a tractor
          </button>
        </div>
      </>
    );
  } else if (phase === 'tractor' || phase === 'implement') {
    side = (
      <>
        <ul className="tc-info">
          <li>
            <b>Before planting:</b> {lay.prep.task}.
          </li>
          <li>
            {job.limit} seconds · {acresText}
          </li>
          <li>
            Tractor: <b>{tr ? tr.name : 'not chosen'}</b>
          </li>
          <li>
            Implement: <b>{impl ? IMPL[impl].name : 'not chosen'}</b>
          </li>
        </ul>
        {phase === 'tractor' ? (
          <button type="button" className="tc-btn" disabled={!tractor} onClick={() => setPhase('implement')}>
            {tractor ? 'Next: the implement' : 'Pick a tractor first'}
          </button>
        ) : (
          <div className="tc-row">
            <button type="button" className="tc-btn is-soft" onClick={() => setPhase('tractor')}>
              Back
            </button>
            <button
              type="button"
              className="tc-btn"
              disabled={!impl}
              onClick={() => {
                track('tractor_pick', { farm, tractor, implement: impl, right: impl === job.right });
                setPhase('ready');
              }}
            >
              {impl ? 'Next: get ready' : 'Pick an implement'}
            </button>
          </div>
        )}
      </>
    );
    over =
      phase === 'tractor' ? (
        <div className="tc-choose">
          <p className="tc-ask">Which tractor suits a field of {acresText}?</p>
          <div className="tc-cards is-three">
            {TRACTORS.map(t => (
              <button type="button" key={t.id} className={`tc-card${tractor === t.id ? ' is-on' : ''}`} aria-pressed={tractor === t.id} onClick={() => setTractor(t.id)}>
                <TractorIcon kind={t} />
                <b>
                  {t.name} · {t.hp} hp
                </b>
                {Object.entries(t.meters).map(([k, v]) => (
                  <span className="tc-meter" key={k}>
                    <span>{k}</span>
                    <i aria-label={`${v} of 5`}>
                      {[1, 2, 3, 4, 5].map(n => (
                        <i key={n} className={n <= v ? 'is-on' : ''} />
                      ))}
                    </i>
                  </span>
                ))}
                <em>{t.note}</em>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="tc-choose">
          <p className="tc-ask">Which implement does this job?</p>
          <div className="tc-cards is-four">
            {IMPL_ORDER.map(k => (
              <button type="button" key={k} className={`tc-card is-small${impl === k ? ' is-on' : ''}`} aria-pressed={impl === k} onClick={() => setImpl(k)}>
                <ImplIcon k={k} />
                <b>{IMPL[k].name}</b>
                <em>{IMPL[k].does}</em>
              </button>
            ))}
          </div>
        </div>
      );
  } else if (phase === 'ready') {
    const all = ['hitch', 'fuel'].every(k => checks.includes(k));
    const tick = (k: string) => setChecks(v => (v.includes(k) ? v : [...v, k]));
    side = (
      <>
        <ul className="tc-info">
          <li>
            <b>{tr?.name}</b> tractor with a <b>{impl ? IMPL[impl].name.toLowerCase() : ''}</b>
          </li>
        </ul>
        <div className="care-opts is-panel">
          {[
            ['hitch', `Hitch the ${impl ? IMPL[impl].name.toLowerCase() : 'implement'}`],
            ['fuel', `Fill up with ${tankOf(job, tr).toFixed(1)} L of diesel`],
          ].map(([k, label]) => (
            <button type="button" key={k} className={`care-opt${checks.includes(k) ? ' is-right' : ''}`} aria-pressed={checks.includes(k)} onClick={() => tick(k)}>
              <span className="care-mark" aria-hidden="true">
                {checks.includes(k) ? '✓' : ''}
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <ul className="tc-info is-tips">
          <li>
            <b>How to drive:</b> tap where to go and hold to keep steering, or use the arrow keys.
          </li>
          <li>Steer around rocks and trunks. Drive in straight rows and don't cover the same ground twice.</li>
        </ul>
        <button type="button" className="tc-btn" disabled={!all} onClick={start}>
          {all ? `Start the engine · ${job.limit}s` : 'Tick both first'}
        </button>
      </>
    );
  } else if (phase === 'drive') {
    const left = stats.left;
    side = (
      <>
        <p className="tc-note">{auto ? `Autopilot is driving (up to ${TRACTOR_REWARD.autopilotStars} stars). Tap Autopilot to take over.` : 'Tap where to drive. Hold to keep steering.'}</p>
        <Stat label="Done" value={`${Math.round(stats.cov)}%`} bar={stats.cov} />
        <Stat label="Time left" value={`${Math.floor(left / 60)}:${String(Math.ceil(left) % 60).padStart(2, '0')}`} bar={(left / job.limit) * 100} low={left < job.limit * 0.2} kind="time" />
        <Stat label="Fuel" value={`${stats.fuel.toFixed(2)} L`} bar={(stats.fuel / Math.max(0.01, job.tankL)) * 100} kind="fuel" />
        <Stat label="Overlap" value={`${stats.over}%`} />
        <Stat label="Hits" value={String(stats.hits)} />
        {lay.slope && !job.strips && <Stat label="Across the slope" value={stats.acr >= 0 ? `${stats.acr}%` : '–'} />}
        <div className="tc-row">
          <button type="button" className={`tc-seg${fast ? '' : ' is-on'}`} aria-pressed={!fast} onClick={() => ((ctl.current.fast = false), setFast(false))}>
            Slow
          </button>
          <button type="button" className={`tc-seg${fast ? ' is-on' : ''}`} aria-pressed={fast} onClick={() => ((ctl.current.fast = true), setFast(true))}>
            Fast
          </button>
          <button
            type="button"
            className={`tc-seg${auto ? ' is-on' : ''}`}
            aria-pressed={auto}
            onClick={() => {
              ctl.current.auto = !auto;
              ctl.current.target = null;
              setAuto(!auto);
            }}
          >
            Autopilot
          </button>
        </div>
        <button type="button" className="tc-btn" onClick={() => finished(job, finishJob(job, 'done'))}>
          Finish the job
        </button>
      </>
    );
  } else {
    const res = result!;
    const r = res.r;
    const wrong = impl !== job.right;
    const why = r.reason === 'fuel' ? 'The fuel ran out. ' : r.reason === 'time' ? 'Time ran out. ' : '';
    const said =
      wrong && job.fit === 0
        ? `A ${impl ? IMPL[impl].name.toLowerCase() : 'that'}? That didn't do the job, ${name}.`
        : r.stars === 3
          ? `Perfect work, ${name}!`
          : r.stars === 2
            ? 'Good job. A few gaps, but it will do.'
            : r.stars === 1
              ? 'It will do, but there is a lot left undone.'
              : 'That did not go well. We can try again.';
    const est = right.hire.estimate || right.manual.estimate;
    side = (
      <>
        <div className="tc-score">
          <span className="tc-stars" aria-label={`${r.stars} of 3 stars`}>
            {[0, 1, 2].map(i => (
              <i key={i} className={i < r.stars ? 'is-on' : ''}>
                ★
              </i>
            ))}
          </span>
          <b>
            {r.score}
            <small>/100</small>
          </b>
          <span className="tc-earn">
            <img src={img.coin} alt="" width={12} height={12} />+{money(res.coins)}
            {res.points > 0 && (
              <>
                <img src={img.star} alt="" width={12} height={12} />+{res.points}
              </>
            )}
          </span>
        </div>
        <p className="voice-bubble is-panel is-small">
          <b>{SPEAKER.name}:</b> {why}
          {said}
        </p>
        <p className="tc-bonus">
          {res.bonus > 0 && <b>Tractor bonus +{res.bonus} · </b>}
          {TRACTOR_EDGE}× faster than walking
        </p>
        <Bar label="Job done" v={pct(r.Q)} note={`${pct(r.cov)}% covered${wrong ? ' · wrong implement' : ''}${r.hits ? ` · ${r.hits} hit${r.hits > 1 ? 's' : ''}` : ''}`} />
        <Bar label="Efficiency" v={r.eff} note={`${r.secs}s of ${job.limit}s · overlap ${pct(r.over)}%`} />
        <Bar label="Climate" v={r.clim} note={`${r.usedL.toFixed(2)} L diesel · ${r.co2.toFixed(1)} kg CO₂${(tr?.soil ?? 0) >= 15 ? ' · heavy tractor' : ''}`} />
        <Bar label="Cost saving" v={r.money} note={r.saved >= 0 ? `${ksh(r.saved)} saved vs. by hand` : `${ksh(r.saved)} more than by hand`} />
        <p className="tc-ksh">
          Real-world shillings{est ? ' (estimate)' : ''}: by hand, {Math.max(0, Math.round(r.days * 10) / 10)} person-days ({ksh(r.manual)}); by tractor, {ksh(r.tractor)}.{' '}
          <button type="button" className="tc-link" onClick={() => setSources(true)}>
            Sources
          </button>
        </p>
        <p className="tc-lesson">
          {wrong ? `This job needed a ${right.name.toLowerCase()}: it ${right.does.charAt(0).toLowerCase() + right.does.slice(1)}` : lay.prep.lesson}
          {r.capped ? ` Autopilot jobs earn up to ${TRACTOR_REWARD.autopilotStars} stars.` : ''}
        </p>
        <div className="tc-row">
          <button type="button" className="tc-btn is-soft" onClick={retry}>
            Try again
          </button>
          <button type="button" className="tc-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </>
    );
    if (sources) over = <Sources figures={[MONEY.diesel, MONEY.wage, right.hire, right.manual, MONEY.co2]} onClose={() => setSources(false)} />;
  }

  return (
    <div className="abs tc" style={{ inset: 0 }} role="dialog" aria-label={`Tractor: ${title}`}>
      <FarmMap dim={0.55} />
      <canvas
        ref={canvas}
        className="tc-canvas"
        width={FW * K}
        height={FH * K}
        aria-label={`${title}: the field from above`}
        onPointerDown={e => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          point(e, true);
        }}
        onPointerMove={e => ctl.current.hold && point(e, false)}
        onPointerUp={() => (ctl.current.hold = false)}
        onPointerCancel={() => (ctl.current.hold = false)}
      />
      {over}
      <NavBar horizontal onBack={back} onHome={phase === 'done' ? onClose : undefined} style={{ left: 6, top: 4 }} />
      {msg && (
        <p key={msg.id} className="tc-msg" role="status">
          {msg.text}
        </p>
      )}
      <div className={`tc-side${phase === 'done' ? ' is-done' : ''}`}>
        <div className="tc-title">
          <TractorIcon kind={tr ?? TRACTORS[1]} small />
          <span>{title}</span>
          <button type="button" className="tc-close" aria-label="Close the tractor" onClick={onClose}>
            ×
          </button>
        </div>
        {steps}
        {side}
      </div>
    </div>
  );
}

/* ---------------- parts ---------------- */

function Stat({ label, value, bar, low, kind }: { label: string; value: string; bar?: number; low?: boolean; kind?: string }) {
  return (
    <div className="tc-stat">
      <span>{label}</span>
      <b>{value}</b>
      {bar !== undefined && (
        <i className={`tc-bar${kind ? ` is-${kind}` : ''}`}>
          <i className={low ? 'is-low' : ''} style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </i>
      )}
    </div>
  );
}

function Bar({ label, v, note }: { label: string; v: number; note: string }) {
  return (
    <div className="tc-scorebar">
      <span>{label}</span>
      <b>{v}</b>
      <i className="tc-bar">
        <i className={v >= 70 ? '' : v >= 40 ? 'is-mid' : 'is-low'} style={{ width: `${v}%` }} />
      </i>
      <em>{note}</em>
    </div>
  );
}

function Sources({ figures, onClose }: { figures: MoneyFigure[]; onClose: () => void }) {
  const seen = new Set<MoneyFigure>();
  return (
    <div className="tc-choose tc-sources" role="dialog" aria-label="Where the shillings come from">
      <CloseX onClick={onClose} />
      <p className="tc-ask">Where the shillings come from</p>
      <ul>
        {figures
          .filter(f => !seen.has(f) && seen.add(f))
          .map(f => (
            <li key={f.what}>
              <b>{f.what}:</b> {f.unit.startsWith('KSh') ? money(f.value) : fmt(f.value)} {f.unit}.{' '}
              {f.source ? (
                <a href={f.source.url} target="_blank" rel="noreferrer">
                  {f.source.name}
                </a>
              ) : (
                <i>Game estimate, to check.</i>
              )}
            </li>
          ))}
        <li>
          One farm is {acresText} ({FARM_ACRES.toFixed(2)} acre). Lima's coins are game money: these shillings are only to compare. Like every value in the game, they are shown at 10 times the source figures.
        </li>
      </ul>
    </div>
  );
}

function TractorIcon({ kind, small }: { kind: TractorKind; small?: boolean }) {
  const s = (small ? 22 : 40) * kind.size;
  const body = kind.id === 'compact' ? '#e07b2a' : kind.id === 'large' ? '#2f6fb5' : '#3e8e3a';
  return (
    <svg viewBox="0 0 40 36" width={s} height={(s * 36) / 40} aria-hidden="true">
      <rect x={4} y={14} width={24} height={11} rx={2} fill={body} />
      <rect x={17} y={5} width={12} height={11} rx={1.5} fill="#26323d" />
      <rect x={20} y={7} width={6} height={6} fill="#a0d2f0" />
      <circle cx={11} cy={28} r={7} fill="#2a2a2a" />
      <circle cx={11} cy={28} r={2.5} fill="#bbb" />
      <circle cx={31} cy={30} r={5} fill="#2a2a2a" />
      <circle cx={31} cy={30} r={1.8} fill="#bbb" />
    </svg>
  );
}

/** Wakala's implement drawings. */
const IMPL_SVG: Record<ImplId, string> = {
  plough: "<rect x='4' y='14' width='40' height='4' rx='2' fill='#6b6f73'/><g fill='#4a4e52'><ellipse cx='10' cy='22' rx='3' ry='5' transform='rotate(-25 10 22)'/><ellipse cx='20' cy='22' rx='3' ry='5' transform='rotate(-25 20 22)'/><ellipse cx='30' cy='22' rx='3' ry='5' transform='rotate(-25 30 22)'/><ellipse cx='40' cy='22' rx='3' ry='5' transform='rotate(-25 40 22)'/></g>",
  harrow: "<rect x='3' y='9' width='42' height='3' rx='1.5' fill='#6b6f73'/><rect x='3' y='21' width='42' height='3' rx='1.5' fill='#6b6f73'/><g fill='#4a4e52'><circle cx='8' cy='15' r='3'/><circle cx='17' cy='15' r='3'/><circle cx='26' cy='15' r='3'/><circle cx='35' cy='15' r='3'/><circle cx='44' cy='15' r='3'/><circle cx='12' cy='27' r='3'/><circle cx='21' cy='27' r='3'/><circle cx='30' cy='27' r='3'/><circle cx='39' cy='27' r='3'/></g>",
  ridger: "<rect x='6' y='8' width='36' height='4' rx='2' fill='#6b6f73'/><g fill='none' stroke='#4a4e52' stroke-width='3' stroke-linecap='round'><path d='M10 14l4 12l4-12'/><path d='M20 14l4 12l4-12'/><path d='M30 14l4 12l4-12'/></g>",
  planter: "<rect x='4' y='20' width='40' height='4' rx='2' fill='#6b6f73'/><g fill='#2f8f4e'><rect x='6' y='8' width='7' height='12' rx='2'/><rect x='16' y='8' width='7' height='12' rx='2'/><rect x='26' y='8' width='7' height='12' rx='2'/><rect x='36' y='8' width='7' height='12' rx='2'/></g>",
  drill: "<rect x='3' y='9' width='42' height='11' rx='2' fill='#c0392b'/><g stroke='#4a4e52' stroke-width='1.6'><path d='M6 20v7M10 20v7M14 20v7M18 20v7M22 20v7M26 20v7M30 20v7M34 20v7M38 20v7M42 20v7'/></g>",
  spreader: "<path d='M14 6h20l-4 12h-12z' fill='#e0892a'/><rect x='22' y='18' width='4' height='5' fill='#5a5e62'/><ellipse cx='24' cy='25' rx='12' ry='3' fill='#6b6f73'/><g fill='#f2f2f2'><circle cx='9' cy='28' r='1.4'/><circle cx='16' cy='30' r='1.4'/><circle cx='32' cy='30' r='1.4'/><circle cx='39' cy='28' r='1.4'/></g>",
  sprayer: "<rect x='1' y='16' width='46' height='3' rx='1.5' fill='#5a5e62'/><circle cx='24' cy='11' r='7' fill='#e6e6e6' stroke='#9a9a9a'/><g fill='#8ec9ef'><circle cx='6' cy='23' r='1.6'/><circle cx='14' cy='23' r='1.6'/><circle cx='34' cy='23' r='1.6'/><circle cx='42' cy='23' r='1.6'/></g>",
  maizeH: "<rect x='4' y='14' width='40' height='9' rx='2' fill='#c0392b'/><g fill='#7a1f16'><path d='M6 14l3-8l3 8z'/><path d='M16 14l3-8l3 8z'/><path d='M26 14l3-8l3 8z'/><path d='M36 14l3-8l3 8z'/></g><rect x='18' y='23' width='12' height='6' rx='1' fill='#e2c069'/>",
  beanH: "<rect x='2' y='14' width='44' height='9' rx='2' fill='#d9a21b'/><g stroke='#8a6410' stroke-width='1.4'><path d='M6 8v6M12 8v6M18 8v6M24 8v6M30 8v6M36 8v6M42 8v6'/></g><rect x='4' y='7' width='40' height='2' fill='#8a6410'/>",
};

function ImplIcon({ k }: { k: ImplId }) {
  return <svg viewBox="0 0 48 32" width={44} height={29} aria-hidden="true" dangerouslySetInnerHTML={{ __html: IMPL_SVG[k] }} />;
}

/* ---------------- the field, drawn (Wakala's jobLayers, jobCell, drawTractor) ---------------- */

function makeLayers(job: Job) {
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = FW * K;
    c.height = FH * K;
    const x = c.getContext('2d')!;
    x.setTransform(K, 0, 0, K, 0, 0);
    return [c, x] as const;
  };
  const [bg, b] = mk();
  const [work, w] = mk();
  const lay = job.lay;
  let s = job.farm * 131 + 17;
  const R = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  b.fillStyle = '#86ad4e';
  b.fillRect(0, 0, FW, FH);
  for (let i = 0; i < 420; i++) {
    b.fillStyle = R() > 0.5 ? 'rgba(40,80,20,.16)' : 'rgba(255,255,210,.12)';
    b.beginPath();
    b.ellipse(R() * FW, R() * FH, 1.4, 1.1, 0, 0, 7);
    b.fill();
  }
  if (lay.channel) {
    b.fillStyle = '#3f8fc8';
    b.fillRect(62, 92, 420, 12);
    b.fillStyle = 'rgba(255,255,255,.35)';
    for (let x = 70; x < 480; x += 26) b.fillRect(x, 96, 12, 1.5);
  }
  const soil = { stubble: '#c9a56c', dry: '#dcbd84', clods: '#8a5d38', grass: '#9fa45a' }[lay.ground];
  lay.field.forEach(r => {
    b.fillStyle = soil;
    b.fillRect(r[0], r[1], r[2], r[3]);
  });
  b.save();
  b.beginPath();
  lay.field.forEach(r => b.rect(r[0], r[1], r[2], r[3]));
  b.clip();
  if (lay.ground === 'dry') {
    b.strokeStyle = 'rgba(120,80,40,.45)';
    b.lineWidth = 0.8;
    for (let i = 0; i < 70; i++) {
      let x = R() * FW;
      let y = R() * FH;
      b.beginPath();
      b.moveTo(x, y);
      for (let j = 0; j < 4; j++) {
        x += (R() - 0.5) * 18;
        y += (R() - 0.5) * 10;
        b.lineTo(x, y);
      }
      b.stroke();
    }
  } else if (lay.ground === 'clods') {
    for (let i = 0; i < 260; i++) {
      b.fillStyle = R() > 0.5 ? '#6f4a2a' : '#a37448';
      b.beginPath();
      b.ellipse(R() * FW, R() * FH, 2 + R() * 3, 1.5 + R() * 2, R() * 3, 0, 7);
      b.fill();
    }
  } else if (lay.ground === 'grass') {
    b.strokeStyle = 'rgba(60,110,30,.6)';
    b.lineWidth = 1;
    for (let i = 0; i < 600; i++) {
      const x = R() * FW;
      const y = R() * FH;
      b.beginPath();
      b.moveTo(x, y);
      b.lineTo(x + (R() - 0.5) * 3, y - 4);
      b.stroke();
    }
  } else {
    b.strokeStyle = 'rgba(120,90,40,.55)';
    b.lineWidth = 1;
    for (let i = 0; i < 520; i++) {
      const x = R() * FW;
      const y = R() * FH;
      b.beginPath();
      b.moveTo(x, y);
      b.lineTo(x + 1, y - 4);
      b.stroke();
    }
  }
  if (job.strips) {
    b.strokeStyle = 'rgba(255,255,255,.55)';
    b.lineWidth = 1.2;
    b.setLineDash([4, 6]);
    job.strips.forEach(sx => {
      b.beginPath();
      b.moveTo(sx, lay.field[0][1]);
      b.lineTo(sx, lay.field[0][1] + lay.field[0][3]);
      b.stroke();
    });
    b.setLineDash([]);
  }
  b.restore();
  b.strokeStyle = 'rgba(80,50,20,.55)';
  b.lineWidth = 1.5;
  lay.field.forEach(r => b.strokeRect(r[0], r[1], r[2], r[3]));
  for (const o of lay.obs) {
    if ('rect' in o) {
      const [x, y, ww, h] = o.rect;
      if (o.k === 'house') {
        b.fillStyle = '#c98f56';
        b.fillRect(x, y, ww, h);
        b.fillStyle = '#8c3f24';
        b.fillRect(x - 3, y - 3, ww + 6, h * 0.55);
      } else if (o.k === 'pond') {
        b.fillStyle = '#3f8fc8';
        b.beginPath();
        b.ellipse(x + ww / 2, y + h / 2, ww / 2, h / 2, 0, 0, 7);
        b.fill();
      } else {
        const vert = h > ww;
        b.fillStyle = '#6e4a2c';
        b.beginPath();
        b.roundRect(x, y, ww, h, Math.min(ww, h) / 2);
        b.fill();
        b.strokeStyle = 'rgba(40,25,10,.45)';
        b.lineWidth = 1;
        for (let t = 6; t < (vert ? h : ww) - 4; t += 7) {
          b.beginPath();
          if (vert) {
            b.moveTo(x + 2, y + t);
            b.lineTo(x + ww - 2, y + t + 3);
          } else {
            b.moveTo(x + t, y + 2);
            b.lineTo(x + t + 3, y + h - 2);
          }
          b.stroke();
        }
      }
    } else if (o.k === 'tank') {
      b.fillStyle = '#6d6f70';
      b.beginPath();
      b.arc(o.x, o.y, o.r, 0, 7);
      b.fill();
      b.fillStyle = '#4f9fd4';
      b.beginPath();
      b.arc(o.x, o.y, o.r - 4, 0, 7);
      b.fill();
    } else if (o.k === 'mound') {
      const g = b.createRadialGradient(o.x - 3, o.y - 3, 2, o.x, o.y, o.r + 4);
      g.addColorStop(0, '#e9cf98');
      g.addColorStop(1, '#a8834c');
      b.fillStyle = g;
      b.beginPath();
      b.arc(o.x, o.y, o.r + 3, 0, 7);
      b.fill();
    } else {
      b.fillStyle = '#8b8f92';
      b.beginPath();
      b.ellipse(o.x, o.y, o.r, o.r * 0.8, 0.3, 0, 7);
      b.fill();
      b.fillStyle = 'rgba(255,255,255,.3)';
      b.beginPath();
      b.ellipse(o.x - 3, o.y - 3, o.r * 0.4, o.r * 0.25, 0.3, 0, 7);
      b.fill();
    }
  }
  if (lay.slope) {
    // the slope runs down the screen
    const x = FW - 26;
    const y = 150;
    b.strokeStyle = '#fff';
    b.fillStyle = '#fff';
    b.lineWidth = 2.4;
    b.beginPath();
    b.moveTo(x, y);
    b.lineTo(x, y + 70);
    b.stroke();
    b.beginPath();
    b.moveTo(x, y + 70);
    b.lineTo(x - 6, y + 62);
    b.lineTo(x + 6, y + 62);
    b.closePath();
    b.fill();
    b.save();
    b.translate(x - 10, y + 35);
    b.rotate(-Math.PI / 2);
    b.font = '600 10px Poppins, sans-serif';
    b.textAlign = 'center';
    b.fillText('Downhill', 0, 0);
    b.restore();
  }
  // cells already worked (after a redraw)
  for (let i = 0; i < job.cnt.length; i++) if (job.cnt[i]) paintCell(w, job, i);
  return { bg, work };
}

function paintCell(c: CanvasRenderingContext2D, job: Job, i: number) {
  const gx = i % GW;
  const gy = Math.floor(i / GW);
  const x = gx * CELL;
  const y = gy * CELL;
  const ik = job.ik ?? job.right;
  const col: Record<ImplId, string> = {
    plough: gy % 4 < 2 ? '#6b4426' : '#5b381e',
    harrow: (gx + gy) % 3 ? '#8a5c36' : '#7c5130',
    ridger: '#5e3b20',
    planter: '#6a4426',
    drill: '#6a4426',
    spreader: 'rgba(245,245,235,.55)',
    sprayer: 'rgba(190,230,255,.5)',
    maizeH: (gx * 7 + gy) % 5 ? '#d8c48a' : '#b8a46a',
    beanH: (gx * 7 + gy) % 5 ? '#c8a878' : '#a88a5e',
  };
  c.fillStyle = col[ik];
  c.fillRect(x, y, CELL, CELL);
}

function drawTractor(c: CanvasRenderingContext2D, job: Job, tr: TractorKind, ik: ImplId) {
  const im = IMPL[ik];
  const off = im.front ? 16 : -16;
  c.save();
  c.translate(job.x, job.y);
  c.rotate(job.h);
  const sc = 1.15 * tr.size;
  c.scale(sc, sc);
  const ox = off / sc;
  const hw = im.w / 2.3 / tr.size;
  c.strokeStyle = '#444';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(im.front ? 12 : -8, 0);
  c.lineTo(ox, 0);
  c.stroke();
  if (ik === 'sprayer') {
    c.fillStyle = '#5a5e62';
    c.fillRect(ox - 1.5, -hw, 3, hw * 2);
  } else if (im.front) {
    c.fillStyle = ik === 'beanH' ? '#d9a21b' : '#c0392b';
    c.fillRect(ox - 3, -hw, 7, hw * 2);
  } else {
    c.fillStyle = '#6b6f73';
    c.fillRect(ox - 3, -hw, 6, hw * 2);
    c.fillStyle = '#4a4e52';
    for (let o = -hw + 2; o < hw; o += ik === 'drill' ? 3 : 5) c.fillRect(ox - 4, o, 2, 2.5);
  }
  c.fillStyle = '#1f1f1f';
  c.fillRect(-10, -13, 11, 5);
  c.fillRect(-10, 8, 11, 5);
  c.fillRect(6, -10, 7, 3.5);
  c.fillRect(6, 6.5, 7, 3.5);
  c.fillStyle = tr.id === 'compact' ? '#e07b2a' : tr.id === 'large' ? '#2f6fb5' : '#3e8e3a';
  c.beginPath();
  c.roundRect(-9, -7, 23, 14, 3);
  c.fill();
  c.fillStyle = '#26323d';
  c.fillRect(-8, -6, 10, 12);
  c.fillStyle = 'rgba(160,210,240,.7)';
  c.fillRect(-1, -5, 2.5, 10);
  c.restore();
}
