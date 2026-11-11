import { useEffect, useRef, useState, type Dispatch, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { ModalShell } from '../components/Modal';
import { GoldButton } from '../components/ui';
import { fmt } from '../components/ui';
import type { Action, GameState } from '../state';
import { money } from '../money';

/* The main menu: one place to reach every part of the game from any screen. It opens on top of whatever the player
   is doing, so Back (or the close button) returns to it. */

type Item = { label: string; note: string; run: () => void };

export function MainMenu({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const intro = s.fs.phase !== 'done';
  const open = (modal: GameState['modal']) => modal && dispatch({ type: 'open', modal });
  const items: Item[] = intro
    ? [
        { label: 'Back to the game', note: 'Carry on where you were', run: () => dispatch({ type: 'close' }) },
        { label: 'How the farm works', note: 'A quick guide', run: () => open({ kind: 'welcome' }) },
        { label: 'Settings', note: 'Full screen, reset', run: () => open({ kind: 'settings' }) },
      ]
    : [
        { label: 'My farm', note: 'Back to the farm', run: () => dispatch({ type: 'home' }) },
        { label: 'Mission', note: 'Plan, progress, results', run: () => dispatch({ type: 'trials', open: true }) },
        { label: 'Field rounds', note: 'Check every bed', run: () => dispatch({ type: 'rounds', open: true }) },
        { label: 'Tractor', note: 'Pick a type and tool, work a plot', run: () => dispatch({ type: 'ride' }) },
        { label: 'Tractor business', note: 'Serve farms, plan routes, partners', run: () => dispatch({ type: 'biz', open: true }) },
        { label: 'Shop', note: 'Seeds, fertilizer, tools', run: () => open({ kind: 'shop', tab: 'food' }) },
        { label: 'Climate', note: 'Emissions, water, soil, credits', run: () => open({ kind: 'climate' }) },
        { label: 'Rewards', note: 'Points for real discounts', run: () => open({ kind: 'rewards' }) },
        { label: 'Farming steps', note: 'The classic maize season', run: () => open({ kind: 'steps', step: 'landprep' }) },
        { label: 'Settings', note: 'Farm view, full screen', run: () => open({ kind: 'settings' }) },
      ];
  return (
    <ModalShell frame="shop" x={178} y={28} title="Main menu" close={[633, 56]} onClose={() => dispatch({ type: 'close' })} isMenu>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254, padding: '12px 18px' }}>
        <p className="section-title">
          {s.farmer?.name ?? 'Farmer'} · Level {s.level} <span style={{ fontWeight: 400, opacity: 0.75 }}>· {money(s.coins)} coins · {fmt(s.points)} points</span>
        </p>
        <MenuScroll>
          {items.map(it => (
            <div key={it.label} className="menu-item">
              <GoldButton font={11} height={30} style={{ width: '100%' }} onClick={it.run}>
                {it.label}
              </GoldButton>
              <small>{it.note}</small>
            </div>
          ))}
        </MenuScroll>
      </div>
    </ModalShell>
  );
}

/** The menu's items in a scrolling box, with a scroll wheel beside it: up and down buttons and a thumb to drag, as
    phones hide their own scroll bars. The mouse wheel, a swipe and the keyboard scroll it too. */
function MenuScroll({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, view: 1 });
  const measure = () => {
    const el = box.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setPos({ top: max > 0 ? el.scrollTop / max : 0, view: el.scrollHeight ? Math.min(1, el.clientHeight / el.scrollHeight) : 1 });
  };
  useEffect(measure, []);
  const by = (dy: number) => box.current?.scrollBy({ top: dy, behavior: 'smooth' });
  // drag the thumb: the box follows
  const drag = (e: RPointerEvent<HTMLSpanElement>) => {
    const el = box.current;
    const track = e.currentTarget.parentElement;
    if (!el || !track) return;
    e.preventDefault();
    const y0 = e.clientY;
    const s0 = el.scrollTop;
    const scale = (el.scrollHeight - el.clientHeight) / (track.clientHeight * (1 - pos.view) || 1);
    const move = (ev: PointerEvent) => (el.scrollTop = s0 + (ev.clientY - y0) * scale);
    const up = () => (window.removeEventListener('pointermove', move), window.removeEventListener('pointerup', up));
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const scrolls = pos.view < 1;
  return (
    <div className="menu-scroll">
      <div ref={box} className="menu-grid" tabIndex={0} role="group" aria-label="Menu items" onScroll={measure}>
        {children}
      </div>
      {scrolls && (
        <div className="menu-wheel" aria-label="Scroll the menu">
          <button type="button" aria-label="Scroll up" disabled={pos.top <= 0.001} onClick={() => by(-90)}>
            ▲
          </button>
          <span className="menu-track">
            <span className="menu-thumb" style={{ height: `${pos.view * 100}%`, top: `${pos.top * (1 - pos.view) * 100}%` }} onPointerDown={drag} />
          </span>
          <button type="button" aria-label="Scroll down" disabled={pos.top >= 0.999} onClick={() => by(90)}>
            ▼
          </button>
        </div>
      )}
    </div>
  );
}
