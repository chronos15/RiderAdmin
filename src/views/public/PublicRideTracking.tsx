import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl, { GeoJSONSource, LngLatBounds, Map as MapboxMap, Marker } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  CarFront,
  ChevronDown,
  ChevronUp,
  Clock3,
  LocateFixed,
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
  type SharedRideStatus,
} from '../../services/publicRideService';

type Coordinate = [number, number];

type RouteState = {
  coordinates: Coordinate[];
  key: string;
  source: 'navigation' | 'mapbox' | 'none';
  distanceM: number | null;
  durationS: number | null;
};

type RouteMetrics = {
  distanceM: number | null;
  durationS: number | null;
};

type RouteProjection = {
  coordinate: Coordinate;
  segmentIndex: number;
  segmentFraction: number;
  distanceToRouteM: number;
  distanceAlongRouteM: number;
};

type DriverMotionPlan = {
  path: Coordinate[];
  cumulativeM: number[];
  totalM: number;
  startBearing: number;
  endBearing: number;
  startedAtMs: number;
  durationMs: number;
};

const emptyRoute: RouteState = {
  coordinates: [],
  key: 'empty',
  source: 'none',
  distanceM: null,
  durationS: null,
};

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
  const [detailsExpanded, setDetailsExpanded] = useState(true);

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
  const metrics = useMemo(
    () => estimateRemainingRouteMetrics(route, data?.location ?? null, data?.ride.status),
    [route, data?.location, data?.ride.status],
  );
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
    <main className={`public-track-page ${detailsExpanded ? '' : 'public-track-sheet-collapsed'}`}>
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

      <section
        className={`public-track-card ${detailsExpanded ? '' : 'collapsed'}`}
        aria-live="polite"
      >
        <button
          type="button"
          className="public-track-sheet-toggle"
          aria-expanded={detailsExpanded}
          aria-label={detailsExpanded ? 'Ocultar detalhes da viagem' : 'Mostrar detalhes da viagem'}
          onClick={() => setDetailsExpanded((value) => !value)}
        >
          <span className="public-track-handle" aria-hidden="true" />
          {detailsExpanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>

        {!detailsExpanded ? (
          <div className="public-track-collapsed-summary">
            <div className={`public-track-status-icon ${status.tone}`}>
              {status.icon}
            </div>
            <div>
              <small>{status.eyebrow}</small>
              <strong>{status.title}</strong>
            </div>
            <div className="public-track-collapsed-metrics">
              <span>{formatDuration(metrics.durationS)}</span>
              <span>{formatDistance(metrics.distanceM)}</span>
            </div>
          </div>
        ) : (
          <div className="public-track-card-content">
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
                <strong>{formatDuration(metrics.durationS)}</strong>
              </div>
              <div>
                <Navigation size={17} />
                <span>Distância restante</span>
                <strong>{formatDistance(metrics.distanceM)}</strong>
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
          </div>
        )}
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
  const driverVisualCoordinateRef = useRef<Coordinate | null>(null);
  const driverVisualBearingRef = useRef(0);
  const driverMotionPlanRef = useRef<DriverMotionPlan | null>(null);
  const driverAnimationFrameRef = useRef<number | null>(null);
  const lastDriverSourceAtRef = useRef<number | null>(null);
  const lastDriverArrivalAtRef = useRef<number | null>(null);
  const lastDriverRouteProgressRef = useRef<number | null>(null);
  const lastDriverRouteKeyRef = useRef('');
  const lastFitKeyRef = useRef('');
  const followingRef = useRef(true);
  const [following, setFollowing] = useState(true);

  dataRef.current = data;
  routeRef.current = route;
  targetRef.current = target;
  themeRef.current = theme;

  const setFollowingMode = useCallback((value: boolean) => {
    followingRef.current = value;
    setFollowing(value);
  }, []);

  const stopDriverAnimation = useCallback(() => {
    if (driverAnimationFrameRef.current != null) {
      window.cancelAnimationFrame(driverAnimationFrameRef.current);
      driverAnimationFrameRef.current = null;
    }
    driverMotionPlanRef.current = null;
  }, []);

  const runDriverAnimation = useCallback(() => {
    if (driverAnimationFrameRef.current != null) return;

    const tick = (now: number) => {
      const marker = driverMarkerRef.current;
      const plan = driverMotionPlanRef.current;
      if (!marker || !plan) {
        driverAnimationFrameRef.current = null;
        return;
      }

      const sample = sampleDriverMotion(plan, now);
      driverVisualCoordinateRef.current = sample.coordinate;
      driverVisualBearingRef.current = sample.bearing;
      marker
        .setLngLat(sample.coordinate)
        .setRotation(sample.bearing);

      if (sample.complete) {
        driverMotionPlanRef.current = null;
        driverAnimationFrameRef.current = null;
        return;
      }
      driverAnimationFrameRef.current = window.requestAnimationFrame(tick);
    };

    driverAnimationFrameRef.current = window.requestAnimationFrame(tick);
  }, []);

  const updateDriverMotion = useCallback((currentData: SharedRidePayload, currentRoute: RouteState) => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const rawPoint = currentData.location
      ? pointOf(currentData.location.lat, currentData.location.lng)
      : null;
    if (!rawPoint) {
      stopDriverAnimation();
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      driverVisualCoordinateRef.current = null;
      lastDriverSourceAtRef.current = null;
      lastDriverArrivalAtRef.current = null;
      lastDriverRouteProgressRef.current = null;
      return;
    }

    const now = performance.now();
    const sourceAt = parseTimestampMs(currentData.location?.created_at);
    const previousSourceAt = lastDriverSourceAtRef.current;
    if (sourceAt != null && previousSourceAt != null && sourceAt <= previousSourceAt) {
      return;
    }

    const rawCoordinate: Coordinate = [rawPoint.lng, rawPoint.lat];
    const routeCoordinates = currentRoute.coordinates.filter(isValidCoordinate);
    const accuracy = clampNumber(currentData.location?.accuracy_m ?? 25, 1, 150);
    const snapThresholdM = clampNumber(accuracy * 1.8, 22, 60);
    const targetProjection = projectCoordinateOnRoute(rawCoordinate, routeCoordinates);
    const targetCoordinate = targetProjection && targetProjection.distanceToRouteM <= snapThresholdM
      ? targetProjection.coordinate
      : rawCoordinate;

    if (lastDriverRouteKeyRef.current !== currentRoute.key) {
      lastDriverRouteKeyRef.current = currentRoute.key;
      lastDriverRouteProgressRef.current = null;
    }

    if (!driverMarkerRef.current) {
      const element = document.createElement('div');
      element.className = 'public-track-driver-marker';
      element.innerHTML = '<span></span>';
      const initialBearing = normalizeBearing(currentData.location?.bearing);
      driverMarkerRef.current = new mapboxgl.Marker({
        element,
        rotationAlignment: 'viewport',
        pitchAlignment: 'viewport',
      })
        .setLngLat(targetCoordinate)
        .setRotation(initialBearing)
        .addTo(map);
      driverVisualCoordinateRef.current = targetCoordinate;
      driverVisualBearingRef.current = initialBearing;
      lastDriverSourceAtRef.current = sourceAt;
      lastDriverArrivalAtRef.current = now;
      lastDriverRouteProgressRef.current = targetProjection?.distanceAlongRouteM ?? null;
      return;
    }

    const activePlan = driverMotionPlanRef.current;
    if (activePlan) {
      const currentSample = sampleDriverMotion(activePlan, now);
      driverVisualCoordinateRef.current = currentSample.coordinate;
      driverVisualBearingRef.current = currentSample.bearing;
      driverMarkerRef.current
        .setLngLat(currentSample.coordinate)
        .setRotation(currentSample.bearing);
    }

    const currentCoordinate = driverVisualCoordinateRef.current ?? targetCoordinate;
    const currentBearing = driverVisualBearingRef.current;
    const directDistanceM = distanceMeters(currentCoordinate, targetCoordinate);
    const stationaryNoiseM = clampNumber(accuracy * 0.16, 1.2, 3.8);
    const speedMps = Math.max(0, currentData.location?.speed_mps ?? 0);

    if (directDistanceM <= stationaryNoiseM && speedMps < 0.8) {
      lastDriverSourceAtRef.current = sourceAt;
      lastDriverArrivalAtRef.current = now;
      return;
    }

    const currentProjection = projectCoordinateOnRoute(currentCoordinate, routeCoordinates);
    const previousProgress = lastDriverRouteProgressRef.current;
    if (
      targetProjection
      && previousProgress != null
      && targetProjection.distanceAlongRouteM < previousProgress
    ) {
      const backwardsM = previousProgress - targetProjection.distanceAlongRouteM;
      const toleratedBackwardsM = clampNumber(accuracy * 0.6, 4, 15);
      if (backwardsM <= toleratedBackwardsM || backwardsM <= 32) {
        lastDriverSourceAtRef.current = sourceAt;
        lastDriverArrivalAtRef.current = now;
        return;
      }
    }

    let path: Coordinate[] = [currentCoordinate, targetCoordinate];
    const canFollowRoute = currentProjection
      && targetProjection
      && currentProjection.distanceToRouteM <= snapThresholdM * 1.25
      && targetProjection.distanceToRouteM <= snapThresholdM
      && targetProjection.distanceAlongRouteM >= currentProjection.distanceAlongRouteM;
    if (canFollowRoute) {
      path = buildRouteSubpath(routeCoordinates, currentProjection, targetProjection);
    }
    path = normalizeCoordinatePath(path, targetCoordinate);

    const motionDistanceM = polylineDistanceMeters(path);
    const arrivalDeltaMs = lastDriverArrivalAtRef.current == null
      ? null
      : now - lastDriverArrivalAtRef.current;
    const sourceDeltaMs = sourceAt != null && previousSourceAt != null
      ? sourceAt - previousSourceAt
      : null;
    const observedIntervalMs = validUpdateInterval(sourceDeltaMs)
      ?? validUpdateInterval(arrivalDeltaMs)
      ?? 3000;
    const longGap = observedIntervalMs > 8000;
    const plausibleDistanceM = (observedIntervalMs / 1000) * 65 + accuracy * 2;
    if (!longGap && motionDistanceM > Math.max(160, plausibleDistanceM)) {
      lastDriverSourceAtRef.current = sourceAt;
      lastDriverArrivalAtRef.current = now;
      return;
    }

    const durationMs = motionDurationMs(observedIntervalMs, motionDistanceM, longGap);
    const targetBearing = resolveDriverBearing({
      previous: currentBearing,
      reported: currentData.location?.bearing,
      path,
      speedMps,
    });
    const cumulativeM = cumulativeDistancesMeters(path);
    driverMotionPlanRef.current = {
      path,
      cumulativeM,
      totalM: cumulativeM.length ? cumulativeM[cumulativeM.length - 1] : 0,
      startBearing: currentBearing,
      endBearing: targetBearing,
      startedAtMs: now,
      durationMs,
    };
    lastDriverSourceAtRef.current = sourceAt;
    lastDriverArrivalAtRef.current = now;
    lastDriverRouteProgressRef.current = targetProjection?.distanceAlongRouteM
      ?? lastDriverRouteProgressRef.current;

    if (followingRef.current) {
      map.easeTo({
        center: targetCoordinate,
        duration: durationMs,
        easing: linearEasing,
        essential: true,
      });
    }
    runDriverAnimation();
  }, [runDriverAnimation, stopDriverAnimation]);

  const renderMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const currentData = dataRef.current;
    const currentRoute = routeRef.current;
    const isDark = themeRef.current === 'dark';
    const safeRouteCoordinates = currentRoute.coordinates.filter(isValidCoordinate);

    const routeData = safeRouteCoordinates.length >= 2
      ? {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: safeRouteCoordinates,
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

    const pickup = pointOf(currentData.ride.pickup_lat, currentData.ride.pickup_lng);
    if (pickup) {
      const coordinate: Coordinate = [pickup.lng, pickup.lat];
      if (!pickupMarkerRef.current) {
        const element = document.createElement('div');
        element.className = 'public-track-pickup-marker';
        pickupMarkerRef.current = new mapboxgl.Marker({ element })
          .setLngLat(coordinate)
          .addTo(map);
      } else {
        pickupMarkerRef.current.setLngLat(coordinate);
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    const destination = pointOf(
      currentData.ride.destination_lat,
      currentData.ride.destination_lng,
    );
    if (destination) {
      const coordinate: Coordinate = [destination.lng, destination.lat];
      if (!destinationMarkerRef.current) {
        const element = document.createElement('div');
        element.className = 'public-track-destination-marker';
        element.innerHTML = '<span></span>';
        destinationMarkerRef.current = new mapboxgl.Marker({ element, anchor: 'bottom' })
          .setLngLat(coordinate)
          .addTo(map);
      } else {
        destinationMarkerRef.current.setLngLat(coordinate);
      }
    } else if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    updateDriverMotion(currentData, currentRoute);

    const fitKey = `${currentData.ride.id}|${currentData.ride.status}`;
    if (fitKey !== lastFitKeyRef.current) {
      lastFitKeyRef.current = fitKey;
      const bounds = new LngLatBounds();
      safeRouteCoordinates.forEach((coordinate) => bounds.extend(coordinate));
      const visualLocation = driverVisualCoordinateRef.current;
      if (visualLocation) bounds.extend(visualLocation);
      const currentTarget = targetRef.current.point
        ? pointOf(targetRef.current.point.lat, targetRef.current.point.lng)
        : null;
      if (currentTarget) bounds.extend([currentTarget.lng, currentTarget.lat]);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, {
          padding: { top: 105, right: 55, bottom: 330, left: 55 },
          maxZoom: 16.2,
          duration: 850,
        });
      }
    }
  }, [updateDriverMotion]);

  useEffect(() => {
    if (!containerRef.current || !env.mapboxAccessToken) return;
    readyRef.current = false;
    lastFitKeyRef.current = '';
    setFollowingMode(true);
    const initialLocation = data.location
      ? pointOf(data.location.lat, data.location.lng)
      : null;
    const initialTarget = target.point
      ? pointOf(target.point.lat, target.point.lng)
      : null;
    const initial: Coordinate = initialLocation
      ? [initialLocation.lng, initialLocation.lat]
      : initialTarget
        ? [initialTarget.lng, initialTarget.lat]
        : [-40.3128, -20.3155];
    const map = new mapboxgl.Map({
      accessToken: env.mapboxAccessToken,
      container: containerRef.current,
      style: theme === 'dark' ? env.mapboxStyleDark : env.mapboxStyleLight,
      center: initial,
      zoom: 14,
      interactive: true,
      attributionControl: false,
      logoPosition: 'bottom-left',
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');

    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.dragRotate.enable();
    map.dragPan.enable();
    map.keyboard.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();

    const onUserGesture = (event: { originalEvent?: unknown }) => {
      if (!event.originalEvent) return;
      setFollowingMode(false);
    };
    const canvasContainer = map.getCanvasContainer();
    const onUserPointerIntent = () => setFollowingMode(false);
    canvasContainer.addEventListener('pointerdown', onUserPointerIntent, { passive: true });
    canvasContainer.addEventListener('wheel', onUserPointerIntent, { passive: true });
    map.on('dragstart', onUserGesture);
    map.on('zoomstart', onUserGesture);
    map.on('rotatestart', onUserGesture);
    map.on('pitchstart', onUserGesture);
    map.on('load', () => {
      readyRef.current = true;
      renderMap();
    });
    mapRef.current = map;

    return () => {
      readyRef.current = false;
      stopDriverAnimation();
      driverMarkerRef.current?.remove();
      pickupMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      pickupMarkerRef.current = null;
      destinationMarkerRef.current = null;
      driverVisualCoordinateRef.current = null;
      lastDriverSourceAtRef.current = null;
      lastDriverArrivalAtRef.current = null;
      lastDriverRouteProgressRef.current = null;
      canvasContainer.removeEventListener('pointerdown', onUserPointerIntent);
      canvasContainer.removeEventListener('wheel', onUserPointerIntent);
      map.off('dragstart', onUserGesture);
      map.off('zoomstart', onUserGesture);
      map.off('rotatestart', onUserGesture);
      map.off('pitchstart', onUserGesture);
      map.remove();
      mapRef.current = null;
    };
  }, [theme, renderMap, setFollowingMode, stopDriverAnimation]);

  useEffect(() => {
    renderMap();
  }, [data, route, target, renderMap]);

  const recenterDriver = useCallback(() => {
    const map = mapRef.current;
    const coordinate = driverVisualCoordinateRef.current;
    if (!map || !coordinate) return;
    setFollowingMode(true);
    map.easeTo({
      center: coordinate,
      zoom: Math.max(map.getZoom(), 15),
      duration: 650,
      essential: true,
    });
  }, [setFollowingMode]);

  if (!env.mapboxAccessToken) {
    return (
      <div className="public-track-map public-track-map-missing">
        <MapPin size={34} />
        <strong>Mapa temporariamente indisponível</strong>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="public-track-map" />
      <button
        type="button"
        className={`public-track-recenter ${following ? 'is-following' : ''}`}
        onClick={recenterDriver}
        aria-label="Recentralizar no motorista"
        aria-pressed={following}
      >
        <LocateFixed size={19} />
        <span>{following ? 'Centralizado' : 'Recentralizar'}</span>
      </button>
    </>
  );
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
          distanceM: navigation.distance_m,
          durationS: navigation.duration_s,
          key: `navigation:${navigation.route_id ?? ''}:${stringSignature(navigation.encoded_polyline)}`,
        };
      }
    }

    const start = data.location
      ? pointOf(data.location.lat, data.location.lng)
      : null;
    const target = activeTarget(data).point;
    if (!start || !target) return { type: 'none' as const };
    return {
      type: 'mapbox' as const,
      start,
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
      setRoute({
        coordinates: routeInput.coordinates,
        key: routeInput.key,
        source: 'navigation',
        distanceM: finitePositive(routeInput.distanceM),
        durationS: finitePositive(routeInput.durationS),
      });
      return;
    }
    if (!env.mapboxAccessToken) {
      setRoute(emptyRoute);
      return;
    }

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
          routes?: Array<{
            geometry?: { coordinates?: Coordinate[] };
            distance?: number;
            duration?: number;
          }>;
        }>;
      })
      .then((response) => {
        const selectedRoute = response.routes?.[0];
        const coordinatesResult = (
          selectedRoute?.geometry?.coordinates ?? []
        ).filter(isValidCoordinate);
        if (coordinatesResult.length >= 2) {
          setRoute({
            coordinates: coordinatesResult,
            key: routeInput.key,
            source: 'mapbox',
            distanceM: finitePositive(selectedRoute?.distance),
            durationS: finitePositive(selectedRoute?.duration),
          });
        }
      })
      .catch((routeError) => {
        if ((routeError as Error).name !== 'AbortError') {
          // Mantém a rota anterior para evitar sumiço e piscadas durante uma falha transitória.
        }
      });

    return () => controller.abort();
  }, [routeInputKey]);

  return route;
}

