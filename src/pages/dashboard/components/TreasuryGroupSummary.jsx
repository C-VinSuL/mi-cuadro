import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Landmark, PiggyBank, RefreshCw, Wallet } from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { getTreasuryGroupSummary } from "../../../services/dashboardService";
import { supabase } from "../../../services/supabase";

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const TreasuryGroupSummary = () => {
  const { grupo, grupos, seleccionarGrupo, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async ({ showRefreshing = false } = {}) => {
    if (showRefreshing) setRefreshing(true);
    try {
      setRows(await getTreasuryGroupSummary());
      setError("");
      setLastUpdated(new Date());
    } catch (loadError) {
      console.error("Error cargando resumen financiero de grupos:", loadError);
      setError("No se pudo cargar el resumen financiero de los grupos.");
    } finally {
      setLoading(false);
      if (showRefreshing) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(load, 0);
    const intervalId = window.setInterval(load, 30000);
    const channel = supabase
      .channel(`resumen-financiero-${user?.id || "sesion"}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "aportes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "movimientos_fondo" }, load)
      .subscribe();

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [load, user?.id]);

  const groupIds = new Set(grupos.map((item) => item.id));
  const visibleRows = rows
    .filter((row) => groupIds.has(row.grupo_id))
    .sort((a, b) => Number(b.aportes_pendientes_revision || 0) - Number(a.aportes_pendientes_revision || 0));

  return (
    <section className="space-y-4" aria-labelledby="resumen-grupos-tesoreria">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-blue-700">Cartera supervisada</p>
          <h2 id="resumen-grupos-tesoreria" className="mt-1 text-2xl font-bold text-slate-900">Resumen financiero por grupo</h2>
          <p className="mt-1 text-sm text-slate-600">Aportes aprobados del periodo, comprobantes pendientes y saldo del fondo. Selecciona un grupo para ver su actividad en el tablero.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button type="button" onClick={() => load({ showRefreshing: true })} disabled={loading || refreshing} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:cursor-wait disabled:opacity-60">
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
          <span className="min-h-4 text-xs text-slate-500" aria-live="polite">
            {refreshing
              ? "Consultando los datos más recientes"
              : lastUpdated
                ? `Actualizado a las ${lastUpdated.toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
          </span>
        </div>
      </header>
      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500" role="status">Cargando resúmenes financieros...</p>
      ) : visibleRows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">No hay grupos disponibles para supervisar.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibleRows.map((row) => {
            const selected = grupo?.id === row.grupo_id;
            return (
              <article key={row.grupo_id} className={`rounded-xl border bg-white p-4 transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none ${Number(row.aportes_pendientes_revision) > 0 ? "border-amber-300" : selected ? "border-blue-400 ring-1 ring-blue-100" : "border-slate-200"}`}>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">{row.grupo_nombre}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
                    row.estado === "activo" ? "bg-emerald-50 text-emerald-800"
                      : row.estado === "borrador" ? "bg-amber-50 text-amber-800"
                        : "bg-slate-100 text-slate-700"
                  }`}>{row.estado === "borrador" ? "En preparación" : row.estado}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric icon={<Landmark size={15} />} label="Socios" value={row.socios} />
                  <Metric icon={<CheckCircle2 size={15} />} label="Pagaron periodo" value={row.aportes_aprobados} />
                  <Metric icon={<Wallet size={15} />} label="Recaudado" value={currency.format(row.recaudado_periodo)} />
                  <Metric icon={<PiggyBank size={15} />} label="Saldo del fondo" value={currency.format(row.saldo_fondo)} />
                </div>
                {Number(row.aportes_pendientes_revision) > 0 && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                    {row.aportes_pendientes_revision} comprobante{Number(row.aportes_pendientes_revision) === 1 ? "" : "s"} por revisar
                  </p>
                )}
                {selected ? (
                  <span aria-current="true" className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600">
                    <CheckCircle2 size={16} /> Grupo actual
                  </span>
                ) : (
                  <button type="button" onClick={() => seleccionarGrupo(row.grupo_id)} className="mt-4 w-full rounded-lg border border-blue-700 px-3 py-2 text-sm font-semibold text-blue-800 transition-colors duration-150 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transition-none">
                    Ver grupo
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

const Metric = ({ icon, label, value }) => (
  <div className="min-w-0">
    <p className="flex items-center gap-1.5 text-xs text-slate-500">{icon}{label}</p>
    <p className="mt-1 truncate font-semibold text-slate-900">{value}</p>
  </div>
);

export default TreasuryGroupSummary;
