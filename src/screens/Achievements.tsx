import { useEffect, useState, type Dispatch, type ReactNode } from 'react';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import {
  ACHIEVEMENTS,
  DAY_ONE,
  GAMES,
  STREAK_CERTS,
  TIER_NAME,
  WEEK_DAYS,
  achOfSave,
  daysBetween,
  progressOf,
  streakNow,
  streakReward,
  unclaimed,
  type AchGame,
  type AchView,
  type Achievement,
  type Certificate,
} from '../achievements/model';
import { achClock, viewOf, weekSoFar } from '../achievements/track';
import { money, withMoney } from '../money';
import type { AchTab, Action, GameState } from '../state';
import {
  LEVELS,
  MODULES,
  currentLevel,
  levelNeeds,
  levelProgress,
  moduleCredits,
  moduleMax,
  modulesAt,
  stageName,
  stageOf,
  totalCredits,
  type ModuleId,
  type ProgressView,
} from '../progress/model';
import { slotBrand } from '../partners/data';
import { BrandMark, SponsorLine } from '../partners/ui';

/* My Progress (the achievements page): the journey of certification levels over the first days and weeks, the
   learning modules and their credits, today's streak and reward, every badge by part of the game, and the
   certificates won. Opened from the PROGRESS button on the farm, or the main menu. */

type Props = { s: GameState; dispatch: Dispatch<Action>; tab?: AchTab };

const TABS: { id: AchTab; label: string; icon: string }[] = [
  { id: 'journey', label: 'Journey', icon: '🎓' },
  { id: 'modules', label: 'Modules', icon: '📚' },
  { id: 'today', label: 'Today', icon: '🔥' },
  { id: 'badges', label: 'Badges', icon: '🏅' },
  { id: 'certificates', label: 'Certificates', icon: '📜' },
];

const dateText = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
/** A badge's progress in its own unit (coins are shown as the player sees them). */
const amount = (x: Achievement, n: number) => (x.id.startsWith('coins') ? money(n) : Math.floor(n).toLocaleString('en-US'));

export function AchievementsPage({ s, dispatch, tab: startTab }: Props) {
  const tab: AchTab = startTab ?? 'journey';
  const setTab = (t: AchTab) => dispatch({ type: 'open', modal: { kind: 'achievements', tab: t } });
  const close = () => dispatch({ type: 'close' });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'close' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  const today = achClock.today();
  const a = achOfSave(s.ach);
  const v = viewOf(s, a, today);
  const waiting = unclaimed(a, today);
  const won = Object.keys(a.won).length;
  const p: ProgressView = { ach: a, v, courses: v.courses };
  const levelsWaiting = Object.values(a.levels).filter(w => !w.claimed).length;
  // the dot sits on the tab where the waiting rewards are claimed
  const dotOn = (id: AchTab) => (id === 'journey' ? levelsWaiting : id === 'today' ? waiting - levelsWaiting : 0);

  return (
    <div className="abs settings-page ach-page" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="My Progress">
      <div className="scrim" onClick={close} />
      <div className="fs-panel set-panel" style={{ left: 18, top: 40, width: 838, height: 348 }}>
        <nav className="set-tabs ach-tabs" aria-label="My Progress sections">
          <p className="set-heading">My Progress</p>
          {TABS.map(t => (
            <button key={t.id} type="button" className={`set-tab${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
              <i aria-hidden="true">{t.icon}</i>
              {t.label}
              {dotOn(t.id) > 0 && <b className="ach-dot">{dotOn(t.id)}</b>}
              {t.id === 'certificates' && a.certs.length > 0 && <small className="ach-count">{a.certs.length}</small>}
            </button>
          ))}
          <p className="set-foot">
            {totalCredits(p)} credits · {won} of {ACHIEVEMENTS.length} badges
          </p>
        </nav>
        <section className="set-content ach-content" aria-label={TABS.find(t => t.id === tab)!.label}>
          {tab === 'journey' && <Journey s={s} dispatch={dispatch} p={p} go={setTab} />}
          {tab === 'modules' && <Modules dispatch={dispatch} p={p} />}
          {tab === 'today' && <Today s={s} dispatch={dispatch} v={v} today={today} go={setTab} />}
          {tab === 'badges' && <Badges s={s} dispatch={dispatch} v={v} />}
          {tab === 'certificates' && <Certificates s={s} v={v} />}
        </section>
      </div>
      <NavBar horizontal onBack={close} hideHome={s.fs.phase !== 'done'} style={{ right: 44, top: 6 }} />
      <CloseX className="page-x" onClick={close} />
      <p className="set-title-bar">
        <span aria-hidden="true">🎓</span> My Progress · <b>{TABS.find(t => t.id === tab)!.label}</b>
      </p>
    </div>
  );
}

/* ---------------- a badge ---------------- */

function Badge({ x, s, v, dispatch, compact }: { x: Achievement; s: GameState; v: AchView; dispatch: Dispatch<Action>; compact?: boolean }) {
  const w = achOfSave(s.ach).won[x.id];
  const p = progressOf(x, v);
  const label = `${x.name}: ${withMoney(x.goal)}. ${w ? (w.claimed ? 'Won' : 'Won, reward to claim') : `${Math.round(p * 100)}% done`}`;
  return (
    <div className={`ach-badge${w ? ' is-won' : ''}${compact ? ' is-compact' : ''} is-${x.tier}`} aria-label={label}>
      <span className="ach-icon" aria-hidden="true">
        {x.icon}
      </span>
      <span className="ach-text">
        <b>{x.name}</b>
        <small>{withMoney(x.goal)}</small>
        {!w && (
          <span className="ach-meter" role="progressbar" aria-label={`${x.name} progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)}>
            <span style={{ width: `${Math.max(4, p * 100)}%` }} />
          </span>
        )}
        {!w && x.need > 1 && (
          <i className="ach-num">
            {amount(x, Math.min(x.value(v), x.need))} / {amount(x, x.need)}
          </i>
        )}
        {w?.claimed && <i className="ach-num">Won {dateText(w.date)}</i>}
      </span>
      {w && !w.claimed ? (
        <button type="button" className="ach-claim" onClick={() => dispatch({ type: 'achClaim', id: x.id })} aria-label={`Claim ${x.name}: ${x.points} points`}>
          Claim <small>+{x.points}</small>
        </button>
      ) : (
        <span className="ach-tier">{w ? '✓' : TIER_NAME[x.tier]}</span>
      )}
    </div>
  );
}

