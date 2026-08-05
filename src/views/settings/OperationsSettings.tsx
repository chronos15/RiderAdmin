import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BellRing, CarFront, CheckCircle2, MapPinned, Plus, RefreshCw, Save, Settings2, Trash2, WalletCards } from 'lucide-react';
import { adminService } from '../../services/adminService';
import { Badge, EmptyState, LoadingState, Modal, PageHeader, Section } from '../../components/Ui';
import { RegionMapEditor } from './RegionMapEditor';
import type { ThemeMode } from '../../types/admin';

const defaultSettings = {
  search_radius_km: 5,
  search_radius_step_km: 5,
  max_search_radius_km: 30,
  offer_timeout_seconds: 15,
  search_timeout_minutes: 5,
  location_update_seconds: 5,
  platform_fee_percent: 20,
  cancellation_fee: 5,
  cancellation_arrived_fee: 7,
  cancellation_grace_minutes: 2,
  support_phone: '',
  emergency_phone: '190',
  allow_test_mode: false,
  driver_wallet_enabled: false,
  driver_wallet_warning_limit: 60,
  driver_wallet_negative_limit: 100,
  driver_wallet_topup_min_amount: 10,
  driver_wallet_pix_enabled: true,
  driver_wallet_boleto_enabled: true,
  driver_wallet_card_enabled: true,
  driver_wallet_stripe_balance_enabled: true,
  driver_wallet_auto_recovery: true,
  pix_online_provider: '',
  driver_wallet_pix_provider: '',
  asaas_pix_enabled: false,
  asaas_payout_enabled: false,
  openpix_pix_enabled: false,
  openpix_payout_enabled: false,
};

const emptyRegion = {
  name: '', city: '', state: '', active: true, base_multiplier: 1, geojson: null,
  search_radius_km_override: null, search_radius_step_km_override: null,
  max_search_radius_km_override: null, offer_timeout_seconds_override: null,
  search_timeout_minutes_override: null, platform_fee_percent_override: null,
  cancellation_fee_override: null, cancellation_arrived_fee_override: null,
};

type SettingsTab = 'categories'|'dispatch'|'payments'|'regions'|'push';

