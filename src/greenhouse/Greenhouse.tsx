import { useState, type Dispatch } from 'react';
import { act } from '../onsite/model';
import { Page, Tile } from '../components/Page';
import { MiniGame, type GameSpec } from '../minigames/MiniGame';
import { money } from '../money';
import { lifeOf } from '../livestock/model';
import { loadOn } from '../power/model';
import type { Action, GameState } from '../state';
import { BED_NAMES, BED_SUGGEST, GH_CROPS, GREENHOUSE, bedStatus, ghCropOf, ghNeeds, greenhouseOf, pickKg, picksLeft, type GhCropId } from './model';
import { NutriChips, NutriTotal } from '../nutrition/Nutri';
import { nutritionOf } from '../nutrition/data';

/* The greenhouse's four beds: choose a crop, plant it (a mini-game), water it each day, pick it into the storehouse.
   Opened at its door on the farm (from the morning of day 4), or the main menu. */

/** Planting: tap each planting hole before the time runs out. */
const plantGame = (): GameSpec => ({
  type: 'tap',
  scene: 'greenhouse',
  verb: 'Seedlings planted',
  mark: '🌱',
  seconds: 14,
  spots: [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ x: 50 + (i % 4) * 80, y: 38 + Math.floor(i / 4) * 108, label: `Planting hole ${i + 1}` })),
});
/** A pick: the ripe ones, not the green ones. */
export const pickGame = (crop: GhCropId): GameSpec => {
  const c = ghCropOf(crop);
  return {
    type: 'tap',
    scene: 'greenhouse',
    verb: 'Picked',
    seconds: 12,
    spots: [0, 1, 2, 3, 4, 5].map(i => ({ x: 46 + i * 50, y: 40 + ((i * 3) % 4) * 52, label: `Ripe ${c.name.toLowerCase()} ${i + 1}` })),
    decoys: [0, 1].map(i => ({ x: 70 + i * 160, y: 200, label: `Not ripe yet ${i + 1}` })),
    spotMark: c.icon,
    decoyMark: '🟢',
    mark: '✓',
  };
};

