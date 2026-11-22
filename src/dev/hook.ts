/* Play-test hook, in dev builds only (npm run dev, then open with ?dev). It exposes the game's state and a few
   jump-to-state helpers as window.__lima, so the Playwright tests in tests/ can set up a moment and then play it
   through the real screens. It is never part of a production build (see App.tsx). */

import type { Dispatch } from 'react';
import { PRESCRIBE, PRODUCTS } from '../care/data';
import { SHAMBAS } from '../first/data';
import { clearEvents, events } from '../first/track';
import { CALL_GROUPS, HAZARDS, type HazardId } from '../rounds/hazards';
import { REVIEW_BASE, initialState, type Action, type GameState } from '../state';
import { LAYOUTS } from '../tractor/data';
import { simClock } from '../tractor/sim';
import { driveClock } from '../business/drive';
import { miniClock } from '../minifarm/sim';
import { shopClock } from '../shop/model';
import { sfxLog } from '../sfx';
import { wakalaCase, type WakalaCase } from '../trials/samples';
import { PLACES } from '../world/engine';
import { PLOTS, signOf, tileCenter } from '../world/field';
import { tidyItems } from '../tidy/model';
import { achClock } from '../achievements/track';
import { fieldClock } from '../csa/model';
import { jobFor } from '../onsite/model';

export function install(get: () => GameState, dispatch: Dispatch<Action>) {
  // the field clock (src/csa) stands at 10 am in the play-tests, an hour that changes nothing, unless a test sets it
  fieldClock.hour = () => 10;
  const jump = (state: Partial<GameState>) => dispatch({ type: 'reset', state: { ...initialState, ...REVIEW_BASE, ...state } });
  const callOf = (hazard: HazardId) => {
    const call = HAZARDS[hazard].call;
    const group = CALL_GROUPS.find(g => g.calls.some(c => c.id === call))!;
    return { group: group.label, label: group.calls.find(c => c.id === call)!.label, single: group.calls.length === 1 };
  };
  const api = {
    get state() {
      return get();
    },
    dispatch,
    /** a player past the first session, with this state on top */
    jump,
    /** a farm-world moment from trials/samples.ts: fix, spray, followUp, cameBack, tractor or voice */
    scenario(kind: WakalaCase) {
      const c = wakalaCase(kind);
      jump({ view: 'world', trial: c.trial, field: c.field, coins: 5000 });
      return { day: c.day, hazard: c.hazard, cycle: c.trial.cycle };
    },
    /** the call that reads a problem right, as the judge screen shows it */
    callFor: callOf,
    /** a call that reads it wrong */
    wrongCallFor(hazard: HazardId) {
      const call = HAZARDS[hazard].call;
      const g = CALL_GROUPS.find(x => x.calls.some(c => c.id !== call && x.calls.length === 1))!;
      return { group: g.label, label: g.calls[0].label, single: true };
    },
    fixes: (hazard: string) => PRESCRIBE[hazard],
    products: (hazard: string) => PRODUCTS[hazard],
    tractorTool: (farm: number) => LAYOUTS[farm].prep.tool,
    shamba: (id: string) => SHAMBAS[id],
    places: PLACES,
    plots: PLOTS,
    sign: signOf,
    tile: tileCenter,
    /** the walk and the work on the farm for a page's action (src/onsite), or null */
    jobFor: (a: Action) => jobFor(get(), a),
    /** today's bushes and rocks for the daily tidy-up (cleared or not) */
    tidy: () => tidyItems(achClock.today()),
    events,
    clearEvents,
    /** the sound effects played so far, newest last */
    sfx: () => [...sfxLog],
    /** the tractor drive's game seconds run this many times faster */
    tractorClock(scale: number) {
      simClock.scale = scale;
    },
    /** the business day's ten-second drives run this many times faster */
    driveClock(scale: number) {
      driveClock.scale = scale;
    },
    /** the tractor game's 30 seconds run this many times faster */
    miniClock(scale: number) {
      miniClock.scale = scale;
    },
    /** the shop floor's customers and cooking run this many times faster */
    shopClock(scale: number) {
      shopClock.scale = scale;
    },
    /** the field clock's hour (src/csa): a play-test sets the hour work on the farm is done at; null: the phone's own */
    fieldHour(hour: number | null) {
      fieldClock.hour = hour === null ? () => new Date().getHours() : () => hour;
    },
  };
  (window as unknown as { __lima: typeof api }).__lima = api;
}