export function OperationsSettings({ theme, initialTab = 'categories' }: { theme: ThemeMode; initialTab?: SettingsTab }) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [categories, setCategories] = useState<any[]>([]);
  const [fares, setFares] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(defaultSettings);
  const [regions, setRegions] = useState<any[]>([]);
  const [regionCategories, setRegionCategories] = useState<any[]>([]);
  const [pushOverview, setPushOverview] = useState<any>({ tokens: [], logs: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success'|'danger'; text: string } | null>(null);
  const [regionModal, setRegionModal] = useState<any | null>(null);
  const [asaasHealth, setAsaasHealth] = useState<any | null>(null);
  const [checkingAsaas, setCheckingAsaas] = useState(false);
  const [openpixHealth, setOpenpixHealth] = useState<any | null>(null);
  const [checkingOpenpix, setCheckingOpenpix] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [categoryData, fareData, settingData, regionData, regionCategoryData, pushData, healthData, openpixHealthData] = await Promise.all([
        adminService.categories(), adminService.fareCategories(), adminService.platformSettings().catch(() => null),
        adminService.regions().catch(() => []), adminService.regionCategories().catch(() => []),
        adminService.pushOverview().catch(() => ({ tokens: [], logs: [] })),
        adminService.asaasHealth().catch((error) => ({ ready: false, webhook_ready: false, message: messageOf(error) })),
        adminService.openpixHealth().catch((error) => ({ ready: false, webhook_ready: false, payout_ready: false, message: messageOf(error) })),
      ]);
      setCategories(categoryData); setFares(fareData); setSettings({ ...defaultSettings, ...(settingData ?? {}) });
      setRegions(regionData); setRegionCategories(regionCategoryData);
      setPushOverview(pushData); setAsaasHealth(healthData); setOpenpixHealth(openpixHealthData);
    } catch (error) {
      setNotice({ tone: 'danger', text: messageOf(error) });
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function fareFor(code: string) { return fares.find((item) => item.category_code === code) ?? { category_code: code, rate_multiplier: 1, minimum_multiplier: 1, base_fare: 0, price_per_km: 0, price_per_minute: 0, minimum_fare: 0, active: true }; }
  async function saveFare(code: string, patch: Record<string, unknown>) { await performSave(async () => { const current = fareFor(code); await adminService.upsertFare({ ...current, ...patch, category_code: code, vehicle_categories: undefined }); }, 'Tarifa atualizada e publicada nos apps.'); }
  async function saveSettings() { await performSave(() => adminService.savePlatformSettings(settings), 'Configurações operacionais sincronizadas.'); }
  async function saveRegion(payload: any, assignments: any[]) { if (await performSave(() => adminService.upsertRegion(payload, assignments), 'Região e categorias publicadas.')) setRegionModal(null); }
  async function deleteRegion(id: string) { if (await performSave(() => adminService.deleteRegion(id), 'Região removida ou desativada por possuir histórico.')) setRegionModal(null); }

  async function checkAsaas() {
    setCheckingAsaas(true); setNotice(null);
    try {
      const health = await adminService.asaasHealth();
      setAsaasHealth(health);
      setNotice({
        tone: health.ready && health.webhook_ready ? 'success' : 'danger',
        text: health.message || 'Validação do Asaas concluída.',
      });
    } catch (error) {
      const message = messageOf(error);
      setAsaasHealth({ ready: false, webhook_ready: false, message });
      setNotice({ tone: 'danger', text: message });
    } finally { setCheckingAsaas(false); }
  }

  async function checkOpenpix() {
    setCheckingOpenpix(true); setNotice(null);
    try {
      const health = await adminService.openpixHealth();
      setOpenpixHealth(health);
      setNotice({
        tone: health.ready && health.webhook_ready ? 'success' : 'danger',
        text: health.message || 'Validação da OpenPix concluída.',
      });
    } catch (error) {
      const message = messageOf(error);
      setOpenpixHealth({ ready: false, webhook_ready: false, payout_ready: false, message });
      setNotice({ tone: 'danger', text: message });
    } finally { setCheckingOpenpix(false); }
  }

  async function performSave(action: () => Promise<unknown>, success: string) {
    setSaving(true); setNotice(null);
    try { await action(); setNotice({ tone: 'success', text: success }); await load(); return true; }
    catch (error) { setNotice({ tone: 'danger', text: messageOf(error) }); return false; }
    finally { setSaving(false); }
  }

  return <>
    <PageHeader title={tab === 'payments' ? 'Pagamentos e gateways' : 'Operação e tarifas'} description={tab === 'payments' ? 'Escolha Stripe, Asaas ou OpenPix sem fallback e valide cada integração separadamente.' : 'Regras operacionais e áreas atendidas consumidas em tempo real pelos aplicativos.'}/>
    {notice && <div className={`settings-notice ${notice.tone}`}><AlertCircle size={18}/><span>{notice.text}</span><button onClick={() => setNotice(null)}>Fechar</button></div>}
    <div className="tabs"><button className={tab === 'categories' ? 'active' : ''} onClick={() => setTab('categories')}><CarFront size={18}/> Categorias e tarifas</button><button className={tab === 'dispatch' ? 'active' : ''} onClick={() => setTab('dispatch')}><Settings2 size={18}/> Despacho e plataforma</button><button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}><WalletCards size={18}/> Pagamentos e gateways</button><button className={tab === 'regions' ? 'active' : ''} onClick={() => setTab('regions')}><MapPinned size={18}/> Regiões atendidas</button><button className={tab === 'push' ? 'active' : ''} onClick={() => setTab('push')}><BellRing size={18}/> Push</button></div>
    {loading ? <LoadingState/> : tab === 'categories'
      ? <CategorySettings categories={categories} fareFor={fareFor} saving={saving} onSave={saveFare}/>
      : tab === 'dispatch'
        ? <DispatchSettings values={settings} onChange={setSettings} onSave={saveSettings} saving={saving}/>
        : tab === 'payments'
          ? <PaymentGatewaySettings values={settings} asaasHealth={asaasHealth} openpixHealth={openpixHealth} onChange={setSettings} onSave={saveSettings} onCheckAsaas={checkAsaas} onCheckOpenpix={checkOpenpix} saving={saving} checkingAsaas={checkingAsaas} checkingOpenpix={checkingOpenpix}/>
          : tab === 'regions'
            ? <RegionSettings regions={regions} assignments={regionCategories} onAdd={() => setRegionModal({ ...emptyRegion })} onEdit={setRegionModal}/>
            : <PushOverview value={pushOverview}/>} 
    <RegionEditor theme={theme} open={Boolean(regionModal)} value={regionModal} categories={categories} assignments={regionCategories} defaults={settings} onClose={() => setRegionModal(null)} onSave={saveRegion} onDelete={deleteRegion} saving={saving}/>
  </>;
}

