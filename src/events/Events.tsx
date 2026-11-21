import type { Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { money } from '../money';
import { fmt } from '../components/ui';
import type { Action, EventsTab, GameState } from '../state';
import { dayText } from '../training/data';
import { achClock } from '../achievements/track';
import { WHERE, liveEvents, type EventWhere } from './live';
import { DAY_SPAN, daysAhead, daysOn, daysTo, isOn, nextDate } from './days';
import { CRISES, MET_BONUS, POINTS_PER, REGIONS, focusRegion, givingOf, regionOf, totalGiven, type Region, type RegionId } from './regions';
import { ORGS, ORG_FOCUS } from './orgs';

/* Special events (src/events): what is going on across the game world today (Happening now), the world days about
   food and the climate (Special days), the regions living through climate and food instability, where the player
   gives from the game's money (Regions), and real organisations to give to on their own sites (Donate). Opened from
   the main menu; Donate also opens before the farm does. */

const TABS: { id: EventsTab; label: string; icon: string }[] = [
  { id: 'now', label: 'Happening now', icon: '✨' },
  { id: 'days', label: 'Special days', icon: '📅' },
  { id: 'regions', label: 'Regions', icon: '🌍' },
  { id: 'donate', label: 'Donate', icon: '🤝' },
];

const GROUPS: EventWhere[] = ['world', 'farm', 'animals', 'business'];
const STATUS = { now: 'To do', done: 'Done', soon: 'Coming' } as const;

export function EventsPage({ s, dispatch, tab = 'now', region }: { s: GameState; dispatch: Dispatch<Action>; tab?: EventsTab; region?: RegionId }) {
  const intro = s.fs.phase !== 'done';
  const here: EventsTab = intro ? 'donate' : tab;
  const tabs = (intro ? TABS.filter(t => t.id === 'donate') : TABS).map(t => (t.id === 'now' ? { ...t, badge: liveEvents(s).filter(e => e.status === 'now').length } : t));
  const setTab = (t: EventsTab) => dispatch({ type: 'open', modal: { kind: 'events', tab: t } });
  const g = givingOf(s.giving);
  return (
    <Page
      title="Special events"
      icon="🎉"
      tabs={tabs}
      tab={here}
      onTab={setTab}
      dispatch={dispatch}
      className="ev-page"
      foot={intro ? <>Real gifts go to each organisation’s own site.</> : <>Given in the game: <b>{money(totalGiven(g))}</b></>}
    >
      {here === 'now' && <Now s={s} dispatch={dispatch} />}
      {here === 'days' && <Days dispatch={dispatch} />}
      {here === 'regions' && (region && regionOf(region) ? <RegionView s={s} r={regionOf(region)!} dispatch={dispatch} /> : <Regions s={s} dispatch={dispatch} />)}
      {here === 'donate' && <Donate s={s} dispatch={dispatch} />}
    </Page>
  );
}

const go = (dispatch: Dispatch<Action>, path: string) => dispatch({ type: 'route', path });

function Now({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const list = liveEvents(s);
  const todo = list.filter(e => e.status === 'now').length;
  return (
    <>
      <p className="pg-h">
        {todo ? `${todo} thing${todo > 1 ? 's' : ''} happening across your world today` : 'All caught up today'}
      </p>
      {GROUPS.map(w => {
        const rows = list.filter(e => e.where === w);
        if (!rows.length) return null;
        return (
          <section key={w} className="ev-group" aria-label={WHERE[w]}>
            <p className="ev-group-h">{WHERE[w]}</p>
            {rows.map(e => (
              <article key={e.id} className={`ev-row is-${e.status}`} data-event={e.id}>
                <span className="ev-icon" aria-hidden="true">
                  {e.icon}
                </span>
                <span className="ev-text">
                  <b>{e.title}</b>
                  <small>{e.text}</small>
                </span>
                <em className={`ev-status is-${e.status}`}>{STATUS[e.status]}</em>
                <button type="button" className={e.status === 'now' ? 'ach-claim' : 'set-link ev-go'} onClick={() => go(dispatch, e.go)} aria-label={`${e.cta}: ${e.title}`}>
                  {e.cta} ›
                </button>
              </article>
            ))}
          </section>
        );
      })}
    </>
  );
}

function Days({ dispatch }: { dispatch: Dispatch<Action> }) {
  const today = achClock.today();
  const on = daysOn(today);
  return (
    <>
      <p className="pg-h">{on.length ? `On now: ${on.map(d => d.name).join(', ')}` : 'The world days about food, farming and the climate'}</p>
      <p className="ev-note">
        Each special day is on for a week ({DAY_SPAN} days either side of its date). While one is on, gifts to the regions earn double points.
      </p>
      <div className="ev-days">
        {daysAhead(today).map(d => {
          const live = isOn(d, today);
          const n = daysTo(d, today);
          return (
            <article key={d.id} className={`ev-day${live ? ' is-on' : ''}`} data-day={d.id}>
              <span className="ev-date">
                <b>{dayText(nextDate(d, today)).replace(/^\w+ /, '')}</b>
                <small>{live ? (n === 0 ? 'Today' : 'On now') : `in ${n} days`}</small>
              </span>
              <span className="ev-text">
                <b>
                  <i aria-hidden="true">{d.icon}</i> {d.name}
                </b>
                <small>{d.line}</small>
                <small className="ev-task">🎯 {d.task}</small>
              </span>
              <button type="button" className={live ? 'ach-claim' : 'set-link ev-go'} onClick={() => go(dispatch, d.go)} aria-label={`Go: ${d.name}`}>
                Go ›
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}

function Meter({ value, goal, label }: { value: number; goal: number; label: string }) {
  const share = Math.min(1, value / goal);
  return (
    <span className="ev-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(value, goal)}>
      <i style={{ width: `${share * 100}%` }} />
    </span>
  );
}

function Crises({ r }: { r: Region }) {
  return (
    <span className="ev-crises">
      {r.crises.map(c => (
        <em key={c} className={`ev-crisis is-${c}`}>
          {CRISES[c].icon} {CRISES[c].label}
        </em>
      ))}
    </span>
  );
}

function Regions({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const g = givingOf(s.giving);
  const focus = focusRegion();
  const points = g.gifts.reduce((n, x) => n + x.points, 0);
  const open = (id: RegionId) => dispatch({ type: 'open', modal: { kind: 'events', tab: 'regions', region: id } });
  const order = [...REGIONS].sort((a, b) => (a.id === focus.id ? -1 : b.id === focus.id ? 1 : b.level - a.level));
  return (
    <>
      <div className="pg-tiles cl-tiles">
        <Tile label="You have given" value={money(totalGiven(g))} sub="from the game’s money" tone={totalGiven(g) ? 'good' : undefined} />
        <Tile label="Gifts" value={`${g.gifts.length}`} sub="relief packs sent" />
        <Tile label="Appeals met" value={`${g.met.length} of ${REGIONS.length}`} sub={`+${MET_BONUS} points each`} />
        <Tile label="Giving points" value={fmt(points)} sub="double for the appeal of the week" />
      </div>
      <p className="ev-note">
        Six regions living through climate and food instability. A gift here uses the game’s money only. To give real money, see <button type="button" className="ev-inline" onClick={() => dispatch({ type: 'open', modal: { kind: 'events', tab: 'donate' } })}>Donate</button>.
      </p>
      <div className="pt-grid ev-regions">
        {order.map(r => {
          const given = g.totals[r.id] ?? 0;
          return (
            <article key={r.id} className={`pt-card ev-region${r.id === focus.id ? ' is-focus' : ''}`} data-region={r.id}>
              <header>
                <span className="ev-badge" aria-hidden="true">
                  {r.icon}
                </span>
                <span className="pt-who">
                  <b>{r.name}</b>
                  <small>{r.where}</small>
                </span>
                {r.id === focus.id ? <em className="pt-tag ev-tag-focus">This week ×2</em> : <em className={`pt-tag ev-level is-${r.level}`}>{r.level === 3 ? 'Severe' : 'Serious'}</em>}
              </header>
              <Crises r={r} />
              <p className="ev-story">{r.story}</p>
              <span className="ev-goal">
                <Meter value={given} goal={r.goal} label={`${r.name}: ${money(given)} of ${money(r.goal)}`} />
                <small>{g.met.includes(r.id) ? '✓ Appeal met' : `${money(given)} of ${money(r.goal)}`}</small>
              </span>
              <footer>
                <button type="button" className="ach-claim" onClick={() => open(r.id)} aria-label={`Give to ${r.name}`}>
                  Give ›
                </button>
              </footer>
            </article>
          );
        })}
      </div>
    </>
  );
}

function RegionView({ s, r, dispatch }: { s: GameState; r: Region; dispatch: Dispatch<Action> }) {
  const g = givingOf(s.giving);
  const given = g.totals[r.id] ?? 0;
  const double = focusRegion().id === r.id || daysOn().length > 0;
  const mine = g.gifts.filter(x => x.region === r.id);
  return (
    <div className="ev-detail" data-region={r.id}>
      <button type="button" className="set-link ev-back" onClick={() => dispatch({ type: 'open', modal: { kind: 'events', tab: 'regions' } })}>
        ‹ All regions
      </button>
      <header className="ev-detail-head">
        <span className="ev-badge is-big" aria-hidden="true">
          {r.icon}
        </span>
        <span className="pt-who">
          <b>{r.name}</b>
          <small>{r.where}</small>
        </span>
        <Crises r={r} />
      </header>
      <dl className="ev-facts">
        <dt>What is happening</dt>
        <dd>{r.story}</dd>
        <dt>Farming and food</dt>
        <dd>{r.food}</dd>
        <dt>For your own farm</dt>
        <dd>{r.lesson}</dd>
      </dl>
      <span className="ev-goal">
        <Meter value={given} goal={r.goal} label={`${r.name}: ${money(given)} of ${money(r.goal)}`} />
        <small>
          {g.met.includes(r.id) ? `✓ Appeal met · ${money(given)} given` : `Appeal: ${money(given)} of ${money(r.goal)} · +${MET_BONUS} points when met`}
        </small>
      </span>
      <p className="pg-h">
        Send a relief pack{double ? <em className="ev-double"> · double points now</em> : null}
      </p>
      <div className="ev-packs">
        {r.packs.map(p => {
          const pts = Math.round(p.price / POINTS_PER) * (double ? 2 : 1);
          const short = s.coins < p.price;
          return (
            <article key={p.id} className="ev-pack" data-pack={p.id}>
              <b>{p.name}</b>
              <small>{p.line}</small>
              <span className="ev-pack-foot">
                <span className="ev-price">{money(p.price)}</span>
                <small>+{pts} pts</small>
              </span>
              <button type="button" className="ach-claim" disabled={short} onClick={() => dispatch({ type: 'give', region: r.id, pack: p.id })} aria-label={`Give ${p.name} for ${money(p.price)}`}>
                {short ? 'Not enough money' : 'Give'}
              </button>
            </article>
          );
        })}
      </div>
      {mine.length > 0 && (
        <p className="ev-note">
          Your gifts here: {mine.slice(0, 5).map(x => `${r.packs.find(p => p.id === x.pack)?.name ?? x.pack} (${dayText(x.date)})`).join(' · ')}
          {mine.length > 5 ? ` and ${mine.length - 5} more` : ''}
        </p>
      )}
    </div>
  );
}

function Donate({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const intro = s.fs.phase !== 'done';
  return (
    <>
      <p className="pg-h">Give for real</p>
      <p className="ev-note">
        These organisations work on hunger, farming and climate shocks across Africa. TemoLima takes no money: each button opens the organisation’s own official site, where you can donate safely to them directly.
        {!intro && (
          <>
            {' '}
            Gifts with the game’s money are in{' '}
            <button type="button" className="ev-inline" onClick={() => dispatch({ type: 'open', modal: { kind: 'events', tab: 'regions' } })}>
              Regions
            </button>
            .
          </>
        )}
      </p>
      <div className="pt-grid ev-orgs">
        {ORGS.map(o => (
          <article key={o.id} className="pt-card ev-org" data-org={o.id} style={{ ['--brand' as string]: o.color }}>
            <header>
              <span className="ev-org-mark" aria-hidden="true">
                {o.short}
              </span>
              <span className="pt-who">
                <b>{o.name}</b>
                <small>{new URL(o.url).hostname.replace(/^www\./, '')}</small>
              </span>
              <em className="pt-tag">{ORG_FOCUS[o.focus]}</em>
            </header>
            <p className="ev-story">{o.line}</p>
            <p className="pt-offer">
              <b>Your gift</b>
              <small>{o.gift}</small>
            </p>
            <footer>
              <a className="ach-claim ev-donate" href={o.url} target="_blank" rel="noopener noreferrer" onClick={() => dispatch({ type: 'orgVisit', id: o.id })}>
                Donate on their site ↗
              </a>
            </footer>
          </article>
        ))}
      </div>
    </>
  );
}
