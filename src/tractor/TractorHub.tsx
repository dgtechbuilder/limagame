import { useState, type Dispatch } from 'react';
import { act } from '../onsite/model';
import { Page, Tile } from '../components/Page';
import { MiniGame, type GameSpec } from '../minigames/MiniGame';
import { money } from '../money';
import type { Action, GameState } from '../state';
import { powerOf } from '../power/model';
import { repairCut } from '../systems/track';
import { HUB, LESSONS, SAFETY_ICONS, SAFETY_STEPS, SERVICE_SPOTS, cannotDrive, faultsFor, hubOf, levelOf, speedOf, type HubSection } from './hub';
import { TractorYard, type Station, type StationInfo } from './Yard';
import { LOOKS } from '../first/data';
import { lifeOf } from '../livestock/model';

/* The tractor screen: what the farm's tractor needs and what the farmer can learn on it. Opened by tapping TRACTOR on
   the farm, or by walking to the Train spot beside the tractor. It opens in the tractor yard (Yard.tsx), a small
   place the farmer walks round, with a station for each section; each section is a short mini-game. Hire and Drive
   hand back to the farm (the oxen or the tractor plough the farms; the farmer hops on). */

const SECTIONS: { id: HubSection; label: string; icon: string; does: string }[] = [
  { id: 'yard', label: 'Yard', icon: '🏡', does: 'Walk round the tractor yard: each station is a mini-game.' },
  { id: 'train', label: 'Train', icon: '🎓', does: 'Drive the practice course round the cones: a better driver drives faster.' },
  { id: 'learn', label: 'Learn', icon: '📖', does: 'Hands-on lessons: fit the tractor’s parts, work it safely and look after the soil, by doing each job yourself.' },
  { id: 'safety', label: 'Safety check', icon: '🦺', does: 'The walk-round before starting, in the right order.' },
  { id: 'service', label: 'Service', icon: '🛢️', does: 'Check the oil and filters, grease the nipples: keeps it in good condition.' },
  { id: 'repair', label: 'Repair', icon: '🔧', does: 'Find what is wrong and fix it: a worn tractor drives slower, then will not start.' },
  { id: 'refuel', label: 'Refuel', icon: '⛽', does: 'Diesel from the farm’s tank (the power yard) or the pump in town.' },
  { id: 'hire', label: 'Hire', icon: '🐂', does: 'The oxen or the tractor plough the farms whose plan hires them.' },
  { id: 'drive', label: 'Drive', icon: '🚜', does: 'Hop on: pick a type and a tool, and work the plots from the seat.' },
];

/** The tractor business sits in the tractor screen as its own module: its tab, straight under the yard, opens the
    full Tractor business screen (src/business/Business.tsx) over the farm. */
const BUSINESS_TAB = { id: 'business' as const, label: 'Tractor business', icon: '💼' };

export function gameOf(section: HubSection, s: GameState, lesson: string): GameSpec | null {
  const h = hubOf(s.hub);
  switch (section) {
    case 'train':
      return { type: 'steer', seconds: 12, speed: 1 + levelOf(h.xp) * 0.15 };
    case 'learn':
      return { type: 'workshop', questions: LESSONS.find(l => l.id === lesson)!.questions };
    case 'safety':
      return { type: 'order', steps: SAFETY_STEPS, icons: SAFETY_ICONS };
    case 'service':
      return { type: 'tap', scene: 'tractor', verb: 'Checked', spots: SERVICE_SPOTS, seconds: 20, ordered: true, mark: '✓' };
    case 'repair':
      return { type: 'tap', scene: 'tractor', verb: 'Faults found', spots: faultsFor(h.done.repair ?? 0), decoys: [{ x: 140, y: 165, label: 'The step: fine' }, { x: 316, y: 150, label: 'The drawbar: fine' }], seconds: 18, spotMark: '⚠️', decoyMark: '👍', mark: '🔧' };
    case 'refuel':
      return { type: 'hold', rounds: 1, band: [80, 94], rate: 40, verb: 'Hold to pour', liquid: '#c9a227' };
    default:
      return null;
  }
}