function PushOverview({ value }: { value: { tokens: any[]; logs: any[] } }) {
  const tokens = value.tokens ?? [];
  const logs = value.logs ?? [];
  const sent = logs.filter((item) => item.status === 'sent').length;
  const failed = logs.filter((item) => item.status === 'failed').length;
  return <>
    <div className="stats-grid push-stats">
      <div className="stat-card"><span>Dispositivos ativos</span><strong>{tokens.length}</strong><small>{tokens.filter((item) => item.app_type === 'driver').length} motoristas · {tokens.filter((item) => item.app_type === 'client').length} clientes</small></div>
      <div className="stat-card positive"><span>Entregas recentes</span><strong>{sent}</strong><small>Últimos {logs.length} registros processados</small></div>
      <div className="stat-card danger"><span>Falhas recentes</span><strong>{failed}</strong><small>Tokens inválidos são desativados automaticamente</small></div>
    </div>
    <Section title="Últimas notificações" description="Monitoramento do envio FCM HTTP v1. Tokens completos nunca são exibidos no painel.">
      {!logs.length ? <EmptyState title="Nenhuma entrega registrada" description="Os eventos aparecerão após a primeira corrida processada com a Etapa 9."/> :
        <div className="table-wrap"><table className="data-table"><thead><tr><th>Evento</th><th>Aplicativo</th><th>Status</th><th>Quando</th></tr></thead><tbody>{logs.slice(0, 30).map((item) => <tr key={item.id}><td><div className="identity-cell"><div><strong>{item.title}</strong><span>{item.event_type}</span></div></div></td><td>{item.app_type === 'driver' ? 'Motorista' : item.app_type === 'client' ? 'Cliente' : 'Admin'}</td><td><Badge status={item.status}/></td><td>{new Date(item.sent_at ?? item.created_at).toLocaleString('pt-BR')}</td></tr>)}</tbody></table></div>}
    </Section>
  </>;
}

function CategorySettings({ categories, fareFor, saving, onSave }: { categories: any[]; fareFor: (code: string) => any; saving: boolean; onSave: (code: string, patch: Record<string, unknown>) => Promise<void> }) {
  return <div className="category-grid">{categories.map((category) => <CategoryCard key={category.code} category={category} initial={fareFor(category.code)} saving={saving} onSave={onSave}/>)}</div>;
}

function CategoryCard({ category, initial, saving, onSave }: { category: any; initial: any; saving: boolean; onSave: (code: string, patch: Record<string, unknown>) => Promise<void> }) {
  const [fare, setFare] = useState(initial);
  useEffect(() => setFare(initial), [initial]);
  return <Section className="category-card"><div className="category-title"><div className="category-icon">{category.code.includes('moto') ? 'M' : 'C'}</div><div><h2>{category.name}</h2><p>{category.description}</p></div><label className="switch"><input type="checkbox" checked={Boolean(fare.active)} onChange={(event) => setFare({ ...fare, active: event.target.checked })}/><span/></label></div><div className="form-grid two-col"><NumberField label="Tarifa base" value={fare.base_fare} onChange={(value) => setFare({ ...fare, base_fare: value })}/><NumberField label="Preço por km" value={fare.price_per_km} onChange={(value) => setFare({ ...fare, price_per_km: value })}/><NumberField label="Preço por minuto" value={fare.price_per_minute} onChange={(value) => setFare({ ...fare, price_per_minute: value })}/><NumberField label="Tarifa mínima" value={fare.minimum_fare} onChange={(value) => setFare({ ...fare, minimum_fare: value })}/><NumberField label="Multiplicador" value={fare.rate_multiplier} onChange={(value) => setFare({ ...fare, rate_multiplier: value })}/><NumberField label="Multiplicador mínimo" value={fare.minimum_multiplier} onChange={(value) => setFare({ ...fare, minimum_multiplier: value })}/></div><button className="button primary full" disabled={saving} onClick={() => onSave(category.code, fare)}><Save size={17}/> Salvar categoria</button></Section>;
}

