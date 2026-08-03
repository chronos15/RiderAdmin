import { supabase } from './supabaseService';

export type SharedRideStatus =
  | 'accepted'
  | 'driver_arriving'
  | 'driver_arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | string;

export type SharedRidePoint = {
  lat: number;
  lng: number;
};

export type SharedRidePayload = {
  ride: {
    id: string;
    status: SharedRideStatus;
    pickup_address: string | null;
    destination_address: string | null;
    pickup_lat: number | null;
    pickup_lng: number | null;
    destination_lat: number | null;
    destination_lng: number | null;
    started_at: string | null;
    created_at: string | null;
    updated_at: string | null;
  };
  driver: {
    name: string;
    rating: number | null;
  };
  vehicle: {
    brand: string | null;
    model: string | null;
    color: string | null;
    plate: string | null;
    vehicle_type: string | null;
  };
  location: {
    lat: number;
    lng: number;
    bearing: number | null;
    speed_mps: number | null;
    accuracy_m: number | null;
    created_at: string | null;
    source: string | null;
  } | null;
  navigation_route: {
    route_id: string | null;
    encoded_polyline: string;
    geometry_format: 'polyline5' | 'polyline6';
    distance_m: number | null;
    duration_s: number | null;
    heading_to_pickup: boolean;
    updated_at: string | null;
  } | null;
  expires_at: string | null;
};

function asNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: unknown): string | null {
  if (value == null) return null;
  const parsed = String(value).trim();
  return parsed.length ? parsed : null;
}

function normalizePayload(value: unknown): SharedRidePayload {
  if (!value || typeof value !== 'object') {
    throw new Error('A viagem compartilhada retornou dados inválidos.');
  }
  const payload = value as Record<string, unknown>;
  const ride = (payload.ride ?? {}) as Record<string, unknown>;
  const driver = (payload.driver ?? {}) as Record<string, unknown>;
  const vehicle = (payload.vehicle ?? {}) as Record<string, unknown>;
  const location = payload.location && typeof payload.location === 'object'
    ? payload.location as Record<string, unknown>
    : null;
  const route = payload.navigation_route && typeof payload.navigation_route === 'object'
    ? payload.navigation_route as Record<string, unknown>
    : null;

  const rideId = asText(ride.id);
  if (!rideId) throw new Error('A viagem compartilhada não foi encontrada.');

  return {
    ride: {
      id: rideId,
      status: asText(ride.status) ?? 'accepted',
      pickup_address: asText(ride.pickup_address),
      destination_address: asText(ride.destination_address),
      pickup_lat: asNumber(ride.pickup_lat),
      pickup_lng: asNumber(ride.pickup_lng),
      destination_lat: asNumber(ride.destination_lat),
      destination_lng: asNumber(ride.destination_lng),
      started_at: asText(ride.started_at),
      created_at: asText(ride.created_at),
      updated_at: asText(ride.updated_at),
    },
    driver: {
      name: asText(driver.name) ?? 'Motorista',
      rating: asNumber(driver.rating),
    },
    vehicle: {
      brand: asText(vehicle.brand),
      model: asText(vehicle.model),
      color: asText(vehicle.color),
      plate: asText(vehicle.plate),
      vehicle_type: asText(vehicle.vehicle_type),
    },
    location: location && asNumber(location.lat) != null && asNumber(location.lng) != null
      ? {
          lat: asNumber(location.lat)!,
          lng: asNumber(location.lng)!,
          bearing: asNumber(location.bearing),
          speed_mps: asNumber(location.speed_mps),
          accuracy_m: asNumber(location.accuracy_m),
          created_at: asText(location.created_at),
          source: asText(location.source),
        }
      : null,
    navigation_route: route && asText(route.encoded_polyline)
      ? {
          route_id: asText(route.route_id),
          encoded_polyline: asText(route.encoded_polyline)!,
          geometry_format: asText(route.geometry_format) === 'polyline5' ? 'polyline5' : 'polyline6',
          distance_m: asNumber(route.distance_m),
          duration_s: asNumber(route.duration_s),
          heading_to_pickup: route.heading_to_pickup === true,
          updated_at: asText(route.updated_at),
        }
      : null,
    expires_at: asText(payload.expires_at),
  };
}

export const publicRideService = {
  async getSharedRide(token: string): Promise<SharedRidePayload> {
    const normalizedToken = token.trim();
    if (!normalizedToken) throw new Error('Link de acompanhamento inválido.');
    const { data, error } = await supabase.rpc('get_shared_ride_rpc', {
      p_token: normalizedToken,
    });
    if (error) throw new Error(error.message || 'Não foi possível carregar a viagem compartilhada.');
    return normalizePayload(data);
  },
};
