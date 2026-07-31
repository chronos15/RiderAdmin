import { DataTable } from '../../components/DataTable';

const clients = [
  { name: 'Cliente Teste 1', phone: '(62) 99999-0001', status: 'active' },
  { name: 'Cliente Teste 2', phone: '(62) 99999-0002', status: 'active' },
];

export function ClientsList() {
  return (
    <section className="card">
      <h2>Clientes</h2>
      <DataTable>
        <thead><tr><th>Nome</th><th>Telefone</th><th>Status</th></tr></thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.name}>
              <td>{client.name}</td>
              <td>{client.phone}</td>
              <td>{client.status}</td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </section>
  );
}