function DispatchSettings({ values, onChange, onSave, saving }: { values: any; onChange: (value: any) => void; onSave: () => void; saving: boolean }) {
  const invalid = Number(values.max_search_radius_km) < Number(values.search_radius_km);
  return <div className="settings-stack">
    <Section title="Busca e despacho" description="Os aplicativos deixam de usar tempos e raios fixos; esta configuração é a fonte padrão."><div className="form-grid three-col"><NumberField label="Raio inicial (km)" min={0.1} value={values.search_radius_km} onChange={(value) => onChange({ ...values, search_radius_km: value })}/><NumberField label="Expansão por minuto (km)" min={0.1} value={values.search_radius_step_km} onChange={(value) => onChange({ ...values, search_radius_step_km: value })}/><NumberField label="Raio máximo (km)" min={0.1} value={values.max_search_radius_km} onChange={(value) => onChange({ ...values, max_search_radius_km: value })}/><NumberField label="Expiração da chamada (seg)" min={5} max={120} step={1} value={values.offer_timeout_seconds} onChange={(value) => onChange({ ...values, offer_timeout_seconds: value })}/><NumberField label="Tempo máximo de busca (min)" min={1} max={30} step={1} value={values.search_timeout_minutes} onChange={(value) => onChange({ ...values, search_timeout_minutes: value })}/><NumberField label="Atualização GPS (seg)" min={3} max={60} step={1} value={values.location_update_seconds} onChange={(value) => onChange({ ...values, location_update_seconds: value })}/></div></Section>
    <Section title="Taxas da plataforma" description="Percentuais e taxas gravados no snapshot de cada nova solicitação."><div className="form-grid three-col"><NumberField label="Percentual da plataforma (%)" min={0} max={100} value={values.platform_fee_percent} onChange={(value) => onChange({ ...values, platform_fee_percent: value })}/><NumberField label="Cancelamento após tolerância" min={0} value={values.cancellation_fee} onChange={(value) => onChange({ ...values, cancellation_fee: value })}/><NumberField label="Cancelamento após chegada" min={0} value={values.cancellation_arrived_fee} onChange={(value) => onChange({ ...values, cancellation_arrived_fee: value })}/><NumberField label="Tolerância sem taxa (min)" min={0} max={60} step={1} value={values.cancellation_grace_minutes} onChange={(value) => onChange({ ...values, cancellation_grace_minutes: value })}/><label className="field"><span>Telefone de suporte</span><input value={values.support_phone ?? ''} onChange={(event) => onChange({ ...values, support_phone: event.target.value })}/></label><label className="field"><span>Telefone de emergência</span><input value={values.emergency_phone ?? ''} onChange={(event) => onChange({ ...values, emergency_phone: event.target.value })}/></label><label className="switch-row full-span"><div><strong>Modo de teste</strong><span>Permite o fallback operacional somente em desenvolvimento.</span></div><label className="switch"><input type="checkbox" checked={Boolean(values.allow_test_mode)} onChange={(event) => onChange({ ...values, allow_test_mode: event.target.checked })}/><span/></label></label></div><div className="form-footer"><button className="button primary" disabled={saving || invalid} onClick={onSave}><Save size={17}/> Publicar configurações</button></div>{invalid && <p className="field-error">O raio máximo precisa ser maior ou igual ao raio inicial.</p>}</Section>
  </div>;
}

