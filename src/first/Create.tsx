import { useState } from 'react';
import { img } from '../assets';
import { GoldButton } from '../components/ui';
import { FarmerFigure, FarmerPortrait } from './art';
import { LOOKS, NAME_SUGGESTIONS } from './data';

const clean = (raw: string) => {
  const s = raw.replace(/[^\p{L}' -]/gu, '').replace(/\s+/g, ' ').trimStart().slice(0, 14);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** The first screen a new player sees: name a farmer and pick a look. */
export function CreateFarmer({ onDone }: { onDone: (name: string, look: number) => void }) {
  const [name, setName] = useState('');
  const [look, setLook] = useState(0);
  const ready = name.trim().length >= 2;
  const submit = () => ready && onDone(name.trim(), look);

  return (
    <div className="abs fs-screen" style={{ inset: 0 }}>
      <div className="abs" style={{ inset: 0, background: 'rgba(20,30,12,0.45)' }} />
      <svg viewBox="-60 -100 120 112" className="abs create-farmer" style={{ left: 60, top: 70, width: 270, height: 252 }} aria-hidden="true">
        <ellipse cx={0} cy={0} rx={46} ry={8} fill="rgba(0,0,0,0.25)" />
        <FarmerFigure look={LOOKS[look]} />
      </svg>
      {name.trim() && (
        <div className="name-bubble" style={{ left: 150, top: 40 }}>
          {name.trim()}
        </div>
      )}

      <form
        className="fs-panel create-card"
        style={{ left: 380, top: 34, width: 452, height: 334 }}
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="abs" style={{ left: 124, top: -22, width: 203, height: 58 }}>
          <img src={img.plank} alt="" width={203} height={58} />
          <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 14 }}>
            Karibu Lima
          </span>
        </div>

        <label className="create-label" htmlFor="farmer-name">
          Name your farmer
        </label>
        <input
          id="farmer-name"
          className="name-input"
          value={name}
          onChange={e => setName(clean(e.target.value))}
          placeholder="Type a name"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="go"
          maxLength={14}
        />
        <div className="chips" role="group" aria-label="Name ideas">
          {NAME_SUGGESTIONS.map(n => (
            <button type="button" key={n} className={`name-chip${name === n ? ' is-on' : ''}`} onClick={() => setName(n)}>
              {n}
            </button>
          ))}
        </div>

        <p className="create-label" style={{ marginTop: 14 }}>
          Pick a look
        </p>
        <div className="looks" role="radiogroup" aria-label="Looks">
          {LOOKS.map((l, i) => (
            <button type="button" role="radio" aria-checked={look === i} aria-label={`Look ${i + 1}`} key={i} className={`look-btn${look === i ? ' is-on' : ''}`} onClick={() => setLook(i)}>
              <FarmerPortrait look={l} size={50} />
            </button>
          ))}
        </div>

        <GoldButton font={13} height={40} style={{ position: 'absolute', left: 30, right: 30, bottom: 20, opacity: ready ? 1 : 0.5 }} onClick={submit} ariaLabel="Twende! Let's go">
          Twende! Let's go
        </GoldButton>
      </form>
    </div>
  );
}
