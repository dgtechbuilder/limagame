import type { Dispatch } from 'react';
import { ModalShell } from '../components/Modal';
import { PriceChip } from '../components/ui';
import { money } from '../money';
import { today, type Action, type GameState } from '../state';
import { COURSES, courseDate, dayText, seatsLeft } from '../training/data';
import { SponsorLine } from '../partners/ui';
import { COURSE_CREDITS } from '../progress/model';

/* Farmer training (Menu → Training): four short courses. Book a seat and the Booking Success dialog says when and
   where, with a reference; the booking is kept and a reminder goes into Messages. */

export function TrainingModal({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const booked = s.trainings ?? [];
  const now = today();
  return (
    <ModalShell frame="tall" x={130} y={2} title="Farmer training" onClose={() => dispatch({ type: 'close' })}>
      <div className="panel pp-body" style={{ left: 170, top: 56, width: 530, height: 300 }}>
        <p className="pp-sub" style={{ textAlign: 'center' }}>
          Learn from people who farm for a living · {booked.length ? `${booked.length} booked` : 'book a seat'} · +{COURSE_CREDITS} learning credits each
        </p>
        <div className="pp-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', flex: 1, gridAutoRows: '1fr' }}>
          {COURSES.map(c => {
            const mine = booked.find(b => b.id === c.id);
            const date = mine?.date ?? courseDate(c, now);
            const short = !mine && s.coins < c.price;
            return (
              <article key={c.id} className={`pp-card train-card${mine ? ' is-on' : ''}`} aria-label={c.title} title={`${c.place} · ${c.host}`}>
                <p className="pp-name">
                  <span aria-hidden="true">{c.icon}</span> {c.title}
                </p>
                <p className="pp-sub" style={{ lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.learn}</p>
                <p className="pp-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <b style={{ color: '#c0711b' }}>{dayText(date)}</b> · {c.time} · {c.hours} h · {c.place}
                </p>
                <div className="pp-row" style={{ marginTop: 'auto' }}>
                  {c.price ? <PriceChip price={c.price} width={72} /> : <span className="train-free">Free</span>}
                  <span className="pp-cap" style={{ whiteSpace: 'nowrap' }}>{seatsLeft(c, !!mine)} left</span>
                  <button
                    type="button"
                    className={`pp-btn${mine ? ' is-on' : ''}`}
                    style={{ marginLeft: 'auto', opacity: short ? 0.55 : 1 }}
                    onClick={() => !mine && dispatch({ type: 'bookTraining', id: c.id })}
                    aria-pressed={!!mine || undefined}
                    aria-label={mine ? `${c.title}: booked, ref ${mine.ref}` : `Book ${c.title}${c.price ? ` for ${money(c.price)}` : ', free'}`}
                  >
                    {mine ? '✓ Booked' : 'Book a seat'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </div>
      <SponsorLine slot="training" label="Courses with" dispatch={dispatch} className="modal-sponsor" style={{ left: 435, top: 360 }} />
    </ModalShell>
  );
}
