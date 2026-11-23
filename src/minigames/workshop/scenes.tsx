import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ArtId } from '../fun';
import { Bench, H, Hold, Lever, PartArt, PartCard, PartIcon, Sky, Slot, Step, Switch, Tractor, W, Wheel, clamp, useBench, useFrames, useOnce, useWs, type P } from './kit';

/* The nine hands-on lesson scenes, one for each question of the tractor's lessons (src/tractor/hub.ts LESSONS). Each is
   a small working job: the answer is found by doing it, and a wrong try shows what really happens. */

const LETTERS = ['A', 'B', 'C', 'D'];
const near = (a: P, b: P, r: number) => Math.hypot(a.x - b.x, a.y - b.y) < r;
const nameOf = (list: { id: string; label: string }[], id: string) => list.find(p => p.id === id)?.label ?? id;

/** Grass, cut or standing. */
const Tuft = ({ x, y, cut }: { x: number; y: number; cut: boolean }) =>
  cut ? (
    <g stroke="#6d9a35" strokeWidth={2} strokeLinecap="round">
      <path d={`M${x - 5} ${y} l1 -3 M${x} ${y} l0 -4 M${x + 5} ${y} l-1 -3`} />
      <path d={`M${x - 9} ${y - 1} l4 -1 M${x + 7} ${y - 1} l4 1`} stroke="#9cc45e" />
    </g>
  ) : (
    <path d={`M${x - 6} ${y} q1 -12 -3 -18 M${x} ${y} q0 -14 2 -22 M${x + 6} ${y} q-1 -12 4 -17`} stroke="#4f9a2b" strokeWidth={2.4} fill="none" strokeLinecap="round" />
  );

/* ================================================================== */
/* Know your tractor 1: which part turns the mower? (the PTO shaft)    */
/* ================================================================== */

const PTO_PARTS = [
  { id: 'shaft', label: 'The PTO shaft' },
  { id: 'steering', label: 'The steering wheel' },
  { id: 'cap', label: 'The fuel cap' },
];
const TUFTS = [40, 70, 100, 130, 160, 190, 220, 250, 280];

function PtoScene() {
  const ws = useWs();
  const once = useOnce();
  const G = 190;
  const S = 0.8;
  const START = 228;
  const [slot, setSlot] = useState<string | null>(null);
  const [pto, setPto] = useState(false);
  const [x, setX] = useState(START);
  const [spin, setSpin] = useState(0);
  const [cut, setCut] = useState(() => TUFTS.map(() => false));
  const tested = useRef<string | null>(null);
  const grabbed = useRef(false);
  const drive = useRef(0);
  const turning = pto && slot === 'shaft';
  const slotAt = { x: x + 78 * S, y: G - 31 * S };
  const test = (id: string | null) => {
    if (!id) return ws.say('The PTO stub at the back turns, but nothing joins it to the mower. Drag a part into the gap.');
    if (id === 'shaft') return ws.say('The PTO shaft spins, and it turns the mower’s blades! Now drive over the grass.', 'good');
    if (tested.current === id) return;
    tested.current = id;
    ws.slip(id === 'steering' ? 'The steering wheel only steers the front wheels: it cannot carry the turn to the mower. Take it out and try another part.' : 'The fuel cap only closes the diesel tank: nothing turns. Take it out and try another part.');
  };
  const reachIn = () => {
    if (grabbed.current) return ws.say('Switch the PTO off before you touch the shaft.', 'bad');
    grabbed.current = true;
    ws.slip('Stop! Never reach in by a turning PTO shaft: it grabs clothes and arms. Switch the PTO off first.');
  };
  const fit = (id: string) => {
    if (turning) return reachIn();
    setSlot(id);
    tested.current = null;
    if (pto) test(id);
    else ws.say(`${nameOf(PTO_PARTS, id)} is in the gap. Now switch the PTO on and watch the mower.`);
  };
  const remove = () => {
    if (turning) return reachIn();
    setSlot(null);
    ws.say('Taken out. Try another part.');
  };
  const b = useBench({
    onDrop: (id, p) => {
      if (p && near(p, slotAt, 30)) {
        if (slot !== id) fit(id);
      } else if (slot === id) remove();
    },
    onTap: id => (slot === id ? remove() : fit(id)),
  });
  useFrames(dt => {
    if (pto) setSpin(v => (v + 900 * dt) % 36000);
    if (!drive.current) return;
    const nx = clamp(x + drive.current * 70 * dt, -70, START);
    if (nx === x) return;
    setX(nx);
    const a = nx + 94 * S;
    const z = nx + 158 * S;
    const nc = cut.slice();
    let changed = false;
    TUFTS.forEach((t, k) => {
      if (nc[k] || t < a || t > z) return;
      if (turning) {
        nc[k] = true;
        changed = true;
      } else once.run('ride', () => ws.say('The mower rides over the grass without cutting: nothing is turning its blades.'));
    });
    if (changed) {
      setCut(nc);
      if (nc.filter(Boolean).length >= 6) ws.win('The grass is cut. The PTO shaft carries the engine’s turn back to the mower.');
    }
  });
  const blade = turning ? spin : 0;
  return (
    <Bench
      b={b}
      label="A tractor with a mower behind it, and a gap between them"
      scene={
        <>
          <Sky ground={G} />
          {TUFTS.map((t, k) => (
            <Tuft key={t} x={t} y={G} cut={cut[k]} />
          ))}
          <Tractor x={x} y={G} s={S} roll={x * 1.9} running>
            {/* the PTO stub turns whenever the PTO is on */}
            {pto && <line x1={60} x2={66} y1={-31} y2={-31} stroke="#ffae00" strokeWidth={6} strokeDasharray="2 2" strokeDashoffset={-spin / 25} />}
            {/* the mower */}
            <rect x={88} y={-40} width={14} height={18} rx={2} fill="#8a2f22" />
            <rect x={94} y={-30} width={64} height={18} rx={5} fill="#c0432f" />
            <rect x={92} y={-13} width={68} height={4} rx={2} fill="#6d2a1e" />
            <g transform="translate(126,-6) scale(1,0.22)">
              <g transform={`rotate(${blade})`}>
                <rect x={-28} y={-3} width={56} height={6} fill="#ddd" />
              </g>
            </g>
            {turning && <ellipse cx={126} cy={-6} rx={30} ry={5} fill="rgba(255,255,255,0.45)" />}
            <circle cx={163} cy={-8} r={7} fill="#333" />
            <text x={126} y={-36} textAnchor="middle" fontSize={10} fontWeight={800} fill="#6b402b">
              Mower
            </text>
            {slot ? (
              <g className="ws-grab" data-fitted={slot} onPointerDown={e => b.drag(slot, e, <PartIcon kind={slot} />)}>
                {slot === 'shaft' ? (
                  <>
                    <rect x={64} y={-34.5} width={26} height={7} rx={2} fill="#9a9a9a" />
                    <line x1={66} x2={88} y1={-31} y2={-31} stroke="#ffae00" strokeWidth={6} strokeDasharray="3 4" strokeDashoffset={-blade / 25} />
                    <rect x={63} y={-37} width={4} height={12} rx={1} fill="#555" />
                    <rect x={87} y={-37} width={4} height={12} rx={1} fill="#555" />
                  </>
                ) : (
                  <g transform="translate(77,-31) scale(0.85)">
                    <PartArt kind={slot} />
                  </g>
                )}
                <rect x={60} y={-48} width={34} height={34} fill="transparent" />
              </g>
            ) : (
              <Slot x={77} y={-31} r={13} label="the gap" />
            )}
          </Tractor>
        </>
      }
      tray={PTO_PARTS.map((p, n) => (
        <PartCard key={p.id} b={b} id={p.id} icon={<PartIcon kind={p.id} />} label={p.label} letter={LETTERS[n]} fitted={slot === p.id} note={slot === p.id ? 'In the gap: drag or tap to take out' : undefined} />
      ))}
      controls={
        <>
          <Switch
            label="PTO"
            ctl="pto"
            on={pto}
            onChange={v => {
              setPto(v);
              if (v) test(slot);
              else grabbed.current = false;
            }}
          />
          <Hold label="◀ Drive" ctl="drive" onHold={v => (drive.current = v ? -1 : 0)} />
          <Hold label="Reverse ▶" ctl="back" onHold={v => (drive.current = v ? 1 : 0)} />
        </>
      }
    />
  );
}

/* ================================================================== */
/* Know your tractor 2: what do the linkage arms do? (lift the tool)   */
/* ================================================================== */

