import type { Dispatch, ReactNode } from 'react';
import { SuccessCard } from '../components/Success';
import { Coin, Img, Stars, fmt } from '../components/ui';
import { PROCESSES, SHOP_TABS, STORAGE_OPTIONS } from '../data';
import { money } from '../money';
import { courseOf, dayText } from '../training/data';
import type { Action, GameState, Success } from '../state';

/* The dialog after something worked (state.ts Success): a sale (Sell Food in the shop, or the season's harvest),
   a training booked, a storage upgrade. It sits above every screen and closes onto the one underneath. */

type Props = { s: GameState; dispatch: Dispatch<Action> };

export function SuccessLayer({ s, dispatch }: Props) {
  const x = s.success;
  if (!x) return null;
  const done = () => dispatch({ type: 'dismissSuccess' });
  switch (x.kind) {
    case 'sale':
      return x.from === 'shop' ? <ShopSale x={x} s={s} dispatch={dispatch} done={done} /> : <SeasonSale x={x} s={s} dispatch={dispatch} done={done} />;
    case 'training':
      return <Booked x={x} s={s} dispatch={dispatch} done={done} />;
    case 'storage':
      return <Upgraded x={x} s={s} dispatch={dispatch} done={done} />;
  }
}

type Of<K extends Success['kind']> = Extract<Success, { kind: K }>;
type Each<K extends Success['kind']> = Props & { x: Of<K>; done: () => void };

const coins = (n: number) => (
  <>
    <Coin size={14} /> {money(n)}
  </>
);

function ShopSale({ x, s, dispatch, done }: Each<'sale'>) {
  const item = SHOP_TABS.find(t => t.id === 'food')!.items.find(i => i.id === x.itemId);
  const left = x.left ?? 0;
  return (
    <SuccessCard
      kicker="Sale complete"
      title={`Sold ${x.qty} bag${x.qty === 1 ? '' : 's'} of ${x.item}`}
      badge={item ? <Img src={item.icon} w={item.iconSize[0] * 1.2} h={item.iconSize[1] * 1.2} /> : undefined}
      highlight={{ label: 'You earned', value: coins(x.earned) }}
      rows={[
        ['Price a bag', coins(x.price)],
        ['Bags left to sell', item?.stock ? `${left} of ${item.stock[1]}` : fmt(left)],
        ['Your coins now', coins(s.coins)],
      ]}
      actions={[
        ...(left > 0 && x.itemId ? [{ label: `Sell another ${x.item.toLowerCase()}`, plain: true, onClick: () => dispatch({ type: 'sell', id: x.itemId!, price: x.price, name: x.item }) }] : []),
        { label: 'Done', onClick: done },
      ]}
      onClose={done}
      label={`Sale complete: sold ${x.qty} ${x.item}`}
    />
  );
}

function SeasonSale({ x, dispatch, done }: Each<'sale'>) {
  const process = x.process ? PROCESSES.find(p => p.id === x.process) : null;
  return (
    <SuccessCard
      kicker="Harvest sold"
      title={`${fmt(x.qty)} bags of maize sold`}
      lead={
        <>
          At the {x.at === 'gate' ? 'farm gate' : 'market'}
          {process ? `, after ${process.name.toLowerCase()}` : ', as grain'} · {x.quality ? <Stars value={x.quality} size={10} /> : null}
        </>
      }
      highlight={{ label: 'You earned', value: coins(x.earned) }}
      rows={[
        ['Price a bag', coins(x.price)],
        ...(x.lost ? ([['Bags lost in storage', fmt(x.lost)]] as [ReactNode, ReactNode][]) : []),
        ...(x.costs ? ([['Storage and processing', <>−{coins(x.costs)}</>]] as [ReactNode, ReactNode][]) : []),
        ['Points', `+${fmt(x.points)}`],
      ]}
      actions={[
        { label: 'Back to the farm', plain: true, onClick: () => dispatch({ type: 'home' }) },
        { label: 'See season results', onClick: done },
      ]}
      onClose={done}
      label={`Harvest sold: ${x.qty} bags`}
    />
  );
}

function Booked({ x, s, dispatch, done }: Each<'training'>) {
  const c = courseOf(x.course);
  if (!c) return null;
  return (
    <SuccessCard
      kicker="Booking confirmed"
      title={`You’re booked, ${s.farmer?.name ?? 'farmer'}!`}
      lead={
        <>
          <span aria-hidden="true">{c.icon}</span> {c.title} · {x.price ? <>{coins(x.price)} paid</> : 'free'}
        </>
      }
      highlight={{ label: 'When', value: `${dayText(x.date)} · ${c.time} · ${c.hours} h` }}
      rows={[
        ['Where', c.place],
        ['Trainer', c.host],
        ['Bring', c.bring],
        ['Your reference', <code className="success-ref">{x.ref}</code>],
      ]}
      actions={[
        { label: 'Back to the farm', plain: true, onClick: () => dispatch({ type: 'home' }) },
        { label: 'Done', onClick: done },
      ]}
      onClose={done}
      width={440}
    >
      <p className="success-note">A reminder is saved in your Messages.</p>
    </SuccessCard>
  );
}

function Upgraded({ x, s, dispatch, done }: Each<'storage'>) {
  const from = STORAGE_OPTIONS.find(o => o.id === x.from)!;
  const to = STORAGE_OPTIONS.find(o => o.id === x.to)!;
  const on = s.settings.upgradeNotes !== false;
  return (
    <SuccessCard
      tone="gold"
      kicker="Storage upgraded"
      title={to.name}
      badge={<Img src={to.icon} w={to.iconSize[0] * 0.8} h={to.iconSize[1] * 0.8} />}
      lead={
        <>
          From {from.name.toLowerCase()} · spoilage <b>{from.spoilage}</b> → <b>{to.spoilage}</b>
        </>
      }
      highlight={{ label: 'Bags saved from spoiling', value: `≈ ${fmt(Math.max(0, x.saved))}` }}
      rows={[
        ['Storage cost', <>{coins(to.costPerBag)}/bag</>],
        ['Extra on this harvest', x.extra > 0 ? coins(x.extra) : 'None'],
        ['Time to market', to.time],
      ]}
      actions={[
        { label: 'Stay here', plain: true, onClick: done },
        {
          label: 'Continue · value addition',
          onClick: () => dispatch({ type: 'open', modal: { kind: 'value' } }),
        },
      ]}
      onClose={done}
    >
      <label className="success-check">
        <input type="checkbox" checked={!on} onChange={e => dispatch({ type: 'settings', patch: { upgradeNotes: !e.target.checked } })} />
        Don’t show this after an upgrade
      </label>
    </SuccessCard>
  );
}
