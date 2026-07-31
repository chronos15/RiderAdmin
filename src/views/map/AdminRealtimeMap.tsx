import { useEffect, useMemo, useState } from 'react';
import { StatusBadge } from '../../components/StatusBadge';
import { supabase } from '../../services/supabaseService';

type DriverPoint = {
  id: string;
  approval_status: string;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
  last_location_at: string | null;
};

export function AdminRealtimeMap() {
  const [drivers, setDrivers] = useState<DriverPoint[]>([]);

  async function loadDrivers() {
    const { data } = await supabase
      .from('drivers')
      .select('id, approval_status, is_online, current_lat, current_lng, last_location_at')
      .eq('is_online', true)
      .not('current_lat', 'is', null)
      .not('current_lng', 'is', null)
      .order('last_location_at', { ascending: false });

    setDrivers((data ?? []) as DriverPoint[]);
  }

  useEffect(() => {
    loadDrivers();
    const channel = supabase
      .channel('admin_driver_location_map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, loadDrivers)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const points = useMemo(() => drivers.slice(0, 12), [drivers]);

  return (
    <section className="panel ride-map-panel">
      <div className="panel-header">
        <div>
          <h2>Mapa em tempo real</h2>
          <p>Motoristas online com última posição enviada pelo app.</p>
        </div>
        <StatusBadge label={`${points.length} online`} status="approved" />
      </div>

      <div className="admin-map-placeholder admin-map-live">
        <div className="route-line" />
        {points.map((driver, index) => (
          <span
            key={driver.id}
            className="driver-dot"
            style={{
              left: `${18 + ((index * 17) % 66)}%`,
              top: `${24 + ((index * 23) % 52)}%`,
            }}
            title={`${driver.current_lat}, ${driver.current_lng}`}
          />
        ))}
        {!points.length && <span>Nenhum motorista online com GPS enviado.</span>}
      </div>
    </section>
  );
}
