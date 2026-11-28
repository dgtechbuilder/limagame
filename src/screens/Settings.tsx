import { cleanTag, evidenceExport, evidenceOf, evidenceSummary } from '../evidence/model';
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
import { DEFAULT_VOLUME, setVolume, volumeSettings, type VolumeSettings } from '../audio/volume';
import { COW_EVERY_S, HEN_EVERY_S, preview } from '../audio/ambience';
import { previewFarm } from '../audio/farm';
import { COUNTRIES, countryOf, money } from '../money';
import { activeFamily, captureInput, connectedPads, onPadPress, onPads, type PadInfo } from '../input/gamepad';
import { FAMILY_NAME, padKey, padLabel, padSettings, type PadAction, type PadFamily, type PadMap, type PadSettings } from '../input/pad';
import { tractorSettings, type TractorSettings } from '../business/tune';
import { linkLabel, lowData, onNetChange, online, slowLink } from '../net/connection';
import { keptStatus, onWarm, warmGame, type KeptStatus } from '../net/offline';
import { HUD_GROUPS, HUD_KEYS, hudHiddenCount, hudShown } from '../hud/prefs';
import { clearSave, initialState, replaceSave, type Action, type GameState, type Settings, type SettingsTab } from '../state';
import { cleanCode, cloudEnabled, cloudPlayerId, cloudRestore, adoptPlayer, type RestoreResult } from '../net/cloud';

/* Settings: a full page with eight sections. Every control changes the game straight away and is kept on this device.
   Farmer: rename and change look. Game: character style, farm view, read aloud. Sound: the overall volume (2% to
   start), mute, and the music, footsteps, farm animals, farm work, ambience and effects (src/audio). Display: graphics, motion, full
   screen. Home screen: which of the farm's buttons show. Tractor: the business drive's speed, steering, touch controls, sounds, dust and smoke. Controller: the controller connected, its button names, Confirm on the bottom or right, dead zone, rumble,
   and setting up the buttons of a controller the browser does not know. Help & data: about the game and its name, the intro, design review, and reset (which keeps these settings). */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: SettingsTab };

const TABS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'farmer', label: 'My farmer', icon: '☺' },
  { id: 'game', label: 'Game', icon: '✦' },
  { id: 'sound', label: 'Sound', icon: '♪' },
  { id: 'display', label: 'Display', icon: '☀' },
  { id: 'home', label: 'Home screen', icon: '▦' },
  { id: 'tractor', label: 'Tractor', icon: '🚜' },
  { id: 'controller', label: 'Controller', icon: '🎮' },
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

