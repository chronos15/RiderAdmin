import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { BadgeDollarSign, Banknote, CalendarDays, Download, HandCoins, RotateCcw, ShieldAlert, Wallet, WalletCards } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Badge, dateTime, EmptyState, humanize, LoadingState, money, PageHeader, Section, StatCard } from '../../components/Ui';

export function FinancePage() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));
  const [status, setStatus] = useState('all');
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try { setData(await adminService.finance(from, to)); }
    catch (exception) { setError(exception instanceof Error ? exception.message : String(exception)); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [from, to]);

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    (data?.rides ?? []).forEach((ride: any) => {
      const day = String(ride.finished_at ?? ride.created_at).slice(5,10).split('-').reverse().join('/');
      map.set(day, (map.get(day) ?? 0) + Number(ride.final_price ?? 0));
    });
    const rows = Array.from(map.entries()).slice(-14);
    const max = Math.max(1, ...rows.map(([, value]) => value));
    return rows.map(([day, value]) => ({ day, value, height: Math.max(8, (value / max) * 100) }));
  }, [data]);

  const transactions = useMemo(
    () => (data?.transactions ?? []).filter((item: any) => status === 'all' || item.status === status),
    [data, status],
  );

  function exportCsv() {
    const rows: Array<Array<string | number>> = [
      ['Data','Transação','Corrida','Cliente','Motorista','Método','Momento','Canal','Confirmação','Status','Valor','Referência'],
      ...transactions.map((item: any) => [
        dateTime(item.created_at), item.id, item.ride_id, item.client_name,
        item.driver_name, humanize(item.method), item.payment_timing === 'prepaid' ? 'Pré' : 'Pós',
        item.payment_channel === 'physical' ? 'Físico' : 'Online',
        humanize(item.confirmation_source ?? 'gateway'), humanize(item.status),
        item.amount ?? 0, item.provider_payment_id ?? '',
      ]),
    ];
    const blob = new Blob([rows.map((row) => row.map((value) => `"${String(value).replaceAll('"','""')}"`).join(';')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pagamentos_${from}_${to}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function refund(transaction: any) {
    if (!window.confirm(`Estornar ${money(transaction.amount)} desta corrida?`)) return;
    setRefundingId(transaction.id);
    setError('');
    try {
      await adminService.refundPayment(transaction.id);
      await load();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception));
    } finally {
      setRefundingId(null);
    }
  }

  async function adjustWallet(wallet: any) {
    const amountText = window.prompt(
      'Valor do ajuste. Positivo reduz a dívida ou concede crédito; negativo aumenta a dívida:',
      '0,00',
    );
    if (amountText == null) return;
    const amount = Number(amountText.replace('.', '').replace(',', '.'));
    if (!Number.isFinite(amount) || amount === 0) {
      setError('Informe um valor de ajuste diferente de zero.');
      return;
    }
    const reason = window.prompt('Justificativa obrigatória do ajuste:', 'Ajuste de conciliação');
    if (!reason || reason.trim().length < 5) return;
    if (!window.confirm(`Confirmar ajuste de ${money(amount)} para ${wallet.driver_name}?`)) return;
    setAdjustingId(wallet.driver_id);
    setError('');
    try {
      await adminService.adjustDriverWallet(wallet.driver_id, amount, reason.trim());
      await load();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception));
    } finally {
      setAdjustingId(null);
    }
  }

  return <>
    <PageHeader
      title="Financeiro"
      description="Pagamentos reais, conciliação, repasses e estornos das corridas."
      actions={<>
        <label className="date-filter compact"><CalendarDays size={17}/><input type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label>
        <label className="date-filter compact"><CalendarDays size={17}/><input type="date" value={to} onChange={(event) => setTo(event.target.value)}/></label>
        <button className="button dark" onClick={exportCsv}><Download size={17}/> Exportar CSV</button>
      </>}
    />
    {error && <div className="form-error">{error}</div>}
    {loading ? <LoadingState label="Conciliando pagamentos..."/> : <>
      <div className="stats-grid finance-stats">
        <StatCard label="Volume das corridas" value={money(data?.gmv)} detail={`${data?.rides?.length ?? 0} corridas`} icon={<BadgeDollarSign size={19}/>}/>
        <StatCard label="Receita da plataforma" value={money(data?.fees)} detail="Taxas acumuladas" icon={<Banknote size={19}/>} tone="positive"/>
        <StatCard label="Ganhos dos motoristas" value={money(data?.driverEarnings)} detail="Valor destinado aos parceiros" icon={<HandCoins size={19}/>}/>
        <StatCard label="Recebido" value={money(data?.paid)} detail={`Pendente ${money(data?.pending)} · Estornado ${money(data?.refunded)}`} icon={<WalletCards size={19}/>} tone={Number(data?.pending ?? 0) > 0 ? 'warning' : 'neutral'}/>
      </div>
      <div className="stats-grid finance-stats">
        <StatCard label="Saldo devedor dos motoristas" value={money(data?.walletDebt)} detail={`${data?.blockedWallets ?? 0} bloqueados · ${data?.recoveryWallets ?? 0} em recuperação`} icon={<ShieldAlert size={19}/>} tone={Number(data?.walletDebt ?? 0) > 0 ? 'warning' : 'neutral'}/>
        <StatCard label="Regularizações recebidas" value={money(data?.topupsPaid)} detail="Pix e boletos conciliados" icon={<Wallet size={19}/>} tone="positive"/>
      </div>
      <div className="dashboard-grid">
        <Section title="GMV diário" description="Comportamento financeiro do período selecionado." className="chart-surface">
          {daily.length
            ? <div className="bar-chart finance-chart">{daily.map((item) => <div className="bar-column" key={item.day}><div className="bar-value">{money(item.value)}</div><div className="bar-track"><span style={{ height: `${item.height}%` }}/></div><small>{item.day}</small></div>)}</div>
            : <EmptyState title="Sem movimento no período" description="Nenhuma corrida concluída entre as datas selecionadas."/>}
        </Section>
        <Section title="Composição" description="Distribuição do valor das corridas.">
          <div className="donut-summary">
            <div className="donut" style={{ '--platform': `${data?.gmv ? (data.fees / data.gmv) * 100 : 0}%` } as CSSProperties}><div><strong>{data?.gmv ? ((data.fees / data.gmv) * 100).toFixed(1) : '0'}%</strong><span>taxa média</span></div></div>
            <div className="legend-list"><div><i className="legend-platform"/><span>Plataforma</span><strong>{money(data?.fees)}</strong></div><div><i className="legend-driver"/><span>Motoristas</span><strong>{money(data?.driverEarnings)}</strong></div></div>
          </div>
        </Section>
      </div>
      <Section
        title="Carteiras dos motoristas"
        description="Saldo negativo representa taxas da plataforma ainda não compensadas. Ajustes administrativos ficam registrados no razão."
      >
        {(data?.wallets ?? []).length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Motorista</th><th>Status</th><th>Saldo</th><th>Taxas físicas</th><th>Recuperado digital</th><th>Ações</th></tr></thead><tbody>
          {(data.wallets ?? []).map((item: any) => <tr key={item.id}>
            <td><strong>{item.driver_name}</strong><span className="table-sub">{item.driver_phone}</span></td>
            <td><Badge status={item.status}/>{item.recovery_mode_enabled && <span className="table-sub">Recuperação digital ativada</span>}</td>
            <td>{Number(item.debt_balance ?? 0) > 0 ? <strong>{money(item.debt_balance)} devedor</strong> : money(item.credit_balance)}</td>
            <td>{money(item.total_platform_fees)}</td>
            <td>{money(item.total_recovered_from_digital)}</td>
            <td><button className="button compact secondary" disabled={adjustingId === item.driver_id} onClick={() => adjustWallet(item)}>{adjustingId === item.driver_id ? 'Ajustando...' : 'Ajustar saldo'}</button></td>
          </tr>)}
        </tbody></table></div> : <EmptyState title="Nenhuma carteira" description="As carteiras são criadas automaticamente para os motoristas após a migration 040."/>}
      </Section>
      <Section title="Regularizações por Pix e boleto" description="Pagamentos criados pelos motoristas e conciliados automaticamente pela Stripe.">
        {(data?.walletTopups ?? []).length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Motorista</th><th>Método</th><th>Status</th><th>Valor</th><th>Referência</th></tr></thead><tbody>
          {(data.walletTopups ?? []).map((item: any) => <tr key={item.id}>
            <td>{dateTime(item.created_at)}</td><td><strong>{item.driver_name}</strong></td><td>{humanize(item.method)}</td><td><Badge status={item.status}/>{item.status_detail && <span className="table-sub">{item.status_detail}</span>}</td><td>{money(item.amount)}</td><td>{item.stripe_payment_intent_id ?? item.stripe_checkout_session_id ?? '—'}</td>
          </tr>)}
        </tbody></table></div> : <EmptyState title="Nenhuma regularização" description="Pix e boletos criados no aplicativo do motorista aparecerão aqui."/>}
      </Section>
      <Section
        title="Transações"
        description="Retorno conciliado do provedor e pagamentos em dinheiro."
        actions={<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos os status</option><option value="approved">Aprovados</option><option value="pending">Pendentes</option><option value="in_process">Em análise</option><option value="refund_pending">Estorno pendente</option><option value="partially_refunded">Estorno parcial</option><option value="rejected">Recusados</option><option value="refunded">Estornados</option><option value="charged_back">Contestados</option></select>}
      >
        {transactions.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Cliente / Motorista</th><th>Método</th><th>Status</th><th>Valor</th><th>Referência</th><th>Ações</th></tr></thead><tbody>
          {transactions.map((item: any) => <tr key={item.id}>
            <td>{dateTime(item.created_at)}<span className="table-sub">{String(item.ride_id ?? item.ride_request_id ?? '').slice(0,8)}</span></td>
            <td><strong>{item.client_name}</strong><span className="table-sub">{item.driver_name}</span></td>
            <td>
              {humanize(item.method)}
              <span className="table-sub">
                {item.payment_timing === 'prepaid' ? 'Pré' : 'Pós'} · {item.payment_channel === 'physical' ? 'Físico' : 'Online'}
              </span>
              <span className="table-sub">
                {item.confirmation_source === 'driver' ? 'Confirmado pelo motorista' : item.provider === 'stripe' ? 'Stripe' : humanize(item.provider)}
              </span>
            </td>
            <td><Badge status={item.status}/>{item.status_detail && <span className="table-sub">{item.status_detail}</span>}</td>
            <td>{money(item.amount)}{Number(item.refunded_amount ?? 0) > 0 && <span className="table-sub">Estornado {money(item.refunded_amount)} · retido {money(item.retained_amount)}</span>}</td>
            <td>{item.provider_payment_id ?? item.provider_preference_id ?? '—'}</td>
            <td>{['approved', 'partially_refunded'].includes(item.status) && item.provider === 'stripe'
              ? <button className="button compact secondary" disabled={refundingId === item.id} onClick={() => refund(item)}><RotateCcw size={14}/>{refundingId === item.id ? 'Estornando...' : 'Estornar'}</button>
              : '—'}</td>
          </tr>)}
        </tbody></table></div> : <EmptyState title="Nenhuma transação" description="Os pagamentos do período aparecerão nesta lista."/>}
      </Section>
    </>}
  </>;
}
