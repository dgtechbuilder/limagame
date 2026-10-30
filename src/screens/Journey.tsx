import { useMemo, useState, type CSSProperties, type Dispatch, type ReactNode } from 'react';
import { img } from '../assets';
import { EditIcon, InfoDot } from '../components/Icons';
import { ModalShell, TextSidebar } from '../components/Modal';
import { Coin, GoldButton, Img, Stars, fmt } from '../components/ui';
import {
  FARM_OUTCOMES,
  HARVEST_CHOICES,
  LESSONS,
  PROCESSES,
  REWARDS,
  STORAGE_OPTIONS,
  TIMELINE,
  TIP,
} from '../data';
import type { Action, GameState, Modal } from '../state';

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

/* ================================================================== */
/* Sale of produce                                                      */
/* ================================================================== */

export function SaleModal({ dispatch }: Props) {
  const [v, setV] = useState({ farmgate: 12, market: 24, transport: 24, storage: 24 });
  const kg = 10;
  // Illustrative formula, chosen so the design's sample values give its "20/bag".
  const profit = Math.max(0, Math.round(((v.market - v.farmgate) * kg) / 6));
  const warn = v.farmgate >= v.market;
  const fields: { key: keyof typeof v; label: string; info?: boolean }[] = [
    { key: 'farmgate', label: 'Farmgate Price', info: true },
    { key: 'market', label: 'Market price' },
    { key: 'transport', label: 'Transportation cost' },
    { key: 'storage', label: 'Storage cost' },
  ];

  return (
    <ModalShell frame="wide" x={116} y={32} title="Sale of produce" close={[714, 46]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 138, top: 72, width: 602, height: 270 }}>
        <div style={box({ left: 10, top: 12, width: 218, height: 247, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 45, padding: '24px 35px' })}>
          <Img src={img.corn} w={136} h={101} alt="Maize" />
          <p style={{ fontSize: 14, fontWeight: 600 }}>Maize</p>
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
                    <input
                      inputMode="numeric"
                      value={v[f.key]}
                      aria-label={f.label}
                      onChange={e => setV({ ...v, [f.key]: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                    />
                  </span>
                  <EditIcon size={20} />
                </span>
              </label>
            ))}
          </div>
          <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Row label="Kg amount">{kg} kg</Row>
            <span className="hair" />
            <Row label="Profit">
              <Coin size={14} /> {profit}/bag
            </Row>
          </div>
          <p style={{ fontSize: 11, color: warn ? '#c0392b' : undefined }}>Farmgate Price - always Lower than Market</p>
          <GoldButton font={10} height={29} onClick={() => go(dispatch, { kind: 'storage' })}>
            Continue
          </GoldButton>
        </div>
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Storage                                                              */
/* ================================================================== */

export function StorageModal({ s, dispatch }: Props) {
  return (
    <ModalShell frame="shop" x={178} y={28} title="Storage" close={[633, 56]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        <p className="section-title" style={{ position: 'absolute', left: 0, right: 0, top: 8 }}>
          Select how to store your crops
        </p>
        <div style={{ position: 'absolute', left: 24, top: 34, width: 398, display: 'flex', gap: 10 }}>
          {STORAGE_OPTIONS.map(o => {
            const on = s.storage === o.id;
            return (
              <div key={o.id} className="card" style={{ flex: 1, height: 208, padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <Img src={o.icon} w={o.iconSize[0]} h={o.iconSize[1]} alt="" />
                <p style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', lineHeight: 1.45 }}>{o.name}</p>
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Row size={8} label="Cost">
                    <Coin size={14} /> {o.cost}
                  </Row>
                  <span className="hair" />
                  <Row size={8} label="Spoilage risk">{o.spoilage}</Row>
                  <span className="hair" />
                  <Row size={8} label="Time to market">{o.time}</Row>
                </div>
                <GoldButton
                  selected={on}
                  style={{ width: '100%', height: 20 }}
                  onClick={() => {
                    dispatch({ type: 'storage', id: o.id });
                    go(dispatch, { kind: 'value' });
                  }}
                  ariaLabel={on ? `${o.name} selected` : `Select ${o.name}`}
                >
                  {on ? 'Selected' : 'Select'}
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
/* Harvest timing                                                        */
/* ================================================================== */

export function TimingModal({ s, dispatch }: Props) {
  const choice = HARVEST_CHOICES.find(c => c.id === s.harvestChoice)!;
  return (
    <ModalShell frame="tall" x={130} y={2} title="Harvest timing" close={[675, 26]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 170, top: 52, width: 530, height: 306 }}>
        {/* Crop progress */}
        <div style={box({ left: 6, top: 12, width: 78, height: 40, border: 0, background: 'rgba(255,255,255,0.35)' })}>
          <Img src={img.timingMaize} w={32} h={32} style={{ margin: '4px auto 0' }} alt="Maize" />
        </div>
        <p style={{ position: 'absolute', left: 9, top: 62, fontSize: 11, fontWeight: 600 }}>Maize</p>
        <div style={{ position: 'absolute', left: 9, top: 84, width: 221, height: 5, borderRadius: 4, background: 'var(--brown-10)' }}>
          <div style={{ width: '70%', height: '100%', borderRadius: 4, background: 'linear-gradient(90deg,#ffb35c,#ff8a3d)' }} />
        </div>
        <p style={{ position: 'absolute', left: 239, top: 80, fontSize: 10, fontWeight: 600 }}>70%</p>
        <p style={{ position: 'absolute', left: 9, top: 98, width: 250, fontSize: 8, lineHeight: 1.5 }}>
          Your crop is maturing. Harvest at the right time for best yield and quantity.
        </p>

        {/* Potential outcome */}
        <div style={box({ left: 272, top: 12, width: 250, height: 108, border: 0, background: 'rgba(255,255,255,0.35)', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 })}>
          <p style={{ fontSize: 9, fontWeight: 600, textAlign: 'center' }}>Potential outcome</p>
          <Row size={8} label="Yield">
            <Img src={img.yieldIcon} w={14} h={14} /> {choice.yieldBags} bags
          </Row>
          <span className="hair" />
          <Row size={8} label="Quality">
            <Stars value={choice.quality} size={11} />
          </Row>
          <span className="hair" />
          <Row size={8} label="Time to market">
            <span style={{ maxWidth: 80, textAlign: 'left', lineHeight: 1.35 }}>{choice.note}</span>
          </Row>
        </div>

        {/* Timeline */}
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

        {/* Choices */}
        <div style={{ position: 'absolute', left: 10, top: 216, width: 513, display: 'flex', gap: 12 }}>
          {HARVEST_CHOICES.map(c => {
            const on = c.id === s.harvestChoice;
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
                  gap: 3,
                  borderColor: on ? 'rgba(107,64,43,0.45)' : undefined,
                  background: on ? 'rgba(107,64,43,0.1)' : undefined,
                }}
              >
                <Img src={c.icon} w={c.iconSize[0]} h={c.iconSize[1]} style={{ height: 25 }} />
                <p style={{ fontSize: 11, fontWeight: 600 }}>{c.label}</p>
                <GoldButton
                  selected={on}
                  style={{ width: '100%', height: 17, marginTop: 'auto' }}
                  onClick={() => {
                    dispatch({ type: 'harvest', choice: c.id });
                    go(dispatch, { kind: 'sale' });
                  }}
                  ariaLabel={on ? `${c.label} selected` : `Select ${c.label}`}
                >
                  {on ? 'Selected' : 'Select'}
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
  return (
    <ModalShell frame="shop" x={178} y={28} title="Value Addition" close={[633, 56]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        <div style={{ position: 'absolute', left: 16, top: 8, width: 414, display: 'flex', gap: 11, alignItems: 'center' }}>
          {PROCESSES.map(p => {
            const on = p.id === s.processId;
            return (
              <div key={p.id} className="card" style={{ flex: 1, height: p.step === 2 ? 187 : 182, padding: '8px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <Img src={p.icon} w={p.iconSize[0]} h={p.iconSize[1]} alt="" />
                <p style={{ fontSize: 11, fontWeight: 700, marginTop: 8 }}>
                  {p.step}. {p.name}
                </p>
                <p style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.45, minHeight: 23, opacity: 0.85 }}>{p.blurb}</p>
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Row size={8} label="Time">
                    <Img src={img.clock} w={14} h={14} /> {p.time}
                  </Row>
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
                  ariaLabel={`Select ${p.name}${on ? ' (current choice)' : ''}`}
                >
                  Select
                </GoldButton>
              </div>
            );
          })}
        </div>
        <div style={box({ left: 15, top: 199, width: 415, height: 47, border: 0, background: 'rgba(255,255,255,0.35)', padding: '6px 9px' })}>
          <Tip style={{ width: 330 }} />
          <Img src={img.guide} w={52} h={48} style={{ position: 'absolute', right: 10, bottom: 0, objectFit: 'cover', objectPosition: 'top' }} alt="" />
        </div>
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Select process (preview)                                             */
/* ================================================================== */

export function ProcessModal({ s, dispatch }: Props) {
  const p = PROCESSES.find(x => x.id === s.processId)!;
  return (
    <ModalShell frame="shop" x={178} y={28} title="Select Process" close={[633, 56]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        <p className="section-title" style={{ position: 'absolute', left: 0, right: 0, top: 4 }}>Preview</p>
        <div style={box({ left: 16, top: 20, width: 201, height: 116, display: 'grid', placeItems: 'center' })}>
          <Img src={img.cornPreview} w={87} h={87} alt="Maize" />
        </div>
        <div style={{ position: 'absolute', left: 16, top: 148 }}>
          <p style={{ fontSize: 8, fontWeight: 500, opacity: 0.8 }}>After {p.name}</p>
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>Maize</p>
          <p style={{ fontSize: 8, opacity: 0.7, marginTop: 4 }}>Potential profit increase</p>
          <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--green-text)', marginTop: 4 }}>
            <Coin size={14} /> + {p.profitIncrease}%
          </p>
        </div>
        <GoldButton
          font={10}
          height={27}
          style={{ position: 'absolute', left: 16, top: 218, width: 201 }}
          onClick={() => {
            dispatch({ type: 'toast', text: `${p.name} started · profit +${p.profitIncrease}%` });
            go(dispatch, { kind: 'outcome' });
          }}
        >
          Confirm
        </GoldButton>
        <div style={box({ left: 228, top: 20, width: 202, height: 225, overflow: 'hidden' })}>
          <Img src={img.guide} w={148} h={132} alt="Farming guide" style={{ position: 'absolute', left: 50, top: 46 }} />
          <Tip style={{ position: 'absolute', left: 9, top: 157, width: 185 }} />
        </div>
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Harvest info                                                          */
/* ================================================================== */

export function InfoModal({ dispatch }: Props) {
  const rows: [string, ReactNode][] = [
    ['Profit', <><Coin size={14} /> 20/bag</>],
    ['Number of kgs', '10 kg'],
    ['Amount of acres', '12'],
    ['Health % of harvest', <Stars value={4} size={11} />],
    ['Grade of produce', 'High'],
  ];
  return (
    <ModalShell frame="shop" x={178} y={28} title="Harvest Info" close={[633, 56]} onClose={() => dispatch({ type: 'close' })}>
      <div className="panel" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        <div style={box({ left: 17, top: 13, width: 200, height: 228, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 45, padding: '0 0 22px' })}>
          <Img src={img.corn} w={136} h={101} alt="Maize" />
          <p style={{ fontSize: 14, fontWeight: 600 }}>Maize</p>
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
        <GoldButton font={10} height={27} style={{ position: 'absolute', left: 235, top: 207, width: 189 }} onClick={() => go(dispatch, { kind: 'sale' })}>
          Sell More
        </GoldButton>
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Outcome comparison (titled "Farming Steps" in the design)            */
/* ================================================================== */

function aiAnswer(farm: (typeof FARM_OUTCOMES)[number], question: string) {
  const q = question.toLowerCase();
  const parts: string[] = [];
  if (farm.harvestChoice === 'Wait 1 week') parts.push('you waited a week, so some cobs over-ripened and lost weight');
  if (farm.harvestChoice === 'Harvest now') parts.push('harvesting early left yield on the table; a 2-day wait usually adds 10–15%');
  if (farm.quality <= 3) parts.push('quality was low, which points to missed fertilizer or watering steps');
  if (!parts.length) parts.push('this farm did well: timing, water and fertilizer were all on track');
  const lead = q.includes('why') || q.includes('reduce') ? 'Likely causes: ' : 'Insight: ';
  return lead + parts.join('; ') + '.';
}

export function OutcomeModal({ s, dispatch }: Props) {
  const farm = FARM_OUTCOMES.find(f => f.id === s.farmView)!;
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const reset = useMemo(() => () => setAnswer(null), []);

  return (
    <ModalShell frame="wide" x={206} y={32} title="Farming Steps" close={[806, 44]} onClose={() => dispatch({ type: 'close' })}>
      <TextSidebar
        label="Farms"
        items={FARM_OUTCOMES.map(f => ({ id: f.id, label: `Farm ${f.id}` }))}
        active={s.farmView}
        onPick={id => {
          dispatch({ type: 'farm', id });
          reset();
        }}
        style={{ left: 112, top: 67, width: 85, height: 278 }}
      />
      <div className="panel" style={{ left: 233, top: 74, width: 598, height: 268 }}>
        {/* Farm summary */}
        <div style={{ position: 'absolute', left: 10, top: 9, width: 192 }}>
          <img src={img.farmPhoto} alt={`Farm ${farm.id}`} style={{ width: 192, height: 75, objectFit: 'cover', borderRadius: 6 }} />
          <p style={{ fontSize: 13, fontWeight: 600, marginTop: 12 }}>Farm {farm.id}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
            <Line label="Crop"><Img src={img.maizeMini} w={14} h={14} /> {farm.crop}</Line>
            <Line label="Harvest choice">{farm.harvestChoice}</Line>
            <Line label="Yield"><Img src={img.yieldIcon} w={14} h={14} /> {farm.yieldBags} bags</Line>
            <Line label="Quality"><Stars value={farm.quality} size={10} /></Line>
            <Line label="Sale value"><Coin size={14} /> {fmt(farm.saleValue)}</Line>
            <Line label="Profit/loss">
              <span style={{ color: farm.profit >= 0 ? 'var(--green-text)' : '#c0392b' }}>
                {farm.profit >= 0 ? '+' : '−'}
                {fmt(Math.abs(farm.profit))}
              </span>
            </Line>
          </div>
          <GoldButton
            font={8}
            height={18}
            style={{ width: 192, marginTop: 14 }}
            onClick={() => dispatch({ type: 'toast', text: `Shared Farm ${farm.id}'s results` })}
          >
            Share my success
          </GoldButton>
        </div>

        {/* Lessons */}
        <div style={box({ left: 212, top: 9, width: 196, height: 258, border: 0, background: 'rgba(255,255,255,0.3)', padding: '10px 11px' })}>
          <p style={{ fontSize: 9, fontWeight: 600, paddingBottom: 8, borderBottom: '0.5px solid var(--brown-20)' }}>Lesson learned</p>
          {LESSONS.map((l, i) => (
            <div key={l.title} style={{ padding: '10px 0', borderBottom: i < LESSONS.length - 1 ? '0.5px solid var(--brown-20)' : undefined }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 600 }}>
                <Img src={img.idea} w={12} h={12} /> {l.title}
              </p>
              <p style={{ fontSize: 8, lineHeight: 1.45, marginTop: 3, opacity: 0.85 }}>{l.body}</p>
            </div>
          ))}
        </div>

        {/* Lima AI tool (answers locally from the farm's data) */}
        <div style={box({ left: 418, top: 9, width: 168, height: 258, border: 0, background: 'rgba(255,255,255,0.3)', padding: '10px 9px' })}>
          <p style={{ fontSize: 9, fontWeight: 600 }}>Lima AI Tool</p>
          <div style={{ marginTop: 12, height: 124, borderRadius: 6, background: 'var(--brown-10)', padding: 6, display: 'flex', gap: 4 }}>
            <Img src={img.aiBot} w={14} h={14} style={{ flexShrink: 0, marginTop: 2 }} />
            {answer ? (
              <p style={{ fontSize: 9, lineHeight: 1.45, overflow: 'auto' }}>{answer}</p>
            ) : (
              <textarea
                aria-label="Ask Lima AI about this farm"
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
            onClick={() => (answer ? (setAnswer(null), setQuestion('')) : setAnswer(aiAnswer(farm, question || 'why did my maize productivity reduce')))}
          >
            {answer ? 'Ask again' : 'Confirm'}
          </GoldButton>
        </div>
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

export function RewardsModal({ s, dispatch }: Props) {
  return (
    <>
      <ModalShell frame="tall" x={130} y={4} title="Rewards & Discounts Hub" titleSize={12} close={[676, 33]} onClose={() => dispatch({ type: 'close' })}>
        <div className="panel" style={{ left: 170, top: 55, width: 530, height: 306 }}>
          {/* Player header */}
          <div style={box({ left: 11, top: 10, width: 65, height: 54, overflow: 'hidden', background: '#fff' })}>
            <Img src={img.rewardAvatar} w={65} h={54} alt="Ojuok" />
          </div>
          <p style={{ position: 'absolute', left: 88, top: 16, fontSize: 11, fontWeight: 600 }}>Ojuok</p>
          <p style={{ position: 'absolute', left: 88, top: 36, fontSize: 8, opacity: 0.8 }}>20h goal</p>
          <Stat left={235} icon={img.clock} label="Total gameplay time" value="18h 45m" />
          <Stat left={385} icon={img.coinBig} label="Available" value={fmt(s.rewardPoints)} />
          <div style={{ position: 'absolute', left: 88, top: 53, width: 333, height: 7, borderRadius: 6, background: 'var(--brown-10)' }}>
            <div style={{ width: '31%', height: '100%', borderRadius: 6, background: 'linear-gradient(90deg,#ff9f2e,#ffc24d)' }} />
          </div>
          <p style={{ position: 'absolute', left: 432, top: 49, fontSize: 10, fontWeight: 600 }}>6h 15m completed</p>

          {/* Rewards grid */}
          <div style={{ position: 'absolute', left: 11, top: 76, width: 512, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 9 }}>
            {REWARDS.map(r => {
              const done = s.redeemed.includes(r.id);
              return (
                <div key={r.id} className="card" style={{ height: 107, padding: '6px 8px 9px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <Img src={r.icon} w={33} h={32} alt="" />
                  <p style={{ fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', marginTop: 4 }}>{r.name}</p>
                  <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8, opacity: 0.85 }}>
                    <Img src={img.coupon} w={16} h={16} /> {r.off}% OFF
                  </p>
                  <GoldButton
                    selected={done}
                    style={{ width: '100%', height: 17, marginTop: 'auto' }}
                    onClick={() => dispatch({ type: 'redeem', id: r.id, name: r.name })}
                    ariaLabel={done ? `${r.name} redeemed` : `Redeem ${r.name}`}
                  >
                    {done ? 'Redeemed' : 'Redeem'}
                  </GoldButton>
                </div>
              );
            })}
          </div>
        </div>
      </ModalShell>
      {/* Guide character outside the frame */}
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
