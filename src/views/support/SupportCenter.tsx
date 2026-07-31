import { useEffect, useState } from 'react';
import { CheckCircle2, Eye, MessageSquareReply, RefreshCw } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Badge, dateTime, EmptyState, LoadingState, Modal, PageHeader, Section } from '../../components/Ui';

export function SupportCenter() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState('');
  async function load() { setLoading(true); try { setTickets(await adminService.supportTickets(status)); } finally { setLoading(false); } }
  useEffect(() => { load(); }, [status]);
  async function update(nextStatus: string) { if (!selected) return; await adminService.updateTicket(selected.id, nextStatus, resolution); setSelected(null); setResolution(''); await load(); }

  return <>
    <PageHeader title="Suporte" description="Chamados de clientes e motoristas, prioridades e resolução operacional." actions={<button className="button secondary" onClick={load}><RefreshCw size={17}/> Atualizar</button>}/>
    <Section className="table-section"><div className="table-toolbar"><div className="segmented"><button className={status === 'all' ? 'active' : ''} onClick={() => setStatus('all')}>Todos</button><button className={status === 'open' ? 'active' : ''} onClick={() => setStatus('open')}>Abertos</button><button className={status === 'reviewing' ? 'active' : ''} onClick={() => setStatus('reviewing')}>Em análise</button><button className={status === 'resolved' ? 'active' : ''} onClick={() => setStatus('resolved')}>Resolvidos</button></div></div>{loading ? <LoadingState/> : tickets.length ? <div className="support-grid">{tickets.map((ticket) => <article className="support-card" key={ticket.id}><div className="support-head"><Badge status={ticket.status ?? 'open'}/><Badge status={ticket.priority === 'urgent' ? 'critical' : 'pending'} label={ticket.priority ?? 'normal'}/></div><h3>{ticket.subject}</h3><p>{ticket.message}</p><div className="support-meta"><span>{ticket.profiles?.name ?? 'Usuário'}</span><span>{ticket.profiles?.role ?? '—'}</span><span>{dateTime(ticket.created_at)}</span></div><button className="button secondary full" onClick={() => { setSelected(ticket); setResolution(''); }}><Eye size={17}/> Abrir chamado</button></article>)}</div> : <EmptyState title="Nenhum chamado" description="A central está sem chamados para o filtro selecionado."/>}</Section>
    <Modal open={Boolean(selected)} title={selected?.subject ?? 'Chamado'} description={`${selected?.profiles?.name ?? 'Usuário'} · ${dateTime(selected?.created_at)}`} onClose={() => setSelected(null)} footer={<div className="modal-action-row"><button className="button secondary" onClick={() => update('reviewing')}><MessageSquareReply size={17}/> Colocar em análise</button><button className="button primary" onClick={() => update('resolved')}><CheckCircle2 size={17}/> Resolver chamado</button></div>}>
      {selected && <div className="ticket-detail"><div className="badge-row"><Badge status={selected.status}/><Badge status={selected.priority === 'urgent' ? 'critical' : 'pending'} label={selected.priority}/></div><div className="message-bubble">{selected.message}</div><label className="field"><span>Resposta / resolução</span><textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows={5} placeholder="Registre o atendimento realizado..."/></label>{selected.ride_id && <div className="notice"><strong>Corrida vinculada</strong><p>{selected.ride_id}</p></div>}</div>}
    </Modal>
  </>;
}
