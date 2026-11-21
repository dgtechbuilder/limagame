import { useState, type Dispatch } from 'react';
import { Info } from '../learn/Info';
import { termFor } from '../learn/glossary';
import { Page, Tile } from '../components/Page';
import { MiniGame, type GameSpec } from '../minigames/MiniGame';
import { money } from '../money';
import { lifeOf } from '../livestock/model';
import type { Action, GameState, PowerTab } from '../state';
import { POWER, POWER_STEPS, partOptionOf, type LoadId, type PartOption, type StepId } from './config';
import { OptionPicker } from '../unlock/Picker';
import { batteryUsable, forecastDay, fuelTankL, has, lightsEggs, loadKwh, loadOn, loadsAvailable, nextStep, partOf, powerOf, powerOn, servedShare, stepBlock } from './model';
import { tankOf } from '../water/model';
import { coldRoom, repairCut } from '../systems/track';

/* The Power page: build the system over the first 7 days (Build: one part a day, each a mini-game), what it makes and
   uses (Today: the loads to switch on and off, diesel for the generator), what it does for the rest of the farm
   (Impact), and its days (History). Opened from POWER on the farm, the main menu, or the power yard. */

const TABS: { id: PowerTab; label: string; icon: string }[] = [
  { id: 'build', label: 'Build (7 days)', icon: '🔧' },
  { id: 'today', label: 'Today', icon: '⚡' },
  { id: 'impact', label: 'Impact', icon: '🌍' },
  { id: 'history', label: 'History', icon: '≡' },
];

/** Each step's mini-game. */

/** The farm word (learn/glossary.ts) behind each part of the power system, for its ⓘ. */
const STEP_TERM: Record<string, string> = { panels: 'solar', inverter: 'inverter', battery: 'batteryBank', lights: 'led', generator: 'generator', fuel: 'diesel', switchOn: 'kw' };
/** …and behind each option of a part: its own word where it has one (pure sine wave, MPPT, lithium…), else the part's. */
function pickTerm(step: string, id: string, name: string): string {
  if (step === 'panels') return 'solar';
  if (step === 'generator') return id === 'biogas' ? 'biogas' : 'generator';
  if (step === 'fuel') return id === 'bunded' ? 'bunded' : 'diesel';
  if (step === 'lights') return 'led';
  return termFor(name)?.id ?? STEP_TERM[step];
}

export function gameFor(id: StepId, s: GameState): GameSpec {
  switch (id) {
    case 'panels':
      return { type: 'aim', target: 64, label: 'Frame angle' };
    case 'inverter':
      return {
        type: 'wires',
        pairs: [
          { label: 'Panel +', color: '#d6332a' },
          { label: 'Panel −', color: '#222' },
          { label: 'Battery +', color: '#e67e22' },
          { label: 'Battery −', color: '#2a6fd6' },
          { label: 'Earth', color: '#2e8b47' },
        ],
      };
    case 'battery':
      return { type: 'order', steps: ['Switch the inverter off', 'Gloves on, rings off', 'Join the batteries + to −', 'Bank − to the inverter', 'Bank + last, through the fuse', 'Switch the inverter on'] };
    case 'lights':
      return {
        type: 'tap',
        scene: 'yard',
        verb: 'Lights up',
        mark: '💡',
        seconds: 16,
        spots: [
          { x: 64, y: 140, label: 'The house door' },
          { x: 150, y: 196, label: 'The path' },
          { x: 260, y: 102, label: 'The cow pen' },
          { x: 300, y: 190, label: 'The gate' },
          { x: 30, y: 196, label: 'The coop' },
          { x: 200, y: 60, label: 'The yard' },
        ],
      };
    case 'generator':
      return { type: 'timing', rounds: 3, zone: [42, 60], speed: 170, verb: 'Pull the cord', icon: '⚙️' };
    case 'fuel':
      return { type: 'hold', rounds: 2, band: [78, 92], rate: 42, verb: 'Hold to pour', liquid: '#c9a227' };
    case 'switchOn': {
      const f = forecastDay(s);
      const cows = tankOf(s.tank).herd.cows;
      return {
        type: 'balance',
        supply: Math.round((f.solar + (has(s, 'battery') ? 4 : 0)) * 10) / 10,
        loads: loadsAvailable(s).map(id => ({ id, name: POWER.loads[id].name, kwh: loadKwh(s, id), need: id === 'pump' || id === 'lights' || (id === 'cooler' && cows > 0) })),
      };
    }
  }
}

