import {
  Activity,
  BadgeDollarSign,
  CarFront,
  ChevronRight,
  CircleGauge,
  Headphones,
  MapPinned,
  Settings2,
  WalletCards,
  ShieldCheck,
  Users,
  X,
  ScrollText,
  Star,
} from 'lucide-react';
import type { AdminView } from '../types/admin';

const navigation: Array<{ view: AdminView; label: string; icon: typeof Activity }> = [
  { view: 'dashboard', label: 'Visão geral', icon: CircleGauge },
  { view: 'operation', label: 'Operação ao vivo', icon: MapPinned },
  { view: 'drivers', label: 'Motoristas', icon: CarFront },
  { view: 'clients', label: 'Clientes', icon: Users },
  { view: 'rides', label: 'Corridas', icon: Activity },
  { view: 'finance', label: 'Financeiro', icon: BadgeDollarSign },
  { view: 'payments', label: 'Pagamentos e Asaas', icon: WalletCards },
  { view: 'safety', label: 'Segurança', icon: ShieldCheck },
  { view: 'support', label: 'Suporte', icon: Headphones },
  { view: 'ratings', label: 'Avaliações', icon: Star },
  { view: 'settings', label: 'Operação e tarifas', icon: Settings2 },
  { view: 'audit', label: 'Auditoria', icon: ScrollText },
];

export function Sidebar({
  activeView,
  onNavigate,
  open,
  onClose,
}: {
  activeView: AdminView;
  onNavigate: (view: AdminView) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {open && <button className="sidebar-overlay" onClick={onClose} aria-label="Fechar menu" />}
      <aside
        id="admin-sidebar"
        className={`admin-sidebar ${open ? 'open' : ''}`}
        aria-label="Menu administrativo"
      >
        <div className="sidebar-brand">
          <div className="brand-mark">R</div>
          <div className="sidebar-brand-copy">
            <strong>RiderX</strong>
            <span>Central administrativa</span>
          </div>
          <button className="sidebar-close" onClick={onClose} aria-label="Fechar menu">
            <X size={20} />
          </button>
        </div>
        <nav className="sidebar-nav" aria-label="Navegação administrativa">
          {navigation.map(({ view, label, icon: Icon }) => (
            <button
              key={view}
              className={activeView === view ? 'active' : ''}
              onClick={() => onNavigate(view)}
              aria-current={activeView === view ? 'page' : undefined}
            >
              <Icon size={20} />
              <span>{label}</span>
              {activeView === view && <ChevronRight size={16} className="nav-arrow" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-status">
          <span className="live-dot" />
          <div>
            <strong>Supabase Realtime</strong>
            <span>Operação conectada</span>
          </div>
        </div>
      </aside>
    </>
  );
}
