import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "motion/react";
import { Analytics } from "@vercel/analytics/react";

import "./index.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
// This entrypoint intentionally defines its startup fallback locally.
// eslint-disable-next-line react-refresh/only-export-components
const StartupFailure = () => (
  <main
    role="alert"
    style={{
      minHeight: "100dvh",
      display: "grid",
      placeItems: "center",
      padding: "24px",
      background: "#f8fafc",
      color: "#0f172a",
      fontFamily: "system-ui, sans-serif",
    }}
  >
    <section
      style={{
        boxSizing: "border-box",
        width: "min(100%, 560px)",
        padding: "32px",
        border: "1px solid #e2e8f0",
        borderRadius: "16px",
        background: "#fff",
        boxShadow: "0 12px 32px rgb(15 23 42 / 8%)",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ margin: "0 0 12px", fontSize: "1.5rem" }}>
        No se pudo iniciar la aplicación
      </h1>
      <p>
        Ocurrió un problema al preparar la aplicación. Inténtalo de nuevo más
        tarde o contacta con el equipo de soporte si el problema continúa.
      </p>
    </section>
  </main>
);

class StartupErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error("Falló la inicialización de la aplicación.", {
      name: error?.name,
    });
  }

  render() {
    return this.state.hasError ? <StartupFailure /> : this.props.children;
  }
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseKey) {
  root.render(
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <section
        role="alert"
        style={{
          boxSizing: "border-box",
          width: "min(100%, 560px)",
          padding: "32px",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          background: "#fff",
          boxShadow: "0 12px 32px rgb(15 23 42 / 8%)",
          lineHeight: 1.6,
        }}
      >
        <h1 style={{ margin: "0 0 12px", fontSize: "1.5rem" }}>
          Falta configurar Supabase
        </h1>
        <p>
          La aplicación necesita la URL y la clave pública de tu proyecto
          Supabase para iniciar. Créalo o consúltalo en el panel de Supabase,
          en <strong>Project Settings → API Keys</strong>.
        </p>
        <p>
          Crea el archivo <code>mi-cuadro/.env</code> junto a{" "}
          <code>package.json</code> y agrega:
        </p>
        <pre
          style={{
            overflowX: "auto",
            padding: "16px",
            borderRadius: "8px",
            background: "#f1f5f9",
          }}
        >
          <code>
            VITE_SUPABASE_URL=la_url_de_tu_proyecto{"\n"}
            VITE_SUPABASE_ANON_KEY=tu_clave_publica
          </code>
        </pre>
        <p style={{ marginBottom: 0 }}>
          Guarda el archivo y reinicia el servidor con <code>npm run dev</code>.
          No compartas la clave en chats ni la publiques.
        </p>
      </section>
    </main>
  );
} else {
  void Promise.all([
    import("./App"),
    import("./context/AuthContext"),
    import("./context/NotificationProvider"),
  ]).then(([{ default: App }, { AuthProvider }, { default: NotificationProvider }]) => {
    window.localStorage.removeItem("mi-cuadro-demo-v1");

    root.render(
      <React.StrictMode>
        <StartupErrorBoundary>
          <MotionConfig reducedMotion="user">
            <BrowserRouter>
              <AuthProvider>
                <NotificationProvider>
                  <App />
                </NotificationProvider>
              </AuthProvider>
              <Analytics mode={import.meta.env.PROD ? "production" : "development"} />
            </BrowserRouter>
          </MotionConfig>
        </StartupErrorBoundary>
      </React.StrictMode>,
    );
  }).catch((error) => {
    console.error("No se pudieron cargar los módulos de inicio de la aplicación.", {
      name: error?.name,
    });
    root.render(<StartupFailure />);
  });
}