const LINK_PARTS = [
  { id: 'arms', label: 'Three-point linkage arms' },
  { id: 'pump', label: 'A tyre pump' },
  { id: 'fan', label: 'An engine fan' },
];

function LinkageScene() {
  const ws = useWs();
  const once = useOnce();
  const G = 190;
  const S = 0.8;
  const START = 214;
  const GAP = 84 * S;
  const FIELD = 72;
  const [slot, setSlot] = useState<string | null>(null);
  const [lift, setLift] = useState(0);
  const [x, setX] = useState(START);
  const [px, setPx] = useState(START + GAP);
  const [dug, setDug] = useState<number[]>([]);
  const tested = useRef<string | null>(null);
  const drive = useRef(0);
  const attached = slot === 'arms';
  const up = attached ? lift : 0;
  const close = Math.abs(px - (x + GAP)) < 6;
  const slotAt = { x: x + 73 * S, y: G - 36 * S };
  const fit = (id: string) => {
    if (!close) return ws.say('Back the tractor up to the plough first: the arms must reach it.');
    setSlot(id);
    tested.current = null;
    ws.say(id === 'arms' ? 'The arms join the tractor to the plough. Now pull the lift lever.' : `${nameOf(LINK_PARTS, id)} is fitted. Try the lift lever.`);
  };
  const remove = () => {
    if (slot === 'arms' && lift > 0.3) ws.say('The plough dropped with a thud. Lower it before you unhitch it.', 'bad');
    else ws.say('Taken out.');
    setSlot(null);
  };
  const b = useBench({
    onDrop: (id, p) => {
      if (p && near(p, slotAt, 30)) {
        if (slot !== id) fit(id);
      } else if (slot === id) remove();
    },
    onTap: id => (slot === id ? remove() : fit(id)),
  });
  const pull = (v: number) => {
    setLift(v / 100);
    if (!slot) once.run('none', () => ws.say('The lift at the back moves, but nothing joins it to the plough. Drag a part in to join them.'));
    else if (slot !== 'arms') {
      if (tested.current !== slot) {
        tested.current = slot;
        ws.slip(slot === 'pump' ? 'A tyre pump only puts air in the tyres: the plough stays on the ground. Take it out and try another part.' : 'An engine fan blows air to cool the engine: it cannot lift anything. Take it out and try another part.');
      }
    } else if (v >= 60) once.run('up', () => ws.say('The linkage arms lift the plough and hold it up. Now drive it to the field.', 'good'));
  };
  useFrames(dt => {
    if (!drive.current) return;
    const lo = FIELD + 80 * S - 20;
    let nx = clamp(x + drive.current * 60 * dt, lo, START + 30);
    if (!attached) nx = Math.min(nx, px - GAP);
    if (nx === x) {
      if (drive.current < 0 && nx === lo) {
        if (attached && up >= 0.5) ws.win('The three-point linkage lifts the plough and holds it: it rides clear all the way to the field.');
        else once.run('there', () => ws.say(attached ? 'The plough is dragging on the ground: lift it to carry it.' : 'You are at the field, but the plough is still back in the yard. Reverse for it.'));
      }
      return;
    }
    if (drive.current > 0) once.reset('there');
    setX(nx);
    if (attached) {
      setPx(nx + GAP);
      if (up < 0.4 && drive.current < 0) {
        const k = Math.round((nx + GAP + 20) / 5);
        if (!dug.includes(k)) setDug([...dug, k]);
        once.run('drag', () => ws.say('The plough is dragging and digging up the yard. Lift it to carry it.'));
      }
    } else if (drive.current < 0 && px - (nx + GAP) > 16) once.run('left', () => ws.say('The plough stays behind: nothing holds it to the tractor.'));
  });
  const py = G - up * 34;
  // the hitch points, on the tractor and on the plough
  const tl = { x: x + 62 * S, y: G - 22 * S - up * 14 };
  const tu = { x: x + 60 * S, y: G - 56 * S };
  const pl = { x: px, y: py - 22 * S };
  const pu = { x: px, y: py - 48 * S };
  return (
    <Bench
      b={b}
      label="A tractor with a plough lying on the ground behind it"
      scene={
        <>
          <Sky ground={G} />
          {/* the field */}
          <rect x={0} y={G} width={FIELD} height={H - G} fill="#5a3a20" />
          {[0, 1, 2, 3].map(i => (
            <path key={i} d={`M0 ${G + 5 + i * 6} H${FIELD}`} stroke="#3e2714" strokeWidth={2} />
          ))}
          <path d={`M${FIELD - 8} ${G} V${G - 44}`} stroke="#6b402b" strokeWidth={3} />
          <path d={`M${FIELD - 8} ${G - 44} l-20 6 l20 6 z`} fill="#ffae00" />
          <text x={30} y={G - 50} textAnchor="middle" fontSize={11} fontWeight={800} fill="#6b402b">
            Field
          </text>
          {dug.map(k => (
            <rect key={k} x={k * 5 - 3} y={G} width={6} height={5} fill="#3e2714" />
          ))}
          <Tractor x={x} y={G} s={S} roll={x * 1.9} running />
          {/* the plough */}
          <g transform={`translate(${px},${py}) scale(${S})`}>
            <path d="M0 -22 L0 -48 L14 -24" stroke="#8a2f22" strokeWidth={4} fill="none" />
            <path d="M0 -22 L62 -16" stroke="#c0432f" strokeWidth={6} strokeLinecap="round" />
            {[22, 48].map(bx => (
              <g key={bx}>
                <path d={`M${bx} -19 L${bx + 4} -5`} stroke="#c0432f" strokeWidth={4} />
                <path d={`M${bx - 8} 0 Q${bx + 2} -10 ${bx + 14} -3 L${bx + 9} 0 Z`} fill="#7a7a7a" />
              </g>
            ))}
            <circle cy={-22} r={2.6} fill="#333" />
            <circle cy={-48} r={2.6} fill="#333" />
          </g>
          {slot ? (
            <g className="ws-grab" data-fitted={slot} onPointerDown={e => b.drag(slot, e, <PartIcon kind={slot} />)}>
              {slot === 'arms' ? (
                <g stroke="#6f6f6f" strokeWidth={4} strokeLinecap="round">
                  <line x1={tl.x} y1={tl.y} x2={pl.x} y2={pl.y} />
                  <line x1={tu.x} y1={tu.y} x2={pu.x} y2={pu.y} />
                  <circle cx={pl.x} cy={pl.y} r={2} fill="#ffae00" stroke="none" />
                  <circle cx={pu.x} cy={pu.y} r={2} fill="#ffae00" stroke="none" />
                </g>
              ) : (
                <g transform={`translate(${slotAt.x},${slotAt.y}) scale(0.85)`}>
                  <PartArt kind={slot} spin={lift * 720} />
                </g>
              )}
              <rect x={slotAt.x - 16} y={slotAt.y - 20} width={32} height={40} fill="transparent" />
            </g>
          ) : (
            close && <Slot x={slotAt.x} y={slotAt.y} r={12} label="hitch" />
          )}
        </>
      }
      tray={LINK_PARTS.map((p, n) => (
        <PartCard key={p.id} b={b} id={p.id} icon={<PartIcon kind={p.id} />} label={p.label} letter={LETTERS[n]} fitted={slot === p.id} note={slot === p.id ? 'Fitted: drag or tap to take out' : undefined} />
      ))}
      controls={
        <>
          <Lever label="Lift lever" ctl="lift" min={0} max={100} value={Math.round(lift * 100)} onChange={pull} show={lift < 0.15 ? 'Down' : lift > 0.85 ? 'Up' : 'Half'} />
          <Hold label="◀ Drive" ctl="drive" onHold={v => (drive.current = v ? -1 : 0)} />
          <Hold label="Reverse ▶" ctl="back" onHold={v => (drive.current = v ? 1 : 0)} />
        </>
      }
    />
  );
}

/* ================================================================== */
/* Know your tractor 3: where does the engine's heat go? (radiator)    */
/* ================================================================== */

const RAD_PARTS = [
  { id: 'radiator', label: 'The radiator' },
  { id: 'battery', label: 'The battery' },
  { id: 'seat', label: 'The seat' },
];
const CLUMPS = [
  { x: 62, y: 66 },
  { x: 92, y: 84 },
  { x: 68, y: 104 },
];

