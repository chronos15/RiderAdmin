import { useEffect, useState } from 'react';
import { Download, RefreshCw, Search } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { dateTime, EmptyState, LoadingState, PageHeader, Section } from '../../components/Ui';

export function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() { setLoading(true); try { setLogs(await adminService.auditLogs()); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  const filtered = logs.filter((log) => !search || `${log.action} ${log.entity} ${log.profiles?.name ?? ''} ${JSON.stringify(log.metadata ?? {})}`.toLowerCase().includes(search.toLowerCase()));
  function exportCsv() { const content = [['Data','Administrador','Ação','Entidade','ID','Metadados'], ...filtered.map((log) => [dateTime(log.created_at),log.profiles?.name ?? '',log.action,log.entity,log.entity_id ?? '',JSON.stringify(log.metadata ?? {})])].map((row) => row.map((value) => `"${String(value).replaceAll('"','""')}"`).join(';')).join('\n'); const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' })); const link = document.createElement('a'); link.href = url; link.download = 'auditoria_admin.csv'; link.click(); URL.revokeObjectURL(url); }
  return <><PageHeader title="Auditoria" description="Registro das ações críticas realizadas pela equipe administrativa." actions={<><button className="button secondary" onClick={load}><RefreshCw size={17}/> Atualizar</button><button className="button dark" onClick={exportCsv}><Download size={17}/> Exportar</button></>}/><Section className="table-section"><label className="search-field audit-search"><Search size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar ação, entidade ou administrador"/></label>{loading ? <LoadingState/> : filtered.length ? <div className="audit-list">{filtered.map((log) => <article key={log.id}><div className="audit-time"><strong>{new Date(log.created_at).toLocaleDateString('pt-BR')}</strong><span>{new Date(log.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div><div className="audit-line"><span/><div><strong>{log.action}</strong><p>{log.entity}{log.entity_id ? ` · ${log.entity_id}` : ''}</p><small>{log.profiles?.name ?? 'Administrador'} · {JSON.stringify(log.metadata ?? {})}</small></div></div></article>)}</div> : <EmptyState title="Nenhum log encontrado" description="As ações administrativas aparecerão nesta linha do tempo."/>}</Section></>;
}
