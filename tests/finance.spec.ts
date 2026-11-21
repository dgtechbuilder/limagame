import { expect, test } from '@playwright/test';
import { PRODUCTS, dailyProfit, dayRate, emptyFinance, farmProfit, financeOf, payoutOf, settle } from '../src/finance/model';
import { initialState, reducer, REVIEW_BASE, type GameState } from '../src/state';
import { walletOf } from '../src/wallet/model';
import { lifeOf } from '../src/livestock/model';
import { fromKsh, kshReal, money, setCountry } from '../src/money';
import { MONEY } from '../src/tractor/data';
import { DIESEL_PRICE, DRIVER_WAGE, FARMER_PAY_X, PAY_EFFICIENCY, TOOLS, bizOf, bestRoute, mapFor, myFarms, planDay, requestsFor, type Bookings } from '../src/business/model';
import { STORY, SHAMBAS, FARM_UPDATE } from '../src/first/data';
import { DEFAULT_PRICES, profitPerBag } from '../src/state';

/* Money: savings, investments and profit tracking (src/finance), the tractor business's pay and its 90% rule, and
   prices that make sense (a figure kept in real shillings is never shown 10 times too large). */

const farm = (over: Partial<GameState> = {}): GameState => ({ ...initialState, ...REVIEW_BASE, coins: 30000, ...over });
const nextDay = (s: GameState, days = 1): GameState => ({ ...s, life: { ...lifeOf(s.life), day: lifeOf(s.life).day + days } });

test('savings: in and out of the wallet, not counted as spending, and interest each farm day', () => {
  let s = reducer(farm(), { type: 'finDeposit', amount: 5000 });
  expect(s.coins).toBe(25000);
  expect(financeOf(s.finance).savings).toBe(5000);
  // the wallet writes the move as savings, which profit tracking leaves out
  const w = walletOf(s.wallet);
  expect(w.entries[0].kind).toBe('savings');
  expect(farmProfit(w, financeOf(s.finance)).total).toEqual({ in: 0, out: 0 });
  // a farm day passes: a week's interest at 6% a year
  s = reducer(nextDay(s), { type: 'finGoal', goal: { name: 'Tank', target: 8000 } });
  const f = financeOf(s.finance);
  expect(f.savings).toBeCloseTo(5000 * (1 + dayRate(PRODUCTS.savings.rate)), 1);
  expect(f.earned).toBeGreaterThan(0);
  expect(f.goal).toEqual({ name: 'Tank', target: 8000 });
  // money saved for the first time earns from that day on, not from farm day 1
  const late = reducer(farm({ life: { ...lifeOf(undefined), day: 9 } }), { type: 'finDeposit', amount: 1000 });
  expect(financeOf(late.finance).savings).toBe(1000);
  // too much, or nothing, can't go in
  expect(reducer(farm({ coins: 5 }), { type: 'finDeposit', amount: 100 }).coins).toBe(5);
  s = reducer(s, { type: 'finWithdraw', amount: 99999 });
  expect(financeOf(s.finance).savings).toBe(0);
});

test('investments: a fund grows, a Treasury bill is paid back on its day, out early loses the interest, shares can fall', () => {
  let s = reducer(farm(), { type: 'finInvest', product: 'tbill', amount: 3000 });
  s = reducer(s, { type: 'finInvest', product: 'mmf', amount: 2000 });
  expect(s.coins).toBe(25000);
  const bill = financeOf(s.finance).holdings.find(h => h.product === 'tbill')!;
  expect(bill.matures).toBe(lifeOf(s.life).day + PRODUCTS.tbill.lockDays);
  // out early: the principal back, no interest
  expect(payoutOf({ ...bill, value: 3100 }, bill.since + 1)).toEqual({ pay: 3000, fee: 0, early: true });
  // its day comes: paid back into the wallet with 13 weeks of interest at 13% a year
  const coins = s.coins;
  s = reducer(nextDay(s, PRODUCTS.tbill.lockDays), { type: 'finGoal', goal: null });
  const f = financeOf(s.finance);
  expect(f.holdings.map(h => h.product)).toEqual(['mmf']);
  const back = 3000 * (1 + dayRate(PRODUCTS.tbill.rate)) ** PRODUCTS.tbill.lockDays;
  expect(s.coins - coins).toBeCloseTo(back, 0);
  expect(walletOf(s.wallet).entries[0].label).toMatch(/Treasury bill paid back/);
  expect(f.holdings[0].value).toBeGreaterThan(2000);
  // shares move both ways from day to day, and selling pays a fee
  const moves = Array.from({ length: 60 }, (_, d) => settle({ ...emptyFinance(), holdings: [{ id: 1, product: 'shares', principal: 1000, value: 1000, since: d }], settled: d }, d + 1).f.holdings[0].value);
  expect(moves.some(v => v < 1000)).toBe(true);
  expect(moves.some(v => v > 1000)).toBe(true);
  expect(payoutOf({ id: 1, product: 'shares', principal: 1000, value: 1000, since: 1 }, 2).fee).toBe(15);
});