/** What each part's choice is about, over its options. */
const PICK_LEAD: Partial<Record<StepId, string>> = {
  panels: 'More kW makes more power, but the inverter (day 2) must be big enough to carry it.',
  inverter: 'An inverter carries only its own kW: match it to your panels. A better one wastes less.',
  battery: 'Lead-acid is cheap, but only half its charge can be used. Lithium costs more and lasts.',
  lights: 'Lights on poles or floodlights keep thieves off; lights in the coop make hens lay more.',
  generator: 'The generator covers what the sun can’t. A better engine burns less diesel for each kWh.',
  fuel: 'A bigger tank means fewer trips to town for the generator and the tractor.',
};

/** A part option's numbers, for its card. */
export function factsOf(id: StepId, o: PartOption): string[] {
  switch (id) {
    case 'panels':
      return [`${o.size} kW`, o.out !== 1 ? `${o.out! > 1 ? '+' : '−'}${Math.abs(Math.round((o.out! - 1) * 100))}% power` : 'full power'];
    case 'inverter':
      return [o.size > 50 ? 'No kW limit' : `Carries ${o.size} kW`, `${Math.round((o.out ?? 1) * 100)}% of the panels’ power`];
    case 'battery':
      return [`${o.size} kWh`, `${o.size * (o.out ?? 1)} kWh usable`];
    case 'lights':
      return [o.size ? `${o.size} kWh a day` : 'Uses no system power', `+${Math.round((o.eggs ?? 0) * 100)}% eggs`, o.secure ? 'Keeps thieves off' : 'No security'];
    case 'generator':
      return [`${o.size} kWh a litre`, ...(o.biogas ? [`${o.biogas} kWh a cow a day on biogas`] : [])];
    case 'fuel':
      return [`${o.size} L`, `Filled with ${o.fill} L`];
    default:
      return [];
  }
}