function estimateRemainingRouteMetrics(
  route: RouteState,
  location: SharedRidePayload['location'],
  status: SharedRideStatus | undefined,
): RouteMetrics {
  if (status === 'completed' || status === 'cancelled') {
    return { distanceM: 0, durationS: 0 };
  }

  const coordinates = route.coordinates.filter(isValidCoordinate);
  if (coordinates.length < 2) {
    return { distanceM: null, durationS: null };
  }

  const geometryDistanceM = polylineDistanceMeters(coordinates);
  if (geometryDistanceM <= 0) {
    return { distanceM: null, durationS: null };
  }

  const baseDistanceM = finitePositive(route.distanceM) ?? geometryDistanceM;
  let remainingRatio = 1;
  if (location) {
    const point = pointOf(location.lat, location.lng);
    if (point) {
      const projection = projectCoordinateOnRoute([point.lng, point.lat], coordinates);
      if (projection && projection.distanceToRouteM <= 140) {
        const geometryRemainingM = Math.max(
          0,
          geometryDistanceM - projection.distanceAlongRouteM,
        );
        remainingRatio = clampNumber(geometryRemainingM / geometryDistanceM, 0, 1);
      }
    }
  }

  const distanceM = Math.max(0, baseDistanceM * remainingRatio);
  const baseDurationS = finitePositive(route.durationS);
  const durationS = baseDurationS != null
    ? Math.max(0, baseDurationS * remainingRatio)
    : distanceM / estimatedTravelSpeedMps(location?.speed_mps);

  return { distanceM, durationS };
}

