import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';

const drivers = [
  { name: 'Carlos Motorista', status: 'pending', car: 'Onix Preto' },
  { name: 'João Aprovado', status: 'approved', car: 'HB20 Prata' },
  { name: 'Marcos Reprovado', status: 'rejected', car: 'Corolla Branco' },
];

export function DriversList() {
  return (
    <section className="card">
      <h2>Motoristas</h2>
      <DataTable>
        <thead><tr><th>Nome</th><th>Status</th><th>Veículo</th><th>Ações</th></tr></thead>
        <tbody>
          {drivers.map((driver) => (
            <tr key={driver.name}>
              <td>{driver.name}</td>
              <td><StatusBadge status={driver.status} /></td>
              <td>{driver.car}</td>
              <td><button className="primary-btn">Detalhes</button></td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </section>
  );
}
