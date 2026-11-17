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
import { COUNTRIES, countryOf, money } from '../money';
import { clearSave, initialState, type Action, type GameState, type Settings, type SettingsTab } from '../state';

/* Settings: a full page with four sections. Every control changes the game straight away and is kept on this device.
   Farmer: rename and change look. Game: character style, farm view, read aloud. Display: graphics, motion, full
   screen. Help & data: about the game and its name, the intro, design review, and reset (which keeps these settings). */

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
      <Row title="Reset progress" body={confirmReset ? 'Erases your farmer, seasons, money and points here. Settings stay.' : 'Start again with a new farmer.'}>
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
