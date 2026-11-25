import { useEffect, useState, type Dispatch, type ReactNode } from 'react';
import { openLesson } from '../learn/Info';
import { SuccessCard } from '../components/Success';
import { Coin, Img, Stars, fmt } from '../components/ui';
import { PROCESSES, SHOP_TABS, STORAGE_OPTIONS } from '../data';
import { money } from '../money';
import { NightScene, sceneOf } from '../security/NightScene';
import { courseOf, dayText } from '../training/data';
import { MORNING_KINDS, type Action, type GameState, type Success } from '../state';

/* The dialog after something worked (state.ts Success): a sale (Sell Food in the shop, or the season's harvest),
   a training booked, a storage upgrade. It sits above every screen and closes onto the one underneath. */

type Props = { s: GameState; dispatch: Dispatch<Action> };

export function SuccessLayer({ s, dispatch }: Props) {
  const x = s.success;
  if (!x) return null;
  // a morning's news waits until the player is back on the farm: it never covers a page they are reading
  if (MORNING_KINDS.includes(x.kind) && (s.modal || s.roundsOpen || s.trialsOpen || s.bizOpen)) return null;
  const done = () => dispatch({ type: 'dismissSuccess' });
  switch (x.kind) {
    case 'sale':
      return x.from === 'shop' ? <ShopSale x={x} s={s} dispatch={dispatch} done={done} /> : <SeasonSale x={x} s={s} dispatch={dispatch} done={done} />;
    case 'training':
      return <Booked x={x} s={s} dispatch={dispatch} done={done} />;
    case 'storage':
      return <Upgraded x={x} s={s} dispatch={dispatch} done={done} />;
    case 'night':
      return <NightNews x={x} s={s} dispatch={dispatch} done={done} />;
    case 'day2':
      return <DayTwo x={x} s={s} dispatch={dispatch} done={done} />;
    case 'morning':
      return <Morning x={x} s={s} dispatch={dispatch} done={done} />;
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
        ...(x.lost ? ([['Bags lost in storage (spoiled or stolen)', fmt(x.lost)]] as [ReactNode, ReactNode][]) : []),
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

/** The morning after a night with news: what was stolen, what predators took, what happened to the animals. */
function NightNews({ x, dispatch, done }: Each<'night'>) {
  const lost = x.events.reduce((n, e) => n + (e.kind === 'theft' || e.kind === 'predator' || e.kind === 'death' ? (e.value ?? 0) : 0), 0);
  const theft = x.events.some(e => e.kind === 'theft' || e.kind === 'predator');
  const sick = x.events.some(e => e.kind === 'issue' || e.kind === 'death' || e.kind === 'thirst');
  const tips = [...new Set(x.events.map(e => e.tip).filter(Boolean))].slice(0, 2) as string[];
  const list = x.events.slice(0, 5);
  // each line that can be shown gets its moving picture, one after another (or the one tapped)
  const scenes = list.flatMap((e, i) => {
    const scene = sceneOf(e);
    return scene ? [{ e, i, scene }] : [];
  });
  const [at, setAt] = useState(0);
  useEffect(() => {
    if (scenes.length < 2) return;
    const t = setTimeout(() => setAt(k => (k + 1) % scenes.length), 8000);
    return () => clearTimeout(t);
  }, [at, scenes.length]);
  const shown = scenes[Math.min(at, scenes.length - 1)];
  return (
    <SuccessCard
      tone="gold"
      kicker={x.nights > 1 ? `While you were away: ${x.nights} nights` : `Good morning · day ${x.day}`}
      title={theft ? 'Trouble in the night' : sick ? 'News from the animals' : 'The night’s news'}
      badge={<span style={{ fontSize: 20.5 }}>{theft ? '🛡' : '🐄'}</span>}
      highlight={lost ? { label: 'Lost in the night', value: coins(lost) } : undefined}
      actions={[
        { label: 'Back to the farm', plain: true, onClick: done },
        theft
          ? { label: 'Protect the farm', onClick: () => dispatch({ type: 'open', modal: { kind: 'security', tab: 'protect' } }) }
          : { label: 'See the animals', onClick: () => dispatch({ type: 'open', modal: { kind: 'animals', tab: sick ? 'health' : 'today' } }) },
      ]}
      onClose={done}
      label="The night's news"
      width={460}
    >
      <div className="night-body">
        {shown && (
          <div className="night-scenes">
            <NightScene key={`${x.id}:${at}`} id={shown.scene} tag={tagOf(shown.e)} found={shown.e.kind === 'recovered'} />
            {scenes.length > 1 && (
              <div className="night-dots">
                {scenes.map((v, k) => (
                  <button key={k} type="button" className={k === at ? 'is-on' : undefined} aria-label={`Show: ${v.e.text}`} onClick={() => setAt(k)} />
                ))}
              </div>
            )}
          </div>
        )}
        <ul className="night-list">
          {list.map((e, i) => {
            const k = scenes.findIndex(v => v.i === i);
            return (
              <li key={i} className={`is-${e.kind}${k >= 0 ? ' has-scene' : ''}${k >= 0 && k === at ? ' is-shown' : ''}`} onClick={k >= 0 ? () => setAt(k) : undefined}>
                {e.text}
                {e.value ? <> ({money(e.value)})</> : null}
              </li>
            );
          })}
        </ul>
      </div>
      {tips.map(t => (
        <p key={t} className="success-note">
          {t}
        </p>
      ))}
    </SuccessCard>
  );
}

/** The red tag on a night's picture: what it cost, or that it was found again. */
function tagOf(e: { kind: string; value?: number; text: string }): ReactNode {
  if (e.kind === 'recovered') return '✓ Found again';
  if (e.value) return `−${money(e.value)}`;
  const n = e.text.match(/(\d+) (hens?|cows?)/);
  return n ? `−${n[1]} ${n[2]}` : undefined;
}

/** Day 2: the animals come into the player's care, the coop can be built, and theft becomes part of every night. */
function DayTwo({ s, dispatch, done }: Each<'day2'>) {
  const name = s.farmer?.name ?? 'farmer';
  return (
    <SuccessCard
      kicker="Good morning · day 2"
      title={`Your animals, ${name}`}
      lead="The cows and the hens are yours to look after from today."
      badge={<span style={{ fontSize: 20.5 }}>🐔</span>}
      rows={[
        ['Every day', 'Feed, water, milk, collect eggs'],
        ['Every 3 days', 'Clean the pen and the coop'],
        ['Watch for', 'Disease, ticks, a leaking trough'],
        ['At night', 'Thieves and predators: protect the farm'],
      ]}
      actions={[
        { label: 'Later', plain: true, onClick: done },
        { label: 'Build the chicken coop', onClick: () => dispatch({ type: 'open', modal: { kind: 'animals', tab: 'coop' } }) },
      ]}
      onClose={done}
      label="Day 2: your animals"
      width={440}
    >
      <p className="success-note">Walk to the pen or the coop, or tap ANIMALS. SECURITY shows what keeps thieves away.</p>
    </SuccessCard>
  );
}

/** A morning with something new: today's power part, the cow shed (day 3), the greenhouse and the storehouse (day 4). */
function Morning({ x, s, dispatch, done }: Each<'morning'>) {
  const name = s.farmer?.name ?? 'farmer';
  const first = x.lines[0];
  return (
    <SuccessCard
      kicker={`Good morning · day ${x.day}`}
      title={x.lines.length > 1 ? `New today, ${name}` : first.title}
      lead={x.lines.length > 1 ? undefined : first.text}
      badge={<span style={{ fontSize: 20.5 }}>{first.icon}</span>}
      rows={x.lines.length > 1 ? x.lines.map(l => [`${l.icon} ${l.title}`, l.text] as [string, string]) : []}
      actions={[
        { label: 'Later', plain: true, onClick: done },
        ...x.lines.slice(0, 2).map(l => ({ label: l.lesson !== undefined ? 'Read today’s farm basics' : l.title, onClick: () => (l.lesson !== undefined ? (done(), openLesson(l.lesson)) : dispatch({ type: 'open', modal: l.go })) })),
      ]}
      onClose={done}
      label={`Day ${x.day}: ${x.lines.map(l => l.title).join(', ')}`}
      width={460}
    />
  );
}
