import { useEffect, useRef, useState } from 'react';
import mapboxgl, { LngLatBounds, Map as MapboxMap, Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Crosshair, ExternalLink, LocateFixed, RefreshCw, Route, ShieldAlert } from 'lucide-react';
import type { ThemeMode } from '../../types/admin';
import { adminService } from '../../services/adminService';
import { supabase } from '../../services/supabaseService';
import { Badge, dateTime, EmptyState, LoadingState, Modal, PageHeader, Section } from '../../components/Ui';

export function OperationPage({ theme }: { theme: ThemeMode }) {
  const [operation, setOperation] = useState<{ drivers: any[]; rides: any[] }>({ drivers: [], rides: [] });
  const [selectedRide, setSelectedRide] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try { setOperation(await adminService.activeOperation()); } finally { setLoading(false); }
  }

  useEffect(() => {
    load();
    const channel = adminService.subscribeOperation(load);
    return () => { supabase.removeChannel(channel); };
  }, []);

  return <>
    <PageHeader title="Operação ao vivo" description="Motoristas online, corridas em andamento e intervenção operacional em tempo real." actions={<button className="button secondary" onClick={load}><RefreshCw size={17}/> Atualizar</button>}/>
    <div className="operation-layout">
      <Section className="map-section">
        {loading ? <LoadingState label="Carregando mapa operacional..."/> : <LiveMap theme={theme} drivers={operation.drivers} rides={operation.rides} onRide={setSelectedRide}/>} 
      </Section>
      <Section title="Corridas ativas" description={`${operation.rides.length} corrida(s) em andamento`} className="operation-feed">
        <div className="live-ride-list">
          {operation.rides.length ? operation.rides.map((ride) => <button className="live-ride-card" key={ride.id} onClick={() => setSelectedRide(ride)}>
            <div className="live-ride-head"><Badge status={ride.status}/><span>{dateTime(ride.created_at)}</span></div>
            <strong>{ride.driver?.profiles?.name ?? 'Motorista'}</strong><p>{ride.client?.name ?? 'Cliente'}</p>
            <div className="mini-route"><span className="origin-dot"/><div><small>{ride.pickup_address ?? 'Origem'}</small><strong>{ride.destination_address ?? 'Destino'}</strong></div></div>
          </button>) : <EmptyState title="Operação tranquila" description="Nenhuma corrida ativa neste momento."/>}
        </div>
      </Section>
    </div>

    <Modal open={Boolean(selectedRide)} onClose={() => setSelectedRide(null)} title="Detalhes da corrida ativa" description={selectedRide?.id} size="large">
      {selectedRide && <RideOperationDetail ride={selectedRide} onClose={() => setSelectedRide(null)} onRefresh={load}/>} 
    </Modal>
  </>;
}

function LiveMap({ theme, drivers, rides, onRide }: { theme: ThemeMode; drivers: any[]; rides: any[]; onRide: (ride: any) => void }) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
  const lightStyle = import.meta.env.VITE_MAPBOX_STYLE_LIGHT || 'mapbox://styles/mapbox/streets-v12';
  const darkStyle = import.meta.env.VITE_MAPBOX_STYLE_DARK || 'mapbox://styles/mapbox/dark-v11';

  useEffect(() => {
    if (!container.current) return;
    const map = new mapboxgl.Map({ accessToken: token, container: container.current, style: theme === 'dark' ? darkStyle : lightStyle, center: [-51.1178, -16.4415], zoom: 11, attributionControl: false });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    mapRef.current = map;
    return () => { markersRef.current.forEach((marker) => marker.remove()); map.remove(); mapRef.current = null; };
  }, [theme, token, lightStyle, darkStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    const bounds = new LngLatBounds();
    drivers.forEach((driver) => {
      if (driver.current_lng == null || driver.current_lat == null) return;
      const node = document.createElement('button');
      node.className = `map-driver-marker ${driver.vehicle_type === 'moto' ? 'moto' : 'car'}`;
      node.title = driver.vehicle_type === 'moto' ? 'Moto online' : 'Carro online';
      node.innerHTML = driver.vehicle_type === 'moto' ? '◆' : '●';
      const marker = new mapboxgl.Marker({ element: node, rotation: Number(driver.current_bearing ?? 0), rotationAlignment: 'map' }).setLngLat([driver.current_lng, driver.current_lat]).addTo(map);
      markersRef.current.push(marker); bounds.extend([driver.current_lng, driver.current_lat]);
    });
    rides.forEach((ride) => {
      const lat = ride.status === 'in_progress' ? ride.destination_lat : ride.pickup_lat;
      const lng = ride.status === 'in_progress' ? ride.destination_lng : ride.pickup_lng;
      if (lat == null || lng == null) return;
      const node = document.createElement('button'); node.className = 'map-ride-marker'; node.innerHTML = '<span></span>'; node.onclick = () => onRide(ride);
      const marker = new mapboxgl.Marker({ element: node }).setLngLat([lng, lat]).addTo(map); markersRef.current.push(marker); bounds.extend([lng, lat]);
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 90, maxZoom: 14, duration: 700 });
  }, [drivers, rides, onRide]);

  return <div className="live-map-wrap"><div ref={container} className="live-map"/><div className="map-toolbar"><span><i className="green-dot"/>{drivers.length} online</span><span><i className="blue-dot"/>{rides.length} corrida(s)</span></div></div>;
}

function RideOperationDetail({ ride, onClose, onRefresh }: { ride: any; onClose: () => void; onRefresh: () => void }) {
  const [busy, setBusy] = useState(false);
  async function cancel() {
    const reason = window.prompt('Motivo da intervenção administrativa:');
    if (!reason) return;
    setBusy(true);
    try { await adminService.cancelRide(ride.id, reason); onClose(); onRefresh(); } finally { setBusy(false); }
  }
  return <div className="ride-detail-grid">
    <div className="detail-stack">
      <div className="detail-row"><span>Status</span><Badge status={ride.status}/></div>
      <div className="detail-row"><span>Cliente</span><strong>{ride.client?.name ?? '—'}</strong></div>
      <div className="detail-row"><span>Motorista</span><strong>{ride.driver?.profiles?.name ?? '—'}</strong></div>
      <div className="detail-row"><span>Início</span><strong>{dateTime(ride.started_at ?? ride.created_at)}</strong></div>
    </div>
    <div className="route-detail"><div><LocateFixed size={18}/><span>{ride.pickup_address ?? 'Origem'}</span></div><i/><div><Crosshair size={18}/><span>{ride.destination_address ?? 'Destino'}</span></div></div>
    <div className="modal-action-row"><button className="button secondary"><ExternalLink size={17}/> Abrir mapa</button><button className="button secondary"><Route size={17}/> Ver timeline</button><button className="button danger" disabled={busy} onClick={cancel}><ShieldAlert size={17}/> Intervir e cancelar</button></div>
  </div>;
}