function estimatedTravelSpeedMps(value: number | null | undefined): number {
  if (value != null && Number.isFinite(value) && value >= 2) {
    return clampNumber(value, 4, 22);
  }
  return 8.33;
}

function sampleDriverMotion(
  plan: DriverMotionPlan,
  nowMs: number,
): { coordinate: Coordinate; bearing: number; complete: boolean } {
  const fraction = plan.durationMs <= 0
    ? 1
    : clampNumber((nowMs - plan.startedAtMs) / plan.durationMs, 0, 1);
  return {
    coordinate: coordinateAtDistance(
      plan.path,
      plan.cumulativeM,
      plan.totalM * fraction,
    ),
    bearing: interpolateBearing(plan.startBearing, plan.endBearing, fraction),
    complete: fraction >= 1,
  };
}

function parseTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validUpdateInterval(value: number | null): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value >= 150 && value <= 60_000 ? value : null;
}

function motionDurationMs(
  observedIntervalMs: number,
  distanceM: number,
  longGap: boolean,
): number {
  if (distanceM < 0.5) return 0;
  if (longGap) return clampNumber(850 + distanceM * 9, 900, 1600);
  const continuityDuration = observedIntervalMs * 0.92;
  if (distanceM <= 3) return clampNumber(continuityDuration, 650, 1300);
  return clampNumber(continuityDuration, 900, 2850);
}

