import { useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import type { Action, GameState } from '../state';
import { CloseX, SuccessCard, useEscape } from '../components/Success';
import { money, moneyCompact } from '../money';
import { farmName, CHECK_DAYS, checkKey } from '../trials/model';
import { treatmentOf } from '../care/treatments';
import { dayNumber } from '../rounds/farms';
import { track } from '../first/track';
import { sfx } from '../sfx';
import { hasCover, isLow } from '../water/model';
import { WATER } from '../water/config';
import { STATUS_WORDS, riskOf, wasResolved, type RiskItem, type RiskSummary } from './model';
import { harvestEstimate, type HarvestEstimate } from './harvest';
import { img } from '../assets';

/* The "at risk" button on the farm: the money every unresolved problem on the six farms would cost, added up.
   Tap it for the list (biggest first: the farm, what is at risk, when it grows; never what the problem is), and tap a
   farm to go straight to its check. Dealing with a problem takes it off with a "saved" cheer. */

const SHOCK_WORDS = { drought: 'Drought', flood: 'Flood', hail: 'Hail' } as const;

/** Every unresolved problem today, worked out from the save. */
export function useRisk(s: GameState, today: number): RiskSummary {
  const covered = hasCover(s) || !!s.offers?.includes('kinga');
  const low = isLow(s);
  return useMemo(() => riskOf(s.trial, s.field, today, { covered, worse: low ? { drought: WATER.droughtLowTank } : undefined }), [s.trial, s.field, today, covered, low]);
}

export function RiskHud({
  s,
  risk,
  dispatch,
  hud,
  busy,
  onGo,
}: {
  s: GameState;
  risk: RiskSummary;
  dispatch: Dispatch<Action>;
  /** the HUD is on screen (the button shows) */
  hud: boolean;
  /** another screen is open over the farm: the cheer waits for it to close */
  busy: boolean;
  /** go to a farm with a problem, in the check flow */
  onGo: (item: RiskItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [harvestOpen, setHarvestOpen] = useState(false);
  const harvest = useMemo(() => harvestEstimate(s.trial, risk), [s.trial, risk]);
  const [saved, setSaved] = useState<{ amount: number; farms: number[]; id: number } | null>(null);
  const [cheer, setCheer] = useState<{ amount: number; id: number } | null>(null);
  // the button as the player last saw it, read once on opening: what grew while they were away
  const [away, setAway] = useState(() => {
    const snap = s.risk?.snap;
    if (!snap || snap.cycle !== risk.cycle || risk.total <= snap.total) return null;
    if (dayNumber(snap.at) >= dayNumber()) return null;
    return { from: snap.total, to: risk.total, grew: risk.items.filter(x => x.amount > (snap.amounts[x.key] ?? 0)).length };
  });

  // a problem leaves the list: dealt with (a cheer and the amount saved) or lost (nothing to cheer)
  const prev = useRef<RiskSummary | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = risk;
    if (!before || before.cycle !== risk.cycle || !s.trial) return;
    const gone = before.items.filter(x => !risk.items.some(y => y.key === x.key));
    const fixed = gone.filter(x => wasResolved(s.trial!, x.farm, x.start, dayNumber()));
    if (!fixed.length) return;
    // a gentler way of treating saves a little less of what was at risk (care/treatments.ts)
    const kept = (x: RiskItem) => {
      const way = treatmentOf(x.hazard, s.trial!.checks[checkKey(x.farm, risk.day || before.day)]?.treatment);
      return Math.round(x.amount * (way?.effect ?? 1));
    };
    const amount = fixed.reduce((n, x) => n + kept(x), 0);
    const at = Date.now();
    fixed.forEach(x => {
      dispatch({ type: 'riskFixed', fix: { key: x.key, farm: x.farm, amount: kept(x), fixedAt: at, daysOpen: x.daysOpen } });
      const seen = s.risk?.seenAt[x.key];
      track('risk_fixed', { farm: x.farm, amount: kept(x), daysOpen: x.daysOpen, msFromSeen: seen ? at - seen : null });
    });
    setSaved({ amount, farms: fixed.map(x => x.farm), id: at });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [risk]);

  // the cheer waits until the screen on top (a check, the fix) has closed
  useEffect(() => {
    if (!saved || busy) return;
    const id = window.setTimeout(() => {
      setCheer({ amount: saved.amount, id: saved.id });
      sfx.flow();
    }, 350);
    return () => window.clearTimeout(id);
  }, [saved, busy]);
  // the floating "saved" chip on the button
  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(x => (x && x.id === saved.id ? null : x)), 2600);
    return () => window.clearTimeout(id);
  }, [saved]);

  // the button as the player sees it: kept for "while you were away", and when each problem was first in view
  const sig = `${risk.cycle}|${risk.day}|${risk.items.map(x => `${x.key}=${x.amount}`).join(',')}|${hud}`;
  useEffect(() => {
    if (!s.trial || risk.day === 0) return;
    dispatch({
      type: 'riskSnap',
      total: risk.total,
      day: risk.day,
      cycle: risk.cycle,
      amounts: Object.fromEntries(risk.items.map(x => [x.key, x.amount])),
      at: Date.now(),
      seen: hud,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  const show = hud && (risk.anyEver || risk.total > 0);
  const clear = risk.total === 0;
  const harvestTime = risk.day > CHECK_DAYS;

  const tap = () => {
    setOpen(true);
    dispatch({ type: 'riskTap', row: false });
    track('risk_open', { total: risk.total, items: risk.items.length, day: risk.day });
  };

  const openHarvest = () => {
    setHarvestOpen(true);
    track('harvest_open', { income: harvest?.income ?? 0, atRisk: harvest?.atRisk ?? 0, day: risk.day });
  };

  return (
    <>
      {/* one card, top left: what the harvest brings in if it goes well, and attached under it, the money at risk on
          the farms today (the same number everywhere: the list, the sheet and the cheer) */}
      {hud && (harvest || show) && (
        <div className={`hud-money${show ? ' has-risk' : ''}`}>
          {harvest && <HarvestButton est={harvest} onClick={openHarvest} />}
          {show && (
            <button
              type="button"
              className={`hud-risk${clear ? ' is-clear' : ''}${saved ? ' is-saved' : ''}`}
              onClick={tap}
              aria-label={clear ? (harvestTime ? 'Harvest time: nothing more at risk' : 'All clear: nothing at risk on your farms') : `${money(risk.total)} at risk on your farms today. Tap to see where.`}
            >
              <span className="hud-risk-icon" aria-hidden="true">
                {clear ? '✓' : '!'}
              </span>
              <span className="hud-risk-text">
                {clear ? (
                  <b>{harvestTime ? 'Harvest time' : 'All clear'}</b>
                ) : (
                  <>
                    <b>{moneyCompact(risk.total)}</b> <i>at risk today</i>
                  </>
                )}
              </span>
              <span className="hud-risk-go" aria-hidden="true">
                ›
              </span>
              {saved && (
                <span key={saved.id} className="hud-risk-saved" aria-hidden="true">
                  {moneyCompact(saved.amount)} saved
                </span>
              )}
            </button>
          )}
        </div>
      )}
      {harvestOpen && harvest && (
        <HarvestSheet
          est={harvest}
          risk={risk}
          onClose={() => setHarvestOpen(false)}
          onRisk={() => {
            setHarvestOpen(false);
            setOpen(true);
            dispatch({ type: 'riskTap', row: false });
            track('risk_open', { total: risk.total, items: risk.items.length, day: risk.day, from: 'harvest' });
          }}
        />
      )}

      {open && (
        <RiskSheet
          risk={risk}
          onClose={() => setOpen(false)}
          onGo={item => {
            setOpen(false);
            dispatch({ type: 'riskTap', row: true });
            track('risk_row', { farm: item.farm, amount: item.amount, daysOpen: item.daysOpen, status: item.status });
            onGo(item);
          }}
        />
      )}

      {cheer && !busy && (
        <RiskCheer
          key={cheer.id}
          amount={cheer.amount}
          left={risk.total}
          onList={() => (setCheer(null), setOpen(true))}
          onClose={() => setCheer(null)}
        />
      )}

      {away && !cheer && !busy && hud && (
        <SuccessCard
          kicker="While you were away"
          title={`${moneyCompact(away.to)} at risk`}
          tone="gold"
          badge={<b style={{ color: '#fff', fontSize: 19 }}>!</b>}
          lead={`Left alone, problems on your farms grew: ${moneyCompact(away.from)} at risk when you left, ${moneyCompact(away.to)} now${away.grew ? ` (${away.grew} grew)` : ''}. Deal with them before they grow again.`}
          actions={[
            { label: 'See what is at risk', onClick: () => (setAway(null), setOpen(true)) },
            { label: 'Later', onClick: () => setAway(null), plain: true },
          ]}
          onClose={() => setAway(null)}
          label="At risk while you were away"
          width={400}
        />
      )}
    </>
  );
}

/** The cheer after a problem is dealt with: a card over the farm that does not stop play (taps go through around it)
    and closes itself after a few seconds. */
function RiskCheer({ amount, left, onList, onClose }: { amount: number; left: number; onList: () => void; onClose: () => void }) {
  // closes itself once, 5 seconds after it shows (the farm re-renders often: the timer is not restarted)
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const id = window.setTimeout(() => close.current(), 5000);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <div className="risk-cheer" role="dialog" aria-label="Money saved">
      <CloseX onClick={onClose} />
      <span className="risk-cheer-badge" aria-hidden="true">
        ✓
      </span>
      <div className="risk-cheer-text">
        <small>Caught in time</small>
        <b>{moneyCompact(amount)} saved</b>
        <i>{left > 0 ? `About ${money(amount)} of harvest kept · still at risk: ${moneyCompact(left)}` : `About ${money(amount)} of harvest kept · all clear`}</i>
      </div>
      {left > 0 && (
        <button type="button" className="risk-cheer-go" onClick={onList}>
          See what is at risk
        </button>
      )}
    </div>
  );
}

function RiskSheet({ risk, onClose, onGo }: { risk: RiskSummary; onClose: () => void; onGo: (item: RiskItem) => void }) {
  useEscape(onClose);
  const tomorrow = risk.items.reduce((n, x) => n + (x.next ?? x.amount), 0);
  const full = risk.items.reduce((n, x) => n + x.stated, 0);
  return (
    <div className="abs risk-layer" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Money at risk">
      <div className="success-scrim" onClick={onClose} />
      <div className="risk-sheet">
        <CloseX onClick={onClose} />
        <p className="risk-kicker">Money at risk</p>
        <p className="risk-total">{risk.total > 0 ? `${money(risk.total)} at risk today` : 'All clear'}</p>
        <p className="risk-lead">
          {risk.items.length
            ? 'Each farm here has a problem that will cost harvest if it is left. The longer it is left, the more it costs. Tap a farm to go and find out what it is.'
            : risk.day > CHECK_DAYS
              ? 'Harvest time: nothing more can be saved this cycle.'
              : 'Every problem on your farms is dealt with. Check them again tomorrow.'}
        </p>
        {risk.items.length > 0 && (
          <div className="sheet-stats">
            <span className="is-loss">
              <small>At risk today</small>
              <b>−{money(risk.total)}</b>
            </span>
            <span className="is-loss is-soft">
              <small>Tomorrow, if left</small>
              <b>−{money(tomorrow)}</b>
            </span>
            <span className="is-loss is-soft">
              <small>By harvest, if never fixed</small>
              <b>−{money(full)}</b>
            </span>
          </div>
        )}
        {risk.items.length > 0 && (
          <ul className="risk-list">
            {risk.items.map(x => (
              <li key={x.key}>
                <button type="button" onClick={() => onGo(x)} aria-label={`${farmName(x.farm)}: ${money(x.amount)} at risk. ${STATUS_WORDS[x.status]}. Go there.`}>
                  <span className="risk-farm">
                    <b>{farmName(x.farm)}</b>
                    <i>{x.plots ? `${x.plots} of 20 plots` : 'Plots 1–20'} · {STATUS_WORDS[x.status]}</i>
                  </span>
                  <span className="risk-amount">
                    <b>−{moneyCompact(x.amount)}</b>
                    <i>{growLine(x)}</i>
                  </span>
                  <span className="risk-go" aria-hidden="true">
                    ›
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {risk.shocks.length > 0 && (
          <div className="risk-shocks">
            <small>Forecast shocks this season</small>
            {risk.shocks.map(x => (
              <span key={x.shock}>
                {SHOCK_WORDS[x.shock]} <b>{moneyCompact(x.amount)}</b>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Beside the farmer's portrait: what the harvest is likely to bring in if it goes well, and under it, what the player
    is likely to lose if the problems on the farms now are not put right. */
function HarvestButton({ est, onClick }: { est: HarvestEstimate; onClick: () => void }) {
  const done = est.kind === 'done';
  const risky = !done && est.atRisk > 0;
  return (
    <button
      type="button"
      className={`hud-harvest${risky ? ' is-risky' : ''}`}
      onClick={onClick}
      aria-label={
        done
          ? `Last harvest: ${money(est.income)}. Tap for each farm.`
          : `Harvest estimate: ${money(est.income)} if your harvest goes well.${risky ? ` Up to ${money(est.atRisk)} less if the problems on your farms are never put right.` : ''} Tap for each farm.`
      }
    >
      <span className="hud-harvest-icon" aria-hidden="true">
        <img src={img.corn} alt="" width={30} height={30} />
      </span>
      <span className="hud-harvest-text">
        <i>{done ? 'Last harvest' : 'Harvest estimate'}</i>
        <b>{moneyCompact(est.income)}</b>
        <small className="hud-harvest-sub">{done ? `${est.bags} bags` : 'if it goes well'}</small>
      </span>
    </button>
  );
}

function HarvestSheet({ est, risk, onClose, onRisk }: { est: HarvestEstimate; risk: RiskSummary; onClose: () => void; onRisk: () => void }) {
  useEscape(onClose);
  const done = est.kind === 'done';
  const today = (farm: number) => risk.items.filter(x => x.farm === farm).reduce((n, x) => n + x.amount, 0);
  return (
    <div className="abs risk-layer" style={{ inset: 0 }} role="dialog" aria-modal="true" aria-label="Harvest estimate">
      <div className="success-scrim" onClick={onClose} />
      <div className="risk-sheet harvest-sheet">
        <CloseX onClick={onClose} />
        <p className="risk-kicker">{done ? 'Last harvest' : 'Harvest estimate'}</p>
        <p className="risk-total">{done ? `${money(est.income)} from the harvest` : `${money(est.income)} if it goes well`}</p>
        <p className="risk-lead">
          {done
            ? `Your farms brought in ${money(est.income)} for ${est.bags} bags. After what they cost (${money(est.costs)}), that is ${money(est.profit)}.`
            : `What your farms should bring in, the way you farm them now. They have cost ${money(est.costs)} so far: about ${money(est.profit)} after costs.`}
        </p>
        {!done && (
          <div className={`sheet-stats harvest-split${est.atRisk > 0 ? '' : ' is-clear'}`}>
            <span>
              <small>If it goes well</small>
              <b>{money(est.income)}</b>
            </span>
            <span className="is-loss">
              <small>At risk today</small>
              <b>{risk.total > 0 ? `−${money(risk.total)}` : money(0)}</b>
              {est.atRisk > risk.total && <em>Grows each day it is left: up to −{money(est.atRisk)}</em>}
            </span>
            <span>
              <small>If never put right</small>
              <b>{money(est.ifLeft)}</b>
            </span>
          </div>
        )}
        <ul className="risk-list harvest-list">
          {est.farms.map(x => (
            <li key={x.farm}>
              <span className="risk-farm">
                <b>{farmName(x.farm)}</b>
                <i>
                  {x.bags} bags · cost {moneyCompact(x.costs)}
                </i>
              </span>
              <span className="risk-amount">
                <b className="is-income">{moneyCompact(x.income)}</b>
                {!done && <i className={today(x.farm) ? 'is-loss' : ''}>{today(x.farm) ? `−${moneyCompact(today(x.farm))} at risk today` : 'Nothing at risk'}</i>}
              </span>
            </li>
          ))}
        </ul>
        {!done && risk.total > 0 && (
          <div className="sheet-foot">
            <button type="button" className="sheet-go" onClick={onRisk}>
              See what is at risk
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** When a problem's cost grows, and to what: never what it is. */
function growLine(x: RiskItem) {
  if (x.next === null) return x.daysOpen ? `Full cost · left ${x.daysOpen} day${x.daysOpen === 1 ? '' : 's'}` : 'Full cost';
  return `${moneyCompact(x.next)} in 1 day`;
}
