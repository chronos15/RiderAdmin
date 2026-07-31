import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { authService } from '../../services/authService';

export function AdminLogin({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { error: authError } = await authService.signIn(email.trim(), password);
      if (authError) throw authError;
      const profile = await authService.getAdminProfile();
      if (!profile || profile.role !== 'admin' || profile.status !== 'active') {
        await authService.signOut();
        throw new Error('Esta conta não possui acesso administrativo ativo.');
      }
      onAuthenticated();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-shell">
    <section className="login-brand-panel">
      <div className="login-brand"><div className="brand-mark large">R</div><span>RiderX Admin</span></div>
      <div className="login-copy"><span className="eyebrow"><ShieldCheck size={16}/> Operação protegida</span><h1>Controle a mobilidade da sua cidade em um só lugar.</h1><p>Acompanhe corridas, aprove motoristas, configure tarifas e intervenha na operação em tempo real.</p></div>
      <div className="login-grid-lines"/>
    </section>
    <section className="login-form-panel">
      <form className="login-form" onSubmit={submit}>
        <div className="login-icon"><LockKeyhole size={24}/></div><h2>Entrar na central</h2><p>Use uma conta com perfil administrativo no Supabase.</p>
        <label><span>E-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@empresa.com" required/></label>
        <label><span>Senha</span><div className="password-field"><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" required/><button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></label>
        {error && <div className="form-error">{error}</div>}
        <button className="button primary full" disabled={busy}>{busy ? <span className="spinner light"/> : <>Entrar <ArrowRight size={18}/></>}</button>
        <small>A central nunca utiliza a service role key no navegador.</small>
      </form>
    </section>
  </main>;
}
