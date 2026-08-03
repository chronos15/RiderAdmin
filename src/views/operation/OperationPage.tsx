import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl, { GeoJSONSource, LngLatBounds, Map as MapboxMap, Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  Clock3,
  Crosshair,
  ExternalLink,
  LocateFixed,
  Navigation,
  RefreshCw,
  Route,
  ShieldAlert,
  WalletCards,
} from 'lucide-react';
import type { ThemeMode } from '../../types/admin';
import { adminService } from '../../services/adminService';
import { supabase } from '../../services/supabaseService';
import { Badge, dateTime, EmptyState, LoadingState, Modal, money, PageHeader, Section } from '../../components/Ui';

type Coordinate = [number, number];

type RouteState = {
  coordinates: Coordinate[];
  distanceM: number | null;
  durationS: number | null;
  source: 'navigation' | 'mapbox' | 'none';
  key: string;
};

const emptyRoute: RouteState = {
  coordinates: [],
  distanceM: null,
  durationS: null,
  source: 'none',
  key: 'none',
};

export function OperationPage({ theme }: { theme: ThemeMode }) {
  const [operation, setOperation] = useState<{ drivers: any[]; rides: any[] }>({ drivers: [], rides: [] });
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [modalRide, setModalRide] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedRide = useMemo(
    () => operation.rides.find((ride) => ride.id === selectedRideId) ?? null,
    [operation.rides, selectedRideId],
  );
  const selectedRoute = useOperationRoute(selectedRide);

  const load = useCallback(async () => {
    setError('');
    try {
      const next = await adminService.activeOperation();
      setOperation(next);
      setSelectedRideId((current) => (
        current && next.rides.some((ride: any) => ride.id === current)
          ? current
          : next.rides[0]?.id ?? null
      ));
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const channel = adminService.subscribeOperation(() => { void load(); });
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  return <>
    <PageHeader
      title="Operação ao vivo"
      description="Acompanhe motoristas, rotas, valores e métricas restantes das corridas em andamento."
      actions={<button className="button secondary" onClick={() => void load()}><RefreshCw size={17}/> Atualizar</button>}
    />
    {error && <div className="form-error operation-error">{error}</div>}
    <div className="operation-layout">
      <Section className="map-section">
        {loading
          ? <LoadingState label="Carregando mapa operacional..."/>
          : <LiveMap
              theme={theme}
              drivers={operation.drivers}
              rides={operation.rides}
              selectedRide={selectedRide}
              route={selectedRoute}
              onRide={(ride) => setSelectedRideId(ride.id)}
            />}
      </Section>
      <Section
        title="Corridas ativas"
        description={`${operation.rides.length} corrida(s) em andamento`}
        className="operation-feed"
      >
        {selectedRide && <SelectedRideOverview
          ride={selectedRide}
          route={selectedRoute}
          onDetails={() => setModalRide(selectedRide)}
        />}
        <div className="live-ride-list">
          {operation.rides.length
            ? operation.rides.map((ride) => <button
                className={`live-ride-card ${ride.id === selectedRideId ? 'active' : ''}`}
                key={ride.id}
                onClick={() => setSelectedRideId(ride.id)}
              >
                <div className="live-ride-head"><Badge status={ride.status}/><span>{dateTime(ride.created_at)}</span></div>
                <strong>{ride.driver?.profiles?.name ?? 'Motorista'}</strong>
                <p>{ride.client?.name ?? 'Cliente'}</p>
                <div className="mini-route"><span className="origin-dot"/><div><small>{ride.pickup_address ?? 'Origem'}</small><strong>{ride.destination_address ?? 'Destino'}</strong></div></div>
                <div className="live-ride-quick-metrics">
                  <span>{money(ride.final_price ?? ride.estimated_price)}</span>
                  <span>{formatDistance(Number(ride.navigation_route?.distance_m ?? ride.estimated_distance_km * 1000))}</span>
                  <span>{formatDuration(Number(ride.navigation_route?.duration_s ?? ride.estimated_duration_min * 60))}</span>
                </div>
              </button>)
            : <EmptyState title="Operação tranquila" description="Nenhuma corrida ativa neste momento."/>}
        </div>
      </Section>
    </div>

    <Modal open={Boolean(modalRide)} onClose={() => setModalRide(null)} title="Detalhes da corrida ativa" description={modalRide?.id} size="large">
      {modalRide && <RideOperationDetail ride={modalRide} onClose={() => setModalRide(null)} onRefresh={load}/>} 
    </Modal>
  </>;
}

function SelectedRideOverview({ ride, route, onDetails }: { ride: any; route: RouteState; onDetails: () => void }) {
  const routeUpdatedAt = ride.navigation_route?.updated_at ?? ride.live_driver?.last_location_at;
  return <div className="selected-ride-overview">
    <div className="selected-ride-title">
      <div><span>Corrida acompanhada</span><strong>{ride.driver?.profiles?.name ?? 'Motorista'}</strong><small>{ride.client?.name ?? 'Cliente'}</small></div>
      <Badge status={ride.status}/>
    </div>
    <div className="selected-ride-metrics">
      <Metric icon={<WalletCards size={16}/>} label="Valor" value={money(ride.final_price ?? ride.estimated_price)}/>
      <Metric icon={<Clock3 size={16}/>} label="Tempo restante" value={formatDuration(route.durationS ?? Number(ride.estimated_duration_min ?? 0) * 60)}/>
      <Metric icon={<Route size={16}/>} label="Distância restante" value={formatDistance(route.distanceM ?? Number(ride.estimated_distance_km ?? 0) * 1000)}/>
    </div>
    <div className="selected-ride-status-row">
      <span><i className={route.source === 'navigation' ? 'green-dot' : 'blue-dot'}/>{route.source === 'navigation' ? 'Rota enviada pelo Driver' : route.source === 'mapbox' ? 'Rota calculada pelo Mapbox' : 'Aguardando rota'}</span>
      <small>{routeUpdatedAt ? `Atualizado ${dateTime(routeUpdatedAt)}` : 'Sem telemetria recente'}</small>
    </div>
    <button className="button secondary full" onClick={onDetails}><ExternalLink size={16}/> Abrir detalhes e intervenção</button>
  </div>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="operation-metric"><span>{icon}{label}</span><strong>{value}</strong></div>;
}

function LiveMap({
  theme,
  drivers,
  rides,
  selectedRide,
  route,
  onRide,
}: {
  theme: ThemeMode;
  drivers: any[];
  rides: any[];
  selectedRide: any | null;
  route: RouteState;
  onRide: (ride: any) => void;
}) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const driverMarkersRef = useRef<Map<string, Marker>>(new Map());
  const rideMarkersRef = useRef<Map<string, Marker>>(new Map());
  const endpointMarkersRef = useRef<Marker[]>([]);
  const lastFocusSignatureRef = useRef('');
  const [mapReady, setMapReady] = useState(false);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
  const lightStyle = import.meta.env.VITE_MAPBOX_STYLE_LIGHT || 'mapbox://styles/mapbox/streets-v12';
  const darkStyle = import.meta.env.VITE_MAPBOX_STYLE_DARK || 'mapbox://styles/mapbox/dark-v11';

  const fitSelectedRide = useCallback((animated = true) => {
    const map = mapRef.current;
    if (!map || !selectedRide) return;
    const bounds = new LngLatBounds();
    route.coordinates.filter(isValidCoordinate).forEach((coordinate) => bounds.extend(coordinate));
    const driverPoint = liveDriverCoordinate(selectedRide);
    if (driverPoint) bounds.extend(driverPoint);
    const pickup = coordinateOf(selectedRide.pickup_lng, selectedRide.pickup_lat);
    const destination = coordinateOf(selectedRide.destination_lng, selectedRide.destination_lat);
    if (pickup) bounds.extend(pickup);
    if (destination) bounds.extend(destination);
    if (bounds.isEmpty()) return;
    map.fitBounds(bounds, {
      padding: { top: 90, right: 90, bottom: 110, left: 90 },
      maxZoom: 15.5,
      duration: animated ? 750 : 0,
    });
  }, [route.coordinates, selectedRide]);

  useEffect(() => {
    if (!container.current || !token) return;
    setMapReady(false);
    const map = new mapboxgl.Map({
      accessToken: token,
      container: container.current,
      style: theme === 'dark' ? darkStyle : lightStyle,
      center: [-40.3078, -20.3155],
      zoom: 11,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('load', () => setMapReady(true));
    mapRef.current = map;
    return () => {
      driverMarkersRef.current.forEach((marker) => marker.remove());
      rideMarkersRef.current.forEach((marker) => marker.remove());
      endpointMarkersRef.current.forEach((marker) => marker.remove());
      driverMarkersRef.current.clear();
      rideMarkersRef.current.clear();
      endpointMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [theme, token, lightStyle, darkStyle]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const activeDriverIds = new Set<string>();
    drivers.forEach((driver) => {
      const coordinate = coordinateOf(driver.lng, driver.lat);
      if (!coordinate) return;
      const id = String(driver.driver_id);
      activeDriverIds.add(id);
      let marker = driverMarkersRef.current.get(id);
      if (!marker) {
        const node = document.createElement('button');
        node.className = `map-driver-marker ${driver.vehicle_type === 'moto' ? 'moto' : 'car'}`;
        node.title = driver.vehicle_type === 'moto' ? 'Moto online' : 'Carro online';
        node.innerHTML = '<span>▲</span>';
        node.onclick = () => {
          const ride = rides.find((item) => item.driver_id === driver.driver_id);
          if (ride) onRide(ride);
        };
        marker = new mapboxgl.Marker({ element: node, rotationAlignment: 'map', pitchAlignment: 'map' })
          .setLngLat(coordinate)
          .setRotation(normalizeBearing(driver.bearing))
          .addTo(map);
        driverMarkersRef.current.set(id, marker);
      } else {
        marker.setLngLat(coordinate).setRotation(normalizeBearing(driver.bearing));
      }
      marker.getElement().classList.toggle('active', selectedRide?.driver_id === driver.driver_id);
    });
    driverMarkersRef.current.forEach((marker, id) => {
      if (!activeDriverIds.has(id)) { marker.remove(); driverMarkersRef.current.delete(id); }
    });

    const activeRideIds = new Set<string>();
    rides.forEach((ride) => {
      const target = activeTargetCoordinate(ride);
      if (!target) return;
      activeRideIds.add(ride.id);
      let marker = rideMarkersRef.current.get(ride.id);
      if (!marker) {
        const node = document.createElement('button');
        node.className = 'map-ride-marker';
        node.innerHTML = '<span></span>';
        node.onclick = () => onRide(ride);
        marker = new mapboxgl.Marker({ element: node }).setLngLat(target).addTo(map);
        rideMarkersRef.current.set(ride.id, marker);
      } else {
        marker.setLngLat(target);
        marker.getElement().onclick = () => onRide(ride);
      }
      marker.getElement().classList.toggle('active', selectedRide?.id === ride.id);
    });
    rideMarkersRef.current.forEach((marker, id) => {
      if (!activeRideIds.has(id)) { marker.remove(); rideMarkersRef.current.delete(id); }
    });
  }, [drivers, rides, selectedRide?.id, selectedRide?.driver_id, onRide, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    ensureRouteLayers(map, theme);
    const source = map.getSource('admin-active-route') as GeoJSONSource | undefined;
    source?.setData({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: route.coordinates.filter(isValidCoordinate) },
    });

    endpointMarkersRef.current.forEach((marker) => marker.remove());
    endpointMarkersRef.current = [];
    if (selectedRide) {
      const pickup = coordinateOf(selectedRide.pickup_lng, selectedRide.pickup_lat);
      const destination = coordinateOf(selectedRide.destination_lng, selectedRide.destination_lat);
      if (pickup) endpointMarkersRef.current.push(createEndpointMarker('pickup').setLngLat(pickup).addTo(map));
      if (destination) endpointMarkersRef.current.push(createEndpointMarker('destination').setLngLat(destination).addTo(map));
    }

    const focusSignature = selectedRide
      ? `${selectedRide.id}:${selectedRide.status}:${selectedRide.navigation_route?.route_id ?? selectedRide.navigation_route?.heading_to_pickup ?? 'fallback'}`
      : '';
    if (focusSignature && focusSignature !== lastFocusSignatureRef.current) {
      lastFocusSignatureRef.current = focusSignature;
      window.requestAnimationFrame(() => fitSelectedRide(true));
    }
  }, [fitSelectedRide, mapReady, route.coordinates, selectedRide, theme]);

  if (!token) return <EmptyState title="Mapbox não configurado" description="Defina VITE_MAPBOX_ACCESS_TOKEN para visualizar a operação ao vivo."/>;

  return <div className="live-map-wrap">
    <div ref={container} className="live-map"/>
    <div className="map-toolbar">
      <span><i className="green-dot"/>{drivers.length} online</span>
      <span><i className="blue-dot"/>{rides.length} corrida(s)</span>
    </div>
    {selectedRide && <button className="map-focus-ride" onClick={() => fitSelectedRide(true)}><LocateFixed size={17}/> Enquadrar corrida</button>}
    {selectedRide && <div className="map-live-caption">
      <Navigation size={16}/>
      <div><strong>{selectedRide.driver?.profiles?.name ?? 'Motorista'}</strong><span>{formatDistance(route.distanceM)} · {formatDuration(route.durationS)}</span></div>
    </div>}
  </div>;
}

function RideOperationDetail({ ride, onClose, onRefresh }: { ride: any; onClose: () => void; onRefresh: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  async function cancel() {
    const reason = window.prompt('Motivo da intervenção administrativa:');
    if (!reason) return;
    setBusy(true);
    try { await adminService.cancelRide(ride.id, reason); onClose(); await onRefresh(); } finally { setBusy(false); }
  }
  return <div className="ride-detail-grid">
    <div className="detail-stack">
      <div className="detail-row"><span>Status</span><Badge status={ride.status}/></div>
      <div className="detail-row"><span>Cliente</span><strong>{ride.client?.name ?? '—'}</strong></div>
      <div className="detail-row"><span>Motorista</span><strong>{ride.driver?.profiles?.name ?? '—'}</strong></div>
      <div className="detail-row"><span>Veículo</span><strong>{ride.vehicle ? `${ride.vehicle.brand ?? ''} ${ride.vehicle.model ?? ''} · ${ride.vehicle.plate ?? ''}`.trim() : '—'}</strong></div>
      <div className="detail-row"><span>Valor</span><strong>{money(ride.final_price ?? ride.estimated_price)}</strong></div>
      <div className="detail-row"><span>Início</span><strong>{dateTime(ride.started_at ?? ride.created_at)}</strong></div>
    </div>
    <div className="route-detail"><div><LocateFixed size={18}/><span>{ride.pickup_address ?? 'Origem'}</span></div><i/><div><Crosshair size={18}/><span>{ride.destination_address ?? 'Destino'}</span></div></div>
    <div className="modal-action-row"><button className="button secondary"><ExternalLink size={17}/> Abrir mapa</button><button className="button secondary"><Route size={17}/> Ver timeline</button><button className="button danger" disabled={busy} onClick={() => void cancel()}><ShieldAlert size={17}/> Intervir e cancelar</button></div>
  </div>;
}

function useOperationRoute(ride: any | null): RouteState {
  const [route, setRoute] = useState<RouteState>(emptyRoute);
  const token = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

  const input = useMemo(() => {
    if (!ride) return { type: 'none' as const, key: 'none' };
    const navigation = ride.navigation_route;
    const headingToPickup = isHeadingToPickup(ride.status);
    if (navigation && Boolean(navigation.heading_to_pickup) === headingToPickup) {
      const coordinates = decodePolyline(
        String(navigation.encoded_polyline ?? ''),
        navigation.geometry_format === 'polyline5' ? 5 : 6,
      );
      if (coordinates.length >= 2) {
        return {
          type: 'navigation' as const,
          key: `navigation:${ride.id}:${navigation.route_id ?? ''}:${navigation.updated_at ?? ''}`,
          coordinates,
          distanceM: finitePositive(navigation.distance_m),
          durationS: finitePositive(navigation.duration_s),
        };
      }
    }

    const start = liveDriverCoordinate(ride);
    const target = activeTargetCoordinate(ride);
    if (!start || !target) return { type: 'none' as const, key: `none:${ride.id}` };
    return {
      type: 'mapbox' as const,
      key: `mapbox:${ride.id}:${start[0].toFixed(4)},${start[1].toFixed(4)}:${target[0].toFixed(5)},${target[1].toFixed(5)}`,
      start,
      target,
    };
  }, [ride]);

  useEffect(() => {
    if (input.type === 'none') { setRoute(emptyRoute); return; }
    if (input.type === 'navigation') {
      setRoute({
        coordinates: input.coordinates,
        distanceM: input.distanceM,
        durationS: input.durationS,
        source: 'navigation',
        key: input.key,
      });
      return;
    }
    if (!token) { setRoute(emptyRoute); return; }

    const controller = new AbortController();
    const coordinates = `${input.start[0]},${input.start[1]};${input.target[0]},${input.target[1]}`;
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}`);
    url.searchParams.set('access_token', token);
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('steps', 'false');
    url.searchParams.set('language', 'pt-BR');

    void fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Mapbox Directions HTTP ${response.status}`);
        return response.json() as Promise<{ routes?: Array<{ geometry?: { coordinates?: Coordinate[] }; distance?: number; duration?: number }> }>;
      })
      .then((response) => {
        const selected = response.routes?.[0];
        const geometry = (selected?.geometry?.coordinates ?? []).filter(isValidCoordinate);
        if (geometry.length >= 2) {
          setRoute({
            coordinates: geometry,
            distanceM: finitePositive(selected?.distance),
            durationS: finitePositive(selected?.duration),
            source: 'mapbox',
            key: input.key,
          });
        }
      })
      .catch((exception) => {
        if ((exception as Error).name !== 'AbortError') {
          setRoute((current) => current.coordinates.length ? current : emptyRoute);
        }
      });
    return () => controller.abort();
  }, [input.key, token]);

  return route;
}

function ensureRouteLayers(map: MapboxMap, theme: ThemeMode) {
  if (!map.getSource('admin-active-route')) {
    map.addSource('admin-active-route', {
      type: 'geojson',
      lineMetrics: true,
      data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } },
    });
  }
  if (!map.getLayer('admin-active-route-casing')) {
    map.addLayer({
      id: 'admin-active-route-casing',
      type: 'line',
      source: 'admin-active-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': theme === 'dark' ? '#111111' : '#ffffff', 'line-width': 11, 'line-opacity': 0.9 },
    });
  }
  if (!map.getLayer('admin-active-route-line')) {
    map.addLayer({
      id: 'admin-active-route-line',
      type: 'line',
      source: 'admin-active-route',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-width': 7,
        'line-gradient': theme === 'dark'
          ? ['interpolate', ['linear'], ['line-progress'], 0, '#ff7a18', 1, '#ffb347']
          : ['interpolate', ['linear'], ['line-progress'], 0, '#6d4aff', 1, '#ff3b8d'],
      },
    });
  }
}