export function TractorHub({
  s,
  dispatch,
  section,
  onSection,
  hire,
  onHire,
  onDrive,
  onClose,
}: {
  s: GameState;
  dispatch: Dispatch<Action>;
  section: HubSection;
  onSection: (x: HubSection) => void;
  /** what Hire would do now, or why there is nothing to hire */
  hire: { ready: boolean; text: string };
  onHire: () => void;
  onDrive: () => void;
  onClose: () => void;
}) {
  const h = hubOf(s.hub);
  const [lesson, setLesson] = useState(LESSONS[0].id);
  const [playing, setPlaying] = useState(false);
  /** the section was opened from a station in the yard: Back (and a finished game) walks back out to it */
  const [fromYard, setFromYard] = useState(section === 'yard');
  const sec = SECTIONS.find(x => x.id === section)!;
  const cut = repairCut(s);
  const farmFuel = powerOf(s.power).parts.fuel ? powerOf(s.power).fuel : null;
  const lvl = levelOf(h.xp);
  const block = cannotDrive(h);
  const game = gameOf(section, s, lesson);
  const look = LOOKS[s.farmer?.look ?? 0] ?? LOOKS[0];
  const today = lifeOf(s.life).day;
  const stations: StationInfo[] = SECTIONS.filter((x): x is typeof x & { id: Station } => x.id !== 'yard').map(x => ({
    id: x.id,
    label: x.label === 'Safety check' ? 'Safety' : x.label,
    icon: x.icon,
    best: h.best[x.id],
    due:
      x.id === 'repair' && h.condition < HUB.worn
        ? 'the tractor is worn'
        : x.id === 'service' && h.condition < 70
          ? 'due a service'
          : x.id === 'refuel' && h.fuel < 10
            ? 'the tank is low'
            : x.id === 'hire' && hire.ready
              ? 'a farm is waiting'
              : x.id === 'safety' && h.safetyDay !== today
                ? 'today’s walk-round'
                : x.id === 'learn' && h.lessons.length < LESSONS.length
                  ? `${LESSONS.length - h.lessons.length} lesson${LESSONS.length - h.lessons.length === 1 ? '' : 's'} to pass`
                  : undefined,
    off: x.id === 'drive' ? (block ?? undefined) : undefined,
  }));
  const openBusiness = () => {
    onClose();
    dispatch({ type: 'biz', open: true });
  };
  const cost = section === 'service' ? Math.round(HUB.serviceCost * (1 - cut)) : section === 'repair' ? Math.round(HUB.repairCost * (1 - cut)) : section === 'refuel' && (farmFuel ?? 0) < HUB.tankL - h.fuel ? Math.round((HUB.tankL - h.fuel) * HUB.pumpPrice) : 0;
  return (
    <Page
      title="Tractor"
      icon="🚜"
      className="hub-page"
      tabs={SECTIONS.flatMap(x => {
        const tab = { id: x.id as HubSection | 'business', label: x.label, icon: x.icon, badge: x.id === 'repair' && h.condition < HUB.worn ? 1 : x.id === 'refuel' && h.fuel < 10 ? 1 : x.id === 'hire' && hire.ready ? 1 : 0 };
        // the tractor business comes straight after the yard
        return x.id === 'yard' ? [tab, BUSINESS_TAB] : [tab];
      })}
      tab={section as HubSection | 'business'}
      onTab={id => (id === 'business' ? openBusiness() : onSection(id))}
      dispatch={dispatch}
      onClose={onClose}
    >
      {section === 'yard' ? (
        <TractorYard
          stations={stations}
          name={s.farmer?.name ?? 'Farmer'}
          look={{ skin: look.skin, shirt: look.outfit }}
          onOpen={id => {
            setFromYard(true);
            onSection(id);
          }}
          top={
            <>
              <span className={`ty-chip${lvl > 0 ? ' is-good' : ''}`}>🎓 Driver level {lvl} · {Math.round((speedOf(h) - 1) * 100)}% speed</span>
              <span className={`ty-chip${h.condition < HUB.worn ? ' is-bad' : ''}`}>🔧 {Math.round(h.condition)}%</span>
              <span className={`ty-chip${h.fuel < 10 ? ' is-bad' : ''}`}>⛽ {Math.round(h.fuel)} L</span>
              <span className="ty-chip">📖 {h.lessons.length}/{LESSONS.length} lessons</span>
              <button type="button" className="ty-chip ck-chip" onClick={() => dispatch({ type: 'open', modal: { kind: 'checks', subject: 'tractor' } })}>
                🔍 Examine the tractor
              </button>
            </>
          }
          corner={
            !block && (
              <button type="button" className="gold-btn ty-hop" onClick={onDrive}>
                Hop on
              </button>
            )
          }
        />
      ) : (
      <>
      {fromYard && (
        <button type="button" className="ty-back" onClick={() => onSection('yard')}>
          ← Back to the yard
        </button>
      )}
      <div className="pg-tiles">
        <Tile label="Driver" value={`Level ${lvl}`} sub={lvl < 3 ? `${HUB.levels[lvl] - h.xp} experience to level ${lvl + 1}` : 'top level'} tone={lvl > 0 ? 'good' : undefined} />
        <Tile label="Condition" value={`${Math.round(h.condition)}%`} sub={h.condition < HUB.worn ? 'worn: drives slower' : 'good'} tone={h.condition < HUB.worn ? 'bad' : 'good'} />
        <Tile label="Diesel" value={`${Math.round(h.fuel)} L`} sub={`of ${HUB.tankL} L`} tone={h.fuel < 10 ? 'bad' : undefined} />
        <Tile label="Lessons" value={`${h.lessons.length} of ${LESSONS.length}`} sub="passed" />
      </div>
      <p className="pg-h">
        {sec.icon} {sec.label}
      </p>
      <p className="pg-lead">{sec.does}</p>
      {section === 'learn' && (
        <div className="pg-chips" role="group" aria-label="Lessons">
          {LESSONS.map(l => (
            <button key={l.id} type="button" className={`pg-chip${lesson === l.id ? ' is-on' : ''}`} onClick={() => setLesson(l.id)}>
              {h.lessons.includes(l.id) ? '✓ ' : ''}
              {l.title}
            </button>
          ))}
        </div>
      )}
      {section === 'service' && <p className="pg-lead">Check every point in order: {SERVICE_SPOTS.map(p => p.label.toLowerCase()).join(', ')}. Oil, grease and filters: {money(cost)}{cut ? ' (workshop power: 30% less)' : ''}.</p>}
      {section === 'repair' && <p className="pg-lead">Three things are wrong today: tap each one on the tractor. Tapping a part that is fine wastes time. Parts: {money(cost)}{cut ? ' (workshop power: 30% less)' : ''}.</p>}
      {section === 'refuel' && (
        <p className="pg-lead">
          {farmFuel !== null && farmFuel >= HUB.tankL - h.fuel ? `From the farm’s diesel tank (${Math.round(farmFuel)} L in it): no trip to town.` : `At the pump in town: ${money(cost)} to fill up${farmFuel === null ? '. Put in the farm’s diesel tank (Power, day 6) to refuel here' : '. The farm tank is low: buy diesel in Power'}.`} Pour steadily: spilt diesel is lost.
        </p>
      )}
      {section === 'hire' && <p className="pg-lead">{hire.text}</p>}
      {section === 'drive' && <p className="pg-lead">{block ?? 'The tractor is ready.'} A worn tractor (under 30%) drives 20% slower; each driver level adds 5%.</p>}
      {game ? (
        <button type="button" className="gold-btn mg-big" disabled={(section === 'refuel' && h.fuel >= HUB.tankL - 0.5) || cost > s.coins} onClick={() => setPlaying(true)}>
          {section === 'learn' ? `Start: ${LESSONS.find(l => l.id === lesson)!.title}` : section === 'refuel' && h.fuel >= HUB.tankL - 0.5 ? 'The tank is full' : `Start ${sec.label.toLowerCase()}${cost ? ` · ${money(cost)}` : ''}`}
        </button>
      ) : section === 'hire' ? (
        <button type="button" className="gold-btn mg-big" disabled={!hire.ready} onClick={onHire}>
          {hire.ready ? 'Hire now' : 'Nothing to hire'}
        </button>
      ) : (
        <button type="button" className="gold-btn mg-big" disabled={!!block} onClick={onDrive}>
          Hop on
        </button>
      )}
      </>
      )}
      {playing && game && (
        <MiniGame
          title={section === 'learn' ? LESSONS.find(l => l.id === lesson)!.title : sec.label}
          kicker="Tractor"
          task={section === 'train' ? 'Steer left and right round the cones down the practice lane.' : section === 'learn' ? 'Every question is a job on a working tractor. Drag parts in and out, work the levers and drive it to see what moves. Fewer wrong tries, more stars.' : section === 'safety' ? 'Tap the steps of the walk-round in the right order.' : section === 'service' ? 'Tap each service point in order before the time runs out.' : section === 'repair' ? 'Fix the three faults (⚠️) before the time runs out. Leave the parts that are fine (👍).' : 'Hold to pour the diesel and let go at the line.'}
          spec={game}
          onClose={() => setPlaying(false)}
          onDone={score => {
            act(s, dispatch, { type: 'tractorHub', section, score, id: section === 'learn' ? lesson : undefined, label: sec.label });
            setPlaying(false);
            // back out to the yard, to see the stars on the station
            if (fromYard) onSection('yard');
          }}
        />
      )}
    </Page>
  );
}
