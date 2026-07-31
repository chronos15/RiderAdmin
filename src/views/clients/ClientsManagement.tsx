import { useEffect, useState } from 'react';
import { Ban, Eye, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';
import type { ClientSummary } from '../../types/admin';
import { adminService } from '../../services/adminService';
import { Badge, dateTime, EmptyState, LoadingState, Modal, money, PageHeader, SearchField, Section } from '../../components/Ui';

export function ClientsManagement() {
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<ClientSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() { setLoading(true); try { setClients(await adminService.clients(search, status)); } finally { setLoading(false); } }
  useEffect(() => { const timer = window.setTimeout(load, 180); return () => window.clearTimeout(timer); }, [search, status]);

  async function toggleStatus(client: ClientSummary) {
    const next = client.status === 'blocked' ? 'active' : 'blocked';
    const reason = next === 'blocked' ? window.prompt('Informe o motivo do bloqueio:') : undefined;
    if (next === 'blocked' && !reason) return;
    await adminService.setUserStatus(client.id, next, reason ?? undefined);
    await load();
    if (selected?.id === client.id) setSelected({ ...client, status: next });
  }

  return <>
    <PageHeader title="Clientes" description="Gerencie usuários, bloqueios, histórico e relacionamento com a plataforma." actions={<button className="button secondary" onClick={load}><RefreshCw size={17}/> Atualizar</button>}/>
    <Section className="table-section">
      <div className="table-toolbar"><SearchField value={search} onChange={setSearch} placeholder="Buscar por nome ou telefone"/><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos</option><option value="active">Ativos</option><option value="blocked">Bloqueados</option></select></div>
      {loading ? <LoadingState/> : clients.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Status</th><th>Corridas</th><th>Total movimentado</th><th>Última viagem</th><th></th></tr></thead><tbody>{clients.map((client) => <tr key={client.id}><td><div className="identity-cell"><div className="avatar small"><UserRound size={18}/></div><div><strong>{client.name || 'Sem nome'}</strong><span>{client.phone || 'Sem telefone'}</span></div></div></td><td><Badge status={client.status}/></td><td>{client.ride_count ?? 0}</td><td>{money(client.total_spent)}</td><td>{dateTime(client.last_ride_at)}</td><td><div className="row-actions"><button className="icon-btn bordered" onClick={() => setSelected(client)}><Eye size={18}/></button><button className={`icon-btn bordered ${client.status === 'blocked' ? 'success' : 'danger'}`} onClick={() => toggleStatus(client)}>{client.status === 'blocked' ? <ShieldCheck size={18}/> : <Ban size={18}/>}</button></div></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum cliente encontrado" description="Ajuste os filtros ou aguarde novos cadastros."/>}
    </Section>
    <Modal open={Boolean(selected)} title={selected?.name ?? 'Cliente'} description={selected?.phone ?? ''} onClose={() => setSelected(null)} footer={selected && <div className="modal-action-row"><button className={selected.status === 'blocked' ? 'button primary' : 'button danger'} onClick={() => toggleStatus(selected)}>{selected.status === 'blocked' ? <><ShieldCheck size={17}/> Desbloquear usuário</> : <><Ban size={17}/> Bloquear usuário</>}</button></div>}>
      {selected && <div className="client-overview"><div className="client-hero"><div className="avatar large">{selected.name?.slice(0,1) ?? 'C'}</div><div><h3>{selected.name}</h3><p>Cadastrado em {dateTime(selected.created_at)}</p><Badge status={selected.status}/></div></div><div className="client-metrics"><div><span>Corridas</span><strong>{selected.ride_count ?? 0}</strong></div><div><span>Movimentado</span><strong>{money(selected.total_spent)}</strong></div><div><span>Última viagem</span><strong>{dateTime(selected.last_ride_at)}</strong></div></div><div className="notice"><ShieldCheck size={18}/><div><strong>Dados protegidos</strong><p>Alterações críticas ficam registradas na auditoria administrativa.</p></div></div></div>}
    </Modal>
  </>;
}