/** A dial from 180° (left) round the top to 0° (right). */
const polar = (a: number, r: number) => ({ x: r * Math.cos((a * Math.PI) / 180), y: -r * Math.sin((a * Math.PI) / 180) });
const arc = (r: number, a0: number, a1: number) => {
  const p = polar(a0, r);
  const q = polar(a1, r);
  return `M${p.x} ${p.y} A${r} ${r} 0 ${Math.abs(a0 - a1) > 180 ? 1 : 0} 1 ${q.x} ${q.y}`;
};

function RadiatorScene() {
  const ws = useWs();
  const once = useOnce();
  const G = 198;
  const S = 1.1;
  const X = 262;
  const IN = { x: 78, y: 84, r: 50 };
  const [slot, setSlot] = useState<string | null>(null);
  const [engine, setEngine] = useState(false);
  const [temp, setTemp] = useState(34);
  const [dirt, setDirt] = useState([1, 1, 1]);
  const [boil, setBoil] = useState(0);
  const cool = slot === 'radiator';
  const front = { x: X - 80 * S, y: G - 47 * S };
  const fit = (id: string) => {
    setSlot(id);
    ws.say(id === 'radiator' ? 'The radiator is on the front of the engine. Start the engine and watch the gauge.' : `${nameOf(RAD_PARTS, id)} is on the front of the engine. Start it and watch the gauge.`);
  };
  const remove = () => {
    setSlot(null);
    ws.say('Taken out.');
  };
  const b = useBench({
    onDrop: (id, p) => {
      if (p && (near(p, front, 32) || near(p, IN, IN.r))) {
        if (slot !== id) fit(id);
      } else if (slot === id) remove();
    },
    onTap: id => (slot === id ? remove() : fit(id)),
  });
  const rub = (k: number, by: number) =>
    setDirt(d => {
      const n = d.map((v, j) => (j === k ? Math.max(0, v - by) : v));
      if (n.every(v => v === 0) && d.some(v => v > 0)) window.setTimeout(() => ws.say('Clean fins: the air flows through them again.', 'good'), 0);
      return n;
    });
  useFrames(dt => {
    if (boil > 0) setBoil(Math.max(0, boil - dt));
    const target = engine ? (cool ? 66 + 10 * dirt.reduce((a, v) => a + v, 0) : 118) : 30;
    const t = temp + (target - temp) * (engine ? 0.38 : 0.3) * dt;
    if (engine && t >= 88) once.run('warm', () => ws.say(cool ? 'Still too hot: chaff and mud block the radiator’s fins. Rub them clean.' : 'The needle is climbing into the red! Stop the engine, or fit the part that cools it.', 'bad'));
    if (engine && t >= 100) {
      setEngine(false);
      setBoil(2.4);
      once.reset('warm');
      ws.slip(!slot ? 'Nothing cooled it: the heat had nowhere to go, and the engine boiled over. Fit the part that cools it.' : slot === 'battery' ? 'A battery stores power to start the engine; it does not cool it. The engine boiled over.' : 'A seat cannot cool anything. The engine boiled over.');
    }
    if (engine && cool && dirt.every(v => v === 0) && t <= 76) ws.win('The radiator carries the engine’s heat out into the air. Keep its fins clean of chaff and mud.');
    setTemp(t);
  });
  const needle = 180 - ((clamp(temp, 30, 120) - 30) / 90) * 180;
  const part = (kind: string, s: number, x: number, y: number) => (
    <g className="ws-grab" data-fitted={kind} transform={`translate(${x},${y}) scale(${s})`} onPointerDown={e => b.drag(kind, e, <PartIcon kind={kind} />)}>
      <PartArt kind={kind} />
      <rect x={-14} y={-14} width={28} height={28} fill="transparent" />
    </g>
  );
  return (
    <Bench
      b={b}
      label="A tractor with its engine’s front shown close up, and a temperature gauge"
      scene={
        <>
          <Sky ground={G} sun={false} />
          <Tractor
            x={X}
            y={G}
            s={S}
            running={engine}
            front={
              <>
                {cool && engine && (
                  <g className="ws-flow">
                    <path d="M-78 -56 H-64" stroke="#d9473a" strokeWidth={3} />
                    <path d="M-78 -38 H-64" stroke="#22ade2" strokeWidth={3} />
                  </g>
                )}
                {slot ? part(slot, 0.7, -80, -47) : <Slot x={-80} y={-47} r={10} />}
              </>
            }
          >
            {boil > 0 && (
              <g className="ws-steam">
                {[0, 1, 2].map(i => (
                  <circle key={i} cx={-60 + i * 22} cy={-70} r={9} fill="#fff" style={{ animationDelay: `${i * 0.25}s` }} />
                ))}
              </g>
            )}
          </Tractor>
          {/* the close-up of the engine's front */}
          <path d={`M${IN.x + IN.r * 0.9} ${IN.y + 20} L${front.x - 4} ${front.y}`} stroke="#6b402b" strokeWidth={1.5} strokeDasharray="3 3" />
          <circle cx={IN.x} cy={IN.y} r={IN.r} fill="#fff8ea" stroke="#6b402b" strokeWidth={2.5} />
          <text x={IN.x} y={IN.y - IN.r - 5} textAnchor="middle" fontSize={9} fontWeight={800} fill="#6b402b">
            Front of the engine
          </text>
          {slot === 'radiator' ? (
            <g>
              <g className="ws-grab" data-fitted="radiator" onPointerDown={e => b.drag('radiator', e, <PartIcon kind="radiator" />)}>
                <g transform={`translate(${IN.x},${IN.y}) scale(1.55)`}>
                  <g opacity={0.35}>
                    <PartArt kind="fan" spin={engine ? temp * 40 : 0} />
                  </g>
                </g>
                <rect x={IN.x - 30} y={IN.y - 36} width={60} height={72} rx={4} fill="#3d4a52" opacity={0.92} />
                {Array.from({ length: 11 }, (_, i) => (
                  <line key={i} x1={IN.x - 26} x2={IN.x + 26} y1={IN.y - 30 + i * 6} y2={IN.y - 30 + i * 6} stroke="#b8c7cf" strokeWidth={1.6} />
                ))}
              </g>
              {CLUMPS.map((c, k) =>
                dirt[k] > 0 ? (
                  <g
                    key={k}
                    className="ws-rub"
                    data-clump={k}
                    opacity={0.25 + dirt[k] * 0.75}
                    onPointerDown={e => {
                      rub(k, 0.35);
                      b.follow(e, p => near(p, c, 18) && rub(k, 0.06));
                    }}
                  >
                    <ellipse cx={c.x} cy={c.y} rx={12} ry={9} fill="#8a6a3a" />
                    <path d={`M${c.x - 9} ${c.y - 2} l7 4 M${c.x} ${c.y - 6} l5 9 M${c.x + 3} ${c.y + 3} l7 -3`} stroke="#d9b76a" strokeWidth={1.6} />
                  </g>
                ) : null,
              )}
            </g>
          ) : slot ? (
            part(slot, 2.4, IN.x, IN.y)
          ) : (
            <Slot x={IN.x} y={IN.y} r={24} />
          )}
          {/* the temperature gauge */}
          <g transform="translate(300,76)">
            <rect x={-50} y={-50} width={100} height={72} rx={10} fill="#fff8ea" stroke="#6b402b" strokeWidth={2} />
            <path d={arc(34, 180, 140)} stroke="#22ade2" strokeWidth={8} fill="none" />
            <path d={arc(34, 140, 80)} stroke="#2f9b14" strokeWidth={8} fill="none" />
            <path d={arc(34, 80, 30)} stroke="#ffae00" strokeWidth={8} fill="none" />
            <path d={arc(34, 30, 0)} stroke="#d9473a" strokeWidth={8} fill="none" />
            <line x1={0} y1={0} x2={polar(needle, 30).x} y2={polar(needle, 30).y} stroke="#2a1a10" strokeWidth={3} strokeLinecap="round" />
            <circle r={4} fill="#2a1a10" />
            <text y={16} textAnchor="middle" fontSize={11} fontWeight={800} fill="#6b402b">
              {Math.round(temp)}°C
            </text>
          </g>
        </>
      }
      tray={RAD_PARTS.map((p, n) => (
        <PartCard key={p.id} b={b} id={p.id} icon={<PartIcon kind={p.id} />} label={p.label} letter={LETTERS[n]} fitted={slot === p.id} note={slot === p.id ? 'Fitted: drag or tap to take out' : undefined} />
      ))}
      controls={
        <>
          <Switch
            label="Engine"
            ctl="engine"
            on={engine}
            onText="Running"
            onChange={v => {
              if (v && boil > 0) return ws.say('Let it cool down first.');
              setEngine(v);
              once.reset('warm');
            }}
          />
          {cool && dirt.some(v => v > 0) && <span className="ws-hint">Rub the chaff off the fins with your finger</span>}
        </>
      }
    />
  );
}

