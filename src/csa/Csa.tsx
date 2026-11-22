import { useMemo, useState, type ComponentType, type Dispatch } from 'react';
import { achClock } from '../achievements/track';
import { money } from '../money';
import type { Action, GameState } from '../state';
import { Confetti } from '../minigames/fun';
import { PRACTICES, practiceOf, type CsaId } from './data';
import { CSA, benefitsOf, clockNow, csaOf, drillDone, fieldClock, drillOf, drillSeed, drillStreak, finishRun, learned, practised, skillOf, type CsaPay } from './model';
import { hashText, starsOf } from './rules';
import type { GameProps } from './games/common';
import { HalfMoonGame } from './games/HalfMoon';
import { WaterSaveGame } from './games/WaterSave';
import { DayClockGame } from './games/DayClock';
import { ZaiGame } from './games/Zai';
import { PushPullGame } from './games/PushPull';
import { FmnrGame } from './games/Fmnr';
import { SeedsGame } from './games/Seeds';

/* Climate › Climate Smart Agriculture: the module. Its tab lists the seven practices, with the farmer's skill in
   each, today's drill, the field clock and what the skills do for the farm. A practice opens as a lesson that fills
   the page: learn it (what it is, where it is used in Kenya and West Africa, how to do it, why it is climate-smart),
   practise it in its own game, and see the result. The daily drill (the CLIMATE-SMART chip on the farm) opens
   today's practice the same way, and pays once a day. */

const GAMES: Record<CsaId, ComponentType<GameProps>> = {
  halfmoon: HalfMoonGame,
  water: WaterSaveGame,
  clock: DayClockGame,
  zai: ZaiGame,
  pushpull: PushPullGame,
  fmnr: FmnrGame,
  seeds: SeedsGame,
};

const Stars = ({ n, size = 'sm' }: { n: number; size?: 'sm' | 'lg' }) => (
  <span className={`csa-stars is-${size}`} aria-label={`${n} of 3 stars`}>
    {[1, 2, 3].map(i => (
      <i key={i} className={i <= n ? 'is-on' : ''} aria-hidden="true">
        ★
      </i>
    ))}
  </span>
);