function PaymentGatewaySettings({ values, asaasHealth, openpixHealth, onChange, onSave, onCheckAsaas, onCheckOpenpix, saving, checkingAsaas, checkingOpenpix }: { values: any; asaasHealth: any; openpixHealth: any; onChange: (value: any) => void; onSave: () => void; onCheckAsaas: () => void; onCheckOpenpix: () => void; saving: boolean; checkingAsaas: boolean; checkingOpenpix: boolean }) {
  const validProviders = ['stripe', 'asaas', 'openpix'];
  const invalidProvider = !validProviders.includes(String(values.pix_online_provider ?? '')) || !validProviders.includes(String(values.driver_wallet_pix_provider ?? ''));
  const invalidAsaas = !values.asaas_pix_enabled && (values.pix_online_provider === 'asaas' || values.driver_wallet_pix_provider === 'asaas' || values.asaas_payout_enabled);
  const invalidOpenpix = !values.openpix_pix_enabled && (values.pix_online_provider === 'openpix' || values.driver_wallet_pix_provider === 'openpix' || values.openpix_payout_enabled);
  const invalidWallet = Number(values.driver_wallet_negative_limit) < Number(values.driver_wallet_warning_limit);
  const providerName = (value: string) => value === 'asaas' ? 'Asaas' : value === 'openpix' ? 'OpenPix' : value === 'stripe' ? 'Stripe' : 'não selecionado';
  const asaasHealthy = Boolean(asaasHealth?.ready && asaasHealth?.webhook_ready);
  const openpixHealthy = Boolean(openpixHealth?.ready && openpixHealth?.webhook_ready);
  const openpixWebhookEvents = Object.entries(openpixHealth?.webhook_event_status ?? {}) as [string, any][];
  return <div className="settings-stack">
    <Section title="Status dos gateways" description="As credenciais ficam somente nos Secrets do Supabase. Cada provedor é validado e conciliado de forma independente.">
      <div className={`settings-notice ${asaasHealthy ? 'success' : 'danger'}`}>
        {asaasHealthy ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}<span><strong>{asaasHealthy ? 'Asaas pronto' : 'Asaas requer configuração'}</strong> · {asaasHealth?.message || 'Valide a conexão.'}{asaasHealth?.environment ? ` Ambiente: ${asaasHealth.environment}.` : ''}</span>
        <button className="gateway-check-button" disabled={checkingAsaas} onClick={onCheckAsaas}><RefreshCw size={16}/>{checkingAsaas ? 'Validando...' : 'Validar Asaas'}</button>
      </div>
      <div className={`settings-notice ${openpixHealthy ? 'success' : 'danger'}`}>
        {openpixHealthy ? <CheckCircle2 size={18}/> : <AlertCircle size={18}/>}<span><strong>{openpixHealthy ? 'OpenPix pronta' : 'OpenPix requer configuração'}</strong> · {openpixHealth?.message || 'Valide a conexão.'}{openpixHealth?.webhook_message ? ` ${openpixHealth.webhook_message}` : ''}{openpixHealth?.payout_message ? ` ${openpixHealth.payout_message}` : ''}{openpixHealth?.environment ? ` Ambiente: ${openpixHealth.environment}.` : ''}</span>
        <button className="gateway-check-button" disabled={checkingOpenpix} onClick={onCheckOpenpix}><RefreshCw size={16}/>{checkingOpenpix ? 'Validando...' : 'Validar OpenPix'}</button>
      </div>
      {openpixWebhookEvents.length > 0 && <div className="openpix-webhook-grid">{openpixWebhookEvents.map(([eventType, status]) => <div className={`openpix-webhook-item ${Number(status?.received ?? 0) > 0 ? 'received' : 'waiting'}`} key={eventType}><strong>{eventType.replace('OPENPIX:', '')}</strong><span>{Number(status?.received ?? 0) > 0 ? `${status.received} recebido(s)` : 'Aguardando evento real'}</span>{status?.signature_key && <small>HMAC: {status.signature_key}</small>}</div>)}</div>}
    </Section>
    <Section title="Pix online e repasses" description="A seleção é determinística: Stripe usa Stripe, Asaas usa Asaas e OpenPix usa OpenPix. Não existe fallback automático.">
      <div className="form-grid two-col">
        <WalletSwitch label="Habilitar Asaas Pix" description="Mantém cobranças e estornos Pix pelo Asaas disponíveis." checked={Boolean(values.asaas_pix_enabled)} onChange={(checked) => onChange({ ...values, asaas_pix_enabled: checked })}/>
        <WalletSwitch label="Repasse Pix Asaas" description="Envia o ganho líquido pela chave Pix do motorista usando o Asaas." checked={Boolean(values.asaas_payout_enabled)} onChange={(checked) => onChange({ ...values, asaas_payout_enabled: checked })}/>
        <WalletSwitch label="Habilitar OpenPix" description="Libera cobranças, QR Code, webhook e estornos pela OpenPix." checked={Boolean(values.openpix_pix_enabled)} onChange={(checked) => onChange({ ...values, openpix_pix_enabled: checked })}/>
        <WalletSwitch label="Repasse PIX OUT OpenPix" description="Exige PIX OUT/API MASTER habilitado na conta OpenPix." checked={Boolean(values.openpix_payout_enabled)} onChange={(checked) => onChange({ ...values, openpix_payout_enabled: checked })}/>
        <label className="field"><span>Pix pago pelos clientes</span><select value={values.pix_online_provider ?? ''} onChange={(event) => onChange({ ...values, pix_online_provider: event.target.value })}><option value="" disabled>Selecione o gateway</option><option value="stripe">Stripe Pix</option><option value="asaas">Asaas Pix</option><option value="openpix">OpenPix</option></select></label>
        <label className="field"><span>Pix para regularizar carteira</span><select value={values.driver_wallet_pix_provider ?? ''} onChange={(event) => onChange({ ...values, driver_wallet_pix_provider: event.target.value })}><option value="" disabled>Selecione o gateway</option><option value="stripe">Stripe Pix</option><option value="asaas">Asaas Pix</option><option value="openpix">OpenPix</option></select></label>
      </div>
      {invalidProvider && <p className="field-error">Selecione explicitamente um gateway válido para o PIX dos clientes e para a carteira dos motoristas. Não existe seleção automática.</p>}
      {invalidAsaas && <p className="field-error">Ative o Asaas antes de selecioná-lo para cobranças, carteira ou repasses.</p>}
      {invalidOpenpix && <p className="field-error">Ative a OpenPix antes de selecioná-la para cobranças, carteira ou repasses.</p>}
      <p className="section-note">Cartões, Google Pay e Apple Pay continuam exclusivamente na Stripe. Cobranças já criadas permanecem ligadas ao gateway original.</p>
    </Section>
    <Section title="Carteira dos motoristas" description="Taxas de corridas físicas geram saldo devedor; corridas digitais compensam esse saldo antes do repasse.">
      <div className="form-grid three-col"><NumberField label="Avisar a partir de (R$)" min={0} value={values.driver_wallet_warning_limit} onChange={(value) => onChange({ ...values, driver_wallet_warning_limit: value })}/><NumberField label="Suspender a partir de (R$)" min={1} value={values.driver_wallet_negative_limit} onChange={(value) => onChange({ ...values, driver_wallet_negative_limit: value })}/><NumberField label="Pagamento mínimo (R$)" min={1} value={values.driver_wallet_topup_min_amount} onChange={(value) => onChange({ ...values, driver_wallet_topup_min_amount: value })}/><WalletSwitch label="Carteira ativa" description="Aplica conciliação nas novas corridas concluídas." checked={Boolean(values.driver_wallet_enabled)} onChange={(checked) => onChange({ ...values, driver_wallet_enabled: checked })}/><WalletSwitch label="Pagamento por Pix" description={`Regularização pelo gateway selecionado: ${providerName(values.driver_wallet_pix_provider)}.`} checked={Boolean(values.driver_wallet_pix_enabled)} onChange={(checked) => onChange({ ...values, driver_wallet_pix_enabled: checked })}/><WalletSwitch label="Pagamento por boleto" description="Permite quitação com compensação bancária pela Stripe." checked={Boolean(values.driver_wallet_boleto_enabled)} onChange={(checked) => onChange({ ...values, driver_wallet_boleto_enabled: checked })}/><WalletSwitch label="Pagamento por cartão" description="Abre o Stripe PaymentSheet no app do motorista." checked={Boolean(values.driver_wallet_card_enabled)} onChange={(checked) => onChange({ ...values, driver_wallet_card_enabled: checked })}/><WalletSwitch label="Usar saldo Stripe" description="Permite compensação com saldo disponível da conta Connect." checked={Boolean(values.driver_wallet_stripe_balance_enabled)} onChange={(checked) => onChange({ ...values, driver_wallet_stripe_balance_enabled: checked })}/><WalletSwitch label="Recuperação automática" description="Retém saldo devedor antes do próximo repasse digital." checked={Boolean(values.driver_wallet_auto_recovery)} onChange={(checked) => onChange({ ...values, driver_wallet_auto_recovery: checked })}/></div>
      {invalidWallet && <p className="field-error">O limite de suspensão precisa ser maior ou igual ao limite de aviso.</p>}
      <div className="form-footer"><button className="button primary" disabled={saving || invalidProvider || invalidAsaas || invalidOpenpix || invalidWallet} onClick={onSave}><Save size={17}/> Salvar pagamentos</button></div>
    </Section>
  </div>;
}

