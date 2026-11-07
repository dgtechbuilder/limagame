import { createContext, useContext, type CSSProperties } from 'react';

/* Navigation that every screen shares: Back (one step), Menu (the main menu), Farm (all the way home).
   The app provides the actions; a screen only says what its own Back does. */

export interface NavApi {
  /** open the main menu on top of the current screen */
  menu: () => void;
  /** close every screen and go back to the farm */
  home: () => void;
  /** open Settings */
  settings: () => void;
  /** the main menu is open now (a live game, like the tractor drive, waits while it is) */
  menuOpen: boolean;
}

export const NavContext = createContext<NavApi>({ menu: () => undefined, home: () => undefined, settings: () => undefined, menuOpen: false });
export const useNav = () => useContext(NavContext);

export function NavBar({
  onBack,
  onHome,
  backLabel = 'Back',
  hideMenu,
  hideHome,
  showSettings,
  horizontal,
  style,
}: {
  /** what Back does on this screen; leave out when there is nothing to go back to */
  onBack?: () => void;
  /** what Farm does when a screen has to finish something first (the default closes every screen) */
  onHome?: () => void;
  backLabel?: string;
  hideMenu?: boolean;
  hideHome?: boolean;
  /** a Settings button too (before the farm is open, Settings is the only other place to go) */
  showSettings?: boolean;
  horizontal?: boolean;
  style?: CSSProperties;
}) {
  const nav = useNav();
  return (
    <nav className={`navbar${horizontal ? ' is-row' : ''}`} aria-label="Navigation" style={style}>
      {onBack && (
        <button type="button" className="nav-btn" onClick={onBack} aria-label={backLabel === 'Back' ? 'Back' : backLabel}>
          <i aria-hidden="true">←</i>
          <span>{backLabel}</span>
        </button>
      )}
      {!hideMenu && (
        <button type="button" className="nav-btn" onClick={nav.menu} aria-label="Main menu">
          <i aria-hidden="true">☰</i>
          <span>Menu</span>
        </button>
      )}
      {showSettings && (
        <button type="button" className="nav-btn" onClick={nav.settings} aria-label="Settings">
          <i aria-hidden="true">⚙</i>
          <span>Settings</span>
        </button>
      )}
      {!hideHome && (
        <button type="button" className="nav-btn" onClick={onHome ?? nav.home} aria-label="Back to my farm">
          <i aria-hidden="true">⌂</i>
          <span>Farm</span>
        </button>
      )}
    </nav>
  );
}
