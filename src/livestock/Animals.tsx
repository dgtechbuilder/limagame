import { useEffect, useMemo, type Dispatch, type ReactNode } from 'react';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import { money } from '../money';
import { WATER } from '../water/config';
import { capacityOf, tankOf, useToday } from '../water/model';
import type { Action, AnimalsTab, GameState } from '../state';
import { CARE, COOPS, ISSUES, LIFE, NO_COOP, PREVENT, coopOption, issueOf, type Group, type IssueId } from './config';
import {
  animalWater,
  careCost,
  careDoneToday,
  careDue,
  careOpen,
  coopPrice,
  coopRoom,
  countOf,
  crowded,
  dirty,
  eggsToday,
  issueRisk,
  lifeOf,
  milkToday,
  preventCost,
  preventLeft,
} from './model';
import { roll } from './rand';

/* The Animals page: the cows and the hens. Today (the day's jobs), Health (problems by their signs, and the fix to
   choose; vaccines and tick control), Water (what they drink and waste from the tank), Coop (build it from day 2), and
   Herd (buy and sell). Opened from the ANIMALS button, the main menu, or by walking to the pen or the coop. */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: AnimalsTab };

const TABS: { id: AnimalsTab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '☀' },
  { id: 'health', label: 'Health', icon: '✚' },
  { id: 'water', label: 'Water', icon: '💧' },
  { id: 'coop', label: 'Coop', icon: '⌂' },
  { id: 'herd', label: 'Herd', icon: '🐄' },
];

const L = (n: number) => `${Math.round(n).toLocaleString('en-US')} L`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const GROUP_NAME: Record<Group, string> = { cows: 'Cows', hens: 'Hens' };