function RegionSettings({ regions, assignments, onAdd, onEdit }: { regions: any[]; assignments: any[]; onAdd: () => void; onEdit: (region: any) => void }) {
  return <Section title="Regiões atendidas" description="Desenhe polígonos reais, configure multiplicadores e restrinja categorias por área." actions={<button className="button primary" onClick={onAdd}><Plus size={17}/> Nova região</button>}>{regions.length ? <div className="region-grid">{regions.map((region) => { const count = assignments.filter((item) => item.region_id === region.id && item.active).length; return <button className="region-card" key={region.id} onClick={() => onEdit(region)}><div className="region-map-swatch"><MapPinned size={24}/><small>{region.geojson ? 'Polígono ativo' : 'Sem desenho'}</small></div><div><h3>{region.name}</h3><p>{region.city}{region.state ? `, ${region.state}` : ''}</p><div className="badge-row"><Badge status={region.active ? 'active' : 'blocked'} label={region.active ? 'Ativa' : 'Inativa'}/><span className="multiplier">× {Number(region.base_multiplier ?? 1).toFixed(2)}</span><span className="multiplier">{count || 'Todas'} categorias</span></div></div></button>; })}</div> : <EmptyState title="Nenhuma região configurada" description="Cadastre e desenhe a primeira área. Fora dos polígonos, novas solicitações serão bloqueadas."/>}</Section>;
}