function createEndpointMarker(type: 'pickup' | 'destination'): Marker {
  const node = document.createElement('div');
  node.className = `operation-endpoint-marker ${type}`;
  node.innerHTML = type === 'pickup' ? '<span></span>' : '<span>◆</span>';
  return new mapboxgl.Marker({ element: node, anchor: 'center' });
}

function liveDriverCoordinate(ride: any): Coordinate | null {
  return coordinateOf(ride?.live_driver?.lng, ride?.live_driver?.lat);
}

function activeTargetCoordinate(ride: any): Coordinate | null {
  return isHeadingToPickup(ride?.status)
    ? coordinateOf(ride?.pickup_lng, ride?.pickup_lat)
    : coordinateOf(ride?.destination_lng, ride?.destination_lat);
}

function isHeadingToPickup(status: string | null | undefined): boolean {
  return ['accepted', 'driver_arriving', 'driver_arrived'].includes(String(status ?? ''));
}

function coordinateOf(lngValue: unknown, latValue: unknown): Coordinate | null {
  const lng = Number(lngValue);
  const lat = Number(latValue);
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
  return [lng, lat];
}

function decodePolyline(encoded: string, precisionDigits: 5 | 6): Coordinate[] {
  if (!encoded) return [];
  const precision = 10 ** precisionDigits;
  const coordinates: Coordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  function decodeDelta(): number | null {
    let result = 0;
    let shift = 0;
    while (index < encoded.length) {
      const byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0) return null;
      result |= (byte & 0x1f) << shift;
      if (byte < 0x20) return (result & 1) ? ~(result >> 1) : result >> 1;
      shift += 5;
      if (shift > 30) return null;
    }
    return null;
  }

  while (index < encoded.length) {
    const latitudeDelta = decodeDelta();
    const longitudeDelta = decodeDelta();
    if (latitudeDelta == null || longitudeDelta == null) break;
    latitude += latitudeDelta;
    longitude += longitudeDelta;
    const coordinate = coordinateOf(longitude / precision, latitude / precision);
    if (coordinate) coordinates.push(coordinate);
  }
  return coordinates;
}

function isValidCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && coordinateOf(value[0], value[1]) != null;
}

function finitePositive(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeBearing(value: unknown): number {
  const bearing = Number(value);
  return Number.isFinite(bearing) ? ((bearing % 360) + 360) % 360 : 0;
}

function formatDistance(value: number | null | undefined): string {
  const distance = Number(value);
  if (!Number.isFinite(distance) || distance < 0) return 'Calculando';
  if (distance < 1000) return `${Math.round(distance)} m`;
  return `${(distance / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function formatDuration(value: number | null | undefined): string {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds < 0) return 'Calculando';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return remaining ? `${hours}h ${remaining}min` : `${hours}h`;
}
