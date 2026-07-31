import { useEffect, useState } from 'react';
import { DataTable } from '../../components/DataTable';
import { StatusBadge } from '../../components/StatusBadge';
import { adminService } from '../../services/adminService';

export function RatingsList() {
  const [ratings, setRatings] = useState<any[]>([]);

  async function load() {
    setRatings(await adminService.ratings());
  }

  useEffect(() => {
    load();
  }, []);

  const avg = ratings.length
    ? ratings.reduce((sum, item) => sum + Number(item.rating ?? 0), 0) / ratings.length
    : 0;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Avaliações</h2>
          <p>Feedbacks das corridas finalizadas.</p>
        </div>
        <StatusBadge label={avg ? `Média ${avg.toFixed(1)}` : 'Sem notas'} status="approved" />
      </div>
      <DataTable
        columns={['Nota', 'Comentário', 'Origem', 'Destino']}
        rows={ratings.map((rating) => [
          `★ ${rating.rating ?? '-'}`,
          rating.comment ?? '-',
          rating.rides?.pickup_address ?? '-',
          rating.rides?.destination_address ?? '-',
        ])}
      />
    </section>
  );
}