export function AnimalsPage({ s, dispatch, tab: startTab }: Props) {
  const tab: AnimalsTab = startTab ?? 'today';
  const setTab = (t: AnimalsTab) => dispatch({ type: 'open', modal: { kind: 'animals', tab: t } });
  const close = () => dispatch({ type: 'close' });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'close' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  const l = lifeOf(s.life);
  const open = careOpen(s);
  const issues = l.issues.length;
  return (
    <div className="abs settings-page lv-page" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Animals">
      <div className="scrim" onClick={close} />
      <div className="fs-panel set-panel" style={{ left: 24, top: 46, width: 826, height: 334 }}>
        <nav className="set-tabs cl-tabs" aria-label="Animals sections">
          <p className="set-heading">Animals</p>
          {TABS.map(t => (
            <button key={t.id} type="button" className={`set-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <i aria-hidden="true">{t.icon}</i>
              {t.label}
              {t.id === 'health' && issues > 0 && <b className="lv-count">{issues}</b>}
            </button>
          ))}
          <p className="set-foot">
            Farm day {l.day}
            {open ? '' : ` · care starts on day ${LIFE.startDay}`}
            <br />
            Numbers are estimates for learning.
          </p>
        </nav>
        <section className="set-content cl-content" aria-label={TABS.find(t => t.id === tab)!.label}>
          {!open && <Locked />}
          {tab === 'today' && <Today s={s} dispatch={dispatch} go={setTab} />}
          {tab === 'health' && <Health s={s} dispatch={dispatch} />}
          {tab === 'water' && <Water s={s} dispatch={dispatch} />}
          {tab === 'coop' && <Coop s={s} dispatch={dispatch} />}
          {tab === 'herd' && <Herd s={s} dispatch={dispatch} />}
        </section>
      </div>
      <NavBar horizontal onBack={close} style={{ right: 62, top: 8 }} />
      <CloseX className="page-x" onClick={close} />
      <p className="set-title-bar">
        <span aria-hidden="true">🐔</span> Animals · <b>{TABS.find(t => t.id === tab)!.label}</b>
      </p>
    </div>
  );
}

function Locked() {
  return (
    <p className="lv-locked" role="note">
      Your cows and hens come into your care on <b>day {LIFE.startDay}</b>: sleep at the farmhouse to end day 1 (or come back tomorrow). Then you feed, water and milk, build the
      chicken coop, and keep the farm safe from thieves.
    </p>
  );
}

function Meter({ value, label }: { value: number; label: string }) {
  const tone = value >= 70 ? 'good' : value >= 40 ? 'mid' : 'bad';
  return (
    <span className={`lv-meter is-${tone}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
      <span style={{ width: `${Math.max(3, value)}%` }} />
    </span>
  );
}

function Btn({ children, onClick, disabled, label, tone }: { children: ReactNode; onClick: () => void; disabled?: boolean; label?: string; tone?: 'go' | 'quiet' }) {
  return (
    <button type="button" className={`lv-btn${tone ? ` is-${tone}` : ''}`} onClick={onClick} disabled={disabled} aria-label={label}>
      {children}
    </button>
  );
}

/* ---------------- Today ---------------- */

function Today({ s, dispatch, go }: { s: GameState; dispatch: Dispatch<Action>; go: (t: AnimalsTab) => void }) {
  const l = lifeOf(s.life);
  const open = careOpen(s);
  const w = animalWater(s);
  return (
    <div className="lv-today">
      <div className="cl-tiles">
        {(['cows', 'hens'] as Group[]).map(g => (
          <div key={g} className="cl-tile">
            <p className="cl-tile-label">
              {GROUP_NAME[g]} · {countOf(s, g)}
            </p>
            <Meter value={l.health[g]} label={`${GROUP_NAME[g]} health ${Math.round(l.health[g])} of 100`} />
            <p className="cl-tile-sub">
              Health {Math.round(l.health[g])}/100
              {l.issues.filter(i => issueOf(i.id).group === g).length ? ' · a problem showing' : ''}
              {dirty(s, g) ? ` · ${g === 'cows' ? 'pen' : 'coop'} dirty` : ''}
            </p>
          </div>
        ))}
        <div className="cl-tile">
          <p className="cl-tile-label">Today</p>
          <p className="cl-tile-value">{money(l.today.earned)}</p>
          <p className="cl-tile-sub">
            {l.today.milk} L milk · {l.today.eggs} eggs · care {money(l.today.spent)}
          </p>
        </div>
        <div className="cl-tile">
          <p className="cl-tile-label">Water today</p>
          <p className="cl-tile-value">{L(w.total)}</p>
          <p className="cl-tile-sub">
            from the tank ·{' '}
            <button type="button" className="set-link cl-inline" onClick={() => go('water')}>
              Water
            </button>
          </p>
        </div>
      </div>
      <div className="lv-jobs">
        {(['cows', 'hens'] as Group[]).map(g => (
          <div key={g} className="lv-col">
            <p className="set-title">
              {GROUP_NAME[g]}
              {g === 'cows' ? ` · ${milkToday(s)} L of milk today if milked now` : ` · ${eggsToday(s)} egg${eggsToday(s) === 1 ? '' : 's'} today if collected now`}
            </p>
            {countOf(s, g) === 0 ? (
              <p className="cl-empty">No {g}. Buy some in Herd.</p>
            ) : (
              CARE.filter(c => c.group === g).map(c => {
                const done = careDoneToday(s, c.id);
                const due = careDue(s, c.id);
                const cost = careCost(s, c.id);
                const noCoop = c.id === 'closeCoop' && !l.coop;
                return (
                  <div key={c.id} className={`lv-job${done ? ' is-done' : ''}`}>
                    <span className="lv-job-text">
                      <b>{c.label}</b>
                      <small>{noCoop ? 'Build the coop first (Coop).' : c.does}</small>
                    </span>
                    {done ? (
                      <span className="lv-done" aria-label={`${c.label}: done today`}>
                        ✓ Done
                      </span>
                    ) : !due && !noCoop ? (
                      <span className="lv-done is-later">Not yet</span>
                    ) : (
                      <Btn tone="go" disabled={!open || noCoop} onClick={() => dispatch({ type: 'animalCare', id: c.id })} label={`${c.label}${cost ? ` for ${money(cost)}` : ''}`}>
                        {c.id === 'milk' || c.id === 'eggs' ? 'Collect' : 'Do it'}
                        {cost ? ` · ${money(cost)}` : ''}
                      </Btn>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Health ---------------- */

/** The fixes in an order that does not give the right one away (the same order each time for the same problem). */
function shuffled(id: IssueId, since: number) {
  return [...issueOf(id).fixes].map((f, i) => ({ f, k: roll(`${id}:${since}:${i}`) })).sort((a, b) => a.k - b.k).map(x => x.f);
}

function Health({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const l = lifeOf(s.life);
  const open = careOpen(s);
  return (
    <div className="lv-health">
      {l.issues.length === 0 ? (
        <p className="cl-tip">
          No problems showing. Cows: {pct(issueRisk(s, 'cows').chance)} chance of one tonight; hens: {pct(issueRisk(s, 'hens').chance)}. Clean, fed, watered and vaccinated animals get sick
          less.
        </p>
      ) : (
        l.issues.map(i => {
          const def = issueOf(i.id);
          const tried = l.tried[i.id] ?? [];
          const last = tried.length ? def.fixes.find(f => f.id === tried[tried.length - 1]) : null;
          return (
            <div key={i.id} className="lv-issue" aria-label={`A problem with the ${def.group}`}>
              <p className="lv-issue-head">
                <span className="cl-where">{GROUP_NAME[def.group]}</span>
                <b>What you see</b>
                <small>since day {i.since}</small>
              </p>
              <p className="lv-signs">{def.signs}</p>
              {last && !last.right && <p className="lv-wrong">Not that: {last.lesson}</p>}
              <div className="lv-fixes" role="group" aria-label="Choose the fix">
                {shuffled(i.id, i.since).map(f => (
                  <Btn key={f.id} disabled={!open || tried.includes(f.id)} onClick={() => dispatch({ type: 'animalFix', issue: i.id, fix: f.id })}>
                    {f.label}
                    {f.cost ? ` · ${money(f.cost)}` : ''}
                  </Btn>
                ))}
              </div>
              {tried.length > 0 && (
                <p className="lv-hint">
                  It is <b>{def.name}</b>. {def.cause}
                </p>
              )}
            </div>
          );
        })
      )}
      <p className="set-title lv-sub">Keep them well</p>
      {PREVENT.map(p => {
        const left = preventLeft(s, p.id);
        const cost = preventCost(s, p.id);
        const keeps = ISSUES.filter(i => i.preventBy === p.id).map(i => i.name);
        return (
          <div key={p.id} className="lv-job">
            <span className="lv-job-text">
              <b>{p.label}</b>
              <small>
                {p.does}
                {keeps.length ? ` Keeps away ${keeps.join(', ')}.` : ''}
              </small>
            </span>
            {left > 2 ? (
              <span className="lv-done">✓ {left} days left</span>
            ) : (
              <Btn tone="go" disabled={!open} onClick={() => dispatch({ type: 'animalPrevent', id: p.id })} label={`${p.label} for ${money(cost)}`}>
                {left ? 'Renew' : 'Do it'} · {money(cost)}
              </Btn>
            )}
          </div>
        );
      })}
      {l.log.length > 0 && (
        <>
          <p className="set-title lv-sub">Lately</p>
          <ul className="lv-log">
            {l.log.slice(0, 5).map((e, k) => (
              <li key={k}>
                <span className="cl-where">Day {e.day}</span> {e.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ---------------- Water ---------------- */

function Water({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const tank = tankOf(s.tank);
  const cap = capacityOf(s);
  const w = animalWater(s);
  const herd = tank.herd;
  const all = useToday(s).total + w.heatDrink + w.extra;
  const days = all > 0 ? Math.floor(tank.level / all) : null;
  const leak = lifeOf(s.life).issues.some(i => i.id === 'leak');
  return (
    <div className="cl-two">
      <div>
        <p className="set-title">What the animals use</p>
        <div className="lv-rows">
          <p>
            <span>
              {herd.cows} cow{herd.cows === 1 ? '' : 's'} × {WATER.animals.cow.litres} L
            </span>
            <b>{L(herd.cows * WATER.animals.cow.litres)}</b>
          </p>
          <p>
            <span>
              {herd.hens} hen{herd.hens === 1 ? '' : 's'} × {WATER.animals.hen.litres} L
            </span>
            <b>{L(herd.hens * WATER.animals.hen.litres)}</b>
          </p>
          {w.heatDrink > 0 && (
            <p>
              <span>A dry season: cows drink a fifth more</span>
              <b>+{L(w.heatDrink)}</b>
            </p>
          )}
          {w.extra > 0 && (
            <p className="is-bad">
              <span>{leak ? 'Wasted: the trough is leaking' : 'Extra for a problem (Health)'}</span>
              <b>+{L(w.extra)}</b>
            </p>
          )}
          <p className="is-total">
            <span>A day</span>
            <b>{L(w.total)}</b>
          </p>
        </div>
        <p className="cl-tip cl-note">
          Fill the trough every day: a cow with no water gives no milk. A leak or a dry spell can use more than the cows drink. Fix drips the day they start, and keep the tank above a day of
          use.
        </p>
      </div>
      <div>
        <p className="set-title">The tank</p>
        <div className="lv-rows">
          <p>
            <span>In the tank</span>
            <b>
              {L(tank.level)} of {L(cap)}
            </b>
          </p>
          <p>
            <span>The farm’s use today (house, animals, rows)</span>
            <b>{L(all)}</b>
          </p>
          <p className={days !== null && days < 3 ? 'is-bad' : ''}>
            <span>At this use, the tank lasts</span>
            <b>{days === null ? '—' : `${days} day${days === 1 ? '' : 's'}`}</b>
          </p>
        </div>
        <div className="lv-actions">
          <Btn tone="go" onClick={() => dispatch({ type: 'open', modal: { kind: 'climate', tab: 'tank' } })}>
            Buy water · rain in
          </Btn>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Coop ---------------- */

function Coop({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const l = lifeOf(s.life);
  const open = careOpen(s);
  const have = coopOption(l.coop);
  const hens = countOf(s, 'hens');
  return (
    <div className="lv-coop">
      <p className="cl-tip">
        {have ? (
          <>
            Your <b>{have.name.toLowerCase()}</b> holds {have.room} hens; you have {hens}.{crowded(s) ? ' It is crowded: disease and egg eating are likelier.' : ''} Shut its door every evening
            (Today).
          </>
        ) : (
          <>
            No coop yet: {hens} hens roost in the trees. They lay {pct(-NO_COOP.eggs)} of their eggs in the bush, and thieves and mongooses take them at night. Build one from day{' '}
            {LIFE.startDay}.
          </>
        )}
      </p>
      <div className="lv-options">
        {COOPS.map(c => {
          const price = coopPrice(l.coop, c.id);
          const built = l.coop === c.id;
          return (
            <div key={c.id} className={`lv-option${built ? ' is-on' : ''}`}>
              <p className="set-title">{c.name}</p>
              <p className="set-body">{c.does}</p>
              <ul className="lv-facts">
                <li>Room for {c.room} hens</li>
                <li>+{pct(c.eggs)} eggs: nest boxes</li>
                <li>Door shut: −{pct(c.theft)} theft, −{pct(c.predators)} predators</li>
                <li>−{pct(c.disease)} coop diseases</li>
              </ul>
              {built ? (
                <span className="lv-done">✓ Built</span>
              ) : price === null ? (
                <span className="lv-done is-later">You have a better one</span>
              ) : (
                <Btn tone="go" disabled={!open} onClick={() => dispatch({ type: 'coopBuild', id: c.id })} label={`${l.coop ? 'Upgrade to' : 'Build'} the ${c.name.toLowerCase()} for ${money(price)}`}>
                  {l.coop ? 'Upgrade' : 'Build'} · {money(price)}
                </Btn>
              )}
            </div>
          );
        })}
      </div>
      <p className="set-body lv-room">
        Room now: {coopRoom(l.coop)} hens{l.coop ? '' : ' in the trees'}. More hens than room make problems {Math.round((LIFE.crowded - 1) * 100)}% likelier.
      </p>
    </div>
  );
}

/* ---------------- Herd ---------------- */

function Herd({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const herd = tankOf(s.tank).herd;
  const rows = useMemo(
    () => [
      { g: 'cows' as Group, n: herd.cows, step: 1, price: LIFE.price.cow, gives: `${LIFE.milk.perCow} L of milk a day (${money(LIFE.milk.perCow * LIFE.milk.price)})`, drinks: `${WATER.animals.cow.litres} L a day`, max: WATER.herd.maxCows },
      { g: 'hens' as Group, n: herd.hens, step: 5, price: LIFE.price.hen, gives: `${LIFE.eggs.perHen} eggs a day (${money(LIFE.eggs.perHen * LIFE.eggs.price)})`, drinks: `${WATER.animals.hen.litres} L a day`, max: WATER.herd.maxHens },
    ],
    [herd.cows, herd.hens],
  );
  return (
    <div className="lv-herd">
      {rows.map(r => (
        <div key={r.g} className="lv-job">
          <span className="lv-job-text">
            <b>
              {GROUP_NAME[r.g]}: {r.n}
            </b>
            <small>
              Each gives {r.gives}, drinks {r.drinks}. Buy {money(r.price)}; sells for {money(Math.round(r.price * LIFE.price.sellShare))}. At most {r.max}.
            </small>
          </span>
          <span className="lv-pair">
            <Btn tone="quiet" disabled={r.n <= 0} onClick={() => dispatch({ type: 'herdBuy', group: r.g, n: -r.step })} label={`Sell ${r.step} ${r.g}`}>
              Sell {r.step}
            </Btn>
            <Btn tone="go" disabled={r.n >= r.max} onClick={() => dispatch({ type: 'herdBuy', group: r.g, n: r.step })} label={`Buy ${r.step} ${r.g} for ${money(r.price * r.step)}`}>
              Buy {r.step} · {money(r.price * r.step)}
            </Btn>
          </span>
        </div>
      ))}
      <p className="cl-tip cl-note">
        Keep new animals apart for two weeks before they join the herd: most diseases come in with them. More animals mean more milk and eggs, and more water, feed, work and emissions
        (Climate › Farm areas).
      </p>
    </div>
  );
}
