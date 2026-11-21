import { useState, type Dispatch } from 'react';
import { Page, Tile } from '../components/Page';
import { MiniGame, type GameSpec } from '../minigames/MiniGame';
import { money } from '../money';
import { lifeOf } from '../livestock/model';
import { loadOn } from '../power/model';
import type { Action, GameState } from '../state';
import { GARDEN, GARDEN_CROPS, GARDEN_NAMES, cropOf, gardenOf, harvestKg, statusOf, type GardenCropId } from './model';
import { NutriChips, NutriTotal } from '../nutrition/Nutri';
import { nutritionOf } from '../nutrition/data';

/* Farms 7 and 8: choose a crop, plant it (a mini-game), water it each day, harvest it into the store. Opened at
   their signs on the farm, from the morning of day 4, or the main menu. */

type Tab = 0 | 1;

/** Planting: tap each hole before the time runs out. */
const plantGame = (crop: GardenCropId): GameSpec =>
  crop === 'orchard'
    ? { type: 'tap', scene: 'orchard', verb: 'Trees planted', mark: '🌳', seconds: 14, spots: [0, 1, 2, 3, 4, 5].map(i => ({ x: 60 + (i % 3) * 110, y: 52 + Math.floor(i / 3) * 140, label: `Planting hole ${i + 1}` })) }
    : { type: 'tap', scene: 'rows', verb: 'Seedlings planted', mark: '🌱', seconds: 14, spots: [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ x: 50 + (i % 4) * 80, y: 38 + Math.floor(i / 4) * 108, label: `Planting hole ${i + 1}` })) };
/** The harvest: pick the ripe ones, leave the green ones. */
const harvestGame = (crop: GardenCropId): GameSpec => {
  const c = cropOf(crop);
  return {
    type: 'tap',
    scene: crop === 'orchard' ? 'orchard' : 'rows',
    verb: 'Picked',
    seconds: 12,
    spots: [0, 1, 2, 3, 4, 5].map(i => ({ x: 46 + i * 50, y: 40 + ((i * 3) % 4) * 52, label: `Ripe ${c.name.toLowerCase()} ${i + 1}` })),
    decoys: [0, 1].map(i => ({ x: 70 + i * 160, y: 200, label: `Not ripe yet ${i + 1}` })),
    spotMark: c.icon,
    decoyMark: '🟢',
    mark: '✓',
  };
};

