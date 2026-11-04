import type { Dispatch } from 'react';
import { img } from '../assets';
import { STEP_META, STEPS } from '../data';
import { SELLING, SOLD, daysToHarvest, stepIndex, today, type Action, type GameState, type Modal } from '../state';
import { FarmerPortrait } from '../first/art';
import { FarmMap } from './FarmMap';
import { LOOKS } from '../first/data';
import { GoArrow, MailIcon, SettingsIcon, TimerIcon } from './Icons';
import { Img, fmt } from './ui';
import { CHECK_DAYS, checkKey, currentDay } from '../trials/model';
import { dayNumber } from '../rounds/farms';

/** What the six farms need now: a count of farms to check today, '!' at harvest time, or nothing. */
function trialBadge(s: GameState): string | null {
  const t = s.trial;
  if (!t || t.phase !== 'growing') return null;
  const day = currentDay(t, dayNumber());
  if (day > CHECK_DAYS) return '!';
  const left = t.plans.filter((_, i) => !t.checks[checkKey(i, day)]).length;
  return left ? String(left) : null;
}

/** What the player should do now, used by Next Task, the field bubble and the farm card. */
export function nextAction(s: GameState): { label: string; short: string; icon: string; modal: Modal } {
  if (s.stage < STEPS.length) {
    const st = STEPS[s.stage];
    const short: Record<string, string> = {
      landprep: 'Prepare land',
      planting: 'Plant now',
      fertilizer: 'Fertilize',
      pesticides: 'Protect crop',
      water: 'Water now',
      harvest: 'Harvest now',
    };
    return { label: st.label, short: short[st.id], icon: st.icon, modal: { kind: 'steps', step: st.id } };
  }
  if (s.stage === SELLING) return { label: 'Sell harvest', short: 'Sell harvest', icon: img.coinBig, modal: { kind: 'sale' } };
  return { label: `Start season ${s.season + 1}`, short: 'New season', icon: img.sprout, modal: { kind: 'outcome' } };
}

/**
 * The farm (Figma frames "Game"): background art, HUD, task list and field actions.
 * All coordinates are on the 874 × 402 landscape stage, measured from the Figma frames.
 */