function Row({ title, body, children }: { title: string; body: ReactNode; children?: ReactNode }) {
  return (
    <div className="set-row">
      <div className="set-text">
        <p className="set-title">{title}</p>
        <p className="set-body">{body}</p>
      </div>
      {children && <div className="set-control">{children}</div>}
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
      <div className="fs-panel set-panel" style={{ left: 24, top: 46, width: 826, height: 334 }}>
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
            {cloudEnabled() ? 'Saved on this phone and online' : 'Saved on this device'}
          </p>
        </nav>
        <section className="set-content" aria-label={TABS.find(t => t.id === tab)!.label}>
          {tab === 'farmer' && <FarmerTab s={s} dispatch={dispatch} />}
          {tab === 'game' && <GameTab s={s} dispatch={dispatch} set={set} />}
          {tab === 'sound' && <SoundTab s={s} dispatch={dispatch} set={set} />}
          {tab === 'display' && <DisplayTab s={s} dispatch={dispatch} set={set} />}
          {tab === 'home' && <HomeTab s={s} dispatch={dispatch} set={set} />}
          {tab === 'tractor' && <TractorTab s={s} dispatch={dispatch} set={set} />}
          {tab === 'controller' && <ControllerTab s={s} dispatch={dispatch} set={set} />}
          {tab === 'help' && <HelpTab s={s} dispatch={dispatch} />}
        </section>
      </div>
      <NavBar horizontal onBack={close} hideHome={s.fs.phase !== 'done'} style={{ right: 62, top: 8 }} />
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
        <p className="set-body">Change your farmer’s name and look.</p>
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
          <input id="set-name" className="name-input" style={{ marginTop: 0, height: 34, fontSize: 11 }} value={name} maxLength={14} autoComplete="off" onChange={e => setName(clean(e.target.value))} />
          <GoldButton font={10} height={34} style={{ width: 96, flexShrink: 0, opacity: ready ? 1 : 0.5 }} onClick={save} ariaLabel="Save name">
            Save
          </GoldButton>
        </div>
        <div className="chips" role="group" aria-label="Name ideas" style={{ marginTop: 6 }}>
          {NAME_SUGGESTIONS.map(n => (
            <button type="button" key={n} className={`name-chip${name === n ? ' is-on' : ''}`} style={{ minHeight: 26, padding: '3px 12px', fontSize: 8.5 }} onClick={() => setName(n)}>
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
          Your farmer’s look, everywhere in the game.
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
      <Row title="Country and money" body={`Money is shown in ${countryOf(st.country).currency.name}: you have ${money(s.coins)}.`}>
        <select className="set-select" aria-label="Country" value={st.country} onChange={e => set({ country: e.target.value })}>
          {COUNTRIES.map(c => (
            <option key={c.id || 'other'} value={c.id}>
              {c.flag} {c.name} ({c.currency.code})
            </option>
          ))}
        </select>
      </Row>
      <Row title="Character style" body="How the characters are drawn.">
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
      <Row title="Farm view" body={s.view === 'world' ? 'The walkable 3D farm with the tractor.' : 'The classic painted farm.'}>
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
      <Row title="Read aloud" body={voiceOk ? "Your phone reads the guide’s lines aloud." : 'This browser has no voice to read with.'}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Seg
            label="Read aloud"
            value={st.voice ? 'on' : 'off'}
            onChange={v => {
              set({ voice: v === 'on' });
              if (v === 'on') speak('Read aloud is on. Karibu TemoLima!');
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
      <Row title="Sound effects" body="A ping for each action, a fanfare for each flow.">
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
      <Row title="Upgrade messages" body="A dialog after an upgrade, saying what it changes.">
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

/* ---------------- Sound (src/audio) ---------------- */

/** A level from 0 to 100%, with its number beside it. */
function Level({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <span className="vol-level">
      <input type="range" className="vol-range" min={0} max={100} step={1} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={label} aria-valuetext={`${value}%`} />
      <b className="vol-pct">{value}%</b>
    </span>
  );
}

function SoundTab({ s, set }: Props & { set: (p: Partial<Settings>) => void }) {
  const v = volumeSettings(s.settings.volume);
  const change = (patch: Partial<VolumeSettings>) => {
    const next = { ...v, ...patch };
    // straight away, so a test button pressed next plays at the new level
    setVolume(next);
    set({ volume: next });
  };
  const fx = s.settings.sound !== false;
  // with the sound muted, every test button stays quiet: unmute first
  const on = !v.muted && v.master > 0;
  return (
    <div className="set-rows">
      <Row title="Mute" body={v.muted ? 'Every sound is off. Your levels are kept for when you turn it back on.' : 'Turn every sound off at once (the 🔊 button on the farm does the same).'}>
        <Seg
          label="Mute"
          value={v.muted ? 'on' : 'off'}
          onChange={m => change({ muted: m === 'on' })}
          options={[
            { id: 'off', label: 'Sound on' },
            { id: 'on', label: 'Muted' },
          ]}
        />
      </Row>
      <Row title="Overall volume" body={v.master === 0 ? 'Every sound is off.' : `Every sound in the game. It starts at ${DEFAULT_VOLUME.master}%, so the game is only lightly heard; turn the phone up or this up for more.`}>
        <Level label="Overall volume" value={v.master} onChange={master => change({ master })} />
      </Row>
      <Row title="Music" body="The calm background score: a soft pad, a round bass and a kalimba.">
        <Level label="Music" value={v.music} onChange={music => change({ music })} />
      </Row>
      <Row title="Footsteps" body="The farmer’s steps on the farm: a soft swish on grass, a drier crunch on soil.">
        <div className="vol-ctl">
          <Level label="Footsteps" value={v.steps} onChange={steps => change({ steps })} />
          <button type="button" className="set-link" disabled={!on || !v.steps} onClick={() => preview('grass')}>
            Grass
          </button>
          <button type="button" className="set-link" disabled={!on || !v.steps} onClick={() => preview('soil')}>
            Soil
          </button>
        </div>
      </Row>
      <Row title="Farm animals" body={`On the farm, the hens cluck every ${HEN_EVERY_S} seconds and a cow moos every ${COW_EVERY_S === 60 ? 'minute' : `${COW_EVERY_S} seconds`}.`}>
        <div className="vol-ctl">
          <Level label="Farm animals" value={v.animals} onChange={animals => change({ animals })} />
          <button type="button" className="set-link" disabled={!on || !v.animals} onClick={() => preview('cluck')}>
            Cluck
          </button>
          <button type="button" className="set-link" disabled={!on || !v.animals} onClick={() => preview('moo')}>
            Moo
          </button>
        </div>
      </Row>
      <Row title="Farm work" body="Each swing of the tool: the hoe in soil, the sickle through grass and weeds, the hammer and wrench building, wiring the power.">
        <div className="vol-ctl">
          <Level label="Farm work" value={v.work} onChange={work => change({ work })} />
          <button type="button" className="set-link" disabled={!on || !v.work} onClick={() => previewFarm('grass')}>
            Cut
          </button>
          <button type="button" className="set-link" disabled={!on || !v.work} onClick={() => previewFarm('hammer')}>
            Build
          </button>
          <button type="button" className="set-link" disabled={!on || !v.work} onClick={() => previewFarm('power')}>
            Power
          </button>
        </div>
      </Row>
      <Row title="Ambience" body="The breeze and the birds (crickets at night) on the farm, and the fridge and freezer humming as you walk up to them.">
        <div className="vol-ctl">
          <Level label="Ambience" value={v.ambience} onChange={ambience => change({ ambience })} />
          <button type="button" className="set-link" disabled={!on || !v.ambience} onClick={() => previewFarm('fridge')}>
            Fridge
          </button>
          <button type="button" className="set-link" disabled={!on || !v.ambience} onClick={() => previewFarm('freezer')}>
            Freezer
          </button>
        </div>
      </Row>
      <Row title="Effects" body={fx ? 'The ping and fanfare for each action and flow, and the tractor’s drive.' : 'Sound effects are off (Game): turn them on to hear these.'}>
        <div className="vol-ctl">
          <Level label="Effects" value={v.effects} onChange={effects => change({ effects })} />
          <button type="button" className="set-link" disabled={!fx || !on || !v.effects} onClick={() => sfx.action()}>
            Ping
          </button>
        </div>
      </Row>
      <Row title="Start again" body={`Back to ${DEFAULT_VOLUME.master}% overall, every sound at its full share, not muted.`}>
        <button type="button" className="set-link" onClick={() => change(DEFAULT_VOLUME)}>
          Reset volume
        </button>
      </Row>
    </div>
  );
}

/* ---------------- Display: Play offline (src/net/offline.ts) ---------------- */

const pct = (k?: { kept: number; total: number }) => (k && k.total ? Math.floor((k.kept / k.total) * 100) : 0);

/** How much of the game is on the phone, and a button to keep all of it (with the crop photos) while there is Wi-Fi. */
function OfflineRow() {
  const [kept, setKept] = useState<KeptStatus | null | undefined>(undefined);
  const [busy, setBusy] = useState<number | null>(null);
  const [, setNet] = useState(0);
  useEffect(() => {
    let live = true;
    void keptStatus().then(k => live && setKept(k));
    const offWarm = onWarm((p, k) => {
      if (!live) return;
      if (p.finished) {
        setBusy(null);
        if (k) setKept(k);
      } else setBusy(Math.floor((p.done / Math.max(1, p.total)) * 100));
    });
    const offNet = onNetChange(() => setNet(n => n + 1));
    return () => {
      live = false;
      offWarm();
      offNet();
    };
  }, []);
  const photos = lowData() ? kept?.lite : kept?.photos;
  const all = pct(kept?.game) >= 100 && pct(photos) >= 100;
  const body =
    kept === undefined
      ? `${linkLabel()}. Checking what is on this phone…`
      : kept === null
        ? `${linkLabel()}. Your farm is always saved on this phone.`
        : busy !== null
          ? `Downloading for offline: ${busy}%. Keep the game open.`
          : all
            ? `${linkLabel()}. The whole game is on this phone: it plays with no signal.`
            : `${linkLabel()}. ${pct(kept.game)}% of the game is on this phone${photos?.total ? `, ${pct(photos)}% of the crop photos` : ''}. Download the rest where there is Wi-Fi.`;
  return (
    <Row title="Play offline" body={body}>
      {kept && !all && (
        <button
          type="button"
          className="ach-claim"
          disabled={busy !== null || !online()}
          onClick={() => {
            setBusy(0);
            void warmGame({ photos: true }).then(ok => !ok && setBusy(null));
          }}
        >
          {busy !== null ? `${busy}%` : lowData() ? 'Download (up to 4 MB)' : 'Download (up to 11 MB)'}
        </button>
      )}
    </Row>
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
    Promise.resolve(p).catch(() => dispatch({ type: 'toast', text: 'Not available here. Add the game to your home screen.' }));
  };
  const gfx = { auto: 'Shadows and a sharp picture; lightens itself if slow.', high: 'Always shadows and the sharpest picture. Uses more battery.', low: 'No shadows. Smoothest on older phones; saves battery.' };
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
      <Row
        title="Data saver"
        body={
          { auto: `Saves data by itself when your phone asks to or the signal is slow (2G).${slowLink() ? ' On now.' : ''}`, on: 'Lighter pictures and photos, and only what you open is downloaded. For costly or slow data.', off: 'Sharp pictures, and the whole game downloaded ahead so it opens at once.' }[st.data ?? 'auto']
        }
      >
        <Seg
          label="Data saver"
          value={st.data ?? 'auto'}
          onChange={data => set({ data })}
          options={[
            { id: 'auto', label: 'Auto' },
            { id: 'on', label: 'On' },
            { id: 'off', label: 'Off' },
          ]}
        />
      </Row>
      <OfflineRow />
      <Row title="Night mode" body={{ auto: 'Night falls on the farm from 7 pm to 6 am, by your phone’s clock.', day: 'Always day on the farm.', night: 'Always night: the farm’s lights (Power) light the way.' }[st.night ?? 'auto']}>
        <Seg
          label="Night mode"
          value={st.night ?? 'auto'}
          onChange={night => set({ night })}
          options={[
            { id: 'auto', label: 'Auto' },
            { id: 'day', label: 'Day' },
            { id: 'night', label: 'Night' },
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
      <Row title="Full screen" body="Fills the whole screen.">
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

/* ---------------- Home screen (src/hud/prefs.ts) ---------------- */

/* Which of the farm's buttons show. Settings, Menu, the money, the tractor and the next task always stay; anything
   hidden is still in the Main menu. */
function HomeTab({ s, set }: Props & { set: (p: Partial<Settings>) => void }) {
  const st = s.settings;
  const hidden = hudHiddenCount(st);
  const setAll = (shown: boolean) => set({ hud: shown ? {} : Object.fromEntries(HUD_KEYS.map(k => [k, false])) });
  return (
    <div className="set-rows set-home">
      <Row
        title="Buttons on the farm"
        body={
          <>
            Hide what you don’t use to keep the farm clear. Settings, Menu, your money, the tractor and the next task always stay. Anything hidden is still in the <b>Main menu</b>.
          </>
        }
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button type="button" className="set-link" disabled={hidden === HUD_KEYS.length} onClick={() => setAll(false)}>
            Hide all
          </button>
          <GoldButton font={10} height={28} style={{ width: 96, opacity: hidden ? 1 : 0.5 }} onClick={() => hidden && setAll(true)} ariaLabel="Show all buttons">
            Show all
          </GoldButton>
        </div>
      </Row>
      {HUD_GROUPS.map(g => (
        <div key={g.title} className="set-group" role="group" aria-label={g.title}>
          <p className="set-group-head">{g.title}</p>
          {g.items.map(i => (
            <Row key={i.key} title={i.label} body={i.body}>
              <Seg
                label={i.label}
                value={hudShown(st, i.key) ? 'show' : 'hide'}
                onChange={v => set({ hud: { ...st.hud, [i.key]: v === 'show' } })}
                options={[
                  { id: 'hide', label: 'Hide' },
                  { id: 'show', label: 'Show' },
                ]}
              />
            </Row>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Tractor ---------------- */

/* How the tractor handles in the tractor business's drive (business/DayDrive.tsx): its speed, its steering, the touch
   controls, its sounds, and its dust and smoke. A change applies at the next stop of a drive under way. */
function TractorTab({ s, set }: Props & { set: (p: Partial<Settings>) => void }) {
  const t = tractorSettings(s.settings.tractor);
  const setT = (patch: Partial<TractorSettings>) => set({ tractor: { ...t, ...patch } });
  const onOff = (v: boolean) => (v ? 'on' : 'off');
  return (
    <div className="set-rows">
      <Row title="Driving speed" body={{ gentle: 'Slow and steady: the most time to steer. Each field allows more time to match.', normal: 'A steady working pace.', quick: 'A brisker pace: less time per field, quicker turns.', fast: 'Flat out: for experienced drivers.' }[t.speed]}>
        <Seg
          label="Driving speed"
          value={t.speed}
          onChange={speed => setT({ speed })}
          options={[
            { id: 'gentle', label: 'Gentle' },
            { id: 'normal', label: 'Normal' },
            { id: 'quick', label: 'Quick' },
            { id: 'fast', label: 'Fast' },
          ]}
        />
      </Row>
      <Row title="Steering sensitivity" body={{ low: 'Wide, smooth turns and slow lane changes.', medium: 'The standard tractor’s turning circle.', high: 'Tight, sharp turns and quick lane changes.' }[t.steer]}>
        <Seg
          label="Steering sensitivity"
          value={t.steer}
          onChange={steer => setT({ steer })}
          options={[
            { id: 'low', label: 'Low' },
            { id: 'medium', label: 'Medium' },
            { id: 'high', label: 'High' },
          ]}
        />
      </Row>
      <Row title="Touch controls" body={t.controls === 'tap' ? 'Tap and hold where the tractor should go; tap a lane on the road.' : 'Steering buttons: the tractor drives itself forward, you steer with ◀ ▶ (▲ ▼ on the road).'}>
        <Seg
          label="Touch controls"
          value={t.controls}
          onChange={controls => setT({ controls })}
          options={[
            { id: 'tap', label: 'Tap to steer' },
            { id: 'buttons', label: 'Buttons' },
          ]}
        />
      </Row>
      <Row title="Tractor sounds" body={s.settings.sound === false ? 'Sound effects are off (Game): turn them on to hear the tractor.' : 'The engine, the clonk of a rock, the crunch of a tree, the horn.'}>
        <Seg
          label="Tractor sounds"
          value={t.sound}
          onChange={sound => setT({ sound })}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'quiet', label: 'Quiet' },
            { id: 'normal', label: 'Normal' },
            { id: 'loud', label: 'Loud' },
          ]}
        />
      </Row>
      <Row title="Dust and smoke" body="Exhaust smoke, dust behind the implement, and the burst of dust, chips and leaves when you hit something.">
        <Seg
          label="Dust and smoke"
          value={t.effects}
          onChange={effects => setT({ effects })}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'some', label: 'Some' },
            { id: 'lots', label: 'Lots' },
          ]}
        />
      </Row>
      <Row title="Shake on hits" body={s.settings.reduceMotion ? 'Reduce motion is on (Display), so the view stays still.' : 'The view shakes when the tractor hits a rock, a tree or a pothole.'}>
        <Seg label="Shake on hits" value={onOff(t.shake)} onChange={v => setT({ shake: v === 'on' })} options={[{ id: 'off', label: 'Off' }, { id: 'on', label: 'On' }]} />
      </Row>
      <Row title="Row guides" body="Faint lines on the field where each pass of the implement should go.">
        <Seg label="Row guides" value={onOff(t.guides)} onChange={v => setT({ guides: v === 'on' })} options={[{ id: 'off', label: 'Off' }, { id: 'on', label: 'On' }]} />
      </Row>
    </div>
  );
}

/* ---------------- Controller ---------------- */

const SETUP_STEPS: { action: PadAction; what: string }[] = [
  { action: 'confirm', what: 'Confirm (choose, press the button in focus)' },
  { action: 'back', what: 'Back (close, go back)' },
  { action: 'x', what: 'Hold and timing games, and the tractor' },
  { action: 'y', what: 'Walk to the next task' },
  { action: 'up', what: 'D-pad up' },
  { action: 'down', what: 'D-pad down' },
  { action: 'left', what: 'D-pad left' },
  { action: 'right', what: 'D-pad right' },
  { action: 'prev', what: 'Previous button (left bumper)' },
  { action: 'next', what: 'Next button (right bumper)' },
  { action: 'prevTab', what: 'Previous section (left trigger)' },
  { action: 'nextTab', what: 'Next section (right trigger)' },
  { action: 'start', what: 'Main menu (Start)' },
  { action: 'select', what: 'Settings (Select)' },
];

/** The controls, as the player's controller names them. */
type LegendKey = PadAction | 'stick' | 'rstick' | 'dpad';
const PAD_LEGEND: { does: string; keys: LegendKey[] }[] = [
    { does: 'Walk, drive and steer; move round a page', keys: ['stick', 'dpad'] },
    { does: 'Choose, or the farm’s action', keys: ['confirm'] },
    { does: 'Back, close', keys: ['back'] },
    { does: 'Hold and timing games; tractor on/off', keys: ['x'] },
    { does: 'Walk to the next task', keys: ['y'] },
    { does: 'Previous / next button', keys: ['prev', 'next'] },
    { does: 'Previous / next section', keys: ['prevTab', 'nextTab'] },
    { does: 'Main menu', keys: ['start'] },
    { does: 'Settings', keys: ['select'] },
    { does: 'Scroll', keys: ['rstick'] },
];

function ControllerTab({ s, set }: Props & { set: (p: Partial<Settings>) => void }) {
  const pad = padSettings(s.settings.pad);
  const setPad = (patch: Partial<PadSettings>) => set({ pad: { ...pad, ...patch } });
  const [pads, setPads] = useState<PadInfo[]>(() => connectedPads());
  const [held, setHeld] = useState<Set<PadAction>>(() => new Set());
  const [setup, setSetup] = useState<{ pad: PadInfo; step: number; map: PadMap } | null>(null);
  useEffect(() => {
    const a = onPads(() => setPads(connectedPads()));
    const b = onPadPress(on => setHeld(on));
    setPads(connectedPads());
    return () => (a(), b());
  }, []);
  // Set up buttons: each press is the next action's button
  useEffect(() => {
    if (!setup) return;
    if (setup.step >= SETUP_STEPS.length) {
      setPad({ maps: { ...pad.maps, [padKey(setup.pad.id)]: setup.map } });
      setSetup(null);
      return;
    }
    return captureInput((b, from) => {
      if (from.id !== setup.pad.id) return setSetup({ ...setup });
      setSetup({ ...setup, step: setup.step + 1, map: { ...setup.map, [SETUP_STEPS[setup.step].action]: b } });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup]);

  const fam: PadFamily = pad.glyphs === 'auto' ? (activeFamily() ?? pads[0]?.family ?? 'xbox') : pad.glyphs;
  const label = (k: LegendKey) => (k === 'stick' ? 'Left stick' : k === 'rstick' ? 'Right stick' : k === 'dpad' ? 'D-pad' : padLabel(k, fam, pad.swap));
  const lit = (k: LegendKey) => (k === 'dpad' ? ['up', 'down', 'left', 'right'].some(d => held.has(d as PadAction)) : k !== 'stick' && k !== 'rstick' && held.has(k));
  const first = pads[0];

  if (setup && setup.step < SETUP_STEPS.length) {
    const st = SETUP_STEPS[setup.step];
    return (
      <div className="set-rows pad-setup" aria-live="polite">
        <Row title={`Set up buttons · ${setup.step + 1} of ${SETUP_STEPS.length}`} body={`On ${setup.pad.name}, press the button for:`} />
        <p className="pad-ask">
          <b>{st.what}</b>
          <small>Usually {padLabel(st.action, setup.pad.family)} on this controller</small>
        </p>
        <div className="pad-setup-btns">
          <button type="button" className="set-link" onClick={() => setSetup(null)}>
            Cancel
          </button>
          <GoldButton font={10} height={28} style={{ width: 120 }} onClick={() => setSetup({ ...setup, step: setup.step + 1 })}>
            Skip
          </GoldButton>
        </div>
      </div>
    );
  }

  return (
    <div className="set-rows">
      <Row
        title="Controller"
        body={
          pads.length ? (
            <span className="pad-list">
              {pads.map(p => (
                <span key={`${p.index}-${p.id}`}>
                  <b>{p.name}</b> · {FAMILY_NAME[p.family]}
                  {p.custom ? ' · your own buttons' : p.standard ? '' : ' · buttons guessed: set them up below if any are wrong'}
                </span>
              ))}
            </span>
          ) : (
            'None connected. Plug one in or pair it by Bluetooth, then press any button. Xbox, PlayStation, Nintendo Switch and other controllers all work.'
          )
        }
      >
        <Seg
          label="Use a controller"
          value={pad.on ? 'on' : 'off'}
          onChange={v => setPad({ on: v === 'on' })}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'on', label: 'On' },
          ]}
        />
      </Row>
      <Row title="Button names" body={pad.glyphs === 'auto' ? 'As printed on the controller you are using.' : `Always ${FAMILY_NAME[pad.glyphs]} names.`}>
        <Seg
          label="Button names"
          value={pad.glyphs}
          onChange={glyphs => setPad({ glyphs })}
          options={[
            { id: 'auto', label: 'Auto' },
            { id: 'xbox', label: 'Xbox' },
            { id: 'playstation', label: 'PlayStation' },
            { id: 'nintendo', label: 'Nintendo' },
          ]}
        />
      </Row>
      <Row title="Confirm button" body={pad.swap ? 'The right-hand button confirms, the bottom one goes back (as on a Nintendo Switch).' : 'The bottom button confirms, the right-hand one goes back (as on Xbox and PlayStation).'}>
        <Seg
          label="Confirm button"
          value={pad.swap ? 'right' : 'bottom'}
          onChange={v => setPad({ swap: v === 'right' })}
          options={[
            { id: 'bottom', label: 'Bottom' },
            { id: 'right', label: 'Right' },
          ]}
        />
      </Row>
      <Row title="Stick dead zone" body="How far a stick moves before it counts. Larger stops a worn stick drifting.">
        <Seg
          label="Stick dead zone"
          value={pad.dead}
          onChange={dead => setPad({ dead })}
          options={[
            { id: 'small', label: 'Small' },
            { id: 'medium', label: 'Medium' },
            { id: 'large', label: 'Large' },
          ]}
        />
      </Row>
      <Row title="Rumble" body={first && !pads.some(p => p.rumble) ? 'A short rumble when something is done. This controller or browser cannot rumble.' : 'A short rumble when something is done.'}>
        <Seg
          label="Rumble"
          value={pad.rumble ? 'on' : 'off'}
          onChange={v => setPad({ rumble: v === 'on' })}
          options={[
            { id: 'off', label: 'Off' },
            { id: 'on', label: 'On' },
          ]}
        />
      </Row>
      <Row title="Buttons" body={pads.length ? 'Press a button: it lights up here.' : 'What each button does.'} />
      <ul className="pad-legend" aria-label="Controller buttons">
        {PAD_LEGEND.map(r => (
          <li key={r.does}>
            <span className="pad-keys">
              {r.keys.map(k => (
                <kbd key={k} className={`pad-key${lit(k) ? ' is-held' : ''}`} data-key={k}>
                  {label(k)}
                </kbd>
              ))}
            </span>
            <span>{r.does}</span>
          </li>
        ))}
      </ul>
      <Row title="Set up buttons" body={first ? 'If a button does the wrong thing (common on unbranded or older controllers), press each one in turn.' : 'Connect a controller first.'}>
        <div style={{ display: 'flex', gap: 6 }}>
          {first?.custom && (
            <button
              type="button"
              className="set-link"
              onClick={() => {
                const maps = { ...pad.maps };
                delete maps[padKey(first.id)];
                setPad({ maps });
              }}
            >
              Reset
            </button>
          )}
          <GoldButton font={10} height={28} style={{ width: 120 }} onClick={() => first && setSetup({ pad: first, step: 0, map: {} })} ariaLabel="Set up buttons">
            Set up
          </GoldButton>
        </div>
      </Row>
    </div>
  );
}

/* ---------------- Help & data ---------------- */

function HelpTab({ s, dispatch }: Props) {
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <div className="set-rows">
      <Row
        title="About TemoLima"
        body={
          <>
            TemoLima means <b>farming</b> in a combination of Swahili and Sesotho: <i>temo</i> is Sesotho and <i>lima</i> is
            Swahili. Grow maize, learn good farming practice and earn partner discounts.
          </>
        }
      />
      {cloudEnabled() && <PlayerCode />}
      <Row title="How the farm works" body="A quick guide to seasons, selling and rewards.">
        <GoldButton font={10} height={28} style={{ width: 120 }} onClick={() => dispatch({ type: 'open', modal: { kind: 'welcome' } })}>
          Open
        </GoldButton>
      </Row>
      <Row title="Page addresses" body="Each page has an address after the #, e.g. #/farm or #/climate/emissions.">
        <code className="set-address">#/settings/help</code>
      </Row>
      <Row title="Design review" body="A sandbox of every screen. Your game is untouched.">
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
      <Row title="Programme" body="A programme or cohort code, if you have one. It is saved with your play.">
        <ProgrammeTags s={s} dispatch={dispatch} />
      </Row>
      <Row title="My evidence" body={evidenceLine(s)}>
        <GoldButton font={10} height={28} style={{ width: 120 }} onClick={() => downloadEvidence(s)}>
          Download
        </GoldButton>
      </Row>
      <Row title="Reset progress" body={confirmReset ? cloudEnabled() ? 'Erases your farmer, seasons, money and points, here and online. Settings and your player code stay.' : 'Erases your farmer, seasons, money and points here. Settings stay.' : 'Start again with a new farmer.'}>
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

/** The player code: this farm's key on any phone. Copy it here; type it on another phone to open the same farm. */
function PlayerCode() {
  const mine = cloudPlayerId();
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [found, setFound] = useState<RestoreResult | null>(null);
  const typed = cleanCode(text);
  const why: Record<string, string> = {
    code: 'That is not a player code. It looks like 8-4-4-4-12 letters and numbers.',
    none: 'No farm is saved under that code yet.',
    offline: 'No signal. Try again when you are online.',
    off: 'Online saving is off in this game.',
    error: 'Could not reach the server. Try again in a moment.',
  };
  const copy = async () => {
    if (!mine) return;
    try {
      await navigator.clipboard.writeText(mine);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no clipboard: the code is on screen to copy by hand */
    }
  };
  const look = async () => {
    if (!typed || typed === mine) return;
    setBusy(true);
    setFound(await cloudRestore(typed));
    setBusy(false);
  };
  const open = () => {
    if (!found?.ok || !typed || !adoptPlayer(typed)) return;
    replaceSave(found.state);
  };
  return (
    <>
      <Row
        title="My player code"
        body={
          <>
            Your farm is saved online under this code. Type it on another phone to play the same farm there. Keep it to
            yourself: anyone with it can open your farm.
            <br />
            <code className="set-address" data-testid="player-code" style={{ userSelect: 'all', display: 'inline-block', marginTop: 4 }}>
              {mine ?? 'Not saved online on this phone'}
            </code>
          </>
        }
      >
        {mine && (
          <GoldButton font={10} height={28} style={{ width: 120 }} onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </GoldButton>
        )}
      </Row>
      <Row
        title="Open my farm from another phone"
        body={
          found?.ok ? (
            <>
              Found {found.farmer ? <b>{found.farmer}</b> : 'a farm'}, saved {new Date(found.savedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}. Opening it
              replaces the farm on this phone.
            </>
          ) : found ? (
            why[found.why]
          ) : (
            'Type the player code from your other phone.'
          )
        }
      >
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {found?.ok ? (
            <>
              <button type="button" className="set-link" onClick={() => setFound(null)}>
                Cancel
              </button>
              <GoldButton font={10} height={28} style={{ width: 120, background: '#c0392b', borderColor: '#8e2a1f' }} onClick={open} ariaLabel="Open this farm here">
                Open it here
              </GoldButton>
            </>
          ) : (
            <>
              <input
                className="name-input"
                aria-label="Player code"
                placeholder="Player code"
                style={{ marginTop: 0, height: 28, width: 190, fontSize: 9 }}
                value={text}
                maxLength={48}
                autoComplete="off"
                spellCheck={false}
                onChange={e => {
                  setText(e.target.value);
                  setFound(null);
                }}
                onKeyDown={e => e.key === 'Enter' && void look()}
              />
              <GoldButton font={10} height={28} style={{ width: 80, opacity: typed && typed !== mine && !busy ? 1 : 0.5 }} onClick={() => void look()} ariaLabel="Find farm">
                {busy ? '…' : 'Find'}
              </GoldButton>
            </>
          )}
        </div>
      </Row>
    </>
  );
}

/** The programme / cohort tags: type a code, tap × to remove one. */
function ProgrammeTags({ s, dispatch }: Props) {
  const [text, setText] = useState('');
  const tags = evidenceOf(s.evidence).tags;
  const add = () => {
    if (!cleanTag(text)) return;
    dispatch({ type: 'evidenceTag', tag: text, on: true });
    setText('');
  };
  return (
    <div className="set-tags">
      {tags.map(t => (
        <i key={t}>
          {t}
          <button type="button" aria-label={`Remove ${t}`} onClick={() => dispatch({ type: 'evidenceTag', tag: t, on: false })}>
            ×
          </button>
        </i>
      ))}
      <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} placeholder="Code" aria-label="Programme code" maxLength={32} />
      <button type="button" className="set-link" onClick={add}>
        Add
      </button>
    </div>
  );
}

function evidenceLine(s: GameState) {
  const x = evidenceSummary(s);
  return `${x.decisions} decisions kept on this device: ${x.checks} checks (${x.checksPerDay} a day), ${x.treatments} treatments (${x.climateSmartTreatments} climate-smart)${x.medianMinutesToFix !== null ? `, ${x.medianMinutesToFix} min from seeing a risk to fixing it` : ''}. Download them as a file.`;
}

function downloadEvidence(s: GameState) {
  const blob = new Blob([JSON.stringify(evidenceExport(s), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `lima-evidence-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
