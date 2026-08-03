import { supabase } from './supabaseService';
import type { ClientSummary, DriverSummary, RideSummary } from '../types/admin';

function readableServiceError(value: unknown, fallback: string): string {
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (typeof value === 'string') {
    const text = value.trim();
    return text && text !== '[object Object]' ? text : fallback;
  }
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    for (const key of ['message', 'description', 'error_description', 'details', 'hint', 'error', 'code']) {
      const nested = readableServiceError(object[key], '');
      if (nested) return nested;
    }
    try {
      const encoded = JSON.stringify(value);
      if (encoded && encoded !== '{}') return encoded;
    } catch (_) { /* fallback abaixo */ }
  }
  return fallback;
}

async function rpcOrFallback<T>(rpcName: string, args: Record<string, unknown> | undefined, fallback: () => Promise<T>): Promise<T> {
  const { data, error } = await supabase.rpc(rpcName, args);
  if (!error) return data as T;
  if (error.code !== 'PGRST202' && !String(error.message).includes('Could not find the function')) throw error;
  return fallback();
}

export const adminService = {
  async dashboard() {
    return rpcOrFallback<Record<string, unknown>>('admin_dashboard_v2_rpc', undefined, async () => {
      const [profiles, drivers, rides, tickets, incidents] = await Promise.all([
        supabase.from('profiles').select('id, role, status, created_at'),
        supabase.from('drivers').select('id, approval_status, is_online, rating, created_at'),
        supabase.from('rides').select('id, status, final_price, driver_earning, platform_fee, created_at, finished_at'),
        supabase.from('support_tickets').select('id, status, priority, created_at'),
        supabase.from('safety_incidents').select('id, status, severity, created_at'),
      ]);
      const today = new Date().toISOString().slice(0, 10);
      const allRides = rides.data ?? [];
      const ridesToday = allRides.filter((ride) => ride.created_at?.startsWith(today));
      return {
        clients: (profiles.data ?? []).filter((item) => item.role === 'client').length,
        active_clients: (profiles.data ?? []).filter((item) => item.role === 'client' && item.status === 'active').length,
        drivers: (drivers.data ?? []).length,
        online_drivers: (drivers.data ?? []).filter((item) => item.is_online).length,
        pending_drivers: (drivers.data ?? []).filter((item) => item.approval_status === 'pending').length,
        rides_today: ridesToday.length,
        active_rides: allRides.filter((item) => ['accepted', 'driver_arriving', 'driver_arrived', 'in_progress'].includes(item.status)).length,
        completed_today: ridesToday.filter((item) => item.status === 'completed').length,
        cancelled_today: ridesToday.filter((item) => item.status === 'cancelled').length,
        gmv_today: ridesToday.reduce((sum, item) => sum + Number(item.final_price ?? 0), 0),
        platform_fee_today: ridesToday.reduce((sum, item) => sum + Number(item.platform_fee ?? 0), 0),
        open_tickets: (tickets.data ?? []).filter((item) => item.status === 'open').length,
        open_incidents: (incidents.data ?? []).filter((item) => item.status !== 'resolved').length,
        avg_rating: (drivers.data ?? []).length ? (drivers.data ?? []).reduce((sum, item) => sum + Number(item.rating ?? 0), 0) / (drivers.data ?? []).length : 0,
      };
    });
  },

  async drivers(search = '', status = 'all'): Promise<DriverSummary[]> {
    return rpcOrFallback<DriverSummary[]>('admin_list_drivers_rpc', { p_search: search, p_status: status }, async () => {
      let query = supabase
        .from('drivers')
        .select('id, user_id, approval_status, rejection_reason, is_online, rating, total_trips, last_location_at, current_lat, current_lng, profiles!drivers_user_id_fkey(name, phone, avatar_url, status), vehicles(*), driver_documents(*)')
        .order('created_at', { ascending: false });
      if (status !== 'all') query = query.eq('approval_status', status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        name: item.profiles?.name ?? 'Sem nome',
        phone: item.profiles?.phone ?? '',
        avatar_url: item.profiles?.avatar_url,
        profile_status: item.profiles?.status ?? 'active',
        approval_status: item.approval_status,
        rejection_reason: item.rejection_reason,
        is_online: item.is_online,
        rating: Number(item.rating ?? 0),
        total_trips: Number(item.total_trips ?? 0),
        last_location_at: item.last_location_at,
        current_lat: item.current_lat,
        current_lng: item.current_lng,
        vehicles: item.vehicles ?? [],
        documents: item.driver_documents ?? [],
        primary_vehicle: (item.vehicles ?? []).find((vehicle: any) => vehicle.is_primary) ?? item.vehicles?.[0] ?? null,
        pending_documents: (item.driver_documents ?? []).filter((document: any) => document.status === 'pending').length,
      })).filter((item) => !search || `${item.name} ${item.phone} ${(item.primary_vehicle as any)?.plate ?? ''}`.toLowerCase().includes(search.toLowerCase()));
    });
  },

  async reviewDriver(driverId: string, status: 'approved' | 'rejected' | 'pending', reason?: string) {
    const { data, error } = await supabase.functions.invoke('approve_driver', { body: { driver_id: driverId, status, reason: reason ?? null } });
    if (error || data?.error) throw error ?? new Error(data.error);
    return data?.data;
  },

  async reviewVehicle(vehicleId: string, status: 'approved' | 'rejected', reason?: string) {
    const { data, error } = await supabase.rpc('admin_review_vehicle_rpc', {
      p_vehicle_id: vehicleId,
      p_status: status,
      p_reason: reason ?? null,
    });
    if (error) throw error;
    return data;
  },

  async reviewDocument(documentId: string, status: 'approved' | 'rejected', reason?: string) {
    const { data, error } = await supabase.rpc('admin_review_document_rpc', {
      p_document_id: documentId,
      p_status: status,
      p_reason: reason ?? null,
    });
    if (error) throw error;
    return data;
  },

  async signedDocumentUrl(pathOrUrl: string) {
    if (!pathOrUrl) return null;
    if (pathOrUrl.startsWith('http')) return pathOrUrl;
    const bucket = pathOrUrl.includes('driver-vehicles') ? 'driver-vehicles' : 'driver-documents';
    const normalized = pathOrUrl.replace(`${bucket}/`, '');
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(normalized, 300);
    if (error) throw error;
    return data.signedUrl;
  },

  async clients(search = '', status = 'all'): Promise<ClientSummary[]> {
    return rpcOrFallback<ClientSummary[]>('admin_list_clients_rpc', { p_search: search, p_status: status }, async () => {
      let query = supabase.from('profiles').select('id, name, phone, status, created_at').eq('role', 'client').order('created_at', { ascending: false });
      if (status !== 'all') query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      const clients = data ?? [];
      const ids = clients.map((item) => item.id);
      const rides = ids.length ? await supabase.from('rides').select('client_id, final_price, created_at').in('client_id', ids) : { data: [] as any[] };
      return clients.map((client) => {
        const ownRides = (rides.data ?? []).filter((ride) => ride.client_id === client.id);
        return { ...client, ride_count: ownRides.length, total_spent: ownRides.reduce((sum, ride) => sum + Number(ride.final_price ?? 0), 0), last_ride_at: ownRides.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]?.created_at ?? null };
      }).filter((item) => !search || `${item.name} ${item.phone}`.toLowerCase().includes(search.toLowerCase()));
    });
  },

  async setUserStatus(userId: string, status: 'active' | 'blocked', reason?: string) {
    return rpcOrFallback('admin_set_user_status_rpc', { p_user_id: userId, p_status: status, p_reason: reason ?? null }, async () => {
      const { data, error } = await supabase.from('profiles').update({ status }).eq('id', userId).select().single();
      if (error) throw error;
      return data;
    });
  },

  async rides(filters: { status?: string; search?: string; from?: string; to?: string } = {}): Promise<RideSummary[]> {
    let query = supabase
      .from('rides')
      .select('*, client:profiles!rides_client_id_fkey(id,name,phone), driver:drivers!rides_driver_id_fkey(id,user_id,profiles!drivers_user_id_fkey(name,phone)), vehicle:vehicles(*)')
      .order('created_at', { ascending: false })
      .limit(300);
    if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00`);
    if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((ride: any) => ({ ...ride, driver: ride.driver ? { id: ride.driver.id, name: ride.driver.profiles?.name ?? 'Motorista', phone: ride.driver.profiles?.phone } : null })).filter((ride: any) => !filters.search || `${ride.id} ${ride.pickup_address} ${ride.destination_address} ${ride.client?.name} ${ride.driver?.name}`.toLowerCase().includes(filters.search.toLowerCase()));
  },

  async rideDetail(rideId: string) {
    return rpcOrFallback<Record<string, unknown>>('admin_get_ride_detail_rpc', { p_ride_id: rideId }, async () => {
      const [ride, locations, events, cancellations, incidents] = await Promise.all([
        supabase.from('rides').select('*, client:profiles!rides_client_id_fkey(*), driver:drivers!rides_driver_id_fkey(*, profiles!drivers_user_id_fkey(*)), vehicle:vehicles(*)').eq('id', rideId).single(),
        supabase.from('ride_locations').select('*').eq('ride_id', rideId).order('created_at', { ascending: true }).limit(1000),
        supabase.from('ride_status_events').select('*').eq('ride_id', rideId).order('created_at', { ascending: true }),
        supabase.from('ride_cancellations').select('*').eq('ride_id', rideId),
        supabase.from('safety_incidents').select('*').eq('ride_id', rideId),
      ]);
      if (ride.error) throw ride.error;
      return { ride: ride.data, locations: locations.data ?? [], events: events.data ?? [], cancellations: cancellations.data ?? [], incidents: incidents.data ?? [] };
    });
  },

  async activeOperation() {
    const [drivers, rides] = await Promise.all([
      supabase.from('driver_public_locations').select('*').eq('is_online', true).order('last_location_at', { ascending: false }),
      supabase.from('rides').select('*, client:profiles!rides_client_id_fkey(name), driver:drivers!rides_driver_id_fkey(id, profiles!drivers_user_id_fkey(name))').in('status', ['accepted', 'driver_arriving', 'driver_arrived', 'in_progress']).order('created_at', { ascending: false }),
    ]);
    if (drivers.error) throw drivers.error;
    if (rides.error) throw rides.error;
    return { drivers: drivers.data ?? [], rides: rides.data ?? [] };
  },

  async cancelRide(rideId: string, reason: string) {
    const { data, error } = await supabase.functions.invoke('cancel_ride', { body: { ride_id: rideId, reason } });
    if (error || data?.error) throw error ?? new Error(data.error);
    return data?.data;
  },

  async finance(from?: string, to?: string) {
    const [rides, transactionResult, walletResult, topupResult] = await Promise.all([
      adminService.rides({ status: 'completed', from, to }),
      (() => {
        let query = supabase
          .from('payment_transactions')
          .select('*, ride_requests(id,client_id,pickup_address,destination_address,client:profiles!ride_requests_client_id_fkey(name)), rides(id,client_id,driver_id,pickup_address,destination_address,client:profiles!rides_client_id_fkey(name),driver:drivers!rides_driver_id_fkey(profiles!drivers_user_id_fkey(name)))')
          .order('created_at', { ascending: false })
          .limit(500);
        if (from) query = query.gte('created_at', `${from}T00:00:00`);
        if (to) query = query.lte('created_at', `${to}T23:59:59`);
        return query;
      })(),
      supabase
        .from('driver_wallets')
        .select('*, driver:drivers!driver_wallets_driver_id_fkey(id,user_id,approval_status,profiles!drivers_user_id_fkey(name,phone))')
        .order('balance', { ascending: true })
        .limit(500),
      (() => {
        let query = supabase
          .from('driver_wallet_topups')
          .select('*, driver:drivers!driver_wallet_topups_driver_id_fkey(id,profiles!drivers_user_id_fkey(name))')
          .order('created_at', { ascending: false })
          .limit(300);
        if (from) query = query.gte('created_at', `${from}T00:00:00`);
        if (to) query = query.lte('created_at', `${to}T23:59:59`);
        return query;
      })(),
    ]);
    if (transactionResult.error) throw transactionResult.error;
    if (walletResult.error) throw walletResult.error;
    if (topupResult.error) throw topupResult.error;
    const transactions = (transactionResult.data ?? []).map((transaction: any) => ({
      ...transaction,
      client_name: transaction.rides?.client?.name ?? transaction.ride_requests?.client?.name ?? '—',
      driver_name: transaction.rides?.driver?.profiles?.name ?? '—',
    }));
    const gmv = rides.reduce((sum, ride) => sum + Number(ride.final_price ?? 0), 0);
    const fees = rides.reduce((sum, ride) => sum + Number(ride.platform_fee ?? 0), 0);
    const driverEarnings = rides.reduce((sum, ride) => sum + Number(ride.driver_earning ?? 0), 0);
    const paid = transactions
      .filter((item: any) => ['approved', 'partially_refunded'].includes(item.status))
      .reduce((sum: number, item: any) => sum + Number(item.amount ?? 0) - Number(item.refunded_amount ?? 0), 0);
    const refunded = transactions.reduce(
      (sum: number, item: any) => sum + Number(item.refunded_amount ?? (item.status === 'refunded' ? item.amount : 0)),
      0,
    );
    const wallets = (walletResult.data ?? []).map((wallet: any) => ({
      ...wallet,
      driver_name: wallet.driver?.profiles?.name ?? 'Motorista',
      driver_phone: wallet.driver?.profiles?.phone ?? '—',
      debt_balance: Math.max(0, -Number(wallet.balance ?? 0)),
      credit_balance: Math.max(0, Number(wallet.balance ?? 0)),
    }));
    const walletTopups = (topupResult.data ?? []).map((topup: any) => ({
      ...topup,
      driver_name: topup.driver?.profiles?.name ?? 'Motorista',
    }));
    const walletDebt = wallets.reduce((sum: number, item: any) => sum + Number(item.debt_balance ?? 0), 0);
    const walletCredit = wallets.reduce((sum: number, item: any) => sum + Number(item.credit_balance ?? 0), 0);
    const topupsPaid = walletTopups.filter((item: any) => item.status === 'paid')
      .reduce((sum: number, item: any) => sum + Number(item.amount ?? 0), 0);
    return {
      rides, transactions, wallets, walletTopups, gmv, fees, driverEarnings, paid,
      pending: Math.max(0, gmv - paid), refunded, walletDebt, walletCredit, topupsPaid,
      blockedWallets: wallets.filter((item: any) => item.status === 'blocked').length,
      recoveryWallets: wallets.filter((item: any) => item.status === 'recovery_only').length,
    };
  },

  async financialIntegrity(limit = 100) {
    const { data, error } = await supabase.rpc('admin_financial_integrity_report_rpc', { p_limit: limit });
    if (!error) return data ?? { summary: {}, issues: [] };
    if (error.code !== 'PGRST202' && !String(error.message).includes('Could not find the function')) throw error;
    const fallback = await supabase.functions.invoke('financial_reconciliation', {
      body: { action: 'preview', limit },
    });
    if (fallback.error) throw fallback.error;
    const envelope = fallback.data && typeof fallback.data === 'object' ? fallback.data as Record<string, any> : {};
    if (envelope.error) throw new Error(readableServiceError(envelope.error, 'Falha ao gerar diagnóstico financeiro.'));
    return envelope.data?.report ?? envelope.report ?? { summary: {}, issues: [] };
  },

  async reconcileFinancial(limit = 25) {
    const { data, error } = await supabase.functions.invoke('financial_reconciliation', {
      body: { action: 'run', limit },
    });
    if (error) throw error;
    const envelope = data && typeof data === 'object' ? data as Record<string, any> : {};
    if (envelope.error) throw new Error(readableServiceError(envelope.error, 'Falha ao conciliar pagamentos.'));
    return envelope.data ?? envelope;
  },

  async adjustDriverWallet(driverId: string, amount: number, reason: string) {
    const { data, error } = await supabase.rpc('admin_adjust_driver_wallet_rpc', {
      p_driver_id: driverId,
      p_amount: amount,
      p_reason: reason,
    });
    if (error) throw error;
    return data;
  },

  async refundPayment(transactionId: string) {
    const { data, error } = await supabase.functions.invoke('refund_payment', {
      body: { transaction_id: transactionId },
    });
    if (error || data?.error) throw error ?? new Error(data.error);
    return data?.data;
  },

  async supportTickets(status = 'all') {
    let query = supabase.from('support_tickets').select('*, profiles(name,phone,role)').order('created_at', { ascending: false }).limit(200);
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  async updateTicket(ticketId: string, status: string, resolution?: string) {
    return rpcOrFallback('admin_update_ticket_rpc', { p_ticket_id: ticketId, p_status: status, p_resolution: resolution ?? null }, async () => {
      const { data, error } = await supabase.from('support_tickets').update({ status }).eq('id', ticketId).select().single();
      if (error) throw error;
      return data;
    });
  },

  async ratings() {
    const { data, error } = await supabase
      .from('ratings')
      .select('*, from_profile:profiles!ratings_from_user_id_fkey(name), to_profile:profiles!ratings_to_user_id_fkey(name), rides(pickup_address,destination_address,final_price)')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      const fallback = await supabase.from('ratings').select('*').order('created_at', { ascending: false }).limit(300);
      if (fallback.error) throw fallback.error;
      return fallback.data ?? [];
    }
    return data ?? [];
  },

  async safetyOverview() {
    const { data, error } = await supabase.rpc('admin_safety_overview_rpc');
    if (error) throw error;
    return data ?? { incidents: [], cancellations: [] };
  },

  async resolveSafetyIncident(id: string, status: 'reviewing' | 'resolved' | 'dismissed', note?: string) {
    const { data, error } = await supabase.rpc('admin_resolve_safety_incident_rpc', { p_incident_id: id, p_status: status, p_note: note ?? null });
    if (error) throw error;
    return data;
  },

  async categories() {
    const { data, error } = await supabase
      .from('vehicle_categories')
      .select('*')
      .neq('code', 'x_black')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async fareCategories() {
    const { data, error } = await supabase.from('fare_category_settings').select('*, vehicle_categories(*)').order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async upsertFare(payload: Record<string, unknown>) {
    const { vehicle_categories: _category, created_at: _createdAt, ...cleanPayload } = payload;
    const { data, error } = await supabase
      .from('fare_category_settings')
      .upsert(cleanPayload, { onConflict: 'category_code' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async platformSettings() {
    const { data, error } = await supabase.from('platform_operation_settings').select('*').eq('id', 1).maybeSingle();
    if (error) throw error;
    return data;
  },

  async asaasHealth() {
    const { data, error } = await supabase.functions.invoke('asaas_gateway_admin', { body: { action: 'health' } });
    if (error) throw error;
    const envelope = data && typeof data === 'object' ? data as Record<string, any> : {};
    if (envelope.error) throw new Error(readableServiceError(envelope.error, 'Falha ao validar o Asaas.'));
    return envelope.data ?? envelope;
  },

  async savePlatformSettings(payload: Record<string, unknown>) {
    const usesAsaas = payload.asaas_pix_enabled === true || payload.asaas_payout_enabled === true ||
      payload.pix_online_provider === 'asaas' || payload.driver_wallet_pix_provider === 'asaas';
    if (usesAsaas) {
      const health = await this.asaasHealth();
      if (!health.ready) throw new Error(health.message || 'Asaas não está configurado no backend.');
      if (!health.webhook_ready) throw new Error(health.webhook_message || 'Configure ASAAS_WEBHOOK_TOKEN e publique asaas_webhook antes de ativar o Asaas.');
    }
    const { data, error } = await supabase.from('platform_operation_settings').upsert({ id: 1, ...payload }).select().single();
    if (error) throw error;
    return data;
  },

  async pushOverview() {
    const [tokens, logs] = await Promise.all([
      supabase.from('push_device_tokens').select('user_id,app_type,platform,active,last_seen_at').eq('active', true).order('last_seen_at', { ascending: false }).limit(500),
      supabase.from('push_notification_logs').select('id,user_id,app_type,event_type,title,status,error_message,sent_at,created_at').order('created_at', { ascending: false }).limit(100),
    ]);
    if (tokens.error) throw tokens.error;
    if (logs.error) throw logs.error;
    return { tokens: tokens.data ?? [], logs: logs.data ?? [] };
  },

  async regions() {
    const { data, error } = await supabase.from('service_regions').select('*').order('name');
    if (error) throw error;
    return data ?? [];
  },

  async regionCategories() {
    const { data, error } = await supabase.from('service_region_categories').select('*').order('category_code');
    if (error) throw error;
    return data ?? [];
  },

  async upsertRegion(payload: Record<string, unknown>, categories: Record<string, unknown>[]) {
    const { data, error } = await supabase.rpc('admin_upsert_service_region_rpc', {
      p_region: payload,
      p_categories: categories,
    });
    if (error) throw error;
    return data;
  },

  async deleteRegion(regionId: string) {
    const { data, error } = await supabase.rpc('admin_delete_service_region_rpc', { p_region_id: regionId });
    if (error) throw error;
    return data as boolean;
  },

  async auditLogs() {
    const { data, error } = await supabase.from('admin_logs').select('*, profiles:admin_id(name)').order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    return data ?? [];
  },

  subscribeOperation(onChange: () => void) {
    return supabase.channel('admin-operation-v8')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_public_locations' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_locations' }, onChange)
      .subscribe();
  },

  subscribeDashboard(onChange: () => void) {
    return supabase.channel('admin-dashboard-v8')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ride_requests' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'safety_incidents' }, onChange)
      .subscribe();
  },
};