/* ================================================================== */
/* Working safely 1: across a steep slope the tractor can roll over    */
/* ================================================================== */

function SlopeScene() {
  const ws = useWs();
  const once = useOnce();
  const START = { x: 110, y: 186 };
  const SHED = { x: 110, y: 28 };
  const [pos, setPos] = useState(START);
  const [h, setH] = useState(40);
  const [rolled, setRolled] = useState(0);
  const drive = useRef(0);
  const turn = useRef(0);
  const lean = 34 * Math.abs(Math.sin((h * Math.PI) / 180));
  const b = useBench();
  useFrames(dt => {
    if (rolled > 0) {
      const r = rolled - dt;
      if (r <= 0) {
        setRolled(0);
        setPos(START);
        setH(40);
        once.reset('lean');
      } else setRolled(r);
      return;
    }
    if (turn.current) setH(v => v + turn.current * 80 * dt);
    if (!drive.current) return;
    if (lean >= 24) {
      setRolled(2.2);
      ws.slip('It rolled over! Across a slope the tractor leans more and more until it tips. Drive straight up and down a slope, with the ROPS frame up and the belt on.');
      return;
    }
    if (lean >= 12) once.run('lean', () => ws.say('Feel it lean? Any more across the slope and it will roll.', 'bad'));
    const r = (h * Math.PI) / 180;
    const sp = 44 * drive.current * dt;
    const np = { x: clamp(pos.x + Math.sin(r) * sp, 14, 346), y: clamp(pos.y - Math.cos(r) * sp, 14, 206) };
    setPos(np);
    if (near(np, SHED, 30)) ws.win('Pointing straight up the slope, it stays level side to side and climbs safely.');
  });
  const side = Math.sin((h * Math.PI) / 180) >= 0 ? 1 : -1;
  const tip = rolled > 0 ? Math.min(1, (2.2 - rolled) / 0.6) : 0;
  const shown = side * (lean + tip * (100 - lean));
  const tone = lean >= 24 ? '#d9473a' : lean >= 12 ? '#ffae00' : '#2f9b14';
  return (
    <Bench
      b={b}
      label="A steep hill seen from above, a tractor at the bottom and a shed at the top"
      scene={
        <>
          <defs>
            <linearGradient id="ws-hill" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#9ccf6a" />
              <stop offset="1" stopColor="#4f8f30" />
            </linearGradient>
          </defs>
          <rect width={W} height={H} fill="url(#ws-hill)" />
          {[40, 72, 104, 136, 168, 200].map(y => (
            <path key={y} d={`M0 ${y} C90 ${y - 8} 180 ${y + 8} 360 ${y - 4}`} stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} fill="none" />
          ))}
          <text x={16} y={120} fontSize={10} fontWeight={800} fill="#fff" transform="rotate(-90 16 120)" textAnchor="middle">
            uphill ⟶
          </text>
          <g transform={`translate(${SHED.x},${SHED.y})`}>
            <rect x={-18} y={-10} width={36} height={22} fill="#a8612f" />
            <path d="M-22 -10 L0 -24 L22 -10 Z" fill="#6b402b" />
            <rect x={-6} y={0} width={12} height={12} fill="#5a3a20" />
          </g>
          <circle cx={START.x} cy={START.y} r={10} fill="none" stroke="rgba(255,255,255,0.6)" strokeDasharray="3 3" />
          {/* the tractor from above */}
          <g transform={`translate(${pos.x},${pos.y}) rotate(${h}) scale(${rolled > 0 ? 1.15 : 1})`} opacity={rolled > 0 ? 0.7 : 1}>
            <rect x={-14} y={2} width={7} height={15} rx={2} fill="#222" />
            <rect x={7} y={2} width={7} height={15} rx={2} fill="#222" />
            <rect x={-11} y={-22} width={4} height={9} rx={1} fill="#222" />
            <rect x={7} y={-22} width={4} height={9} rx={1} fill="#222" />
            <rect x={-7} y={-25} width={14} height={28} rx={3} fill={rolled > 0 ? '#8a8a8a' : '#2b8a4a'} />
            <rect x={-10} y={-2} width={20} height={16} rx={2} fill={rolled > 0 ? '#666' : '#1d5e33'} />
            <g className="ws-grab" data-handle="nose" onPointerDown={e => b.follow(e, p => setH((Math.atan2(p.x - pos.x, pos.y - p.y) * 180) / Math.PI))}>
              <circle cy={-36} r={8} fill="rgba(255,174,0,0.85)" stroke="#fff" strokeWidth={1.5} />
              <path d="M-4 -36 L0 -41 L4 -36" stroke="#6b402b" strokeWidth={2} fill="none" />
            </g>
          </g>
          {rolled > 0 && (
            <text x={pos.x} y={pos.y - 26} textAnchor="middle" fontSize={20}>
              ⚠️
            </text>
          )}
          {/* the tractor seen from behind */}
          <g transform="translate(292,60)">
            <rect x={-58} y={-50} width={116} height={100} rx={10} fill="#fff8ea" stroke="#6b402b" strokeWidth={2} />
            <text y={-37} textAnchor="middle" fontSize={9} fontWeight={800} fill="#6b402b">
              Seen from behind
            </text>
            <g transform={`translate(0,16) rotate(${side * lean})`}>
              <rect x={-52} y={0} width={104} height={6} fill="#7cb342" />
            </g>
            <g transform={`translate(0,16) rotate(${shown})`}>
              <rect x={-30} y={-26} width={13} height={26} rx={3} fill="#222" />
              <rect x={17} y={-26} width={13} height={26} rx={3} fill="#222" />
              <rect x={-15} y={-24} width={30} height={16} rx={3} fill="#2b8a4a" />
              <path d="M-15 -22 V-52 H15 V-22" stroke="#1d5e33" strokeWidth={4} fill="none" />
              <circle cy={-30} r={5} fill="#8a5634" />
            </g>
            <rect x={-44} y={30} width={88} height={8} rx={4} fill="rgba(107,64,43,0.15)" />
            <rect x={-44} y={30} width={(Math.min(lean, 30) / 30) * 88} height={8} rx={4} fill={tone} />
            <text y={47} textAnchor="middle" fontSize={9} fontWeight={800} fill={tone}>
              Leans {Math.round(lean)}°{lean >= 24 ? ': it will roll!' : ''}
            </text>
          </g>
        </>
      }
      controls={
        <>
          <Hold label="⟲ Turn" ctl="left" onHold={v => (turn.current = v ? -1 : 0)} />
          <Hold label="Turn ⟳" ctl="right" onHold={v => (turn.current = v ? 1 : 0)} />
          <Hold label="▲ Drive" ctl="drive" onHold={v => (drive.current = v ? 1 : 0)} />
          <Hold label="▼ Reverse" ctl="back" onHold={v => (drive.current = v ? -1 : 0)} />
          <span className="ws-hint">Or drag the yellow handle on its nose to turn it</span>
        </>
      }
    />
  );
}

/* ================================================================== */
/* Working safely 2: before getting off: tool down, PTO off, brake on  */
/* ================================================================== */

