import { useEffect, useSyncExternalStore, type CSSProperties, type Dispatch, type KeyboardEvent, type MouseEvent, type PointerEvent as RPointerEvent } from 'react';
import { useVoice } from '../art/style';
import { canSpeak, speak, stopSpeaking } from '../speech';
import type { Action } from '../state';
import { BASICS, TERMS, termFor, type Term } from './glossary';

/* Info buttons: a small ⓘ beside the name of a fertilizer, a spray, a tool, a machine or any farm word. It opens that
   word's card on top of everything (InfoLayer, mounted once in App): what it is, what it does, when to use it, and a
   warning where there is one. The same layer shows the Farm basics lessons. The words are in glossary.ts. */

/* ---------------- what is open: a small store any screen can open from ---------------- */

type Shown = { kind: 'term'; id: string } | { kind: 'lesson'; index: number };
let stack: Shown[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));
const snapshot = () => stack;

/** Who hears a word's card being opened (useAnalytics). */
export const infoListeners: ((t: Term) => void)[] = [];

/** Open a word's card (on top of a lesson, Back returns to the lesson). */
export function openTerm(id: string) {
  const t = termFor(id);
  if (!t) return;
  stack = [...stack, { kind: 'term', id: t.id }];
  emit();
  infoListeners.forEach(l => l(t));
}
/** Open a Farm basics lesson. */
export function openLesson(index: number) {
  stack = [{ kind: 'lesson', index }];
  emit();
}
const back = () => {
  stack = stack.slice(0, -1);
  emit();
};
export const closeInfo = () => {
  stack = [];
  emit();
};

/* ---------------- the button ---------------- */

/** An ⓘ that opens a word's card. `term` is a word's id or any name in the game ("Knapsack sprayer", "Spray
    glyphosate"); it draws nothing when the name is not a known word. `nested`: inside another button (a shop card), so
    it is a span that keeps its tap to itself. */
export function Info({ term, size = 16, nested, className, style, light }: { term: string | undefined | null; size?: number; nested?: boolean; className?: string; style?: CSSProperties; light?: boolean }) {
  const t = termFor(term);
  if (!t) return null;
  const open = (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation();
    e.preventDefault();
    openTerm(t.id);
  };
  const props = {
    className: `info-btn${light ? ' is-light' : ''}${className ? ` ${className}` : ''}`,
    style: { width: size, height: size, fontSize: Math.round(size * 0.68), ...style },
    'aria-label': `What is ${t.name}?`,
    title: `What is ${t.name}?`,
    'data-term': t.id,
    onClick: open,
    onPointerDown: (e: RPointerEvent) => e.stopPropagation(),
  };
  return nested ? (
    <span role="button" tabIndex={0} {...props} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && open(e)}>
      i
    </span>
  ) : (
    <button type="button" {...props}>
      i
    </button>
  );
}

/** A name with its ⓘ after it. */
export function Named({ name, term, size = 14 }: { name: string; term?: string; size?: number }) {
  return (
    <span className="info-named">
      {name}
      <Info term={term ?? name} size={size} />
    </span>
  );
}

/* ---------------- the card on top ---------------- */

