export function FareSettings() {
  return (
    <section className="card" style={{ marginTop: 16 }}>
      <h2>Configuração de tarifas</h2>
      <div className="form-row">
        <input className="input" placeholder="Cidade" defaultValue="Goiânia" />
        <input className="input" placeholder="Tarifa base" defaultValue="5,00" />
        <input className="input" placeholder="Raio de busca KM" defaultValue="5" />
      </div>
      <br />
      <button className="primary-btn">Salvar tarifa</button>
    </section>
  );
}
