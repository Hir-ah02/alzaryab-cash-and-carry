import { useEffect, useRef, useState } from 'react';
import { Outlet, ScrollRestoration, useLocation, useMatches, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useMediaQuery } from '../utils/hooks';
import Header from './Header';
import Sidebar from './Sidebar';

const COLLAPSED_KEY = 'alzaryab.sidebarCollapsed';

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Sidebar + sticky Header + main content (the current page renders in <Outlet />). */
export default function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const matches = useMatches();
  const isMobile = useMediaQuery('(max-width: 767px)');
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toggleRef = useRef(null);

  const title = [...matches].reverse().find((m) => m.handle?.title)?.handle.title ?? 'Dashboard';

  useEffect(() => {
    document.title = `${title} · Alzaryab Admin Portal`;
  }, [title]);

  // Close the mobile drawer whenever the route changes or we leave mobile size.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, isMobile]);

  // Esc closes the drawer and returns focus to the menu button.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    document.querySelector('#app-sidebar .nav-item')?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const toggleSidebar = () => {
    if (isMobile) {
      setDrawerOpen((v) => !v);
      return;
    }
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, v ? '0' : '1');
      } catch {
        /* storage unavailable – ignore */
      }
      return !v;
    });
  };

  // Logging out goes through a route so unsaved-changes guards can intercept it.
  const handleLogout = () => navigate('/logout');

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link" onClick={(e) => {
        e.preventDefault();
        document.getElementById('main-content')?.focus();
      }}>
        Skip to main content
      </a>

      <Sidebar
        collapsed={collapsed}
        isMobile={isMobile}
        mobileOpen={drawerOpen}
        onNavigate={() => setDrawerOpen(false)}
        onLogout={handleLogout}
      />
      {isMobile && drawerOpen && (
        <div className="sidebar-scrim" aria-hidden="true" onClick={() => setDrawerOpen(false)} />
      )}

      <div className="main-column">
        <Header
          title={title}
          user={user}
          isMobile={isMobile}
          collapsed={collapsed}
          drawerOpen={drawerOpen}
          onToggleSidebar={toggleSidebar}
          onLogout={handleLogout}
          toggleRef={toggleRef}
        />
        <main id="main-content" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <ScrollRestoration />
    </div>
  );
}
