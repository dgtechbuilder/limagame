import type { Dispatch } from 'react';
import { ModalShell } from '../components/Modal';
import { GoldButton } from '../components/ui';
import { fmt } from '../components/ui';
import type { Action, GameState } from '../state';

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
        { label: 'Shop', note: 'Seeds, fertilizer, tools', run: () => open({ kind: 'shop', tab: 'food' }) },
        { label: 'Rewards', note: 'Points for real discounts', run: () => open({ kind: 'rewards' }) },
        { label: 'Farming steps', note: 'The classic maize season', run: () => open({ kind: 'steps', step: 'landprep' }) },
        { label: 'Settings', note: 'Farm view, full screen', run: () => open({ kind: 'settings' }) },
      ];
  return (
    <ModalShell frame="shop" x={178} y={28} title="Main menu" close={[633, 56]} onClose={() => dispatch({ type: 'close' })} isMenu>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254, padding: '12px 18px' }}>
        <p className="section-title">
          {s.farmer?.name ?? 'Farmer'} · Level {s.level} <span style={{ fontWeight: 400, opacity: 0.75 }}>· {fmt(s.coins)} coins · {fmt(s.points)} points</span>
        </p>
        <div className="menu-grid">
          {items.map(it => (
            <div key={it.label} className="menu-item">
              <GoldButton font={11} height={30} style={{ width: '100%' }} onClick={it.run}>
                {it.label}
              </GoldButton>
              <small>{it.note}</small>
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
