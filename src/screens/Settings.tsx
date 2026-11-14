import { useEffect, useState, type Dispatch, type ReactNode } from 'react';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import { GoldButton } from '../components/ui';
import { FarmerFigure, FarmerPortrait } from '../first/art';
import { LOOKS, NAME_SUGGESTIONS } from '../first/data';
import { CAST, AnimeBust } from '../art/anime';
import { ArtContext } from '../art/style';
import { img } from '../assets';
import { canSpeak, speak } from '../speech';
import { setSoundOn, sfx } from '../sfx';
import { clearSave, initialState, type Action, type GameState, type Settings, type SettingsTab } from '../state';

/* Settings: a full page with four sections. Every control changes the game straight away and is kept on this device.
   Farmer: rename and change look. Game: character style, farm view, read aloud. Display: graphics, motion, full
   screen. Help & data: the intro, design review, and reset (which keeps these settings). */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: SettingsTab };

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'farmer', label: 'My farmer', icon: '☺' },
  { id: 'game', label: 'Game', icon: '✦' },
  { id: 'display', label: 'Display', icon: '☀' },
  { id: 'help', label: 'Help & data', icon: '?' },
];

const clean = (raw: string) => {
  const s = raw.replace(/[^\p{L}' -]/gu, '').replace(/\s+/g, ' ').trimStart().slice(0, 14);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** A row of choices, one of them on (a radio group). */
function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: ReactNode; aria?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} aria-label={o.aria} className={value === o.id ? 'is-on' : undefined} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ title, body, children }: { title: string; body: ReactNode; children: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-text">
        <p className="set-title">{title}</p>
        <p className="set-body">{body}</p>
      </div>
      <div className="set-control">{children}</div>
    </div>
  );
}

