const ACTIONS_RUN_URL =
  "https://github.com/marceloconta401/sistema-manutencao/actions/runs/39460997799";

export function WindowsDownloadCard() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        boxSizing: "border-box",
        background:
          "radial-gradient(circle at 15% 0%, #14243a 0, #0b1422 48%, #080f19 100%)",
        color: "#edf4ff",
        fontFamily: "Inter, Segoe UI, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(100%, 560px)",
          padding: 28,
          border: "1px solid #26384f",
          borderRadius: 18,
          background: "linear-gradient(145deg, #152235, #101a29)",
          boxShadow: "0 18px 50px #0008",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 18,
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 48,
              height: 48,
              borderRadius: 14,
              background: "#0878e9",
              fontSize: 25,
            }}
          >
            ↓
          </span>
          <div>
            <div
              style={{
                color: "#8ea7c5",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              Instalador oficial
            </div>
            <h1 style={{ margin: "4px 0 0", fontSize: 22 }}>
              Sistema de Manutenção
            </h1>
          </div>
        </div>

        <p style={{ margin: "0 0 8px", color: "#b9c9dc", fontSize: 14 }}>
          Windows · versão 1.0.4 · 64 bits
        </p>
        <p
          style={{
            margin: "0 0 22px",
            color: "#dce8f7",
            fontSize: 15,
            fontWeight: 600,
            overflowWrap: "anywhere",
          }}
        >
          Sistema de Manutenção-1.0.4-x64.exe
        </p>

        <a
          href={ACTIONS_RUN_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "block",
            padding: "13px 18px",
            borderRadius: 10,
            background: "linear-gradient(90deg, #0878e9, #1167d7)",
            color: "#fff",
            textAlign: "center",
            textDecoration: "none",
            fontWeight: 700,
            boxShadow: "0 7px 20px #0878e944",
          }}
        >
          Abrir download no GitHub Actions ↗
        </a>

        <p
          style={{
            margin: "16px 0 0",
            color: "#9db0c8",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          Na página, abra <strong>Artifacts</strong>, baixe{" "}
          <strong>Sistema-de-Manutencao-Windows</strong>, extraia o ZIP e execute
          o instalador. O GitHub pode pedir que você entre na conta autorizada
          para acessar o artefato.
        </p>
      </section>
    </main>
  );
}