/* ---------------- today ---------------- */

function Today({ s, dispatch, v, today, go }: { s: GameState; dispatch: Dispatch<Action>; v: AchView; today: string; go: (t: AchTab) => void }) {
  const a = achOfSave(s.ach);
  const streak = streakNow(a, today);
  const d = a.daily && a.daily.date === today ? a.daily : null;
  const reward = streakReward(d?.streak ?? streak + 1);
  const waiting = unclaimed(a, today);
  // the last seven days, today last
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(`${today}T12:00:00`);
    day.setDate(day.getDate() - (6 - i));
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    return { key, letter: day.toLocaleDateString('en-GB', { weekday: 'narrow' }), on: a.recent.includes(key), today: key === today };
  });
  const nextStreak = STREAK_CERTS.find(n => n > a.streak.count);
  const toWeek = WEEK_DAYS - (a.days % WEEK_DAYS);
  const sofar = weekSoFar(s, today);
  const dayOneLeft = DAY_ONE.filter(x => !a.won[x.id]).length;
  return (
    <div className="ach-today">
      <div className="ach-head">
        <div className="ach-streak" aria-label={`${streak}-day streak, best ${a.streak.best}`}>
          <span className="ach-flame" aria-hidden="true">
            🔥
          </span>
          <span>
            <b>{streak}</b>
            <small>day streak{a.streak.best > streak ? ` · best ${a.streak.best}` : ''}</small>
          </span>
          <ol className="ach-week" aria-label="The last seven days">
            {week.map(w => (
              <li key={w.key} className={`${w.on ? 'is-on' : ''}${w.today ? ' is-today' : ''}`} aria-label={`${w.key}${w.on ? ': played' : ''}`}>
                <i>{w.on ? '✓' : ''}</i>
                {w.letter}
              </li>
            ))}
          </ol>
        </div>
        <div className="ach-daily">
          {d ? (
            d.claimed ? (
              <>
                <b>Today’s reward claimed ✓</b>
                <small>Come back tomorrow for day {d.streak + 1}: +{money(streakReward(d.streak + 1).coins)}</small>
              </>
            ) : (
              <>
                <b>Day {d.streak} reward</b>
                <small>
                  +{money(reward.coins)} · +{reward.points} points
                </small>
                <button type="button" className="ach-claim is-big" onClick={() => dispatch({ type: 'achDaily' })}>
                  Claim
                </button>
              </>
            )
          ) : (
            <>
              <b>{streak ? 'Keep your streak going' : 'Start a streak today'}</b>
              <small>Do one job on the farm today, then claim +{money(reward.coins)} here.</small>
            </>
          )}
        </div>
        <div className="ach-next">
          <small>Next certificate</small>
          <b>{nextStreak ? `${nextStreak - a.streak.count} day${nextStreak - a.streak.count === 1 ? '' : 's'} to a ${nextStreak}-day streak` : 'Every streak certificate won'}</b>
          <small>
            {toWeek} day{toWeek === 1 ? '' : 's'} played to your week {Math.floor(a.days / WEEK_DAYS) + 1} certificate
            {sofar.length ? ` · so far: ${sofar.slice(0, 2).join(', ')}` : ''}
          </small>
        </div>
      </div>

      <div className="ach-row-head">
        <p className="set-title">{dayOneLeft ? `Day-one goals · ${DAY_ONE.length - dayOneLeft} of ${DAY_ONE.length} done` : 'Day-one goals · all done!'}</p>
        {waiting > 0 && (
          <button type="button" className="ach-claim" onClick={() => dispatch({ type: 'achClaimAll' })}>
            Claim all ({waiting})
          </button>
        )}
        <button type="button" className="set-link" onClick={() => go('badges')}>
          All badges ›
        </button>
      </div>
      <div className="ach-grid is-two">
        {DAY_ONE.map(x => (
          <Badge key={x.id} x={x} s={s} v={v} dispatch={dispatch} compact />
        ))}
      </div>
    </div>
  );
}

