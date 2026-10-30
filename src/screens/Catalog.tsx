import { useState, type Dispatch } from 'react';
import { img } from '../assets';
import { InfoDot, EditIcon } from '../components/Icons';
import { IconSidebar, ModalShell } from '../components/Modal';
import { GoldButton, Img, Partner, PriceChip } from '../components/ui';
import { SHOP_TABS, STEPS, type ShopTab, type StepId } from '../data';
import { isStepComplete, type Action, type GameState } from '../state';

/* ================================================================== */
/* Shop (Figma: Food / Fertilizer / Water tanks / Equipments)          */
/* ================================================================== */

export function ShopModal({ s, tab, dispatch }: { s: GameState; tab: ShopTab; dispatch: Dispatch<Action> }) {
  const def = SHOP_TABS.find(t => t.id === tab)!;
  const close = () => dispatch({ type: 'close' });
  const rows = [def.items.slice(0, 3), def.items.slice(3)].filter(r => r.length);

  return (
    <ModalShell frame="shop" x={178} y={28} title="Shop" close={[633, 56]} onClose={close}>
      <IconSidebar
        label="Shop sections"
        items={SHOP_TABS.map(t => ({ id: t.id, label: t.label, icon: t.icon, iconOn: t.iconOn, size: t.iconSize, sizeOn: t.iconOnSize }))}
        active={tab}
        onPick={id => dispatch({ type: 'open', modal: { kind: 'shop', tab: id as ShopTab } })}
        centerX={145}
        centerY={201}
        gap={16}
      />

      {/* Shopkeeper with a speech bubble that changes per section */}
      <div className="panel" style={{ left: 215, top: 78, width: 197, height: 254, borderRadius: '16px 0 0 16px' }}>
        <img src={img.shopkeeper} alt="Shopkeeper" style={{ width: 197, height: 254 }} />
        <div className="speech" style={{ left: 72, top: 149, width: 125, height: 91 }}>
          <img src={img.bubble} alt="" />
          <span style={{ width: 98, fontSize: 9, padding: '10px 0 0' }}>{def.speech}</span>
        </div>
      </div>

      <div className="panel right-round" style={{ left: 412, top: 78, width: 247, height: 254 }}>
        <div
          style={{
            position: 'absolute',
            left: 14,
            right: 14,
            top: def.id === 'food' ? 6 : 19,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <p className="section-title">{def.title}</p>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 10, alignSelf: ri === 1 && row.length < 3 ? 'flex-start' : 'center', marginLeft: ri === 1 && row.length < 3 ? 2 : 0 }}>
              {row.map(item => {
                const left = item.stock ? s.stock[item.id] ?? 0 : undefined;
                const owned = !item.stock && s.owned.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`card${owned ? ' is-owned' : ''}`}
                    style={{ width: 66, padding: '4px 8px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: left === 0 ? 0.55 : 1 }}
                    onClick={() =>
                      item.stock
                        ? dispatch({ type: 'sell', id: item.id, price: item.price, name: item.name })
                        : dispatch({ type: 'buy', id: item.id, price: item.price, name: item.name })
                    }
                    aria-label={item.stock ? `Sell ${item.name}, ${left} of ${item.stock[1]} bags left, ${item.price} coins each` : `Buy ${item.name} for ${item.price} coins`}
                  >
                    <span style={{ fontSize: def.nameFont, fontWeight: 700, lineHeight: 'normal', textAlign: 'center', ...(def.id === 'fertilizer' ? { maxWidth: 52 } : { whiteSpace: 'nowrap', margin: '0 -8px' }) }}>
                      {item.name}
                    </span>
                    <Img src={item.icon} w={item.iconSize[0]} h={item.iconSize[1]} />
                    {item.stock && (
                      <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.7 }}>
                        {left}/{item.stock[1]}
                      </span>
                    )}
                    <PriceChip price={item.price} width="100%" font={def.priceFont} />
                    <span style={{ position: 'absolute', right: 2, top: 2 }}>
                      <InfoDot size={10} />
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <Partner top={233} />
      </div>
    </ModalShell>
  );
}

/* ================================================================== */
/* Farming Steps (Figma: Land Prep / Planting / Fertilizer /           */
/* Pesticides / Water / Harvest)                                       */
/* ================================================================== */

const STEP_FRAME_X: Record<StepId, number> = {
  landprep: 198,
  planting: 196,
  fertilizer: 198,
  pesticides: 188,
  water: 191,
  harvest: 191,
};

export function StepsModal({ s, step, dispatch }: { s: GameState; step: StepId; dispatch: Dispatch<Action> }) {
  const def = STEPS.find(d => d.id === step)!;
  const fx = STEP_FRAME_X[step];
  const close = () => dispatch({ type: 'close' });

  return (
    <ModalShell frame="shop" x={fx} y={28} title="Farming Steps" close={[fx + 455, 56]} onClose={close}>
      <IconSidebar
        label="Farming steps"
        items={STEPS.map(d => ({
          id: d.id,
          label: d.label,
          icon: d.icon,
          iconOn: d.iconOn,
          size: d.iconSize,
          sizeOn: d.iconOnSize,
          done: isStepComplete(s, d.id),
        }))}
        active={step}
        onPick={id => dispatch({ type: 'open', modal: { kind: 'steps', step: id as StepId } })}
        centerX={145.5}
        centerY={201}
        gap={4}
      />
      <div className="panel" style={{ left: fx + 36, top: 78, width: 446, height: 254 }}>
        <p className="section-title" style={{ position: 'absolute', left: 0, right: 0, top: 2 }}>
          {def.title}
        </p>
        {step === 'water' ? <WaterBody s={s} dispatch={dispatch} /> : <TaskGrid s={s} step={step} dispatch={dispatch} />}
        <Partner top={233} />
      </div>
    </ModalShell>
  );
}

function TaskGrid({ s, step, dispatch }: { s: GameState; step: StepId; dispatch: Dispatch<Action> }) {
  const def = STEPS.find(d => d.id === step)!;
  const three = def.columns === 3;
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        translate: '-50% 0',
        top: step === 'fertilizer' ? 27 : 19,
        display: 'grid',
        gridTemplateColumns: three ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, 127px)',
        width: three ? 403 : undefined,
        gap: 10,
      }}
    >
      {def.tasks.map(t => {
        const done = s.doneTasks.includes(t.id);
        return (
          <button
            key={t.id}
            type="button"
            className={`card${done ? ' is-owned' : ''}`}
            style={{ padding: '2px 8px 4px', minHeight: step === 'fertilizer' ? 87 : 99, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}
            onClick={() => dispatch({ type: 'task', id: t.id, price: t.price, name: t.name })}
            aria-pressed={done}
            aria-label={done ? `${t.name}, done` : `${t.name}, ${t.price} coins`}
          >
            <Img src={t.icon} w={t.iconSize[0]} h={t.iconSize[1]} />
            <span style={{ fontSize: def.nameFont, fontWeight: 700, lineHeight: 1.15, maxWidth: step === 'landprep' ? 66 : 120, textAlign: 'center' }}>
              {t.name}
            </span>
            {done ? (
              <span className="chip" style={{ width: 110, fontSize: 8, background: '#5fb544', borderColor: '#3e8c2a' }}>Done</span>
            ) : (
              <PriceChip price={t.price} width={110} />
            )}
          </button>
        );
      })}
    </div>
  );
}

