import { useEffect, useMemo, useState } from 'react';
import { Activity, BadgeDollarSign, CarFront, Headphones, ShieldAlert, Star, UserRoundCheck, UsersRound } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { supabase } from '../../services/supabaseService';
import { Badge, dateTime, EmptyState, LoadingState, money, PageHeader, Section, StatCard } from '../../components/Ui';

export function AdminDashboard({ onNavigate }: { onNavigate: (view: any) => void }) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  const [rides, setRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [dashboard, recentRides] = await Promise.all([adminService.dashboard(), adminService.rides({})]);
      setData(dashboard);
      setRides(recentRides.slice(0, 8));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const channel = adminService.subscribeDashboard(load);
    return () => { supabase.removeChannel(channel); };
  }, []);

  const hourly = useMemo(() => {
    const values = Array.from({ length: 12 }, (_, index) => ({ hour: `${index + 8}h`, count: 0 }));
    rides.forEach((ride) => {
      const hour = new Date(ride.created_at).getHours();
      const item = values.find((entry) => Number(entry.hour.replace('h', '')) === hour);
      if (item) item.count += 1;
    });
    const max = Math.max(1, ...values.map((item) => item.count));
    return values.map((item) => ({ ...item, height: Math.max(8, (item.count / max) * 100) }));
  }, [rides]);

  if (loading) return <LoadingState label="Montando visão operacional..."/>;

  return <>
    <PageHeader title="Visão geral" description="Acompanhe os indicadores mais importantes da operação em tempo real." actions={<button className="button dark" onClick={() => onNavigate('operation')}>Abrir operação ao vivo</button>}/>
    <div className="stats-grid">
      <StatCard label="Corridas hoje" value={data?.rides_today ?? 0} detail={`${data?.completed_today ?? 0} concluídas`} icon={<Activity size={19}/>} />
      <StatCard label="GMV hoje" value={money(data?.gmv_today)} detail={`Taxa ${money(data?.platform_fee_today)}`} icon={<BadgeDollarSign size={19}/>} tone="positive" />
      <StatCard label="Motoristas online" value={data?.online_drivers ?? 0} detail={`${data?.pending_drivers ?? 0} aguardando análise`} icon={<CarFront size={19}/>} />
      <StatCard label="Clientes ativos" value={data?.active_clients ?? 0} detail={`${data?.clients ?? 0} cadastrados`} icon={<UsersRound size={19}/>} />
      <StatCard label="Chamados abertos" value={data?.open_tickets ?? 0} detail="Central de atendimento" icon={<Headphones size={19}/>} tone={(data?.open_tickets ?? 0) > 0 ? 'warning' : 'neutral'} />
      <StatCard label="Incidentes ativos" value={data?.open_incidents ?? 0} detail="Segurança operacional" icon={<ShieldAlert size={19}/>} tone={(data?.open_incidents ?? 0) > 0 ? 'danger' : 'neutral'} />
      <StatCard label="Motoristas" value={data?.drivers ?? 0} detail="Base operacional" icon={<UserRoundCheck size={19}/>} />
      <StatCard label="Avaliação média" value={Number(data?.avg_rating ?? 0).toFixed(1)} detail="Qualidade da plataforma" icon={<Star size={19}/>} />
    </div>

    <div className="dashboard-grid">
      <Section title="Movimento por horário" description="Distribuição das corridas recentes ao longo do dia." className="chart-surface">
        <div className="bar-chart" aria-label="Corridas por horário">{hourly.map((item) => <div className="bar-column" key={item.hour}><div className="bar-value">{item.count}</div><div className="bar-track"><span style={{ height: `${item.height}%` }}/></div><small>{item.hour}</small></div>)}</div>
      </Section>
      <Section title="Saúde da operação" description="Leitura rápida da capacidade atual.">
        <div className="health-list">
          <HealthItem label="Motoristas disponíveis" value={data?.online_drivers ?? 0} target={Math.max(10, Number(data?.active_rides ?? 0) * 2)} />
          <HealthItem label="Corridas ativas" value={data?.active_rides ?? 0} target={Math.max(10, Number(data?.online_drivers ?? 0))} />
          <HealthItem label="Taxa de conclusão" value={data?.rides_today ? Math.round(((data?.completed_today ?? 0) / data.rides_today) * 100) : 0} target={100} suffix="%" />
          <HealthItem label="Cancelamentos" value={data?.cancelled_today ?? 0} target={Math.max(1, Number(data?.rides_today ?? 1))} />
        </div>
      </Section>
    </div>

    <Section title="Corridas recentes" description="Últimas movimentações registradas no sistema." actions={<button className="button ghost" onClick={() => onNavigate('rides')}>Ver todas</button>}>
      {rides.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Cliente</th><th>Motorista</th><th>Trajeto</th><th>Status</th><th>Valor</th></tr></thead><tbody>{rides.map((ride) => <tr key={ride.id}><td>{dateTime(ride.created_at)}</td><td>{ride.client?.name ?? '—'}</td><td>{ride.driver?.name ?? '—'}</td><td><div className="route-cell"><strong>{ride.pickup_address ?? 'Origem'}</strong><span>{ride.destination_address ?? 'Destino'}</span></div></td><td><Badge status={ride.status}/></td><td>{money(ride.final_price ?? ride.estimated_price)}</td></tr>)}</tbody></table></div> : <EmptyState title="Nenhuma corrida registrada" description="As novas corridas aparecerão aqui automaticamente."/>}
    </Section>
  </>;
}

function HealthItem({ label, value, target, suffix = '' }: { label: string; value: number; target: number; suffix?: string }) {
  const percent = Math.min(100, target ? (value / target) * 100 : 0);
  return <div className="health-item"><div><span>{label}</span><strong>{value}{suffix}</strong></div><div className="progress"><span style={{ width: `${percent}%` }}/></div></div>;
}
