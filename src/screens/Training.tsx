import type { Dispatch } from 'react';
import { ModalShell } from '../components/Modal';
import { GoldButton, PriceChip } from '../components/ui';
import { money } from '../money';
import { today, type Action, type GameState } from '../state';
import { COURSES, courseDate, dayText, seatsLeft } from '../training/data';

/* Farmer training (Menu → Training): four short courses. Book a seat and the Booking Success dialog says when and
   where, with a reference; the booking is kept and a reminder goes into Messages. */

export function TrainingModal({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const booked = s.trainings ?? [];
  const now = today();
  return (
    <ModalShell frame="tall" x={130} y={2} title="Farmer training" close={[675, 26]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 170, top: 52, width: 530, height: 306 }}>
        <p className="section-title" style={{ marginTop: 8 }}>
          Learn from people who farm for a living · {booked.length ? `${booked.length} booked` : 'book a seat'}
        </p>
        <div className="train-grid">
          {COURSES.map(c => {
            const mine = booked.find(b => b.id === c.id);
            const date = mine?.date ?? courseDate(c, now);
            const short = !mine && s.coins < c.price;
            return (
              <article key={c.id} className={`card train-card${mine ? ' is-booked' : ''}`} aria-label={c.title}>
                <p className="train-title">
                  <span aria-hidden="true">{c.icon}</span> {c.title}
                </p>
                <p className="train-learn">{c.learn}</p>
                <p className="train-meta">
                  <b>{dayText(date)}</b> · {c.time} · {c.hours} h
                </p>
                <p className="train-meta">
                  {c.place} · {c.host}
                </p>
                <div className="train-foot">
                  {c.price ? <PriceChip price={c.price} width={58} font={8} /> : <span className="train-free">Free</span>}
                  <span className="train-seats">{seatsLeft(c, !!mine)} seats left</span>
                  <GoldButton
                    selected={!!mine}
                    style={{ width: 92, height: 22, marginLeft: 'auto', opacity: short ? 0.6 : 1 }}
                    font={9}
                    onClick={() => dispatch({ type: 'bookTraining', id: c.id })}
                    ariaLabel={mine ? `${c.title}: booked, ref ${mine.ref}` : `Book ${c.title}${c.price ? ` for ${money(c.price)} coins` : ', free'}`}
                  >
                    {mine ? '✓ Booked' : 'Book a seat'}
                  </GoldButton>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </ModalShell>
  );
}