export function InfoLayer({ dispatch, read }: { dispatch: Dispatch<Action>; read: number[] }) {
  const shown = useSyncExternalStore(subscribe, snapshot, snapshot);
  const top = shown[shown.length - 1];
  const voice = useVoice();

  // Escape closes the card, not the page under it
  useEffect(() => {
    if (!top) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.stopImmediatePropagation();
      back();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [top]);

  const t = top?.kind === 'term' ? TERMS[top.id] : undefined;
  const lesson = top?.kind === 'lesson' ? BASICS[top.index] : undefined;
  useEffect(() => {
    if (!voice) return;
    if (t) speak(sayTerm(t));
    else if (lesson) speak([lesson.title, lesson.lead, ...lesson.cards.map(c => `${TERMS[c.term].name}: ${c.line}`)].join('. '));
  }, [voice, t, lesson]);
  useEffect(() => () => stopSpeaking(), []);

  if (!top) return null;
  const allWords = (tab: Extract<Action, { type: 'open' }>['modal']) => {
    closeInfo();
    dispatch({ type: 'open', modal: tab });
  };

  if (t)
    return (
      <div className="info-layer" role="dialog" aria-modal="true" aria-label={`${t.name}: what it is`}>
        <div className="scrim" onClick={closeInfo} />
        <div className="info-card">
          <header className="info-head">
            <span className="info-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="info-title">
              <small>{t.type}</small>
              <b>{t.name}</b>
            </span>
            <button type="button" className="mg-x" onClick={closeInfo} aria-label="Close">
              ×
            </button>
          </header>
          <div className="info-body">
          <dl className="info-rows">
            <div>
              <dt>What it is</dt>
              <dd>{t.what}</dd>
            </div>
            <div>
              <dt>What it does</dt>
              <dd>{t.does}</dd>
            </div>
            <div>
              <dt>When and how</dt>
              <dd>{t.use}</dd>
            </div>
            {t.care && (
              <div className="is-care">
                <dt>Take care</dt>
                <dd>{t.care}</dd>
              </div>
            )}
          </dl>
          {t.see && t.see.length > 0 && (
            <p className="info-see">
              <span>See also</span>
              {t.see
                .filter(id => TERMS[id])
                .map(id => (
                  <button key={id} type="button" className="info-chip" onClick={() => openTerm(id)}>
                    {TERMS[id].icon} {TERMS[id].name}
                  </button>
                ))}
            </p>
          )}
          </div>
          <footer className="info-foot">
            {shown.length > 1 && (
              <button type="button" className="mg-plain" onClick={back}>
                ‹ Back
              </button>
            )}
            {canSpeak() && (
              <button type="button" className="mg-plain" onClick={() => speak(sayTerm(t))} aria-label={`Read ${t.name} aloud`}>
                🔊 Read aloud
              </button>
            )}
            <button type="button" className="mg-plain" onClick={() => allWords({ kind: 'glossary', tab: t.section })}>
              📖 All farm words
            </button>
            <button type="button" className="gold-btn info-ok" onClick={shown.length > 1 ? back : closeInfo}>
              Got it
            </button>
          </footer>
        </div>
      </div>
    );

  if (!lesson || top.kind !== 'lesson') return null;
  const i = top.index;
  const done = () => {
    dispatch({ type: 'basicsRead', lesson: i });
    closeInfo();
  };
  return (
    <div className="info-layer" role="dialog" aria-modal="true" aria-label={`Farm basics: ${lesson.title}`}>
      <div className="scrim" onClick={closeInfo} />
      <div className="info-card is-lesson">
        <header className="info-head">
          <span className="info-icon" aria-hidden="true">
            {lesson.icon}
          </span>
          <span className="info-title">
            <small>
              Farm basics · {i + 1} of {BASICS.length}
              {read.includes(i) ? ' · read ✓' : ''}
            </small>
            <b>{lesson.title}</b>
          </span>
          <button type="button" className="mg-x" onClick={closeInfo} aria-label="Close">
            ×
          </button>
        </header>
        <p className="info-lead">{lesson.lead}</p>
        <ul className={`info-lesson n${lesson.cards.length}`}>
          {lesson.cards.map(c => {
            const w = TERMS[c.term];
            return (
              <li key={c.term}>
                <button type="button" className="info-word" onClick={() => openTerm(c.term)} aria-label={`${w.name}: ${c.line} Learn more`}>
                  <span className="info-word-icon" aria-hidden="true">
                    {w.icon}
                  </span>
                  <b>{w.name}</b>
                  <span>{c.line}</span>
                  <em>Learn more ›</em>
                </button>
              </li>
            );
          })}
        </ul>
        <footer className="info-foot">
          {i > 0 && (
            <button type="button" className="mg-plain" onClick={() => openLesson(i - 1)}>
              ‹ Lesson {i}
            </button>
          )}
          {i < BASICS.length - 1 && (
            <button type="button" className="mg-plain" onClick={() => (dispatch({ type: 'basicsRead', lesson: i }), openLesson(i + 1))}>
              Next lesson ›
            </button>
          )}
          <button type="button" className="mg-plain" onClick={() => allWords({ kind: 'glossary', tab: 'basics' })}>
            📖 All farm words
          </button>
          <button type="button" className="gold-btn info-ok" onClick={done}>
            Got it
          </button>
        </footer>
      </div>
    </div>
  );
}

const sayTerm = (t: Term) => [t.name, t.what, t.does, t.use, t.care].filter(Boolean).join(' ');
