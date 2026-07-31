import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { AdminView, ThemeMode } from '../types/admin';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const DESKTOP_BREAKPOINT = 1120;

export function AdminLayout({
  children,
  activeView,
  onNavigate,
  theme,
  onToggleTheme,
  onSignOut,
  adminName,
}: {
  children: ReactNode;
  activeView: AdminView;
  onNavigate: (view: AdminView) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onSignOut: () => void;
  adminName: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth > DESKTOP_BREAKPOINT) setMobileOpen(false);
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };

    window.addEventListener('resize', closeOnDesktop);
    window.addEventListener('keydown', closeOnEscape);

    return () => {
      window.removeEventListener('resize', closeOnDesktop);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  function navigate(view: AdminView) {
    onNavigate(view);
    setMobileOpen(false);
  }

  return (
    <div className="admin-shell">
      <Sidebar
        activeView={activeView}
        onNavigate={navigate}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="admin-content">
        <Topbar
          theme={theme}
          onToggleTheme={onToggleTheme}
          onSignOut={onSignOut}
          adminName={adminName}
          menuOpen={mobileOpen}
          onMenu={() => setMobileOpen((current) => !current)}
        />
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}
