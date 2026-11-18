import type { Dispatch } from 'react';
import type { Action, GameState } from '../state';
import { CloseX } from '../components/Success';
import { evidenceOf, type Answer } from './model';
import { Coach } from '../minigames/fun';

/* "Have you tried this on your own farm?": asked now and then after a practice, never more than once a day, and kept
   with the evidence. It does not stop play: answering or closing it carries on. */

const ANSWERS: { id: Answer; label: string; icon: string }[] = [
  { id: 'yes', label: 'Yes, I have', icon: '👍' },
  { id: 'planning', label: 'Not yet, but I will', icon: '🗓️' },
  { id: 'no', label: 'No', icon: '✋' },
  { id: 'no-farm', label: 'I don’t farm (yet)', icon: '🌱' },
];

export function EvidenceAsk({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const p = evidenceOf(s.evidence).pending;
  if (!p) return null;
  const answer = (a: Answer) => dispatch({ type: 'evidenceAnswer', answer: a });
  return (
    <div className="ev-ask" role="dialog" aria-label="Have you tried this on your own farm?">
      <CloseX label="Not now" onClick={() => answer('skip')} />
      <span className="ev-coach">
        <Coach mood="think" size={38} />
      </span>
      <small>On your own farm</small>
      <p>You {p.context}. Have you tried {p.label} on your own farm?</p>
      <div className="ev-ask-row">
        {ANSWERS.map(a => (
          <button key={a.id} type="button" className={a.id === 'yes' ? 'is-yes' : ''} onClick={() => answer(a.id)}>
            <i aria-hidden="true">{a.icon}</i> {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
