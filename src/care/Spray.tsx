import { useState } from 'react';
import { NavBar } from '../components/Nav';
import { img } from '../assets';
import { FarmMap } from '../components/FarmMap';
import { GuideLine } from '../first/Review';
import { track } from '../first/track';
import { HAZARD_WORDS } from '../trials/model';
import type { SprayFor } from '../world/field';
import { KIT, KIT_LESSON, PRODUCTS, type Product } from './data';

/** What a spray is against, in words: a problem a check found, or stalk borer (scheduled care). */
const sprayWords = (h: SprayFor) => (h === 'borer' ? 'stalk borer' : HAZARD_WORDS[h]);

/* From Wakala Agent: at the shed, before the sprayer is picked up for a spray job, the safety kit goes on (gloves,
   face mask, boots), then the right product goes in the sprayer: one question for each problem being sprayed
   today. A wrong product says why and goes back on the shelf; it costs nothing. */

export function Spray({ jobs, name, onDone, onLeave }: { jobs: { farm: number; hazard: SprayFor }[]; name: string; onDone: () => void; onLeave: () => void }) {
  // one product question per problem (two farms with armyworm share one)
  const asks = jobs.filter((j, i) => PRODUCTS[j.hazard] && jobs.findIndex(x => x.hazard === j.hazard) === i);
  const [kit, setKit] = useState<string[]>([]);
  const [at, setAt] = useState(0);
  const [tried, setTried] = useState<string[]>([]);
  const [said, setSaid] = useState<Product | null>(null);
  const kitOn = kit.length === KIT.length;
  const ask = kitOn ? asks[at] : undefined;
  const ready = kitOn && at >= asks.length;
  const farmsOf = (h: SprayFor) =>
    jobs
      .filter(j => j.hazard === h)
      .map(j => `Farm ${j.farm + 1}`)
      .join(' and ');

  const wear = (id: string) => {
    if (kit.includes(id)) return;
    const next = [...kit, id];
    setKit(next);
    if (next.length === KIT.length) track('kit_on', { jobs: jobs.length });
  };

  const pick = (p: Product) => {
    if (!ask || tried.includes(p.id)) return;
    track('product', { hazard: ask.hazard, pick: p.id, right: p.right });
    setSaid(p);
    if (!p.right) return setTried(v => [...v, p.id]);
    setTried([]);
    setAt(n => n + 1);
  };

  let line = `Safety first, ${name}. Put on the safety kit.`;
  if (!kitOn && kit.length) line = KIT_LESSON;
  if (ask) line = said && !said.right ? `${said.lesson} Pick again.` : `${said?.right ? `Right: ${said.lesson} ` : ''}Which product goes in the sprayer for ${farmsOf(ask.hazard)} (${sprayWords(ask.hazard)})?`;
  if (ready) line = `${said?.right ? `Right: ${said.lesson} ` : ''}Kit on, sprayer filled. Take it to the farm and spray every row.`;

  return (
    <div className="abs fs-screen review care-screen" style={{ inset: 0 }}>
      <FarmMap dim={0.42} />
      <div className="abs" style={{ left: 336, top: -4, width: 203, height: 58 }}>
        <img src={img.plank} alt="" width={203} height={58} />
        <span className="label abs" style={{ left: 0, right: 0, top: 21, textAlign: 'center', fontSize: 11 }}>
          Ready to spray
        </span>
      </div>
      <span className="rr-roundtag">The shed · sprayer</span>
      <NavBar horizontal onBack={onLeave} style={{ right: 6, top: 4 }} />
      <ol className="review-steps" aria-label="Spray steps">
        <li className={kitOn ? 'is-done' : 'is-now'}>Safety kit</li>
        <li className={ready ? 'is-done' : kitOn ? 'is-now' : ''}>Product</li>
      </ol>

      <div className="fs-panel" style={{ left: 24, top: 78, width: 826, height: 246 }}>
        <div className="kit-art" aria-hidden="true">
          <KitArt on={kit} />
        </div>
        {!kitOn ? (
          <div className="care-opts" role="group" aria-label="Safety kit">
            <p className="care-ask">Put on every piece</p>
            {KIT.map(k => (
              <button type="button" key={k.id} className={`care-opt${kit.includes(k.id) ? ' is-right' : ''}`} aria-pressed={kit.includes(k.id)} onClick={() => wear(k.id)}>
                <span className="care-mark" aria-hidden="true">
                  {kit.includes(k.id) ? '✓' : ''}
                </span>
                <span>{k.label}</span>
              </button>
            ))}
          </div>
        ) : ask ? (
          <div className="care-opts" role="group" aria-label="Products" key={ask.hazard}>
            <p className="care-ask">For {farmsOf(ask.hazard)}</p>
            {PRODUCTS[ask.hazard].map(p => (
              <button type="button" key={p.id} className={`care-opt${tried.includes(p.id) ? ' is-wrong' : ''}`} disabled={tried.includes(p.id)} onClick={() => pick(p)}>
                <span className="care-mark" aria-hidden="true">
                  {tried.includes(p.id) ? '✕' : ''}
                </span>
                <span>
                  {p.name}
                  <small className="care-kind">{p.kind}</small>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="care-opts">
            <p className="care-ask">Ready</p>
            <p className="care-done">Gloves, mask and boots on. The sprayer is filled.</p>
          </div>
        )}
      </div>

      <GuideLine text={line} action={ready ? { label: 'Pick up the sprayer', onClick: onDone } : undefined} />
    </div>
  );
}

/** The farmer's kit, drawn: each piece shows once it is on. */
function KitArt({ on }: { on: string[] }) {
  const has = (k: string) => on.includes(k);
  return (
    <svg viewBox="0 0 120 150" width={180} height={210}>
      <circle cx={60} cy={26} r={16} fill="#8a5634" />
      {has('mask') && <rect x={47} y={28} width={26} height={11} rx={4} fill="#e8f1f5" stroke="#9ab" />}
      <rect x={40} y={44} width={40} height={52} rx={10} fill="#d9433a" />
      <rect x={26} y={48} width={14} height={40} rx={6} fill="#d9433a" />
      <rect x={80} y={48} width={14} height={40} rx={6} fill="#d9433a" />
      <circle cx={33} cy={92} r={7} fill={has('gloves') ? '#f2c230' : '#8a5634'} />
      <circle cx={87} cy={92} r={7} fill={has('gloves') ? '#f2c230' : '#8a5634'} />
      <rect x={44} y={96} width={14} height={36} rx={5} fill="#3b4a5a" />
      <rect x={62} y={96} width={14} height={36} rx={5} fill="#3b4a5a" />
      {has('boots') ? (
        <>
          <rect x={41} y={120} width={19} height={20} rx={4} fill="#2f7d27" />
          <rect x={60} y={120} width={19} height={20} rx={4} fill="#2f7d27" />
        </>
      ) : (
        <>
          <ellipse cx={51} cy={136} rx={9} ry={4} fill="#8a5634" />
          <ellipse cx={69} cy={136} rx={9} ry={4} fill="#8a5634" />
        </>
      )}
      <rect x={92} y={60} width={18} height={34} rx={6} fill="#f2c230" opacity={on.length === 3 ? 1 : 0.25} />
      <path d="M101 60V50h10" stroke="#444" strokeWidth={3} fill="none" opacity={on.length === 3 ? 1 : 0.25} />
    </svg>
  );
}
