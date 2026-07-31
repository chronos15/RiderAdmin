import { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { adminService } from '../../services/adminService';

export function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);

  async function load() {
    setTickets(await adminService.supportTickets());
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Suporte e chamados</h2>
          <p>Pedidos de ajuda abertos por clientes e motoristas.</p>
        </div>
        <StatusBadge label={`${tickets.filter((ticket) => ticket.status === 'open').length} abertos`} status="pending" />
      </div>
      <DataTable
        columns={['Status', 'Assunto', 'Categoria', 'Prioridade']}
        rows={tickets.map((ticket) => [
          ticket.status ?? 'open',
          ticket.subject ?? '-',
          ticket.category ?? 'general',
          ticket.priority ?? 'normal',
        ])}
      />
    </section>
  );
}