function RegionEditor({ theme, open, value, categories, assignments, defaults, onClose, onSave, onDelete, saving }: { theme: ThemeMode; open: boolean; value: any; categories: any[]; assignments: any[]; defaults: any; onClose: () => void; onSave: (payload: any, assignments: any[]) => Promise<void>; onDelete: (id: string) => Promise<void>; saving: boolean }) {
  const [form, setForm] = useState(value);
  const [selected, setSelected] = useState<Record<string, { active: boolean; fare_multiplier: number }>>({});
  const [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    setForm(value);
    const own = assignments.filter((item) => item.region_id === value?.id);
    setSelected(Object.fromEntries((!value?.id && own.length === 0 ? categories.map((category) => ({ category_code: category.code, active: true, fare_multiplier: 1 })) : own).map((item) => [item.category_code, { active: item.active !== false, fare_multiplier: Number(item.fare_multiplier ?? 1) }])));
    setAdvanced(Boolean(value && ['search_radius_km_override','search_radius_step_km_override','max_search_radius_km_override','offer_timeout_seconds_override','search_timeout_minutes_override','platform_fee_percent_override','cancellation_fee_override','cancellation_arrived_fee_override'].some((key) => value[key] != null)));
  }, [value, assignments, categories]);
  const allSelected = categories.length > 0 && categories.every((category) => selected[category.code]?.active);
  const validPolygon = form?.geojson?.type === 'Polygon' || form?.geojson?.type === 'MultiPolygon';
  const invalidRadius = form?.max_search_radius_km_override != null && form?.search_radius_km_override != null && Number(form.max_search_radius_km_override) < Number(form.search_radius_km_override);
  if (!form) return null;

  function toggleAll() {
    if (allSelected) { setSelected({}); return; }
    setSelected(Object.fromEntries(categories.map((category) => [category.code, { active: true, fare_multiplier: selected[category.code]?.fare_multiplier ?? 1 }])));
  }
  const categoryPayload = Object.entries(selected).filter(([, item]) => item.active).map(([category_code, item]) => ({ category_code, active: true, fare_multiplier: item.fare_multiplier }));

  return <Modal open={open} size="large" title={form.id ? 'Editar região' : 'Nova região'} description="Defina a área no mapa. Origem e destino precisam estar dentro de uma região ativa." onClose={onClose} footer={<div className="modal-action-row region-modal-footer">{form.id && <button className="button danger ghost" disabled={saving} onClick={() => onDelete(form.id)}><Trash2 size={17}/> Excluir</button>}<span/><button className="button secondary" onClick={onClose}>Cancelar</button><button className="button primary" disabled={saving || !form.name?.trim() || !form.city?.trim() || !validPolygon || invalidRadius || categoryPayload.length === 0} onClick={() => onSave(form, categoryPayload)}><Save size={17}/> Publicar região</button></div>}>
    <div className="region-editor-layout"><div className="region-editor-form"><div className="form-grid two-col"><label className="field"><span>Nome da região</span><input value={form.name ?? ''} onChange={(event) => setForm({ ...form, name: event.target.value })}/></label><label className="field"><span>Cidade</span><input value={form.city ?? ''} onChange={(event) => setForm({ ...form, city: event.target.value })}/></label><label className="field"><span>Estado</span><input value={form.state ?? ''} maxLength={2} onChange={(event) => setForm({ ...form, state: event.target.value.toUpperCase() })}/></label><NumberField label="Multiplicador regional" min={0.01} value={form.base_multiplier ?? 1} onChange={(number) => setForm({ ...form, base_multiplier: number })}/><label className="switch-row full-span"><div><strong>Região ativa</strong><span>Permite solicitações dentro do polígono.</span></div><label className="switch"><input type="checkbox" checked={Boolean(form.active)} onChange={(event) => setForm({ ...form, active: event.target.checked })}/><span/></label></label></div>
      <div className="region-category-head"><div><strong>Categorias disponíveis</strong><p>Selecione ao menos uma e ajuste o multiplicador local se necessário.</p></div><button className="button secondary compact" type="button" onClick={toggleAll}>{allSelected ? 'Limpar' : 'Selecionar todas'}</button></div>
      <div className="region-category-list">{categories.map((category) => { const current = selected[category.code] ?? { active: false, fare_multiplier: 1 }; return <div className={`region-category-row ${current.active ? 'selected' : ''}`} key={category.code}><label><input type="checkbox" checked={current.active} onChange={(event) => setSelected({ ...selected, [category.code]: { ...current, active: event.target.checked } })}/><span><strong>{category.name}</strong><small>{category.description}</small></span></label><NumberField label="Multiplicador" min={0.01} value={current.fare_multiplier} disabled={!current.active} onChange={(fare_multiplier) => setSelected({ ...selected, [category.code]: { ...current, fare_multiplier } })}/></div>; })}</div>
      <button type="button" className="advanced-toggle" onClick={() => setAdvanced((current) => !current)}>{advanced ? 'Ocultar regras específicas' : 'Usar regras específicas nesta região'}</button>
      {advanced && <div className="regional-overrides"><p>Campos vazios herdam o padrão global exibido como referência.</p><div className="form-grid two-col"><NullableNumberField label={`Raio inicial · padrão ${defaults.search_radius_km} km`} value={form.search_radius_km_override} onChange={(value) => setForm({ ...form, search_radius_km_override: value })}/><NullableNumberField label={`Expansão · padrão ${defaults.search_radius_step_km} km`} value={form.search_radius_step_km_override} onChange={(value) => setForm({ ...form, search_radius_step_km_override: value })}/><NullableNumberField label={`Raio máximo · padrão ${defaults.max_search_radius_km} km`} value={form.max_search_radius_km_override} onChange={(value) => setForm({ ...form, max_search_radius_km_override: value })}/><NullableNumberField label={`Expiração · padrão ${defaults.offer_timeout_seconds}s`} step={1} value={form.offer_timeout_seconds_override} onChange={(value) => setForm({ ...form, offer_timeout_seconds_override: value })}/><NullableNumberField label={`Busca · padrão ${defaults.search_timeout_minutes} min`} step={1} value={form.search_timeout_minutes_override} onChange={(value) => setForm({ ...form, search_timeout_minutes_override: value })}/><NullableNumberField label={`Plataforma · padrão ${defaults.platform_fee_percent}%`} value={form.platform_fee_percent_override} onChange={(value) => setForm({ ...form, platform_fee_percent_override: value })}/><NullableNumberField label={`Cancelamento · padrão R$ ${defaults.cancellation_fee}`} value={form.cancellation_fee_override} onChange={(value) => setForm({ ...form, cancellation_fee_override: value })}/><NullableNumberField label={`Após chegada · padrão R$ ${defaults.cancellation_arrived_fee}`} value={form.cancellation_arrived_fee_override} onChange={(value) => setForm({ ...form, cancellation_arrived_fee_override: value })}/></div>{invalidRadius && <p className="field-error">O raio máximo regional não pode ser menor que o inicial.</p>}</div>}
    </div><div><RegionMapEditor theme={theme} value={form.geojson} onChange={(geojson) => setForm({ ...form, geojson })}/>{!validPolygon && <p className="field-error map-error">Desenhe ao menos três pontos para salvar a área.</p>}</div></div>
  </Modal>;
}