function resolveDriverBearing({
  previous,
  reported,
  path,
  speedMps,
}: {
  previous: number;
  reported: number | null | undefined;
  path: Coordinate[];
  speedMps: number;
}): number {
  const geometry = pathBearing(path);
  const reportedBearing = reported != null
    && Number.isFinite(reported)
    && speedMps >= 0.75
      ? normalizeBearing(reported)
      : null;

  let raw = previous;
  if (geometry != null && reportedBearing != null) {
    raw = bearingDistance(geometry, reportedBearing) <= 55
      ? interpolateBearing(geometry, reportedBearing, 0.24)
      : geometry;
  } else if (geometry != null) {
    raw = geometry;
  } else if (reportedBearing != null) {
    raw = reportedBearing;
  }

  const delta = bearingDistance(previous, raw);
  const amount = delta >= 50 ? 0.8 : delta >= 25 ? 0.62 : speedMps < 0.6 ? 0.22 : 0.44;
  return interpolateBearing(previous, raw, amount);
}

function pathBearing(path: Coordinate[]): number | null {
  for (let index = 0; index < path.length - 1; index += 1) {
    if (distanceMeters(path[index], path[index + 1]) >= 1) {
      return bearingBetween(path[index], path[index + 1]);
    }
  }
  return null;
}