/* ---------------- badges ---------------- */

function Badges({ s, dispatch, v }: { s: GameState; dispatch: Dispatch<Action>; v: AchView }) {
  const [game, setGame] = useState<AchGame | 'all'>('all');
  const a = achOfSave(s.ach);
  // won and waiting first, then the closest to done, then the rest in order
  const list = ACHIEVEMENTS.filter(x => game === 'all' || x.game === game)
    .map((x, i) => ({ x, i, rank: a.won[x.id] ? (a.won[x.id].claimed ? 3 : 0) : progressOf(x, v) > 0 ? 1 : 2, p: progressOf(x, v) }))
    .sort((p, q) => p.rank - q.rank || q.p - p.p || p.i - q.i)
    .map(r => r.x);
  const of = (g: AchGame | 'all') => {
    const xs = ACHIEVEMENTS.filter(x => g === 'all' || x.game === g);
    return `${xs.filter(x => a.won[x.id]).length}/${xs.length}`;
  };
  return (
    <div className="ach-badges">
      <div className="ach-filter" role="tablist" aria-label="Part of the game">
        <button type="button" role="tab" aria-selected={game === 'all'} className={game === 'all' ? 'is-on' : ''} onClick={() => setGame('all')}>
          All <small>{of('all')}</small>
        </button>
        {GAMES.map(g => (
          <button key={g.id} type="button" role="tab" aria-selected={game === g.id} className={game === g.id ? 'is-on' : ''} onClick={() => setGame(g.id)}>
            <span aria-hidden="true">{g.icon}</span> {g.name} <small>{of(g.id)}</small>
          </button>
        ))}
      </div>
      <div className="ach-grid is-three">
        {list.map(x => (
          <Badge key={x.id} x={x} s={s} v={v} dispatch={dispatch} />
        ))}
      </div>
    </div>
  );
}

/* ---------------- certificates ---------------- */

