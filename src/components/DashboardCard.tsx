export function DashboardCard({ title, value, hint }: { title: string; value: string | number; hint?: string }) {
  return (
    <article className="card">
      <div className="muted">{title}</div>
      <div className="metric">{value}</div>
      {hint && <small className="muted">{hint}</small>}
    </article>
  );
}
