import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { money } from './Ui';

type TooltipItem = {
  name?: string;
  value?: number | string;
  payload?: Record<string, unknown>;
  color?: string;
};

type TooltipContentProps = {
  active?: boolean;
  label?: string | number;
  payload?: readonly TooltipItem[];
  valueFormatter?: (value: number) => string;
};

function ChartTooltip({ active, label, payload, valueFormatter = (value) => String(value) }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  return <div className="admin-chart-tooltip">
    {label != null && <strong>{label}</strong>}
    <div>
      {payload.map((item, index) => {
        const numeric = Number(item.value ?? 0);
        return <span key={`${item.name ?? 'serie'}-${index}`}>
          <i style={{ background: item.color ?? 'var(--chart-primary)' }}/>
          <em>{item.name ?? 'Valor'}</em>
          <b>{valueFormatter(Number.isFinite(numeric) ? numeric : 0)}</b>
        </span>;
      })}
    </div>
  </div>;
}

export function HourlyRidesChart({ data }: { data: Array<{ hour: string; count: number }> }) {
  return <div className="admin-chart admin-chart-large" aria-label="Gráfico interativo de corridas por horário">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" vertical={false}/>
        <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }}/>
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }}/>
        <Tooltip content={<ChartTooltip valueFormatter={(value) => `${Math.round(value)} corrida${Math.round(value) === 1 ? '' : 's'}`}/>} cursor={{ fill: 'var(--chart-hover)' }}/>
        <Bar dataKey="count" name="Corridas" fill="var(--chart-primary)" radius={[9, 9, 3, 3]} maxBarSize={46} activeBar={{ fill: 'var(--chart-secondary)' }}/>
      </BarChart>
    </ResponsiveContainer>
  </div>;
}

export function DailyGmvChart({ data }: { data: Array<{ day: string; value: number }> }) {
  return <div className="admin-chart admin-chart-large" aria-label="Gráfico interativo de GMV diário">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 10, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id="gmvGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.36}/>
            <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0.02}/>
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="4 5" vertical={false}/>
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }}/>
        <YAxis tickLine={false} axisLine={false} width={64} tick={{ fill: 'var(--muted)', fontSize: 11 }} tickFormatter={(value: number) => compactMoney(value)}/>
        <Tooltip content={<ChartTooltip valueFormatter={money}/>} cursor={{ stroke: 'var(--chart-primary)', strokeDasharray: '4 4' }}/>
        <Area type="monotone" dataKey="value" name="GMV" stroke="var(--chart-primary)" strokeWidth={3} fill="url(#gmvGradient)" activeDot={{ r: 6, strokeWidth: 3, fill: 'var(--surface)', stroke: 'var(--chart-primary)' }}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

export function RevenueCompositionChart({ platform, drivers }: { platform: number; drivers: number }) {
  const total = Math.max(0, platform) + Math.max(0, drivers);
  const platformShare = total > 0 ? (Math.max(0, platform) / total) * 100 : 0;
  const data = [
    { name: 'Plataforma', value: Math.max(0, platform), fill: 'var(--chart-primary)' },
    { name: 'Motoristas', value: Math.max(0, drivers), fill: 'var(--chart-secondary)' },
  ];

  return <div className="composition-chart-layout">
    <div className="admin-chart composition-chart" aria-label="Gráfico interativo de composição da receita">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip content={<ChartTooltip valueFormatter={money}/>}/>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="88%" paddingAngle={3} cornerRadius={8} stroke="var(--surface)" strokeWidth={4}>
            {data.map((item) => <Cell key={item.name} fill={item.fill}/>) }
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="chart-center-label"><strong>{platformShare.toFixed(1)}%</strong><span>taxa média</span></div>
    </div>
    <div className="chart-legend-list">
      {data.map((item) => <div key={item.name}><i style={{ background: item.fill }}/><span>{item.name}</span><strong>{money(item.value)}</strong></div>)}
    </div>
  </div>;
}

function compactMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    notation: 'compact',
    compactDisplay: 'short',
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 1,
  }).format(Number(value ?? 0));
}
