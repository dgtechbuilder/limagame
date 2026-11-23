import { lockShort, lockText } from '../unlock/model';
import { Info } from '../learn/Info';
import { useState, type CSSProperties, type Dispatch, type ReactNode } from 'react';
import { FarmerPortrait } from '../first/art';
import { LOOKS } from '../first/data';
import { img } from '../assets';
import { nextAction } from '../components/FarmScene';
import { EditIcon, InfoDot } from '../components/Icons';
import { ModalShell, TextSidebar } from '../components/Modal';
import { Cast } from '../art/Cast';
import { PROCESS_CO2, STORAGE_CO2 } from '../climate/model';
import { hasSolar } from '../climate/track';
import { Coin, GoldButton, Img, Stars, fmt } from '../components/ui';
import { GROWING_STEPS, HARVEST_CHOICES, PLAY_GOAL_HOURS, PROCESSES, REWARDS, STEPS, STORAGE_OPTIONS, TIMELINE, TIP, type StepId } from '../data';
import {
  SELLING,
  SOLD,
  cropHealth,
  daysToHarvest,
  expectedHarvest,
  profitPerBag,
  qualityPrice,
  saleQuote,
  sellAt,
  stepIndex,
  type Action,
  type GameState,
  type Modal,
  type Prices,
  type SeasonResult,
} from '../state';
import { fromLocal, localNumber, money } from '../money';
import { REWARD_SPONSOR, brandOf } from '../partners/data';
import { BrandMark, openOffer } from '../partners/ui';

type Props = { s: GameState; dispatch: Dispatch<Action> };

const go = (dispatch: Dispatch<Action>, modal: Modal) => dispatch({ type: 'open', modal });

/** Shown in place of a screen's content when the season isn't at that point yet. */
function Empty({ s, dispatch, title, body, style }: Props & { title: string; body: string; style?: CSSProperties }) {
  const now = nextAction(s);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, textAlign: 'center', ...style }}>
      <Img src={img.cornPreview} w={64} h={64} />
      <p className="pp-h">{title}</p>
      <p className="pp-sub" style={{ maxWidth: 320 }}>{body}</p>
      <GoldButton className="pp-main" style={{ minWidth: 180, marginTop: 8 }} onClick={() => go(dispatch, now.modal)}>
        Next task: {now.label}
      </GoldButton>
    </div>
  );
}

const notSellingCopy = (s: GameState) =>
  s.stage === SOLD
    ? { title: 'This season is sold', body: 'Check your results, then start the next season.' }
    : { title: 'Nothing to sell yet', body: `Your maize is growing: ready in about ${daysToHarvest(s)} days if you keep up.` };

/* ================================================================== */
/* Sale of produce                                                      */
/* ================================================================== */