function WaterBody({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const def = STEPS.find(d => d.id === 'water')!;
  const [amount, setAmount] = useState('');
  const save = () => {
    const n = Number(amount.replace(/[^\d.]/g, ''));
    if (!n) return dispatch({ type: 'toast', text: 'Enter a water amount first' });
    dispatch({ type: 'water', litres: n });
    setAmount('');
  };
  return (
    <div style={{ position: 'absolute', left: 12, right: 12, top: 20 }}>
      <label htmlFor="water-amount" style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
        Water amount
      </label>
      <form
        className="field-box"
        style={{ height: 35, paddingLeft: 8 }}
        onSubmit={e => {
          e.preventDefault();
          save();
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Img src={img.waterInput} w={22} h={23} />
          <input
            id="water-amount"
            inputMode="numeric"
            placeholder="Enter water amount"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{ width: 220 }}
          />
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--brown-50)' }}>L/m^2</span>
          <EditIcon size={18} />
          <GoldButton font={10} style={{ width: 63, height: 27 }} onClick={save}>
            Save
          </GoldButton>
        </span>
      </form>
      <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
        {def.tasks.map((t, i) => {
          const done = s.doneTasks.includes(t.id);
          const litres = [1, 5, 10, 20][i];
          return (
            <button
              key={t.id}
              type="button"
              className={`card${done ? ' is-owned' : ''}`}
              style={{ width: 85, height: 101, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 6, padding: '6px 6px 8px' }}
              onClick={() => dispatch({ type: 'task', id: t.id, price: t.price, name: `${t.name} of water`, water: litres })}
              aria-label={done ? `${t.name}, added` : `Add ${t.name} of water for ${t.price} coins`}
            >
              <Img src={t.icon} w={t.iconSize[0]} h={t.iconSize[1]} />
              <span style={{ fontSize: 10, fontWeight: 700 }}>{t.name}</span>
              {done ? (
                <span className="chip" style={{ width: 70, fontSize: 8, background: '#5fb544', borderColor: '#3e8c2a' }}>Added</span>
              ) : (
                <PriceChip price={t.price} width={70} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