export function GreenhousePage({ s, dispatch, bed }: { s: GameState; dispatch: Dispatch<Action>; bed: number }) {
  const tab = Math.max(0, Math.min(GREENHOUSE.beds - 1, bed));
  const setTab = (t: number) => dispatch({ type: 'open', modal: { kind: 'greenhouse', bed: t } });
  const g = greenhouseOf(s.greenhouse);
  const day = lifeOf(s.life).day;
  const b = g.beds[tab];
  const st = bedStatus(b, day);
  const drip = loadOn(s, 'pump');
  const needs = ghNeeds(g, day);
  const [game, setGame] = useState<{ kind: 'plant'; crop: GhCropId } | { kind: 'pick' } | null>(null);
  const crops = [...GH_CROPS].sort((x, y) => (x.id === BED_SUGGEST[tab] ? -1 : y.id === BED_SUGGEST[tab] ? 1 : 0));
  const last = g.log[0];
  return (
    <Page
      title="Greenhouse"
      icon="🍅"
      tabs={BED_NAMES.map((n, i) => ({ id: i, label: `${n}${g.beds[i].crop ? ` · ${ghCropOf(g.beds[i].crop!).name}` : ''}`, icon: g.beds[i].crop ? ghCropOf(g.beds[i].crop!).icon : '▢' }))}
      tab={tab}
      onTab={setTab}
      dispatch={dispatch}
      foot={
        <>
          Farm day {day} · open from day {GREENHOUSE.openDay}
          <br />
          {drip ? 'Drip irrigation on (solar pump)' : 'Water by hand every day'}
        </>
      }
    >
      {st === 'locked' && (
        <p className="pg-lead">
          The greenhouse opens on <b>day {GREENHOUSE.openDay}</b>, after your first three days (today is day {day}). Then grow tomatoes, capsicum, cucumbers, strawberries and chillies in its four
          beds, under glass, and bring every pick into the storehouse.
        </p>
      )}
      {st !== 'locked' && needs.thirsty > 1 && (
        <div className="pg-row">
          <i aria-hidden="true">💧</i>
          <span className="pg-row-text">
            <b>{needs.thirsty} beds need water today</b>
            <small>Under glass no rain falls on them: water every bed, every day, or switch on the solar drip.</small>
          </span>
          <button type="button" className="gold-btn" style={{ height: 30, padding: '0 14px', fontSize: 11 }} onClick={() => act(s, dispatch, { type: 'ghWater', bed: -1 })}>
            Water all
          </button>
        </div>
      )}
      {st === 'empty' && (
        <>
          <p className="pg-lead">
            Choose what {BED_NAMES[tab].toLowerCase()} grows. The glass keeps off the rain, cold nights and most pests, so it is picked again and again; grow something different in each bed and
            the storehouse always has something to sell or make.
          </p>
          <div className="pg-grid">
            {crops.map(c => (
              <div key={c.id} className="pg-card">
                <div className="pg-card-head">
                  <i aria-hidden="true">{c.icon}</i>
                  <b>{c.name}</b>
                  <small>{c.id === BED_SUGGEST[tab] ? 'Laid out for it' : `${c.grow} days`}</small>
                </div>
                <p>{c.does}</p>
                <p>
                  First pick in {c.grow} days, then {c.picks - 1} more every {c.regrow} days · about {c.kg} kg a pick · {c.water} L a day
                </p>
                <NutriChips food={c.produce} max={2} />
                <button type="button" className="gold-btn" disabled={s.coins < c.cost} onClick={() => setGame({ kind: 'plant', crop: c.id })} aria-label={`Plant ${c.name} in greenhouse ${BED_NAMES[tab].toLowerCase()} for ${money(c.cost)}`}>
                  Plant · {money(c.cost)}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {last && last.bed === tab && last.day === day && (
        <div className="pg-row nu-harvest" aria-label="Today's pick">
          <i aria-hidden="true">{ghCropOf(last.crop).icon}</i>
          <span className="pg-row-text">
            <b>
              Picked today: {last.kg} kg of {ghCropOf(last.crop).name.toLowerCase()}, into the storehouse
            </b>
            <NutriTotal total={nutritionOf({ [ghCropOf(last.crop).produce]: last.kg })} prefix="It feeds" />
          </span>
        </div>
      )}
      {b.crop && st !== 'locked' && st !== 'empty' && (
        <>
          <div className="pg-tiles">
            <Tile label="Growing" value={`${ghCropOf(b.crop).icon} ${ghCropOf(b.crop).name}`} sub={`planted on day ${b.planted}`} />
            <Tile label="Health" value={`${b.health}%`} sub={b.health < 70 ? 'it went thirsty' : 'well watered'} tone={b.health < 70 ? 'bad' : 'good'} />
            <Tile label={st === 'ready' ? 'Ready now' : 'Next pick'} value={st === 'ready' ? `${pickKg(b, 1)} kg` : `Day ${b.ready}`} sub={st === 'ready' ? 'pick it into the storehouse' : `${b.ready - day} day${b.ready - day === 1 ? '' : 's'} to go`} tone={st === 'ready' ? 'good' : undefined} />
            <Tile label="Picks left" value={`${picksLeft(b)}`} sub={`every ${ghCropOf(b.crop).regrow} days, then plant again`} />
          </div>
          <div className="pg-row">
            <i aria-hidden="true">🥗</i>
            <span className="pg-row-text">
              <b>What {ghCropOf(b.crop).name.toLowerCase()} give the people who eat them</b>
              <NutriChips food={ghCropOf(b.crop).produce} />
              <NutriTotal total={nutritionOf({ [ghCropOf(b.crop).produce]: pickKg(b, 1) })} prefix={`A pick (${pickKg(b, 1)} kg) feeds`} top={2} />
            </span>
          </div>
          <div className="pg-row">
            <i aria-hidden="true">💧</i>
            <span className="pg-row-text">
              <b>{b.watered >= day ? 'Watered today' : 'Needs water today'}</b>
              <small>{drip ? 'The solar drip waters it every night.' : `${ghCropOf(b.crop).water} L from the tank. A day without water costs ${GREENHOUSE.dry}% of its health.`}</small>
            </span>
            <button type="button" className="gold-btn" style={{ height: 30, padding: '0 14px', fontSize: 11 }} disabled={b.watered >= day} onClick={() => act(s, dispatch, { type: 'ghWater', bed: tab })}>
              Water
            </button>
          </div>
          <div className="pg-row">
            <i aria-hidden="true">{ghCropOf(b.crop).icon}</i>
            <span className="pg-row-text">
              <b>{st === 'ready' ? 'Ready to pick' : 'Not ready yet'}</b>
              <small>Pick the ripe ones only: every pick goes into the storehouse, where the stall sells it or you make it into something that keeps.</small>
            </span>
            <button type="button" className="gold-btn" style={{ height: 30, padding: '0 14px', fontSize: 11 }} disabled={st !== 'ready'} onClick={() => setGame({ kind: 'pick' })}>
              Pick
            </button>
          </div>
        </>
      )}
      {game && (
        <MiniGame
          title={game.kind === 'plant' ? `Plant ${ghCropOf(game.crop).name.toLowerCase()}` : `Pick ${ghCropOf(b.crop!).name.toLowerCase()}`}
          kicker={`Greenhouse · ${BED_NAMES[tab]}`}
          task={game.kind === 'plant' ? 'Tap every planting hole before the time runs out.' : 'Tap every ripe one. Leave the green ones: they are not ripe yet.'}
          spec={game.kind === 'plant' ? plantGame() : pickGame(b.crop!)}
          doneLabel={game.kind === 'plant' ? 'Done planting' : 'Into the storehouse'}
          onClose={() => setGame(null)}
          onDone={score => {
            if (game.kind === 'plant') dispatch({ type: 'ghPlant', bed: tab, crop: game.crop, score });
            else dispatch({ type: 'ghHarvest', bed: tab, score });
            setGame(null);
          }}
        />
      )}
    </Page>
  );
}
