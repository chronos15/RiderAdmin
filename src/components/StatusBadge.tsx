export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <span className={`badge ${status}`}>{label ?? status}</span>;
}
