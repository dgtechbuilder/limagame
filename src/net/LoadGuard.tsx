import { Component, type ReactNode } from 'react';
import { online, onNetChange } from './connection';
import { newLoadAttempt } from '../prefetch';

/* What shows when a part of the game could not be downloaded (an activity's code on a weak or missing signal), in
   place of a blank screen: a card that says the farm is safe, a Try again button, and a way back to the farm. It tries
   again by itself as soon as the phone comes back online. Wraps every activity's Suspense (App.tsx, World.tsx). If the
   game was updated while it was open (the old files are gone from the server), it reloads to the new one; and if a
   second try fails with a signal, Try again opens the game again (a fresh page fetches every file anew). Progress is
   saved on the phone and the address keeps the screen (src/route.ts), so nothing is lost. */

interface Props {
  children: ReactNode;
  /** back to the farm (closes the screen that could not open) */
  onBack?: () => void;
  /** the whole screen, not a card over the farm */
  full?: boolean;
}
interface State {
  error: boolean;
  attempt: number;
  /** Try again reloads the page (a second try failed with a signal) */
  reload?: boolean;
}

const RELOADED = 'lima-reloaded-for-update';

/** The game was updated since this page was opened: the page's own entry file is no longer named in the new page. */
async function updatedSinceOpened(): Promise<boolean> {
  const mine = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))
    .map(s => s.getAttribute('src') ?? '')
    .find(src => /\/assets\/index-[\w-]+\.js$/.test(src));
  if (!mine) return false;
  try {
    const r = await fetch(`./?fresh=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    return !(await r.text()).includes(mine.replace(/^.*\/assets\//, 'assets/'));
  } catch {
    return false;
  }
}

export class LoadGuard extends Component<Props, State> {
  state: State = { error: false, attempt: 0 };
  private off: (() => void) | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { error: true };
  }

  componentDidCatch() {
    // back online: try again by itself
    this.off?.();
    this.off = onNetChange(() => {
      if (this.state.error && online()) this.retry();
    });
    if (online()) {
      void updatedSinceOpened().then(updated => {
        let done = false;
        try {
          done = window.sessionStorage.getItem(RELOADED) === '1';
          if (updated && !done) window.sessionStorage.setItem(RELOADED, '1');
        } catch {
          /* no session storage: reload at most this once anyway */
        }
        if (updated && !done) window.location.reload();
      });
    }
  }

  componentDidUpdate(_p: Props, prev: State) {
    // a try that failed again with a signal: the next one opens the game again
    if (this.state.error && !prev.error && this.state.attempt > 0 && online() && !this.state.reload) this.setState({ reload: true });
  }

  componentWillUnmount() {
    this.off?.();
  }

  retry = () => {
    if (this.state.reload && online()) {
      window.location.reload();
      return;
    }
    this.off?.();
    this.off = null;
    newLoadAttempt();
    this.setState(s => ({ error: false, attempt: s.attempt + 1 }));
  };

  render() {
    if (!this.state.error) return <Keyed key={this.state.attempt}>{this.props.children}</Keyed>;
    const off = !online();
    return (
      <div className={`abs act-loading net-fail${this.props.full ? ' is-full' : ''}`} style={{ inset: 0 }} role="alert">
        <div className="act-loading-card net-fail-card">
          <span className="net-fail-icon" aria-hidden="true">
            {off ? '📵' : '📶'}
          </span>
          <span className="net-fail-text">
            <b>{off ? 'No signal just now' : 'The signal is weak'}</b>
            <small>
              {off
                ? 'This part of the game has not downloaded yet. Your farm is saved on this phone; this opens by itself when the signal is back.'
                : 'This part of the game did not finish downloading. Your farm is saved on this phone.'}
            </small>
            <span className="net-fail-actions">
              <button type="button" className="ach-claim" onClick={this.retry}>
                {this.state.reload && !off ? 'Open the game again' : 'Try again'}
              </button>
              {this.props.onBack && (
                <button type="button" className="set-link" onClick={this.props.onBack}>
                  Back to the farm
                </button>
              )}
            </span>
          </span>
        </div>
      </div>
    );
  }
}

/** Remounts its children for each attempt (a fresh try at downloading what failed). */
function Keyed({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

/** The last line of defence: any crash while drawing the game shows this card instead of a blank screen. */
export class CrashGuard extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="net-crash" role="alert">
        <div className="act-loading-card net-fail-card">
          <span className="net-fail-text">
            <b>Something went wrong</b>
            <small>Your farm is saved on this phone. Open the game again to carry on.</small>
            <span className="net-fail-actions">
              <button type="button" className="ach-claim" onClick={() => window.location.reload()}>
                Open again
              </button>
            </span>
          </span>
        </div>
      </div>
    );
  }
}