export function PowerPage({ s, dispatch, tab = 'build' }: { s: GameState; dispatch: Dispatch<Action>; tab?: PowerTab }) {
  const setTab = (t: PowerTab) => dispatch({ type: 'open', modal: { kind: 'power', tab: t } });
  const [playing, setPlaying] = useState<StepId | null>(null);
  const [picking, setPicking] = useState<StepId | null>(null);
  const [option, setOption] = useState<string | null>(null);
  const p = powerOf(s.power);
  const day = lifeOf(s.life).day;
  const due = nextStep(s);
  return (
    <Page
      title="Power"
      icon="⚡"
      tabs={TABS}
      tab={tab}
      onTab={setTab}
      dispatch={dispatch}
      foot={
        <>
          Farm day {day} · {powerOn(s) ? 'the power is on' : `${POWER_STEPS.filter(x => has(s, x.id)).length} of 7 done`}
          <br />
          Numbers are estimates for learning.
        </>
      }
    >
      {tab === 'build' && (
        <>
          <p className="pg-lead">
            Build your farm’s solar power system, one part a day for the first 7 days. Each part has its own job to do well: a part put in well works better. Then switch it on, and it powers
            the pump, the milk cooler, the lights, the house and the workshop.
          </p>
          <div className="pg-grid">
            {POWER_STEPS.map(st => {
              const done = p.parts[st.id];
              const block = stepBlock(s, st.id, s.coins);
              const locked = day < st.day;
              return (
                <div key={st.id} className={`pg-card${done ? ' is-done' : due?.id === st.id && !locked ? ' is-due' : ''}${locked ? ' is-locked' : ''}`} aria-label={`Day ${st.day}: ${st.name}`}>
                  <div className="pg-card-head">
                    <i aria-hidden="true">{st.icon}</i>
                    <b>{st.name}</b>
                    <Info term={STEP_TERM[st.id]} size={14} />
                    <small>Day {st.day}</small>
                  </div>
                  <p>{st.does}</p>
                  {done ? (
                    <span className="pg-status">
                      ✓ {partOptionOf(st.id, done.option)?.name ?? 'Done'} · day {done.day} · {Math.round(done.score * 100)}%
                    </span>
                  ) : (
                    <>
                      <p>
                        <b>Job:</b> {st.task}
                        {st.options.length ? ` · ${st.options.length} options, from ${money(Math.min(...st.options.map(o => o.price)))}` : ''}
                      </p>
                      <button
                        type="button"
                        className="gold-btn"
                        disabled={st.options.length ? locked || (!!block && !block.startsWith('You need')) : !!block}
                        title={block ?? undefined}
                        onClick={() => (st.options.length ? setPicking(st.id) : (setOption(null), setPlaying(st.id)))}
                      >
                        {locked ? `Opens on day ${st.day}` : block && !block.startsWith('You need') ? block.replace(/^.*?: /, '') : st.id === 'switchOn' ? 'Switch on' : 'Choose and install'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      {tab === 'today' && <Today s={s} dispatch={dispatch} />}
      {tab === 'impact' && <Impact s={s} />}
      {tab === 'history' && <History s={s} />}
      {picking && (
        <OptionPicker
          s={s}
          kicker={`Power · day ${POWER_STEPS.find(x => x.id === picking)!.day}`}
          title={`${POWER_STEPS.find(x => x.id === picking)!.name}: choose one`}
          lead={PICK_LEAD[picking]}
          options={POWER_STEPS.find(x => x.id === picking)!.options.map(o => ({ id: o.id, name: o.name, does: o.does, facts: factsOf(picking, o), price: o.price, term: pickTerm(picking, o.id, o.name) }))}
          coins={s.coins}
          verb="Install"
          onClose={() => setPicking(null)}
          onPick={id => {
            setOption(id);
            setPlaying(picking);
            setPicking(null);
          }}
        />
      )}
      {playing && (
        <MiniGame
          title={POWER_STEPS.find(x => x.id === playing)!.name}
          kicker={`Power · day ${POWER_STEPS.find(x => x.id === playing)!.day}`}
          task={`${POWER_STEPS.find(x => x.id === playing)!.task}.`}
          spec={gameFor(playing, s)}
          doneLabel={playing === 'switchOn' ? 'Power on' : 'Finish the install'}
          onClose={() => setPlaying(null)}
          onDone={(score, data) => {
            dispatch({ type: 'powerInstall', id: playing, score, loads: playing === 'switchOn' ? (data as LoadId[]) : undefined, option: option ?? undefined });
            setPlaying(null);
          }}
        />
      )}
    </Page>
  );
}

function Today({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const p = powerOf(s.power);
  const f = forecastDay(s);
  const last = p.history[0];
  if (!has(s, 'panels')) return <p className="cl-empty">No power yet: put in the solar panels first (Build, day 1).</p>;
  return (
    <>
      <div className="pg-tiles">
        <Tile label="Sun today" value={`${f.solar} kWh`} sub={`${f.sun} sun hours (${s.trial?.forecast ?? 'normal'} season)`} tone="good" />
        <Tile label="Needed a day" value={`${f.need} kWh`} sub={`${p.loads.length} things switched on`} />
        <Tile label="Battery" value={has(s, 'battery') ? `${p.battery} kWh` : '—'} sub={has(s, 'battery') ? `of ${batteryUsable(s)} kWh usable` : 'day 3'} />
        <Tile label="Diesel" value={has(s, 'fuel') ? `${Math.round(p.fuel)} L` : '—'} sub={has(s, 'fuel') ? `of ${fuelTankL(s)} L · generator and tractor` : 'day 6'} tone={has(s, 'fuel') && p.fuel < 20 ? 'bad' : undefined} />
      </div>
      {last && (
        <p className="pg-lead">
          Last day (farm day {last.day}): {last.solar} kWh from the sun{last.gen ? `, ${last.gen} kWh from the generator (${last.fuelL} L of diesel)` : ''}; {Math.round(last.served * 100)}% of what was needed.
          {last.served < 0.9 ? ' Switch something off, or buy diesel for the generator.' : ''}
        </p>
      )}
      <p className="pg-h">What it powers</p>
      {loadsAvailable(s).map(id => {
        const l = POWER.loads[id];
        const on = p.loads.includes(id);
        return (
          <div key={id} className="pg-row">
            <i aria-hidden="true">{id === 'pump' ? '💧' : id === 'cooler' ? '🥛' : id === 'lights' ? '💡' : id === 'house' ? '🏠' : '🔧'}</i>
            <span className="pg-row-text">
              <b>
                {l.name} · {loadKwh(s, id)} kWh a day
              </b>
              <small>{l.does}</small>
            </span>
            <button type="button" className={`pg-toggle${on ? ' is-on' : ''}`} aria-pressed={on} disabled={!powerOn(s)} onClick={() => dispatch({ type: 'powerLoad', id, on: !on })}>
              {powerOn(s) ? (on ? 'On' : 'Off') : 'Day 7'}
            </button>
          </div>
        );
      })}
      {has(s, 'fuel') && (
        <div className="pg-row">
          <i aria-hidden="true">⛽</i>
          <span className="pg-row-text">
            <b>Buy diesel · {money(POWER.dieselPrice)} a litre</b>
            <small>For the generator on cloudy days, and the tractor (refuel it at the tractor)</small>
          </span>
          <button type="button" className="gold-btn" style={{ height: 28, padding: '0 12px', fontSize: 11 }} disabled={p.fuel >= fuelTankL(s)} onClick={() => dispatch({ type: 'powerFuel', litres: 50 })}>
            50 L · {money(50 * POWER.dieselPrice)}
          </button>
        </div>
      )}
    </>
  );
}

function Impact({ s }: { s: GameState }) {
  const p = powerOf(s.power);
  const on = powerOn(s);
  const lines: [string, string, string, boolean][] = [
    ['💧', 'Water', `The solar pump lifts up to ${POWER.pumpLitres} L a day from the pond into the tank (${p.totals.water.toLocaleString('en-US')} L so far), and drips the greenhouse with ${Math.round(POWER.dripShare * 100)}% of the water.`, loadOn(s, 'pump')],
    ['🌍', 'Climate', `Clean power keeps ${Math.round(p.totals.avoided)} kg CO₂ out of the air (paid as climate credits); the generator has burned ${Math.round(p.totals.fuelL)} L of diesel (${Math.round(p.totals.emitted)} kg CO₂). Pumping and cooking count as solar.`, on],
    ['💰', 'Profit', `Chilled milk sells for ${Math.round(POWER.milkPremium * 100)}% more, lit coops lay ${Math.round((partOf(s, 'lights')?.eggs ?? POWER.eggBoost) * 100)}% more eggs, the cold room keeps fresh produce (+10% at the stall, no wilting). Saved on bills: ${money(Math.max(0, p.totals.saved))}.`, coldRoom(s) || lightsEggs(s) > 0],
    ['🚜', 'Tractor', `The workshop’s power tools cut servicing and repairs by ${Math.round(POWER.repairCut * 100)}%; the diesel tank refuels the tractor without a trip to the pump.`, repairCut(s) > 0 || has(s, 'fuel')],
    ['🔒', 'Security', 'The farm lights work as a security light: thieves keep to the dark.', loadOn(s, 'lights')],
    ['⚡', 'Electricity', `${Math.round(p.totals.solar)} kWh from the sun and ${Math.round(p.totals.gen)} kWh from the generator so far, over ${p.totals.days} days. Yesterday it gave ${Math.round(servedShare(s) * 100)}% of what was needed.`, on],
  ];
  return (
    <>
      {!on && <p className="pg-lead">Nothing yet: everything below starts once the system is switched on (day 7).</p>}
      {lines.map(([icon, title, text, active]) => (
        <div key={title} className="pg-row">
          <i aria-hidden="true">{icon}</i>
          <span className="pg-row-text">
            <b>{title}</b>
            <small>{text}</small>
          </span>
          <span className={`pg-status${active ? '' : ' is-bad'}`}>{active ? 'Working' : 'Not yet'}</span>
        </div>
      ))}
    </>
  );
}

function History({ s }: { s: GameState }) {
  const p = powerOf(s.power);
  if (!p.history.length) return <p className="cl-empty">The system’s days show here once it is switched on.</p>;
  return (
    <table className="pg-table" aria-label="Power, day by day, newest first">
      <thead>
        <tr>
          <th>Farm day</th>
          <th className="is-num">Sun</th>
          <th className="is-num">Generator</th>
          <th className="is-num">Needed</th>
          <th className="is-num">Served</th>
          <th className="is-num">Water pumped</th>
          <th className="is-num">CO₂ avoided</th>
        </tr>
      </thead>
      <tbody>
        {p.history.map(d => (
          <tr key={d.day}>
            <td>Day {d.day}</td>
            <td className="is-num">{d.solar} kWh</td>
            <td className="is-num">{d.gen ? `${d.gen} kWh · ${d.fuelL} L` : '—'}</td>
            <td className="is-num">{d.need} kWh</td>
            <td className="is-num">{Math.round(d.served * 100)}%</td>
            <td className="is-num">{d.water} L</td>
            <td className="is-num">{d.avoided} kg</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
