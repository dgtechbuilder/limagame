import type { Dispatch } from 'react';
import { img } from '../assets';
import type { Action, GameState, Modal } from '../state';
import { GoArrow, MailIcon, SettingsIcon, TimerIcon } from './Icons';
import { Img } from './ui';

/**
 * The farm (Figma frames "Game"): background art, HUD, task list and field actions.
 * All coordinates are on the 874 × 402 landscape stage, measured from the Figma frames.
 */
export function FarmScene({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const busy = s.modal !== null; // the Figma modal frames hide the field HUD
  const open = (modal: Modal) => dispatch({ type: 'open', modal });

  const tasks: { days: number; label: string; go: () => void }[] = [
    { days: 7, label: 'Harvest', go: () => open({ kind: 'steps', step: 'harvest' }) },
    { days: 5, label: 'Pesticides', go: () => open({ kind: 'steps', step: 'pesticides' }) },
    { days: 3, label: 'Fertilizer', go: () => open({ kind: 'steps', step: 'fertilizer' }) },
  ];

  const coinFill = Math.min(1, s.coins / 16000);
  const waterFill = Math.min(1, s.water / 27);

  return (
    <>
      <img className="farm-bg" src={img.bg} alt="Ojuok's farm: goats, chickens, a market stall and crop plots" draggable={false} />
      <div className="top-shade" />
      {s.plotSelected && <div className="abs" style={{ inset: 0, background: 'rgba(0,0,0,0.32)', pointerEvents: 'none' }} />}

      {/* Crop plots (tap targets over the painted background) */}
      <button
        type="button"
        className="plot-hit"
        aria-label="Select Farm Moja (spinach plot)"
        style={{ left: 176, top: 222, width: 168, height: 92 }}
        onClick={() => dispatch({ type: 'selectPlot', on: !s.plotSelected })}
      />
      <button
        type="button"
        className="plot-hit"
        aria-label="Maize plot: check harvest timing"
        style={{ left: 336, top: 160, width: 210, height: 100 }}
        onClick={() => open({ kind: 'timing' })}
      />
      <button
        type="button"
        className="plot-hit"
        aria-label="Tomato plot: open harvest info"
        style={{ left: 516, top: 226, width: 210, height: 92 }}
        onClick={() => open({ kind: 'info' })}
      />

      {!busy && (<>
      {/* Title plank */}
      <div className="abs" style={{ left: 346, top: 6, width: 203, height: 58 }}>
        <Img src={img.plank} w={203} h={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 23, textAlign: 'center', fontSize: 14 }}>
          Lima Farming Game
        </span>
      </div>
      </>)}

      {/* Profile: avatar, level star + XP, farm name */}
      <button
        type="button"
        className="peach-btn inset-dark abs"
        style={{ left: 39, top: 24, width: 61, height: 53, padding: 4, borderWidth: 1 }}
        aria-label="Farm results"
        onClick={() => open({ kind: 'outcome' })}
      >
        <Img src={img.avatar} w={53} h={45} style={{ borderRadius: 10, objectFit: 'cover' }} />
      </button>
      <div className="meter abs" style={{ left: 104, top: 36, width: 81, backdropFilter: 'blur(2.5px)' }}>
        <span className="fill" style={{ width: Math.max(8, 79 * s.xp), background: 'var(--xp)' }} />
      </div>
      <div className="abs" style={{ left: 100, top: 26, width: 30, height: 30, display: 'grid', placeItems: 'center' }}>
        <Img src={img.star} w={30} h={30} style={{ position: 'absolute', inset: 0 }} />
        <span style={{ position: 'relative', fontSize: 8, fontWeight: 600, color: '#fff', marginTop: 1 }} aria-label={`Level ${s.level}`}>
          {s.level}
        </span>
      </div>
      {!busy && (
        <div className="abs" style={{ left: 104, top: 59 }}>
          <p className="label" style={{ fontSize: 14, fontWeight: 700 }}>Ojuoks farm</p>
          <p className="label" style={{ fontSize: 12 }}>1 acre</p>
        </div>
      )}

      {/* Resources (coins in thousands, water tank level) */}
      <div className="meter abs" style={{ left: 713, top: 31, width: 60 }} title={`${s.coins.toLocaleString('en-US')} coins`}>
        <span className="fill" style={{ width: Math.max(10, 58 * coinFill), background: 'var(--xp)' }} />
        <span className="value">{Math.floor(s.coins / 1000)}</span>
      </div>
      <Img src={img.coin} w={14} h={14} style={{ position: 'absolute', left: 758, top: 30 }} />
      <div className="meter abs" style={{ left: 713, top: 51, width: 60 }} title={`${(s.water * 1000).toLocaleString('en-US')} L of water`}>
        <span className="fill" style={{ width: Math.max(10, 58 * waterFill), background: 'var(--water)' }} />
        <span className="value">{Math.round(s.water)}</span>
      </div>
      <Img src={img.drop} w={14} h={14} style={{ position: 'absolute', left: 758, top: 50 }} />

      <button
        type="button"
        className="peach-btn abs"
        style={{ left: 779, top: 24, width: 56, height: 48.66 }}
        aria-label="Rewards and discounts"
        onClick={() => open({ kind: 'rewards' })}
      >
        <Img src={img.sack} w={32} h={32} />
      </button>
      <button
        type="button"
        className="peach-btn small inset-dark abs"
        style={{ left: busy ? 39 : 774, top: busy ? 85 : 77, width: 28, height: 28 }}
        aria-label="Settings"
        onClick={() => dispatch({ type: 'toast', text: 'Settings are coming soon' })}
      >
        <SettingsIcon size={20} />
      </button>
      <button
        type="button"
        className="peach-btn small inset-dark abs"
        style={{ left: busy ? 72 : 807, top: busy ? 85 : 77, width: 28, height: 28 }}
        aria-label="Messages"
        onClick={() => dispatch({ type: 'toast', text: 'No new messages' })}
      >
        <MailIcon size={20} />
      </button>

      {!busy && (<>
      {/* Next task */}
      <div className="abs" style={{ left: 39, top: 127 }}>
        <p className="label" style={{ fontSize: 14, height: 21 }}>Next Task</p>
        <ul style={{ listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map(t => (
            <li key={t.label}>
              <button type="button" className="task-row" onClick={t.go}>
                <TimerIcon size={16} />
                <span style={{ marginLeft: 2 }}>
                  {t.days} days : {t.label}
                </span>
                <GoArrow size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Days to next stage */}
      <div className="abs task-row" style={{ left: 39, top: 364, fontSize: 14, gap: 4 }}>
        <TimerIcon size={16} />
        <span>Days to next stage</span>
      </div>

      {/* Learn + Shop buttons */}
      <button
        type="button"
        className="abs"
        style={{ left: 41, top: 281, width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
        onClick={() => open({ kind: 'steps', step: 'landprep' })}
        aria-label="Learn: farming steps"
      >
        <span className="peach-btn" style={{ width: 56, height: 48.66 }}>
          <Img src={img.infoBtn} w={22} h={22} />
        </span>
        <span className="label" style={{ fontSize: 14 }}>Learn</span>
      </button>
      <button
        type="button"
        className="abs"
        style={{ left: 779, top: 310, width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
        onClick={() => open({ kind: 'shop', tab: 'food' })}
        aria-label="Shop"
      >
        <span className="peach-btn" style={{ width: 56, height: 48.66 }}>
          <Img src={img.cart} w={28} h={28} />
        </span>
        <span className="label" style={{ fontSize: 14 }}>Shop</span>
      </button>

      {/* Field action bubbles */}
      {!s.plotSelected && (
        <>
          <FieldAction left={393} top={280} width={60} icon={img.sprout} label="Plant now" onClick={() => open({ kind: 'steps', step: 'planting' })} />
          <FieldAction left={528} top={194} width={45} icon={img.sprout} ariaLabel="Plant maize" onClick={() => open({ kind: 'steps', step: 'planting' })} />
          <FieldAction left={711} top={259} width={45} icon={img.sprout} ariaLabel="Plant tomatoes" onClick={() => open({ kind: 'steps', step: 'planting' })} />
          {!s.collected.includes('milk') && (
            <FieldAction
              left={334}
              top={62}
              width={54}
              icon={img.milk}
              label="Milk now"
              onClick={() => dispatch({ type: 'collect', id: 'milk', coins: 30, text: 'Collected 3 L of goat milk · +30 coins' })}
            />
          )}
          {!s.collected.includes('eggs') && (
            <FieldAction
              left={563}
              top={109}
              width={81}
              icon={img.egg}
              label="Harvest eggs"
              onClick={() => dispatch({ type: 'collect', id: 'eggs', coins: 20, text: 'Collected 12 eggs · +20 coins' })}
            />
          )}
        </>
      )}

      </>)}

      {/* First-run hint (Figma "Game" variant with the speech bubble) */}
      {s.showHint && (
        <button type="button" className="speech" style={{ left: 31, top: 229, width: 131, height: 86 }} onClick={() => dispatch({ type: 'hint', on: false })}>
          <img src={img.tipBubble} alt="" style={{ transform: 'scaleX(-1)' }} />
          <span style={{ width: 100, padding: '10px 0 0' }}>Sell your freshly harvested crops to earn money</span>
        </button>
      )}

      {s.plotSelected && <SelectedPlot dispatch={dispatch} />}
    </>
  );
}

function FieldAction({
  left,
  top,
  width,
  icon,
  label,
  ariaLabel,
  onClick,
}: {
  left: number;
  top: number;
  width: number;
  icon: string;
  label?: string;
  ariaLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="abs"
      style={{ left, top, width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
      onClick={onClick}
      aria-label={ariaLabel ?? label}
    >
      <span className="bubble-btn">
        <Img src={icon} w={25} h={24} />
      </span>
      {label && <span className="label" style={{ fontSize: 12 }}>{label}</span>}
    </button>
  );
}

/** Figma "Game" variant with the selected plot, pointer arrows and the four farm actions. */
function SelectedPlot({ dispatch }: { dispatch: Dispatch<Action> }) {
  const arrows = [
    { left: 136, top: 243, size: 34, nx: '3px', ny: '0px' },
    { left: 279, top: 184, size: 37, nx: '0px', ny: '3px' },
    { left: 337, top: 250, size: 39, nx: '-3px', ny: '0px' },
    { left: 203, top: 306, size: 40, nx: '2px', ny: '-2px' },
  ];
  const actions = [
    { label: 'Info', icon: img.farmInfo, onClick: () => dispatch({ type: 'open', modal: { kind: 'info' } }) },
    { label: 'Farm', icon: img.farmFarm, onClick: () => dispatch({ type: 'open', modal: { kind: 'steps', step: 'landprep' } }) },
    { label: 'Upgrade', icon: img.farmUpgrade, onClick: () => dispatch({ type: 'open', modal: { kind: 'value' } }) },
    { label: 'Harvest', icon: img.farmHarvest, onClick: () => dispatch({ type: 'open', modal: { kind: 'timing' } }) },
  ];
  return (
    <>
      <img src={img.plotHighlight} alt="" className="abs" style={{ left: 171, top: 218, width: 178, height: 97, pointerEvents: 'none' }} />
      <div className="plot-glow" style={{ left: 171, top: 218, width: 178, height: 97 }} />
      {arrows.map((a, i) => (
        <img
          key={i}
          src={img.arrows[i]}
          alt=""
          className="plot-arrow"
          style={{ left: a.left, top: a.top, width: a.size, height: a.size, ['--nx' as string]: a.nx, ['--ny' as string]: a.ny }}
        />
      ))}
      <div className="abs" style={{ left: 349, top: 263, width: 176, textAlign: 'center' }}>
        <p className="label" style={{ fontSize: 16, fontWeight: 700 }}>Farm Moja</p>
        <p className="label" style={{ fontSize: 12 }}>1 acre</p>
      </div>
      <div className="abs" style={{ left: 279, top: 316, display: 'flex', gap: 12 }}>
        {actions.map(a => (
          <button key={a.label} type="button" className="farm-action" onClick={a.onClick}>
            <Img src={a.icon} w={32} h={32} />
            <span>{a.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
