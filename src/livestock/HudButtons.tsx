import type { Dispatch } from 'react';
import type { Action, GameState } from '../state';
import { animalsBadge, careOpen, lifeOf } from './model';
import { activeMeasures, securityOf, theftOpen } from '../security/model';

/** The classic farm's buttons, in its peach style: a badge for jobs and problems, a ! after a theft. */
export function ClassicLifeButtons({ s, dispatch }: { s: GameState; dispatch: Dispatch<Action> }) {
  const n = animalsBadge(s);
  const sick = lifeOf(s.life).issues.length > 0;
  const sec = securityOf(s.security);
  const fresh = sec.reports[0]?.events.some(e => e.kind === 'theft' || e.kind === 'predator') ?? false;
  const col = { width: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 } as const;
  return (
    <>
      <button type="button" className="abs" style={{ left: 651, top: 238, ...col }} onClick={() => dispatch({ type: 'open', modal: { kind: 'animals', tab: sick ? 'health' : 'today' } })} aria-label={careOpen(s) ? `Animals: ${n ? `${n} thing${n === 1 ? '' : 's'} to do` : 'all cared for today'}` : 'Animals: in your care from day 2'}>
        <span className="peach-btn" style={{ width: 56, height: 48.66, position: 'relative' }}>
          <HenIcon />
          {n > 0 && <span className="tr-badge">{n}</span>}
        </span>
        <span className="label" style={{ fontSize: 10 }}>Animals</span>
      </button>
      <button type="button" className="abs" style={{ left: 651, top: 310, ...col }} onClick={() => dispatch({ type: 'open', modal: { kind: 'security', tab: fresh ? 'reports' : 'protect' } })} aria-label={`Security: ${activeMeasures(s).length} measures in place${fresh ? ', a theft last night' : ''}`}>
        <span className="peach-btn" style={{ width: 56, height: 48.66, position: 'relative' }}>
          <ShieldIcon />
          {fresh && <span className="tr-badge">!</span>}
        </span>
        <span className="label" style={{ fontSize: 10 }}>Security</span>
      </button>
    </>
  );
}

/* The farm's ANIMALS and SECURITY buttons (the 3D farm and the classic farm): the animals' jobs and problems waiting,
   and how well the farm is watched tonight. */

export function AnimalsButton({ s, dispatch, style }: { s: GameState; dispatch: Dispatch<Action>; style?: React.CSSProperties }) {
  const n = animalsBadge(s);
  const sick = lifeOf(s.life).issues.length > 0;
  const open = careOpen(s);
  return (
    <button
      type="button"
      className={`hud-round hud-animals${sick ? ' is-sick' : ''}`}
      style={style}
      onClick={() => dispatch({ type: 'open', modal: { kind: 'animals', tab: sick ? 'health' : 'today' } })}
      aria-label={open ? `Animals: ${n ? `${n} thing${n === 1 ? '' : 's'} to do` : 'all cared for today'}` : 'Animals: in your care from day 2'}
    >
      <HenIcon />
      <span>ANIMALS</span>
      {n > 0 && (
        <i className="hud-badge" aria-hidden="true">
          {n}
        </i>
      )}
    </button>
  );
}

export function SecurityButton({ s, dispatch, style }: { s: GameState; dispatch: Dispatch<Action>; style?: React.CSSProperties }) {
  const sec = securityOf(s.security);
  const fresh = sec.reports[0]?.events.some(e => e.kind === 'theft' || e.kind === 'predator') ?? false;
  const measures = activeMeasures(s).length;
  return (
    <button
      type="button"
      className={`hud-round hud-security${fresh ? ' is-alert' : ''}`}
      style={style}
      onClick={() => dispatch({ type: 'open', modal: { kind: 'security', tab: fresh ? 'reports' : 'protect' } })}
      aria-label={`Security: ${measures} measure${measures === 1 ? '' : 's'} in place${fresh ? ', a theft last night' : ''}${theftOpen(s) ? '' : ' (thieves from day 2)'}`}
    >
      <ShieldIcon />
      <span>SECURITY</span>
      {fresh && (
        <i className="hud-badge is-alert" aria-hidden="true">
          !
        </i>
      )}
    </button>
  );
}

export function HenIcon() {
  return (
    <svg viewBox="-14 -14 28 28" width={30} height={30} aria-hidden="true">
      <ellipse cx={-1} cy={3} rx={9} ry={7} fill="#fff" />
      <circle cx={6} cy={-5} r={4.4} fill="#fff" />
      <path d="M4,-10 q2,-3 4,0 q1,-3 3,0" fill="#e0432f" />
      <path d="M10,-5 l4,1.4 l-4,1.4 z" fill="#f2b22a" />
      <circle cx={7} cy={-5.6} r={0.9} fill="#333" />
      <path d="M-10,0 q-4,-6 0,-9" stroke="#fff" strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M-2,10 v3 M2,10 v3" stroke="#f2b22a" strokeWidth={1.6} />
    </svg>
  );
}

export function ShieldIcon() {
  return (
    <svg viewBox="-14 -14 28 28" width={30} height={30} aria-hidden="true">
      <path d="M0,-12 L10,-8 C10,2 6,8 0,12 C-6,8 -10,2 -10,-8 Z" fill="#fff" />
      <path d="M0,-8 L6,-5.6 C6,1 4,5 0,8 Z" fill="#c9d6dc" />
      <rect x={-3.6} y={-1} width={7.2} height={6} rx={1.2} fill="#3d6e86" />
      <path d="M-2,-1 v-2 a2,2 0 0 1 4,0 v2" stroke="#3d6e86" strokeWidth={1.4} fill="none" />
    </svg>
  );
}
