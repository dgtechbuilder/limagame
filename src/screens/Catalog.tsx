import { useState, type Dispatch } from 'react';
import { Info } from '../learn/Info';
import { img } from '../assets';
import { IconSidebar, ModalShell } from '../components/Modal';
import { Cast } from '../art/Cast';
import { ClimateTag } from '../climate/Tag';
import { TASK_CLIMATE, waterTask } from '../climate/model';
import { hasSolar } from '../climate/track';
import { GoldButton, Img, Partner, PriceChip } from '../components/ui';
import { SHOP_TABS, STEP_META, STEPS, TASK_USES_ITEM, itemsFor, shopIndex, type ShopTab, type StepId } from '../data';
import { lockText } from '../unlock/model';
import { stepIndex, tasksDone, type Action, type GameState } from '../state';
import { money } from '../money';
import { PartnerRibbon, SponsorLine } from '../partners/ui';
import { brandOf, slotBrand, type SlotId } from '../partners/data';

/** The partner slot each Shop section sells. */
const SHOP_SLOT: Partial<Record<ShopTab, SlotId>> = { fertilizer: 'shop-fertilizer', tank: 'shop-tank', equipment: 'shop-equipment' };

/** The farm word (learn/glossary.ts) behind a Shop item or a farming step, where its name alone does not say it. */
const ITEM_TERM: Record<string, string> = { 'tank-s': 'tank', 'tank-m': 'tank', 'tank-l': 'tank', 'tank-xl': 'tank', 'tank-pan': 'waterPan', 'tank-tangi': 'tank', cultivator: 'handCultivator', 'w-1000': 'tank', 'w-5000': 'tank', 'w-10000': 'tank', 'w-20000': 'tank', storage: 'hermetic', timing: 'drying', reaping: 'sickle', protection: 'aflatoxin' };
const STEP_TERM: Record<StepId, string> = { landprep: 'landPrep', planting: 'spacing', fertilizer: 'fertilizer', pesticides: 'pesticide', water: 'drip', harvest: 'drying' };

/* ================================================================== */
/* Shop (Figma: Food / Fertilizer / Water tanks / Equipments)          */
/* ================================================================== */

