import { useEffect, useMemo, useRef, useState } from 'react';
import { Confetti } from '../fun';
import { WsCtx, type HandsQuestion, type Msg, type Tone, type Ws } from './kit';
import { SCENES } from './scenes';

/* The workshop: the tractor's lessons done with the hands. Each question is a small job on a working tractor (fit the
   part that turns the mower, carry the plough, cool the engine, get up a slope, get off safely, ...): the player drags
   parts in and out, works the levers and drives to see what moves. A try that goes wrong is shown, not just marked,
   and counted: a question done with no wrong tries is worth full marks, one wrong try two thirds, more a third. */

const WORTH = [1, 2 / 3, 1 / 3];

export function Workshop({ questions, onEnd }: { questions: HandsQuestion[]; onEnd: (score: number) => void }) {
  const [i, setI] = useState(0);
  const [slips, setSlips] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [won, setWon] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [streak, setStreak] = useState(0);
  const q = questions[i];
  const k = useRef(0);
  const wonRef = useRef(false);
  const slipsRef = useRef(0);
  slipsRef.current = slips;
  const ws: Ws = useMemo(() => {
    const say = (text: string, tone: Tone = 'info') => setMsg({ text, tone, k: ++k.current });
    return {
      q,
      msg,
      won,
      say,
      slip: text => {
        if (wonRef.current) return;
        setSlips(n => n + 1);
        say(text, 'bad');
      },
      win: text => {
        if (wonRef.current) return;
        wonRef.current = true;
        setWon(true);
        setStreak(x => (slipsRef.current === 0 ? x + 1 : 0));
        say(text, 'good');
      },
    };
  }, [q, msg, won]);
  const next = () => {
    const all = [...scores, WORTH[Math.min(slips, 2)]];
    if (i + 1 >= questions.length) return onEnd(all.reduce((a, b) => a + b, 0) / all.length);
    setScores(all);
    setI(i + 1);
    setSlips(0);
    setWon(false);
    wonRef.current = false;
    setMsg(null);
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (won && e.key === 'Enter') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  const Scene = SCENES[q.art];
  return (
    <div className="ws" data-question={q.art}>
      <div className="mg-quiz-top">
        <p className="mg-progress">
          Question {i + 1} of {questions.length}
          <span>
            {questions.map((_, n) => (
              <i key={n} className={n < i || (n === i && won) ? 'is-done' : ''} />
            ))}
          </span>
        </p>
        {streak >= 2 && <span className="mg-streak">🔥 {streak} in a row</span>}
        <span className={`ws-tries${slips ? ' is-bad' : ''}`}>{slips === 0 ? 'No wrong tries' : `${slips} wrong ${slips === 1 ? 'try' : 'tries'}`}</span>
      </div>
      <WsCtx.Provider value={ws}>
        <Scene key={i} />
      </WsCtx.Provider>
      {won && (
        <div className="mg-why is-right ws-why" role="status">
          <Confetti n={16} spread={0.8} />
          <p>
            <b>✓ {q.options[q.right]}.</b> {q.why}
          </p>
          <button type="button" className="gold-btn mg-go" onClick={next}>
            {i + 1 >= questions.length ? 'Finish' : 'Next question'}
          </button>
        </div>
      )}
    </div>
  );
}
