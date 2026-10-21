import { useState } from "react";
import "./_group.css";

const statusMetrics = [
  ["Chamados abertos", "yellow"],
  ["Urgentes", "red"],
  ["Em atendimento", "blue"],
  ["Aguardando peça", "purple"],
  ["Concluídos", "green"],
] as const;

const adminMetrics = [
  "Usuários ativos",
  "Setores",
  "Equipamentos",
  "Total de chamados",
];

const shortcuts = [
  "Usuários e perfis",
  "Setores",
  "Equipamentos",
  "Histórico de manutenção",
  "Peças",
  "Manutenção preventiva",
];

export function Current() {
  const [light, setLight] = useState(false);

  return (
    <div className={`wm-preview wm-current${light ? " wm-preview-light" : ""}`}>
      <header className="wm-current-top">
        <div className="wm-current-brand">
          <img className="wm-current-mark" src="/__mockup/images/wm-icon.png" alt="" />
          <div>
            <strong>Sistema de Manutenção</strong>
            <span>Controle de chamados</span>
          </div>
        </div>
        <button
          className="wm-current-theme"
          type="button"
          aria-label={light ? "Ativar tema escuro" : "Ativar tema claro"}
          onClick={() => setLight((value) => !value)}
        >
          {light ? "Tema escuro" : "Tema claro"}
        </button>
      </header>

      <main className="wm-current-content">
        <div className="wm-current-heading">
          <div>
            <h1>Administração</h1>
            <p>Visão geral da organização</p>
          </div>
        </div>

        <section className="wm-current-metrics" aria-label="Indicadores de chamados">
          {statusMetrics.map(([label, color]) => (
            <div className={`wm-current-kpi wm-${color}`} key={label}>
              <span>{label}</span>
              <strong>—</strong>
            </div>
          ))}
        </section>

        <section className="wm-current-panel">
          <h2>Administração</h2>
          <div className="wm-current-admin-metrics">
            {adminMetrics.map((label) => (
              <div className="wm-current-admin-kpi" key={label}>
                <span>{label}</span>
                <strong>—</strong>
              </div>
            ))}
          </div>
        </section>

        <div className="wm-current-columns">
          <section className="wm-current-panel">
            <h2>Chamados</h2>
            <p className="wm-current-muted">Os chamados reais são carregados após o login.</p>
          </section>
          <section className="wm-current-panel">
            <h2>Atalhos administrativos</h2>
            <div className="wm-current-shortcuts">
              {shortcuts.map((label) => <button key={label} type="button">{label}</button>)}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
