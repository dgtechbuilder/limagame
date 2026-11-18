import { expect, test } from '@playwright/test';
import { MINI_FARM, START, TRACTOR_R, miniClock, newMiniFarm, shareOf, stepMini, timeLeft, type MiniControls, type MiniFarm } from '../src/minifarm/sim';

/* The mini farm tractor game, without a browser: five rocks, three trees and four holes on every farm, 30 seconds
   on the clock, rocks and trees cost time, a hole ends the game, and ploughing the farm in time is possible. */

const drive = (d: MiniFarm, c: MiniControls, secs: number) => {
  for (let t = 0; t < secs && !d.done; t += 1 / 60) stepMini(d, 1 / 60, c);
};

/** Drive row by row along the farm (a serpentine), until the game ends or the time given runs out. */
function serpentine(d: MiniFarm, maxSecs = 40) {
  const rows: number[] = [];
  for (let y = MINI_FARM.h - MINI_FARM.swath / 2 + 2; y > 0; y -= MINI_FARM.swath) rows.push(Math.max(14, y));
  const c: MiniControls = { target: null, hold: true, keys: {} };
  let row = 0;
  let right = true;
  for (let t = 0; t < maxSecs && !d.done && row < rows.length; t += 1 / 60) {
    const goalX = right ? d.w - 10 : 10;
    c.target = [goalX, rows[row]];
    if (Math.abs(d.x - goalX) < 14) {
      row++;
      right = !right;
    }
    stepMini(d, 1 / 60, c);
  }
  return d;
}

test.beforeEach(() => {
  miniClock.scale = 1;
});

test('every farm has five rocks, three trees and four holes, apart and clear of the gate', () => {
  for (const seed of ['a', 'b', 'c', 'farm-7', '123', 'zz', 'tractor', 'mini']) {
    const d = newMiniFarm(seed);
    const n = (k: string) => d.things.filter(t => t.kind === k).length;
    expect(n('rock')).toBe(5);
    expect(n('tree')).toBe(3);
    expect(n('hole')).toBe(4);
    for (const a of d.things) {
      expect(Math.hypot(a.x - START[0], a.y - START[1])).toBeGreaterThan(90);
      // the tractor fits between a thing and the fence
      expect(Math.min(a.x, a.y, d.w - a.x, d.h - a.y) - a.r).toBeGreaterThan(2 * TRACTOR_R);
      for (const b of d.things) if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y) - a.r - b.r).toBeGreaterThan(2 * TRACTOR_R);
    }
    // the same seed makes the same farm
    expect(newMiniFarm(seed).things).toEqual(d.things);
  }
});

test('the clock is 30 seconds, and running out of it loses', () => {
  expect(MINI_FARM.secs).toBe(30);
  const d = newMiniFarm('idle');
  drive(d, { target: null, hold: false, keys: {} }, 31);
  expect(d.done?.outcome).toBe('time');
  expect(d.done?.stars).toBe(0);
});

test('a rock or a tree stops the tractor and costs 3 seconds', () => {
  const d = newMiniFarm('bump');
  const rock = d.things.find(t => t.kind === 'rock')!;
  // put the tractor just left of the rock, facing it, and drive on
  d.x = rock.x - rock.r - TRACTOR_R - 6;
  d.y = rock.y;
  d.things = [rock];
  drive(d, { target: null, hold: false, keys: { up: true } }, 0.4);
  expect(d.bumps).toBe(1);
  expect(d.lost).toBe(MINI_FARM.bumpCost);
  expect(timeLeft(d)).toBeLessThan(MINI_FARM.secs - MINI_FARM.bumpCost);
  expect(d.done).toBeNull();
});

test('driving into a hole ends the game', () => {
  const d = newMiniFarm('hole');
  const hole = d.things.find(t => t.kind === 'hole')!;
  d.x = hole.x - hole.r - 10;
  d.y = hole.y;
  d.things = [hole];
  drive(d, { target: null, hold: false, keys: { up: true } }, 1);
  expect(d.done?.outcome).toBe('hole');
  expect(d.fell).toBe(hole);
});

test('an open farm can be ploughed in well under 30 seconds', () => {
  const d = newMiniFarm('open');
  d.things = [];
  d.cell.fill(0);
  d.total = d.gw * d.gh;
  serpentine(d);
  expect(d.done?.outcome).toBe('win');
  expect(shareOf(d)).toBeGreaterThanOrEqual(MINI_FARM.goal);
  // time left for steering round twelve things
  expect(d.done!.left).toBeGreaterThan(5);
});
