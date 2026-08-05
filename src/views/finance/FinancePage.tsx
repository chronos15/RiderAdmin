import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, BadgeDollarSign, Banknote, CalendarDays, CheckCircle2,
  Download, HandCoins, RefreshCw, RotateCcw, ShieldAlert, Wallet, WalletCards,
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Badge, dateTime, EmptyState, humanize, LoadingState, money, PageHeader, Section, StatCard } from '../../components/Ui';
import { DailyGmvChart, RevenueCompositionChart } from '../../components/AdminCharts';

export function FinancePage() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0,10));
  const [status, setStatus] = useState('all');
  const [data, setData] = useState<any | null>(null);
  const [integrity, setIntegrity] = useState<any>({ summary: {}, issues: [] });
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [finance, report] = await Promise.all([
        adminService.finance(from, to),
        adminService.financialIntegrity(100).catch((exception) => ({
          summary: {}, issues: [],
          warning: exception instanceof Error ? exception.message : String(exception),
        })),
      ]);
      setData(finance);
      setIntegrity(report ?? { summary: {}, issues: [] });
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, [from, to]);

  const daily = useMemo(() => {
    const map = new Map<string, number>();
    (data?.rides ?? []).forEach((ride: any) => {
      const day = String(ride.finished_at ?? ride.created_at).slice(5,10).split('-').reverse().join('/');
      map.set(day, (map.get(day) ?? 0) + Number(ride.final_price ?? 0));
    });
    const rows = Array.from(map.entries()).slice(-14);
    return rows.map(([day, value]) => ({ day, value }));
  }, [data]);

  const transactions = useMemo(
    () => (data?.transactions ?? []).filter((item: any) => status === 'all' || item.status === status),
    [data, status],
  );
  const integritySummary = integrity?.summary ?? {};
  const integrityProblems = Object.values(integritySummary).reduce((sum: number, value) => sum + Number(value ?? 0), 0);

  function exportCsv() {
    const rows: Array<Array<string | number>> = [
      ['Data','Transação','Corrida','Cliente','Motorista','Gateway','Método','Momento','Canal','Status local','Status gateway','Valor','Referência externa'],
      ...transactions.map((item: any) => [
        dateTime(item.created_at), item.id, item.ride_id ?? item.ride_request_id ?? '', item.client_name,
        item.driver_name, item.provider ?? '', humanize(item.method), item.payment_timing === 'prepaid' ? 'Pré' : 'Pós',
        item.payment_channel === 'physical' ? 'Físico' : 'Online', humanize(item.status),
        item.provider_status ?? item.status_detail ?? '', item.amount ?? 0,
        item.provider_external_reference ?? item.external_reference ?? item.provider_payment_id ?? '',
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

  async function reconcile() {
    setReconciling(true);
    setError('');
    setSuccess('');
    try {
      const result = await adminService.reconcileFinancial(40);
      const summary = result?.summary ?? {};
      setSuccess(`Conciliação concluída: ${summary.succeeded ?? 0} item(ns) corrigido(s) e ${summary.failed ?? 0} pendência(s) mantida(s) para nova tentativa.`);
      await load();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception));
    } finally {
      setReconciling(false);
    }
  }

  async function refund(transaction: any) {
    if (!window.confirm(`Estornar ${money(transaction.amount)} via ${humanize(transaction.provider)}?`)) return;
    setRefundingId(transaction.id);
    setError('');
    setSuccess('');
    try {
      await adminService.refundPayment(transaction.id);
      setSuccess('Solicitação de estorno enviada. A conciliação acompanhará a confirmação do gateway.');
      await load();
    } catch (exception) {
      setError(exception instanceof Error ? exception.message : String(exception));
    } finally {
      setRefundingId(null);
    }
  }

  async function adjustWallet(wallet: any) {
    const amountText = window.prompt('Valor do ajuste. Positivo reduz a dívida ou concede crédito; negativo aumenta a dívida:', '0,00');
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
      description="Pagamentos, conciliação multigateway, carteira, repasses e estornos."
      actions={<>
        <label className="date-filter compact"><CalendarDays size={17}/><input type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label>
        <label className="date-filter compact"><CalendarDays size={17}/><input type="date" value={to} onChange={(event) => setTo(event.target.value)}/></label>
        <button className="button secondary" disabled={reconciling} onClick={() => void reconcile()}><RefreshCw size={17}/>{reconciling ? 'Conciliando...' : 'Reconciliar agora'}</button>
        <button className="button dark" onClick={exportCsv}><Download size={17}/> Exportar CSV</button>
      </>}
    />
    {error && <div className="form-error">{error}</div>}
    {success && <div className="settings-notice success">{success}</div>}
    {integrity?.warning && <div className="settings-notice warning">Diagnóstico indisponível: {integrity.warning}</div>}
    {loading ? <LoadingState label="Conciliando pagamentos..."/> : <>
      <Section
        title="Integridade financeira"
        description={`Verificação gerada em ${integrity?.generated_at ? dateTime(integrity.generated_at) : 'tempo real'}. As filas internas recuperam eventos mesmo quando Asaas ou OpenPix os entregam fora de ordem.`}
        actions={<Badge status={integrityProblems > 0 ? 'pending' : 'active'} label={integrityProblems > 0 ? `${integrityProblems} ponto(s) de atenção` : 'Sem divergências detectadas'}/>}
      >
        <div className="stats-grid finance-stats">
          <StatCard label="Webhooks na fila" value={String(Number(integritySummary.webhook_queued ?? 0))} detail={`Fila morta ${Number(integritySummary.webhook_dead_letter ?? 0)}`} icon={<Activity size={19}/>} tone={Number(integritySummary.webhook_queued ?? 0) > 0 ? 'warning' : 'positive'}/>
          <StatCard label="Pagamentos divergentes" value={String(Number(integritySummary.approved_not_reflected ?? 0) + Number(integritySummary.payment_missing_provider_id ?? 0) + Number(integritySummary.payment_missing_reference ?? 0))} detail="Referência, gateway ou liberação" icon={<AlertTriangle size={19}/>} tone={Number(integritySummary.approved_not_reflected ?? 0) > 0 ? 'warning' : 'neutral'}/>
          <StatCard label="Carteiras sem razão" value={String(Number(integritySummary.topup_paid_without_ledger ?? 0) + Number(integritySummary.topup_refund_without_ledger ?? 0))} detail="Crédito ou estorno sem lançamento" icon={<Wallet size={19}/>} tone={(Number(integritySummary.topup_paid_without_ledger ?? 0) + Number(integritySummary.topup_refund_without_ledger ?? 0)) > 0 ? 'warning' : 'positive'}/>
          <StatCard label="Conciliação" value={integrityProblems > 0 ? 'Atenção' : 'Íntegra'} detail={`Erros persistidos ${Number(integritySummary.reconciliation_errors ?? 0)}`} icon={integrityProblems > 0 ? <ShieldAlert size={19}/> : <CheckCircle2 size={19}/>} tone={integrityProblems > 0 ? 'warning' : 'positive'}/>
        </div>
        {(integrity?.issues ?? []).length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Severidade</th><th>Origem</th><th>Diagnóstico</th><th>Data</th></tr></thead><tbody>
          {(integrity.issues ?? []).map((item: any, index: number) => <tr key={`${item.entity}-${item.entity_id}-${index}`}>
            <td><Badge status={item.severity === 'critical' ? 'blocked' : item.severity === 'warning' ? 'pending' : 'active'} label={humanize(item.severity)}/></td>
            <td><strong>{humanize(item.entity)}</strong><span className="table-sub">{String(item.entity_id ?? '').slice(0, 12)}</span></td>
            <td><strong>{item.title}</strong><span className="table-sub">{item.detail}</span></td>
            <td>{dateTime(item.created_at)}</td>
          </tr>)}
        </tbody></table></div> : <EmptyState title="Fluxo financeiro consistente" description="Não foram encontradas divergências entre pagamentos, webhooks, corridas, carteiras e repasses."/>}
      </Section>

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
            ? <DailyGmvChart data={daily}/>
            : <EmptyState title="Sem movimento no período" description="Nenhuma corrida concluída entre as datas selecionadas."/>}
        </Section>
        <Section title="Composição" description="Distribuição do valor das corridas.">
          <RevenueCompositionChart platform={Number(data?.fees ?? 0)} drivers={Number(data?.driverEarnings ?? 0)}/>
        </Section>
      </div>
      <Section title="Carteiras dos motoristas" description="Saldo negativo representa taxas da plataforma ainda não compensadas. Ajustes administrativos ficam registrados no razão.">
        {(data?.wallets ?? []).length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Motorista</th><th>Status</th><th>Saldo</th><th>Taxas físicas</th><th>Recuperado digital</th><th>Ações</th></tr></thead><tbody>
          {(data.wallets ?? []).map((item: any) => <tr key={item.id}>
            <td><strong>{item.driver_name}</strong><span className="table-sub">{item.driver_phone}</span></td>
            <td><Badge status={item.status}/>{item.recovery_mode_enabled && <span className="table-sub">Recuperação digital ativada</span>}</td>
            <td>{Number(item.debt_balance ?? 0) > 0 ? <strong>{money(item.debt_balance)} devedor</strong> : money(item.credit_balance)}</td>
            <td>{money(item.total_platform_fees)}</td><td>{money(item.total_recovered_from_digital)}</td>
            <td><button className="button compact secondary" disabled={adjustingId === item.driver_id} onClick={() => void adjustWallet(item)}>{adjustingId === item.driver_id ? 'Ajustando...' : 'Ajustar saldo'}</button></td>
          </tr>)}
        </tbody></table></div> : <EmptyState title="Nenhuma carteira" description="As carteiras são criadas automaticamente para os motoristas."/>}
      </Section>
      <Section title="Regularizações por Pix e boleto" description="Pagamentos dos motoristas conciliados automaticamente pelo gateway de origem.">
        {(data?.walletTopups ?? []).length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Motorista</th><th>Gateway / Método</th><th>Status</th><th>Valor</th><th>Referência</th></tr></thead><tbody>
          {(data.walletTopups ?? []).map((item: any) => <tr key={item.id}>
            <td>{dateTime(item.created_at)}</td><td><strong>{item.driver_name}</strong></td>
            <td><strong>{humanize(item.provider)}</strong><span className="table-sub">{humanize(item.method)}</span></td>
            <td><Badge status={item.status}/>{item.provider_status && <span className="table-sub">Gateway: {item.provider_status}</span>}{item.status_detail && <span className="table-sub">{item.status_detail}</span>}</td>
            <td>{money(item.amount)}</td><td>{item.openpix_charge_id ?? item.asaas_payment_id ?? item.stripe_payment_intent_id ?? item.stripe_checkout_session_id ?? '—'}</td>
          </tr>)}
        </tbody></table></div> : <EmptyState title="Nenhuma regularização" description="Pix e boletos criados no aplicativo do motorista aparecerão aqui."/>}
      </Section>
      <Section title="Transações" description="Estado local e retorno conciliado do provedor." actions={<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos os status</option><option value="approved">Aprovados</option><option value="pending">Pendentes</option><option value="in_process">Em análise</option><option value="refund_pending">Estorno pendente</option><option value="partially_refunded">Estorno parcial</option><option value="rejected">Recusados</option><option value="refunded">Estornados</option><option value="charged_back">Contestados</option></select>}>
        {transactions.length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>Data</th><th>Cliente / Motorista</th><th>Gateway / Método</th><th>Status</th><th>Valor</th><th>Referência</th><th>Ações</th></tr></thead><tbody>
          {transactions.map((item: any) => <tr key={item.id}>
            <td>{dateTime(item.created_at)}<span className="table-sub">{String(item.ride_id ?? item.ride_request_id ?? '').slice(0,8)}</span></td>
            <td><strong>{item.client_name}</strong><span className="table-sub">{item.driver_name}</span></td>
            <td><strong>{humanize(item.provider)}</strong><span className="table-sub">{humanize(item.method)} · {item.payment_timing === 'prepaid' ? 'Pré' : 'Pós'} · {item.payment_channel === 'physical' ? 'Físico' : 'Online'}</span></td>
            <td><Badge status={item.status}/>{item.provider_status && <span className="table-sub">Gateway: {item.provider_status}</span>}{item.status_detail && <span className="table-sub">{item.status_detail}</span>}{item.reconciliation_error && <span className="table-sub">Conciliação: {item.reconciliation_error}</span>}</td>
            <td>{money(item.amount)}{Number(item.refunded_amount ?? 0) > 0 && <span className="table-sub">Estornado {money(item.refunded_amount)} · retido {money(item.retained_amount)}</span>}</td>
            <td>{item.provider_payment_id ?? item.provider_external_reference ?? item.external_reference ?? '—'}</td>
            <td>{['approved', 'partially_refunded'].includes(item.status) && ['stripe', 'asaas', 'openpix'].includes(item.provider)
              ? <button className="button compact secondary" disabled={refundingId === item.id} onClick={() => void refund(item)}><RotateCcw size={14}/>{refundingId === item.id ? 'Estornando...' : 'Estornar'}</button>
              : '—'}</td>
          </tr>)}
        </tbody></table></div> : <EmptyState title="Nenhuma transação" description="Os pagamentos do período aparecerão nesta lista."/>}
      </Section>
    </>}
  </>;
}
