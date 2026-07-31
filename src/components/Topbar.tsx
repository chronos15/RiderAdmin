import { Bell, LogOut, Menu, Moon, Search, Sun } from 'lucide-react';
import type { ThemeMode } from '../types/admin';

export function Topbar({
  theme,
  onToggleTheme,
  onSignOut,
  adminName,
  menuOpen,
  onMenu,
}: {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onSignOut: () => void;
  adminName: string;
  menuOpen: boolean;
  onMenu: () => void;
}) {
  return (
    <header className="admin-topbar">
      <button
        className="icon-btn mobile-menu"
        onClick={onMenu}
        aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={menuOpen}
        aria-controls="admin-sidebar"
      >
        <Menu size={21} />
      </button>
      <label className="top-search">
        <Search size={18} />
        <input placeholder="Buscar motorista, cliente ou corrida" />
      </label>
      <div className="topbar-actions">
        <button className="icon-btn" onClick={onToggleTheme} aria-label="Alternar tema">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        <button className="icon-btn notification-btn" aria-label="Notificações">
          <Bell size={20} />
          <span />
        </button>
        <div className="admin-profile">
          <div className="avatar">{adminName.slice(0, 1).toUpperCase()}</div>
          <div>
            <strong>{adminName}</strong>
            <span>Administrador</span>
          </div>
        </div>
        <button className="icon-btn" onClick={onSignOut} aria-label="Sair">
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}
