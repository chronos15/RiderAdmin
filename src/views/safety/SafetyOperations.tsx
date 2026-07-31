import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Eye, RefreshCw, ShieldAlert, Siren } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Badge, dateTime, EmptyState, LoadingState, PageHeader, Section, StatCard } from '../../components/Ui';

export function SafetyOperations() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [cancellations, setCancellations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  async function load() { setLoading(true); try { const data: any = await adminService.safetyOverview(); setIncidents(data?.incidents ?? []); setCancellations(data?.cancellations ?? []); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  const critical = useMemo(() => incidents.filter((item) => item.severity === 'critical' && !['resolved','dismissed'].includes(item.status)).length, [incidents]);
  async function update(id: string, status: 'reviewing' | 'resolved') { setBusy(id); try { await adminService.resolveSafetyIncident(id, status, status === 'resolved' ? 'Resolvido pela central administrativa.' : undefined); await load(); } finally { setBusy(''); } }

  return <>
    <PageHeader title="Segurança" description="SOS, incidentes, cancelamentos e intervenção da central." actions={<button className="button secondary" onClick={load}><RefreshCw size={17}/> Atualizar</button>}/>
    <div className="stats-grid safety-stats"><StatCard label="Incidentes ativos" value={incidents.filter((item) => !['resolved','dismissed'].includes(item.status)).length} detail="Aguardando atuação" icon={<ShieldAlert size={19}/>} tone="warning"/><StatCard label="Críticos" value={critical} detail="Prioridade máxima" icon={<Siren size={19}/>} tone={critical ? 'danger' : 'neutral'}/><StatCard label="Cancelamentos" value={cancellations.length} detail="Registros recentes" icon={<RefreshCw size={19}/>} /></div>
    {loading ? <LoadingState/> : <div className="safety-layout"><Section title="Incidentes" description="Ocorrências abertas por clientes, motoristas ou administradores.">{incidents.length ? <div className="incident-list">{incidents.map((incident) => <article className={`incident-card ${incident.severity === 'critical' ? 'critical' : ''}`} key={incident.id}><div className="incident-icon"><Siren size={20}/></div><div className="incident-content"><div className="badge-row"><Badge status={incident.status}/><Badge status={incident.severity === 'critical' ? 'critical' : 'pending'} label={incident.severity}/></div><h3>{incident.incident_type ?? 'Incidente'}</h3><p>{incident.description ?? 'Sem descrição'}</p><small>{dateTime(incident.created_at)} · {incident.reporter_role ?? 'usuário'}</small></div><div className="incident-actions">{incident.status === 'open' && <button disabled={busy === incident.id} onClick={() => update(incident.id, 'reviewing')}><Eye size={17}/></button>}<button disabled={busy === incident.id} onClick={() => update(incident.id, 'resolved')}><CheckCircle2 size={17}/></button></div></article>)}</div> : <EmptyState title="Sem incidentes" description="Nenhuma ocorrência ativa na central."/>}</Section><Section title="Cancelamentos recentes" description="Motivos, responsáveis e taxas aplicadas.">{cancellations.length ? <div className="cancellation-list">{cancellations.map((item) => <article key={item.id}><div><strong>{item.reason_text ?? item.reason_code ?? 'Cancelamento'}</strong><span>{item.actor_role ?? '—'} · {dateTime(item.created_at)}</span></div><div><Badge status={item.status_at_cancel ?? 'cancelled'}/><strong>R$ {Number(item.fee_amount ?? 0).toFixed(2).replace('.', ',')}</strong></div></article>)}</div> : <EmptyState title="Sem cancelamentos" description="Não há registros recentes."/>}</Section></div>}
  </>;
}
