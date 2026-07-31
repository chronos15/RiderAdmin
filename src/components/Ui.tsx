import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Search, X } from 'lucide-react';

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return <header className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{actions && <div className="page-actions">{actions}</div>}</header>;
}

export function Section({ title, description, actions, children, className = '' }: { title?: string; description?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`surface ${className}`}>
    {(title || actions) && <div className="section-head"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{actions && <div className="section-actions">{actions}</div>}</div>}
    {children}
  </section>;
}

export function StatCard({ label, value, detail, icon, tone = 'neutral' }: { label: string; value: string | number; detail?: string; icon?: ReactNode; tone?: 'neutral' | 'positive' | 'warning' | 'danger' }) {
  return <article className={`stat-card ${tone}`}><div className="stat-top"><span>{label}</span>{icon && <span className="stat-icon">{icon}</span>}</div><strong>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

export function Badge({ status, label }: { status: string; label?: string }) {
  const normalized = status?.toLowerCase?.() || 'neutral';
  const positive = ['approved', 'active', 'completed', 'paid', 'resolved', 'online'].includes(normalized);
  const danger = ['rejected', 'blocked', 'cancelled', 'failed', 'critical', 'charged_back'].includes(normalized);
  const waiting = ['pending', 'pending_cash', 'in_process', 'searching', 'reviewing', 'open', 'driver_arriving', 'accepted'].includes(normalized);
  const Icon = positive ? CheckCircle2 : danger ? AlertTriangle : Clock3;
  return <span className={`status-badge ${positive ? 'positive' : danger ? 'danger' : waiting ? 'warning' : 'neutral'}`}><Icon size={13}/>{label ?? humanize(status)}</span>;
}

export function SearchField({ value, onChange, placeholder = 'Buscar' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="search-field"><Search size={18}/><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder}/>{value && <button type="button" onClick={() => onChange('')} aria-label="Limpar"><X size={16}/></button>}</label>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><div className="empty-icon">•</div><strong>{title}</strong><p>{description}</p></div>;
}

export function LoadingState({ label = 'Carregando dados...' }: { label?: string }) {
  return <div className="loading-state"><span className="spinner"/><span>{label}</span></div>;
}

export function Modal({ open, title, description, onClose, children, footer, size = 'medium' }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'small' | 'medium' | 'large' }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
      <header><div><h2>{title}</h2>{description && <p>{description}</p>}</div><button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={20}/></button></header>
      <div className="modal-body">{children}</div>{footer && <footer>{footer}</footer>}
    </section>
  </div>;
}

export function humanize(value?: string | null) {
  if (!value) return '—';
  const dictionary: Record<string, string> = {
    active: 'Ativo', blocked: 'Bloqueado', pending: 'Pendente', approved: 'Aprovado', rejected: 'Reprovado',
    searching: 'Procurando', accepted: 'Aceita', driver_arriving: 'Motorista a caminho', driver_arrived: 'Motorista chegou',
    in_progress: 'Em andamento', completed: 'Concluída', cancelled: 'Cancelada', expired: 'Expirada',
    open: 'Aberto', reviewing: 'Em análise', resolved: 'Resolvido', paid: 'Pago', failed: 'Falhou', online: 'Online', offline: 'Offline',
    awaiting_payment: 'Aguardando pagamento', pending_cash: 'Aguardando dinheiro', in_process: 'Em análise',
    refund_pending: 'Estorno pendente', partially_refunded: 'Estorno parcial',
    refunded: 'Estornado', charged_back: 'Contestado',
    pix: 'Pix', card: 'Cartão', cash: 'Dinheiro'
  };
  return dictionary[value] ?? value.replaceAll('_', ' ').replace(/^./, (char) => char.toUpperCase());
}

export function money(value?: number | null) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0));
}

export function dateTime(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}
