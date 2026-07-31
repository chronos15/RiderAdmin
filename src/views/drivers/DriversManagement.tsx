import { useEffect, useMemo, useState } from 'react';
import { Ban, Car, Check, Eye, FileCheck2, RefreshCw, ShieldX, UserCheck, XCircle } from 'lucide-react';
import type { DriverSummary } from '../../types/admin';
import { adminService } from '../../services/adminService';
import { Badge, dateTime, EmptyState, LoadingState, Modal, PageHeader, SearchField, Section } from '../../components/Ui';

export function DriversManagement() {
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<DriverSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setDrivers(await adminService.drivers(search, status)); } finally { setLoading(false); }
  }
  useEffect(() => { const timer = window.setTimeout(load, 180); return () => window.clearTimeout(timer); }, [search, status]);

  const totals = useMemo(() => ({
    all: drivers.length,
    approved: drivers.filter((item) => item.approval_status === 'approved').length,
    pending: drivers.filter((item) => item.approval_status === 'pending').length,
    rejected: drivers.filter((item) => item.approval_status === 'rejected').length,
  }), [drivers]);

  return <>
    <PageHeader title="Motoristas" description="Cadastro, aprovação, veículos, documentos e status operacional." actions={<button className="button secondary" onClick={load}><RefreshCw size={17}/> Atualizar</button>}/>
    <div className="compact-stats"><button onClick={() => setStatus('all')} className={status === 'all' ? 'active' : ''}><span>Todos</span><strong>{totals.all}</strong></button><button onClick={() => setStatus('pending')} className={status === 'pending' ? 'active' : ''}><span>Pendentes</span><strong>{totals.pending}</strong></button><button onClick={() => setStatus('approved')} className={status === 'approved' ? 'active' : ''}><span>Aprovados</span><strong>{totals.approved}</strong></button><button onClick={() => setStatus('rejected')} className={status === 'rejected' ? 'active' : ''}><span>Reprovados</span><strong>{totals.rejected}</strong></button></div>
    <Section className="table-section">
      <div className="table-toolbar"><SearchField value={search} onChange={setSearch} placeholder="Buscar por nome, telefone ou placa"/><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos os status</option><option value="pending">Pendentes</option><option value="approved">Aprovados</option><option value="rejected">Reprovados</option></select></div>
      {loading ? <LoadingState/> : drivers.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Motorista</th><th>Veículo principal</th><th>Aprovação</th><th>Operação</th><th>Avaliação</th><th></th></tr></thead><tbody>{drivers.map((driver) => {
        const vehicle: any = driver.primary_vehicle;
        return <tr key={driver.id}><td><div className="identity-cell"><div className="avatar small">{driver.name.slice(0, 1).toUpperCase()}</div><div><strong>{driver.name}</strong><span>{driver.phone || 'Sem telefone'}</span></div></div></td><td><div className="vehicle-cell"><Car size={18}/><div><strong>{vehicle ? `${vehicle.brand ?? ''} ${vehicle.model ?? ''}`.trim() : 'Não cadastrado'}</strong><span>{vehicle?.plate ?? '—'} · {vehicle?.category ?? '—'}</span></div></div></td><td><Badge status={driver.approval_status}/>{driver.pending_documents ? <small className="inline-alert">{driver.pending_documents} documento(s) pendente(s)</small> : null}</td><td><Badge status={driver.is_online ? 'online' : 'offline'}/><small>{dateTime(driver.last_location_at)}</small></td><td><strong>★ {driver.rating.toFixed(1)}</strong><span className="table-sub">{driver.total_trips} viagens</span></td><td><button className="icon-btn bordered" onClick={() => setSelected(driver)}><Eye size={18}/></button></td></tr>;
      })}</tbody></table></div> : <EmptyState title="Nenhum motorista encontrado" description="Ajuste os filtros ou aguarde novos cadastros."/>}
    </Section>
    <DriverDrawer driver={selected} onClose={() => setSelected(null)} onChanged={async () => { await load(); if (selected) setSelected((await adminService.drivers('', 'all')).find((item) => item.id === selected.id) ?? null); }}/>
  </>;
}