function GetOffScene() {
  const ws = useWs();
  const once = useOnce();
  const G = 192;
  const S = 1.05;
  const X = 210;
  const [toolUp, setToolUp] = useState(true);
  const [pto, setPto] = useState(true);
  const [brake, setBrake] = useState(false);
  const [engine, setEngine] = useState(true);
  const [farmer, setFarmer] = useState<'seat' | 'ground'>('seat');
  const [alarm, setAlarm] = useState(0);
  const [bad, setBad] = useState<string[]>([]);
  const [spin, setSpin] = useState(0);
  const safe = !toolUp && !pto && brake && !engine;
  useEffect(() => {
    if (safe && farmer === 'seat') once.run('safe', () => ws.say('Everything is safe now. Drag the farmer down to the ground.', 'good'));
  });
  const getOff = () => {
    const why: string[] = [];
    if (!brake) why.push('brake');
    if (toolUp) why.push('tool');
    if (pto) why.push('pto');
    if (engine) why.push('engine');
    setFarmer('ground');
    if (!why.length) return ws.win('Tool down, PTO off, hand brake on, engine off: the tractor stays still and safe while you step down.');
    setBad(why);
    setAlarm(2.4);
    const words: Record<string, string> = {
      brake: 'no hand brake, so the tractor rolled away',
      tool: 'the tool was left up, and it dropped',
      pto: engine ? 'the PTO shaft is still turning, and it grabs clothes' : 'the PTO is still on: it spins as soon as the engine starts',
      engine: 'the engine is running, so anyone could drive off',
    };
    ws.slip(`Not safe: ${why.map(k => words[k]).join('; ')}. Use the switches first.`);
  };
  const b = useBench({
    onDrop: (id, p) => {
      if (id !== 'farmer' || farmer !== 'seat') return;
      if (p && p.x < 140 && p.y > 130) getOff();
      else ws.say('Drop the farmer on the ground beside the tractor.');
    },
    onTap: () => (farmer === 'seat' ? getOff() : !ws.won && setFarmer('seat')),
  });
  useFrames(dt => {
    if (pto && engine) setSpin(v => (v + 800 * dt) % 36000);
    if (alarm > 0) {
      const a = alarm - dt;
      if (a <= 0) {
        setAlarm(0);
        setBad([]);
        setFarmer('seat');
      } else setAlarm(a);
    }
  });
  const creep = bad.includes('brake') ? Math.min(1, (2.4 - alarm) / 1.2) * 60 : 0;
  const up = toolUp && !bad.includes('tool') ? -30 : 0;
  const turning = pto && engine;
  const x = X - creep;
  return (
    <Bench
      b={b}
      label="A tractor with the farmer in the seat, the engine running and a rotavator raised behind"
      scene={
        <>
          <Sky ground={G} />
          <rect x={10} y={G + 2} width={110} height={22} rx={6} fill="rgba(255,255,255,0.18)" stroke="#fff" strokeDasharray="4 3" />
          <text x={65} y={G + 17} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">
            Step down here
          </text>
          <Tractor x={x} y={G} s={S} roll={x * 1.9} running={engine} driver={false}>
            {/* the rotavator */}
            <path d={`M62 -22 L86 ${-22 + up} M60 -56 L86 ${-40 + up}`} stroke="#6f6f6f" strokeWidth={4} strokeLinecap="round" />
            <line x1={64} y1={-31} x2={86} y2={-26 + up} stroke="#9a9a9a" strokeWidth={6} />
            {turning && <line x1={64} y1={-31} x2={86} y2={-26 + up} stroke="#ffae00" strokeWidth={5} strokeDasharray="3 4" strokeDashoffset={-spin / 25} />}
            {bad.includes('pto') && <circle cx={76} cy={-28 + up / 2} r={12} fill="none" stroke="#d9473a" strokeWidth={3} className="ws-alarm" />}
            <rect x={84} y={-42 + up} width={48} height={26} rx={5} fill="#e07a1f" />
            <g transform={`translate(108,${-12 + up})`}>
              <g transform={`rotate(${turning ? spin : 0})`}>
                {[0, 60, 120, 180, 240, 300].map(a => (
                  <rect key={a} x={-1.5} y={-11} width={3} height={9} fill="#555" transform={`rotate(${a})`} />
                ))}
              </g>
            </g>
            {/* the hand brake, by the seat */}
            <path d={brake ? 'M20 -64 L14 -82' : 'M20 -64 L4 -68'} stroke="#444" strokeWidth={3} strokeLinecap="round" />
            <circle cx={brake ? 14 : 4} cy={brake ? -82 : -68} r={3.4} fill="#d9473a" />
            {farmer === 'seat' && (
              <g className="ws-grab" data-person="farmer" onPointerDown={e => b.drag('farmer', e, <span className="ws-emoji">🧑‍🌾</span>)}>
                <text x={30} y={-68} fontSize={26} textAnchor="middle">
                  🧑‍🌾
                </text>
                <rect x={14} y={-96} width={32} height={30} fill="transparent" />
              </g>
            )}
          </Tractor>
          {farmer === 'ground' && (
            <text x={60} y={G + 2} fontSize={30} textAnchor="middle" data-person="farmer" className={alarm > 0 ? 'ws-alarm' : undefined} onPointerDown={e => b.drag('farmer', e, <span className="ws-emoji">🧑‍🌾</span>)}>
              🧑‍🌾
            </text>
          )}
          {alarm > 0 && (
            <text x={x} y={40} textAnchor="middle" fontSize={22} className="ws-alarm">
              ⚠️
            </text>
          )}
        </>
      }
      controls={
        <>
          <Switch label="Tool" ctl="tool" on={toolUp} onChange={setToolUp} onText="Up" offText="Down" />
          <Switch label="PTO" ctl="pto" on={pto} onChange={setPto} />
          <Switch label="Hand brake" ctl="brake" on={brake} onChange={setBrake} />
          <Switch label="Engine" ctl="engine" on={engine} onChange={setEngine} onText="Running" offText="Off, key out" />
          <span className="ws-hint">Then drag the farmer down, or tap the farmer</span>
        </>
      }
    />
  );
}

/* ================================================================== */
/* Working safely 3: who rides on the tractor? (only the driver)       */
/* ================================================================== */

const PEOPLE = [
  { id: 'driver', icon: '🧑‍🌾', label: 'The driver', small: 'the driver' },
  { id: 'friend', icon: '👦', label: 'A friend', small: 'your friend' },
  { id: 'friend2', icon: '👩', label: 'Another friend', small: 'your other friend' },
  { id: 'child', icon: '🧒', label: 'A child', small: 'the child' },
];
const SPOTS: Record<string, { x: number; y: number; name: string }> = {
  seat: { x: 30, y: -68, name: 'In the seat' },
  guard: { x: 60, y: -46, name: 'On the mudguard' },
  hood: { x: -42, y: -60, name: 'On the bonnet' },
  bar: { x: 80, y: -10, name: 'On the drawbar' },
};

