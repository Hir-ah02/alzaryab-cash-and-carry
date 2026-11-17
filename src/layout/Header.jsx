import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    itemRef.current?.focus();
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="user-menu" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="user-menu"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="avatar" aria-hidden="true">
          {user.initials}
        </span>
        <span className="user-menu__who">
          <span className="user-menu__name">{user.name}</span>
          <span className="user-menu__role">{user.role}</span>
        </span>
        <ChevronDown size={16} className="user-menu__chevron" aria-hidden="true" />
        <span className="sr-only">Account menu</span>
      </button>

      {open && (
        <div
          id="user-menu"
          className="dropdown"
          role="menu"
          aria-label="Account"
          onKeyDown={(e) => {
            if (e.key === 'Escape' || e.key === 'Tab') {
              if (e.key === 'Escape') e.preventDefault();
              close();
            }
          }}
        >
          <div className="dropdown__header" role="presentation">
            <p className="user-menu__name">{user.name}</p>
            <p className="dropdown__email">{user.email}</p>
          </div>
          <button
            ref={itemRef}
            type="button"
            role="menuitem"
            className="dropdown__item"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut size={16} aria-hidden="true" />
            Logout
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header({ title, user, isMobile, collapsed, drawerOpen, onToggleSidebar, onLogout, toggleRef }) {
  let Icon = collapsed ? PanelLeftOpen : PanelLeftClose;
  let label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  let expanded = !collapsed;
  if (isMobile) {
    Icon = Menu;
    label = 'Open navigation menu';
    expanded = drawerOpen;
  }

  return (
    <header className="header">
      <button
        ref={toggleRef}
        type="button"
        className="header__toggle"
        onClick={onToggleSidebar}
        aria-label={label}
        title={label}
        aria-controls="app-sidebar"
        aria-expanded={expanded}
      >
        <Icon size={20} aria-hidden="true" />
      </button>
      <h1 className="header__title">{title}</h1>
      <UserMenu user={user} onLogout={onLogout} />
    </header>
  );
}
