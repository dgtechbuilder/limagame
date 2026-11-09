import { useEffect, useState } from 'react';
import { img } from '../assets';
import { GoldButton } from '../components/ui';
import { useVoice } from '../art/style';
import { speak } from '../speech';
import { photoByKey } from '../rounds/photos';
import { Field, FIELD_H, FIELD_W, FarmerFigure, Hut, Tree } from './art';
import { CallIcon } from './Review';
import { ksh, say, STORY, type Look, type StoryPage } from './data';
import { track } from './track';

/* The story so far: three pages between naming the farmer and the first walk.
   1 · the farmer bought this farm · 2 · last season's harvest failed and lost money · 3 · what went wrong, and the
   plan to learn from each mistake, starting with the maize. */

const ARMYWORM = photoByKey('armyworm/pests');

export function Story({ name, look, onDone }: { name: string; look: Look; onDone: () => void }) {
  const [i, setI] = useState(0);
  const page = STORY[i];
  const t = (line: string) => say(line, name);
  const last = i === STORY.length - 1;

  useEffect(() => track('story_page', { page: page.id }), [page.id]);

  // Read aloud: the page's lines, then (page 3) each mistake and its lesson
  const voice = useVoice();
  useEffect(() => {
    if (!voice) return;
    const parts = [page.title, ...page.lines.map(t), ...(page.ledger ?? []).map(l => `${l.label}: ${l.ksh} shillings.`), ...(page.mistakes ?? []).map(m => `${m.what} ${m.lesson}`)];
    speak(parts.join(' '));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voice, i]);

  const next = () => (last ? (track('story_done'), onDone()) : setI(i + 1));
  const skip = () => (track('story_skipped', { page: page.id }), onDone());

  return (
    <div className="abs fs-screen" style={{ inset: 0 }}>
      <div className="abs" style={{ inset: 0, background: 'rgba(20,30,12,0.5)' }} />
      <section className="fs-panel story-card" style={{ left: 40, top: 40, width: 794, height: 334 }} aria-label="The story so far" aria-roledescription="story">
        <div className="abs" style={{ left: 280, top: -22, width: 234, height: 58 }}>
          <img src={img.plank} alt="" width={234} height={58} />
          <h2 className="label abs story-title">{page.title}</h2>
        </div>
        <button type="button" className="story-skip" onClick={skip}>
          Skip story
        </button>

        <div key={page.id} className="story-art" aria-hidden="true">
          <StoryArt page={page} look={look} name={name} />
          {page.id === 'failed' && ARMYWORM && (
            <>
              {/* a close look, in a real photo: the caterpillar in the leaf funnel */}
              <span className="story-zoom">
                <img src={ARMYWORM.url} alt="" draggable={false} />
              </span>
              <span className="story-credit">
                Photo: {ARMYWORM.author} · {ARMYWORM.license}
              </span>
            </>
          )}
        </div>

        <div key={`t-${page.id}`} className="story-text">
          {page.lines.map(l => (
            <p key={l}>{t(l)}</p>
          ))}
          {page.ledger && (
            <dl className="story-ledger">
              {page.ledger.map(l => (
                <div key={l.label} className={`is-${l.kind}`}>
                  <dt>{l.label}</dt>
                  <dd>{(l.kind === 'out' || l.kind === 'lost' ? '− ' : '+ ') + ksh(l.ksh)}</dd>
                </div>
              ))}
            </dl>
          )}
          {page.mistakes && (
            <ol className="story-mistakes">
              {page.mistakes.map(m => (
                <li key={m.what}>
                  <span className="story-icon">
                    <CallIcon id={m.icon} />
                  </span>
                  <span>
                    <s>{m.what}</s>
                    <b>{m.lesson}</b>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="story-foot">
          <div className="story-dots" aria-label={`Page ${i + 1} of ${STORY.length}`} role="img">
            {STORY.map((p, k) => (
              <span key={p.id} className={k === i ? 'is-on' : k < i ? 'is-done' : ''} />
            ))}
          </div>
          {i > 0 && (
            <button type="button" className="story-back" onClick={() => setI(i - 1)}>
              Previous
            </button>
          )}
          <GoldButton font={13} height={40} style={{ minWidth: last ? 210 : 140, padding: '0 18px' }} onClick={next} ariaLabel={page.button}>
            {page.button}
          </GoldButton>
        </div>
      </section>
    </div>
  );
}

/** One picture per page, drawn in SVG with the first session's own art (300 × 220). */
function StoryArt({ page, look, name }: { page: StoryPage; look: Look; name: string }) {
  if (page.id === 'bought')
    return (
      <svg viewBox="0 0 300 220" width={300} height={220}>
        <defs>
          <linearGradient id="story-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#9fd6ee" />
            <stop offset="1" stopColor="#e9f4dc" />
          </linearGradient>
        </defs>
        <rect width={300} height={220} fill="url(#story-sky)" />
        <circle cx={250} cy={40} r={20} fill="#ffd45a" />
        <path d="M0,120 Q80,100 160,116 T300,108 L300,220 L0,220 Z" fill="#8cc163" />
        <path d="M0,150 Q120,134 300,148 L300,220 L0,220 Z" fill="#a8743f" />
        {[0, 1, 2].map(r => (
          <path key={r} d={`M10,${166 + r * 18} Q150,${158 + r * 18} 290,${166 + r * 18}`} stroke="#7d5229" strokeWidth={3} fill="none" opacity={0.6} />
        ))}
        <Tree x={32} y={118} s={0.95} />
        <Hut x={228} y={128} s={1.1} />
        {/* the water tank */}
        <g transform="translate(278,130)">
          <rect x={-12} y={-34} width={24} height={34} rx={4} fill="#2b7fb8" />
          <path d="M-12,-24 H12 M-12,-14 H12" stroke="#1d5f8c" strokeWidth={1.4} />
          <ellipse cx={0} cy={-34} rx={12} ry={3} fill="#3a93cf" />
        </g>
        {/* the signpost: the farmer's name, and SOLD */}
        <g transform="translate(86,154)">
          <rect x={-2.5} y={-46} width={5} height={46} fill="#6a4a2a" />
          <rect x={-46} y={-62} width={92} height={22} rx={3} fill="#f7e2b8" stroke="#8a5a30" strokeWidth={1.6} />
          <text x={0} y={-47} textAnchor="middle" fontSize={11} fontWeight={700} fill="#6b402b">
            {name.length > 9 ? 'My farm' : `${name}'s farm`}
          </text>
          <g transform="rotate(-8)">
            <rect x={-6} y={-40} width={40} height={14} rx={2} fill="#c0392b" />
            <text x={14} y={-30} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff" letterSpacing={1}>
              SOLD
            </text>
          </g>
        </g>
        <g transform="translate(172,198) scale(1.15)">
          <FarmerFigure look={look} pose="cheer" />
        </g>
      </svg>
    );

  if (page.id === 'failed')
    return (
      <svg viewBox="0 0 300 220" width={300} height={220}>
        <rect width={300} height={220} fill="#e7d7b2" />
        <rect width={300} height={70} fill="#d9cfa8" />
        <svg x={0} y={40} width={300} height={180} viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} preserveAspectRatio="xMidYMid slice">
          <Field crop="maize" cond="armyworm" problemRows={[0, 1, 2, 3, 4]} rows={5} seed={7} />
        </svg>
        {/* the handle of the magnifier over the field */}
        <path d="M206,92 L184,116" stroke="#8a5a30" strokeWidth={5} strokeLinecap="round" />
      </svg>
    );

  return (
    <svg viewBox="0 0 300 220" width={300} height={220}>
      <rect width={300} height={220} fill="#eaf3dc" />
      <svg x={0} y={60} width={300} height={160} viewBox={`0 0 ${FIELD_W} ${FIELD_H}`} preserveAspectRatio="xMidYMid slice">
        <Field crop="maize" cond="armyworm" problemRows={[]} rows={5} seed={3} />
      </svg>
      {/* the farmer with a notebook: this season, everything gets written down */}
      <g transform="translate(92,200) scale(1.3)">
        <FarmerFigure look={look} />
      </g>
      <g transform="translate(180,40) rotate(4)">
        <rect x={0} y={0} width={96} height={112} rx={6} fill="#fffaf0" stroke="#8a5a30" strokeWidth={2} />
        <rect x={0} y={0} width={96} height={18} rx={6} fill="#c98d55" />
        <text x={48} y={13} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">
          THIS SEASON
        </text>
        {['Check often', 'Water by the soil', 'Time the sale'].map((l, k) => (
          <g key={l} transform={`translate(8,${34 + k * 28})`}>
            <path d="M0,0 L4,5 L11,-5" stroke="#2f9b14" strokeWidth={2.4} fill="none" strokeLinecap="round" />
            <text x={15} y={4} fontSize={8.2} fontWeight={600} fill="#6b402b">
              {l}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
