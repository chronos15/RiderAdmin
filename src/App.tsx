import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminView } from './types/admin';
import { useTheme } from './hooks/useTheme';
import { authService } from './services/authService';
import { supabase } from './services/supabaseService';
import { AdminLayout } from './components/AdminLayout';
import { AdminLogin } from './views/auth/AdminLogin';
import { AdminDashboard } from './views/dashboard/AdminDashboard';
import { OperationPage } from './views/operation/OperationPage';
import { DriversManagement } from './views/drivers/DriversManagement';
import { ClientsManagement } from './views/clients/ClientsManagement';
import { RidesManagement } from './views/rides/RidesManagement';
import { FinancePage } from './views/finance/FinancePage';
import { SafetyOperations } from './views/safety/SafetyOperations';
import { SupportCenter } from './views/support/SupportCenter';
import { RatingsManagement } from './views/ratings/RatingsManagement';
import { OperationsSettings } from './views/settings/OperationsSettings';
import { AuditPage } from './views/audit/AuditPage';
import { LoadingState } from './components/Ui';

const demoMode = import.meta.env.VITE_ADMIN_DEMO_MODE === 'true';

export function App() {
  const { theme, toggleTheme } = useTheme();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any | null>(demoMode ? { name: 'Administrador Demo', role: 'admin', status: 'active' } : null);
  const [loading, setLoading] = useState(!demoMode);
  const [view, setView] = useState<AdminView>(() => (window.location.hash.replace('#/', '') as AdminView) || 'dashboard');

  async function resolveAuth(nextSession?: Session | null) {
    if (demoMode) { setLoading(false); return; }
    setLoading(true);
    try {
      const current = nextSession ?? (await authService.getSession()).data.session;
      setSession(current);
      if (!current) { setProfile(null); return; }
      const admin = await authService.getAdminProfile();
      if (!admin || admin.role !== 'admin' || admin.status !== 'active') {
        await authService.signOut(); setSession(null); setProfile(null); return;
      }
      setProfile(admin);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    resolveAuth();
    if (demoMode) return;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { resolveAuth(nextSession); });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onHash = () => setView((window.location.hash.replace('#/', '') as AdminView) || 'dashboard');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function navigate(next: AdminView) { setView(next); window.history.replaceState(null, '', `#/${next}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  async function signOut() { if (!demoMode) await authService.signOut(); setSession(null); setProfile(null); }

  if (loading) return <div className="full-loading"><LoadingState label="Validando acesso administrativo..."/></div>;
  if (!demoMode && (!session || !profile)) return <AdminLogin onAuthenticated={() => resolveAuth()}/>;

  const content = (() => {
    switch (view) {
      case 'operation': return <OperationPage theme={theme}/>;
      case 'drivers': return <DriversManagement/>;
      case 'clients': return <ClientsManagement/>;
      case 'rides': return <RidesManagement/>;
      case 'finance': return <FinancePage/>;
      case 'payments': return <OperationsSettings theme={theme} initialTab="payments"/>;
      case 'safety': return <SafetyOperations/>;
      case 'support': return <SupportCenter/>;
      case 'ratings': return <RatingsManagement/>;
      case 'settings': return <OperationsSettings theme={theme}/>;
      case 'audit': return <AuditPage/>;
      default: return <AdminDashboard onNavigate={navigate}/>;
    }
  })();

  return <AdminLayout activeView={view} onNavigate={navigate} theme={theme} onToggleTheme={toggleTheme} onSignOut={signOut} adminName={profile?.name || 'Administrador'}>{content}</AdminLayout>;
}