function SkillBar({ s, id }: { s: GameState; id: CsaId }) {
  const k = skillOf(csaOf(s.csa), id);
  return (
    <span className="csa-skill" title={k.nextName ? `${k.next} more to ${k.nextName}` : 'Top level'}>
      <b>{k.name}</b>
      <span className="csa-meter" role="progressbar" aria-label={`Skill: ${k.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(k.share * 100)}>
        <span style={{ width: `${Math.max(4, k.share * 100)}%` }} />
      </span>
    </span>
  );
}

/* ---------------- the tab ---------------- */

export function CsaTab({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const c = csaOf(s.csa);
  const today = achClock.today();
  const drill = drillOf(today);
  const done = drillDone(c, today);
  const streak = drillStreak(c, today);
  const now = clockNow(fieldClock.hour());
  const open = (id: CsaId, daily = false) => dispatch({ type: 'open', modal: { kind: 'climate', tab: 'csa', practice: id, ...(daily ? { daily: true } : {}) } });
  return (
    <div className="csa-tab">
      <div className="csa-head">
        <div>
          <p className="set-title">Climate Smart Agriculture</p>
          <p className="set-body csa-intro">Farming that keeps the harvest coming when the rains fail, the heat rises and pests spread, while it stores carbon. Learn each practice, then practise it by hand.</p>
        </div>
        <div className="csa-head-stats">
          <span>
            <b>{learned(c)}/7</b> learned
          </span>
          <span>
            <b>{practised(c)}/7</b> at 2★+
          </span>
          <span>
            <b>{streak}</b> day drill streak
          </span>
        </div>
      </div>
      <button type="button" className={`csa-drill${done ? ' is-done' : ''}`} onClick={() => open(drill, true)}>
        <i aria-hidden="true">{practiceOf(drill).icon}</i>
        <span>
          <b>{done ? '✓ Today’s drill done' : 'Today’s drill'}: {practiceOf(drill).name}</b>
          <small>{done ? 'Practise it again any time; a new practice tomorrow.' : `+${money(CSA.drill.coins)} · +${CSA.drill.points} points · climate credits for each star`}</small>
        </span>
        <em>{done ? 'Again ›' : 'Start ›'}</em>
      </button>
      <div className="csa-cards">
        {PRACTICES.map(p => {
          const best = c.best[p.id] ?? 0;
          return (
            <button key={p.id} type="button" className={`csa-card${p.id === drill && !done ? ' is-today' : ''}`} onClick={() => open(p.id)} aria-label={`${p.name}: ${p.fixes}. ${best ? `Best ${starsOf(best)} stars` : 'Not practised yet'}`}>
              <span className="csa-card-top">
                <i aria-hidden="true">{p.icon}</i>
                <b>{p.name}</b>
              </span>
              <small>{p.fixes}</small>
              <span className="csa-card-foot">
                <SkillBar s={s} id={p.id} />
                {best ? <Stars n={starsOf(best)} /> : <em>Learn ›</em>}
              </span>
            </button>
          );
        })}
      </div>
      <div className="csa-farm">
        <p className="set-title">On your farm</p>
        <ul>
          <li className="is-on">
            <i aria-hidden="true">{now.icon}</i> Field clock now: <b>{now.label}</b>. {now.tip}
          </li>
          {benefitsOf(c).map(b => (
            <li key={b.icon} className={b.on ? 'is-on' : ''}>
              <i aria-hidden="true">{b.icon}</i> {b.text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ---------------- a lesson ---------------- */

type Step = 'learn' | 'play' | 'result';

export function CsaLesson({ s, dispatch, id, daily }: { s: GameState; dispatch: Dispatch<Action>; id: CsaId; daily?: boolean }) {
  const p = practiceOf(id);
  const today = achClock.today();
  const c = csaOf(s.csa);
  const isDrill = !!daily && drillOf(today) === id;
  const [step, setStep] = useState<Step>('learn');
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<{ score: number; summary: string; pay: CsaPay } | null>(null);
  const seed = useMemo(() => (isDrill ? drillSeed(today) : hashText(`${id}:${run}:${Date.now()}`)), [isDrill, today, id, run]);
  const Game = GAMES[id];
  const back = () => dispatch({ type: 'open', modal: { kind: 'climate', tab: 'csa' } });
  const done = (score: number, summary: string) => {
    const pay = finishRun(s.csa, id, score, today, !!daily);
    setResult({ score, summary, pay });
    setStep('result');
    dispatch({ type: 'csaDone', id, score, daily: !!daily });
  };
  const again = () => {
    setResult(null);
    setRun(r => r + 1);
    setStep('play');
  };

  return (
    <div className="csa-lesson" aria-label={`${p.name} lesson`}>
      <header className="csa-lesson-head">
        <button type="button" className="set-link" onClick={back}>
          ‹ All practices
        </button>
        <span className="csa-lesson-title">
          <i aria-hidden="true">{p.icon}</i>
          <b>{p.name}</b>
          <small>{p.aka}</small>
        </span>
        {isDrill && !drillDone(c, today) && <span className="csa-tag">Today’s drill</span>}
        <SkillBar s={s} id={id} />
        <ol className="csa-steps" aria-label="Lesson steps">
          {(['learn', 'play', 'result'] as Step[]).map((x, i) => (
            <li key={x} className={step === x ? 'is-on' : ''}>
              {i + 1} {x === 'learn' ? 'Learn' : x === 'play' ? 'Practise' : 'Result'}
            </li>
          ))}
        </ol>
      </header>

      {step === 'learn' && (
        <div className="csa-learn">
          <div className="csa-learn-main">
            <p className="csa-what">{p.what}</p>
            <ol className="csa-how">
              {p.steps.map(([icon, text], i) => (
                <li key={i}>
                  <i aria-hidden="true">{icon}</i>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="csa-learn-side">
            <div className="csa-where">
              <p>
                <b>🇰🇪 Kenya</b> {p.kenya}
              </p>
              <p>
                <b>🌍 West Africa</b> {p.westAfrica}
              </p>
            </div>
            <div className="csa-why">
              <b>Why it is climate-smart</b>
              <ul>
                {p.why.map(w => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
            <p className="csa-task">
              <b>Practise:</b> {p.task}.
            </p>
            <button type="button" className="gold-btn csa-go" onClick={() => setStep('play')}>
              {isDrill && !drillDone(c, today) ? 'Start today’s drill' : 'Practise it'} ›
            </button>
          </div>
        </div>
      )}

      {step === 'play' && <Game key={run} seed={seed} drill={isDrill} onDone={done} />}

      {step === 'result' && result && (
        <div className="csa-result">
          {result.pay.stars >= 2 && <Confetti />}
          <div className="csa-result-main">
            <Stars n={result.pay.stars} size="lg" />
            <p className="csa-result-score">{Math.round(result.score * 100)}%</p>
            <p className="csa-result-sum">{result.summary}</p>
            <p className="csa-remember">
              <b>Remember:</b> {p.remember}
            </p>
          </div>
          <div className="csa-result-side">
            <ul className="csa-pay">
              {result.pay.first && <li>First time: +{money(CSA.first.coins)} · +{CSA.first.points} points</li>}
              {result.pay.drill && (
                <li>
                  Today’s drill: +{money(CSA.drill.coins)} · +{result.pay.points - result.pay.starPoints - (result.pay.first ? CSA.first.points : 0)} points · +{result.pay.credits} climate credits
                  {result.pay.csa.drill.streak > 1 ? ` · ${result.pay.csa.drill.streak}-day streak` : ''}
                </li>
              )}
              {result.pay.starPoints > 0 && <li>New best: +{result.pay.starPoints} points</li>}
              {result.pay.levelUp && <li className="is-up">Skill up: {result.pay.levelUp}</li>}
              {!result.pay.first && !result.pay.drill && !result.pay.starPoints && !result.pay.levelUp && <li>Practice makes the skill: two stars or more add to it (a few runs a day).</li>}
            </ul>
            <div className="csa-result-btns">
              <button type="button" className="gold-btn csa-go" onClick={again}>
                Practise again
              </button>
              {daily ? (
                <button type="button" className="set-link" onClick={() => dispatch({ type: 'close' })}>
                  Back to the farm
                </button>
              ) : (
                <button type="button" className="set-link" onClick={back}>
                  All practices
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
