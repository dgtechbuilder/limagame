/* The farm's newer systems, through the days, as the water and the animals are: after every action, look at what it
   did and what day it is. When a farm day ends (a night slept on the fast clock, or a calendar day), the power system
   runs its day (src/power), the cow shed's gutters catch rain, the greenhouse's beds are watered by the drip or go
   thirsty (src/greenhouse), fresh produce wilts in a store with no cold room (src/produce: half as fast once the
   storehouse is open, src/storehouse), and the morning brings what is new to
   build. Driving wears the tractor and burns its diesel (src/tractor/hub.ts); the milk cooler pays a premium; a share
   of each harvest goes into the store for the market stall. */

import { toast, type Action, type GameState, type Modal } from '../state';
import { BASICS, lessonForDay } from '../learn/glossary';
import { LIFE, shedOption } from '../livestock/config';
import { lifeOf } from '../livestock/model';
import { capacityOf, tankOf } from '../water/model';
import { record } from '../climate/model';
import { addEntry } from '../wallet/model';
import { POWER, POWER_STEPS } from '../power/config';
import { has, lightsEggs, loadOn, powerOf, powerOn, runDay } from '../power/model';
import { HUB, hubOf } from '../tractor/hub';
import { MARKET, PRODUCE, atRisk, daySale, qualityNight, stock, storeNight, type ProduceId } from '../produce/model';
import { gradeName, type GradeDrop, type StoreCtx } from '../produce/quality';
import { achClock } from '../achievements/track';
import { GREENHOUSE, ghCropOf, greenhouseNight, greenhouseOf } from '../greenhouse/model';
import { cropOf } from '../trials/model';
import { popcount } from '../world/field';
import { money } from '../money';

/** Fresh produce keeps (and fetches more) in the cold room the power system runs. */
export const coldRoom = (s: Pick<GameState, 'power'>) => loadOn(s, 'cooler');
/** What the store has to keep its food in today: the storehouse (from the day it opens), the cold room, what was bought. */
export const storeCtx = (s: Pick<GameState, 'power' | 'produce' | 'life'>, day = lifeOf(s.life).day): StoreCtx => ({ storehouse: day >= GREENHOUSE.openDay, coldRoom: coldRoom(s), owned: s.produce?.owned ?? [] });

const foodWord = (id: ProduceId) => PRODUCE[id].name.toLowerCase().replace(/ \(.*\)/, '');
/** The drops in a few words: "12 kg tomatoes to Grade 2, 4 kg spinach spoils". */
export const dropWords = (drops: GradeDrop[], max = 3) =>
  [...drops]
    .sort((a, b) => b.loss - a.loss)
    .slice(0, max)
    .map(d => `${d.kg} kg ${foodWord(d.id)} ${d.to === null ? 'spoils' : `to ${gradeName(d.to)}`}`)
    .join(', ');
/** The workshop's power tools make tractor work cheaper. */
export const repairCut = (s: Pick<GameState, 'power'>) => (loadOn(s, 'workshop') ? POWER.repairCut : 0);
/** The rain a day's gutters catch, by the season. */
const RAIN_SHARE = { dry: 0.3, normal: 1, wet: 1.6 } as const;

let morningId = 0;