function DriverDrawer({ driver, onClose, onChanged }: { driver: DriverSummary | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  if (!driver) return null;
  const driverId = driver.id;
  const vehicles: any[] = (driver.vehicles ?? []) as any[];
  const documents: any[] = (driver.documents ?? []) as any[];

  async function review(status: 'approved' | 'rejected' | 'pending') {
    const reason = status === 'rejected' ? window.prompt('Informe o motivo da reprovação:') : undefined;
    if (status === 'rejected' && !reason) return;
    setBusy(`driver-${status}`);
    try { await adminService.reviewDriver(driverId, status, reason ?? undefined); await onChanged(); } finally { setBusy(''); }
  }
  async function reviewVehicle(id: string, status: 'approved' | 'rejected') {
    const reason = status === 'rejected' ? window.prompt('Motivo da reprovação do veículo:') : undefined;
    if (status === 'rejected' && !reason) return;
    setBusy(id); try { await adminService.reviewVehicle(id, status, reason ?? undefined); await onChanged(); } finally { setBusy(''); }
  }
  async function reviewDocument(id: string, status: 'approved' | 'rejected') {
    const reason = status === 'rejected' ? window.prompt('Motivo da reprovação do documento:') : undefined;
    if (status === 'rejected' && !reason) return;
    setBusy(id); try { await adminService.reviewDocument(id, status, reason ?? undefined); await onChanged(); } finally { setBusy(''); }
  }
  async function openFile(path: string) { try { setPreview(await adminService.signedDocumentUrl(path)); } catch { window.alert('Não foi possível abrir o arquivo.'); } }

  return <><Modal open title={driver.name} description={`Motorista · ${driver.phone || 'sem telefone'}`} onClose={onClose} size="large" footer={<div className="modal-action-row"><button className="button secondary" disabled={Boolean(busy)} onClick={() => review('pending')}><RefreshCw size={17}/> Reabrir análise</button><button className="button danger" disabled={Boolean(busy)} onClick={() => review('rejected')}><ShieldX size={17}/> Reprovar</button><button className="button primary" disabled={Boolean(busy)} onClick={() => review('approved')}><UserCheck size={17}/> Aprovar motorista</button></div>}>
    <div className="driver-detail-head"><div className="avatar large">{driver.name.slice(0, 1)}</div><div><h3>{driver.name}</h3><p>{driver.phone || 'Telefone não informado'}</p><div className="badge-row"><Badge status={driver.approval_status}/><Badge status={driver.profile_status}/><Badge status={driver.is_online ? 'online' : 'offline'}/></div></div><div className="driver-score"><strong>{driver.rating.toFixed(1)}</strong><span>★ avaliação</span><small>{driver.total_trips} viagens</small></div></div>
    {driver.rejection_reason && <div className="notice danger"><ShieldX size={18}/><div><strong>Último motivo de reprovação</strong><p>{driver.rejection_reason}</p></div></div>}
    <div className="detail-columns">
      <div><h3>Veículos</h3><div className="review-list">{vehicles.length ? vehicles.map((vehicle) => <article className="review-card" key={vehicle.id}><div className="review-card-main"><div className="review-icon"><Car size={21}/></div><div><strong>{vehicle.brand} {vehicle.model}</strong><span>{vehicle.plate} · {vehicle.year} · {vehicle.color}</span><small>{vehicle.vehicle_type === 'moto' ? 'Moto' : 'Carro'} · {vehicle.category}</small></div></div><div className="review-card-actions"><Badge status={vehicle.status}/><button disabled={busy === vehicle.id} onClick={() => reviewVehicle(vehicle.id, 'approved')} title="Aprovar"><Check size={17}/></button><button disabled={busy === vehicle.id} onClick={() => reviewVehicle(vehicle.id, 'rejected')} title="Reprovar"><XCircle size={17}/></button></div></article>) : <p className="muted-copy">Nenhum veículo cadastrado.</p>}</div></div>
      <div><h3>Documentos</h3><div className="review-list">{documents.length ? documents.map((document) => <article className="review-card" key={document.id}><div className="review-card-main"><div className="review-icon"><FileCheck2 size={21}/></div><div><strong>{document.document_type}</strong><span>Enviado em {dateTime(document.updated_at ?? document.created_at)}</span>{document.rejection_reason && <small className="danger-text">{document.rejection_reason}</small>}</div></div><div className="review-card-actions"><Badge status={document.status}/><button onClick={() => openFile(document.file_url)} title="Visualizar"><Eye size={17}/></button><button disabled={busy === document.id} onClick={() => reviewDocument(document.id, 'approved')} title="Aprovar"><Check size={17}/></button><button disabled={busy === document.id} onClick={() => reviewDocument(document.id, 'rejected')} title="Reprovar"><Ban size={17}/></button></div></article>) : <p className="muted-copy">Nenhum documento enviado.</p>}</div></div>
    </div>
  </Modal><Modal open={Boolean(preview)} title="Visualização do documento" onClose={() => setPreview(null)} size="large">{preview && (preview.toLowerCase().includes('.pdf') ? <iframe className="document-preview" src={preview}/> : <img className="document-preview image" src={preview} alt="Documento do motorista"/>)}</Modal></>;
}
