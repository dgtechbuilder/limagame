import { useState, type CSSProperties, type Dispatch, type ReactNode } from 'react';
import { img } from '../assets';
import { nextAction } from '../components/FarmScene';
import { EditIcon, InfoDot } from '../components/Icons';
import { ModalShell, TextSidebar } from '../components/Modal';
import { Coin, GoldButton, Img, Stars, fmt } from '../components/ui';
import { GROWING_STEPS, HARVEST_CHOICES, PLAY_GOAL_HOURS, PROCESSES, REWARDS, STEPS, STORAGE_OPTIONS, TIMELINE, TIP, type StepId } from '../data';
import {
  SELLING,
  SOLD,
  cropHealth,
  daysToHarvest,
  expectedHarvest,
  profitPerBag,
  saleQuote,
  stepIndex,
  type Action,
  type GameState,
  type Modal,
  type Prices,
  type SeasonResult,
} from '../state';

type Props = { s: GameState; dispatch: Dispatch<Action> };

const go = (dispatch: Dispatch<Action>, modal: Modal) => dispatch({ type: 'open', modal });

const box = (extra?: CSSProperties): CSSProperties => ({
  position: 'absolute',
  background: 'var(--brown-05)',
  border: '1px solid var(--brown-10)',
  borderRadius: 8,
  ...extra,
});

function Row({ label, children, size = 10 }: { label: ReactNode; children: ReactNode; size?: number }) {
  return (
    <div className="kv" style={{ fontSize: size }}>
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function Tip({ style }: { style?: CSSProperties }) {
  return (
    <div style={style}>
      <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}>
        <Img src={img.idea} w={12} h={12} /> Real world tip
      </p>
      <p style={{ fontSize: 8, lineHeight: 1.45, marginTop: 4, opacity: 0.85 }}>{TIP}</p>
    </div>
  );
}

/** Shown in place of a screen's content when the season isn't at that point yet. */
function Empty({ s, dispatch, title, body, style }: Props & { title: string; body: string; style?: CSSProperties }) {
  const now = nextAction(s);
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, textAlign: 'center', ...style }}>
      <Img src={img.cornPreview} w={64} h={64} style={{ opacity: 0.9 }} />
      <p style={{ fontSize: 13, fontWeight: 700 }}>{title}</p>
      <p style={{ fontSize: 10, lineHeight: 1.5, maxWidth: 300, opacity: 0.85 }}>{body}</p>
      <GoldButton font={10} height={26} style={{ width: 180, marginTop: 6 }} onClick={() => go(dispatch, now.modal)}>
        Next task: {now.label}
      </GoldButton>
    </div>
  );
}