function RiderScene() {
  const ws = useWs();
  const once = useOnce();
  const G = 194;
  const S = 0.95;
  const START = 262;
  const GATE = 54;
  const [x, setX] = useState(START);
  const [where, setWhere] = useState<Record<string, string>>({ driver: 'seat', friend: 'guard', friend2: 'hood', child: 'bar' });
  const [fall, setFall] = useState<{ ids: string[]; t: number } | null>(null);
  const ride = useRef(0);
  const wrongSeat = useRef<string | null>(null);
  const drive = useRef(0);
  const spotAt = (s: string) => ({ x: x + SPOTS[s].x * S, y: G + SPOTS[s].y * S });
  const place = (id: string, spot: string) =>
    setWhere(w => {
      const n = { ...w };
      for (const k of Object.keys(n)) if (n[k] === spot && k !== id) n[k] = 'ground';
      n[id] = spot;
      return n;
    });
  const b = useBench({
    onDrop: (id, p) => {
      const s = p && Object.keys(SPOTS).find(k => near(p, spotAt(k), 22));
      place(id, s || 'ground');
    },
    onTap: id => {
      if (where[id] !== 'ground') return place(id, 'ground');
      const order = id === 'driver' ? ['seat', 'guard', 'hood', 'bar'] : ['guard', 'hood', 'bar', 'seat'];
      const free = order.find(s => !Object.values(where).includes(s));
      if (free) place(id, free);
    },
  });
  useFrames(dt => {
    if (fall) {
      const t = fall.t - dt;
      if (t <= 0) {
        setWhere(w => ({ ...w, ...Object.fromEntries(fall.ids.map(i => [i, 'ground'])) }));
        setFall(null);
      } else setFall({ ...fall, t });
      return;
    }
    if (!drive.current) return;
    const inSeat = Object.keys(where).find(k => where[k] === 'seat');
    if (!inSeat) return once.run('empty', () => ws.say('Nobody is in the seat to drive. Drag the driver into the seat.'));
    if (inSeat !== 'driver') {
      if (wrongSeat.current !== inSeat) {
        wrongSeat.current = inSeat;
        ws.slip(inSeat === 'child' ? 'A child must never drive a tractor. Only the trained driver sits in the seat.' : 'Only the trained driver drives. Put the driver back in the seat.');
      }
      return;
    }
    const nx = clamp(x + drive.current * 55 * dt, GATE + 80 * S - 4, START);
    if (nx === x) return;
    const riders = PEOPLE.filter(p => p.id !== 'driver' && where[p.id] !== 'ground').map(p => p.id);
    if (riders.length) {
      ride.current += Math.abs(nx - x);
      if (ride.current > 24) {
        ride.current = 0;
        setFall({ ids: riders, t: 1.6 });
        const names = riders.map(r => PEOPLE.find(p => p.id === r)!.small);
        const said = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
        ws.slip(`Bump! ${said[0].toUpperCase()}${said.slice(1)} fell off, right by the big wheels. The seat is for one: everyone else walks.`);
        return;
      }
    }
    setX(nx);
    if (nx <= GATE + 80 * S - 4 + 1) ws.win('Only the driver rides. There is one seat, and passengers fall under the wheels.');
  });
  const ground = PEOPLE.filter(p => where[p.id] === 'ground' && !fall?.ids.includes(p.id));
  return (
    <Bench
      b={b}
      label="A tractor with the driver in the seat and people riding on the mudguard, the bonnet and the drawbar"
      trayLabel="People: drag them on or off the tractor"
      scene={
        <>
          <Sky ground={G} />
          <path d={`M${GATE - 20} ${G} V${G - 40} M${GATE} ${G} V${G - 40} M${GATE - 20} ${G - 30} H${GATE} M${GATE - 20} ${G - 16} H${GATE}`} stroke="#a8612f" strokeWidth={4} />
          <text x={GATE - 10} y={G - 46} textAnchor="middle" fontSize={10} fontWeight={800} fill="#6b402b">
            Gate
          </text>
          <Tractor x={x} y={G} s={S} roll={x * 1.9} running driver={false} />
          {Object.keys(SPOTS)
            .filter(s => !Object.values(where).includes(s))
            .map(s => (
              <circle key={s} cx={spotAt(s).x} cy={spotAt(s).y - 9} r={9} className="ws-spot" />
            ))}
          {PEOPLE.filter(p => where[p.id] !== 'ground').map(p => {
            const at = spotAt(where[p.id]);
            const f = fall?.ids.includes(p.id) ? Math.min(1, (1.6 - fall.t) / 0.7) : 0;
            const fy = f ? Math.min(G + 2, at.y + f * f * 70) : at.y;
            return (
              <g key={p.id} className="ws-grab" data-person={p.id} transform={f ? `rotate(${f * 80} ${at.x} ${fy - 10})` : undefined} onPointerDown={e => !fall && b.drag(p.id, e, <span className="ws-emoji">{p.icon}</span>)}>
                <text x={at.x} y={fy} fontSize={22} textAnchor="middle">
                  {p.icon}
                </text>
                <rect x={at.x - 12} y={fy - 22} width={24} height={24} fill="transparent" />
              </g>
            );
          })}
          {fall && (
            <text x={x + 28 * S} y={G - 70} textAnchor="middle" fontSize={20} className="ws-alarm">
              ⚠️
            </text>
          )}
          {ground.map((p, k) => (
            <text key={p.id} x={300 + k * 18} y={H - 3} fontSize={17} textAnchor="middle" data-person={p.id} className="ws-grab" onPointerDown={e => b.drag(p.id, e, <span className="ws-emoji">{p.icon}</span>)}>
              {p.icon}
            </text>
          ))}
        </>
      }
      tray={PEOPLE.map(p => (
        <PartCard key={p.id} b={b} id={p.id} icon={<span className="ws-emoji">{p.icon}</span>} label={p.label} fitted={where[p.id] !== 'ground'} note={where[p.id] === 'ground' ? 'On the ground' : SPOTS[where[p.id]].name} />
      ))}
      controls={
        <>
          <Hold label="◀ Drive" ctl="drive" onHold={v => (drive.current = v ? -1 : 0)} disabled={!!fall} />
          <Hold label="Reverse ▶" ctl="back" onHold={v => (drive.current = v ? 1 : 0)} disabled={!!fall} />
        </>
      }
    />
  );
}

/* ================================================================== */
/* Look after the soil 1: driving on wet soil packs it hard            */
/* ================================================================== */

const CELLS = 12;
const cellX = (k: number, a = 20, z = 340) => a + ((k + 0.5) * (z - a)) / CELLS;

function WetSoilScene() {
  const ws = useWs();
  const G = 124;
  const S = 0.62;
  const START = 318;
  const END = 74;
  const [t, setT] = useState(0.05);
  const [x, setX] = useState(START);
  const [packed, setPacked] = useState(() => Array.from({ length: CELLS }, () => false));
  const [stuck, setStuck] = useState(0);
  const drive = useRef(0);
  const m = 0.92 - 0.6 * t;
  const dry = m <= 0.55;
  const b = useBench();
  const day = (to: number) => {
    const nt = clamp(Math.max(t, to), 0, 1);
    if (nt === t) return;
    setT(nt);
    const nm = 0.92 - 0.6 * nt;
    if (nm <= 0.55 && m > 0.55) ws.say('The soil is dry enough now: it crumbles in the hand instead of smearing.', 'good');
  };
  useFrames(dt => {
    if (stuck > 0) {
      const s = stuck - dt;
      if (s <= 0) {
        setStuck(0);
        setX(START);
      } else setStuck(s);
      return;
    }
    if (!drive.current) return;
    const nx = clamp(x + drive.current * 50 * dt, END, START);
    if (nx === x) return;
    setX(nx);
    if (!dry) {
      const wheels = [nx + 28 * S, nx - 52 * S];
      const hit = packed.map((v, k) => v || wheels.some(w => Math.abs(cellX(k) - w) < 8));
      if (hit.some((v, k) => v !== packed[k])) {
        setPacked(hit);
        setStuck(1.5);
        ws.slip('The wheels sank in. Wet soil squashes flat: its air spaces are gone, so roots and water cannot get through. Let the sun dry it first.');
        return;
      }
    }
    if (nx <= END) ws.win('Dry-enough soil carries the tractor: the wheels roll on top and the air spaces stay open.');
  });
  const ang = Math.PI * (1 - t) * 0.9 + Math.PI * 0.05;
  const sun = { x: 180 + 150 * Math.cos(ang), y: 112 - 92 * Math.sin(ang) };
  const w = 320 / CELLS;
  return (
    <Bench
      b={b}
      label="A wet field with the soil cut open to show its air spaces, a tractor, and the sun"
      scene={
        <>
          <rect width={W} height={H} fill={m > 0.6 ? '#b9cbd6' : '#cfeaf6'} />
          <g className="ws-grab" data-handle="sun" onPointerDown={e => b.follow(e, p => day((p.x - 32) / 296), (_, moved) => !moved && day(t + 0.25))}>
            <circle cx={sun.x} cy={sun.y} r={16} fill="#ffd25c" stroke="#fff" strokeWidth={2} />
            <text x={sun.x} y={sun.y + 3.5} textAnchor="middle" fontSize={9} fontWeight={800} fill="#6b402b">
              drag
            </text>
          </g>
          <g opacity={clamp((m - 0.5) * 2.5, 0, 1)}>
            <ellipse cx={120} cy={40} rx={34} ry={13} fill="#eef3f6" />
            <ellipse cx={150} cy={34} rx={26} ry={12} fill="#eef3f6" />
            <ellipse cx={250} cy={52} rx={30} ry={11} fill="#eef3f6" />
          </g>
          {/* soil water */}
          <g transform="translate(10,10)">
            <rect width={120} height={30} rx={8} fill="#fff8ea" stroke="#6b402b" strokeWidth={1.5} />
            <text x={8} y={12} fontSize={8} fontWeight={800} fill="#6b402b">
              Soil water · Day {1 + Math.floor(t * 3.99)}
            </text>
            <rect x={8} y={17} width={104} height={7} rx={3} fill="rgba(107,64,43,0.15)" />
            <rect x={8} y={17} width={104 * m} height={7} rx={3} fill={dry ? '#2f9b14' : '#22ade2'} />
            <line x1={8 + 104 * 0.55} x2={8 + 104 * 0.55} y1={14} y2={27} stroke="#6b402b" strokeWidth={1.5} />
          </g>
          {/* the field, cut open */}
          <rect y={G} width={W} height={H - G} fill="#7a5230" />
          <rect y={G} width={W} height={H - G} fill="#2b1a10" opacity={clamp((m - 0.3) * 0.7, 0, 0.5)} />
          {m > 0.7 && [60, 170, 280].map(px => <ellipse key={px} cx={px} cy={G + 1} rx={18} ry={2.5} fill="#8fc3dd" />)}
          {packed.map((p, k) => {
            const x0 = 20 + k * w;
            return (
              <g key={k} data-cell={p ? 'packed' : 'open'}>
                {p && <rect x={x0} y={G} width={w} height={52} fill="#3a2414" opacity={0.75} />}
                {[0.25, 0.5, 0.75].flatMap(fx =>
                  [16, 32, 48, 70].map(dy => (p && dy < 56 ? <ellipse key={`${fx}${dy}`} cx={x0 + w * fx} cy={G + dy} rx={2.6} ry={0.7} fill="#5a3a20" /> : <circle key={`${fx}${dy}`} cx={x0 + w * fx} cy={G + dy} r={2.6} fill="#e3cfa8" opacity={0.85} />)),
                )}
              </g>
            );
          })}
          <text x={8} y={H - 6} fontSize={8} fontWeight={800} fill="#f3e2c7">
            ○ air spaces in the soil
          </text>
          <Tractor x={x} y={G} s={S} roll={stuck > 0 ? stuck * 900 : x * 1.9} running sink={stuck > 0 ? 5 : 0} />
          <path d={`M${END - 80 * S} ${G} V${G - 30}`} stroke="#6b402b" strokeWidth={2} />
          <path d={`M${END - 80 * S} ${G - 30} l12 4 l-12 4 z`} fill="#ffae00" />
        </>
      }
      controls={
        <>
          <Step label="☀️ Wait a day" ctl="wait" onClick={() => day(t + 0.25)} disabled={t >= 1} />
          <Hold label="◀ Drive" ctl="drive" onHold={v => (drive.current = v ? -1 : 0)} disabled={stuck > 0} />
          <span className="ws-hint">{dry ? 'Dry enough to drive on' : m > 0.7 ? 'Wet and sticky' : 'Still too wet'}: drag the sun to let days pass</span>
        </>
      }
    />
  );
}