export function SaleModal({ s, dispatch }: Props) {
  const p = s.prices;
  const perBag = profitPerBag(p);
  const fields: { key: keyof Prices; label: string; info?: boolean }[] = [
    { key: 'farmgate', label: 'Farmgate Price', info: true },
    { key: 'market', label: 'Market price' },
    { key: 'transport', label: 'Transportation cost' },
    { key: 'storage', label: 'Storage cost' },
  ];
  const setPrice = (key: keyof Prices, raw: string) => {
    // prices are typed as shown, in the player's currency (src/money.ts)
    const n = Math.min(key === 'market' || key === 'farmgate' ? 60 : 200, fromLocal(Number(raw.replace(/[^\d.]/g, '')) || 0));
    dispatch({ type: 'prices', prices: { ...p, [key]: n } });
  };
  const selling = s.stage === SELLING && s.harvested;

  return (
    <ModalShell frame="wide" x={116} y={32} title="Sale of produce" onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 138, top: 72, width: 602, height: 270 }}>
        {!selling ? (
          <Empty s={s} dispatch={dispatch} {...notSellingCopy(s)} />
        ) : (
          <>
            <div className="pp-card" style={{ position: 'absolute', left: 16, top: 16, width: 200, height: 238, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <Img src={img.corn} w={120} h={89} alt="Maize" />
              <div style={{ textAlign: 'center' }}>
                <p className="pp-h">Maize</p>
                <p className="pp-sub" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {s.harvested!.bags} bags · <Stars value={s.harvested!.quality} size={12} />
                </p>
              </div>
            </div>

            <div style={{ position: 'absolute', left: 232, top: 16, right: 16, bottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {fields.map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span className="pp-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {f.info && <InfoDot size={12} />}
                      {f.label}
                    </span>
                    <span className="field-box" style={{ height: 32 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Img src={img.coin20} w={18} h={19} />
                        <input id={`price-${f.key}`} inputMode="numeric" value={localNumber(p[f.key]).replace(/,/g, '')} aria-label={f.label} onChange={e => setPrice(f.key, e.target.value)} style={{ fontSize: 10 }} />
                      </span>
                      <EditIcon size={18} />
                    </span>
                  </label>
                ))}
              </div>
              <div className="pp-facts">
                <div className="pp-fact"><span>Bags to sell</span><span>{s.harvested!.bags} bags</span></div>
                <div className="pp-fact"><span>Profit per bag at market, after costs</span><span><Coin size={14} /> {money(perBag)}/bag</span></div>
              </div>
              <p className="pp-sub" style={{ lineHeight: 1.35, color: sellAt(p) === 'gate' ? 'var(--bad)' : undefined }}>
                {sellAt(p) === 'gate' ? 'The gate pays more right now, so you sell there: ' : 'Market pays more: '}
                {money(p.farmgate)}/bag at your gate vs {money(perBag)}/bag at market
                {s.harvested!.quality < 5 ? `. ${s.harvested!.quality}-star grain fetches ${Math.round(qualityPrice(s.harvested!.quality) * 100)}% of that.` : '.'}
              </p>
              <GoldButton className="pp-main" style={{ marginTop: 'auto' }} onClick={() => go(dispatch, { kind: 'storage' })}>
                Continue · choose storage
              </GoldButton>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Storage                                                              */
/* ================================================================== */

export function StorageModal({ s, dispatch }: Props) {
  const selling = s.stage === SELLING && s.harvested;
  const [details, setDetails] = useState(false);
  const co2 = (id: string) => (STORAGE_CO2[id] ? `${id === 'cold' && hasSolar(s) ? 0.4 : STORAGE_CO2[id]} kg/bag` : 'None');
  return (
    <ModalShell frame="shop" x={178} y={28} title="Storage" onClose={() => dispatch({ type: 'close' })}>
      <div className="panel pp-body" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        {!selling ? (
          <Empty s={s} dispatch={dispatch} {...notSellingCopy(s)} />
        ) : (
          <>
            <div className="pp-head" style={{ alignItems: 'center' }}>
              <p className="pp-h">How will you store your maize?</p>
              <span className="pp-seg" role="group" aria-label="Show">
                <button type="button" aria-pressed={!details} onClick={() => setDetails(false)}>Costs</button>
                <button type="button" aria-pressed={details} onClick={() => setDetails(true)}>Details</button>
              </span>
            </div>
            <div className="pp-table" style={{ gridTemplateColumns: '30px minmax(0, 1fr) 66px 58px 58px 80px' }}>
              <span />
              <span className="pp-th">Store</span>
              <span className="pp-th">{details ? 'Spoilage' : 'Cost / bag'}</span>
              <span className="pp-th" title={details ? undefined : 'Bags lost to spoilage (and theft) before you sell'}>{details ? 'CO₂e' : 'Lost'}</span>
              <span className="pp-th">Time</span>
              <span />
              {STORAGE_OPTIONS.map((o, i) => {
                const on = s.storage === o.id;
                const q = saleQuote({ ...s, storage: o.id }, null);
                const lock = on ? null : lockText(s, i);
                return (
                  <div key={o.id} className={`pp-trow${lock ? ' is-gated' : ''}${on ? ' is-on' : ''}`} data-option={o.id}>
                    <span style={{ justifyContent: 'center' }}>
                      <Img src={o.icon} w={Math.round(o.iconSize[0] * Math.min(1, 28 / o.iconSize[0], 28 / o.iconSize[1]))} h={Math.round(o.iconSize[1] * Math.min(1, 28 / o.iconSize[0], 28 / o.iconSize[1]))} alt="" />
                    </span>
                    <span className="pp-name" style={on ? { textDecoration: 'underline', textDecorationColor: 'var(--select-ring)', textDecorationThickness: 2, textUnderlineOffset: 3 } : undefined}>
                      {o.name}
                      <Info term={({ home: 'homeStore', coop: 'warehouse' } as Record<string, string>)[o.id] ?? o.id} size={14} style={{ margin: '0 0 0 4px', verticalAlign: -2 }} />
                    </span>
                    <b>{details ? o.spoilage : o.costPerBag ? <><Coin size={14} /> {money(o.costPerBag)}</> : 'Free'}</b>
                    <b>{details ? co2(o.id) : `≈ ${q.lost}${q.stolen ? ` +${q.stolen}` : ''}`}</b>
                    <span>{o.time}</span>
                    <span style={{ justifyContent: 'flex-end' }}>
                      {lock ? (
                        <span className="lock-tag" title={lock}>
                          🔒 {lockShort(s, i)}
                        </span>
                      ) : on ? (
                        <GoldButton className="pp-main is-small" style={{ width: '100%', padding: 0 }} onClick={() => go(dispatch, { kind: 'value' })} ariaLabel={`Continue with ${o.name}`}>
                          Continue
                        </GoldButton>
                      ) : (
                        <button type="button" className="pp-btn" style={{ width: '100%' }} onClick={() => dispatch({ type: 'storage', id: o.id })} aria-label={`Select ${o.name}`}>
                          Select
                        </button>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Harvest timing                                                        */
/* ================================================================== */

export function TimingModal({ s, dispatch }: Props) {
  const ready = s.stage === stepIndex('harvest');
  const choice = HARVEST_CHOICES.find(c => c.id === s.harvestChoice)!;
  const out = expectedHarvest(s, s.harvestChoice);
  const toGo = daysToHarvest(s);
  const progress = s.stage >= stepIndex('harvest') ? 100 : Math.round((s.day / (s.day + toGo)) * 100);
  const current = STEPS[Math.min(s.stage, STEPS.length - 1)];

  return (
    <ModalShell frame="tall" x={130} y={2} title="Harvest timing" onClose={() => dispatch({ type: 'close' })}>
      <div className="panel pp-body" style={{ left: 170, top: 56, width: 530, height: 302, padding: 16, gap: 12 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
            <div className="pp-row">
              <Img src={img.timingMaize} w={32} h={32} alt="" />
              <p className="pp-h">Maize</p>
              <span className="pp-bar" role="img" aria-label={`${progress}% of the way to harvest`}>
                <i style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#ffb35c,#ff8a3d)' }} />
              </span>
              <b className="pp-name">{progress}%</b>
            </div>
            <p className="pp-sub">
              {ready
                ? 'Your crop is ready. A short wait can raise yield; too long lowers quality.'
                : s.stage > stepIndex('harvest')
                  ? 'This season is already harvested.'
                  : `About ${toGo} days to go. Finish ${current.label} and the later steps first.`}
            </p>
          </div>
          <div className="pp-card" style={{ width: 200, flexShrink: 0, background: 'rgba(255,255,255,0.4)', border: 0 }}>
            <p className="pp-label">If you {choice.label.toLowerCase()}</p>
            <div className="pp-facts">
              <div className="pp-fact"><span>Yield</span><span><Img src={img.yieldIcon} w={14} h={14} /> {out.bags} bags</span></div>
              <div className="pp-fact"><span>Quality</span><span><Stars value={out.quality} size={12} /></span></div>
              <div className="pp-fact"><span>Crop health</span><span>{Math.round(out.health * 100)}%</span></div>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', height: 72 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: 10, height: 8, borderRadius: 6, background: 'linear-gradient(90deg,#ffb23f 0%,#ffc35e 28%,#ffd88f 50%,#f3e3c8 68%,#e8ded3 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            {TIMELINE.map(t => (
              <div key={t.week} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <Img src={t.star} w={26} h={26} />
                <p className="pp-name" style={{ marginTop: 2 }}>{t.week}</p>
                <p className="pp-sub" style={{ lineHeight: 1.3 }}>{t.note.replace('\n', ' ').replace(/^./, c => c.toUpperCase())}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="pp-row" style={{ marginTop: 'auto', alignItems: 'stretch' }}>
          <div role="radiogroup" aria-label="When to harvest" className="pp-grid" style={{ flex: 1, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
            {HARVEST_CHOICES.map(c => {
              const on = c.id === s.harvestChoice;
              const est = expectedHarvest(s, c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`pp-card${on ? ' is-on' : ''}`}
                  style={{ height: 56, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  onClick={() => dispatch({ type: 'chooseHarvest', choice: c.id })}
                  aria-label={`Select ${c.label}, about ${est.bags} bags`}
                >
                  <Img src={c.icon} w={c.iconSize[0]} h={c.iconSize[1]} style={{ height: 24, width: 'auto', flexShrink: 0 }} />
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className="pp-name">{c.label}</span>
                    <span className="pp-cap" style={{ color: 'var(--ink-2)' }}>≈ {est.bags} bags</span>
                  </span>
                </button>
              );
            })}
          </div>
          {ready && (
            <GoldButton className="pp-main" style={{ height: 56, flexShrink: 0 }} onClick={() => dispatch({ type: 'harvest' })} ariaLabel={`Harvest: ${choice.label}`}>
              Harvest
            </GoldButton>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Value addition                                                        */
/* ================================================================== */

export function ValueModal({ s, dispatch }: Props) {
  const selling = s.stage === SELLING && s.harvested;
  return (
    <ModalShell frame="shop" x={178} y={28} title="Value Addition" onClose={() => dispatch({ type: 'close' })}>
      <div className="panel pp-body" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        {!selling ? (
          <Empty s={s} dispatch={dispatch} {...notSellingCopy(s)} />
        ) : (
          <>
            <div className="pp-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', flex: 1 }}>
              {PROCESSES.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className="pp-card"
                  style={{ alignItems: 'stretch', justifyContent: 'space-between' }}
                  onClick={() => {
                    dispatch({ type: 'process', id: p.id });
                    go(dispatch, { kind: 'process' });
                  }}
                  aria-label={`Select ${p.name}`}
                >
                  <Info term={p.id} nested size={14} className="info-corner" />
                  <span className="pp-row">
                    <Img src={p.icon} w={30} h={28} alt="" style={{ flexShrink: 0 }} />
                    <span className="pp-name" style={{ fontSize: 'var(--text-subhead)' }}>{p.name}</span>
                  </span>
                  <span className="pp-sub" style={{ lineHeight: 1.35 }}>{p.blurb}</span>
                  <span className="pp-facts">
                    <span className="pp-fact"><span>CO₂e</span><span>{PROCESS_CO2[p.id] ? `${p.id === 'processing' && hasSolar(s) ? 0.2 : PROCESS_CO2[p.id]} kg/bag` : 'None'}</span></span>
                    <span className="pp-fact"><span>Cost</span><span><Coin size={14} /> {money(p.cost)}</span></span>
                  </span>
                  <span className="pp-btn" aria-hidden="true">
                    Choose · <span className="pp-good">+{p.profitIncrease}% price</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="pp-row" style={{ justifyContent: 'space-between' }}>
              <p className="pp-sub" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Img src={img.idea} w={14} h={14} /> {TIP}
              </p>
              <button type="button" className="pp-text-btn" onClick={() => dispatch({ type: 'completeSale', processId: null })}>
                Sell as grain
              </button>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Select process (preview)                                             */
/* ================================================================== */

export function ProcessModal({ s, dispatch }: Props) {
  const p = PROCESSES.find(x => x.id === s.processId)!;
  const selling = s.stage === SELLING && s.harvested;
  const q = saleQuote(s, p.id);
  const plain = saleQuote(s, null);
  return (
    <ModalShell frame="shop" x={178} y={28} title="Select Process" onClose={() => dispatch({ type: 'close' })}>
      <div className="panel pp-body" style={{ left: 213, top: 78, width: 446, height: 254, flexDirection: 'row', gap: 16 }}>
        {!selling ? (
          <Empty s={s} dispatch={dispatch} {...notSellingCopy(s)} />
        ) : (
          <>
            <div style={{ width: 206, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="pp-row">
                <span style={{ width: 72, height: 72, borderRadius: 'var(--radius-md)', background: 'var(--brown-05)', border: '1px solid var(--brown-20)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Img src={img.cornPreview} w={56} h={56} alt="Maize" />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column' }}>
                  <span className="pp-label">After {p.name.toLowerCase()}</span>
                  <span className="pp-h">Maize</span>
                </span>
              </div>
              <div>
                <p className="pp-sub">Potential price increase</p>
                <p className="pp-hero pp-good" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Coin size={20} /> +{p.profitIncrease}%
                </p>
              </div>
              <p className="pp-sub">
                <b style={{ color: 'var(--ink)' }}>{money(q.revenue)}</b> against {money(plain.revenue)} as plain grain
              </p>
              <GoldButton className="pp-main" style={{ marginTop: 'auto', width: '100%' }} onClick={() => dispatch({ type: 'completeSale', processId: p.id })}>
                Confirm and sell
              </GoldButton>
            </div>
            <div className="pp-card" style={{ flex: 1, overflow: 'hidden', background: 'rgba(255,255,255,0.35)', border: 0, padding: 12 }}>
              <button type="button" className="pp-text-btn" style={{ alignSelf: 'flex-start', minHeight: 24, padding: 0 }} onClick={() => go(dispatch, { kind: 'value' })}>
                ‹ Choose another process
              </button>
              <Cast id="guide" w={120} h={108} alt="Farming guide" backdrop="none" style={{ alignSelf: 'center' }} />
              <p className="pp-name" style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 'auto' }}>
                <Img src={img.idea} w={14} h={14} /> Real world tip
              </p>
              <p className="pp-sub">{TIP}</p>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Harvest info                                                          */
/* ================================================================== */

const grade = (quality: number) => (quality >= 5 ? 'Grade 1' : quality >= 4 ? 'High' : quality >= 3 ? 'Medium' : 'Low');

export function InfoModal({ s, dispatch }: Props) {
  const health = cropHealth(s);
  const est = expectedHarvest(s, s.harvestChoice);
  const now = nextAction(s);
  const rows: [string, ReactNode][] = [
    ['Profit at market', <><Coin size={14} /> {money(profitPerBag(s.prices))}/bag</>],
    [s.harvested ? 'Bags harvested' : 'Expected harvest', `${s.harvested?.bags ?? est.bags} bags`],
    ['Farm size', '1 acre'],
    ['Crop health', health === null ? 'Not planted yet' : <><Stars value={Math.max(1, Math.round(1 + 4 * health))} size={12} /> {Math.round(health * 100)}%</>],
    ['Grade of produce', s.harvested ? grade(s.harvested.quality) : health === null ? '—' : `${grade(est.quality)} (expected)`],
  ];
  return (
    <ModalShell frame="shop" x={178} y={28} title="Harvest Info" onClose={() => dispatch({ type: 'close' })}>
      <div className="panel pp-body" style={{ left: 213, top: 78, width: 446, height: 254, flexDirection: 'row', gap: 16 }}>
        <div className="pp-card" style={{ width: 176, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Img src={img.corn} w={120} h={89} alt="Maize" />
          <div style={{ textAlign: 'center' }}>
            <p className="pp-h">Maize</p>
            <p className="pp-sub">Season {s.season} · Day {s.day}</p>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="pp-facts">
            {rows.map(([k, v]) => (
              <div key={k} className="pp-fact" style={{ minHeight: 32 }}>
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
          <GoldButton className="pp-main" style={{ marginTop: 'auto', width: '100%' }} onClick={() => go(dispatch, now.modal)}>
            Next: {now.label}
          </GoldButton>
        </div>
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Season results (the Figma "Outcome comparison")                      */
/* ================================================================== */

const STEP_LESSON: Record<string, [string, string]> = {
  landprep: ['Prepare the land well', 'Poorly prepared soil holds less water and gives weaker roots.'],
  planting: ['Plant carefully', 'An uneven stand leaves gaps that never yield.'],
  fertilizer: ['Feed your crop', 'Maize without enough nutrients grows small cobs.'],
  pesticides: ['Protect your crop', 'Weeds and armyworm can take a large share of the harvest.'],
  water: ['Water at the right time', 'Dry weeks at tasseling cut yield the most.'],
};

function lessonsFor(r: SeasonResult) {
  const out: { title: string; body: string }[] = [];
  const weak = GROWING_STEPS.map(id => [id, r.stepScores[id] ?? 0] as [StepId, number])
    .filter(([, v]) => v < 1)
    .sort((a, b) => a[1] - b[1]);
  for (const [id, v] of weak.slice(0, 2)) {
    const [title, body] = STEP_LESSON[id];
    out.push({ title, body: `You did ${Math.round(v * 100)}% of the recommended ${STEPS[stepIndex(id)].label.toLowerCase()} work. ${body}` });
  }
  if (r.choice === 'now') out.push({ title: 'Harvest timing', body: 'Harvesting at once cost about 15% of the yield. A short wait pays.' });
  else if (r.choice === 'week') out.push({ title: 'Harvest timing', body: 'Waiting a week over-ripened the crop.' });
  else out.push({ title: 'Harvest timing', body: 'Waiting two days gave the best yield and quality.' });
  const lost = r.bagsHarvested - r.bagsSold;
  if (out.length < 3) out.push({ title: 'Storage', body: lost > 0 ? `${lost} bags spoiled or were stolen. A guarded co-op warehouse, locks and good sorting help.` : 'Good storage: almost nothing spoiled.' });
  if (out.length < 3) out.push({ title: 'Market timing is key', body: 'Selecting when demand is high maximizes your profit.' });
  return out.slice(0, 3);
}

function aiAnswer(r: SeasonResult, question: string) {
  const lessons = lessonsFor(r);
  const lead = /why|reduce|low|bad|less/i.test(question) ? 'Most likely causes this season: ' : 'What mattered most this season: ';
  return lead + lessons.map(l => l.body.replace(/\.$/, '')).join('; ') + '.';
}

export function OutcomeModal({ s, dispatch }: Props) {
  const r = s.history[s.farmView];
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const latest = s.farmView === s.history.length - 1;
  const firstShown = Math.max(0, s.history.length - 6);

  return (
    <ModalShell frame="wide" x={206} y={32} title="Season results" onClose={() => dispatch({ type: 'close' })}>
      {s.history.length > 0 && (
        <TextSidebar
          label="Seasons"
          items={s.history.slice(firstShown).map((h, i) => ({ id: firstShown + i, label: `Season ${h.season}` }))}
          active={s.farmView}
          onPick={index => {
            dispatch({ type: 'farm', index });
            setAnswer(null);
          }}
          style={{ left: 92, top: 67, width: 104, height: 278 }}
        />
      )}
      <div className="panel pp-body" style={{ left: 233, top: 74, width: 598, height: 268, flexDirection: 'row', gap: 16, padding: 16 }}>
        {!r ? (
          <Empty s={s} dispatch={dispatch} title="No harvest yet" body="Your results appear here after your first harvest and sale." />
        ) : (
          <>
            {/* the season in one number, then the facts behind it */}
            <div style={{ width: 196, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <img src={img.farmPhoto} alt="Farm Moja" style={{ display: 'block', width: 196, height: 52, objectFit: 'cover', borderRadius: 'var(--radius-md)' }} />
              <div>
                <p className="pp-label">Season {r.season} · Farm Moja · profit</p>
                <p className={`pp-hero ${r.profit >= 0 ? 'pp-good' : 'pp-bad'}`}>
                  {r.profit >= 0 ? '+' : '−'}
                  {money(Math.abs(r.profit))}
                </p>
                <p className="pp-sub">
                  {money(r.revenue)} sold, {money(r.spend)} spent
                </p>
              </div>
              <div className="pp-facts">
                <div className="pp-fact"><span>Yield</span><span><Img src={img.yieldIcon} w={14} h={14} /> {r.bagsHarvested} bags ({r.bagsSold} sold)</span></div>
                <div className="pp-fact"><span>Quality</span><span><Stars value={r.quality} size={12} /></span></div>
                <div className="pp-fact"><span>Crop health</span><span>{Math.round(r.health * 100)}%</span></div>
              </div>
              {latest && s.stage === SOLD ? (
                <GoldButton className="pp-main is-small" style={{ marginTop: 'auto' }} onClick={() => dispatch({ type: 'newSeason' })}>
                  Start season {s.season + 1}
                </GoldButton>
              ) : (
                <button type="button" className="pp-btn" style={{ marginTop: 'auto' }} onClick={() => dispatch({ type: 'close' })}>
                  Back to the farm
                </button>
              )}
            </div>

            {/* three lessons, and TemoLima AI under them rather than in a third narrow column */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="pp-row" style={{ justifyContent: 'space-between', minHeight: 20 }}>
                <p className="pp-label">{answer ? 'TemoLima AI' : 'Lessons learned'}</p>
                {answer && (
                  <button type="button" className="pp-text-btn" style={{ minHeight: 20 }} onClick={() => setAnswer(null)}>
                    ‹ Lessons
                  </button>
                )}
              </div>
              {answer ? (
                <p className="pp-sub" style={{ display: 'flex', gap: 8, color: 'var(--ink)' }}>
                  <Img src={img.aiBot} w={16} h={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{answer}</span>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {lessonsFor(r).map(l => (
                    <div key={l.title} className="pp-lesson">
                      <p className="pp-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Img src={img.idea} w={14} h={14} /> {l.title}
                      </p>
                      <p className="pp-sub" style={{ lineHeight: 1.3 }}>{l.body}</p>
                    </div>
                  ))}
                </div>
              )}
              <form
                className="pp-ask"
                style={{ marginTop: 'auto' }}
                onSubmit={e => {
                  e.preventDefault();
                  setAnswer(aiAnswer(r, question || 'why did my maize productivity reduce'));
                }}
              >
                <Img src={img.aiBot} w={16} h={16} />
                <input id="ai-question" aria-label="Ask TemoLima AI about this season" placeholder="Ask TemoLima AI: why did my yield drop?" value={question} onChange={e => setQuestion(e.target.value)} />
                <button type="submit" className="pp-btn">
                  Ask
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Rewards & Discounts Hub                                              */
/* ================================================================== */

const hm = (sec: number) => `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;

export function RewardsModal({ s, dispatch }: Props) {
  const played = Math.min(1, s.playSeconds / (PLAY_GOAL_HOURS * 3600));
  return (
    <>
      <ModalShell frame="tall" x={130} y={4} title="Rewards & Discounts" label="Rewards & Discounts Hub" onClose={() => dispatch({ type: 'close' })}>
        <div className="panel pp-body" style={{ left: 170, top: 58, width: 530, height: 300, padding: 16, gap: 12 }}>
          <div className="pp-row" style={{ gap: 12, alignItems: 'stretch' }}>
            <span style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: '#cfe6b0', overflow: 'hidden', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {s.farmer ? <FarmerPortrait look={LOOKS[s.farmer.look] ?? LOOKS[0]} size={46} /> : <Cast id="ojuok" w={48} h={48} alt="Ojuok" />}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, flex: 1 }}>
              <span className="pp-h">{s.farmer?.name ?? 'Ojuok'}</span>
              {/* the play goal: one bar above the grid */}
              <span className="pp-row">
                <span className="pp-bar" role="img" aria-label={`${Math.round(played * 100)}% of the ${PLAY_GOAL_HOURS}-hour goal`}>
                  <i style={{ width: `${Math.max(1, played * 100)}%` }} />
                </span>
                <span className="pp-sub" style={{ whiteSpace: 'nowrap' }}>
                  <b style={{ color: 'var(--ink)' }}>{hm(s.playSeconds)}</b> of {PLAY_GOAL_HOURS}h played
                </span>
              </span>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', paddingLeft: 12, borderLeft: '1px solid var(--brown-10)' }}>
              <span className="pp-h" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Img src={img.coinBig} w={16} h={16} /> {fmt(s.points)} pts
              </span>
              <span className="pp-cap">+100 a farming step, +5 a bag sold</span>
            </span>
          </div>

          <div className="pp-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 'auto' }}>
            {REWARDS.map(r => {
              const done = s.redeemed.includes(r.id);
              const short = s.points < r.cost;
              const sponsor = brandOf(REWARD_SPONSOR[r.id]);
              return (
                <div key={r.id} className={`pp-card${done ? ' is-on' : ''}`} style={{ height: 102, justifyContent: 'space-between' }}>
                  <span className="pp-row">
                    <Img src={r.icon} w={30} h={30} alt="" style={{ flexShrink: 0 }} />
                    <span className="pp-name">{r.name}</span>
                  </span>
                  <span className="pp-cap" style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', minWidth: 0 }}>
                    <b className="pp-good">{r.off}% off</b>
                    {sponsor && (
                      <button type="button" className="sponsor-line is-tiny" style={{ minWidth: 0, overflow: 'hidden' }} onClick={() => openOffer(dispatch, 'rewards', REWARD_SPONSOR[r.id]!)} aria-label={`${r.name} with ${sponsor.name}: see the offer`}>
                        <BrandMark b={sponsor} size={14} />
                        <b style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{sponsor.name}</b>
                      </button>
                    )}
                  </span>
                  <button
                    type="button"
                    className={`pp-btn${done ? ' is-on' : ''}`}
                    disabled={done}
                    style={{ opacity: short && !done ? 0.55 : 1 }}
                    onClick={() => dispatch({ type: 'redeem', id: r.id })}
                    aria-label={done ? `${r.name} redeemed` : `Redeem ${r.name} for ${r.cost} points`}
                  >
                    {done ? 'Redeemed ✓' : short ? `Needs ${fmt(r.cost)} pts` : `Redeem · ${fmt(r.cost)} pts`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </ModalShell>
      {/* the guide stands beside the panel, never over a button */}
      <Cast id="guide" w={150} h={140} backdrop="none" style={{ position: 'absolute', left: 716, top: 200, pointerEvents: 'none', animation: 'pop 0.25s ease both' }} />
    </>
  );
}
