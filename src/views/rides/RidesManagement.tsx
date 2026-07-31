import { useEffect, useState } from 'react';
import { CalendarDays, Eye, RefreshCw, ShieldAlert } from 'lucide-react';
import type { RideSummary } from '../../types/admin';
import { adminService } from '../../services/adminService';
import { Badge, dateTime, EmptyState, LoadingState, Modal, money, PageHeader, SearchField, Section } from '../../components/Ui';

export function RidesManagement() {
  const [rides, setRides] = useState<RideSummary[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<RideSummary | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() { setLoading(true); try { setRides(await adminService.rides({ search, status, from, to })); } finally { setLoading(false); } }
  useEffect(() => { const timer = window.setTimeout(load, 180); return () => window.clearTimeout(timer); }, [search, status, from, to]);

  async function openRide(ride: RideSummary) { setSelected(ride); setDetail(null); try { setDetail(await adminService.rideDetail(ride.id)); } catch { setDetail({ ride }); } }
  async function cancelRide() {
    if (!selected) return;
    const reason = window.prompt('Motivo do cancelamento administrativo:');
    if (!reason) return;
    await adminService.cancelRide(selected.id, reason);
    setSelected(null); setDetail(null); await load();
  }

  return <>
    <PageHeader title="Corridas" description="Histórico completo, filtros, timeline e intervenção administrativa." actions={<button className="button secondary" onClick={load}><RefreshCw size={17}/> Atualizar</button>}/>
    <Section className="table-section">
      <div className="ride-filter-grid"><SearchField value={search} onChange={setSearch} placeholder="Buscar por ID, cliente, motorista ou endereço"/><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos os status</option><option value="searching">Procurando</option><option value="accepted">Aceita</option><option value="driver_arriving">Motorista a caminho</option><option value="driver_arrived">Motorista chegou</option><option value="in_progress">Em andamento</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option></select><label className="date-filter"><CalendarDays size={17}/><input type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label><label className="date-filter"><CalendarDays size={17}/><input type="date" value={to} onChange={(event) => setTo(event.target.value)}/></label></div>
      {loading ? <LoadingState/> : rides.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Cliente</th><th>Motorista</th><th>Trajeto</th><th>Status</th><th>Pagamento</th><th>Valor</th><th></th></tr></thead><tbody>{rides.map((ride) => <tr key={ride.id}><td>{dateTime(ride.created_at)}</td><td>{ride.client?.name ?? '—'}</td><td>{ride.driver?.name ?? '—'}</td><td><div className="route-cell"><strong>{ride.pickup_address ?? 'Origem'}</strong><span>{ride.destination_address ?? 'Destino'}</span></div></td><td><Badge status={ride.status}/></td><td><Badge status={ride.payment_status ?? 'pending'}/></td><td>{money(ride.final_price ?? ride.estimated_price)}</td><td><button className="icon-btn bordered" onClick={() => openRide(ride)}><Eye size={18}/></button></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhuma corrida encontrada" description="Altere o período ou os filtros aplicados."/>}
    </Section>
    <Modal open={Boolean(selected)} title="Detalhes da corrida" description={selected?.id} onClose={() => { setSelected(null); setDetail(null); }} size="large" footer={selected && !['completed','cancelled'].includes(selected.status) && <div className="modal-action-row"><button className="button danger" onClick={cancelRide}><ShieldAlert size={17}/> Cancelar administrativamente</button></div>}>
      {!detail ? <LoadingState label="Carregando timeline..."/> : <RideDetail detail={detail}/>} 
    </Modal>
  </>;
}

function RideDetail({ detail }: { detail: any }) {
  const ride = detail.ride ?? detail;
  const events = detail.events ?? [];
  const cancellations = detail.cancellations ?? [];
  const incidents = detail.incidents ?? [];
  const locations = detail.locations ?? [];
  return <div className="ride-admin-detail">
    <div className="ride-summary-grid"><div><span>Status</span><Badge status={ride.status}/></div><div><span>Cliente</span><strong>{ride.client?.name ?? '—'}</strong></div><div><span>Motorista</span><strong>{ride.driver?.profiles?.name ?? ride.driver?.name ?? '—'}</strong></div><div><span>Veículo</span><strong>{ride.vehicle ? `${ride.vehicle.brand ?? ''} ${ride.vehicle.model ?? ''}` : '—'}</strong></div><div><span>Valor final</span><strong>{money(ride.final_price)}</strong></div><div><span>Taxa plataforma</span><strong>{money(ride.platform_fee)}</strong></div><div><span>Ganho motorista</span><strong>{money(ride.driver_earning)}</strong></div><div><span>Pagamento</span><Badge status={ride.payment_status ?? 'pending'}/></div></div>
    {ride.early_finish && <div className="notice warning"><ShieldAlert size={18}/><div><strong>Finalização antecipada</strong><p>{Number(ride.distance_to_destination_m ?? 0).toFixed(0)} m restantes · {ride.finish_reason_code === 'client_requested' ? 'Cliente solicitou' : 'Outros'}{ride.finish_reason_text ? ` — ${ride.finish_reason_text}` : ''}</p></div></div>}
    <div className="route-detail large"><div><span className="origin-dot"/><span>{ride.pickup_address ?? 'Origem'}</span></div><i/><div><span className="destination-dot"/><span>{ride.destination_address ?? 'Destino'}</span></div></div>
    <div className="detail-columns">
      <div><h3>Timeline</h3><div className="timeline">{events.length ? events.map((event: any) => <div className="timeline-item" key={event.id}><span/><div><strong>{event.new_status ?? event.to_status ?? event.status ?? 'Atualização'}</strong><p>{event.metadata?.reason_text ?? event.metadata?.reason ?? event.reason ?? (event.new_status === 'finish_audit' ? `${Number(event.metadata?.distance_to_destination_m ?? 0).toFixed(0)} m do destino` : 'Alteração de status da corrida')}</p><small>{dateTime(event.created_at)}</small></div></div>) : <p className="muted-copy">Sem eventos registrados.</p>}</div></div>
      <div><h3>Operação</h3><div className="detail-stack"><div className="detail-row"><span>Pontos GPS</span><strong>{locations.length}</strong></div><div className="detail-row"><span>Incidentes</span><strong>{incidents.length}</strong></div><div className="detail-row"><span>Cancelamentos</span><strong>{cancellations.length}</strong></div><div className="detail-row"><span>Duração</span><strong>{ride.duration_min ? `${ride.duration_min} min` : '—'}</strong></div><div className="detail-row"><span>Distância</span><strong>{ride.distance_km ? `${ride.distance_km} km` : '—'}</strong></div><div className="detail-row"><span>Distância final</span><strong>{ride.distance_to_destination_m != null ? `${Number(ride.distance_to_destination_m).toFixed(0)} m` : '—'}</strong></div></div>{incidents.map((item: any) => <div className="notice danger" key={item.id}><ShieldAlert size={18}/><div><strong>{item.incident_type}</strong><p>{item.description}</p></div></div>)}</div>
    </div>
  </div>;
}