/* ================================================================== */
/* Look after the soil 2: ploughing too deep brings up subsoil         */
/* ================================================================== */

type Cell = null | 'good' | 'deep' | 'shallow';

function DeepScene() {
  const ws = useWs();
  const once = useOnce();
  const G = 92;
  const S = 0.58;
  const START = 276;
  const BACK = 71;
  const yOf = (cm: number) => G + cm * 2.9;
  const [depth, setDepth] = useState(30);
  const [x, setX] = useState(START);
  const [cells, setCells] = useState<Cell[]>(() => Array.from({ length: CELLS }, () => null));
  const [carbon, setCarbon] = useState(100);
  const drive = useRef(0);
  const slipped = useRef(false);
  const b = useBench();
  const done = cells.every(Boolean);
  const good = cells.filter(c => c === 'good').length;
  useFrames(dt => {
    if (!drive.current) {
      slipped.current = false;
      return;
    }
    const nx = clamp(x + drive.current * 55 * dt, -62, START);
    if (nx === x) return;
    setX(nx);
    if (drive.current > 0) return;
    const sx = nx + BACK;
    const nc = cells.slice();
    let changed = false;
    nc.forEach((c, k) => {
      if (c || Math.abs(cellX(k, 16, 344) - sx) > 6) return;
      changed = true;
      if (depth > 22) {
        nc[k] = 'deep';
        setCarbon(v => Math.max(0, v - 6));
        if (!slipped.current) {
          slipped.current = true;
          ws.slip('Too deep! The plough turned pale, poor subsoil up on top, and the topsoil’s carbon escapes into the air as CO₂.');
        }
      } else if (depth < 8) {
        nc[k] = 'shallow';
        once.run('shallow', () => ws.say('Too shallow: the plough only scratches the top.'));
      } else {
        nc[k] = 'good';
        once.run('good', () => ws.say('Just right: the dark topsoil turns over and stays on top.', 'good'));
      }
    });
    if (!changed) return;
    setCells(nc);
    if (nc.every(Boolean)) {
      if (nc.filter(c => c === 'good').length >= 9) ws.win('Shallow ploughing keeps the dark topsoil on top and its carbon in the ground. Vary the depth, or use a ripper.');
      else ws.say('Too much of the strip went wrong. Press “Plough it again” and keep the plough shallow.', 'bad');
    }
  });
  const again = () => {
    setCells(cells.map(() => null));
    setX(START);
    setCarbon(100);
    once.reset('good');
  };
  const w = (344 - 16) / CELLS;
  const sx = x + BACK;
  const zone = depth > 22 ? 'too deep' : depth < 8 ? 'too shallow' : 'just right';
  return (
    <Bench
      b={b}
      label="A field cut open to show dark topsoil over pale subsoil, and a tractor pulling a plough"
      scene={
        <>
          <rect width={W} height={G} fill="#cfeaf6" />
          <rect y={G} width={W} height={yOf(20) - G} fill="#4a2f1a" />
          <rect y={yOf(20)} width={W} height={H - yOf(20)} fill="#c99a62" />
          {Array.from({ length: 40 }, (_, i) => (
            <circle key={i} cx={(i * 47) % 350 + 6} cy={G + 8 + ((i * 13) % 46)} r={1.3} fill="#1e130b" />
          ))}
          <path d="M60 118 q5 -4 10 0 t10 0" stroke="#e79a9a" strokeWidth={2} fill="none" />
          <path d="M230 130 q5 -4 10 0 t10 0" stroke="#e79a9a" strokeWidth={2} fill="none" />
          <text x={6} y={G + 14} fontSize={8} fontWeight={800} fill="#f3e2c7">
            topsoil: dark, full of carbon
          </text>
          <text x={6} y={H - 8} fontSize={8} fontWeight={800} fill="#6b402b">
            subsoil: pale and poor
          </text>
          {cells.map((c, k) => {
            const x0 = 16 + k * w;
            return (
              <g key={k} data-cell={c ?? 'none'}>
                {c === 'good' && <path d={`M${x0} ${G} q${w / 4} -5 ${w / 2} 0 t${w / 2} 0`} fill="#3b2412" stroke="#2a1a0c" />}
                {c === 'shallow' && <path d={`M${x0 + 3} ${G + 2} h${w - 6}`} stroke="#2a1a0c" strokeDasharray="3 2" />}
                {c === 'deep' && (
                  <>
                    <rect x={x0} y={G} width={w} height={22} fill="#c99a62" opacity={0.85} />
                    {[0.2, 0.5, 0.8].map(f => (
                      <ellipse key={f} cx={x0 + w * f} cy={G - 2} rx={4.5} ry={3} fill="#d8b27c" stroke="#a87a45" />
                    ))}
                    <text x={x0 + w / 2} y={G - 10} textAnchor="middle" fontSize={7} fontWeight={800} fill="#777" className="ws-co2">
                      CO₂
                    </text>
                  </>
                )}
              </g>
            );
          })}
          {/* the depth scale */}
          {[0, 10, 20, 30, 40].map(cm => (
            <g key={cm}>
              <line x1={346} x2={352} y1={yOf(cm)} y2={yOf(cm)} stroke="#fff" strokeWidth={1.5} />
              <text x={344} y={yOf(cm) + 3} textAnchor="end" fontSize={7} fill="#fff" fontWeight={700}>
                {cm}
              </text>
            </g>
          ))}
          <rect x={353} y={yOf(8)} width={5} height={yOf(22) - yOf(8)} fill="#7ccf5a" />
          <line x1={0} x2={W} y1={yOf(depth)} y2={yOf(depth)} stroke="#fff" strokeDasharray="2 4" opacity={0.6} />
          <Tractor x={x} y={G} s={S} roll={x * 1.9} running />
          {/* the plough, on its depth */}
          <path d={`M${x + 62 * S} ${G - 14} L${sx - 6} ${G - 10} L${sx} ${yOf(depth)}`} stroke="#c0432f" strokeWidth={4} fill="none" strokeLinejoin="round" />
          <g className="ws-grab" data-handle="share" onPointerDown={e => b.follow(e, p => setDepth(clamp(Math.round((p.y - G) / 2.9), 4, 36)))}>
            <path d={`M${sx - 10} ${yOf(depth) + 3} Q${sx} ${yOf(depth) - 8} ${sx + 10} ${yOf(depth) - 2} L${sx + 6} ${yOf(depth) + 3} Z`} fill="#8a8a8a" stroke="#555" />
            <circle cx={sx} cy={yOf(depth)} r={9} fill="rgba(255,174,0,0.35)" stroke="#ffae00" strokeWidth={1.5} />
          </g>
          {/* carbon in the topsoil */}
          <g transform="translate(8,8)">
            <rect width={130} height={28} rx={8} fill="#fff8ea" stroke="#6b402b" strokeWidth={1.5} />
            <text x={8} y={12} fontSize={8} fontWeight={800} fill="#6b402b">
              Carbon in the topsoil: {Math.round(carbon)}%
            </text>
            <rect x={8} y={16} width={114} height={6} rx={3} fill="rgba(107,64,43,0.15)" />
            <rect x={8} y={16} width={(114 * carbon) / 100} height={6} rx={3} fill={carbon > 80 ? '#2f9b14' : '#d9473a'} />
          </g>
        </>
      }
      controls={
        <>
          <Lever label="Plough depth" ctl="depth" min={4} max={36} value={depth} onChange={setDepth} show={`${depth} cm, ${zone}`} />
          <Hold label="◀ Plough" ctl="drive" onHold={v => (drive.current = v ? -1 : 0)} disabled={done} />
          {done && !ws.won && <Step label="↺ Plough it again" ctl="reset" onClick={again} />}
          {!done && good === 0 && <span className="ws-hint">Or drag the plough’s blade up and down</span>}
        </>
      }
    />
  );
}

