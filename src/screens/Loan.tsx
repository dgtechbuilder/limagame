import type { Dispatch } from 'react';
import { ModalShell } from '../components/Modal';
import { Coin, GoldButton } from '../components/ui';
import { money } from '../money';
import { basePerBag, expectedHarvest, type Action, type GameState } from '../state';
import {
  DEFAULT_LOAN,
  LOAN_FEE,
  LOAN_MAX,
  LOAN_MIN,
  LOAN_MONTHS,
  LOAN_PURPOSES,
  LOAN_STEP,
  SEASON_MONTHS,
  VERDICT_TEXT,
  VOUCHER_OFF,
  loanQuote,
  monthlyPayment,
  purposeOf,
  type LoanAsk,
} from '../finance/loan';

/* The loan calculator (Menu → Loan calculator): pick what the loan is for, how much and over how many months, then
   "Get my quote" opens the Loan Quote Result: the monthly repayment, what it costs in all, and whether the farm can
   carry it. A calculator only: no coins change hands. */

type Props = { s: GameState; dispatch: Dispatch<Action>; view?: 'calc' | 'quote' };

/** Coins a month the farm earns: the last seasons' sales, or this season's expected harvest, spread over a season. */
export function farmIncome(s: GameState) {
  const sold = s.history.slice(-3).map(h => h.revenue);
  const season = sold.length ? sold.reduce((a, b) => a + b, 0) / sold.length : expectedHarvest(s, 'wait2').bags * basePerBag(s.prices);
  return Math.max(1, season / SEASON_MONTHS);
}

const FRAME = { x: 116, y: 32, close: [714, 46] as [number, number] };
const PANEL = { left: 138, top: 72, width: 602, height: 270 };

export function LoanModal({ s, dispatch, view = 'calc' }: Props) {
  const ask: LoanAsk = { ...DEFAULT_LOAN, ...s.loan };
  const set = (patch: Partial<LoanAsk>) => dispatch({ type: 'loanAsk', ask: patch });
  const close = () => dispatch({ type: 'close' });
  const voucher = s.redeemed.includes('phone');
  const quote = loanQuote(ask, farmIncome(s), voucher);
  const title = view === 'quote' ? 'Your loan quote' : 'Loan calculator';

  return (
    <ModalShell frame="wide" x={FRAME.x} y={FRAME.y} title={title} close={FRAME.close} onClose={close}>
      <div className="panel loan" style={PANEL}>
        {view === 'quote' ? <Quote s={s} dispatch={dispatch} q={quote} /> : <Calculator ask={ask} set={set} voucher={voucher} onQuote={() => dispatch({ type: 'open', modal: { kind: 'loan', view: 'quote' } })} />}
      </div>
    </ModalShell>
  );
}

/* ---------------- the calculator ---------------- */

function Calculator({ ask, set, voucher, onQuote }: { ask: LoanAsk; set: (p: Partial<LoanAsk>) => void; voucher: boolean; onQuote: () => void }) {
  const purpose = purposeOf(ask.purpose);
  const rate = voucher ? Math.round(purpose.rate * (1 - VOUCHER_OFF) * 10) / 10 : purpose.rate;
  const step = (d: number) => set({ amount: Math.max(LOAN_MIN, Math.min(LOAN_MAX, ask.amount + d)) });
  return (
    <>
      <div className="loan-col loan-purposes">
        <p className="loan-label">1 · What is the loan for?</p>
        <div className="loan-purpose-grid" role="radiogroup" aria-label="What the loan is for">
          {LOAN_PURPOSES.map(p => (
            <button key={p.id} type="button" role="radio" aria-checked={ask.purpose === p.id} className={`loan-purpose${ask.purpose === p.id ? ' is-on' : ''}`} onClick={() => set({ purpose: p.id })}>
              <span aria-hidden="true">{p.icon}</span>
              <b>{p.label}</b>
              <small>{p.rate}% a year</small>
            </button>
          ))}
        </div>
        <p className="loan-note">{purpose.note}.{voucher ? ` Your Phone Loan Discount takes ${Math.round(VOUCHER_OFF * 100)}% off the rate.` : ' Redeem the Phone Loan Discount in Rewards for a lower rate.'}</p>
      </div>

      <div className="loan-col loan-inputs">
        <p className="loan-label">2 · How much?</p>
        <div className="loan-amount">
          <button type="button" className="loan-step" onClick={() => step(-LOAN_STEP)} disabled={ask.amount <= LOAN_MIN} aria-label="Borrow less">
            −
          </button>
          <span className="loan-amount-value">
            <Coin size={18} /> <output aria-live="polite">{money(ask.amount)}</output>
          </span>
          <button type="button" className="loan-step" onClick={() => step(LOAN_STEP)} disabled={ask.amount >= LOAN_MAX} aria-label="Borrow more">
            +
          </button>
        </div>
        <input
          className="loan-range"
          type="range"
          min={LOAN_MIN}
          max={LOAN_MAX}
          step={LOAN_STEP}
          value={ask.amount}
          aria-label="Amount to borrow"
          onChange={e => set({ amount: Number(e.target.value) })}
        />
        <p className="loan-label" style={{ marginTop: 8 }}>
          3 · Over how many months?
        </p>
        <div className="seg loan-months" role="radiogroup" aria-label="Months to pay back">
          {LOAN_MONTHS.map(m => (
            <button key={m} type="button" role="radio" aria-checked={ask.months === m} className={ask.months === m ? 'is-on' : undefined} onClick={() => set({ months: m })}>
              {m}
            </button>
          ))}
        </div>
        <p className="loan-preview">
          About <Coin size={12} /> <b>{money(monthlyPayment(ask.amount, rate, ask.months))}</b> a month at {rate}% a year
        </p>
        <GoldButton font={11} height={32} style={{ width: '100%', marginTop: 'auto' }} onClick={onQuote}>
          Get my quote
        </GoldButton>
      </div>
    </>
  );
}