export function FarmScene({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const busy = s.modal !== null; // the Figma modal frames hide the field HUD
  const open = (modal: Modal) => dispatch({ type: 'open', modal });
  const now = nextAction(s);

  // Next Task: the current step, then the next two with the days until they start.
  const tasks: { when: string; label: string; go: () => void }[] = [{ when: 'Now', label: now.label, go: () => open(now.modal) }];
  if (s.stage < STEPS.length) {
    let days = STEP_META[STEPS[s.stage].id].days;
    for (const st of STEPS.slice(s.stage + 1, s.stage + 3)) {
      tasks.push({ when: `${days} days`, label: st.label, go: () => open({ kind: 'steps', step: st.id }) });
      days += STEP_META[st.id].days;
    }
  }

  const stageLine =
    s.stage < stepIndex('harvest')
      ? `Day ${s.day} · ${daysToHarvest(s)} days to harvest`
      : s.stage === stepIndex('harvest')
        ? `Day ${s.day} · your maize is ready to harvest`
        : s.stage === SELLING
          ? `${s.harvested?.bags ?? 0} bags in store · ready to sell`
          : `Season ${s.season} sold · see your results`;

  const coinFill = Math.min(1, s.coins / 16000);
  const waterFill = Math.min(1, s.water / 40);
  const showHint = s.onboarded && !busy && !s.plotSelected && s.season === 1 && s.stage === 0 && s.doneTasks.length === 0;

  return (
    <>
      <FarmMap alt={`${s.farmer?.name ?? 'Ojuok'}'s farm: goats, chickens, a market stall and crop plots`} />
      <div className="top-shade" />
      {s.plotSelected && <div className="abs" style={{ inset: 0, background: 'rgba(0,0,0,0.32)', pointerEvents: 'none' }} />}

      {/* Farm Moja: the maize plot the season is played on */}
      <button
        type="button"
        className="plot-hit"
        aria-label={s.plotSelected ? 'Close Farm Moja actions' : 'Open Farm Moja (maize plot)'}
        style={{ left: 330, top: 152, width: 222, height: 120, zIndex: s.plotSelected ? 1 : undefined }}
        onClick={() => dispatch({ type: 'selectPlot', on: !s.plotSelected })}
      />

      {!busy && (
        <div className="abs" style={{ left: 346, top: 6, width: 203, height: 58 }}>
          <Img src={img.plank} w={203} h={58} />
          <span className="label abs" style={{ left: 0, right: 0, top: 23, textAlign: 'center', fontSize: 14 }}>
            Lima Farming Game
          </span>
        </div>
      )}

      {/* Profile: avatar, level star + XP, farm name */}
      <button
        type="button"
        className="peach-btn inset-dark abs"
        style={{ left: 39, top: 24, width: 61, height: 53, padding: 4, borderWidth: 1 }}
        aria-label="Season results"
        onClick={() => open({ kind: 'outcome' })}
      >
        {s.farmer ? (
          <span style={{ display: 'grid', placeItems: 'center', width: 53, height: 45, borderRadius: 10, background: '#cfe6b0', overflow: 'hidden' }}>
            <FarmerPortrait look={LOOKS[s.farmer.look] ?? LOOKS[0]} size={44} />
          </span>
        ) : (
          <Img src={img.avatar} w={53} h={45} style={{ borderRadius: 10, objectFit: 'cover' }} />
        )}
      </button>
      <div className="meter abs" style={{ left: 104, top: 36, width: 81, backdropFilter: 'blur(2.5px)' }} title={`Level ${s.level}`}>
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
          <p className="label" style={{ fontSize: 14, fontWeight: 700 }}>{s.farmer ? `${s.farmer.name}'s farm` : 'Ojuoks farm'}</p>
          <p className="label" style={{ fontSize: 12 }}>1 acre · Season {s.season}</p>
        </div>
      )}

      {/* Resources */}
      <div className="meter abs" style={{ left: 713, top: 31, width: 60 }} title="Coins" aria-label={`${fmt(s.coins)} coins`}>
        <span className="fill" style={{ width: Math.max(10, 58 * coinFill), background: 'var(--xp)' }} />
        <span className="value" style={{ paddingRight: 8 }}>{fmt(s.coins)}</span>
      </div>
      <Img src={img.coin} w={14} h={14} style={{ position: 'absolute', left: 758, top: 30 }} />
      <div className="meter abs" style={{ left: 713, top: 51, width: 60 }} title="Water in your tanks" aria-label={`${Math.round(s.water)} thousand litres of water`}>
        <span className="fill" style={{ width: Math.max(10, 58 * waterFill), background: 'var(--water)' }} />
        <span className="value" style={{ paddingRight: 8 }}>{Math.round(s.water)}k L</span>
      </div>
      <Img src={img.drop} w={14} h={14} style={{ position: 'absolute', left: 758, top: 50 }} />

      <button type="button" className="peach-btn abs" style={{ left: 779, top: 24, width: 56, height: 48.66 }} aria-label="Rewards and discounts" onClick={() => open({ kind: 'rewards' })}>
        <Img src={img.sack} w={32} h={32} />
      </button>
      <button
        type="button"
        className="peach-btn small inset-dark abs"
        style={{ left: busy ? 39 : 774, top: busy ? 85 : 77, width: 28, height: 28 }}
        aria-label="Settings"
        onClick={() => open({ kind: 'settings' })}
      >
        <SettingsIcon size={20} />
      </button>
      <button
        type="button"
        className="peach-btn small inset-dark abs"
        style={{ left: busy ? 72 : 807, top: busy ? 85 : 77, width: 28, height: 28 }}
        aria-label="Messages"
        onClick={() => dispatch({ type: 'toast', text: s.note ?? 'No messages yet' })}
      >
        <MailIcon size={20} />
      </button>

      {!busy && (
        <>
          {/* Next task */}
          <div className="abs" style={{ left: 39, top: 127 }}>
            <p className="label" style={{ fontSize: 14, height: 21 }}>Next Task</p>
            <ul style={{ listStyle: 'none', margin: '2px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.map((t, i) => (
                <li key={t.label}>
                  <button type="button" className="task-row" onClick={t.go} style={i === 0 ? { color: '#ffe08a' } : undefined}>
                    <TimerIcon size={16} color={i === 0 ? '#ffe08a' : '#fff'} />
                    <span style={{ marginLeft: 2 }}>
                      {t.when} : {t.label}
                    </span>
                    <GoArrow size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="abs task-row" style={{ left: 39, top: 364, fontSize: 14, gap: 4 }}>
            <TimerIcon size={16} />
            <span>{stageLine}</span>
          </div>

          <button
            type="button"
            className="abs"
            style={{ left: 41, top: 281, width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
            onClick={() => open(s.stage < STEPS.length ? now.modal : { kind: 'steps', step: 'landprep' })}
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

          <button
            type="button"
            className="abs"
            style={{ left: 779, top: 238, width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
            onClick={() => dispatch({ type: 'rounds', open: true, trial: !!s.trial && s.trial.phase === 'growing' && currentDay(s.trial, dayNumber()) <= CHECK_DAYS })}
            aria-label="Field rounds: check every bed on your farm"
          >
            <span className="peach-btn" style={{ width: 56, height: 48.66 }}>
              <Img src={img.maizeMini} w={28} h={28} />
            </span>
            <span className="label" style={{ fontSize: 14 }}>Rounds</span>
          </button>

          <button
            type="button"
            className="abs"
            style={{ left: 779, top: 166, width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
            onClick={() => dispatch({ type: 'trials', open: true })}
            aria-label={`Six farms: grow maize to different plans and compare${trialBadge(s) ? ` (${trialBadge(s) === '!' ? 'ready to harvest' : `${trialBadge(s)} to check today`})` : ''}`}
          >
            <span className="peach-btn" style={{ width: 56, height: 48.66, position: 'relative' }}>
              <Img src={img.sprout} w={28} h={28} />
              {trialBadge(s) && <span className="tr-badge">{trialBadge(s)}</span>}
            </span>
            <span className="label" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Six farms</span>
          </button>
          {s.onboarded && !s.trial && s.trialHistory.length === 0 && !s.plotSelected && (
            <button type="button" className="tr-hint" onClick={() => dispatch({ type: 'trials', open: true })}>
              New: grow maize two ways and see which grows more.
            </button>
          )}

          {!s.plotSelected && (
            <>
              <FieldAction left={500} top={182} width={92} icon={now.icon} label={now.short} onClick={() => open(now.modal)} />
              {s.collectedDay.milk !== today() && (
                <FieldAction
                  left={334}
                  top={62}
                  width={54}
                  icon={img.milk}
                  label="Milk now"
                  onClick={() => dispatch({ type: 'collect', id: 'milk', coins: 30, text: 'Collected 3 L of goat milk · +30 coins · back tomorrow' })}
                />
              )}
              {s.collectedDay.eggs !== today() && (
                <FieldAction
                  left={563}
                  top={109}
                  width={81}
                  icon={img.egg}
                  label="Harvest eggs"
                  onClick={() => dispatch({ type: 'collect', id: 'eggs', coins: 20, text: 'Collected 12 eggs · +20 coins · back tomorrow' })}
                />
              )}
            </>
          )}
        </>
      )}

      {/* First-run pointer to the first task */}
      {showHint && (
        <button type="button" className="speech" style={{ left: 31, top: 229, width: 131, height: 86 }} onClick={() => open(now.modal)}>
          <img src={img.tipBubble} alt="" style={{ transform: 'scaleX(-1)' }} />
          <span style={{ width: 104, padding: '10px 0 0' }}>
            Start here: tap <b>Now : {now.label}</b> to begin your season
          </span>
        </button>
      )}

      {s.plotSelected && !busy && <SelectedPlot s={s} dispatch={dispatch} />}
    </>
  );
}

function FieldAction({ left, top, width, icon, label, onClick }: { left: number; top: number; width: number; icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="abs"
      style={{ left, top, width, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
      onClick={onClick}
      aria-label={label}
    >
      <span className="bubble-btn">
        <Img src={icon} w={26} h={24} />
      </span>
      <span className="label" style={{ fontSize: 12 }}>{label}</span>
    </button>
  );
}

/** Figma "Game" variant with the selected plot, pointer arrows and the four farm actions. */
function SelectedPlot({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const open = (modal: Modal) => dispatch({ type: 'open', modal });
  const now = nextAction(s);
  const arrows = [
    { left: 293, top: 194, size: 34, nx: '3px', ny: '0px' },
    { left: 424, top: 112, size: 37, nx: '0px', ny: '3px' },
    { left: 552, top: 236, size: 39, nx: '-3px', ny: '0px' },
    { left: 300, top: 262, size: 40, nx: '2px', ny: '-2px' },
  ];
  const harvest = () => {
    if (s.stage === stepIndex('harvest')) open({ kind: 'timing' });
    else if (s.stage === SELLING) open({ kind: 'sale' });
    else if (s.stage === SOLD) open({ kind: 'outcome' });
    else dispatch({ type: 'toast', text: `Not ready yet · ${daysToHarvest(s)} days to harvest. Next: ${now.label}` });
  };
  const actions = [
    { label: 'Info', icon: img.farmInfo, onClick: () => open({ kind: 'info' }) },
    { label: 'Farm', icon: img.farmFarm, onClick: () => open(s.stage < STEPS.length ? now.modal : { kind: 'steps', step: 'landprep' }) },
    { label: 'Upgrade', icon: img.farmUpgrade, onClick: () => open({ kind: 'shop', tab: 'equipment' }) },
    { label: 'Harvest', icon: img.farmHarvest, onClick: harvest },
  ];
  return (
    <>
      <div
        className="plot-glow"
        style={{ left: 330, top: 152, width: 222, height: 120, borderRadius: 14, backdropFilter: 'brightness(1.35) saturate(1.1)', WebkitBackdropFilter: 'brightness(1.35) saturate(1.1)' }}
      />
      {arrows.map((a, i) => (
        <img
          key={i}
          src={img.arrows[i]}
          alt=""
          className="plot-arrow"
          style={{ left: a.left, top: a.top, width: a.size, height: a.size, ['--nx' as string]: a.nx, ['--ny' as string]: a.ny }}
        />
      ))}
      <div className="abs" style={{ left: 349, top: 274, width: 176, textAlign: 'center', pointerEvents: 'none' }}>
        <p className="label" style={{ fontSize: 16, fontWeight: 700 }}>Farm Moja</p>
        <p className="label" style={{ fontSize: 12 }}>Maize · 1 acre</p>
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