const notSellingCopy = (s: GameState) =>
  s.stage === SOLD
    ? { title: 'This season is sold', body: 'Check your season results, then start the next season to farm again.' }
    : { title: 'Nothing to sell yet', body: `Your maize is still growing. It will be ready in about ${daysToHarvest(s)} days if you keep up with the farming steps.` };

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
    const n = Math.min(key === 'market' || key === 'farmgate' ? 60 : 200, Number(raw.replace(/\D/g, '')) || 0);
    dispatch({ type: 'prices', prices: { ...p, [key]: n } });
  };
  const selling = s.stage === SELLING && s.harvested;

  return (
    <ModalShell frame="wide" x={116} y={32} title="Sale of produce" close={[714, 46]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 138, top: 72, width: 602, height: 270 }}>
        {!selling ? (
          <Empty s={s} dispatch={dispatch} {...notSellingCopy(s)} />
        ) : (
          <>
            <div style={box({ left: 10, top: 12, width: 218, height: 247, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 30, padding: '24px 20px' })}>
              <Img src={img.corn} w={136} h={101} alt="Maize" />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 14, fontWeight: 600 }}>Maize</p>
                <p style={{ fontSize: 10, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  {s.harvested!.bags} bags · <Stars value={s.harvested!.quality} size={10} />
                </p>
              </div>
            </div>

            <div style={{ position: 'absolute', left: 253, top: 10, width: 326, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '157px 157px', gap: 8 }}>
                {fields.map(f => (
                  <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 12, fontWeight: 600 }}>
                      {f.info && <InfoDot size={10} />}
                      {f.label}
                    </span>
                    <span className="field-box">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Img src={img.coin20} w={20} h={21} />
                        <input id={`price-${f.key}`} inputMode="numeric" value={p[f.key]} aria-label={f.label} onChange={e => setPrice(f.key, e.target.value)} />
                      </span>
                      <EditIcon size={20} />
                    </span>
                  </label>
                ))}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Row label="Bags to sell">{s.harvested!.bags} bags</Row>
                <span className="hair" />
                <Row label="Profit per bag at market, after costs">
                  <Coin size={14} /> {perBag}/bag
                </Row>
              </div>
              <p style={{ fontSize: 9, color: p.farmgate >= perBag ? '#c0392b' : undefined }}>
                {p.farmgate >= perBag ? 'Selling at the gate pays more right now: ' : 'Market pays more: '}
                {p.farmgate}/bag at your gate vs {perBag}/bag at market
              </p>
              <GoldButton font={10} height={29} onClick={() => go(dispatch, { kind: 'storage' })}>
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
  return (
    <ModalShell frame="shop" x={178} y={28} title="Storage" close={[633, 56]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        {!selling ? (
          <Empty s={s} dispatch={dispatch} {...notSellingCopy(s)} />
        ) : (
          <>
            <p className="section-title" style={{ position: 'absolute', left: 0, right: 0, top: 8 }}>
              Select how to store your crops
            </p>
            <div style={{ position: 'absolute', left: 24, top: 30, width: 398, display: 'flex', gap: 10 }}>
              {STORAGE_OPTIONS.map(o => {
                const on = s.storage === o.id;
                const q = saleQuote({ ...s, storage: o.id }, null);
                return (
                  <div
                    key={o.id}
                    className="card"
                    style={{ flex: 1, height: 214, padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: on ? 'inset 0 0 0 1.5px var(--select-ring)' : undefined }}
                  >
                    <Img src={o.icon} w={o.iconSize[0]} h={o.iconSize[1]} alt="" />
                    <p style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.45 }}>{o.name}</p>
                    <div style={{ width: '100%', background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <Row size={8} label="Cost">
                        <Coin size={14} /> {o.costPerBag ? `${o.costPerBag}/bag` : 'Free'}
                      </Row>
                      <span className="hair" />
                      <Row size={8} label="Spoilage risk">{o.spoilage}</Row>
                      <span className="hair" />
                      <Row size={8} label="Time to market">{o.time}</Row>
                      <span className="hair" />
                      <Row size={8} label="Bags lost">≈ {q.lost}</Row>
                    </div>
                    <GoldButton
                      style={{ width: '100%', height: 20, opacity: on ? 1 : 0.85 }}
                      onClick={() => (on ? go(dispatch, { kind: 'value' }) : dispatch({ type: 'storage', id: o.id }))}
                      ariaLabel={on ? `Continue with ${o.name}` : `Select ${o.name}`}
                    >
                      {on ? 'Continue' : 'Select'}
                    </GoldButton>
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
    <ModalShell frame="tall" x={130} y={2} title="Harvest timing" close={[675, 26]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 170, top: 52, width: 530, height: 306 }}>
        <div style={box({ left: 6, top: 12, width: 78, height: 40, border: 0, background: 'rgba(255,255,255,0.35)' })}>
          <Img src={img.timingMaize} w={32} h={32} style={{ margin: '4px auto 0' }} alt="Maize" />
        </div>
        <p style={{ position: 'absolute', left: 9, top: 62, fontSize: 11, fontWeight: 600 }}>Maize</p>
        <div style={{ position: 'absolute', left: 9, top: 84, width: 221, height: 5, borderRadius: 4, background: 'var(--brown-10)' }}>
          <div style={{ width: `${progress}%`, height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#ffb35c,#ff8a3d)' }} />
        </div>
        <p style={{ position: 'absolute', left: 239, top: 80, fontSize: 10, fontWeight: 600 }}>{progress}%</p>
        <p style={{ position: 'absolute', left: 9, top: 98, width: 250, fontSize: 8, lineHeight: 1.5 }}>
          {ready
            ? 'Your crop is ready. Choose when to harvest: waiting a little can raise yield, waiting too long lowers quality.'
            : s.stage > stepIndex('harvest')
              ? 'This season is already harvested.'
              : `Not ready yet: about ${toGo} days to go. Finish ${current.label} and the steps after it first.`}
        </p>

        <div style={box({ left: 272, top: 12, width: 250, height: 108, border: 0, background: 'rgba(255,255,255,0.35)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 })}>
          <p style={{ fontSize: 9, fontWeight: 600, textAlign: 'center' }}>Potential outcome · {choice.label}</p>
          <Row size={8} label="Yield">
            <Img src={img.yieldIcon} w={14} h={14} /> {out.bags} bags
          </Row>
          <span className="hair" />
          <Row size={8} label="Quality">
            <Stars value={out.quality} size={11} />
          </Row>
          <span className="hair" />
          <Row size={8} label="Crop health">
            {Math.round(out.health * 100)}%
          </Row>
        </div>

        <div style={{ position: 'absolute', left: 9, top: 144, width: 513, height: 7, borderRadius: 6, background: 'linear-gradient(90deg,#ffb23f 0%,#ffc35e 28%,#ffd88f 50%,#f3e3c8 68%,#e8ded3 100%)' }} />
        {TIMELINE.map((t, i) => {
          const cx = [72, 223, 361, 483][i];
          return (
            <div key={t.week} style={{ position: 'absolute', left: cx - 50, top: 136, width: 100, textAlign: 'center' }}>
              <Img src={t.star} w={24} h={24} style={{ margin: '-3px auto 0' }} />
              <p style={{ fontSize: 10, fontWeight: 600, marginTop: 7 }}>{t.week}</p>
              <p style={{ fontSize: 8, whiteSpace: 'pre-line', lineHeight: 1.35, marginTop: 1, opacity: 0.85 }}>{t.note}</p>
            </div>
          );
        })}

        <div style={{ position: 'absolute', left: 10, top: 216, width: 513, display: 'flex', gap: 12 }}>
          {HARVEST_CHOICES.map(c => {
            const on = c.id === s.harvestChoice;
            const est = expectedHarvest(s, c.id);
            return (
              <div
                key={c.id}
                className="card"
                style={{
                  flex: 1,
                  height: 74,
                  padding: '6px 8px 7px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  borderColor: on ? 'rgba(107,64,43,0.45)' : undefined,
                  background: on ? 'rgba(107,64,43,0.1)' : undefined,
                }}
              >
                <Img src={c.icon} w={c.iconSize[0]} h={c.iconSize[1]} style={{ height: 22 }} />
                <p style={{ fontSize: 11, fontWeight: 600 }}>
                  {c.label} <span style={{ fontSize: 8, fontWeight: 500, opacity: 0.75 }}>· {est.bags} bags</span>
                </p>
                <GoldButton
                  selected={!ready && on}
                  style={{ width: '100%', height: 17, marginTop: 'auto', opacity: ready || on ? 1 : 0.7 }}
                  onClick={() => (!ready ? dispatch({ type: 'chooseHarvest', choice: c.id }) : on ? dispatch({ type: 'harvest' }) : dispatch({ type: 'chooseHarvest', choice: c.id }))}
                  ariaLabel={ready && on ? `Harvest: ${c.label}` : `Select ${c.label}`}
                >
                  {ready && on ? 'Harvest' : on ? 'Selected' : 'Select'}
                </GoldButton>
              </div>
            );
          })}
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
    <ModalShell frame="shop" x={178} y={28} title="Value Addition" close={[633, 56]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        {!selling ? (
          <Empty s={s} dispatch={dispatch} {...notSellingCopy(s)} />
        ) : (
          <>
            <div style={{ position: 'absolute', left: 16, top: 8, width: 414, display: 'flex', gap: 11, alignItems: 'center' }}>
              {PROCESSES.map(p => (
                <div key={p.id} className="card" style={{ flex: 1, height: p.step === 2 ? 187 : 182, padding: '8px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <Img src={p.icon} w={p.iconSize[0]} h={p.iconSize[1]} alt="" />
                  <p style={{ fontSize: 11, fontWeight: 700, marginTop: 8 }}>
                    {p.step}. {p.name}
                  </p>
                  <p style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.45, minHeight: 23, opacity: 0.85 }}>{p.blurb}</p>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Row size={8} label="Price boost">+{p.profitIncrease}%</Row>
                    <span className="hair" />
                    <Row size={8} label="Cost">
                      <Coin size={14} /> {p.cost}
                    </Row>
                  </div>
                  <GoldButton
                    style={{ width: '100%', height: 19, marginTop: 'auto' }}
                    onClick={() => {
                      dispatch({ type: 'process', id: p.id });
                      go(dispatch, { kind: 'process' });
                    }}
                    ariaLabel={`Select ${p.name}`}
                  >
                    Select
                  </GoldButton>
                </div>
              ))}
            </div>
            <div style={box({ left: 15, top: 199, width: 415, height: 47, border: 0, background: 'rgba(255,255,255,0.35)', padding: '6px 9px' })}>
              <Tip style={{ width: 270 }} />
              <button
                type="button"
                onClick={() => dispatch({ type: 'completeSale', processId: null })}
                style={{ position: 'absolute', right: 9, top: 12, fontSize: 9, fontWeight: 700, textDecoration: 'underline', color: 'var(--brown)' }}
              >
                Sell as grain, no processing
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
    <ModalShell frame="shop" x={178} y={28} title="Select Process" close={[633, 56]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        {!selling ? (
          <Empty s={s} dispatch={dispatch} {...notSellingCopy(s)} />
        ) : (
          <>
            <p className="section-title" style={{ position: 'absolute', left: 0, right: 0, top: 4 }}>Preview</p>
            <div style={box({ left: 16, top: 20, width: 201, height: 104, display: 'grid', placeItems: 'center' })}>
              <Img src={img.cornPreview} w={80} h={80} alt="Maize" />
            </div>
            <div style={{ position: 'absolute', left: 16, top: 132, width: 201 }}>
              <p style={{ fontSize: 8, fontWeight: 500, opacity: 0.8 }}>After {p.name}</p>
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>Maize</p>
              <p style={{ fontSize: 8, opacity: 0.7, marginTop: 4 }}>Potential profit increase</p>
              <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--green-text)', marginTop: 2 }}>
                <Coin size={14} /> + {p.profitIncrease}%
              </p>
              <p style={{ fontSize: 8, marginTop: 4, lineHeight: 1.4 }}>
                <b>{fmt(q.revenue)}</b> coins vs {fmt(plain.revenue)} as plain grain
              </p>
            </div>
            <GoldButton font={10} height={27} style={{ position: 'absolute', left: 16, top: 218, width: 201 }} onClick={() => dispatch({ type: 'completeSale', processId: p.id })}>
              Confirm and sell
            </GoldButton>
            <div style={box({ left: 228, top: 20, width: 202, height: 225, overflow: 'hidden' })}>
              <Img src={img.guide} w={148} h={132} alt="Farming guide" style={{ position: 'absolute', left: 50, top: 46 }} />
              <Tip style={{ position: 'absolute', left: 9, top: 157, width: 185 }} />
              <button
                type="button"
                onClick={() => go(dispatch, { kind: 'value' })}
                style={{ position: 'absolute', left: 9, top: 10, fontSize: 9, fontWeight: 700, textDecoration: 'underline', color: 'var(--brown)' }}
              >
                ‹ Choose another process
              </button>
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
    ['Profit at market', <><Coin size={14} /> {profitPerBag(s.prices)}/bag</>],
    [s.harvested ? 'Bags harvested' : 'Expected harvest', `${s.harvested?.bags ?? est.bags} bags`],
    ['Farm size', '1 acre'],
    ['Crop health', health === null ? 'Not planted yet' : <><Stars value={Math.max(1, Math.round(1 + 4 * health))} size={11} /> {Math.round(health * 100)}%</>],
    ['Grade of produce', s.harvested ? grade(s.harvested.quality) : health === null ? '—' : `${grade(est.quality)} (expected)`],
  ];
  return (
    <ModalShell frame="shop" x={178} y={28} title="Harvest Info" close={[633, 56]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        <div style={box({ left: 17, top: 13, width: 200, height: 228, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 36, padding: '0 0 18px' })}>
          <Img src={img.corn} w={136} h={101} alt="Maize" />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 600 }}>Maize</p>
            <p style={{ fontSize: 9, opacity: 0.75, marginTop: 2 }}>Season {s.season} · Day {s.day}</p>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 235, top: 20, width: 189, display: 'flex', flexDirection: 'column' }}>
          {rows.map(([k, v], i) => (
            <div key={k}>
              {i > 0 && <span className="hair" style={{ display: 'block' }} />}
              <div className="kv" style={{ height: 31 }}>
                <span>{k}</span>
                <span>{v}</span>
              </div>
            </div>
          ))}
        </div>
        <GoldButton font={10} height={27} style={{ position: 'absolute', left: 235, top: 207, width: 189 }} onClick={() => go(dispatch, now.modal)}>
          Next: {now.label}
        </GoldButton>
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
  if (r.choice === 'now') out.push({ title: 'Harvest timing', body: 'Harvesting straight away cost you about 15% of the yield. A short wait usually pays.' });
  else if (r.choice === 'week') out.push({ title: 'Harvest timing', body: 'Waiting a week let the crop over-ripen and lowered quality.' });
  else out.push({ title: 'Harvest timing', body: 'Waiting two days gave the best yield and quality.' });
  const lost = r.bagsHarvested - r.bagsSold;
  if (out.length < 3) out.push({ title: 'Storage', body: lost > 0 ? `${lost} bags spoiled in storage. Better storage or sorting cuts losses.` : 'Good storage: almost nothing spoiled.' });
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
    <ModalShell frame="wide" x={206} y={32} title="Season results" close={[806, 44]} onClose={() => dispatch({ type: 'close' })}>
      {s.history.length > 0 && (
        <TextSidebar
          label="Seasons"
          items={s.history.slice(firstShown).map((h, i) => ({ id: firstShown + i, label: `Season ${h.season}` }))}
          active={s.farmView}
          onPick={index => {
            dispatch({ type: 'farm', index });
            setAnswer(null);
          }}
          style={{ left: 104, top: 67, width: 101, height: 278 }}
        />
      )}
      <div className="panel" style={{ left: 233, top: 74, width: 598, height: 268 }}>
        {!r ? (
          <Empty
            s={s}
            dispatch={dispatch}
            title="No harvest yet"
            body="Your results appear here after you harvest and sell your first maize crop: yield, quality, money made and what to do better next time."
          />
        ) : (
          <>
            <div style={{ position: 'absolute', left: 10, top: 9, width: 192 }}>
              <img src={img.farmPhoto} alt="Farm Moja" style={{ width: 192, height: 75, objectFit: 'cover', borderRadius: 6 }} />
              <p style={{ fontSize: 13, fontWeight: 600, marginTop: 10 }}>Season {r.season} · Farm Moja</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                <Line label="Crop"><Img src={img.maizeMini} w={14} h={14} /> Maize · health {Math.round(r.health * 100)}%</Line>
                <Line label="Harvest choice">{HARVEST_CHOICES.find(c => c.id === r.choice)!.label}</Line>
                <Line label="Yield"><Img src={img.yieldIcon} w={14} h={14} /> {r.bagsHarvested} bags ({r.bagsSold} sold)</Line>
                <Line label="Quality"><Stars value={r.quality} size={10} /></Line>
                <Line label="Sale value"><Coin size={14} /> {fmt(r.revenue)}</Line>
                <Line label="Profit/loss">
                  <span style={{ color: r.profit >= 0 ? 'var(--green-text)' : '#c0392b' }}>
                    {r.profit >= 0 ? '+' : '−'}
                    {fmt(Math.abs(r.profit))}
                  </span>
                  <span style={{ fontWeight: 400, opacity: 0.7 }}>after {fmt(r.spend)} spent</span>
                </Line>
              </div>
              {latest && s.stage === SOLD ? (
                <GoldButton font={9} height={20} style={{ width: 192, marginTop: 10 }} onClick={() => dispatch({ type: 'newSeason' })}>
                  Start season {s.season + 1}
                </GoldButton>
              ) : (
                <GoldButton font={9} height={20} style={{ width: 192, marginTop: 10 }} onClick={() => dispatch({ type: 'close' })}>
                  Back to the farm
                </GoldButton>
              )}
            </div>

            <div style={box({ left: 212, top: 9, width: 196, height: 250, border: 0, background: 'rgba(255,255,255,0.3)', padding: '10px 11px' })}>
              <p style={{ fontSize: 9, fontWeight: 600, paddingBottom: 8, borderBottom: '0.5px solid var(--brown-20)' }}>Lesson learned</p>
              {lessonsFor(r).map((l, i) => (
                <div key={l.title} style={{ padding: '8px 0', borderBottom: i < 2 ? '0.5px solid var(--brown-20)' : undefined }}>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}>
                    <Img src={img.idea} w={12} h={12} /> {l.title}
                  </p>
                  <p style={{ fontSize: 8, lineHeight: 1.45, marginTop: 3, opacity: 0.85 }}>{l.body}</p>
                </div>
              ))}
            </div>

            <div style={box({ left: 418, top: 9, width: 168, height: 250, border: 0, background: 'rgba(255,255,255,0.3)', padding: '10px 9px' })}>
              <p style={{ fontSize: 9, fontWeight: 600 }}>Lima AI Tool</p>
              <div style={{ marginTop: 12, height: 150, borderRadius: 6, background: 'var(--brown-10)', padding: 6, display: 'flex', gap: 4 }}>
                <Img src={img.aiBot} w={14} h={14} style={{ flexShrink: 0, marginTop: 2 }} />
                {answer ? (
                  <p style={{ fontSize: 9, lineHeight: 1.45, overflow: 'auto' }}>{answer}</p>
                ) : (
                  <textarea
                    id="ai-question"
                    aria-label="Ask Lima AI about this season"
                    placeholder="Why did my maize productivity reduce?"
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    style={{ flex: 1, resize: 'none', border: 0, background: 'transparent', outline: 'none', font: 'inherit', fontSize: 10, lineHeight: 1.45, color: 'var(--brown)' }}
                  />
                )}
              </div>
              <GoldButton
                height={18}
                style={{ position: 'absolute', left: 9, right: 9, bottom: 10 }}
                onClick={() => (answer ? (setAnswer(null), setQuestion('')) : setAnswer(aiAnswer(r, question || 'why did my maize productivity reduce')))}
              >
                {answer ? 'Ask again' : 'Ask'}
              </GoldButton>
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 8 }}>
      <span style={{ opacity: 0.7, fontWeight: 500 }}>{label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>{children}</span>
    </div>
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
      <ModalShell frame="tall" x={130} y={4} title="Rewards & Discounts Hub" titleSize={12} close={[676, 33]} onClose={() => dispatch({ type: 'close' })}>
        <div className="panel" style={{ left: 170, top: 55, width: 530, height: 306 }}>
          <div style={box({ left: 11, top: 10, width: 65, height: 54, overflow: 'hidden', background: '#fff' })}>
            <Img src={img.rewardAvatar} w={65} h={54} alt="Ojuok" />
          </div>
          <p style={{ position: 'absolute', left: 88, top: 16, fontSize: 11, fontWeight: 600 }}>Ojuok</p>
          <p style={{ position: 'absolute', left: 88, top: 36, fontSize: 8, opacity: 0.8 }}>
            Earn points: +100 per farming step, +5 per bag sold
          </p>
          <Stat left={235} icon={img.clock} label={`Played · goal ${PLAY_GOAL_HOURS}h`} value={hm(s.playSeconds)} />
          <Stat left={385} icon={img.coinBig} label="Points available" value={fmt(s.points)} />
          <div style={{ position: 'absolute', left: 88, top: 53, width: 333, height: 7, borderRadius: 6, background: 'var(--brown-10)' }}>
            <div style={{ width: `${Math.max(1, played * 100)}%`, height: '100%', borderRadius: 6, background: 'linear-gradient(90deg,#ff9f2e,#ffc24d)' }} />
          </div>
          <p style={{ position: 'absolute', left: 432, top: 49, fontSize: 10, fontWeight: 600 }}>{Math.round(played * 100)}% of goal</p>

          <div style={{ position: 'absolute', left: 11, top: 76, width: 512, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
            {REWARDS.map(r => {
              const done = s.redeemed.includes(r.id);
              const short = s.points < r.cost;
              return (
                <div key={r.id} className="card" style={{ height: 107, padding: '6px 8px 9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <Img src={r.icon} w={33} h={32} alt="" />
                  <p style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', marginTop: 4 }}>{r.name}</p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, opacity: 0.85 }}>
                    <Img src={img.coupon} w={16} h={16} /> {r.off}% OFF
                  </p>
                  <GoldButton
                    selected={done}
                    style={{ width: '100%', height: 17, marginTop: 'auto', opacity: short && !done ? 0.6 : 1 }}
                    onClick={() => dispatch({ type: 'redeem', id: r.id })}
                    ariaLabel={done ? `${r.name} redeemed` : `Redeem ${r.name} for ${r.cost} points`}
                  >
                    {done ? 'Redeemed' : `Redeem · ${fmt(r.cost)} pts`}
                  </GoldButton>
                </div>
              );
            })}
          </div>
        </div>
      </ModalShell>
      <div className="abs" style={{ left: 711, top: 63, width: 163, height: 182, pointerEvents: 'none', animation: 'pop 0.25s ease both' }}>
        <Img src={img.guide} w={156} h={145} alt="" style={{ marginLeft: 10 }} />
        <div className="speech" style={{ left: 22, top: 94, width: 118, height: 82 }}>
          <img src={img.tipBubble} alt="" />
          <span style={{ width: 90, fontSize: 9, padding: '10px 0 0' }}>Keep playing to unlock more rewards</span>
        </div>
      </div>
    </>
  );
}

function Stat({ left, icon, label, value }: { left: number; icon: string; label: string; value: string }) {
  return (
    <div style={box({ left, top: 10, width: 139, height: 36, border: 0, background: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px' })}>
      <Img src={icon} w={21} h={20} />
      <div>
        <p style={{ fontSize: 8, opacity: 0.8 }}>{label}</p>
        <p style={{ fontSize: 11, fontWeight: 600 }}>{value}</p>
      </div>
    </div>
  );
}