/** One farm day ended (`ended` is the day that ended). */
function endDay(s: GameState, ended: number): GameState {
  let next = s;
  const cap = capacityOf(next);
  const addWater = (litres: number) => {
    const t = tankOf(next.tank);
    const got = Math.max(0, Math.min(litres, cap - t.level));
    if (got > 0) next = { ...next, tank: { ...t, level: t.level + got } };
    return got;
  };
  // the power system's day
  if (powerOn(next)) {
    const r = runDay(next, ended);
    next = { ...next, power: r.power, ...(r.tank ? { tank: r.tank } : {}) };
    const d = r.d;
    if (d.avoided > 0 || d.emitted > 0) {
      const { c, levelUp } = record(next.climate, `Power · farm day ${ended}: ${d.solar} kWh of sun${d.gen ? `, ${d.gen} kWh from ${d.fuelL} L of diesel` : ''}`, 'land', {
        emit: d.emitted ? { fuel: d.emitted } : {},
        diesel: d.fuelL || undefined,
        credits: d.avoided / 10,
      });
      next = { ...next, climate: c, ...(levelUp ? { points: next.points + levelUp.points } : {}) };
    }
  }
  // the cow shed's gutters
  const shed = shedOption(lifeOf(next.life).shed);
  if (shed) addWater(Math.round(shed.gutter * RAIN_SHARE[next.trial?.forecast ?? 'normal']));
  // the greenhouse: the drip waters its beds if it has power and water
  const g0 = greenhouseOf(next.greenhouse);
  const wants = g0.beds.reduce((n, b) => n + (b.crop ? Math.round(ghCropOf(b.crop).water * POWER.dripShare) : 0), 0);
  const drip = loadOn(next, 'pump') && wants > 0 && tankOf(next.tank).level >= wants;
  const gn = greenhouseNight(next.greenhouse, ended, drip, POWER.dripShare);
  if (gn.litres) {
    const t = tankOf(next.tank);
    next = { ...next, tank: { ...t, level: Math.max(0, t.level - gn.litres) } };
  }
  next = { ...next, greenhouse: gn.g };
  // the daily sales cycle: the stall sells what is left of the day's 25 kg, then the store's night
  const sale = daySale(next.produce, ended, achClock.today(), coldRoom(next));
  if (sale) {
    next = { ...next, produce: sale.p, coins: next.coins + sale.earned };
    next = addEntry(next, 'produce', `Market stall, farm day ${ended}: ${sale.kg} kg sold`, sale.earned, next.coins);
    saleLog.push({ day: ended, kg: sale.kg, earned: sale.earned, profit: sale.earned - sale.cost, items: sale.items });
  }
  next = { ...next, produce: storeNight(next.produce, coldRoom(next), ended >= GREENHOUSE.openDay) };
  // the graded food loses quality by how it is stored: some drops a grade, and what falls below Grade 3 spoils
  const qn = qualityNight(next.produce, storeCtx(next, ended));
  next = { ...next, produce: qn.p };
  nightLog.push(...qn.drops);
  return next;
}