export function ShopModal({ s, tab, dispatch }: { s: GameState; tab: ShopTab; dispatch: Dispatch<Action> }) {
  const def = SHOP_TABS.find(t => t.id === tab)!;
  const close = () => dispatch({ type: 'close' });

  return (
    <ModalShell frame="shop" x={178} y={28} title="Shop" onClose={close}>
      <IconSidebar
        label="Shop sections"
        items={SHOP_TABS.map(t => ({ id: t.id, label: t.label, icon: t.icon, iconOn: t.iconOn, size: t.iconSize, sizeOn: t.iconOnSize }))}
        active={tab}
        onPick={id => dispatch({ type: 'open', modal: { kind: 'shop', tab: id as ShopTab } })}
        centerX={145}
        centerY={201}
        gap={16}
      />

      {/* the items fill the frame; the shopkeeper stands beside it, her tip one line above the grid */}
      <div className="panel pp-body" style={{ left: 213, top: 78, width: 446, height: 254 }}>
        <div className="pp-head">
          <p className="pp-h">{def.title}</p>
          <p className="pp-sub is-right">{def.speech}</p>
        </div>
        <div className="pp-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
          {def.items.map(item => {
            const left = item.stock ? s.stock[item.id] ?? 0 : undefined;
            const owned = !item.stock && s.inventory.includes(item.id);
            const brand = brandOf(item.partner);
            const lock = lockText(s, shopIndex(item.id));
            return (
              <button
                key={item.id}
                type="button"
                title={lock ?? undefined}
                data-option={item.id}
                className={`pp-card card${owned ? ' is-owned is-on' : ''}${brand ? ' is-partner' : ''}${lock ? ' is-gated' : ''}`}
                style={{ height: 84, justifyContent: 'space-between', opacity: left === 0 ? 0.55 : 1, ...(brand ? { ['--brand' as string]: brand.color } : {}) }}
                onClick={() =>
                  item.stock
                    ? dispatch({ type: 'sell', id: item.id, price: item.price, name: item.name })
                    : dispatch({ type: 'buy', id: item.id, price: item.price, name: item.name })
                }
                aria-label={item.stock ? `Sell ${item.name}, ${left} of ${item.stock[1]} bags left, ${money(item.price)} each` : `Buy ${item.name} for ${money(item.price)}${brand ? `, from partner ${brand.name}` : ''}${lock ? `. ${lock}` : ''}`}
              >
                {item.partner && <PartnerRibbon brand={item.partner} />}
                <span className="pp-row" style={{ paddingTop: item.partner ? 12 : 0 }}>
                  <Img src={item.icon} w={36} h={30} style={{ flexShrink: 0 }} />
                  <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className="pp-name">{item.name}</span>
                    {item.stock && <span className="pp-cap">{left} of {item.stock[1]} left</span>}
                    {owned && <span className="pp-cap">Owned</span>}
                  </span>
                </span>
                <PriceChip price={item.price} />
                {lock ? <span className="pp-corner" aria-hidden="true">🔒</span> : <Info term={ITEM_TERM[item.id] ?? item.name} nested size={14} className="info-corner" />}
              </button>
            );
          })}
        </div>
        {SHOP_SLOT[tab] && slotBrand(SHOP_SLOT[tab]!) ? (
          <SponsorLine slot={SHOP_SLOT[tab]!} label="Featured partner" dispatch={dispatch} className="shop-sponsor" />
        ) : (
          <Partner top={226} />
        )}
      </div>
      <Cast id="shopkeeper" w={176} h={226} alt="Shopkeeper" backdrop="none" style={{ position: 'absolute', left: 682, top: 150, pointerEvents: 'none' }} />
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

type StepStatus = 'current' | 'finished' | 'locked';
const statusOf = (s: GameState, step: StepId): StepStatus => {
  const i = stepIndex(step);
  return i === s.stage ? 'current' : i < s.stage ? 'finished' : 'locked';
};

export function StepsModal({ s, step, dispatch }: { s: GameState; step: StepId; dispatch: Dispatch<Action> }) {
  const def = STEPS.find(d => d.id === step)!;
  const meta = STEP_META[step];
  const status = statusOf(s, step);
  const fx = STEP_FRAME_X[step];
  const close = () => dispatch({ type: 'close' });
  const done = tasksDone(s, step);
  const current = STEPS[Math.min(s.stage, STEPS.length - 1)];

  return (
    <ModalShell frame="shop" x={fx} y={28} title={def.title} label="Farming Steps" onClose={close}>
      <IconSidebar
        label="Farming steps"
        items={STEPS.map(d => ({
          id: d.id,
          label: d.label,
          icon: d.icon,
          iconOn: d.iconOn,
          size: d.iconSize,
          sizeOn: d.iconOnSize,
          done: statusOf(s, d.id) === 'finished',
          locked: statusOf(s, d.id) === 'locked',
        }))}
        active={step}
        onPick={id => dispatch({ type: 'open', modal: { kind: 'steps', step: id as StepId } })}
        centerX={145.5}
        centerY={201}
        gap={4}
      />
      <div className="panel pp-body" style={{ left: fx + 36, top: 78, width: 446, height: 254 }}>
        {step === 'water' ? (
          <WaterBody s={s} status={status} dispatch={dispatch} />
        ) : (
          <TaskGrid s={s} step={step} status={status} dispatch={dispatch} />
        )}
        <div className="pp-foot">
          <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <b className="pp-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {status === 'current'
                ? `${done}/${meta.need} recommended tasks done`
                : status === 'finished'
                  ? `Finished this season · ${Math.round((s.stepScores[step] ?? 0) * 100)}% of the recommended work`
                  : `Locked · finish ${current.label} first`}
            </b>
            <span className="pp-sub" style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <Info term={STEP_TERM[step]} size={14} style={{ margin: 0, flexShrink: 0 }} />
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {status === 'locked' ? 'You can look around to plan ahead.' : status === 'current' ? `${done < meta.need ? 'Fewer means a weaker crop' : 'Your crop is in good shape'}. ${meta.purpose}.` : `${meta.purpose}.`}
              </span>
            </span>
          </span>
          {status === 'current' &&
            (done === 0 && step !== 'harvest' ? (
              <button type="button" className="pp-text-btn" onClick={() => dispatch({ type: 'finishStep', step })}>
                Skip {def.label}
              </button>
            ) : (
              <GoldButton className="pp-main is-small" style={{ flexShrink: 0 }} onClick={() => dispatch({ type: 'finishStep', step })}>
                {step === 'harvest' ? 'Harvest the crop' : `Finish ${def.label} · ${meta.days}d`}
              </GoldButton>
            ))}
        </div>
      </div>
    </ModalShell>
  );
}

function TaskChip({ s, taskId, price, done, status }: { s: GameState; taskId: string; price: number; done: boolean; status: StepStatus }) {
  if (done) return <span className="pp-price is-done">Done</span>;
  if (status !== 'current') return <span className="pp-price is-off">{status === 'locked' ? 'Locked' : 'Skipped'}</span>;
  const item = TASK_USES_ITEM[taskId];
  if (item && itemsFor(item).some(i => s.inventory.includes(i))) return <span className="pp-price is-done">In stock · free</span>;
  return <PriceChip price={price} />;
}

/** A task card: picture and name on one row, its climate effect under the name, the price below (3 × 2 at most). */
function TaskCard({ s, step, t, status, onDo, label, water, tall }: { s: GameState; step: StepId; t: { id: string; name: string; icon: string; iconSize: [number, number]; price: number }; status: StepStatus; onDo: () => void; label: string; water?: number; tall?: boolean }) {
  const done = s.doneTasks.includes(t.id);
  const disabled = status !== 'current' || done;
  const tag = step === 'water' ? waterTask((water ?? 0) * 1000, hasSolar(s)) : TASK_CLIMATE[t.id];
  const [iw, ih] = t.iconSize;
  const k = Math.min(1, (tall ? 48 : 30) / iw, (tall ? 36 : 28) / ih);
  const pic = <Img src={t.icon} w={Math.round(iw * k)} h={Math.round(ih * k)} />;
  return (
    <button
      type="button"
      className={`pp-card card${done ? ' is-owned is-on' : ''}`}
      style={{ height: tall ? 132 : 88, padding: tall ? '6px 8px 8px' : '6px 6px 8px', justifyContent: 'space-between', alignItems: tall ? 'center' : undefined, opacity: status === 'locked' ? 0.6 : 1, cursor: disabled ? 'default' : 'pointer' }}
      onClick={() => !disabled && onDo()}
      aria-disabled={disabled}
      aria-label={label}
    >
      {tall ? (
        <>
          <span style={{ height: 36, display: 'grid', placeItems: 'center' }}>{pic}</span>
          <span className="pp-name">{t.name}</span>
          {tag && <ClimateTag short d={tag} style={{ textAlign: 'center', justifyContent: 'center' }} />}
        </>
      ) : (
        <span className="pp-row" style={{ alignItems: 'flex-start' }}>
          <span style={{ width: 30, height: 30, display: 'grid', placeItems: 'center', flexShrink: 0 }}>{pic}</span>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span className="pp-name">{t.name}</span>
            {tag && <ClimateTag short d={tag} style={{ whiteSpace: 'nowrap' }} />}
          </span>
        </span>
      )}
      <span style={{ alignSelf: 'stretch' }}>
        <TaskChip s={s} taskId={t.id} price={t.price} done={done} status={status} />
      </span>
      <Info term={ITEM_TERM[t.id] ?? t.name} nested size={14} className="info-corner" />
    </button>
  );
}

function TaskGrid({ s, step, status, dispatch }: { s: GameState; step: StepId; status: StepStatus; dispatch: Dispatch<Action> }) {
  const def = STEPS.find(d => d.id === step)!;
  return (
    <div className="pp-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', rowGap: 12, flexShrink: 0 }}>
      {def.tasks.map(t => {
        const done = s.doneTasks.includes(t.id);
        return (
          <TaskCard
            key={t.id}
            s={s}
            step={step}
            t={t}
            status={status}
            onDo={() => dispatch({ type: 'task', step, id: t.id, price: t.price, name: t.name })}
            label={done ? `${t.name}, done` : status !== 'current' ? `${t.name}, not available` : `${t.name}, ${money(t.price)}`}
          />
        );
      })}
    </div>
  );
}

function WaterBody({ s, status, dispatch }: { s: GameState; status: StepStatus; dispatch: Dispatch<Action> }) {
  const def = STEPS.find(d => d.id === 'water')!;
  const [amount, setAmount] = useState('');
  const save = () => {
    const n = Number(amount.replace(/[^\d.]/g, ''));
    if (!n) return dispatch({ type: 'toast', text: 'Type how many litres per square metre you plan to use' });
    dispatch({ type: 'water', litres: n });
    setAmount('');
  };
  return (
    <>
      <form
        className="pp-row"
        onSubmit={e => {
          e.preventDefault();
          save();
        }}
      >
        <label htmlFor="water-amount" className="pp-name" style={{ whiteSpace: 'nowrap' }}>
          Water amount
        </label>
        <span className="field-box" style={{ flex: 1, height: 32, padding: '0 8px', gap: 8 }}>
          <Img src={img.waterInput} w={20} h={21} />
          <input id="water-amount" inputMode="numeric" placeholder="Litres per m²" value={amount} onChange={e => setAmount(e.target.value)} style={{ flex: 1, minWidth: 0, fontSize: 12 }} />
          <span className="pp-cap">L/m²</span>
          <Info term="lpm2" size={14} style={{ margin: 0 }} />
        </span>
        <button type="submit" className="pp-btn">Save</button>
      </form>
      <div className="pp-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', flexShrink: 0 }}>
        {def.tasks.map((t, i) => {
          const done = s.doneTasks.includes(t.id);
          const litres = [1, 5, 10, 20][i];
          return (
            <TaskCard
              key={t.id}
              s={s}
              step="water"
              t={t}
              water={litres}
              tall
              status={status}
              onDo={() => dispatch({ type: 'task', step: 'water', id: t.id, price: t.price, name: `${t.name} of water`, water: litres })}
              label={done ? `${t.name}, added` : `Add ${t.name} of water for ${money(t.price)}`}
            />
          );
        })}
      </div>
    </>
  );
}