function bearingBetween(from: Coordinate, to: Coordinate): number {
  const fromLat = degreesToRadians(from[1]);
  const toLat = degreesToRadians(to[1]);
  const deltaLng = degreesToRadians(to[0] - from[0]);
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat)
    - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return normalizeBearing(radiansToDegrees(Math.atan2(y, x)));
}

function interpolateBearing(from: number, to: number, amount: number): number {
  const normalizedFrom = normalizeBearing(from);
  const normalizedTo = normalizeBearing(to);
  const delta = ((normalizedTo - normalizedFrom + 540) % 360) - 180;
  return normalizeBearing(normalizedFrom + delta * clampNumber(amount, 0, 1));
}

function bearingDistance(a: number, b: number): number {
  const delta = Math.abs(normalizeBearing(a) - normalizeBearing(b));
  return Math.min(delta, 360 - delta);
}

function projectCoordinateOnRoute(
  point: Coordinate,
  route: Coordinate[],
): RouteProjection | null {
  if (route.length < 2 || !isValidCoordinate(point)) return null;
  const cumulative = cumulativeDistancesMeters(route);
  let best: RouteProjection | null = null;

  for (let index = 0; index < route.length - 1; index += 1) {
    const start = route[index];
    const end = route[index + 1];
    const projection = projectOnSegment(point, start, end);
    const segmentDistanceM = distanceMeters(start, end);
    const candidate: RouteProjection = {
      coordinate: projection.coordinate,
      segmentIndex: index,
      segmentFraction: projection.fraction,
      distanceToRouteM: projection.distanceM,
      distanceAlongRouteM: cumulative[index] + segmentDistanceM * projection.fraction,
    };
    if (!best || candidate.distanceToRouteM < best.distanceToRouteM) best = candidate;
  }
  return best;
}

