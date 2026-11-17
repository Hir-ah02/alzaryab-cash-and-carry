import { Link, useLocation } from 'react-router';
import { LogOut } from 'lucide-react';
import cx from '../utils/cx';
import Logo from '../components/Logo';
import { NAV_GROUPS } from './navItems';

export default function Sidebar({ collapsed, mobileOpen, isMobile, onNavigate, onLogout }) {
  const { pathname } = useLocation();
  // Icon-only mode only applies on desktop; the mobile drawer always shows labels.
  const iconOnly = collapsed && !isMobile;

  return (
    <aside
      id="app-sidebar"
      className={cx('sidebar', collapsed && 'is-collapsed', mobileOpen && 'is-open')}
      aria-label="Main navigation"
    >
      <div className="sidebar__brand">
        <Link to="/" className="sidebar__brand-link" aria-label="Alzaryab Cash & Carry – Dashboard" onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      <nav className="sidebar__nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="sidebar__group-label" id={`nav-group-${group.label}`}>
              {group.label}
            </p>
            <ul className="sidebar__list" aria-labelledby={`nav-group-${group.label}`}>
              {group.items.map((item) => {
                const active = item.isActive(pathname);
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className={cx('nav-item', active && 'is-active')}
                      aria-current={active ? 'page' : undefined}
                      title={iconOnly ? item.label : undefined}
                      aria-label={iconOnly ? item.label : undefined}
                      onClick={onNavigate}
                    >
                      <Icon size={20} aria-hidden="true" />
                      <span className="nav-item__label">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button
          type="button"
          className="nav-item nav-item--logout"
          onClick={onLogout}
          title={iconOnly ? 'Logout' : undefined}
          aria-label={iconOnly ? 'Logout' : undefined}
        >
          <LogOut size={20} aria-hidden="true" />
          <span className="nav-item__label">Logout</span>
        </button>
      </div>
    </aside>
  );
}
