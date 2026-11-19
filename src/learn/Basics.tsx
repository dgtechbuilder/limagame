import { BASICS, TERMS } from './glossary';
import { Info, openLesson } from './Info';

/* Farm basics for a player who has never farmed: the first lesson in a box on the first session's farm update, and
   on the farm a chip each of the first days with that day's lesson (the first one not yet read). */

/** The first lesson, inline: fertilizer, pesticide and herbicide in a line each. */
export function BasicsBox() {
  const l = BASICS[0];
  return (
    <div className="basics-box" role="note" aria-label={`New to farming? ${l.title}`}>
      <p>
        <span aria-hidden="true">{l.icon}</span> New to farming? {l.title}
        <button type="button" className="basics-more" onClick={() => openLesson(0)}>
          Learn more
        </button>
      </p>
      <ul>
        {l.cards.map(c => (
          <li key={c.term}>
            <b>
              {TERMS[c.term].name}
              <Info term={c.term} size={14} />
            </b>
            <span>{c.short ?? c.line}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The lesson to offer on a farm day: the first not yet read, up to that day's own (day 1: the first lesson). */
export function lessonDue(day: number, read: number[]): number | null {
  const upTo = Math.min(BASICS.length - 1, Math.max(0, day - 1));
  for (let i = 0; i <= upTo; i++) if (!read.includes(i)) return i;
  return null;
}

/** On the farm in the first days: today's Farm basics lesson, until it is read. */
export function BasicsChip({ day, read }: { day: number; read: number[] }) {
  const i = lessonDue(day, read);
  if (i === null) return null;
  const l = BASICS[i];
  return (
    <button type="button" className="hud-basics" onClick={() => openLesson(i)} aria-label={`Farm basics, lesson ${i + 1}: ${l.title}`}>
      <i aria-hidden="true">{l.icon}</i>
      <span>
        <small>Farm basics · lesson {i + 1}</small>
        {l.title}
      </span>
    </button>
  );
}