function projectOnSegment(
  point: Coordinate,
  start: Coordinate,
  end: Coordinate,
): { coordinate: Coordinate; fraction: number; distanceM: number } {
  const referenceLatRad = degreesToRadians((point[1] + start[1] + end[1]) / 3);
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = Math.max(1, metersPerDegreeLat * Math.cos(referenceLatRad));
  const segmentX = (end[0] - start[0]) * metersPerDegreeLng;
  const segmentY = (end[1] - start[1]) * metersPerDegreeLat;
  const pointX = (point[0] - start[0]) * metersPerDegreeLng;
  const pointY = (point[1] - start[1]) * metersPerDegreeLat;
  const lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const fraction = lengthSquared <= 0
    ? 0
    : clampNumber((pointX * segmentX + pointY * segmentY) / lengthSquared, 0, 1);
  const projectedX = segmentX * fraction;
  const projectedY = segmentY * fraction;
  const coordinate: Coordinate = [
    start[0] + (end[0] - start[0]) * fraction,
    start[1] + (end[1] - start[1]) * fraction,
  ];
  return {
    coordinate,
    fraction,
    distanceM: Math.hypot(pointX - projectedX, pointY - projectedY),
  };
}

function buildRouteSubpath(
  route: Coordinate[],
  start: RouteProjection,
  end: RouteProjection,
): Coordinate[] {
  if (start.segmentIndex > end.segmentIndex) return [start.coordinate, end.coordinate];
  const result: Coordinate[] = [start.coordinate];
  for (let index = start.segmentIndex + 1; index <= end.segmentIndex; index += 1) {
    const coordinate = route[index];
    if (coordinate && distanceMeters(result[result.length - 1], coordinate) >= 0.3) {
      result.push(coordinate);
    }
  }
  if (distanceMeters(result[result.length - 1], end.coordinate) >= 0.3) {
    result.push(end.coordinate);
  } else {
    result[result.length - 1] = end.coordinate;
  }
  return result;
}

