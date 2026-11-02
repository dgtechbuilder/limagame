import { useEffect, useRef, useState, type Dispatch } from 'react';
import type { Action, GameState } from '../state';
import { FarmerPortrait } from './art';
import { CreateFarmer } from './Create';
import { LOOKS, SHAMBAS, say } from './data';
import { GuideLine, Review } from './Review';
import { track } from './track';
import { Village } from './Village';

/* The first session, in order:
   create the farmer → walk to the shamba → first review (wrong call → back shamba → review)
   → the village opens → walk to a neighbour → second review → back to the farm. */

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

  // the village-opening moment plays once
  useEffect(() => {
    if (phase !== 'walk2' || s.fs.opened) return;
    track('village_unlocked');
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
            go('walk1');
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
  const topLine = { top: 8, bottom: 'auto', left: 172, right: 172 } as const;

  if (phase === 'walk1')
    return (
      <>
        <Village look={look} name={name} route="toFirst" target="first" open={false} showTapHint={!moved} onFirstMove={() => (setMoved(true), track('first_move'))} onArrive={arrive('first', 'review1')} />
        {hud}
        <GuideLine style={topLine} text={moved ? t('Keep going, {name}. Your maize is just ahead.') : t('Karibu, {name}! Tap the path to walk to your shamba.')} />
      </>
    );

  if (phase === 'walkRetry')
    return (
      <>
        <Village look={look} name={name} route="toLower" target="lower" open={false} showTapHint={!moved} onFirstMove={() => setMoved(true)} onArrive={arrive('lower', 'retry')} />
        {hud}
        <GuideLine style={topLine} text={t('Try again on your back shamba, {name}.')} />
      </>
    );

  if (phase === 'walk2') {
    const opening = !s.fs.opened;
    return (
      <>
        <Village
          look={look}
          name={name}
          route={s.fs.at === 'lower' ? 'lowerToAchieng' : 'toAchieng'}
          target={opening ? null : 'achieng'}
          frozen={opening}
          open
          opening={opening}
          onArrive={arrive('achieng', 'review2')}
        />
        {hud}
        <GuideLine style={topLine} text={opening || openingLine ? t('The farm is open, {name}! Your neighbours need you.') : t('Mama Achieng asked you to check her sukuma wiki.')} />
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
        ending={{ line: "You can read a shamba now, {name}, and your neighbours' shambas need you.", button: 'Help the neighbours' }}
        onPassed={() => track('review_passed', { shamba: sh.id, first: true })}
        onFailed={() => go('walkRetry')}
        onEnd={() => go('walk2', { at: sh.id === 'lower' ? 'lower' : 'first', opened: false })}
      />
    );
  }

  if (phase === 'review2')
    return (
      <Review
        key="achieng"
        shamba={SHAMBAS.achieng}
        name={name}
        look={look}
        ending={{ line: "The rains are due tonight, {name}. Check Mama Achieng's sukuma wiki again tomorrow.", button: 'Go to my farm' }}
        onPassed={() => track('review_passed', { shamba: 'achieng' })}
        onFailed={() => undefined}
        onEnd={() => {
          track('session_close');
          go('done', { note: "Check Mama Achieng's sukuma wiki after the rains." });
          dispatch({ type: 'toast', text: t('Welcome to your farm, {name}.') });
        }}
      />
    );

  return null;
}
