import { useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Command,
  Gauge,
  LayoutDashboard,
  Menu,
  Moon,
  Package,
  Search,
  Sun,
  Users,
  Wrench,
  Building2,
  Boxes,
  Clock3,
  ArrowUpRight,
  Filter,
  MonitorCog,
} from "lucide-react";
import "./_group.css";

const navigation = [
  { label: "Painel", icon: LayoutDashboard },
  { label: "Chamados", icon: ClipboardList },
  { label: "Equipamentos", icon: MonitorCog },
  { label: "Setores", icon: Building2 },
  { label: "Mecânicos", icon: Wrench },
  { label: "Usuários", icon: Users },
  { label: "Histórico", icon: Activity },
  { label: "Preventiva", icon: CalendarDays },
  { label: "Peças e Estoque", icon: Package },
  { label: "Notificações", icon: Bell },
];

const ticketMetrics = [
  { label: "Chamados abertos", tone: "red", icon: ClipboardList, detail: "Urgentes: —" },
  { label: "Em atendimento", tone: "amber", icon: Clock3, detail: "Aceitos ou iniciados" },
  { label: "Concluídos", tone: "green", icon: Activity, detail: "Nos últimos 30 dias" },
  { label: "Equipamentos", tone: "blue", icon: MonitorCog, detail: "Total cadastrado" },
  { label: "Mecânicos", tone: "violet", icon: Users, detail: "Perfis ativos; presença não monitorada" },
];

function ChartPlaceholder({ title, kind, subtitle }: { title: string; kind: "donut" | "bars"; subtitle: string }) {
  return (
    <section className="wa-card wa-chart-card">
      <div className="wa-card-head">
        <div>
          <h2>{title}</h2>
          <span className="wa-caption">{subtitle}</span>
        </div>
      </div>
      <div className={`wa-chart-empty wa-${kind}`}>
        {kind === "bars" ? (
          <div className="wa-priority-placeholder">
            {["Urgente", "Alta", "Normal", "Baixa"].map((label) => (
              <div className="wa-priority-placeholder-item" key={label}>
                <span className="wa-priority-placeholder-bar" />
                <small>{label}</small>
              </div>
            ))}
          </div>
        ) : (
          <div className="wa-chart-donut"><span /></div>
        )}
        <div className="wa-chart-message">
          <span className="wa-chart-dot" />
          <span>Dados reais após login</span>
        </div>
      </div>
    </section>
  );
}