function normalizeCoordinatePath(path: Coordinate[], target: Coordinate): Coordinate[] {
  const normalized: Coordinate[] = [];
  path.filter(isValidCoordinate).forEach((coordinate) => {
    if (!normalized.length || distanceMeters(normalized[normalized.length - 1], coordinate) >= 0.3) {
      normalized.push(coordinate);
    }
  });
  if (!normalized.length) normalized.push(target);
  if (distanceMeters(normalized[normalized.length - 1], target) >= 0.3) normalized.push(target);
  else normalized[normalized.length - 1] = target;
  return normalized;
}

function cumulativeDistancesMeters(path: Coordinate[]): number[] {
  const cumulative = [0];
  for (let index = 1; index < path.length; index += 1) {
    cumulative.push(cumulative[index - 1] + distanceMeters(path[index - 1], path[index]));
  }
  return cumulative;
}

function polylineDistanceMeters(path: Coordinate[]): number {
  return (() => { const values = cumulativeDistancesMeters(path); return values.length ? values[values.length - 1] : 0; })();
}

function coordinateAtDistance(
  path: Coordinate[],
  cumulativeM: number[],
  targetDistanceM: number,
): Coordinate {
  if (!path.length) return [0, 0];
  if (path.length === 1 || targetDistanceM <= 0) return path[0];
  const totalM = cumulativeM.length ? cumulativeM[cumulativeM.length - 1] : 0;
  if (targetDistanceM >= totalM) return path[path.length - 1];

  for (let index = 0; index < cumulativeM.length - 1; index += 1) {
    const startM = cumulativeM[index];
    const endM = cumulativeM[index + 1];
    if (targetDistanceM <= endM) {
      const segmentM = endM - startM;
      const fraction = segmentM <= 0 ? 1 : (targetDistanceM - startM) / segmentM;
      return interpolateCoordinate(path[index], path[index + 1], fraction);
    }
  }
  return path[path.length - 1];
}