/** The last day's sale at the stall, for the morning's words. */
type DaySale = { day: number; kg: number; earned: number; profit: number; items: Partial<Record<ProduceId, number>> };
const saleLog: DaySale[] = [];
/** What dropped a grade (or spoiled) in the store last night. */
const nightLog: GradeDrop[] = [];
const saleWords = (x: DaySale) =>
  (Object.entries(x.items) as [ProduceId, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([id, kg]) => `${kg} kg ${PRODUCE[id].name.toLowerCase().replace(/ \(.*\)/, '')}`)
    .join(', ');

/** What is new this morning: today's power part, the cow shed, the greenhouse and the storehouse. */
function morningNews(s: GameState, day: number) {
  const lines: { icon: string; title: string; text: string; go: Modal; lesson?: number }[] = [];
  const step = POWER_STEPS.find(p => p.day === day && !has(s, p.id));
  if (step) lines.push({ icon: step.icon, title: step.id === 'switchOn' ? 'Switch on the power' : `Put in the ${step.name.toLowerCase()}`, text: `${step.does} Walk to the power yard (top right) or tap POWER.`, go: { kind: 'power', tab: 'build' } });
  if (day === LIFE.shedDay && !lifeOf(s.life).shed) lines.push({ icon: '🐄', title: 'Upgrade the cow shed', text: 'A roof, a dry floor and troughs: more milk and fewer diseases. Walk to the pen.', go: { kind: 'animals', tab: 'shed' } });
  if (day === GREENHOUSE.openDay) {
    lines.push({ icon: '🍅', title: 'The greenhouse is open', text: 'Four beds under glass: plant tomatoes, capsicum, cucumbers, strawberries or chillies. It stands at the bottom of the farm, left of the market path.', go: { kind: 'greenhouse', bed: 0 } });
    lines.push({ icon: '🏚️', title: 'The storehouse is open', text: 'Your harvests are kept here, and wilt half as fast in its shade. Make tomato sauce, jam, pickles or maize flour that sell for more. Right of the market path.', go: { kind: 'storehouse', tab: 'produce' } });
  }
  // the Farm basics lesson for the day, for players new to farming
  const lesson = lessonForDay(day);
  if (lesson !== null && !(s.basics ?? []).includes(lesson)) lines.push({ icon: BASICS[lesson].icon, title: `Farm basics: ${BASICS[lesson].title.toLowerCase()}`, text: BASICS[lesson].lead, go: { kind: 'glossary', tab: 'basics' }, lesson });
  return lines;
}

export function trackSystems(prev: GameState, s: GameState, a: Action): GameState {
  if (a.type === 'reset') return s;
  let next = s;

  // a farm day (or more) ended
  const d0 = lifeOf(prev.life).day;
  const d1 = lifeOf(next.life).day;
  if (d1 > d0 && next.fs.phase === 'done') {
    saleLog.length = 0;
    nightLog.length = 0;
    for (let d = d0; d < d1; d++) next = endDay(next, d);
    // the power system counts from the day it was switched on
    const p = powerOf(next.power);
    if (p.parts.switchOn) next = { ...next, power: { ...p, day: d1 } };
    const lines = morningNews(next, d1);
    // the daily reminder: what drops a grade tonight if it is not sold today (and what went last night)
    const risk = atRisk(next.produce, storeCtx(next, d1));
    let remindText = '';
    if (risk.length) {
      const loss = risk.reduce((n, d) => n + d.loss, 0);
      const went = nightLog.filter(d => d.to === null);
      remindText = `Tonight ${dropWords(risk)}: ${money(loss)} less at the stall if it waits.${went.length ? ` Last night ${dropWords(went)}.` : ''} Sell it today, or store it better.`;
      if (!next.success) lines.push({ icon: '⏳', title: 'Sell before prices drop', text: remindText, go: { kind: 'market', tab: 'sell' } });
    }
    // the stall's sale: on the morning's news when there is news, otherwise a short message
    const sold = saleLog[saleLog.length - 1];
    if (sold) {
      const text = `${saleWords(sold)} · +${money(sold.earned)}, a profit of ${money(sold.profit)} over what it cost to grow.`;
      if (lines.length && !next.success) lines.push({ icon: '🧺', title: `The stall sold ${sold.kg} kg on day ${sold.day}`, text, go: { kind: 'market', tab: 'sales' } });
      else next = { ...next, toast: toast(`Market stall, day ${sold.day}: ${sold.kg} kg sold · +${money(sold.earned)} · profit ${money(sold.profit)}`) };
    }
    // the night's own news took the morning: the reminder is a message instead
    if (remindText && next.success) next = { ...next, toast: toast([sold ? next.toast?.text : '', `Sell before prices drop: ${remindText}`].filter(Boolean).join(' · ')) };
    if (lines.length && !next.success) next = { ...next, success: { kind: 'morning', id: ++morningId, day: d1, lines } };
  }

  // driving wears the tractor and burns its diesel
  const wear = (points: number, litres: number) => {
    const h = hubOf(next.hub);
    next = { ...next, hub: { ...h, condition: Math.max(0, Math.round((h.condition - points) * 10) / 10), fuel: Math.max(0, Math.round((h.fuel - litres) * 100) / 100) } };
  };
  if (a.type === 'fieldMark' && a.tractor && next.field !== prev.field) {
    const n = popcount(a.bits);
    wear(n * HUB.perPlotWear, n * HUB.perPlotL);
  }
  if (a.type === 'tractorDone' && next.trial !== prev.trial) wear(HUB.driveWear, 1.5);
  if (a.type === 'bizRun' && next.biz !== prev.biz) wear(HUB.bizWear, 4);

  // the milk cooler: chilled milk fetches more at the dairy; the lights keep the hens laying longer
  if (a.type === 'animalCare' && next.coins > prev.coins) {
    const earned = next.coins - prev.coins;
    const bonus = a.id === 'milk' && loadOn(prev, 'cooler') ? earned * POWER.milkPremium : a.id === 'eggs' && lightsEggs(prev) ? earned * lightsEggs(prev) : 0;
    if (bonus > 0) {
      const b = Math.round(bonus * 100) / 100;
      next = { ...next, coins: next.coins + b };
      next = addEntry(next, 'power', a.id === 'milk' ? 'Chilled milk premium (milk cooler)' : 'Extra eggs (lights in the coop)', b, next.coins);
      next = { ...next, toast: toast(`${next.toast?.text ?? ''} · +${money(b)} ${a.id === 'milk' ? 'for chilled milk' : 'from the lit coop'}`) };
    }
  }

  // the harvest: a share goes into the store for the market stall
  if (a.type === 'trialHarvest' && prev.trial && next.trial?.phase === 'done' && prev.trial.phase === 'growing') {
    const add: Partial<Record<ProduceId, number>> = {};
    next.trial.results?.forEach((r, farm) => {
      const id: ProduceId = cropOf(next.trial!, farm) === 'kale' ? 'sukuma' : 'maize';
      add[id] = (add[id] ?? 0) + Math.round(r.bags * MARKET.bagKg * MARKET.keepShare);
      // the beans grown between the maize rows
      if (r.beans > 0) add.drybeans = (add.drybeans ?? 0) + Math.round(r.beans * MARKET.bagKg * MARKET.beanShare);
    });
    next = { ...next, produce: stock(next.produce, add) };
    const kg = Object.values(add).reduce((n, v) => n + (v ?? 0), 0);
    if (kg > 0) next = { ...next, toast: toast(`${next.toast?.text ?? 'Harvest sold'} · ${kg} kg kept in the store: sell ${MARKET.dailyKg} kg a day at the stall`) };
  }
  return next;
}

