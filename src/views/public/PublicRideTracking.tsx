import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl, { GeoJSONSource, LngLatBounds, Map as MapboxMap, Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  CarFront,
  Clock3,
  MapPin,
  Moon,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Star,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { ThemeMode } from '../../types/admin';
import { env } from '../../core/config/env';
import {
  publicRideService,
  type SharedRidePayload,
  type SharedRidePoint,
} from '../../services/publicRideService';

type Coordinate = [number, number];

type RouteState = {
  coordinates: Coordinate[];
  key: string;
  source: 'navigation' | 'mapbox' | 'none';
};

const emptyRoute: RouteState = { coordinates: [], key: 'empty', source: 'none' };

export function PublicRideTracking({
  token,
  theme,
  onToggleTheme,
}: {
  token: string;
  theme: ThemeMode;
  onToggleTheme: () => void;
}) {
  const [data, setData] = useState<SharedRidePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Acompanhe a viagem | RiderX';
    let robots = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const createdRobots = !robots;
    const previousRobots = robots?.content ?? '';
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex,nofollow,noarchive';
    return () => {
      document.title = previousTitle;
      if (createdRobots) robots?.remove();
      else if (robots) robots.content = previousRobots;
    };
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const response = await publicRideService.getSharedRide(token);
      setData(response);
      setError(null);
      setOnline(true);
      setLastUpdatedAt(new Date());
    } catch (loadError) {
      const message = loadError instanceof Error
        ? loadError.message
        : 'Não foi possível carregar a viagem compartilhada.';
      if (!silent || !data) setError(message);
      setOnline(false);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, [token, data]);

  useEffect(() => {
    let disposed = false;
    let running = false;

    async function refresh(initial = false) {
      if (disposed || running) return;
      running = true;
      try {
        const response = await publicRideService.getSharedRide(token);
        if (disposed) return;
        setData(response);
        setError(null);
        setOnline(true);
        setLastUpdatedAt(new Date());
      } catch (loadError) {
        if (disposed) return;
        const message = loadError instanceof Error
          ? loadError.message
          : 'Não foi possível carregar a viagem compartilhada.';
        if (initial) setError(message);
        setOnline(false);
      } finally {
        running = false;
        if (!disposed) setLoading(false);
      }
    }

    void refresh(true);
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh(false);
    }, 3000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh(false);
    };
    const onOnline = () => {
      setOnline(true);
      void refresh(false);
    };
    const onOffline = () => setOnline(false);

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [token]);

  const route = useSharedRideRoute(data);
  const status = statusPresentation(data?.ride.status ?? 'accepted');
  const target = activeTarget(data);

  if (loading && !data) {
    return (
      <main className="public-track-page public-track-loading">
        <div className="public-track-loading-card">
          <div className="public-track-brand-mark">R</div>
          <div className="spinner" />
          <strong>Carregando viagem compartilhada</strong>
          <span>Conectando ao acompanhamento seguro...</span>
        </div>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="public-track-page public-track-error-page">
        <section className="public-track-error-card">
          <div className="public-track-brand-mark">R</div>
          <ShieldCheck size={34} />
          <h1>Link indisponível</h1>
          <p>{error}</p>
          <button className="button primary" onClick={() => void load(false)}>
            <RefreshCw size={17} /> Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  if (!data) return null;

  return (
    <main className="public-track-page">
      <PublicRideMap
        theme={theme}
        data={data}
        route={route}
        target={target}
      />

      <header className="public-track-topbar">
        <div className="public-track-brand">
          <div className="public-track-brand-mark">R</div>
          <div>
            <strong>RiderX</strong>
            <span>Viagem compartilhada</span>
          </div>
        </div>
        <div className="public-track-actions">
          <span className={`public-track-connection ${online ? 'online' : 'offline'}`}>
            {online ? <Wifi size={15} /> : <WifiOff size={15} />}
            {online ? 'Ao vivo' : 'Reconectando'}
          </span>
          <button
            type="button"
            className="public-track-icon-button"
            aria-label="Alternar tema"
            onClick={onToggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      <section className="public-track-card" aria-live="polite">
        <div className="public-track-handle" />
        <div className="public-track-status-row">
          <div className={`public-track-status-icon ${status.tone}`}>
            {status.icon}
          </div>
          <div className="public-track-status-copy">
            <span>{status.eyebrow}</span>
            <h1>{status.title}</h1>
            <p>{status.description}</p>
          </div>
          {refreshing ? <div className="spinner public-track-mini-spinner" /> : null}
        </div>

        <div className="public-track-driver">
          <div className="public-track-driver-avatar">
            <CarFront size={22} />
          </div>
          <div className="public-track-driver-copy">
            <strong>{data.driver.name}</strong>
            <span>{vehicleLabel(data)}</span>
          </div>
          <div className="public-track-driver-meta">
            {data.driver.rating != null ? (
              <span><Star size={14} fill="currentColor" /> {data.driver.rating.toFixed(1)}</span>
            ) : null}
            {data.vehicle.plate ? <strong>{data.vehicle.plate}</strong> : null}
          </div>
        </div>

        <div className="public-track-route-summary">
          <div className="public-track-route-line" aria-hidden="true">
            <i className="pickup" />
            <span />
            <i className="destination" />
          </div>
          <div className="public-track-addresses">
            <div>
              <small>Embarque</small>
              <strong>{data.ride.pickup_address ?? 'Local de embarque'}</strong>
            </div>
            <div>
              <small>Destino</small>
              <strong>{data.ride.destination_address ?? 'Destino da viagem'}</strong>
            </div>
          </div>
        </div>

        <div className="public-track-metrics">
          <div>
            <Clock3 size={17} />
            <span>Tempo estimado</span>
            <strong>{formatDuration(data.navigation_route?.duration_s)}</strong>
          </div>
          <div>
            <Navigation size={17} />
            <span>Distância restante</span>
            <strong>{formatDistance(data.navigation_route?.distance_m)}</strong>
          </div>
          <div>
            <MapPin size={17} />
            <span>Próximo ponto</span>
            <strong>{target.label}</strong>
          </div>
        </div>

        <footer className="public-track-footer">
          <ShieldCheck size={17} />
          <span>
            A posição é atualizada durante a viagem. Dados pessoais sensíveis não são exibidos.
          </span>
          <time>{lastUpdatedAt ? relativeUpdate(lastUpdatedAt) : 'Atualizando...'}</time>
        </footer>
      </section>
    </main>
  );
}

function PublicRideMap({
  theme,
  data,
  route,
  target,
}: {
  theme: ThemeMode;
  data: SharedRidePayload;
  route: RouteState;
  target: { point: SharedRidePoint | null; label: string };
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const readyRef = useRef(false);
  const dataRef = useRef(data);
  const routeRef = useRef(route);
  const targetRef = useRef(target);
  const themeRef = useRef(theme);
  const driverMarkerRef = useRef<Marker | null>(null);
  const pickupMarkerRef = useRef<Marker | null>(null);
  const destinationMarkerRef = useRef<Marker | null>(null);
  const lastFitKeyRef = useRef('');

  dataRef.current = data;
  routeRef.current = route;
  targetRef.current = target;
  themeRef.current = theme;

  const renderMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const currentData = dataRef.current;
    const currentRoute = routeRef.current;
    const isDark = themeRef.current === 'dark';

    const routeData = currentRoute.coordinates.length >= 2
      ? {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: currentRoute.coordinates,
          },
        }
      : { type: 'FeatureCollection', features: [] };
    const routeSource = map.getSource('public-shared-route') as GeoJSONSource | undefined;
    if (routeSource) {
      routeSource.setData(routeData as never);
    } else {
      map.addSource('public-shared-route', {
        type: 'geojson',
        lineMetrics: true,
        data: routeData as never,
      });
      map.addLayer({
        id: 'public-shared-route-casing',
        type: 'line',
        source: 'public-shared-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': isDark ? '#332315' : '#ffffff',
          'line-width': 6.8,
          'line-opacity': isDark ? 0.84 : 0.94,
        },
      });
      map.addLayer({
        id: 'public-shared-route-line',
        type: 'line',
        source: 'public-shared-route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-width': 4.4,
          'line-opacity': 1,
          'line-gradient': [
            'interpolate',
            ['linear'],
            ['line-progress'],
            0,
            isDark ? '#F27016' : '#603AF3',
            1,
            isDark ? '#FFB020' : '#A32CE6',
          ],
        },
      });
    }

    const location = currentData.location;
    if (location) {
      if (!driverMarkerRef.current) {
        const element = document.createElement('div');
        element.className = 'public-track-driver-marker';
        element.innerHTML = '<span></span>';
        driverMarkerRef.current = new mapboxgl.Marker({
          element,
          rotationAlignment: 'map',
          pitchAlignment: 'map',
        }).addTo(map);
      }
      driverMarkerRef.current
        .setLngLat([location.lng, location.lat])
        .setRotation(location.bearing ?? 0);
    }

    const pickup = pointOf(currentData.ride.pickup_lat, currentData.ride.pickup_lng);
    if (pickup) {
      if (!pickupMarkerRef.current) {
        const element = document.createElement('div');
        element.className = 'public-track-pickup-marker';
        pickupMarkerRef.current = new mapboxgl.Marker({ element }).addTo(map);
      }
      pickupMarkerRef.current.setLngLat([pickup.lng, pickup.lat]);
    }

    const destination = pointOf(
      currentData.ride.destination_lat,
      currentData.ride.destination_lng,
    );
    if (destination) {
      if (!destinationMarkerRef.current) {
        const element = document.createElement('div');
        element.className = 'public-track-destination-marker';
        element.innerHTML = '<span></span>';
        destinationMarkerRef.current = new mapboxgl.Marker({ element, anchor: 'bottom' }).addTo(map);
      }
      destinationMarkerRef.current.setLngLat([destination.lng, destination.lat]);
    }

    const fitKey = `${currentData.ride.id}|${currentData.ride.status}|${currentRoute.key}`;
    if (fitKey !== lastFitKeyRef.current) {
      lastFitKeyRef.current = fitKey;
      const bounds = new LngLatBounds();
      currentRoute.coordinates.forEach((coordinate) => bounds.extend(coordinate));
      if (location) bounds.extend([location.lng, location.lat]);
      if (targetRef.current.point) {
        bounds.extend([targetRef.current.point.lng, targetRef.current.point.lat]);
      }
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 105, right: 55, bottom: 330, left: 55 },
          maxZoom: 16.2,
          duration: 850,
        });
      }
    } else if (location) {
      const bounds = map.getBounds();
      if (bounds && !bounds.contains([location.lng, location.lat])) {
        map.easeTo({ center: [location.lng, location.lat], duration: 650 });
      }
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current || !env.mapboxAccessToken) return;
    readyRef.current = false;
    lastFitKeyRef.current = '';
    const initial = data.location
      ? [data.location.lng, data.location.lat] as Coordinate
      : target.point
        ? [target.point.lng, target.point.lat] as Coordinate
        : [-40.3128, -20.3155] as Coordinate;
    const map = new mapboxgl.Map({
      accessToken: env.mapboxAccessToken,
      container: containerRef.current,
      style: theme === 'dark' ? env.mapboxStyleDark : env.mapboxStyleLight,
      center: initial,
      zoom: 14,
      attributionControl: false,
      logoPosition: 'bottom-left',
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
    map.on('load', () => {
      readyRef.current = true;
      renderMap();
    });
    mapRef.current = map;

    return () => {
      readyRef.current = false;
      driverMarkerRef.current?.remove();
      pickupMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      pickupMarkerRef.current = null;
      destinationMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [theme, renderMap]);

  useEffect(() => {
    renderMap();
  }, [data, route, target, renderMap]);

  if (!env.mapboxAccessToken) {
    return (
      <div className="public-track-map public-track-map-missing">
        <MapPin size={34} />
        <strong>Mapa temporariamente indisponível</strong>
      </div>
    );
  }

  return <div ref={containerRef} className="public-track-map" />;
}

function useSharedRideRoute(data: SharedRidePayload | null): RouteState {
  const [route, setRoute] = useState<RouteState>(emptyRoute);

  const routeInput = useMemo(() => {
    if (!data) return null;
    const navigation = data.navigation_route;
    const headingToPickup = isHeadingToPickup(data.ride.status);
    const navigationMatchesPhase = navigation
      ? navigation.heading_to_pickup === headingToPickup
      : false;
    if (navigation && navigationMatchesPhase) {
      const coordinates = decodePolyline(
        navigation.encoded_polyline,
        navigation.geometry_format === 'polyline5' ? 5 : 6,
      );
      if (coordinates.length >= 2) {
        return {
          type: 'navigation' as const,
          coordinates,
          key: `navigation:${navigation.route_id ?? ''}:${stringSignature(navigation.encoded_polyline)}`,
        };
      }
    }

    const start = data.location;
    const target = activeTarget(data).point;
    if (!start || !target) return { type: 'none' as const };
    return {
      type: 'mapbox' as const,
      start: { lat: start.lat, lng: start.lng },
      target,
      key: `mapbox:${start.lat.toFixed(4)},${start.lng.toFixed(4)}:${target.lat.toFixed(5)},${target.lng.toFixed(5)}`,
    };
  }, [data]);

  const routeInputKey = routeInput && routeInput.type !== 'none'
    ? routeInput.key
    : 'none';

  useEffect(() => {
    if (!routeInput || routeInput.type === 'none') {
      setRoute(emptyRoute);
      return;
    }
    if (routeInput.type === 'navigation') {
      setRoute({ coordinates: routeInput.coordinates, key: routeInput.key, source: 'navigation' });
      return;
    }
    if (!env.mapboxAccessToken) {
      setRoute(emptyRoute);
      return;
    }

    setRoute(emptyRoute);
    const controller = new AbortController();
    const coordinates = `${routeInput.start.lng},${routeInput.start.lat};${routeInput.target.lng},${routeInput.target.lat}`;
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}`);
    url.searchParams.set('access_token', env.mapboxAccessToken);
    url.searchParams.set('geometries', 'geojson');
    url.searchParams.set('overview', 'full');
    url.searchParams.set('steps', 'false');
    url.searchParams.set('language', 'pt-BR');

    void fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Mapbox Directions HTTP ${response.status}`);
        return response.json() as Promise<{
          routes?: Array<{ geometry?: { coordinates?: Coordinate[] } }>;
        }>;
      })
      .then((response) => {
        const coordinatesResult = response.routes?.[0]?.geometry?.coordinates ?? [];
        if (coordinatesResult.length >= 2) {
          setRoute({ coordinates: coordinatesResult, key: routeInput.key, source: 'mapbox' });
        } else {
          setRoute(emptyRoute);
        }
      })
      .catch((routeError) => {
        if ((routeError as Error).name !== 'AbortError') setRoute(emptyRoute);
      });

    return () => controller.abort();
  }, [routeInputKey]);

  return route;
}

