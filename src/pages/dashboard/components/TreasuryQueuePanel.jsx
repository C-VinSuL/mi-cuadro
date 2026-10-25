import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Clock3, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { getTreasuryPendingSummary } from "../../../services/dashboardService";
import { supabase } from "../../../services/supabase";

const TreasuryQueuePanel = () => {
  const { user, grupos } = useAuth();
  const [summary, setSummary] = useState({ receipts: 0, walletRequests: 0 });
  const [error, setError] = useState("");

  const loadSummary = useCallback(async () => {
    try {
      const result = await getTreasuryPendingSummary(grupos.map((grupo) => grupo.id));
      setSummary(result);
      setError("");
    } catch (loadError) {
      console.error("Error cargando pendientes de tesorería:", loadError);
      setError("No se pudieron actualizar los pendientes financieros.");
    }
  }, [grupos]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadSummary, 0);
    const intervalId = window.setInterval(loadSummary, 30000);
    const groupIds = new Set(grupos.map((grupo) => grupo.id));
    const channel = supabase
      .channel(`pendientes-tesoreria-${user?.id || "sesion"}-${crypto.randomUUID()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "aportes"
      }, (payload) => {
        const groupId = payload.new?.grupo_id || payload.old?.grupo_id;
        if (!groupId || groupIds.has(groupId)) loadSummary();
      })
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "solicitudes_billetera"
      }, () => loadSummary())
      .subscribe();

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [grupos, loadSummary, user?.id]);

  return (
    <section className="space-y-4" aria-labelledby="tesoreria-pendientes-titulo">
      <header>
        <p className="text-sm font-semibold text-blue-700">Seguimiento financiero</p>
        <h2 id="tesoreria-pendientes-titulo" className="mt-1 text-2xl font-bold text-slate-900">Pendientes de tesorería</h2>
        <p className="mt-1 text-sm text-slate-600">Las cifras se actualizan automáticamente y también puedes abrir cada cola para revisar su detalle.</p>
      </header>
      {error && <p className="border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">{error}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <Link to="/aportes?estado=pendiente" className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transform-none motion-reduce:transition-none">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Clock3 size={21} /></span>
            <div>
              <p className="font-semibold text-slate-900">Comprobantes de aportes</p>
              <p className="mt-1 text-sm text-slate-500">Abrir cola y revisar comprobantes</p>
            </div>
          </div>
          <span className="flex items-center gap-2 text-xl font-bold text-slate-900">{summary.receipts}<ArrowRight size={17} className="text-slate-400 transition group-hover:translate-x-1" /></span>
        </Link>
        <Link to="/admin/billetera" className="group flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 motion-reduce:transform-none motion-reduce:transition-none">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Wallet size={21} /></span>
            <div>
              <p className="font-semibold text-slate-900">Solicitudes de billetera</p>
              <p className="mt-1 text-sm text-slate-500">Abrir solicitudes por revisar</p>
            </div>
          </div>
          <span className="flex items-center gap-2 text-xl font-bold text-slate-900">{summary.walletRequests}<ArrowRight size={17} className="text-slate-400 transition group-hover:translate-x-1" /></span>
        </Link>
      </div>
      {summary.receipts === 0 && summary.walletRequests === 0 && !error && (
        <p className="flex items-center gap-2 text-sm text-emerald-800"><CheckCircle2 size={17} /> No hay revisiones financieras pendientes.</p>
      )}
    </section>
  );
};

export default TreasuryQueuePanel;