function interpolateCoordinate(from: Coordinate, to: Coordinate, amount: number): Coordinate {
  const fraction = clampNumber(amount, 0, 1);
  return [
    from[0] + (to[0] - from[0]) * fraction,
    from[1] + (to[1] - from[1]) * fraction,
  ];
}

function distanceMeters(a: Coordinate, b: Coordinate): number {
  const earthRadiusM = 6_371_000;
  const lat1 = degreesToRadians(a[1]);
  const lat2 = degreesToRadians(b[1]);
  const deltaLat = lat2 - lat1;
  const deltaLng = degreesToRadians(b[0] - a[0]);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}

function finitePositive(value: number | null | undefined): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180;
}

function radiansToDegrees(value: number): number {
  return value * 180 / Math.PI;
}

function linearEasing(value: number): number {
  return value;
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

function isValidCoordinate(value: unknown): value is Coordinate {
  if (!Array.isArray(value) || value.length < 2) return false;
  const lng = Number(value[0]);
  const lat = Number(value[1]);
  return Number.isFinite(lng)
    && Number.isFinite(lat)
    && lng >= -180
    && lng <= 180
    && lat >= -90
    && lat <= 90;
}

function pointOf(lat: number | null, lng: number | null): SharedRidePoint | null {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function normalizeBearing(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  return ((value % 360) + 360) % 360;
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
  if (seconds <= 0) return '0 min';
  if (seconds < 60) return '< 1 min';
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

function formatDistance(meters: number | null | undefined): string {
  if (meters == null || !Number.isFinite(meters)) return 'Calculando';
  if (meters <= 0) return '0 m';
  if (meters < 20) return '< 20 m';
  if (meters < 1000) return `${Math.max(20, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

function relativeUpdate(value: Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - value.getTime()) / 1000));
  if (seconds < 5) return 'Atualizado agora';
  if (seconds < 60) return `Atualizado há ${seconds}s`;
  return `Atualizado há ${Math.floor(seconds / 60)} min`;
}