function stringSignature(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `${value.length}:${(hash >>> 0).toString(16)}`;
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
    const lat = latitude / precision;
    const lng = longitude / precision;
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) coordinates.push([lng, lat]);
  }
  return coordinates;
}

function pointOf(lat: number | null, lng: number | null): SharedRidePoint | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function activeTarget(data: SharedRidePayload | null): { point: SharedRidePoint | null; label: string } {
  if (!data) return { point: null, label: '—' };
  if (isHeadingToPickup(data.ride.status)) {
    return {
      point: pointOf(data.ride.pickup_lat, data.ride.pickup_lng),
      label: data.ride.status === 'driver_arrived' ? 'Embarque' : 'Passageiro',
    };
  }
  return {
    point: pointOf(data.ride.destination_lat, data.ride.destination_lng),
    label: 'Destino',
  };
}

function isHeadingToPickup(status: string): boolean {
  return ['accepted', 'driver_arriving', 'driver_arrived'].includes(status);
}

function statusPresentation(status: string) {
  switch (status) {
    case 'accepted':
    case 'driver_arriving':
      return {
        eyebrow: 'Motorista em deslocamento',
        title: 'A caminho do passageiro',
        description: 'O motorista está seguindo a rota até o local de embarque.',
        tone: 'moving',
        icon: <Navigation size={21} />,
      };
    case 'driver_arrived':
      return {
        eyebrow: 'Motorista no embarque',
        title: 'Chegou ao local',
        description: 'O motorista aguarda o passageiro para iniciar a viagem.',
        tone: 'arrived',
        icon: <MapPin size={21} />,
      };
    case 'in_progress':
      return {
        eyebrow: 'Viagem em andamento',
        title: 'Seguindo para o destino',
        description: 'O passageiro embarcou e o motorista segue pela rota principal.',
        tone: 'moving',
        icon: <CarFront size={21} />,
      };
    case 'completed':
      return {
        eyebrow: 'Acompanhamento encerrado',
        title: 'Viagem finalizada',
        description: 'O motorista concluiu a viagem no destino informado.',
        tone: 'completed',
        icon: <ShieldCheck size={21} />,
      };
    case 'cancelled':
      return {
        eyebrow: 'Acompanhamento encerrado',
        title: 'Viagem cancelada',
        description: 'Esta viagem foi cancelada e não recebe novas atualizações.',
        tone: 'cancelled',
        icon: <ShieldCheck size={21} />,
      };
    default:
      return {
        eyebrow: 'Acompanhamento seguro',
        title: 'Viagem compartilhada',
        description: 'A posição do motorista está sendo atualizada.',
        tone: 'moving',
        icon: <Navigation size={21} />,
      };
  }
}

function vehicleLabel(data: SharedRidePayload): string {
  const description = [data.vehicle.color, data.vehicle.brand, data.vehicle.model]
    .filter(Boolean)
    .join(' ');
  return description || (data.vehicle.vehicle_type === 'moto' ? 'Moto' : 'Veículo');
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return 'Calculando';
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min`;
}

function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return 'Calculando';
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

function relativeUpdate(value: Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - value.getTime()) / 1000));
  if (seconds < 5) return 'Atualizado agora';
  if (seconds < 60) return `Atualizado há ${seconds}s`;
  return `Atualizado há ${Math.floor(seconds / 60)} min`;
}