export function GardenPage({ s, dispatch, farm }: { s: GameState; dispatch: Dispatch<Action>; farm: number }) {
  const tab = (farm === 1 ? 1 : 0) as Tab;
  const setTab = (t: Tab) => dispatch({ type: 'open', modal: { kind: 'garden', farm: t } });
  const g = gardenOf(s.garden);
  const day = lifeOf(s.life).day;
  const f = g.farms[tab];
  const st = statusOf(f, day);
  const drip = loadOn(s, 'pump');
  const [game, setGame] = useState<{ kind: 'plant'; crop: GardenCropId } | { kind: 'harvest' } | null>(null);
  return (
    <Page
      title="New farms"
      icon="🌱"
      tabs={GARDEN_NAMES.map((n, i) => ({ id: i as Tab, label: `${n}${g.farms[i].crop ? ` · ${cropOf(g.farms[i].crop!).name}` : ''}`, icon: g.farms[i].crop ? cropOf(g.farms[i].crop!).icon : '▢' }))}
      tab={tab}
      onTab={setTab}
      dispatch={dispatch}
      foot={
        <>
          Farm day {day} · open from day {GARDEN.openDay}
          <br />
          {drip ? 'Drip irrigation on (solar pump)' : 'Water by hand every day'}
        </>
      }
    >
      {st === 'locked' && (
        <p className="pg-lead">
          {GARDEN_NAMES[tab]} opens on <b>day {GARDEN.openDay}</b>, after your first three days (today is day {day}). Then grow spinach, cabbage, tomatoes, beans, onions, watermelon or a fruit orchard here, and sell
          it at the market stall.
        </p>
      )}
      {st === 'empty' && (
        <>
          <p className="pg-lead">Choose what {GARDEN_NAMES[tab]} grows. You plant it yourself, water it each day, and its harvest goes into the store for the market stall.</p>
          <div className="pg-grid">
            {GARDEN_CROPS.map(c => (
              <div key={c.id} className="pg-card">
                <div className="pg-card-head">
                  <i aria-hidden="true">{c.icon}</i>
                  <b>{c.name}</b>
                  <small>{c.grow} days</small>
                </div>
                <p>{c.does}</p>
                <p>
                  About {c.kg} kg a harvest{c.regrow ? `, again every ${c.regrow} days` : ''} · {c.water} L a day
                </p>
                <NutriChips food={c.produce} max={2} />
                <button type="button" className="gold-btn" disabled={s.coins < c.cost} onClick={() => setGame({ kind: 'plant', crop: c.id })} aria-label={`Plant ${c.name} on ${GARDEN_NAMES[tab]} for ${money(c.cost)}`}>
                  Plant · {money(c.cost)}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
      {g.last && g.last.farm === tab && g.last.day === day && (
        <div className="pg-row nu-harvest" aria-label="Today's harvest">
          <i aria-hidden="true">{cropOf(g.last.crop).icon}</i>
          <span className="pg-row-text">
            <b>
              Harvested today: {g.last.kg} kg of {cropOf(g.last.crop).name.toLowerCase()}, into the store
            </b>
            <NutriTotal total={nutritionOf({ [cropOf(g.last.crop).produce]: g.last.kg })} prefix="It feeds" />
          </span>
        </div>
      )}
      {f.crop && st !== 'locked' && st !== 'empty' && (
        <>
          <div className="pg-tiles">
            <Tile label="Growing" value={`${cropOf(f.crop).icon} ${cropOf(f.crop).name}`} sub={`planted on day ${f.planted}`} />
            <Tile label="Health" value={`${f.health}%`} sub={f.health < 70 ? 'it went thirsty' : 'well watered'} tone={f.health < 70 ? 'bad' : 'good'} />
            <Tile label={st === 'ready' ? 'Ready now' : 'Ready on'} value={st === 'ready' ? `${harvestKg(f, 1)} kg` : `Day ${f.ready}`} sub={st === 'ready' ? 'harvest it into the store' : `${f.ready - day} day${f.ready - day === 1 ? '' : 's'} to go`} tone={st === 'ready' ? 'good' : undefined} />
            <Tile label="Harvests" value={`${f.harvests}`} sub={cropOf(f.crop).regrow ? `again every ${cropOf(f.crop).regrow} days` : 'once, then plant again'} />
          </div>
          <div className="pg-row">
            <i aria-hidden="true">🥗</i>
            <span className="pg-row-text">
              <b>What {cropOf(f.crop).name.toLowerCase()} gives the people who eat it</b>
              <NutriChips food={cropOf(f.crop).produce} />
              <NutriTotal total={nutritionOf({ [cropOf(f.crop).produce]: harvestKg(f, 1) })} prefix={`This harvest (${harvestKg(f, 1)} kg) feeds`} top={2} />
            </span>
          </div>
          <div className="pg-row">
            <i aria-hidden="true">💧</i>
            <span className="pg-row-text">
              <b>{f.watered >= day ? 'Watered today' : 'Needs water today'}</b>
              <small>{drip ? 'The solar drip waters it every night.' : `${cropOf(f.crop).water} L from the tank. A day without water costs ${GARDEN.dry}% of its health.`}</small>
            </span>
            <button type="button" className="gold-btn" style={{ height: 30, padding: '0 14px', fontSize: 11 }} disabled={f.watered >= day} onClick={() => dispatch({ type: 'gardenWater', farm: tab })}>
              Water
            </button>
          </div>
          <div className="pg-row">
            <i aria-hidden="true">{cropOf(f.crop).icon}</i>
            <span className="pg-row-text">
              <b>{st === 'ready' ? 'Ready to harvest' : 'Not ready yet'}</b>
              <small>Pick the ripe ones only: each harvest goes into the store, and the market stall sells 25 kg a day.</small>
            </span>
            <button type="button" className="gold-btn" style={{ height: 30, padding: '0 14px', fontSize: 11 }} disabled={st !== 'ready'} onClick={() => setGame({ kind: 'harvest' })}>
              Harvest
            </button>
          </div>
        </>
      )}
      {game && (
        <MiniGame
          title={game.kind === 'plant' ? `Plant ${cropOf(game.crop).name.toLowerCase()}` : `Harvest ${cropOf(f.crop!).name.toLowerCase()}`}
          kicker={GARDEN_NAMES[tab]}
          task={game.kind === 'plant' ? 'Tap every planting hole before the time runs out.' : 'Tap every ripe one. Leave the green ones: they are not ripe yet.'}
          spec={game.kind === 'plant' ? plantGame(game.crop) : harvestGame(f.crop!)}
          doneLabel={game.kind === 'plant' ? 'Done planting' : 'Into the store'}
          onClose={() => setGame(null)}
          onDone={score => {
            if (game.kind === 'plant') dispatch({ type: 'gardenPlant', farm: tab, crop: game.crop, score });
            else dispatch({ type: 'gardenHarvest', farm: tab, score });
            setGame(null);
          }}
        />
      )}
    </Page>
  );
}