function WalletSwitch({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="switch-row"><div><strong>{label}</strong><span>{description}</span></div><label className="switch"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)}/><span/></label></label>;
}

function NumberField({ label, value, onChange, min, max, step = 0.01, disabled = false }: { label: string; value: number | string; onChange: (value: number) => void; min?: number; max?: number; step?: number; disabled?: boolean }) { return <label className="field"><span>{label}</span><input type="number" min={min} max={max} step={step} disabled={disabled} value={value ?? 0} onChange={(event) => onChange(Number(event.target.value))}/></label>; }
function NullableNumberField({ label, value, onChange, step = 0.01 }: { label: string; value: number | null | undefined; onChange: (value: number | null) => void; step?: number }) { return <label className="field"><span>{label}</span><input type="number" step={step} value={value ?? ''} placeholder="Herdar padrão global" onChange={(event) => onChange(event.target.value === '' ? null : Number(event.target.value))}/></label>; }
function messageOf(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string') return error.trim() || 'Não foi possível concluir a operação.';
  if (error && typeof error === 'object') {
    const value = error as Record<string, unknown>;
    for (const key of ['message', 'description', 'error_description', 'details', 'hint', 'error', 'code']) {
      const candidate = messageOfValue(value[key]);
      if (candidate) return candidate;
    }
    try {
      const encoded = JSON.stringify(error);
      if (encoded && encoded !== '{}') return encoded;
    } catch (_) { /* fallback abaixo */ }
  }
  const text = String(error ?? '').trim();
  return text && text !== '[object Object]' ? text : 'Não foi possível concluir a operação.';
}

function messageOfValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (value instanceof Error) return value.message.trim();
  if (Array.isArray(value)) return value.map(messageOfValue).filter(Boolean).join(' · ');
  if (typeof value === 'object') return messageOf(value);
  return String(value);
}
