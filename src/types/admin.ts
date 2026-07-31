export type AdminView =
  | 'dashboard'
  | 'operation'
  | 'drivers'
  | 'clients'
  | 'rides'
  | 'finance'
  | 'payments'
  | 'safety'
  | 'support'
  | 'ratings'
  | 'settings'
  | 'audit';

export type ThemeMode = 'light' | 'dark';

export type DriverSummary = {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  avatar_url?: string | null;
  profile_status: string;
  approval_status: string;
  rejection_reason?: string | null;
  is_online: boolean;
  rating: number;
  total_trips: number;
  last_location_at?: string | null;
  current_lat?: number | null;
  current_lng?: number | null;
  primary_vehicle?: Record<string, unknown> | null;
  vehicles?: Record<string, unknown>[];
  documents?: Record<string, unknown>[];
  pending_documents?: number;
};

export type ClientSummary = {
  id: string;
  name: string;
  phone: string;
  status: string;
  created_at: string;
  ride_count?: number;
  total_spent?: number;
  last_ride_at?: string | null;
};

export type RideSummary = {
  id: string;
  status: string;
  pickup_address?: string | null;
  destination_address?: string | null;
  final_price?: number | null;
  estimated_price?: number | null;
  platform_fee?: number | null;
  driver_earning?: number | null;
  payment_status?: string | null;
  payment_method?: string | null;
  payment_timing?: string | null;
  payment_channel?: string | null;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  client?: { id: string; name: string; phone?: string | null } | null;
  driver?: { id: string; name: string; phone?: string | null } | null;
  vehicle?: Record<string, unknown> | null;
};
