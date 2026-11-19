import { useEffect, type Dispatch } from 'react';
import { act } from '../onsite/model';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import { money } from '../money';
import { dayNumber } from '../rounds/farms';
import { currentDay } from '../trials/model';
import type { Action, GameState, SecurityTab } from '../state';
import { LIFE } from '../livestock/config';
import { LockTag, OpenLine } from '../unlock/Lock';
import { isOpen } from '../unlock/model';
import { MEASURES, TARGETS, type Target } from './config';
import { activeMeasures, bestAgainst, exposure, nightlyCost, securityOf, storeTheftShare, theftOpen } from './model';

/* The Security page: keeping the farm safe from thieves (and the hens from predators). Protect (every measure, what
   it cuts and what it costs), Risks (what is out there tonight and its chance, before and after), and Night reports
   (each night's news). Opened from the SECURITY button, the main menu, or a theft's morning report. */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: SecurityTab };

const TABS: { id: SecurityTab; label: string; icon: string }[] = [
  { id: 'protect', label: 'Protect', icon: '🛡' },
  { id: 'risk', label: 'Risks tonight', icon: '⚠' },
  { id: 'reports', label: 'Night reports', icon: '☾' },
];

const pct = (n: number) => `${Math.round(n * 100)}%`;
const SHORT: Record<Target, string> = { crops: 'crops', hens: 'hens', predators: 'predators', cows: 'cows', tools: 'tools', store: 'store', cash: 'cash', water: 'water', diesel: 'diesel' };

