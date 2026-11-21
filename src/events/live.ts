/* Events › Happening now: everything going on across the game world today, in one list, each with the page that deals
   with it (its address, src/route.ts). Worked out from the game's state; nothing here is saved. */

import type { GameState } from '../state';
import { achClock } from '../achievements/track';
import { achOfSave, unclaimed } from '../achievements/model';
import { tidyCount } from '../tidy/model';
import { careLeft, careOpen, lifeOf } from '../livestock/model';
import { securityOf, theftOpen } from '../security/model';
import { nextStep } from '../power/model';
import { leftToday, produceOf, storeKg } from '../produce/model';
import { sixFarmsDue } from '../route';
import { daysOn, daysTo, daysAhead } from './days';
import { CRISES, focusRegion, givingOf } from './regions';
import { BRANDS } from '../partners/data';
import { KAKUMA_EVENT, daysToGo, kakumaPhase } from './model';

export type EventWhere = 'world' | 'farm' | 'animals' | 'business';

export const WHERE: Record<EventWhere, string> = { world: 'Across Africa', farm: 'On the farm', animals: 'Animals & safety', business: 'Money & partners' };

export interface LiveEvent {
  id: string;
  icon: string;
  title: string;
  text: string;
  where: EventWhere;
  /** 'now': something to do today; 'done': today's part is done; 'soon': coming up */
  status: 'now' | 'done' | 'soon';
  /** the label on its button, and the address it opens */
  cta: string;
  go: string;
}

/** a, b and c */
const listText = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');