export function SettingsPage({ s, dispatch, tab: startTab }: Props) {
  // the tab is part of the address (#/settings/display), so it lives in the game state
  const tab: SettingsTab = startTab ?? (s.farmer ? 'farmer' : 'game');
  const setTab = (t: SettingsTab) => dispatch({ type: 'open', modal: { kind: 'settings', tab: t } });
  const set = (patch: Partial<Settings>) => dispatch({ type: 'settings', patch });
  const close = () => dispatch({ type: 'close' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'close' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <div className="abs settings-page" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Settings">
      <div className="scrim" onClick={close} />
      <div className="fs-panel set-panel" style={{ left: 18, top: 40, width: 838, height: 348 }}>
        <nav className="set-tabs" aria-label="Settings sections">
          <p className="set-heading">Settings</p>
          {TABS.map(t => (
            <button key={t.id} type="button" className={`set-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <i aria-hidden="true">{t.icon}</i>
              {t.label}
            </button>
          ))}
          <p className="set-foot">
            {s.farmer ? `Season ${s.season} · Level ${s.level}` : 'New game'}
            <br />
            Saved on this device
          </p>
        </nav>
        <section className="set-content" aria-label={TABS.find(t => t.id === tab)!.label}>
          {tab === 'farmer' && <FarmerTab s={s} dispatch={dispatch} />}
          {tab === 'game' && <GameTab s={s} dispatch={dispatch} set={set} />}
          {tab === 'display' && <DisplayTab s={s} dispatch={dispatch} set={set} />}
          {tab === 'help' && <HelpTab s={s} dispatch={dispatch} />}
        </section>
      </div>
      <NavBar horizontal onBack={close} hideHome={s.fs.phase !== 'done'} style={{ right: 44, top: 6 }} />
      <CloseX className="page-x" onClick={close} />
      <p className="set-title-bar">
        <span aria-hidden="true">⚙</span> Settings · <b>{TABS.find(t => t.id === tab)!.label}</b>
      </p>
    </div>
  );
}

/* ---------------- My farmer ---------------- */

function FarmerTab({ s, dispatch }: Props) {
  const f = s.farmer;
  const [name, setName] = useState(f?.name ?? '');
  if (!f)
    return (
      <div className="set-empty">
        <p className="set-title">No farmer yet</p>
        <p className="set-body">Name your farmer and pick a look on the first screen. You can change both here afterwards.</p>
      </div>
    );
  const look = LOOKS[f.look] ?? LOOKS[0];
  const ready = name.trim().length >= 2 && name.trim() !== f.name;
  const save = () => ready && (dispatch({ type: 'farmer', name: name.trim(), look: f.look }), dispatch({ type: 'toast', text: `Your farmer is now ${name.trim()}` }));
  return (
    <div className="set-farmer">
      <div className="set-preview" aria-hidden="true">
        <svg viewBox="-34 -100 68 106" width={150} height={234}>
          <FarmerFigure look={look} pose="cheer" />
        </svg>
        <span className="name-bubble set-name-tag">{f.name}</span>
      </div>
      <form
        className="set-farmer-form"
        onSubmit={e => {
          e.preventDefault();
          save();
        }}
      >
        <label className="set-title" htmlFor="set-name">
          Name
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input id="set-name" className="name-input" style={{ marginTop: 0, height: 34, fontSize: 14 }} value={name} maxLength={14} autoComplete="off" onChange={e => setName(clean(e.target.value))} />
          <GoldButton font={10} height={34} style={{ width: 96, flexShrink: 0, opacity: ready ? 1 : 0.5 }} onClick={save} ariaLabel="Save name">
            Save
          </GoldButton>
        </div>
        <div className="chips" role="group" aria-label="Name ideas" style={{ marginTop: 6 }}>
          {NAME_SUGGESTIONS.map(n => (
            <button type="button" key={n} className={`name-chip${name === n ? ' is-on' : ''}`} style={{ minHeight: 26, padding: '3px 12px', fontSize: 11 }} onClick={() => setName(n)}>
              {n}
            </button>
          ))}
        </div>
        <p className="set-title" style={{ marginTop: 14 }}>
          Look
        </p>
        <div className="looks" role="radiogroup" aria-label="Looks" style={{ marginTop: 4 }}>
          {LOOKS.map((l, i) => (
            <button
              type="button"
              role="radio"
              aria-checked={f.look === i}
              aria-label={`Look ${i + 1}`}
              key={i}
              className={`look-btn${f.look === i ? ' is-on' : ''}`}
              onClick={() => dispatch({ type: 'farmer', name: f.name, look: i })}
            >
              <FarmerPortrait look={l} size={50} />
            </button>
          ))}
        </div>
        <p className="set-body" style={{ marginTop: 10 }}>
          Your farmer looks the same on the farm, in the field rounds and on the HUD.
        </p>
      </form>
    </div>
  );
}

/* ---------------- Game ---------------- */

function StyleSample({ art }: { art: GameState['settings']['art'] }) {
  return (
    <ArtContext.Provider value={art}>
      {art === 'anime' ? <AnimeBust t={CAST.guide} size={30} /> : <img src={img.guide} alt="" style={{ width: 40, height: 33, objectFit: 'cover', objectPosition: '50% 8%' }} />}
    </ArtContext.Provider>
  );
}

function GameTab({ s, dispatch, set }: Props & { set: (p: Partial<Settings>) => void }) {
  const st = s.settings;
  const voiceOk = canSpeak();
  return (
    <div className="set-rows">
      <Row title="Character style" body="How your farmer, the guide, the shopkeeper and the animals are drawn.">
        <Seg
          label="Character style"
          value={st.art}
          onChange={art => set({ art })}
          options={[
            { id: 'anime', aria: 'Retro anime', label: <span className="seg-pic"><StyleSample art="anime" />Retro anime</span> },
            { id: 'original', aria: 'Original', label: <span className="seg-pic"><StyleSample art="original" />Original</span> },
          ]}
        />
      </Row>
      <Row title="Farm view" body={s.view === 'world' ? 'The walkable 3D farm, with the tractor and the six farms.' : 'The classic painted farm: Farm Moja seasons and the field rounds.'}>
        <Seg
          label="Farm view"
          value={s.view}
          onChange={view => dispatch({ type: 'view', view })}
          options={[
            { id: 'world', label: '3D farm' },
            { id: 'classic', label: 'Classic' },
          ]}
        />
      </Row>
      <Row title="Read aloud" body={voiceOk ? "The guide's lines and the game's messages are spoken by your phone's voice." : 'This browser has no voice to read with.'}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Seg
            label="Read aloud"
            value={st.voice ? 'on' : 'off'}
            onChange={v => {
              set({ voice: v === 'on' });
              if (v === 'on') speak('Read aloud is on. Karibu Lima!');
            }}
            options={[
              { id: 'off', label: 'Off' },
              { id: 'on', label: 'On' },
            ]}
          />
          <button type="button" className="set-link" disabled={!voiceOk} onClick={() => speak(`Karibu${s.farmer ? `, ${s.farmer.name}` : ''}! This is how the guide sounds.`)}>
            Test
          </button>
        </div>
      </Row>
      <Row title="Sound effects" body="A happy ping when you finish an action, and a fanfare when you finish a whole flow.">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Seg
            label="Sound effects"
            value={st.sound === false ? 'off' : 'on'}
            onChange={v => {
              set({ sound: v === 'on' });
              setSoundOn(v === 'on');
              if (v === 'on') sfx.action();
            }}
            options={[
              { id: 'off', label: 'Off' },
              { id: 'on', label: 'On' },
            ]}
          />
          <button type="button" className="set-link" disabled={st.sound === false} onClick={() => sfx.action()}>
            Action
          </button>
          <button type="button" className="set-link" disabled={st.sound === false} onClick={() => sfx.flow()}>
            Flow
          </button>
        </div>
      </Row>
      <Row title="Upgrade messages" body="A dialog after you upgrade, such as moving the harvest to better storage, saying what it changes.">
        <Seg
          label="Upgrade messages"
          value={st.upgradeNotes === false ? 'off' : 'on'}
          onChange={v => set({ upgradeNotes: v === 'on' })}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'on', label: 'On' },
          ]}
        />
      </Row>
    </div>
  );
}

/* ---------------- Display ---------------- */

function DisplayTab({ s, dispatch, set }: Props & { set: (p: Partial<Settings>) => void }) {
  const st = s.settings;
  const [full, setFull] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  const fullScreen = () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    Promise.resolve(p).catch(() => dispatch({ type: 'toast', text: 'Full screen is not available here. Add the game to your home screen instead.' }));
  };
  const gfx = { auto: 'Shadows and a picture sized to your phone, made lighter by itself if it slows down.', high: 'Always shadows and the sharpest picture. Uses more battery.', low: 'No shadows, a softer picture. Smoothest on older phones and saves battery.' };
  return (
    <div className="set-rows">
      <Row title="Graphics" body={gfx[st.graphics]}>
        <Seg
          label="Graphics"
          value={st.graphics}
          onChange={graphics => set({ graphics })}
          options={[
            { id: 'auto', label: 'Auto' },
            { id: 'high', label: 'High' },
            { id: 'low', label: 'Low' },
          ]}
        />
      </Row>
      <Row title="Reduce motion" body="Stops the bobbing, pulsing and pop-in animations.">
        <Seg
          label="Reduce motion"
          value={st.reduceMotion ? 'on' : 'off'}
          onChange={v => set({ reduceMotion: v === 'on' })}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'on', label: 'On' },
          ]}
        />
      </Row>
      <Row title="Full screen" body="Fills the whole screen. On phones, adding Lima to your home screen fits best.">
        <Seg
          label="Full screen"
          value={full ? 'on' : 'off'}
          onChange={v => (v === 'on') !== full && fullScreen()}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'on', label: 'On' },
          ]}
        />
      </Row>
    </div>
  );
}

/* ---------------- Help & data ---------------- */

function HelpTab({ s, dispatch }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="set-rows">
      <Row title="How the farm works" body="A quick guide to seasons, selling and rewards.">
        <GoldButton font={10} height={28} style={{ width: 120 }} onClick={() => dispatch({ type: 'open', modal: { kind: 'welcome' } })}>
          Open
        </GoldButton>
      </Row>
      <Row title="Page addresses" body="Every page has its own address after the # in the address bar. Change it to go to another page, e.g. #/farm, #/shop/food or #/climate/emissions.">
        <code className="set-address">#/settings/help</code>
      </Row>
      <Row title="Design review" body="A sandbox with a menu of every screen. Your game is not changed.">
        <GoldButton
          font={10}
          height={28}
          style={{ width: 120 }}
          onClick={() => {
            window.location.search = '?review=1';
          }}
        >
          Open
        </GoldButton>
      </Row>
      <Row title="Reset progress" body={confirmReset ? 'This erases your farmer, seasons, coins and points on this device. Your settings stay.' : 'Start again with a new farmer.'}>
        <div style={{ display: 'flex', gap: 6 }}>
          {confirmReset && (
            <button type="button" className="set-link" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          )}
          <GoldButton
            font={10}
            height={28}
            style={{ width: 120, ...(confirmReset ? { background: '#c0392b', borderColor: '#8e2a1f' } : {}) }}
            onClick={() => {
              if (!confirmReset) return setConfirmReset(true);
              clearSave();
              dispatch({ type: 'reset', state: { ...initialState, settings: s.settings, modal: null, toast: null } });
            }}
          >
            {confirmReset ? 'Yes, erase' : 'Reset'}
          </GoldButton>
        </div>
      </Row>
    </div>
  );
}