test('profit tracking: each part of the farm, and money in and out by farm day', () => {
  let s = reducer(farm(), { type: 'kakumaGive', gift: 'small' });
  s = reducer(nextDay(s), { type: 'finDeposit', amount: 100 });
  const w = walletOf(s.wallet);
  const days = dailyProfit(w);
  expect(days.length).toBeGreaterThan(0);
  const p = farmProfit(w, financeOf(s.finance));
  expect(p.profit).toBe(p.total.in - p.total.out + financeOf(s.finance).earned);
});

test('the tractor business: farmers pay 10 times the market hire, costs are real, and under 90% efficiency it is a loss', () => {
  // the hire is 10 times the market's, in stored money; diesel and the driver are real shillings
  expect(TOOLS.plough.hire).toBe(fromKsh(MONEY.ploughHire.value) * FARMER_PAY_X);
  expect(DIESEL_PRICE).toBe(fromKsh(228));
  expect(DRIVER_WAGE).toBe(fromKsh(1000));
  setCountry('KE');
  expect(kshReal(MONEY.diesel.value)).toBe('KSh 228');
  expect(money(TOOLS.plough.hire)).toBe('KSh 30,000');

  const b = bizOf({ day: 1 });
  const m = mapFor(b.day);
  const req = requestsFor(b);
  // book every job the hub tractor can do
  const bookings: Bookings = {};
  for (const k of req) bookings[k] = 'me';
  const fit = planDay(b, req, bookings, bestRoute(m, myFarms(bookings)));
  const farms = myFarms(bookings);
  expect(farms.length).toBeGreaterThanOrEqual(2);
  const best = bestRoute(m, farms);
  const top = planDay(b, req, bookings, best);
  expect(top.efficiency).toBeGreaterThanOrEqual(PAY_EFFICIENCY);
  expect(top.refund).toBe(0);
  expect(top.profit).toBeGreaterThan(0);
  // the worst order through the same farms
  const perms = (xs: string[]): string[][] => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p])));
  const worst = perms(farms).map(r => planDay(b, req, bookings, r)).sort((x, y) => x.efficiency - y.efficiency)[0];
  if (worst.efficiency < PAY_EFFICIENCY) {
    expect(worst.refund).toBeGreaterThan(0);
    expect(worst.profit).toBeLessThan(0);
    // the loss grows as the efficiency falls: what the day earns is that share of its costs
    expect(worst.profit).toBe(Math.floor((worst.diesel + worst.wage + worst.hubFee) * worst.efficiency) - (worst.diesel + worst.wage + worst.hubFee));
  }
  expect(fit.problem === null || typeof fit.problem === 'string').toBe(true);
});

test('prices make sense: the story adds up, a bag of maize, the farm update', () => {
  const ledger = STORY.find(p => p.ledger)!.ledger!;
  expect(ledger[0].ksh - ledger[1].ksh).toBe(ledger[2].ksh);
  // the first-session farm costs about what the six farms do an acre, not ten times more
  expect(ledger[0].ksh).toBeLessThan(15000);
  // catching both problems turns the season back towards breaking even
  const caught = FARM_UPDATE.atThisRate + SHAMBAS.first.atStake + SHAMBAS.sukuma.atStake;
  expect(Math.abs(caught - FARM_UPDATE.spent) / FARM_UPDATE.spent).toBeLessThan(0.1);
  // a 90 kg bag sells for KSh 3,000 to 4,000 after costs
  setCountry('KE');
  expect(profitPerBag(DEFAULT_PRICES)).toBeGreaterThan(300);
  expect(profitPerBag(DEFAULT_PRICES)).toBeLessThan(400);
});
