import { useEffect } from 'react';
import { img } from '../assets';
import { GoldButton } from '../components/ui';
import { useVoice } from '../art/style';
import { speak } from '../speech';
import { Plant } from './art';
import { FARM_UPDATE, SHAMBAS, ksh, say } from './data';
import { track } from './track';

/* The farm update: the farmer has walked to the maize, and before the first check sees how this season is going:
   7 weeks in, over KSh 200,000 spent, and heading for a loss of most of it. Each crop's problem is still unread; what
   each one puts at stake is shown again on its check. */

export function FarmUpdate({ name, onDone }: { name: string; onDone: () => void }) {
  const u = FARM_UPDATE;
  const loss = u.spent - u.atThisRate;
  const fill = (line: string) => say(line, name).replace('{weeks}', String(u.weeks)).replace('{spent}', ksh(u.spent));

  useEffect(() => track('farm_update_shown'), []);

  const voice = useVoice();
  useEffect(() => {
    if (!voice) return;
    speak([u.title, ...u.lines.map(fill), `At this rate the harvest brings back about ${u.atThisRate} shillings: a loss of ${loss} shillings.`].join(' '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice]);

  return (
    <div className="abs fs-screen" style={{ inset: 0 }}>
      <div className="abs" style={{ inset: 0, background: 'rgba(20,30,12,0.5)' }} />
      <section className="fs-panel story-card update-card" style={{ left: 40, top: 40, width: 794, height: 334 }} aria-label={u.title}>
        <div className="abs" style={{ left: 280, top: -22, width: 234, height: 58 }}>
          <img src={img.plank} alt="" width={234} height={58} />
          <h2 className="label abs story-title">{u.title}</h2>
        </div>
        <span className="update-week">Week {u.weeks} of the season</span>

        <div className="story-art update-art" role="img" aria-label={`Spent ${ksh(u.spent)}; at this rate the harvest brings ${ksh(u.atThisRate)}; a loss of ${ksh(loss)}`}>
          <LossChart spent={u.spent} back={u.atThisRate} />
        </div>

        <div className="story-text">
          {u.lines.map(l => (
            <p key={l}>{fill(l)}</p>
          ))}
          <ul className="update-crops">
            {u.crops.map(c => (
              <li key={c.name}>
                <svg viewBox="-30 -62 60 66" width={36} height={40} aria-hidden="true">
                  <Plant crop={c.crop} x={0} y={0} s={c.crop === 'maize' ? 0.75 : 1.1} cond={SHAMBAS[c.stake].condition} seed={3} bg="#f5e4cb" />
                </svg>
                <span>
                  <b>{c.name}</b>
                  <i>{c.sign}</i>
                </span>
                <em>{ksh(SHAMBAS[c.stake].atStake)} at stake</em>
              </li>
            ))}
          </ul>
        </div>

        <div className="story-foot">
          <p className="update-nudge">Find each problem and you can still save most of it.</p>
          <GoldButton font={13} height={40} style={{ minWidth: 190, padding: '0 18px' }} onClick={onDone} ariaLabel={u.button}>
            {u.button}
          </GoldButton>
        </div>
      </section>
    </div>
  );
}

/** Two bars: what the season has cost, and what its harvest brings back at this rate; the gap is the loss. */
function LossChart({ spent, back }: { spent: number; back: number }) {
  const H = 150;
  const base = 186;
  const hSpent = H;
  const hBack = (back / spent) * H;
  const k = (n: number) => `${Math.round(n / 100) / 10}k`;
  return (
    <svg viewBox="0 0 300 220" width={300} height={220} aria-hidden="true">
      <rect width={300} height={220} fill="#fff8ec" />
      <line x1={30} y1={base} x2={280} y2={base} stroke="#a8916f" strokeWidth={2} />
      {/* spent */}
      <rect x={52} y={base - hSpent} width={70} height={hSpent} rx={6} fill="#a0522d" />
      <text x={87} y={base - hSpent + 22} textAnchor="middle" fontSize={15} fontWeight={800} fill="#fff">
        {k(spent)}
      </text>
      <text x={87} y={base + 18} textAnchor="middle" fontSize={11} fontWeight={700} fill="#6b402b">
        Spent so far
      </text>
      {/* back at this rate, and the loss above it */}
      <rect x={178} y={base - hSpent} width={70} height={hSpent - hBack} rx={6} fill="none" stroke="#c0392b" strokeWidth={2.5} strokeDasharray="7 5" />
      <text x={213} y={base - hSpent + (hSpent - hBack) / 2 + 2} textAnchor="middle" fontSize={13} fontWeight={800} fill="#c0392b">
        −{k(spent - back)}
      </text>
      <text x={213} y={base - hSpent + (hSpent - hBack) / 2 + 18} textAnchor="middle" fontSize={10} fontWeight={700} fill="#c0392b">
        lost
      </text>
      <rect x={178} y={base - hBack} width={70} height={hBack} rx={6} fill="#2f9b14" />
      <text x={213} y={base - hBack + 18} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff">
        {k(back)}
      </text>
      <text x={213} y={base + 18} textAnchor="middle" fontSize={11} fontWeight={700} fill="#6b402b">
        Harvest at this rate
      </text>
      <text x={150} y={22} textAnchor="middle" fontSize={11} fontWeight={700} fill="#8a6a4a">
        Shillings, this season
      </text>
    </svg>
  );
}
