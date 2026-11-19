import { useState, type Dispatch } from 'react';
import { Page } from '../components/Page';
import type { Action, GameState, GlossaryTab } from '../state';
import { BASICS, SECTIONS, TERMS, termList, termsIn, type Term } from './glossary';
import { openLesson, openTerm } from './Info';

/* Farm words: every word in the game in one place, with the Farm basics lessons first. A section lists its words;
   the search box finds a word in any section. Tapping a word opens its card (Info.tsx). */

export function GlossaryPage({ s, dispatch, tab = 'basics' }: { s: GameState; dispatch: Dispatch<Action>; tab?: GlossaryTab }) {
  const [q, setQ] = useState('');
  const read = s.basics ?? [];
  const tabs = [
    { id: 'basics' as GlossaryTab, label: 'Farm basics', icon: '📖', badge: BASICS.length - read.length > 0 ? BASICS.length - read.length : undefined },
    ...SECTIONS.map(x => ({ id: x.id as GlossaryTab, label: x.tab, icon: x.icon })),
  ];
  const query = q.trim().toLowerCase();
  const found = query
    ? termList.filter(t => [t.name, t.type, t.what, ...(t.aka ?? [])].some(w => w.toLowerCase().includes(query)))
    : null;
  const section = SECTIONS.find(x => x.id === tab);
  return (
    <Page
      title="Farm words"
      className="gl-page"
      icon="📖"
      tabs={tabs}
      tab={tab}
      onTab={t => (setQ(''), dispatch({ type: 'open', modal: { kind: 'glossary', tab: t } }))}
      dispatch={dispatch}
      foot={`${termList.length} words. Tap ⓘ beside a name anywhere in the game.`}
    >
      <div className="gl-top">
        <input
          className="gl-search"
          type="search"
          placeholder="Find a word: DAP, glyphosate, harrow…"
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label="Find a farm word"
        />
      </div>
      {found ? (
        <>
          <p className="pg-lead">{found.length ? `${found.length} word${found.length === 1 ? '' : 's'} found` : 'No word found. Try another name.'}</p>
          <Words list={found} />
        </>
      ) : tab === 'basics' ? (
        <>
          <p className="pg-lead">New to farming? Start here: {BASICS.length} short lessons on the words this game uses most. One opens each morning; read any of them now.</p>
          <ol className="gl-lessons">
            {BASICS.map((l, i) => (
              <li key={l.id}>
                <button type="button" className={`gl-lesson${read.includes(i) ? ' is-read' : ''}`} onClick={() => openLesson(i)} aria-label={`Lesson ${i + 1}: ${l.title}${read.includes(i) ? ', read' : ''}`}>
                  <span className="gl-lesson-icon" aria-hidden="true">
                    {l.icon}
                  </span>
                  <span className="gl-lesson-text">
                    <small>
                      Lesson {i + 1}
                      {read.includes(i) ? ' · read ✓' : ''}
                    </small>
                    <b>{l.title}</b>
                    <span>{l.cards.map(c => TERMS[c.term].name).join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <>
          <p className="pg-lead">
            <b>{section?.label}.</b> {section?.lead}
          </p>
          <Words list={termsIn(tab as Term['section'])} />
        </>
      )}
    </Page>
  );
}

function Words({ list }: { list: Term[] }) {
  return (
    <ul className="gl-words">
      {list.map(t => (
        <li key={t.id}>
          <button type="button" className="gl-word" onClick={() => openTerm(t.id)} data-term={t.id}>
            <span className="gl-word-icon" aria-hidden="true">
              {t.icon}
            </span>
            <span className="gl-word-text">
              <b>{t.name}</b>
              <small>{t.type}</small>
              <span>{t.what}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
