import { useEffect, useState, type Dispatch } from 'react';
import { NavBar } from '../components/Nav';
import type { Action, GameState } from '../state';
import { GROUPS, OPTIONS, OVERVIEW, PARTNER_EMAIL, STATUS, optionOf, optionsIn, shortlistText, type GroupTab, type PartnerOption, type PartnerTab, type Status } from './data';

/* The Partnerships page: every way a brand, a school or a service can be part of Lima, grouped by area, each with the
   place in the game where players meet it. A partner taps Interested on the ones that fit and sends the shortlist.
   Opened from the PARTNERS button on the farm, the main menu, or #/partners (also before the farm opens). */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: PartnerTab };

const TABS: { id: PartnerTab; label: string; icon: string }[] = [
  { id: 'overview', label: 'Overview', icon: '◎' },
  ...GROUPS.map(g => ({ id: g.id as PartnerTab, label: g.label, icon: g.icon })),
  { id: 'shortlist', label: 'Shortlist', icon: '★' },
];

export function PartnersPage({ s, dispatch, tab: startTab }: Props) {
  // the section is part of the address (#/partners/farm-inputs), so it lives in the game state
  const tab: PartnerTab = startTab ?? 'overview';
  const setTab = (t: PartnerTab) => dispatch({ type: 'open', modal: { kind: 'partners', tab: t } });
  const close = () => dispatch({ type: 'close' });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'close' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  const picks = s.partnerPicks;
  const label = TABS.find(t => t.id === tab)!.label;
  // the game's other screens open from a card once the farm is open (before that, only the story can be played)
  const canSee = s.fs.phase === 'done';

  return (
    <div className="abs settings-page partners-page" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Partnerships">
      <div className="scrim" onClick={close} />
      <div className="fs-panel set-panel" style={{ left: 18, top: 40, width: 838, height: 348 }}>
        <nav className="set-tabs pt-tabs" aria-label="Partnership areas">
          <p className="set-heading">Partnerships</p>
          {TABS.map(t => (
            <button key={t.id} type="button" className={`set-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <i aria-hidden="true">{t.icon}</i>
              {t.label}
              {t.id === 'shortlist' && picks.length > 0 && <b className="pt-count">{picks.length}</b>}
            </button>
          ))}
        </nav>
        <section className="set-content pt-content" aria-label={label}>
          {tab === 'overview' && <Overview go={setTab} />}
          {GROUPS.some(g => g.id === tab) && <Group g={tab as GroupTab} picks={picks} dispatch={dispatch} canSee={canSee} />}
          {tab === 'shortlist' && <Shortlist picks={picks} dispatch={dispatch} go={setTab} />}
        </section>
      </div>
      <NavBar horizontal onBack={close} hideHome={s.fs.phase !== 'done'} style={{ right: 8, top: 6 }} />
      <p className="set-title-bar">
        <span aria-hidden="true">🤝</span> Partnerships · <b>{label}</b>
      </p>
    </div>
  );
}

function StatusChip({ status }: { status: Status }) {
  return (
    <span className={`pt-status is-${status}`} title={STATUS[status].means}>
      {STATUS[status].label}
    </span>
  );
}

/* ---------------- Overview ---------------- */

function Overview({ go }: { go: (t: PartnerTab) => void }) {
  return (
    <div className="pt-overview">
      <h2 className="pt-title">{OVERVIEW.title}</h2>
      <p className="pt-lead">{OVERVIEW.lead}</p>
      <div className="cl-tiles">
        {OVERVIEW.facts.map(f => (
          <div key={f.label} className="cl-tile">
            <p className="cl-tile-label">{f.label}</p>
            <p className="cl-tile-value">{f.value}</p>
            <p className="cl-tile-sub">{f.sub}</p>
          </div>
        ))}
      </div>

      <p className="pt-sub">Explore by area</p>
      <div className="pt-areas">
        {GROUPS.map(g => {
          return (
            <button key={g.id} type="button" className="pt-area" onClick={() => go(g.id)}>
              <span className="pt-area-icon" aria-hidden="true">
                {g.icon}
              </span>
              <b>{g.label}</b>
              <small>{g.covers}</small>
              <i className="pt-area-n">{optionsIn(g.id).length} ways →</i>
            </button>
          );
        })}
      </div>

      <div className="cl-two">
        <div>
          <p className="pt-sub">How it works</p>
          <ol className="pt-steps">
            {OVERVIEW.steps.map(t => (
              <li key={t}>{t}</li>
            ))}
          </ol>
          <p className="pt-sub">What each label means</p>
          <ul className="pt-legend">
            {(Object.keys(STATUS) as Status[]).map(k => (
              <li key={k}>
                <StatusChip status={k} /> {STATUS[k].means}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="pt-sub">The rules every partner keeps</p>
          <ul className="pt-rules">
            {OVERVIEW.rules.map(r => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ---------------- an area ---------------- */

function Group({ g, picks, dispatch, canSee }: { g: GroupTab; picks: string[]; dispatch: Dispatch<Action>; canSee: boolean }) {
  const group = GROUPS.find(x => x.id === g)!;
  return (
    <div>
      <p className="pt-blurb">{group.blurb}</p>
      <div className="pt-cards">
        {optionsIn(g).map(o => (
          <Card key={o.id} o={o} picked={picks.includes(o.id)} dispatch={dispatch} canSee={canSee} />
        ))}
      </div>
      {!canSee && <p className="pt-note">Finish the first crop checks to open these screens in the game.</p>}
    </div>
  );
}

function Card({ o, picked, dispatch, canSee }: { o: PartnerOption; picked: boolean; dispatch: Dispatch<Action>; canSee: boolean }) {
  return (
    <article className={`pt-card${picked ? ' is-picked' : ''}`} aria-label={o.name}>
      <header className="pt-card-head">
        <span className="pt-card-icon" aria-hidden="true">
          {o.icon}
        </span>
        <h3>{o.name}</h3>
        <StatusChip status={o.status} />
      </header>
      <p className="pt-pitch">{o.pitch}</p>
      <p className="pt-label">Where players meet it</p>
      <ul className="pt-where">
        {o.where.map(w => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      <p className="pt-label">What you get</p>
      <p className="pt-gets">{o.gets}</p>
      <div className="pt-actions">
        <button type="button" className={`pt-pick${picked ? ' is-on' : ''}`} aria-pressed={picked} onClick={() => dispatch({ type: 'partnerPick', id: o.id })}>
          {picked ? '✓ On my shortlist' : '+ Interested'}
        </button>
        {o.see && canSee && (
          <button type="button" className="pt-see" onClick={() => dispatch({ type: 'open', modal: o.see!, back: true })} aria-label={`See it in the game: ${o.name}`}>
            See it in the game →
          </button>
        )}
      </div>
    </article>
  );
}

/* ---------------- the shortlist ---------------- */

function Shortlist({ picks, dispatch, go }: { picks: string[]; dispatch: Dispatch<Action>; go: (t: PartnerTab) => void }) {
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const picked = picks.map(optionOf).filter((o): o is PartnerOption => !!o);
  const text = shortlistText(picks);
  if (picked.length === 0)
    return (
      <div className="pt-empty">
        <p>Your shortlist is empty.</p>
        <p>Open an area and tap “+ Interested” on the ways of partnering that fit you.</p>
        <button type="button" className="pt-pick" onClick={() => go('inputs')}>
          Start with Farm inputs →
        </button>
      </div>
    );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('yes');
    } catch {
      setCopied('no');
    }
  };
  return (
    <div>
      <p className="pt-blurb">
        {picked.length} of {OPTIONS.length} ways to partner. Send this list to the Lima team and we will plan a pilot with you.
      </p>
      <ul className="pt-list">
        {picked.map(o => (
          <li key={o.id}>
            <span aria-hidden="true">{o.icon}</span>
            <span className="pt-list-text">
              <b>{o.name}</b>
              <small>
                {GROUPS.find(g => g.id === o.group)!.label} · {o.pitch}
              </small>
            </span>
            <StatusChip status={o.status} />
            <button type="button" className="pt-remove" onClick={() => dispatch({ type: 'partnerPick', id: o.id })} aria-label={`Take ${o.name} off the shortlist`}>
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="pt-actions">
        <button type="button" className="pt-pick is-on" onClick={copy}>
          Copy the shortlist
        </button>
        {PARTNER_EMAIL && (
          <a className="pt-see" href={`mailto:${PARTNER_EMAIL}?subject=${encodeURIComponent('Lima partnership')}&body=${encodeURIComponent(text)}`}>
            Email it to the Lima team →
          </a>
        )}
        {copied === 'yes' && <span className="pt-copied" role="status">Copied. Paste it into an email or a message.</span>}
        {copied === 'no' && <span className="pt-copied" role="status">This browser would not copy it: select the list below.</span>}
      </div>
      {copied === 'no' && <textarea className="pt-text" readOnly value={text} aria-label="The shortlist as text" />}
    </div>
  );
}
