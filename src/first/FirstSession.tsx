import { useEffect, useRef, useState, type Dispatch } from 'react';
import type { Action, GameState } from '../state';
import { FarmerPortrait } from './art';
import { CreateFarmer } from './Create';
import { LOOKS, SHAMBAS, say } from './data';
import { GuideLine, Review } from './Review';
import { Story } from './Story';
import { track } from './track';
import { Village } from './Village';

/* The first session, in order, all on the farmer's own farm:
   create the farmer → the story so far (bought the farm, last harvest failed, learn from the mistakes) → walk to the maize → first check (wrong call → back maize bed → check again)
   → the whole farm opens → walk to the sukuma wiki → second check → field rounds: check every bed. */

export function FirstSession({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const phase = s.fs.phase;
  const name = s.farmer?.name ?? '';
  const look = LOOKS[s.farmer?.look ?? 0];
  const [moved, setMoved] = useState(false);
  const [openingLine, setOpeningLine] = useState(true);
  const go = (p: GameState['fs']['phase'], extra: Partial<Extract<Action, { type: 'fs' }>> = {}) => dispatch({ type: 'fs', phase: p, ...extra });
  const t = (line: string) => say(line, name);
  const logged = useRef<string>('');

  // one event per moment, the first time it is shown in this visit
  useEffect(() => {
    if (logged.current === phase) return;
    logged.current = phase;
    setMoved(false);
    if (phase === 'create') track('create_shown');
    if (phase === 'walk1' || phase === 'walkRetry' || phase === 'walk2') track('walk_start', { route: phase });
  }, [phase]);

  // the farm-opening moment plays once
  useEffect(() => {
    if (phase !== 'walk2' || s.fs.opened) return;
    track('farm_opened');
    setOpeningLine(true);
    const id = window.setTimeout(() => {
      go('walk2', { opened: true });
      setOpeningLine(false);
    }, 2600);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, s.fs.opened]);

  const arrive = (shamba: string, next: GameState['fs']['phase']) => () => {
    track('shamba_reached', { shamba });
    go(next);
  };

  if (phase === 'create' || !s.farmer) {
    return (
      <>
        <Village look={look} name="" route={null} target={null} open={false} />
        <CreateFarmer
          onDone={(n, l) => {
            track('farmer_created', { look: l, suggested: ['Wanjiku', 'Otieno', 'Chebet'].includes(n) });
            dispatch({ type: 'farmer', name: n, look: l });
            go('story', { page: 0 });
          }}
        />
      </>
    );
  }

  const hud = (
    <div className="farmer-chip">
      <FarmerPortrait look={look} size={34} />
      <span>{name}</span>
    </div>
  );
  const topLine = { top: 8, bottom: 'auto', left: 172, right: 190 } as const;

  if (phase === 'story')
    return (
      <>
        <Village look={look} name={name} route={null} target={null} open={false} />
        <Story name={name} look={look} page={s.fs.page ?? 0} onPage={page => go('story', { page })} onDone={() => go('walk1')} />
      </>
    );

  if (phase === 'walk1')
    return (
      <>
        <Village look={look} name={name} route="toFirst" target="first" open={false} showTapHint={!moved} onFirstMove={() => (setMoved(true), track('first_move'))} onArrive={arrive('first', 'review1')} />
        {hud}
        <GuideLine style={topLine} text={moved ? t('Keep going, {name}. Your maize is just ahead.') : t('Karibu, {name}! Tap the path to walk to your maize.')} />
      </>
    );

  if (phase === 'walkRetry')
    return (
      <>
        <Village look={look} name={name} route="toLower" target="lower" open={false} showTapHint={!moved} onFirstMove={() => setMoved(true)} onArrive={arrive('lower', 'retry')} />
        {hud}
        <GuideLine style={topLine} text={t('Try again on your back maize, {name}.')} />
      </>
    );

  if (phase === 'walk2') {
    const opening = !s.fs.opened;
    return (
      <>
        <Village
          look={look}
          name={name}
          route={s.fs.at === 'lower' ? 'lowerToSukuma' : 'toSukuma'}
          target={opening ? null : 'sukuma'}
          frozen={opening}
          open
          opening={opening}
          onArrive={arrive('sukuma', 'review2')}
        />
        {hud}
        <GuideLine style={topLine} text={opening || openingLine ? t('Your whole farm is open, {name}! Every crop needs checking.') : t('Your sukuma wiki is next, {name}.')} />
      </>
    );
  }

  if (phase === 'review1' || phase === 'retry') {
    const sh = SHAMBAS[phase === 'review1' ? 'first' : 'lower'];
    return (
      <Review
        key={sh.id}
        shamba={sh}
        name={name}
        look={look}
        ending={{ line: 'You can read your crops now, {name}, so check every one of them often.', button: 'Check the next crop' }}
        onPassed={() => track('review_passed', { shamba: sh.id, first: true })}
        onFailed={() => go('walkRetry')}
        onEnd={() => go('walk2', { at: sh.id === 'lower' ? 'lower' : 'first', opened: false })}
      />
    );
  }

  if (phase === 'review2')
    return (
      <Review
        key="sukuma"
        shamba={SHAMBAS.sukuma}
        name={name}
        look={look}
        ending={
          s.view === 'world'
            ? { line: 'Now your own farm, {name}: clear Farm 1 for maize, then plant sukuma wiki on Farm 2, one plot at a time.', button: 'Go to my farm' }
            : { line: 'Your tomatoes need a check too, {name}: healthy crops mean good food for your family.', button: 'Check all my crops' }
        }
        onPassed={() => track('review_passed', { shamba: 'sukuma' })}
        onFailed={() => undefined}
        onEnd={() => {
          track('session_close');
          if (s.view === 'world') {
            // into the walkable farm: its task card says what to do first
            go('done', { note: 'Clear Farm 1 for maize, then plant sukuma wiki on Farm 2: tap the task card at the top of the farm.' });
            return;
          }
          go('done', { note: 'Check every bed on your farm often: open Rounds on the farm.' });
          // straight into the field rounds: every bed on the farm, checked one after another
          dispatch({ type: 'rounds', open: true });
        }}
      />
    );

  return null;
}