/* ---------------- the Loan Quote Result ---------------- */

function Quote({ s, dispatch, q }: { s: GameState; dispatch: Dispatch<Action>; q: ReturnType<typeof loanQuote> }) {
  const purpose = purposeOf(q.ask.purpose);
  const verdict = VERDICT_TEXT[q.verdict];
  const maxBar = Math.max(...q.schedule.map(m => m.principal + m.interest));
  const share = Math.min(1, q.share);
  return (
    <>
      <div className="loan-col loan-result">
        <p className="loan-kicker">
          <span aria-hidden="true">{purpose.icon}</span> {purpose.label}
        </p>
        <p className="loan-label">You would pay</p>
        <p className="loan-big">
          <Coin size={22} /> {money(q.monthly)}
          <small>/ month</small>
        </p>
        <p className="loan-sub">
          for {q.ask.months} months at {q.rate}% a year
          {q.voucher && <span className="loan-voucher">Voucher −{Math.round(VOUCHER_OFF * 100)}%</span>}
        </p>
        <dl className="loan-rows">
          <div>
            <dt>You borrow</dt>
            <dd>
              <Coin size={12} /> {money(q.ask.amount)}
            </dd>
          </div>
          <div>
            <dt>Interest</dt>
            <dd>
              <Coin size={12} /> {money(q.interest)}
            </dd>
          </div>
          <div>
            <dt>Processing fee ({(LOAN_FEE * 100).toFixed(1)}%)</dt>
            <dd>
              <Coin size={12} /> {money(q.fee)}
            </dd>
          </div>
          <div className="is-total">
            <dt>Total to pay back</dt>
            <dd>
              <Coin size={12} /> {money(q.total)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="loan-col loan-check">
        <p className="loan-label">Can your farm carry it?</p>
        <p className={`loan-verdict is-${q.verdict}`}>{verdict.label}</p>
        <div className="loan-share" aria-label={`${Math.round(q.share * 100)}% of the farm's income a month`}>
          <span className={`is-${q.verdict}`} style={{ width: `${Math.max(3, share * 100)}%` }} />
          <i style={{ left: '30%' }} />
          <i style={{ left: '50%' }} />
        </div>
        <p className="loan-small">
          {Number.isFinite(q.share) ? `${Math.round(q.share * 100)}%` : 'All'} of about <Coin size={10} /> {money(q.income)} the farm earns a month{' '}
          {s.history.length ? `(your last ${Math.min(3, s.history.length) === 1 ? 'season' : `${Math.min(3, s.history.length)} seasons`})` : '(this season’s expected harvest)'}.
        </p>
        <p className="loan-small">{verdict.line}</p>
        {q.verdict !== 'comfortable' && q.safeAmount >= LOAN_MIN && (
          <p className="loan-small">
            <b>
              Up to <Coin size={10} /> {money(q.safeAmount)}
            </b>{' '}
            over {q.ask.months} months keeps it comfortable.
          </p>
        )}
        <div className="loan-bars" aria-hidden="true">
          {q.schedule.map(m => (
            <span key={m.month} style={{ height: `${((m.principal + m.interest) / maxBar) * 100}%` }}>
              <i style={{ height: `${(m.interest / (m.principal + m.interest)) * 100}%` }} />
            </span>
          ))}
        </div>
        <p className="loan-legend">
          <span className="is-loan" /> the loan <span className="is-interest" /> interest, month by month
        </p>
      </div>

      <div className="loan-actions">
        <button type="button" className="success-plain" onClick={() => dispatch({ type: 'open', modal: { kind: 'loan', view: 'calc' } })}>
          ‹ Change the amounts
        </button>
        {q.verdict !== 'comfortable' && q.safeAmount >= LOAN_MIN && (
          <button
            type="button"
            className="success-plain"
            onClick={() => dispatch({ type: 'loanAsk', ask: { amount: q.safeAmount } })}
          >
            Try {money(q.safeAmount)}
          </button>
        )}
        <GoldButton font={10} height={28} style={{ width: 150 }} onClick={() => dispatch({ type: 'close' })}>
          Done
        </GoldButton>
      </div>
      <p className="loan-foot">A quote to plan with: game figures, no coins change hands.</p>
    </>
  );
}
