import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Star } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { dateTime, EmptyState, LoadingState, PageHeader, Section, StatCard } from '../../components/Ui';

export function RatingsManagement() {
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [minimum, setMinimum] = useState(1);
  async function load() { setLoading(true); try { setRatings(await adminService.ratings()); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  const visible = ratings.filter((item) => Number(item.rating ?? 0) >= minimum);
  const avg = ratings.length ? ratings.reduce((sum, item) => sum + Number(item.rating ?? 0), 0) / ratings.length : 0;
  const distribution = useMemo(() => [5,4,3,2,1].map((score) => ({ score, count: ratings.filter((item) => Number(item.rating) === score).length })), [ratings]);
  return <>
    <PageHeader title="Avaliações" description="Qualidade das corridas e feedback de clientes e motoristas." actions={<button className="button secondary" onClick={load}><RefreshCw size={17}/> Atualizar</button>}/>
    <div className="stats-grid ratings-stats"><StatCard label="Média geral" value={avg.toFixed(1)} detail={`${ratings.length} avaliação(ões)`} icon={<Star size={19}/>} /><StatCard label="Notas 5" value={distribution[0].count} detail="Experiências excelentes" icon={<Star size={19}/>} tone="positive"/><StatCard label="Notas baixas" value={ratings.filter((item) => Number(item.rating) <= 2).length} detail="Requer acompanhamento" icon={<Star size={19}/>} tone="danger"/></div>
    <div className="dashboard-grid ratings-layout"><Section title="Distribuição" description="Quantidade de avaliações por nota."><div className="rating-distribution">{distribution.map((item) => <div key={item.score}><span>{item.score} ★</span><div className="progress"><i style={{ width: `${ratings.length ? (item.count / ratings.length) * 100 : 0}%` }}/></div><strong>{item.count}</strong></div>)}</div></Section><Section title="Filtro" description="Escolha a nota mínima exibida."><div className="rating-filter"><input type="range" min="1" max="5" value={minimum} onChange={(event) => setMinimum(Number(event.target.value))}/><strong>{minimum}+ estrelas</strong><span>{visible.length} resultado(s)</span></div></Section></div>
    <Section title="Feedbacks recentes" description="Comentários vinculados às corridas.">{loading ? <LoadingState/> : visible.length ? <div className="rating-list">{visible.map((rating) => <article key={rating.id}><div className="rating-score">{rating.rating}<Star size={15} fill="currentColor"/></div><div><strong>{rating.from_profile?.name ?? 'Usuário'}</strong><p>{rating.comment || 'Sem comentário.'}</p><small>{rating.rides?.pickup_address ?? 'Origem'} → {rating.rides?.destination_address ?? 'Destino'} · {dateTime(rating.created_at)}</small></div></article>)}</div> : <EmptyState title="Nenhuma avaliação encontrada" description="Ajuste o filtro para visualizar mais feedbacks."/>}</Section>
  </>;
}