export function liveEvents(s: GameState, today = achClock.today()): LiveEvent[] {
  const out: LiveEvent[] = [];
  const life = lifeOf(s.life);

  // ---------- across Africa ----------
  for (const d of daysOn(today)) {
    const n = daysTo(d, today);
    out.push({ id: `day-${d.id}`, icon: d.icon, title: d.name, text: `${n === 0 ? 'Today' : n > 0 ? `In ${n} day${n > 1 ? 's' : ''}` : 'This week'}: ${d.task} Gifts to the regions earn double points.`, where: 'world', status: 'now', cta: 'Take part', go: d.go });
  }
  // the Kakuma special event with the World Food Programme (src/events/model.ts)
  const kk = kakumaPhase();
  if (kk !== 'over') {
    const n = daysToGo();
    out.push({ id: 'kakuma', icon: '🍲', title: `Kakuma, with the ${KAKUMA_EVENT.partner}`, text: kk === 'on' ? `On now until ${KAKUMA_EVENT.dates.split('–')[1]}: learn about food in Kakuma refugee camp and give.` : `${KAKUMA_EVENT.dates}, in ${n} day${n === 1 ? '' : 's'}: read about Kakuma refugee camp now.`, where: 'world', status: kk === 'on' ? 'now' : 'soon', cta: 'Open the event', go: '/kakuma' });
  }
  const focus = focusRegion(today);
  const given = givingOf(s.giving).totals[focus.id] ?? 0;
  out.push({ id: 'appeal', icon: focus.icon, title: `Appeal of the week: ${focus.name}`, text: `Facing ${listText(focus.crises.map(c => CRISES[c].label.toLowerCase()))}. Gifts there earn double points this week.`, where: 'world', status: given ? 'done' : 'now', cta: 'See the region', go: `/events/regions/${focus.id}` });
  if (!daysOn(today).length) {
    const next = daysAhead(today)[0];
    if (next) out.push({ id: `next-${next.id}`, icon: next.icon, title: next.name, text: `In ${daysTo(next, today)} days: ${next.line}`, where: 'world', status: 'soon', cta: 'Special days', go: '/events/special-days' });
  }

  // ---------- on the farm ----------
  const tidy = tidyCount(s.tidy, today);
  out.push({ id: 'tidy', icon: '🪨', title: 'Daily tidy-up', text: tidy.done >= tidy.total ? 'Every bush and rock cleared today.' : `${tidy.done} of ${tidy.total} bushes and rocks cleared today.`, where: 'farm', status: tidy.done >= tidy.total ? 'done' : 'now', cta: 'Go to the farm', go: '/farm' });
  if (sixFarmsDue(s)) out.push({ id: 'six', icon: '🌽', title: 'The six farms: today’s checks', text: 'Your six farms are growing: read each one today.', where: 'farm', status: 'now', cta: 'Check them', go: '/rounds/six-farms' });
  else out.push({ id: 'mission', icon: '🌽', title: 'Mission: the six farms', text: s.trial ? 'Your farms are in: see the plan and the results.' : 'Plant six farms to six plans and compare the harvests.', where: 'farm', status: s.trial ? 'done' : 'soon', cta: 'Open Mission', go: '/mission' });
  const step = nextStep(s);
  if (step) out.push({ id: 'power', icon: step.icon, title: `Power: ${step.name}`, text: life.day >= step.day ? `${step.task}: it goes in today.` : `Goes in on day ${step.day}.`, where: 'farm', status: life.day >= step.day ? 'now' : 'soon', cta: 'Power yard', go: '/power/build' });
  const p = produceOf(s.produce);
  if (storeKg(p) > 0) {
    const left = leftToday(p, life.day);
    out.push({ id: 'market', icon: '🧺', title: 'Market stall', text: left > 0 ? `${Math.round(storeKg(p))} kg in store: sell up to ${left} kg today.` : 'Today’s selling is done.', where: 'farm', status: left > 0 ? 'now' : 'done', cta: 'Open the stall', go: '/market' });
  }

  // ---------- animals and safety ----------
  if (careOpen(s)) {
    const left = careLeft(s).length;
    out.push({ id: 'care', icon: '🐄', title: 'Animal care', text: left ? `${left} job${left > 1 ? 's' : ''} left for the cows and hens today.` : 'The cows and hens are cared for today.', where: 'animals', status: left ? 'now' : 'done', cta: 'Animals', go: '/animals/today' });
    if (life.issues.length) out.push({ id: 'sick', icon: '🩺', title: 'Sick animals', text: `${life.issues.length} problem${life.issues.length > 1 ? 's' : ''} to treat by their signs.`, where: 'animals', status: 'now', cta: 'Treat them', go: '/animals/health' });
  } else out.push({ id: 'care', icon: '🐄', title: 'The animals arrive', text: 'The cows and hens come into your care on day 2.', where: 'animals', status: 'soon', cta: 'Animals', go: '/animals/today' });
  if (theftOpen(s)) {
    const last = securityOf(s.security).reports[0];
    const thefts = last?.events.filter(e => e.kind === 'theft' || e.kind === 'predator').length ?? 0;
    out.push({ id: 'night', icon: '🌙', title: 'Last night', text: !last ? 'No night report yet: keep thieves off the farm.' : thefts ? `${thefts} thing${thefts > 1 ? 's' : ''} went wrong in the night.` : 'A quiet night: nothing taken.', where: 'animals', status: thefts ? 'now' : 'done', cta: 'Night reports', go: '/security/night-reports' });
  }

  // ---------- money and partners ----------
  const waiting = unclaimed(achOfSave(s.ach), today);
  out.push({ id: 'rewards', icon: '🏅', title: 'Rewards waiting', text: waiting ? `${waiting} reward${waiting > 1 ? 's' : ''} to claim in My Progress.` : 'Every reward claimed.', where: 'business', status: waiting ? 'now' : 'done', cta: 'Claim', go: '/progress/today' });
  const offers = BRANDS.length - (s.offers ?? []).length;
  if (offers > 0) out.push({ id: 'offers', icon: '🏷️', title: 'Partner offers', text: `${offers} partner offer${offers > 1 ? 's' : ''} you have not taken yet.`, where: 'business', status: 'soon', cta: 'See offers', go: '/partners/offers' });

  return out;
}