export function WindowsAdminDashboard() {
  const [light, setLight] = useState(false);
  const [activeNav, setActiveNav] = useState("Painel");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={`wm-preview wa-root${light ? " wa-light" : ""}${collapsed ? " wa-collapsed" : ""}`}>
      <aside className="wa-sidebar">
        <div className="wa-brand">
          <div className="wa-brand-mark"><Wrench size={19} strokeWidth={2.4} /></div>
          <div className="wa-brand-copy">
            <strong>Sistema de<br />Manutenção</strong>
            <span>GESTÃO DE SERVIÇOS</span>
          </div>
          <button className="wa-collapse wa-icon-button" type="button" onClick={() => setCollapsed(!collapsed)} aria-label="Recolher navegação">
            <Menu size={17} />
          </button>
        </div>

        <div className="wa-sidebar-label">MENU</div>
        <nav className="wa-nav" aria-label="Navegação principal">
          {navigation.map(({ label, icon: Icon }) => (
            <button
              className={`wa-nav-item${activeNav === label ? " wa-nav-active" : ""}`}
              key={label}
              type="button"
              onClick={() => setActiveNav(label)}
              title={label}
            >
              <Icon size={17} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Chamados" && <span className="wa-nav-hint">›</span>}
            </button>
          ))}
        </nav>
        <div className="wa-sidebar-foot">
          <div className="wa-system-mark"><span className="wa-system-dot" /> <span className="wa-system-copy">Área administrativa</span></div>
          <span className="wa-version">SISTEMA DE MANUTENÇÃO</span>
        </div>
      </aside>

      <main className="wa-main">
        <header className="wa-topbar">
          <button className="wa-icon-button wa-top-menu" type="button" onClick={() => setCollapsed(!collapsed)} aria-label="Recolher menu">
            <Menu size={17} />
          </button>
          <label className="wa-search">
            <Search size={15} />
            <input aria-label="Pesquisar chamados" placeholder="Pesquisar chamados..." />
            <span className="wa-shortcut"><Command size={11} /> K</span>
          </label>
          <div className="wa-top-actions">
            <button className="wa-icon-button wa-top-icon" type="button" aria-label="Notificações"><Bell size={17} /><i /></button>
            <button
              className="wa-theme-button"
              type="button"
              onClick={() => setLight(!light)}
              aria-label={light ? "Ativar tema escuro" : "Ativar tema claro"}
              title={light ? "Tema escuro" : "Tema claro"}
            >
              {light ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            <div className="wa-profile">
              <div className="wa-avatar"><Users size={17} /></div>
              <div className="wa-profile-copy"><strong>Administrador</strong><span>Dados reais após login</span></div>
              <ChevronDown size={14} className="wa-profile-chevron" />
            </div>
          </div>
        </header>

        <div className="wa-content">
          <section className="wa-metrics" aria-label="Indicadores de chamados">
            {ticketMetrics.map(({ label, tone, icon: Icon, detail }) => (
              <article className={`wa-metric wa-tone-${tone}`} key={label}>
                <div className="wa-metric-top"><span>{label}</span><span className="wa-metric-icon"><Icon size={16} /></span></div>
                <strong>—</strong>
                <div className="wa-metric-bottom"><span>{detail}</span></div>
              </article>
            ))}
          </section>

          <section className="wa-charts" aria-label="Gráficos de manutenção">
            <ChartPlaceholder title="Chamados por situação" subtitle="Distribuição dos registros" kind="donut" />
            <ChartPlaceholder title="Chamados por prioridade" subtitle="Chamados ativos" kind="bars" />
            <ChartPlaceholder title="Status dos equipamentos" subtitle="Situação cadastral; não indica funcionamento" kind="donut" />
          </section>

          <section className="wa-card wa-table-card">
            <div className="wa-card-head wa-table-head">
              <div><h2>Últimos chamados</h2><span className="wa-caption">Acompanhe as solicitações mais recentes</span></div>
              <div className="wa-table-tools">
                <label className="wa-table-search"><Search size={14} /><input aria-label="Pesquisar chamados" placeholder="Pesquisar chamados..." /></label>
                <button className="wa-filter-button" type="button"><Filter size={14} /><span>Todos os status</span><ChevronDown size={13} /></button>
                <button className="wa-filter-button" type="button" onClick={() => setActiveNav("Chamados")}><ArrowUpRight size={14} />Ver todos</button>
              </div>
            </div>
            <div className="wa-table-scroll">
              <table>
                <thead><tr><th>#</th><th>DATA</th><th>MÁQUINA / EQUIPAMENTO</th><th>SETOR</th><th>DESCRIÇÃO</th><th>PRIORIDADE</th><th>STATUS</th><th>RESPONSÁVEL</th><th>AÇÕES</th></tr></thead>
                <tbody>
                  <tr>
                    <td colSpan={9}>
                      <div className="wa-empty-row">
                        <div className="wa-empty-icon"><ClipboardList size={17} /></div>
                        <div><strong>Chamados aguardam autenticação</strong><span>Dados reais após login</span></div>
                        <span className="wa-dash">—</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="wa-bottom-grid">
            <div className="wa-card wa-compact-card wa-sector-card">
              <div className="wa-card-head"><div><h2>Chamados por setor</h2><span className="wa-caption">Chamados ativos</span></div><Building2 size={16} className="wa-head-icon" /></div>
              <div className="wa-sector-placeholder">
                <div className="wa-sector-placeholder-row"><span>Distribuição por setor</span><i /></div>
                <div className="wa-sector-placeholder-row"><span>Carrega com dados autenticados</span><i /></div>
              </div>
              <div className="wa-data-note"><span className="wa-note-dot" /> Dados por setor após login</div>
            </div>
            <div className="wa-card wa-compact-card wa-time-card">
              <div className="wa-card-head"><div><h2>Tempo médio de atendimento</h2><span className="wa-caption">Com início e conclusão registrados</span></div><Clock3 size={16} className="wa-head-icon" /></div>
              <div className="wa-time-value">— <span>dados reais após login</span></div>
              <div className="wa-time-rule" />
              <div className="wa-time-foot"><Gauge size={14} /> Indicadores disponíveis após login</div>
            </div>
            <div className="wa-card wa-compact-card wa-preventive">
              <div className="wa-card-head"><div><h2>Manutenções preventivas</h2><span className="wa-caption">Registros com data futura</span></div><CalendarDays size={16} className="wa-head-icon" /></div>
              <div className="wa-placeholder-block"><div className="wa-calendar-tile"><CalendarDays size={18} /></div><div><strong>Dados disponíveis após login</strong><span>Chamados preventivos reais</span></div></div>
            </div>
            <div className="wa-card wa-compact-card wa-activity">
              <div className="wa-card-head"><div><h2>Últimas atividades</h2><span className="wa-caption">Eventos de chamados recentes</span></div><Activity size={16} className="wa-head-icon" /></div>
              <div className="wa-activity-empty"><div className="wa-activity-mark"><Boxes size={17} /></div><div><strong>Atividades após autenticação</strong><span>Eventos reais dos chamados</span></div></div>
              <div className="wa-activity-foot">A lista usa os eventos registrados pelo sistema.</div>
            </div>
          </section>
          <footer className="wa-footer"><span>Sistema de Manutenção <i /> Painel administrativo</span><span>Dados reais após login</span></footer>
        </div>
      </main>

      <style>{`
        .wa-root {
          --bg: #0b1220; --panel: #111a2b; --panel-2: #151f32; --panel-3: #19263c;
          --text: #edf3fc; --muted: #8e9db4; --faint: #687991; --line: #24334b;
          --blue: #3178e6; --blue-soft: rgba(49,120,230,.15); --shadow: 0 12px 30px rgba(0,0,0,.12);
          display: flex; width: 100%; min-height: 100vh; color: var(--text); background: var(--bg);
          font-family: "Segoe UI", system-ui, sans-serif; font-size: 12px; overflow: hidden;
          transition: background .2s ease, color .2s ease;
        }
        .wa-root *, .wa-root *::before, .wa-root *::after { box-sizing: border-box; }
        .wa-root button, .wa-root input { font: inherit; color: inherit; }
        .wa-root button { cursor: pointer; }
        .wa-sidebar { width: 198px; min-width: 198px; min-height: 100vh; display: flex; flex-direction: column; background: #0e192a; border-right: 1px solid #1d2b40; }
        .wa-brand { min-height: 73px; padding: 0 13px 0 16px; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #1c2a3e; }
        .wa-brand-mark { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px; color: #c3dcff; background: linear-gradient(145deg,#1c4d89,#183761); border: 1px solid #30639e; flex: none; }
        .wa-brand-copy { min-width: 0; flex: 1; }
        .wa-brand-copy strong { display: block; font-size: 12px; line-height: 1.12; letter-spacing: -.15px; }
        .wa-brand-copy span { display: block; margin-top: 5px; color: #72839b; font-size: 8px; font-weight: 700; letter-spacing: .9px; }
        .wa-icon-button { display: inline-grid; place-items: center; padding: 0; border: 0; background: transparent; color: var(--muted); }
        .wa-collapse { width: 24px; height: 28px; border-radius: 6px; }
        .wa-collapse:hover, .wa-icon-button:hover { background: rgba(126,161,206,.1); color: var(--text); }
        .wa-sidebar-label { padding: 21px 16px 9px; color: #697a93; font-size: 9px; font-weight: 750; letter-spacing: .95px; }
        .wa-nav { display: grid; gap: 3px; padding: 0 9px; }
        .wa-nav-item { position: relative; display: flex; align-items: center; gap: 11px; width: 100%; height: 36px; padding: 0 10px; color: #a6b4c8 !important; border: 1px solid transparent; border-radius: 7px; background: transparent; text-align: left; font-size: 11.5px !important; transition: .16s ease; }
        .wa-nav-item:hover { color: #eff6ff !important; background: #152238; }
        .wa-nav-active { color: #eaf3ff !important; border-color: #234c7c; background: linear-gradient(90deg,#17345a,#162c49) !important; box-shadow: inset 2px 0 #4592f5; }
        .wa-nav-active > svg { color: #7db8ff; }
        .wa-nav-item span:first-of-type { flex: 1; }
        .wa-nav-chevron { color: #74869f; }
        .wa-nav-hint { color: #7c8da5; font-size: 17px; }
        .wa-sidebar-foot { margin-top: auto; padding: 12px 13px 15px; border-top: 1px solid #1c2a3e; }
        .wa-system-mark { display: flex; align-items: center; gap: 7px; color: #a8b7c9; font-size: 10px; }
        .wa-system-dot { width: 7px; height: 7px; border-radius: 50%; background: #4788d4; box-shadow: 0 0 0 3px rgba(71,136,212,.12); }
        .wa-version { display: block; margin: 9px 0 0 14px; color: #63748c; font-size: 8px; letter-spacing: .75px; }
        .wa-main { min-width: 0; flex: 1; height: 100vh; overflow: auto; }
        .wa-topbar { height: 58px; padding: 0 25px; display: flex; align-items: center; gap: 23px; position: sticky; top: 0; z-index: 4; background: color-mix(in srgb,var(--bg) 92%,transparent); border-bottom: 1px solid var(--line); backdrop-filter: blur(12px); }
        .wa-breadcrumb { min-width: 160px; display: flex; align-items: center; gap: 9px; color: var(--muted); font-size: 11px; }
        .wa-breadcrumb strong { color: var(--text); font-weight: 650; }
        .wa-crumb-slash { color: #52627a; }
        .wa-search { height: 33px; max-width: 395px; min-width: 190px; flex: 1; display: flex; align-items: center; gap: 8px; padding: 0 9px; border: 1px solid var(--line); background: var(--panel); border-radius: 7px; color: #788ba4; }
        .wa-search input, .wa-table-search input { flex: 1; min-width: 0; border: 0; outline: none; background: transparent; color: var(--text); font-size: 10px !important; }
        .wa-search input::placeholder, .wa-table-search input::placeholder { color: #7788a0; opacity: 1; }
        .wa-shortcut { height: 19px; display: flex; align-items: center; gap: 3px; padding: 0 5px; border: 1px solid #2b3b54; border-radius: 4px; color: #91a1b7; font-size: 9px; }
        .wa-top-actions { margin-left: auto; display: flex; align-items: center; gap: 14px; }
        .wa-top-icon { position: relative; width: 28px; height: 30px; }
        .wa-top-icon i { position: absolute; right: 4px; top: 4px; width: 5px; height: 5px; border-radius: 50%; background: #498fe6; border: 1px solid var(--bg); }
        .wa-theme-button { display: grid; place-items: center; width: 29px; height: 29px; border: 1px solid var(--line); border-radius: 7px; background: var(--panel); color: #aebbd0 !important; }
        .wa-theme-button:hover { border-color: #477dbb; color: #83b9fa !important; }
        .wa-profile { display: flex; align-items: center; gap: 8px; padding-left: 12px; border-left: 1px solid var(--line); }
        .wa-avatar { width: 29px; height: 29px; display: grid; place-items: center; border-radius: 50%; color: #b6d6ff; border: 1px solid #31547e; background: #1a3558; }
        .wa-profile-copy strong, .wa-profile-copy span { display: block; }
        .wa-profile-copy strong { font-size: 10px; font-weight: 650; }
        .wa-profile-copy span { margin-top: 3px; color: var(--muted); font-size: 9px; }
        .wa-profile-chevron { color: var(--muted); margin-left: 4px; }
        .wa-content { max-width: 1450px; margin: 0 auto; padding: 19px 25px 16px; }
        .wa-page-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 17px; }
        .wa-eyebrow { display: flex; align-items: center; gap: 7px; color: #83a8d6; font-size: 8px; font-weight: 750; letter-spacing: 1.2px; }
        .wa-eyebrow-line { width: 14px; height: 1px; background: #4386d2; }
        .wa-page-heading h1 { margin: 4px 0 3px; font-size: 21px; line-height: 1.15; letter-spacing: -.55px; font-weight: 700; }
        .wa-page-heading p { margin: 0; color: var(--muted); font-size: 10.5px; }
        .wa-range-button, .wa-filter-button { display: flex; align-items: center; gap: 8px; height: 31px; padding: 0 9px; border: 1px solid var(--line); border-radius: 6px; color: #c0ccdc !important; background: var(--panel); font-size: 10px !important; white-space: nowrap; }
        .wa-range-button:hover, .wa-filter-button:hover { border-color: #426c9f; }
        .wa-metrics { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 10px; margin-bottom: 12px; }
        .wa-metric { position: relative; min-width: 0; min-height: 86px; padding: 11px 12px 9px; overflow: hidden; border: 1px solid var(--line); border-radius: 9px; background: linear-gradient(130deg,var(--panel),color-mix(in srgb,var(--panel) 72%,var(--panel-3))); box-shadow: var(--shadow); }
        .wa-metric::before { content: ""; position: absolute; inset: 0 auto 0 0; width: 2px; background: var(--tone); opacity: .9; }
        .wa-tone-amber { --tone:#e4a93c; --tone-bg:rgba(228,169,60,.13); }
        .wa-tone-red { --tone:#e16a72; --tone-bg:rgba(225,106,114,.13); }
        .wa-tone-blue { --tone:#5195eb; --tone-bg:rgba(81,149,235,.14); }
        .wa-tone-sky { --tone:#58b8db; --tone-bg:rgba(88,184,219,.14); }
        .wa-tone-violet { --tone:#9b83e6; --tone-bg:rgba(155,131,230,.14); }
        .wa-tone-green { --tone:#53b994; --tone-bg:rgba(83,185,148,.13); }
        .wa-metric-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; color: #c1ccdc; font-size: 10px; font-weight: 600; }
        .wa-metric-icon { display: grid; place-items: center; width: 25px; height: 25px; color: var(--tone); border-radius: 6px; background: var(--tone-bg); }
        .wa-metric > strong { display: block; margin-top: -1px; font-size: 23px; line-height: 1; letter-spacing: -.7px; }
        .wa-metric-bottom { display: flex; justify-content: space-between; align-items: center; margin-top: 5px; color: #7889a1; font-size: 8px; }
        .wa-metric-bottom svg { color: #6d7d94; }
        .wa-charts { display: grid; grid-template-columns: 1fr 1.1fr 1fr; gap: 10px; margin-bottom: 12px; }
        .wa-card { min-width: 0; border: 1px solid var(--line); border-radius: 9px; background: var(--panel); box-shadow: var(--shadow); }
        .wa-chart-card { min-height: 137px; padding: 11px 12px 9px; }
        .wa-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .wa-card-head h2 { margin: 0; font-size: 11px; font-weight: 650; letter-spacing: -.1px; }
        .wa-caption { display: block; margin-top: 3px; color: var(--muted); font-size: 9px; }
        .wa-subtle-button { width: 24px; height: 22px; border-radius: 5px; }
        .wa-chart-empty { height: 77px; margin-top: 6px; display: flex; align-items: center; justify-content: center; gap: 15px; position: relative; overflow: hidden; }
        .wa-chart-donut { position: relative; width: 66px; height: 66px; flex: none; border-radius: 50%; border: 8px solid #21344c; background: conic-gradient(from -90deg,rgba(57,126,214,.3) 0 25%,#21344c 25% 100%); }
        .wa-chart-donut::after { content: ""; position: absolute; inset: -8px; border: 1px dashed #355171; border-radius: 50%; }
        .wa-chart-donut span { position: absolute; inset: 11px; border-radius: 50%; background: var(--panel); border: 1px solid var(--line); }
        .wa-ring .wa-chart-donut { width: 65px; height: 65px; border-color: #203650; background: conic-gradient(from 25deg,rgba(64,145,218,.35) 0 16%,#22394f 16% 67%,#203650 67%); }
        .wa-chart-message { display: flex; align-items: center; gap: 6px; color: #8d9db3; font-size: 9px; white-space: nowrap; }
        .wa-chart-dot { width: 7px; height: 7px; border: 1px solid #4e8bce; border-radius: 50%; background: rgba(49,120,230,.2); }
        .wa-chart-grid { position: relative; width: 52%; height: 58px; display: flex; flex-direction: column; justify-content: space-between; }
        .wa-chart-grid > span { width: 100%; border-top: 1px dashed #26374d; }
        .wa-chart-line { position: absolute; left: 0; right: 0; bottom: 0; border-bottom: 1px solid #34455d; }
        .wa-bars .wa-chart-message { position: absolute; right: 6px; bottom: 3px; }
        .wa-table-card { margin-bottom: 12px; overflow: hidden; }
        .wa-table-head { padding: 11px 12px 10px; align-items: center; }
        .wa-table-tools { display: flex; align-items: center; gap: 7px; }
        .wa-table-search { height: 29px; width: 165px; display: flex; align-items: center; gap: 6px; padding: 0 8px; border: 1px solid var(--line); border-radius: 5px; color: #8293aa; background: var(--panel-2); }
        .wa-table-search input { font-size: 9px !important; }
        .wa-filter-button { height: 29px; gap: 5px; padding: 0 8px; font-size: 9px !important; }
        .wa-add-button { display: flex; align-items: center; gap: 6px; height: 29px; padding: 0 10px; color: white !important; border: 1px solid #397fdb; border-radius: 5px; background: #286fcb; font-size: 9px !important; font-weight: 650; white-space: nowrap; }
        .wa-add-button:hover { background: #347fdd; }
        .wa-add-button span { font-size: 16px; line-height: 1; font-weight: 400; }
        .wa-table-scroll { overflow-x: auto; }
        .wa-table-scroll table { width: 100%; border-collapse: collapse; text-align: left; }
        .wa-table-scroll th { height: 29px; padding: 0 9px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); color: #7f90a8; background: color-mix(in srgb,var(--panel-2) 80%,transparent); font-size: 8px; font-weight: 700; letter-spacing: .4px; white-space: nowrap; }
        .wa-table-scroll th:first-child { padding-left: 13px; }
        .wa-table-scroll td { padding: 0; }
        .wa-empty-row { min-height: 58px; display: flex; align-items: center; gap: 10px; padding: 8px 13px; }
        .wa-empty-icon { width: 30px; height: 30px; display: grid; place-items: center; color: #7ea8d8; border: 1px solid #2c4666; border-radius: 7px; background: #15263c; }
        .wa-empty-row strong, .wa-empty-row span { display: block; }
        .wa-empty-row strong { color: #c2cede; font-size: 10px; font-weight: 600; }
        .wa-empty-row div:nth-child(2) span { margin-top: 3px; color: var(--muted); font-size: 9px; }
        .wa-dash { margin-left: auto; color: #657891; font-size: 14px; }
        .wa-bottom-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; }
        .wa-compact-card { min-height: 127px; padding: 11px 12px 10px; }
        .wa-head-icon { color: #7893b4; }
        .wa-neutral-list { margin-top: 10px; }
        .wa-neutral-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid color-mix(in srgb,var(--line) 70%,transparent); color: #aebbd0; font-size: 9px; }
        .wa-neutral-row span:last-child { color: #d8e2f0; }
        .wa-data-note { display: flex; align-items: center; gap: 6px; margin-top: 8px; color: #788aa2; font-size: 8px; }
        .wa-note-dot { width: 6px; height: 6px; border-radius: 50%; border: 1px solid #6491c4; }
        .wa-time-value { margin-top: 13px; color: #e0e9f5; font-size: 22px; font-weight: 700; }
        .wa-time-value span { color: var(--muted); font-size: 9px; font-weight: 400; }
        .wa-time-rule { height: 4px; margin: 9px 0 8px; border-radius: 5px; background: linear-gradient(90deg,#253b55 0 35%,#1d2d41 35%); }
        .wa-time-foot { display: flex; align-items: center; gap: 5px; color: #8293a9; font-size: 8px; }
        .wa-time-foot svg { color: #6298d1; }
        .wa-placeholder-block { margin-top: 12px; display: flex; align-items: center; gap: 9px; }
        .wa-calendar-tile { width: 34px; height: 34px; display: grid; place-items: center; color: #80b5f1; background: #172e4b; border: 1px solid #2a4c71; border-radius: 7px; }
        .wa-placeholder-block strong, .wa-placeholder-block span { display: block; }
        .wa-placeholder-block strong { color: #c2cede; font-size: 9px; font-weight: 600; }
        .wa-placeholder-block span { margin-top: 3px; color: var(--muted); font-size: 8px; }
        .wa-chip-row { display: flex; gap: 5px; margin-top: 10px; }
        .wa-chip-row span { flex: 1; padding: 5px 6px; display: flex; justify-content: space-between; gap: 3px; border: 1px solid var(--line); border-radius: 5px; color: #96a6bb; background: var(--panel-2); font-size: 8px; white-space: nowrap; }
        .wa-chip-row b { color: #d2ddec; font-size: 9px; }
        .wa-activity-empty { display: flex; align-items: center; gap: 9px; margin-top: 17px; }
        .wa-activity-mark { display: grid; place-items: center; width: 31px; height: 31px; border: 1px solid #2b4667; border-radius: 50%; color: #83aede; background: #172942; }
        .wa-activity-empty strong, .wa-activity-empty span { display: block; }
        .wa-activity-empty strong { color: #c2cede; font-size: 9px; font-weight: 600; }
        .wa-activity-empty span { margin-top: 4px; color: var(--muted); font-size: 8px; }
        .wa-activity-foot { margin-top: 10px; color: #7789a1; font-size: 8px; }
        .wa-footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 13px; padding: 0 2px; color: #62748b; font-size: 8px; }
        .wa-footer i { display: inline-block; height: 8px; margin: 0 6px; border-left: 1px solid #35445a; vertical-align: -1px; }
        .wa-light { --bg:#edf2f8; --panel:#fff; --panel-2:#f5f8fc; --panel-3:#e8eef6; --text:#172538; --muted:#6b7c93; --faint:#8391a4; --line:#d8e1ed; --shadow:0 8px 22px rgba(28,48,75,.06); }
        .wa-light .wa-sidebar { background: #e3ebf5; border-color: #d2deec; }
        .wa-light .wa-brand { border-color: #d2deec; }
        .wa-light .wa-brand-copy span, .wa-light .wa-sidebar-label, .wa-light .wa-version { color: #73859d; }
        .wa-light .wa-nav-item { color: #4a5d74 !important; }
        .wa-light .wa-nav-item:hover { background: #d9e5f3; color: #1a385e !important; }
        .wa-light .wa-nav-active { background: linear-gradient(90deg,#d3e5fb,#e1edfa) !important; color: #1d4c82 !important; border-color: #b9d3ef; }
        .wa-light .wa-nav-active > svg { color: #3179c5; }
        .wa-light .wa-sidebar-foot { border-color: #d2deec; }
        .wa-light .wa-system-mark { color: #59718d; }
        .wa-light .wa-metric-top, .wa-light .wa-neutral-row, .wa-light .wa-placeholder-block strong, .wa-light .wa-activity-empty strong { color: #465a73; }
        .wa-light .wa-chart-donut { border-color: #d6e2ef; background: conic-gradient(from -90deg,rgba(49,120,230,.21) 0 25%,#d6e2ef 25% 100%); }
        .wa-light .wa-ring .wa-chart-donut { background: conic-gradient(from 25deg,rgba(64,145,218,.3) 0 16%,#d7e3ef 16% 67%,#d0dfed 67%); }
        .wa-light .wa-chart-donut span { background: var(--panel); }
        .wa-light .wa-chart-grid > span { border-color: #dce4ed; }
        .wa-light .wa-chart-line { border-color: #cbd7e5; }
        .wa-light .wa-empty-icon, .wa-light .wa-calendar-tile, .wa-light .wa-activity-mark { background: #edf5fd; color: #397bbd; }
        .wa-light .wa-metric > strong, .wa-light .wa-time-value { color: #1a2a3e; }
        .wa-light .wa-chip-row b, .wa-light .wa-neutral-row span:last-child { color: #273b53; }
        .wa-light .wa-table-scroll th { color: #62748a; }
        .wa-collapsed .wa-sidebar { width: 64px; min-width: 64px; }
        .wa-collapsed .wa-brand { padding: 0 14px; }
        .wa-collapsed .wa-brand-copy, .wa-collapsed .wa-collapse, .wa-collapsed .wa-sidebar-label, .wa-collapsed .wa-nav-item > span, .wa-collapsed .wa-system-copy, .wa-collapsed .wa-version { display: none; }
        .wa-collapsed .wa-nav { padding: 0 9px; }
        .wa-collapsed .wa-nav-item { justify-content: center; padding: 0; }
        .wa-collapsed .wa-nav-item > svg { flex: none; }
        .wa-collapsed .wa-sidebar-foot { padding-left: 27px; }
        @media (min-width: 1500px) { .wa-content { padding-right: 32px; padding-left: 32px; } }
        @media (max-width: 1050px) {
          .wa-sidebar { width: 174px; min-width: 174px; }
          .wa-topbar { padding: 0 17px; gap: 12px; }
          .wa-content { padding-right: 17px; padding-left: 17px; }
          .wa-breadcrumb { min-width: 125px; }
          .wa-bottom-grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .wa-charts { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .wa-chart-card:last-child { grid-column: 1 / -1; }
        }
        @media (max-width: 720px) {
          .wa-root { min-height: 100dvh; }
          .wa-sidebar { width: 58px; min-width: 58px; }
          .wa-brand { justify-content: center; padding: 0; }
          .wa-brand-copy, .wa-collapse, .wa-sidebar-label, .wa-nav-item > span, .wa-system-copy, .wa-version { display: none; }
          .wa-nav { padding: 0 7px; }
          .wa-nav-item { justify-content: center; padding: 0; }
          .wa-nav-item > svg { flex: none; }
          .wa-nav-hint, .wa-nav-chevron { display: none !important; }
          .wa-sidebar-foot { padding-left: 25px; }
          .wa-topbar { height: 53px; padding: 0 12px; gap: 9px; }
          .wa-breadcrumb { min-width: 0; font-size: 10px; }
          .wa-breadcrumb > span:first-child { display: none; }
          .wa-search { max-width: none; min-width: 0; height: 31px; }
          .wa-search input { font-size: 9px !important; }
          .wa-shortcut, .wa-profile-copy, .wa-profile-chevron { display: none; }
          .wa-top-actions { gap: 7px; }
          .wa-profile { padding-left: 7px; }
          .wa-content { padding: 15px 12px 20px; }
          .wa-page-heading { align-items: flex-start; }
          .wa-page-heading h1 { font-size: 19px; }
          .wa-page-heading p { max-width: 390px; line-height: 1.45; }
          .wa-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); }
          .wa-metric { min-height: 82px; }
          .wa-metric:last-child { grid-column: 1 / -1; }
          .wa-charts { grid-template-columns: 1fr; }
          .wa-chart-card:last-child { grid-column: auto; }
          .wa-chart-card { min-height: 125px; }
          .wa-table-head { align-items: flex-start; flex-direction: column; }
          .wa-table-tools { width: 100%; flex-wrap: wrap; }
          .wa-table-search { flex: 1; min-width: 130px; }
          .wa-table-scroll table { min-width: 790px; }
          .wa-bottom-grid { grid-template-columns: 1fr; }
          .wa-compact-card { min-height: 120px; }
        }
        @media (max-width: 430px) {
          .wa-sidebar { width: 48px; min-width: 48px; }
          .wa-brand-mark { width: 30px; height: 30px; }
          .wa-nav { padding: 0 5px; }
          .wa-nav-item { height: 34px; }
          .wa-topbar { gap: 7px; padding: 0 9px; }
          .wa-search { padding: 0 7px; }
          .wa-search input::placeholder { font-size: 8px; }
          .wa-top-icon { width: 24px; }
          .wa-theme-button { width: 26px; height: 27px; }
          .wa-content { padding-right: 9px; padding-left: 9px; }
          .wa-range-button { padding: 0 7px; gap: 5px; }
          .wa-filter-button { flex: 1; justify-content: center; }
          .wa-footer { flex-direction: column; gap: 4px; }
        }
        .wa-root { --bg:#0a1422; --panel:#101b2b; --panel-2:#152338; --panel-3:#1b2a40; --line:#23334a; --muted:#92a1b6; font-size:11px; }
        .wa-sidebar { width:142px; min-width:142px; background:#101b2b; border-color:var(--line); }
        .wa-brand { min-height:56px; padding:0 10px; gap:8px; }
        .wa-brand-mark { width:31px; height:31px; border-radius:8px; }
        .wa-brand-copy strong { font-size:10px; }
        .wa-brand-copy span { display:none; }
        .wa-collapse { display:none; }
        .wa-sidebar-label { padding:15px 12px 8px; font-size:8px; }
        .wa-nav { padding:0 7px; gap:3px; }
        .wa-nav-item { height:34px; gap:8px; padding:0 8px; font-size:10px !important; }
        .wa-nav-item > svg { width:15px; height:15px; }
        .wa-nav-hint { margin-left:auto; }
        .wa-sidebar-foot { padding:10px 10px 12px; }
        .wa-version { margin-left:12px; letter-spacing:.3px; }
        .wa-main { height:100vh; }
        .wa-topbar { height:56px; padding:0 13px; gap:10px; }
        .wa-top-menu { width:30px; height:30px; flex:none; border-radius:6px; }
        .wa-breadcrumb { display:none; }
        .wa-search { min-width:120px; max-width:none; height:32px; }
        .wa-top-actions { gap:8px; }
        .wa-content { max-width:none; padding:10px 12px 12px; }
        .wa-page-heading { display:none; }
        .wa-metrics { grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; margin-bottom:9px; }
        .wa-metric { min-height:76px; padding:8px; display:grid; grid-template-columns:38px minmax(0,1fr); grid-template-rows:17px 21px 13px; align-content:center; column-gap:8px; row-gap:2px; border-radius:8px; }
        .wa-metric::before { width:0; }
        .wa-tone-red { --tone:#e94c5c; --tone-bg:#712c3b; }
        .wa-tone-amber { --tone:#ffbf24; --tone-bg:#6a4b1c; }
        .wa-tone-green { --tone:#20bf7a; --tone-bg:#1b5c4b; }
        .wa-tone-blue { --tone:#1788f6; --tone-bg:#1c4771; }
        .wa-tone-violet { --tone:#8b4bf4; --tone-bg:#492975; }
        .wa-metric-top { display:contents; }
        .wa-metric-top > span:first-child { grid-column:2; grid-row:1; overflow:hidden; color:#c3cfdf; font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
        .wa-metric-icon { grid-column:1; grid-row:1 / span 3; width:38px; height:38px; color:white; border-radius:7px; background:var(--tone); }
        .wa-metric-icon svg { width:19px; height:19px; }
        .wa-metric > strong { grid-column:2; grid-row:2; margin:0; font-size:20px; line-height:1; }
        .wa-metric-bottom { grid-column:2; grid-row:3; overflow:hidden; margin:0; white-space:nowrap; text-overflow:ellipsis; font-size:8px; }
        .wa-metric-bottom svg { display:none; }
        .wa-charts { grid-template-columns:1.15fr 1fr 1.15fr; gap:8px; margin-bottom:9px; }
        .wa-chart-card { min-height:140px; padding:10px; }
        .wa-card { border-radius:8px; box-shadow:none; }
        .wa-card-head h2 { font-size:10px; }
        .wa-caption { font-size:8px; }
        .wa-subtle-button { display:none; }
        .wa-chart-empty { height:92px; margin-top:5px; gap:10px; }
        .wa-chart-empty.wa-bars { flex-direction:column; align-items:stretch; justify-content:flex-start; gap:0; }
        .wa-chart-donut { width:72px; height:72px; border:9px solid #25405d; background:none; }
        .wa-chart-donut::after { display:none; }
        .wa-chart-donut span { inset:9px; border:0; background:var(--panel); }
        .wa-chart-message { font-size:8px; }
        .wa-priority-placeholder { width:100%; height:73px; display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); align-items:stretch; gap:8px; padding:0 3px; border-bottom:1px solid var(--line); background:repeating-linear-gradient(to bottom,transparent 0,transparent 20px,#24344a 21px); }
        .wa-priority-placeholder-item { position:relative; height:100%; display:grid; grid-template-rows:minmax(0,1fr) 14px; justify-items:center; align-items:end; }
        .wa-priority-placeholder-bar { width:min(27px,70%); height:42%; border-radius:4px 4px 0 0; background:#516782; opacity:.72; }
        .wa-priority-placeholder-item:nth-child(2) .wa-priority-placeholder-bar { height:56%; }
        .wa-priority-placeholder-item:nth-child(3) .wa-priority-placeholder-bar { height:70%; }
        .wa-priority-placeholder-item:nth-child(4) .wa-priority-placeholder-bar { height:82%; }
        .wa-priority-placeholder-item small { position:static; margin:0; transform:none; color:var(--text); font-size:7px; white-space:nowrap; }
        .wa-bars .wa-chart-message { position:static; align-self:flex-end; margin-top:1px; }
        .wa-table-card { margin-bottom:9px; }
        .wa-table-head { min-height:42px; padding:7px 9px; }
        .wa-table-head .wa-caption { display:none; }
        .wa-table-tools { gap:5px; }
        .wa-table-search { width:145px; height:27px; padding:0 6px; }
        .wa-filter-button { height:27px; gap:4px; padding:0 6px; font-size:8px !important; }
        .wa-table-scroll th { height:27px; padding:0 7px; font-size:7px; }
        .wa-empty-row { min-height:140px; padding:6px 9px; }
        .wa-bottom-grid { grid-template-columns:1.1fr 1.05fr 1.05fr 1.2fr; gap:8px; }
        .wa-compact-card { min-height:130px; padding:9px; }
        .wa-time-value { margin-top:15px; font-size:21px; }
        .wa-placeholder-block { margin-top:12px; }
        .wa-activity-empty { margin-top:16px; }
        .wa-sector-placeholder { margin-top:12px; display:grid; gap:12px; }
        .wa-sector-placeholder-row { display:flex; align-items:center; justify-content:space-between; gap:8px; color:#c1ccdc; font-size:8px; }
        .wa-sector-placeholder-row i { width:48%; height:6px; border-radius:5px; background:linear-gradient(90deg,#337edb,#233b58); }
        .wa-sector-placeholder-row + .wa-sector-placeholder-row i { background:linear-gradient(90deg,#5e4acf,#233b58); }
        .wa-footer { display:none; }
        .wa-light .wa-metric-top > span:first-child { color:#50627a; }
        .wa-light .wa-chart-donut { border-color:#d4e1ef; }
        .wa-light .wa-priority-placeholder { background:repeating-linear-gradient(to bottom,transparent 0,transparent 20px,#d7e0eb 21px); }
        .wa-light .wa-sector-placeholder-row { color:#52647c; }
        @media (max-width: 1050px) {
          .wa-sidebar { width:142px; min-width:142px; }
          .wa-charts { grid-template-columns:1.15fr 1fr 1.15fr; }
          .wa-chart-card:last-child { grid-column:auto; }
          .wa-bottom-grid { grid-template-columns:1.1fr 1.05fr 1.05fr 1.2fr; }
          .wa-content { padding-right:12px; padding-left:12px; }
          .wa-topbar { padding:0 13px; gap:10px; }
        }
        @media (max-width: 900px) {
          .wa-metrics { grid-template-columns:repeat(3,minmax(0,1fr)); }
          .wa-charts { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .wa-chart-card:last-child { grid-column:1 / -1; }
          .wa-bottom-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .wa-empty-row { min-height:90px; }
        }
        @media (max-width: 620px) {
          .wa-sidebar { width:54px; min-width:54px; }
          .wa-brand { justify-content:center; padding:0; }
          .wa-brand-copy,.wa-sidebar-label,.wa-nav-item > span,.wa-system-copy,.wa-version { display:none; }
          .wa-nav { padding:0 5px; }
          .wa-nav-item { justify-content:center; padding:0; }
          .wa-metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
          .wa-metric:last-child { grid-column:auto; }
          .wa-charts,.wa-bottom-grid { grid-template-columns:1fr; }
          .wa-chart-card:last-child { grid-column:auto; }
          .wa-topbar { padding:0 7px; gap:5px; }
          .wa-search { min-width:0; }
          .wa-shortcut,.wa-profile-copy,.wa-profile-chevron { display:none; }
          .wa-top-actions { gap:4px; }
          .wa-profile { padding-left:5px; }
          .wa-content { padding:8px; }
          .wa-table-head { align-items:flex-start; flex-direction:column; }
          .wa-table-tools { width:100%; flex-wrap:wrap; }
          .wa-table-search { flex:1; min-width:100px; }
          .wa-table-scroll table { min-width:790px; }
        }
        @media (prefers-reduced-motion: reduce) { .wa-root *, .wa-root *::before, .wa-root *::after { transition-duration: .01ms !important; } }
      `}</style>
    </div>
  );
}