export function SecurityPage({ s, dispatch, tab: startTab }: Props) {
  const tab: SecurityTab = startTab ?? 'protect';
  const setTab = (t: SecurityTab) => dispatch({ type: 'open', modal: { kind: 'security', tab: t } });
  const close = () => dispatch({ type: 'close' });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'close' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  const sec = securityOf(s.security);
  return (
    <div className="abs settings-page lv-page" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Security">
      <div className="scrim" onClick={close} />
      <div className="fs-panel set-panel" style={{ left: 24, top: 46, width: 826, height: 334 }}>
        <nav className="set-tabs cl-tabs" aria-label="Security sections">
          <p className="set-heading">Security</p>
          {TABS.map(t => (
            <button key={t.id} type="button" className={`set-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <i aria-hidden="true">{t.icon}</i>
              {t.label}
            </button>
          ))}
          <p className="set-foot">
            {sec.totals.thefts} theft{sec.totals.thefts === 1 ? '' : 's'} · {money(sec.totals.lost)} lost
            {sec.totals.recovered ? ` · ${money(sec.totals.recovered)} found again` : ''}
            <br />
            Watch: {money(nightlyCost(s))} a night
          </p>
        </nav>
        <section className="set-content cl-content" aria-label={TABS.find(t => t.id === tab)!.label}>
          {!theftOpen(s) && (
            <p className="lv-locked" role="note">
              Thieves notice a farm once it has animals and a crop: from <b>day {LIFE.startDay}</b>, every night has its risks. Put protection in place now.
            </p>
          )}
          {tab === 'protect' && <Protect s={s} dispatch={dispatch} />}
          {tab === 'risk' && <Risks s={s} />}
          {tab === 'reports' && <Reports s={s} />}
        </section>
      </div>
      <NavBar horizontal onBack={close} style={{ right: 62, top: 8 }} />
      <CloseX className="page-x" onClick={close} />
      <p className="set-title-bar">
        <span aria-hidden="true">🛡</span> Security · <b>{TABS.find(t => t.id === tab)!.label}</b>
      </p>
    </div>
  );
}

function Protect({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const sec = securityOf(s.security);
  return (
    <div className="lv-measures">
      <OpenLine s={s} total={MEASURES.filter(m => !m.needs || s.biz).length} what="measures" />
      {MEASURES.filter(m => !m.needs || s.biz).map(m => {
        const owned = sec.owned.includes(m.id);
        const hired = sec.hired.includes(m.id);
        const cuts = (Object.entries(m.cut) as [Target, number][]).sort((a, b) => b[1] - a[1]);
        const at = MEASURES.indexOf(m);
        const gated = !owned && !hired && !isOpen(s, at);
        return (
          <div key={m.id} className={`lv-job${owned || hired ? ' is-done' : ''}${gated ? ' is-gated' : ''}`} data-option={m.id}>
            <span className="lv-job-text">
              <b>{m.name}</b>
              <small>{m.does}</small>
              <small className="lv-cuts">
                Cuts: {cuts.map(([t, k]) => `${SHORT[t]} ${pct(k)}`).join(' · ')}
                {m.recover ? ` · finds stolen ${(Object.keys(m.recover) as Target[]).map(t => SHORT[t]).join(', ')}` : ''}
              </small>
            </span>
            {gated ? (
              <LockTag s={s} index={at} />
            ) : m.kind === 'nightly' ? (
              <button type="button" className={`lv-btn ${hired ? 'is-quiet' : 'is-go'}`} onClick={() => dispatch({ type: 'securityHire', id: m.id, on: !hired })} aria-pressed={hired} aria-label={hired ? `Stop the ${m.name.toLowerCase()}` : `Hire a ${m.name.toLowerCase()} for ${money(m.nightly ?? 0)} a night`}>
                {hired ? 'Stop' : 'Hire'} · {money(m.nightly ?? 0)}/night
              </button>
            ) : owned ? (
              <span className="lv-done">✓ In place{m.nightly ? ` · ${money(m.nightly)}/night` : ''}</span>
            ) : (
              <button type="button" className="lv-btn is-go" onClick={() => act(s, dispatch, { type: 'securityBuy', id: m.id })} aria-label={`${m.name}: ${m.price ? money(m.price) : 'free'}`}>
                {m.price ? `Buy · ${money(m.price)}` : 'Set up · free'}
                {m.nightly ? ` + ${money(m.nightly)}/night` : ''}
              </button>
            )}
          </div>
        );
      })}
      <p className="cl-tip cl-note">
        Also: harvest the six farms on time (ripe maize left standing is stolen most), store the classic season’s maize in the co-op warehouse, shut the coop every night, and take
        payments on mobile money.
      </p>
    </div>
  );
}

function Risks({ s }: { s: GameState }) {
  const day = s.trial ? currentDay(s.trial, dayNumber()) : 0;
  const rows = exposure(s, day);
  const ids = activeMeasures(s);
  const store = s.stage === 6 && s.harvested ? storeTheftShare(s) : 0;
  return (
    <div>
      <table className="lv-table">
        <thead>
          <tr>
            <th>What</th>
            <th>Out there tonight</th>
            <th>Chance</th>
            <th>With your protection</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.target} className={r.at ? '' : 'is-none'}>
              <th scope="row" title={TARGETS[r.target].what}>
                {r.label}
              </th>
              <td>
                {r.target === 'store' && r.at ? `${r.at} · ${pct(store)} of it over its time in store` : (r.at ?? 'Nothing to take')}
                {r.why.length ? <small> · {r.why.join(', ')}</small> : null}
              </td>
              <td>{r.at ? pct(r.base) : '—'}</td>
              <td className={r.at && r.chance > 0.05 ? 'is-bad' : ''}>
                {r.at ? (
                  <>
                    <b>{pct(r.chance)}</b>
                    {r.cut > 0 ? <small> (−{pct(r.cut)})</small> : null}
                    {r.chance > 0.02 && <small className="lv-tip"> {bestAgainst(s, r.target)}</small>}
                  </>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="set-body lv-room">{ids.length ? `In place: ${ids.length} measure${ids.length === 1 ? '' : 's'}.` : 'Nothing in place yet: see Protect.'} A night’s chance is for that one night; over a cycle they add up.</p>
    </div>
  );
}

function Reports({ s }: { s: GameState }) {
  const sec = securityOf(s.security);
  if (!sec.reports.length) return <p className="cl-empty">No nights yet. Each morning’s news shows here: thefts, predators, and what happened to the animals.</p>;
  return (
    <ul className="cl-log">
      {sec.reports.map((r, k) => (
        <li key={k}>
          <span className="cl-where">Night to day {r.day}</span>
          <span className="cl-log-text">
            {r.events.length === 0 ? <b>A quiet night{r.paid ? ` · watch paid ${money(r.paid)}` : ''}</b> : null}
            {r.events.map((e, i) => (
              <small key={i} className={`lv-ev is-${e.kind}`}>
                {e.text}
                {e.value ? ` (${money(e.value)})` : ''}
                {e.tip ? <i> {e.tip}</i> : null}
              </small>
            ))}
            {r.events.length > 0 && r.paid ? <small>Watch paid {money(r.paid)}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