function Certificates({ s, v }: { s: GameState; v: AchView }) {
  const a = achOfSave(s.ach);
  const certs = [...a.certs].reverse();
  const [pick, setPick] = useState(certs[0]?.id ?? null);
  const c = certs.find(x => x.id === pick) ?? certs[0];
  const today = achClock.today();
  if (!c) {
    const nextStreak = STREAK_CERTS.find(n => n > a.streak.count) ?? STREAK_CERTS[0];
    return (
      <div className="ach-none">
        <p className="set-title">Your certificates will be kept here</p>
        <p className="set-body">They are awarded as you go:</p>
        <ul className="cl-list">
          <li>
            <b>Every {WEEK_DAYS} days played</b>: a certificate for the week’s work ({WEEK_DAYS - (a.days % WEEK_DAYS)} more to go)
          </li>
          <li>
            <b>Streaks</b> of {STREAK_CERTS.slice(0, 4).join(', ')} days and more ({Math.max(0, nextStreak - streakNow(a, today))} more days for the next)
          </li>
          <li>
            <b>Certification levels</b>: from day 1 to week 4, on the Journey tab
          </li>
          <li>
            <b>Mastery</b>: every bronze, silver or gold badge in one part of the game
          </li>
        </ul>
        {v.days === 0 && <p className="set-body">Do one job on the farm today to count your first day.</p>}
      </div>
    );
  }
  return (
    <div className="ach-certs">
      <ul className="ach-cert-list" aria-label="Certificates">
        {certs.map(x => (
          <li key={x.id}>
            <button type="button" className={x.id === c.id ? 'is-on' : ''} onClick={() => setPick(x.id)}>
              <span aria-hidden="true">{CERT_ICON[x.kind]}</span>
              <span>
                <b>{x.title}</b>
                <small>{dateText(x.date)}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <CertificateCard c={c} name={s.farmer?.name ?? 'Farmer'} />
    </div>
  );
}

const CERT_ICON: Record<Certificate['kind'], string> = { streak: '🔥', week: '📅', mastery: '🎓', level: '🎖️' };

function CertificateCard({ c, name }: { c: Certificate; name: string }) {
  const tone = c.kind === 'mastery' ? c.tier : c.kind;
  // the certification partner co-signs every certificate
  const partner = slotBrand('certification');
  return (
    <article className={`ach-cert is-${tone}`} aria-label={`Certificate: ${c.title}`}>
      <p className="ach-cert-org">Lima Farming Game{partner ? ` × ${partner.name}` : ''}</p>
      <p className="ach-cert-kind">{c.kind === 'level' ? 'Certificate of certification' : 'Certificate of achievement'}</p>
      <p className="ach-cert-to">This certifies that</p>
      <p className="ach-cert-name">{name}</p>
      <p className="ach-cert-title">{c.title}</p>
      <p className="ach-cert-line">{c.line}</p>
      {c.summary && c.summary.length > 0 && <p className="ach-cert-sum">{c.summary.join(' · ')}</p>}
      <p className="ach-cert-date">
        Awarded {dateText(c.date)}
        {daysBetween(c.date, achClock.today()) === 0 ? ' · today' : ''}
      </p>
      <span className="ach-seal" aria-hidden="true">
        {c.kind === 'week' ? '🌾' : CERT_ICON[c.kind]}
      </span>
    </article>
  );
}

/* ---------------- the journey: certification levels ---------------- */

/** A ring that fills as a level comes closer. */
function Ring({ value, size = 44, children }: { value: number; size?: number; children: ReactNode }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <span className="pg-ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} className="pg-ring-bg" />
        <circle cx={size / 2} cy={size / 2} r={r} className="pg-ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} />
      </svg>
      <span>{children}</span>
    </span>
  );
}

function Journey({ s, dispatch, p, go }: { s: GameState; dispatch: Dispatch<Action>; p: ProgressView; go: (t: AchTab) => void }) {
  const a = p.ach;
  const { level, next } = currentLevel(a);
  const credits = totalCredits(p);
  const partner = slotBrand('certification');
  const need = next ? levelNeeds(next, p) : null;
  const toClaim = LEVELS.filter(l => a.levels[l.id] && !a.levels[l.id].claimed);
  return (
    <div className="pg-journey">
      <div className="pg-head">
        <div className="pg-now">
          <Ring value={next ? levelProgress(next, p) : 1} size={52}>
            <b>{level?.n ?? 0}</b>
          </Ring>
          <span>
            <small>{s.farmer?.name ?? 'Farmer'} · certification</small>
            <b>{level ? `Level ${level.n} · ${level.name}` : 'Not certified yet'}</b>
            <small>{next ? `Next: Level ${next.n} · ${next.name} (${Math.round(levelProgress(next, p) * 100)}%)` : 'Every level reached: Master Farmer'}</small>
          </span>
        </div>
        <div className="pg-stat">
          <b>{credits}</b>
          <small>learning credits</small>
        </div>
        <div className="pg-stat">
          <b>{a.days}</b>
          <small>day{a.days === 1 ? '' : 's'} played</small>
        </div>
        <div className="pg-stat">
          <b>
            {modulesAt('started', p)}/{MODULES.length}
          </b>
          <small>modules started</small>
        </div>
      </div>

      <ol className="pg-path" aria-label="Certification levels">
        {LEVELS.map(l => {
          const got = a.levels[l.id];
          const isNext = next?.id === l.id;
          const locked = !got && a.days < l.day;
          const pct = Math.round(levelProgress(l, p) * 100);
          return (
            <li key={l.id} className={`pg-step${got ? ' is-got' : ''}${isNext ? ' is-next' : ''}${locked ? ' is-locked' : ''}`} aria-label={`Level ${l.n}, ${l.name}, ${l.when}: ${got ? 'reached' : locked ? `opens on day ${l.day} played` : `${pct}% there`}`}>
              <small className="pg-when">{l.when}</small>
              <Ring value={got ? 1 : levelProgress(l, p)} size={38}>
                {got ? '✓' : locked ? '🔒' : l.n}
              </Ring>
              <b>{l.name}</b>
              {got && !got.claimed ? (
                <button type="button" className="ach-claim" onClick={() => dispatch({ type: 'levelClaim', id: l.id })} aria-label={`Claim Level ${l.n}: ${money(l.coins)} and ${l.points} points`}>
                  Claim
                </button>
              ) : (
                <small>{got ? 'Certified' : locked ? `Opens day ${l.day}` : `${pct}%`}</small>
              )}
            </li>
          );
        })}
      </ol>

      <div className="pg-next">
        {next && need ? (
          <>
            <p className="set-title">
              To reach Level {next.n} · {next.name}
            </p>
            <ul className="pg-needs">
              <Need done={need.days === 0} label={`Play on ${next.day} day${next.day === 1 ? '' : 's'}`} have={`${Math.min(a.days, next.day)}/${next.day}`} />
              <Need done={need.credits === 0} label={`Earn ${next.credits} learning credits`} have={`${Math.min(credits, next.credits)}/${next.credits}`} />
              <Need
                done={need.modules === 0}
                label={`${next.modules.count} modules ${stageName(next.modules.stage).toLowerCase()} or beyond`}
                have={`${Math.min(modulesAt(next.modules.stage, p), next.modules.count)}/${next.modules.count}`}
              />
            </ul>
            <p className="pg-reward">
              Reward: +{money(next.coins)} · +{next.points} points · a certificate{partner ? ` co-signed by ${partner.name}` : ''}
              <button type="button" className="set-link" onClick={() => go('modules')}>
                How to earn credits ›
              </button>
            </p>
          </>
        ) : (
          <p className="set-title">Every certification level reached. Keep going for gold badges in every module.</p>
        )}
        {toClaim.length > 1 && (
          <button type="button" className="ach-claim" onClick={() => dispatch({ type: 'achClaimAll' })}>
            Claim all
          </button>
        )}
      </div>
      <SponsorLine slot="certification" label="Certification with" dispatch={dispatch} className="pg-sponsor" />
    </div>
  );
}

function Need({ done, label, have }: { done: boolean; label: string; have: string }) {
  return (
    <li className={done ? 'is-done' : ''}>
      <i aria-hidden="true">{done ? '✓' : '○'}</i>
      <span>{label}</span>
      <b>{have}</b>
    </li>
  );
}

/* ---------------- the modules: credits by part of the game ---------------- */

/** Where each module is played. */
const GO: Record<ModuleId, Action> = {
  farm: { type: 'open', modal: { kind: 'steps', step: 'landprep' } },
  rounds: { type: 'rounds', open: true },
  six: { type: 'trials', open: true },
  tractor: { type: 'ride' },
  business: { type: 'biz', open: true },
  climate: { type: 'open', modal: { kind: 'climate' } },
  daily: { type: 'open', modal: { kind: 'achievements', tab: 'today' } },
  courses: { type: 'open', modal: { kind: 'training' } },
};

function Modules({ dispatch, p }: { dispatch: Dispatch<Action>; p: ProgressView }) {
  const partner = slotBrand('certification');
  return (
    <div className="pg-modules">
      <div className="ach-row-head">
        <p className="set-title">
          Learning modules · {totalCredits(p)} credits
        </p>
        {partner && (
          <span className="pg-partner">
            <BrandMark b={partner} size={14} /> Credits count toward {partner.name} certification
          </span>
        )}
      </div>
      <div className="pg-grid">
        {MODULES.map(m => {
          const have = moduleCredits(m.id, p);
          const max = moduleMax(m.id);
          const st = stageOf(m.id, p);
          return (
            <button key={m.id} type="button" className={`pg-module is-${st}`} onClick={() => dispatch(GO[m.id])} aria-label={`${m.name}: ${stageName(st)}, ${have} of ${max} credits. ${m.how}. Open it`}>
              <span className="pg-mod-top">
                <i aria-hidden="true">{m.icon}</i>
                <b>{m.name}</b>
                <em>{stageName(st)}</em>
              </span>
              <small>{m.subject}</small>
              <span className="ach-meter" aria-hidden="true">
                <span style={{ width: `${Math.max(3, (have / (max || 1)) * 100)}%` }} />
              </span>
              <span className="pg-mod-foot">
                <small>{m.how}</small>
                <b>
                  {have}/{max}
                </b>
              </span>
            </button>
          );
        })}
      </div>
      <p className="pg-foot">Badges pay credits into their module: day-one 1, bronze 2, silver 4, gold 8. Each course booked pays 5.</p>
    </div>
  );
}