/* ================================================================== */
/* Look after the soil 3: tyre pressure for the field: lower           */
/* ================================================================== */

function TyreScene() {
  const ws = useWs();
  const G = 90;
  const S = 0.42;
  const START = 320;
  const END = 50;
  const DIAL = { x: 268, y: 170, r: 36 };
  const [p, setP] = useState(1.8);
  const [x, setX] = useState(START);
  const [rut, setRut] = useState<{ x: number; p: number }[]>([]);
  const [stuck, setStuck] = useState(0);
  const dist = useRef(0);
  const drive = useRef(0);
  const b = useBench();
  const set = (v: number) => setP(Math.round(clamp(v, 0.3, 2.4) * 20) / 20);
  const zone = p < 0.6 ? 'flat' : p < 0.7 ? 'very soft' : p <= 1.3 ? 'field' : p < 1.6 ? 'hard' : p <= 2.1 ? 'road' : 'too hard';
  useFrames(dt => {
    if (stuck > 0) {
      const s = stuck - dt;
      if (s <= 0) {
        setStuck(0);
        setX(START);
        setRut([]);
      } else setStuck(s);
      return;
    }
    if (!drive.current) {
      dist.current = 0;
      return;
    }
    const nx = clamp(x - 60 * dt, END, START);
    if (nx === x) return;
    dist.current += x - nx;
    setX(nx);
    if (!rut.length || rut[rut.length - 1].x - nx > 3) setRut([...rut, { x: nx + 28 * S, p }]);
    if (p > 1.3 && dist.current > 50) {
      setStuck(1.4);
      ws.slip('Hard tyres press a narrow, deep rut and pack the soil hard, far down. Let some air out for the field.');
    } else if (p < 0.6 && dist.current > 40) {
      setStuck(1.4);
      ws.slip('Too soft: the tyre wall folds over, and it can tear or spin on the rim. Pump some air back in.');
    } else if (nx <= END) ws.win('Lower pressure spreads the weight over a wider footprint, so the soil is packed less. Pump the tyres up again for the road.');
  });
  const sag = (2.4 - p) * 7;
  const foot = 24 + (2.4 - p) * 30;
  const ang = 200 - (p / 2.5) * 220;
  const band = (a: number, z: number, c: string) => <path d={arc(DIAL.r, 200 - (a / 2.5) * 220, 200 - (z / 2.5) * 220)} stroke={c} strokeWidth={7} fill="none" />;
  return (
    <Bench
      b={b}
      label="A tractor about to cross a field, a close-up of its tyre on the soil, and a pressure gauge"
      scene={
        <>
          <rect width={W} height={G} fill="#cfeaf6" />
          <rect y={G} width={W} height={22} fill="#7a4a24" />
          <rect y={G} width={W} height={3} fill="#7cb342" />
          {rut.map((r, k) => (
            <rect key={k} x={r.x - 2} y={G} width={4.5} height={1.5 + r.p * 3} fill="#3a2414" />
          ))}
          <Tractor x={x} y={G} s={S} roll={stuck > 0 ? stuck * 900 : x * 1.9} running sink={stuck > 0 ? 3 : 0} />
          <path d={`M${END - 80 * S} ${G} V${G - 26}`} stroke="#6b402b" strokeWidth={2} />
          <path d={`M${END - 80 * S} ${G - 26} l12 4 l-12 4 z`} fill="#ffae00" />
          <g transform="translate(250,8)">
            <rect width={102} height={20} rx={8} fill="#fff8ea" stroke="#6b402b" strokeWidth={1.5} />
            <text x={51} y={13.5} textAnchor="middle" fontSize={8.5} fontWeight={800} fill="#6b402b">
              Tyres: {p.toFixed(1)} bar ({zone})
            </text>
          </g>
          {/* under the tyre, close up */}
          <rect y={112} width={W} height={H - 112} fill="#fff8ea" />
          <line x1={0} x2={W} y1={112} y2={112} stroke="#6b402b" strokeWidth={2} />
          <text x={8} y={124} fontSize={8} fontWeight={800} fill="#6b402b">
            Under the tyre
          </text>
          <rect x={14} y={196} width={170} height={24} fill="#8a5a30" />
          <ellipse cx={96} cy={196} rx={foot / 2 + 4} ry={6 + p * 7} fill="#4a2a12" opacity={0.3 + p * 0.2} />
          <Wheel cx={96} cy={196 - 40} r={40} squash={sag} rot={x * 1.9} />
          {p < 0.6 && (
            <g stroke="#d9473a" strokeWidth={2.2} fill="none">
              <path d={`M${96 - 46} 186 q-6 6 0 10 M${96 + 46} 186 q6 6 0 10`} />
            </g>
          )}
          <line x1={96 - foot / 2} x2={96 + foot / 2} y1={197} y2={197} stroke="#ffae00" strokeWidth={3} />
          <text x={150} y={132} fontSize={8} fontWeight={800} fill="#6b402b">
            {foot > 60 ? 'wide footprint' : 'narrow footprint'}
          </text>
          <text x={150} y={143} fontSize={8} fontWeight={800} fill="#6b402b">
            packed {p > 1.3 ? 'deep' : 'shallow'}
          </text>
          {/* the pressure gauge: drag its needle */}
          <g transform={`translate(${DIAL.x},${DIAL.y})`} className="ws-grab" data-handle="gauge" onPointerDown={e => b.follow(e, q => {
            let a = (Math.atan2(-(q.y - DIAL.y), q.x - DIAL.x) * 180) / Math.PI;
            if (a < -90) a += 360;
            set(((200 - a) / 220) * 2.5);
          })}>
            <circle r={DIAL.r + 10} fill="#fff" stroke="#6b402b" strokeWidth={2} />
            {band(0.3, 0.6, '#d9473a')}
            {band(0.7, 1.3, '#2f9b14')}
            {band(1.6, 2.1, '#22ade2')}
            {band(2.1, 2.5, '#d9473a')}
            <text x={polar(200 - (1 / 2.5) * 220, 22).x} y={polar(200 - (1 / 2.5) * 220, 22).y + 3} textAnchor="middle" fontSize={7} fontWeight={800} fill="#2f9b14">
              field
            </text>
            <text x={polar(200 - (1.85 / 2.5) * 220, 22).x} y={polar(200 - (1.85 / 2.5) * 220, 22).y + 3} textAnchor="middle" fontSize={7} fontWeight={800} fill="#1a7fb0">
              road
            </text>
            <line x2={polar(ang, DIAL.r - 4).x} y2={polar(ang, DIAL.r - 4).y} stroke="#2a1a10" strokeWidth={3} strokeLinecap="round" />
            <circle r={4} fill="#2a1a10" />
            <text y={24} textAnchor="middle" fontSize={10} fontWeight={800} fill="#6b402b">
              {p.toFixed(1)} bar
            </text>
          </g>
        </>
      }
      controls={
        <>
          <Step label="− Let air out" ctl="vent" onClick={() => set(p - 0.1)} />
          <Step label="＋ Pump" ctl="pump" onClick={() => set(p + 0.1)} />
          <Hold label="◀ Drive" ctl="drive" onHold={v => (drive.current = v ? -1 : 0)} disabled={stuck > 0} />
          <span className="ws-hint">Or drag the gauge’s needle</span>
        </>
      }
    />
  );
}

export const SCENES: Record<ArtId, () => ReactNode> = {
  pto: PtoScene,
  linkage: LinkageScene,
  radiator: RadiatorScene,
  slope: SlopeScene,
  getoff: GetOffScene,
  rider: RiderScene,
  wetsoil: WetSoilScene,
  deep: DeepScene,
  tyre: TyreScene,
};
