import { useEffect, useMemo, useState, type Dispatch, type ReactNode } from 'react';
import { act, jobWaiting } from '../onsite/model';
import { Info } from '../learn/Info';
import { MiniGame, type GameSpec } from '../minigames/MiniGame';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import { money } from '../money';
import { WATER } from '../water/config';
import { capacityOf, tankOf, useToday } from '../water/model';
import type { Action, AnimalsTab, GameState } from '../state';
import { LockTag, OpenLine } from '../unlock/Lock';
import { isOpen } from '../unlock/model';
import { CARE, COOPS, ISSUES, LIFE, NO_COOP, PREVENT, SHEDS, coopOption, issueOf, shedOption, type CoopId, type CoopOption, type Group, type IssueId, type ShedId } from './config';
import { coopPhoto } from './photos';
import { PhotoPicture } from '../components/PhotoPicture';
import {
  animalWater,
  careCost,
  careDoneToday,
  careDue,
  careOpen,
  coopOpen,
  coopPrice,
  shedOpen,
  shedPrice,
  coopRoom,
  countOf,
  crowded,
  dirty,
  eggsToday,
  issueRisk,
  larderValue,
  lifeOf,
  milkToday,
  preventCost,
  preventLeft,
} from './model';
import { roll } from './rand';
import { Exam } from './Exam';
import { ExamScene } from './ExamScene';
import { FINDINGS, marksOf, spotsOf } from './exam';
import { checksOf, plannedOf } from '../inspect/model';
import { subjectFor, subjectOf } from '../inspect/subjects';
import type { SubjectId } from '../inspect/types';

/* The Animals page: the cows and the hens. Today (the day's jobs), Health (problems by their signs, and the fix to
   choose; vaccines and tick control), Water (what they drink and waste from the tank), Coop (build it from day 2), and
   Herd (buy and sell). Opened from the ANIMALS button, the main menu, or by walking to the pen or the coop. */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: AnimalsTab };

const TABS: { id: AnimalsTab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: '☀' },
  { id: 'health', label: 'Health', icon: '✚' },
  { id: 'water', label: 'Water', icon: '💧' },
  { id: 'coop', label: 'Coop', icon: '⌂' },
  { id: 'shed', label: 'Cow shed', icon: '🏚' },
  { id: 'herd', label: 'Herd', icon: '🐄' },
];

const L = (n: number) => `${Math.round(n).toLocaleString('en-US')} L`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const GROUP_NAME: Record<Group, string> = { cows: 'Cows', hens: 'Hens' };


