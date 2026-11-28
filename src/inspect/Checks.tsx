import { useEffect, useState, type Dispatch } from 'react';
import { NavBar } from '../components/Nav';
import { CloseX } from '../components/Success';
import { Exam } from '../livestock/Exam';
import { Routine } from '../livestock/Animals';
import { issueOf } from '../livestock/config';
import { ExamScene } from '../livestock/ExamScene';
import { lifeOf } from '../livestock/model';
import { money } from '../money';
import type { Action, GameState } from '../state';
import { checksOf, earlyToday, plannedOf } from './model';
import { CHECK_ORDER, PLANTS, isPlant, subjectOf } from './subjects';
import type { SubjectId } from './types';
import { urgentOf } from './urgent';

/* Farm checks: every full check in one place. A card for each (the cow, the chicken, a maize plant, the tractor, the
   farm, the water and the power), with what is red on it now and when it was last checked all over; tapping one
   opens its examination (src/livestock/Exam.tsx). Below, every job planned from a check, soonest first, to do now.
   Opened from the main menu (Farm checks), and from the Animals, Power and tractor pages for their own check. */

export function ChecksPage({ s, dispatch, subject: first }: { s: GameState; dispatch: Dispatch<Action>; subject?: SubjectId }) {
  const [open, setOpen] = useState<SubjectId | null>(first ?? null);
  const close = () => dispatch({ type: 'close' });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dispatch({ type: 'close' });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);
  const l = lifeOf(s.life);
  const ch = checksOf(s.checks);
  const planned = plannedOf(s.checks);
  return (
    <div className="abs settings-page ck-page" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Farm checks">
      <div className="scrim" onClick={close} />
      <div className="fs-panel set-panel ck-panel" style={{ left: 24, top: 46, width: 826, height: 334 }}>
        <p className="ck-lead">
          Check every part, not only what looks wrong: problems start small. <b>Red</b> needs you now; an early sign can be fixed in a few seconds or planned for a day.
        </p>
        <div className="ck-grid">
          {CHECK_ORDER.map(id => {
            const def = subjectOf(id);
            const red = def.group ? l.issues.filter(i => issueOf(i.id).group === def.group).length : urgentOf(s, id).length;
            const last = ch.full[id];
            const plans = planned.filter(p => p.subject === id).length;
            return (
              <button key={id} type="button" className={`ck-card${red ? ' has-red' : ''}${last === l.day ? ' is-done' : ''}`} onClick={() => setOpen(id)}>
                <span className="ck-thumb" style={{ background: def.ground }}>
                  <ExamScene subject={id} marks={new Set(def.group ? [] : urgentOf(s, id).map(u => u.mark))} early={earlyToday(s.checks, id, l.day).map(e => e.id)} />
                </span>
                <b>{def.title}</b>
                <small>
                  {red ? <em className="ck-red">{red} red</em> : null}
                  {last === l.day ? '✓ Checked today' : last ? `Last: day ${last}` : 'Not checked yet'}
                  {plans ? ` · ${plans} planned` : ''}
                </small>
              </button>
            );
          })}
        </div>
        <p className="set-title lv-sub">Planned from your checks</p>
        {planned.length === 0 ? (
          <p className="cl-tip">Nothing planned. Early signs you plan for a day on a check wait here.</p>
        ) : (
          planned.map(p => (
            <div key={`${p.subject}:${p.early.id}`} className={`lv-job${p.day < l.day ? ' is-late' : ''}`}>
              <span className="lv-job-text">
                <b>
                  <span className="cl-where">{p.day < l.day ? `Overdue · day ${p.day}` : p.day === l.day ? 'Today' : `Day ${p.day}`}</span> {p.early.fix.label}
                </b>
                <small>
                  {subjectOf(p.subject).title.replace('Examine the ', 'The ')}: {p.early.title.toLowerCase()}. {p.early.risk}
                </small>
              </span>
              <button type="button" className="lv-btn is-go" onClick={() => dispatch({ type: 'checkFix', subject: p.subject, id: p.early.id })} aria-label={`${p.early.fix.label}${p.early.fix.cost ? ` for ${money(p.early.fix.cost)}` : ''}`}>
                Do it{p.early.fix.cost ? ` · ${money(p.early.fix.cost)}` : ''}
              </button>
            </div>
          ))
        )}
      </div>
      <NavBar horizontal onBack={close} style={{ right: 62, top: 8 }} />
      <CloseX className="page-x" onClick={close} />
      <p className="set-title-bar">
        <span aria-hidden="true">🔍</span> <b>Farm checks</b>
      </p>
      {open && <CheckExam s={s} dispatch={dispatch} subject={open} onClose={() => (first ? close() : setOpen(null))} />}
    </div>
  );
}

/** One check opened from here: an animal's with its problem showing as red parts, the rest with what is red now. */
export function CheckExam({ s, dispatch, subject, onClose }: { s: GameState; dispatch: Dispatch<Action>; subject: SubjectId; onClose: () => void }) {
  if (subjectOf(subject).group) return <Routine s={s} dispatch={dispatch} subject={subject} onClose={onClose} />;
  if (subject === 'farm' || isPlant(subject)) return <PlantsThenFarm s={s} dispatch={dispatch} subject={subject} onClose={onClose} />;
  return <Exam s={s} dispatch={dispatch} subject={subject} onClose={onClose} />;
}

/** Checking the farm is two steps: a plant up close first (maize, beans, kale or tomatoes, each drawn like the
    animals), then the farm itself. A plant's own card opens the first step alone. */
function PlantsThenFarm({ s, dispatch, subject, onClose }: { s: GameState; dispatch: Dispatch<Action>; subject: SubjectId; onClose: () => void }) {
  const farm = subject === 'farm';
  const [stage, setStage] = useState<'plant' | 'farm'>('plant');
  const [crop, setCrop] = useState<SubjectId>(farm ? 'plant' : subject);
  if (stage === 'farm') return <Exam key="farm" s={s} dispatch={dispatch} subject="farm" stepOf="step 2 of 2: the farm" onClose={onClose} />;
  return (
    <Exam
      key={crop}
      s={s}
      dispatch={dispatch}
      subject={crop}
      crops={{ list: PLANTS, pick: setCrop }}
      stepOf={farm ? 'step 1 of 2: the plants' : undefined}
      then={farm ? { label: 'Step 2: examine the farm', go: () => setStage('farm') } : undefined}
      onClose={onClose}
    />
  );
}
