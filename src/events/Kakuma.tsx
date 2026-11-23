import type { CSSProperties, Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { money } from '../money';
import { PRODUCE, PRODUCE_IDS, produceOf } from '../produce/model';
import type { Action, GameState, KakumaTab } from '../state';
import {
  GIFT_POINTS,
  KAKUMA_ABOUT,
  KAKUMA_EVENT,
  KAKUMA_FACTS,
  KAKUMA_FOODS,
  KAKUMA_GIFTS,
  KAKUMA_LIFE,
  KG_PER_MEAL,
  STORE_GIFT_KG,
  daysToGo,
  kakumaOf,
  kakumaPhase,
  type KakumaPhase,
} from './model';

/* The Kakuma special event (27–30 November), with the World Food Programme: what Kakuma refugee camp is, the foods
   grown there, what food means to the families who live there, and a Donate section to give money, a food gift or
   produce from the farm's store. Opened from the pop-up on the farm's bottom left (KakumaPopup), or /kakuma. */

const TABS: { id: KakumaTab; label: string; icon: string }[] = [
  { id: 'about', label: 'About Kakuma', icon: '🏕️' },
  { id: 'foods', label: 'Foods grown', icon: '🥬' },
  { id: 'life', label: 'Food and life', icon: '🍲' },
  { id: 'donate', label: 'Donate', icon: '🤝' },
];

const whenText = (phase: KakumaPhase) =>
  phase === 'on' ? 'On now · gifts earn double points' : phase === 'soon' ? `Starts in ${daysToGo()} day${daysToGo() === 1 ? '' : 's'}` : 'The event has ended';

function WfpBadge() {
  return (
    <span className="kk-wfp" aria-label={`In partnership with the ${KAKUMA_EVENT.partner}`}>
      <i aria-hidden="true">🌾</i>
      <span>
        <small>In partnership with</small>
        <b>{KAKUMA_EVENT.partner}</b>
      </span>
    </span>
  );
}

function Banner({ phase }: { phase: KakumaPhase }) {
  return (
    <div className="kk-banner">
      <span className="kk-banner-text">
        <small>Special event · {KAKUMA_EVENT.dates}</small>
        <b>Kakuma: food and hope</b>
        <i className={`kk-when is-${phase}`}>{whenText(phase)}</i>
      </span>
      <WfpBadge />
    </div>
  );
}

export function KakumaPage({ s, dispatch, tab = 'about' }: { s: GameState; dispatch: Dispatch<Action>; tab?: KakumaTab }) {
  const phase = kakumaPhase();
  const k = kakumaOf(s.kakuma);
  const go = (t: KakumaTab) => dispatch({ type: 'open', modal: { kind: 'kakuma', tab: t } });
  return (
    <Page
      title="Kakuma special event"
      icon="🌍"
      tabs={TABS.map(t => (t.id === 'donate' && k.totals.count ? { ...t, badge: k.totals.count } : t))}
      tab={tab}
      onTab={go}
      dispatch={dispatch}
      className="kk-page"
      foot={
        <>
          {KAKUMA_EVENT.dates}
          <br />
          With the {KAKUMA_EVENT.partner}
        </>
      }
    >
      {tab === 'about' && (
        <div className="kk-col">
          <Banner phase={phase} />
          <div className="cl-tiles">
            {KAKUMA_FACTS.map(f => (
              <Tile key={f.label} label={f.label} value={f.value} sub={f.sub} />
            ))}
          </div>
          {KAKUMA_ABOUT.map((p, i) => (
            <p key={i} className="kk-p">
              {p}
            </p>
          ))}
          <div className="kk-actions">
            <button type="button" className="pp-btn" onClick={() => go('foods')}>
              🥬 The foods grown there
            </button>
            <button type="button" className="pp-btn kk-cta" onClick={() => go('donate')}>
              🤝 Donate
            </button>
          </div>
        </div>
      )}

      {tab === 'foods' && (
        <div className="kk-col">
          <p className="kk-lead">
            Little rain falls in Kakuma, so families and farmers grow tough, fast and nourishing crops in kitchen gardens, shade nets and water-saving beds. Here is what they grow, and what it can teach your farm.
          </p>
          <div className="kk-foods">
            {KAKUMA_FOODS.map(f => (
              <article key={f.id} className="kk-food" aria-label={f.name}>
                <p className="pp-name">
                  <span aria-hidden="true">{f.icon}</span> {f.name}
                </p>
                <p className="kk-line">
                  <b>Grows</b> {f.grows}
                </p>
                <p className="kk-line">
                  <b>Helps</b> {f.helps}
                </p>
                <p className="kk-line is-you">
                  <b>Your farm</b> {f.forYou}
                </p>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'life' && (
        <div className="kk-col">
          <p className="kk-lead">For people who have lost their homes, food is more than a meal: it is how a normal day comes back.</p>
          <div className="kk-life">
            {KAKUMA_LIFE.map(l => (
              <div key={l.title} className="kk-life-item">
                <i aria-hidden="true">{l.icon}</i>
                <span>
                  <b>{l.title}</b>
                  <small>{l.text}</small>
                </span>
              </div>
            ))}
          </div>
          <div className="kk-actions">
            <button type="button" className="pp-btn kk-cta" onClick={() => go('donate')}>
              🤝 Help put food on the table
            </button>
          </div>
        </div>
      )}

      {tab === 'donate' && <Donate s={s} dispatch={dispatch} phase={phase} />}
    </Page>
  );
}

function Donate({ s, dispatch, phase }: { s: GameState; dispatch: Dispatch<Action>; phase: KakumaPhase }) {
  const k = kakumaOf(s.kakuma);
  const p = produceOf(s.produce);
  const have = PRODUCE_IDS.filter(id => (p.store[id] ?? 0) >= 0.1);
  const over = phase === 'over';
  const pts = GIFT_POINTS * (phase === 'on' ? 2 : 1);
  return (
    <div className="kk-col">
      <Banner phase={phase} />
      <div className="cl-tiles">
        <Tile label="Meals you gave" value={`${k.totals.meals}`} sub="in the game" tone={k.totals.meals ? 'good' : undefined} />
        <Tile label="Money given" value={money(k.totals.money)} sub={`${k.totals.count} gift${k.totals.count === 1 ? '' : 's'}`} />
        <Tile label="Food given" value={`${Math.round(k.totals.kg * 10) / 10} kg`} sub="from your store" />
        <Tile label="Each gift" value={`+${pts} pts`} sub={phase === 'on' ? 'double on event days' : 'double on 27–30 Nov'} />
      </div>

      {over ? (
        <p className="kk-lead">The Kakuma event has ended. Thank you for every gift. You can still give for real with the World Food Programme.</p>
      ) : (
        <>
          <p className="kk-h">Give money or food</p>
          <div className="kk-gifts">
            {KAKUMA_GIFTS.map(g => {
              const short = s.coins < g.price;
              return (
                <button
                  key={g.id}
                  type="button"
                  className="kk-gift"
                  aria-disabled={short || undefined}
                  onClick={() => dispatch({ type: 'kakumaGive', gift: g.id })}
                  aria-label={`Give ${g.name.toLowerCase()}: ${money(g.price)}, about ${g.meals} meals`}
                >
                  <i aria-hidden="true">{g.icon}</i>
                  <span>
                    <b>{g.name}</b>
                    <small>{g.line}</small>
                  </span>
                  <em>{money(g.price)}</em>
                </button>
              );
            })}
          </div>

          <p className="kk-h">Give from your store</p>
          {have.length ? (
            <div className="kk-store">
              {have.map(id => {
                const kg = Math.round(Math.min(STORE_GIFT_KG, p.store[id] ?? 0) * 10) / 10;
                return (
                  <button
                    key={id}
                    type="button"
                    className="kk-store-item"
                    onClick={() => dispatch({ type: 'kakumaGiveStore', produce: id })}
                    aria-label={`Give ${kg} kg of ${PRODUCE[id].name.toLowerCase()}, about ${Math.round(kg / KG_PER_MEAL)} meals`}
                  >
                    <i aria-hidden="true">{PRODUCE[id].icon}</i>
                    <span>
                      <b>{PRODUCE[id].name}</b>
                      <small>{Math.round((p.store[id] ?? 0) * 10) / 10} kg in store</small>
                    </span>
                    <em>Give {kg} kg</em>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="cl-empty">Nothing in your store yet: harvest your farms and some of every crop is kept here to sell or give.</p>
          )}
        </>
      )}

      <div className="kk-real">
        <span>
          <b>Give for real</b>
          <small>Gifts in the game use game money. To help families in Kakuma for real, give to the {KAKUMA_EVENT.partner}.</small>
        </span>
        <a className="pp-btn kk-cta" href={KAKUMA_EVENT.giveUrl} target="_blank" rel="noopener noreferrer">
          Give at wfp.org ↗
        </a>
      </div>

      {!!k.gifts.length && (
        <>
          <p className="kk-h">Your gifts</p>
          <ul className="kk-history">
            {k.gifts.slice(0, 8).map((g, i) => (
              <li key={`${g.t}-${i}`}>
                <span>{g.label}</span>
                <span>{g.money ? money(g.money) : `${g.kg} kg`}</span>
                <span>~{g.meals} meals</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** The event's pop-up on the farm's bottom left, or, tucked away, a round button in the left column. Gone after the event. */
export function KakumaPopup({ s, dispatch, style }: { s: GameState; dispatch: Dispatch<Action>; style?: CSSProperties }) {
  const phase = kakumaPhase();
  if (phase === 'over') return null;
  const k = kakumaOf(s.kakuma);
  const open = () => dispatch({ type: 'open', modal: { kind: 'kakuma', tab: 'about' } });
  if (k.tucked)
    return (
      <button type="button" className="hud-round hud-kakuma" style={style} onClick={() => dispatch({ type: 'kakumaTuck', tucked: false })} aria-label={`Kakuma special event, ${KAKUMA_EVENT.dates}: show`}>
        <span className="hud-kakuma-icon" aria-hidden="true">🌍</span>
        <span>KAKUMA</span>
        {phase === 'on' && <i className="hud-badge" aria-hidden="true">!</i>}
      </button>
    );
  return (
    <div className={`kk-pop is-${phase}`} role="region" aria-label="Kakuma special event">
      <button type="button" className="kk-pop-x" onClick={() => dispatch({ type: 'kakumaTuck', tucked: true })} aria-label="Tuck the Kakuma event away">
        ×
      </button>
      <span className="kk-pop-tag">{phase === 'on' ? 'Special event · on now' : `Special event · ${KAKUMA_EVENT.dates}`}</span>
      <b className="kk-pop-title">
        <span aria-hidden="true">🌍</span> Kakuma refugee camp
      </b>
      <small className="kk-pop-wfp">With the World Food Programme</small>
      <span className="kk-pop-foot">
        <span className="kk-pop-line">{phase === 'on' ? 'On until 30 Nov' : `Starts in ${daysToGo()} day${daysToGo() === 1 ? '' : 's'}`}</span>
        <button type="button" className="kk-pop-go" onClick={open} aria-label="Join the event">
          Join ›
        </button>
      </span>
    </div>
  );
}