/** The farm word (learn/glossary.ts) behind a daily job or a prevention, for its ⓘ. */
const CARE_TERM: Record<string, string> = { cowFeed: 'napier', henFeed: 'layersMash', coopClean: 'litter', dip: 'acaricide', fmdVax: 'fmd', ncdVax: 'newcastle', deworm: 'deworm' };

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
          <p className="set-heading lv-heading">
            Animals
            <span className="lv-day" title={open ? undefined : `Care starts on day ${LIFE.startDay}`}>
              Day {l.day}
            </span>
          </p>
          {TABS.map(t => (
            <button key={t.id} type="button" className={`set-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <i aria-hidden="true">{t.icon}</i>
              {t.label}
              {t.id === 'health' && issues > 0 && <b className="lv-count">{issues}</b>}
            </button>
          ))}
          <div className="set-foot lv-foot">
            <button type="button" className="set-link ck-link" onClick={() => dispatch({ type: 'open', modal: { kind: 'checks' } })}>
              <span aria-hidden="true">🔍</span> All farm checks
            </button>
            <span>Numbers are estimates for learning.</span>
          </div>
        </nav>
        <section className="set-content cl-content" aria-label={TABS.find(t => t.id === tab)!.label}>
          {!open && tab !== 'coop' && tab !== 'shed' && <Locked />}
          {tab === 'today' && <Today s={s} dispatch={dispatch} go={setTab} />}
          {tab === 'health' && <Health s={s} dispatch={dispatch} />}
          {tab === 'water' && <Water s={s} dispatch={dispatch} />}
          {tab === 'coop' && <Coop s={s} dispatch={dispatch} />}
          {tab === 'shed' && <Shed s={s} dispatch={dispatch} />}
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
      The cows and hens came with the farm: they come into your care on <b>day {LIFE.startDay}</b>: sleep at the farmhouse to end day 1 (or come back tomorrow). Then you feed, water and milk, build the
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
      {l.larder && (
        <div className="lv-larder" role="group" aria-label="The farm's first milk and eggs">
          <span className="lv-larder-icon" aria-hidden="true">🥛🥚</span>
          <p>
            <b>Your first milk and eggs.</b> The cows and hens that came with the farm gave {l.larder.milk} L of milk this morning, and there is a tray of {l.larder.eggs} eggs in the
            farmhouse. Sell them to start your farm money.
          </p>
          <Btn tone="go" onClick={() => dispatch({ type: 'animalLarder' })} label={`Sell the first milk and eggs for ${money(larderValue(l.larder))}`}>
            Sell · {money(larderValue(l.larder))}
          </Btn>
        </div>
      )}
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
                      <b>
                        {c.label}
                        <Info term={CARE_TERM[c.id]} size={14} />
                      </b>
                      <small>{noCoop ? 'Build the coop first (Coop).' : c.does}</small>
                    </span>
                    {done ? (
                      <span className="lv-done" aria-label={`${c.label}: done today`}>
                        ✓ Done
                      </span>
                    ) : !due && !noCoop ? (
                      <span className="lv-done is-later">Not yet</span>
                    ) : jobWaiting(s, `care:${c.id}`) ? (
                      <span className="lv-done is-later" aria-label={`${c.label}: on your jobs list`}>
                        🚶 On your list
                      </span>
                    ) : (
                      <Btn tone="go" disabled={!open || noCoop} onClick={() => act(s, dispatch, { type: 'animalCare', id: c.id })} label={`${c.label}${cost ? ` for ${money(cost)}` : ''}`}>
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

/** The fix to choose for a problem: the last wrong one's lesson, the three fixes, and its name once one was tried. */
function Fixes({ s, dispatch, id, since }: { s: GameState; dispatch: Dispatch<Action>; id: IssueId; since: number }) {
  const l = lifeOf(s.life);
  const open = careOpen(s);
  const def = issueOf(id);
  const tried = l.tried[id] ?? [];
  const last = tried.length ? def.fixes.find(f => f.id === tried[tried.length - 1]) : null;
  return (
    <>
      {last && !last.right && <p className="lv-wrong">Not that: {last.lesson}</p>}
      <div className="lv-fixes" role="group" aria-label="Choose the fix">
        {shuffled(id, since).map(f => (
          <Btn key={f.id} disabled={!open || tried.includes(f.id)} onClick={() => dispatch({ type: 'animalFix', issue: id, fix: f.id })}>
            {f.label}
            {f.cost ? ` · ${money(f.cost)}` : ''}
          </Btn>
        ))}
      </div>
      {tried.length > 0 && (
        <p className="lv-hint">
          It is <b>{def.name}</b>
          <Info term={def.name} size={14} />. {def.cause}
        </p>
      )}
    </>
  );
}

/** A full check of the cows or the hens: the red parts of a problem showing (if any) first, then every other part. */
export function Routine({ s, dispatch, subject, onClose }: { s: GameState; dispatch: Dispatch<Action>; subject: SubjectId; onClose: () => void }) {
  const l = lifeOf(s.life);
  const g = subjectOf(subject).group;
  // the problem it opened with stays its red parts, even once fixed (the check goes on)
  const [issue] = useState(() => l.issues.find(i => issueOf(i.id).group === g) ?? null);
  const still = issue && l.issues.some(i => i.id === issue.id);
  return (
    <Exam
      s={s}
      dispatch={dispatch}
      subject={subject}
      issue={issue?.id ?? null}
      since={issue?.since}
      onClose={onClose}
      decide={issue && still ? <Fixes s={s} dispatch={dispatch} id={issue.id} since={issue.since} /> : issue ? <p className="lv-hint">✓ Treated.</p> : undefined}
    />
  );
}

function Health({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const l = lifeOf(s.life);
  const [examining, setExamining] = useState<IssueId | null>(null);
  const [routine, setRoutine] = useState<SubjectId | null>(null);
  const exam = examining ? l.issues.find(i => i.id === examining) : null;
  const ch = checksOf(s.checks);
  const planned = plannedOf(s.checks).filter(p => p.subject === 'cow' || p.subject === 'hen');
  return (
    <div className="lv-health">
      <div className="lv-checks" role="group" aria-label="Full checks">
        {(['cows', 'hens'] as Group[]).map(g => {
          const sub = subjectFor(g);
          const last = ch.full[sub];
          return (
            <button key={g} type="button" className={`lv-check${last === l.day ? ' is-done' : ''}`} onClick={() => setRoutine(sub)} disabled={countOf(s, g) === 0}>
              <i aria-hidden="true">🔍</i>
              <span>
                <b>{subjectOf(sub).title}</b>
                <small>{last === l.day ? '✓ Checked today' : last ? `Last full check: day ${last}` : `Every part of the ${g === 'cows' ? 'cows' : 'hens'}, a few seconds each`}</small>
              </span>
            </button>
          );
        })}
      </div>
      {planned.length > 0 && (
        <div className="lv-planned" aria-label="Planned from your checks">
          <p className="set-title lv-sub">Planned from your checks</p>
          {planned.map(p => (
            <div key={`${p.subject}:${p.early.id}`} className={`lv-job${p.day < l.day ? ' is-late' : ''}`}>
              <span className="lv-job-text">
                <b>
                  <span className="cl-where">{p.day < l.day ? `Overdue · day ${p.day}` : p.day === l.day ? 'Today' : `Day ${p.day}`}</span> {p.early.fix.label}
                </b>
                <small>
                  {subjectOf(p.subject).name === 'cow' ? 'Cows' : 'Hens'}: {p.early.title.toLowerCase()}. {p.early.risk}
                </small>
              </span>
              <Btn tone="go" disabled={!open} onClick={() => dispatch({ type: 'checkFix', subject: p.subject, id: p.early.id })} label={`${p.early.fix.label}${p.early.fix.cost ? ` for ${money(p.early.fix.cost)}` : ''}`}>
                Do it{p.early.fix.cost ? ` · ${money(p.early.fix.cost)}` : ''}
              </Btn>
            </div>
          ))}
        </div>
      )}
      {l.issues.length === 0 ? (
        <p className="cl-tip">
          No problems showing. Cows: {pct(issueRisk(s, 'cows').chance)} chance of one tonight; hens: {pct(issueRisk(s, 'hens').chance)}. Clean, fed, watered and vaccinated animals get sick
          less.
        </p>
      ) : (
        l.issues.map(i => {
          const def = issueOf(i.id);
          const who = def.group === 'cows' ? 'cow' : 'hens';
          return (
            <div key={i.id} className="lv-issue" aria-label={`A problem with the ${def.group}`}>
              <button type="button" className="lv-thumb" onClick={() => setExamining(i.id)} aria-label={`Examine the ${who} up close`}>
                <ExamScene subject={subjectFor(def.group)} marks={marksOf(i.id)} spots={spotsOf(i.id)} rings={[...new Set<string>(FINDINGS[i.id].map(f => f.part))]} />
                <span className="lv-thumb-go">
                  <i aria-hidden="true">🔍</i> Examine the {who}
                </span>
              </button>
              <div className="lv-issue-body">
                <p className="lv-issue-head">
                  <span className="cl-where">{GROUP_NAME[def.group]}</span>
                  <b>What you see</b>
                  <small>since day {i.since}</small>
                </p>
                <p className="lv-signs">{def.signs}</p>
                <Fixes s={s} dispatch={dispatch} id={i.id} since={i.since} />
              </div>
            </div>
          );
        })
      )}
      {exam && (
        <Exam
          s={s}
          dispatch={dispatch}
          subject={subjectFor(issueOf(exam.id).group)}
          issue={exam.id}
          since={exam.since}
          onClose={() => setExamining(null)}
          decide={<Fixes s={s} dispatch={dispatch} id={exam.id} since={exam.since} />}
        />
      )}
      {routine && !exam && <Routine s={s} dispatch={dispatch} subject={routine} onClose={() => setRoutine(null)} />}
      <p className="set-title lv-sub">Keep them well</p>
      {PREVENT.map(p => {
        const left = preventLeft(s, p.id);
        const cost = preventCost(s, p.id);
        const keeps = ISSUES.filter(i => i.preventBy === p.id).map(i => i.name);
        return (
          <div key={p.id} className="lv-job">
            <span className="lv-job-text">
              <b>
                {p.label}
                <Info term={CARE_TERM[p.id]} size={14} />
              </b>
              <small>
                {p.does}
                {keeps.length ? ` Keeps away ${keeps.join(', ')}.` : ''}
              </small>
            </span>
            {left > 2 ? (
              <span className="lv-done">✓ {left} days left</span>
            ) : (
              <Btn tone="go" disabled={!open} onClick={() => act(s, dispatch, { type: 'animalPrevent', id: p.id })} label={`${p.label} for ${money(cost)}`}>
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
        <button type="button" className="lv-check ck-inline" onClick={() => dispatch({ type: 'open', modal: { kind: 'checks', subject: 'water' } })}>
          <i aria-hidden="true">🔍</i>
          <span>
            <b>Examine the water setup</b>
            <small>Gutters, tank, pump, pipes and drip lines: every part</small>
          </span>
        </button>
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

/** Building the coop or the shed: a hammer, in time. */
export const BUILD_GAME: GameSpec = { type: 'timing', rounds: 4, zone: [40, 62], speed: 150, verb: 'Hammer!', icon: '🔨' };

function Coop({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const l = lifeOf(s.life);
  const open = coopOpen(s);
  const [building, setBuilding] = useState<CoopId | null>(null);
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
            No coop yet: {hens} hens roost in the trees. They lay {pct(-NO_COOP.eggs)} of their eggs in the bush, and thieves and mongooses take them at night. Upgrade it from day{' '}
            {LIFE.coopDay}: build it yourself, nail by nail.
          </>
        )}
      </p>
      <OpenLine s={s} total={COOPS.length} what="coops" />
      <div className="lv-options">
        {COOPS.map((c, i) => {
          const price = coopPrice(l.coop, c.id);
          const built = l.coop === c.id;
          const gated = !isOpen(s, i);
          return (
            <div key={c.id} className={`lv-option${built ? ' is-on' : ''}${gated && !built ? ' is-gated' : ''}`} data-option={c.id}>
              <CoopPicture id={c.id} name={c.name} size={c.size} />
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
              ) : gated ? (
                <LockTag s={s} index={i} />
              ) : (
                <Btn tone="go" disabled={!open || s.coins < price} onClick={() => setBuilding(c.id)} label={`${l.coop ? 'Upgrade to' : 'Build'} the ${c.name.toLowerCase()} for ${money(price)}`}>
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
      {building && (
        <MiniGame
          title={`Build the ${COOPS.find(c => c.id === building)!.name.toLowerCase()}`}
          kicker="Coop upgrade"
          task="Nail the frame together: press Hammer when the marker is in the green. Four nails."
          spec={BUILD_GAME}
          doneLabel="Finish the coop"
          onClose={() => setBuilding(null)}
          onDone={() => {
            act(s, dispatch, { type: 'coopBuild', id: building });
            setBuilding(null);
          }}
        />
      )}
    </div>
  );
}

/** A coop's photo, with its size on it: the metres, how tall, and its footprint drawn to one scale for every coop
    (the dashed box is the largest, the 6 × 4 m layer house), so the five compare at a glance. */
function CoopPicture({ id, name, size }: { id: CoopId; name: string; size: CoopOption['size'] }) {
  const photo = coopPhoto(id);
  const m = (n: number) => n.toLocaleString('en-US');
  const scale = 3.5;
  return (
    <div className={`lv-photo${photo ? '' : ' is-empty'}`}>
      {photo && <PhotoPicture photo={photo} alt={`${name}: a real one on a small farm`} credit />}
      <span className="lv-size" aria-label={`About ${m(size.w)} by ${m(size.d)} metres, ${size.tall}`}>
        <svg width={6 * scale + 2} height={4 * scale + 2} viewBox={`0 0 ${6 * scale + 2} ${4 * scale + 2}`} aria-hidden="true">
          <rect className="lv-scale" x={1} y={1} width={6 * scale} height={4 * scale} rx={1.5} />
          <rect x={1} y={1 + (4 - size.d) * scale} width={size.w * scale} height={size.d * scale} rx={1.5} fill="currentColor" />
        </svg>
        {m(size.w)} × {m(size.d)} m · {size.tall}
      </span>
    </div>
  );
}

/* ---------------- Cow shed ---------------- */

function Shed({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const l = lifeOf(s.life);
  const open = shedOpen(s);
  const have = shedOption(l.shed);
  const [building, setBuilding] = useState<ShedId | null>(null);
  return (
    <div className="lv-coop">
      <p className="cl-tip">
        {have ? (
          <>
            Your cows sleep in the <b>{have.name.toLowerCase()}</b>: +{pct(have.milk)} milk, −{pct(have.disease)} cow diseases, and its gutters catch rain for the tank.
          </>
        ) : open ? (
          <>The cows sleep in the open pen: mud, ticks and rain cost milk. Upgrade their shed now.</>
        ) : (
          <>
            The cows sleep in the open pen. From <b>day {LIFE.shedDay}</b> (today is day {l.day}) you can upgrade their shed: build it yourself, beam by beam.
          </>
        )}
      </p>
      <OpenLine s={s} total={SHEDS.length} what="sheds" />
      <div className="lv-options">
        {SHEDS.map((c, i) => {
          const price = shedPrice(l.shed, c.id);
          const built = l.shed === c.id;
          const gated = !isOpen(s, i);
          return (
            <div key={c.id} className={`lv-option${built ? ' is-on' : ''}${gated && !built ? ' is-gated' : ''}`} data-option={c.id}>
              <p className="set-title">
                {c.name}
                <Info term={c.id === 'zero' ? 'zeroGrazing' : null} size={14} />
              </p>
              <p className="set-body">{c.does}</p>
              <ul className="lv-facts">
                <li>+{pct(c.milk)} milk</li>
                <li>−{pct(c.disease)} cow diseases</li>
                <li>−{pct(c.theft)} cow theft at night</li>
                <li>Gutters: +{c.gutter} L a day into the tank</li>
              </ul>
              {built ? (
                <span className="lv-done">✓ Built</span>
              ) : price === null ? (
                <span className="lv-done is-later">You have a better one</span>
              ) : gated && open ? (
                <LockTag s={s} index={i} />
              ) : (
                <Btn tone="go" disabled={!open || s.coins < price} onClick={() => setBuilding(c.id)} label={`${l.shed ? 'Upgrade to' : 'Build'} the ${c.name.toLowerCase()} for ${money(price)}`}>
                  {open ? `${l.shed ? 'Upgrade' : 'Build'} · ${money(price)}` : `From day ${LIFE.shedDay}`}
                </Btn>
              )}
            </div>
          );
        })}
      </div>
      {building && (
        <MiniGame
          title={`Build the ${SHEDS.find(c => c.id === building)!.name.toLowerCase()}`}
          kicker="Cow shed upgrade"
          task="Fix the roof beams: press Hammer when the marker is in the green. Four beams."
          spec={BUILD_GAME}
          doneLabel="Finish the shed"
          onClose={() => setBuilding(null)}
          onDone={() => {
            act(s, dispatch, { type: 'shedBuild', id: building });
            setBuilding(null);
          }}
        />
      )}
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
            <Btn tone="quiet" disabled={r.n <= 0} onClick={() => act(s, dispatch, { type: 'herdBuy', group: r.g, n: -r.step })} label={`Sell ${r.step} ${r.g}`}>
              Sell {r.step}
            </Btn>
            <Btn tone="go" disabled={r.n >= r.max} onClick={() => act(s, dispatch, { type: 'herdBuy', group: r.g, n: r.step })} label={`Buy ${r.step} ${r.g} for ${money(r.price * r.step)}`}>
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
