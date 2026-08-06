import { useEffect, useMemo, useRef, useState } from 'react';
import mapboxgl, { type GeoJSONSource, type Map as MapboxMap } from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { ThemeMode } from '../../types/admin';
import { LocateFixed, MousePointer2, RotateCcw, Trash2, Undo2 } from 'lucide-react';
import type * as GeoJSON from 'geojson';
//
type Position = [number, number];

type Props = {
  theme: ThemeMode;
  value: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  onChange: (value: GeoJSON.Polygon | null) => void;
};

const emptyCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function polygonFeature(value: Props['value']): GeoJSON.FeatureCollection {
  if (!value) return emptyCollection;
  return {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: {}, geometry: value }],
  };
}

function pointsToPolygon(points: Position[]): GeoJSON.Polygon | null {
  if (points.length < 3) return null;
  return { type: 'Polygon', coordinates: [[...points, points[0]]] };
}

function editablePoints(value: Props['value']): Position[] {
  if (!value || value.type !== 'Polygon' || !value.coordinates[0]?.length) return [];
  return value.coordinates[0].slice(0, -1).map(([lng, lat]) => [lng, lat]);
}

export function RegionMapEditor({ theme, value, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const pointsRef = useRef<Position[]>(editablePoints(value));
  const onChangeRef = useRef(onChange);
  const [drawing, setDrawing] = useState(!value);
  const [pointCount, setPointCount] = useState(pointsRef.current.length);
  const mapboxToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';
  const lightStyle = import.meta.env.VITE_MAPBOX_STYLE_LIGHT || 'mapbox://styles/mapbox/streets-v12';
  const darkStyle = import.meta.env.VITE_MAPBOX_STYLE_DARK || 'mapbox://styles/mapbox/dark-v11';
  const mapStyle = theme === 'dark' ? darkStyle : lightStyle;

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    pointsRef.current = editablePoints(value);
    setPointCount(pointsRef.current.length);
    const source = mapRef.current?.getSource('service-area') as GeoJSONSource | undefined;
    source?.setData(polygonFeature(value));
  }, [value]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new mapboxgl.Map({
      accessToken: mapboxToken,
      container: containerRef.current,
      style: mapStyle,
      center: [-40.3128, -20.3155],
      zoom: 11,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => {
      map.addSource('service-area', { type: 'geojson', data: polygonFeature(value) });
      map.addLayer({ id: 'service-area-fill', type: 'fill', source: 'service-area', paint: { 'fill-color': '#2563eb', 'fill-opacity': 0.2 } });
      map.addLayer({ id: 'service-area-line', type: 'line', source: 'service-area', paint: { 'line-color': '#2563eb', 'line-width': 3 } });
      if (value) {
        const coordinates = value.type === 'Polygon' ? value.coordinates.flat(1) : value.coordinates.flat(2);
        if (coordinates.length) {
          const bounds = coordinates.reduce((box, coordinate) => box.extend(coordinate as Position), new mapboxgl.LngLatBounds(coordinates[0] as Position, coordinates[0] as Position));
          map.fitBounds(bounds, { padding: 55, maxZoom: 14, duration: 0 });
        }
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => map.easeTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 13 }), () => undefined, { enableHighAccuracy: false, timeout: 3500 });
      }
    });
    map.on('click', (event) => {
      if (!drawingRef.current) return;
      pointsRef.current = [...pointsRef.current, [event.lngLat.lng, event.lngLat.lat]];
      setPointCount(pointsRef.current.length);
      onChangeRef.current(pointsToPolygon(pointsRef.current));
    });
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [mapboxToken, mapStyle]);

  const drawingRef = useRef(drawing);
  useEffect(() => {
    drawingRef.current = drawing;
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = drawing ? 'crosshair' : 'grab';
  }, [drawing]);

  const helper = useMemo(() => {
    if (!drawing) return 'Visualizacao ativa. Clique em “Editar desenho” para alterar o poligono.';
    if (pointCount < 3) return `Clique no mapa para marcar os limites. Faltam ${3 - pointCount} ponto(s).`;
    return `${pointCount} pontos definidos. O poligono ja pode ser salvo ou continuar sendo detalhado.`;
  }, [drawing, pointCount]);

  function undo() {
    pointsRef.current = pointsRef.current.slice(0, -1);
    setPointCount(pointsRef.current.length);
    onChange(pointsToPolygon(pointsRef.current));
  }

  function clear() {
    pointsRef.current = [];
    setPointCount(0);
    setDrawing(true);
    onChange(null);
  }

  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((position) => mapRef.current?.easeTo({ center: [position.coords.longitude, position.coords.latitude], zoom: 14 }), () => undefined, { enableHighAccuracy: true, timeout: 6000 });
  }

  return <div className="region-draw-shell">
    <div className="region-draw-toolbar">
      <button type="button" className={drawing ? 'button primary compact' : 'button secondary compact'} onClick={() => setDrawing((current) => !current)}><MousePointer2 size={16}/>{drawing ? 'Desenhando' : 'Editar desenho'}</button>
      <button type="button" className="icon-btn" onClick={undo} disabled={!pointCount} title="Desfazer ultimo ponto"><Undo2 size={17}/></button>
      <button type="button" className="icon-btn" onClick={clear} disabled={!value && !pointCount} title="Limpar desenho"><Trash2 size={17}/></button>
      <button type="button" className="icon-btn" onClick={() => { clear(); mapRef.current?.easeTo({ zoom: 11 }); }} title="Recomecar"><RotateCcw size={17}/></button>
      <button type="button" className="icon-btn" onClick={locate} title="Ir para minha localizacao"><LocateFixed size={17}/></button>
      <span>{pointCount} pontos</span>
    </div>
    <div ref={containerRef} className="region-draw-map" aria-label="Mapa para desenhar area de atendimento"/>
    <p className="region-draw-help">{helper}</p>
  </div>;
}
